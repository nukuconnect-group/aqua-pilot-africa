import React, { useMemo } from 'react';
import { AlertTriangle, Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import AlgaeCultureMonitoringForm from './AlgaeCultureMonitoringForm';

interface Props { unitId: string; }

// Seuils de culture d'algues (plage générale micro/macroalgues)
const LIMITS = { ph: [6.5, 9.5], temperature: [15, 35], salinity: [0, 40] } as const;

type Rec = Record<string, any>;

export const getAlgaeQualityAlerts = (records: Rec[]) => {
  const alerts: { id: string; basin: string; date: string; message: string; level: 'critical' | 'warning' }[] = [];
  records.forEach((r) => {
    const basin = r.basin_id || '—';
    const push = (message: string, level: 'critical' | 'warning') =>
      alerts.push({ id: `${r.id}-${message}`, basin, date: r.date, message, level });
    if (r.ph != null && (r.ph < LIMITS.ph[0] || r.ph > LIMITS.ph[1])) push(`pH hors norme (${r.ph})`, 'critical');
    if (r.temperature != null && (r.temperature < LIMITS.temperature[0] || r.temperature > LIMITS.temperature[1]))
      push(`Température hors norme (${r.temperature} °C)`, 'warning');
    if (r.oxygen != null && r.oxygen > LIMITS.salinity[1]) push(`Salinité élevée (${r.oxygen} ‰)`, 'warning');
    if (typeof r.notes === 'string' && /Contamination :/i.test(r.notes)) push('Lot contaminé signalé', 'critical');
    if (r.mortality != null && Number(r.mortality) > 0) push(`Pertes de biomasse : ${r.mortality}`, 'warning');
  });
  return alerts.sort((a, b) => (a.date < b.date ? 1 : -1));
};

const AlgaeCultureTracking = ({ unitId }: Props) => {
  const { records, refetch } = useHealthRecords(undefined, unitId);
  const list = (records || []) as Rec[];

  const byBasin = useMemo(() => {
    const map = new Map<string, Rec[]>();
    list.forEach((r) => {
      const k = r.basin_id || '—';
      map.set(k, [...(map.get(k) || []), r]);
    });
    map.forEach((v) => v.sort((a, b) => (a.date < b.date ? 1 : -1)));
    return map;
  }, [list]);

  const alerts = useMemo(() => getAlgaeQualityAlerts(list), [list]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Leaf className="w-5 h-5 text-primary" />Suivi des cultures</CardTitle>
          <AlgaeCultureMonitoringForm unitId={unitId} onRecordCreated={() => refetch?.()} />
        </CardHeader>
        <CardContent className="space-y-4">
          {byBasin.size === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun relevé de culture enregistré pour cette unité.</p>
          )}
          {[...byBasin.entries()].map(([basin, rows]) => (
            <div key={basin} className="border rounded-lg overflow-x-auto">
              <div className="px-3 py-2 bg-muted/50 font-medium text-sm">Lot / bassin : {basin}</div>
              <table className="w-full text-xs sm:text-sm">
                <thead className="text-muted-foreground">
                  <tr><th className="text-left p-2">Date</th><th className="p-2">Biomasse</th><th className="p-2">Densité</th><th className="p-2">pH</th><th className="p-2">Salinité (‰)</th><th className="p-2">T °C</th><th className="p-2">Pertes</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t text-center">
                      <td className="p-2 text-left">{r.date}</td>
                      <td className="p-2">{r.average_weight ?? '—'}</td>
                      <td className="p-2">{r.density ?? '—'}</td>
                      <td className="p-2">{r.ph ?? '—'}</td>
                      <td className="p-2">{r.oxygen ?? '—'}</td>
                      <td className="p-2">{r.temperature ?? '—'}</td>
                      <td className="p-2">{r.mortality ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="w-5 h-5 text-destructive" />Alertes qualité ({alerts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune alerte : tous les paramètres relevés sont dans les normes.</p>
          ) : alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
              <span>{a.date} · {a.basin} — {a.message}</span>
              <Badge variant={a.level === 'critical' ? 'destructive' : 'secondary'}>{a.level === 'critical' ? 'Critique' : 'Attention'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlgaeCultureTracking;
