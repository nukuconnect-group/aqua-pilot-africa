import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({}) }));
import { computeExpectedCash } from '@/hooks/useCashSession';

describe('caisse', () => {
  it('espèces attendues = fond + ventes espèces + entrées - sorties', () => {
    expect(computeExpectedCash(10000, [
      { type: 'sale', amount: 5000, payment_method: 'Espèces' },
      { type: 'sale', amount: 3000, payment_method: 'Mobile Money' },
      { type: 'cash_in', amount: 2000, payment_method: 'Espèces' },
      { type: 'cash_out', amount: 1500, payment_method: 'Espèces' },
    ])).toBe(15500);
  });
});
