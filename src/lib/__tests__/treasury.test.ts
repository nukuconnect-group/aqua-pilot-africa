import { describe, it, expect } from 'vitest';
import { movementLines, accountBalance, type TreasuryAccount, type TreasuryMovement } from '../treasury';
import { buildEntries, isBalanced, trialBalance, incomeStatement } from '../syscohada';

const cash: TreasuryAccount = { id: 'cash', user_id: 'owner', unit_id: 'unit', name: 'Caisse', kind: 'cash', account_code: '5711', currency: 'XOF' };
const bank: TreasuryAccount = { ...cash, id: 'bank', name: 'Banque', kind: 'bank', account_code: '5211' };
const move = (kind: TreasuryMovement['kind'], amount: number, source_id: string | null, destination_id: string | null): TreasuryMovement => ({ id: kind, unit_id: 'unit', kind, amount, source_id, destination_id, date: '2026-10-20', label: kind, journal: 'CA', lines: [] });
describe('trésorerie demandée', () => {
  it('initialise une caisse avec débit caisse et crédit de contrepartie', () => {
    expect(movementLines('opening', 10000, undefined, cash, '101')).toEqual([{ account: '5711', debit: 10000, credit: 0 }, { account: '101', debit: 0, credit: 10000 }]);
  });
  it('encaisse avec une écriture équilibrée', () => {
    const lines = movementLines('receipt', 5000, undefined, cash, '411');
    expect(isBalanced(lines)).toBe(true);
    expect(lines[0]).toEqual({ account: '5711', debit: 5000, credit: 0 });
  });
  it('décaisse au crédit du compte banque', () => {
    expect(movementLines('payment', 2000, bank, undefined, '401')[1]).toEqual({ account: '5211', debit: 0, credit: 2000 });
  });
  it('transfère sans créer un revenu ni une charge', () => {
    const lines = movementLines('transfer', 3000, cash, bank);
    expect(lines).toEqual([{ account: '5211', debit: 3000, credit: 0 }, { account: '5711', debit: 0, credit: 3000 }]);
    expect(incomeStatement(trialBalance([{ id: 't', date: '2026-10-20', journal: 'CA', label: 'Transfert', lines }])).resultat).toBe(0);
  });
  it('calcule les fonds restants après entrée, sortie et transfert', () => {
    const movements = [move('opening', 10000, null, 'cash'), move('receipt', 5000, null, 'cash'), move('payment', 2000, 'cash', null), move('transfer', 3000, 'cash', 'bank')];
    expect(accountBalance('cash', movements)).toBe(10000);
    expect(accountBalance('bank', movements)).toBe(3000);
  });
  it('interdit un transfert entre unités', () => {
    expect(() => movementLines('transfer', 3000, cash, { ...bank, unit_id: 'other' })).toThrow('même unité');
  });
  it('conserve la vente payée et ajoute ses contre-écritures à la date d’annulation', () => {
    const entries = buildEntries([{ id: 's', date: '2026-10-01', clientName: 'Client', totalAmount: 5000, status: 'cancelled', statusBeforeCancellation: 'paid', cancelledAt: '2026-10-20T04:10:00Z', cancellationReason: 'Erreur', paymentMethod: 'Espèces' }], [], []);
    expect(entries).toHaveLength(4);
    expect(entries.filter(e => e.id.startsWith('ann-')).map(e => e.date)).toEqual(['2026-10-20', '2026-10-20']);
    expect(entries.every(e => isBalanced(e.lines))).toBe(true);
    expect(incomeStatement(trialBalance(entries)).resultat).toBe(0);
    expect(trialBalance(entries).find(r => r.account === '571')?.soldeD).toBe(0);
  });
  it('n’ajoute pas de contre-écriture pour une vente en attente jamais comptabilisée', () => {
    expect(buildEntries([{ id: 's', date: '2026-10-01', clientName: 'Client', totalAmount: 5000, status: 'cancelled', statusBeforeCancellation: 'pending', cancelledAt: '2026-10-20' }], [], [])).toEqual([]);
  });
  it('ne double pas un achat déjà relié à une dépense', () => {
    const entries = buildEntries([], [{ id: 'p', date: '2026-10-01', category: 'Aliments', description: 'Achat', supplier: 'Fournisseur', amount: 2000, paymentMethod: 'Espèces', status: 'received' }], [{ id: 'tx', date: '2026-10-01', type: 'expense', category: 'Aliments', description: 'Achat', amount: 2000, paymentMethod: 'Espèces', status: 'confirmed', purchaseId: 'p' }]);
    expect(incomeStatement(trialBalance(entries)).charges).toBe(2000);
  });
});