import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/appClient';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useToast } from '@/hooks/use-toast';
import { getStockPurpose, stocksForUnitType } from '@/lib/stockPurpose';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';

export const applyMovement = (current: number, type: 'in' | 'out' | 'adjust', qty: number) =>
  type === 'in' ? current + qty : type === 'out' ? current - qty : qty;

interface Mv { id: string; stock_id: string; type: 'in' | 'out' | 'adjust'; quantity: number; quantity_after: number; reason: string | null; created_at: string }

const LABEL = { in: 'Entrée', out: 'Sortie', adjust: 'Inventaire' };
const BADGE = {
  in: 'bg-primary/10 text-primary border-primary/30',
  out: 'bg-destructive/10 text-destructive border-destructive/30',
  adjust: 'bg-muted text-foreground border-border',
};
const QTY_TONE = { in: 'text-primary', out: 'text-destructive', adjust: 'text-foreground' };
const fmtNum = (n: number) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const TypeBadge: React.FC<{ type: Mv['type'] }> = ({ type }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE[type]}`}>{LABEL[type]}</span>
);

const StockMovementsPanel: React.FC<{ unitId: string }> = ({ unitId }) => {
  const { stocks: allStocks, updateStock } = useFeedStocks(unitId);
  const { activeUnit } = useProductionUnits();
  const stocks = stocksForUnitType(allStocks, activeUnit?.type);
  const { toast } = useToast();
  const db = supabase as any;
  const [stockId, setStockId] = useState('');
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [rows, setRows] = useState<Mv[]>([]);
  const [notInstalled, setNotInstalled] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await db.from('stock_movements').select('*').eq('unit_id', unitId).order('created_at', { ascending: false }).limit(100);
    if (error) { setNotInstalled(/does not exist|schema cache/i.test(error.message)); return; }
    setRows((data || []).map((r: any) => ({ ...r, quantity: Number(r.quantity), quantity_after: Number(r.quantity_after) })));
  }, [unitId]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const stock = stocks.find((s) => s.id === stockId);
    const q = Number(qty);
    if (!stock || !(q >= 0) || qty === '') return toast({ title: 'Produit et quantité requis', variant: 'destructive' });
    const after = applyMovement(Number(stock.quantity), type, q);
    if (after < 0) return toast({ title: 'Stock insuffisant', description: `Disponible : ${stock.quantity} ${stock.unit}`, variant: 'destructive' });
    const { error } = await db.from('stock_movements').insert({ user_id: stock.user_id, unit_id: unitId, stock_id: stock.id, type, quantity: q, quantity_after: after, reason: reason || null });
    if (error) return toast({ title: 'Mouvement non enregistré', description: error.message, variant: 'destructive' });
    await updateStock(stock.id, { quantity: after });
    setQty(''); setReason(''); load();
  };

  const name = (id: string) => { const s = stocks.find((x) => x.id === id); return s ? (s.custom_name || s.feed_type) : 'Produit supprimé'; };
  const purposeOf = (id: string) => { const s = stocks.find((x) => x.id === id); return s ? (getStockPurpose(s) === 'commercial' ? 'Commercial' : 'Production') : '—'; };
  const unitOf = (id: string) => stocks.find((x) => x.id === id)?.unit || '';
  const signed = (r: Mv) => r.type === 'in' ? `+${fmtNum(r.quantity)}` : r.type === 'out' ? `−${fmtNum(r.quantity)}` : `=${fmtNum(r.quantity)}`;

  if (notInstalled) return <Alert><AlertDescription>Aucun mouvement de stock à afficher pour le moment.</AlertDescription></Alert>;

  return (
    <Card className="min-w-0 rounded-lg">
      <CardHeader className="pb-2"><CardTitle className="text-base">Mouvements de stock</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
          <select aria-label="Produit du mouvement" className="min-w-0 w-full border border-input bg-background rounded-md h-10 px-2 text-sm" value={stockId} onChange={(e) => setStockId(e.target.value)}>
            <option value="">Produit…</option>
            {stocks.map((s) => <option key={s.id} value={s.id}>{s.custom_name || s.feed_type} — {getStockPurpose(s) === 'commercial' ? 'commercial' : 'production'} ({s.quantity} {s.unit})</option>)}
          </select>
          <select aria-label="Type de mouvement" className="min-w-0 w-full border border-input bg-background rounded-md h-10 px-2 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="in">Entrée</option><option value="out">Sortie</option><option value="adjust">Inventaire (quantité comptée)</option>
          </select>
          <Input type="number" min="0" placeholder="Quantité" value={qty} onChange={(e) => setQty(e.target.value)} />
          <Input placeholder="Motif (livraison, perte…)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={submit}>Valider</Button>
        </div>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p> : (<>
          <div className="hidden md:block max-h-[560px] overflow-auto rounded-md border border-border">
            <table className="w-full table-fixed text-sm">
              <colgroup><col className="w-[150px]" /><col /><col className="w-[110px]" /><col className="w-[110px]" /><col className="w-[110px]" /><col className="w-[120px]" /><col className="w-[28%]" /></colgroup>
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">Produit</th>
                  <th className="px-3 py-2.5 text-left font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-left font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Quantité</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock après</th>
                  <th className="px-3 py-2.5 text-left font-medium">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">{rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-3 py-2.5 truncate font-medium" title={name(r.stock_id)}>{name(r.stock_id)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{purposeOf(r.stock_id)}</td>
                  <td className="px-3 py-2.5"><TypeBadge type={r.type} /></td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${QTY_TONE[r.type]}`}>{signed(r)} <span className="font-normal text-muted-foreground">{unitOf(r.stock_id)}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtNum(r.quantity_after)} <span className="text-muted-foreground">{unitOf(r.stock_id)}</span></td>
                  <td className="px-3 py-2.5 truncate text-muted-foreground" title={r.reason || ''}>{r.reason || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <ul className="md:hidden divide-y divide-border rounded-md border border-border">{rows.map((r) => (
            <li key={r.id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{name(r.stock_id)} <span className="text-xs font-normal text-muted-foreground">· Stock {purposeOf(r.stock_id).toLowerCase()}</span></span>
                <TypeBadge type={r.type} />
              </div>
              <div className="flex items-center justify-between text-sm tabular-nums">
                <span className={`font-semibold ${QTY_TONE[r.type]}`}>{signed(r)} {unitOf(r.stock_id)}</span>
                <span className="text-muted-foreground">Après : {fmtNum(r.quantity_after)} {unitOf(r.stock_id)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{r.reason || '—'}</span>
                <span className="shrink-0 tabular-nums">{fmtDate(r.created_at)}</span>
              </div>
            </li>
          ))}</ul>
        </>)}
      </CardContent>
    </Card>
  );
};

export default StockMovementsPanel;
