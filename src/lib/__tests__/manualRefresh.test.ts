import { expect, it, vi } from 'vitest';
import { registerManualRefresh, refreshMountedData, shouldPullRefresh, refreshApplication, isAppRefreshing, requireFreshRead, isPullSurfaceAtTop } from '../manualRefresh';
it('awaits mounted data and prevents duplicate overlapping refreshes', async () => {
  let finish: (() => void) | undefined;
  const task = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const unregister = registerManualRefresh(task);
  const first = refreshMountedData();
  expect(refreshMountedData()).toBe(first);
  await Promise.resolve(); expect(task).toHaveBeenCalledTimes(1);
  finish?.(); await first; unregister();
  await refreshMountedData(); expect(task).toHaveBeenCalledTimes(1);
});
it('reports a failed data read rather than declaring success', async () => {
  const unregister = registerManualRefresh(() => Promise.reject(new Error('unavailable')));
  await expect(refreshMountedData()).rejects.toThrow('Refresh failed'); unregister();
});
it('refreshes only on a downward pull at the top, never a horizontal or short gesture', () => {
  expect(shouldPullRefresh(80,0,true)).toBe(true);
  expect(shouldPullRefresh(79,0,true)).toBe(false);
  expect(shouldPullRefresh(100,50,true)).toBe(false);
  expect(shouldPullRefresh(100,0,false)).toBe(false);
});
it('shares one awaited application refresh between button and gesture', async () => {
  let finish: (() => void) | undefined;
  const query = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const first = refreshApplication(query);
  expect(isAppRefreshing()).toBe(true);
  expect(refreshApplication(query)).toBe(first);
  await Promise.resolve();
  finish?.(); await first;
  expect(query).toHaveBeenCalledTimes(1);
  expect(isAppRefreshing()).toBe(false);
});
it('reports caught server failures and query failures', async () => {
  expect(() => requireFreshRead(false)).toThrow('Data read failed');
  await expect(refreshApplication(() => Promise.reject(new Error('network')))).rejects.toThrow('Refresh failed');
});
it('never refreshes from the middle of a nested scroller', () => {
  const main = document.createElement('main');
  const list = document.createElement('div'); main.append(list);
  list.scrollTop = 40;
  expect(isPullSurfaceAtTop(list, main)).toBe(false);
  list.scrollTop = 0;
  expect(isPullSurfaceAtTop(list, main)).toBe(true);
});