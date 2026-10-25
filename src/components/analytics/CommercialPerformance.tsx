import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { commercialMetrics, commercialForecast, CommercialSale, CommercialPurchase, CommercialItem } from '@/lib/commercialAnalytics';
import { formatMoney, getCurrency } from '@/lib/currency';
import { exportToPDF, exportToCSV, ReportData } from '@/lib/reportExportUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { format, startOfDay, subDays } from 'date-fns';

async function allRows(makeQuery: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await makeQuery().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

export default function CommercialPerformance({ initialTab = 'performance', title = 'Analytique commerciale' }: { initialTab?: string; title?: string }) {
  const { user } = useAuth();
  const { activeUnit, convertCurrency } = useProductionUnits();
  const [days, setDays] = useState('30');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const unitId = activeUnit?.id;
  const now = useMemo(() => new Date(), [unitId, days]);
  const start = format(subDays(startOfDay(now), Number(days) - 1), 'yyyy-MM-dd');
  const end = format(now, 'yyyy-MM-dd');
  const currency = getCurrency();
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['commercial-performance', user?.id, unitId], enabled: Boolean(user?.id && unitId),
    queryFn: async () => {
      if (!unitId) throw new Error('Sélectionnez une unité.');
      const [sales, purchases] = await Promise.all([
        allRows(() => supabase.from('sales').select('id,unit_id,date,total_amount,status,paid_amount,is_credit').eq('unit_id', unitId).order('id')),
        allRows(() => supabase.from('purchases').select('id,unit_id,date,amount,currency,status').eq('unit_id', unitId).order('id')),
      ]);
      const items: CommercialItem[] = [];
      for (let offset = 0; offset < sales.length; offset += 100) {
        items.push(...await allRows(() => supabase.from('sale_items').select('id,sale_id,name,quantity,total').in('sale_id', sales.slice(offset, offset + 100).map(s => s.id)).order('id')));
      }
      return { sales: sales as CommercialSale[], purchases: purchases as CommercialPurchase[], items };
    },
  });
  useEffect(() => {
    const refresh = () => { void refetch(); };
    window.addEventListener('aqua:data-refresh', refresh);
    return () => window.removeEventListener('aqua:data-refresh', refresh);
  }, [refetch]);
  const convert = (amount: number, from: string) => convertCurrency(amount, from, currency);
  const metrics = data && unitId ? commercialMetrics(data.sales, data.purchases, data.items, unitId, start, end, convert) : null;
  const projection = data && unitId ? commercialForecast(data.sales, data.purchases, unitId, now, convert) : null;
  const figures = metrics ? [
    ['Chiffre d’affaires', formatMoney(metrics.revenue)], ['Encaissements des ventes', formatMoney(metrics.paid)],
    ['Créances clients', formatMoney(metrics.outstanding)], ['Achats enregistrés', formatMoney(metrics.expenses)],
    ['Solde ventes − achats', formatMoney(metrics.balance)], ['Nombre de ventes', String(metrics.count)],
    ['Panier moyen', metrics.average === null ? 'Non calculable' : formatMoney(metrics.average)],
  ] : [];
  const report: ReportData | null = metrics && projection ? {
    title: 'Rapport commercial', unitName: activeUnit?.name, period: `${start} au ${end}`,
    generatedAt: now.toLocaleString('fr-FR'), sections: [
      {title:'Performances réalisées',type:'summary',summary:figures.map(([label,value])=>({label,value}))},
      {title:'Produits vendus',type:'table',headers:['Produit','Quantité','Ventes'],rows:metrics.products.map(p=>[p.name,p.quantity,formatMoney(p.total)])},
      {title:'Prévisions commerciales estimées',type:'table',headers:['Mois','Ventes estimées','Achats estimés'],rows:projection.forecast.map(p=>[p.month,formatMoney(p.revenue),formatMoney(p.expenses)])},
      {title:'Périmètre',type:'summary',summary:[{label:'Solde ventes − achats',value:'Ce solde n’est pas un bénéfice net : les achats incluent du stock et ne couvrent pas toutes les charges.'},{label:'Prévisions',value:projection.forecast.length ? 'Estimations automatiques, non garanties, à partir des montants enregistrés. Les mois sans opérations enregistrées comptent pour zéro.' : 'Historique insuffisant : au moins trois mois complets nécessaires.'}]},
    ],
  } : null;
  const download = async () => {
    if (!report) return;
    setExporting(true); setExportError('');
    try { await exportToPDF(report, `rapport-commercial-${unitId}-${end}`); }
    catch { setExportError('Le PDF n’a pas pu être téléchargé. Réessayez.'); }
    finally { setExporting(false); }
  };
  if (!unitId) return <p className="text-muted-foreground">Sélectionnez une unité.</p>;
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">{title}</h1><p className="break-words text-sm text-muted-foreground">{activeUnit?.name} · {start} au {end}</p></div>
      <div className="flex items-center gap-2"><Select value={days} onValueChange={setDays}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 derniers jours</SelectItem><SelectItem value="30">30 derniers jours</SelectItem><SelectItem value="90">90 derniers jours</SelectItem><SelectItem value="365">12 derniers mois</SelectItem></SelectContent></Select>
      <Button variant="outline" size="icon" title="Actualiser" aria-label="Actualiser les chiffres" disabled={isFetching} onClick={()=>void refetch()}><RefreshCw className="size-4" /></Button></div></div>
    {error && <p role="alert" className="text-sm text-destructive">Les données commerciales sont indisponibles. Réessayez.</p>}
    {isPending ? <p className="text-muted-foreground">Chargement des données commerciales…</p> : !metrics ? null : <Tabs defaultValue={initialTab}>
      <TabsList className="flex h-auto w-full flex-wrap justify-start"><TabsTrigger value="performance">Performances</TabsTrigger><TabsTrigger value="forecast">Prévisions</TabsTrigger><TabsTrigger value="report">Rapport</TabsTrigger></TabsList>
      <TabsContent value="performance" className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{figures.map(([label,value])=><Card key={label}><CardContent className="min-w-0 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-xl font-bold tabular-nums">{value}</p></CardContent></Card>)}</div>
        <p className="text-xs text-muted-foreground">Le solde ventes − achats n’est pas un bénéfice net : achats de stock et autres charges ne sont pas équivalents.</p>
        <h2 className="text-lg font-semibold">Produits vendus</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Produit</th><th className="text-right">Quantité</th><th className="text-right">Ventes</th></tr></thead><tbody>{metrics.products.map(p=><tr key={p.name} className="border-b"><td className="py-3">{p.name}</td><td className="text-right tabular-nums">{p.quantity.toLocaleString('fr-FR')}</td><td className="text-right tabular-nums">{formatMoney(p.total)}</td></tr>)}</tbody></table></div>{!metrics.count && <p className="text-muted-foreground">Aucune vente enregistrée sur cette période.</p>}
      </TabsContent>
      <TabsContent value="forecast" className="space-y-4"><h2 className="text-lg font-semibold">Prévisions commerciales</h2><p className="text-sm text-muted-foreground">Estimations : moyenne des trois derniers mois complets enregistrés. Elles ne représentent pas des ventes réalisées.</p>
        {!projection?.forecast.length ? <p>Historique insuffisant : au moins trois mois complets nécessaires.</p> : <><div className="h-72 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={projection.forecast}><XAxis dataKey="month"/><YAxis width={70}/><Tooltip formatter={(v:number)=>formatMoney(v)}/><Legend/><Bar dataKey="revenue" name="Ventes estimées" fill="hsl(var(--primary))"/><Bar dataKey="expenses" name="Achats estimés" fill="hsl(var(--muted-foreground))"/></BarChart></ResponsiveContainer></div><div className="grid gap-3 sm:grid-cols-3">{projection.forecast.map(f=><div key={f.month} className="border-t py-3"><p className="font-semibold">{f.month}</p><p className="break-words">Ventes : {formatMoney(f.revenue)}</p><p className="break-words text-sm text-muted-foreground">Achats : {formatMoney(f.expenses)}</p></div>)}</div></>}
      </TabsContent>
      <TabsContent value="report" className="space-y-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="size-5"/>Rapport commercial · {activeUnit?.name}</h2><p className="text-sm text-muted-foreground">{report?.generatedAt} · {report?.period}</p><dl className="divide-y">{figures.map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt>{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl><div className="flex flex-wrap gap-2"><Button onClick={()=>void download()} disabled={exporting}><Download className="size-4"/>{exporting?'Téléchargement…':'PDF'}</Button><Button variant="outline" onClick={()=>report && exportToCSV(report,`rapport-commercial-${end}`)}><Download className="size-4"/>CSV</Button></div>{exportError&&<p role="alert" className="text-destructive">{exportError}</p>}</TabsContent>
    </Tabs>}
  </div>;
}