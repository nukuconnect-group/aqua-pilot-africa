import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Factory, Package, Wallet, FolderOpen, Boxes, TrendingUp, FlaskConical, Utensils, Tag,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { StoredBatch, StoredFormulation, StoredIngredient } from './useFeedMill';
import { suggestedSellingPrice } from '@/lib/feedFormulationExport';

interface Props {
  formulations: StoredFormulation[];
  batches: StoredBatch[];
  ingredients: StoredIngredient[];
  onNavigate: (tab: string) => void;
}

const monthKey = (d: string) => new Date(d).toISOString().slice(0, 7);

const FeedMillDashboard: React.FC<Props> = ({ formulations, batches, ingredients, onNavigate }) => {
  const { formatCurrency, activeUnit } = useProductionUnits();
  const { stocks } = useFeedStocks(activeUnit?.id);

  const kpi = useMemo(() => {
    const producedKg = batches.reduce((s, b) => s + Number(b.quantity_kg || 0), 0);
    const totalCost = batches.reduce((s, b) => s + Number(b.total_cost || 0), 0);
    const stockKg = stocks.reduce((s, st) => s + Number(st.quantity || 0), 0);
    const consumedKg = Math.max(0, producedKg - stockKg);
    const avgCost = producedKg > 0 ? totalCost / producedKg : 0;
    return {
      producedKg,
      stockKg,
      consumedKg,
      totalCost,
      avgCost,
      sellingPrice: suggestedSellingPrice(avgCost),
      estimatedValue: suggestedSellingPrice(avgCost) * stockKg,
      formulations: formulations.filter(f => f.status !== 'archived').length,
      batches: batches.length,
      ingredients: ingredients.length,
      rawStockKg: ingredients.reduce((s, i) => s + Number(i.stock_kg || 0), 0),
    };
  }, [batches, stocks, formulations, ingredients]);

  /* Évolution mensuelle de la production */
  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; kg: number; cout: number }>();
    batches.forEach(b => {
      const k = monthKey(b.manufactured_at);
      const row = map.get(k) ?? { month: k, kg: 0, cout: 0 };
      row.kg += Number(b.quantity_kg || 0);
      row.cout += Number(b.total_cost || 0);
      map.set(k, row);
    });
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(r => ({
        ...r,
        kg: Number(r.kg.toFixed(1)),
        cout: Number(r.cout.toFixed(0)),
        label: new Date(`${r.month}-01`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      }));
  }, [batches]);

  /* Principaux ingrédients utilisés (toutes fabrications) */
  const topIngredients = useMemo(() => {
    const map = new Map<string, { name: string; kg: number; cout: number }>();
    batches.forEach(b => {
      (b.lines ?? []).forEach((l: any) => {
        const name = l.name ?? 'Ingrédient';
        const row = map.get(name) ?? { name, kg: 0, cout: 0 };
        row.kg += Number(l.quantity_kg || 0);
        row.cout += Number(l.cost || 0);
        map.set(name, row);
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 8)
      .map(r => ({ ...r, kg: Number(r.kg.toFixed(1)), cout: Number(r.cout.toFixed(0)) }));
  }, [batches]);

  const recent = useMemo(() => batches.slice(0, 6), [batches]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />Tableau de bord général — Fabrication d'aliments
          </CardTitle>
          <CardDescription>
            Vue synthétique de votre activité de fabrication{activeUnit ? ` — ${activeUnit.name}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onNavigate('lab')}><FlaskConical className="w-4 h-4 mr-1.5" />Laboratoire</Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('studio')}><FlaskConical className="w-4 h-4 mr-1.5" />Formuler</Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('formulations')}><FolderOpen className="w-4 h-4 mr-1.5" />Mes formulations</Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('ingredients')}><Boxes className="w-4 h-4 mr-1.5" />Ingrédients</Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('batches')}><Factory className="w-4 h-4 mr-1.5" />Fabrications</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Factory className="w-4 h-4" />} label="Aliments fabriqués" value={`${kpi.producedKg.toFixed(1)} kg`} hint={`${kpi.batches} fabrication(s)`} />
        <Stat icon={<Package className="w-4 h-4" />} label="Aliments en stock" value={`${kpi.stockKg.toFixed(1)} kg`} hint={`${stocks.length} référence(s)`} />
        <Stat icon={<Utensils className="w-4 h-4" />} label="Aliments consommés" value={`${kpi.consumedKg.toFixed(1)} kg`} hint="Fabriqué – stock restant" />
        <Stat icon={<FolderOpen className="w-4 h-4" />} label="Formulations" value={String(kpi.formulations)} hint={`${kpi.ingredients} ingrédients`} />
        <Stat icon={<Wallet className="w-4 h-4" />} label="Coût total de fabrication" value={formatCurrency(kpi.totalCost)} />
        <Stat icon={<Wallet className="w-4 h-4" />} label="Coût moyen / kg" value={formatCurrency(kpi.avgCost)} />
        <Stat icon={<Tag className="w-4 h-4" />} label="Prix estimatif / kg" value={formatCurrency(kpi.sellingPrice)} hint="Coût + 25 %" />
        <Stat icon={<Boxes className="w-4 h-4" />} label="Matières premières en stock" value={`${kpi.rawStockKg.toFixed(1)} kg`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Évolution de la production</CardTitle>
            <CardDescription className="text-xs">Quantités fabriquées et coûts par mois.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {monthly.length === 0 ? (
              <Empty text="Aucune fabrication enregistrée pour l'instant." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="kg" name="Kg fabriqués" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="cout" name="Coût" stroke="hsl(var(--accent-foreground))" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Principaux ingrédients utilisés</CardTitle>
            <CardDescription className="text-xs">Consommation cumulée de matières premières.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {topIngredients.length === 0 ? (
              <Empty text="Les ingrédients apparaîtront après votre première fabrication." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topIngredients} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="kg" name="Kg utilisés" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Dernières fabrications</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {recent.length === 0 ? <Empty text="Aucun lot fabriqué." /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2">Lot</th><th className="py-2">Formulation</th>
                  <th className="py-2 text-right">Kg</th><th className="py-2 text-right">Coût/kg</th>
                </tr></thead>
                <tbody>
                  {recent.map(b => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-1.5">{b.batch_number}</td>
                      <td className="py-1.5">{b.formulation_name}</td>
                      <td className="py-1.5 text-right">{Number(b.quantity_kg).toFixed(1)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(Number(b.cost_per_kg || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stock d'aliments fabriqués</CardTitle>
            <CardDescription className="text-xs">Valeur estimative : {formatCurrency(kpi.estimatedValue)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stocks.length === 0 && <Empty text="Aucun stock d'aliment enregistré pour cette unité." />}
            {stocks.slice(0, 6).map(s => (
              <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.custom_name || s.feed_type}</p>
                  <p className="text-xs text-muted-foreground">{s.supplier ?? '—'}</p>
                </div>
                <Badge variant="outline">{Number(s.quantity || 0).toFixed(1)} {s.unit || 'kg'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: string; hint?: string }> = ({ icon, label, value, hint }) => (
  <Card>
    <CardContent className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <p className="text-lg font-semibold mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </CardContent>
  </Card>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">{text}</div>
);

export default FeedMillDashboard;
