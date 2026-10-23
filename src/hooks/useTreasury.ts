import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { accountBalance, movementLines, type MovementKind, type TreasuryAccount, type TreasuryMovement } from '@/lib/treasury';

const db = supabase as any;
export function useTreasury(unitId?: string) {
  const [state, setState] = useState<{ unitId?: string; accounts: TreasuryAccount[]; movements: TreasuryMovement[] }>({ accounts: [], movements: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accounts = state.unitId === unitId ? state.accounts : [];
  const movements = state.unitId === unitId ? state.movements : [];
  const load = useCallback(async () => {
    if (!unitId) { setState({ accounts: [], movements: [] }); return; }
    setLoading(true);
    const [a, m] = await Promise.all([
      db.from('treasury_accounts').select('*').eq('unit_id', unitId).order('created_at'),
      db.from('treasury_movements').select('*').eq('unit_id', unitId).order('date', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    const failure = a.error || m.error;
    setError(failure ? 'Impossible de charger la trésorerie pour le moment. Réessayez dans un instant.' : null);
    setState({ unitId, accounts: (a.data || []).filter((x: any) => !x.archived_at), movements: (m.data || []).map((r: TreasuryMovement) => ({ ...r, amount: Number(r.amount) })) });
    setLoading(false);
  }, [unitId]);
  useEffect(() => { load(); }, [load]);
  const createAccount = async (input: { unitId?: string; name: string; kind: 'cash' | 'bank'; code: string; currency: string; opening: number; counterpart: string; date: string }) => {
    const target = input.unitId || unitId;
    if (!target) throw new Error('Sélectionnez une unité.');
    if (!input.name.trim() || !Number.isFinite(input.opening) || input.opening < 0) throw new Error('Nom ou fonds initiaux invalides.');
    const { error } = await db.rpc('create_treasury_account', {
      _unit_id: target, _name: input.name, _kind: input.kind, _code: input.code, _currency: input.currency,
      _opening: input.opening, _counterpart: input.counterpart, _date: input.date,
    });
    if (error) throw error;
    await load();
  };
  const recordMovement = async (input: { requestId: string; kind: MovementKind; sourceId: string; destinationId: string; amount: number; date: string; label: string; counterpart: string }) => {
    if (!unitId || !input.label.trim()) throw new Error('Unité et libellé obligatoires.');
    const source = accounts.find(a => a.id === input.sourceId);
    const destination = accounts.find(a => a.id === input.destinationId);
    const lines = movementLines(input.kind, input.amount, source, destination, input.counterpart);
    if (source && input.amount > accountBalance(source.id, movements)) throw new Error('Solde insuffisant sur le compte source.');
    const owner = source || destination;
    if (!owner || owner.unit_id !== unitId) throw new Error('Compte inaccessible.');
    const { error } = await db.from('treasury_movements').insert({
      request_id: input.requestId, user_id: owner.user_id, unit_id: unitId, kind: input.kind,
      source_id: input.kind === 'payment' || input.kind === 'transfer' ? input.sourceId : null,
      destination_id: input.kind === 'payment' ? null : input.destinationId,
      amount: input.amount, date: input.date, label: input.label.trim(), journal: owner.kind === 'cash' ? 'CA' : 'BQ', lines,
    });
    if (error) throw error;
    await load();
  };
  /** Suppression = archivage : le compte disparaît de la liste, ses mouvements et écritures restent dans l'historique. */
  const archiveAccount = async (id: string) => {
    const { error } = await db.from('treasury_accounts').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('unit_id', unitId);
    if (error) throw new Error(/archived_at|column|policy|permission/i.test(error.message) ? 'La suppression de comptes n’est pas encore activée sur le serveur (script docs/sql/treasury_archive.sql à exécuter).' : error.message);
    await load();
  };
  return { accounts, movements, error, loading, createAccount, archiveAccount, recordMovement, reload: load };
}