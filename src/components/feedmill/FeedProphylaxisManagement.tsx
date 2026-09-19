import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ShieldCheck, Pencil, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import { useFeedOperations, type QualityControl } from '@/components/aquafeed/feedmill/useFeedOperations';
import { useSettings } from '@/contexts/SettingsContext';
import { tr } from '@/i18n/runtime';

/**
 * Prophylaxie spécifique aux unités « Fabrication d'aliments ».
 * Centrée sur la sécurité sanitaire des aliments : matières premières,
 * moisissures, mycotoxines, conditions de stockage, contrôles par lot.
 */

const CONTROL_TYPES = [
  { key: 'matiere_premiere', label: 'Matière première / ingrédient' },
  { key: 'moisissures', label: 'Moisissures / développement fongique' },
  { key: 'mycotoxines', label: 'Mycotoxines' },
  { key: 'stockage', label: 'Conditions de stockage' },
  { key: 'humidite', label: 'Humidité' },
  { key: 'temperature', label: 'Température' },
  { key: 'lot_fabrique', label: 'Lot d\'aliment fabriqué' },
  { key: 'echantillon', label: 'Échantillon prélevé' },
  { key: 'inspection', label: 'Inspection / contrôle sanitaire' },
  { key: 'autre', label: 'Autre risque sanitaire' },
];

const CONFORMITY = [
  { key: 'conforme', label: 'Conforme' },
  { key: 'non_conforme', label: 'Non conforme' },
  { key: 'en_attente', label: 'En attente de résultat' },
];

const empty = {
  control_date: new Date().toISOString().slice(0, 10),
  control_type: 'lot_fabrique',
  item_name: '',
  batch_number: '',
  supplier: '',
  responsible: '',
  status: 'en_attente',
  anomaly: '',
  corrective_action: '',
  notes: '',
  parameters: { sample_date: '', humidity_pct: '', temperature_c: '' },
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'conforme':
      return <Badge className="bg-emerald-100 text-emerald-800">Conforme</Badge>;
    case 'non_conforme':
      return <Badge variant="destructive">Non conforme</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-800">En attente</Badge>;
  }
};

const typeLabel = (key: string) => CONTROL_TYPES.find(t => t.key === key)?.label || key;

const FeedProphylaxisManagement: React.FC = () => {
  const { controls, cycles, loading, saveControl, deleteControl } = useFeedOperations();
  const { language } = useSettings();
  const text = (value: string) => tr(value, language);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [filter, setFilter] = useState('all');

  const batchNumbers = useMemo(
    () => Array.from(new Set(cycles.map(c => c.batch_number).filter(Boolean))) as string[],
    [cycles]
  );

  const stats = useMemo(() => {
    const total = controls.length;
    const nonConforme = controls.filter(c => c.status === 'non_conforme').length;
    const enAttente = controls.filter(c => c.status === 'en_attente').length;
    const avecAnomalie = controls.filter(c => c.anomaly).length;
    return { total, nonConforme, enAttente, avecAnomalie };
  }, [controls]);

  const filtered = useMemo(
    () => (filter === 'all' ? controls : controls.filter(c => c.control_type === filter)),
    [controls, filter]
  );

  const submit = async () => {
    if (!form.item_name?.trim()) return;
    await saveControl({
      ...form,
      item_name: form.item_name.trim(),
      batch_number: form.batch_number || null,
      supplier: form.supplier || null,
      responsible: form.responsible || null,
      anomaly: form.anomaly || null,
      corrective_action: form.corrective_action || null,
      notes: form.notes || null,
      parameters: {
        sample_date: form.parameters?.sample_date || null,
        humidity_pct: form.parameters?.humidity_pct !== '' ? Number(form.parameters?.humidity_pct) : null,
        temperature_c: form.parameters?.temperature_c !== '' ? Number(form.parameters?.temperature_c) : null,
      },
    });
    setOpen(false);
    setForm(empty);
  };

  const exportOptions = {
    title: "Prophylaxie — Fabrication d'aliments",
    filename: 'prophylaxie-aliments',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Type' },
      { key: 'item', label: 'Élément' },
      { key: 'batch', label: 'Lot' },
      { key: 'supplier', label: 'Fournisseur' },
      { key: 'responsible', label: 'Responsable' },
      { key: 'status', label: 'Statut' },
      { key: 'anomaly', label: 'Anomalie' },
      { key: 'corrective', label: 'Action corrective' },
      { key: 'notes', label: 'Observations' },
    ],
    data: filtered.map(c => ({
      date: c.control_date,
      type: typeLabel(c.control_type),
      item: c.item_name,
      batch: c.batch_number || '',
      supplier: c.supplier || '',
      responsible: c.responsible || '',
      status: c.status,
      anomaly: c.anomaly || '',
      corrective: c.corrective_action || '',
      notes: c.notes || '',
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {text('Prophylaxie — Sécurité sanitaire des aliments')}
          </h2>
          <p className="text-muted-foreground">
            {text('Contrôles sanitaires des matières premières, des lots fabriqués et des conditions de stockage.')}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDropdown data={exportData} filename="prophylaxie-aliments" title="Prophylaxie — Fabrication d'aliments" />
          <Button onClick={() => { setForm(empty); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> {text('Nouveau contrôle')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">{text('Contrôles réalisés')}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{stats.nonConforme}</div><p className="text-xs text-muted-foreground">{text('Non conformités')}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-amber-600">{stats.enAttente}</div><p className="text-xs text-muted-foreground">{text('En attente de résultat')}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-orange-600">{stats.avecAnomalie}</div><p className="text-xs text-muted-foreground">{text('Anomalies signalées')}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{text('Historique sanitaire des lots et contrôles')}</CardTitle>
              <CardDescription>{text('Chaque contrôle est rattaché au lot ou à l\'échantillon concerné.')}</CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{text('Tous les types')}</SelectItem>
                {CONTROL_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{text(t.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">{text('Chargement…')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">{text('Aucun contrôle enregistré pour le moment.')}</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(c => (
                <div key={c.id} className="border rounded-lg p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.item_name}</span>
                      {statusBadge(c.status)}
                      <Badge variant="outline">{text(typeLabel(c.control_type))}</Badge>
                      {c.batch_number && <Badge variant="secondary">Lot {c.batch_number}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.control_date}
                      {c.parameters?.sample_date ? ` · ${text('Prélèvement')} : ${c.parameters.sample_date}` : ''}
                      {c.parameters?.humidity_pct != null ? ` · ${text('Humidité')} : ${c.parameters.humidity_pct}%` : ''}
                      {c.parameters?.temperature_c != null ? ` · ${text('Temp.')} : ${c.parameters.temperature_c}°C` : ''}
                      {c.responsible ? ` · ${c.responsible}` : ''}
                    </p>
                    {c.anomaly && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> {c.anomaly}
                      </p>
                    )}
                    {c.corrective_action && (
                      <p className="text-sm text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {c.corrective_action}
                      </p>
                    )}
                    {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ ...empty, ...c, parameters: { ...empty.parameters, ...(c.parameters || {}) } }); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteControl(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? text('Modifier le contrôle') : text('Nouveau contrôle sanitaire')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{text('Date du contrôle')}</Label>
              <Input type="date" value={form.control_date} onChange={e => setForm({ ...form, control_date: e.target.value })} />
            </div>
            <div>
              <Label>{text('Type de contrôle')}</Label>
              <Select value={form.control_type} onValueChange={v => setForm({ ...form, control_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTROL_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{text(t.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{text('Élément contrôlé (ingrédient, lot, zone…)')} *</Label>
              <Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder="Ex : Farine de poisson, Lot AL-2026-09…" />
            </div>
            <div>
              <Label>{text('Lot concerné')}</Label>
              <Select value={form.batch_number || 'none'} onValueChange={v => setForm({ ...form, batch_number: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{text('Aucun / saisie libre')}</SelectItem>
                  {batchNumbers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              {!batchNumbers.length && (
                <Input className="mt-2" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} placeholder={text('N° de lot')} />
              )}
            </div>
            <div>
              <Label>{text('Date de prélèvement de l\'échantillon')}</Label>
              <Input type="date" value={form.parameters?.sample_date || ''} onChange={e => setForm({ ...form, parameters: { ...form.parameters, sample_date: e.target.value } })} />
            </div>
            <div>
              <Label>{text('Fournisseur (si matière première)')}</Label>
              <Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <Label>{text('Humidité mesurée (%)')}</Label>
              <Input type="number" value={form.parameters?.humidity_pct ?? ''} onChange={e => setForm({ ...form, parameters: { ...form.parameters, humidity_pct: e.target.value } })} />
            </div>
            <div>
              <Label>{text('Température mesurée (°C)')}</Label>
              <Input type="number" value={form.parameters?.temperature_c ?? ''} onChange={e => setForm({ ...form, parameters: { ...form.parameters, temperature_c: e.target.value } })} />
            </div>
            <div>
              <Label>{text('Responsable du contrôle')}</Label>
              <Input value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
            </div>
            <div>
              <Label>{text('Conformité')}</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONFORMITY.map(s => <SelectItem key={s.key} value={s.key}>{text(s.label)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>{text('Anomalie constatée')}</Label>
              <Textarea value={form.anomaly} onChange={e => setForm({ ...form, anomaly: e.target.value })} placeholder={text('Ex : présence de moisissures, taux d\'humidité trop élevé…')} />
            </div>
            <div className="md:col-span-2">
              <Label>{text('Mesure corrective / préventive')}</Label>
              <Textarea value={form.corrective_action} onChange={e => setForm({ ...form, corrective_action: e.target.value })} placeholder={text('Ex : lot isolé et détruit, séchage supplémentaire, changement de fournisseur…')} />
            </div>
            <div className="md:col-span-2">
              <Label>{text('Observations')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{text('Annuler')}</Button>
            <Button onClick={submit} disabled={!form.item_name?.trim()}>{text('Enregistrer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedProphylaxisManagement;
