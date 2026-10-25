import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshApplication, isAppRefreshing, subscribeAppRefresh } from '@/lib/manualRefresh';
import { useToast } from '@/hooks/use-toast';

export function useAppRefresh() {
  const refreshing = useSyncExternalStore(subscribeAppRefresh, isAppRefreshing, () => false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const refresh = async () => {
    if (isAppRefreshing()) return;
    if (!navigator.onLine) { toast({ title: 'Connexion nécessaire', description: 'Reconnectez-vous à Internet pour actualiser les données.' }); return; }
    try { await refreshApplication(() => queryClient.refetchQueries({ type: 'active' }, { throwOnError: true })); }
    catch { toast({ title: 'Actualisation incomplète', description: 'Certaines données n’ont pas pu être actualisées. Réessayez.', variant: 'destructive' }); }
  };
  return { refreshing, refresh };
}