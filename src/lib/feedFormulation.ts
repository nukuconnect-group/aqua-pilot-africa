/**
 * Moteur de formulation d'aliments aquacoles — AquaFeed AI
 * Profils nutritionnels de référence, bibliothèque d'ingrédients par défaut
 * et optimiseur de mélange (coût minimum / équilibré / performance).
 */

export type FormulationMode = 'cost' | 'balanced' | 'performance';

export interface NutrientProfile {
  protein: number;      // %
  lipid: number;        // %
  fiber_max: number;    // %
  energy: number;       // kcal/kg
  calcium: number;      // %
  phosphorus: number;   // %
}

export interface SpeciesStage {
  key: string;
  label: string;
  weight_range: string;
  targets: NutrientProfile;
}

export interface SpeciesProfile {
  key: string;
  label: string;
  stages: SpeciesStage[];
}

const stage = (
  key: string, label: string, weight_range: string,
  protein: number, lipid: number, fiber_max: number, energy: number,
  calcium = 1.2, phosphorus = 0.8,
): SpeciesStage => ({ key, label, weight_range, targets: { protein, lipid, fiber_max, energy, calcium, phosphorus } });

export const SPECIES_PROFILES: SpeciesProfile[] = [
  {
    key: 'tilapia', label: 'Tilapia',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 40, 10, 5, 3200),
      stage('juvenile', 'Juvénile', '5 – 50 g', 35, 8, 6, 3000),
      stage('croissance', 'Croissance', '50 – 250 g', 32, 7, 7, 2900),
      stage('finition', 'Finition', '> 250 g', 28, 6, 8, 2800),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 35, 9, 6, 3000, 1.5, 1.0),
    ],
  },
  {
    key: 'clarias', label: 'Clarias / Poisson-chat africain',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 45, 12, 4, 3400),
      stage('juvenile', 'Juvénile', '5 – 100 g', 40, 10, 5, 3200),
      stage('croissance', 'Croissance', '100 – 500 g', 35, 9, 6, 3050),
      stage('finition', 'Finition', '> 500 g', 32, 8, 7, 2950),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 40, 10, 5, 3200, 1.5, 1.0),
    ],
  },
  {
    key: 'carpe', label: 'Carpe',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 38, 8, 5, 3000),
      stage('juvenile', 'Juvénile', '5 – 50 g', 33, 7, 6, 2900),
      stage('croissance', 'Croissance', '50 – 500 g', 30, 6, 8, 2800),
      stage('finition', 'Finition', '> 500 g', 27, 6, 9, 2700),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 33, 8, 6, 2900, 1.5, 1.0),
    ],
  },
  {
    key: 'truite', label: 'Truite',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 50, 16, 3, 4000),
      stage('juvenile', 'Juvénile', '5 – 50 g', 45, 18, 3, 4100),
      stage('croissance', 'Croissance', '50 – 300 g', 42, 20, 3, 4200),
      stage('finition', 'Finition', '> 300 g', 38, 22, 4, 4300),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 45, 18, 3, 4100, 1.6, 1.1),
    ],
  },
  {
    key: 'pangasius', label: 'Pangasius',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 40, 9, 5, 3100),
      stage('juvenile', 'Juvénile', '5 – 100 g', 32, 7, 6, 2950),
      stage('croissance', 'Croissance', '100 – 600 g', 28, 6, 8, 2850),
      stage('finition', 'Finition', '> 600 g', 26, 6, 9, 2800),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 34, 8, 6, 3000, 1.5, 1.0),
    ],
  },
  {
    key: 'saumon', label: 'Saumon',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 52, 18, 3, 4200),
      stage('juvenile', 'Juvénile', '5 – 100 g', 48, 22, 3, 4400),
      stage('croissance', 'Croissance', '100 g – 1 kg', 44, 26, 3, 4600),
      stage('finition', 'Finition', '> 1 kg', 40, 28, 4, 4700),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 46, 22, 3, 4400, 1.6, 1.1),
    ],
  },
  {
    key: 'bar', label: 'Bar (Loup)',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 52, 15, 3, 4000),
      stage('juvenile', 'Juvénile', '5 – 50 g', 48, 16, 3, 4100),
      stage('croissance', 'Croissance', '50 – 300 g', 45, 18, 4, 4200),
      stage('finition', 'Finition', '> 300 g', 42, 20, 4, 4250),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 48, 17, 3, 4100, 1.6, 1.1),
    ],
  },
  {
    key: 'dorade', label: 'Dorade',
    stages: [
      stage('alevin', 'Alevin', '0 – 5 g', 52, 15, 3, 4000),
      stage('juvenile', 'Juvénile', '5 – 50 g', 48, 16, 3, 4050),
      stage('croissance', 'Croissance', '50 – 300 g', 45, 18, 4, 4150),
      stage('finition', 'Finition', '> 300 g', 42, 19, 4, 4200),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 48, 17, 3, 4100, 1.6, 1.1),
    ],
  },
  {
    key: 'crevette', label: 'Crevettes',
    stages: [
      stage('alevin', 'Post-larve', 'PL', 45, 9, 4, 3400, 2.0, 1.4),
      stage('juvenile', 'Juvénile', '0,5 – 5 g', 40, 8, 4, 3300, 2.0, 1.4),
      stage('croissance', 'Croissance', '5 – 20 g', 35, 7, 5, 3200, 2.2, 1.5),
      stage('finition', 'Finition', '> 20 g', 32, 7, 5, 3150, 2.2, 1.5),
      stage('reproducteur', 'Reproducteur', 'Géniteurs', 45, 10, 4, 3400, 2.4, 1.6),
    ],
  },
  {
    key: 'autre', label: 'Autre espèce',
    stages: [
      stage('alevin', 'Alevin', '—', 42, 10, 5, 3200),
      stage('juvenile', 'Juvénile', '—', 36, 8, 6, 3050),
      stage('croissance', 'Croissance', '—', 32, 7, 7, 2950),
      stage('finition', 'Finition', '—', 28, 6, 8, 2850),
      stage('reproducteur', 'Reproducteur', '—', 36, 9, 6, 3050, 1.5, 1.0),
    ],
  },
];

export const INGREDIENT_CATEGORIES = [
  { key: 'proteine', label: 'Source protéique' },
  { key: 'energie', label: 'Source énergétique' },
  { key: 'huile', label: 'Huiles & lipides' },
  { key: 'mineraux', label: 'Vitamines & minéraux' },
  { key: 'additif', label: 'Additifs & prémix' },
  { key: 'liant', label: 'Liants' },
];

export interface IngredientInput {
  id: string;
  name: string;
  category: string;
  price_per_kg: number;
  protein_pct: number;
  lipid_pct: number;
  fiber_pct: number;
  energy_kcal_kg: number;
  calcium_pct: number;
  phosphorus_pct: number;
  ash_pct?: number;
  moisture_pct?: number;
  min_inclusion_pct: number;
  max_inclusion_pct: number;
  stock_kg?: number;
}

type DefaultIngredient = Omit<IngredientInput, 'id'> & { stock_kg: number };

const ing = (
  name: string, category: string, price: number, protein: number, lipid: number,
  fiber: number, energy: number, ca: number, p: number, maxInc: number, minInc = 0,
): DefaultIngredient => ({
  name, category, price_per_kg: price, protein_pct: protein, lipid_pct: lipid,
  fiber_pct: fiber, energy_kcal_kg: energy, calcium_pct: ca, phosphorus_pct: p,
  ash_pct: 0, moisture_pct: 10, min_inclusion_pct: minInc, max_inclusion_pct: maxInc, stock_kg: 0,
});

/** Bibliothèque de démarrage (prix indicatifs en devise locale, modifiables). */
export const DEFAULT_INGREDIENTS: DefaultIngredient[] = [
  // Protéines
  ing('Farine de poisson (65 %)', 'proteine', 1200, 65, 9, 1, 3200, 4.5, 2.8, 40),
  ing('Tourteau de soja (48 %)', 'proteine', 450, 48, 1.5, 6, 2800, 0.3, 0.65, 45),
  ing("Tourteau d'arachide", 'proteine', 380, 45, 6, 8, 2900, 0.2, 0.6, 25),
  ing('Tourteau de coton', 'proteine', 300, 41, 3, 12, 2500, 0.2, 0.9, 15),
  ing('Farine de sang', 'proteine', 700, 85, 1, 1, 3000, 0.3, 0.25, 8),
  ing("Farine d'insectes (BSF)", 'proteine', 900, 55, 18, 7, 3600, 3.5, 0.9, 20),
  ing('Drêche de brasserie séchée', 'proteine', 200, 25, 6, 15, 2200, 0.3, 0.5, 20),
  ing('Farine de crevette', 'proteine', 800, 52, 6, 4, 2900, 6.0, 1.5, 15),
  // Énergie
  ing('Maïs', 'energie', 250, 9, 4, 2.5, 3350, 0.03, 0.28, 45),
  ing('Blé (grain)', 'energie', 280, 12, 2, 3, 3200, 0.05, 0.35, 35),
  ing('Son de blé', 'energie', 180, 15, 4, 11, 2200, 0.13, 1.1, 25),
  ing('Son de riz', 'energie', 150, 13, 13, 12, 2600, 0.07, 1.5, 25),
  ing('Riz brisé', 'energie', 300, 8, 1.5, 1, 3400, 0.04, 0.25, 35),
  ing('Farine de manioc', 'energie', 200, 2.5, 0.6, 3, 3300, 0.15, 0.1, 25),
  ing('Sorgho', 'energie', 240, 10, 3, 3, 3300, 0.03, 0.3, 30),
  // Huiles
  ing('Huile de poisson', 'huile', 1500, 0, 100, 0, 9000, 0, 0, 8),
  ing('Huile de soja', 'huile', 1100, 0, 100, 0, 8800, 0, 0, 8),
  ing('Huile de palme', 'huile', 900, 0, 100, 0, 8700, 0, 0, 6),
  // Minéraux / additifs
  ing('Phosphate bicalcique', 'mineraux', 600, 0, 0, 0, 0, 24, 18, 3),
  ing('Carbonate de calcium', 'mineraux', 150, 0, 0, 0, 0, 38, 0, 3),
  ing('Sel (NaCl)', 'mineraux', 200, 0, 0, 0, 0, 0, 0, 1),
  ing('Prémix vitamines & minéraux', 'additif', 2500, 0, 0, 0, 0, 2, 1, 2, 0.5),
  ing('Lysine HCl', 'additif', 2200, 78, 0, 0, 0, 0, 0, 1),
  ing('Méthionine', 'additif', 3000, 58, 0, 0, 0, 0, 0, 1),
  ing('Liant (amidon / CMC)', 'liant', 800, 0, 0, 0, 3000, 0, 0, 4),
];

export interface FormulationLine {
  ingredient_id: string;
  name: string;
  category: string;
  percent: number;      // % du mélange
  quantity_kg: number;  // kg
  price_per_kg: number;
  cost: number;
}

export interface NutritionResult {
  protein: number;
  lipid: number;
  fiber: number;
  energy: number;
  calcium: number;
  phosphorus: number;
}

export interface FormulationResult {
  lines: FormulationLine[];
  nutrition: NutritionResult;
  total_cost: number;
  cost_per_kg: number;
  cost_per_100kg: number;
  cost_per_ton: number;
  feasible: boolean;
  messages: { level: 'ok' | 'warn' | 'error'; text: string }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function nutritionOf(ings: IngredientInput[], x: number[]): NutritionResult {
  const acc: NutritionResult = { protein: 0, lipid: 0, fiber: 0, energy: 0, calcium: 0, phosphorus: 0 };
  ings.forEach((g, i) => {
    const w = x[i];
    acc.protein += w * (g.protein_pct || 0);
    acc.lipid += w * (g.lipid_pct || 0);
    acc.fiber += w * (g.fiber_pct || 0);
    acc.energy += w * (g.energy_kcal_kg || 0);
    acc.calcium += w * (g.calcium_pct || 0);
    acc.phosphorus += w * (g.phosphorus_pct || 0);
  });
  return acc;
}

function costOf(ings: IngredientInput[], x: number[]) {
  return ings.reduce((s, g, i) => s + x[i] * (g.price_per_kg || 0), 0);
}

function penalty(n: NutritionResult, t: NutrientProfile, mode: FormulationMode) {
  const rel = (got: number, target: number) => (target > 0 ? (got - target) / target : 0);
  let p = 0;
  const dProt = rel(n.protein, t.protein);
  p += (dProt < 0 ? 25 : 4) * dProt * dProt;
  const dLip = rel(n.lipid, t.lipid);
  p += (dLip < 0 ? 8 : 6) * dLip * dLip;
  const dEn = rel(n.energy, t.energy);
  p += 6 * dEn * dEn;
  const dCa = rel(n.calcium, t.calcium);
  p += 2 * dCa * dCa;
  const dP = rel(n.phosphorus, t.phosphorus);
  p += 2 * dP * dP;
  if (t.fiber_max > 0 && n.fiber > t.fiber_max) {
    const dF = (n.fiber - t.fiber_max) / t.fiber_max;
    p += 8 * dF * dF;
  }
  if (mode === 'performance') p *= 1.6;
  return p;
}

/** Optimiseur : descente locale multi-départs sur les proportions (somme = 1). */
export function optimizeFormulation(params: {
  ingredients: IngredientInput[];
  targets: NutrientProfile;
  batchSizeKg: number;
  mode: FormulationMode;
}): FormulationResult {
  const { ingredients, targets, batchSizeKg, mode } = params;
  const messages: FormulationResult['messages'] = [];

  if (ingredients.length === 0) {
    return {
      lines: [], nutrition: { protein: 0, lipid: 0, fiber: 0, energy: 0, calcium: 0, phosphorus: 0 },
      total_cost: 0, cost_per_kg: 0, cost_per_100kg: 0, cost_per_ton: 0, feasible: false,
      messages: [{ level: 'error', text: 'Sélectionnez au moins un ingrédient.' }],
    };
  }

  const lo = ingredients.map(g => clamp((g.min_inclusion_pct || 0) / 100, 0, 1));
  const hi = ingredients.map(g => clamp((g.max_inclusion_pct ?? 100) / 100, 0, 1));
  let sumLo = lo.reduce((a, b) => a + b, 0);
  let sumHi = hi.reduce((a, b) => a + b, 0);

  // Les bornes ne doivent jamais bloquer le calcul : on les assouplit
  // automatiquement et on prévient l'utilisateur.
  if (sumLo > 1) {
    const f = 1 / sumLo;
    for (let i = 0; i < lo.length; i++) lo[i] = lo[i] * f * 0.98;
    sumLo = lo.reduce((a, b) => a + b, 0);
    messages.push({ level: 'warn', text: 'Les taux minimums cumulés dépassaient 100 % : ils ont été réduits proportionnellement.' });
  }
  if (sumHi < 1) {
    for (let i = 0; i < hi.length; i++) hi[i] = clamp(Math.max(hi[i], lo[i]) * (1.05 / Math.max(sumHi, 1e-6)), lo[i], 1);
    sumHi = hi.reduce((a, b) => a + b, 0);
    messages.push({ level: 'warn', text: 'Les taux maximums cumulés étaient inférieurs à 100 % : ils ont été relevés pour permettre le calcul. Ajoutez des ingrédients pour un résultat plus réaliste.' });
  }
  for (let i = 0; i < hi.length; i++) if (hi[i] < lo[i]) hi[i] = lo[i];


  // Coût normalisé pour équilibrer objectif nutritionnel / économique
  const maxPrice = Math.max(1, ...ingredients.map(g => g.price_per_kg || 0));
  const costWeight = mode === 'cost' ? 3.5 : mode === 'balanced' ? 1.2 : 0.35;

  const score = (x: number[]) =>
    penalty(nutritionOf(ingredients, x), targets, mode) +
    costWeight * (costOf(ingredients, x) / maxPrice);

  const project = (x: number[]) => {
    // respecte bornes puis renormalise à 1
    for (let it = 0; it < 60; it++) {
      for (let i = 0; i < x.length; i++) x[i] = clamp(x[i], lo[i], hi[i]);
      const s = x.reduce((a, b) => a + b, 0);
      if (Math.abs(s - 1) < 1e-6) break;
      const diff = 1 - s;
      // répartir l'écart sur les ingrédients ayant de la marge
      const idx = x.map((_, i) => i).filter(i => (diff > 0 ? x[i] < hi[i] - 1e-9 : x[i] > lo[i] + 1e-9));
      if (idx.length === 0) break;
      idx.forEach(i => { x[i] += diff / idx.length; });
    }
    return x;
  };

  let best: number[] | null = null;
  let bestScore = Infinity;
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

  const starts = ingredients.length > 10 ? 8 : 24;
  for (let s = 0; s < starts; s++) {
    let x: number[];
    if (s === 0) x = ingredients.map(() => 1 / ingredients.length);
    else if (s === 1) {
      // départ orienté protéines
      const tot = ingredients.reduce((a, g) => a + (g.protein_pct || 0) + 1, 0);
      x = ingredients.map(g => ((g.protein_pct || 0) + 1) / tot);
    } else if (s === 2) {
      // départ orienté coût
      const inv = ingredients.map(g => 1 / Math.max(1, g.price_per_kg || 1));
      const tot = inv.reduce((a, b) => a + b, 0);
      x = inv.map(v => v / tot);
    } else {
      const r = ingredients.map(() => rand() + 0.05);
      const tot = r.reduce((a, b) => a + b, 0);
      x = r.map(v => v / tot);
    }
    project(x);

    let step = 0.12;
    let cur = score(x);
    for (let iter = 0; iter < 900; iter++) {
      let improved = false;
      for (let i = 0; i < x.length; i++) {
        for (let j = 0; j < x.length; j++) {
          if (i === j) continue;
          const d = Math.min(step, hi[i] - x[i], x[j] - lo[j]);
          if (d <= 1e-6) continue;
          const y = x.slice();
          y[i] += d; y[j] -= d;
          const sc = score(y);
          if (sc < cur - 1e-9) { x = y; cur = sc; improved = true; }
        }
      }
      if (!improved) {
        step /= 2;
        if (step < 1e-4) break;
      }
    }
    if (cur < bestScore) { bestScore = cur; best = x.slice(); }
  }

  const x = project(best ?? ingredients.map(() => 1 / ingredients.length));
  const nutrition = nutritionOf(ingredients, x);
  const costPerKg = costOf(ingredients, x);

  const lines: FormulationLine[] = ingredients.map((g, i) => {
    const percent = x[i] * 100;
    const quantity_kg = (x[i] * batchSizeKg);
    return {
      ingredient_id: g.id,
      name: g.name,
      category: g.category,
      percent: round(percent, 2),
      quantity_kg: round(quantity_kg, 3),
      price_per_kg: g.price_per_kg || 0,
      cost: round(quantity_kg * (g.price_per_kg || 0), 2),
    };
  }).filter(l => l.percent > 0.009)
    .sort((a, b) => b.percent - a.percent);

  // Diagnostic objectif vs obtenu
  const cmp = (label: string, got: number, target: number, unit: string, tol = 0.05) => {
    if (target <= 0) return;
    const d = (got - target) / target;
    if (Math.abs(d) <= tol) messages.push({ level: 'ok', text: `${label} : objectif atteint (${round(got, 1)} ${unit})` });
    else messages.push({
      level: 'warn',
      text: `${label} : ${round(got, 1)} ${unit} contre ${round(target, 1)} ${unit} visés (${d > 0 ? '+' : ''}${round(d * 100, 1)} %)`,
    });
  };
  cmp('Protéines', nutrition.protein, targets.protein, '%');
  cmp('Lipides', nutrition.lipid, targets.lipid, '%');
  cmp('Énergie', nutrition.energy, targets.energy, 'kcal/kg');
  cmp('Calcium', nutrition.calcium, targets.calcium, '%', 0.25);
  cmp('Phosphore', nutrition.phosphorus, targets.phosphorus, '%', 0.25);
  if (targets.fiber_max > 0) {
    if (nutrition.fiber <= targets.fiber_max) messages.push({ level: 'ok', text: `Fibres : ${round(nutrition.fiber, 1)} % (max ${targets.fiber_max} %)` });
    else messages.push({ level: 'warn', text: `Fibres trop élevées : ${round(nutrition.fiber, 1)} % (max ${targets.fiber_max} %)` });
  }
  messages.push({ level: 'ok', text: `Quantité totale : ${round(batchSizeKg, 2)} kg` });

  // Alternatives / conseils
  if (nutrition.protein < targets.protein * 0.95) {
    messages.push({ level: 'warn', text: 'Ajoutez une source protéique plus concentrée (farine de poisson, farine de sang, tourteau de soja) ou augmentez son taux maximum.' });
  }
  if (nutrition.lipid < targets.lipid * 0.95) {
    messages.push({ level: 'warn', text: 'Ajoutez une huile (poisson, soja, palme) pour relever le taux de lipides.' });
  }

  const feasible = !messages.some(m => m.level === 'error');

  return {
    lines,
    nutrition: {
      protein: round(nutrition.protein, 2), lipid: round(nutrition.lipid, 2), fiber: round(nutrition.fiber, 2),
      energy: round(nutrition.energy, 0), calcium: round(nutrition.calcium, 2), phosphorus: round(nutrition.phosphorus, 2),
    },
    total_cost: round(costPerKg * batchSizeKg, 2),
    cost_per_kg: round(costPerKg, 2),
    cost_per_100kg: round(costPerKg * 100, 2),
    cost_per_ton: round(costPerKg * 1000, 2),
    feasible,
    messages,
  };
}

/** Recalcule le résultat à partir de pourcentages saisis manuellement. */
export function recomputeFromLines(
  ingredients: IngredientInput[],
  percents: Record<string, number>,
  batchSizeKg: number,
  targets: NutrientProfile,
  mode: FormulationMode,
): FormulationResult {
  const x = ingredients.map(g => (percents[g.id] ?? 0) / 100);
  const sum = x.reduce((a, b) => a + b, 0) || 1;
  const nutrition = nutritionOf(ingredients, x);
  const costPerKg = costOf(ingredients, x);
  const messages: FormulationResult['messages'] = [];
  if (Math.abs(sum - 1) > 0.001) {
    messages.push({ level: 'warn', text: `Le total des taux est de ${round(sum * 100, 2)} % — ajustez pour atteindre 100 %.` });
  }
  if (nutrition.protein < targets.protein * 0.95) messages.push({ level: 'warn', text: 'Protéines en dessous de l\'objectif.' });
  else messages.push({ level: 'ok', text: 'Protéines : objectif atteint' });
  return {
    lines: ingredients.map((g, i) => ({
      ingredient_id: g.id, name: g.name, category: g.category,
      percent: round(x[i] * 100, 2),
      quantity_kg: round(x[i] * batchSizeKg, 3),
      price_per_kg: g.price_per_kg || 0,
      cost: round(x[i] * batchSizeKg * (g.price_per_kg || 0), 2),
    })).filter(l => l.percent > 0),
    nutrition: {
      protein: round(nutrition.protein, 2), lipid: round(nutrition.lipid, 2), fiber: round(nutrition.fiber, 2),
      energy: round(nutrition.energy, 0), calcium: round(nutrition.calcium, 2), phosphorus: round(nutrition.phosphorus, 2),
    },
    total_cost: round(costPerKg * batchSizeKg, 2),
    cost_per_kg: round(costPerKg, 2),
    cost_per_100kg: round(costPerKg * 100, 2),
    cost_per_ton: round(costPerKg * 1000, 2),
    feasible: true,
    messages,
  };
}

export function round(v: number, d = 2) {
  const f = Math.pow(10, d);
  return Math.round((Number.isFinite(v) ? v : 0) * f) / f;
}

export function getSpecies(key: string) {
  return SPECIES_PROFILES.find(s => s.key === key) ?? SPECIES_PROFILES[0];
}

export function getStage(speciesKey: string, stageKey: string) {
  const sp = getSpecies(speciesKey);
  return sp.stages.find(s => s.key === stageKey) ?? sp.stages[0];
}

export function buildBatchNumber(seq: number, speciesKey: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `LOT-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${speciesKey.slice(0, 3).toUpperCase()}-${String(seq).padStart(3, '0')}`;
}

export const QUANTITY_PRESETS = [50, 100, 500, 1000];
