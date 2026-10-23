import type { ProductionUnitType } from '@/contexts/ProductionUnitsContext';

/** Unités proposées à l'inscription ; chaque choix crée une unité du même type. */
export const SIGNUP_UNIT_OPTIONS: { type: ProductionUnitType; label: string; desc: string }[] = [
  { type: 'grossissement', label: 'Grossissement', desc: 'Production de poissons en bassins' },
  { type: 'ecloserie', label: 'Écloserie', desc: 'Reproduction et alevins' },
  { type: 'fabrication_aliment', label: "Fabrication d'aliment", desc: 'Formulation et production d’aliments' },
  { type: 'commercialisation', label: 'Commercialisation', desc: 'Vente, caisse et stock commercial' },
  { type: 'transformation', label: 'Transformation', desc: 'Fumage, découpe, conditionnement' },
  { type: 'conservation', label: 'Conservation', desc: 'Stockage froid et congélation' },
  { type: 'algoculture', label: 'Algoculture', desc: 'Culture d’algues' },
];

const VALID = new Set(SIGNUP_UNIT_OPTIONS.map((o) => o.type));

/** Garde seulement les types d'unité reconnus, sans doublon. */
export const signupUnitTypes = (values: unknown): ProductionUnitType[] =>
  Array.isArray(values) ? [...new Set(values.filter((v): v is ProductionUnitType => VALID.has(v as ProductionUnitType)))] : [];

export const signupUnitLabel = (type: ProductionUnitType) =>
  SIGNUP_UNIT_OPTIONS.find((o) => o.type === type)?.label ?? type;
