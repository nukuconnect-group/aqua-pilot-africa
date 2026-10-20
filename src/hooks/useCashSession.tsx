import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';

export interface CashSession {
  id: string;
  user_id: string;
  unit_id: string;
  name: string | null;
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
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loadedUnitId, setLoadedUnitId] = useState<string>();
  const requestId = useRef(0);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [notInstalled, setNotInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const db = supabase as any;

  const session = useMemo(
    () => loadedUnitId === unitId ? sessions.find((s) => s.id === activeSessionId) || sessions[0] || null : null,
    [sessions, activeSessionId, loadedUnitId, unitId],
  );

  const load = useCallback(async () => {
    if (!user?.id || !unitId) return;
    const request = ++requestId.current;
    setLoading(true);
    const { data, error: sessionError } = await db
      .from('cash_sessions').select('*').eq('unit_id', unitId)
      .order('opened_at', { ascending: false });
    if (request !== requestId.current) return;
    if (sessionError) {
      setNotInstalled(isMissingTable(sessionError));
      setError('Impossible de charger les caisses. Réessayez.');
      setSessions([]); setHistory([]); setMovements([]);
      setLoading(false);
      return;
    }
    setNotInstalled(false);
    setError(null);
    setLoadedUnitId(unitId);
    const open = (data || []).filter((s: CashSession) => s.status === 'open');
    setSessions(open);
    setHistory((data || []).filter((s: CashSession) => s.status === 'closed'));
    const { data: mv, error: movementError } = await db.from('cash_movements').select('*')
      .eq('unit_id', unitId).order('created_at', { ascending: false });
    if (request !== requestId.current) return;
    if (movementError) setError('Impossible de charger les mouvements des caisses. Réessayez.');
    setMovements((mv || []).map((m: any) => ({ ...m, amount: Number(m.amount) })));
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

  const openSession = async (openingAmount: number, name?: string) => {
    if (!owner || !unitId) return { error: 'Aucune unité active' };
    if (!Number.isFinite(openingAmount) || openingAmount < 0) return { error: 'Fond de caisse invalide' };
    const { data, error } = await db.from('cash_sessions')
      .insert({ user_id: owner, unit_id: unitId, opening_amount: openingAmount, name: name?.trim() || null })
      .select().single();
    if (error) return { error: error.message };
    if (data?.id) setActiveSessionId(data.id);
    await load();
    return {};
  };

  const addMovement = async (m: { type: CashMovement['type']; amount: number; payment_method?: string; label?: string; sale_id?: string }, sessionId = session?.id) => {
    if (!sessionId || !owner || !unitId) return { error: 'Caisse fermée' };
    const { data: current, error: checkError } = await db.from('cash_sessions').select('id, status')
      .eq('id', sessionId).eq('unit_id', unitId).single();
    if (checkError || current?.status !== 'open') return { error: 'Cette caisse est fermée ou indisponible' };
    if (m.sale_id) {
      const { data: existing, error: lookupError } = await db.from('cash_movements').select('id')
        .eq('sale_id', m.sale_id).eq('type', 'sale').eq('unit_id', unitId).limit(1);
      if (lookupError) return { error: lookupError.message };
      if (existing?.length) { await load(); return {}; }
    }
    const { error } = await db.from('cash_movements').insert({
      session_id: sessionId, user_id: owner, unit_id: unitId,
      type: m.type, amount: m.amount, payment_method: m.payment_method || 'Espèces',
      label: m.label || null, sale_id: m.sale_id || null,
    });
    if (error) return { error: error.message };
    await load();
    return {};
  };

  /** Transfert d'espèces de la caisse active vers une autre caisse ouverte (partiel ou total). */
  const transferTo = async (targetSessionId: string, amount: number) => {
    if (!session || !owner || !unitId) return { error: 'Caisse fermée' };
    const target = sessions.find((s) => s.id === targetSessionId);
    if (!target) return { error: 'Caisse de destination introuvable' };
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Montant invalide' };
    if (amount > expected) return { error: 'Montant supérieur aux espèces disponibles' };
    const label = `Transfert vers ${target.name || 'caisse'}`;
    const out = await db.from('cash_movements').insert({
      session_id: session.id, user_id: owner, unit_id: unitId,
      type: 'cash_out', amount, payment_method: 'Espèces', label,
    });
    if (out.error) return { error: out.error.message };
    const inn = await db.from('cash_movements').insert({
      session_id: target.id, user_id: owner, unit_id: unitId,
      type: 'cash_in', amount, payment_method: 'Espèces',
      label: `Transfert depuis ${session.name || 'caisse'}`,
    });
    if (inn.error) return { error: inn.error.message };
    await load();
    return {};
  };

  const sessionMovements = useMemo(() => session ? movements.filter(m => m.session_id === session.id) : [], [session, movements]);
  const expected = useMemo(
    () => (session ? computeExpectedCash(Number(session.opening_amount), sessionMovements) : 0),
    [session, sessionMovements],
  );

  const closeSession = async (countedAmount: number) => {
    if (!session) return { error: 'Aucune caisse ouverte' };
    const { error } = await db.from('cash_sessions').update({
      status: 'closed', closed_at: new Date().toISOString(),
      expected_amount: expected, counted_amount: countedAmount, difference: countedAmount - expected,
    }).eq('id', session.id);
    if (error) return { error: error.message };
    setActiveSessionId(null);
    await load();
    return {};
  };

  return {
    session, sessions: loadedUnitId === unitId ? sessions : [], movements: sessionMovements,
    allMovements: loadedUnitId === unitId ? movements : [], history: loadedUnitId === unitId ? history : [],
    loading, notInstalled, error, expected,
    openSession, addMovement, transferTo, closeSession, setActiveSession: setActiveSessionId, reload: load,
  };
};
