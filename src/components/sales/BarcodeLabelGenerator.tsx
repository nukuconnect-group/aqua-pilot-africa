import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Tag, Search } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '@/contexts/SettingsContext';
import { useProductionUnits } from '@/hooks/useProductionUnits';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { getSalePrice, isCommercialStock } from '@/lib/stockPurpose';
import { normalizeProductSearch } from '@/lib/posCatalog';

const isEan13 = (c: string) => /^\d{13}$/.test(c);

/** Étiquettes générées à partir des vrais articles de stock de l'unité active (EAN-13 + QR attribués automatiquement). */
const BarcodeLabelGenerator: React.FC = () => {
  const { companyInfo, formatCurrency } = useSettings();
  const { activeUnit } = useProductionUnits();
  const { stocks } = useFeedStocks(activeUnit?.id);
  const [scope, setScope] = useState<'commercial' | 'all'>('commercial');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copies, setCopies] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => stocks
    .filter((s: any) => s.unit_id === activeUnit?.id && s.barcode && (scope === 'all' || isCommercialStock(s)))
    .filter((s) => !query || normalizeProductSearch(`${s.custom_name || s.feed_type} ${(s as any).barcode}`).includes(normalizeProductSearch(query)))
    .map((s: any) => ({ id: s.id, name: s.custom_name || s.feed_type, code: String(s.barcode), price: getSalePrice(s) || 0 })),
  [stocks, activeUnit?.id, scope, query]);

  const toPrint = useMemo(() => items.filter((i) => selected.has(i.id)).flatMap((i) =>
    Array.from({ length: Math.max(1, Math.min(50, copies)) }, (_, n) => ({ ...i, uid: `${i.id}-${n}` }))), [items, selected, copies]);

  useEffect(() => {
    toPrint.forEach((l) => {
      const el = document.getElementById(`bc-${l.uid}`);
      if (!el) return;
      try {
        JsBarcode(el, l.code, { format: isEan13(l.code) ? 'EAN13' : 'CODE128', width: 1.5, height: 40, fontSize: 11, margin: 2 });
      } catch (err) { console.error('Barcode error', err); }
    });
  }, [toPrint]);

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const print = () => {
    const html = containerRef.current?.innerHTML;
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Étiquettes</title><style>
      body{margin:0;padding:6mm;font-family:system-ui,sans-serif;color:#111}
      .labels{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
      .label{border:1px dashed #999;padding:3mm;border-radius:4px;text-align:center;page-break-inside:avoid}
      .row{display:flex;align-items:center;justify-content:center;gap:3mm}
      .label svg{max-width:100%;height:auto}
      .n{font-weight:600;font-size:12px}.p{font-size:12px;font-weight:600;margin-top:1mm}.c{font-size:9px;color:#555;text-transform:uppercase}
    </style></head><body>${html}</body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Tag className="w-4 h-4 text-primary" /> Étiquettes codes-barres et QR</CardTitle>
          <p className="text-sm text-muted-foreground">Chaque produit reçoit automatiquement un code EAN-13 et un code QR à l’initiation du stock.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rechercher un produit ou un code" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select aria-label="Type de stock" className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as any)}>
              <option value="commercial">Stock commercial</option>
              <option value="all">Tous les stocks</option>
            </select>
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">Copies
              <Input type="number" min={1} max={50} className="w-20" value={copies} onChange={(e) => setCopies(Number(e.target.value) || 1)} />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} /> Tout sélectionner ({items.length})
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSelected(new Set(items.map((i) => i.id))); setTimeout(print, 150); }} disabled={!items.length}>
                <Printer className="w-4 h-4 mr-1" /> Tout imprimer
              </Button>
              <Button size="sm" onClick={print} disabled={!selected.size}>
                <Printer className="w-4 h-4 mr-1" /> Imprimer la sélection ({selected.size})
              </Button>
            </div>
          </div>

          {items.length === 0 ? <p className="text-sm text-muted-foreground">Aucun produit dans le stock de cette unité.</p> : (
            <ul className="max-h-80 divide-y divide-border overflow-auto rounded-md border border-border">
              {items.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                    <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{i.name}</span>
                    <span className="hidden sm:inline font-mono text-xs text-muted-foreground tabular-nums">{i.code}</span>
                    <span className="w-24 text-right text-sm tabular-nums">{i.price > 0 ? formatCurrency(i.price) : <span className="text-destructive text-xs">Sans prix</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {toPrint.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Aperçu ({toPrint.length} étiquette(s))</CardTitle></CardHeader>
          <CardContent>
            <div ref={containerRef}>
              <div className="labels grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {toPrint.map((l) => (
                  <div key={l.uid} className="label rounded border border-dashed border-border bg-card p-2 text-center text-card-foreground">
                    {companyInfo.name && <div className="c text-[10px] uppercase tracking-wide text-muted-foreground">{companyInfo.name}</div>}
                    <div className="n truncate text-sm font-semibold" title={l.name}>{l.name}</div>
                    <div className="row flex items-center justify-center gap-2">
                      <svg id={`bc-${l.uid}`} />
                      <QRCodeSVG value={l.code} size={64} />
                    </div>
                    {l.price > 0 && <div className="p text-sm font-semibold">{formatCurrency(l.price)}</div>}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BarcodeLabelGenerator;
