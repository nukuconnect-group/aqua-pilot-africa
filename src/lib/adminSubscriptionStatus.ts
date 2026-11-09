// Picks the subscription that currently governs an account, matching the
// server ordering of public.get_current_subscription: a valid (in-period
// trial/active) one first, then by status, then the latest end date.
export interface SubscriptionLike {
  user_id: string;
  plan: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at?: string | null;
}

export type EffectiveStatus = 'active' | 'trial' | 'expired' | 'suspended' | 'cancelled' | 'none';

export interface CurrentSubscription {
  plan: string;
  status: EffectiveStatus;
  endDate: string;
  daysRemaining: number;
}

const isValidOn = (s: SubscriptionLike, today: string) =>
  (s.status === 'active' || s.status === 'trial') && s.start_date <= today && s.end_date >= today;

const statusRank = (s: string) => (s === 'active' ? 1 : s === 'trial' ? 2 : s === 'expired' ? 3 : 4);

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

export function pickCurrentSubscription(subs: SubscriptionLike[], today: string): CurrentSubscription | null {
  if (!subs.length) return null;
  const sorted = [...subs].sort((a, b) => {
    const va = isValidOn(a, today) ? 0 : 1;
    const vb = isValidOn(b, today) ? 0 : 1;
    if (va !== vb) return va - vb;
    const ra = statusRank(a.status);
    const rb = statusRank(b.status);
    if (ra !== rb) return ra - rb;
    if (a.end_date !== b.end_date) return a.end_date < b.end_date ? 1 : -1;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
  const s = sorted[0];
  let status: EffectiveStatus;
  if (isValidOn(s, today)) status = s.plan === 'trial_discovery' || s.status === 'trial' ? 'trial' : 'active';
  else if (s.status === 'suspended' || s.status === 'cancelled') status = s.status;
  else status = 'expired';
  return { plan: s.plan, status, endDate: s.end_date, daysRemaining: Math.max(0, dayDiff(today, s.end_date)) };
}

export function currentSubscriptionsByUser(subs: SubscriptionLike[], today: string): Map<string, CurrentSubscription> {
  const grouped = new Map<string, SubscriptionLike[]>();
  subs.forEach((s) => {
    const list = grouped.get(s.user_id) || [];
    list.push(s);
    grouped.set(s.user_id, list);
  });
  const result = new Map<string, CurrentSubscription>();
  grouped.forEach((list, userId) => {
    const current = pickCurrentSubscription(list, today);
    if (current) result.set(userId, current);
  });
  return result;
}
