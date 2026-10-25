import { useCallback, useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

/** Native dictation stays local to the existing composer; no second conversation or audio storage. */
export function useAssistantVoice(language: string) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'listening' | 'finishing' | 'ready'>('idle');
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(Array(28).fill(2));
  const [error, setError] = useState('');
  const resources = useRef<{ recognition?: Recognition; stream?: MediaStream; audio?: AudioContext; frame?: number; timer?: ReturnType<typeof setInterval> }>({});
  const transcript = useRef('');
  const base = useRef('');
  const generation = useRef(0);
  const completion = useRef<((value: string | null) => void) | null>(null);
  const release = useCallback(() => {
    const r = resources.current;
    r.stream?.getTracks().forEach(track => track.stop());
    if (r.frame) cancelAnimationFrame(r.frame);
    if (r.timer) clearInterval(r.timer);
    void r.audio?.close().catch(() => undefined);
    r.stream = undefined; r.audio = undefined; r.frame = undefined; r.timer = undefined;
  }, []);
  const cancel = useCallback(() => {
    generation.current += 1;
    const r = resources.current.recognition;
    if (r) { r.onend = null; r.onresult = null; r.onerror = null; r.abort(); }
    release(); completion.current?.(null); completion.current = null;
    setPhase('idle'); setText(''); setError('');
    return base.current;
  }, [release]);
  useEffect(() => () => { cancel(); }, [cancel, language]);

  const start = async (draft: string) => {
    if (resources.current.stream || phase === 'starting') return;
    const Constructor = (window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition;
    if (!Constructor || !navigator.mediaDevices?.getUserMedia) {
      setError('Le vocal n’est pas disponible dans ce navigateur. Utilisez Chrome ou Safari, ou écrivez votre question.'); return;
    }
    const id = ++generation.current;
    base.current = draft; transcript.current = ''; setText(''); setError(''); setSeconds(0); setBars(Array(28).fill(2)); setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      resources.current.stream = stream;
      const audio = new AudioContext(); resources.current.audio = audio;
      await audio.resume();
      if (id !== generation.current) return;
      const analyser = audio.createAnalyser(); analyser.fftSize = 256;
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(samples);
        setBars(Array.from({ length: 28 }, (_, i) => Math.max(2, samples[i * 3] / 255 * 30)));
        resources.current.frame = requestAnimationFrame(draw);
      };
      const recognition = new Constructor(); resources.current.recognition = recognition;
      recognition.lang = language; recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = event => {
        let final = '', interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) final += `${result[0].transcript} `;
          else interim += `${result[0].transcript} `;
        }
        transcript.current = final.trim(); setText((final + interim).trim());
      };
      recognition.onerror = event => {
        const message = event.error === 'not-allowed' ? 'Autorisez le microphone pour dicter votre question.'
          : event.error === 'no-speech' ? 'Aucune parole reconnue. Réessayez ou écrivez votre question.'
          : event.error === 'network' ? 'La reconnaissance vocale est indisponible. Vérifiez votre connexion.'
          : 'La dictée a été interrompue. Votre saisie est conservée.';
        release(); setError(message); setPhase('ready'); completion.current?.(null); completion.current = null;
      };
      recognition.onend = () => {
        release(); setPhase('ready'); setText(transcript.current);
        const value = transcript.current ? [base.current.trim(), transcript.current].filter(Boolean).join(' ') : null;
        if (!value) setError('Aucune parole reconnue. Réessayez ou écrivez votre question.');
        completion.current?.(value); completion.current = null;
      };
      recognition.start(); draw(); setPhase('listening');
      resources.current.timer = setInterval(() => setSeconds(value => value + 1), 1000);
    } catch {
      if (id !== generation.current) return;
      release(); setPhase('idle'); setError('Le microphone est inaccessible. Vérifiez son autorisation dans votre navigateur.');
    }
  };
  const finish = (): Promise<string | null> => {
    if (phase === 'ready') return Promise.resolve(transcript.current ? [base.current.trim(), transcript.current].filter(Boolean).join(' ') : null);
    if (phase !== 'listening') return Promise.resolve(null);
    setPhase('finishing');
    return new Promise(resolve => { completion.current = resolve; resources.current.recognition?.stop(); });
  };
  return { phase, text, seconds, bars, error, start, finish, cancel };
}