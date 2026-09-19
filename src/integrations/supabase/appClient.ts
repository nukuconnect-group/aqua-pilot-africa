/**
 * Client unique de l'application, branché sur la base intégrée du projet.
 *
 * Toute l'application (données, auth, storage, edge functions) passe par ici.
 * Seule la clé publique est utilisée côté navigateur.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const APP_SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;
export const APP_SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
