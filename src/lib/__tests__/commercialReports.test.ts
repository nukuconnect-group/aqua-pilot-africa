import { describe, expect, it } from 'vitest';
import { buildCommercialReport, commercialReportRange } from '../commercialReports';
import type { CommercialSale } from '../commercialAnalytics';

const sale = (id: string, unit_id: string, date: string, status = 'paid'): CommercialSale => ({ id, unit_id, date, status, total_amount: 100, paid_amount: null, is_credit: false });
describe('commercial reports unit scope', () => {
  it('exports only the active unit sales within the selected period', () => {
    const report = buildCommercialReport({ id: 'sales', unitId: 'u', unitName: 'Unité', start: '2026-10-01', end: '2026-10-25', money: String, convert: n => n, purchases: [], items: [], sales: [sale('included', 'u', '2026-10-10'), sale('other-unit', 'v', '2026-10-10'), sale('old', 'u', '2026-09-30'), sale('cancelled', 'u', '2026-10-10', 'cancelled')] });
    expect(report.sections.find(s => s.type === 'table')?.rows).toEqual([['2026-10-10', 'included', '100', '100', '0']]);
  });
  it('exports commercial products only from eligible sales', () => {
    const report = buildCommercialReport({ id: 'products', unitId: 'u', unitName: 'Unité', start: '2026-10-01', end: '2026-10-25', money: String, convert: n => n, purchases: [], sales: [sale('a', 'u', '2026-10-10')], items: [{ sale_id: 'a', name: 'Poisson', quantity: 2, total: 100 }, { sale_id: 'b', name: 'Autre', quantity: 99, total: 999 }] });
    expect(report.sections[0].rows).toEqual([['Poisson', 2, '100']]);
  });
  it('uses the selected calendar month', () => {
    expect(commercialReportRange('month', new Date('2026-10-25T12:00:00Z'))).toEqual({ start: '2026-10-01', end: '2026-10-25' });
  });
});