import { useEffect, useSyncExternalStore } from 'react';
import { installationStatus, type InstallationStatus } from '@/lib/pwaInstallation';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const isStandaloneDisplay = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: minimal-ui)').matches || window.matchMedia?.('(display-mode: window-controls-overlay)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
};
export const supportsInstallPrompt = () => typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;
interface Snapshot { status: InstallationStatus; isInstalled: boolean; isStandalone: boolean; canPromptInstall: boolean; isReady: boolean; busy: boolean }
let confirmed = false;
let deferred: BeforeInstallPromptEvent | null = null;
let initialized = false;
let checking = 0;
let snapshot: Snapshot = { status: 'unknown', isInstalled: false, isStandalone: false, canPromptInstall: false, isReady: false, busy: false };
const listeners = new Set<() => void>();
function publish() {
  const standalone = isStandaloneDisplay();
  snapshot = { ...snapshot, status: installationStatus(confirmed, Boolean(deferred)), isInstalled: confirmed, isStandalone: standalone, canPromptInstall: Boolean(deferred) && !confirmed && !standalone, isReady: true };
  listeners.forEach(listener => listener());
}
async function detect() {
  const generation = ++checking;
  publish();
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string; id?: string }>> };
  if (!nav.getInstalledRelatedApps) return;
  try {
    const apps = await nav.getInstalledRelatedApps();
    if (generation !== checking) return;
    // An empty list proves nothing: the API only reports configured related apps.
    const manifest = new URL('/manifest.json', window.location.origin).href;
    if (apps.some(app => app.platform === 'webapp' && app.url && new URL(app.url, window.location.origin).href === manifest)) {
      confirmed = true; deferred = null; publish();
    }
  } catch { /* Browser cannot verify; retain unknown, not a local guess. */ }
}
export function initializePWAInstallation() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (confirmed) return;
    deferred = event as BeforeInstallPromptEvent;
    publish();
  });
  window.addEventListener('appinstalled', () => { ++checking; confirmed = true; deferred = null; publish(); });
  for (const mode of ['standalone', 'minimal-ui', 'window-controls-overlay']) {
    window.matchMedia?.(`(display-mode: ${mode})`).addEventListener?.('change', () => { void detect(); });
  }
  window.addEventListener('pageshow', () => { void detect(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void detect(); });
  void detect();
}
async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event || snapshot.busy || confirmed || isStandaloneDisplay()) return 'unavailable';
  snapshot = { ...snapshot, busy: true }; listeners.forEach(listener => listener());
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Acceptance is not proof that installation completed; wait for appinstalled.
    return outcome;
  } catch { return 'unavailable'; }
  finally { if (deferred === event) deferred = null; snapshot = { ...snapshot, busy: false }; publish(); }
}
export const usePWAInstallState = () => {
  useEffect(initializePWAInstallation, []);
  const state = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => snapshot, () => snapshot);
  return { ...state, promptInstall };
};
