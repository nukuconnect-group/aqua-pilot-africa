import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionDraft } from './useSessionDraft';

let draft: ReturnType<typeof useSessionDraft<string>> | undefined;
const container = document.createElement('div');
const root = createRoot(container);
const Harness = ({ draftKey }: { draftKey: string }) => {
  draft = useSessionDraft(draftKey, ''); return null;
};
const mount = async (draftKey: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(<Harness draftKey={draftKey} />));
  if (!draft) throw new Error('Brouillon non monté');
  return draft;
};
afterEach(async () => { await act(async () => root.render(null)); sessionStorage.clear(); });
describe('saisies de nourrissage', () => {
  it('conserve une saisie après un remontage dû à une mise à jour', async () => {
    let current = await mount('user-a:unit-a');
    await act(async () => current[1]('20 kg prélevés, 15 kg servis'));
    await act(async () => root.render(null));
    current = await mount('user-a:unit-a');
    expect(current[0]).toBe('20 kg prélevés, 15 kg servis');
  });
  it('ne mélange pas les brouillons entre unités ni utilisateurs', async () => {
    const current = await mount('user-a:unit-a');
    await act(async () => current[1]('20'));
    expect((await mount('user-a:unit-b'))[0]).toBe('');
    expect((await mount('user-b:unit-a'))[0]).toBe('');
    expect((await mount('user-a:unit-a'))[0]).toBe('20');
  });
});