import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PurchaseStockSection, { EMPTY_STOCK_TARGET, type PurchaseStockTarget } from './PurchaseStockSection';
import type { FeedStock } from '@/hooks/useFeedStocks';

const commercial = {
  id: 's1', unit_id: 'u1', custom_name: 'Tilapia 1kg', feed_type: 'Tilapia 1kg',
  quantity: 5, unit: 'kg', cost: 500, sale_price: 900, stock_purpose: 'commercial', min_threshold: 10,
} as unknown as FeedStock;

const legacyCommercial = {
  id: 's2', unit_id: 'u1', custom_name: 'Granulés 25kg', feed_type: 'Granulés 25kg',
  quantity: 2, unit: 'sac', cost: 12000, notes: '[Stock commercial] Prix de vente: 15000', min_threshold: 5,
} as unknown as FeedStock;

describe('PurchaseStockSection — réapprovisionnement', () => {
  let container: HTMLDivElement;
  let root: Root;
  let target: PurchaseStockTarget;
  let picked: FeedStock | null;

  const render = async (stocks: FeedStock[]) => {
    target = EMPTY_STOCK_TARGET;
    picked = null;
    await act(async () => {
      root.render(
        <PurchaseStockSection
          stocks={stocks}
          target={target}
          onTarget={(t) => { target = t; }}
          onPickSuggestion={(s) => { picked = s; }}
        />,
      );
    });
  };

  const typeSearch = async (value: string) => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Rechercher un produit à approvisionner"]')!;
    const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setVal.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const clickButton = async (label: string) => {
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
    expect(btn, `bouton « ${label} » visible`).toBeTruthy();
    await act(async () => { btn!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('la recherche affiche le produit existant avec ses prix enregistrés', async () => {
    await render([commercial]);
    await typeSearch('tilapia');
    expect(container.textContent).toContain('Tilapia 1kg');
    expect(container.textContent).toContain('coût 500');
  });

  it('l\'ajout d\'un produit existant pré-remplit prix d\'achat et prix de vente enregistrés', async () => {
    await render([commercial]);
    await typeSearch('tilapia');
    await clickButton('Ajouter');
    expect(target).toEqual({ purpose: 'commercial', stockId: 's1', salePrice: 900 });
    expect(picked?.id).toBe('s1');
    expect(Number((picked as any)?.cost)).toBe(500);
  });

  it('le prix de vente est retrouvé même pour un produit marqué dans les notes (ancienne méthode)', async () => {
    await render([legacyCommercial]);
    await typeSearch('granulés');
    await clickButton('Ajouter');
    expect(target).toEqual({ purpose: 'commercial', stockId: 's2', salePrice: 15000 });
  });

  it('les produits sous leur seuil sont proposés directement à l\'ouverture', async () => {
    await render([commercial]);
    expect(container.textContent).toContain('Produits en rupture ou presque');
    await clickButton('Tilapia 1kg');
    expect(target.stockId).toBe('s1');
  });
});
