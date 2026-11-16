import { afterEach, expect, it, vi } from 'vitest';
const getSession = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/appClient', () => ({
  APP_SUPABASE_ANON_KEY: 'test-anon-key',
  APP_SUPABASE_URL: 'https://app-backend.example',
  supabase: { auth: { getSession } },
}));
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
it('utilise le backend de l’application et explique une indisponibilité réseau', async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-only-token' } } });
  const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetcher);

  await expect(transcribeAssistantAudio(file, signal, vi.fn())).rejects.toThrow('Le service vocal est injoignable');
  expect(fetcher).toHaveBeenCalledWith(
    'https://app-backend.example/functions/v1/aqua-transcribe',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer test-only-token',
        apikey: 'test-anon-key',
      }),
    }),
  );
});