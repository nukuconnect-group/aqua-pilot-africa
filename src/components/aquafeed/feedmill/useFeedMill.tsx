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

export function useFeedMill() {
  const { user } = useAuth();
  const { activeUnit } = useProductionUnits();
  const [ingredients, setIngredients] = useState<StoredIngredient[]>([]);
  const [formulations, setFormulations] = useState<StoredFormulation[]>([]);
  const [batches, setBatches] = useState<StoredBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const [ing, form, bat] = await Promise.all([
      db.from('feed_ingredients').select('*').order('category').order('name'),
      db.from('feed_formulations').select('*').order('created_at', { ascending: false }),
      db.from('feed_manufacturing_batches').select('*').order('manufactured_at', { ascending: false }),
    ]);
    setIngredients((ing.data ?? []).map(normalizeIngredient));
    setFormulations(form.data ?? []);
    setBatches(bat.data ?? []);
    setLoading(false);

    // Amorçage de la bibliothèque au premier usage
    if ((ing.data ?? []).length === 0) {
      await seedLibrary(user.id, activeUnit?.id ?? null);
      const again = await db.from('feed_ingredients').select('*').order('category').order('name');
      setIngredients((again.data ?? []).map(normalizeIngredient));
    }
  }, [user?.id, activeUnit?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveIngredient = async (payload: Partial<StoredIngredient> & { id?: string }) => {
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
    const { error } = await db.from('feed_ingredients').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  const saveFormulation = async (payload: any) => {
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
    const { error } = await db.from('feed_formulations').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  const setFormulationStatus = async (id: string, status: string) => {
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
    if (!user?.id) return null;
    const { formulation, quantityKg, responsible, deductRaw, transferStock, batchNumber, notes } = opts;
    const ratio = formulation.batch_size_kg > 0 ? quantityKg / Number(formulation.batch_size_kg) : 1;
    const lines = (formulation.lines ?? []).map((l: any) => ({
      ...l,
      quantity_kg: Number((Number(l.quantity_kg) * ratio).toFixed(3)),
      cost: Number((Number(l.quantity_kg) * ratio * Number(l.price_per_kg || 0)).toFixed(2)),
    }));
    const totalCost = lines.reduce((s: number, l: any) => s + Number(l.cost || 0), 0);

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
    const { error } = await db.from('feed_manufacturing_batches').delete().eq('id', id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else await loadAll();
  };

  return {
    ingredients, formulations, batches, loading,
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
