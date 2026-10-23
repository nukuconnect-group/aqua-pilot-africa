import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertTriangle, PackagePlus, Search, Plus, X, Store, Warehouse } from 'lucide-react';
import type { FeedStock } from '@/hooks/useFeedStocks';
import { getSalePrice, isCommercialStock } from '@/lib/stockPurpose';
import { normalizeProductSearch } from '@/lib/posCatalog';

export interface PurchaseStockTarget {
  purpose: 'none' | 'commercial' | 'production';
  stockId: string; // '' = nouveau produit
  salePrice: number;
}

export const EMPTY_STOCK_TARGET: PurchaseStockTarget = { purpose: 'none', stockId: '', salePrice: 0 };

/** Produits de l'unité en rupture ou sous leur seuil minimum, les plus urgents d'abord. */
export const lowStockSuggestions = (stocks: FeedStock[]) =>
  stocks
    .filter((s) => Number(s.quantity) <= Number(s.min_threshold ?? 0))
    .sort((a, b) => Number(a.quantity) / Math.max(1, Number(a.min_threshold ?? 1)) - Number(b.quantity) / Math.max(1, Number(b.min_threshold ?? 1)));

/** Quantité proposée : remonter au double du seuil minimum. */
export const suggestedQuantity = (s: FeedStock) =>
  Math.max(1, Math.ceil(Number(s.min_threshold ?? 0) * 2 - Number(s.quantity)));

const stockName = (s: FeedStock) => s.custom_name || s.feed_type;

interface Props {
  stocks: FeedStock[];
  target: PurchaseStockTarget;
  onTarget: (t: PurchaseStockTarget) => void;
  /** Produit existant choisi (réapprovisionnement) : remplit aussi description, unité, prix. */
  onPickSuggestion: (s: FeedStock) => void;
  /** Nouveau produit à créer : pré-remplit la description avec le nom recherché. */
  onCreateNew?: (name: string, purpose: 'commercial' | 'production') => void;
}

const PurchaseStockSection: React.FC<Props> = ({ stocks, target, onTarget, onPickSuggestion, onCreateNew }) => {
  const [query, setQuery] = useState('');
  const suggestions = useMemo(() => lowStockSuggestions(stocks).slice(0, 12), [stocks]);
  const selected = stocks.find((s) => s.id === target.stockId);

  const results = useMemo(() => {
    const q = normalizeProductSearch(query);
    if (!q) return [];
    return stocks
      .filter((s) => normalizeProductSearch(stockName(s)).includes(q) ||
        ((s as any).barcode && String((s as any).barcode).includes(query.trim())))
      .slice(0, 8);
  }, [stocks, query]);

  const pickExisting = (s: FeedStock) => {
    onTarget({ purpose: isCommercialStock(s) ? 'commercial' : 'production', stockId: s.id, salePrice: getSalePrice(s) || 0 });
    onPickSuggestion(s);
    setQuery('');
  };

  const createNew = (purpose: 'commercial' | 'production') => {
    onTarget({ purpose, stockId: '', salePrice: 0 });
    onCreateNew?.(query.trim(), purpose);
    setQuery('');
  };

  // État B : un produit (existant ou nouveau) est choisi.
  if (target.purpose !== 'none') {
    const isCommercial = target.purpose === 'commercial';
    return (
      <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              {isCommercial ? <Store className="h-4 w-4 shrink-0 text-primary" /> : <Warehouse className="h-4 w-4 shrink-0 text-primary" />}
              <span className="truncate">{selected ? stockName(selected) : 'Nouveau produit'}</span>
              <span className="rounded-full border border-primary/40 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {isCommercial ? 'Stock commercial' : 'Stock de production'}
              </span>
              {!selected && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">À créer</span>}
            </p>
            {selected && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground tabular-nums">
                <p>Stock actuel : {Number(selected.quantity)} {selected.unit} · unité de mesure : {selected.unit}</p>
                <p>
                  Prix d’achat enregistré : {Number(selected.cost) > 0 ? `${Number(selected.cost).toLocaleString('fr-FR')} F` : 'non renseigné'}
                  {isCommercial && ` · prix de vente enregistré : ${getSalePrice(selected) > 0 ? `${getSalePrice(selected).toLocaleString('fr-FR')} F` : 'non renseigné'}`}
                </p>
                <p>Ces prix sont repris tels quels ci-dessous ; modifiez-les seulement si nécessaire.</p>
              </div>
            )}
            {!selected && (
              <p className="mt-1 text-xs text-muted-foreground">Le nom du produit est la description de l’achat.</p>
            )}
          </div>
          <button type="button" onClick={() => onTarget(EMPTY_STOCK_TARGET)}
            className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary">
            <X className="h-3 w-3" /> Changer
          </button>
        </div>
        <p className="text-xs text-muted-foreground">La quantité entre en stock dès que l’achat est payé, avec un mouvement d’entrée.</p>
      </div>
    );
  }

  // État A : recherche d'un produit à réapprovisionner, ou création.
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Produits en rupture ou presque ({suggestions.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.id} type="button" onClick={() => pickExisting(s)}
                className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-left text-xs hover:border-primary">
                <span className="block font-medium">{stockName(s)}</span>
                <span className="text-muted-foreground tabular-nums">Reste {Number(s.quantity)} {s.unit} · à commander {suggestedQuantity(s)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label className="flex items-center gap-1"><PackagePlus className="h-4 w-4" /> Produit à approvisionner</Label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit par nom ou code-barres…"
            className="pl-9"
            aria-label="Rechercher un produit à approvisionner"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sans choix de produit, l’achat n’entre dans aucun stock (service, frais…).
        </p>
      </div>

      {query.trim() && (
        <div className="space-y-1.5">
          {results.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{stockName(s)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {isCommercialStock(s) ? 'Commercial' : 'Production'} · reste {Number(s.quantity)} {s.unit}
                  {Number(s.cost) > 0 ? ` · achat ${Number(s.cost).toLocaleString('fr-FR')} F` : ''}
                  {isCommercialStock(s) && getSalePrice(s) > 0 ? ` · vente ${getSalePrice(s).toLocaleString('fr-FR')} F` : ''}
                </p>
              </div>
              <button type="button" onClick={() => pickExisting(s)}
                className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
            </div>
          ))}
          <div className="rounded-md border border-dashed border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {results.length === 0 ? `« ${query.trim()} » n’existe pas encore.` : 'Pas dans la liste ?'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => createNew('commercial')}
                className="flex items-center gap-1 rounded-md border border-primary px-2.5 py-1.5 text-xs font-medium text-primary">
                <Store className="h-3.5 w-3.5" /> Créer en stock commercial
              </button>
              <button type="button" onClick={() => createNew('production')}
                className="flex items-center gap-1 rounded-md border border-primary px-2.5 py-1.5 text-xs font-medium text-primary">
                <Warehouse className="h-3.5 w-3.5" /> Créer en stock de production
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseStockSection;
