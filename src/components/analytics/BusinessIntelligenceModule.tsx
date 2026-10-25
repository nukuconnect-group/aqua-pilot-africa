import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyticsDateRange } from '@/lib/analyticsDateRange';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, LineChart as LineIcon, Loader2, TrendingDown, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { formatMoney } from '@/lib/currency';
import CommercialPerformance from './CommercialPerformance';

type PeriodKey = '7' | '30' | '90' | '365' | 'custom';
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v) || 0;
const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2, 160 60% 45%))', 'hsl(var(--chart-3, 30 80% 55%))', 'hsl(var(--chart-4, 280 65% 60%))', 'hsl(var(--chart-5, 340 75% 55%))', 'hsl(var(--muted-foreground))'];

interface RawData {
  sales: { id: string; date: string; total_amount: number; status: string }[];
  purchases: { date: string; amount: number; category: string; status: string | null }[];
  feeding: { date: string; quantity: number; mortality: number | null }[];
  health: { date: string; mortality: number | null }[];
  items: { sale_id: string; name: string; total: number }[];
}

const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

const Kpi = ({ label, value, change, invert = false }: { label: string; value: string; change: number | null; invert?: boolean }) => {
  const good = change === null ? null : invert ? change <= 0 : change >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-lg font-bold sm:text-xl">{value}</p>
        <p className={`mt-1 flex items-center gap-1 text-xs ${good === null ? 'text-muted-foreground' : good ? 'text-primary' : 'text-destructive'}`}>
          {change === null ? 'Pas de comparaison' : <>{change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{change >= 0 ? '+' : ''}{change.toFixed(1)} % vs période précédente</>}
        </p>
      </CardContent>
    </Card>
  );
};

const Empty = () => <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Aucune donnée sur cette période</div>;

const ProductionBusinessIntelligenceModule = () => {
  const { activeUnit } = useProductionUnits();
  const [period, setPeriod] = useState<PeriodKey>('30');
  const [customFrom, setCustomFrom] = useState(iso(new Date(Date.now() - 30 * DAY)));
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [data, setData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const validRange = useMemo(() => analyticsDateRange(period, customFrom, customTo), [period, customFrom, customTo]);
  const range = validRange ?? { start: '', end: '', prevStart: '', days: 0 };
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    if (!validRange || !activeUnit?.id) { setData(null); setLoading(false); setError(null); return; }
    setLoading(true); setError(null);
    setData(null);
    try {
    const scope = <T,>(q: T): T => (activeUnit?.id ? (q as any).eq('unit_id', activeUnit.id) : q);
    const [s, p, f, h] = await Promise.all([
      scope(supabase.from('sales').select('id,date,total_amount,status').gte('date', range.prevStart).lte('date', range.end).limit(5000)),
      scope(supabase.from('purchases').select('date,amount,category,status').gte('date', range.prevStart).lte('date', range.end).limit(5000)),
      scope(supabase.from('feeding_records').select('date,quantity,mortality').gte('date', range.prevStart).lte('date', range.end).limit(5000)),
      scope(supabase.from('health_records').select('date,mortality').gte('date', range.prevStart).lte('date', range.end).limit(5000)),
    ]);
    const err = s.error || p.error || f.error || h.error;
    if (err) throw err;
    const sales = ((s.data ?? []) as RawData['sales']).filter((x) => x.status !== 'cancelled');
    const curIds = sales.filter((x) => x.date >= range.start).map((x) => x.id);
    let items: RawData['items'] = [];
    if (curIds.length) {
      const { data: it, error: itemError } = await supabase.from('sale_items').select('sale_id,name,total').in('sale_id', curIds.slice(0, 500));
      if (itemError) throw itemError;
      items = (it ?? []) as RawData['items'];
    }
    if (request === requestId.current) setData({ sales, purchases: ((p.data ?? []) as RawData['purchases']).filter((x) => x.status !== 'cancelled'), feeding: (f.data ?? []) as RawData['feeding'], health: (h.data ?? []) as RawData['health'], items });
    } catch {
      if (request === requestId.current) setError('Les données d’analyse sont indisponibles. Vérifiez votre connexion puis réessayez.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [activeUnit?.id, validRange]);

  useEffect(() => { void load(); return () => { requestId.current += 1; }; }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;
    const isCur = (d: string) => d >= range.start && d <= range.end;
    const isPrev = (d: string) => d >= range.prevStart && d < range.start;
    const sum = <T,>(arr: T[], pick: (x: T) => number, filt: (x: T) => boolean) => arr.filter(filt).reduce((a, x) => a + pick(x), 0);
    const rev = [sum(data.sales, (x) => num(x.total_amount), (x) => isCur(x.date)), sum(data.sales, (x) => num(x.total_amount), (x) => isPrev(x.date))];
    const exp = [sum(data.purchases, (x) => num(x.amount), (x) => isCur(x.date)), sum(data.purchases, (x) => num(x.amount), (x) => isPrev(x.date))];
    const feed = [sum(data.feeding, (x) => num(x.quantity), (x) => isCur(x.date)), sum(data.feeding, (x) => num(x.quantity), (x) => isPrev(x.date))];
    const mort = [
      sum(data.feeding, (x) => num(x.mortality), (x) => isCur(x.date)) + sum(data.health, (x) => num(x.mortality), (x) => isCur(x.date)),
      sum(data.feeding, (x) => num(x.mortality), (x) => isPrev(x.date)) + sum(data.health, (x) => num(x.mortality), (x) => isPrev(x.date)),
    ];
    const margin = [rev[0] - exp[0], rev[1] - exp[1]];
    const monthly = range.days > 62;
    const bucket = (d: string) => (monthly ? d.slice(0, 7) : d);
    const series: Record<string, { label: string; ca: number; depenses: number; mortalite: number }> = {};
    const add = (d: string, k: 'ca' | 'depenses' | 'mortalite', v: number) => { if (!isCur(d)) return; const b = bucket(d); series[b] ??= { label: b, ca: 0, depenses: 0, mortalite: 0 }; series[b][k] += v; };
    data.sales.forEach((x) => add(x.date, 'ca', num(x.total_amount)));
    data.purchases.forEach((x) => add(x.date, 'depenses', num(x.amount)));
    data.feeding.forEach((x) => add(x.date, 'mortalite', num(x.mortality)));
    data.health.forEach((x) => add(x.date, 'mortalite', num(x.mortality)));
    const cats: Record<string, number> = {};
    data.purchases.filter((x) => isCur(x.date)).forEach((x) => { cats[x.category || 'Autre'] = (cats[x.category || 'Autre'] ?? 0) + num(x.amount); });
    const prods: Record<string, number> = {};
    data.items.forEach((x) => { prods[x.name] = (prods[x.name] ?? 0) + num(x.total); });
    return {
      rev, exp, feed, mort, margin,
      series: Object.values(series).sort((a, b) => a.label.localeCompare(b.label)),
      cats: Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
      prods: Object.entries(prods).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
    };
  }, [data, range]);

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><Brain className="size-6 text-primary" />Intelligence & Analyse</h1>
        <p className="text-sm text-muted-foreground">{activeUnit ? `Unité : ${activeUnit.name}` : 'Toutes les unités'} · données réelles enregistrées</p>
      </div>
      <Tabs defaultValue="bi">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="bi"><LineIcon className="mr-1 size-4" />Tableau de bord BI</TabsTrigger>
          <TabsTrigger value="forecast"><Brain className="mr-1 size-4" />Prévisions IA</TabsTrigger>
        </TabsList>

        <TabsContent value="bi" className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 derniers jours</SelectItem>
                <SelectItem value="30">30 derniers jours</SelectItem>
                <SelectItem value="90">3 derniers mois</SelectItem>
                <SelectItem value="365">12 derniers mois</SelectItem>
                <SelectItem value="custom">Personnalisée</SelectItem>
              </SelectContent>
            </Select>
            {period === 'custom' && <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" aria-label="Date de début" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" aria-label="Date de fin" />
            </>}
            {validRange && <p className="text-xs text-muted-foreground">Comparée à la période précédente de même durée ({range.days} j)</p>}
          </div>

          {!validRange && <p role="alert" className="text-sm text-destructive">Choisissez des dates valides : la fin doit suivre le début.</p>}
          {!activeUnit?.id && <p className="text-sm text-muted-foreground">Sélectionnez une unité pour consulter ses analyses.</p>}
          {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => void load()}>Réessayer</Button></div>}
          {loading ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : !stats ? null : <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Kpi label="Chiffre d'affaires" value={formatMoney(stats.rev[0])} change={pct(stats.rev[0], stats.rev[1])} />
              <Kpi label="Dépenses (achats)" value={formatMoney(stats.exp[0])} change={pct(stats.exp[0], stats.exp[1])} invert />
              <Kpi label="Résultat" value={formatMoney(stats.margin[0])} change={stats.margin[1] !== 0 ? ((stats.margin[0] - stats.margin[1]) / Math.abs(stats.margin[1])) * 100 : null} />
              <Kpi label="Rentabilité (marge)" value={stats.rev[0] > 0 ? `${((stats.margin[0] / stats.rev[0]) * 100).toFixed(1)} %` : 'Non calculable'} change={null} />
              <Kpi label="Aliment distribué" value={`${stats.feed[0].toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`} change={pct(stats.feed[0], stats.feed[1])} />
              <Kpi label="Mortalités" value={stats.mort[0].toLocaleString('fr-FR')} change={pct(stats.mort[0], stats.mort[1])} invert />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">Chiffre d'affaires vs dépenses</CardTitle></CardHeader>
                <CardContent>{stats.series.length ? <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={stats.series}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={60} /><Tooltip formatter={(v: number) => formatMoney(v)} /><Legend />
                    <Area type="monotone" dataKey="ca" name="CA" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} />
                    <Area type="monotone" dataKey="depenses" name="Dépenses" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.15} />
                    <Brush dataKey="label" height={24} stroke="hsl(var(--primary))" fill="hsl(var(--background))" />
                  </AreaChart></ResponsiveContainer> : <Empty />}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Répartition des dépenses</CardTitle></CardHeader>
                <CardContent>{stats.cats.length ? <ResponsiveContainer width="100%" height={240}>
                  <PieChart><Pie data={stats.cats} dataKey="value" nameKey="name" outerRadius={85} label={({ name }) => name}>{stats.cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatMoney(v)} /></PieChart>
                </ResponsiveContainer> : <Empty />}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Meilleurs produits</CardTitle></CardHeader>
                <CardContent>{stats.prods.length ? <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.prods} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="name" width={90} fontSize={11} /><Tooltip formatter={(v: number) => formatMoney(v)} /><Bar dataKey="value" name="Ventes" fill={COLORS[0]} radius={4} /></BarChart>
                </ResponsiveContainer> : <Empty />}</CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">Mortalités dans le temps</CardTitle></CardHeader>
                <CardContent>{stats.series.some((s) => s.mortalite > 0) ? <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats.series}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip /><Line type="monotone" dataKey="mortalite" name="Mortalités" stroke={COLORS[4]} strokeWidth={2} dot={false} /></LineChart>
                </ResponsiveContainer> : <Empty />}</CardContent>
              </Card>
            </div>
          </>}
        </TabsContent>

        <TabsContent value="forecast"><ForecastPanel unitId={activeUnit?.id} unitName={activeUnit?.name} /></TabsContent>
      </Tabs>
    </div>
  );
};

interface ForecastResult {
  history: { month: string; revenue: number; expenses: number }[];
  forecast: { month: string; revenue: number; expenses: number }[];
  summary: string; risks: string[]; recommendations: string[]; confidence?: string | null; insufficient?: boolean;
}

const ForecastPanel = ({ unitId, unitName }: { unitId?: string; unitName?: string }) => {
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setResult(null); setError(null); }, [unitId]);

  const run = async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.functions.invoke('ai-forecast', { body: { unitId, unitName } });
    setLoading(false);
    if (err || data?.error) {
      let msg = data?.error as string | undefined;
      try { msg ||= (await (err as any)?.context?.json?.())?.error; } catch { /* ignore */ }
      setError(msg || 'Impossible de générer la prévision.');
      return;
    }
    setResult(data as ForecastResult);
  };

  const chart = result ? [
    ...result.history.map((h) => ({ month: h.month, ca: h.revenue, depenses: h.expenses, caPrev: null as number | null })),
    ...result.forecast.map((f) => ({ month: f.month, ca: null as number | null, depenses: null as number | null, caPrev: f.revenue })),
  ] : [];
  if (result && result.forecast.length && result.history.length) {
    const lastIdx = result.history.length - 1;
    chart[lastIdx].caPrev = result.history[lastIdx].revenue;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prévisions IA des 3 prochains mois</CardTitle>
          <CardDescription>L'IA analyse vos 12 derniers mois réels (ventes, achats, alimentation) de {unitName || 'toutes les unités'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={run} disabled={loading}>{loading ? <><Loader2 className="mr-2 size-4 animate-spin" />Analyse en cours…</> : <><Brain className="mr-2 size-4" />Générer les prévisions</>}</Button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && <>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Historique et prévision du CA</CardTitle>{result.confidence && <CardDescription>Fiabilité estimée : {result.confidence}</CardDescription>}</CardHeader>
          <CardContent><ResponsiveContainer width="100%" height={280}>
            <LineChart data={chart}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={60} /><Tooltip formatter={(v: number) => formatMoney(v)} /><Legend />
              <Line type="monotone" dataKey="ca" name="CA réel" stroke={COLORS[0]} strokeWidth={2} connectNulls={false} />
              <Line type="monotone" dataKey="depenses" name="Dépenses réelles" stroke={COLORS[2]} strokeWidth={2} />
              <Line type="monotone" dataKey="caPrev" name="CA prévu" stroke={COLORS[0]} strokeDasharray="6 4" strokeWidth={2} />
              <Brush dataKey="month" height={24} stroke="hsl(var(--primary))" fill="hsl(var(--background))" />
            </LineChart></ResponsiveContainer></CardContent>
        </Card>
        <Card><CardContent className="space-y-3 p-4">
          <p className="text-sm">{result.summary}</p>
          {result.forecast.length > 0 && <div className="grid gap-2 sm:grid-cols-3">{result.forecast.map((f) => <div key={f.month} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{f.month}</p><p className="font-bold">{formatMoney(f.revenue)}</p><p className="text-xs text-muted-foreground">Dépenses {formatMoney(f.expenses)}</p></div>)}</div>}
          {result.risks.length > 0 && <div><p className="flex items-center gap-1 text-sm font-semibold"><AlertTriangle className="size-4 text-destructive" />Risques</p><ul className="ml-5 list-disc text-sm">{result.risks.map((r) => <li key={r}>{r}</li>)}</ul></div>}
          {result.recommendations.length > 0 && <div><p className="flex items-center gap-1 text-sm font-semibold"><Lightbulb className="size-4 text-primary" />Recommandations</p><ul className="ml-5 list-disc text-sm">{result.recommendations.map((r) => <li key={r}>{r}</li>)}</ul></div>}
        </CardContent></Card>
      </>}
    </div>
  );
};

const BusinessIntelligenceModule = () => {
  const { activeUnit } = useProductionUnits();
  return activeUnit?.type === 'commercialisation' ? <CommercialPerformance title="Intelligence & Analyse" presentation="intelligence" /> : <ProductionBusinessIntelligenceModule />;
};
export default BusinessIntelligenceModule;
