/**
 * Client unique de l'application, branché sur le projet Supabase existant
 * d'AquaPilote (base de production historique).
 *
 * Toute l'application (données, auth, storage, edge functions) passe par ici.
 * Seule la clé publique/anon est utilisée côté navigateur.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const APP_SUPABASE_URL = 'https://hhsvraqchtqqgaezhnzn.supabase.co';
export const APP_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoc3ZyYXFjaHRxcWdhZXpobnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTQ0OTUsImV4cCI6MjA3NzY5MDQ5NX0.yPX0oLUaW5L2_d43MB7X8xpwPaTGCMDNsWKx9JbGrbA';

// Verrou personnalisé : LockManager pose problème sur iOS / WebView.
const customLock = async (_name: string, _timeout: number, fn: () => Promise<any>) => fn();

export const supabase = createClient<Database>(APP_SUPABASE_URL, APP_SUPABASE_ANON_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'aqua-pilot-auth',
    lock: customLock as any,
  },
  db: { schema: 'public' },
  global: { headers: { 'x-client-info': 'aqua-pilot-web' } },
});

export default supabase;
