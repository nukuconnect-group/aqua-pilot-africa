import { describe, it, expect } from 'vitest';
import { analyticsDateRange } from '../analyticsDateRange';
describe('analytics dates', () => {
  it('rejects empty and invalid dates without throwing', () => {
    expect(analyticsDateRange('custom', '', '2026-10-25')).toBeNull();
    expect(analyticsDateRange('custom', '2026-10-01', '')).toBeNull();
    expect(analyticsDateRange('custom', 'invalid', '2026-10-25')).toBeNull();
  });
  it('rejects reversed dates', () => {
    expect(analyticsDateRange('custom', '2026-10-25', '2026-10-01')).toBeNull();
  });
  it('keeps a valid custom range', () => {
    expect(analyticsDateRange('custom', '2026-10-01', '2026-10-25')).toEqual({start:'2026-10-01',end:'2026-10-25',prevStart:'2026-09-07',days:24});
  });
});