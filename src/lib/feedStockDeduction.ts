import { supabase } from '@/integrations/supabase/client';

/** Déduit la quantité distribuée du stock correspondant et enregistre la sortie. */
export async function deductFeedStock(unitId: string, feedType: string, qty: number, reason: string) {
  if (!(qty > 0) || !feedType) return { status: 'skipped' as const };
  const db = supabase as any;
  const { data: stocks } = await db.from('feed_stocks').select('*').eq('unit_id', unitId);
  const key = feedType.trim().toLowerCase();
  const s = (stocks || []).find((x: any) => [x.feed_type, x.custom_name].some((v: string) => (v || '').trim().toLowerCase() === key));
  if (!s) return { status: 'not_found' as const };
  if (Number(s.quantity) < qty) return { status: 'insufficient' as const, stock: s };
  const after = Number(s.quantity) - qty;
  const { error } = await db.from('feed_stocks').update({ quantity: after }).eq('id', s.id);
  if (error) throw error;
  await db.from('stock_movements').insert({ user_id: s.user_id, unit_id: unitId, stock_id: s.id, type: 'out', quantity: qty, quantity_after: after, reason });
  return { status: 'ok' as const, stock: s, after };
}
