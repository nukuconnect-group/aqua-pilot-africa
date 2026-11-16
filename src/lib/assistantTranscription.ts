import { createParser } from 'eventsource-parser';
import { APP_SUPABASE_ANON_KEY, APP_SUPABASE_URL, supabase } from '@/integrations/supabase/appClient';

export async function transcribeAssistantAudio(file: File, signal: AbortSignal, onText: (text: string) => void): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Connectez-vous pour utiliser le vocal.');
  const form = new FormData(); form.append('file', file);
  let response: Response;
  try {
    response = await fetch(`${APP_SUPABASE_URL}/functions/v1/aqua-transcribe`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: APP_SUPABASE_ANON_KEY },
      body: form,
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    if (error instanceof TypeError) {
      throw new Error('Le service vocal est injoignable. Vérifiez votre connexion et réessayez.');
    }
    throw error;
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || payload?.error?.message || (typeof payload?.error === 'string' ? payload.error : null);
    throw new Error(message || `La transcription a échoué (${response.status}).`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Aucune transcription reçue.');
  let text = ''; let complete = false; let streamError = '';
  const parser = createParser({ onEvent: event => {
    if (event.data === '[DONE]') return;
    let data;
    try { data = JSON.parse(event.data); } catch { streamError = 'La transcription reçue est invalide.'; return; }
    const type = data.type || event.event;
    if (type === 'error' || data.error) { streamError = data.message || data.error?.message || 'La transcription a été interrompue.'; return; }
    if (type === 'transcript.text.delta') { text += data.delta || ''; onText(text); }
    if (type === 'transcript.text.done') { text = data.text || ''; complete = true; onText(text); }
  } });
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      if (streamError) { await reader.cancel(); throw new Error(streamError); }
    }
    parser.feed(decoder.decode());
  } finally { reader.releaseLock(); }
  if (streamError) throw new Error(streamError);
  if (!complete) throw new Error('La transcription est incomplète. Aucun message n’a été envoyé.');
  if (!text.trim()) throw new Error('Aucune parole reconnue. Enregistrez à nouveau votre question.');
  return text.trim();
}