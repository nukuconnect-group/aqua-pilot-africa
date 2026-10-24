import { describe, expect, it } from 'vitest';
import { allocateFeeding, buildDailyRows, buildSheetFields, cleanObservations, findInfrastructureConflict, readSheetPlan, isSheetScheduled, validateSchedule, dateAfter } from '../feedingSheetPlan';

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
  it('un programme d’une semaine inclut les sept dates mais pas le lendemain', () => {
    const start = '2026-10-26';
    const end = dateAfter(start, 6);
    expect(end).toBe('2026-11-01');
    const sheet = { is_active: true, start_date: start, end_date: end, days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] };
    for (let offset = 0; offset < 7; offset++) expect(isSheetScheduled(sheet, dateAfter(start, offset))).toBe(true);
    expect(isSheetScheduled(sheet, '2026-11-02')).toBe(false);
    expect(isSheetScheduled(sheet, '2026-10-25')).toBe(false);
  });
  it('respecte les jours choisis et refuse une plage inversée', () => {
    expect(isSheetScheduled({ is_active: true, days: ['lundi'] }, '2026-10-27')).toBe(false);
    expect(() => validateSchedule('2026-10-27', '2026-10-26', ['lundi'])).toThrow();
    expect(() => validateSchedule('2026-10-26', '2026-11-01', [])).toThrow();
  });
  it('sauvegarde les doses propres au lundi sans modifier celles du mardi', () => {
    const fields = buildSheetFields([{ period: 'matin', time: '07:00', quantity: 20 }], 'Consignes', {
      lundi: [{ period: 'matin', time: '08:00', quantity: 15 }, { period: 'soir', time: '18:00', quantity: 5 }],
    });
    expect(readSheetPlan(fields, '2026-10-26')).toEqual([{ period: 'matin', time: '08:00', quantity: 15 }, { period: 'soir', time: '18:00', quantity: 5 }]);
    expect(readSheetPlan(fields, '2026-10-27')).toEqual([{ period: 'matin', time: '07:00', quantity: 20 }]);
  });
  it('les matin, midi et soir complètent les mêmes lignes sans effacer les précédentes', () => {
    const plan = [{ period: 'matin' as const, time: '07:00', quantity: 20 }, { period: 'midi' as const, time: '12:00', quantity: 10 }, { period: 'soir' as const, time: '18:00', quantity: 5 }];
    const rows = buildDailyRows(plan, [{ session_type: 'matin', actual_quantity: 15, remaining_quantity: 5 }, { session_type: 'midi', actual_quantity: 10 }, { session_type: 'soir', actual_quantity: 4, remaining_quantity: 1 }]);
    expect(rows.map(row => row.served)).toEqual(['15', '10', '4']);
    expect(buildDailyRows(plan, []).map(row => row.served)).toEqual(['', '', '']);
  });
  it('autorise deux programmes successifs sans chevauchement', () => {
    const sheets = [{ id: 'next', title: 'Semaine suivante', is_active: true, infrastructure_id: 'i1', start_date: '2026-11-02', end_date: '2026-11-08' }];
    expect(findInfrastructureConflict(sheets, 'i1', '2026-10-26', undefined, '2026-11-01')).toBeNull();
    expect(findInfrastructureConflict(sheets, 'i1', '2026-11-01', undefined, '2026-11-02')?.id).toBe('next');
  });
  it('remplit la période nourrie et laisse les autres à compléter', () => {
    const rows = buildDailyRows([{ period: 'matin', time: '07:00', quantity: 20 }, { period: 'soir', time: '17:00', quantity: 10 }],
      [{ session_type: 'matin', time: '07:10:00', actual_quantity: 15, remaining_quantity: 5, mortality: 2, behavior: 'faible', notes: 'Eau trouble · [ref:x]' }], 500);
    expect(rows[0]).toMatchObject({ actualTime: '07:10', fish: '500', prescribed: 20, taken: '20', served: '15', remaining: '5', mortality: '2', behavior: 'Appétit faible', notes: 'Eau trouble ·' });
    expect(rows[1]).toMatchObject({ served: '', remaining: '' });
  });
});
