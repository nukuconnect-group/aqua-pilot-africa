import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sale } from '@/hooks/useSales';
import { useSettings } from '@/contexts/SettingsContext';
import { TrendingUp, Wallet, Clock, Undo2 } from 'lucide-react';
import RevenueByRegister from './RevenueByRegister';

const startOf = (kind: 'day' | 'week' | 'month' | 'year') => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (kind === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (kind === 'month') d.setDate(1);
  if (kind === 'year') { d.setMonth(0); d.setDate(1); }
  return d;
};

const paidOf = (s: Sale) =>
  s.status === 'paid' ? s.totalAmount : s.isCredit ? Math.min(s.paidAmount || 0, s.totalAmount) : 0;

export function computeSalesKpis(sales: Sale[]) {
  const valid = sales.filter((s) => s.status !== 'cancelled');
  const sum = (from: Date) =>
    valid.filter((s) => new Date(s.date) >= from).reduce((a, s) => a + (s.totalAmount || 0), 0);
  const cashed = valid.reduce((a, s) => a + paidOf(s), 0);
  const revenue = valid.reduce((a, s) => a + (s.totalAmount || 0), 0);
  return {
    day: sum(startOf('day')),
    week: sum(startOf('week')),
    month: sum(startOf('month')),
    year: sum(startOf('year')),
    revenue,
    cashed,
    receivables: Math.max(revenue - cashed, 0),
    cancelledCount: sales.length - valid.length,
  };
}

export default function SalesDashboard({ sales }: { sales: Sale[] }) {
  const { formatCurrency } = useSettings();
  const k = useMemo(() => computeSalesKpis(sales), [sales]);
  const periods = [
    ['Aujourd’hui', k.day],
    ['Cette semaine', k.week],
    ['Ce mois', k.month],
    ['Cette année', k.year],
  ] as const;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" /> Chiffre d’affaires réalisé
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {periods.map(([label, v]) => (
            <div key={label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold truncate">{formatCurrency(v)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Wallet className="w-6 h-6 text-primary" />
          <div><p className="text-xs text-muted-foreground">Montant encaissé</p><p className="font-bold">{formatCurrency(k.cashed)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-6 h-6 text-primary" />
          <div><p className="text-xs text-muted-foreground">Créances clients</p><p className="font-bold">{formatCurrency(k.receivables)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Undo2 className="w-6 h-6 text-primary" />
          <div><p className="text-xs text-muted-foreground">Ventes annulées</p><p className="font-bold">{k.cancelledCount}</p></div>
        </CardContent></Card>
      </div>
      <RevenueByRegister />
      <p className="text-xs text-muted-foreground">Les ventes annulées sont exclues du chiffre d’affaires. Une vente à crédit n’est comptée comme encaissée qu’à hauteur des paiements reçus.</p>
    </div>
  );
}

export function CancelledSales({ sales }: { sales: Sale[] }) {
  const { formatCurrency } = useSettings();
  const list = sales.filter((s) => s.status === 'cancelled');
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="flex items-center gap-2 text-base"><Undo2 className="w-4 h-4 text-primary" /> Retours et annulations</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune vente annulée.</p>
        ) : list.map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{s.clientName || 'Client comptoir'}</p>
              <p className="text-xs text-muted-foreground">
                Vente du {new Date(s.date).toLocaleDateString('fr-FR')}
                {s.cancelledAt && ` · annulée le ${new Date(s.cancelledAt).toLocaleDateString('fr-FR')}`}
              </p>
              {s.cancellationReason && <p className="text-xs mt-1">Motif : {s.cancellationReason}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold">{formatCurrency(s.totalAmount)}</p>
              <Badge variant="outline" className="text-xs">Annulée</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
