/**
 * AquaFeed IA — Moteur de formulation « fiche Excel »
 * Reproduit intégralement la logique de la fiche de composition d'aliment :
 * INGRÉDIENTS → PRIX → ED → EB → PB → CB → FB → Ca → Ph → Lysine → Méth. →
 * Méth.+Lys. → Sel → TAUX D'INCORPORATION → QUANTITÉ → CONTRIBUTION →
 * TOTAL NUTRITIONNEL → COÛT → COÛT RÉEL/kg → VÉRIFICATION DES OBJECTIFS.
 */

export type ParamKey =
  | 'ed' | 'eb' | 'pb' | 'cb' | 'fb' | 'ca' | 'ph'
  | 'lysine' | 'methionine' | 'meth_lys' | 'sel';

export interface ParamMeta {
  key: ParamKey;
  label: string;
  full: string;
  unit: string;
  help: string;
  decimals: number;
}

/** Signification des paramètres (infobulles de l'interface). */
export const FEED_PARAMS: ParamMeta[] = [
  { key: 'ed', label: 'ED', full: 'Énergie Digestible', unit: 'kcal/kg', decimals: 0, help: "Énergie réellement assimilable par le poisson, exprimée en kcal par kg d'aliment." },
  { key: 'eb', label: 'EB', full: 'Énergie Brute', unit: 'kcal/kg', decimals: 0, help: "Énergie totale contenue dans l'aliment avant digestion, en kcal par kg." },
  { key: 'pb', label: 'PB', full: 'Protéines Brutes', unit: '%', decimals: 2, help: "Teneur en protéines brutes de l'aliment, en pourcentage." },
  { key: 'cb', label: 'CB', full: 'Cendres Brutes', unit: '%', decimals: 2, help: "Matière minérale totale restant après incinération, en pourcentage." },
  { key: 'fb', label: 'FB', full: 'Fibres Brutes', unit: '%', decimals: 2, help: "Teneur en fibres brutes ; un excès réduit la digestibilité." },
  { key: 'ca', label: 'Ca', full: 'Calcium', unit: '%', decimals: 3, help: "Teneur en calcium, essentielle au squelette et aux écailles." },
  { key: 'ph', label: 'Ph', full: 'Phosphore', unit: '%', decimals: 3, help: "Teneur en phosphore ; à équilibrer avec le calcium." },
  { key: 'lysine', label: 'Lysine', full: 'Lysine', unit: '%', decimals: 3, help: "Acide aminé essentiel, premier facteur limitant de la croissance." },
  { key: 'methionine', label: 'Méth.', full: 'Méthionine', unit: '%', decimals: 3, help: "Acide aminé soufré essentiel, second facteur limitant." },
  { key: 'meth_lys', label: 'Méth.+Lys.', full: 'Méthionine + Lysine', unit: '%', decimals: 3, help: "Somme méthionine + lysine, indicateur global de qualité protéique." },
  { key: 'sel', label: 'Sel', full: 'Sel', unit: '%', decimals: 3, help: "Teneur en sel (NaCl) de l'aliment." },
];

export const PARAM_HELP_PRICE = "Prix d'achat de l'ingrédient par kilogramme, dans la devise de l'exploitation.";
export const PARAM_HELP_INCORPORATION =
  "Taux d'incorporation : pourcentage minimal, recommandé et maximal d'utilisation de l'ingrédient dans la formulation. Il sert de contrainte au moteur de calcul.";

export const INGREDIENT_CATEGORIES_LAB = [
  { key: 'cereale', label: 'Céréales & sous-produits' },
  { key: 'proteine_vegetale', label: 'Protéines végétales' },
  { key: 'proteine_animale', label: 'Protéines animales' },
  { key: 'huile', label: 'Huiles & lipides' },
  { key: 'mineraux', label: 'Minéraux & vitamines' },
  { key: 'additif', label: 'Additifs & divers' },
];

export interface LabIngredient {
  id: string;
  name: string;
  category: string;
  /** null = prix non renseigné dans la fiche de référence (à saisir par l'utilisateur). */
  price_per_kg: number | null;
  ed: number; eb: number; pb: number; cb: number; fb: number;
  ca: number; ph: number;
  lysine: number; methionine: number; meth_lys: number; sel: number;
  min_inclusion_pct: number;
  max_inclusion_pct: number;
  /** Taux recommandé de la fiche Excel, si disponible. */
  recommended_inclusion_pct: number | null;
  /** Fourchette de marché indicative (FCFA/kg) pour proposer un prix. */
  market_price_min?: number | null;
  market_price_max?: number | null;
  source: 'reference' | 'user';
  stock_kg?: number;
  notes?: string | null;
}

const mk = (
  id: string, name: string, category: string,
  price: number | null,
  ed: number, eb: number, pb: number, cb: number, fb: number,
  ca: number, ph: number, lysine: number, methionine: number, meth_lys: number, sel: number,
  reco: number | null,
): LabIngredient => ({
  id, name, category, price_per_kg: price,
  ed, eb, pb, cb, fb, ca, ph, lysine, methionine, meth_lys, sel,
  min_inclusion_pct: 0,
  max_inclusion_pct: reco ?? 100,
  recommended_inclusion_pct: reco,
  market_price_min: price != null ? Math.round(price * 0.8) : null,
  market_price_max: price != null ? Math.round(price * 1.25) : null,
  source: 'reference',
  stock_kg: 0,
});

/**
 * Bibliothèque de référence — valeurs reprises telles quelles de la fiche Excel
 * « COMPOSITION ALIMENT ». Aucune valeur n'a été inventée : les cases vides de
 * la fiche restent vides (prix null, taux recommandé null).
 */
export const REFERENCE_INGREDIENTS: LabIngredient[] = [
  mk('ref-mais', 'Maïs Togo - Bénin', 'cereale', 167, 4187, 5233.75, 8.6, 3.8, 14, 0.25, 0.18, 0.27, 0.3, 0.29, 0.05, 15),
  mk('ref-son-ble', 'Son cubé / son de blé', 'cereale', 75, 4067, 5083.75, 15.5, 3.7, 9.9, 0.636, 0.237, 0.563, 0.19, 1.15, 0.165, null),
  mk('ref-manioc', 'Cossette de manioc', 'cereale', 300, 3700, 4625, 2.4, 0.4, 4.3, 0.089, 0.031, 0.06, 0.37, 0.08, 0.06, 5),
  mk('ref-son-riz', 'Son de riz', 'cereale', 25, 2809, 3511.25, 13, 18.5, 7.6, 0.585, 0.26, 0.52, 2.7, 1.55, 0.082, 15),
  mk('ref-fp40', 'Farine de poisson 40 (%)', 'proteine_animale', 270, 3870, 4837.5, 40, 10, 1.5, 4.3, 1.5, 2, 4, 2.5, 1.2, 10),
  mk('ref-fp50', 'Farine de poisson 50 (%)', 'proteine_animale', 350, 4317, 5396.25, 50, 10, 1.5, 4.3, 1.5, 2, 4, 2.5, 1.2, 20),
  mk('ref-dreche', 'Drêche de bière', 'proteine_vegetale', 200, 4617, 5771.25, 25, 7, 15, 0.925, 0.45, 0.875, 0.35, 0.78, 0.165, null),
  mk('ref-coquille', "Coquille d'huître", 'mineraux', null, 0, 0, 0, 0, 0, 0, 0, 0, 28, 0, 0, null),
  mk('ref-soja-torrefie', 'Soja torréfié', 'proteine_vegetale', 400, 3939, 4923.75, 43.56, 20.8, 5.7, 2.13, 0.57, 1.025, 0.29, 0.55, 0.049, 11),
  mk('ref-tourteau-soja', 'Tourteau de soja 42 (%)', 'proteine_vegetale', 500, 4032.59, 5040.7375, 42, 2.2, 6.7, 2.604, 0.567, 1.176, 0.31, 0.63, 0.059, 15),
  mk('ref-palmiste', 'Tourteau de palmiste', 'proteine_vegetale', 100, 3700, 4625, 16, 9, 22, 0.44, 0.28, 0.4, 0.23, 0.55, 0.15, null),
  mk('ref-nonnomme', 'Ingrédient non nommé (fiche de référence)', 'proteine_vegetale', 500, 4505, 5631.25, 40.2, 10.4, 10.3, 1.327, 0.482, 1.045, 0.18, 0.56, 0.8, null),
  mk('ref-coton', 'Tourteau de coton', 'proteine_vegetale', 75, 4090, 5112.5, 38, 7.1, 23.6, 0.41, 0.16, 0.35, 0.22, 1.18, 0.05, null),
  mk('ref-cmv', 'Concentré minéraux vitaminé', 'mineraux', null, 4334, 5417.5, 42, 3.35, 3, 2.79, 3, 3.54, 3.11, 3.5, 4.89, null),
  mk('ref-huile-rouge', 'Huile rouge', 'huile', 700, 8500, 10625, 0, 0, 0, 0, 0, 0, 0, 0, 0, null),
  mk('ref-moringa', 'Feuille de moringa', 'additif', 400, 3426, 4282.5, 31.3, 5.7, 10, 0.91, 0.31, 0.58, 0.97, 0.2, 0.1, null),
  mk('ref-levure', 'Levure', 'additif', 1400, 3310, 4137.5, 49, 3, 2.8, 0, 0, 0, 0, 0, 0, null),
  mk('ref-huile-soja', 'Huile de soja', 'huile', 1000, 4546.97, 8957.97, 0, 0, 0, 0, 0, 0, 0, 0, 0, null),
];

/* ------------------------------------------------------------------ */
/* Objectifs nutritionnels                                             */
/* ------------------------------------------------------------------ */

export interface TargetRange { min?: number | null; target?: number | null; max?: number | null }
export type TargetMap = Partial<Record<ParamKey, TargetRange>>;

export const STAGES = [
  { key: 'alevin', label: 'Alevin' },
  { key: 'juvenile', label: 'Juvénile' },
  { key: 'croissance', label: 'Croissance / Grossissement' },
  { key: 'finition', label: 'Finition' },
  { key: 'reproducteur', label: 'Reproducteur' },
];

export const SPECIES = [
  { key: 'tilapia', label: 'Tilapia' },
  { key: 'clarias', label: 'Clarias / Poisson-chat' },
  { key: 'carpe', label: 'Carpe' },
  { key: 'pangasius', label: 'Pangasius' },
  { key: 'autre', label: 'Autre espèce' },
];

/** Suggestions de PB par stade (modifiables — l'utilisateur reste maître). */
export const STAGE_PB_SUGGESTION: Record<string, number> = {
  alevin: 40, juvenile: 35, croissance: 32, finition: 28, reproducteur: 35,
};

export const QUANTITY_PRESETS = [10, 25, 50, 100, 500, 1000];

export type LabMode = 'cost' | 'balanced' | 'performance';

/* ------------------------------------------------------------------ */
/* Calcul                                                              */
/* ------------------------------------------------------------------ */

export interface LabLine {
  ingredient_id: string;
  name: string;
  category: string;
  price_per_kg: number;
  inclusion_pct: number;
  quantity_kg: number;
  /** Contribution = quantité × valeur de l'ingrédient, par paramètre. */
  contributions: Record<ParamKey, number>;
  cost: number;
}

export interface LabTotals {
  /** Somme des contributions (quantité × valeur). */
  contributions: Record<ParamKey, number>;
  /** Valeur finale de l'aliment = contribution ÷ quantité totale. */
  values: Record<ParamKey, number>;
}

export interface ConformityRow {
  key: ParamKey;
  label: string;
  unit: string;
  value: number;
  min?: number | null;
  target?: number | null;
  max?: number | null;
  status: 'ok' | 'low' | 'high' | 'none';
  message: string;
}

export interface LabResult {
  lines: LabLine[];
  totals: LabTotals;
  total_quantity_kg: number;
  total_cost: number;
  cost_per_kg: number;
  conformity: ConformityRow[];
  feasible: boolean;
  problems: string[];
  suggestions: string[];
  warnings: string[];
}

const PKEYS = FEED_PARAMS.map(p => p.key);
const zero = (): Record<ParamKey, number> =>
  PKEYS.reduce((a, k) => { a[k] = 0; return a; }, {} as Record<ParamKey, number>);

export const round = (v: number, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round((Number(v) || 0) * f) / f;
};

export const priceOf = (i: LabIngredient) => Number(i.price_per_kg ?? 0);

/** Calcul direct : à partir de taux d'incorporation imposés (en %). */
export function computeFormulation(
  ingredients: LabIngredient[],
  inclusionPct: number[],
  totalQuantityKg: number,
  targets: TargetMap,
): LabResult {
  const lines: LabLine[] = [];
  const contribTotals = zero();
  let totalCost = 0;
  let usedQty = 0;

  ingredients.forEach((g, i) => {
    const pct = Number(inclusionPct[i] || 0);
    if (pct <= 0) return;
    const qty = (pct / 100) * totalQuantityKg;
    const contributions = zero();
    PKEYS.forEach(k => {
      const c = qty * (Number((g as any)[k]) || 0);
      contributions[k] = c;
      contribTotals[k] += c;
    });
    const cost = qty * priceOf(g);
    totalCost += cost;
    usedQty += qty;
    lines.push({
      ingredient_id: g.id, name: g.name, category: g.category,
      price_per_kg: priceOf(g), inclusion_pct: pct, quantity_kg: qty,
      contributions, cost,
    });
  });

  const denom = usedQty > 0 ? usedQty : 1;
  const values = zero();
  PKEYS.forEach(k => { values[k] = contribTotals[k] / denom; });

  const conformity = checkConformity(values, targets);
  const problems = conformity.filter(c => c.status === 'low' || c.status === 'high').map(c => c.message);

  const warnings: string[] = [];
  const missingPrice = ingredients.filter((g, i) => (inclusionPct[i] || 0) > 0 && g.price_per_kg == null);
  if (missingPrice.length) {
    warnings.push(`Prix non renseigné pour : ${missingPrice.map(m => m.name).join(', ')}. Le coût affiché est donc sous-estimé.`);
  }
  const sumPct = inclusionPct.reduce((a, b) => a + (Number(b) || 0), 0);
  if (Math.abs(sumPct - 100) > 0.5) {
    warnings.push(`La somme des taux d'incorporation est de ${round(sumPct, 2)} % au lieu de 100 %. Les valeurs affichées sont ramenées à la quantité réellement pesée (${round(usedQty, 2)} kg).`);
  }

  return {
    lines: lines.sort((a, b) => b.inclusion_pct - a.inclusion_pct),
    totals: { contributions: contribTotals, values },
    total_quantity_kg: usedQty,
    total_cost: totalCost,
    cost_per_kg: usedQty > 0 ? totalCost / usedQty : 0,
    conformity,
    feasible: problems.length === 0,
    problems,
    suggestions: problems.length ? buildSuggestions(conformity) : [],
    warnings,
  };
}

export function checkConformity(values: Record<ParamKey, number>, targets: TargetMap): ConformityRow[] {
  return FEED_PARAMS.map(p => {
    const t = targets[p.key] || {};
    const v = values[p.key] ?? 0;
    const min = num(t.min), max = num(t.max), target = num(t.target);
    const fmt = (x: number) => `${round(x, p.decimals)} ${p.unit}`;
    if (min == null && max == null && target == null) {
      return { key: p.key, label: p.full, unit: p.unit, value: v, min, max, target, status: 'none' as const, message: `${p.full} : ${fmt(v)} (aucun objectif défini)` };
    }
    if (min != null && v < min - 1e-9) {
      return { key: p.key, label: p.full, unit: p.unit, value: v, min, max, target, status: 'low' as const, message: `${p.full} insuffisant : ${fmt(v)} pour un minimum de ${fmt(min)}` };
    }
    if (max != null && v > max + 1e-9) {
      return { key: p.key, label: p.full, unit: p.unit, value: v, min, max, target, status: 'high' as const, message: `${p.full} trop élevé : ${fmt(v)} pour un maximum de ${fmt(max)}` };
    }
    return { key: p.key, label: p.full, unit: p.unit, value: v, min, max, target, status: 'ok' as const, message: `${p.full} : ${fmt(v)} — conforme` };
  });
}

function buildSuggestions(conf: ConformityRow[]): string[] {
  const s: string[] = [];
  const low = conf.filter(c => c.status === 'low').map(c => c.label);
  const high = conf.filter(c => c.status === 'high').map(c => c.label);
  if (low.length) s.push(`Relevez le taux maximum d'incorporation des ingrédients riches en ${low.join(', ')}, ou ajoutez un ingrédient plus concentré.`);
  if (high.length) s.push(`Abaissez le taux maximum des ingrédients apportant ${high.join(', ')}, ou retirez l'un d'eux de la sélection.`);
  s.push("Élargissez la plage nutritionnelle (minimum/maximum) du paramètre concerné.");
  s.push("Ajoutez un ingrédient complémentaire à votre sélection.");
  s.push("Assouplissez l'objectif de coût (mode Équilibré ou Performance).");
  return s;
}

const num = (v: any): number | null =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

/* ------------------------------------------------------------------ */
/* Optimiseur                                                          */
/* ------------------------------------------------------------------ */

function violation(values: Record<ParamKey, number>, targets: TargetMap): number {
  let p = 0;
  for (const meta of FEED_PARAMS) {
    const t = targets[meta.key]; if (!t) continue;
    const v = values[meta.key] ?? 0;
    const min = num(t.min), max = num(t.max), tgt = num(t.target);
    const scale = Math.max(1, Math.abs(tgt ?? max ?? min ?? 1));
    if (min != null && v < min) p += 60 * Math.pow((min - v) / scale, 2);
    if (max != null && v > max) p += 60 * Math.pow((v - max) / scale, 2);
    if (tgt != null) p += 6 * Math.pow((v - tgt) / scale, 2);
  }
  return p;
}

/** Recherche une combinaison respectant les contraintes (somme = 100 %). */
export function optimizeLab(params: {
  ingredients: LabIngredient[];
  targets: TargetMap;
  totalQuantityKg: number;
  mode: LabMode;
}): LabResult {
  const { ingredients, targets, totalQuantityKg, mode } = params;

  if (ingredients.length === 0) {
    return {
      lines: [], totals: { contributions: zero(), values: zero() },
      total_quantity_kg: 0, total_cost: 0, cost_per_kg: 0,
      conformity: [], feasible: false,
      problems: ['Aucun ingrédient sélectionné.'],
      suggestions: ['Sélectionnez au moins deux ingrédients dans la bibliothèque.'],
      warnings: [],
    };
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const lo = ingredients.map(g => clamp((g.min_inclusion_pct || 0) / 100, 0, 1));
  const hi = ingredients.map(g => clamp((g.max_inclusion_pct ?? 100) / 100, 0, 1));
  for (let i = 0; i < hi.length; i++) if (hi[i] < lo[i]) hi[i] = lo[i];

  const warnings: string[] = [];
  const sumLo = lo.reduce((a, b) => a + b, 0);
  const sumHi = hi.reduce((a, b) => a + b, 0);
  const boundsBlocking = sumLo > 1 + 1e-9 || sumHi < 1 - 1e-9;
  if (boundsBlocking) {
    return {
      lines: [], totals: { contributions: zero(), values: zero() },
      total_quantity_kg: 0, total_cost: 0, cost_per_kg: 0, conformity: [],
      feasible: false,
      problems: sumLo > 1
        ? [`Les taux d'incorporation minimums cumulés atteignent ${round(sumLo * 100, 1)} % : impossible de descendre à 100 %.`]
        : [`Les taux d'incorporation maximums cumulés ne totalisent que ${round(sumHi * 100, 1)} % : impossible d'atteindre 100 %.`],
      suggestions: [
        "Modifiez les taux d'incorporation minimum / maximum des ingrédients sélectionnés.",
        'Ajoutez un ingrédient supplémentaire à la sélection.',
        'Supprimez un ingrédient dont le taux minimum est trop élevé.',
      ],
      warnings: [],
    };
  }

  const maxPrice = Math.max(1, ...ingredients.map(priceOf));
  const costWeight = mode === 'cost' ? 3.0 : mode === 'balanced' ? 1.0 : 0.3;

  const valuesOf = (x: number[]) => {
    const v = zero();
    ingredients.forEach((g, i) => { PKEYS.forEach(k => { v[k] += x[i] * (Number((g as any)[k]) || 0); }); });
    return v;
  };
  const costOf = (x: number[]) => ingredients.reduce((s, g, i) => s + x[i] * priceOf(g), 0);
  const score = (x: number[]) => violation(valuesOf(x), targets) + costWeight * (costOf(x) / maxPrice);

  const project = (x: number[]) => {
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < x.length; i++) x[i] = clamp(x[i], lo[i], hi[i]);
      const s = x.reduce((a, b) => a + b, 0);
      if (Math.abs(s - 1) < 1e-9) break;
      const diff = 1 - s;
      const idx = x.map((_, i) => i).filter(i => (diff > 0 ? x[i] < hi[i] - 1e-12 : x[i] > lo[i] + 1e-12));
      if (!idx.length) break;
      idx.forEach(i => { x[i] += diff / idx.length; });
    }
    return x;
  };

  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let best: number[] | null = null;
  let bestScore = Infinity;
  const starts = ingredients.length > 12 ? 10 : 22;

  for (let s = 0; s < starts; s++) {
    let x: number[];
    if (s === 0) x = ingredients.map(() => 1 / ingredients.length);
    else if (s === 1) {
      const tot = ingredients.reduce((a, g) => a + g.pb + 1, 0);
      x = ingredients.map(g => (g.pb + 1) / tot);
    } else if (s === 2) {
      const inv = ingredients.map(g => 1 / Math.max(1, priceOf(g)));
      const t = inv.reduce((a, b) => a + b, 0);
      x = inv.map(v => v / t);
    } else if (s === 3) {
      const r = ingredients.map(g => (g.recommended_inclusion_pct ?? 100 / ingredients.length) / 100);
      const t = r.reduce((a, b) => a + b, 0) || 1;
      x = r.map(v => v / t);
    } else {
      const r = ingredients.map(() => rand() + 0.05);
      const t = r.reduce((a, b) => a + b, 0);
      x = r.map(v => v / t);
    }
    project(x);

    let step = 0.15;
    let cur = score(x);
    for (let iter = 0; iter < 800; iter++) {
      let improved = false;
      for (let i = 0; i < x.length; i++) {
        for (let j = 0; j < x.length; j++) {
          if (i === j) continue;
          const d = Math.min(step, hi[i] - x[i], x[j] - lo[j]);
          if (d <= 1e-7) continue;
          const y = x.slice();
          y[i] += d; y[j] -= d;
          const sc = score(y);
          if (sc < cur - 1e-10) { x = y; cur = sc; improved = true; }
        }
      }
      if (!improved) { step /= 2; if (step < 1e-5) break; }
    }
    if (cur < bestScore) { bestScore = cur; best = x.slice(); }
  }

  const x = project(best ?? ingredients.map(() => 1 / ingredients.length));
  const result = computeFormulation(ingredients, x.map(v => v * 100), totalQuantityKg, targets);
  result.warnings = [...warnings, ...result.warnings];
  return result;
}

/* ------------------------------------------------------------------ */
/* Mode 2 — extraction des paramètres depuis une demande en langage naturel */
/* ------------------------------------------------------------------ */

export interface ParsedRequest {
  species?: string;
  stage?: string;
  quantityKg?: number;
  pbTarget?: number;
  ingredientIds: string[];
  mode?: LabMode;
  unmatched: string[];
}

const STAGE_WORDS: [string, string][] = [
  ['alevin', 'alevin'], ['larve', 'alevin'],
  ['juvenil', 'juvenile'],
  ['grossis', 'croissance'], ['croissance', 'croissance'],
  ['finition', 'finition'],
  ['reproduct', 'reproducteur'], ['geniteur', 'reproducteur'],
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function parseRequest(text: string, library: LabIngredient[]): ParsedRequest {
  const t = norm(text);
  const out: ParsedRequest = { ingredientIds: [], unmatched: [] };

  for (const sp of SPECIES) if (t.includes(norm(sp.label).split(' ')[0]) && sp.key !== 'autre') out.species = sp.key;
  if (t.includes('silure') || t.includes('poisson-chat') || t.includes('poisson chat')) out.species = 'clarias';

  for (const [w, k] of STAGE_WORDS) if (t.includes(w)) { out.stage = k; break; }

  const q = t.match(/(\d[\d\s.,]*)\s*(kg|kilo|tonne|t\b)/);
  if (q) {
    const v = parseFloat(q[1].replace(/\s/g, '').replace(',', '.'));
    out.quantityKg = /tonne|^t/.test(q[2]) ? v * 1000 : v;
  }

  const pb = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:de\s*)?(?:proteine|pb|protéine)?/);
  const pb2 = t.match(/(?:proteine|pb)[^\d]{0,15}(\d{1,2}(?:[.,]\d+)?)/);
  const raw = pb2?.[1] ?? (t.includes('protein') || t.includes('pb') ? pb?.[1] : undefined);
  if (raw) out.pbTarget = parseFloat(raw.replace(',', '.'));

  if (/moins cher|minimiser le cout|cout minimum|economique|reduire le prix|moindre cout/.test(t)) out.mode = 'cost';
  else if (/performance|meilleure croissance|qualite maximale/.test(t)) out.mode = 'performance';

  for (const g of library) {
    const keys = norm(g.name).replace(/[()%]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    if (keys.some(k => t.includes(k))) out.ingredientIds.push(g.id);
  }
  if (t.includes('local')) {
    library.filter(g => /mais|manioc|son|palmiste|coton|moringa|huile rouge/.test(norm(g.name)))
      .forEach(g => { if (!out.ingredientIds.includes(g.id)) out.ingredientIds.push(g.id); });
  }
  return out;
}

export interface Adjustment {
  kind: 'increase' | 'decrease' | 'remove' | 'add' | 'pb' | 'cheaper' | 'unknown';
  ingredientId?: string;
  value?: number;
}

/** Traduit une consigne conversationnelle en nouvelle contrainte. */
export function parseAdjustment(text: string, library: LabIngredient[]): Adjustment {
  const t = norm(text);
  const match = library.find(g => {
    const keys = norm(g.name).replace(/[()%]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    return keys.some(k => t.includes(k));
  });
  const pb = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (/exactement|je veux.*(proteine|pb)/.test(t) && pb) return { kind: 'pb', value: parseFloat(pb[1].replace(',', '.')) };
  if (/reduis? le prix|moins cher|baisse le cout|reduire le cout/.test(t)) return { kind: 'cheaper' };
  if (/supprime|retire|enleve|sans /.test(t) && match) return { kind: 'remove', ingredientId: match.id };
  if (/ajoute|utilise|inclus/.test(t) && match) return { kind: 'add', ingredientId: match.id };
  if (/augmente|plus de/.test(t) && match) return { kind: 'increase', ingredientId: match.id };
  if (/reduis|diminue|moins de/.test(t) && match) return { kind: 'decrease', ingredientId: match.id };
  return { kind: 'unknown' };
}

/* ------------------------------------------------------------------ */
/* Intelligence de marché — ingrédients disponibles par pays           */
/* ------------------------------------------------------------------ */

export interface MarketSuggestion {
  /** Ingrédient de la bibliothèque de référence auquel rattacher l'offre. */
  ref_id: string;
  /** Prix indicatif observé sur le marché local (devise locale / kg). */
  price_min: number;
  price_max: number;
  note?: string;
}

export interface CountryMarket {
  code: string;
  label: string;
  currency: string;
  suggestions: MarketSuggestion[];
}

/**
 * Disponibilités et fourchettes de prix indicatives par pays.
 * Ce sont des repères de marché à confirmer localement : l'utilisateur peut
 * remplacer chaque prix par son prix d'achat réel.
 */
export const COUNTRY_MARKETS: CountryMarket[] = [
  {
    code: 'TG', label: 'Togo', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 150, price_max: 220, note: 'Récolte locale, moins cher en période de récolte (oct.–déc.).' },
      { ref_id: 'ref-son-ble', price_min: 60, price_max: 110, note: 'Minoteries de Lomé.' },
      { ref_id: 'ref-son-riz', price_min: 20, price_max: 60, note: 'Rizeries de la Kara et des Savanes.' },
      { ref_id: 'ref-manioc', price_min: 200, price_max: 350 },
      { ref_id: 'ref-fp50', price_min: 300, price_max: 450, note: 'Farine de poisson du port de Lomé, qualité variable.' },
      { ref_id: 'ref-tourteau-soja', price_min: 400, price_max: 600 },
      { ref_id: 'ref-palmiste', price_min: 80, price_max: 150 },
      { ref_id: 'ref-huile-rouge', price_min: 600, price_max: 900 },
      { ref_id: 'ref-moringa', price_min: 300, price_max: 600, note: 'Feuilles séchées, production locale.' },
    ],
  },
  {
    code: 'BJ', label: 'Bénin', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 150, price_max: 230 },
      { ref_id: 'ref-son-ble', price_min: 70, price_max: 120 },
      { ref_id: 'ref-manioc', price_min: 180, price_max: 320, note: 'Cossettes très disponibles.' },
      { ref_id: 'ref-fp40', price_min: 250, price_max: 400 },
      { ref_id: 'ref-tourteau-soja', price_min: 380, price_max: 550, note: 'Filière soja développée.' },
      { ref_id: 'ref-coton', price_min: 60, price_max: 120, note: 'Tourteau de coton abondant.' },
      { ref_id: 'ref-palmiste', price_min: 80, price_max: 160 },
      { ref_id: 'ref-huile-rouge', price_min: 600, price_max: 900 },
    ],
  },
  {
    code: 'CI', label: "Côte d'Ivoire", currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 180, price_max: 260 },
      { ref_id: 'ref-son-riz', price_min: 40, price_max: 90 },
      { ref_id: 'ref-manioc', price_min: 200, price_max: 350 },
      { ref_id: 'ref-fp50', price_min: 350, price_max: 550, note: 'Farine de poisson d’Abidjan.' },
      { ref_id: 'ref-tourteau-soja', price_min: 450, price_max: 650 },
      { ref_id: 'ref-palmiste', price_min: 70, price_max: 140, note: 'Sous-produit de la filière palmier.' },
      { ref_id: 'ref-huile-rouge', price_min: 650, price_max: 950 },
      { ref_id: 'ref-dreche', price_min: 120, price_max: 250, note: 'Brasseries locales.' },
    ],
  },
  {
    code: 'BF', label: 'Burkina Faso', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 170, price_max: 260 },
      { ref_id: 'ref-son-ble', price_min: 60, price_max: 110 },
      { ref_id: 'ref-coton', price_min: 55, price_max: 110, note: 'Tourteau de coton très disponible.' },
      { ref_id: 'ref-fp40', price_min: 350, price_max: 600, note: 'Importée, coût de transport élevé.' },
      { ref_id: 'ref-dreche', price_min: 100, price_max: 220 },
      { ref_id: 'ref-moringa', price_min: 350, price_max: 700 },
    ],
  },
  {
    code: 'SN', label: 'Sénégal', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 180, price_max: 270 },
      { ref_id: 'ref-son-riz', price_min: 40, price_max: 90, note: 'Vallée du fleuve Sénégal.' },
      { ref_id: 'ref-fp50', price_min: 300, price_max: 500, note: 'Farine de poisson de la pêche artisanale.' },
      { ref_id: 'ref-tourteau-soja', price_min: 450, price_max: 650 },
      { ref_id: 'ref-coquille', price_min: 20, price_max: 60, note: 'Coquillages broyés, source de calcium.' },
      { ref_id: 'ref-huile-soja', price_min: 900, price_max: 1400 },
    ],
  },
  {
    code: 'CM', label: 'Cameroun', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 160, price_max: 250 },
      { ref_id: 'ref-son-ble', price_min: 70, price_max: 130 },
      { ref_id: 'ref-manioc', price_min: 150, price_max: 300 },
      { ref_id: 'ref-fp50', price_min: 350, price_max: 600 },
      { ref_id: 'ref-palmiste', price_min: 70, price_max: 150 },
      { ref_id: 'ref-dreche', price_min: 120, price_max: 250 },
      { ref_id: 'ref-huile-rouge', price_min: 600, price_max: 1000 },
    ],
  },
  {
    code: 'ML', label: 'Mali', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 170, price_max: 260 },
      { ref_id: 'ref-son-riz', price_min: 35, price_max: 80, note: 'Office du Niger.' },
      { ref_id: 'ref-coton', price_min: 55, price_max: 115 },
      { ref_id: 'ref-fp40', price_min: 400, price_max: 650 },
    ],
  },
  {
    code: 'NE', label: 'Niger', currency: 'FCFA',
    suggestions: [
      { ref_id: 'ref-mais', price_min: 200, price_max: 300 },
      { ref_id: 'ref-son-ble', price_min: 80, price_max: 140 },
      { ref_id: 'ref-coton', price_min: 70, price_max: 130 },
      { ref_id: 'ref-fp40', price_min: 450, price_max: 700, note: 'Importée.' },
    ],
  },
];

/** Reconnaît un pays cité dans la demande de l'utilisateur. */
export function parseCountry(text: string): string | undefined {
  const t = norm(text);
  const found = COUNTRY_MARKETS.find(c => t.includes(norm(c.label)) || t.includes(norm(c.label).split(' ')[0]));
  return found?.code;
}

/* ------------------------------------------------------------------ */
/* Recommandations & procédé de fabrication                            */
/* ------------------------------------------------------------------ */

export interface ProcessStep {
  title: string;
  detail: string;
}

/** Recommandations de formulation en fonction de l'espèce et du stade. */
export function buildRecommendations(species: string, stage: string, result: LabResult | null): string[] {
  const r: string[] = [];
  const pb = STAGE_PB_SUGGESTION[stage] ?? 32;
  const speciesLabel = SPECIES.find(s => s.key === species)?.label ?? species;
  const stageLabel = STAGES.find(s => s.key === stage)?.label ?? stage;
  r.push(`${speciesLabel} au stade ${stageLabel} : visez environ ${pb} % de protéines brutes et une énergie digestible de 2 800 à 3 200 kcal/kg.`);
  if (species === 'clarias') r.push("Le Clarias est carnivore : gardez au moins 25 à 30 % de l'apport protéique d'origine animale (farine de poisson).");
  if (species === 'tilapia') r.push('Le tilapia valorise bien les protéines végétales : le tourteau de soja peut couvrir une large part des protéines.');
  if (stage === 'alevin') r.push("Pour les alevins, broyez finement (< 0,5 mm) et distribuez 6 à 8 fois par jour.");
  if (stage === 'finition') r.push("En finition, limitez la farine de poisson pour réduire le coût sans nuire à la qualité de la chair.");
  r.push('Fibres brutes : restez sous 8 % pour préserver la digestibilité.');
  r.push('Rapport calcium/phosphore recommandé : 1,2 à 1,5 pour 1.');
  r.push("Ajoutez toujours 1 à 2 % de complément minéral vitaminé et 0,3 à 0,5 % de sel.");
  if (result) {
    const fb = result.totals.values.fb;
    if (fb > 8) r.push(`Vos fibres brutes atteignent ${round(fb, 2)} % : réduisez le son de riz ou le tourteau de palmiste.`);
    const ca = result.totals.values.ca, ph = result.totals.values.ph;
    if (ph > 0 && ca / ph < 1) r.push("Le calcium est faible par rapport au phosphore : ajoutez de la coquille d'huître broyée.");
    if (result.cost_per_kg > 0) r.push(`Coût de revient obtenu : ${round(result.cost_per_kg, 2)} / kg d'aliment fabriqué.`);
  }
  return r;
}

/** Étapes de fabrication, dimensionnées selon la quantité à produire. */
export function buildProcessSteps(result: LabResult | null, quantityKg: number, stage: string): ProcessStep[] {
  const fine = stage === 'alevin' || stage === 'juvenile';
  const pellet = fine ? (stage === 'alevin' ? '0,5 – 1 mm' : '1 – 2 mm') : '2 – 4 mm';
  const eau = round(quantityKg * 0.3, 1);
  const liant = round(quantityKg * 0.02, 2);
  const sacs = Math.ceil(quantityKg / 50);
  const lines = result?.lines ?? [];
  const pesee = lines.length
    ? lines.map(l => `${l.name} : ${round(l.quantity_kg, 2)} kg`).join(' · ')
    : 'Lancez le calcul pour obtenir les quantités exactes à peser.';

  return [
    { title: '1. Pesée des matières premières', detail: `Pesez séparément chaque ingrédient sur une balance fiable : ${pesee}. Total visé : ${round(quantityKg, 2)} kg.` },
    { title: '2. Nettoyage et séchage', detail: "Éliminez cailloux, moisissures et impuretés. Les matières doivent être sèches (humidité < 12 %) pour éviter le développement de moisissures." },
    { title: '3. Broyage', detail: `Broyez chaque matière première au moulin à marteaux. Finesse recommandée : ${fine ? 'très fine, tamis de 0,5 mm' : 'fine, tamis de 1 mm'}.` },
    { title: '4. Mélange à sec', detail: `Mélangez 10 à 15 minutes en commençant par les gros volumes, puis incorporez les petites quantités (CMV, sel, méthionine) après pré-mélange avec un peu de farine, pour une répartition homogène.` },
    { title: '5. Ajout des liquides', detail: `Incorporez l'huile puis ajoutez progressivement environ ${eau} L d'eau tiède (≈ 30 % du poids) et ${liant} kg de liant (amidon de manioc ou farine gélatinisée) jusqu'à obtenir une pâte qui tient dans la main.` },
    { title: '6. Granulation', detail: `Passez la pâte à la granuleuse ou au hachoir avec une filière de ${pellet} selon le stade. Émiettez ensuite pour obtenir des granulés réguliers.` },
    { title: '7. Séchage', detail: "Séchez à l'ombre sur claies aérées 24 à 48 h, ou au séchoir à 50–60 °C jusqu'à une humidité inférieure à 10 %. Un granulé bien sec se casse net." },
    { title: '8. Tamisage et calibrage', detail: 'Tamisez pour séparer les fines (à recycler dans le prochain mélange) et obtenir un calibre homogène adapté à la taille de la bouche des poissons.' },
    { title: '9. Ensachage et stockage', detail: `Ensachez dans des sacs propres de 50 kg (≈ ${sacs} sac${sacs > 1 ? 's' : ''}) avec étiquette : nom de la formule, date, taux de protéines. Stockez sur palettes, au sec et à l'abri des rongeurs. Durée de conservation : 2 à 3 mois.` },
    { title: '10. Test et suivi', detail: "Vérifiez la flottabilité/stabilité dans l'eau (au moins 10 minutes sans se déliter), puis suivez l'indice de consommation et la croissance sur le premier lot nourri avant de produire en grande quantité." },
  ];
}
