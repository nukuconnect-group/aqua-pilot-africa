export const DASHBOARD_IMAGE_INTERVAL_MS = 30 * 60 * 1000;
export const dashboardImageIndex = (elapsedMs: number) => Math.floor(Math.max(0, elapsedMs) / DASHBOARD_IMAGE_INTERVAL_MS) % 2;