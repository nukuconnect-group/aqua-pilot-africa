import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search } from 'lucide-react';
import type { CashMovement, CashSession } from '@/hooks/useCashSession';
import type { Sale } from '@/hooks/useSales';
import { useSettings } from '@/contexts/SettingsContext';
import { normalizeProductSearch } from '@/lib/posCatalog';

interface Props { sessions: CashSession[]; movements: CashMovement[]; sales: Sale[]; activeSessionId?: string }

export default function CashSalesHistory({ sessions, movements, sales, activeSessionId }: Props) {
  const { formatCurrency } = useSettings();
  const [register, setRegister] = useState(activeSessionId || 'all');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const rows = useMemo(() => movements.filter(m => m.type === 'sale').map(m => ({
    movement: m, sale: sales.find(s => s.id === m.sale_id), session: sessions.find(s => s.id === m.session_id),
  })).filter(r => (register === 'all' || r.movement.session_id === register) &&
    (!date || r.movement.created_at.slice(0, 10) === date) &&
    normalizeProductSearch(`${r.sale?.clientName || ''} ${r.sale?.documentNumber || ''} ${r.sale?.products.map(p => p.name).join(' ') || ''} ${r.movement.label || ''}`)
      .includes(normalizeProductSearch(search))), [movements, sales, sessions, register, date, search]);

  const exportCsv = () => {
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const content = [['Date', 'Caisse', 'Client', 'Produits', 'Paiement', 'Montant', 'Statut'], ...rows.map(r => [
      r.movement.created_at, r.session?.name || 'Caisse', r.sale?.clientName || '',
      r.sale?.products.map(p => `${p.name} (${p.quantity} × ${p.unitPrice})`).join(', ') || '',
      r.movement.payment_method, r.movement.amount, r.sale?.status === 'cancelled' ? 'Annulée' : 'Encaissée',
    ])].map(row => row.map(cell).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'ventes-caisses.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={register} onValueChange={setRegister}>
        <SelectTrigger className="w-full sm:w-64" aria-label="Filtrer l’historique par caisse"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">Toutes les caisses</SelectItem>
          {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.name || 'Caisse'} · {new Date(s.opened_at).toLocaleDateString('fr-FR')} · {s.status === 'open' ? 'Ouverte' : 'Clôturée'}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Client, produit, reçu…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <Input type="date" className="w-auto" aria-label="Date des ventes" value={date} onChange={e => setDate(e.target.value)} />
      <Button variant="outline" disabled={!rows.length} onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV</Button>
    </div>
    <div className="text-sm text-muted-foreground">{rows.length} vente(s) · Total encaissé hors annulations : <b className="text-foreground">{formatCurrency(rows.filter(r => r.sale?.status !== 'cancelled').reduce((sum, r) => sum + r.movement.amount, 0))}</b></div>
    {!rows.length && <p className="py-8 text-center text-muted-foreground">Aucune vente pour cette sélection.</p>}
    <div className="divide-y divide-border">
      {rows.map(r => <details key={r.movement.id} className="py-3">
        <summary className="cursor-pointer text-sm">
          <span className="inline-flex flex-wrap gap-x-4 gap-y-1 align-middle">
            <span>{new Date(r.movement.created_at).toLocaleString('fr-FR')}</span>
            <span className="font-medium">{r.sale?.clientName || r.movement.label || 'Client comptoir'}</span>
            <span>{r.session?.name || 'Caisse'}</span>
            <span>{r.movement.payment_method}</span>
            <b>{formatCurrency(r.movement.amount)}</b>
            {r.sale?.status === 'cancelled' && <span className="text-destructive">Annulée</span>}
          </span>
        </summary>
        <div className="mt-3 pl-4 space-y-2 text-sm">
          {r.sale?.documentNumber && <p className="text-muted-foreground">{r.sale.documentNumber}</p>}
          {r.sale?.products.map((p, i) => <div key={i} className="flex flex-wrap justify-between gap-2"><span>{p.name} · {p.quantity} × {formatCurrency(p.unitPrice)}</span><span>{formatCurrency(p.total)}</span></div>)}
          {r.sale?.cancellationReason && <p className="text-destructive">{r.sale.cancellationReason}</p>}
        </div>
      </details>)}
    </div>
  </section>;
}