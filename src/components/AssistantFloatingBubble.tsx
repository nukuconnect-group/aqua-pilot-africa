import React, { useEffect, useState } from 'react';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Props { activeTab: string; onOpen: () => void }

const REMIND_AFTER_MS = 10 * 60 * 1000;
const KEY = 'aquapilote-bubble-dismissed-at';

/** Bulle flottante qui invite à discuter avec AquaAssistant. */
const AssistantFloatingBubble: React.FC<Props> = ({ activeTab, onOpen }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const dismissed = Number(sessionStorage.getItem(KEY) || 0);
    const firstName = (user.name?.includes('@') ? '' : user.name || '').split(' ')[0];
    const show = () => setMessage(
      dismissed
        ? 'Voulez-vous de l’aide pour utiliser l’application ou gérer votre ferme ?'
        : `Bonjour${firstName ? ' ' + firstName : ''} ! Je peux vous aider à gérer votre ferme. Voulez-vous discuter de son état ?`,
    );
    const wait = dismissed ? Math.max(0, dismissed + REMIND_AFTER_MS - Date.now()) : 1500;
    const t = window.setTimeout(show, wait);
    return () => window.clearTimeout(t);
  }, [user]);

  if (!user || activeTab === 'aqua-assistant') return null;

  const close = () => { sessionStorage.setItem(KEY, String(Date.now())); setMessage(null); };
  const open = () => { setMessage(null); onOpen(); };

  return (
    <div className="fixed right-4 bottom-24 md:bottom-6 z-50 flex flex-col items-end gap-3">
      {message && (
        <div className="w-[280px] rounded-2xl rounded-br-md border border-primary/20 bg-card text-card-foreground shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-gradient-brand px-3 py-2 flex items-center gap-2 text-primary-foreground">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">AquaAssistant</span>
            <button onClick={close} aria-label="Fermer" className="ml-auto opacity-80 hover:opacity-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-3 space-y-3">
            <p className="text-sm leading-snug">{message}</p>
            <div className="flex gap-2">
              <button onClick={open} className="flex-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold py-2 hover:opacity-90">Oui, discutons</button>
              <button onClick={close} className="rounded-full border border-border text-xs px-3 py-2 text-muted-foreground hover:text-foreground">Plus tard</button>
            </div>
          </div>
        </div>
      )}
      <button onClick={open} aria-label="Ouvrir AquaAssistant"
        className="relative h-16 w-16 rounded-full bg-gradient-brand text-primary-foreground shadow-2xl ring-4 ring-background flex items-center justify-center hover:scale-105 transition-transform">
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" aria-hidden />
        <MessageCircle className="relative w-8 h-8" strokeWidth={2.5} />
        <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-accent ring-2 ring-background" aria-hidden />
      </button>
    </div>
  );
};

export default AssistantFloatingBubble;
