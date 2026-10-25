type RefreshTask = () => Promise<unknown> | unknown;
const tasks = new Set<RefreshTask>();
let running: Promise<void> | undefined;
export function registerManualRefresh(task: RefreshTask) {
  tasks.add(task);
  return () => { tasks.delete(task); };
}
export function refreshMountedData() {
  if (running) return running;
  running = Promise.allSettled([...tasks].map(task => Promise.resolve().then(task)))
    .then(results => {
      if (results.some(result => result.status === 'rejected')) throw new Error('Refresh failed');
    }).finally(() => { running = undefined; });
  return running;
}

export function shouldPullRefresh(distance: number, horizontalDistance: number, atTop: boolean) {
  return atTop && distance >= 80 && Math.abs(horizontalDistance) < 40;
}