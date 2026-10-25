import { describe, expect, it } from 'vitest';
import { analyticsDate, analyticsNumber } from '../analyticsValues';
describe('analytics stored values', () => {
  it('normalizes nullable and serialized quantities for charts', () => {
    expect(analyticsNumber(null)).toBe(0);
    expect(analyticsNumber('20.5')).toBe(20.5);
    expect(analyticsNumber('invalid')).toBe(0);
    expect(analyticsNumber(Infinity)).toBe(0);
    expect(analyticsNumber('20') + analyticsNumber('15')).toBe(35);
  });
  it('ignores missing and invalid recorded dates without crashing', () => {
    expect(analyticsDate(null)).toBeNull();
    expect(analyticsDate(undefined)).toBeNull();
    expect(analyticsDate('invalid')).toBeNull();
    expect(analyticsDate('2026-10-25')?.getFullYear()).toBe(2026);
  });
});