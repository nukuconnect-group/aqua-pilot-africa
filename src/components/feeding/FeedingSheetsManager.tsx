import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Printer, FileDown, Share2, CheckCircle2, Trash2, Pencil, ClipboardList, Sun, Sunrise, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { generateCompanyHeaderHTML, generateCompanyFooterHTML, type CompanyInfoForPrint } from '@/lib/companyHeaderUtils';

interface FeedingSheet {
  id: string;
  user_id: string;
  unit_id: string;
  infrastructure_id?: string | null;
  title: string;
  period: 'matin' | 'midi' | 'soir';
  time: string;
  feed_type: string;
  quantity: number;
  unit: string;
  responsible_name?: string | null;
  observations?: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  days: string[];
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  created_at?: string;
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const PERIOD_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  matin: { label: 'Matin', icon: Sunrise, color: 'bg-amber-100 text-amber-800' },
  midi: { label: 'Midi', icon: Sun, color: 'bg-orange-100 text-orange-800' },
  soir: { label: 'Soir', icon: Moon, color: 'bg-indigo-100 text-indigo-800' },
};

interface Props {
  unitId: string;
  unitName: string;
}

const emptyForm = (unitId: string): Partial<FeedingSheet> => ({
  unit_id: unitId,
  title: '',
  period: 'matin',
  time: '07:00',
  feed_type: '',
  quantity: 0,
  unit: 'kg',
  responsible_name: '',
  observations: '',
  frequency: 'daily',
  days: [...DAYS],
  start_date: new Date().toISOString().split('T')[0],
  is_active: true,
});

export default function FeedingSheetsManager({ unitId, unitName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { infrastructures } = useProductionUnits();
  const { companyInfo } = useSettings();

  const [sheets, setSheets] = useState<FeedingSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<FeedingSheet | null>(null);
  const [form, setForm] = useState<Partial<FeedingSheet>>(emptyForm(unitId));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterInfra, setFilterInfra] = useState<string>('all');

  const unitInfras = useMemo(
    () => infrastructures.filter((i: any) => i.unitId === unitId),
    [infrastructures, unitId],
  );

  const fetchSheets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('feeding_sheets')
        .select('*')
        .eq('unit_id', unitId)
        .order('time', { ascending: true });
      if (error) throw error;
      setSheets(data || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erreur', description: 'Impossible de charger les fiches', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSheets(); }, [user?.id, unitId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(unitId));
    setOpenForm(true);
  };

  const openEdit = (s: FeedingSheet) => {
    setEditing(s);
    setForm({ ...s });
    setOpenForm(true);
  };

  const submit = async () => {
    if (!user) return;
    if (!form.title || !form.feed_type || !form.time) {
      toast({ title: 'Champs requis', description: 'Titre, aliment et heure requis', variant: 'destructive' });
      return;
    }
    try {
      const payload: any = {
        user_id: user.id,
        unit_id: unitId,
        infrastructure_id: form.infrastructure_id || null,
        title: form.title,
        period: form.period || 'matin',
        time: form.time,
        feed_type: form.feed_type,
        quantity: Number(form.quantity) || 0,
        unit: form.unit || 'kg',
        responsible_name: form.responsible_name || null,
        observations: form.observations || null,
        frequency: form.frequency || 'daily',
        days: form.days && form.days.length ? form.days : DAYS,
        start_date: form.start_date || new Date().toISOString().split('T')[0],
        end_date: form.end_date || null,
        is_active: form.is_active !== false,
      };
      if (editing) {
        const { error } = await (supabase as any).from('feeding_sheets').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Fiche mise à jour' });
      } else {
        const { error } = await (supabase as any).from('feeding_sheets').insert([payload]);
        if (error) throw error;
        toast({ title: 'Fiche créée' });
      }
      setOpenForm(false);
      fetchSheets();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erreur', description: e.message || 'Enregistrement impossible', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('feeding_sheets').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Fiche supprimée' });
      setDeleteId(null);
      fetchSheets();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const [feeding, setFeeding] = useState<FeedingSheet | null>(null);
  const [feedForm, setFeedForm] = useState({ applied: '', remaining: '', mortality: '', behavior: 'normal', reason: '', notes: '', stockId: '' });
  const { stocks } = useFeedStocks(unitId);
  const stockNames = useMemo(() => Array.from(new Set((stocks || []).map((x: any) => x.custom_name || x.feed_type).filter(Boolean))), [stocks]);

  const validateDistribution = (s: FeedingSheet) => {
    const match = (stocks || []).find((x: any) => [x.feed_type, x.custom_name].some((v: string) => (v || '').trim().toLowerCase() === (s.feed_type || '').trim().toLowerCase()));
    setFeedForm({ applied: String(s.quantity || ''), remaining: '', mortality: '', behavior: 'normal', reason: '', notes: '', stockId: match?.id || '' });
    setFeeding(s);
  };

  const confirmFeeding = async () => {
    const s = feeding;
    if (!user || !s) return;
    const applied = Number(feedForm.applied) || 0;
    const remaining = Number(feedForm.remaining) || 0;
    if (applied <= 0) { toast({ title: 'Dose appliquée requise', variant: 'destructive' }); return; }
    if ((remaining > 0 || feedForm.behavior !== 'normal') && !feedForm.reason.trim()) {
      toast({ title: 'Précisez la raison', description: 'Indiquez pourquoi l’aliment n’a pas été entièrement consommé.', variant: 'destructive' });
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const notes = [
        `Fiche : ${s.title}`,
        feedForm.reason && `Raison non-consommation : ${feedForm.reason}`,
        feedForm.notes,
      ].filter(Boolean).join(' · ');
      const { error } = await (supabase as any).from('feeding_records').insert([{
        user_id: user.id, unit_id: unitId, infrastructure_id: s.infrastructure_id || null,
        date: today, time: s.time, feed_type: s.feed_type, quantity: applied,
        session_type: s.period, feeder_name: s.responsible_name || null,
        prescribed_quantity: s.quantity, actual_quantity: applied, remaining_quantity: remaining,
        mortality: Number(feedForm.mortality) || 0, behavior: feedForm.behavior, notes,
      }]);
      if (error) throw error;
      const { deductFeedStock } = await import('@/lib/feedStockDeduction');
      const r = await deductFeedStock(unitId, s.feed_type, applied, `Nourrissage — fiche ${s.title}`, feedForm.stockId || undefined);
      const extra = r.status === 'ok'
        ? ` · Stock restant : ${r.after.toFixed(1)}${r.amount ? ` · Écriture comptable de ${r.amount.toLocaleString('fr-FR')} créée` : ''}`
        : r.status === 'insufficient' ? ' · Stock insuffisant, non déduit'
        : r.status === 'not_found' ? ' · Aucun article de stock portant ce nom' : '';
      toast({ title: 'Nourrissage enregistré', description: `Dose prévue ${s.quantity} ${s.unit}, appliquée ${applied} ${s.unit}${extra}` });
      setFeeding(null);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const filteredSheets = filterInfra === 'all' ? sheets : sheets.filter(s => s.infrastructure_id === filterInfra);

  const buildProgramHTML = (period: 'today' | 'week' | 'month') => {
    const ci: CompanyInfoForPrint = {
      name: companyInfo.name,
      address: companyInfo.address,
      phone: companyInfo.phone,
      email: companyInfo.email,
      logoUrl: companyInfo.logoUrl,
      registrationNumber: companyInfo.registrationNumber,
      taxId: companyInfo.taxId,
      stampUrl: companyInfo.stampUrl,
      signatureUrl: companyInfo.signatureUrl,
      cifNif: companyInfo.cifNif,
      rccm: companyInfo.rccm,
      website: companyInfo.website,
      legalRepresentative: companyInfo.legalRepresentative,
      hideStampOnDocuments: companyInfo.hideStampOnDocuments,
    };
    const now = new Date();
    const todayName = DAYS[(now.getDay() + 6) % 7];
    const activeSheets = filteredSheets.filter(s => s.is_active);
    let periodLabel = "Programme d'alimentation";
    let rows: FeedingSheet[] = [];
    if (period === 'today') {
      periodLabel = `Programme du ${now.toLocaleDateString('fr-FR')}`;
      rows = activeSheets.filter(s => s.days.includes(todayName));
    } else if (period === 'week') {
      periodLabel = `Programme hebdomadaire — semaine du ${now.toLocaleDateString('fr-FR')}`;
      rows = activeSheets;
    } else {
      periodLabel = `Programme mensuel — ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      rows = activeSheets;
    }

    const infraName = (id?: string | null) => id ? (unitInfras.find(i => i.id === id)?.name || '—') : 'Toutes';

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${periodLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
        h1 { color: #0f766e; margin: 0 0 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e0f2fe; color: #075985; font-size: 11px; }
        .footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
      </style></head><body>
      ${generateCompanyHeaderHTML(ci)}
      <h1>${periodLabel}</h1>
      <p style="margin:0;font-size:12px;color:#475569;">Unité: <strong>${unitName}</strong> — Généré le ${now.toLocaleString('fr-FR')}</p>
      <table>
        <thead>
          <tr>
            <th>Fiche</th><th>Infrastructure</th><th>Période</th><th>Heure</th>
            <th>Type d'aliment</th><th>Quantité</th><th>Responsable</th><th>Jours</th><th>Observations</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px;">Aucune fiche active pour cette période</td></tr>` : rows.map(s => `
            <tr>
              <td><strong>${s.title}</strong></td>
              <td>${infraName(s.infrastructure_id)}</td>
              <td><span class="badge">${PERIOD_META[s.period]?.label || s.period}</span></td>
              <td>${s.time}</td>
              <td>${s.feed_type}</td>
              <td>${s.quantity} ${s.unit}</td>
              <td>${s.responsible_name || '—'}</td>
              <td>${(s.days || []).join(', ')}</td>
              <td>${s.observations || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${generateCompanyFooterHTML(ci)}
      <div class="footer">AquaPilote — Fiches d'alimentation professionnelles</div>
    </body></html>`;
    return html;
  };

  const printProgram = (period: 'today' | 'week' | 'month') => {
    const html = buildProgramHTML(period);
    const w = window.open('', '_blank', 'width=1024,height=768');
    if (!w) {
      toast({ title: 'Bloqué', description: 'Autorisez les popups pour imprimer', variant: 'destructive' });
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const shareProgram = async (period: 'today' | 'week' | 'month') => {
    const html = buildProgramHTML(period);
    const blob = new Blob([html], { type: 'text/html' });
    const file = new File([blob], `programme-alimentation-${period}.html`, { type: 'text/html' });
    const nav: any = navigator;
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'Programme d\'alimentation', text: `Programme ${period} - ${unitName}` });
        return;
      } catch { /* fallthrough */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programme-alimentation-${period}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Fichier téléchargé', description: 'Partagez-le via WhatsApp / Email' });
  };

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-start gap-2 break-words">
                <ClipboardList className="w-5 h-5 text-primary" />
                Fiches d'alimentation — {unitName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Planifiez, imprimez et suivez la distribution d'aliment par infrastructure.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:flex-wrap">
              <Select value={filterInfra} onValueChange={setFilterInfra}>
                <SelectTrigger className="w-full sm:w-52 text-xs"><SelectValue placeholder="Toutes infrastructures" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes infrastructures</SelectItem>
                  {unitInfras.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-auto min-h-9 whitespace-normal text-left" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" /> Créer une fiche d’alimentation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => printProgram('today')}>
              <Printer className="w-4 h-4 mr-1" /> Programme du jour
            </Button>
            <Button size="sm" variant="outline" onClick={() => printProgram('week')}>
              <Printer className="w-4 h-4 mr-1" /> Hebdomadaire
            </Button>
            <Button size="sm" variant="outline" onClick={() => printProgram('month')}>
              <Printer className="w-4 h-4 mr-1" /> Mensuel
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareProgram('today')}>
              <Share2 className="w-4 h-4 mr-1" /> Partager
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareProgram('week')}>
              <FileDown className="w-4 h-4 mr-1" /> Export
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Chargement…</p>
          ) : filteredSheets.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-md">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucune fiche d'alimentation</p>
              <Button size="sm" className="mt-3" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Créer une fiche</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSheets.map(s => {
                const meta = PERIOD_META[s.period] || PERIOD_META.matin;
                const Icon = meta.icon;
                return (
                  <Card key={s.id} className={`border-l-4 ${s.is_active ? 'border-l-emerald-500' : 'border-l-slate-300 opacity-70'}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm break-words">{s.title}</h3>
                            <Badge className={`${meta.color} text-[10px]`}><Icon className="w-3 h-3 mr-1" />{meta.label}</Badge>
                            {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {s.infrastructure_id ? (unitInfras.find(i => i.id === s.infrastructure_id)?.name || '—') : 'Toutes infrastructures'}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 break-words text-xs">
                        <div><span className="text-muted-foreground">Heure:</span> <strong>{s.time}</strong></div>
                        <div><span className="text-muted-foreground">Quantité:</span> <strong>{s.quantity} {s.unit}</strong></div>
                        <div className="col-span-2"><span className="text-muted-foreground">Aliment:</span> <strong>{s.feed_type}</strong></div>
                        {s.responsible_name && <div className="col-span-2"><span className="text-muted-foreground">Resp.:</span> {s.responsible_name}</div>}
                        <div className="col-span-2"><span className="text-muted-foreground">Jours:</span> {(s.days || []).join(', ')}</div>
                        {s.observations && <div className="col-span-2 text-muted-foreground italic">{s.observations}</div>}
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => validateDistribution(s)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Nourrir aujourd’hui
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier la fiche' : 'Nouvelle fiche d\'alimentation'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Titre *</Label>
              <Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Alimentation matin — Bac 1" />
            </div>
            <div>
              <Label>Infrastructure</Label>
              <Select value={form.infrastructure_id || 'none'} onValueChange={v => setForm({ ...form, infrastructure_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Toutes</SelectItem>
                  {unitInfras.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Période</Label>
              <Select value={form.period as string} onValueChange={v => setForm({ ...form, period: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="matin">Matin</SelectItem>
                  <SelectItem value="midi">Midi</SelectItem>
                  <SelectItem value="soir">Soir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Heure *</Label>
              <Input type="time" value={form.time || ''} onChange={e => setForm({ ...form, time: e.target.value })} />
            </div>
            <div>
              <Label>Type d'aliment *</Label>
              <Input list="sheet-stock-names" value={form.feed_type || ''} onChange={e => setForm({ ...form, feed_type: e.target.value })} placeholder="Choisir un article du stock" />
              <datalist id="sheet-stock-names">{stockNames.map((n) => <option key={n as string} value={n as string} />)}</datalist>
              <p className="text-[11px] text-muted-foreground mt-1">Utilisez le nom de l’article du module Stock pour qu’il soit déduit automatiquement.</p>
            </div>
            <div>
              <Label>Dose prévue</Label>
              <Input type="number" step="0.01" value={form.quantity || 0} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Unité</Label>
              <Select value={form.unit as string} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="sacs">sacs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Responsable</Label>
              <Input value={form.responsible_name || ''} onChange={e => setForm({ ...form, responsible_name: e.target.value })} placeholder="Nom du responsable/technicien" />
            </div>
            <div>
              <Label>Fréquence</Label>
              <Select value={form.frequency as string} onValueChange={v => setForm({ ...form, frequency: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Journalière</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date de début</Label>
              <Input type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Jours de la semaine</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS.map(d => {
                  const active = (form.days || []).includes(d);
                  return (
                    <Button key={d} type="button" size="sm" variant={active ? 'default' : 'outline'} onClick={() => {
                      const cur = new Set(form.days || []);
                      if (active) cur.delete(d); else cur.add(d);
                      setForm({ ...form, days: Array.from(cur) });
                    }}>{d.slice(0, 3)}</Button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Observations</Label>
              <Textarea rows={3} value={form.observations || ''} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder="Consignes, préparation, etc." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpenForm(false)}>Annuler</Button>
            <Button onClick={submit}>{editing ? 'Enregistrer' : 'Créer la fiche'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!feeding} onOpenChange={(o) => !o && setFeeding(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nourrir aujourd’hui — {feeding?.title}</DialogTitle></DialogHeader>
          {feeding && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Aliment :</span> <strong>{feeding.feed_type}</strong></div>
                <div><span className="text-muted-foreground">Heure :</span> <strong>{feeding.time}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Dose prévue :</span> <strong>{feeding.quantity} {feeding.unit}</strong></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dose appliquée ({feeding.unit}) *</Label><Input type="number" step="0.01" value={feedForm.applied} onChange={(e) => setFeedForm({ ...feedForm, applied: e.target.value })} /></div>
                <div><Label>Reste non consommé ({feeding.unit})</Label><Input type="number" step="0.01" value={feedForm.remaining} onChange={(e) => setFeedForm({ ...feedForm, remaining: e.target.value })} /></div>
                <div><Label>Mortalité constatée</Label><Input type="number" min="0" value={feedForm.mortality} onChange={(e) => setFeedForm({ ...feedForm, mortality: e.target.value })} /></div>
                <div><Label>Appétit</Label>
                  <Select value={feedForm.behavior} onValueChange={(v) => setFeedForm({ ...feedForm, behavior: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Bon appétit</SelectItem>
                      <SelectItem value="faible">Appétit faible</SelectItem>
                      <SelectItem value="refus">Refus de manger</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(Number(feedForm.remaining) > 0 || feedForm.behavior !== 'normal') && (
                <div><Label>Pourquoi l’aliment n’a pas été consommé ? *</Label>
                  <Input list="feed-refusal-reasons" value={feedForm.reason} onChange={(e) => setFeedForm({ ...feedForm, reason: e.target.value })} placeholder="Ex : eau trouble, température basse…" />
                  <datalist id="feed-refusal-reasons">
                    {['Eau trouble ou de mauvaise qualité', 'Température trop basse', 'Manque d’oxygène', 'Poissons malades', 'Stress (manipulation, pêche)', 'Aliment inadapté ou avarié', 'Suralimentation'].map((r) => <option key={r} value={r} />)}
                  </datalist>
                </div>
              )}
              <div><Label>Observations</Label><Input value={feedForm.notes} onChange={(e) => setFeedForm({ ...feedForm, notes: e.target.value })} /></div>
              <div>
                <Label>Stock à prélever *</Label>
                <Select value={feedForm.stockId} onValueChange={(v) => setFeedForm({ ...feedForm, stockId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir l'article du stock…" /></SelectTrigger>
                  <SelectContent>
                    {(stocks || []).map((x: any) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.custom_name || x.feed_type} — {Number(x.quantity)} {x.unit} dispo.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">La dose appliquée sera retirée du stock choisi, une sortie sera ajoutée à l’historique du stock et l’écriture comptable correspondante sera créée.</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setFeeding(null)}>Annuler</Button>
                <Button className="h-auto min-h-10 whitespace-normal" onClick={confirmFeeding}><CheckCircle2 className="w-4 h-4 mr-1" />Enregistrer le nourrissage</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove(deleteId)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}