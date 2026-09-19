import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ScanLine, Search } from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import type { TraceabilityRecord } from './useFeedOperations';

const PRODUCT_TYPES = [
  { key: 'matiere_premiere', label: 'Matière première' },
  { key: 'aliment_fini', label: 'Aliment fini' },
  { key: 'poisson', label: 'Poisson' },
  { key: 'produit_transforme', label: 'Produit transformé' },
];

const STATES = [
  { key: 'en_stock', label: 'En stock' },
  { key: 'en_production', label: 'En production' },
  { key: 'expedie', label: 'Expédié' },
  { key: 'consomme', label: 'Consommé' },
  { key: 'rebut', label: 'Rebut' },
];

const empty = {
  batch_number: '',
  product_type: 'aliment_fini',
  product_name: '',
  entry_date: new Date().toISOString().slice(0, 10),
  quantity: 0,
  unit_label: 'kg',
  origin: '',
  destination: '',
  state: 'en_stock',
  notes: '',
};

interface Props {
  records: TraceabilityRecord[];
  onSave: (payload: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

const FeedTraceability: React.FC<Props> = ({ records, onSave, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      r.batch_number.toLowerCase().includes(q) ||
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.origin || '').toLowerCase().includes(q) ||
      (r.destination || '').toLowerCase().includes(q));
  }, [records, search]);

  const submit = async () => {
    if (!form.batch_number?.trim()) return;
    await onSave({
      ...form,
      batch_number: form.batch_number.trim(),
      quantity: Number(form.quantity || 0),
      unit_label: form.unit_label || 'kg',
    });
    setOpen(false);
    setForm(empty);
  };

  const exportOptions = {
    title: 'Traçabilité des lots',
    filename: `tracabilite-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'batch_number', label: 'N° de lot' },
      { key: 'product_type', label: 'Type' },
      { key: 'product_name', label: 'Produit' },
      { key: 'entry_date', label: 'Date' },
      { key: 'quantity', label: 'Quantité' },
      { key: 'unit_label', label: 'Unité' },
      { key: 'origin', label: 'Origine' },
      { key: 'destination', label: 'Destination' },
      { key: 'state', label: 'État' },
    ],
    data: filtered as any[],
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-primary" />Traçabilité
            </CardTitle>
            <CardDescription className="text-xs">
              {records.length} lots suivis — origine, mouvements et destination.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportDropdown options={exportOptions as any} />
            <Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />Nouveau lot
            </Button>
          </div>
        </div>
        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-2.5 top-4.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher un lot, un produit, une origine…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2">N° de lot</th><th className="py-2">Type</th><th className="py-2">Produit</th>
              <th className="py-2">Date</th><th className="py-2 text-right">Quantité</th>
              <th className="py-2">Origine</th><th className="py-2">Destination</th><th className="py-2">État</th><th />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-1.5 font-medium">{r.batch_number}</td>
                <td className="py-1.5 text-xs">{PRODUCT_TYPES.find(p => p.key === r.product_type)?.label ?? r.product_type}</td>
                <td className="py-1.5">{r.product_name || '—'}</td>
                <td className="py-1.5 text-xs text-muted-foreground">{r.entry_date}</td>
                <td className="py-1.5 text-right">{Number(r.quantity).toFixed(1)} {r.unit_label}</td>
                <td className="py-1.5 text-xs">{r.origin || '—'}</td>
                <td className="py-1.5 text-xs">{r.destination || '—'}</td>
                <td className="py-1.5">
                  <Badge variant={r.state === 'rebut' ? 'destructive' : 'outline'} className="text-[10px]">
                    {STATES.find(s => s.key === r.state)?.label ?? r.state}
                  </Badge>
                </td>
                <td className="py-1.5 text-right">
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">Aucun lot tracé.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau lot tracé</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">N° de lot</Label>
              <Input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Type de produit</Label>
              <Select value={form.product_type} onValueChange={v => setForm({ ...form, product_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCT_TYPES.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Nom du produit</Label>
              <Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Date d’entrée</Label>
              <Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantité</Label>
              <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Unité</Label>
              <Input value={form.unit_label} onChange={e => setForm({ ...form, unit_label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">État</Label>
              <Select value={form.state} onValueChange={v => setForm({ ...form, state: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Origine</Label>
              <Input value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Destination</Label>
              <Input value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FeedTraceability;
