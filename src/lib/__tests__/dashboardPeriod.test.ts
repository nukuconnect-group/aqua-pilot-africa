import { describe, expect, it } from 'vitest';
import { dashboardPeriod } from '../dashboardPeriod';

describe('dashboard selected periods', () => {
  const now = new Date(2026, 9, 25, 13, 39);
  it('7 jours covers exactly seven days, not years', () => {
    const range = dashboardPeriod('7', now);
    expect(range.start).toBe('2026-10-19');
    expect(range.buckets).toHaveLength(7);
    expect(range.contains('2026-10-18')).toBe(false);
    expect(range.contains('2026-10-19')).toBe(true);
  });
  it('Mois shows 30 days and excludes annual historical data', () => {
    const range = dashboardPeriod('30', now);
    expect(range.start).toBe('2026-09-26');
    expect(range.buckets).toHaveLength(30);
    expect(range.monthly).toBe(false);
    expect(range.contains('2026-02-01')).toBe(false);
    expect(range.contains('2026-09-26')).toBe(true);
  });
  it('Année covers 365 days with month and year labels', () => {
    const range = dashboardPeriod('365', now);
    expect(range.start).toBe('2025-10-26');
    expect(range.contains('2025-10-25')).toBe(false);
    expect(range.contains('2025-10-26')).toBe(true);
    expect(range.monthly).toBe(true);
    expect(range.buckets[0].key).toBe('2025-10');
    expect(range.buckets.at(-1)?.key).toBe('2026-10');
  });
  it('does not include missing, invalid or future observations', () => {
    const range = dashboardPeriod('30', now);
    for (const date of [null, '', 'invalid', '2026-10-26']) expect(range.contains(date)).toBe(false);
    expect(range.contains('2026-10-25T10:00:00Z')).toBe(true);
  });
});