import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, PackagePlus } from 'lucide-react';
import type { FeedStock } from '@/hooks/useFeedStocks';
import { isCommercialStock } from '@/lib/stockPurpose';

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

interface Props {
  stocks: FeedStock[];
  target: PurchaseStockTarget;
  onTarget: (t: PurchaseStockTarget) => void;
  onPickSuggestion: (s: FeedStock) => void;
}

const PurchaseStockSection: React.FC<Props> = ({ stocks, target, onTarget, onPickSuggestion }) => {
  const suggestions = useMemo(() => lowStockSuggestions(stocks).slice(0, 12), [stocks]);
  const candidates = stocks.filter((s) => target.purpose === 'commercial' ? isCommercialStock(s) : !isCommercialStock(s));
  const selected = stocks.find((s) => s.id === target.stockId);

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Produits en rupture ou presque ({suggestions.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.id} type="button" onClick={() => onPickSuggestion(s)}
                className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-left text-xs hover:border-primary">
                <span className="block font-medium">{s.custom_name || s.feed_type}</span>
                <span className="text-muted-foreground tabular-nums">Reste {Number(s.quantity)} {s.unit} · à commander {suggestedQuantity(s)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="flex items-center gap-1"><PackagePlus className="h-4 w-4" /> Ajouter au stock</Label>
          <select aria-label="Destination du stock" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={target.purpose} onChange={(e) => onTarget({ ...EMPTY_STOCK_TARGET, purpose: e.target.value as any })}>
            <option value="none">Ne pas ajouter (service, frais…)</option>
            <option value="commercial">Stock commercial (à vendre)</option>
            <option value="production">Stock de production</option>
          </select>
        </div>
        {target.purpose !== 'none' && (
          <div>
            <Label>Produit</Label>
            <select aria-label="Produit du stock" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={target.stockId} onChange={(e) => onTarget({ ...target, stockId: e.target.value })}>
              <option value="">Nouveau produit (nom = description)</option>
              {candidates.map((s) => <option key={s.id} value={s.id}>{s.custom_name || s.feed_type} ({Number(s.quantity)} {s.unit})</option>)}
            </select>
          </div>
        )}
        {target.purpose === 'commercial' && !selected && (
          <div>
            <Label>Prix de vente *</Label>
            <Input type="number" min={0} className="mt-1" value={target.salePrice || ''}
              onChange={(e) => onTarget({ ...target, salePrice: Number(e.target.value) || 0 })} placeholder="Prix de vente unitaire" />
          </div>
        )}
      </div>
      {target.purpose !== 'none' && (
        <p className="text-xs text-muted-foreground">La quantité entre en stock dès que l’achat est payé, avec un mouvement d’entrée.</p>
      )}
    </div>
  );
};

export default PurchaseStockSection;
