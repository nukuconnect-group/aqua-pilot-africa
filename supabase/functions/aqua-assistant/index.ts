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
- Cite le nom de l'unité ou du bassin concerné quand c'est utile.

CALCULS FINANCIERS :
- Quand on te demande le chiffre d'affaires, la rentabilité, les dépenses ou la marge, donne le chiffre exact du bloc FINANCES,
  puis explique le calcul simplement (ex : "CA 500 000 − coûts 320 000 = bénéfice 180 000").
- Compare avec le mois précédent quand c'est utile.
- Termine par 1 ou 2 conseils concrets pour améliorer la situation.
- Pour les questions financières, tu peux utiliser des listes courtes et du gras pour les chiffres clés.

DONNÉES EXTERNES :
- Tu peux compléter avec tes connaissances générales (prix de marché habituels, bonnes pratiques aquacoles, saisons),
  mais commence alors la phrase par "Information générale :" et ne les présente jamais comme les chiffres de la ferme.`;

const num = (v: unknown) => Number(v) || 0;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

/** Construit un résumé factuel des données réelles de l'utilisateur (RLS appliquée, filtré par unité). */
const buildFarmContext = async (supabase: any, unitId?: string | null, unitName?: string | null): Promise<string> => {
  const now = new Date();
  const since = new Date(); since.setDate(since.getDate() - 30);
  const from = isoDay(since);
  const today = isoDay(now);
  const monthStart = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const prevStart = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const scope = (q: any, col = 'unit_id') => (unitId ? q.eq(col, unitId) : q);

  let unitsQ = supabase.from('production_units').select('id,name,type,capacity,current_stock,is_active');
  if (unitId) unitsQ = unitsQ.eq('id', unitId);
  let batchesQ = supabase.from('livestock_batches').select('species,quantity,average_weight,total_weight,status,unit_name');
  let cyclesQ = supabase.from('production_cycles').select('name,species,status,current_quantity,unit_name,start_date');
  if (unitId) batchesQ = batchesQ.eq('unit_id', unitId);
  if (unitName) cyclesQ = cyclesQ.eq('unit_name', unitName);

  const [units, infra, batches, cycles, stocks, health, feeding, salesQ, purchasesQ, employeesQ] = await Promise.all([
    unitsQ,
    scope(supabase.from('unit_infrastructures').select('id,name,type,status,capacity,unit_id')),
    batchesQ,
    cyclesQ,
    scope(supabase.from('feed_stocks').select('feed_type,quantity,unit,min_threshold')),
    scope(supabase.from('health_records').select('date,mortality,temperature,ph,oxygen,average_weight').gte('date', from).order('date', { ascending: false }).limit(500)),
    scope(supabase.from('feeding_records').select('date,quantity,feed_type,mortality').gte('date', prevStart).order('date', { ascending: false }).limit(1000)),
    scope(supabase.from('sales').select('id,date,total_amount,paid_amount,client_name,status').gte('date', prevStart).limit(1000)),
    scope(supabase.from('purchases').select('date,amount,paid_amount,category,status').gte('date', prevStart).limit(1000)),
    scope(supabase.from('employees').select('salary,status')),
  ]);

  const U = units.data ?? [];
  const I = infra.data ?? [];
  const B = batches.data ?? [];
  const C = (cycles.data ?? []).filter((c: any) => c.status === 'active');
  const S = stocks.data ?? [];
  const H = health.data ?? [];
  const F = feeding.data ?? [];
  const V = (salesQ.data ?? []).filter((v: any) => v.status !== 'cancelled');
  const P = (purchasesQ.data ?? []).filter((p: any) => p.status !== 'cancelled');
  const E = (employeesQ.data ?? []).filter((e: any) => !e.status || e.status === 'active');

  // Top produits du mois
  const monthSaleIds = V.filter((v: any) => v.date >= monthStart).map((v: any) => v.id);
  let topProducts = '';
  if (monthSaleIds.length) {
    const { data: items } = await supabase.from('sale_items').select('name,total,quantity').in('sale_id', monthSaleIds.slice(0, 300));
    const agg: Record<string, number> = {};
    (items ?? []).forEach((i: any) => { agg[i.name] = (agg[i.name] ?? 0) + num(i.total); });
    topProducts = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, t]) => `${n} ${fmt(t)}`).join(' ; ');
  }

  const period = (start: string, end?: string) => {
    const inP = (d: string) => d >= start && (!end || d < end);
    const revenue = V.filter((v: any) => inP(v.date)).reduce((s: number, v: any) => s + num(v.total_amount), 0);
    const received = V.filter((v: any) => inP(v.date)).reduce((s: number, v: any) => s + num(v.paid_amount), 0);
    const purchases = P.filter((p: any) => inP(p.date)).reduce((s: number, p: any) => s + num(p.amount), 0);
    const salesCount = V.filter((v: any) => inP(v.date)).length;
    const feed = F.filter((f: any) => inP(f.date)).reduce((s: number, f: any) => s + num(f.quantity), 0);
    return { revenue, received, purchases, salesCount, feed };
  };
  const cur = period(monthStart);
  const prev = period(prevStart, monthStart);
  const payroll = E.reduce((s: number, e: any) => s + num(e.salary), 0);
  const curCosts = cur.purchases + payroll;
  const prevCosts = prev.purchases + payroll;
  const evol = (a: number, b: number) => (b > 0 ? `${(((a - b) / b) * 100).toFixed(1)} %` : 'non calculable (mois précédent à 0)');
  const byCat: Record<string, number> = {};
  P.filter((p: any) => p.date >= monthStart).forEach((p: any) => { byCat[p.category || 'autre'] = (byCat[p.category || 'autre'] ?? 0) + num(p.amount); });

  const totalFish = B.reduce((s: number, b: any) => s + num(b.quantity), 0);
  const biomass = B.reduce((s: number, b: any) => s + num(b.total_weight), 0);
  const mortality30 = H.reduce((s: number, h: any) => s + num(h.mortality), 0) + F.filter((f: any) => f.date >= from).reduce((s: number, f: any) => s + num(f.mortality), 0);
  const last = H[0];
  const lowStock = S.filter((s: any) => num(s.quantity) <= num(s.min_threshold));

  if (!U.length && !B.length && !C.length && !V.length && !P.length) {
    return "DONNÉES RÉELLES DE LA FERME :\nAucune donnée enregistrée pour cette unité. Dis-le clairement et invite l'utilisateur à enregistrer ventes, achats, lots ou cycles.";
  }

  const lines = [
    `DONNÉES RÉELLES ${unitName ? `DE L'UNITÉ « ${unitName} »` : 'DE TOUTES LES UNITÉS'} (au ${today}) :`,
    `- Unités : ${U.map((u: any) => `${u.name} [${u.type ?? '-'}]`).join(' ; ') || 'aucune'}`,
    `- Infrastructures (${I.length}) : ${I.slice(0, 25).map((i: any) => `${i.name} (${i.type ?? '-'}, ${i.status ?? '-'})`).join(' ; ') || 'aucune'}`,
    `- Lots : ${B.length} lot(s), ${totalFish} sujets, biomasse ${biomass.toFixed(1)} kg`,
    ...B.slice(0, 15).map((b: any) => `   • ${b.species} — ${num(b.quantity)} sujets, poids moyen ${num(b.average_weight)} g, statut ${b.status ?? '-'}`),
    `- Cycles actifs (${C.length}) : ${C.map((c: any) => `${c.name} [${c.species ?? '-'}, ${num(c.current_quantity)} sujets, début ${c.start_date ?? '-'}]`).join(' ; ') || 'aucun'}`,
    '',
    `FINANCES — MOIS EN COURS (depuis ${monthStart}) :`,
    `- Chiffre d'affaires : ${fmt(cur.revenue)} (${cur.salesCount} vente(s)), encaissé ${fmt(cur.received)}, reste à encaisser ${fmt(cur.revenue - cur.received)}`,
    `- Achats / dépenses : ${fmt(cur.purchases)}${Object.keys(byCat).length ? ` (${Object.entries(byCat).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')})` : ''}`,
    `- Masse salariale mensuelle (salaires des employés actifs) : ${fmt(payroll)}`,
    `- Coûts totaux estimés : ${fmt(curCosts)}`,
    `- Résultat (CA - coûts) : ${fmt(cur.revenue - curCosts)} ; marge : ${cur.revenue > 0 ? `${(((cur.revenue - curCosts) / cur.revenue) * 100).toFixed(1)} %` : 'non calculable (CA nul)'} ; ${cur.revenue - curCosts >= 0 ? 'RENTABLE ce mois' : 'NON RENTABLE ce mois'}`,
    `- Meilleurs produits du mois : ${topProducts || 'aucune vente détaillée'}`,
    `FINANCES — MOIS PRÉCÉDENT (${prevStart} → ${monthStart}) :`,
    `- CA ${fmt(prev.revenue)}, achats ${fmt(prev.purchases)}, résultat ${fmt(prev.revenue - prevCosts)}`,
    `- Évolution du CA : ${evol(cur.revenue, prev.revenue)} ; évolution des achats : ${evol(cur.purchases, prev.purchases)}`,
    '',
    `PRODUCTION :`,
    `- Aliment distribué : ce mois ${cur.feed.toFixed(1)} kg, mois précédent ${prev.feed.toFixed(1)} kg`,
    `- Mortalités sur 30 jours : ${mortality30}`,
    `- Stocks d'aliment/intrants : ${S.map((s: any) => `${s.feed_type} ${num(s.quantity)} ${s.unit ?? 'kg'}`).join(' ; ') || 'aucun'}`,
    lowStock.length ? `- ALERTE stock bas : ${lowStock.map((s: any) => s.feed_type).join(', ')}` : '',
    last ? `- Dernier relevé d'eau (${last.date}) : T ${last.temperature ?? '-'} °C, pH ${last.ph ?? '-'}, O2 ${last.oxygen ?? '-'} mg/L` : "- Aucun relevé d'eau sur 30 jours",
  ];

  return lines.filter((l) => l !== undefined).join('\n');
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


    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "fetch",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: fullSystemPrompt,
        input: cleanedMessages
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({ role: m.role, content: m.content })),
        reasoning: { effort: "low" },
        store: false,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      console.error(`[${requestId}] AI gateway error:`, response.status, errorText);
      const message = response.status === 429
        ? "Trop de demandes. Réessaie dans un moment."
        : response.status === 402
          ? "Crédits IA épuisés. Ajoutez des crédits dans les paramètres de l'espace de travail."
          : `Erreur assistant (${response.status})`;
      const status = [400, 401, 402, 403, 404, 429].includes(response.status) ? response.status : 500;
      return new Response(JSON.stringify({ error: message, request_id: requestId }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Traduit le flux Responses en format SSE "choices/delta" attendu par le client.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const upstream = response.body.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await upstream.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, idx).trim();
              buffer = buffer.slice(idx + 1);
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const evt = JSON.parse(payload);
                if (evt.type === 'response.output_text.delta' && evt.delta) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`));
                } else if (evt.type === 'response.failed' || evt.type === 'error') {
                  console.error(`[${requestId}] stream error`, payload.slice(0, 300));
                }
              } catch { /* ligne partielle */ }
            }
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    const aigHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { if (k.toLowerCase().startsWith('x-lovable-aig-')) aigHeaders[k] = v; });
    return new Response(stream, {
      headers: { ...corsHeaders, ...aigHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error(`[${requestId}] Aqua assistant error:`, error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue", request_id: requestId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
