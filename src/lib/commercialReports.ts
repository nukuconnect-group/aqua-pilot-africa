import { startOfMonth, startOfQuarter, startOfYear, subDays, format } from 'date-fns';
import { commercialMetrics, type CommercialSale, type CommercialPurchase, type CommercialItem } from './commercialAnalytics';
import type { ReportData } from './reportExportUtils';

export const commercialReportTemplates = [
  { id: 'comprehensive', title: 'Rapport Complet', description: 'Synthèse de l’activité commerciale de l’unité' },
  { id: 'sales', title: 'Rapport des Ventes', description: 'Ventes enregistrées et encaissements associés' },
  { id: 'financial', title: 'Rapport Financier', description: 'Ventes, achats et créances de l’unité' },
  { id: 'purchases', title: 'Rapport des Achats', description: 'Achats enregistrés sur la période' },
  { id: 'products', title: 'Produits Vendus', description: 'Quantités et montants par produit' },
  { id: 'receivables', title: 'Créances Clients', description: 'Soldes restant à encaisser sur les ventes' },
];

export function commercialReportRange(period: string, now = new Date()) {
  const start = period === 'week' ? subDays(now, 6) : period === 'quarter' ? startOfQuarter(now) : period === 'year' ? startOfYear(now) : startOfMonth(now);
  return { start: format(start, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
}

export function buildCommercialReport(input: {
  id: string; unitId: string; unitName: string; start: string; end: string;
  sales: CommercialSale[]; purchases: CommercialPurchase[]; items: CommercialItem[];
  money: (n: number) => string; convert: (n: number, currency: string) => number;
}): ReportData {
  const { id, unitId, start, end, money } = input;
  const sales = input.sales.filter(s => s.unit_id === unitId && s.status !== 'cancelled' && s.date >= start && s.date <= end);
  const purchases = input.purchases.filter(p => p.unit_id === unitId && p.status !== 'cancelled' && p.date >= start && p.date <= end);
  const m = commercialMetrics(sales, purchases, input.items, unitId, start, end, input.convert);
  const sections: ReportData['sections'] = [];
  if (['comprehensive', 'financial', 'sales'].includes(id)) sections.push({ title: 'Synthèse commerciale', type: 'summary', summary: [
    { label: 'Chiffre d’affaires', value: money(m.revenue) }, { label: 'Encaissements des ventes', value: money(m.paid) },
    { label: 'Créances clients', value: money(m.outstanding) }, { label: 'Achats enregistrés', value: money(m.expenses) },
    { label: 'Solde ventes − achats', value: money(m.balance) }, { label: 'Nombre de ventes', value: m.count },
  ] });
  if (['comprehensive', 'sales', 'receivables'].includes(id)) sections.push({ title: id === 'receivables' ? 'Ventes restant à encaisser' : 'Ventes enregistrées', type: 'table', headers: ['Date', 'Référence', 'Vente', 'Encaissé', 'Restant'], rows: sales.flatMap(s => {
    const total = Number(s.total_amount);
    const paid = s.status === 'paid' ? total : Math.min(total, Math.max(0, Number(s.paid_amount) || 0));
    if (id === 'receivables' && total <= paid) return [];
    return [[s.date, s.id, money(total), money(paid), money(total - paid)]];
  }) });
  if (['comprehensive', 'purchases', 'financial'].includes(id)) sections.push({ title: 'Achats enregistrés', type: 'table', headers: ['Date', 'Montant', 'Statut'], rows: purchases.map(p => [p.date, money(input.convert(Number(p.amount), p.currency || 'XOF')), p.status || 'Non renseigné']) });
  if (['comprehensive', 'products'].includes(id)) sections.push({ title: 'Produits vendus', type: 'table', headers: ['Produit', 'Quantité', 'Ventes'], rows: m.products.map(p => [p.name, p.quantity, money(p.total)]) });
  sections.push({ title: 'Périmètre du rapport', type: 'summary', summary: [
    { label: 'Unité', value: input.unitName },
    { label: 'Solde ventes − achats', value: 'Ce solde n’est pas un bénéfice net : les achats incluent du stock et ne couvrent pas toutes les charges.' },
    ...(!sales.length && !purchases.length ? [{ label: 'Données', value: 'Aucune opération enregistrée sur cette période.' }] : []),
  ] });
  return { title: commercialReportTemplates.find(t => t.id === id)?.title || 'Rapport commercial', unitName: input.unitName, period: `${start} au ${end}`, generatedAt: new Date().toLocaleString('fr-FR'), companyInfo: { name: input.unitName }, sections };
}