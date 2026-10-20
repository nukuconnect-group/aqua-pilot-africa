import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useCashSession } from '@/hooks/useCashSession';

/** Clôtures de caisse réelles de l'unité active : fonds, attendu, compté et écart. */
const CashClosures: React.FC = () => {
  const { activeUnit } = useProductionUnits();
  const { formatCurrency } = useSettings();
  const cash = useCashSession(activeUnit?.id);
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Clôtures de caisse</CardTitle></CardHeader>
      <CardContent>
        {cash.error && <p className="text-sm text-destructive mb-2">{cash.error}</p>}
        {!cash.history.length ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune caisse clôturée pour cette unité.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left p-2">Caisse</th><th className="text-left p-2">Ouverture</th><th className="text-left p-2">Clôture</th>
                  <th className="text-right p-2">Fonds</th><th className="text-right p-2">Ventes</th><th className="text-right p-2">Attendu</th>
                  <th className="text-right p-2">Compté</th><th className="text-right p-2">Écart</th>
                </tr>
              </thead>
              <tbody>
                {cash.history.map(s => {
                  const sold = cash.allMovements.filter(m => m.session_id === s.id && m.type === 'sale').reduce((t, m) => t + m.amount, 0);
                  const diff = Number(s.difference ?? 0);
                  return (
                    <tr key={s.id} className="border-b border-border">
                      <td className="p-2 font-medium">{s.name || 'Caisse'}</td>
                      <td className="p-2">{fmt(s.opened_at)}</td><td className="p-2">{fmt(s.closed_at)}</td>
                      <td className="p-2 text-right">{formatCurrency(Number(s.opening_amount))}</td>
                      <td className="p-2 text-right">{formatCurrency(sold)}</td>
                      <td className="p-2 text-right">{formatCurrency(Number(s.expected_amount ?? 0))}</td>
                      <td className="p-2 text-right">{formatCurrency(Number(s.counted_amount ?? 0))}</td>
                      <td className="p-2 text-right"><Badge variant={diff === 0 ? 'secondary' : 'destructive'}>{formatCurrency(diff)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CashClosures;
