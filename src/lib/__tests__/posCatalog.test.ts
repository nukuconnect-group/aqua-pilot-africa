import { describe, expect, it } from 'vitest';
import { buildPosCatalog, calculatePosTotal, isValidPosCart, normalizeProductSearch } from '../posCatalog';
import type { Sale } from '@/hooks/useSales';
import type { FeedStock } from '@/hooks/useFeedStocks';

const sale = (unitId: string, price: number): Sale => ({
  id: `sale-${price}`, date: '2026-10-20', unitId, clientName: '', clientContact: '',
  products: [{ name: 'Poisson', quantity: 1, unitPrice: price, total: price }],
  totalAmount: price, status: 'paid', paymentMethod: 'Espèces', notes: '',
});
const stock: FeedStock = { id: '12345678-1234-1234-1234-123456789012', user_id: 'owner',
  unit_id: 'unit-a', custom_name: 'Poisson', feed_type: 'article', quantity: 20, unit: 'kg', cost: 500 };

describe('vente en caisse', () => {
  it('recherche les articles du stock avant la première vente sans confondre coût et prix de vente', () => {
    expect(buildPosCatalog('unit-a', [], [stock])[0]).toMatchObject({ name: 'Poisson', price: 0, quantity: 20 });
  });
  it('ne mélange pas les produits entre unités', () => {
    expect(buildPosCatalog('unit-b', [sale('unit-a', 2000)], [stock])).toEqual([]);
  });
  it('conserve le dernier prix réellement vendu', () => {
    expect(buildPosCatalog('unit-a', [sale('unit-a', 2500), sale('unit-a', 2000)], [stock])[0].price).toBe(2500);
  });
  it('reconnaît le code-barres imprimé sur les étiquettes du stock', () => {
    expect(buildPosCatalog('unit-a', [], [stock])[0].codes).toContain('AQP-1234567812');
  });
  it('calcule le total de plusieurs produits avec prix et quantités modifiés', () => {
    expect(calculatePosTotal([{ name: 'Poisson', quantity: 2.5, unitPrice: 2000 }, { name: 'Aliment', quantity: 3, unitPrice: 500 }])).toBe(6500);
  });
  it('refuse un panier sans prix valide', () => {
    expect(isValidPosCart([{ name: 'Poisson', quantity: 1, unitPrice: 0 }])).toBe(false);
    expect(isValidPosCart([{ name: 'Poisson', quantity: 1, unitPrice: 2000 }])).toBe(true);
  });
  it('cherche sans distinction de casse ou accents', () => {
    expect(normalizeProductSearch('  CREVETTÉS ')).toBe('crevettes');
  });
});