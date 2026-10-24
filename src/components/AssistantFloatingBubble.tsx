import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface Props { activeTab: string; onOpen: () => void }

const STORAGE_KEY = 'aqua-assistant-bubble-collapsed';

/** Aide proposée selon l'écran ouvert. */
const CONTEXT_HELP: Record<string, string> = {
  dashboard: 'Je peux résumer l’activité de votre unité et signaler ce qui demande votre attention.',
  feeding: 'Je peux vous aider à préparer vos fiches, rations et nourrissages du jour.',
  aquafeed: 'Je peux vous aider à raisonner vos formules et vos besoins en aliment.',
  stock: 'Je peux vous aider à suivre vos stocks, ruptures et réapprovisionnements.',
  purchases: 'Je peux vous aider à enregistrer vos achats et à réapprovisionner vos produits.',
  sales: 'Je peux vous aider à suivre vos ventes, caisses et encaissements.',
  accounting: 'Je peux vous expliquer vos écritures, résultats et états comptables.',
  production: 'Je peux vous aider à suivre vos cycles, effectifs et croissance.',
  livestock: 'Je peux vous aider à suivre vos lots, effectifs et mortalités.',
  health: 'Je peux vous aider à surveiller la santé de vos poissons.',
  aquahealth: 'Je peux vous aider à interpréter vos analyses de santé.',
  infrastructures: 'Je peux vous aider à organiser vos bassins, bacs et cages.',
  units: 'Je peux vous aider à organiser vos unités de production.',
  hr: 'Je peux vous aider à gérer votre équipe, pointages et paies.',
  crm: 'Je peux vous aider à suivre vos clients et fournisseurs.',
  reports: 'Je peux vous aider à lire et préparer vos rapports.',
};

export const assistantGreeting = (activeTab: string) =>
  CONTEXT_HELP[activeTab] || 'Posez-moi vos questions sur votre ferme, vos chiffres ou l’utilisation de l’application.';

const readCollapsed = () => {
  try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
};

/** Bulle d'accueil AquaAssistant : dépliée à l'arrivée, réductible et redépliable par la flèche. */
const AssistantFloatingBubble: React.FC<Props> = ({ activeTab, onOpen }) => {
  const { user } = useAuth();
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const panelId = useId();

  if (!user) return null;

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    try { sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* sans stockage, l'état reste local */ }
  };
  const open = () => { if (activeTab !== 'aqua-assistant') onOpen(); };

  return createPortal(
    <div onKeyDown={event => { if (event.key === 'Escape') setCollapsed(true); }} className="fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6 z-[10001] flex flex-col items-end gap-2">
      {!collapsed && (
        <div id={panelId} role="region" aria-label="Accueil AquaAssistant" className="w-[min(300px,calc(100vw-1.5rem))] rounded-lg border border-border bg-card text-card-foreground shadow-lg overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border bg-muted/50">
            <Bot className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">AquaAssistant</span>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Réduire AquaAssistant" title="Réduire" className="ml-auto h-8 w-8"><ChevronDown className="w-4 h-4" /></Button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm leading-relaxed">
              <strong>Bonjour,</strong> je peux vous aider à gérer votre ferme et répondre à vos questions.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{assistantGreeting(activeTab)}</p>
            <Button onClick={open} className="w-full gap-2"><MessageSquare className="h-4 w-4" />{activeTab === 'aqua-assistant' ? 'Conversation ouverte' : 'Poser une question'}</Button>
          </div>
        </div>
      )}
      <div className="relative">
        <Button size="icon" onClick={collapsed ? () => setCollapsed(false) : open} aria-label={collapsed ? 'Ouvrir AquaAssistant' : 'Discuter avec AquaAssistant'} title="AquaAssistant"
          aria-controls={panelId}
          className="h-12 w-12 shrink-0 rounded-full bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground shadow-lg ring-2 ring-background motion-safe:hover:scale-105 transition-transform [&_svg]:size-6">
          <Bot strokeWidth={2.2} />
        </Button>
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-controls={panelId}
          aria-label={collapsed ? 'Dérouler AquaAssistant' : 'Réduire la bulle AquaAssistant'} title={collapsed ? 'Dérouler' : 'Réduire'}
          className="absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>, document.body
  );
};

export default AssistantFloatingBubble;
