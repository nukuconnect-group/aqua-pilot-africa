import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
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
    const firstName = (user.user_metadata?.full_name || '').split(' ')[0];
    const show = () => setMessage(
      dismissed
        ? 'Je peux vous aider à utiliser l\'application ou à gérer votre ferme.'
        : `Bonjour${firstName ? ' ' + firstName : ''}, discutez avec moi de l'état de votre ferme.`,
    );
    const wait = dismissed ? Math.max(0, dismissed + REMIND_AFTER_MS - Date.now()) : 1500;
    const t = window.setTimeout(show, wait);
    return () => window.clearTimeout(t);
  }, [user]);

  if (!user || activeTab === 'aqua-assistant') return null;

  const close = () => { sessionStorage.setItem(KEY, String(Date.now())); setMessage(null); };

  return (
    <div className="fixed right-4 bottom-24 md:bottom-6 z-50 flex flex-col items-end gap-2">
      {message && (
        <div className="max-w-[260px] rounded-2xl rounded-br-sm border border-border bg-card p-3 pr-8 text-sm text-card-foreground shadow-lg relative animate-in fade-in slide-in-from-bottom-2">
          <button onClick={close} aria-label="Fermer" className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <button className="text-left" onClick={onOpen}>{message}</button>
        </div>
      )}
      <button onClick={onOpen} aria-label="Ouvrir AquaAssistant"
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

export default AssistantFloatingBubble;
