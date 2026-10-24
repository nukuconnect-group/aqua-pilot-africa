import { describe, expect, it } from 'vitest';
import { allocateFeeding, buildDailyRows, buildSheetFields, cleanObservations, findInfrastructureConflict, readSheetPlan } from '../feedingSheetPlan';

describe('plan de fiche de nourrissage', () => {
  it('enregistre matin, midi et soir avec heure et quantité dans les champs existants', () => {
    const fields = buildSheetFields([
      { period: 'soir', time: '17:00', quantity: 4 }, { period: 'matin', time: '07:00', quantity: 5 }, { period: 'midi', time: '12:00', quantity: 3 },
    ], 'Tremper l’aliment');
    expect(fields).toMatchObject({ period: 'matin', time: '07:00', quantity: 12 });
    expect(cleanObservations(fields.observations)).toBe('Tremper l’aliment');
    expect(readSheetPlan(fields)).toEqual([
      { period: 'matin', time: '07:00', quantity: 5 }, { period: 'midi', time: '12:00', quantity: 3 }, { period: 'soir', time: '17:00', quantity: 4 },
    ]);
  });
  it('refuse une période sans quantité', () => {
    expect(() => buildSheetFields([{ period: 'midi', time: '12:00', quantity: 0 }])).toThrow(/midi/);
  });
  it('lit une ancienne fiche avec sa seule période', () => {
    expect(readSheetPlan({ period: 'soir', time: '18:00:00', quantity: 7, observations: 'x' })).toEqual([{ period: 'soir', time: '18:00', quantity: 7 }]);
  });
});

describe('une infrastructure par fiche active', () => {
  const sheets = [
    { id: 'a', title: 'Bac 1', is_active: true, infrastructure_id: 'i1', start_date: '2026-10-01', end_date: null },
    { id: 'b', title: 'Bac 2 ancien', is_active: false, infrastructure_id: 'i2', start_date: '2026-10-01', end_date: null },
  ];
  it('bloque une seconde fiche active sur la même infrastructure', () => {
    expect(findInfrastructureConflict(sheets, 'i1', '2026-10-24')?.title).toBe('Bac 1');
  });
  it('autorise après désactivation de l’autre fiche, ou en modifiant la même fiche', () => {
    expect(findInfrastructureConflict(sheets, 'i2', '2026-10-24')).toBeNull();
    expect(findInfrastructureConflict(sheets, 'i1', '2026-10-24', 'a')).toBeNull();
  });
});

describe('prélèvement et retour au stock', () => {
  it('20 kg prélevés, 15 servis : 5 kg retournent au stock', () => {
    expect(allocateFeeding([{ id: 's1', quantity: 100 }], 20, 15)).toEqual([{ id: 's1', before: 100, taken: 20, consumed: 15, returned: 5 }]);
  });
  it('répartit sur plusieurs stocks dans l’ordre et refuse un stock insuffisant', () => {
    expect(allocateFeeding([{ id: 's1', quantity: 12 }, { id: 's2', quantity: 50 }], 20, 15).map(p => [p.id, p.taken, p.consumed])).toEqual([['s1', 12, 12], ['s2', 8, 3]]);
    expect(() => allocateFeeding([{ id: 's1', quantity: 10 }], 20, 15)).toThrow(/insuffisant/);
  });
});

describe('fiche journalière', () => {
  it('remplit la période nourrie et laisse les autres à compléter', () => {
    const rows = buildDailyRows([{ period: 'matin', time: '07:00', quantity: 20 }, { period: 'soir', time: '17:00', quantity: 10 }],
      [{ session_type: 'matin', time: '07:10:00', actual_quantity: 15, remaining_quantity: 5, mortality: 2, behavior: 'faible', notes: 'Eau trouble · [ref:x]' }], 500);
    expect(rows[0]).toMatchObject({ actualTime: '07:10', fish: '500', prescribed: 20, taken: '20', served: '15', remaining: '5', mortality: '2', behavior: 'Appétit faible', notes: 'Eau trouble ·' });
    expect(rows[1]).toMatchObject({ served: '', remaining: '' });
  });
});
