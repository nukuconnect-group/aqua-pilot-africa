import { afterEach, expect, it, vi } from 'vitest';
import { registerAppServiceWorker } from '../pwaRegister';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('refuse les aperçus et retire leur ancien worker sans recharger', async () => {
  const unregister = vi.fn();
  const register = vi.fn();
  vi.stubEnv('PROD', true);
  const listeners = vi.fn();
  const sameWindow = {};
  vi.stubGlobal('window', { self: sameWindow, top: sameWindow, location: { hostname: 'id-preview--b2c5432d-e362-4fa8-8b60-f39686099c32.lovable.app', search: '' }, addEventListener: listeners });
  vi.stubGlobal('navigator', { serviceWorker: { register, getRegistrations: async () => [{ active: { scriptURL: 'https://example.test/sw.js' }, unregister }] } });
  registerAppServiceWorker();
  await Promise.resolve();
  expect(register).not.toHaveBeenCalled();
  expect(unregister).toHaveBeenCalledTimes(1);
  expect(listeners).not.toHaveBeenCalled();
});

it('vérifie les mises à jour en arrière-plan sans activer le worker ni recharger au retour', async () => {
  vi.useFakeTimers(); vi.stubEnv('PROD', true);
  const update = vi.fn().mockResolvedValue(undefined);
  const postMessage = vi.fn();
  const reload = vi.fn();
  const listeners: Record<string, () => void> = {};
  const sameWindow = {};
  vi.stubGlobal('window', { self: sameWindow, top: sameWindow, location: { hostname: 'app.aquapilote.com', search: '', reload }, addEventListener: (event: string, callback: () => void) => { listeners[event] = callback; } });
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: { register: vi.fn().mockResolvedValue({ update, waiting: { postMessage } }) } });
  registerAppServiceWorker();
  listeners.load?.(); await Promise.resolve();
  expect(update).toHaveBeenCalledTimes(1);
  listeners.online?.();
  expect(update).toHaveBeenCalledTimes(1);
  expect(listeners.focus).toBeUndefined();
  expect(listeners.controllerchange).toBeUndefined();
  await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
  expect(update).toHaveBeenCalledTimes(2);
  expect(postMessage).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});