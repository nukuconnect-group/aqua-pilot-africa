/**
 * Point unique de vérité pour l'URL et la clé publique du backend.
 * Évite tout reste d'un ancien projet codé en dur après un remix.
 */
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';

export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '';
