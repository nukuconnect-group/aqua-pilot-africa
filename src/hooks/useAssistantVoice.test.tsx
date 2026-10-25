import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useAssistantVoice } from './useAssistantVoice';

let voice: ReturnType<typeof useAssistantVoice>;
let recognition: MockRecognition;
const stopTrack = vi.fn();
class MockRecognition {
  lang = ''; continuous = false; interimResults = false;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { recognition = this; }
  start = vi.fn();
  abort = vi.fn();
  stop = vi.fn(() => { this.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'Analyse mes stocks' } }] }); this.onend?.(); });
}
let root: ReturnType<typeof createRoot>;
function Harness() { voice = useAssistantVoice('fr-FR'); return null; }
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  stopTrack.mockClear();
  Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockRecognition });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  vi.stubGlobal('AudioContext', class {
    resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined);
    createAnalyser() { return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData: (a: Uint8Array) => a.fill(50) }; }
    createMediaStreamSource() { return { connect: vi.fn() }; }
  });
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
describe('dictée de la conversation existante', () => {
  it('attend la fin de reconnaissance avant envoi et conserve le brouillon', async () => {
    await act(async () => { await voice.start('Bonjour'); });
    expect(voice.phase).toBe('listening');
    expect(recognition.lang).toBe('fr-FR');
    let value: string | null = null;
    await act(async () => { value = await voice.finish(); });
    expect(value).toBe('Bonjour Analyse mes stocks');
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(voice.phase).toBe('ready');
  });
  it('annule sans envoyer et libère le microphone', async () => {
    await act(async () => { await voice.start('Saisie préservée'); });
    let draft = '';
    await act(async () => { draft = voice.cancel(); });
    expect(draft).toBe('Saisie préservée');
    expect(voice.phase).toBe('idle');
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
  it('ne transmet rien lorsqu’aucune parole n’est reconnue', async () => {
    await act(async () => { await voice.start('Brouillon seul'); });
    recognition.stop = vi.fn(() => recognition.onend?.());
    let value: string | null = 'unexpected';
    await act(async () => { value = await voice.finish(); });
    expect(value).toBeNull();
    expect(voice.error).not.toBe('');
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
  it('libère un microphone accordé après une annulation', async () => {
    let resolve: (stream: any) => void = () => undefined;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(r => { resolve = r; }));
    let pending: Promise<void> = Promise.resolve();
    await act(async () => { pending = voice.start(''); });
    await act(async () => { voice.cancel(); resolve({ getTracks: () => [{ stop: stopTrack }] }); await pending; });
    expect(voice.phase).toBe('idle');
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});