type RefreshTask = () => Promise<unknown> | unknown;
const tasks = new Set<RefreshTask>();
let running: Promise<void> | undefined;
let appRunning: Promise<void> | undefined;
const activityListeners = new Set<() => void>();
export const isAppRefreshing = () => Boolean(appRunning);
export const subscribeAppRefresh = (listener: () => void) => {
  activityListeners.add(listener);
  return () => { activityListeners.delete(listener); };
};
export function requireFreshRead(result: unknown) {
  if (result === false) throw new Error('Data read failed');
}
export function refreshApplication(refetchQueries: () => Promise<unknown>) {
  if (appRunning) return appRunning;
  appRunning = Promise.allSettled([refreshMountedData(), Promise.resolve().then(refetchQueries)])
    .then(results => {
      if (results.some(result => result.status === 'rejected')) throw new Error('Refresh failed');
    }).finally(() => { appRunning = undefined; activityListeners.forEach(listener => listener()); });
  activityListeners.forEach(listener => listener());
  return appRunning;
}
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