import { describe, expect, it } from 'vitest';
import { findStockShortage, planDeduction } from '../posStock';
import { validateHarvest } from '../harvestTransfer';

const catalog = [{ key: 'tilapia', name: 'Tilapia', price: 2000, unit: 'kg', quantity: 9000, codes: [] }];

describe('vente et stock commercial', () => {
  it('refuse une vente au-delà du stock disponible', () => {
    expect(findStockShortage([{ name: 'Tilapia', quantity: 9001, unitPrice: 2000 }], catalog)).toMatch(/Stock insuffisant/);
  });
  it('accepte une vente de 5 kg sur une récolte de 9 tonnes', () => {
    expect(findStockShortage([{ name: 'Tilapia', quantity: 5, unitPrice: 2000 }], catalog)).toBeNull();
  });
  it('retire la quantité vendue sur plusieurs lots', () => {
    expect(planDeduction(12, [{ id: 'a', quantity: 10 }, { id: 'b', quantity: 5 }]).plan)
      .toEqual([{ id: 'a', take: 10, after: 0 }, { id: 'b', take: 2, after: 3 }]);
  });
  it('refuse un transfert de récolte sans quantité', () => {
    expect(validateHarvest({ cycleId: 'c', unitId: 'u', productName: 'Tilapia', quantity: 0, unit: 'kg', salePrice: 2000 })).not.toBeNull();
  });
});
