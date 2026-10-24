import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
import AssistantFloatingBubble from './AssistantFloatingBubble';

const container = document.createElement('div');
const root = createRoot(container);
afterEach(async () => { await act(async () => root.render(null)); });
it('déplie, replie et ouvre la conversation uniquement sur demande', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const onOpen = vi.fn();
  await act(async () => root.render(<AssistantFloatingBubble activeTab="stock" onOpen={onOpen} />));
  const click = async (label: string) => {
    const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!button) throw new Error('Bouton absent');
    await act(async () => button.click());
  };
  await click('Déplier AquaAssistant');
  expect(document.querySelector('[role="region"]')).not.toBeNull();
  expect(onOpen).not.toHaveBeenCalled();
  await click('Replier AquaAssistant');
  expect(document.querySelector('[role="region"]')).toBeNull();
  await click('Déplier AquaAssistant');
  const open = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Ouvrir la conversation');
  if (!open) throw new Error('Conversation absente');
  await act(async () => open.click());
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="region"]')).toBeNull();
});