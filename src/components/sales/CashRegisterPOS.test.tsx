import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  addSale: vi.fn(), addMovement: vi.fn(), validateSession: vi.fn(), toast: vi.fn(), postAtomic: vi.fn(),
  session: { id: 'register-a', name: 'Caisse A', opened_at: '2026-10-20T00:00:00Z' },
  setActiveSession: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({ formatCurrency: (n: number) => `${n} F CFA`, companyInfo: {} }) }));
vi.mock('@/contexts/ProductionUnitsContext', () => ({ useProductionUnits: () => ({ activeUnit: { id: 'unit-a', name: 'Unité A' } }) }));
vi.mock('@/hooks/useSales', () => ({ useSales: () => ({ sales: [], addSale: state.addSale }) }));
vi.mock('@/hooks/useFeedStocks', () => ({ useFeedStocks: () => ({ stocks: [
  { id: 'stock-a', unit_id: 'unit-a', custom_name: 'Poisson', quantity: 20, unit: 'kg', stock_purpose: 'commercial' },
  { id: 'stock-b', unit_id: 'unit-a', custom_name: 'Aliment', quantity: 30, unit: 'kg', stock_purpose: 'commercial' },
] , updateStock: vi.fn(async () => undefined), refetch: vi.fn(async () => undefined) }) }));
vi.mock('@/hooks/useCashSession', () => ({ useCashSession: () => ({
  session: state.session, sessions: [state.session], movements: [], history: [], allMovements: [],
  expected: 10000, loading: false, setActiveSession: state.setActiveSession, reload: vi.fn(async () => undefined), validateSession: state.validateSession, addMovement: state.addMovement,
}) }));
vi.mock('./BarcodeScanner', () => ({ default: () => null }));
vi.mock('./CashSalesHistory', () => ({ default: () => null }));
vi.mock('@/lib/posStock', async (orig) => ({
  ...(await orig<typeof import('@/lib/posStock')>()),
  postSaleAtomically: state.postAtomic,
  deductSoldStock: vi.fn(async () => undefined),
}));
vi.mock('@/lib/posTreasury', async (orig) => ({
  ...(await orig<typeof import('@/lib/posTreasury')>()),
  hasRegisterAccount: vi.fn(async () => true),
  postSaleToTreasury: vi.fn(async () => ({ status: 'ok' })),
  findUnpostedSales: vi.fn(async () => []),
}));
import CashRegisterPOS from './CashRegisterPOS';

let container: HTMLDivElement;
let root: Root;
const click = async (button: HTMLButtonElement) => { await act(async () => button.click()); };
const button = (text: string) => {
  const match = [...document.querySelectorAll("button")].find(b => b.textContent?.includes(text));
  if (!match) throw new Error(`Missing button: ${text}`);
  return match;
};
const input = async (label: string, value: string) => {
  const element = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!element) throw new Error(`Missing input: ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const fillCart = async () => {
  await input('Rechercher un produit', 'Poisson');
  await click(button('Poisson'));
  await input('Prix du produit', '1');
  await click(button('Ajouter à la sélection'));
  await input('Rechercher un produit', 'Aliment');
  await click(button('Aliment'));
  await input('Prix du produit', '1');
  await click(button('Ajouter à la sélection'));
  await click(button('Ajouter au panier (2)'));
  await input('Quantité 1', '2.5');
  await input('Prix unitaire 1', '2000');
  await input('Quantité 2', '3');
  await input('Prix unitaire 2', '500');
};

beforeEach(async () => {
  vi.clearAllMocks();
  state.validateSession.mockResolvedValue({});
  state.postAtomic.mockResolvedValue(false);
  state.addMovement.mockResolvedValue({});
  state.addSale.mockImplementation(async sale => ({ ...sale, id: 'saved-sale' }));
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(<CashRegisterPOS />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('parcours encaissement — tests isolés sans écriture réelle', () => {
  it('ouvre la caisse sélectionnée depuis la gestion sans créer de vente', async () => {
    const navigate = vi.fn();
    await act(async () => root.render(<CashRegisterPOS view="registers" onNavigate={navigate} />));
    await click(button('Accéder à la caisse'));
    expect(state.setActiveSession).toHaveBeenCalledWith('register-a');
    expect(navigate).toHaveBeenCalledWith('checkout');
    expect(state.addSale).not.toHaveBeenCalled();
  });
  it('conserve des paniers distincts dans la vente IA multi-clients', async () => {
    await act(async () => root.render(<CashRegisterPOS view="multi" />));
    await input('Rechercher un produit', 'Poisson');
    await click(button('Poisson'));
    await input('Prix du produit', '2000');
    await click(button('Ajouter à la sélection'));
    await click(button('Ajouter au panier (1)'));
    await click(button('Nouveau client'));
    expect(button('Encaisser').disabled).toBe(true);
    await click(button('Client 1'));
    expect(button('Encaisser').textContent).toContain('2000 F CFA');
    expect(state.addSale).not.toHaveBeenCalled();
  });
  it('enregistre plusieurs articles, quantités décimales et prix puis rattache 6500 à la caisse choisie', async () => {
    await fillCart();
    expect(button('Encaisser').textContent).toContain('6500 F CFA');
    await click(button('Encaisser'));
    expect(state.addSale).toHaveBeenCalledWith(expect.objectContaining({
      unitId: 'unit-a', totalAmount: 6500, paidAmount: 6500,
      products: [
        { name: 'Poisson', quantity: 2.5, unitPrice: 2000, total: 5000 },
        { name: 'Aliment', quantity: 3, unitPrice: 500, total: 1500 },
      ],
    }));
    expect(state.addMovement).toHaveBeenCalledWith(expect.objectContaining({ sale_id: 'saved-sale', amount: 6500, payment_method: 'Espèces' }), 'register-a');
  });
  it('reprend un mouvement refusé sans créer une deuxième vente', async () => {
    state.addMovement.mockResolvedValueOnce({ error: 'Connexion interrompue' });
    await fillCart(); await click(button('Encaisser'));
    expect(state.addSale).toHaveBeenCalledTimes(1);
    await click(button('Reprendre l’encaissement'));
    expect(state.addSale).toHaveBeenCalledTimes(1);
    expect(state.addMovement).toHaveBeenCalledTimes(2);
  });
  it('ne crée pas une vente payée si la caisse a été fermée entretemps', async () => {
    state.validateSession.mockResolvedValue({ error: 'Cette caisse est fermée' });
    await fillCart(); await click(button('Encaisser'));
    expect(state.addSale).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Encaissement impossible' }));
  });
  it('signale une erreur inattendue et garde les articles pour reprendre', async () => {
    state.addMovement.mockRejectedValueOnce(new Error('Connexion interrompue'));
    await fillCart(); await click(button('Encaisser'));
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Encaissement interrompu', variant: 'destructive' }));
    expect(button('Reprendre l’encaissement').disabled).toBe(false);
  });
  it('encaisse et sort le stock en une seule opération serveur sans second mouvement', async () => {
    state.postAtomic.mockResolvedValue(true);
    await fillCart(); await click(button('Encaisser'));
    expect(state.postAtomic).toHaveBeenCalledWith('unit-a', 'saved-sale', 'register-a', expect.any(Array));
    expect(state.addMovement).not.toHaveBeenCalled();
  });
});