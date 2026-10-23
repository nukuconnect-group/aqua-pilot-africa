import { describe, expect, it } from 'vitest';
import { parseQuickSale } from './CashRegisterPOS';
import { signupUnitTypes } from '@/lib/signupUnits';

const catalog = [{ name: 'Tilapia', price: 2000 }, { name: 'Silure', price: 2500 }];

describe('vente dictée', () => {
  it('reconnaît quantités, produits du stock et client', () => {
    const r = parseQuickSale('5 kg tilapia, 2 silure à Kossi', catalog);
    expect(r.lines).toEqual([
      { name: 'Tilapia', quantity: 5, unitPrice: 2000 },
      { name: 'Silure', quantity: 2, unitPrice: 2500 },
    ]);
    expect(r.client).toBe('Kossi');
  });
  it('ignore un produit absent du stock', () => {
    expect(parseQuickSale('3 carpe', catalog).lines).toEqual([]);
  });
});

describe('unités à l’inscription', () => {
  it('ne garde que les unités existantes de l’application', () => {
    expect(signupUnitTypes(['grossissement', 'Épicerie', 'fabrication_aliment', 'grossissement'])).toEqual(['grossissement', 'fabrication_aliment']);
  });
});
