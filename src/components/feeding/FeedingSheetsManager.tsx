import { useSessionDraft } from '@/hooks/useSessionDraft';
import { printWhenReady } from '@/lib/printReady';
import { feedingBalance, matchesFeedingStock } from '@/lib/feedingDistribution';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isCommercialStock } from '@/lib/stockPurpose';
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Printer, FileDown, Share2, CheckCircle2, Trash2, Pencil, ClipboardList, Sun, Sunrise, Moon, Fish } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { generateCompanyHeaderHTML, generateCompanyFooterHTML, type CompanyInfoForPrint } from '@/lib/companyHeaderUtils';
import {
  PERIOD_ORDER, normalizeInfrastructureIds,
  computeFishCounts, requireSingleInfrastructure,
  type PeriodTime,
} from '@/lib/feedingSheetUtils';
import {
  readSheetPlan, buildSheetFields, cleanObservations, findInfrastructureConflict, planTotal,
  buildDailyRows, PERIOD_LABELS, localDate, dateAfter, isSheetScheduled, validateSchedule, readDayPlans, WEEK_DAYS, type DayPlans, type PeriodPlan,
} from '@/lib/feedingSheetPlan';
import { recordSheetFeeding } from '@/lib/recordSheetFeeding';
import InfrastructureQRCode from '@/components/infrastructure/InfrastructureQRCode';
import { resolveInfrastructureQr, infrastructureQrHTML, infrastructureQrPng } from '@/lib/infrastructureQr';

interface FeedingSheet {
  id: string;
  user_id: string;
  unit_id: string;
  infrastructure_id?: string | null;
  infrastructure_ids?: string[] | null;
  title: string;
  period: 'matin' | 'midi' | 'soir';
  period_times?: PeriodTime[] | null;
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

const DAYS = WEEK_DAYS;
const PERIOD_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  matin: { label: 'Matin', icon: Sunrise, color: 'bg-secondary text-secondary-foreground' },
  midi: { label: 'Midi', icon: Sun, color: 'bg-accent text-accent-foreground' },
  soir: { label: 'Soir', icon: Moon, color: 'bg-muted text-foreground' },
};

interface Props {
  unitId: string;
  unitName: string;
}

type PeriodState = Record<'matin' | 'midi' | 'soir', { enabled: boolean; time: string; quantity?: string }>;

const defaultPeriods = (): PeriodState => ({
  matin: { enabled: true, time: '07:00', quantity: '' },
  midi: { enabled: true, time: '12:00', quantity: '' },
  soir: { enabled: true, time: '17:00', quantity: '' },
});

const periodsToPlan = (periods: PeriodState): PeriodPlan[] =>
  PERIOD_ORDER.filter(p => periods[p].enabled).map(p => ({
    period: p, time: periods[p].time, quantity: Number(String(periods[p].quantity ?? '').replace(',', '.')) || 0,
  }));

const emptyForm = (unitId: string): Partial<FeedingSheet> => ({
  unit_id: unitId,
  title: '',
  infrastructure_ids: [],
  period: 'matin',
  time: '07:00',
  feed_type: '',
  quantity: 0,
  unit: 'kg',
  responsible_name: '',
  observations: '',
  frequency: 'weekly',
  days: [...DAYS],
  start_date: localDate(),
  end_date: dateAfter(localDate(), 6),
  is_active: true,
});

const escapeHtml = (value: string) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const SIGNATURES_HTML = `
  <div class="signatures">
    <div class="sig">
      <p class="sig-title">Le Consultant</p>
      <div class="sig-space"></div>
      <p class="sig-caption">Nom et signature</p>
    </div>
    <div class="sig">
      <p class="sig-title">Le Directeur de l'exploitation</p>
      <div class="sig-space"></div>
      <p class="sig-caption">Nom et signature</p>
    </div>
  </div>`;

const SIGNATURES_CSS = `
  .signatures { display: flex; justify-content: space-between; gap: 24px; margin-top: 48px; }
  .sig { flex: 1; text-align: center; }
  .sig-title { font-weight: bold; font-size: 13px; margin: 0; }
  .sig-space { height: 64px; border-bottom: 1px solid #94a3b8; margin: 8px 24px 4px; }
  .sig-caption { font-size: 11px; color: #64748b; margin: 0; }
`;

export default function FeedingSheetsManager({ unitId, unitName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { infrastructures } = useProductionUnits();
  const { companyInfo } = useSettings();

  const [sheets, setSheets] = useState<FeedingSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const draftKey = `feeding:${user?.id || 'signed-out'}:${unitId}`;
  const [openForm, setOpenForm] = useSessionDraft(`${draftKey}:open`, false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [editing, setEditing] = useSessionDraft<FeedingSheet | null>(`${draftKey}:editing`, null);
  const [form, setForm] = useSessionDraft<Partial<FeedingSheet>>(`${draftKey}:form`, emptyForm(unitId));
  const [periods, setPeriods] = useSessionDraft<PeriodState>(`${draftKey}:periods`, defaultPeriods());
  // Saisie en sacs : 0 = saisie directe ; sinon poids d'un sac (kg). Les quantités restent enregistrées en kg.
  const [bagKg, setBagKg] = useSessionDraft<number>(`${draftKey}:bagKg`, 0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterInfra, setFilterInfra] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState(localDate);
  const [dayRecords, setDayRecords] = useState<any[]>([]);
  const [recordsReady, setRecordsReady] = useState(false);
  const [dailySheet, setDailySheet] = useState<FeedingSheet | null>(null);
  const [dayPlans, setDayPlans] = useSessionDraft<DayPlans>(`${draftKey}:day-plans`, {});
  const [planDay, setPlanDay] = useState('common');
  const [fishCounts, setFishCounts] = useState<Record<string, number>>({});

  const unitInfras = useMemo(
    () => infrastructures.filter((i: any) => i.unitId === unitId),
    [infrastructures, unitId],
  );

  const infraName = (id?: string | null) =>
    id ? (unitInfras.find((i) => i.id === id)?.name || 'Infrastructure introuvable') : 'Aucune infrastructure';

  const sheetInfraIds = (s: FeedingSheet) => normalizeInfrastructureIds(s);
  const sheetQr = (s: FeedingSheet) => {
    const ids = sheetInfraIds(s);
    return ids.length === 1 ? resolveInfrastructureQr(unitId, ids[0], unitInfras) : undefined;
  };
  const sheetPlan = (s: FeedingSheet, date = selectedDate) => readSheetPlan(s, date);
  const sheetPeriods = (s: FeedingSheet): PeriodTime[] => sheetPlan(s).map(({ period, time }) => ({ period, time }));
  const periodQty = (s: FeedingSheet, period: string) => sheetPlan(s).find(p => p.period === period)?.quantity ?? 0;

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

  /** Effectif de poissons par infrastructure, basé sur les cycles actifs de l'unité. */
  const fetchDayRecords = async () => {
    setRecordsReady(false);
    const { data, error } = await (supabase as any).from('feeding_records').select('*').eq('unit_id', unitId).eq('date', selectedDate).order('time', { ascending: true });
    if (error) { setDayRecords([]); toast({ title: 'Suivi journalier indisponible', description: 'Réessayez avant de nourrir.', variant: 'destructive' }); return; }
    setDayRecords(data || []); setRecordsReady(true);
  };
  const recordsFor = (s: FeedingSheet) => dayRecords.filter(r => r.infrastructure_id === sheetInfraIds(s)[0]);
  const periodDone = (s: FeedingSheet, period: string) => recordsFor(s).some(r => r.session_type === period);

  const loadFishCounts = async () => {
    if (!user) return;
    try {
      const { data: cycles, error: cyclesError } = await (supabase as any)
        .from('production_cycles')
        .select('id')
        .eq('unit_id', unitId)
        .eq('status', 'active');
      if (cyclesError) throw cyclesError;
      const cycleIds = (cycles || []).map((c: any) => c.id);
      if (!cycleIds.length) {
        setFishCounts({});
        return;
      }
      const { data: cis, error: cisError } = await (supabase as any)
        .from('cycle_infrastructures')
        .select('*')
        .in('cycle_id', cycleIds);
      if (cisError) throw cisError;
      const batchIds = Array.from(
        new Set((cis || []).map((c: any) => c.livestock_batch_id).filter(Boolean)),
      ) as string[];
      let batches: any[] = [];
      if (batchIds.length) {
        const { data } = await (supabase as any)
          .from('livestock_batches')
          .select('id,quantity,status')
          .in('id', batchIds);
        batches = data || [];
      }
      setFishCounts(computeFishCounts(unitInfras as any, cis || [], batches));
    } catch (e) {
      console.warn('Effectifs de poissons indisponibles:', e);
      setFishCounts({});
    }
  };

  useEffect(() => { fetchSheets(); }, [user?.id, unitId]);
  useEffect(() => { if (user) fetchDayRecords(); }, [user?.id, unitId, selectedDate]);
  useEffect(() => { loadFishCounts(); }, [user?.id, unitId, unitInfras.length]);

  const openCreate = () => {
    if (!unitInfras.length) {
      toast({ title: 'Aucune infrastructure', description: 'Vous n’avez aucune infrastructure dans cette unité. Créez une infrastructure avant sa fiche de nourrissage.', variant: 'destructive' }); return;
    }
    setEditing(null);
    // Reopening a new sheet preserves its unfinished draft.
    if (editing) { setForm(emptyForm(unitId)); setPeriods(defaultPeriods()); setDayPlans({}); }
    setPlanDay('common');
    setOpenForm(true);
  };

  const openEdit = (s: FeedingSheet) => {
    setEditing(s); setDayPlans(readDayPlans(s.observations)); setPlanDay('common');
    setForm({ ...s, infrastructure_ids: sheetInfraIds(s), observations: cleanObservations(s.observations) });
    const next = defaultPeriods();
    (Object.keys(next) as Array<keyof PeriodState>).forEach((p) => { next[p].enabled = false; });
    readSheetPlan(s).forEach((pt) => { next[pt.period] = { enabled: true, time: pt.time, quantity: String(pt.quantity || '') }; });
    setPeriods(next);
    setOpenForm(true);
  };

  /** Fiche active qui utilise déjà cette infrastructure (une seule fiche active par infrastructure). */
  const conflictFor = (infraId?: string | null) =>
    infraId ? findInfrastructureConflict(sheets, infraId, form.start_date || localDate(), editing?.id, form.end_date) : null;

  const submit = async () => {
    if (!user || savingSheet) return;
    if (!form.title?.trim() || !form.feed_type?.trim()) {
      toast({ title: 'Champs requis', description: 'Indiquez le titre de la fiche et l’aliment à servir.', variant: 'destructive' });
      return;
    }
    const infraIds = (form.infrastructure_ids || []).filter(Boolean) as string[];
    try { requireSingleInfrastructure(infraIds, unitInfras.map(i => i.id)); }
    catch (error) { toast({ title: 'Infrastructure requise', description: (error as Error).message, variant: 'destructive' }); return; }
    const conflict = form.is_active !== false ? conflictFor(infraIds[0]) : null;
    if (conflict) {
      toast({ title: 'Infrastructure déjà utilisée', description: `${infraName(infraIds[0])} figure déjà sur la fiche active « ${conflict.title} ». Désactivez cette fiche pour en créer une nouvelle.`, variant: 'destructive' });
      return;
    }
    let fields: ReturnType<typeof buildSheetFields>;
    try { validateSchedule(form.start_date || localDate(), form.end_date, form.days); fields = buildSheetFields(periodsToPlan(periods), form.observations, dayPlans); }
    catch (error) { toast({ title: 'Périodes à compléter', description: (error as Error).message, variant: 'destructive' }); return; }
    setSavingSheet(true);
    try {
      // Champs existants de la base de l'application uniquement.
      const payload: any = {
        user_id: editing?.user_id || user.id,
        unit_id: unitId,
        infrastructure_id: infraIds[0],
        title: form.title.trim(),
        ...fields,
        feed_type: form.feed_type.trim(),
        unit: form.unit || 'kg',
        responsible_name: form.responsible_name?.trim() || null,
        frequency: form.frequency || 'daily',
        days: form.days && form.days.length ? form.days : DAYS,
        start_date: form.start_date || localDate(),
        end_date: form.end_date || null,
        is_active: form.is_active !== false,
      };
      if (editing) {
        const { error } = await (supabase as any).from('feeding_sheets').update(payload).eq('id', editing.id).eq('unit_id', unitId).select('id').single();
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('feeding_sheets').insert([payload]);
        if (error) throw error;
      }
      toast({ title: editing ? 'Fiche mise à jour' : 'Fiche créée', description: `${infraName(infraIds[0])} · ${fields.quantity} ${payload.unit} par jour` });
      setOpenForm(false);
      setForm(emptyForm(unitId)); setPeriods(defaultPeriods()); setDayPlans({}); setEditing(null);
      fetchSheets();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Fiche non enregistrée', description: e.message || 'Enregistrement impossible. Votre saisie est conservée.', variant: 'destructive' });
    } finally { setSavingSheet(false); }
  };

  const toggleActive = async (s: FeedingSheet) => {
    if (!s.is_active) {
      const id = sheetInfraIds(s)[0];
      const conflict = id ? findInfrastructureConflict(sheets, id, s.start_date, s.id, s.end_date) : null;
      if (conflict) {
        toast({ title: 'Infrastructure déjà utilisée', description: `Désactivez d’abord la fiche « ${conflict.title} ».`, variant: 'destructive' });
        return;
      }
    }
    const { error } = await (supabase as any).from('feeding_sheets').update({ is_active: !s.is_active }).eq('id', s.id).eq('unit_id', unitId);
    if (error) { toast({ title: 'Modification impossible', description: error.message, variant: 'destructive' }); return; }
    toast({ title: s.is_active ? 'Fiche désactivée' : 'Fiche réactivée' });
    fetchSheets();
  };

  const remove = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('feeding_sheets').delete().eq('id', id).eq('unit_id', unitId);
      if (error) throw error;
      toast({ title: 'Fiche supprimée' });
      setDeleteId(null);
      fetchSheets();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // ---------- Nourrissage ----------

  interface FeedLine { taken: string; dose: string; mortality: string; }
  const [feeding, setFeeding] = useSessionDraft<FeedingSheet | null>(`${draftKey}:feeding`, null);
  const [feedLines, setFeedLines] = useSessionDraft<Record<string, FeedLine>>(`${draftKey}:lines`, {});
  const [feedForm, setFeedForm] = useSessionDraft(`${draftKey}:distribution`, {
    behavior: 'normal', reason: '', notes: '', period: 'matin', time: '',
    date: localDate(), requestId: '',
  });
  const [savingFeed, setSavingFeed] = useState(false);
  const { stocks: allUnitStocks, refetch: refreshStocks } = useFeedStocks(unitId);
  const stocks = useMemo(() => allUnitStocks.filter(s => !isCommercialStock(s)), [allUnitStocks]);

  const validateDistribution = (s: FeedingSheet, chosenPeriod?: string) => {
    if (!recordsReady || !isSheetScheduled(s, selectedDate)) return;
    const pending = sheetPlan(s).filter(p => !periodDone(s, p.period));
    const first = pending.find(p => p.period === chosenPeriod) || pending[0];
    if (!first) return;
    const ids = sheetInfraIds(s).filter(id => unitInfras.some(i => i.id === id));
    // Fiche ancienne sans infrastructure valide : l'utilisateur la rattache explicitement dans la fenêtre.
    const infraId = ids.length === 1 ? ids[0] : '';
    setFeedLines({ [infraId]: { taken: String(first.quantity), dose: String(first.quantity), mortality: '0' } });
    setFeedForm({ behavior: 'normal', reason: '', notes: '', period: first.period,
      time: new Date().toTimeString().slice(0, 5), date: selectedDate, requestId: crypto.randomUUID() });
    setFeeding(s);
  };

  const changeFeedPeriod = (period: string) => {
    if (!feeding) return;
    const qty = String(periodQty(feeding, period));
    setFeedForm({ ...feedForm, period });
    setFeedLines(Object.fromEntries(Object.entries(feedLines).map(([id, l]) => [id, { ...l, taken: qty, dose: qty }])));
  };

  const attachFeedInfrastructure = (infraId: string) => {
    const line = Object.values(feedLines)[0] || { taken: '0', dose: '0', mortality: '0' };
    setFeedLines({ [infraId]: line });
  };

  const confirmFeeding = async () => {
    const s = feeding;
    if (!user || !s || savingFeed) return;
    try {
      const [infraId, line] = Object.entries(feedLines)[0] || ['', null];
      if (!line) throw new Error('Saisie incomplète.');
      if (!isSheetScheduled(s, feedForm.date)) throw new Error('Cette date ne fait pas partie du programme actif.');
      const existing = await loadDayRecords(s, feedForm.date);
      if (existing.some((r: any) => r.session_type === feedForm.period)) throw new Error('Cette période est déjà nourrie pour cette journée.');
      if (!infraId || !unitInfras.some(i => i.id === infraId)) throw new Error('Choisissez l’infrastructure de cette fiche avant de nourrir.');
      const { taken, served, returned } = feedingBalance(Number(line.taken), Number(line.dose));
      const mortality = Number(line.mortality || 0);
      if (!Number.isInteger(mortality) || mortality < 0) throw new Error('La mortalité doit être un nombre entier positif ou nul.');
      if (fishCounts[infraId] !== undefined && mortality > fishCounts[infraId]) throw new Error(`La mortalité dépasse l’effectif disponible (${fishCounts[infraId]} poissons).`);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(feedForm.time) || !feedForm.date) throw new Error('Précisez la date et l’heure réelle du nourrissage.');
      if (taken <= 0) throw new Error('La quantité prélevée doit être positive.');
      if ((feedForm.behavior !== 'normal' || returned > 0) && !feedForm.reason.trim()) {
        throw new Error('Précisez pourquoi les poissons n’ont pas tout mangé.');
      }
      setSavingFeed(true);
      const requestId = feedForm.requestId || crypto.randomUUID();
      setFeedForm(previous => ({ ...previous, requestId }));
      if (sheetInfraIds(s)[0] !== infraId || sheetInfraIds(s).length !== 1) {
        const conflict = findInfrastructureConflict(sheets, infraId, s.start_date, s.id, s.end_date);
        if (conflict) throw new Error(`${infraName(infraId)} figure déjà sur la fiche active « ${conflict.title} ».`);
        const { error } = await (supabase as any).from('feeding_sheets').update({ infrastructure_id: infraId }).eq('id', s.id).eq('unit_id', unitId);
        if (error) throw error;
      }
      const result = await recordSheetFeeding(supabase, user.id, {
        sheet: s, infrastructureId: infraId, infrastructureName: infraName(infraId), requestId,
        date: feedForm.date, time: feedForm.time, period: feedForm.period as PeriodPlan['period'],
        prescribed: periodQty(s, feedForm.period), taken, served, mortality, behavior: feedForm.behavior,
        notes: [feedForm.reason, feedForm.notes].map(v => v.trim()).filter(Boolean).join(' · '),
      });
      toast({
        title: result.status === 'already_saved' ? 'Nourrissage déjà enregistré' : 'Nourrissage enregistré',
        description: `${taken} ${s.unit} prélevés · ${served} ${s.unit} servis · ${returned} ${s.unit} retournés au stock${mortality ? ` · ${mortality} mort(s)` : ''}`,
      });
      setFeeding(null); setFeedLines({});
      await Promise.all([loadFishCounts(), refreshStocks(), fetchSheets(), fetchDayRecords()]);
    } catch (e: any) {
      toast({ title: 'Nourrissage non enregistré', description: `${e.message || 'Erreur inconnue'} Votre saisie est conservée.`, variant: 'destructive' });
    } finally { setSavingFeed(false); }
  };

  /** Nourrissages réels du jour pour l'infrastructure de la fiche. */
  const loadDayRecords = async (s: FeedingSheet, date: string) => {
    const id = sheetInfraIds(s)[0];
    if (!id) return [];
    const { data, error } = await (supabase as any).from('feeding_records').select('*')
      .eq('unit_id', unitId).eq('infrastructure_id', id).eq('date', date).order('time', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  // ---------- Impression / export ----------

  const filteredSheets = filterInfra === 'all'
    ? sheets
    : sheets.filter((s) => sheetInfraIds(s).includes(filterInfra));

  const companyPrintInfo = (): CompanyInfoForPrint => ({
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
  });


  const infrasLabel = (s: FeedingSheet) => {
    const ids = sheetInfraIds(s);
    return ids.length ? ids.map((id) => infraName(id)).join(', ') : 'Aucune infrastructure';
  };

  const buildProgramHTML = (period: 'today' | 'week' | 'month') => {
    const ci = companyPrintInfo();
    const now = new Date();
    const todayName = DAYS[(now.getDay() + 6) % 7];
    const activeSheets = filteredSheets.filter(s => s.is_active);
    let periodLabel = "Programme d'alimentation";
    let rows: FeedingSheet[] = [];
    if (period === 'today') {
      periodLabel = `Programme du ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR')}`;
      rows = activeSheets.filter(s => isSheetScheduled(s, selectedDate));
    } else if (period === 'week') {
      periodLabel = `Programme hebdomadaire — semaine du ${now.toLocaleDateString('fr-FR')}`;
      rows = activeSheets;
    } else {
      periodLabel = `Programme mensuel — ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      rows = activeSheets;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(periodLabel)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
        h1 { color: #0f766e; margin: 0 0 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e0f2fe; color: #075985; font-size: 11px; }
        .footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
        ${SIGNATURES_CSS}
      </style></head><body>
      ${generateCompanyHeaderHTML(ci)}
      <h1>${escapeHtml(periodLabel)}</h1>
      <p style="margin:0;font-size:12px;color:#475569;">Unité: <strong>${escapeHtml(unitName)}</strong> — Généré le ${now.toLocaleString('fr-FR')}</p>
      <table>
        <thead>
          <tr>
            <th>Fiche</th><th>Infrastructure</th><th>Périodes et quantités</th>
            <th>Type d'aliment</th><th>Ration du jour</th><th>Responsable</th><th>Jours</th><th>Observations</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px;">Aucune fiche active pour cette période</td></tr>` : rows.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.title)}</strong></td>
              <td>${escapeHtml(infrasLabel(s))}${infrastructureQrHTML(sheetQr(s))}</td>
              <td>${sheetPlan(s).map((pt) => `<span class="badge">${PERIOD_META[pt.period]?.label || pt.period} ${pt.time} · ${pt.quantity} ${escapeHtml(s.unit)}</span>`).join(' ')}</td>
              <td>${escapeHtml(s.feed_type)}</td>
              <td>${planTotal(sheetPlan(s))} ${escapeHtml(s.unit)} / jour</td>
              <td>${escapeHtml(s.responsible_name || '—')}</td>
              <td>${escapeHtml((s.days || []).join(', '))}</td>
              <td>${escapeHtml(cleanObservations(s.observations))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${SIGNATURES_HTML}
      ${generateCompanyFooterHTML(ci)}
      <div class="footer">AquaPilote — Fiches d'alimentation professionnelles</div>
    </body></html>`;
    return html;
  };

  const DAILY_HEAD = ['Période', 'Heure prévue', 'Heure réelle', 'Effectif', 'Prescrite', 'Prélevée', 'Servie', 'Restante', 'Mortalité', 'Comportement', 'Raison / observations'];

  const dailyData = async (s: FeedingSheet) => {
    const date = selectedDate;
    const id = sheetInfraIds(s)[0];
    const records = await loadDayRecords(s, date);
    const rows = buildDailyRows(sheetPlan(s), records, id ? fishCounts[id] : undefined);
    const sum = (key: 'served' | 'remaining' | 'taken' | 'mortality') =>
      rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);
    return { rows, id, totals: { prescribed: planTotal(sheetPlan(s)), taken: sum('taken'), served: sum('served'), remaining: sum('remaining'), mortality: sum('mortality') }, done: records.length };
  };

  /** Fiche journalière imprimable : une infrastructure, chaque période sur sa ligne, remplie avec les nourrissages du jour. */
  const buildDailySheetHTML = async (s: FeedingSheet) => {
    const ci = companyPrintInfo();
    const now = new Date();
    const { rows, id, totals } = await dailyData(s);
    const u = escapeHtml(s.unit);
    const body = rows.map(r => `
        <tr>
          <td><strong>${PERIOD_LABELS[r.period]}</strong></td><td class="c">${r.plannedTime}</td><td class="c">${r.actualTime}</td>
          <td class="c">${r.fish || '—'}</td><td class="c">${r.prescribed} ${u}</td><td class="c">${r.taken}</td>
          <td class="c">${r.served}</td><td class="c">${r.remaining}</td><td class="c">${r.mortality}</td>
          <td>${escapeHtml(r.behavior)}</td><td>${escapeHtml(r.notes)}</td>
        </tr>`).join('');
    const cleanNotes = cleanObservations(s.observations);

    return `<!doctype html><html><head><meta charset="utf-8"><title>Fiche de nourrissage — ${escapeHtml(s.title)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; margin: 0; color: #1e293b; }
        h1 { color: #0f766e; margin: 8px 0 2px; font-size: 20px; letter-spacing: .3px; }
        .sub { color: #475569; font-size: 12px; margin: 0 0 12px; }
        .info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 4px; }
        .info div { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font-size: 11px; color: #475569; }
        .info strong { display: block; color: #0f172a; font-size: 13px; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 6px; text-align: left; vertical-align: top; }
        th { background: #0f766e; color: #ffffff; font-weight: bold; }
        td.c, th.c { text-align: center; }
        tbody tr td { height: 26px; }
        tfoot td { background: #f1f5f9; font-weight: bold; }
        .notes { margin-top: 12px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; min-height: 40px; }
        .footer { margin-top: 18px; font-size: 10px; color: #64748b; text-align: center; }
        ${SIGNATURES_CSS}
      </style></head><body>
      ${generateCompanyHeaderHTML(ci)}
      <h1>FICHE DE NOURRISSAGE JOURNALIÈRE</h1>
      <p class="sub">${escapeHtml(s.title)} — ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      ${infrastructureQrHTML(sheetQr(s))}
      <div class="info">
        <div>Unité<strong>${escapeHtml(unitName)}</strong></div>
        <div>Infrastructure<strong>${escapeHtml(infraName(id))}</strong></div>
        <div>Sujets disponibles<strong>${id && fishCounts[id] !== undefined ? fishCounts[id] : '—'}</strong></div>
        <div>Aliment<strong>${escapeHtml(s.feed_type)}</strong></div>
        <div>Ration du jour<strong>${totals.prescribed} ${u}</strong></div>
        <div>Responsable<strong>${escapeHtml(s.responsible_name || '—')}</strong></div>
        <div>Début de la fiche<strong>${escapeHtml(s.start_date || '—')}</strong></div>
        <div>Jours<strong>${escapeHtml((s.days || []).map(d => d.slice(0, 3)).join(', '))}</strong></div>
      </div>
      <table>
        <thead><tr>${DAILY_HEAD.map((h, i) => `<th class="${i < 9 ? 'c' : ''}">${h}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr>
          <td colspan="4">Total de la journée</td><td class="c">${totals.prescribed} ${u}</td><td class="c">${totals.taken || ''}</td>
          <td class="c">${totals.served || ''}</td><td class="c">${totals.remaining || ''}</td><td class="c">${totals.mortality || ''}</td><td colspan="2"></td>
        </tr></tfoot>
      </table>
      <div class="notes"><strong>Consignes :</strong> ${escapeHtml(cleanNotes || '')}</div>
      ${SIGNATURES_HTML}
      ${generateCompanyFooterHTML(ci)}
      <div class="footer">Fiche de nourrissage — ${escapeHtml(unitName)} — imprimée le ${now.toLocaleString('fr-FR')}</div>
    </body></html>`;
  };

  const openPrintWindow = (html: string) => {
    const w = window.open('', '_blank', 'width=1024,height=768');
    if (!w) {
      toast({ title: 'Bloqué', description: 'Autorisez les fenêtres pour imprimer', variant: 'destructive' });
      return;
    }
    w.document.write(html);
    w.document.close();
    void printWhenReady(w);
  };

  const printProgram = (period: 'today' | 'week' | 'month') => openPrintWindow(buildProgramHTML(period));
  const printDailySheet = async (s: FeedingSheet) => {
    try { openPrintWindow(await buildDailySheetHTML(s)); }
    catch { toast({ title: 'Impression impossible', description: 'Les nourrissages de cette journée n’ont pas pu être chargés.', variant: 'destructive' }); }
  };

  const downloadSheetPdf = async (s: FeedingSheet) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 14;
      if (companyInfo.logoUrl) {
        try {
          const image = new Image(); image.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = companyInfo.logoUrl || ''; });
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(image, 0, 0); doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, 8, 22, 16); }
        } catch { /* Le texte de l'entreprise reste affiché même sans logo. */ }
      }
      const x = companyInfo.logoUrl ? 40 : 14;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(companyInfo.name || unitName, x, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text([companyInfo.address, companyInfo.phone, companyInfo.email].filter(Boolean).join(' · '), x, y + 5);
      doc.setDrawColor(15, 118, 110); doc.setLineWidth(0.6); doc.line(14, 27, pageW - 14, 27);
      y = 36;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15, 118, 110);
      doc.text('FICHE DE NOURRISSAGE JOURNALIÈRE', pageW / 2, y, { align: 'center' });
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`${s.title} — ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, y + 6, { align: 'center' });
      const { rows, id, totals } = await dailyData(s);
      const qr = sheetQr(s);
      if (qr) doc.addImage(await infrastructureQrPng(qr), 'PNG', pageW - 40, y + 11, 26, 26);
      autoTable(doc, {
        startY: y + 11, theme: 'grid', styles: { fontSize: 9, cellPadding: 2 },
        margin: { left: 14, right: qr ? 46 : 14 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 }, 2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 38 } },
        body: [
          ['Unité', unitName, 'Infrastructure', infraName(id)],
          ['Sujets disponibles', id && fishCounts[id] !== undefined ? String(fishCounts[id]) : '—', 'Aliment', s.feed_type],
          ['Ration du jour', `${totals.prescribed} ${s.unit}`, 'Responsable', s.responsible_name || '—'],
        ],
      });
      autoTable(doc, {
        startY: Math.max((doc as any).lastAutoTable.finalY, qr ? y + 37 : 0) + 5, theme: 'grid',
        styles: { fontSize: 8.5, cellPadding: 2.2, minCellHeight: 9, valign: 'middle' },
        headStyles: { fillColor: [15, 118, 110], textColor: 255, halign: 'center' },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        columnStyles: { 9: { cellWidth: 28 }, 10: { cellWidth: 50 } },
        head: [DAILY_HEAD],
        body: rows.map(r => [PERIOD_LABELS[r.period], r.plannedTime, r.actualTime, r.fish || '—', `${r.prescribed} ${s.unit}`, r.taken, r.served, r.remaining, r.mortality, r.behavior, r.notes]),
        foot: [['Total de la journée', '', '', '', `${totals.prescribed} ${s.unit}`, totals.taken ? String(totals.taken) : '', totals.served ? String(totals.served) : '', totals.remaining ? String(totals.remaining) : '', totals.mortality ? String(totals.mortality) : '', '', '']],
      });
      let ey = (doc as any).lastAutoTable.finalY + 8;
      const pageH = doc.internal.pageSize.getHeight();
      if (ey > pageH - 45) { doc.addPage(); ey = 20; }
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.text('Consignes :', 14, ey);
      doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(cleanObservations(s.observations) || '—', pageW - 50), 36, ey);
      const sy = ey + 14;
      doc.setFont('helvetica', 'bold'); doc.text('Le Consultant', 50, sy, { align: 'center' }); doc.text("Le Directeur de l'exploitation", pageW - 60, sy, { align: 'center' });
      doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.3); doc.line(20, sy + 18, 80, sy + 18); doc.line(pageW - 90, sy + 18, pageW - 30, sy + 18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('Nom et signature', 50, sy + 23, { align: 'center' }); doc.text('Nom et signature', pageW - 60, sy + 23, { align: 'center' });
      doc.save(`fiche-nourrissage-${s.title.replace(/[^a-zA-Z0-9À-ÿ_-]/g, '-')}-${selectedDate}.pdf`);
    } catch { toast({ title: 'Téléchargement PDF impossible', variant: 'destructive' }); }
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

  // ---------- Rendu ----------

  return (
    <div className="min-w-0 space-y-4">
      <section>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-start gap-2 break-words">
                <ClipboardList className="w-5 h-5 text-primary" />
                Fiches d'alimentation — {unitName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Programmes de nourrissage
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
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="feeding-day">Journée</Label><Input id="feeding-day" type="date" className="w-44" value={selectedDate} onChange={e => setSelectedDate(e.target.value || localDate())} />
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
              <Button size="sm" className="mt-3" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Créer une fiche d’alimentation</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSheets.map(s => {
                const ids = sheetInfraIds(s);
                const qr = ids.length === 1 ? sheetQr(s) : undefined;
                return (
                  <Card key={s.id} className={`border-l-4 ${s.is_active ? 'border-l-primary' : 'border-l-border opacity-70'}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm break-words">{s.title}</h3>
                            {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Fish className="w-3 h-3" />
                            {ids.length === 1
                              ? <>{infraName(ids[0])} · <strong className="text-foreground">{fishCounts[ids[0]] !== undefined ? `${fishCounts[ids[0]]} sujets disponibles` : 'effectif inconnu'}</strong></>
                              : <span className="text-destructive">Infrastructure à rattacher</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Télécharger la fiche du jour en PDF" aria-label="Télécharger la fiche en PDF" onClick={() => downloadSheetPdf(s)}><FileDown className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="Imprimer la fiche du jour" aria-label="Imprimer la fiche du jour" onClick={() => printDailySheet(s)}><Printer className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="Modifier la fiche" aria-label="Modifier la fiche" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="Supprimer la fiche" aria-label="Supprimer la fiche" onClick={() => setDeleteId(s.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-md border text-xs">
                        {qr && <div className="flex justify-center border-b py-2"><InfrastructureQRCode infrastructure={qr} /></div>}
                        <div className="grid grid-cols-3 bg-muted px-2 py-1 font-medium text-muted-foreground">
                          <span>Période</span><span className="text-center">Heure</span><span className="text-right">À servir</span>
                        </div>
                        {sheetPlan(s).map((pt) => {
                          const meta = PERIOD_META[pt.period] || PERIOD_META.matin;
                          const Icon = meta.icon;
                          return (
                            <div key={pt.period} className="grid grid-cols-3 border-t px-2 py-1.5">
                              <span className="flex items-center gap-1"><Icon className="w-3 h-3" />{meta.label}</span>
                              <span className="text-center">{pt.time}</span>
                              <strong className="text-right">{pt.quantity} {s.unit}{periodDone(s, pt.period) && <span className="block text-primary font-normal">Nourri</span>}</strong>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-3 border-t bg-muted/50 px-2 py-1.5 font-semibold">
                          <span className="col-span-2">Ration du jour</span><span className="text-right">{planTotal(sheetPlan(s))} {s.unit}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 break-words text-xs">
                        <div className="col-span-2"><span className="text-muted-foreground">Aliment :</span> <strong>{s.feed_type}</strong></div>
                        {s.responsible_name && <div className="col-span-2"><span className="text-muted-foreground">Responsable :</span> {s.responsible_name}</div>}
                        <div className="col-span-2"><span className="text-muted-foreground">Programme :</span> {s.start_date} → {s.end_date || "sans fin"}</div>
                        <div className="col-span-2"><span className="text-muted-foreground">Jours :</span> {(s.days || []).join(', ')}</div>
                        {cleanObservations(s.observations) && <div className="col-span-2 text-muted-foreground italic">{cleanObservations(s.observations)}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <Button size="sm" className="flex-1" disabled={!recordsReady || !isSheetScheduled(s, selectedDate) || sheetPlan(s).every(p => periodDone(s, p.period))} onClick={() => validateDistribution(s)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> {sheetPlan(s).every(p => periodDone(s, p.period)) ? "Journée remplie" : "Nourrir aujourd’hui"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDailySheet(s)}>Fiche du jour</Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(s)}>
                          {s.is_active ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </section>

      <Dialog open={openForm} onOpenChange={o => !savingSheet && setOpenForm(o)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier la fiche' : 'Créer une fiche d’alimentation'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Titre *</Label>
              <Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Alimentation matin — Bac 1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="sheet-infrastructure">Infrastructure rattachée * (une seule par fiche)</Label>
              <Select value={(form.infrastructure_ids || []).length === 1 ? form.infrastructure_ids?.[0] : undefined} onValueChange={id => setForm({ ...form, infrastructure_id: id, infrastructure_ids: [id] })}>
                <SelectTrigger id="sheet-infrastructure"><SelectValue placeholder="Sélectionner une infrastructure" /></SelectTrigger>
                <SelectContent>{unitInfras.map(i => {
                  const used = conflictFor(i.id);
                  return (
                    <SelectItem key={i.id} value={i.id} disabled={!!used && form.is_active !== false}>
                      {i.name} · {fishCounts[i.id] !== undefined ? `${fishCounts[i.id]} sujets` : 'effectif indisponible'}{used ? ` · déjà sur « ${used.title} »` : ''}
                    </SelectItem>
                  );
                })}</SelectContent>
              </Select>
              {!unitInfras.length && <p role="alert" className="mt-2 text-sm text-destructive">Vous n’avez aucune infrastructure dans cette unité. Créez-en une avant sa fiche de nourrissage.</p>}
              {unitInfras.length > 0 && unitInfras.every(i => conflictFor(i.id)) && (
                <p role="alert" className="mt-2 text-sm text-destructive">Toutes vos infrastructures ont déjà une fiche active. Désactivez une fiche pour en créer une nouvelle.</p>
              )}
              {(form.infrastructure_ids || []).length > 1 && <p role="alert" className="mt-2 text-sm text-destructive">Cette ancienne fiche regroupe plusieurs infrastructures. Sélectionnez une seule infrastructure avant de l’enregistrer.</p>}
              {(form.infrastructure_ids || []).length === 1 && <p className="mt-2 text-sm text-muted-foreground">Sujets disponibles : <strong className="text-foreground">{fishCounts[form.infrastructure_ids?.[0] || ''] ?? 'Effectif indisponible'}</strong></p>}
            </div>
            <div>
              <Label>Type d'aliment *</Label>
              <Input list="sheet-stock-names" value={form.feed_type || ''} onChange={e => setForm({ ...form, feed_type: e.target.value })} placeholder="Choisir un article du stock" />
              <datalist id="sheet-stock-names">
                {Array.from(new Set((stocks || []).map((x: any) => x.custom_name || x.feed_type).filter(Boolean))).map((n) => (
                  <option key={n as string} value={n as string} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground mt-1">Nom de l’article du Stock de production, déduit automatiquement au nourrissage.</p>
            </div>
            <div className="sm:col-span-2">
              <Label>Périodes, heures et quantités prescrites *</Label>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Saisir la quantité prescrite en :</span>
                <Button type="button" size="sm" variant={!bagKg ? 'default' : 'outline'} onClick={() => setBagKg(0)}>{form.unit === 'g' ? 'g' : 'kg'}</Button>
                <Button type="button" size="sm" variant={bagKg ? 'default' : 'outline'} onClick={() => { setBagKg(bagKg || 20); setForm({ ...form, unit: 'kg' }); }}>Sacs</Button>
                {!!bagKg && (<>
                  <span className="text-muted-foreground">Le sac contient combien de kg ?</span>
                  {[10, 15, 20, 25].map(w => <Button key={w} type="button" size="sm" variant={bagKg === w ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setBagKg(w)}>{w} kg</Button>)}
                  <Input type="number" min="0.5" step="0.5" aria-label="Kg par sac" className="h-8 w-20" value={bagKg} onChange={e => setBagKg(Number(e.target.value) || 0)} />
                </>)}
              </div>
              <Select value={planDay} onValueChange={setPlanDay}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="common">Horaires et doses communs</SelectItem>{(form.days || DAYS).map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent></Select>
              <div className="mt-1 overflow-hidden rounded-md border">
                <div className="hidden grid-cols-[1fr_1fr_1fr] gap-2 bg-muted px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                  <span>Période</span><span>Heure prévue</span><span>Quantité prescrite ({bagKg ? 'sacs' : form.unit || 'kg'})</span>
                </div>
                {PERIOD_ORDER.map((p) => {
                  const meta = PERIOD_META[p];
                  const Icon = meta.icon;
                  const customPlan = dayPlans[planDay];
                  const customPeriod = customPlan?.find(pt => pt.period === p);
                  const state = planDay === 'common' || !customPlan ? periods[p] : { enabled: !!customPeriod, time: customPeriod?.time || periods[p].time, quantity: customPeriod ? String(customPeriod.quantity) : '' };
                  const update = (patch: Partial<PeriodState[typeof p]>) => {
                    if (planDay === 'common') { setPeriods({ ...periods, [p]: { ...state, ...patch } }); return; }
                    const updated = { ...state, ...patch };
                    const base = customPlan || periodsToPlan(periods);
                    const next = base.filter(pt => pt.period !== p);
                    if (updated.enabled) next.push({ period: p, time: updated.time, quantity: Number(updated.quantity) || 0 });
                    setDayPlans({ ...dayPlans, [planDay]: next });
                  };
                  return (
                    <div key={p} className="grid grid-cols-1 items-center gap-2 border-t px-3 py-2 sm:grid-cols-[1fr_1fr_1fr]">
                      <Button type="button" size="sm" variant={state.enabled ? 'default' : 'outline'} aria-pressed={state.enabled} onClick={() => update({ enabled: !state.enabled })}>
                        <Icon className="w-3 h-3 mr-1" /> {meta.label}{state.enabled ? '' : ' (non prévu)'}
                      </Button>
                      <Input type="time" aria-label={`Heure ${meta.label}`} disabled={!state.enabled} value={state.time} onChange={(e) => update({ time: e.target.value })} />
                      <Input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Quantité ${meta.label}`} disabled={!state.enabled}
                        placeholder={bagKg ? 'Sacs' : 'Quantité prescrite'}
                        value={bagKg ? (state.quantity ? String(+(Number(state.quantity) / bagKg).toFixed(3)) : '') : (state.quantity ?? '')}
                        onChange={(e) => update({ quantity: bagKg && e.target.value !== '' ? String(+(Number(e.target.value) * bagKg).toFixed(3)) : e.target.value })} />
                    </div>
                  );
                })}
                {(() => {
                  const total = planTotal(planDay === 'common' ? periodsToPlan(periods) : dayPlans[planDay] || periodsToPlan(periods));
                  const unit = form.unit || 'kg';
                  const stock = (stocks || []).find((x: any) => (x.custom_name || x.feed_type) === form.feed_type);
                  const costKg = Number(stock?.cost) || 0;
                  const kg = unit === 'g' ? total / 1000 : total;
                  return (
                    <div className="flex flex-wrap justify-between gap-2 border-t bg-muted/50 px-3 py-2 text-sm font-semibold">
                      <span>Ration du jour prescrite</span>
                      <span>{total.toLocaleString('fr-FR')} {unit}{bagKg ? ` (${+(total / bagKg).toFixed(2)} sacs de ${bagKg} kg)` : ''}
                        {costKg > 0 && unit !== 'sacs' && <> · coût {Math.round(kg * costKg).toLocaleString('fr-FR')} F CFA</>}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div>
              <Label>Unité</Label>
              <Select value={form.unit as string} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsable</Label>
              <Input value={form.responsible_name || ''} onChange={e => setForm({ ...form, responsible_name: e.target.value })} placeholder="Nom du responsable/technicien" />
            </div>
            <div>
              <Label>Fréquence</Label>
              <Select value={form.frequency as string} onValueChange={v => setForm({ ...form, frequency: v as any, end_date: v === 'weekly' ? dateAfter(form.start_date || localDate(), 6) : v === 'monthly' ? dateAfter(form.start_date || localDate(), 29) : form.end_date })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Dates personnalisées</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date de début</Label>
              <Input type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value, end_date: e.target.value && form.frequency === 'weekly' ? dateAfter(e.target.value, 6) : form.end_date })} />
            </div>
            <div><Label htmlFor="sheet-end">Date de fin</Label><Input id="sheet-end" type="date" min={form.start_date} value={form.end_date || ""} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
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
            <Button disabled={savingSheet || !unitInfras.length} onClick={submit}>{editing ? 'Enregistrer' : 'Créer la fiche'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!feeding} onOpenChange={(o) => !o && !savingFeed && setFeeding(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nourrir aujourd’hui — {feeding?.title}</DialogTitle></DialogHeader>
          {feeding && (
            <div className="space-y-3">
              {Object.entries(feedLines).map(([infraId, line]) => {
                const prescribed = periodQty(feeding, feedForm.period);
                const returned = Math.max(0, Number(line.taken) - Number(line.dose));
                const setLine = (patch: Partial<FeedLine>) => setFeedLines({ [infraId]: { ...line, ...patch } });
                const fish = infraId ? fishCounts[infraId] : undefined;
                return (
                  <div key={infraId || 'none'} className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 rounded-md bg-muted p-3 text-sm sm:grid-cols-2">
                      <div><span className="text-muted-foreground">Infrastructure :</span>{' '}
                        {infraId ? <strong>{infraName(infraId)}</strong> : <span className="text-destructive">à rattacher</span>}
                      </div>
                      <div className="flex items-center gap-1"><Fish className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Sujets disponibles :</span> <strong>{fish !== undefined ? `${fish} poissons` : 'inconnu'}</strong>
                      </div>
                      <div><span className="text-muted-foreground">Aliment :</span> <strong>{feeding.feed_type}</strong></div>
                      <div><span className="text-muted-foreground">Ration du jour :</span> <strong>{planTotal(sheetPlan(feeding))} {feeding.unit}</strong></div>
                    </div>
                    {!infraId && (
                      <div className="rounded-md border border-destructive/40 p-3">
                        <Label htmlFor="feed-attach">Cette fiche n’a pas d’infrastructure. Choisissez-la pour l’y rattacher *</Label>
                        <Select onValueChange={attachFeedInfrastructure}>
                          <SelectTrigger id="feed-attach" className="mt-1"><SelectValue placeholder="Sélectionner l’infrastructure" /></SelectTrigger>
                          <SelectContent>{unitInfras.map(i => {
                            const used = findInfrastructureConflict(sheets, i.id, feeding.start_date, feeding.id, feeding.end_date);
                            return <SelectItem key={i.id} value={i.id} disabled={!!used}>{i.name}{used ? ` · déjà sur « ${used.title} »` : ''}</SelectItem>;
                          })}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div><Label>Période</Label>
                        <Select value={feedForm.period} onValueChange={changeFeedPeriod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{sheetPlan(feeding).map(pt => <SelectItem key={pt.period} value={pt.period} disabled={periodDone(feeding, pt.period)}>{PERIOD_LABELS[pt.period]} — prévu {pt.time} · {pt.quantity} {feeding.unit}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Date</Label><Input type="date" readOnly value={feedForm.date} /></div>
                      <div><Label>Heure réelle *</Label><Input type="time" value={feedForm.time} onChange={e => setFeedForm({ ...feedForm, time: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div><Label>Quantité prescrite</Label><Input readOnly value={`${prescribed} ${feeding.unit}`} className="bg-muted" /></div>
                      <div><Label>Quantité prélevée *</Label><Input type="number" min="0" step="0.01" value={line.taken} onChange={e => setLine({ taken: e.target.value })} /></div>
                      <div><Label>Quantité servie *</Label><Input type="number" min="0" step="0.01" value={line.dose} onChange={e => setLine({ dose: e.target.value })} /></div>
                      <div><Label>Quantité restante</Label><Input readOnly value={`${returned.toLocaleString('fr-FR')} ${feeding.unit}`} className="bg-muted font-semibold" /></div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fish !== undefined ? `Sur les ${fish} poissons, ` : ''}{Number(line.dose) || 0} {feeding.unit} servis.
                      {returned > 0 ? ` Les ${returned.toLocaleString('fr-FR')} ${feeding.unit} restants retournent au stock.` : ''}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div><Label>Mortalité observée</Label><Input type="number" min="0" step="1" value={line.mortality} onChange={e => setLine({ mortality: e.target.value })} /></div>
                      <div><Label>Comportement des poissons</Label>
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
                    {(feedForm.behavior !== 'normal' || returned > 0) && (
                      <div><Label>Pourquoi les poissons n’ont pas tout mangé ? *</Label>
                        <Input list="feed-refusal-reasons" value={feedForm.reason} onChange={(e) => setFeedForm({ ...feedForm, reason: e.target.value })} placeholder="Ex : eau trouble, température basse…" />
                        <datalist id="feed-refusal-reasons">
                          {['Eau trouble ou de mauvaise qualité', 'Température trop basse', 'Manque d’oxygène', 'Poissons malades', 'Stress (manipulation, pêche)', 'Aliment inadapté ou avarié', 'Suralimentation'].map((r) => <option key={r} value={r} />)}
                        </datalist>
                      </div>
                    )}
                  </div>
                );
              })}
              <div><Label>Observations, maladies et autres constats</Label><Input value={feedForm.notes} onChange={(e) => setFeedForm({ ...feedForm, notes: e.target.value })} /></div>
              <div className="border-t pt-3 text-sm">
                <span className="text-muted-foreground">Stock de production · {unitName} · {feeding.feed_type} :</span>{' '}
                <strong>{stocks.filter(x => matchesFeedingStock(x, unitId, feeding.feed_type) && x.unit === feeding.unit).reduce((sum, x) => sum + Number(x.quantity), 0).toLocaleString('fr-FR')} {feeding.unit} disponibles</strong>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setFeeding(null)}>Annuler</Button>
                <Button className="h-auto min-h-10 whitespace-normal" disabled={savingFeed} onClick={confirmFeeding}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />{savingFeed ? 'Enregistrement…' : 'Enregistrer le nourrissage'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dailySheet} onOpenChange={open => !open && setDailySheet(null)}>
        <DialogContent className="max-w-5xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Fiche journalière — {dailySheet?.title}</DialogTitle></DialogHeader>
          {dailySheet && <div className="space-y-4">
            <p className="text-sm font-medium">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {infrasLabel(dailySheet)}</p>
            {!isSheetScheduled(dailySheet, selectedDate) && <p className="text-sm text-muted-foreground">Aucun nourrissage prévu pour cette date.</p>}
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Période / heure', 'Prescrite', 'Servie', 'Restante', 'Mortalité', 'Observations', 'État'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>
              {buildDailyRows(sheetPlan(dailySheet), recordsFor(dailySheet), fishCounts[sheetInfraIds(dailySheet)[0]]).map(row => <tr key={row.period} className="border-b">
                <td className="p-2">{PERIOD_LABELS[row.period]} · {row.plannedTime}{row.actualTime && <span className="block text-muted-foreground">Nourri à {row.actualTime}</span>}</td><td className="p-2">{row.prescribed} {dailySheet.unit}</td><td className="p-2">{row.served || '—'}</td><td className="p-2">{row.remaining || '—'}</td><td className="p-2">{row.mortality || '—'}</td><td className="p-2 min-w-40">{row.behavior} {row.notes}</td>
                <td className="p-2">{row.served !== '' ? <Badge variant="secondary">Nourri</Badge> : <Button size="sm" disabled={!recordsReady || !isSheetScheduled(dailySheet, selectedDate)} onClick={() => { validateDistribution(dailySheet, row.period); setDailySheet(null); }}>Nourrir</Button>}</td>
              </tr>)}
            </tbody></table></div>
            <p className="text-sm font-semibold">Total prescrit : {planTotal(sheetPlan(dailySheet))} {dailySheet.unit} · Servi : {buildDailyRows(sheetPlan(dailySheet), recordsFor(dailySheet)).reduce((sum, row) => sum + Number(row.served || 0), 0)} {dailySheet.unit}</p>
            <div className="flex gap-2"><Button variant="outline" onClick={() => downloadSheetPdf(dailySheet)}><FileDown className="w-4 h-4 mr-2" />PDF</Button><Button variant="outline" onClick={() => printDailySheet(dailySheet)}><Printer className="w-4 h-4 mr-2" />Imprimer</Button></div>
          </div>}
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
