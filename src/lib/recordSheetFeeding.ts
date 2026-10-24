/**
 * Enregistrement d'un nourrissage depuis une fiche, sur la base de l'application.
 * Utilise la fonction serveur record_sheet_feeding lorsqu'elle existe ; sinon, enchaîne
 * les écritures avec contrôles (stock relu, mise à jour conditionnelle, restauration en cas d'échec).
 */
import { allocateFeeding } from './feedingSheetPlan';
import { matchesFeedingStock } from './feedingDistribution';

export interface FeedingInput {
  sheet: { id: string; user_id: string; unit_id: string; title: string; feed_type: string; unit: string; responsible_name?: string | null };
  infrastructureId: string; infrastructureName: string; requestId: string;
  date: string; time: string; period: 'matin' | 'midi' | 'soir';
  prescribed: number; taken: number; served: number; mortality: number; behavior: string; notes: string;
}

export async function recordSheetFeeding(db: any, userId: string, input: FeedingInput): Promise<{ status: 'ok' | 'already_saved' }> {
  const { sheet } = input;
  const returned = Math.round((input.taken - input.served) * 1e6) / 1e6;
  const rpc = await db.rpc('record_sheet_feeding', {
    _sheet_id: sheet.id, _request_id: input.requestId, _date: input.date, _time: input.time, _period: input.period,
    _lines: [{ infrastructure_id: input.infrastructureId, taken: input.taken, served: input.served, returned, mortality: input.mortality }],
    _behavior: input.behavior, _notes: input.notes,
  });
  if (!rpc.error) return { status: rpc.data?.status === 'already_saved' ? 'already_saved' : 'ok' };
  if (rpc.error.code !== 'PGRST202' && rpc.error.code !== '42883') throw rpc.error;

  const ref = `[ref:${input.requestId}]`;
  const existing = await db.from('feeding_records').select('id').eq('unit_id', sheet.unit_id).like('notes', `%${ref}%`).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data?.length) return { status: 'already_saved' };

  // Stock de production relu au moment de l'enregistrement (ordre d'entrée).
  const { data: stockRows, error: stockError } = await db.from('feed_stocks').select('*').eq('unit_id', sheet.unit_id).order('created_at', { ascending: true });
  if (stockError) throw stockError;
  const matching = (stockRows || []).filter((s: any) => matchesFeedingStock(s, sheet.unit_id, sheet.feed_type) && s.unit === sheet.unit && Number(s.quantity) > 0);
  const parts = allocateFeeding(matching, input.taken, input.served);

  const applied: Array<{ id: string; before: number }> = [];
  const restore = async () => {
    for (const a of applied) await db.from('feed_stocks').update({ quantity: a.before }).eq('id', a.id).eq('unit_id', sheet.unit_id);
  };
  try {
    for (const p of parts) {
      const after = Math.round((p.before - p.consumed) * 1e6) / 1e6;
      if (p.consumed > 0) {
        const { data, error } = await db.from('feed_stocks').update({ quantity: after })
          .eq('id', p.id).eq('unit_id', sheet.unit_id).eq('quantity', p.before).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('Le stock vient d’être modifié par une autre saisie. Réessayez : votre saisie est conservée.');
        applied.push({ id: p.id, before: p.before });
      }
    }
    const label = `${input.period} ${input.time} — ${sheet.title} — ${input.infrastructureName}`;
    const movements = parts.flatMap(p => {
      const rows: any[] = [{ user_id: userId, unit_id: sheet.unit_id, stock_id: p.id, type: 'out', quantity: p.taken,
        quantity_after: Math.round((p.before - p.taken) * 1e6) / 1e6, reason: `Prélèvement nourrissage ${label} ${ref}` }];
      if (p.returned > 0) rows.push({ user_id: userId, unit_id: sheet.unit_id, stock_id: p.id, type: 'in', quantity: p.returned,
        quantity_after: Math.round((p.before - p.consumed) * 1e6) / 1e6, reason: `Retour non servi ${label} ${ref}` });
      return rows;
    });
    const mv = await db.from('stock_movements').insert(movements);
    if (mv.error) throw mv.error;

    const record = await db.from('feeding_records').insert([{
      user_id: userId, unit_id: sheet.unit_id, infrastructure_id: input.infrastructureId, date: input.date, time: input.time,
      feed_type: sheet.feed_type, quantity: input.served, session_type: input.period, feeder_name: sheet.responsible_name || null,
      prescribed_quantity: input.prescribed, actual_quantity: input.served, remaining_quantity: returned,
      mortality: input.mortality, behavior: input.behavior,
      notes: [`Prélevé ${input.taken} ${sheet.unit}`, input.notes, ref].filter(Boolean).join(' · '),
    }]);
    if (record.error) throw record.error;
  } catch (error) {
    await restore();
    throw error;
  }

  if (input.mortality > 0) await applyMortalityToInfrastructure(db, sheet.unit_id, input.infrastructureName, input.mortality);
  return { status: 'ok' };
}

/** Diminue les lots et effectifs des cycles actifs rattachés à l'infrastructure. */
async function applyMortalityToInfrastructure(db: any, unitId: string, infraName: string, mortality: number) {
  const { data: cycles } = await db.from('production_cycles').select('id').eq('unit_id', unitId).eq('status', 'active');
  const ids = (cycles || []).map((c: any) => c.id);
  if (!ids.length) return;
  const { data: cis } = await db.from('cycle_infrastructures').select('*').in('cycle_id', ids);
  let remaining = mortality;
  for (const ci of (cis || []).filter((c: any) => String(c.infrastructure_name || '').trim().toLowerCase() === infraName.trim().toLowerCase())) {
    if (remaining <= 0) break;
    let lost = Math.min(remaining, Math.max(0, Number(ci.current_quantity) || 0));
    if (ci.livestock_batch_id) {
      const { data: batch } = await db.from('livestock_batches').select('id,quantity,status').eq('id', ci.livestock_batch_id).maybeSingle();
      if (batch && batch.status !== 'sold' && batch.status !== 'harvested') {
        lost = Math.min(remaining, Math.max(0, Number(batch.quantity) || 0));
        await db.from('livestock_batches').update({ quantity: Math.max(0, Number(batch.quantity) - lost) }).eq('id', batch.id);
      }
    }
    if (lost > 0) await db.from('cycle_infrastructures').update({ current_quantity: Math.max(0, (Number(ci.current_quantity) || 0) - lost) }).eq('id', ci.id);
    remaining -= lost;
  }
}
