import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, LogIn, CreditCard, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AccessStats {
  today: number;
  week: number;
  month: number;
  totalActiveSubs: number;
  neverConnected: number;
}

const PLAN_LABELS: Record<string, string> = {
  trial_discovery: 'Essai (30j)',
  annual_basic: 'Basic',
  annual_pro: 'Pro',
  annual_enterprise: 'Enterprise',
  monthly: 'Mensuel',
  annual: 'Annuel',
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--aqua-primary))', '#f59e0b', '#8b5cf6', '#ec4899', '#10b981'];

const AccessStatsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AccessStats>({
    today: 0,
    week: 0,
    month: 0,
    totalActiveSubs: 0,
    neverConnected: 0,
  });
  const [loginsByDay, setLoginsByDay] = useState<{ date: string; logins: number }[]>([]);
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const now = new Date();
      const startToday = startOfDay(now).toISOString();
      const start7d = subDays(startOfDay(now), 7).toISOString();
      const start30d = subDays(startOfDay(now), 30).toISOString();

      // Chargement parallèle
      const [sessions30, subs, profiles] = await Promise.all([
        supabase
          .from('user_sessions')
          .select('user_id, login_at, last_activity_at')
          .gte('login_at', start30d)
          .order('login_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('plan, status')
          .in('status', ['active', 'trial']),
        supabase.from('profiles').select('id'),
      ]);

      if (!alive) return;

      const sessionRows = sessions30.data || [];
      const usersToday = new Set<string>();
      const usersWeek = new Set<string>();
      const usersMonth = new Set<string>();
      const bucket = new Map<string, Set<string>>();

      sessionRows.forEach((s: any) => {
        const t = s.login_at;
        if (t >= startToday) usersToday.add(s.user_id);
        if (t >= start7d) usersWeek.add(s.user_id);
        usersMonth.add(s.user_id);

        const key = format(new Date(t), 'yyyy-MM-dd');
        if (!bucket.has(key)) bucket.set(key, new Set());
        bucket.get(key)!.add(s.user_id);
      });

      // 30 derniers jours
      const daily: { date: string; logins: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, 'yyyy-MM-dd');
        daily.push({
          date: format(d, 'dd/MM', { locale: fr }),
          logins: bucket.get(key)?.size || 0,
        });
      }

      const planCount = new Map<string, number>();
      (subs.data || []).forEach((s: any) => {
        planCount.set(s.plan, (planCount.get(s.plan) || 0) + 1);
      });
      const planData = Array.from(planCount.entries()).map(([plan, count]) => ({
        name: PLAN_LABELS[plan] || plan,
        value: count,
      }));

      const totalUsers = profiles.data?.length || 0;
      const neverConnected = Math.max(0, totalUsers - usersMonth.size);

      setStats({
        today: usersToday.size,
        week: usersWeek.size,
        month: usersMonth.size,
        totalActiveSubs: subs.data?.length || 0,
        neverConnected,
      });
      setLoginsByDay(daily);
      setPlanDistribution(planData);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calcul des statistiques d'accès...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Connectés aujourd'hui</p>
                <p className="text-2xl font-bold text-primary">{stats.today}</p>
              </div>
              <LogIn className="w-7 h-7 text-primary shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Actifs 7 jours</p>
                <p className="text-2xl font-bold">{stats.week}</p>
              </div>
              <TrendingUp className="w-7 h-7 text-aqua-primary shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Actifs 30 jours</p>
                <p className="text-2xl font-bold">{stats.month}</p>
              </div>
              <Users className="w-7 h-7 text-muted-foreground shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Abonnements actifs</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalActiveSubs}</p>
              </div>
              <CreditCard className="w-7 h-7 text-green-600 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Jamais connectés (30j)</p>
                <p className="text-2xl font-bold text-muted-foreground">{stats.neverConnected}</p>
              </div>
              <Badge variant="outline" className="text-xs">inactifs</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Connexions uniques sur 30 jours</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={loginsByDay}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={10} interval={2} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="logins" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition par plan</CardTitle>
          </CardHeader>
          <CardContent>
            {planDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun abonnement actif
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={(e) => `${e.name}: ${e.value}`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {planDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccessStatsPanel;