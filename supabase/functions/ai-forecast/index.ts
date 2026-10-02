import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const num = (v: unknown) => Number(v) || 0;
const monthKey = (d: string) => d.slice(0, 7);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Non autorisé" }, 401);

    const body = await req.json().catch(() => ({}));
    const unitId = typeof body.unitId === "string" && body.unitId.length < 64 ? body.unitId : null;
    const unitName = typeof body.unitName === "string" ? body.unitName.slice(0, 120) : "toutes les unités";

    const since = new Date();
    since.setMonth(since.getMonth() - 11, 1);
    const from = since.toISOString().slice(0, 10);
    let salesQ = supabase.from("sales").select("date,total_amount,status").gte("date", from).limit(5000);
    let purchQ = supabase.from("purchases").select("date,amount,status").gte("date", from).limit(5000);
    let feedQ = supabase.from("feeding_records").select("date,quantity,mortality").gte("date", from).limit(5000);
    if (unitId) { salesQ = salesQ.eq("unit_id", unitId); purchQ = purchQ.eq("unit_id", unitId); feedQ = feedQ.eq("unit_id", unitId); }
    const [s, p, f] = await Promise.all([salesQ, purchQ, feedQ]);

    const months: Record<string, { month: string; revenue: number; expenses: number; feed: number; mortality: number }> = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[k] = { month: k, revenue: 0, expenses: 0, feed: 0, mortality: 0 };
    }
    (s.data ?? []).filter((x: any) => x.status !== "cancelled").forEach((x: any) => { const m = months[monthKey(x.date)]; if (m) m.revenue += num(x.total_amount); });
    (p.data ?? []).filter((x: any) => x.status !== "cancelled").forEach((x: any) => { const m = months[monthKey(x.date)]; if (m) m.expenses += num(x.amount); });
    (f.data ?? []).forEach((x: any) => { const m = months[monthKey(x.date)]; if (m) { m.feed += num(x.quantity); m.mortality += num(x.mortality); } });
    const history = Object.values(months);
    const activeMonths = history.filter((m) => m.revenue > 0 || m.expenses > 0).length;

    if (activeMonths < 2) {
      return json({ history, forecast: [], insufficient: true, summary: "Historique insuffisant : au moins 2 mois de ventes ou d'achats enregistrés sont nécessaires pour une prévision fiable.", risks: [], recommendations: [] });
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Configuration IA manquante" }, 500);

    const prompt = `Unité : ${unitName}. Historique mensuel RÉEL (12 derniers mois, montants en devise locale) :
${JSON.stringify(history)}
Prévois les 3 prochains mois. Base-toi uniquement sur cet historique (tendance, saisonnalité) et tes connaissances générales du secteur aquacole africain, sans inventer de données passées.
Réponds UNIQUEMENT avec un JSON valide, sans texte autour, de la forme :
{"forecast":[{"month":"AAAA-MM","revenue":0,"expenses":0}],"summary":"2 phrases max en français","risks":["max 3 courts"],"recommendations":["max 3 courts et concrets"],"confidence":"faible|moyenne|élevée"}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", input: prompt, reasoning: { effort: "low" }, store: false, stream: true }),
    });
    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => "");
      console.error("forecast AI error", r.status, t.slice(0, 300));
      const msg = r.status === 429 ? "Trop de demandes, réessayez plus tard." : r.status === 402 ? "Crédits IA épuisés." : `Erreur IA (${r.status})`;
      return json({ error: msg }, [402, 403, 429].includes(r.status) ? r.status : 500);
    }

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try { const e = JSON.parse(line.slice(5).trim()); if (e.type === "response.output_text.delta") text += e.delta ?? ""; } catch { /* partial */ }
      }
    }
    const match = text.match(/\{[\s\S]*\}/);
    let parsed: any = {};
    try { parsed = match ? JSON.parse(match[0]) : {}; } catch { parsed = {}; }
    const forecast = Array.isArray(parsed.forecast)
      ? parsed.forecast.slice(0, 3).map((x: any) => ({ month: String(x.month ?? ""), revenue: num(x.revenue), expenses: num(x.expenses) }))
      : [];
    return json({
      history,
      forecast,
      summary: typeof parsed.summary === "string" ? parsed.summary : "Prévision indisponible.",
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3).map(String) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 3).map(String) : [],
      confidence: typeof parsed.confidence === "string" ? parsed.confidence : null,
    });
  } catch (e) {
    console.error("ai-forecast error", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
