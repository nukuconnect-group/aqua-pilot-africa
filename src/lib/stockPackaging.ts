/** Conditionnement d'un article de stock : saisie en kg ou en sacs, prix au kg ou au sac. */
export type QuantityMode = 'kg' | 'sacs';
export type CostMode = 'kg' | 'sac';

export const COMMON_BAG_WEIGHTS = [10, 15, 20, 25];

const round = (value: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** Total en kg à partir d'un nombre de sacs et du poids d'un sac. */
export function totalKgFromBags(bagCount: number, kgPerBag: number): number {
  if (!(bagCount > 0) || !(kgPerBag > 0)) return 0;
  return round(bagCount * kgPerBag);
}

/** Coût au kg déduit du prix d'un sac. */
export function costPerKgFromBag(costPerBag: number, kgPerBag: number): number {
  if (!(costPerBag > 0) || !(kgPerBag > 0)) return 0;
  return round(costPerBag / kgPerBag);
}

/** Prix d'un sac déduit du coût au kg. */
export function costPerBagFromKg(costPerKg: number, kgPerBag: number): number {
  if (!(costPerKg > 0) || !(kgPerBag > 0)) return 0;
  return round(costPerKg * kgPerBag);
}
