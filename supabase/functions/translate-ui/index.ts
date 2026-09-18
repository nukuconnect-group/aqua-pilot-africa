// Traduction à la volée de l'interface (FR -> langue cible) via Lovable AI.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { texts, target = 'en' } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items = texts.slice(0, 80).map((t: unknown) => String(t ?? '').slice(0, 400));
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY missing');

    const prompt = `Translate each JSON array item from French to ${target}.
Rules: keep the exact same array length and order, keep numbers, units, placeholders and punctuation,
keep product names (AquaPilote, AquaFeed, AquaHealth) untranslated, keep the same tone and capitalization style.
Return ONLY a JSON object: {"translations": ["..."]}.
Input: ${JSON.stringify(items)}`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a precise UI translator. Answer with JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (res.status === 429 || res.status === 402) {
      return new Response(JSON.stringify({ translations: items, rateLimited: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) throw new Error(`AI gateway ${res.status}`);

    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? '';
    const json = content.match(/\{[\s\S]*\}/);
    const parsed = json ? JSON.parse(json[0]) : { translations: [] };
    const translations: string[] = Array.isArray(parsed.translations) ? parsed.translations : [];

    return new Response(
      JSON.stringify({ translations: items.map((t, i) => translations[i] ?? t) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error), translations: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
