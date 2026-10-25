import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(async () => ({ error: null })) }));
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: {
  rpc: state.rpc,
  from: (table: string) => {
    const data: Record<string, unknown[]> = {
      sales: [{ id: 'sale-a', total_amount: 6500, status: 'paid', payment_method: 'Espèces', date: '2026-10-25' }],
      treasury_movements: [],
      cash_movements: [{ sale_id: 'sale-a', session_id: 'closed-register-a' }],
      cash_sessions: [{ id: 'closed-register-a', name: 'Caisse A', status: 'closed', treasury_account_id: 'shared-account' }],
    };
    const query = { select: () => query, eq: () => query, neq: () => query, gt: () => query, limit: () => query, in: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: data[table] ?? [], error: null }).then(resolve) };
    return query;
  },
} }));
import { backfillSalesToTreasury } from '../posTreasury';
describe('report des ventes', () => {
  it('utilise la caisse originale même clôturée au lieu d’une caisse choisie au hasard', async () => {
    const result = await backfillSalesToTreasury('unit-a');
    expect(state.rpc).toHaveBeenCalledWith('post_sale_to_linked_treasury', { _sale_id: 'sale-a', _session_id: 'closed-register-a' });
    expect(result.posted).toBe(1);
  });
});