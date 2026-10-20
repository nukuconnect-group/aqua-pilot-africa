import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import type { Entry, EntryLine, JournalCode } from '@/lib/syscohada';

export interface EntryMark { id: string; entry_id: string; account: string; kind: 'lettrage' | 'rapprochement'; code: string | null }
export interface Closure { id: string; fiscal_year: number; result: number; closed_at: string }

const db = supabase as any;

export function useAccountingLedger(unitId?: string) {
  const [manual, setManual] = useState<Entry[]>([]);
  const [marks, setMarks] = useState<EntryMark[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setManual([]); setMarks([]); setClosures([]);
    if (!unitId) return;
    const [m, k, c, t] = await Promise.all([
      db.from('accounting_manual_entries').select('*').eq('unit_id', unitId).order('date'),
      db.from('accounting_entry_marks').select('*').eq('unit_id', unitId),
      db.from('accounting_closures').select('*').eq('unit_id', unitId).order('fiscal_year'),
      db.from('treasury_movements').select('*').eq('unit_id', unitId).order('date'),
    ]);
    setError(m.error?.message || k.error?.message || c.error?.message || t.error?.message || null);
    setManual([...((m.data || []).map((r: any) => ({ id: `md-${r.id}`, date: r.date, journal: r.journal as JournalCode, label: r.label, lines: r.lines as EntryLine[] }))),
      ...((t.data || []).map((r: any) => ({ id: `tr-${r.id}`, date: r.date, journal: r.journal as JournalCode, label: r.label, lines: r.lines as EntryLine[] }))),
    ]);
    setMarks(k.data || []);
    setClosures(c.data || []);
  }, [unitId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = async (e: { date: string; journal: 'AN' | 'OD' | 'CL'; label: string; lines: EntryLine[] }) => {
    const { error } = await db.from('accounting_manual_entries').insert({ unit_id: unitId, ...e });
    if (error) throw error; await load();
  };
  const deleteEntry = async (id: string) => {
    if (!id.startsWith('md-')) throw new Error('Une écriture de trésorerie ne peut pas être supprimée.');
    const { error } = await db.from('accounting_manual_entries').delete().eq('id', id.replace(/^md-/, ''));
    if (error) throw error; await load();
  };
  const toggleMark = async (entryId: string, account: string, kind: EntryMark['kind'], code?: string) => {
    const ex = marks.find((m) => m.entry_id === entryId && m.account === account && m.kind === kind);
    const { error } = ex
      ? await db.from('accounting_entry_marks').delete().eq('id', ex.id)
      : await db.from('accounting_entry_marks').insert({ unit_id: unitId, entry_id: entryId, account, kind, code: code || null });
    if (error) throw error; await load();
  };
  const closeYear = async (year: number, result: number, entry: Entry) => {
    await addEntry({ date: entry.date, journal: 'CL', label: entry.label, lines: entry.lines });
    const { error } = await db.from('accounting_closures').insert({ unit_id: unitId, fiscal_year: year, result });
    if (error) throw error; await load();
  };

  return { manual, marks, closures, error, addEntry, deleteEntry, toggleMark, closeYear };
}
