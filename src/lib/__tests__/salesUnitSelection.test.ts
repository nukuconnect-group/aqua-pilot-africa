import { describe, expect, it } from 'vitest';
import { resolveSalesUnit } from '../salesUnitSelection';

describe('unité de vente', () => {
  const a = { id: 'a' }, b = { id: 'b' };
  it('ouvre directement l’unité unique', () => expect(resolveSalesUnit([a], null)).toEqual(a));
  it('conserve l’unité choisie parmi plusieurs', () => expect(resolveSalesUnit([a, b], b)).toEqual(b));
  it('demande un choix avec plusieurs unités sans sélection', () => expect(resolveSalesUnit([a, b], null)).toBeNull());
  it('ne sélectionne pas une unité inaccessible', () => expect(resolveSalesUnit([a], b)).toBeNull());
});