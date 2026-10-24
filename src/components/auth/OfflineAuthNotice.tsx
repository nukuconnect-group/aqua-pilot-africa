import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OFFLINE_AUTH_MESSAGE = 'Pas de connexion Internet. La connexion à un compte et la création de compte nécessitent Internet. Si vous étiez déjà connecté sur cet appareil, rouvrez simplement l’application : votre accès est conservé.';

export function useIsOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

export default function OfflineAuthNotice() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p>{OFFLINE_AUTH_MESSAGE}</p>
    </div>
  );
}
