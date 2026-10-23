import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: {} }));
import { findRegisterAccount } from '@/lib/posTreasury';

const acc = (id: string, name: string, kind: 'cash' | 'bank' = 'cash') => ({ id, name, kind, user_id: 'u', unit_id: 'x', account_code: '5711', currency: 'XOF' } as any);

describe('caisse de trésorerie rattachée à la caisse de vente', () => {
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
