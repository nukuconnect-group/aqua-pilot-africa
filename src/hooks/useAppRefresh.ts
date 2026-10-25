import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshMountedData } from '@/lib/manualRefresh';
import { useToast } from '@/hooks/use-toast';

export function useAppRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refresh = async () => {
    if (pending.current) return;
    if (!navigator.onLine) { toast({ title: 'Connexion nécessaire', description: 'Reconnectez-vous à Internet pour actualiser les données.' }); return; }
    pending.current = true; setRefreshing(true);
    try { await Promise.all([refreshMountedData(), queryClient.refetchQueries({ type: 'active' })]); }
    catch { toast({ title: 'Actualisation incomplète', description: 'Certaines données n’ont pas pu être actualisées. Réessayez.', variant: 'destructive' }); }
    finally { pending.current = false; setRefreshing(false); }
  };
  return { refreshing, refresh };
}