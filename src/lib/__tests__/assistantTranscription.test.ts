import { afterEach, expect, it, vi } from 'vitest';
const getSession = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: { auth: { getSession } } }));
import { transcribeAssistantAudio } from '../assistantTranscription';
afterEach(() => vi.unstubAllGlobals());
const file = new File(['audio'], 'question.wav', { type: 'audio/wav' });
const signal = new AbortController().signal;
it('lit la transcription complète et n’envoie pas un fragment incomplet', async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-only-token' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"type":"transcript.text.delta","delta":"Analyse"}\n\ndata: {"type":"transcript.text.done","text":"Analyse les stocks de mon unité."}\n\ndata: [DONE]\n\n')));
  expect(await transcribeAssistantAudio(file, signal, vi.fn())).toBe('Analyse les stocks de mon unité.');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"type":"transcript.text.delta","delta":"Analyse"}\n\n')));
  await expect(transcribeAssistantAudio(file, signal, vi.fn())).rejects.toThrow('incomplète');
});
it('préserve le message du refus sans nouvelle tentative', async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-only-token' } } });
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Accès refusé par le fournisseur.' }), { status: 403 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(transcribeAssistantAudio(file, signal, vi.fn())).rejects.toThrow('Accès refusé par le fournisseur.');
  expect(fetcher).toHaveBeenCalledTimes(1);
});