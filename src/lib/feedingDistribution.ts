import { getStockPurpose } from './stockPurpose';

export function feedingBalance(taken: number, served: number) {
  if (!Number.isFinite(taken) || !Number.isFinite(served) || taken < 0 || served < 0 || served > taken) {
    throw new Error('La quantité servie doit être comprise entre zéro et la quantité prélevée.');
  }
  return { taken, served, returned: Math.round((taken - served) * 1e6) / 1e6 };
}

export function matchesFeedingStock(stock: { unit_id: string; feed_type?: string; custom_name?: string | null; stock_purpose?: string | null; notes?: string | null }, unitId: string, feedType: string) {
  const key = feedType.trim().toLowerCase();
  return stock.unit_id === unitId && getStockPurpose(stock) === 'production' &&
    [stock.feed_type, stock.custom_name].some(name => name?.trim().toLowerCase() === key);
}