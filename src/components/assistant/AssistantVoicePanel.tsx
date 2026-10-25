import { Loader2, Send, Trash2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { useAssistantVoice } from '@/hooks/useAssistantVoice';

export default function AssistantVoicePanel({ voice, onSend, onCancel }: {
  voice: ReturnType<typeof useAssistantVoice>; onSend: () => void; onCancel: () => void;
}) {
  const busy = voice.phase === 'starting' || voice.phase === 'finishing';
  return <div className="space-y-2 rounded-md border bg-card p-2.5" aria-label="Dictée vocale">
    <div className="flex min-w-0 items-center gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={onCancel} title="Annuler la dictée" aria-label="Annuler la dictée"><Trash2 className="size-4" /></Button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Mic className="size-4 shrink-0 text-ocean-secondary" />
        <span className="text-xs tabular-nums text-muted-foreground">{Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}</span>
        <svg className="h-9 min-w-0 flex-1 text-ocean-secondary" viewBox="0 0 112 36" preserveAspectRatio="none" aria-label="Niveau du microphone">
          {voice.bars.map((height, i) => <line key={i} x1={i * 4 + 2} x2={i * 4 + 2} y1={18 - height / 2} y2={18 + height / 2} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)}
        </svg>
      </div>
      <Button type="button" size="icon" disabled={busy || (voice.phase === 'ready' && !voice.text)} onClick={onSend} title="Terminer et envoyer la dictée" aria-label="Terminer et envoyer la dictée">{busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Send className="size-4" />}</Button>
    </div>
    <p role="status" className="text-xs text-muted-foreground">{voice.phase === 'starting' ? 'Accès au microphone…' : voice.phase === 'finishing' ? 'Transcription de votre parole…' : voice.phase === 'ready' ? 'Dictée interrompue — aucun message envoyé' : 'Écoute en cours…'}</p>
    {voice.text && <p className="max-h-24 overflow-y-auto break-words text-sm [overflow-wrap:anywhere]">{voice.text}</p>}
  </div>;
}