import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), toast: vi.fn() }));
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useAuthReady', () => ({ useAuthReady: () => ({ isReady: false, isAuthenticated: true }) }));
import { useFeedStocks } from './useFeedStocks';

let api: ReturnType<typeof useFeedStocks> | undefined;
const container = document.createElement('div');
const root = createRoot(container);
const Harness = ({ unitId }: { unitId?: string }) => { api = useFeedStocks(unitId); return null; };
afterEach(async () => { await act(async () => root.render(null)); vi.clearAllMocks(); });
const mount = async (unitId?: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(<Harness unitId={unitId} />));
  if (!api) throw new Error('Hook non monté');
  return api;
};
describe('retrait de produits du stock', () => {
  it('supprime un groupe uniquement dans son unité, en une requête et sans doublons', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }], error: null });
    const filterIds = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ in: filterIds }));
    const remove = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ delete: remove });
    const hook = await mount('unit-a');
    let removed;
    await act(async () => { removed = await hook.deleteStocks(['a', 'b', 'a']); });
    expect(eq).toHaveBeenCalledWith('unit_id', 'unit-a');
    expect(filterIds).toHaveBeenCalledWith('id', ['a', 'b']);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(removed).toEqual(['a', 'b']);
  });
  it('ne retire aucun article sans unité active', async () => {
    const hook = await mount();
    await expect(hook.deleteStocks(['a'])).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('ne lance pas une suppression globale pour une sélection vide', async () => {
    const hook = await mount('unit-a');
    expect(await hook.deleteStocks([])).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('remonte un refus de suppression sans annoncer un succès', async () => {
    mocks.from.mockReturnValue({ delete: () => ({ eq: () => ({ in: () => ({ select: async () => ({ data: null, error: { code: '23503' } }) }) }) }) });
    const hook = await mount('unit-a');
    await expect(hook.deleteStocks(['a', 'b'])).rejects.toEqual({ code: '23503' });
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Succès' }));
  });
});

describe('correction et retrait individuel par unité', () => {
  it('confirme la correction du produit dans la seule unité active', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'a' }, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn().mockReturnValueOnce({ eq: vi.fn(() => ({ select })) });
    const update = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ update });
    const hook = await mount('unit-a');
    await hook.updateStock('a', { quantity: 0, cost: 0, supplier: null });
    expect(update).toHaveBeenCalledWith({ quantity: 0, cost: 0, supplier: null });
    expect(eq).toHaveBeenCalledWith('id', 'a');
    expect(eq.mock.results[0].value.eq).toHaveBeenCalledWith('unit_id', 'unit-a');
    expect(single).toHaveBeenCalledTimes(1);
  });
  it('ne corrige rien sans unité active', async () => {
    const hook = await mount();
    await expect(hook.updateStock('a', { quantity: 0 })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('ne présente pas une correction sans ligne accessible comme réussie', async () => {
    mocks.from.mockReturnValue({ update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ error: { code: 'PGRST116' } }) }) }) }) }) });
    const hook = await mount('unit-a');
    await expect(hook.updateStock('a', { quantity: 15 })).rejects.toEqual({ code: 'PGRST116' });
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Succès' }));
  });
  it('retire uniquement le produit demandé individuellement', async () => {
    const filter = vi.fn(() => ({ select: async () => ({ data: [{ id: 'a' }], error: null }) }));
    mocks.from.mockReturnValue({ delete: () => ({ eq: () => ({ in: filter }) }) });
    const hook = await mount('unit-a');
    expect(await hook.deleteStock('a')).toEqual(['a']);
    expect(filter).toHaveBeenCalledWith('id', ['a']);
  });
});
