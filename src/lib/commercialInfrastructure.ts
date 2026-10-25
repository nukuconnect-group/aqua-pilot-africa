import { isCommercialStock } from './stockPurpose';

export const COMMERCIAL_INFRASTRUCTURE_TYPES = [
  { value: 'chambre_froide', label: 'Chambre froide' },
  { value: 'chambre_froide_positive', label: 'Chambre froide positive' },
  { value: 'chambre_froide_negative', label: 'Chambre froide négative' },
  { value: 'tunnel_congelation', label: 'Tunnel de congélation' },
  { value: 'four_fumage', label: 'Four de fumage' },
  { value: 'four_sechage', label: 'Four de séchage' },
  { value: 'table_decoupe', label: 'Table de découpe' },
  { value: 'machine_filetage', label: 'Machine de filetage' },
  { value: 'balance', label: 'Balance' },
  { value: 'emballeuse', label: 'Machine d’emballage' },
  { value: 'materiel', label: 'Matériel / outillage' },
  { value: 'materiaux', label: 'Matériaux' },
];

export const isColdStorage = (type: string) =>
  ['chambre_froide', 'chambre_froide_positive', 'chambre_froide_negative', 'tunnel_congelation', 'congelateur', 'frigo_standard'].includes(type);

type StockLink = { id: string; unit_id: string; stock_purpose?: string | null; notes?: string | null };
type InfrastructureLink = { id: string; unitId: string; specifications: Record<string, unknown> };

export function availableCommercialLots<T extends StockLink>(stocks: T[], unitId: string, infrastructures: InfrastructureLink[], currentId?: string): T[] {
  return stocks.filter(stock => stock.unit_id === unitId && isCommercialStock(stock) && !infrastructures.some(infra =>
    infra.unitId === unitId && infra.id !== currentId && infra.specifications.attachedStockId === stock.id));
}

export interface TemperatureObservation { id: string; basin_id?: string | null; unit_id?: string | null; temperature: number | null; created_at?: string; date: string }
export function temperatureSeries(records: TemperatureObservation[], unitId: string, infrastructureId: string) {
  return records.filter(r => r.unit_id === unitId && r.basin_id === infrastructureId && r.temperature !== null && Number.isFinite(Number(r.temperature)))
    .map(r => ({ id: r.id, time: new Date(r.created_at || r.date).getTime(), value: Number(r.temperature) }))
    .filter(r => Number.isFinite(r.time)).sort((a, b) => a.time - b.time);
}

export function temperatureSummary(points: { time: number; value: number }[], min?: number, max?: number) {
  if (!points.length) return null;
  const values = points.map(p => p.value);
  const latest = points[points.length - 1];
  return {
    latest, min: Math.min(...values), max: Math.max(...values),
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    variation: latest.value - points[0].value,
    observedHours: (latest.time - points[0].time) / 3600000,
    outsideCount: points.filter(p => (min !== undefined && p.value < min) || (max !== undefined && p.value > max)).length,
  };
}