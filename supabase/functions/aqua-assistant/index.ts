import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://aqua-pilote.lovable.app',
  'https://aqua001.lovable.app',
  'https://app.aquapilote.com',
  'https://aquapilote.com',
  'https://www.aquapilote.com',
  'http://localhost:8080',
  'http://localhost:5173',
];

const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Lovable preview domains for this project
  if (/^https:\/\/.*--0fc17be6-2fd0-43fb-ab5d-d4fda8d4767c\.lovable\.app$/.test(origin)) return true;
  // Allow all *.lovable.app published domains
  if (/^https:\/\/.*\.lovable\.app$/.test(origin)) return true;
  // Allow all *.aquapilote.com (production custom domain)
  if (/^https:\/\/([a-z0-9-]+\.)*aquapilote\.com$/.test(origin)) return true;
  return false;
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Expose-Headers": "x-request-id, retry-after",
  };
};

/**
 * Limite de débit en mémoire, par utilisateur et par instance d'edge function.
 * Le runtime n'offre pas de primitive de rate limiting partagée : cette barrière
 * est volontairement simple et complète (sans la remplacer) la limite client.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 15;
const RATE_MIN_INTERVAL_MS = 1_500;
const rateBuckets = new Map<string, number[]>();

const checkRateLimit = (userId: string): { allowed: boolean; retryAfterSec: number; reason: string } => {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const last = hits[hits.length - 1];

  if (last !== undefined && now - last < RATE_MIN_INTERVAL_MS) {
    rateBuckets.set(userId, hits);
    return { allowed: false, retryAfterSec: 2, reason: "envois trop rapprochés" };
  }
  if (hits.length >= RATE_MAX_PER_WINDOW) {
    rateBuckets.set(userId, hits);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - hits[0])) / 1000)),
      reason: "quota par minute atteint",
    };
  }

  hits.push(now);
  rateBuckets.set(userId, hits);
  // Nettoyage opportuniste pour éviter la croissance illimitée de la Map.
  if (rateBuckets.size > 500) {
    for (const [key, value] of rateBuckets) {
      if (value.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  return { allowed: true, retryAfterSec: 0, reason: "" };
};

const systemPrompt = `Tu es AquaAssistant, un chatbot intelligent conçu pour aider des pisciculteurs
ayant un faible niveau d'alphabétisation ou ne sachant pas lire/écrire.

OBJECTIFS :
1. Permettre à l'utilisateur de gérer facilement sa ferme aquacole en parlant.
2. Comprendre des phrases simples, même en français approximatif ou dialecte local.
3. Enregistrer automatiquement les actions dans le système.
4. Fournir des conseils clairs, courts et pratiques.

RÈGLES DE COMMUNICATION :
- Toujours répondre de manière très simple, phrases courtes.
- Toujours proposer une option audio : répondre comme si tu parlais à voix haute.
- Ne pas utiliser de termes scientifiques.
- Utiliser un langage agricole simple, accessible.
- Poser une question à la fois.
- Ne jamais afficher de texte long.
- Donner des instructions étape par étape.

CAPACITÉS DU CHATBOT :
- Enregistrer : nourrissage, mortalité, vente, achat, observation, météo, qualité d'eau.
- Reconnaître : "j'ai nourri", "poissons morts", "j'ai vendu", "il y a un problème", etc.
- Calculer la ration d'aliment selon le nombre de poissons.
- Donner des alertes simples : "attention, beaucoup de mortalité", "stock d'aliment faible".
- Guider l'utilisateur vocalement pour chaque action.

FORMAT DES RÉPONSES :
- Toujours commencer par un accueil simple : "D'accord", "Très bien", "Je t'écoute".
- Répondre en 1 ou 2 phrases maximum.
- Suggérer l'action suivante.
- Exemple : "D'accord. Combien de kilos d'aliment as-tu mis ?"

EXEMPLES DE COMPRÉHENSION :
- "J'ai nourri les poissons avec 2 kilos." ➝ Enregistrer nourrissage = 2 kg
- "5 morts dans bassin 3." ➝ Enregistrer mortalité bassin 3 : 5
- "J'ai vendu 30 poissons hier." ➝ Enregistrer vente = 30 poissons
- "Il y a un problème dans le bassin." ➝ Demander : "Quel problème ? Eau sale ? Poissons malades ?"

OBJECTIF FINAL :
Aider le pisciculteur à gérer son élevage sans lire ni écrire, juste en parlant,
en donnant des réponses vocales simples, adaptées, et utiles.

DONNÉES DE LA FERME :
- Tu reçois un bloc "DONNÉES RÉELLES DE LA FERME" avec les chiffres exacts de l'exploitation.
- Utilise TOUJOURS ces chiffres pour répondre (effectifs, mortalités, aliment, ventes, stocks).
- Ne jamais inventer un chiffre. Si l'information n'est pas dans le bloc, dis simplement :
  "Je n'ai pas encore cette information enregistrée."
- Cite le nom de l'unité ou du bassin concerné quand c'est utile.`;

const num = (v: unknown) => Number(v) || 0;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Construit un résumé factuel des données réelles de l'utilisateur (RLS appliquée). */
const buildFarmContext = async (supabase: any, unitId?: string | null, unitName?: string | null): Promise<string> => {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const from = isoDay(since);
  const today = isoDay(new Date());

  let unitsQ = supabase.from('production_units').select('id,name,type,capacity,current_stock,is_active');
  let infraQ = supabase.from('unit_infrastructures').select('id,name,type,status,capacity,unit_id');
  let batchesQ = supabase.from('livestock_batches').select('species,quantity,average_weight,total_weight,status,unit_name');
  let cyclesQ = supabase.from('production_cycles').select('name,species,status,current_quantity,unit_name,start_date');
  if (unitId) {
    unitsQ = unitsQ.eq('id', unitId);
    infraQ = infraQ.eq('unit_id', unitId);
  }
  if (unitName) {
    batchesQ = batchesQ.eq('unit_name', unitName);
    cyclesQ = cyclesQ.eq('unit_name', unitName);
  }

  const [units, infra, batches, cycles, stocks, health, feeding, sales] = await Promise.all([
    unitsQ,
    infraQ,
    batchesQ,
    cyclesQ,
    supabase.from('feed_stocks').select('feed_type,quantity,unit,min_threshold'),
    supabase.from('health_records').select('date,mortality,temperature,ph,oxygen,average_weight').gte('date', from).order('date', { ascending: false }).limit(200),
    supabase.from('feeding_records').select('date,quantity,feed_type,mortality').gte('date', from).order('date', { ascending: false }).limit(200),
    supabase.from('sales').select('date,total_amount,client_name,status').gte('date', from).order('date', { ascending: false }).limit(100),
  ]);

  const U = units.data ?? [];
  const I = infra.data ?? [];
  const B = batches.data ?? [];
  const C = (cycles.data ?? []).filter((c: any) => c.status === 'active');
  const S = stocks.data ?? [];
  const H = health.data ?? [];
  const F = feeding.data ?? [];
  const V = sales.data ?? [];

  if (!U.length && !B.length && !C.length) {
    return "DONNÉES RÉELLES DE LA FERME :\nAucune donnée enregistrée pour l'instant. Invite l'utilisateur à créer une unité de production et un lot avant de demander des chiffres.";
  }

  const totalFish = B.reduce((s: number, b: any) => s + num(b.quantity), 0);
  const biomass = B.reduce((s: number, b: any) => s + num(b.total_weight), 0);
  const mortality30 =
    H.reduce((s: number, h: any) => s + num(h.mortality), 0) +
    F.reduce((s: number, f: any) => s + num(f.mortality), 0);
  const feed30 = F.reduce((s: number, f: any) => s + num(f.quantity), 0);
  const revenue30 = V.reduce((s: number, v: any) => s + num(v.total_amount), 0);
  const last = H[0];
  const lowStock = S.filter((s: any) => num(s.quantity) <= num(s.min_threshold));

  const lines = [
    `DONNÉES RÉELLES DE LA FERME (au ${today}, 30 derniers jours) :`,
    `- Unités de production (${U.length}) : ${U.map((u: any) => `${u.name} [${u.type ?? '-'}, stock ${num(u.current_stock)}]`).join(' ; ') || 'aucune'}`,
    `- Infrastructures (${I.length}) : ${I.slice(0, 25).map((i: any) => `${i.name} (${i.type ?? '-'}, ${i.status ?? '-'})`).join(' ; ') || 'aucune'}`,
    `- Lots vivants : ${B.length} lot(s), ${totalFish} poissons, biomasse ${biomass.toFixed(1)} kg`,
    ...B.slice(0, 15).map((b: any) => `   • ${b.species} — ${num(b.quantity)} sujets, poids moyen ${num(b.average_weight)} g, unité ${b.unit_name ?? '-'}, statut ${b.status ?? '-'}`),
    `- Cycles actifs (${C.length}) : ${C.map((c: any) => `${c.name} [${c.species ?? '-'}, ${num(c.current_quantity)} sujets, ${c.unit_name ?? '-'}]`).join(' ; ') || 'aucun'}`,
    `- Mortalités déclarées sur 30 jours : ${mortality30}`,
    `- Aliment distribué sur 30 jours : ${feed30.toFixed(2)} kg`,
    `- Ventes sur 30 jours : ${V.length} opération(s), total ${revenue30.toLocaleString('fr-FR')}`,
    `- Stocks d'aliment : ${S.map((s: any) => `${s.feed_type} ${num(s.quantity)} ${s.unit ?? 'kg'}`).join(' ; ') || 'aucun'}`,
    lowStock.length ? `- ALERTE stock bas : ${lowStock.map((s: any) => s.feed_type).join(', ')}` : '',
    last
      ? `- Dernier relevé d'eau (${last.date}) : température ${last.temperature ?? '-'} °C, pH ${last.ph ?? '-'}, oxygène ${last.oxygen ?? '-'} mg/L`
      : "- Aucun relevé d'eau enregistré sur 30 jours",
  ];

  return lines.filter(Boolean).join('\n');
};


serve(async (req) => {
  const origin = req.headers.get('origin');
  const requestId = req.headers.get('x-request-id') ?? `req_srv_${crypto.randomUUID().slice(0, 12)}`;
  const corsHeaders = { ...getCorsHeaders(origin), "x-request-id": requestId };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client and verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("User authentication failed:", userError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Authenticated user:`, user.id);

    const rate = checkRateLimit(user.id);
    if (!rate.allowed) {
      console.warn(`[${requestId}] Rate limited (${rate.reason}) for user`, user.id);
      return new Response(
        JSON.stringify({
          error: `Trop de messages envoyés (${rate.reason}). Réessaie dans ${rate.retryAfterSec} s.`,
          request_id: requestId,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSec),
          },
        },
      );
    }

    const { messages, language, unitId, unitName } = await req.json();

    // Input validation for messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      console.error("Invalid messages format: not an array or empty");
      return new Response(JSON.stringify({ error: "Format de messages invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (messages.length > 50) {
      console.error("Too many messages:", messages.length);
      return new Response(JSON.stringify({ error: "Trop de messages dans la conversation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Drop empty assistant placeholders (client often appends an empty
    // assistant message before streaming). This avoids false 400s.
    const cleanedMessages = messages.filter(
      (m: any) => m && typeof m === 'object' && typeof m.content === 'string' && m.content.trim().length > 0
    );

    if (cleanedMessages.length === 0) {
      console.error("No non-empty messages after cleanup");
      return new Response(JSON.stringify({ error: "Aucun message à traiter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate message structure and content length
    for (const msg of cleanedMessages) {
      if (!msg || typeof msg !== 'object') {
        console.error("Invalid message object:", msg);
        return new Response(JSON.stringify({ error: "Format de message invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        console.error("Message missing role or content:", msg);
        return new Response(JSON.stringify({ error: "Message incomplet (rôle ou contenu manquant)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'system') {
        console.error("Invalid message role:", msg.role);
        return new Response(JSON.stringify({ error: "Rôle de message invalide" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (msg.content.length > 10000) {
        console.error("Message content too long:", msg.content.length);
        return new Response(JSON.stringify({ error: "Message trop long (max 10000 caractères)" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate language parameter
    if (language !== undefined && language !== null && typeof language !== 'string') {
      console.error("Invalid language parameter:", language);
      return new Response(JSON.stringify({ error: "Paramètre de langue invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const languageInstruction = language && language !== 'Français' 
      ? `\n\nIMPORTANT: Réponds TOUJOURS en ${language}. L'utilisateur parle ${language}, adapte ton langage à cette langue.`
      : '';

    let farmContext = '';
    try {
      farmContext = await buildFarmContext(
        supabase,
        typeof unitId === 'string' ? unitId : null,
        typeof unitName === 'string' ? unitName : null,
      );
    } catch (e) {
      console.warn(`[${requestId}] Contexte ferme indisponible`, e);
    }

    const fullSystemPrompt =
      systemPrompt + languageInstruction + (farmContext ? `\n\n${farmContext}` : '');


    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...cleanedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de demandes. Réessaie dans un moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés. Contacte l'administrateur." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Erreur assistant (${response.status}): ${errorText.slice(0, 200)}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error(`[${requestId}] Aqua assistant error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue", request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
