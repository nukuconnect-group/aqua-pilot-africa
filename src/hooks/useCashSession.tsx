import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';

export interface CashSession {
  id: string;
  user_id: string;
  unit_id: string;
  opened_at: string;
  opening_amount: number;
  closed_at: string | null;
  expected_amount: number | null;
  counted_amount: number | null;
  difference: number | null;
  status: 'open' | 'closed';
}

export interface CashMovement {
  id: string;
  session_id: string;
  type: 'sale' | 'cash_in' | 'cash_out';
  amount: number;
  payment_method: string;
  label: string | null;
  sale_id: string | null;
  created_at: string;
}

const isMissingTable = (err: any) =>
  !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message || ''));

/** Calcule le montant d'espèces attendu dans le tiroir. */
export const computeExpectedCash = (opening: number, movements: Pick<CashMovement, 'type' | 'amount' | 'payment_method'>[]) =>
  movements.reduce((sum, m) => {
    if (m.type === 'cash_out') return m.payment_method === 'Espèces' ? sum - m.amount : sum;
    if (m.type === 'sale' && m.payment_method !== 'Espèces') return sum;
    return sum + m.amount;
  }, opening);

export const useCashSession = (unitId?: string, ownerId?: string) => {
  const { user } = useAuth();
  const [session, setSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [notInstalled, setNotInstalled] = useState(false);
  const db = supabase as any;

  const load = useCallback(async () => {
    if (!user?.id || !unitId) return;
    setLoading(true);
    const { data, error } = await db
      .from('cash_sessions').select('*').eq('unit_id', unitId)
      .order('opened_at', { ascending: false }).limit(20);
    if (error) {
      setNotInstalled(isMissingTable(error));
      setLoading(false);
      return;
    }
    setNotInstalled(false);
    const open = (data || []).find((s: CashSession) => s.status === 'open') || null;
    setSession(open);
    setHistory((data || []).filter((s: CashSession) => s.status === 'closed'));
    if (open) {
      const { data: mv } = await db.from('cash_movements').select('*')
        .eq('session_id', open.id).order('created_at', { ascending: false });
      setMovements((mv || []).map((m: any) => ({ ...m, amount: Number(m.amount) })));
    } else setMovements([]);
    setLoading(false);
  }, [user?.id, unitId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.id || !unitId || notInstalled) return;
    const ch = supabase.channel(`cash-${unitId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions', filter: `unit_id=eq.${unitId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `unit_id=eq.${unitId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, unitId, notInstalled, load]);

  const owner = ownerId || user?.id;

  const openSession = async (openingAmount: number) => {
    if (!owner || !unitId) return { error: 'Aucune unité active' };
    const { error } = await db.from('cash_sessions').insert({ user_id: owner, unit_id: unitId, opening_amount: openingAmount });
    if (error) return { error: error.message };
    await load();
    return {};
  };

  const addMovement = async (m: { type: CashMovement['type']; amount: number; payment_method?: string; label?: string; sale_id?: string }) => {
    if (!session || !owner || !unitId) return { error: 'Caisse fermée' };
    const { error } = await db.from('cash_movements').insert({
      session_id: session.id, user_id: owner, unit_id: unitId,
      type: m.type, amount: m.amount, payment_method: m.payment_method || 'Espèces',
      label: m.label || null, sale_id: m.sale_id || null,
    });
    if (error) return { error: error.message };
    await load();
    return {};
  };

  const expected = useMemo(
    () => (session ? computeExpectedCash(Number(session.opening_amount), movements) : 0),
    [session, movements],
  );

  const closeSession = async (countedAmount: number) => {
    if (!session) return { error: 'Aucune caisse ouverte' };
    const { error } = await db.from('cash_sessions').update({
      status: 'closed', closed_at: new Date().toISOString(),
      expected_amount: expected, counted_amount: countedAmount, difference: countedAmount - expected,
    }).eq('id', session.id);
    if (error) return { error: error.message };
    await load();
    return {};
  };

  return { session, movements, history, loading, notInstalled, expected, openSession, addMovement, closeSession, reload: load };
};
