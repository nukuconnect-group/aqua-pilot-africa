import { describe, it, expect } from 'vitest';
import { isUnitTypeAllowed, unitCreationLimit } from '../unitTypeAccess';

describe('isUnitTypeAllowed', () => {
  const period = { start_date: '2026-09-24', end_date: '2026-10-24' };
  it('Petite exploitation limite la création à une unité', () => {
    expect(unitCreationLimit({ ...period, status: 'active', plan: 'annual_basic' }, false, '2026-10-24')).toBe(1);
  });
  it('Semi-industriel limite la création à trois unités', () => {
    expect(unitCreationLimit({ ...period, status: 'active', plan: 'annual_pro' }, false, '2026-10-24')).toBe(3);
  });
  it('Industriel autorise tous les types et un nombre illimité d’unités', () => {
    const sub = { ...period, status: 'active', plan: 'annual_enterprise' };
    expect(unitCreationLimit(sub, false, '2026-10-24')).toBeNull();
    expect(isUnitTypeAllowed(['grossissement'], 'conservation', false, sub, '2026-10-24')).toBe(true);
  });
  it('conserve les unités libres pendant l’essai et pour les administrateurs', () => {
    expect(unitCreationLimit({ ...period, status: 'trial', plan: 'annual_basic' }, false, '2026-10-24')).toBeNull();
    expect(unitCreationLimit({ ...period, status: 'active', plan: 'annual_basic' }, true, '2026-10-24')).toBeNull();
  });
  it('autorise la fabrication d’aliment pendant l’essai malgré un choix grossissement', () => {
    expect(isUnitTypeAllowed(['grossissement'], 'fabrication_aliment', false, { ...period, status: 'trial' }, '2026-10-24')).toBe(true);
  });
  it('refuse la fabrication d’aliment pour un abonnement payant limité au grossissement', () => {
    expect(isUnitTypeAllowed(['grossissement'], 'fabrication_aliment', false, { ...period, status: 'active' }, '2026-10-24')).toBe(false);
  });
  it('autorise plusieurs créations du même type couvert pour un compte payant', () => {
    const paid = { ...period, status: 'active' };
    expect(isUnitTypeAllowed(['grossissement'], 'grossissement', false, paid, '2026-10-24')).toBe(true);
    expect(isUnitTypeAllowed(['grossissement'], 'grossissement', false, paid, '2026-10-24')).toBe(true);
  });
  it('refuse toute création après l’essai sans paiement même pour un type couvert', () => {
    expect(isUnitTypeAllowed(['grossissement'], 'grossissement', false, { ...period, status: 'trial' }, '2026-10-25')).toBe(false);
  });
  it('autorise un type couvert par l’abonnement', () => {
    expect(isUnitTypeAllowed(['grossissement'], 'grossissement', false)).toBe(true);
  });

  it('refuse un type non couvert par l’abonnement', () => {
    expect(isUnitTypeAllowed(['grossissement'], 'fabrication_aliment', false)).toBe(false);
  });

  it('autorise tout quand le profil n’a pas de liste enregistrée (comptes anciens)', () => {
    expect(isUnitTypeAllowed(null, 'fabrication_aliment', false)).toBe(true);
    expect(isUnitTypeAllowed([], 'fabrication_aliment', false)).toBe(true);
  });

  it('n’impose aucune restriction aux administrateurs', () => {
    expect(isUnitTypeAllowed(['grossissement'], 'fabrication_aliment', true)).toBe(true);
  });
});
