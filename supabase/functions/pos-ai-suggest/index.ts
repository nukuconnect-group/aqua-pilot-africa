// Suggestions de vente pour la caisse : propose des produits et quantités à partir du panier.
// Aucune vente n'est enregistrée ici : l'utilisateur confirme dans l'écran de caisse.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Base de l'application (comptes existants) : sert uniquement à vérifier l'utilisateur.
const APP_URL = "https://hhsvraqchtqqgaezhnzn.supabase.co";
const APP_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoc3ZyYXFjaHRxcWdhZXpobnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTQ0OTUsImV4cCI6MjA3NzY5MDQ5NX0.yPX0oLUaW5L2_d43MB7X8xpwPaTGCMDNsWKx9JbGrbA";

const Line = z.object({ name: z.string().min(1).max(120), quantity: z.number().min(0).max(1e7), unitPrice: z.number().min(0).max(1e10) });
const Product = z.object({ name: z.string().min(1).max(120), price: z.number().min(0).max(1e10), quantity: z.number().nullable().optional(), unit: z.string().max(20).nullable().optional() });
const Body = z.object({ cart: z.array(Line).max(50), catalog: z.array(Product).min(1).max(200), request: z.string().max(300).optional() });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
  const { cart, catalog, request } = parsed.data;

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "Assistant indisponible" }, 500);

  const schema = {
    type: "object", additionalProperties: false, required: ["suggestions"],
    properties: { suggestions: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["name", "quantity", "reason"],
      properties: { name: { type: "string" }, quantity: { type: "number" }, reason: { type: "string" } },
    } } },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions:
        "Tu aides un vendeur en caisse d'une exploitation aquacole. Propose au plus 4 produits à ajouter ou des quantités à ajuster, " +
        "UNIQUEMENT parmi les noms exacts du catalogue fourni, sans dépasser la quantité disponible. Raison courte en français (moins de 12 mots). " +
        "Si rien de pertinent, renvoie une liste vide. N'invente jamais de produit ni de prix.",
      input: [{ role: "user", content: JSON.stringify({ panier: cart, catalogue: catalog, demande: request || null }) }],
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "pos_suggestions", strict: true, schema } },
      store: false,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    if (res.status === 402) return json({ error: "Crédits IA épuisés. Rechargez les crédits pour utiliser l'assistant." }, 402);
    if (res.status === 429) return json({ error: "Assistant très sollicité, réessayez dans un instant." }, 429);
    return json({ error: "Assistant indisponible pour le moment." }, res.status >= 500 ? 502 : res.status);
  }

  // Lecture du flux et assemblage du texte final.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      try { const ev = JSON.parse(l.slice(5).trim()); if (ev.type === "response.output_text.delta") text += ev.delta; } catch { /* ignore */ }
    }
  }

  let suggestions: { name: string; quantity: number; reason: string }[] = [];
  try { suggestions = JSON.parse(text).suggestions || []; } catch { return json({ error: "Réponse de l'assistant illisible, réessayez." }, 502); }
  // Ne garder que les produits réels du catalogue, quantités valides et disponibles.
  const byName = new Map(catalog.map((p) => [p.name.toLowerCase(), p]));
  const clean = suggestions.flatMap((s) => {
    const p = byName.get(s.name.toLowerCase());
    if (!p || !(s.quantity > 0)) return [];
    const max = typeof p.quantity === "number" ? p.quantity : Infinity;
    return [{ name: p.name, quantity: Math.min(s.quantity, max), unitPrice: p.price, reason: s.reason }];
  }).filter((s) => s.quantity > 0).slice(0, 4);
  return json({ suggestions: clean });
});
