import type { Sale } from '@/hooks/useSales';
import type { FeedStock } from '@/hooks/useFeedStocks';

export interface PosProduct {
  key: string;
  name: string;
  price: number;
  unit?: string;
  quantity?: number;
  codes: string[];
}

export const normalizeProductSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function buildPosCatalog(unitId: string, sales: Sale[], stocks: FeedStock[]): PosProduct[] {
  const products = new Map<string, PosProduct>();
  // Sales are newest first: keep the most recent selling price, never the purchase cost.
  sales.filter(s => s.unitId === unitId && s.status !== 'cancelled').forEach(s => {
    s.products.forEach(p => {
      const key = normalizeProductSearch(p.name);
      if (key && !products.has(key)) products.set(key, { key, name: p.name, price: p.unitPrice, codes: [] });
    });
  });
  stocks.filter(s => s.unit_id === unitId).forEach(s => {
    const name = s.custom_name || s.feed_type;
    const key = normalizeProductSearch(name);
    if (!key) return;
    const existing = products.get(key);
    products.set(key, {
      key, name, price: existing?.price ?? 0, unit: s.unit,
      quantity: (existing?.quantity ?? 0) + Number(s.quantity),
      codes: [...(existing?.codes ?? []), s.id, `AQP-${s.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`],
    });
  });
  return [...products.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export interface PosLine { name: string; quantity: number; unitPrice: number }
export const isValidPosCart = (cart: PosLine[]) => cart.length > 0 && cart.every(l =>
  l.name.trim().length > 0 && Number.isFinite(l.quantity) && l.quantity > 0 &&
  Number.isFinite(l.unitPrice) && l.unitPrice > 0,
);

export const calculatePosTotal = (cart: PosLine[]) =>
  cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);