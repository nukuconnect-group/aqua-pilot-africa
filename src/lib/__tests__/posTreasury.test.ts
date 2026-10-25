import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: {} }));
import { findRegisterAccount, treasuryNotice, findSaleAccount as selectAccount } from '@/lib/posTreasury';
import { accountCoversUnit } from '@/lib/treasury';

const acc = (id: string, name: string, kind: 'cash' | 'bank' = 'cash') => ({ id, name, kind, user_id: 'u', unit_id: 'x', account_code: '5711', currency: 'XOF' } as any);

describe('caisse de trésorerie rattachée à la caisse de vente', () => {
  it('privilégie le compte explicitement rattaché à la caisse', () => {
    expect(selectAccount([acc('a', 'Caisse 1'), acc('b', 'Coffre')], 'Espèces', 'Caisse 1', 'b')?.id).toBe('b');
  });
  it('refuse une autre caisse si le rattachement explicite est absent', () => {
    expect(selectAccount([acc('a', 'Caisse 1')], 'Espèces', 'Caisse 1', 'absent')).toBeNull();
  });
  it('un compte partagé couvre uniquement ses unités rattachées', () => {
    const shared = { ...acc('a', 'Caisse'), unit_ids: ['deux', 'trois'] };
    expect(accountCoversUnit(shared, 'deux')).toBe(true);
    expect(accountCoversUnit(shared, 'quatre')).toBe(false);
    expect(treasuryNotice([shared], [], 'deux').needs).toEqual([]);
  });
  it('cesse de demander une caisse dès qu’un compte actif existe dans cette unité', () => {
    expect(treasuryNotice([acc('a', 'Caisse')], [], 'x').needs).toEqual([]);
    expect(treasuryNotice([acc('a', 'Caisse')], [], 'autre').needs).toEqual(['cash']);
  });
  it('conserve le report des ventes sans demander un nouveau compte existant', () => {
    expect(treasuryNotice([acc('a', 'Caisse')], [{ total_amount: 6500, payment_method: 'Espèces' }], 'x')).toEqual({ count: 1, amount: 6500, needs: [] });
  });
  it('prend le compte portant le même nom que la caisse', () => {
    expect(findRegisterAccount([acc('a', 'Coffre'), acc('b', 'Caisse 1')], 'caisse 1')?.id).toBe('b');
  });
  it('sinon un compte caisse dont le nom contient « vente »', () => {
    expect(findRegisterAccount([acc('a', 'Banque', 'bank'), acc('c', 'Caisse de vente')], 'Comptoir')?.id).toBe('c');
  });
  it('le seul compte caisse de l’unité reçoit les ventes', () => {
    expect(findRegisterAccount([acc('a', 'Coffre')], 'Comptoir')?.id).toBe('a');
  });
  it('aucun compte si plusieurs caisses sans correspondance ou aucune caisse', () => {
    expect(findRegisterAccount([acc('a', 'Coffre'), acc('b', 'Petite caisse')], 'Comptoir')).toBeNull();
    expect(findRegisterAccount([acc('a', 'Banque', 'bank')], 'Comptoir')).toBeNull();
  });
});

import { paymentDestination, findSaleAccount } from '@/lib/posTreasury';
describe('destination des ventes selon le paiement', () => {
  it('espèces et Mobile Money vont en caisse, carte bancaire et virement en banque', () => {
    expect(paymentDestination('Espèces')).toBe('cash');
    expect(paymentDestination('Mobile Money')).toBe('cash');
    expect(paymentDestination('Carte bancaire')).toBe('bank');
    expect(paymentDestination('Virement bancaire')).toBe('bank');
  });
  it('un virement sans compte bancaire ne trouve aucun compte', () => {
    expect(findSaleAccount([acc('a', 'Caisse de vente')], 'Virement bancaire')).toBeNull();
    expect(findSaleAccount([acc('a', 'Caisse de vente'), acc('b', 'Banque', 'bank')], 'Virement bancaire')?.id).toBe('b');
  });
});
