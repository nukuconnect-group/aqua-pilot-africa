const DAY = 86_400_000;
export function analyticsDateRange(period: string, from: string, to: string, now = new Date()) {
  const start = period === 'custom' ? new Date(from) : new Date(now.getTime() - Number(period) * DAY);
  const end = period === 'custom' ? new Date(to) : now;
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return null;
  const span = Math.max(DAY, end.getTime() - start.getTime());
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), prevStart: iso(new Date(start.getTime() - span)), days: Math.round(span / DAY) };
}