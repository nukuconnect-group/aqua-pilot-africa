import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, ChevronDown, MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface Props { activeTab: string; onOpen: () => void }

/** Bulle flottante qui invite à discuter avec AquaAssistant. */
const AssistantFloatingBubble: React.FC<Props> = ({ activeTab, onOpen }) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (!user) return null;

  const close = () => setExpanded(false);
  const open = () => {
    close();
    if (activeTab === 'aqua-assistant') return;
    onOpen();
  };

  return createPortal(
    <div onKeyDown={event => { if (event.key === 'Escape') close(); }} className="fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6 z-[10001] flex flex-col items-end gap-2">
      {expanded && (
        <div id={panelId} role="region" aria-label="Accès AquaAssistant" className="w-[min(280px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card text-card-foreground shadow-lg overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
            <Bot className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">AquaAssistant</span>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Replier AquaAssistant" title="Replier sur l’icône" className="ml-auto h-8 w-8"><X className="w-4 h-4" /></Button>
          </div>
          <div className="p-3">
            <Button onClick={open} className="w-full gap-2"><MessageSquare className="h-4 w-4" />{activeTab === 'aqua-assistant' ? 'Revenir à la conversation' : 'Ouvrir la conversation'}</Button>
          </div>
        </div>
      )}
      <Button size="icon" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={panelId} aria-label={expanded ? 'Replier le bouton AquaAssistant' : 'Déplier AquaAssistant'} title={expanded ? 'Replier AquaAssistant' : 'Déplier AquaAssistant'}
        className="relative h-12 w-12 shrink-0 rounded-full bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground shadow-lg ring-2 ring-background motion-safe:hover:scale-105 transition-transform [&_svg]:size-6">
        {expanded ? <ChevronDown strokeWidth={2.2} /> : <Bot strokeWidth={2.2} />}
      </Button>
    </div>, document.body
  );
};

export default AssistantFloatingBubble;
