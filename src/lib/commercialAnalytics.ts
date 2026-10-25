import { addMonths, format, startOfMonth, subMonths } from 'date-fns';

export interface CommercialSale {
  id: string; unit_id: string; date: string; total_amount: number; status: string;
  paid_amount: number | null; is_credit: boolean | null;
}
export interface CommercialPurchase {
  unit_id: string; date: string; amount: number; currency: string | null; status: string | null;
}
export interface CommercialItem { sale_id: string; name: string; quantity: number; total: number }

export function commercialMetrics(sales: CommercialSale[], purchases: CommercialPurchase[], items: CommercialItem[], unitId: string, start: string, end: string, convert: (amount: number, currency: string) => number = (amount) => amount) {
  const current = sales.filter(s => s.unit_id === unitId && s.status !== 'cancelled' && s.date >= start && s.date <= end);
  const costs = purchases.filter(p => p.unit_id === unitId && p.status !== 'cancelled' && p.date >= start && p.date <= end);
  const revenue = current.reduce((sum, s) => sum + Number(s.total_amount), 0);
  // Match the sales payment convention: paid sales are fully settled; credits use their recorded paid amount.
  const paid = current.reduce((sum, s) => sum + (s.status === 'paid' ? Number(s.total_amount) : Math.min(Number(s.total_amount), Math.max(0, Number(s.paid_amount) || 0))), 0);
  const expenses = costs.reduce((sum, p) => sum + convert(Number(p.amount), p.currency || 'XOF'), 0);
  const ids = new Set(current.map(s => s.id));
  const products = new Map<string, { name: string; quantity: number; total: number }>();
  items.filter(i => ids.has(i.sale_id)).forEach(i => {
    const row = products.get(i.name) || { name: i.name, quantity: 0, total: 0 };
    row.quantity += Number(i.quantity) || 0; row.total += Number(i.total) || 0; products.set(i.name, row);
  });
  return { revenue, paid, outstanding: revenue - paid, expenses, balance: revenue - expenses, count: current.length,
    average: current.length ? revenue / current.length : null,
    products: [...products.values()].sort((a, b) => b.total - a.total) };
}

// Complete calendar months only: a partial current month must not depress the projection.
export function commercialForecast(sales: CommercialSale[], purchases: CommercialPurchase[], unitId: string, now: Date, convert: (amount: number, currency: string) => number = (amount) => amount) {
  const completed = format(startOfMonth(now), 'yyyy-MM-dd');
  const eligible = [...sales.filter(s => s.unit_id === unitId && s.status !== 'cancelled'), ...purchases.filter(p => p.unit_id === unitId && p.status !== 'cancelled')].filter(r => r.date < completed);
  const first = eligible.map(r => r.date).sort()[0];
  if (!first) return { history: [], forecast: [], months: 0 };
  const history: { month: string; revenue: number; expenses: number }[] = [];
  for (let offset = 12; offset >= 1; offset--) {
    const month = format(subMonths(startOfMonth(now), offset), 'yyyy-MM');
    if (month < first.slice(0, 7)) continue;
    const values = commercialMetrics(sales, purchases, [], unitId, `${month}-01`, `${month}-31`, convert);
    history.push({ month, revenue: values.revenue, expenses: values.expenses });
  }
  if (history.length < 3) return { history, forecast: [], months: history.length };
  const recent = history.slice(-3);
  const revenue = recent.reduce((s, r) => s + r.revenue, 0) / recent.length;
  const expenses = recent.reduce((s, r) => s + r.expenses, 0) / recent.length;
  const forecast = [1, 2, 3].map(offset => ({ month: format(addMonths(startOfMonth(now), offset), 'yyyy-MM'), revenue, expenses }));
  return { history, forecast, months: history.length };
}