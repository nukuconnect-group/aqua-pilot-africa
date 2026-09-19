import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  if (/^http:\/\/localhost:(8080|5173)$/.test(origin)) return true;
  if (/^https:\/\/.*\.lovable\.app$/.test(origin)) return true;
  if (/^https:\/\/([a-z0-9-]+\.)*aquapilote\.com$/.test(origin)) return true;
  return false;
};

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : "https://app.aquapilote.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
});

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
Si une information est incertaine, indique-le dans le champ concerné plutôt que d'inventer.`;

const SCHEMA_HINT = `Format JSON attendu :
{
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
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentification requise" }), { status: 401, headers: cors });
    }

    const body = await req.json();
    const mode: "image" | "species" = body.mode === "species" ? "species" : "image";
    const domain: "algae" | "fish" = body.domain === "algae" ? "algae" : "fish";
    const SYSTEM = domain === "algae" ? SYSTEM_ALGAE : SYSTEM_FISH;

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
      if (!imageData.startsWith("data:image/")) {
        return new Response(JSON.stringify({ error: "Image invalide" }), { status: 400, headers: cors });
      }
      const extra = body.species ? `Espèce déclarée par l'éleveur : ${body.species}.` : "";
      content = [
        {
          type: "text",
          text: `Analyse cette photo de poissons d'élevage. ${extra}
Identifie l'espèce si possible, estime le poids moyen individuel en grammes (champ averageWeight),
décris les anomalies visibles (lésions, taches, nageoires, branchies, comportement) et déduis les
maladies probables avec un niveau de confiance. Donne les traitements et les recommandations.
${SCHEMA_HINT}`,
        },
        { type: "image_url", image_url: { url: imageData } },
      ];
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
      const detail = await aiRes.text();
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502;
      const message = aiRes.status === 429
        ? "Trop de requêtes IA, réessayez dans un instant."
        : aiRes.status === 402
        ? "Crédits IA épuisés. Ajoutez des crédits pour continuer."
        : `Analyse IA indisponible (${aiRes.status}).`;
      console.error("aqua-health-vision gateway error", aiRes.status, detail);
      return new Response(JSON.stringify({ error: message }), { status, headers: cors });
    }

    const json = await aiRes.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      const match = String(raw).match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { diseases: [], recommendations: [] };
    }

    return new Response(
      JSON.stringify({
        species: parsed.species ?? body.species ?? null,
        averageWeight: typeof parsed.averageWeight === "number" ? parsed.averageWeight : null,
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        diseases: Array.isArray(parsed.diseases) ? parsed.diseases : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      }),
      { headers: cors },
    );
  } catch (e) {
    console.error("aqua-health-vision error", e);
    return new Response(JSON.stringify({ error: "Erreur interne de l'analyse" }), { status: 500, headers: cors });
  }
});
