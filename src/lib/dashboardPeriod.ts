export type DashboardPeriod = '7' | '14' | '30' | '365';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Inclusive calendar days, bounded at today; never includes absent or invalid dates. */
export function dashboardPeriod(period: DashboardPeriod, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - Number(period) + 1);
  const endKey = dateKey(now);
  const startKey = dateKey(start);
  const contains = (value?: string | null) => {
    if (!value) return false;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return false;
    const key = value.slice(0, 10);
    return key >= startKey && key <= endKey;
  };
  const monthly = period === '365';
  const buckets: { key: string; label: string }[] = [];
  const cursor = monthly ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(start);
  while (dateKey(cursor) <= endKey) {
    buckets.push({ key: dateKey(cursor).slice(0, monthly ? 7 : 10), label: cursor.toLocaleDateString('fr-FR', monthly ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: '2-digit' }) });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1); else cursor.setDate(cursor.getDate() + 1);
  }
  return { start: startKey, end: endKey, contains, buckets, monthly };
}