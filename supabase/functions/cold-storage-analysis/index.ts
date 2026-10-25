// Analyse IA des températures réellement enregistrées des chambres froides d'une unité.
// Aucun relevé n'est créé ici ; l'IA ne reçoit que les mesures envoyées par l'écran.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const APP_URL = "https://hhsvraqchtqqgaezhnzn.supabase.co";
const APP_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoc3ZyYXFjaHRxcWdhZXpobnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTQ0OTUsImV4cCI6MjA3NzY5MDQ5NX0.yPX0oLUaW5L2_d43MB7X8xpwPaTGCMDNsWKx9JbGrbA";

const Reading = z.object({ time: z.string().max(40), value: z.number().min(-100).max(100) });
const Room = z.object({
  name: z.string().min(1).max(120),
  type: z.string().max(60),
  min: z.number().nullable(),
  max: z.number().nullable(),
  readings: z.array(Reading).max(300),
});
const Body = z.object({ rooms: z.array(Room).min(1).max(30) });
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Connexion requise" }, 401);
  const app = createClient(APP_URL, APP_ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await app.auth.getUser();
  if (!user) return json({ error: "Connexion requise" }, 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Demande invalide" }, 400);
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "Analyse indisponible" }, 500);

  const schema = {
    type: "object", additionalProperties: false, required: ["summary", "rooms"],
    properties: {
      summary: { type: "string" },
      rooms: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "status", "analysis", "recommendations"],
        properties: { name: { type: "string" }, status: { type: "string", enum: ["ok", "attention", "critique", "sans_donnees"] }, analysis: { type: "string" }, recommendations: { type: "array", items: { type: "string" } } } } },
    },
  };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions:
        "Tu es expert en chaîne du froid pour la conservation de poissons. Analyse UNIQUEMENT les relevés de température fournis pour chaque chambre froide " +
        "(tendance, stabilité, dépassements des limites si elles sont renseignées). Si une chambre n'a aucun relevé, statut sans_donnees et recommande d'enregistrer des relevés. " +
        "N'invente aucune mesure ni capteur. Les relevés sont ponctuels : ne déduis pas la durée exacte d'un dépassement. " +
        "Donne 2 à 4 recommandations concrètes et courtes par chambre, en français. Résumé global en 2 phrases.",
      input: [{ role: "user", content: JSON.stringify(parsed.data.rooms) }],
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "cold_analysis", strict: true, schema } },
      store: false,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    if (res.status === 402) return json({ error: "Crédits IA épuisés." }, 402);
    if (res.status === 429) return json({ error: "Analyse très sollicitée, réessayez dans un instant." }, 429);
    return json({ error: "Analyse indisponible pour le moment." }, 502);
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const l of lines) { if (!l.startsWith("data:")) continue; try { const ev = JSON.parse(l.slice(5).trim()); if (ev.type === "response.output_text.delta") text += ev.delta; } catch { /* */ } }
  }
  try { return json(JSON.parse(text)); } catch { return json({ error: "Réponse illisible, réessayez." }, 502); }
});
