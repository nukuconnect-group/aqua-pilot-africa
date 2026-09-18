import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { toast } from '@/hooks/use-toast';
import { DEFAULT_INGREDIENTS, IngredientInput } from '@/lib/feedFormulation';

export interface StoredIngredient extends IngredientInput {
  ash_pct: number;
  moisture_pct: number;
  stock_kg: number;
  supplier?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface StoredFormulation {
  id: string;
  name: string;
  species: string;
  stage: string;
  batch_size_kg: number;
  mode: string;
  targets: any;
  lines: any[];
  nutrition: any;
  total_cost: number;
  cost_per_kg: number;
  status: string;
  notes?: string | null;
  created_at: string;
  unit_id?: string | null;
}

export interface StoredBatch {
  id: string;
  batch_number: string;
  formulation_id: string | null;
  formulation_name: string;
  species: string | null;
  stage: string | null;
  quantity_kg: number;
  lines: any[];
  nutrition: any;
  total_cost: number;
  cost_per_kg: number;
  responsible: string | null;
  status: string;
  stock_transferred: boolean;
  raw_deducted: boolean;
  manufactured_at: string;
  notes?: string | null;
}

const db = supabase as any;

/* ------------------------------------------------------------------ */
/* Sauvegarde locale de secours                                        */
/* Les tables distantes peuvent être absentes : l'atelier reste alors   */
/* pleinement utilisable, les données sont conservées sur l'appareil.   */
/* ------------------------------------------------------------------ */
const LK = {
  ingredients: 'aquafeed-mill-ingredients-v1',
  formulations: 'aquafeed-mill-formulations-v1',
  batches: 'aquafeed-mill-batches-v1',
};

const readLocal = <T,>(key: string, fallback: T): T => {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};
const isMissingTable = (error: any) =>
  !!error && (error.code === 'PGRST205' || /schema cache|does not exist|not find the table/i.test(error.message ?? ''));

export function useFeedMill() {
  const { user } = useAuth();
  const { activeUnit } = useProductionUnits();
  const [ingredients, setIngredients] = useState<StoredIngredient[]>([]);
  const [formulations, setFormulations] = useState<StoredFormulation[]>([]);
  const [batches, setBatches] = useState<StoredBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [localMode, setLocalMode] = useState(false);

  const loadLocal = useCallback(() => {
    const ing = readLocal<StoredIngredient[]>(LK.ingredients, []);
    if (ing.length === 0) {
      const seeded = DEFAULT_INGREDIENTS.map((i: any) => normalizeIngredient({ ...i, id: i.id ?? crypto.randomUUID() }));
      writeLocal(LK.ingredients, seeded);
      setIngredients(seeded);
    } else {
      setIngredients(ing.map(normalizeIngredient));
    }
    setFormulations(readLocal<StoredFormulation[]>(LK.formulations, []));
    setBatches(readLocal<StoredBatch[]>(LK.batches, []));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [ing, form, bat] = await Promise.all([
      db.from('feed_ingredients').select('*').order('category').order('name'),
      db.from('feed_formulations').select('*').order('created_at', { ascending: false }),
      db.from('feed_manufacturing_batches').select('*').order('manufactured_at', { ascending: false }),
    ]);

    if (isMissingTable(ing.error) || isMissingTable(form.error) || isMissingTable(bat.error) || !user?.id) {
      setLocalMode(true);
      loadLocal();
      setLoading(false);
      return;
    }

    setLocalMode(false);
    setIngredients((ing.data ?? []).map(normalizeIngredient));
    setFormulations(form.data ?? []);
    setBatches(bat.data ?? []);
    setLoading(false);

    if ((ing.data ?? []).length === 0) {
      await seedLibrary(user.id, activeUnit?.id ?? null);
      const again = await db.from('feed_ingredients').select('*').order('category').order('name');
      setIngredients((again.data ?? []).map(normalizeIngredient));
    }
  }, [user?.id, activeUnit?.id, loadLocal]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ----------------------------- Ingrédients ----------------------------- */
  const saveIngredient = async (payload: Partial<StoredIngredient> & { id?: string }) => {
    if (localMode) {
      const row = normalizeIngredient({ ...payload, id: payload.id ?? crypto.randomUUID() });
      const next = payload.id
        ? ingredients.map(i => (i.id === payload.id ? row : i))
        : [...ingredients, row];
      writeLocal(LK.ingredients, next);
      setIngredients(next);
      return row;
    }
    if (!user?.id) return null;
    const body = { ...payload, user_id: user.id, unit_id: activeUnit?.id ?? null, updated_at: new Date().toISOString() };
    const res = payload.id
      ? await db.from('feed_ingredients').update(body).eq('id', payload.id).select().single()
      : await db.from('feed_ingredients').insert(body).select().single();
    if (res.error) {
      toast({ title: 'Erreur', description: res.error.message, variant: 'destructive' });
      return null;
    }
    await loadAll();
    return res.data;
  };

  const deleteIngredient = async (id: string) => {
    if (localMode) {
      const next = ingredients.filter(i => i.id !== id);
      writeLocal(LK.ingredients, next);
      setIngredients(next);
      return;
    }
    const { error } = await db.from('feed_ingredients').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  /* ---------------------------- Formulations ----------------------------- */
  const saveFormulation = async (payload: any) => {
    if (localMode) {
      const row: StoredFormulation = {
        id: payload.id ?? crypto.randomUUID(),
        name: payload.name, species: payload.species, stage: payload.stage,
        batch_size_kg: Number(payload.batch_size_kg || 0), mode: payload.mode ?? 'balanced',
        targets: payload.targets ?? {}, lines: payload.lines ?? [], nutrition: payload.nutrition ?? {},
        total_cost: Number(payload.total_cost || 0), cost_per_kg: Number(payload.cost_per_kg || 0),
        status: payload.status ?? 'active', notes: payload.notes ?? null,
        created_at: payload.created_at ?? new Date().toISOString(),
        unit_id: activeUnit?.id ?? null,
      };
      const next = payload.id
        ? formulations.map(f => (f.id === payload.id ? row : f))
        : [row, ...formulations];
      writeLocal(LK.formulations, next);
      setFormulations(next);
      return row;
    }
    if (!user?.id) return null;
    const body = { ...payload, user_id: user.id, unit_id: activeUnit?.id ?? null, updated_at: new Date().toISOString() };
    const res = payload.id
      ? await db.from('feed_formulations').update(body).eq('id', payload.id).select().single()
      : await db.from('feed_formulations').insert(body).select().single();
    if (res.error) {
      toast({ title: 'Erreur', description: res.error.message, variant: 'destructive' });
      return null;
    }
    await loadAll();
    return res.data as StoredFormulation;
  };

  const deleteFormulation = async (id: string) => {
    if (localMode) {
      const next = formulations.filter(f => f.id !== id);
      writeLocal(LK.formulations, next);
      setFormulations(next);
      return;
    }
    const { error } = await db.from('feed_formulations').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  const setFormulationStatus = async (id: string, status: string) => {
    if (localMode) {
      const next = formulations.map(f => (f.id === id ? { ...f, status } : f));
      writeLocal(LK.formulations, next);
      setFormulations(next);
      return;
    }
    const { error } = await db.from('feed_formulations').update({ status }).eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  /** Fabrication : crée le lot, déduit les matières premières, alimente le stock d'aliments. */
  const manufacture = async (opts: {
    formulation: StoredFormulation;
    quantityKg: number;
    responsible: string;
    deductRaw: boolean;
    transferStock: boolean;
    batchNumber: string;
    notes?: string;
  }) => {
    const { formulation, quantityKg, responsible, deductRaw, transferStock, batchNumber, notes } = opts;
    const ratio = formulation.batch_size_kg > 0 ? quantityKg / Number(formulation.batch_size_kg) : 1;
    const lines = (formulation.lines ?? []).map((l: any) => ({
      ...l,
      quantity_kg: Number((Number(l.quantity_kg) * ratio).toFixed(3)),
      cost: Number((Number(l.quantity_kg) * ratio * Number(l.price_per_kg || 0)).toFixed(2)),
    }));
    const totalCost = lines.reduce((s: number, l: any) => s + Number(l.cost || 0), 0);

    if (localMode) {
      const batch: StoredBatch = {
        id: crypto.randomUUID(),
        batch_number: batchNumber,
        formulation_id: formulation.id,
        formulation_name: formulation.name,
        species: formulation.species, stage: formulation.stage,
        quantity_kg: quantityKg, lines, nutrition: formulation.nutrition,
        total_cost: Number(totalCost.toFixed(2)),
        cost_per_kg: quantityKg > 0 ? Number((totalCost / quantityKg).toFixed(2)) : 0,
        responsible, status: 'produced',
        stock_transferred: false, raw_deducted: deductRaw,
        manufactured_at: new Date().toISOString(),
        notes: notes ?? null,
      };
      if (deductRaw) {
        const nextIng = ingredients.map(i => {
          const l = lines.find((x: any) => x.ingredient_id === i.id);
          return l ? { ...i, stock_kg: Math.max(0, Number(i.stock_kg || 0) - Number(l.quantity_kg || 0)) } : i;
        });
        writeLocal(LK.ingredients, nextIng);
        setIngredients(nextIng);
      }
      const nextBatches = [batch, ...batches];
      writeLocal(LK.batches, nextBatches);
      setBatches(nextBatches);
      return batch;
    }

    if (!user?.id) return null;
    const { data: batch, error } = await db.from('feed_manufacturing_batches').insert({
      user_id: user.id,
      unit_id: activeUnit?.id ?? null,
      formulation_id: formulation.id,
      formulation_name: formulation.name,
      batch_number: batchNumber,
      species: formulation.species,
      stage: formulation.stage,
      quantity_kg: quantityKg,
      lines,
      nutrition: formulation.nutrition,
      total_cost: Number(totalCost.toFixed(2)),
      cost_per_kg: quantityKg > 0 ? Number((totalCost / quantityKg).toFixed(2)) : 0,
      responsible,
      status: 'produced',
      stock_transferred: false,
      raw_deducted: false,
      notes: notes ?? null,
    }).select().single();

    if (error) {
      toast({ title: 'Fabrication impossible', description: error.message, variant: 'destructive' });
      return null;
    }

    let rawDeducted = false;
    if (deductRaw) {
      for (const l of lines) {
        const ing = ingredients.find(i => i.id === l.ingredient_id);
        if (!ing) continue;
        const newStock = Math.max(0, Number(ing.stock_kg || 0) - Number(l.quantity_kg || 0));
        await db.from('feed_ingredients').update({ stock_kg: newStock }).eq('id', ing.id);
      }
      rawDeducted = true;
    }

    let transferred = false;
    if (transferStock) {
      if (!activeUnit?.id) {
        toast({ title: 'Unité manquante', description: "Sélectionnez une unité de production pour transférer l'aliment vers le stock.", variant: 'destructive' });
      } else {
        const feedType = `${formulation.name}`;
        const existing = await db.from('feed_stocks').select('*')
          .eq('unit_id', activeUnit.id).eq('feed_type', feedType).maybeSingle();
        if (existing.data) {
          await db.from('feed_stocks').update({
            quantity: Number(existing.data.quantity || 0) + quantityKg,
            cost: Number(totalCost.toFixed(2)),
            protein_content: formulation.nutrition?.protein ?? null,
            fat_content: formulation.nutrition?.lipid ?? null,
          }).eq('id', existing.data.id);
        } else {
          await db.from('feed_stocks').insert({
            user_id: user.id,
            unit_id: activeUnit.id,
            feed_type: feedType,
            custom_name: `${formulation.name} (fabrication maison)`,
            quantity: quantityKg,
            unit: 'kg',
            cost: Number(totalCost.toFixed(2)),
            protein_content: formulation.nutrition?.protein ?? null,
            fat_content: formulation.nutrition?.lipid ?? null,
            supplier: 'Fabrication interne',
            notes: `Lot ${batchNumber}`,
          });
        }
        transferred = true;
      }
    }

    await db.from('feed_manufacturing_batches')
      .update({ stock_transferred: transferred, raw_deducted: rawDeducted })
      .eq('id', batch.id);

    await loadAll();
    return { ...batch, stock_transferred: transferred, raw_deducted: rawDeducted } as StoredBatch;
  };

  const deleteBatch = async (id: string) => {
    if (localMode) {
      const next = batches.filter(b => b.id !== id);
      writeLocal(LK.batches, next);
      setBatches(next);
      return;
    }
    const { error } = await db.from('feed_manufacturing_batches').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  return {
    ingredients, formulations, batches, loading, localMode,
    reload: loadAll,
    saveIngredient, deleteIngredient,
    saveFormulation, deleteFormulation, setFormulationStatus,
    manufacture, deleteBatch,
  };
}

function normalizeIngredient(r: any): StoredIngredient {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    price_per_kg: Number(r.price_per_kg || 0),
    protein_pct: Number(r.protein_pct || 0),
    lipid_pct: Number(r.lipid_pct || 0),
    fiber_pct: Number(r.fiber_pct || 0),
    energy_kcal_kg: Number(r.energy_kcal_kg || 0),
    calcium_pct: Number(r.calcium_pct || 0),
    phosphorus_pct: Number(r.phosphorus_pct || 0),
    ash_pct: Number(r.ash_pct || 0),
    moisture_pct: Number(r.moisture_pct || 0),
    min_inclusion_pct: Number(r.min_inclusion_pct || 0),
    max_inclusion_pct: Number(r.max_inclusion_pct ?? 100),
    stock_kg: Number(r.stock_kg || 0),
    supplier: r.supplier,
    notes: r.notes,
    is_active: r.is_active !== false,
  };
}

async function seedLibrary(userId: string, unitId: string | null) {
  const rows = DEFAULT_INGREDIENTS.map(i => ({ ...i, user_id: userId, unit_id: unitId }));
  const { error } = await db.from('feed_ingredients').insert(rows);
  if (error) console.warn('Amorçage bibliothèque ingrédients:', error.message);
}
