import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { usePWAInstallState, initializePWAInstallation } from './usePWAInstallState';

it('shares browser events, ignores stored guesses and waits for actual installation confirmation', async () => {
  localStorage.setItem('aqua-pwa-installed', 'true');
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn() }));
  initializePWAInstallation();
  const host = document.createElement('div');
  const root = createRoot(host);
  let first: ReturnType<typeof usePWAInstallState> | undefined;
  let second: ReturnType<typeof usePWAInstallState> | undefined;
  const Reader = ({ index }: { index: number }) => {
    const state = usePWAInstallState();
    if (index === 1) first = state; else second = state;
    return null;
  };
  await act(async () => root.render(<><Reader index={1} /><Reader index={2} /></>));
  expect(first?.status).toBe('unknown');
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
  await act(async () => { window.dispatchEvent(event); });
  expect(first?.status).toBe('not-installed');
  expect(second?.canPromptInstall).toBe(true);
  await act(async () => { await first?.promptInstall(); });
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(first?.status).toBe('unknown');
  expect(second?.isInstalled).toBe(false);
  await act(async () => { window.dispatchEvent(new Event('appinstalled')); });
  expect(first?.status).toBe('installed');
  expect(second?.status).toBe('installed');
  expect(second?.canPromptInstall).toBe(false);
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  localStorage.clear();
});