import { supabase } from '@/integrations/supabase/appClient';
import { getStockPurpose } from '@/lib/stockPurpose';

/**
 * Déduit la quantité distribuée du stock correspondant, enregistre la sortie
 * dans l'historique des mouvements et crée l'écriture comptable de la sortie
 * (débit 602 achats d'aliments / crédit 321 stock d'aliments) quand le coût
 * de l'article est connu.
 */
export async function deductFeedStock(unitId: string, feedType: string, qty: number, reason: string, stockId?: string) {
  if (!(qty > 0) || (!feedType && !stockId)) return { status: 'skipped' as const };
  const db = supabase as any;
  const { data: all } = await db.from('feed_stocks').select('*').eq('unit_id', unitId);
  // Nourrir les poissons ne prélève que le stock de production, jamais le stock commercial.
  const stocks = (all || []).filter((x: any) => getStockPurpose(x) === 'production');
  const key = feedType.trim().toLowerCase();
  const s = stockId
    ? stocks.find((x: any) => x.id === stockId)
    : stocks.find((x: any) => [x.feed_type, x.custom_name].some((v: string) => (v || '').trim().toLowerCase() === key));
  if (!s) return { status: 'not_found' as const };
  if (Number(s.quantity) < qty) return { status: 'insufficient' as const, stock: s };
  const after = Number(s.quantity) - qty;
  const { error } = await db.from('feed_stocks').update({ quantity: after }).eq('id', s.id);
  if (error) throw error;
  await db.from('stock_movements').insert({ user_id: s.user_id, unit_id: unitId, stock_id: s.id, type: 'out', quantity: qty, quantity_after: after, reason });

  // Écriture comptable de la sortie de stock (valeur = quantité × coût unitaire)
  const unitCost = Number(s.cost) || 0;
  const amount = +(qty * unitCost).toFixed(2);
  if (amount > 0) {
    await db.from('accounting_manual_entries').insert({
      user_id: s.user_id,
      unit_id: unitId,
      date: new Date().toISOString().split('T')[0],
      journal: 'OD',
      label: `Sortie de stock — ${s.custom_name || s.feed_type} (${reason})`,
      lines: [
        { account: '602', debit: amount, credit: 0 },
        { account: '321', debit: 0, credit: amount },
      ],
    });
  }
  return { status: 'ok' as const, stock: s, after, amount };
}
