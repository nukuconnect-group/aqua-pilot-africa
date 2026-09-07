import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthReadyState {
  isReady: boolean;
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}

/**
 * Hook qui attend que l'authentification soit prête avant de permettre les opérations
 * Garantit que la session est restaurée depuis le stockage local
 */
export const useAuthReady = () => {
  const [state, setState] = useState<AuthReadyState>({
    isReady: false,
    isAuthenticated: false,
    user: null,
    session: null
  });

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Timeout rapide pour ne pas bloquer l'UI - 2 secondes max
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 2000)
        );

        let result;
        try {
          result = await Promise.race([sessionPromise, timeoutPromise]);
        } catch {
          // Timeout - marquer comme prêt sans session (mode offline possible)
          if (mounted) {
            setState({
              isReady: true,
              isAuthenticated: false,
              user: null,
              session: null
            });
          }
          return;
        }

        const { data: { session }, error } = result as { data: { session: any }, error: any };
        
        if (error) {
          console.warn('Session check warning:', error.message);
        }

        if (mounted) {
          setState({
            isReady: true,
            isAuthenticated: !!session?.user,
            user: session?.user ?? null,
            session: session
          });
        }
      } catch (error) {
        // Erreur - continuer quand même (mode offline)
        if (mounted) {
          setState({
            isReady: true,
            isAuthenticated: false,
            user: null,
            session: null
          });
        }
      }
    };

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setState({
            isReady: true,
            isAuthenticated: !!session?.user,
            user: session?.user ?? null,
            session: session
          });
        }
      }
    );

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh error:', error);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Session refresh failed:', error);
      return null;
    }
  }, []);

  const getUserId = useCallback(async (): Promise<string | null> => {
    if (state.user?.id) return state.user.id;
    
    // Fallback: récupérer directement depuis Supabase
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  }, [state.user]);

  return {
    ...state,
    refreshSession,
    getUserId
  };
};

export default useAuthReady;
