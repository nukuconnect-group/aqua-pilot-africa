import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, ChartNoAxesCombined } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/currency';

type SeriesRow = { date: string; revenue: number; expenses: number; paid: number };
type Product = { name: string; total: number; quantity: number };
const colors = ['hsl(var(--primary))', 'hsl(var(--ocean-secondary))', 'hsl(var(--assistant-positive))', 'hsl(var(--muted-foreground))'];
const Empty = () => <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Aucune opération enregistrée sur cette période.</div>;

export default function CommercialCharts({ series, products, view = 'overview' }: { series: SeriesRow[]; products: Product[]; view?: string }) {
  const [mode, setMode] = useState<'curve' | 'bar'>('curve');
  const [visible, setVisible] = useState({ revenue: true, expenses: true, paid: true });
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = (name: string) => {
    const key = ({ Ventes: 'revenue', Achats: 'expenses', Encaissements: 'paid' } as const)[name as 'Ventes' | 'Achats' | 'Encaissements'];
    if (key) setVisible(current => ({ ...current, [key]: !current[key] }));
  };
  const axes = <><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" fontSize={11} minTickGap={24} /><YAxis width={65} fontSize={11} tickFormatter={value => Number(value).toLocaleString('fr-FR', { notation: 'compact' })} /><Tooltip formatter={(value: number) => formatMoney(value)} /><Legend onClick={entry => toggle(String(entry.value))} wrapperStyle={{ cursor: 'pointer' }} /><Brush dataKey="date" height={24} stroke="hsl(var(--primary))" fill="hsl(var(--background))" /></>;
  const keys = view === 'sales' ? ['revenue', 'paid'] as const : view === 'purchases' ? ['expenses'] as const : ['revenue', 'expenses', 'paid'] as const;
  const names = { revenue: 'Ventes', expenses: 'Achats', paid: 'Encaissements' };
  const color = { revenue: colors[0], expenses: colors[1], paid: colors[2] };
  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="min-w-0"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">{view === 'sales' ? 'Évolution des ventes' : view === 'purchases' ? 'Évolution des achats' : 'Évolution commerciale'}</CardTitle><div className="flex gap-1"><Button size="icon" variant={mode === 'curve' ? 'secondary' : 'ghost'} aria-label="Afficher les courbes" title="Courbes" onClick={() => setMode('curve')}><ChartNoAxesCombined className="size-4" /></Button><Button size="icon" variant={mode === 'bar' ? 'secondary' : 'ghost'} aria-label="Afficher les histogrammes" title="Histogrammes" onClick={() => setMode('bar')}><BarChart3 className="size-4" /></Button></div></CardHeader><CardContent>{!series.length ? <Empty /> : <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%">{mode === 'curve' ? <AreaChart data={series}>{axes}{keys.map(key => <Area key={key} type="monotone" dataKey={key} name={names[key]} hide={!visible[key]} stroke={color[key]} fill={color[key]} fillOpacity={0.12} strokeWidth={2} isAnimationActive={animate} />)}</AreaChart> : <BarChart data={series}>{axes}{keys.map(key => <Bar key={key} dataKey={key} name={names[key]} hide={!visible[key]} fill={color[key]} radius={[3, 3, 0, 0]} isAnimationActive={animate} />)}</BarChart>}</ResponsiveContainer></div>}</CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Répartition des ventes par produit</CardTitle></CardHeader><CardContent>{!products.length ? <Empty /> : <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={products} dataKey="total" nameKey="name" innerRadius={55} outerRadius={85} isAnimationActive={animate}>{products.map((product, index) => <Cell key={product.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value: number) => formatMoney(value)} /><Legend /></PieChart></ResponsiveContainer></div>}</CardContent></Card>
    </div>
    <Card className="min-w-0"><CardHeader><CardTitle className="text-base">Produits les plus vendus</CardTitle></CardHeader><CardContent>{!products.length ? <Empty /> : <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={products.slice(0, 8)} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" fontSize={11} /><YAxis dataKey="name" type="category" width={100} fontSize={11} tickFormatter={value => String(value).length > 16 ? `${String(value).slice(0, 15)}…` : String(value)} /><Tooltip formatter={(value: number) => formatMoney(value)} /><Bar dataKey="total" name="Ventes" fill={colors[0]} radius={[0, 4, 4, 0]} isAnimationActive={animate} /></BarChart></ResponsiveContainer></div>}</CardContent></Card>
  </div>;
}