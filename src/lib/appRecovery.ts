type DiagnosticKind =
  | 'console'
  | 'network'
  | 'navigation'
  | 'mutation'
  | 'query-cache'
  | 'route-render'
  | 'hook-state'
  | 'watchdog'
  | 'error-boundary'
  | 'react-crash'
  | 'server-log'
  | 'transition'
  | 'overlay-cleanup';

type DiagnosticEntry = {
  id: string;
  at: string;
  kind: DiagnosticKind;
  label: string;
  data?: unknown;
};

declare global {
  interface Window {
    __AQUA_DIAGNOSTICS__?: DiagnosticEntry[];
    __AQUA_DIAGNOSTIC_MODE__?: boolean;
    __AQUA_DIAGNOSTICS_INSTALLED__?: boolean;
    __AQUA_ROUTE_TRANSITION__?: {
      active: boolean;
      from?: string;
      to?: string;
      startedAt?: number;
      completedAt?: number;
    };
    __AQUA_LAST_RENDERED_MODULE__?: string;
    __AQUA_LAST_ROUTE__?: string;
  }
}

const MAX_ENTRIES = 250;

const safeData = (data: unknown) => {
  try {
    return JSON.parse(JSON.stringify(data, (_key, value) => {
      if (typeof value === 'string' && value.length > 180) return `${value.slice(0, 180)}…`;
      return value;
    }));
  } catch {
    return String(data);
  }
};

const getRouteSnapshot = () => {
  if (typeof window === 'undefined') return {};
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    moduleParam: new URLSearchParams(window.location.search).get('module') || 'dashboard',
    renderedModule: window.__AQUA_LAST_RENDERED_MODULE__ || null,
    routeTransition: window.__AQUA_ROUTE_TRANSITION__ || null,
  };
};

export const isDiagnosticModeEnabled = () => {
  if (typeof window === 'undefined') return false;
  return window.__AQUA_DIAGNOSTIC_MODE__ === true || localStorage.getItem('aqua-diagnostic-mode') === 'true';
};

export const recordDiagnostic = (kind: DiagnosticKind, label: string, data?: unknown) => {
  if (typeof window === 'undefined') return;
  const entry: DiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    kind,
    label,
    data: safeData(data),
  };
  const entries = window.__AQUA_DIAGNOSTICS__ ?? [];
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  window.__AQUA_DIAGNOSTICS__ = entries;
  window.dispatchEvent(new CustomEvent('aqua:diagnostic-entry', { detail: entry }));
};

const shouldPersistError = (kind: DiagnosticKind, label: string) =>
  kind === 'react-crash' ||
  kind === 'error-boundary' ||
  label.toLowerCase().includes('removechild') ||
  label.toLowerCase().includes('module mismatch');

export const persistDiagnosticToServer = async (kind: DiagnosticKind, label: string, data?: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    const { supabase } = await import('@/integrations/supabase/appClient');
    const payload = {
      kind,
      label,
      route: getRouteSnapshot(),
      userAgent: navigator.userAgent,
      at: new Date().toISOString(),
      data: safeData(data),
      recentDiagnostics: (window.__AQUA_DIAGNOSTICS__ || []).slice(-25),
    };

    const { error } = await supabase.functions.invoke('client-error-log', { body: payload });
    if (error) {
      recordDiagnostic('server-log', 'client-error-log failed', { message: error.message });
    } else {
      recordDiagnostic('server-log', 'client-error-log sent', { kind, label });
    }
  } catch (error: any) {
    recordDiagnostic('server-log', 'client-error-log exception', { message: error?.message || String(error) });
  }
};

export const recordClientError = (label: string, error: unknown, extra?: Record<string, unknown>) => {
  const err = error as Error | undefined;
  const data = {
    message: err?.message || String(error),
    name: err?.name,
    stack: err?.stack,
    route: getRouteSnapshot(),
    ...extra,
  };
  recordDiagnostic('react-crash', label, data);
  if (shouldPersistError('react-crash', `${label} ${data.message}`)) {
    void persistDiagnosticToServer('react-crash', label, data);
  }
};

export const beginRouteTransition = (from: string, to: string) => {
  if (typeof window === 'undefined') return;
  window.__AQUA_ROUTE_TRANSITION__ = { active: true, from, to, startedAt: performance.now() };
  recordDiagnostic('transition', 'route transition begin', { from, to, route: getRouteSnapshot() });
  window.dispatchEvent(new CustomEvent('aqua:route-transition-begin', { detail: { from, to } }));
};

export const completeRouteTransition = (module: string) => {
  if (typeof window === 'undefined') return;
  const previous = window.__AQUA_ROUTE_TRANSITION__;
  window.__AQUA_LAST_RENDERED_MODULE__ = module;
  window.__AQUA_LAST_ROUTE__ = window.location.href;
  window.__AQUA_ROUTE_TRANSITION__ = {
    ...previous,
    active: false,
    completedAt: performance.now(),
  };
  recordDiagnostic('route-render', 'module rendered', { module, route: getRouteSnapshot(), previous });
  window.dispatchEvent(new CustomEvent('aqua:route-transition-complete', { detail: { module } }));
};

export const isRouteTransitionActive = () => {
  if (typeof window === 'undefined') return false;
  const transition = window.__AQUA_ROUTE_TRANSITION__;
  if (!transition?.active) return false;
  if (transition.startedAt && performance.now() - transition.startedAt > 1400) {
    transition.active = false;
    recordDiagnostic('transition', 'route transition auto-released', { route: getRouteSnapshot() });
    return false;
  }
  return true;
};

const OPEN_TRANSIENT_OVERLAY_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
  '[data-state="open"][data-side]',
].join(', ');

export const hasOpenTransientOverlay = () => {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector(OPEN_TRANSIENT_OVERLAY_SELECTOR));
};

export const installDiagnostics = () => {
  if (typeof window === 'undefined' || window.__AQUA_DIAGNOSTICS_INSTALLED__) return;
  window.__AQUA_DIAGNOSTICS_INSTALLED__ = true;
  window.__AQUA_DIAGNOSTICS__ = window.__AQUA_DIAGNOSTICS__ ?? [];

  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1' || params.get('diagnostic') === '1') {
    localStorage.setItem('aqua-diagnostic-mode', 'true');
    window.__AQUA_DIAGNOSTIC_MODE__ = true;
  }

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    recordDiagnostic('console', 'console.error', args);
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    recordDiagnostic('console', 'console.warn', args);
    originalWarn(...args);
  };

  window.addEventListener('error', (event) => {
    const data = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      route: getRouteSnapshot(),
    };
    recordDiagnostic('console', 'window.error', data);
    if (event.message?.includes('removeChild')) recordClientError('window.removeChild', event.error || event.message, data);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason);
    const data = { reason, stack: event.reason?.stack, route: getRouteSnapshot() };
    recordDiagnostic('console', 'unhandledrejection', data);
    if (reason.includes('removeChild')) recordClientError('promise.removeChild', event.reason, data);
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const startedAt = performance.now();
    const request = args[0];
    const url = typeof request === 'string' ? request : request instanceof Request ? request.url : String(request);
    try {
      const response = await originalFetch(...args);
      if (!response.ok || isDiagnosticModeEnabled()) {
        recordDiagnostic('network', response.ok ? 'fetch' : 'fetch failed', {
          url,
          status: response.status,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
      return response;
    } catch (error: any) {
      recordDiagnostic('network', 'fetch exception', { url, message: error?.message || String(error) });
      throw error;
    }
  };

  const wrapHistory = (name: 'pushState' | 'replaceState') => {
    const original = history[name].bind(history);
    history[name] = (...args) => {
      const result = original(...args);
      recordDiagnostic('navigation', name, { url: String(args[2] ?? window.location.href) });
      window.dispatchEvent(new CustomEvent('aqua:navigation', { detail: { type: name, url: window.location.href } }));
      return result;
    };
  };
  wrapHistory('pushState');
  wrapHistory('replaceState');
  window.addEventListener('popstate', () => {
    recordDiagnostic('navigation', 'popstate', { url: window.location.href });
  });
};

export const cleanupBlockingOverlays = (reason = 'manual') => {
  if (typeof document === 'undefined') return 0;
  if (isRouteTransitionActive()) {
    recordDiagnostic('overlay-cleanup', `skipped-during-transition:${reason}`, getRouteSnapshot());
    return 0;
  }

  if (hasOpenTransientOverlay()) {
    recordDiagnostic('overlay-cleanup', `skipped-active-overlay:${reason}`, getRouteSnapshot());
    return 0;
  }

  const body = document.body;
  const html = document.documentElement;
  const hadBodyLock =
    body.style.pointerEvents === 'none' ||
    body.style.overflow === 'hidden' ||
    body.hasAttribute('data-scroll-locked') ||
    html.style.pointerEvents === 'none' ||
    html.style.overflow === 'hidden' ||
    html.hasAttribute('data-scroll-locked');

  // Never remove or hide Radix/React portal nodes here. React still owns those
  // DOM nodes; manual DOM mutations can make Radix/React try to unmount a node
  // that is no longer in its expected parent and throw `removeChild`.
  [body, html].forEach((node) => {
    node.style.pointerEvents = '';
    node.style.overflow = '';
    node.removeAttribute('data-scroll-locked');
  });

  const portalCount = document.querySelectorAll(
    '[data-radix-focus-guard], [data-radix-dismissable-layer], [data-radix-popper-content-wrapper]'
  ).length;

  if (hadBodyLock || portalCount > 0) {
    recordDiagnostic('overlay-cleanup', reason, { bodyLockCleared: hadBodyLock, portalCount, removed: 0 });
  }

  return hadBodyLock ? 1 : 0;
};

export const emitDataMutation = (detail: { table: string; action: 'create' | 'update' | 'delete'; id?: string; module?: string }) => {
  recordDiagnostic('mutation', `${detail.table}:${detail.action}`, { ...detail, route: getRouteSnapshot() });
  window.dispatchEvent(new CustomEvent('aqua:data-mutated', { detail: { ...detail, route: getRouteSnapshot() } }));
};

export const requestDataRefresh = (reason: string, tables: string[] = []) => {
  recordDiagnostic('mutation', 'refresh requested', { reason, tables, route: getRouteSnapshot() });
  window.dispatchEvent(new CustomEvent('aqua:data-refresh', { detail: { reason, tables, route: getRouteSnapshot() } }));
};

export const recordHookState = (hook: string, state: Record<string, unknown>) => {
  if (!isDiagnosticModeEnabled()) return;
  recordDiagnostic('hook-state', hook, state);
};
