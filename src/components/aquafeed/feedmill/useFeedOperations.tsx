import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { toast } from '@/hooks/use-toast';

export interface QualityControl {
  id: string;
  control_date: string;
  control_type: string;
  item_name: string;
  batch_number?: string | null;
  supplier?: string | null;
  responsible?: string | null;
  status: string;
  anomaly?: string | null;
  corrective_action?: string | null;
  parameters?: any;
  notes?: string | null;
  unit_id?: string | null;
}

export interface FeedProductionCycle {
  id: string;
  name: string;
  formulation_name?: string | null;
  batch_number?: string | null;
  start_date: string;
  end_date?: string | null;
  planned_quantity_kg: number;
  produced_quantity_kg: number;
  loss_kg: number;
  total_cost: number;
  cost_per_kg: number;
  status: string;
  notes?: string | null;
  unit_id?: string | null;
}

export interface TraceabilityRecord {
  id: string;
  batch_number: string;
  product_type: string;
  product_name?: string | null;
  entry_date: string;
  quantity: number;
  unit_label: string;
  origin?: string | null;
  destination?: string | null;
  state: string;
  notes?: string | null;
  unit_id?: string | null;
}

const LOCAL_PREFIX = 'aquafeed-ops-';

const readLocal = <T,>(table: string): T[] => {
  try { return JSON.parse(localStorage.getItem(LOCAL_PREFIX + table) || '[]'); } catch { return []; }
};
const writeLocal = <T,>(table: string, rows: T[]) => {
  try { localStorage.setItem(LOCAL_PREFIX + table, JSON.stringify(rows)); } catch { /* ignore */ }
};

/** CRUD partagé pour contrôles qualité, cycles de fabrication et traçabilité. */
export function useFeedOperations() {
  const { user } = useAuth();
  const { activeUnit } = useProductionUnits();
  const [controls, setControls] = useState<QualityControl[]>([]);
  const [cycles, setCycles] = useState<FeedProductionCycle[]>([]);
  const [traces, setTraces] = useState<TraceabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTable = useCallback(async (table: string, orderCol: string) => {
    if (!user?.id) return readLocal<any>(table);
    try {
      let query = (supabase as any).from(table).select('*').order(orderCol, { ascending: false });
      if (activeUnit?.id) query = query.eq('unit_id', activeUnit.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    } catch {
      return readLocal<any>(table);
    }
  }, [user?.id, activeUnit?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p, t] = await Promise.all([
      fetchTable('feed_quality_controls', 'control_date'),
      fetchTable('feed_production_cycles', 'start_date'),
      fetchTable('traceability_records', 'entry_date'),
    ]);
    setControls(c);
    setCycles(p);
    setTraces(t);
    setLoading(false);
  }, [fetchTable]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (table: string, payload: any) => {
    const row = { ...payload, unit_id: payload.unit_id ?? activeUnit?.id ?? null };
    if (user?.id) {
      try {
        const body = { ...row, user_id: user.id };
        const { data, error } = row.id
          ? await (supabase as any).from(table).update(body).eq('id', row.id).select().single()
          : await (supabase as any).from(table).insert(body).select().single();
        if (error) throw error;
        await load();
        toast({ title: 'Enregistré' });
        return data;
      } catch (e: any) {
        // Repli local si la table est indisponible.
        console.warn(`Sauvegarde ${table} en local:`, e?.message);
      }
    }
    const rows = readLocal<any>(table);
    const saved = row.id
      ? rows.map(r => (r.id === row.id ? { ...r, ...row } : r))
      : [{ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...rows];
    writeLocal(table, saved);
    await load();
    toast({ title: 'Enregistré' });
    return saved[0];
  }, [activeUnit?.id, load, user?.id]);

  const remove = useCallback(async (table: string, id: string) => {
    if (user?.id) {
      try {
        const { error } = await (supabase as any).from(table).delete().eq('id', id);
        if (error) throw error;
        await load();
        return;
      } catch { /* repli */ }
    }
    writeLocal(table, readLocal<any>(table).filter(r => r.id !== id));
    await load();
  }, [load, user?.id]);

  return {
    loading,
    controls,
    cycles,
    traces,
    reload: load,
    saveControl: (p: any) => save('feed_quality_controls', p),
    deleteControl: (id: string) => remove('feed_quality_controls', id),
    saveCycle: (p: any) => save('feed_production_cycles', p),
    deleteCycle: (id: string) => remove('feed_production_cycles', id),
    saveTrace: (p: any) => save('traceability_records', p),
    deleteTrace: (id: string) => remove('traceability_records', id),
  };
}

export default useFeedOperations;
