import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { transcribe } from './transcribe.ts';

// The application session belongs to the historical app backend, not Cloud Auth.
const APP_URL = 'https://hhsvraqchtqqgaezhnzn.supabase.co';
const APP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoc3ZyYXFjaHRxcWdhZXpobnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTQ0OTUsImV4cCI6MjA3NzY5MDQ5NX0.yPX0oLUaW5L2_d43MB7X8xpwPaTGCMDNsWKx9JbGrbA';
const MAX_BODY = 24 * 1024 * 1024;
const json = (message: string, status: number) => new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json('Méthode non autorisée.', 405);
  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json('Connectez-vous pour utiliser le vocal.', 401);
    const app = createClient(APP_URL, APP_ANON, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data, error } = await app.auth.getUser();
    if (error || !data.user) return json('Votre session a expiré. Reconnectez-vous.', 401);
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json('Le service de transcription n’est pas configuré.', 401);
    const contentType = req.headers.get('Content-Type') || '';
    if (!contentType.startsWith('multipart/form-data')) return json('Un fichier audio est requis.', 400);
    if (Number(req.headers.get('Content-Length')) > MAX_BODY) return json('L’enregistrement est trop volumineux.', 413);
    // Enforce the real body limit, including requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) return json('Aucun enregistrement reçu.', 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return json('L’enregistrement est trop volumineux.', 413); }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks), { headers: { 'Content-Type': contentType } }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 2048 || file.size > MAX_BODY - 8192 || file.type !== 'audio/wav') return json('L’enregistrement audio est vide ou invalide.', 400);
    const response = await transcribe({ baseURL: 'https://ai.gateway.lovable.dev', apiKey: key, model: 'openai/gpt-transcribe', maxFileBytes: MAX_BODY - 8192, audioOnly: true }, file, { signal: req.signal });
    // Preserve upstream status, safe errors and SSE; never retry denied work.
    return new Response(response.body, { status: response.status, headers: { ...corsHeaders, 'Content-Type': response.headers.get('Content-Type') || 'application/json', 'Access-Control-Expose-Headers': 'retry-after', ...(response.headers.has('Retry-After') ? { 'Retry-After': response.headers.get('Retry-After') || '' } : {}) } });
  } catch (error) {
    if (req.signal.aborted) return json('Transcription annulée.', 499);
    return json(error instanceof TypeError ? 'L’enregistrement n’a pas pu être lu.' : 'La transcription est indisponible pour le moment.', 500);
  }
});