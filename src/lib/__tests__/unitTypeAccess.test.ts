import { describe, it, expect } from 'vitest';
import { isUnitTypeAllowed } from '../unitTypeAccess';

describe('isUnitTypeAllowed', () => {
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
