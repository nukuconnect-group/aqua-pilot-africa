import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

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

  if (!user) return null;

  const close = () => { sessionStorage.setItem(KEY, String(Date.now())); setMessage(null); };
  const open = () => { setMessage(null); onOpen(); };

  return createPortal(
    <div className="fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6 z-[10001] flex flex-col items-end gap-2">
      {message && (
        <div className="w-[min(240px,calc(100vw-1.5rem))] rounded-xl rounded-br-sm border border-border bg-card text-card-foreground shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-gradient-brand px-3 py-1.5 flex items-center gap-2 text-primary-foreground">
            <Bot className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">AquaAssistant</span>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Fermer" className="ml-auto h-6 w-6"><X className="w-4 h-4" /></Button>
          </div>
          <div className="p-2.5 space-y-2">
            <p className="text-xs leading-snug">{message}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={open} className="flex-1">Oui, discutons</Button>
              <Button variant="outline" size="sm" onClick={close}>Plus tard</Button>
            </div>
          </div>
        </div>
      )}
      <Button size="icon" onClick={open} aria-label="Ouvrir AquaAssistant" title="AquaAssistant"
        className="relative h-12 w-12 rounded-full bg-sidebar-background text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground shadow-lg ring-2 ring-background motion-safe:hover:scale-105 transition-transform [&_svg]:size-6">
                <Bot className="relative" strokeWidth={2.2} />
        <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-background" aria-hidden />
      </Button>
    </div>, document.body
  );
};

export default AssistantFloatingBubble;
