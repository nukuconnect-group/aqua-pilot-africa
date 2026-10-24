import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
import AssistantFloatingBubble from './AssistantFloatingBubble';

const container = document.createElement('div');
const root = createRoot(container);
afterEach(async () => { await act(async () => root.render(null)); sessionStorage.clear(); });
const click = async (label: string) => {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Bouton absent : ${label}`);
  await act(async () => button.click());
};

it('s’affiche déplié à l’arrivée avec un message adapté à l’écran, se réduit et se redéroule par la flèche', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const onOpen = vi.fn();
  await act(async () => root.render(<AssistantFloatingBubble activeTab="stock" onOpen={onOpen} />));
  const region = () => document.querySelector('[role="region"]');
  expect(region()?.textContent).toContain('Bonjour');
  expect(region()?.textContent).toContain('stocks');
  await click('Réduire la bulle AquaAssistant');
  expect(region()).toBeNull();
  expect(document.querySelector('button[aria-label="Dérouler AquaAssistant"]')).not.toBeNull();
  await click('Dérouler AquaAssistant');
  expect(region()).not.toBeNull();
  expect(onOpen).not.toHaveBeenCalled();
  const ask = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Poser une question');
  if (!ask) throw new Error('Conversation absente');
  await act(async () => ask.click());
  expect(onOpen).toHaveBeenCalledTimes(1);
});
