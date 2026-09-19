import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Factory, Pencil } from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import type { FeedProductionCycle } from './useFeedOperations';
import { useSettings } from '@/contexts/SettingsContext';
import { tr } from '@/i18n/runtime';

const STATUSES = [
  { key: 'planifie', label: 'Planifié' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'termine', label: 'Terminé' },
  { key: 'annule', label: 'Annulé' },
];

const empty = {
  name: '',
  formulation_name: '',
  batch_number: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
  planned_quantity_kg: 0,
  produced_quantity_kg: 0,
  loss_kg: 0,
  total_cost: 0,
  status: 'planifie',
  notes: '',
};

interface Props {
  cycles: FeedProductionCycle[];
  formulationNames: string[];
  onSave: (payload: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

const FeedProductionCycles: React.FC<Props> = ({ cycles, formulationNames, onSave, onDelete }) => {
  const { formatCurrency } = useProductionUnits();
  const { language } = useSettings();
  const text = (value: string) => tr(value, language);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const totals = useMemo(() => {
    const planned = cycles.reduce((s, c) => s + Number(c.planned_quantity_kg || 0), 0);
    const produced = cycles.reduce((s, c) => s + Number(c.produced_quantity_kg || 0), 0);
    const loss = cycles.reduce((s, c) => s + Number(c.loss_kg || 0), 0);
    const cost = cycles.reduce((s, c) => s + Number(c.total_cost || 0), 0);
    return {
      planned, produced, loss, cost,
      yieldPct: planned > 0 ? (produced / planned) * 100 : 0,
      costPerKg: produced > 0 ? cost / produced : 0,
    };
  }, [cycles]);

  const submit = async () => {
    if (!form.name?.trim()) return;
    const produced = Number(form.produced_quantity_kg || 0);
    const cost = Number(form.total_cost || 0);
    await onSave({
      ...form,
      name: form.name.trim(),
      end_date: form.end_date || null,
      planned_quantity_kg: Number(form.planned_quantity_kg || 0),
      produced_quantity_kg: produced,
      loss_kg: Number(form.loss_kg || 0),
      total_cost: cost,
      cost_per_kg: produced > 0 ? cost / produced : 0,
    });
    setOpen(false);
    setForm(empty);
  };

  const exportOptions = {
    title: text('Cycles de fabrication d’aliments'),
    filename: `cycles-fabrication-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'name', label: text('Cycle') },
      { key: 'formulation_name', label: text('Formulation') },
      { key: 'batch_number', label: text('Lot') },
      { key: 'start_date', label: text('Début') },
      { key: 'end_date', label: text('Fin') },
      { key: 'planned_quantity_kg', label: text('Prévu (kg)') },
      { key: 'produced_quantity_kg', label: text('Produit (kg)') },
      { key: 'loss_kg', label: text('Pertes (kg)') },
      { key: 'total_cost', label: text('Coût total') },
      { key: 'cost_per_kg', label: text('Coût / kg') },
      { key: 'status', label: text('Statut'), format: (value: string) => text(STATUSES.find(item => item.key === value)?.label ?? value) },
    ],
    data: cycles as any[],
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini label={text('Quantité prévue')} value={`${totals.planned.toFixed(0)} kg`} />
        <Mini label={text('Quantité produite')} value={`${totals.produced.toFixed(0)} kg`} />
        <Mini label={text('Rendement')} value={`${totals.yieldPct.toFixed(1)} %`} />
        <Mini label={text('Coût moyen / kg')} value={formatCurrency(totals.costPerKg)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Factory className="w-4 h-4 text-primary" />{text('Production d’aliments')}
              </CardTitle>
              <CardDescription className="text-xs">
                {cycles.length} {text('cycles')} — {text('pertes cumulées')} {totals.loss.toFixed(1)} kg.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportDropdown options={exportOptions as any} />
              <Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}>
                <Plus className="w-4 h-4 mr-1.5" />{text('Nouveau cycle')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2">{text('Cycle')}</th><th className="py-2">{text('Formulation')}</th><th className="py-2">{text('Période')}</th>
                <th className="py-2 text-right">{text('Prévu')}</th><th className="py-2 text-right">{text('Produit')}</th>
                <th className="py-2 text-right">{text('Pertes')}</th><th className="py-2 text-right">{text('Coût/kg')}</th>
                <th className="py-2">{text('Statut')}</th><th />
              </tr>
            </thead>
            <tbody>
              {cycles.map(c => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-1.5 font-medium">{c.name}</td>
                  <td className="py-1.5 text-xs">{c.formulation_name || '—'}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">{c.start_date}{c.end_date ? ` → ${c.end_date}` : ''}</td>
                  <td className="py-1.5 text-right">{Number(c.planned_quantity_kg).toFixed(0)} kg</td>
                  <td className="py-1.5 text-right">{Number(c.produced_quantity_kg).toFixed(0)} kg</td>
                  <td className="py-1.5 text-right">{Number(c.loss_kg).toFixed(1)} kg</td>
                  <td className="py-1.5 text-right">{formatCurrency(Number(c.cost_per_kg || 0))}</td>
                  <td className="py-1.5">
                    <Badge variant={c.status === 'termine' ? 'outline' : c.status === 'annule' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {text(STATUSES.find(s => s.key === c.status)?.label ?? c.status)}
                    </Badge>
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setForm({ ...c, end_date: c.end_date ?? '' }); setOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {cycles.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">{text('Aucun cycle de fabrication.')}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{text(form.id ? 'Modifier le cycle' : 'Nouveau cycle de fabrication')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">{text('Nom du cycle')}</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={text('Fabrication tilapia grossissement — semaine 12')} />
            </div>
            <div>
              <Label className="text-xs">{text('Formulation')}</Label>
              <Select value={form.formulation_name || 'none'} onValueChange={v => setForm({ ...form, formulation_name: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder={text('Sélectionner')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{text('Aucune')}</SelectItem>
                  {formulationNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{text('N° de lot')}</Label>
              <Input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Date de début')}</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Date de fin')}</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Quantité prévue (kg)')}</Label>
              <Input type="number" value={form.planned_quantity_kg} onChange={e => setForm({ ...form, planned_quantity_kg: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{text('Quantité produite (kg)')}</Label>
              <Input type="number" value={form.produced_quantity_kg} onChange={e => setForm({ ...form, produced_quantity_kg: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{text('Pertes (kg)')}</Label>
              <Input type="number" value={form.loss_kg} onChange={e => setForm({ ...form, loss_kg: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{text('Coût total')}</Label>
              <Input type="number" value={form.total_cost} onChange={e => setForm({ ...form, total_cost: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">{text('Statut')}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.key} value={s.key}>{text(s.label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{text('Notes')}</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{text('Annuler')}</Button>
            <Button onClick={submit}>{text('Enregistrer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Mini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Card><CardContent className="p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold mt-1">{value}</p>
  </CardContent></Card>
);

export default FeedProductionCycles;
