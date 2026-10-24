import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionAccess } from '@/lib/subscriptionAccess';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled';

export interface CurrentSubscription {
  id: string;
  plan: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string;
  days_remaining: number;
  total_days: number;
  isTrial: boolean;
  isExpired: boolean;
  isActive: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  trial_discovery: 'Essai gratuit (1 mois)',
  annual_basic: 'Annuel Basic',
  annual_pro: 'Annuel Pro',
  annual_enterprise: 'Annuel Enterprise',
  monthly: 'Mensuel',
  annual: 'Annuel',
};

export const getPlanLabel = (plan: string) => PLAN_LABELS[plan] || plan;

export const useCurrentSubscription = () => {
  const { user, isDemoMode } = useAuth();
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  // Only the first read for an account shows a loading state: periodic and focus
  // refreshes run silently so guarded screens (and their unsaved forms) stay mounted.
  const loadedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user || isDemoMode) {
      setSubscription(null);
      setLoading(false);
      loadedFor.current = null;
      return;
    }
    if (loadedFor.current !== user.id) setLoading(true);
    const { data, error } = await supabase.rpc('get_current_subscription', {
      _user_id: user.id,
    });
    if (error || !data || (data as any[]).length === 0) {
      setSubscription(null);
    } else {
      const s: any = (data as any[])[0];
      const start = new Date(s.start_date);
      const end = new Date(s.end_date);
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
      setSubscription({
        id: s.id,
        plan: s.plan,
        status: s.status,
        start_date: s.start_date,
        end_date: s.end_date,
        days_remaining: s.days_remaining ?? 0,
        total_days: totalDays,
        ...subscriptionAccess(s),
      });
    }
    loadedFor.current = user.id;
    setLoading(false);
  }, [user?.id, isDemoMode]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return { subscription, loading, reload: load };
};
