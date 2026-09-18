/**
 * Construction d'un export complet (PDF / Word / Excel / CSV) pour une formulation d'aliment.
 * Toutes les informations importantes sont incluses : ingrédients, kg, %, coûts,
 * coût par kg, prix de vente proposé, marge, espèce, stade, date.
 */
import { ExportOptions } from '@/lib/dataExportUtils';

export interface ExportLine {
  name: string;
  inclusion_pct: number;
  quantity_kg: number;
  price_per_kg: number;
  cost: number;
}

export interface FormulationExportInput {
  name: string;
  speciesLabel: string;
  stageLabel?: string;
  feedTypeLabel?: string;
  quantityKg: number;
  lines: ExportLine[];
  totalCost: number;
  costPerKg: number;
  sellingPricePerKg?: number;
  nutrition?: Record<string, number | null | undefined>;
  createdAt?: string;
  unitName?: string;
  notes?: string;
}

const n = (v: any, d = 2) => {
  const x = Number(v);
  return Number.isFinite(x) ? Number(x.toFixed(d)) : 0;
};

/** Marge indicative : prix de vente conseillé = coût de revient + 25 %. */
export const suggestedSellingPrice = (costPerKg: number) => n(costPerKg * 1.25, 2);

export function buildFormulationExport(input: FormulationExportInput): ExportOptions {
  const date = input.createdAt ? new Date(input.createdAt) : new Date();
  const selling = input.sellingPricePerKg ?? suggestedSellingPrice(input.costPerKg);
  const marginPerKg = n(selling - input.costPerKg, 2);
  const marginTotal = n(marginPerKg * input.quantityKg, 2);

  const rows: any[] = input.lines.map(l => ({
    ingredient: l.name,
    pourcentage: n(l.inclusion_pct, 2),
    quantite: n(l.quantity_kg, 3),
    prix: n(l.price_per_kg, 2),
    cout: n(l.cost, 2),
  }));

  rows.push({
    ingredient: 'TOTAL',
    pourcentage: n(input.lines.reduce((s, l) => s + Number(l.inclusion_pct || 0), 0), 2),
    quantite: n(input.quantityKg, 3),
    prix: '',
    cout: n(input.totalCost, 2),
  });

  const infos: [string, string | number][] = [
    ['Nom de la formulation', input.name],
    ["Type d'aliment", input.feedTypeLabel ?? '—'],
    ['Espèce', input.speciesLabel],
    ['Stade', input.stageLabel ?? '—'],
    ['Quantité totale à fabriquer (kg)', n(input.quantityKg, 2)],
    ['Coût total de fabrication', n(input.totalCost, 2)],
    ['Coût de revient par kg', n(input.costPerKg, 2)],
    ['Prix de vente indicatif par kg', selling],
    ['Marge potentielle par kg', marginPerKg],
    ['Marge potentielle totale', marginTotal],
    ['Date de formulation', date.toLocaleDateString('fr-FR')],
  ];
  if (input.unitName) infos.push(['Unité de production', input.unitName]);
  if (input.notes) infos.push(['Informations complémentaires', input.notes]);

  Object.entries(input.nutrition ?? {}).forEach(([k, v]) => {
    if (v == null || !Number.isFinite(Number(v))) return;
    infos.push([`Valeur nutritionnelle — ${k}`, n(v, 2)]);
  });

  rows.push({ ingredient: '', pourcentage: '', quantite: '', prix: '', cout: '' });
  infos.forEach(([label, value]) => {
    rows.push({ ingredient: label, pourcentage: '', quantite: '', prix: '', cout: value });
  });

  return {
    title: `Formulation — ${input.name}`,
    subtitle: `${input.speciesLabel}${input.stageLabel ? ` · ${input.stageLabel}` : ''} · ${n(input.quantityKg, 2)} kg · coût de revient ${n(input.costPerKg, 2)}/kg · prix conseillé ${selling}/kg`,
    filename: `formulation_${input.name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '')}_${date.toISOString().slice(0, 10)}`,
    unitName: input.unitName,
    columns: [
      { key: 'ingredient', label: 'Ingrédient / Information' },
      { key: 'pourcentage', label: 'Pourcentage (%)' },
      { key: 'quantite', label: 'Quantité (kg)' },
      { key: 'prix', label: 'Prix unitaire / kg' },
      { key: 'cout', label: 'Coût / Valeur' },
    ],
    data: rows,
  };
}
