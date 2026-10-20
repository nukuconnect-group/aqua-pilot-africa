import { supabase } from '@/integrations/supabase/appClient';
import { COMMERCIAL_TAG, isMissingColumnError, toLegacyStockRow } from '@/lib/stockPurpose';

/** Référence unique écrite sur l'article pour empêcher un second transfert du même cycle. */
export type TransferKind = 'harvest' | 'fry';
export const harvestRef = (cycleId: string, kind: TransferKind = 'harvest') => kind === 'fry' ? `Alevins lot ${cycleId}` : `Récolte cycle ${cycleId}`;

export interface HarvestInput {
  cycleId: string;
  unitId: string;
  productName: string;
  quantity: number;
  unit: string;
  salePrice: number;
  costPerUnit?: number;
  kind?: TransferKind;
}

export const validateHarvest = (h: HarvestInput): string | null => {
  if (!h.unitId) return 'Sélectionnez une unité.';
  if (!h.productName.trim()) return 'Indiquez le nom du produit.';
  if (!Number.isFinite(h.quantity) || h.quantity <= 0) return 'La quantité récoltée doit être supérieure à zéro.';
  if (!Number.isFinite(h.salePrice) || h.salePrice < 0) return 'Prix de vente invalide.';
  return null;
};

export const isHarvestTransferred = async (cycleId: string, unitId: string, kind: TransferKind = 'harvest') => {
  const { data, error } = await (supabase as any).from('feed_stocks').select('id')
    .eq('unit_id', unitId).ilike('notes', `%${harvestRef(cycleId, kind)}%`).limit(1);
  if (error) throw error;
  return !!data?.length;
};

/** Verse la récolte d'un cycle dans le stock commercial de la même unité (une seule fois par cycle). */
export const transferHarvest = async (h: HarvestInput) => {
  const invalid = validateHarvest(h);
  if (invalid) throw new Error(invalid);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connectez-vous pour transférer la récolte.');
  if (await isHarvestTransferred(h.cycleId, h.unitId, h.kind)) throw new Error(h.kind === 'fry' ? 'Ces alevins ont déjà été transférés au stock commercial.' : 'La récolte de ce cycle a déjà été transférée au stock commercial.');
  const row: any = {
    user_id: user.id, unit_id: h.unitId, custom_name: h.productName.trim(), feed_type: h.kind === 'fry' ? 'alevins' : 'poisson_recolte',
    quantity: h.quantity, unit: h.unit, cost: h.costPerUnit ?? null, min_threshold: 0,
    stock_purpose: 'commercial', sale_price: h.salePrice || null,
    notes: harvestRef(h.cycleId, h.kind),
  };
  let { data, error } = await (supabase as any).from('feed_stocks').insert(row).select('id').single();
  if (isMissingColumnError(error)) {
    const legacy = toLegacyStockRow(row);
    ({ data, error } = await (supabase as any).from('feed_stocks').insert(legacy).select('id').single());
  }
  if (error) throw error;
  await (supabase as any).from('stock_movements').insert({
    user_id: user.id, unit_id: h.unitId, stock_id: data.id, type: 'in',
    quantity: h.quantity, quantity_after: h.quantity, reason: `${harvestRef(h.cycleId, h.kind)} — transfert vers ${COMMERCIAL_TAG.slice(1, -1).toLowerCase()}`,
  });
  return data.id as string;
};
