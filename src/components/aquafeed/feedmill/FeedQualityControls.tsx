import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ShieldCheck } from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import type { QualityControl } from './useFeedOperations';
import { useSettings } from '@/contexts/SettingsContext';
import { tr } from '@/i18n/runtime';

const CONTROL_TYPES = [
  { key: 'hygiene', label: 'Hygiène atelier' },
  { key: 'matiere_premiere', label: 'Matière première' },
  { key: 'produit_fini', label: 'Produit fini' },
  { key: 'equipement', label: 'Équipement' },
  { key: 'stockage', label: 'Stockage' },
];

const STATUSES = [
  { key: 'conforme', label: 'Conforme' },
  { key: 'a_surveiller', label: 'À surveiller' },
  { key: 'non_conforme', label: 'Non conforme' },
];

const empty = {
  control_date: new Date().toISOString().slice(0, 10),
  control_type: 'hygiene',
  item_name: '',
  batch_number: '',
  supplier: '',
  responsible: '',
  status: 'conforme',
  anomaly: '',
  corrective_action: '',
  notes: '',
};

interface Props {
  controls: QualityControl[];
  onSave: (payload: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

const FeedQualityControls: React.FC<Props> = ({ controls, onSave, onDelete }) => {
  const { language } = useSettings();
  const text = (value: string) => tr(value, language);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(
    () => controls.filter(c => filter === 'all' || c.status === filter),
    [controls, filter],
  );

  const stats = useMemo(() => ({
    total: controls.length,
    nc: controls.filter(c => c.status === 'non_conforme').length,
    watch: controls.filter(c => c.status === 'a_surveiller').length,
  }), [controls]);

  const submit = async () => {
    if (!form.item_name?.trim()) return;
    await onSave({ ...form, item_name: form.item_name.trim() });
    setOpen(false);
    setForm(empty);
  };

  const exportOptions = {
    title: text('Prophylaxie alimentaire — contrôles qualité'),
    filename: `controles-qualite-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'control_date', label: text('Date') },
      { key: 'control_type', label: text('Type'), format: (value: string) => text(CONTROL_TYPES.find(item => item.key === value)?.label ?? value) },
      { key: 'item_name', label: text('Élément contrôlé') },
      { key: 'batch_number', label: text('Lot') },
      { key: 'supplier', label: text('Fournisseur') },
      { key: 'status', label: text('Statut'), format: (value: string) => text(STATUSES.find(item => item.key === value)?.label ?? value) },
      { key: 'anomaly', label: text('Anomalie') },
      { key: 'corrective_action', label: text('Action corrective') },
    ],
    data: filtered as any[],
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />{text('Prophylaxie alimentaire')}
            </CardTitle>
            <CardDescription className="text-xs">
              {stats.total} {text('contrôles')} — {stats.nc} {text('non conformes')}, {stats.watch} {text('à surveiller')}.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportDropdown options={exportOptions as any} />
            <Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" />{text('Nouveau contrôle')}
            </Button>
          </div>
        </div>
        <div className="pt-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text('Tous les statuts')}</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.key} value={s.key}>{text(s.label)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2">{text('Date')}</th><th className="py-2">{text('Type')}</th><th className="py-2">{text('Élément')}</th>
              <th className="py-2">{text('Lot')}</th><th className="py-2">{text('Statut')}</th><th className="py-2">{text('Anomalie')}</th><th />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-1.5">{c.control_date}</td>
                <td className="py-1.5">{text(CONTROL_TYPES.find(t => t.key === c.control_type)?.label ?? c.control_type)}</td>
                <td className="py-1.5 font-medium">{c.item_name}</td>
                <td className="py-1.5 text-xs text-muted-foreground">{c.batch_number || '—'}</td>
                <td className="py-1.5">
                  <Badge variant={c.status === 'non_conforme' ? 'destructive' : c.status === 'a_surveiller' ? 'secondary' : 'outline'} className="text-[10px]">
                    {text(STATUSES.find(s => s.key === c.status)?.label ?? c.status)}
                  </Badge>
                </td>
                <td className="py-1.5 text-xs">{c.anomaly || '—'}</td>
                <td className="py-1.5 text-right">
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">{text('Aucun contrôle enregistré.')}</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{text('Nouveau contrôle qualité')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{text('Date')}</Label>
              <Input type="date" value={form.control_date} onChange={e => setForm({ ...form, control_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Type de contrôle')}</Label>
              <Select value={form.control_type} onValueChange={v => setForm({ ...form, control_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTROL_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{text(t.label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{text('Élément contrôlé')}</Label>
              <Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder={text('Maïs, broyeur, aliment 35 %…')} />
            </div>
            <div>
              <Label className="text-xs">{text('N° de lot')}</Label>
              <Input value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Fournisseur')}</Label>
              <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Responsable')}</Label>
              <Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">{text('Statut')}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s.key} value={s.key}>{text(s.label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{text('Anomalie constatée')}</Label>
              <Textarea rows={2} value={form.anomaly} onChange={e => setForm({ ...form, anomaly: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{text('Action corrective')}</Label>
              <Textarea rows={2} value={form.corrective_action} onChange={e => setForm({ ...form, corrective_action: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{text('Annuler')}</Button>
            <Button onClick={submit}>{text('Enregistrer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FeedQualityControls;
