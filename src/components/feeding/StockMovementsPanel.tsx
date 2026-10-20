import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/appClient';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useToast } from '@/hooks/use-toast';

export const applyMovement = (current: number, type: 'in' | 'out' | 'adjust', qty: number) =>
  type === 'in' ? current + qty : type === 'out' ? current - qty : qty;

interface Mv { id: string; stock_id: string; type: 'in' | 'out' | 'adjust'; quantity: number; quantity_after: number; reason: string | null; created_at: string }

const LABEL = { in: 'Entrée', out: 'Sortie', adjust: 'Inventaire' };

const StockMovementsPanel: React.FC<{ unitId: string }> = ({ unitId }) => {
  const { stocks, updateStock } = useFeedStocks(unitId);
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

  if (notInstalled) return <Alert><AlertDescription>L'historique des mouvements n'est pas encore activé sur votre serveur : le fichier « stock_movements.sql » doit y être exécuté une fois.</AlertDescription></Alert>;

  return (
    <Card className="min-w-0 rounded-lg">
      <CardHeader className="pb-2"><CardTitle className="text-base">Mouvements de stock</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
          <select aria-label="Produit du mouvement" className="min-w-0 w-full border border-input bg-background rounded-md h-10 px-2 text-sm" value={stockId} onChange={(e) => setStockId(e.target.value)}>
            <option value="">Produit…</option>
            {stocks.map((s) => <option key={s.id} value={s.id}>{s.custom_name || s.feed_type} ({s.quantity} {s.unit})</option>)}
          </select>
          <select aria-label="Type de mouvement" className="min-w-0 w-full border border-input bg-background rounded-md h-10 px-2 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="in">Entrée</option><option value="out">Sortie</option><option value="adjust">Inventaire (quantité comptée)</option>
          </select>
          <Input type="number" min="0" placeholder="Quantité" value={qty} onChange={(e) => setQty(e.target.value)} />
          <Input placeholder="Motif (livraison, perte…)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={submit}>Valider</Button>
        </div>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p> : (
          <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1">Date</th><th>Produit</th><th>Type</th><th className="text-right">Qté</th><th className="text-right">Stock après</th><th>Motif</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50"><td className="py-1">{new Date(r.created_at).toLocaleString('fr-FR')}</td><td>{name(r.stock_id)}</td><td>{LABEL[r.type]}</td>
                <td className="text-right">{r.type === 'out' ? '-' : ''}{r.quantity}</td><td className="text-right">{r.quantity_after}</td><td>{r.reason || ''}</td></tr>
            ))}</tbody></table></div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockMovementsPanel;
