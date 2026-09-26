import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Printer, Save, AlertTriangle, Info } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useSales } from '@/hooks/useSales';
import { useEmployees } from '@/hooks/useEmployees';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/currency';
import { npv, irr, monthsBetween, pct, DatedFlow } from '@/lib/financeMath';

const NA = 'Indicateur non calculable avec les données disponibles.';
const MISSING = 'Donnée non renseignée';
const CHART = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--accent-foreground))', 'hsl(var(--muted-foreground))', 'hsl(var(--secondary-foreground))', 'hsl(var(--ring))'];

type Post = 'alevins' | 'aliments' | 'medicaments' | 'energie' | 'eau' | 'transport' | 'salaires' | 'maintenance' | 'consommables' | 'autres';
const POSTS: { key: Post; label: string; kw: RegExp }[] = [
  { key: 'alevins', label: 'Alevins / semences', kw: /alevin|juvénile|juvenile|souche|inocul|semence|géniteur/i },
  { key: 'aliments', label: 'Aliments / intrants', kw: /aliment|feed|nutri|fertil|provende|granul/i },
  { key: 'medicaments', label: 'Médicaments & sanitaires', kw: /médic|medic|sanit|vaccin|traitement|désinf|desinf|véto|veto/i },
  { key: 'energie', label: 'Énergie', kw: /énerg|energ|électr|electr|carbur|gasoil|essence|fuel|solaire/i },
  { key: 'eau', label: 'Eau', kw: /\beau\b|water|forage/i },
  { key: 'transport', label: 'Transport', kw: /transport|livraison|fret|logist/i },
  { key: 'salaires', label: 'Salaires / main-d’œuvre', kw: /salaire|paie|main.d|personnel|journalier/i },
  { key: 'maintenance', label: 'Maintenance', kw: /mainten|répar|repar|entretien/i },
  { key: 'consommables', label: 'Consommables', kw: /consomm|emballage|fourniture|matériel|materiel|équip|equip|outil/i },
  { key: 'autres', label: 'Autres charges', kw: /.*/ },
];
const classify = (text: string): Post => POSTS.find(p => p.kw.test(text))!.key;

const BUDGET_FIELDS: { key: string; label: string; group: 'produits' | 'charges' | 'invest' }[] = [
  { key: 'qty_planned', label: 'Quantité produite prévue (kg)', group: 'produits' },
  { key: 'qty_sellable', label: 'Quantité vendable prévue (kg)', group: 'produits' },
  { key: 'price_planned', label: 'Prix de vente prévu (/kg)', group: 'produits' },
  { key: 'other_revenue', label: 'Autres recettes prévues', group: 'produits' },
  ...POSTS.map(p => ({ key: `c_${p.key}`, label: p.label, group: 'charges' as const })),
  { key: 'i_construction', label: 'Construction / bassins / étangs', group: 'invest' },
  { key: 'i_equipment', label: 'Pompes, aérateurs, équipements', group: 'invest' },
  { key: 'i_iot', label: 'Capteurs IoT', group: 'invest' },
  { key: 'i_other', label: 'Autres immobilisations', group: 'invest' },
];

const inRange = (d: string, from: string, to: string) => !!d && d.slice(0, 10) >= from && d.slice(0, 10) <= to;
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const CycleFinancialReport: React.FC = () => {
  const { activeUnit, purchases, transactions, depreciableAssets } = useProductionUnits();
  const { cycles } = useProductionCycles(activeUnit?.id);
  const { allSales } = useSales();
  const { allPaySlips } = useEmployees();
  const { toast } = useToast();
  const [cycleId, setCycleId] = useState<string>('');
  const [budget, setBudget] = useState<Record<string, number>>({});
  const [initialCash, setInitialCash] = useState(0);
  const [rate, setRate] = useState(10);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!cycleId && cycles.length) setCycleId(cycles[0].id); }, [cycles, cycleId]);
  const cycle = cycles.find(c => c.id === cycleId);

  useEffect(() => {
    if (!cycleId) return;
    (supabase as any).from('cycle_budgets').select('*').eq('cycle_id', cycleId).maybeSingle().then(({ data }: any) => {
      setBudget((data?.lines as Record<string, number>) || {});
      setInitialCash(n(data?.initial_cash));
      setRate(data ? n(data.discount_rate) : 10);
    });
  }, [cycleId]);

  const saveBudget = async () => {
    if (!cycle || !activeUnit) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('cycle_budgets').upsert(
      { user_id: user?.id, unit_id: activeUnit.id, cycle_id: cycle.id, lines: budget, initial_cash: initialCash, discount_rate: rate },
      { onConflict: 'user_id,cycle_id' });
    setSaving(false);
    toast(error ? { title: 'Enregistrement impossible', description: error.message, variant: 'destructive' } : { title: 'Prévisionnel enregistré' });
  };

  const r = useMemo(() => {
    if (!cycle || !activeUnit) return null;
    const from = cycle.start_date?.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const to = (cycle.end_date && cycle.end_date < today ? cycle.end_date : today).slice(0, 10);
    const unitId = activeUnit.id;

    const sales = allSales.filter(s => s.unitId === unitId && s.documentType !== 'proforma' && inRange(s.date, from, to));
    const salesRows = sales.map(s => {
      const qty = s.products.reduce((a, p) => a + p.quantity, 0);
      const cashed = s.isCredit ? n(s.paidAmount) : (s.status === 'pending' ? n(s.paidAmount) : s.totalAmount);
      return { ...s, qty, cashed, remaining: Math.max(0, s.totalAmount - cashed), pricePerKg: qty ? s.totalAmount / qty : null };
    });
    const purch = purchases.filter(p => p.unitId === unitId && p.status !== 'cancelled' && inRange(p.date, from, to)).map(p => {
      const paid = p.isCredit ? n(p.paidAmount) : (p.status === 'received' ? p.amount : n(p.paidAmount));
      return { ...p, post: classify(`${p.category} ${p.subcategory || ''} ${p.description}`), paid, due: Math.max(0, p.amount - paid) };
    });
    const txs = transactions.filter(t => t.unitId === unitId && t.status !== 'cancelled' && !t.purchaseId && inRange(t.date, from, to));
    const revTx = txs.filter(t => t.type === 'revenue');
    const expTx = txs.filter(t => t.type === 'expense').map(t => ({ ...t, post: classify(`${t.category} ${t.description}`) }));
    const slips = allPaySlips.filter(p => p.unitId === unitId && p.period && p.period.slice(0, 7) >= from.slice(0, 7) && p.period.slice(0, 7) <= to.slice(0, 7));
    const assets = depreciableAssets.filter(a => a.unitId === unitId && a.status !== 'disposed' && a.purchaseDate <= to);

    const days = Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 86400000);
    const assetRows = assets.map(a => {
      const annual = a.usefulLife ? a.purchasePrice / a.usefulLife : 0;
      const start = a.purchaseDate > from ? a.purchaseDate : from;
      const periodDays = Math.max(0, (new Date(to).getTime() - new Date(start).getTime()) / 86400000);
      const period = annual * periodDays / 365;
      const cumulDays = Math.max(0, (new Date(to).getTime() - new Date(a.purchaseDate).getTime()) / 86400000);
      const cumul = Math.min(a.purchasePrice, annual * cumulDays / 365);
      return { ...a, annual, period, cumul, nbv: a.purchasePrice - cumul };
    });

    const byPost: Record<Post, number> = Object.fromEntries(POSTS.map(p => [p.key, 0])) as any;
    purch.forEach(p => { byPost[p.post] += p.amount; });
    expTx.forEach(t => { byPost[t.post] += t.amount; });
    const laborCost = slips.reduce((a, s) => a + s.baseSalary + s.overtime + s.bonuses, 0);
    byPost.salaires += laborCost;

    const ca = sales.reduce((a, s) => a + s.totalAmount, 0);
    const otherRev = revTx.reduce((a, t) => a + t.amount, 0);
    const totalProduits = ca + otherRev;
    const opCharges = Object.values(byPost).reduce((a, b) => a + b, 0);
    const depreciation = assetRows.reduce((a, x) => a + x.period, 0);
    const variable = byPost.alevins + byPost.aliments + byPost.medicaments;
    const margeBrute = ca - variable;
    const resultatExpl = totalProduits - opCharges;
    const resultatNet = resultatExpl - depreciation;
    const invest = assets.reduce((a, x) => a + x.purchasePrice, 0);
    const qtySold = salesRows.reduce((a, s) => a + s.qty, 0);
    const qtyProduced = n(cycle.current_quantity) || null;

    const cashIn = salesRows.reduce((a, s) => a + s.cashed, 0) + otherRev;
    const outPurch = purch.reduce((a, p) => a + p.paid, 0);
    const outTx = expTx.reduce((a, t) => a + t.amount, 0);
    const outSal = slips.reduce((a, s) => a + s.netSalary, 0);
    const outInvest = assets.filter(a => a.purchaseDate >= from).reduce((a, x) => a + x.purchasePrice, 0);
    const cashOut = outPurch + outTx + outSal + outInvest;
    const cashFinal = initialCash + cashIn - cashOut;
    const receivables = salesRows.reduce((a, s) => a + s.remaining, 0);
    const payables = purch.reduce((a, p) => a + p.due, 0);

    // Flux datés
    type Ev = { date: string; inflow: number; outflow: number };
    const evs: Ev[] = [
      ...salesRows.map(s => ({ date: s.date, inflow: s.cashed, outflow: 0 })),
      ...revTx.map(t => ({ date: t.date, inflow: t.amount, outflow: 0 })),
      ...purch.map(p => ({ date: p.date, inflow: 0, outflow: p.paid })),
      ...expTx.map(t => ({ date: t.date, inflow: 0, outflow: t.amount })),
      ...slips.map(s => ({ date: `${s.period.slice(0, 7)}-28`, inflow: 0, outflow: s.netSalary })),
      ...assets.filter(a => a.purchaseDate >= from).map(a => ({ date: a.purchaseDate, inflow: 0, outflow: a.purchasePrice })),
    ];
    const keyOf = (d: string, g: 'day' | 'week' | 'month') => {
      if (g === 'day') return d.slice(0, 10);
      if (g === 'month') return d.slice(0, 7);
      const dt = new Date(d); const w = new Date(dt); w.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      return `Sem. ${w.toISOString().slice(0, 10)}`;
    };
    const buckets = (g: 'day' | 'week' | 'month') => {
      const m = new Map<string, { inflow: number; outflow: number }>();
      evs.forEach(e => { const k = keyOf(e.date, g); const b = m.get(k) || { inflow: 0, outflow: 0 }; b.inflow += e.inflow; b.outflow += e.outflow; m.set(k, b); });
      let cum = initialCash;
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, b]) => { cum += b.inflow - b.outflow; return { period, ...b, net: b.inflow - b.outflow, cumul: cum }; });
    };

    // VAN / TRI : investissement initial à t0 (+ immobilisations antérieures), flux mensuels réels
    const priorInvest = assets.filter(a => a.purchaseDate < from).reduce((a, x) => a + x.purchasePrice, 0);
    const monthly = buckets('month');
    const flows: DatedFlow[] = [];
    if (priorInvest) flows.push({ months: 0, amount: -priorInvest });
    monthly.forEach(mb => flows.push({ months: Math.max(0, monthsBetween(from, `${mb.period}-15`)), amount: mb.net }));
    const van = flows.length >= 2 ? npv(rate / 100, flows) : null;
    const tri = irr(flows);

    // Prévisionnel
    const b = (k: string) => n(budget[k]);
    const hasBudget = Object.values(budget).some(v => n(v) > 0);
    const caPrev = b('qty_sellable') * b('price_planned');
    const chargesPrev = POSTS.reduce((a, p) => a + b(`c_${p.key}`), 0);
    const produitsPrev = caPrev + b('other_revenue');
    const investPrev = b('i_construction') + b('i_equipment') + b('i_iot') + b('i_other');

    const compare = [
      { label: 'Production (kg)', prev: b('qty_planned'), real: qtyProduced ?? 0, money: false, isCharge: false },
      { label: 'Quantité vendue', prev: b('qty_sellable'), real: qtySold, money: false, isCharge: false },
      { label: 'Chiffre d’affaires', prev: caPrev, real: ca, money: true, isCharge: false },
      { label: 'Autres recettes', prev: b('other_revenue'), real: otherRev, money: true, isCharge: false },
      ...POSTS.map(p => ({ label: p.label, prev: b(`c_${p.key}`), real: byPost[p.key], money: true, isCharge: true })),
      { label: 'Investissements', prev: investPrev, real: invest, money: true, isCharge: true },
      { label: 'Résultat', prev: produitsPrev - chargesPrev, real: resultatExpl, money: true, isCharge: false },
    ];
    const observations: string[] = [];
    if (hasBudget) compare.forEach(c => {
      if (!c.prev) return;
      const e = ((c.real - c.prev) / Math.abs(c.prev)) * 100;
      if (Math.abs(e) >= 5) observations.push(`${c.label} : ${e > 0 ? 'supérieur' : 'inférieur'} de ${Math.abs(e).toFixed(1)} % aux prévisions.`);
    });
    const topPost = POSTS.map(p => ({ ...p, v: byPost[p.key] })).sort((a, b2) => b2.v - a.v)[0];
    if (opCharges > 0 && topPost.v > 0) observations.unshift(`${topPost.label} représente ${((topPost.v / opCharges) * 100).toFixed(1)} % des charges du cycle.`);
    observations.push(hasBudget ? `Chiffre d’affaires réalisé : ${formatMoney(ca)} contre ${formatMoney(caPrev)} prévus.` : 'Aucun prévisionnel saisi : les écarts ne peuvent pas être calculés.');
    observations.push(`Trésorerie disponible à la date du rapport : ${formatMoney(cashFinal)}.`);

    const today0 = today;
    const daily = {
      sales: sales.filter(s => s.date.slice(0, 10) === today0).reduce((a, s) => a + s.totalAmount, 0),
      cashed: salesRows.filter(s => s.date.slice(0, 10) === today0).reduce((a, s) => a + s.cashed, 0),
      purchases: purch.filter(p => p.date.slice(0, 10) === today0).reduce((a, p) => a + p.amount, 0),
      expenses: expTx.filter(t => t.date.slice(0, 10) === today0).reduce((a, t) => a + t.amount, 0),
      receivables: salesRows.filter(s => s.date.slice(0, 10) === today0).reduce((a, s) => a + s.remaining, 0),
      payables: purch.filter(p => p.date.slice(0, 10) === today0).reduce((a, p) => a + p.due, 0),
    };

    const totalCost = opCharges + depreciation;
    return {
      from, to, days, salesRows, purch, expTx, revTx, slips, assetRows, byPost, laborCost, ca, otherRev, totalProduits, opCharges,
      depreciation, margeBrute, resultatExpl, resultatNet, invest, qtySold, qtyProduced, cashIn, cashOut, cashFinal, receivables, payables,
      outPurch, outTx, outSal, outInvest, buckets, van, tri, flows, priorInvest, compare, observations, hasBudget, caPrev, chargesPrev, produitsPrev, investPrev,
      daily, totalCost,
      costPerKg: qtyProduced ? totalCost / qtyProduced : (qtySold ? totalCost / qtySold : null),
      avgPrice: qtySold ? ca / qtySold : null,
      resultPerKg: qtyProduced ? resultatNet / qtyProduced : (qtySold ? resultatNet / qtySold : null),
      roi: invest ? (resultatNet / invest) * 100 : null,
      breakEven: margeBrute > 0 && ca > 0 ? (opCharges - variable + depreciation) / (margeBrute / ca) : null,
      committed: purch.reduce((a, p) => a + p.amount, 0) + outTx + outSal,
      paidOut: cashOut,
      expectedIn: ca + otherRev,
    };
  }, [cycle, activeUnit, allSales, purchases, transactions, allPaySlips, depreciableAssets, budget, initialCash, rate]);

  if (!activeUnit) return <Alert><AlertDescription>Sélectionnez une unité de production pour générer le rapport financier.</AlertDescription></Alert>;
  if (!cycles.length) return <Alert><AlertDescription>Aucun cycle enregistré pour cette unité. Créez un cycle dans le module Production.</AlertDescription></Alert>;

  const M = (v: number | null | undefined) => (v === null || v === undefined ? <span className="text-muted-foreground italic text-xs">{NA}</span> : formatMoney(v));
  const P = (v: number | null) => (v === null ? <span className="text-muted-foreground italic text-xs">{NA}</span> : `${v.toFixed(1)} %`);
  const Kpi = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
    <div className="rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><div className="text-base font-semibold mt-1">{value}</div>{hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}</div>
  );
  const flowRows = r ? r.buckets(granularity) : [];
  const pieData = r ? POSTS.map(p => ({ name: p.label, value: r.byPost[p.key] })).filter(x => x.value > 0) : [];

  return (
    <div className="space-y-4 print:space-y-2">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Rapport financier du cycle</CardTitle>
              <CardDescription>{activeUnit.name}{r ? ` — période du ${r.from} au ${r.to}` : ''}. Toutes les valeurs proviennent des données enregistrées.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => window.print()} className="print:hidden"><Printer className="w-4 h-4 mr-2" />Imprimer / PDF</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 print:hidden">
            <div><Label>Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.species ? ` — ${c.species}` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Trésorerie initiale</Label><Input type="number" value={initialCash} onChange={e => setInitialCash(n(e.target.value))} /></div>
            <div><Label>Taux d’actualisation (%/an)</Label><Input type="number" step="0.5" value={rate} onChange={e => setRate(n(e.target.value))} /></div>
          </div>
        </CardHeader>
      </Card>

      {r && (
        <Tabs defaultValue="synthese">
          <TabsList className="flex flex-wrap h-auto print:hidden">
            {[['synthese', 'Synthèse'], ['previsionnel', 'Prévisionnel vs réalisé'], ['exploitation', 'Compte d’exploitation'], ['ventes', 'Ventes'], ['achats', 'Achats & frais'], ['mo', 'Main-d’œuvre'], ['amort', 'Amortissements'], ['treso', 'Trésorerie & flux'], ['renta', 'Rentabilité, VAN, TRI'], ['jour', 'Journalier']].map(([v, l]) => <TabsTrigger key={v} value={v} className="text-xs">{l}</TabsTrigger>)}
          </TabsList>

          <TabsContent value="synthese" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Investissement initial" value={r.invest ? formatMoney(r.invest) : MISSING} />
              <Kpi label="Chiffre d’affaires" value={formatMoney(r.ca)} />
              <Kpi label="Total des produits" value={formatMoney(r.totalProduits)} />
              <Kpi label="Total des charges" value={formatMoney(r.opCharges)} />
              <Kpi label="Résultat d’exploitation" value={formatMoney(r.resultatExpl)} />
              <Kpi label="Résultat net" value={formatMoney(r.resultatNet)} hint="après amortissements" />
              <Kpi label="Marge brute" value={P(pct(r.margeBrute, r.ca))} />
              <Kpi label="Marge nette" value={P(pct(r.resultatNet, r.totalProduits))} />
              <Kpi label="Trésorerie disponible" value={formatMoney(r.cashFinal)} />
              <Kpi label="Flux de trésorerie net" value={formatMoney(r.cashIn - r.cashOut)} />
              <Kpi label="ROI" value={P(r.roi)} />
              <Kpi label={`VAN (${rate} %)`} value={M(r.van)} />
              <Kpi label="TRI" value={r.tri === null ? <span className="text-xs italic text-muted-foreground">TRI non calculable avec les données disponibles.</span> : `${(r.tri * 100).toFixed(1)} %`} />
              <Kpi label="Seuil de rentabilité (CA)" value={M(r.breakEven)} />
              <Kpi label="Coût de production /kg" value={M(r.costPerKg)} />
              <Kpi label="Prix moyen de vente /kg" value={M(r.avgPrice)} />
              <Kpi label="Résultat par kg" value={M(r.resultPerKg)} />
              <Kpi label="Coût de production total" value={formatMoney(r.totalCost)} />
            </div>
            <Card><CardHeader><CardTitle className="text-base">Analyse automatique</CardTitle><CardDescription>Basée uniquement sur les données enregistrées</CardDescription></CardHeader>
              <CardContent><ul className="space-y-2 text-sm">{r.observations.map((o, i) => <li key={i} className="flex gap-2"><Info className="w-4 h-4 mt-0.5 text-primary shrink-0" />{o}</li>)}</ul></CardContent></Card>
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base">Encaissements vs décaissements</CardTitle></CardHeader><CardContent className="h-64">
                {r.buckets('month').length ? <ResponsiveContainer><BarChart data={r.buckets('month')}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: number) => formatMoney(v)} /><Legend /><Bar dataKey="inflow" name="Encaissements" fill={CHART[0]} /><Bar dataKey="outflow" name="Décaissements" fill={CHART[1]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">Aucune donnée enregistrée.</p>}
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Répartition des charges</CardTitle></CardHeader><CardContent className="h-64">
                {pieData.length ? <ResponsiveContainer><PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e: any) => e.name}>{pieData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}</Pie><Tooltip formatter={(v: number) => formatMoney(v)} /></PieChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">Aucune charge enregistrée.</p>}
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="previsionnel" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Compte d’exploitation prévisionnel</CardTitle><CardDescription>Saisissez vos prévisions pour ce cycle ; elles sont enregistrées et comparées au réalisé.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {(['produits', 'charges', 'invest'] as const).map(g => (
                  <div key={g}><p className="font-medium text-sm mb-2">{g === 'produits' ? 'Produits prévisionnels' : g === 'charges' ? 'Charges prévisionnelles' : 'Investissements'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{BUDGET_FIELDS.filter(f => f.group === g).map(f => (
                      <div key={f.key}><Label className="text-xs">{f.label}</Label><Input type="number" value={budget[f.key] ?? ''} onChange={e => setBudget({ ...budget, [f.key]: n(e.target.value) })} /></div>))}</div></div>))}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Kpi label="CA prévu" value={formatMoney(r.caPrev)} /><Kpi label="Produits prévus" value={formatMoney(r.produitsPrev)} />
                  <Kpi label="Charges prévues" value={formatMoney(r.chargesPrev)} /><Kpi label="Résultat prévu" value={formatMoney(r.produitsPrev - r.chargesPrev)} />
                  <Kpi label="Marge prévue" value={P(pct(r.produitsPrev - r.chargesPrev, r.produitsPrev))} />
                </div>
                <Button onClick={saveBudget} disabled={saving} className="print:hidden"><Save className="w-4 h-4 mr-2" />{saving ? 'Enregistrement…' : 'Enregistrer le prévisionnel'}</Button>
              </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Prévisionnel vs réalisé</CardTitle></CardHeader><CardContent className="overflow-x-auto">
              {!r.hasBudget && <Alert className="mb-3"><AlertTriangle className="w-4 h-4" /><AlertDescription>Aucun prévisionnel saisi : les écarts ne sont pas calculables.</AlertDescription></Alert>}
              <Table><TableHeader><TableRow><TableHead>Poste</TableHead><TableHead className="text-right">Prévision</TableHead><TableHead className="text-right">Réalisé</TableHead><TableHead className="text-right">Écart</TableHead><TableHead className="text-right">Écart %</TableHead></TableRow></TableHeader>
                <TableBody>{r.compare.map(c => { const e = c.real - c.prev; const ep = c.prev ? (e / Math.abs(c.prev)) * 100 : null; const bad = ep !== null && Math.abs(ep) >= 5 && ((c.isCharge && e > 0) || (!c.isCharge && e < 0));
                  const f = (v: number) => (c.money ? formatMoney(v) : v.toLocaleString('fr-FR'));
                  return <TableRow key={c.label}><TableCell>{c.label}</TableCell><TableCell className="text-right">{c.prev ? f(c.prev) : MISSING}</TableCell><TableCell className="text-right">{f(c.real)}</TableCell><TableCell className="text-right">{c.prev ? f(e) : '—'}</TableCell><TableCell className="text-right">{ep === null ? '—' : <Badge variant={bad ? 'destructive' : 'secondary'}>{ep.toFixed(1)} %</Badge>}</TableCell></TableRow>; })}</TableBody></Table>
              {r.hasBudget && <div className="h-72 mt-4"><ResponsiveContainer><BarChart data={r.compare.filter(c => c.money && (c.prev || c.real))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={10} interval={0} angle={-30} textAnchor="end" height={80} /><YAxis fontSize={11} /><Tooltip formatter={(v: number) => formatMoney(v)} /><Legend /><Bar dataKey="prev" name="Prévisionnel" fill={CHART[3]} /><Bar dataKey="real" name="Réalisé" fill={CHART[0]} /></BarChart></ResponsiveContainer></div>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="exploitation">
            <Card><CardHeader><CardTitle className="text-base">Compte d’exploitation réel</CardTitle></CardHeader><CardContent>
              <Table><TableBody>
                <TableRow className="bg-muted/50"><TableCell className="font-semibold">Produits</TableCell><TableCell /></TableRow>
                <TableRow><TableCell className="pl-6">Ventes</TableCell><TableCell className="text-right">{formatMoney(r.ca)}</TableCell></TableRow>
                <TableRow><TableCell className="pl-6">Autres revenus</TableCell><TableCell className="text-right">{formatMoney(r.otherRev)}</TableCell></TableRow>
                <TableRow><TableCell className="font-semibold">Total des produits</TableCell><TableCell className="text-right font-semibold">{formatMoney(r.totalProduits)}</TableCell></TableRow>
                <TableRow className="bg-muted/50"><TableCell className="font-semibold">Charges</TableCell><TableCell /></TableRow>
                {POSTS.map(p => <TableRow key={p.key}><TableCell className="pl-6">{p.label}</TableCell><TableCell className="text-right">{formatMoney(r.byPost[p.key])}</TableCell></TableRow>)}
                <TableRow><TableCell className="font-semibold">Total des charges</TableCell><TableCell className="text-right font-semibold">{formatMoney(r.opCharges)}</TableCell></TableRow>
                <TableRow><TableCell className="font-semibold">Résultat d’exploitation</TableCell><TableCell className="text-right font-semibold">{formatMoney(r.resultatExpl)}</TableCell></TableRow>
                <TableRow><TableCell className="pl-6">Dotations aux amortissements</TableCell><TableCell className="text-right">{formatMoney(r.depreciation)}</TableCell></TableRow>
                <TableRow><TableCell className="font-semibold">Résultat net</TableCell><TableCell className="text-right font-semibold">{formatMoney(r.resultatNet)}</TableCell></TableRow>
                <TableRow><TableCell>Marge brute</TableCell><TableCell className="text-right">{formatMoney(r.margeBrute)} ({P(pct(r.margeBrute, r.ca))})</TableCell></TableRow>
                <TableRow><TableCell>Marge nette</TableCell><TableCell className="text-right">{P(pct(r.resultatNet, r.totalProduits))}</TableCell></TableRow>
              </TableBody></Table></CardContent></Card>
          </TabsContent>

          <TabsContent value="ventes">
            <Card><CardHeader><CardTitle className="text-base">Rapport détaillé des ventes</CardTitle></CardHeader><CardContent className="overflow-x-auto">
              {r.salesRows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune vente enregistrée sur la période.</p> : <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                <Kpi label="Quantité vendue" value={r.qtySold.toLocaleString('fr-FR')} /><Kpi label="Chiffre d’affaires" value={formatMoney(r.ca)} />
                <Kpi label="Prix moyen /kg" value={M(r.avgPrice)} /><Kpi label="Encaissé" value={formatMoney(r.salesRows.reduce((a, s) => a + s.cashed, 0))} />
                <Kpi label="Créances clients" value={formatMoney(r.receivables)} /><Kpi label="Nombre de ventes" value={r.salesRows.length} />
              </div>
              <Table><TableHeader><TableRow>{['Date', 'Client', 'Espèce', 'Produit(s)', 'Quantité', 'Prix /kg', 'Montant', 'Encaissé', 'Restant', 'Paiement', 'Cycle'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{r.salesRows.map(s => <TableRow key={s.id}><TableCell>{s.date.slice(0, 10)}</TableCell><TableCell>{s.clientName}</TableCell><TableCell>{cycle?.species || MISSING}</TableCell><TableCell>{s.products.map(p => p.name).join(', ') || MISSING}</TableCell><TableCell>{s.qty}</TableCell><TableCell>{s.pricePerKg ? formatMoney(s.pricePerKg) : '—'}</TableCell><TableCell>{formatMoney(s.totalAmount)}</TableCell><TableCell>{formatMoney(s.cashed)}</TableCell><TableCell>{formatMoney(s.remaining)}</TableCell><TableCell>{s.paymentMethod || MISSING}</TableCell><TableCell>{cycle?.name}</TableCell></TableRow>)}</TableBody></Table></>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="achats">
            <Card><CardHeader><CardTitle className="text-base">Achats et frais</CardTitle><CardDescription>Poste principal : {r.opCharges ? POSTS.map(p => ({ l: p.label, v: r.byPost[p.key] })).sort((a, b) => b.v - a.v)[0].l : MISSING}</CardDescription></CardHeader><CardContent className="overflow-x-auto space-y-4">
              <Table><TableHeader><TableRow><TableHead>Catégorie</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Part</TableHead></TableRow></TableHeader>
                <TableBody>{POSTS.filter(p => r.byPost[p.key] > 0).sort((a, b) => r.byPost[b.key] - r.byPost[a.key]).map(p => <TableRow key={p.key}><TableCell>{p.label}</TableCell><TableCell className="text-right">{formatMoney(r.byPost[p.key])}</TableCell><TableCell className="text-right">{P(pct(r.byPost[p.key], r.opCharges))}</TableCell></TableRow>)}</TableBody></Table>
              {r.purch.length + r.expTx.length === 0 ? <p className="text-sm text-muted-foreground">Aucun achat ni frais enregistré sur la période.</p> :
              <Table><TableHeader><TableRow>{['Date', 'Source', 'Fournisseur', 'Catégorie', 'Produit / service', 'Qté', 'Montant', 'Payé', 'Reste', 'Paiement'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {r.purch.map(p => <TableRow key={p.id}><TableCell>{p.date.slice(0, 10)}</TableCell><TableCell><Badge variant="outline">Achat</Badge></TableCell><TableCell>{p.supplier || MISSING}</TableCell><TableCell>{POSTS.find(x => x.key === p.post)?.label}</TableCell><TableCell>{p.description}</TableCell><TableCell>{p.quantity ?? '—'} {p.unit || ''}</TableCell><TableCell>{formatMoney(p.amount)}</TableCell><TableCell>{formatMoney(p.paid)}</TableCell><TableCell>{formatMoney(p.due)}</TableCell><TableCell>{p.paymentMethod || MISSING}</TableCell></TableRow>)}
                  {r.expTx.map(t => <TableRow key={t.id}><TableCell>{t.date.slice(0, 10)}</TableCell><TableCell><Badge variant="outline">Transaction</Badge></TableCell><TableCell>{t.supplier || MISSING}</TableCell><TableCell>{POSTS.find(x => x.key === t.post)?.label}</TableCell><TableCell>{t.description}</TableCell><TableCell>—</TableCell><TableCell>{formatMoney(t.amount)}</TableCell><TableCell>{formatMoney(t.amount)}</TableCell><TableCell>{formatMoney(0)}</TableCell><TableCell>{t.paymentMethod || MISSING}</TableCell></TableRow>)}
                </TableBody></Table>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="mo">
            <Card><CardHeader><CardTitle className="text-base">Salaires et main-d’œuvre</CardTitle><CardDescription>Coût total de la main-d’œuvre du cycle : {formatMoney(r.laborCost)}</CardDescription></CardHeader><CardContent className="overflow-x-auto">
              {r.slips.length === 0 ? <p className="text-sm text-muted-foreground">Aucun bulletin de paie affecté à cette unité sur la période.</p> :
              <Table><TableHeader><TableRow>{['Salarié', 'Période', 'Salaire de base', 'Heures sup.', 'Primes', 'Retenues', 'Net versé', 'Coût total'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{r.slips.map(s => <TableRow key={s.id}><TableCell>{s.employeeName}</TableCell><TableCell>{s.period}</TableCell><TableCell>{formatMoney(s.baseSalary)}</TableCell><TableCell>{formatMoney(s.overtime)}</TableCell><TableCell>{formatMoney(s.bonuses)}</TableCell><TableCell>{formatMoney(s.deductions)}</TableCell><TableCell>{formatMoney(s.netSalary)}</TableCell><TableCell>{formatMoney(s.baseSalary + s.overtime + s.bonuses)}</TableCell></TableRow>)}</TableBody></Table>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="amort">
            <Card><CardHeader><CardTitle className="text-base">Amortissements (linéaire)</CardTitle></CardHeader><CardContent className="overflow-x-auto">
              {r.assetRows.length === 0 ? <p className="text-sm text-muted-foreground">Aucune immobilisation affectée à cette unité.</p> :
              <Table><TableHeader><TableRow>{['Équipement', 'Acquisition', 'Coût', 'Durée', 'Dotation période', 'Cumul', 'VNC'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{r.assetRows.map(a => <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell>{a.purchaseDate}</TableCell><TableCell>{formatMoney(a.purchasePrice)}</TableCell><TableCell>{a.usefulLife ? `${a.usefulLife} ans` : MISSING}</TableCell><TableCell>{formatMoney(a.period)}</TableCell><TableCell>{formatMoney(a.cumul)}</TableCell><TableCell>{formatMoney(a.nbv)}</TableCell></TableRow>)}</TableBody>
                <TableFooter><TableRow><TableCell colSpan={4}>Total dotation de la période (intégrée au résultat net)</TableCell><TableCell>{formatMoney(r.depreciation)}</TableCell><TableCell colSpan={2} /></TableRow></TableFooter></Table>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="treso" className="space-y-4">
            <Card><CardHeader><CardTitle className="text-base">Situation de trésorerie</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Solde initial" value={formatMoney(initialCash)} hint={initialCash ? undefined : MISSING} /><Kpi label="Encaissements" value={formatMoney(r.cashIn)} />
                <Kpi label="Décaissements" value={formatMoney(r.cashOut)} /><Kpi label="Solde final" value={formatMoney(r.cashFinal)} />
                <Kpi label="Créances clients (à recevoir)" value={formatMoney(r.receivables)} /><Kpi label="Dettes fournisseurs (à payer)" value={formatMoney(r.payables)} />
                <Kpi label="Dépenses engagées" value={formatMoney(r.committed)} /><Kpi label="Dépenses payées" value={formatMoney(r.paidOut)} />
                <Kpi label="Recettes attendues" value={formatMoney(r.expectedIn)} /><Kpi label="Recettes encaissées" value={formatMoney(r.cashIn)} />
              </div>
              <Table><TableBody>
                <TableRow className="bg-muted/50"><TableCell className="font-semibold">Encaissements</TableCell><TableCell /></TableRow>
                <TableRow><TableCell className="pl-6">Ventes encaissées</TableCell><TableCell className="text-right">{formatMoney(r.cashIn - r.otherRev)}</TableCell></TableRow>
                <TableRow><TableCell className="pl-6">Autres recettes</TableCell><TableCell className="text-right">{formatMoney(r.otherRev)}</TableCell></TableRow>
                <TableRow className="bg-muted/50"><TableCell className="font-semibold">Décaissements</TableCell><TableCell /></TableRow>
                <TableRow><TableCell className="pl-6">Achats payés</TableCell><TableCell className="text-right">{formatMoney(r.outPurch)}</TableCell></TableRow>
                <TableRow><TableCell className="pl-6">Autres dépenses</TableCell><TableCell className="text-right">{formatMoney(r.outTx)}</TableCell></TableRow>
                <TableRow><TableCell className="pl-6">Salaires nets versés</TableCell><TableCell className="text-right">{formatMoney(r.outSal)}</TableCell></TableRow>
                <TableRow><TableCell className="pl-6">Investissements</TableCell><TableCell className="text-right">{formatMoney(r.outInvest)}</TableCell></TableRow>
              </TableBody></Table>
            </CardContent></Card>
            <Card><CardHeader><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Flux de trésorerie</CardTitle>
              <Select value={granularity} onValueChange={v => setGranularity(v as any)}><SelectTrigger className="w-40 print:hidden"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Journalier</SelectItem><SelectItem value="week">Hebdomadaire</SelectItem><SelectItem value="month">Mensuel</SelectItem></SelectContent></Select></div></CardHeader>
              <CardContent className="space-y-4 overflow-x-auto">
                {flowRows.length === 0 ? <p className="text-sm text-muted-foreground">Aucun flux enregistré sur la période.</p> : <>
                  <div className="h-64"><ResponsiveContainer><LineChart data={flowRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: number) => formatMoney(v)} /><Legend /><Line dataKey="cumul" name="Trésorerie cumulée" stroke={CHART[0]} strokeWidth={2} /><Line dataKey="net" name="Flux net" stroke={CHART[3]} /></LineChart></ResponsiveContainer></div>
                  <Table><TableHeader><TableRow>{['Période', 'Encaissements', 'Décaissements', 'Flux net', 'Trésorerie cumulée'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>{flowRows.map(f => <TableRow key={f.period}><TableCell>{f.period}</TableCell><TableCell>{formatMoney(f.inflow)}</TableCell><TableCell>{formatMoney(f.outflow)}</TableCell><TableCell>{formatMoney(f.net)}</TableCell><TableCell>{formatMoney(f.cumul)}</TableCell></TableRow>)}</TableBody>
                    <TableFooter><TableRow><TableCell>Cycle</TableCell><TableCell>{formatMoney(r.cashIn)}</TableCell><TableCell>{formatMoney(r.cashOut)}</TableCell><TableCell>{formatMoney(r.cashIn - r.cashOut)}</TableCell><TableCell>{formatMoney(r.cashFinal)}</TableCell></TableRow></TableFooter></Table></>}
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="renta" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Chiffre d’affaires" value={formatMoney(r.ca)} /><Kpi label="Charges totales (avec amort.)" value={formatMoney(r.totalCost)} />
              <Kpi label="Résultat" value={formatMoney(r.resultatNet)} /><Kpi label="Marge brute" value={P(pct(r.margeBrute, r.ca))} />
              <Kpi label="Marge nette" value={P(pct(r.resultatNet, r.totalProduits))} /><Kpi label="Coût de production /kg" value={M(r.costPerKg)} />
              <Kpi label="Prix moyen /kg" value={M(r.avgPrice)} /><Kpi label="Marge /kg" value={M(r.avgPrice !== null && r.costPerKg !== null ? r.avgPrice - r.costPerKg : null)} />
              <Kpi label="ROI" value={P(r.roi)} hint={r.invest ? `Investissement ${formatMoney(r.invest)} — résultat ${formatMoney(r.resultatNet)}` : 'Aucune immobilisation enregistrée'} />
              <Kpi label="Seuil de rentabilité / point mort" value={M(r.breakEven)} hint="CA nécessaire pour couvrir les charges fixes" />
            </div>
            <Card><CardHeader><CardTitle className="text-base">VAN — Valeur actuelle nette</CardTitle>
              <CardDescription>La VAN additionne les flux de trésorerie réels du cycle, ramenés à leur valeur d’aujourd’hui avec un taux de {rate} %/an. Une VAN positive signifie que le cycle crée plus de valeur que ce taux.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi label="Taux d’actualisation" value={`${rate} %`} /><Kpi label="Investissement initial (t0)" value={r.priorInvest ? formatMoney(r.priorInvest) : MISSING} />
                  <Kpi label="VAN" value={M(r.van)} /><Kpi label="TRI" value={r.tri === null ? <span className="text-xs italic text-muted-foreground">TRI non calculable avec les données disponibles.</span> : `${(r.tri * 100).toFixed(1)} %`} />
                </div>
                {r.flows.length > 0 && <Table><TableHeader><TableRow><TableHead>Mois depuis le début</TableHead><TableHead>Flux</TableHead><TableHead>Valeur actualisée</TableHead></TableRow></TableHeader>
                  <TableBody>{r.flows.map((f, i) => <TableRow key={i}><TableCell>{f.months.toFixed(1)}</TableCell><TableCell>{formatMoney(f.amount)}</TableCell><TableCell>{formatMoney(f.amount / Math.pow(1 + rate / 100, f.months / 12))}</TableCell></TableRow>)}</TableBody></Table>}
                <p className="text-xs text-muted-foreground">Le TRI est le taux pour lequel la VAN est nulle. Il n’est calculable que si les flux comportent au moins une sortie et une entrée d’argent.</p>
              </CardContent></Card>
          </TabsContent>

          <TabsContent value="jour">
            <Card><CardHeader><CardTitle className="text-base">Rapport financier du jour ({new Date().toLocaleDateString('fr-FR')})</CardTitle><CardDescription>Ces montants sont automatiquement cumulés dans le rapport du cycle.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Ventes du jour" value={formatMoney(r.daily.sales)} /><Kpi label="Recettes encaissées" value={formatMoney(r.daily.cashed)} />
                <Kpi label="Achats du jour" value={formatMoney(r.daily.purchases)} /><Kpi label="Dépenses du jour" value={formatMoney(r.daily.expenses)} />
                <Kpi label="Solde journalier" value={formatMoney(r.daily.cashed - r.daily.purchases - r.daily.expenses)} />
                <Kpi label="Créances du jour" value={formatMoney(r.daily.receivables)} /><Kpi label="Dettes du jour" value={formatMoney(r.daily.payables)} />
              </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default CycleFinancialReport;
