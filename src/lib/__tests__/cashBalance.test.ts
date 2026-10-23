import { describe, it, expect } from 'vitest';
import { summarizeSession, cashDifference, carriedOverBalance } from '../cashBalance';

describe('caisse à solde permanent', () => {
  it('20 000 d’ouverture + 50 000 de ventes espèces = 70 000 théorique', () => {
    const s = summarizeSession(20000, [{ type: 'sale', amount: 50000, payment_method: 'Espèces' }]);
    expect(s.expected).toBe(70000);
  });
  it('les ventes Mobile Money ne comptent pas dans les espèces', () => {
    const s = summarizeSession(0, [{ type: 'sale', amount: 10000, payment_method: 'Mobile Money' }]);
    expect(s.expected).toBe(0);
    expect(s.sales).toBe(10000);
  });
  it('théorique = ouverture + encaissements + transferts entrants − décaissements − transferts sortants', () => {
    const s = summarizeSession(1000, [
      { type: 'cash_in', amount: 500, payment_method: 'Espèces', label: 'Apport' },
      { type: 'cash_in', amount: 300, payment_method: 'Espèces', label: 'Transfert depuis A' },
      { type: 'cash_out', amount: 200, payment_method: 'Espèces', label: 'Dépense' },
      { type: 'cash_out', amount: 100, payment_method: 'Espèces', label: 'Transfert vers B' },
    ]);
    expect(s.expected).toBe(1500);
    expect(s.transfersIn).toBe(300);
    expect(s.transfersOut).toBe(100);
  });
  it('écart = physique − théorique', () => {
    expect(cashDifference(68000, 70000)).toBe(-2000);
  });
  it('le jour 2 reprend les 70 000 déclarés à la clôture de la même caisse', () => {
    const h = [
      { name: 'Caisse 01', status: 'closed', opened_at: '2026-10-01', closed_at: '2026-10-01T18:00', counted_amount: 70000 },
      { name: 'Autre', status: 'closed', opened_at: '2026-10-02', closed_at: '2026-10-02T18:00', counted_amount: 5 },
    ];
    expect(carriedOverBalance(h, 'caisse 01')).toBe(70000);
    expect(carriedOverBalance(h, 'Nouvelle')).toBeNull();
  });
});
