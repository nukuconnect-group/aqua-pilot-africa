import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Tag } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { useSettings } from '@/contexts/SettingsContext';
import type { FeedStock } from '@/hooks/useFeedStocks';

/** Code-barres stable généré automatiquement à partir de l'identifiant de l'article. */
export const stockBarcode = (id: string) => `AQP-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;

const StockBarcodeLabels: React.FC<{ stocks: FeedStock[] }> = ({ stocks }) => {
  const { companyInfo } = useSettings();
  const [selected, setSelected] = useState<Set<string>>(new Set(stocks.map((s) => s.id)));
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => stocks.filter((s) => selected.has(s.id)), [stocks, selected]);

  useEffect(() => {
    items.forEach((s) => {
      const el = document.getElementById(`stock-bc-${s.id}`);
      if (!el) return;
      try {
        JsBarcode(el, stockBarcode(s.id), { format: 'CODE128', width: 1.6, height: 44, displayValue: true, fontSize: 11, margin: 4 });
      } catch (err) {
        console.error('Barcode error', err);
      }
    });
  }, [items]);

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });

  const handlePrint = () => {
    const html = containerRef.current?.innerHTML;
    if (!html) return;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Étiquettes stock</title>
      <style>
        body{margin:0;padding:8mm;font-family:system-ui,sans-serif;color:#111}
        .labels{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
        .label{border:1px dashed #999;padding:4mm;border-radius:4px;text-align:center;page-break-inside:avoid}
        .label .n{font-weight:600;font-size:12px;margin-bottom:2px}
        .label svg{max-width:100%;height:auto}
        @media print { body{padding:4mm} }
      </style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  if (!stocks.length) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Aucun article en stock. Ajoutez ou importez des articles pour générer leurs codes-barres.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4 text-primary" /> Codes-barres des articles en stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(stocks.map((s) => s.id)))}>Tout sélectionner</Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Tout désélectionner</Button>
            <Button size="sm" onClick={handlePrint} disabled={!items.length}>
              <Printer className="w-4 h-4 mr-1" /> Imprimer ({items.length})
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stocks.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm cursor-pointer">
                <Checkbox checked={selected.has(s.id)} onCheckedChange={(c) => toggle(s.id, c === true)} />
                <span className="truncate">{s.custom_name || s.feed_type}</span>
                <span className="ml-auto text-xs text-muted-foreground">{s.quantity} {s.unit}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Aperçu des étiquettes</CardTitle></CardHeader>
        <CardContent>
          <div ref={containerRef}>
            <div className="labels grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map((s) => (
                <div key={s.id} className="label border border-dashed border-border rounded p-2 text-center bg-white text-black">
                  {companyInfo.name && <div className="text-[10px] uppercase tracking-wide text-gray-500">{companyInfo.name}</div>}
                  <div className="n font-semibold text-sm truncate">{s.custom_name || s.feed_type}</div>
                  <svg id={`stock-bc-${s.id}`} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockBarcodeLabels;
