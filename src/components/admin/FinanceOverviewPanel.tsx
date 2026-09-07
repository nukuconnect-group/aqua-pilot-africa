import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, CreditCard, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Sub {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  start_date: string;
  end_date: string;
  price: number | null;
  currency: string | null;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  trial_discovery: 'Essai',
  annual_basic: 'Basic',
  annual_pro: 'Pro',
  annual_enterprise: 'Enterprise',
};

const formatXOF = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F CFA`;

const FinanceOverviewPanel: React.FC = () => {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, user_id, plan, status, start_date, end_date, price, currency, created_at')
        .order('created_at', { ascending: false });
      setSubs((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const paid = subs.filter((s) => (s.price || 0) > 0);
    const totalRevenue = paid.reduce((sum, s) => sum + (s.price || 0), 0);
    const activeRevenue = paid
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (s.price || 0), 0);

    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthRevenue = paid
      .filter((s) => s.created_at >= monthStart)
      .reduce((sum, s) => sum + (s.price || 0), 0);

    const trials = subs.filter((s) => s.status === 'trial').length;
    const active = subs.filter((s) => s.status === 'active').length;
    const expired = subs.filter((s) => s.status === 'expired' || s.status === 'cancelled').length;
    const suspended = subs.filter((s) => s.status === 'suspended').length;

    // Expiring in next 30 days
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const expiringSoon = subs.filter(
      (s) => s.status === 'active' && new Date(s.end_date) <= in30 && new Date(s.end_date) >= now,
    ).length;

    // Plan breakdown revenue
    const planBreakdown: Record<string, { count: number; revenue: number }> = {};
    paid.forEach((s) => {
      const label = PLAN_LABELS[s.plan] || s.plan;
      if (!planBreakdown[label]) planBreakdown[label] = { count: 0, revenue: 0 };
      planBreakdown[label].count++;
      planBreakdown[label].revenue += s.price || 0;
    });

    // 6-month revenue trend
    const trend = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      const start = startOfMonth(d).toISOString();
      const end = endOfMonth(d).toISOString();
      const revenue = paid
        .filter((s) => s.created_at >= start && s.created_at <= end)
        .reduce((sum, s) => sum + (s.price || 0), 0);
      return { month: format(d, 'MMM yy', { locale: fr }), revenue };
    });

    return {
      totalRevenue,
      activeRevenue,
      monthRevenue,
      trials,
      active,
      expired,
      suspended,
      expiringSoon,
      planBreakdown,
      trend,
    };
  }, [subs]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des données financières...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Revenus totaux</p>
                <p className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-400 truncate">
                  {formatXOF(stats.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Tous abonnements confondus</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Revenus actifs (MRR/ARR)</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatXOF(stats.activeRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.active} abonnements actifs</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Ce mois-ci</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatXOF(stats.monthRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Nouveaux abonnements</p>
              </div>
              <CreditCard className="w-8 h-8 text-aqua-primary shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className={stats.expiringSoon > 0 ? 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Expirent sous 30j</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600">{stats.expiringSoon}</p>
                <p className="text-xs text-muted-foreground mt-1">À renouveler</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évolution des revenus (6 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatXOF(v)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par plan</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.planBreakdown).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun abonnement payant</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.planBreakdown)
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([label, data]) => {
                    const pct = stats.totalRevenue > 0 ? (data.revenue / stats.totalRevenue) * 100 : 0;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{label}</span>
                            <Badge variant="outline" className="text-xs">{data.count}</Badge>
                          </div>
                          <span className="text-muted-foreground">{formatXOF(data.revenue)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Essais</p>
          <p className="text-xl font-bold text-sky-600">{stats.trials}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Actifs</p>
          <p className="text-xl font-bold text-green-600">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Suspendus</p>
          <p className="text-xl font-bold text-orange-600">{stats.suspended}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Expirés</p>
          <p className="text-xl font-bold text-muted-foreground">{stats.expired}</p>
        </CardContent></Card>
      </div>

      {stats.expiringSoon > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">{stats.expiringSoon} abonnement(s) expirent dans les 30 prochains jours.</p>
              <p className="text-muted-foreground">Rendez-vous dans l'onglet Abonnements pour les renouveler.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinanceOverviewPanel;