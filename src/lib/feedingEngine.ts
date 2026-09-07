import { supabase } from '@/integrations/supabase/appClient';

export interface FeedingRule {
  id: string;
  species_id: string;
  stage: 'alevin' | 'juvenile' | 'grossissement' | 'geniteur';
  weight_min_g: number;
  weight_max_g: number;
  feed_rate_pct: number;
  meals_per_day: number;
  optimal_temp_min: number | null;
  optimal_temp_max: number | null;
}

export interface FishSpecies {
  id: string;
  name: string;
  scientific_name: string | null;
  default_cycle_days: number | null;
  default_growth_rate: number | null;
  default_fcr?: number | null;
}

export interface FeedingResult {
  biomass_kg: number;
  stage: string;
  feed_rate_pct: number;
  daily_ration_kg: number;
  meals_per_day: number;
  ration_per_meal_kg: number;
  projected_final_weight_g: number;
  projected_total_feed_kg: number;
  growth_curve: Array<{ day: number; weight_g: number; biomass_kg: number; cumulative_feed_kg: number }>;
  rule_used: FeedingRule | null;
}

export interface AdvancedFeedingInput {
  fcr?: number | null;               // Indice de Conversion
  volume_m3?: number | null;
  surface_m2?: number | null;
  feed_price_per_kg?: number | null;
  sale_price_per_kg?: number | null;
  target_final_weight_g?: number | null; // poids commercial cible
  meal_distribution?: number[] | null;   // % par repas, doit sommer à 100
}

export interface AdvancedFeedingResult extends FeedingResult {
  fcr_used: number;
  expected_biomass_final_kg: number;
  expected_weight_gain_kg: number;
  expected_feed_from_fcr_kg: number;    // aliment nécessaire selon IC
  expected_cost: number;
  expected_revenue: number;
  expected_margin: number;
  density_kg_per_m3: number | null;
  density_fish_per_m2: number | null;
  meal_schedule: Array<{ meal: number; time: string; ration_kg: number; pct: number }>;
  warnings: string[];
}

const DEFAULT_MEAL_TIMES: Record<number, string[]> = {
  1: ['08:00'],
  2: ['08:00', '16:00'],
  3: ['07:00', '12:00', '17:00'],
  4: ['07:00', '11:00', '15:00', '19:00'],
  5: ['07:00', '10:00', '13:00', '16:00', '19:00'],
  6: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
};

// Seuils indicatifs de densité par type d'infrastructure (kg/m³ recommandé max)
export const DENSITY_LIMITS: Record<string, { max_kg_m3?: number; max_fish_m2?: number; label: string }> = {
  bassin: { max_kg_m3: 25, label: 'Bassin béton/PVC' },
  bassin_grossissement: { max_kg_m3: 25, label: 'Bassin béton/PVC' },
  bassin_incubation: { max_kg_m3: 15, label: 'Bassin incubation' },
  etang: { max_kg_m3: 8, max_fish_m2: 5, label: 'Étang de terre' },
  bac_hors_sol: { max_kg_m3: 30, label: 'Bac hors-sol' },
  barrage: { max_kg_m3: 5, max_fish_m2: 3, label: 'Barrage / retenue' },
  enclos: { max_kg_m3: 15, max_fish_m2: 8, label: 'Enclos / cage' },
  cage_flottante: { max_kg_m3: 20, label: 'Cage flottante' },
  autre: { label: 'Autre' },
};

export function computeAdvancedFeeding(params: {
  fishCount: number;
  avgWeightG: number;
  rules: FeedingRule[];
  species?: FishSpecies | null;
  cycleDays?: number;
  infraType?: string;
  advanced: AdvancedFeedingInput;
}): AdvancedFeedingResult {
  const base = computeFeeding(params);
  const { advanced, infraType, fishCount } = params;
  const warnings: string[] = [];

  const fcr = advanced.fcr && advanced.fcr > 0
    ? advanced.fcr
    : (params.species?.default_fcr ?? 1.5);

  const targetWeight = advanced.target_final_weight_g && advanced.target_final_weight_g > 0
    ? advanced.target_final_weight_g
    : base.projected_final_weight_g;

  const expected_biomass_final_kg = (fishCount * targetWeight) / 1000;
  const expected_weight_gain_kg = Math.max(0, expected_biomass_final_kg - base.biomass_kg);
  const expected_feed_from_fcr_kg = Math.round(expected_weight_gain_kg * fcr * 100) / 100;

  const feedPrice = advanced.feed_price_per_kg ?? 0;
  const salePrice = advanced.sale_price_per_kg ?? 0;
  const expected_cost = Math.round(expected_feed_from_fcr_kg * feedPrice);
  const expected_revenue = Math.round(expected_biomass_final_kg * salePrice);
  const expected_margin = expected_revenue - expected_cost;

  let density_kg_per_m3: number | null = null;
  let density_fish_per_m2: number | null = null;
  if (advanced.volume_m3 && advanced.volume_m3 > 0) {
    density_kg_per_m3 = Math.round((base.biomass_kg / advanced.volume_m3) * 100) / 100;
  }
  if (advanced.surface_m2 && advanced.surface_m2 > 0) {
    density_fish_per_m2 = Math.round((fishCount / advanced.surface_m2) * 100) / 100;
  }
  const limits = infraType ? DENSITY_LIMITS[infraType] : undefined;
  if (limits?.max_kg_m3 && density_kg_per_m3 && density_kg_per_m3 > limits.max_kg_m3) {
    warnings.push(`Densité biomasse (${density_kg_per_m3} kg/m³) supérieure au seuil recommandé pour ${limits.label} (${limits.max_kg_m3} kg/m³).`);
  }
  if (limits?.max_fish_m2 && density_fish_per_m2 && density_fish_per_m2 > limits.max_fish_m2) {
    warnings.push(`Densité (${density_fish_per_m2} poissons/m²) supérieure au seuil recommandé pour ${limits.label} (${limits.max_fish_m2}/m²).`);
  }
  if (fcr < 0.8 || fcr > 3) {
    warnings.push(`IC de ${fcr} inhabituel — vérifiez la valeur (typique aquaculture : 1.0 – 2.0).`);
  }

  // Répartition des repas
  const meals = base.meals_per_day;
  const distribution = advanced.meal_distribution && advanced.meal_distribution.length === meals
    ? advanced.meal_distribution
    : Array.from({ length: meals }, () => 100 / meals);
  const times = DEFAULT_MEAL_TIMES[meals] ?? Array.from({ length: meals }, (_, i) => `${String(7 + i * 3).padStart(2, '0')}:00`);
  const meal_schedule = distribution.map((pct, i) => ({
    meal: i + 1,
    time: times[i] ?? `Repas ${i + 1}`,
    pct: Math.round(pct * 10) / 10,
    ration_kg: Math.round(base.daily_ration_kg * (pct / 100) * 1000) / 1000,
  }));

  return {
    ...base,
    fcr_used: fcr,
    expected_biomass_final_kg: Math.round(expected_biomass_final_kg * 100) / 100,
    expected_weight_gain_kg: Math.round(expected_weight_gain_kg * 100) / 100,
    expected_feed_from_fcr_kg,
    expected_cost,
    expected_revenue,
    expected_margin,
    density_kg_per_m3,
    density_fish_per_m2,
    meal_schedule,
    warnings,
  };
}

const DEFAULT_FALLBACK = (avg: number) => {
  if (avg < 5) return { rate: 10, meals: 6, stage: 'alevin' };
  if (avg < 30) return { rate: 7, meals: 5, stage: 'alevin' };
  if (avg < 150) return { rate: 4, meals: 4, stage: 'juvenile' };
  if (avg < 500) return { rate: 3, meals: 3, stage: 'grossissement' };
  if (avg < 1200) return { rate: 2, meals: 3, stage: 'grossissement' };
  return { rate: 1.5, meals: 2, stage: 'geniteur' };
};

export async function loadSpecies(): Promise<FishSpecies[]> {
  const { data } = await supabase
    .from('fish_species')
    .select('id,name,scientific_name,default_cycle_days,default_growth_rate')
    .eq('is_active', true)
    .order('name');
  return (data ?? []) as FishSpecies[];
}

export async function loadRulesForSpecies(speciesId: string): Promise<FeedingRule[]> {
  const { data } = await supabase
    .from('feeding_rules')
    .select('*')
    .eq('species_id', speciesId)
    .order('weight_min_g');
  return (data ?? []) as FeedingRule[];
}

export function computeFeeding(params: {
  fishCount: number;
  avgWeightG: number;
  rules: FeedingRule[];
  species?: FishSpecies | null;
  cycleDays?: number;
}): FeedingResult {
  const { fishCount, avgWeightG, rules, species, cycleDays } = params;
  const biomass_kg = (fishCount * avgWeightG) / 1000;
  const matching = rules.find(r => avgWeightG >= r.weight_min_g && avgWeightG <= r.weight_max_g);
  const fb = DEFAULT_FALLBACK(avgWeightG);
  const feed_rate_pct = matching?.feed_rate_pct ?? fb.rate;
  const meals_per_day = matching?.meals_per_day ?? fb.meals;
  const stage = matching?.stage ?? fb.stage;
  const daily_ration_kg = biomass_kg * (feed_rate_pct / 100);
  const ration_per_meal_kg = daily_ration_kg / Math.max(1, meals_per_day);

  const days = cycleDays ?? species?.default_cycle_days ?? 180;
  const dailyGrowthRate = species?.default_growth_rate ?? 0.015;
  const curve: FeedingResult['growth_curve'] = [];
  let weight = avgWeightG;
  let cumFeed = 0;
  const step = Math.max(1, Math.round(days / 30));
  for (let d = 0; d <= days; d += step) {
    const bm = (fishCount * weight) / 1000;
    const rule = rules.find(r => weight >= r.weight_min_g && weight <= r.weight_max_g);
    const rate = rule?.feed_rate_pct ?? DEFAULT_FALLBACK(weight).rate;
    cumFeed += bm * (rate / 100) * step;
    curve.push({ day: d, weight_g: Math.round(weight), biomass_kg: Math.round(bm * 100) / 100, cumulative_feed_kg: Math.round(cumFeed * 100) / 100 });
    weight = weight * Math.pow(1 + dailyGrowthRate, step);
  }

  return {
    biomass_kg: Math.round(biomass_kg * 1000) / 1000,
    stage,
    feed_rate_pct,
    daily_ration_kg: Math.round(daily_ration_kg * 1000) / 1000,
    meals_per_day,
    ration_per_meal_kg: Math.round(ration_per_meal_kg * 1000) / 1000,
    projected_final_weight_g: Math.round(weight),
    projected_total_feed_kg: Math.round(cumFeed * 100) / 100,
    growth_curve: curve,
    rule_used: matching ?? null,
  };
}
