import { useSessionDraft } from '@/hooks/useSessionDraft';
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
  PERIOD_ORDER, normalizePeriodTimes, normalizeInfrastructureIds,
  computeFishCounts, requireSingleInfrastructure,
  type PeriodTime,
} from '@/lib/feedingSheetUtils';

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

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const PERIOD_META: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  matin: { label: 'Matin', icon: Sunrise, color: 'bg-secondary text-secondary-foreground' },
  midi: { label: 'Midi', icon: Sun, color: 'bg-accent text-accent-foreground' },
  soir: { label: 'Soir', icon: Moon, color: 'bg-muted text-foreground' },
};

interface Props {
  unitId: string;
  unitName: string;
}

type PeriodState = Record<'matin' | 'midi' | 'soir', { enabled: boolean; time: string }>;

const defaultPeriods = (): PeriodState => ({
  matin: { enabled: true, time: '07:00' },
  midi: { enabled: false, time: '12:00' },
  soir: { enabled: false, time: '18:00' },
});

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
  frequency: 'daily',
  days: [...DAYS],
  start_date: new Date().toISOString().split('T')[0],
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterInfra, setFilterInfra] = useState<string>('all');
  const [fishCounts, setFishCounts] = useState<Record<string, number>>({});

  const unitInfras = useMemo(
    () => infrastructures.filter((i: any) => i.unitId === unitId),
    [infrastructures, unitId],
  );

  const infraName = (id?: string | null) =>
    id ? (unitInfras.find((i) => i.id === id)?.name || '—') : 'Toutes';

  const sheetInfraIds = (s: FeedingSheet) => normalizeInfrastructureIds(s);
  const sheetPeriods = (s: FeedingSheet) => normalizePeriodTimes(s);

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
  useEffect(() => { loadFishCounts(); }, [user?.id, unitId, unitInfras.length]);

  const openCreate = () => {
    if (!unitInfras.length) {
      toast({ title: 'Aucune infrastructure', description: 'Vous n’avez aucune infrastructure dans cette unité. Créez une infrastructure avant sa fiche de nourrissage.', variant: 'destructive' }); return;
    }
    setEditing(null);
    // Reopening a new sheet preserves its unfinished draft.
    if (editing) { setForm(emptyForm(unitId)); setPeriods(defaultPeriods()); }
    setOpenForm(true);
  };

  const openEdit = (s: FeedingSheet) => {
    setEditing(s);
    setForm({ ...s, infrastructure_ids: sheetInfraIds(s) });
    const next = defaultPeriods();
    (Object.keys(next) as Array<keyof PeriodState>).forEach((p) => { next[p].enabled = false; });
    sheetPeriods(s).forEach((pt) => { next[pt.period] = { enabled: true, time: pt.time }; });
    setPeriods(next);
    setOpenForm(true);
  };

  const submit = async () => {
    if (!user || savingSheet) return;
    const enabledPeriods = PERIOD_ORDER.filter((p) => periods[p].enabled);
    if (!form.title || !form.feed_type || !enabledPeriods.length) {
      toast({
        title: 'Champs requis',
        description: 'Titre, aliment et au moins une période de nourrissage sont requis',
        variant: 'destructive',
      });
      return;
    }
    const periodTimes: PeriodTime[] = enabledPeriods.map((p) => ({
      period: p,
      time: periods[p].time || '07:00',
    }));
    const infraIds = (form.infrastructure_ids || []).filter(Boolean) as string[];
    try { requireSingleInfrastructure(infraIds, unitInfras.map(i => i.id)); }
    catch (error) { toast({ title: 'Infrastructure requise', description: (error as Error).message, variant: 'destructive' }); return; }
    if (!infraIds.length || !(Number(form.quantity) > 0) || !periodTimes.every(p => /^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))) {
      toast({ title: 'Précisez les infrastructures, une quantité positive et les horaires.', variant: 'destructive' }); return;
    }
    setSavingSheet(true);
    try {
      const basePayload: any = {
        user_id: user.id,
        unit_id: unitId,
        infrastructure_id: infraIds[0] || null,
        title: form.title,
        period: periodTimes[0].period,
        time: periodTimes[0].time,
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
      const fullPayload = { ...basePayload, infrastructure_ids: infraIds, period_times: periodTimes };

      const saveRow = async (payload: any) => {
        if (editing) {
          const { error } = await (supabase as any).from('feeding_sheets').update(payload).eq('id', editing.id).eq('unit_id', unitId).select('id').single();
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from('feeding_sheets').insert([payload]);
          if (error) throw error;
        }
      };

      // Never silently discard advanced fields when the server is not ready.
      await saveRow(fullPayload);
      toast({ title: editing ? 'Fiche mise à jour' : 'Fiche créée' });
      setOpenForm(false);
      setForm(emptyForm(unitId)); setPeriods(defaultPeriods()); setEditing(null);
      fetchSheets();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erreur', description: e.message || 'Enregistrement impossible', variant: 'destructive' });
    } finally { setSavingSheet(false); }
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
    date: new Date().toLocaleDateString('en-CA'), requestId: '',
  });
  const [savingFeed, setSavingFeed] = useState(false);
  const { stocks: allUnitStocks, refetch: refreshStocks } = useFeedStocks(unitId);
  const stocks = useMemo(() => allUnitStocks.filter(s => !isCommercialStock(s)), [allUnitStocks]);

  const validateDistribution = (s: FeedingSheet) => {
    const ids = sheetInfraIds(s);
    try { requireSingleInfrastructure(ids, unitInfras.map(i => i.id)); }
    catch (error) { toast({ title: 'Fiche à corriger', description: (error as Error).message, variant: 'destructive' }); return; }
    const lines: Record<string, FeedLine> = {};
    ids.forEach(id => {
      lines[id] = { taken: String(s.quantity), dose: String(s.quantity), mortality: '0' };
    });
    setFeedLines(lines);
    setFeedForm({ behavior: 'normal', reason: '', notes: '', period: sheetPeriods(s)[0].period,
      time: new Date().toTimeString().slice(0, 5), date: new Date().toLocaleDateString('en-CA'), requestId: crypto.randomUUID() });
    setFeeding(s);
  };

  const confirmFeeding = async () => {
    const s = feeding;
    if (!user || !s || savingFeed) return;
    try {
      const lines = Object.entries(feedLines).map(([infrastructure_id, line]) => ({
        infrastructure_id, ...feedingBalance(Number(line.taken), Number(line.dose)), mortality: Number(line.mortality),
      }));
      requireSingleInfrastructure(lines.map(l => l.infrastructure_id), unitInfras.map(i => i.id));
      requireSingleInfrastructure(sheetInfraIds(s), unitInfras.map(i => i.id));
      if (lines[0]?.infrastructure_id !== sheetInfraIds(s)[0]) throw new Error('L’infrastructure ne correspond pas à la fiche.');
      if (!lines.length || lines.some(l => !l.infrastructure_id || !Number.isInteger(l.mortality) || l.mortality < 0) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(feedForm.time) || !feedForm.date) {
        throw new Error('Précisez la date, l’heure réelle, l’infrastructure et une mortalité entière positive ou nulle.');
      }
      const totalTaken = lines.reduce((sum, l) => sum + l.taken, 0);
      const totalServed = lines.reduce((sum, l) => sum + l.served, 0);
      if (totalTaken <= 0) throw new Error('La quantité prélevée doit être positive.');
      if (feedForm.behavior !== 'normal' && !feedForm.reason.trim()) throw new Error('Précisez la raison de la non-consommation.');
      const matchingStocks = stocks.filter(x => matchesFeedingStock(x, unitId, s.feed_type) && x.unit === s.unit);
      if (matchingStocks.reduce((sum, x) => sum + Number(x.quantity), 0) < totalTaken) {
        throw new Error('Stock de production insuffisant pour ce prélèvement dans cette unité.');
      }
      setSavingFeed(true);
      const requestId = feedForm.requestId || crypto.randomUUID();
      setFeedForm(previous => ({ ...previous, requestId }));
      const { error } = await (supabase as any).rpc('record_sheet_feeding', {
        _sheet_id: s.id, _request_id: requestId, _date: feedForm.date, _time: feedForm.time,
        _period: feedForm.period, _lines: lines, _behavior: feedForm.behavior,
        _notes: [feedForm.reason, feedForm.notes].filter(Boolean).join(' · '),
      });
      if (error) {
        if (error.code === 'PGRST202' || error.code === '42883') {
          throw new Error('L’enregistrement sécurisé du nourrissage n’est pas encore disponible pour votre compte. Votre saisie est conservée ; aucun stock n’a été modifié.');
        }
        throw error;
      }
      toast({ title: 'Nourrissage enregistré', description: `${totalTaken} ${s.unit} prélevés · ${totalServed} ${s.unit} servis · ${totalTaken - totalServed} ${s.unit} retournés au stock` });
      setFeeding(null); setFeedLines({});
      await Promise.all([loadFishCounts(), refreshStocks()]);
    } catch (e: any) {
      toast({ title: 'Nourrissage non enregistré', description: e.message || 'Votre saisie est conservée.', variant: 'destructive' });
    } finally { setSavingFeed(false); }
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

  const periodsLabel = (s: FeedingSheet) =>
    sheetPeriods(s).map((pt) => `${PERIOD_META[pt.period]?.label || pt.period} ${pt.time}`).join(' · ');

  const infrasLabel = (s: FeedingSheet) => {
    const ids = sheetInfraIds(s);
    return ids.length ? ids.map((id) => infraName(id)).join(', ') : 'Toutes';
  };

  const buildProgramHTML = (period: 'today' | 'week' | 'month') => {
    const ci = companyPrintInfo();
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
            <th>Fiche</th><th>Infrastructures</th><th>Périodes</th>
            <th>Type d'aliment</th><th>Quantité</th><th>Responsable</th><th>Jours</th><th>Observations</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:16px;">Aucune fiche active pour cette période</td></tr>` : rows.map(s => `
            <tr>
              <td><strong>${escapeHtml(s.title)}</strong></td>
              <td>${escapeHtml(infrasLabel(s))}</td>
              <td>${sheetPeriods(s).map((pt) => `<span class="badge">${PERIOD_META[pt.period]?.label || pt.period} ${pt.time}</span>`).join(' ')}</td>
              <td>${escapeHtml(s.feed_type)}</td>
              <td>${s.quantity} ${escapeHtml(s.unit)}</td>
              <td>${escapeHtml(s.responsible_name || '—')}</td>
              <td>${escapeHtml((s.days || []).join(', '))}</td>
              <td>${escapeHtml(s.observations || '')}</td>
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

  /** Fiche journalière imprimable d'une seule fiche, avec effectifs et cases à remplir. */
  const buildDailySheetHTML = (s: FeedingSheet) => {
    const ci = companyPrintInfo();
    const now = new Date();
    const ids = sheetInfraIds(s);
    const rows = sheetPeriods(s).flatMap(pt => (ids.length ? ids : ['']).map(id => ({ id, pt }))).map(({ id, pt }) => {
      const name = id ? infraName(id) : 'Toutes infrastructures';
      const count = id ? fishCounts[id] : undefined;
      return `
        <tr>
          <td>${escapeHtml(name)}</td><td>${escapeHtml(PERIOD_META[pt.period].label)} ${pt.time}</td><td></td>
          <td style="text-align:center;">${count !== undefined ? count : '—'}</td>
          <td>${escapeHtml(s.feed_type)}</td>
          <td style="text-align:center;">${s.quantity} ${escapeHtml(s.unit)}</td>
          <td></td><td></td><td></td><td></td><td></td>
        </tr>`;
    }).join('');

    return `<!doctype html><html><head><meta charset="utf-8"><title>Fiche de nourrissage — ${escapeHtml(s.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
        h1 { color: #0f766e; margin: 0 0 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e0f2fe; color: #075985; font-size: 11px; margin: 1px; }
        .meta { font-size: 12px; color: #475569; margin: 4px 0; }
        .footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
        ${SIGNATURES_CSS}
      </style></head><body>
      ${generateCompanyHeaderHTML(ci)}
      <h1>Fiche de nourrissage journalière</h1>
      <p class="meta">Unité : <strong>${escapeHtml(unitName)}</strong> — Date : ${now.toLocaleDateString('fr-FR')}</p>
      <p class="meta">Fiche : <strong>${escapeHtml(s.title)}</strong> — Responsable : <strong>${escapeHtml(s.responsible_name || '—')}</strong></p>
      <p class="meta">Périodes : ${sheetPeriods(s).map((pt) => `<span class="badge">${PERIOD_META[pt.period]?.label || pt.period} — ${pt.time}</span>`).join(' ')}</p>
      <table>
        <thead>
          <tr>
            <th>Infrastructure</th><th>Période prévue</th><th>Heure réelle</th><th>Poissons présents</th><th>Aliment</th>
            <th>Prescrite</th><th>Prélevée</th><th>Servie</th><th>Restante / retour</th><th>Mortalité</th><th>Observations</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${s.observations ? `<p class="meta">Consignes : ${escapeHtml(s.observations)}</p>` : ''}
      ${SIGNATURES_HTML}
      ${generateCompanyFooterHTML(ci)}
      <div class="footer">AquaPilote — Fiche de nourrissage journalière</div>
    </body></html>`;
  };

  const openPrintWindow = (html: string) => {
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

  const printProgram = (period: 'today' | 'week' | 'month') => openPrintWindow(buildProgramHTML(period));
  const printDailySheet = (s: FeedingSheet) => openPrintWindow(buildDailySheetHTML(s));

  const downloadSheetPdf = async (s: FeedingSheet) => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      let y = 16;
      if (companyInfo.logoUrl) {
        try {
          const image = new Image(); image.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = companyInfo.logoUrl || ''; });
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.drawImage(image, 0, 0); doc.addImage(canvas.toDataURL('image/png'), 'PNG', 14, 8, 24, 16); y = 30; }
        } catch { /* The company's text remains even if its logo is unavailable. */ }
      }
      doc.setFontSize(16); doc.text(companyInfo.name || unitName, 14, y);
      doc.setFontSize(9); doc.text([companyInfo.address, companyInfo.phone, companyInfo.email].filter(Boolean).join(' · '), 14, y + 6);
      doc.setFontSize(14); doc.text('Fiche de nourrissage', 14, y + 17);
      doc.setFontSize(10); doc.text(doc.splitTextToSize(`${s.title} — Unité : ${unitName}`, 265), 14, y + 24);
      doc.text(`Responsable : ${s.responsible_name || '—'} · Début : ${s.start_date}${s.end_date ? ` · Fin : ${s.end_date}` : ''}`, 14, y + 35);
      const ids = sheetInfraIds(s);
      autoTable(doc, {
        startY: y + 40, styles: { fontSize: 8 }, theme: 'grid',
        head: [['Infrastructure', 'Effectif', 'Période', 'Heure prévue', 'Heure réelle', 'Aliment', 'Prescrite', 'Prélevée', 'Servie', 'Retour', 'Mortalité']],
        body: sheetPeriods(s).flatMap(pt => ids.map(id => [infraName(id), fishCounts[id] ?? '—', PERIOD_META[pt.period].label, pt.time, '', s.feed_type, `${s.quantity} ${s.unit}`, '', '', '', ''])),
      });
      doc.addPage(); doc.setFontSize(12); doc.text('Consignes et validation', 14, 18);
      doc.setFontSize(10); doc.text(doc.splitTextToSize(s.observations || '—', 265), 14, 28);
      doc.text('Le consultant : nom et signature', 14, 100); doc.text("Le directeur de l’exploitation : nom et signature", 155, 100);
      doc.save(`fiche-nourrissage-${s.title.replace(/[^a-zA-Z0-9À-ÿ_-]/g, '-')}.pdf`);
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
                const pts = sheetPeriods(s);
                const ids = sheetInfraIds(s);
                return (
                  <Card key={s.id} className={`border-l-4 ${s.is_active ? 'border-l-primary' : 'border-l-border opacity-70'}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm break-words">{s.title}</h3>
                            {pts.map((pt) => {
                              const meta = PERIOD_META[pt.period] || PERIOD_META.matin;
                              const Icon = meta.icon;
                              return (
                                <Badge key={pt.period} className={`${meta.color} text-[10px]`}>
                                  <Icon className="w-3 h-3 mr-1" />{meta.label} {pt.time}
                                </Badge>
                              );
                            })}
                            {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ids.length ? ids.map((id) => infraName(id)).join(', ') : 'Toutes infrastructures'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Télécharger la fiche en PDF" aria-label="Télécharger la fiche en PDF" onClick={() => downloadSheetPdf(s)}><FileDown className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="Imprimer la fiche du jour" onClick={() => printDailySheet(s)}><Printer className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="Modifier la fiche" aria-label="Modifier la fiche" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" title="Supprimer la fiche" aria-label="Supprimer la fiche" onClick={() => setDeleteId(s.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 break-words text-xs">
                        <div><span className="text-muted-foreground">Quantité:</span> <strong>{s.quantity} {s.unit}</strong></div>
                        <div><span className="text-muted-foreground">Aliment:</span> <strong>{s.feed_type}</strong></div>
                        {ids.map((id) => (
                          <div key={id} className="col-span-2 flex items-center gap-1">
                            <Fish className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{infraName(id)} :</span>
                            <strong>{fishCounts[id] !== undefined ? `${fishCounts[id]} poisson(s)` : 'effectif inconnu'}</strong>
                          </div>
                        ))}
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
      </section>

      <Dialog open={openForm} onOpenChange={o => !savingSheet && setOpenForm(o)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier la fiche' : 'Nouvelle fiche d\'alimentation'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Titre *</Label>
              <Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Alimentation matin — Bac 1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="sheet-infrastructure">Infrastructure rattachée *</Label>
              <Select value={(form.infrastructure_ids || []).length === 1 ? form.infrastructure_ids?.[0] : undefined} onValueChange={id => setForm({ ...form, infrastructure_id: id, infrastructure_ids: [id] })}>
                <SelectTrigger id="sheet-infrastructure"><SelectValue placeholder="Sélectionner une infrastructure" /></SelectTrigger>
                <SelectContent>{unitInfras.map(i => <SelectItem key={i.id} value={i.id}>{i.name} · {fishCounts[i.id] !== undefined ? `${fishCounts[i.id]} sujets disponibles` : 'effectif indisponible'}</SelectItem>)}</SelectContent>
              </Select>
              {!unitInfras.length && <p role="alert" className="mt-2 text-sm text-destructive">Vous n’avez aucune infrastructure dans cette unité. Créez-en une avant sa fiche de nourrissage.</p>}
              {(form.infrastructure_ids || []).length > 1 && <p role="alert" className="mt-2 text-sm text-destructive">Cette ancienne fiche regroupe plusieurs infrastructures. Sélectionnez une seule infrastructure avant de l’enregistrer.</p>}
              {(form.infrastructure_ids || []).length === 1 && <p className="mt-2 text-sm text-muted-foreground">Sujets disponibles : <strong className="text-foreground">{fishCounts[form.infrastructure_ids?.[0] || ''] ?? 'Effectif indisponible'}</strong></p>}
            </div>
            <div className="sm:col-span-2">
              <Label>Périodes de nourrissage *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                {PERIOD_ORDER.map((p) => {
                  const meta = PERIOD_META[p];
                  const Icon = meta.icon;
                  const state = periods[p];
                  return (
                    <div key={p} className={`rounded-md border p-2 ${state.enabled ? 'border-primary' : ''}`}>
                      <Button
                        type="button"
                        size="sm"
                        variant={state.enabled ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => setPeriods({ ...periods, [p]: { ...state, enabled: !state.enabled } })}
                      >
                        <Icon className="w-3 h-3 mr-1" /> {meta.label}
                      </Button>
                      {state.enabled && (
                        <Input
                          type="time"
                          className="mt-2"
                          value={state.time}
                          onChange={(e) => setPeriods({ ...periods, [p]: { ...state, time: e.target.value } })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Type d'aliment *</Label>
              <Input list="sheet-stock-names" value={form.feed_type || ''} onChange={e => setForm({ ...form, feed_type: e.target.value })} placeholder="Choisir un article du stock" />
              <datalist id="sheet-stock-names">
                {Array.from(new Set((stocks || []).map((x: any) => x.custom_name || x.feed_type).filter(Boolean))).map((n) => (
                  <option key={n as string} value={n as string} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground mt-1">Utilisez le nom de l’article du module Stock pour qu’il soit déduit automatiquement.</p>
            </div>
            <div>
              <Label>Quantité prescrite (par infrastructure et période)</Label>
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
            <div>
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
            <Button disabled={savingSheet || !unitInfras.length} onClick={submit}>{editing ? 'Enregistrer' : 'Créer la fiche'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!feeding} onOpenChange={(o) => !o && !savingFeed && setFeeding(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nourrir aujourd’hui — {feeding?.title}</DialogTitle></DialogHeader>
          {feeding && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Aliment :</span> <strong>{feeding.feed_type}</strong></div>
                <div><span className="text-muted-foreground">Périodes :</span> <strong>{periodsLabel(feeding)}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Dose prévue :</span> <strong>{feeding.quantity} {feeding.unit} par infrastructure</strong></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Période de nourrissage</Label><Select value={feedForm.period} onValueChange={period => setFeedForm({ ...feedForm, period })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sheetPeriods(feeding).map(pt => <SelectItem key={pt.period} value={pt.period}>Nourrissage {pt.period === 'soir' ? 'du soir' : pt.period === 'midi' ? 'de midi' : 'du matin'}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Date du nourrissage</Label><Input type="date" value={feedForm.date} onChange={e => setFeedForm({ ...feedForm, date: e.target.value })} /></div>
                <div><Label>Heure réelle *</Label><Input type="time" value={feedForm.time} onChange={e => setFeedForm({ ...feedForm, time: e.target.value })} /></div>
              </div>
              {Object.entries(feedLines).map(([infraId, line]) => (
                <div key={infraId || 'all'} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{infraId ? infraName(infraId) : 'Toutes infrastructures'}</p>
                    {infraId && fishCounts[infraId] !== undefined && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Fish className="w-3 h-3 mr-1" />{fishCounts[infraId]} poisson(s)
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label>Quantité prélevée ({feeding.unit}) *</Label><Input type="number" min="0" step="0.01" value={line.taken} onChange={e => setFeedLines({ ...feedLines, [infraId]: { ...line, taken: e.target.value } })} /></div>
                    <div>
                      <Label>Quantité servie / ingérée ({feeding.unit}) *</Label>
                      <Input type="number" step="0.01" value={line.dose} onChange={(e) => setFeedLines({ ...feedLines, [infraId]: { ...line, dose: e.target.value } })} />
                    </div>
                    <div>
                      <Label>Mortalité constatée</Label>
                      <Input type="number" min="0" value={line.mortality} onChange={(e) => setFeedLines({ ...feedLines, [infraId]: { ...line, mortality: e.target.value } })} />
                    </div>
                  </div>
                  <p className="text-sm"><span className="text-muted-foreground">Prescrite :</span> {feeding.quantity} {feeding.unit} · <span className="text-muted-foreground">Restante / retour au stock :</span> <strong>{Math.max(0, Number(line.taken) - Number(line.dose)).toLocaleString('fr-FR')} {feeding.unit}</strong></p>
                </div>
              ))}

              <div>
                <Label>Appétit</Label>
                <Select value={feedForm.behavior} onValueChange={(v) => setFeedForm({ ...feedForm, behavior: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Bon appétit</SelectItem>
                    <SelectItem value="faible">Appétit faible</SelectItem>
                    <SelectItem value="refus">Refus de manger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {feedForm.behavior !== 'normal' && (
                <div><Label>Pourquoi l’aliment n’a pas été consommé ? *</Label>
                  <Input list="feed-refusal-reasons" value={feedForm.reason} onChange={(e) => setFeedForm({ ...feedForm, reason: e.target.value })} placeholder="Ex : eau trouble, température basse…" />
                  <datalist id="feed-refusal-reasons">
                    {['Eau trouble ou de mauvaise qualité', 'Température trop basse', 'Manque d’oxygène', 'Poissons malades', 'Stress (manipulation, pêche)', 'Aliment inadapté ou avarié', 'Suralimentation'].map((r) => <option key={r} value={r} />)}
                  </datalist>
                </div>
              )}
              <div><Label>Observations</Label><Input value={feedForm.notes} onChange={(e) => setFeedForm({ ...feedForm, notes: e.target.value })} /></div>
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
