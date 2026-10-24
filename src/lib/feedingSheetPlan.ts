/**
 * Plan de nourrissage d'une fiche (une seule infrastructure) :
 * heure et quantité à servir pour le matin, le midi et le soir.
 *
 * La base de l'application ne possède que les champs historiques
 * (period, time, quantity, observations). Le plan détaillé est donc
 * conservé dans un repère lisible en fin des observations, retiré à l'affichage.
 */
import { PERIOD_ORDER, type PeriodTime } from './feedingSheetUtils';

export type Period = PeriodTime['period'];
export interface PeriodPlan { period: Period; time: string; quantity: number }

const MARKER = /\n?\[\[plan-nourrissage:(\{.*?\})\]\]\s*$/s;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const PERIOD_LABELS: Record<Period, string> = { matin: 'Matin', midi: 'Midi', soir: 'Soir' };

export function cleanObservations(observations?: string | null): string {
  return String(observations || '').replace(MARKER, '').trim();
}

/** Plan normalisé : repère enregistré, sinon period_times, sinon période/heure/quantité historiques. */
export function readSheetPlan(sheet: {
  observations?: string | null; period_times?: unknown; period?: string | null; time?: string | null; quantity?: number | null;
}): PeriodPlan[] {
  const fallbackQty = Math.max(0, Number(sheet.quantity) || 0);
  const fromList = (raw: unknown, defaultQty: number): PeriodPlan[] => {
    if (!Array.isArray(raw)) return [];
    const items = raw.map((p: any) => ({
      period: String(p?.period || '').toLowerCase() as Period,
      time: String(p?.time || '').slice(0, 5),
      quantity: p?.quantity === undefined ? defaultQty : Math.max(0, Number(p.quantity) || 0),
    })).filter(p => PERIOD_ORDER.includes(p.period) && TIME.test(p.time));
    return PERIOD_ORDER.flatMap(period => items.filter(p => p.period === period).slice(0, 1));
  };
  const match = String(sheet.observations || '').match(MARKER);
  if (match) {
    try {
      const parsed = fromList(JSON.parse(match[1]).periods, 0);
      if (parsed.length) return parsed;
    } catch { /* repère illisible : repli sur les champs historiques */ }
  }
  const listed = fromList(sheet.period_times, fallbackQty);
  if (listed.length) return listed;
  const legacy = String(sheet.period || 'matin').toLowerCase() as Period;
  const time = String(sheet.time || '07:00').slice(0, 5);
  return [{ period: PERIOD_ORDER.includes(legacy) ? legacy : 'matin', time: TIME.test(time) ? time : '07:00', quantity: fallbackQty }];
}

/** Vérifie le plan saisi : au moins une période, heures valides et quantités positives. */
export function validatePlan(plan: PeriodPlan[]): PeriodPlan[] {
  if (!plan.length) throw new Error('Activez au moins une période de nourrissage (matin, midi ou soir).');
  for (const p of plan) {
    if (!TIME.test(p.time)) throw new Error(`Heure invalide pour la période ${PERIOD_LABELS[p.period].toLowerCase()}.`);
    if (!(Number(p.quantity) > 0)) throw new Error(`Indiquez la quantité à servir le ${PERIOD_LABELS[p.period].toLowerCase()}.`);
  }
  return PERIOD_ORDER.flatMap(period => plan.filter(p => p.period === period).slice(0, 1));
}

export const planTotal = (plan: PeriodPlan[]) => Math.round(plan.reduce((s, p) => s + (Number(p.quantity) || 0), 0) * 1000) / 1000;

/** Champs à enregistrer, compatibles avec la base existante. */
export function buildSheetFields(plan: PeriodPlan[], observations?: string | null) {
  const valid = validatePlan(plan);
  const notes = cleanObservations(observations);
  const marker = `[[plan-nourrissage:${JSON.stringify({ periods: valid })}]]`;
  return {
    period: valid[0].period,
    time: valid[0].time,
    quantity: planTotal(valid),
    observations: notes ? `${notes}\n${marker}` : marker,
  };
}

interface SheetLike {
  id: string; title: string; is_active: boolean; infrastructure_id?: string | null; infrastructure_ids?: unknown;
  start_date?: string | null; end_date?: string | null;
}

const sheetInfra = (s: SheetLike): string[] => {
  const ids = Array.isArray(s.infrastructure_ids) ? (s.infrastructure_ids as unknown[]).filter((v): v is string => typeof v === 'string' && !!v) : [];
  return ids.length ? ids : (s.infrastructure_id ? [s.infrastructure_id] : []);
};

/**
 * Une infrastructure ne peut figurer que sur une seule fiche active à la fois.
 * Retourne la fiche active qui l'utilise déjà (hors fiche modifiée), si elle couvre la date de début.
 */
export function findInfrastructureConflict(sheets: SheetLike[], infrastructureId: string, startDate: string, excludeId?: string | null): SheetLike | null {
  return sheets.find(s => s.id !== excludeId && s.is_active && sheetInfra(s).includes(infrastructureId) &&
    (!s.end_date || s.end_date >= startDate)) || null;
}

/** Répartition FIFO d'un prélèvement : la quantité servie est consommée d'abord, le reste revient au stock. */
export function allocateFeeding(stocks: Array<{ id: string; quantity: number }>, taken: number, served: number) {
  let outstanding = taken; let toConsume = served;
  const parts: Array<{ id: string; before: number; taken: number; consumed: number; returned: number }> = [];
  for (const st of stocks) {
    if (outstanding <= 0) break;
    const before = Math.max(0, Number(st.quantity) || 0);
    const part = Math.min(before, outstanding);
    if (part <= 0) continue;
    const consumed = Math.min(part, toConsume);
    parts.push({ id: st.id, before, taken: part, consumed, returned: Math.round((part - consumed) * 1e6) / 1e6 });
    outstanding = Math.round((outstanding - part) * 1e6) / 1e6; toConsume = Math.round((toConsume - consumed) * 1e6) / 1e6;
  }
  if (outstanding > 0) throw new Error('Stock de production insuffisant pour ce prélèvement dans cette unité.');
  return parts;
}

/** Ligne d'une fiche journalière : prévue, puis complétée par le nourrissage réel s'il existe. */
export interface DailyRow {
  period: Period; plannedTime: string; actualTime: string; fish: string; prescribed: number;
  taken: string; served: string; remaining: string; mortality: string; behavior: string; notes: string;
}

const BEHAVIOR_LABELS: Record<string, string> = { normal: 'Bon appétit', faible: 'Appétit faible', refus: 'Refus de manger' };
export const behaviorLabel = (b?: string | null) => (b ? BEHAVIOR_LABELS[b] || b : '');

export function buildDailyRows(plan: PeriodPlan[], records: Array<any>, fishCount?: number): DailyRow[] {
  return plan.map(p => {
    const r = records.find(x => String(x.session_type || '').toLowerCase() === p.period);
    const served = r ? Number(r.actual_quantity ?? r.quantity) || 0 : null;
    const remaining = r ? Number(r.remaining_quantity) || 0 : null;
    const notes = r ? String(r.notes || '').replace(/\s*\[ref:[^\]]+\]/g, '').trim() : '';
    return {
      period: p.period, plannedTime: p.time, actualTime: r?.time ? String(r.time).slice(0, 5) : '',
      fish: fishCount !== undefined ? String(fishCount) : '', prescribed: p.quantity,
      taken: served !== null ? String(Math.round((served + (remaining || 0)) * 1000) / 1000) : '',
      served: served !== null ? String(served) : '', remaining: remaining !== null ? String(remaining) : '',
      mortality: r ? String(r.mortality ?? 0) : '', behavior: r ? behaviorLabel(r.behavior) : '', notes,
    };
  });
}
