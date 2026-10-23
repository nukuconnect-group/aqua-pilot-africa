import { supabase } from '@/integrations/supabase/appClient';
import { movementLines, type TreasuryAccount } from '@/lib/treasury';

const db = supabase as any;
const norm = (v?: string | null) => (v || '').trim().toLowerCase();

/** Compte de trésorerie rattaché à une caisse de vente : même nom, sinon un compte caisse dont le nom contient « vente ». */
export const findRegisterAccount = (accounts: TreasuryAccount[], registerName?: string | null) =>
  accounts.find(a => a.kind === 'cash' && norm(a.name) === norm(registerName)) ||
  accounts.find(a => a.kind === 'cash' && norm(a.name).includes('vente')) || null;

/**
 * Inscrit l'encaissement espèces d'une vente dans la caisse de trésorerie rattachée.
 * Contrepartie 571 : la vente a déjà son écriture de règlement (débit 571), ce mouvement
 * ne fait que reclasser l'argent dans le compte précis de la caisse, sans doubler le chiffre d'affaires.
 * Idempotent : l'identifiant de la vente sert d'identifiant de mouvement.
 */
export async function postSaleToTreasury(unitId: string, sale: { id: string; totalAmount: number; paymentMethod?: string; documentNumber?: string; clientName?: string; date?: string }, registerName?: string | null) {
  if (!(sale.totalAmount > 0) || (sale.paymentMethod || 'Espèces') !== 'Espèces') return { status: 'skipped' as const };
  const { data: accounts } = await db.from('treasury_accounts').select('*').eq('unit_id', unitId);
  const account = findRegisterAccount(accounts || [], registerName);
  if (!account) return { status: 'no_account' as const };
  const { data: existing } = await db.from('treasury_movements').select('id').eq('request_id', sale.id).limit(1);
  if (existing?.length) return { status: 'ok' as const };
  const { error } = await db.from('treasury_movements').insert({
    request_id: sale.id, user_id: account.user_id, unit_id: unitId, kind: 'receipt', source_id: null, destination_id: account.id,
    amount: sale.totalAmount, date: sale.date || new Date().toISOString().slice(0, 10),
    label: `Vente ${sale.documentNumber || sale.clientName || ''} · ${sale.id}`.trim(), journal: 'CA',
    lines: movementLines('receipt', sale.totalAmount, undefined, account, '571'),
  });
  if (error) throw error;
  return { status: 'ok' as const, account };
}

/** À l'annulation : sortie inverse sur la même caisse de trésorerie (une seule fois). */
export async function reverseSaleInTreasury(unitId: string, saleId: string, reason: string) {
  const { data: rows } = await db.from('treasury_movements').select('*').eq('unit_id', unitId).eq('request_id', saleId).limit(1);
  const original = rows?.[0];
  if (!original) return { status: 'skipped' as const };
  const { data: done } = await db.from('treasury_movements').select('id').eq('unit_id', unitId).ilike('label', `Annulation vente%${saleId}%`).limit(1);
  if (done?.length) return { status: 'ok' as const };
  const { data: acc } = await db.from('treasury_accounts').select('*').eq('id', original.destination_id).single();
  if (!acc) return { status: 'skipped' as const };
  const { error } = await db.from('treasury_movements').insert({
    request_id: crypto.randomUUID(), user_id: acc.user_id, unit_id: unitId, kind: 'payment', source_id: acc.id, destination_id: null,
    amount: Number(original.amount), date: new Date().toISOString().slice(0, 10),
    label: `Annulation vente · ${reason} · ${saleId}`, journal: 'CA',
    lines: movementLines('payment', Number(original.amount), acc, undefined, '571'),
  });
  if (error) throw error;
  return { status: 'ok' as const };
}
