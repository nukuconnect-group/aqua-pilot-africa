import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ updateStock: vi.fn(), deleteStocks: vi.fn(), createStock: vi.fn(), toast: vi.fn(), stocks: [
  { id: 'a', unit_id: 'unit-a', custom_name: 'Article A', feed_type: 'autre', quantity: 10, unit: 'kg', supplier: 'Fournisseur A', cost: 100, min_threshold: 0 },
  { id: 'b', unit_id: 'unit-a', custom_name: 'Article B', feed_type: 'autre', quantity: 20, unit: 'kg', min_threshold: 0 },
] }));
vi.mock('@/hooks/useFeedStocks', () => ({ useFeedStocks: () => ({
  stocks: state.stocks, loading: false, error: null, refetch: vi.fn(), ...state,
}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/contexts/ProductionUnitsContext', () => ({ useProductionUnits: () => ({ activeUnit: { id: 'unit-a', name: 'Unité A', type: 'fish_farming' } }) }));
vi.mock('@/integrations/supabase/appClient', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user' } }) }));
vi.mock('@/hooks/useSuppliers', () => ({ useSuppliers: () => ({ suppliers: [] }) }));
vi.mock('@/components/alerts/AlertHistory', () => ({ default: () => null }));
vi.mock('recharts', () => ({ ResponsiveContainer: () => null, LineChart: () => null, Line: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null }));
import FeedStockManager from './FeedStockManager';
let root: Root;
let container: HTMLDivElement;
const button = (name: string) => {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label') === name || b.textContent?.trim() === name || (name === 'Ajouter stock' && b.textContent?.includes('Ajouter stock')));
  if (!found) throw new Error(`Bouton absent : ${name}`);
  return found;
};
const click = async (name: string) => { await act(async () => button(name).click()); };
const input = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const field = (label: string) => {
  const dialog = document.querySelector('[role="dialog"]');
  const text = [...(dialog?.querySelectorAll('label') || [])].find(l => l.textContent === label);
  const element = text?.parentElement?.querySelector('input');
  if (!element) throw new Error(`Champ absent : ${label}`);
  return element;
};
const select = async (name: string) => {
  const checkbox = document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${name}"]`);
  if (!checkbox) throw new Error(`Sélection absente : ${name}`);
  await act(async () => checkbox.click());
};
beforeEach(async () => {
  vi.clearAllMocks(); sessionStorage.clear(); state.createStock.mockResolvedValue({}); state.deleteStocks.mockImplementation(async ids => ids); state.updateStock.mockResolvedValue({});
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(<FeedStockManager unitId="unit-a" />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe('actions du stock — essais isolés sans données réelles', () => {
  it('corrige la quantité, retire le fournisseur et conserve un seuil nul', async () => {
    await click('Modifier Article A');
    await input(field('Quantité'), '15');
    await input(field('Fournisseur'), '');
    await input(field('Coût par kg (F CFA)'), '0');
    await click('Modifier le stock');
    expect(state.updateStock).toHaveBeenCalledWith('a', expect.objectContaining({ quantity: 15, supplier: null, cost: 0, min_threshold: 0 }));
  });
  it('permet de corriger un article épuisé à zéro', async () => {
    await click('Modifier Article A'); await input(field('Quantité'), '0'); await click('Modifier le stock');
    expect(state.updateStock).toHaveBeenCalledWith('a', expect.objectContaining({ quantity: 0 }));
  });
  it('fermer une correction ne transforme pas un nouvel ajout en modification', async () => {
    await click('Modifier Article A'); await click('Close'); await click('Ajouter stock');
    expect(field('Nom de l’article *').value).toBe('');
  });
  it('20 sacs de 25 kg à 15 000 F le sac : 500 kg à 600 F/kg', async () => {
    await click('Ajouter stock');
    const production = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b => b.textContent?.includes('nourrir mes poissons'));
    await act(async () => production!.click());
    await input(field('Nom de l’article *'), 'Granulés 3 mm');
    await click('En sacs');
    await input(field('Nombre de sacs'), '20');
    await click('25 kg');
    await input(field('Prix d’un sac (F CFA)'), '15000');
    await click('Ajouter le stock');
    expect(state.createStock).toHaveBeenCalledWith(expect.objectContaining({ quantity: 500, unit: 'kg', cost: 600, bag_count: 20, kg_per_bag: 25, stock_purpose: 'production' }));
  });
  it('un brouillon de saisie survit au remontage de l’écran', async () => {
    await click('Ajouter stock');
    await input(field('Nom de l’article *'), 'Aliment en cours');
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<FeedStockManager unitId="unit-a" />));
    expect(field('Nom de l’article *').value).toBe('Aliment en cours');
  });
  it('annuler une suppression ne supprime rien', async () => {
    await click('Supprimer Article A'); await click('Annuler'); expect(state.deleteStocks).not.toHaveBeenCalled();
  });
  it('confirme la suppression individuelle du seul article choisi', async () => {
    await click('Supprimer Article A'); expect(state.deleteStocks).not.toHaveBeenCalled(); await click('Confirmer la suppression');
    expect(state.deleteStocks).toHaveBeenCalledWith(['a']);
  });
  it('supprime les deux articles sélectionnés en groupe', async () => {
    await select('Sélectionner Article A'); await select('Sélectionner Article B'); await click('Supprimer la sélection'); await click('Confirmer la suppression');
    expect(state.deleteStocks).toHaveBeenCalledWith(['a', 'b']);
  });
  it('réinitialise tous les articles même après une recherche', async () => {
    const search = container.querySelector<HTMLInputElement>('input[placeholder="Rechercher un article, fournisseur…"]');
    if (!search) throw new Error('Recherche absente'); await input(search, 'Article A');
    await click('Réinitialiser le stock'); await click('Confirmer la suppression'); expect(state.deleteStocks).toHaveBeenCalledWith(['a', 'b']);
  });
  it('garde la confirmation ouverte si la suppression est refusée', async () => {
    state.deleteStocks.mockRejectedValueOnce({ code: '23503' }); await click('Supprimer Article A'); await click('Confirmer la suppression');
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });
});
