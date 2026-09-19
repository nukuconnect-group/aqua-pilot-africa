import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Fish, Building2, History, Activity, AlertTriangle, Search, Heart, Leaf } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';

const statusColor = (s: string) => {
  switch (s) {
    case 'healthy': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    case 'sick': case 'diseased': return 'bg-destructive/15 text-destructive border-destructive/30';
    case 'observation': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

const CheptelSante: React.FC = () => {
  const { activeUnit, infrastructures } = useProductionUnits();
  const { batches, loading } = useLivestockBatches(activeUnit?.id);
  const { records: healthRecords } = useHealthRecords(undefined, activeUnit?.id);
  const [search, setSearch] = useState('');

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(b =>
      b.species?.toLowerCase().includes(q) ||
      b.variety?.toLowerCase().includes(q) ||
      b.unit_name?.toLowerCase().includes(q)
    );
  }, [batches, search]);

  const unitInfras = useMemo(
    () => infrastructures.filter(i => !activeUnit || i.unitId === activeUnit.id),
    [infrastructures, activeUnit]
  );

  const batchesByInfra = useMemo(() => {
    const map = new Map<string, typeof batches>();
    batches.forEach(b => {
      const key = b.attached_infrastructure_id || 'unassigned';
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    });
    return map;
  }, [batches]);

  const stats = useMemo(() => ({
    total: batches.length,
    healthy: batches.filter(b => b.status === 'healthy' || b.status === 'active').length,
    sick: batches.filter(b => b.status === 'sick' || b.status === 'diseased').length,
    observation: batches.filter(b => b.status === 'observation').length,
  }), [batches]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Heart className="w-6 h-6 text-primary" /></div>
            <div>
              <CardTitle className="text-xl">Cheptel Sanitaire</CardTitle>
              <CardDescription>Vue sanitaire des lots — par lot, par infrastructure et historique des maladies.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 border rounded-lg"><p className="text-xs text-muted-foreground">Lots actifs</p><p className="text-2xl font-bold">{stats.total}</p></div>
            <div className="p-3 border rounded-lg bg-emerald-500/5"><p className="text-xs text-muted-foreground">En bonne santé</p><p className="text-2xl font-bold text-emerald-600">{stats.healthy}</p></div>
            <div className="p-3 border rounded-lg bg-amber-500/5"><p className="text-xs text-muted-foreground">En observation</p><p className="text-2xl font-bold text-amber-600">{stats.observation}</p></div>
            <div className="p-3 border rounded-lg bg-destructive/5"><p className="text-xs text-muted-foreground">Malades</p><p className="text-2xl font-bold text-destructive">{stats.sick}</p></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="batches" className="space-y-3">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="batches">{activeUnit?.type === "algoculture" ? <Leaf className="w-4 h-4 mr-2" /> : <Fish className="w-4 h-4 mr-2" />}{activeUnit?.type === "algoculture" ? "Lots de culture" : "Lots"}</TabsTrigger>
          <TabsTrigger value="infra"><Building2 className="w-4 h-4 mr-2" />Infrastructures</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />Historique</TabsTrigger>
        </TabsList>

        {/* ONGLET LOTS */}
        <TabsContent value="batches" className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher un lot (espèce, variété, unité)..." className="pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Chargement...</div>
          ) : filteredBatches.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Aucun lot enregistré. Créez d'abord un lot depuis <strong>Cheptel</strong>.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredBatches.map(b => {
                const infra = unitInfras.find(i => i.id === b.attached_infrastructure_id);
                return (
                  <Card key={b.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold flex items-center gap-2 flex-wrap">
                            {activeUnit?.type === "algoculture" ? <Leaf className="w-4 h-4" /> : <Fish className="w-4 h-4" />}{b.species}
                            {b.variety && <Badge variant="outline" className="text-[10px]">{b.variety}</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">{b.unit_name}{infra ? ` · ${infra.name}` : ''}</p>
                        </div>
                        <Badge className={statusColor(b.status)}>{b.status}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><p className="text-muted-foreground">Effectif</p><p className="font-semibold">{b.quantity.toLocaleString()}</p></div>
                        <div><p className="text-muted-foreground">Poids moy.</p><p className="font-semibold">{b.average_weight} g</p></div>
                        <div><p className="text-muted-foreground">Biomasse</p><p className="font-semibold">{Math.round(b.total_weight)} kg</p></div>
                      </div>
                      {b.last_health_check && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Activity className="w-3 h-3" />Dernier contrôle : {new Date(b.last_health_check).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ONGLET INFRASTRUCTURES */}
        <TabsContent value="infra" className="space-y-3">
          {unitInfras.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Aucune infrastructure. Créez bassins/étangs/bacs dans <strong>Infrastructures</strong>.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {unitInfras.map(infra => {
                const list = batchesByInfra.get(infra.id) ?? [];
                const biomass = list.reduce((s, b) => s + (b.total_weight || 0), 0);
                const sickCount = list.filter(b => b.status === 'sick' || b.status === 'diseased').length;
                return (
                  <Card key={infra.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="w-4 h-4" />{infra.name}
                            <Badge variant="outline">{infra.type}</Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {list.length} lot(s) · Biomasse totale {Math.round(biomass)} kg
                          </p>
                        </div>
                        {sickCount > 0 && (
                          <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                            <AlertTriangle className="w-3 h-3 mr-1" />{sickCount} lot(s) malade(s)
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {list.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Aucun lot rattaché à cette infrastructure.</p>
                      ) : (
                        <div className="space-y-2">
                          {list.map(b => (
                            <div key={b.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                {activeUnit?.type === "algoculture" ? <Leaf className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <Fish className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                <span className="truncate">{b.species}{b.variety ? ` — ${b.variety}` : ''}</span>
                                <span className="text-xs text-muted-foreground">({b.quantity.toLocaleString()} × {b.average_weight}g)</span>
                              </div>
                              <Badge className={statusColor(b.status)}>{b.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {(batchesByInfra.get('unassigned')?.length ?? 0) > 0 && (
                <Card className="border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Lots sans infrastructure rattachée</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {batchesByInfra.get('unassigned')!.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                        <span>{b.species}{b.variety ? ` — ${b.variety}` : ''}</span>
                        <Badge className={statusColor(b.status)}>{b.status}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ONGLET HISTORIQUE MALADIES */}
        <TabsContent value="history" className="space-y-3">
          {healthRecords.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Aucun enregistrement sanitaire pour cette unité.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {healthRecords.map(r => (
                <Card key={r.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold">{new Date(r.date).toLocaleDateString('fr-FR')}</p>
                        <div className="flex gap-2 flex-wrap mt-1 text-xs">
                          {r.temperature != null && <Badge variant="outline">T° {r.temperature}°C</Badge>}
                          {r.ph != null && <Badge variant="outline">pH {r.ph}</Badge>}
                          {r.oxygen != null && <Badge variant="outline">O₂ {r.oxygen} mg/L</Badge>}
                          {r.mortality != null && r.mortality > 0 && (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                              Mortalité {r.mortality}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {r.notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{r.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CheptelSante;
