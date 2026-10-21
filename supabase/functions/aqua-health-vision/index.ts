import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { enforceFishPhoto } from './result.ts';

const BodySchema = z.object({
  mode: z.enum(['image', 'species']), domain: z.enum(['algae', 'fish']).optional(),
  imageBase64: z.string().max(12 * 1024 * 1024).optional(),
  species: z.string().max(200).optional(), language: z.string().max(80).optional(),
});
const ResultSchema = z.object({
  subject: z.string().nullable().optional(), isFishPhoto: z.boolean().optional(),
  rejectionReason: z.string().nullable().optional(), species: z.string().nullable().optional(),
  averageWeight: z.number().nullable().optional(), observations: z.array(z.string()).default([]),
  diseases: z.array(z.object({ name: z.string(), severity: z.enum(['low', 'medium', 'high']),
    confidence: z.number().min(0).max(100), description: z.string().optional(), causes: z.string().optional(),
    treatment: z.string().optional(), prevention: z.string().optional() })).default([]),
  recommendations: z.array(z.string()).default([]),
});
// Validate existing application users without moving their data or accounts.
const APP_URL = 'https://hhsvraqchtqqgaezhnzn.supabase.co';
const APP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoc3ZyYXFjaHRxcWdhZXpobnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTQ0OTUsImV4cCI6MjA3NzY5MDQ5NX0.yPX0oLUaW5L2_d43MB7X8xpwPaTGCMDNsWKx9JbGrbA';

const SYSTEM_ALGAE = `Tu es AquaHealth AI, un expert en phycologie et en algoculture (spiruline, chlorella, nannochloropsis,
gracilaria, kappaphycus, ulva...). Tu maîtrises les contaminations biologiques (bactéries, champignons, protozoaires brouteurs,
algues concurrentes, cyanobactéries indésirables), les maladies des macro-algues (ice-ice disease, épiphytes, nécroses),
les dérives physico-chimiques (pH, salinité, nutriments, lumière, température) et les traitements/corrections réels
(dosages, durées, protocoles de désinfection, renouvellement de milieu, ajustement nutritif).
Tu réponds UNIQUEMENT en JSON valide, en français, avec des informations réelles et vérifiables.
Si une information est incertaine, indique-le dans le champ concerné plutôt que d'inventer.`;

const SYSTEM_FISH = `Tu es AquaHealth AI, un vétérinaire aquacole expert (tilapia, clarias, carpe, crevette...).
Tu réponds UNIQUEMENT en JSON valide, en français, avec des informations réelles et vérifiables
(maladies réellement décrites en aquaculture, traitements et posologies usuelles).
Si une information est incertaine, indique-le dans le champ concerné plutôt que d'inventer.
Une photo ne permet pas de confirmer un diagnostic ni de prescrire un médicament : présente des hypothèses à confirmer par un vétérinaire.
N'invente aucun poids ni dosage. Le poids sans mesure et échelle doit être null.`;

const SCHEMA_HINT = `Format JSON attendu :
{
  "subject": "sujet effectivement visible, ou null pour une recherche par espèce",
  "isFishPhoto": true|false,
  "rejectionReason": "explication si ce n'est pas une photo de vrais poissons, sinon null",
  "species": "nom de l'espèce identifiée ou analysée",
  "averageWeight": nombre|null,
  "observations": ["observation 1", "..."],
  "diseases": [
    { "name": "...", "severity": "low|medium|high", "confidence": 0-100,
      "description": "...", "causes": "...", "treatment": "produit, dosage, durée, voie",
      "prevention": "..." }
  ],
  "recommendations": ["action prophylactique 1", "..."]
}`;

serve(async (req) => {
  const cors = { ...corsHeaders, 'Content-Type': 'application/json' };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      APP_URL,
      APP_ANON,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: cors });
    }

    const input = BodySchema.safeParse(await req.json().catch(() => null));
    if (!input.success) return new Response(JSON.stringify({ error: 'La demande est invalide. Choisissez une photo ou saisissez une espèce.' }), { status: 400, headers: cors });
    const body = input.data;
    const mode = body.mode;
    const domain: "algae" | "fish" = body.domain === "algae" ? "algae" : "fish";
    const SYSTEM = mode === 'image' || domain === 'fish' ? SYSTEM_FISH : SYSTEM_ALGAE;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Service IA non configuré" }), { status: 500, headers: cors });
    }

    let content: unknown;
    if (mode === "species") {
      const species = String(body.species ?? "").trim();
      if (!species) {
        return new Response(JSON.stringify({ error: "Espèce manquante" }), { status: 400, headers: cors });
      }
      content = domain === "algae"
        ? `Espèce / souche d'algue cultivée : "${species}".
Liste les maladies, contaminations et dysfonctionnements réellement observés sur cette algue en culture
(contaminants biologiques, brouteurs, épiphytes, algues concurrentes, dérives de pH/salinité/nutriments/lumière),
avec pour chacun : causes, symptômes visibles sur la culture, traitement ou correction (produit, dosage, durée, protocole)
et prévention. Ajoute des recommandations prophylactiques concrètes pour la conduite des bassins.
${SCHEMA_HINT}`
        : `Espèce élevée : "${species}".
Liste les maladies les plus fréquentes réellement observées chez cette espèce en aquaculture,
avec pour chacune : causes, signes cliniques, traitement (produit, dosage, durée, voie d'administration)
et prévention. Ajoute des recommandations prophylactiques concrètes.
${SCHEMA_HINT}`;
    } else {
      const imageData = String(body.imageBase64 ?? "");
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/\r\n]+=*$/.test(imageData)) {
        return new Response(JSON.stringify({ error: "Photo illisible. Importez une image JPG, PNG ou WebP." }), { status: 400, headers: cors });
      }
      const extra = body.species ? `Espèce déclarée par l'éleveur : ${body.species}.` : "";
      content = [
        {
          type: "text",
          text: `Identifie D'ABORD ce que montre réellement cette image, indépendamment du nom déclaré. ${extra}
Renseigne subject avec le nom du sujet visible. isFishPhoto=true UNIQUEMENT pour une photographie de vrais poissons.
Un texte (même « poisson » ou un nom d'espèce), document, dessin, logo, autre animal, plante ou objet n'est PAS une photo de poissons.
Sans vrais poissons visibles ou si l'image est trop floue, isFishPhoto=false, explique dans rejectionReason pourquoi l'analyse n'est pas possible ; species=null, averageWeight=null, observations=[], diseases=[], recommendations=[].
Si de vrais poissons sont visibles, reconnais l'espèce si possible (sinon null), décris les signes visibles et propose uniquement des hypothèses sanitaires prudentes à confirmer. Aucun diagnostic certain sur photo seule.
averageWeight=null : le poids ne peut pas être établi sur cette photo. Pas de prescription ou dosage médicamenteux sur la seule photo.
${SCHEMA_HINT}`,
        },
        { type: "image_url", image_url: { url: imageData } },
      ];
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content: `${SYSTEM}\n\nRéponds impérativement dans la langue suivante : ${String(body.language ?? "Français")}. Tous les textes libres (descriptions, recommandations, traitements) doivent être dans cette langue.`,
          },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.json().catch(() => null);
      const status = aiRes.status;
      const safeMessage = detail?.error?.message || detail?.message;
      const message = typeof safeMessage === 'string' ? safeMessage : aiRes.status === 429
        ? "Trop de requêtes IA, réessayez dans un instant."
        : aiRes.status === 402
        ? "Crédits IA épuisés. Ajoutez des crédits pour continuer."
        : aiRes.status === 403 ? "L’accès à l’analyse IA est désactivé. Un administrateur doit le rétablir."
        : "L’analyse IA est indisponible pour le moment.";
      console.error("aqua-health-vision gateway error", aiRes.status);
      return new Response(JSON.stringify({ error: message }), { status, headers: cors });
    }

    const json = await aiRes.json();
    const message = json?.choices?.[0]?.message;
    if (message?.refusal || !message?.content) return new Response(JSON.stringify({ error: message?.refusal || 'L’IA n’a pas pu analyser cette image.' }), { status: 422, headers: cors });
    const raw = message.content;
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    const validated = ResultSchema.safeParse(parsed);
    if (!validated.success) return new Response(JSON.stringify({ error: 'La réponse de l’analyse est incomplète. Aucun diagnostic ne peut être affiché.' }), { status: 502, headers: cors });

    return new Response(
      JSON.stringify(enforceFishPhoto(validated.data, mode)),
      { headers: cors },
    );
  } catch (e) {
    console.error("aqua-health-vision error", e);
    return new Response(JSON.stringify({ error: "Erreur interne de l'analyse" }), { status: 500, headers: cors });
  }
});
