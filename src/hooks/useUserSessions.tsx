import { SUPABASE_URL } from '@/integrations/supabase/env';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/clientConfig';
import { useAuthReady } from '@/hooks/useAuthReady';
import { detectDevice } from '@/lib/deviceDetection';

interface UserSession {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  last_activity_at: string;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  country?: string | null;
  country_code?: string | null;
  device_type?: string | null;
  device_info?: string | null;
}

export const useUserSessions = () => {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Detect country from IP
  const detectCountry = useCallback(async (): Promise<{ country: string; country_code: string } | null> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/detect-country`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          country: data.country || 'Unknown',
          country_code: data.countryCode || 'XX'
        };
      }
    } catch (error) {
      console.error('Error detecting country:', error);
    }
    return null;
  }, []);

  // Créer une nouvelle session lors de la connexion
  const createSession = useCallback(async () => {
    if (!isReady || !isAuthenticated || !user?.id) return;

    try {
      // Detect device and country
      const deviceInfo = detectDevice();
      const countryInfo = await detectCountry();

      const sessionData: Record<string, unknown> = {
        user_id: user.id,
        user_agent: navigator.userAgent,
        is_active: true,
        device_type: deviceInfo.deviceType,
        device_info: deviceInfo.deviceInfo
      };

      if (countryInfo) {
        sessionData.country = countryInfo.country;
        sessionData.country_code = countryInfo.country_code;
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .insert(sessionData as any)
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return;
      }

      if (data) {
        setCurrentSessionId(data.id);
        localStorage.setItem('current_session_id', data.id);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }, [isReady, isAuthenticated, user?.id, detectCountry]);

  // Mettre à jour l'activité de la session
  const updateActivity = useCallback(async () => {
    const sessionId = currentSessionId || localStorage.getItem('current_session_id');
    if (!sessionId) return;

    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity_at: new Date().toISOString() } as any)
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }, [currentSessionId]);

  // Terminer la session lors de la déconnexion
  const endSession = useCallback(async () => {
    const sessionId = currentSessionId || localStorage.getItem('current_session_id');
    if (!sessionId) return;

    try {
      await supabase
        .from('user_sessions')
        .update({ 
          logout_at: new Date().toISOString(),
          is_active: false 
        } as any)
        .eq('id', sessionId);

      localStorage.removeItem('current_session_id');
      setCurrentSessionId(null);
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }, [currentSessionId]);

  // Récupérer les sessions actives (pour admin)
  const getActiveSessions = useCallback(async (): Promise<UserSession[]> => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('is_active', true)
        .gte('last_activity_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      return (data as any[]) || [];
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }, []);

  // Récupérer l'historique des sessions d'un utilisateur
  const getUserSessionHistory = useCallback(async (userId: string): Promise<UserSession[]> => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as any[]) || [];
    } catch (error) {
      console.error('Error getting user session history:', error);
      return [];
    }
  }, []);

  // Récupérer toutes les sessions (pour admin)
  const getAllSessions = useCallback(async (): Promise<UserSession[]> => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data as any[]) || [];
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }, []);

  // Initialiser la session au montage quand l'auth est prête
  useEffect(() => {
    if (!isReady || !isAuthenticated || !user?.id) return;
    
    const existingSessionId = localStorage.getItem('current_session_id');
    if (existingSessionId) {
      setCurrentSessionId(existingSessionId);
      updateActivity();
    } else {
      createSession();
    }

    // Mettre à jour l'activité toutes les 2 minutes
    const activityInterval = setInterval(updateActivity, 2 * 60 * 1000);

    return () => {
      clearInterval(activityInterval);
    };
  }, [isReady, isAuthenticated, user?.id, createSession, updateActivity]);

  // Écouter les événements de déconnexion
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Note: endSession async ne sera pas complètement exécuté ici
      // mais on peut au moins essayer
      navigator.sendBeacon && endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [endSession]);

  return {
    currentSessionId,
    createSession,
    updateActivity,
    endSession,
    getActiveSessions,
    getUserSessionHistory,
    getAllSessions
  };
};
