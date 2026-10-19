import { describe, it, expect } from 'vitest';
import { buildEntries, trialBalance, incomeStatement } from '@/lib/syscohada';

describe('SYSCOHADA', () => {
  const entries = buildEntries(
    [{ id: 's1', date: '2026-10-01', clientName: 'A', totalAmount: 100000, status: 'paid', paymentMethod: 'Espèces' }],
    [{ id: 'p1', date: '2026-10-02', category: 'Aliments', description: 'Provende', supplier: 'F', amount: 40000, paymentMethod: 'Mobile Money', status: 'received' }],
    [{ id: 't1', date: '2026-10-01', type: 'revenue', category: 'Vente de poissons', description: 'doublon', amount: 100000, paymentMethod: 'Espèces', status: 'confirmed' }],
  );
  it('chaque écriture est équilibrée', () => {
    entries.forEach((e) => expect(e.lines.reduce((s, l) => s + l.debit - l.credit, 0)).toBe(0));
  });
  it('la vente n’est pas comptée deux fois et le résultat est juste', () => {
    expect(incomeStatement(trialBalance(entries))).toEqual({ produits: 100000, charges: 40000, resultat: 60000 });
  });
  it('vente en espèces en caisse 571, achat aliment en 602', () => {
    const b = trialBalance(entries);
    expect(b.find((r) => r.account === '571')?.soldeD).toBe(100000);
    expect(b.find((r) => r.account === '602')?.soldeD).toBe(40000);
  });
});
