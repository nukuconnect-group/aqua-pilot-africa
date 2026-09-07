import { SUPABASE_URL } from '@/integrations/supabase/env';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { detectDevice } from '@/lib/deviceDetection';

const SESSION_KEY = 'aqua_visit_session';
const ACTIVITY_INTERVAL = 60000; // Update activity every minute

const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

const getOrCreateSessionId = (): string => {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
};

export const useAnonymousVisitTracking = () => {
  const hasTrackedRef = useRef(false);
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackVisit = useCallback(async () => {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;

    try {
      const sessionId = getOrCreateSessionId();
      const device = detectDevice(navigator.userAgent);
      
      // Check if session already exists
      const { data: existingSession } = await supabase
        .from('anonymous_visits')
        .select('id')
        .eq('session_id', sessionId)
        .single();

      if (existingSession) {
        // Update last activity
        await supabase
          .from('anonymous_visits')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('session_id', sessionId);
        return;
      }

      // Call edge function to detect country
      let country = 'Inconnu';
      let countryCode = 'XX';
      
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/detect-country`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          country = data.country || 'Inconnu';
          countryCode = data.countryCode || 'XX';
        }
      } catch (e) {
        console.log('Could not detect country:', e);
      }

      // Insert new visit
      await supabase
        .from('anonymous_visits')
        .insert({
          session_id: sessionId,
          country,
          country_code: countryCode,
          device_type: device.deviceType,
          device_info: device.deviceInfo,
          user_agent: navigator.userAgent.substring(0, 500),
          referrer: document.referrer || null,
          page_path: window.location.pathname
        });

      console.log('Anonymous visit tracked:', { country, device: device.deviceType });
    } catch (error) {
      console.error('Error tracking visit:', error);
    }
  }, []);

  const updateActivity = useCallback(async () => {
    try {
      const sessionId = sessionStorage.getItem(SESSION_KEY);
      if (!sessionId) return;

      await supabase
        .from('anonymous_visits')
        .update({ 
          last_activity_at: new Date().toISOString(),
          page_path: window.location.pathname
        })
        .eq('session_id', sessionId);
    } catch (error) {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    // Track initial visit
    trackVisit();

    // Update activity periodically
    activityIntervalRef.current = setInterval(updateActivity, ACTIVITY_INTERVAL);

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackVisit, updateActivity]);
};

export default useAnonymousVisitTracking;
