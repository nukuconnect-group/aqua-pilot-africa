import { expect, it } from 'vitest';
import { dashboardImageIndex, DASHBOARD_IMAGE_INTERVAL_MS } from '../dashboardImageRotation';
it('alternates the two uploaded images every 30 minutes', () => {
  expect(DASHBOARD_IMAGE_INTERVAL_MS).toBe(1800000);
  expect(dashboardImageIndex(0)).toBe(0);
  expect(dashboardImageIndex(1799999)).toBe(0);
  expect(dashboardImageIndex(1800000)).toBe(1);
  expect(dashboardImageIndex(3600000)).toBe(0);
});