import { describe, expect, it } from 'vitest';
import { availableCommercialLots, COMMERCIAL_INFRASTRUCTURE_TYPES, isColdStorage, temperatureSeries, temperatureSummary } from '../commercialInfrastructure';
import { getUnitTerms } from '../unitContext';

describe('commercial infrastructure rules', () => {
  const stocks = [
    { id: 'fish', unit_id: 'commercial', stock_purpose: 'commercial', quantity: 6000 },
    { id: 'feed', unit_id: 'commercial', stock_purpose: 'production', quantity: 100 },
    { id: 'other', unit_id: 'another', stock_purpose: 'commercial', quantity: 6000 },
  ];
  it('offers the six-tonne stock lot from the same unit, not feed or another unit', () => {
    expect(availableCommercialLots(stocks, 'commercial', []).map(s => s.id)).toEqual(['fish']);
    expect(availableCommercialLots(stocks, 'commercial', [])[0].quantity).toBe(6000);
  });
  it('retains the current link and excludes a lot already in another infrastructure', () => {
    const infrastructure = { id: 'cold-room', unitId: 'commercial', specifications: { attachedStockId: 'fish' } };
    expect(availableCommercialLots(stocks, 'commercial', [infrastructure], 'cold-room')).toHaveLength(1);
    expect(availableCommercialLots(stocks, 'commercial', [infrastructure], 'other-room')).toHaveLength(0);
  });
  it('offers cold rooms, ovens, cutting tables and material, not farming basins', () => {
    const options = getUnitTerms('commercialisation').infrastructureTypeOptions.map(t => t.value);
    expect(options).toEqual(COMMERCIAL_INFRASTRUCTURE_TYPES.map(t => t.value));
    expect(options).toEqual(expect.arrayContaining(['chambre_froide','four_fumage','table_decoupe','materiel','materiaux']));
    expect(options).not.toContain('bassin_grossissement');
  });
  it('monitors cold storage rather than ovens or cutting tables', () => {
    expect(isColdStorage('chambre_froide_negative')).toBe(true);
    expect(isColdStorage('four_fumage')).toBe(false);
    expect(isColdStorage('table_decoupe')).toBe(false);
  });
  it('uses only dated temperatures of the selected unit and infrastructure, retaining zero', () => {
    const base = { unit_id: 'commercial', basin_id: 'cold-room', date: '2026-10-25', created_at: '2026-10-25T10:00:00Z' };
    const points = temperatureSeries([
      { ...base, id: 'real', temperature: 0 },
      { ...base, id: 'absent', temperature: null },
      { ...base, id: 'other-unit', unit_id: 'another', temperature: 12 },
      { ...base, id: 'other-room', basin_id: 'other', temperature: 12 },
    ], 'commercial', 'cold-room');
    expect(points.map(p => p.value)).toEqual([0]);
  });
  it('calculates thermal analysis without inventing continuous excursion durations', () => {
    const summary = temperatureSummary([{ time: 0, value: -18 }, { time: 3600000, value: -15 }, { time: 7200000, value: -12 }], -20, -16);
    expect(summary).toMatchObject({ min: -18, max: -12, average: -15, variation: 6, observedHours: 2, outsideCount: 2 });
    expect(temperatureSummary([])).toBeNull();
  });
});