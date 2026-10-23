// Photos des produits de caisse : renvoie les photos existantes et, sur demande, génère celles qui manquent
// (une seule fois par nom de produit). Les photos restent dans un espace privé, servies par liens signés.
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
const WEEK = 60 * 60 * 24 * 7;

const Item = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) });
const Body = z.object({ items: z.array(Item).min(1).max(200), generate: z.boolean().optional() });
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function generate(name: string, key: string): Promise<Uint8Array | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-image-2.5-sunburst",
      prompt: `Realistic product photo of "${name}" as sold at a fish farm shop in West Africa (fresh fish, smoked fish, fingerlings, fish feed bag, or similar). Centered, soft studio lighting, plain light background, square framing. No text, no logo, no brand.`,
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const out = await res.json();
  const b64: string | undefined = out?.data?.[0]?.b64_json;
  return b64 ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : null;
}

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
  const { items, generate: doGenerate } = parsed.data;

  const storage = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!).storage.from(BUCKET);
  const { data: files } = await storage.list("", { limit: 1000 });
  const have = new Set((files || []).map((f) => f.name));
  const key = Deno.env.get("LOVABLE_API_KEY");
  let generated = 0;
  let failure: string | null = null;

  for (const it of items) {
    const path = `${it.slug}.png`;
    if (have.has(path) || !doGenerate || !key || generated >= 8 || failure) continue;
    try {
      const bytes = await generate(it.name, key);
      if (!bytes) continue;
      const { error } = await storage.upload(path, bytes, { contentType: "image/png", upsert: false });
      if (!error || /exists/i.test(error.message)) { have.add(path); generated++; }
    } catch (e) {
      failure = (e as Error).message === "429" ? "Trop de demandes, réessayez dans un instant" : (e as Error).message === "402" ? "Crédits IA épuisés" : "Génération interrompue";
    }
  }

  const paths = items.map((i) => `${i.slug}.png`).filter((p) => have.has(p));
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await storage.createSignedUrls(paths, WEEK);
    (data || []).forEach((d) => { if (d.signedUrl && d.path) urls[d.path.replace(/\.png$/, "")] = d.signedUrl; });
  }
  const missing = items.filter((i) => !urls[i.slug]).length;
  return json({ urls, missing, generated, error: failure });
});
