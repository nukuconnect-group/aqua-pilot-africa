import { describe, expect, it } from 'vitest';
import { commercialMetrics, commercialForecast, CommercialSale } from '../commercialAnalytics';
const sale = (id: string, unit_id: string, date: string, amount: number, status = 'paid', paid_amount: number | null = null): CommercialSale => ({ id, unit_id, date, total_amount: amount, status, paid_amount, is_credit: status !== 'paid' });
describe('commercial unit real metrics', () => {
  it('uses only the active unit, date window and uncancelled sales', () => {
    const m = commercialMetrics([sale('a', 'u', '2026-10-10', 10000), sale('b', 'other', '2026-10-10', 99999), sale('c', 'u', '2026-10-10', 4000, 'cancelled'), sale('d', 'u', '2026-09-30', 5000)], [], [], 'u', '2026-10-01', '2026-10-31');
    expect(m.revenue).toBe(10000); expect(m.count).toBe(1);
  });
  it('separates collected money and outstanding credit from revenue', () => {
    const m = commercialMetrics([sale('a', 'u', '2026-10-10', 10000, 'pending', 3000)], [], [], 'u', '2026-10-01', '2026-10-31');
    expect(m.paid).toBe(3000); expect(m.outstanding).toBe(7000);
  });
  it('converts real purchase amounts and does not call the balance net profit', () => {
    const m = commercialMetrics([sale('a', 'u', '2026-10-10', 10000)], [{ unit_id: 'u', date: '2026-10-10', amount: 10, currency: 'EUR', status: 'received' }], [], 'u', '2026-10-01', '2026-10-31', n => n * 650);
    expect(m.expenses).toBe(6500); expect(m.balance).toBe(3500);
  });
  it('excludes items from other sales and keeps the real quantity', () => {
    const m = commercialMetrics([sale('a', 'u', '2026-10-10', 10000)], [], [{sale_id:'a',name:'Poisson',quantity:20,total:10000},{sale_id:'b',name:'Autre',quantity:999,total:999}], 'u', '2026-10-01', '2026-10-31');
    expect(m.products).toEqual([{name:'Poisson',quantity:20,total:10000}]);
  });
  it('projects from three completed real months, never the partial month or another unit', () => {
    const data = [sale('a','u','2026-07-01',300),sale('b','u','2026-08-01',600),sale('c','u','2026-09-01',900),sale('d','u','2026-10-01',99999),sale('e','other','2026-09-01',99999)];
    const f = commercialForecast(data, [], 'u', new Date('2026-10-24T12:00:00Z'));
    expect(f.forecast.map(x=>x.revenue)).toEqual([600,600,600]); expect(f.forecast.map(x=>x.month)).toEqual(['2026-11','2026-12','2027-01']);
  });
  it('does not invent a projection without enough history', () => {
    expect(commercialForecast([sale('a','u','2026-09-01',100)], [], 'u', new Date('2026-10-24')).forecast).toEqual([]);
    expect(commercialMetrics([],[],[],'u','2026-10-01','2026-10-31').average).toBeNull();
  });
});