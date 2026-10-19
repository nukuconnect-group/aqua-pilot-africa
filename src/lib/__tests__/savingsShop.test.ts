import { describe, it, expect } from 'vitest';
import { memberBalance, canWithdraw, agentCollection, orderTotal, SavingsTx } from '../savingsShop';

const txs: SavingsTx[] = [
  { member_id: 'm1', agent_id: 'a1', type: 'deposit', amount: 1000, date: '2026-10-01' },
  { member_id: 'm1', agent_id: 'a1', type: 'deposit', amount: 500, date: '2026-10-02' },
  { member_id: 'm1', agent_id: null, type: 'withdrawal', amount: 300, date: '2026-10-03' },
  { member_id: 'm2', agent_id: 'a1', type: 'deposit', amount: 2000, date: '2026-09-15' },
];

describe('caisse d’épargne', () => {
  it('solde = dépôts − retraits', () => expect(memberBalance('m1', txs)).toBe(1200));
  it('retrait refusé au-delà du solde', () => {
    expect(canWithdraw(1200, 1300)).toBe(false);
    expect(canWithdraw(1200, 1200)).toBe(true);
  });
  it('commission agent sur la période', () => {
    expect(agentCollection('a1', 3, txs, '2026-10-01', '2026-10-31')).toEqual({ collected: 1500, commission: 45 });
  });
});

describe('boutique', () => {
  it('total commande', () => expect(orderTotal([{ product_id: 'p', name: 'Tilapia', quantity: 3, unit_price: 2500 }])).toBe(7500));
});
