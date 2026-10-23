import React, { useMemo } from 'react';
import { AlertTriangle, PackageX } from 'lucide-react';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { isCommercialStock } from '@/lib/stockPurpose';
import { suggestedQuantity } from '@/components/accounting/PurchaseStockSection';

/** Résumé succinct des produits en rupture et à réapprovisionner de l'unité active. */
const RestockSummary: React.FC<{ unitId?: string }> = ({ unitId }) => {
  const { stocks } = useFeedStocks(unitId);
  const { out, low } = useMemo(() => {
    const rows = stocks.filter((s) => s.unit_id === unitId || !unitId);
    return {
      out: rows.filter((s) => Number(s.quantity) <= 0),
      low: rows.filter((s) => Number(s.quantity) > 0 && Number(s.quantity) <= Number(s.min_threshold ?? 0)),
    };
  }, [stocks, unitId]);
  if (!unitId || (out.length === 0 && low.length === 0)) return null;

  const go = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('module', 'purchases');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const item = (s: (typeof stocks)[number]) => (
    <li key={s.id} className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="min-w-0 truncate">
        {s.custom_name || s.feed_type}
        <span className="ml-1 text-xs text-muted-foreground">· {isCommercialStock(s) ? 'Commercial' : 'Production'}</span>
      </span>
      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
        {Number(s.quantity)} {s.unit} · commander {suggestedQuantity(s)}
      </span>
    </li>
  );

  return (
    <section className="rounded-md border border-border bg-card p-4" aria-label="Stock à réapprovisionner">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Stock à réapprovisionner</h3>
        <button type="button" onClick={go} className="text-sm font-medium text-primary hover:underline">Ouvrir les achats</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive"><PackageX className="h-4 w-4" /> En rupture ({out.length})</p>
          {out.length ? <ul className="divide-y divide-border">{out.slice(0, 5).map(item)}</ul> : <p className="text-sm text-muted-foreground py-1">Aucun</p>}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-primary" /> Sous le seuil ({low.length})</p>
          {low.length ? <ul className="divide-y divide-border">{low.slice(0, 5).map(item)}</ul> : <p className="text-sm text-muted-foreground py-1">Aucun</p>}
        </div>
      </div>
    </section>
  );
};

export default RestockSummary;
