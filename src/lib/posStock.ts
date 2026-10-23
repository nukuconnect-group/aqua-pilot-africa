import { supabase } from '@/integrations/supabase/appClient';
import { isCommercialStock } from '@/lib/stockPurpose';
import { normalizeProductSearch, type PosLine, type PosProduct } from '@/lib/posCatalog';

/** Refuse un panier qui dépasse le stock commercial disponible. */
export const findStockShortage = (cart: PosLine[], catalog: PosProduct[]) => {
  for (const line of cart) {
    const product = catalog.find(p => p.key === normalizeProductSearch(line.name));
    if (product && product.quantity !== undefined && line.quantity > product.quantity) {
      return `Stock insuffisant pour ${product.name} : ${product.quantity} ${product.unit || ''} disponible(s).`;
    }
  }
  return null;
};

/** Répartit une quantité vendue sur les articles commerciaux portant ce nom. */
export const planDeduction = (qty: number, rows: { id: string; quantity: number }[]) => {
  const plan: { id: string; take: number; after: number }[] = [];
  let left = qty;
  for (const r of rows) {
    if (left <= 0) break;
    const take = Math.min(Number(r.quantity), left);
    if (take <= 0) continue;
    plan.push({ id: r.id, take, after: +(Number(r.quantity) - take).toFixed(4) });
    left = +(left - take).toFixed(4);
  }
  return { plan, missing: left > 0 ? left : 0 };
};

/** Calcule les articles de stock commercial à retirer pour un panier. */
export const planSaleStock = async (unitId: string, cart: PosLine[]) => {
  const { data: stocks, error } = await (supabase as any).from('feed_stocks').select('*').eq('unit_id', unitId);
  if (error) throw error;
  const out: { stock_id: string; quantity: number }[] = [];
  for (const line of cart) {
    const key = normalizeProductSearch(line.name);
    const rows = (stocks || []).filter((s: any) => isCommercialStock(s) && normalizeProductSearch(s.custom_name || s.feed_type) === key);
    for (const p of planDeduction(line.quantity, rows).plan) out.push({ stock_id: p.id, quantity: p.take });
  }
  return out;
};

/**
 * Encaissement + sortie de stock en une seule opération côté serveur.
 * Renvoie false si la fonction serveur n'existe pas (ancienne base) pour basculer sur l'ancien parcours.
 */
export const postSaleAtomically = async (unitId: string, saleId: string, sessionId: string, cart: PosLine[]) => {
  const stock = await planSaleStock(unitId, cart);
  const { error } = await (supabase as any).rpc('pos_post_sale', { _sale_id: saleId, _session_id: sessionId, _stock: stock });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return false;
    throw new Error(error.message);
  }
  return true;
};

/** Retire du stock commercial les quantités d'une vente en caisse (une seule fois par vente). */
export const deductSoldStock = async (unitId: string, saleId: string, cart: PosLine[]) => {
  const db = supabase as any;
  const reason = `Vente en caisse ${saleId}`;
  const { data: already } = await db.from('stock_movements').select('id').eq('unit_id', unitId).eq('reason', reason).limit(1);
  if (already?.length) return;
  const { data: stocks, error } = await db.from('feed_stocks').select('*').eq('unit_id', unitId);
  if (error) throw error;
  for (const line of cart) {
    const key = normalizeProductSearch(line.name);
    const rows = (stocks || []).filter((s: any) => isCommercialStock(s) && normalizeProductSearch(s.custom_name || s.feed_type) === key);
    if (!rows.length) continue; // article libre, hors stock
    const { plan } = planDeduction(line.quantity, rows);
    for (const p of plan) {
      const row = rows.find((r: any) => r.id === p.id);
      const { error: upErr } = await db.from('feed_stocks').update({ quantity: p.after }).eq('id', p.id).eq('unit_id', unitId);
      if (upErr) throw upErr;
      await db.from('stock_movements').insert({ user_id: row.user_id, unit_id: unitId, stock_id: p.id, type: 'out', quantity: p.take, quantity_after: p.after, reason });
    }
  }
};
