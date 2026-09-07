import { supabase } from '@/integrations/supabase/appClient';
import type { ReportData } from '@/lib/reportExportUtils';

export type JournalPeriodType = 'day' | 'week' | 'month' | 'quarter' | 'custom';

export const PERIOD_LABELS: Record<JournalPeriodType, string> = {
  day: 'Journalier',
  week: 'Hebdomadaire',
  month: 'Mensuel',
  quarter: 'Trimestriel',
  custom: 'Personnalisé',
};

export interface JournalEntry {
  id: string;
  unitId: string;
  unitName: string;
  periodType: JournalPeriodType;
  start: string;
  end: string;
  generatedAt: string;
  auto: boolean;
  read?: boolean;
  data: ReportData;
}

export const STORAGE_KEY = 'aquapilote.farm-journal.history';
export const AUTO_FLAG_KEY = 'aquapilote.farm-journal.autoDone';
export const AUTO_ENABLED_KEY = 'aquapilote.farm-journal.auto';
export const JOURNAL_EVENT = 'aquapilote:farm-journal-updated';

export const isoDate = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};
export const frDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');

export const computeRange = (
  type: JournalPeriodType,
  ref: string,
  customStart: string,
  customEnd: string
) => {
  const base = new Date(`${ref}T00:00:00`);
  switch (type) {
    case 'day':
      return { start: isoDate(base), end: isoDate(base) };
    case 'week': {
      const day = (base.getDay() + 6) % 7;
      const start = new Date(base); start.setDate(base.getDate() - day);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { start: isoDate(start), end: isoDate(end) };
    }
    case 'month': {
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      return { start: isoDate(start), end: isoDate(end) };
    }
    case 'quarter': {
      const q = Math.floor(base.getMonth() / 3);
      const start = new Date(base.getFullYear(), q * 3, 1);
      const end = new Date(base.getFullYear(), q * 3 + 3, 0);
      return { start: isoDate(start), end: isoDate(end) };
    }
    case 'custom':
    default:
      return { start: customStart, end: customEnd };
  }
};

export const readHistory = (): JournalEntry[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

export const writeHistory = (entries: JournalEntry[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 40))); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(JOURNAL_EVENT));
};

export const markJournalsRead = () => {
  writeHistory(readHistory().map(e => ({ ...e, read: true })));
};

export const unreadJournals = () => readHistory().filter(e => e.auto && !e.read);

export const buildJournal = async (
  targetUnitId: string,
  targetUnitName: string,
  start: string,
  end: string,
  type: JournalPeriodType
): Promise<ReportData> => {
  const scoped = (q: any) => (targetUnitId === 'all' ? q : q.eq('unit_id', targetUnitId));

  const [feedingRes, healthRes, salesRes, cyclesRes, batchesRes] = await Promise.all([
    scoped(supabase.from('feeding_records').select('*').gte('date', start).lte('date', end)),
    scoped(supabase.from('health_records').select('*').gte('date', start).lte('date', end)),
    scoped(supabase.from('sales').select('*').gte('date', start).lte('date', end)),
    scoped(supabase.from('production_cycles').select('*')),
    supabase.from('livestock_batches').select('*'),
  ]);

  const feeding = (feedingRes as any).data ?? [];
  const health = (healthRes as any).data ?? [];
  const sales = (salesRes as any).data ?? [];
  const cycles = ((cyclesRes as any).data ?? []).filter((c: any) => c.status === 'active');
  const batches = ((batchesRes as any).data ?? []).filter(
    (b: any) => targetUnitId === 'all' || b.unit_id === targetUnitId
  );

  const totalFeed = feeding.reduce((s: number, f: any) => s + (Number(f.quantity) || 0), 0);
  const mortality =
    feeding.reduce((s: number, f: any) => s + (Number(f.mortality) || 0), 0) +
    health.reduce((s: number, h: any) => s + (Number(h.mortality) || 0), 0);
  const revenue = sales.reduce((s: number, v: any) => s + (Number(v.total_amount) || 0), 0);
  const stock = batches.reduce((s: number, b: any) => s + (Number(b.quantity) || 0), 0);
  const biomass = batches.reduce((s: number, b: any) => s + (Number(b.total_weight) || 0), 0);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const sections: ReportData['sections'] = [
    {
      title: '📌 Résumé de la période',
      type: 'summary',
      summary: [
        { label: 'Unité', value: targetUnitName },
        { label: 'Période', value: start === end ? frDate(start) : `${frDate(start)} → ${frDate(end)}` },
        { label: 'Cycles actifs', value: cycles.length },
        { label: 'Effectif en stock', value: stock.toLocaleString('fr-FR') },
        { label: 'Biomasse (kg)', value: biomass.toFixed(1) },
        { label: 'Aliment distribué (kg)', value: totalFeed.toFixed(2) },
        { label: 'Mortalités déclarées', value: mortality },
        { label: 'Ventes (montant)', value: revenue.toLocaleString('fr-FR') },
      ],
    },
    {
      title: '🍽️ Alimentation',
      type: 'table',
      headers: ['Date', 'Séance', 'Aliment', 'Quantité (kg)', 'Responsable', 'Notes'],
      rows: feeding.map((f: any) => [
        frDate(f.date), f.session_type || '-', f.feed_type || '-',
        String(f.quantity ?? 0), f.feeder_name || '-', f.notes || '-',
      ]),
    },
    {
      title: "🩺 Suivi sanitaire & qualité de l'eau",
      type: 'table',
      headers: ['Date', 'Température', 'pH', 'Oxygène', 'Mortalité', 'Poids moyen', 'Notes'],
      rows: health.map((h: any) => [
        frDate(h.date), String(h.temperature ?? '-'), String(h.ph ?? '-'), String(h.oxygen ?? '-'),
        String(h.mortality ?? 0), String(h.average_weight ?? '-'), h.notes || '-',
      ]),
    },
    {
      title: '💰 Ventes',
      type: 'table',
      headers: ['Date', 'Document', 'Client', 'Montant', 'Statut'],
      rows: sales.map((v: any) => [
        frDate(v.date), v.document_number || v.document_type, v.client_name,
        String(v.total_amount ?? 0), v.status,
      ]),
    },
    {
      title: '🐟 Cheptel et cycles',
      type: 'table',
      headers: ['Cycle / Lot', 'Espèce', 'Quantité', 'Poids moyen (g)', 'Statut'],
      rows: [
        ...cycles.map((c: any) => [c.name, c.species || '-', String(c.current_quantity ?? 0), '-', c.status]),
        ...batches.map((b: any) => [
          b.batch_number || b.species, b.species, String(b.quantity ?? 0),
          String(b.average_weight ?? '-'), b.status,
        ]),
      ],
    },
  ];

  if (health.length) {
    sections.push({
      title: '📈 Moyennes de la période',
      type: 'summary',
      summary: [
        { label: 'Température moyenne', value: avg(health.map((h: any) => Number(h.temperature) || 0)).toFixed(1) },
        { label: 'pH moyen', value: avg(health.map((h: any) => Number(h.ph) || 0)).toFixed(2) },
        { label: 'Oxygène moyen', value: avg(health.map((h: any) => Number(h.oxygen) || 0)).toFixed(2) },
      ],
    });
  }

  return {
    title: `Journal de ferme — ${PERIOD_LABELS[type]}`,
    period: start === end ? frDate(start) : `${frDate(start)} au ${frDate(end)}`,
    generatedAt: new Date().toLocaleString('fr-FR'),
    unitName: targetUnitName,
    sections,
  };
};

export const notifyJournalReady = async (userId: string, unitName: string, period: string) => {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Journal de ferme prêt',
      message: `${unitName} — ${period} : le journal quotidien est disponible dans le module Journal de ferme.`,
      type: 'success',
      module: 'reports',
      is_critical: false,
    } as any);
  } catch (e) {
    console.warn('Notification journal non enregistrée', e);
  }
};

/**
 * Génère (une seule fois) le journal quotidien de chaque unité pour la date donnée.
 * Retourne les journaux créés.
 */
export const generateDailyJournals = async (
  units: Array<{ id: string; name: string }>,
  userId: string,
  date: string
): Promise<JournalEntry[]> => {
  const existing = readHistory();
  const created: JournalEntry[] = [];
  const targets = units.length > 0 ? units : [{ id: 'all', name: 'Toutes les unités' }];

  for (const unit of targets) {
    const already = existing.some(e => e.auto && e.periodType === 'day' && e.start === date && e.unitId === unit.id);
    if (already) continue;
    try {
      const data = await buildJournal(unit.id, unit.name, date, date, 'day');
      created.push({
        id: `${date}-${unit.id}`,
        unitId: unit.id,
        unitName: unit.name,
        periodType: 'day',
        start: date,
        end: date,
        generatedAt: new Date().toLocaleString('fr-FR'),
        auto: true,
        read: false,
        data,
      });
    } catch (e) {
      console.error('Échec de génération du journal quotidien', unit.name, e);
    }
  }

  if (created.length > 0) {
    writeHistory([...created, ...existing]);
    await notifyJournalReady(
      userId,
      created.length > 1 ? `${created.length} unités` : created[0].unitName,
      frDate(date)
    );
  }
  return created;
};
