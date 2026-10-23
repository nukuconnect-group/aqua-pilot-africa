// Génère une photo réaliste d'un produit de caisse et l'enregistre (une seule fois par nom de produit).
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
const BUCKET = "product-images";

const Body = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });
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
  const { name, slug } = parsed.data;

  const storage = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!).storage.from(BUCKET);
  const path = `${slug}.png`;
  const { data: existing } = await storage.list("", { search: path, limit: 1 });
  if (existing?.some((f) => f.name === path)) return json({ path });

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "Service indisponible" }, 500);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      modalities: ["image", "text"],
      messages: [{ role: "user", content: `Realistic product photo of "${name}" (aquaculture / fish farm / food product sold in West Africa), centered, studio lighting, plain light background, square, no text, no logo, no brand.` }],
    }),
  });
  if (res.status === 429) return json({ error: "Trop de demandes, réessayez dans un instant" }, 429);
  if (res.status === 402) return json({ error: "Crédits IA épuisés" }, 402);
  if (!res.ok) return json({ error: "Génération impossible" }, 502);
  const out = await res.json();
  const url: string | undefined = out?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const b64 = url?.split(",")[1];
  if (!b64) return json({ error: "Aucune image produite" }, 502);
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const { error } = await storage.upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error && !/exists/i.test(error.message)) return json({ error: "Enregistrement impossible" }, 500);
  return json({ path });
});
