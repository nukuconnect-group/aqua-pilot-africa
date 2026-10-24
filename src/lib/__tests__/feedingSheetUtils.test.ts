import { describe, it, expect } from 'vitest';
import {
  normalizePeriodTimes,
  normalizeInfrastructureIds,
  computeFishCounts,
  applyMortality,
  splitMortality,
  isMissingColumnError,
  requireSingleInfrastructure,
} from '../feedingSheetUtils';

describe('normalizePeriodTimes', () => {
  it('lit period_times quand présent et trie matin/midi/soir', () => {
    const result = normalizePeriodTimes({
      period_times: [
        { period: 'soir', time: '18:30' },
        { period: 'matin', time: '07:00' },
      ],
      period: 'midi',
      time: '12:00',
    });
    expect(result).toEqual([
      { period: 'matin', time: '07:00' },
      { period: 'soir', time: '18:30' },
    ]);
  });

  it('replie sur period/time hérités', () => {
    expect(normalizePeriodTimes({ period: 'midi', time: '12:15:00' })).toEqual([
      { period: 'midi', time: '12:15' },
    ]);
  });

  it('ignore les entrées invalides et garde une valeur par défaut', () => {
    expect(normalizePeriodTimes({ period_times: [{ period: 'nuit', time: 'x' }] })).toEqual([
      { period: 'matin', time: '07:00' },
    ]);
  });
});

describe('normalizeInfrastructureIds', () => {
  it('utilise infrastructure_ids sans doublon', () => {
    expect(
      normalizeInfrastructureIds({ infrastructure_ids: ['a', 'b', 'a'], infrastructure_id: 'c' }),
    ).toEqual(['a', 'b']);
  });

  it('replie sur infrastructure_id hérité', () => {
    expect(normalizeInfrastructureIds({ infrastructure_id: 'c' })).toEqual(['c']);
    expect(normalizeInfrastructureIds({})).toEqual([]);
  });
});

describe('fiche par infrastructure', () => {
  it('rattache exactement une infrastructure disponible', () => {
    expect(requireSingleInfrastructure(['i1'], ['i1', 'i2'])).toBe('i1');
  });
  it('refuse deux infrastructures sur la même fiche', () => {
    expect(() => requireSingleInfrastructure(['i1', 'i2'], ['i1', 'i2'])).toThrow();
  });
  it('refuse une fiche sans infrastructure sélectionnée', () => {
    expect(() => requireSingleInfrastructure([], ['i1'])).toThrow();
  });
  it('refuse la création lorsque l’unité ne possède aucune infrastructure', () => {
    expect(() => requireSingleInfrastructure([], [])).toThrow('Vous n’avez aucune infrastructure');
  });
  it('refuse une infrastructure d’une autre unité', () => {
    expect(() => requireSingleInfrastructure(['other-unit'], ['i1'])).toThrow();
  });
});

describe('computeFishCounts', () => {
  const unitInfras = [
    { id: 'i1', name: 'Bac 1' },
    { id: 'i2', name: 'Étang A' },
  ];

  it('additionne les lots liés par infrastructure', () => {
    const counts = computeFishCounts(
      unitInfras,
      [
        { infrastructure_name: 'Bac 1', livestock_batch_id: 'b1', current_quantity: 0 },
        { infrastructure_name: 'bac 1 ', livestock_batch_id: 'b2', current_quantity: 0 },
      ],
      [
        { id: 'b1', quantity: 500, status: 'active' },
        { id: 'b2', quantity: 250, status: 'active' },
      ],
    );
    expect(counts).toEqual({ i1: 750, i2: 0 });
  });

  it('utilise current_quantity quand aucun lot n’est lié et ignore les lots vendus', () => {
    const counts = computeFishCounts(
      unitInfras,
      [
        { infrastructure_name: 'Étang A', current_quantity: 120 },
        { infrastructure_name: 'Bac 1', livestock_batch_id: 'b9', current_quantity: 50 },
      ],
      [{ id: 'b9', quantity: 400, status: 'sold' }],
    );
    expect(counts).toEqual({ i1: 0, i2: 120 });
  });
});

describe('applyMortality', () => {
  it('diminue l’effectif sans passer sous zéro', () => {
    expect(applyMortality(500, 12)).toBe(488);
    expect(applyMortality(10, 25)).toBe(0);
    expect(applyMortality(100, 0)).toBe(100);
  });
});

describe('splitMortality', () => {
  it('répartit le total et place le reste sur la dernière part', () => {
    expect(splitMortality(10, 3)).toEqual([3, 3, 4]);
    expect(splitMortality(5, 1)).toEqual([5]);
  });
});

describe('isMissingColumnError', () => {
  it('reconnaît les erreurs de colonne absente', () => {
    expect(
      isMissingColumnError({ message: "column feeding_sheets.infrastructure_ids does not exist" }, 'infrastructure_ids'),
    ).toBe(true);
    expect(
      isMissingColumnError({ message: "Could not find the 'period_times' column of 'feeding_sheets' in the schema cache" }, 'period_times'),
    ).toBe(true);
    expect(isMissingColumnError({ message: 'row level security violated' }, 'period_times')).toBe(false);
  });
});
