import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sheet = { id: 'sheet-a', user_id: 'user-a', unit_id: 'unit-a', title: 'Fiche test', infrastructure_ids: ['infra-a'], period: 'matin', time: '07:00', feed_type: 'Aliment test', quantity: 20, unit: 'kg', frequency: 'daily', days: ['samedi'], start_date: '2026-10-24', is_active: true };
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn(), refetch: vi.fn(), noInfrastructure: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
vi.mock('@/contexts/ProductionUnitsContext', () => ({ useProductionUnits: () => ({ infrastructures: mocks.noInfrastructure ? [] : [{ id: 'infra-a', unitId: 'unit-a', name: 'Infrastructure test' }] }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ companyInfo: {} }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useFeedStocks', () => ({ useFeedStocks: () => ({ stocks: [{ id: 'stock-a', unit_id: 'unit-a', feed_type: 'Aliment test', quantity: 100, unit: 'kg', stock_purpose: 'production' }], refetch: mocks.refetch }) }));
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: {
  rpc: mocks.rpc,
  from: (table: string) => {
    const result = { data: table === 'feeding_sheets' ? [sheet] : [], error: null };
    const chain = { select: () => chain, eq: () => chain, order: async () => result, then: (resolve: (r: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  },
} }));
import FeedingSheetsManager from './FeedingSheetsManager';

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<FeedingSheetsManager unitId="unit-a" unitName="Unité test" />));
};
const click = async (text: string) => {
  const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === text);
  if (!button) throw new Error(`Action introuvable : ${text}`);
  await act(async () => button.click());
};
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); sessionStorage.clear(); mocks.noInfrastructure = false; vi.clearAllMocks(); });

describe('enregistrement depuis la fiche', () => {
  it('empêche la création sans infrastructure et ne lance aucune écriture', async () => {
    mocks.noInfrastructure = true;
    await mount(); await click('Créer une fiche d’alimentation');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Aucune infrastructure', variant: 'destructive' }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('envoie la période, l’heure réelle, 20 prélevés, 15 servis et 5 retournés en une seule opération', async () => {
    mocks.rpc.mockResolvedValue({ data: { status: 'ok' }, error: null });
    await mount(); await click('Nourrir aujourd’hui');
    const numbers = document.querySelectorAll<HTMLInputElement>('input[type="number"]');
    const served = numbers[1];
    if (!served) throw new Error('Quantité servie absente');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(served, '15'); served.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click('Enregistrer le nourrissage');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('record_sheet_feeding', expect.objectContaining({
      _sheet_id: 'sheet-a', _period: 'matin', _time: expect.stringMatching(/^\d{2}:\d{2}$/),
      _lines: [{ infrastructure_id: 'infra-a', taken: 20, served: 15, returned: 5, mortality: 0 }],
    }));
    expect(mocks.refetch).toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('conserve le brouillon et la même référence après un refus, sans annoncer de succès', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await mount(); await click('Nourrir aujourd’hui'); await click('Enregistrer le nourrissage');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Nourrissage enregistré' }));
    const firstRequest = mocks.rpc.mock.calls[0][1]._request_id;
    await click('Enregistrer le nourrissage');
    expect(mocks.rpc.mock.calls[1][1]._request_id).toBe(firstRequest);
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
});