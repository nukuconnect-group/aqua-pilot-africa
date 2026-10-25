import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeWav } from '@/lib/assistantAudio';
import { transcribeAssistantAudio } from '@/lib/assistantTranscription';

/** Capture complete WAV segments in memory; upload only on explicit validation. */
export function useAssistantVoice(language: string) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'listening' | 'finishing' | 'ready'>('idle');
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(28).fill(2));
  const [error, setError] = useState('');
  const resources = useRef<{ stream?: MediaStream; audio?: AudioContext; node?: ScriptProcessorNode; source?: MediaStreamAudioSourceNode; frame?: number; timer?: ReturnType<typeof setInterval> }>({});
  const chunks = useRef<Float32Array[]>([]);
  const segments = useRef<Float32Array[][]>([]);
  const chunkSamples = useRef(0);
  const sampleRate = useRef(48000);
  const energy = useRef(0);
  const base = useRef('');
  const generation = useRef(0);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const release = useCallback(() => {
    const r = resources.current;
    if (r.node) { r.node.onaudioprocess = null; r.node.disconnect(); }
    r.source?.disconnect();
    r.stream?.getTracks().forEach(track => track.stop());
    if (r.frame) cancelAnimationFrame(r.frame);
    if (r.timer) clearInterval(r.timer);
    void r.audio?.close().catch(() => undefined);
    resources.current = {};
  }, []);
  const cancel = useCallback(() => {
    generation.current += 1; abort.current?.abort(); abort.current = null; busy.current = false;
    release(); chunks.current = []; segments.current = []; chunkSamples.current = 0;
    setPhase('idle'); setText(''); setError('');
    return base.current;
  }, [release]);
  useEffect(() => () => { cancel(); }, [cancel, language]);

  const start = async (draft: string) => {
    if (resources.current.stream || busy.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError('Le microphone n’est pas disponible dans ce navigateur.'); return;
    }
    const id = ++generation.current; busy.current = true;
    base.current = draft; chunks.current = []; segments.current = []; chunkSamples.current = 0; energy.current = 0;
    setText(''); setError(''); setSeconds(0); setBars(Array(28).fill(2)); setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      resources.current.stream = stream;
      const audio = new AudioContext(); resources.current.audio = audio;
      await audio.resume();
      if (id !== generation.current) return;
      sampleRate.current = audio.sampleRate;
      const source = audio.createMediaStreamSource(stream); resources.current.source = source;
      const analyser = audio.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
      const node = audio.createScriptProcessor(4096, 1, 1); resources.current.node = node;
      node.onaudioprocess = event => {
        const samples = new Float32Array(event.inputBuffer.getChannelData(0));
        for (const sample of samples) energy.current = Math.max(energy.current, Math.abs(sample));
        chunks.current.push(samples); chunkSamples.current += samples.length;
        // Five-minute segments stay comfortably below the verified 25 MB limit even at 96 kHz.
        if (chunkSamples.current >= audio.sampleRate * 60) {
          segments.current.push(chunks.current); chunks.current = []; chunkSamples.current = 0;
        }
      };
      source.connect(node); node.connect(audio.destination);
      const frequencies = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(frequencies);
        setBars(Array.from({ length: 28 }, (_, i) => Math.max(2, frequencies[i * 3] / 255 * 30)));
        resources.current.frame = requestAnimationFrame(draw);
      };
      draw(); setPhase('listening'); busy.current = false;
      resources.current.timer = setInterval(() => setSeconds(value => value + 1), 1000);
    } catch {
      if (id !== generation.current) return;
      release(); busy.current = false; setPhase('idle'); setError('Le microphone est inaccessible. Autorisez-le dans votre navigateur.');
    }
  };
  const finish = async (): Promise<string | null> => {
    if (busy.current || phase !== 'listening') return null;
    busy.current = true; setPhase('finishing');
    const id = generation.current;
    release();
    if (chunks.current.length) segments.current.push(chunks.current);
    chunks.current = [];
    const clips = segments.current; segments.current = [];
    if (!clips.length || energy.current < 0.001) {
      busy.current = false; setPhase('ready'); setError('Aucune parole enregistrée. Réessayez ou écrivez votre question.'); return null;
    }
    const controller = new AbortController(); abort.current = controller;
    let final = '';
    try {
      for (const clip of clips) {
        const wav = encodeWav(clip, sampleRate.current);
        if (wav.size < 2048) continue;
        const prefix = final;
        const result = await transcribeAssistantAudio(new File([wav], 'question.wav', { type: 'audio/wav' }), controller.signal, partial => {
          if (id === generation.current) setText([prefix, partial].filter(Boolean).join(' '));
        });
        final = [final, result].filter(Boolean).join(' ');
      }
      if (id !== generation.current) return null;
      if (!final.trim()) throw new Error('Aucune parole reconnue. Aucun message n’a été envoyé.');
      setText(final); setPhase('ready');
      return [base.current.trim(), final].filter(Boolean).join(' ');
    } catch (err) {
      if (id !== generation.current) return null;
      setPhase('ready'); setError(err instanceof Error ? err.message : 'La transcription a échoué. Aucun message n’a été envoyé.');
      return null;
    } finally {
      if (id === generation.current) { busy.current = false; abort.current = null; }
    }
  };
  return { phase, text, seconds, bars, error, start, finish, cancel };
}
