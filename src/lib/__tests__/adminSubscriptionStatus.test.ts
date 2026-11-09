import { describe, it, expect } from 'vitest';
import { pickCurrentSubscription } from '../adminSubscriptionStatus';

const today = '2026-11-09';

describe('pickCurrentSubscription', () => {
  it('shows the newly assigned annual subscription after an expired free trial', () => {
    const current = pickCurrentSubscription([
      { user_id: 'u', plan: 'trial_discovery', status: 'expired', start_date: '2026-09-01', end_date: '2026-10-01', created_at: '2026-09-01' },
      { user_id: 'u', plan: 'annual_basic', status: 'active', start_date: '2026-11-09', end_date: '2027-11-09', created_at: '2026-11-09' },
    ], today);
    expect(current?.plan).toBe('annual_basic');
    expect(current?.status).toBe('active');
    expect(current?.daysRemaining).toBe(365);
  });

  it('treats a trial whose end date has passed as expired even if not yet marked', () => {
    const current = pickCurrentSubscription([
      { user_id: 'u', plan: 'trial_discovery', status: 'active', start_date: '2026-09-10', end_date: '2026-10-10' },
    ], today);
    expect(current?.status).toBe('expired');
  });

  it('returns null when the account has no subscription', () => {
    expect(pickCurrentSubscription([], today)).toBeNull();
  });
});
