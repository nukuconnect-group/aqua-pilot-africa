import { describe, expect, it } from 'vitest';
import { groupMovements } from './RevenueByRegister';

describe('encaissements par caisse', () => {
  it('additionne seulement les ventes, par caisse et par mode de paiement', () => {
    const r = groupMovements([
      { session_id: 'a', type: 'sale', amount: 6500, payment_method: 'Espèces' },
      { session_id: 'a', type: 'sale', amount: 1000, payment_method: 'Mobile money' },
      { session_id: 'b', type: 'sale', amount: 2000, payment_method: 'Espèces' },
      { session_id: 'a', type: 'cash_out', amount: 500, payment_method: 'Espèces' },
    ], { a: 'Caisse A', b: 'Caisse B' });
    expect(r.registers).toEqual([
      { label: 'Caisse A', amount: 7500, count: 2 },
      { label: 'Caisse B', amount: 2000, count: 1 },
    ]);
    expect(r.payments[0]).toEqual({ label: 'Espèces', amount: 8500, count: 2 });
  });
});
