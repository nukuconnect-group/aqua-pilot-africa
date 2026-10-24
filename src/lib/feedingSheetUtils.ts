/**
 * Logique pure des fiches d'alimentation :
 * - plusieurs infrastructures par fiche (infrastructure_ids, repli sur infrastructure_id)
 * - plusieurs périodes de nourrissage avec heure par période (period_times)
 * - effectif de poissons par infrastructure (cycle actif)
 * - application de la mortalité aux lots et infrastructures
 */

export interface PeriodTime {
  period: 'matin' | 'midi' | 'soir';
  time: string;
}

export const PERIOD_ORDER: Array<PeriodTime['period']> = ['matin', 'midi', 'soir'];

export const DEFAULT_PERIOD_TIMES: PeriodTime[] = [{ period: 'matin', time: '07:00' }];

/** Normalise les périodes d'une fiche : period_times prioritaire, repli sur period/time. */
export function normalizePeriodTimes(sheet: {
  period_times?: unknown;
  period?: string | null;
  time?: string | null;
}): PeriodTime[] {
  const raw = sheet.period_times;
  if (Array.isArray(raw)) {
    const parsed = raw
      .map((p: any) => ({
        period: String(p?.period || '').toLowerCase() as PeriodTime['period'],
        time: String(p?.time || '').slice(0, 5),
      }))
      .filter((p) => PERIOD_ORDER.includes(p.period) && /^\d{2}:\d{2}$/.test(p.time));
    if (parsed.length) {
      return PERIOD_ORDER.flatMap((period) => parsed.filter((p) => p.period === period));
    }
  }
  const legacyPeriod = String(sheet.period || 'matin').toLowerCase() as PeriodTime['period'];
  const period = PERIOD_ORDER.includes(legacyPeriod) ? legacyPeriod : 'matin';
  const time = String(sheet.time || '07:00').slice(0, 5);
  return [{ period, time: /^\d{2}:\d{2}$/.test(time) ? time : '07:00' }];
}

/** Normalise les infrastructures d'une fiche : infrastructure_ids prioritaire, repli sur infrastructure_id. */
export function normalizeInfrastructureIds(sheet: {
  infrastructure_ids?: unknown;
  infrastructure_id?: string | null;
}): string[] {
  const raw = sheet.infrastructure_ids;
  if (Array.isArray(raw)) {
    const ids = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (ids.length) return Array.from(new Set(ids));
  }
  return sheet.infrastructure_id ? [sheet.infrastructure_id] : [];
}

interface UnitInfraLike {
  id: string;
  name: string;
}

interface CycleInfraLike {
  infrastructure_name: string;
  current_quantity?: number | null;
  livestock_batch_id?: string | null;
}

interface BatchLike {
  id: string;
  quantity: number;
  status?: string | null;
}

/**
 * Effectif actuel de poissons par infrastructure (clé = id de l'infrastructure d'unité).
 * Source : infrastructures rattachées aux cycles actifs, lot lié prioritaire,
 * sinon current_quantity de l'infrastructure de cycle.
 */
export function computeFishCounts(
  unitInfras: UnitInfraLike[],
  cycleInfras: CycleInfraLike[],
  batches: BatchLike[],
): Record<string, number> {
  const batchById = new Map(batches.map((b) => [b.id, b]));
  const counts: Record<string, number> = {};
  for (const infra of unitInfras) {
    const name = (infra.name || '').trim().toLowerCase();
    let total = 0;
    for (const ci of cycleInfras) {
      if ((ci.infrastructure_name || '').trim().toLowerCase() !== name) continue;
      const batch = ci.livestock_batch_id ? batchById.get(ci.livestock_batch_id) : undefined;
      if (batch && batch.status !== 'sold' && batch.status !== 'harvested') {
        total += Math.max(0, Number(batch.quantity) || 0);
      } else if (!batch) {
        total += Math.max(0, Number(ci.current_quantity) || 0);
      }
    }
    counts[infra.id] = total;
  }
  return counts;
}

/** Nouvel effectif après mortalité (jamais négatif). */
export function applyMortality(currentQuantity: number, mortality: number): number {
  const current = Math.max(0, Math.floor(Number(currentQuantity) || 0));
  const dead = Math.max(0, Math.floor(Number(mortality) || 0));
  return Math.max(0, current - dead);
}

/** Répartit une mortalité saisie sur plusieurs infrastructures (restant sur la dernière). */
export function splitMortality(total: number, parts: number): number[] {
  const dead = Math.max(0, Math.floor(Number(total) || 0));
  const n = Math.max(1, Math.floor(parts));
  const base = Math.floor(dead / n);
  const result = Array.from({ length: n }, () => base);
  result[n - 1] += dead - base * n;
  return result;
}

/** Détecte une erreur « colonne absente » de la base (schéma historique non mis à jour). */
export function isMissingColumnError(error: unknown, column: string): boolean {
  const message = String((error as any)?.message || (error as any)?.details || '').toLowerCase();
  const col = column.toLowerCase();
  return (
    message.includes(col) &&
    (message.includes('does not exist') ||
      message.includes('could not find') ||
      message.includes('schema cache') ||
      message.includes('undefined column'))
  );
}
