import { supabase } from '@/integrations/supabase/client';

/**
 * Crée un canal Realtime avec un nom TOUJOURS unique.
 *
 * Sans cela, deux composants (ou un double montage React StrictMode) qui
 * demandent `supabase.channel('mon-canal')` récupèrent la même instance déjà
 * abonnée, et l'ajout des écouteurs échoue avec :
 * "cannot add `postgres_changes` callbacks ... after `subscribe()`".
 */
export function uniqueChannel(name: string) {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return supabase.channel(`${name}-${suffix}`);
}

/** Suppression défensive d'un canal (ne casse jamais le démontage). */
export function safeRemoveChannel(channel: unknown) {
  try {
    if (channel) supabase.removeChannel(channel as never);
  } catch {
    /* ignore */
  }
}
