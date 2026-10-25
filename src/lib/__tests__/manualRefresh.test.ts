import { expect, it, vi } from 'vitest';
import { registerManualRefresh, refreshMountedData, shouldPullRefresh } from '../manualRefresh';
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