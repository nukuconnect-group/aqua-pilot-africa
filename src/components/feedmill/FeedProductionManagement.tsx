import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Factory, PackageSearch, History } from 'lucide-react';
import FeedProductionCycles from '@/components/aquafeed/feedmill/FeedProductionCycles';
import { useFeedOperations } from '@/components/aquafeed/feedmill/useFeedOperations';
import { useFeedMill } from '@/components/aquafeed/feedmill/useFeedMill';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { tr } from '@/i18n/runtime';

/**
 * Module Production spécifique aux unités « Fabrication d'aliments » :
 * cycles de fabrication (formulation, quantités prévues/produites, pertes,
 * coûts) et traçabilité des lots de la préparation à l'entrée en stock.
 */
const FeedProductionManagement: React.FC = () => {
  const { cycles, traces, loading, saveCycle, deleteCycle } = useFeedOperations();
  const { formulations } = useFeedMill();
  const { formatCurrency } = useProductionUnits();
  const { language } = useSettings();
  const text = (value: string) => tr(value, language);
  const [tab, setTab] = useState('cycles');

  const formulationNames = useMemo(
    () => formulations.map((f: any) => f.name).filter(Boolean),
    [formulations]
  );

  const batchTraces = useMemo(() => {
    const byBatch = new Map<string, typeof traces>();
    traces.forEach(t => {
      const list = byBatch.get(t.batch_number) || [];
      list.push(t);
      byBatch.set(t.batch_number, list);
    });
    return Array.from(byBatch.entries());
  }, [traces]);

  const stateBadge = (state: string) => {
    switch (state) {
      case 'en_stock':
        return <Badge className="bg-emerald-100 text-emerald-800">{text('En stock')}</Badge>;
      case 'vendu':
        return <Badge className="bg-sky-100 text-sky-800">{text('Vendu')}</Badge>;
      case 'utilise':
        return <Badge className="bg-violet-100 text-violet-800">{text('Utilisé')}</Badge>;
      case 'rejete':
        return <Badge variant="destructive">{text('Rejeté')}</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Factory className="h-6 w-6 text-primary" />
          {text('Production — Fabrication d\'aliments')}
        </h2>
        <p className="text-muted-foreground">
          {text('Cycles de fabrication et traçabilité des lots, de la préparation à l\'entrée en stock.')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cycles" className="flex items-center gap-2">
            <Factory className="h-4 w-4" /> {text('Cycles de fabrication')}
          </TabsTrigger>
          <TabsTrigger value="traceability" className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4" /> {text('Traçabilité des lots')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cycles" className="mt-4">
          <FeedProductionCycles
            cycles={cycles}
            formulationNames={formulationNames}
            onSave={saveCycle}
            onDelete={deleteCycle}
          />
        </TabsContent>

        <TabsContent value="traceability" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> {text('Historique de traçabilité par lot')}
              </CardTitle>
              <CardDescription>
                {text('Chaque mouvement (production, entrée en stock, vente, utilisation) est rattaché à son lot.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">{text('Chargement…')}</p>
              ) : batchTraces.length === 0 ? (
                <p className="text-muted-foreground">
                  {text('Aucun mouvement tracé pour le moment. Les entrées sont créées automatiquement lors des fabrications et des ventes.')}
                </p>
              ) : (
                <div className="space-y-4">
                  {batchTraces.map(([batch, records]) => (
                    <div key={batch} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Lot {batch}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {records.length} {text('mouvement(s)')}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {records.map(r => (
                          <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{r.entry_date}</span>
                            <span className="font-medium">{r.product_name || r.product_type}</span>
                            <span>{r.quantity} {r.unit_label}</span>
                            {stateBadge(r.state)}
                            {r.origin && <span className="text-muted-foreground">· {text('De')} : {r.origin}</span>}
                            {r.destination && <span className="text-muted-foreground">· {text('Vers')} : {r.destination}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedProductionManagement;
