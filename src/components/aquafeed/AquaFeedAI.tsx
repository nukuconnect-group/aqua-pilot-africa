import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calculator, Fish, Sparkles, History, Save, TrendingUp, AlertTriangle, Gauge, Wallet, Utensils, Sliders, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { loadSpecies, loadRulesForSpecies, computeFeeding, computeAdvancedFeeding, FishSpecies, FeedingRule, FeedingResult, AdvancedFeedingResult, DENSITY_LIMITS } from '@/lib/feedingEngine';
import ExportDropdown from '@/components/ExportDropdown';
import AdvancedAquaFeedCalculator from './AdvancedAquaFeedCalculator';
import FeedMillWorkspace from './feedmill/FeedMillWorkspace';
import { FlaskConical, ArrowRight } from 'lucide-react';

const FeedCalculatorSuite: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const { activeUnit, infrastructures, formatCurrency } = useProductionUnits();
  const [species, setSpecies] = useState<FishSpecies[]>([]);
  const [rules, setRules] = useState<FeedingRule[]>([]);
  const [speciesId, setSpeciesId] = useState<string>('');
  const [fishCount, setFishCount] = useState<number>(0);
  const [avgWeight, setAvgWeight] = useState<number>(0);
  const [waterTemp, setWaterTemp] = useState<number | ''>('');
  const [cycleDays, setCycleDays] = useState<number | ''>('');
  const [result, setResult] = useState<FeedingResult | null>(null);
  const [advancedResult, setAdvancedResult] = useState<AdvancedFeedingResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Champs avancés
  const [infrastructureId, setInfrastructureId] = useState<string>('');
  const [fcrOverride, setFcrOverride] = useState<number | ''>('');
  const [feedPrice, setFeedPrice] = useState<number | ''>('');
  const [salePrice, setSalePrice] = useState<number | ''>('');
  const [targetWeight, setTargetWeight] = useState<number | ''>('');
  const [volumeM3, setVolumeM3] = useState<number | ''>('');
  const [surfaceM2, setSurfaceM2] = useState<number | ''>('');

  useEffect(() => { loadSpecies().then(s => { setSpecies(s); if (s.length && !speciesId) setSpeciesId(s[0].id); }); }, []);
  useEffect(() => { if (speciesId) loadRulesForSpecies(speciesId).then(setRules); }, [speciesId]);
  useEffect(() => { loadHistory(); }, [user?.id]);

  const currentSpecies = useMemo(() => species.find(s => s.id === speciesId) ?? null, [species, speciesId]);
  const unitInfrastructures = useMemo(
    () => infrastructures.filter(i => !activeUnit || i.unitId === activeUnit.id),
    [infrastructures, activeUnit]
  );
  const selectedInfra = useMemo(() => unitInfrastructures.find(i => i.id === infrastructureId) ?? null, [unitInfrastructures, infrastructureId]);

  // Cascade IC : override manuel > (par infra dans specs) > par espèce
  const effectiveFcr = useMemo(() => {
    if (typeof fcrOverride === 'number' && fcrOverride > 0) return fcrOverride;
    const infraFcr = (selectedInfra?.specifications as any)?.fcr;
    if (typeof infraFcr === 'number' && infraFcr > 0) return infraFcr;
    return currentSpecies?.default_fcr ?? 1.5;
  }, [fcrOverride, selectedInfra, currentSpecies]);

  // Auto-remplir volume/surface depuis les specs de l'infrastructure
  useEffect(() => {
    if (!selectedInfra) return;
    const specs = selectedInfra.specifications || {};
    if ((specs.volume || specs.capacity) && volumeM3 === '') {
      setVolumeM3(Number(specs.volume ?? specs.capacity));
    }
    if (specs.surface && surfaceM2 === '') {
      setSurfaceM2(Number(specs.surface));
    }
  }, [selectedInfra]);

  const loadHistory = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('feed_calculations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data ?? []);
  };

  const handleCompute = async () => {
    if (!speciesId || fishCount <= 0 || avgWeight <= 0) {
      toast({ title: 'Champs manquants', description: 'Sélectionnez une espèce et saisissez nombre + poids.', variant: 'destructive' });
      return;
    }
    const r = computeFeeding({
      fishCount, avgWeightG: avgWeight, rules, species: currentSpecies,
      cycleDays: typeof cycleDays === 'number' ? cycleDays : undefined,
    });
    setResult(r);
    setAdvancedResult(null);
    await autoSave(r, null);
  };

  const handleComputeAdvanced = async () => {
    if (!speciesId || fishCount <= 0 || avgWeight <= 0) {
      toast({ title: 'Champs manquants', description: 'Sélectionnez une espèce et saisissez nombre + poids.', variant: 'destructive' });
      return;
    }
    const r = computeAdvancedFeeding({
      fishCount, avgWeightG: avgWeight, rules, species: currentSpecies,
      cycleDays: typeof cycleDays === 'number' ? cycleDays : undefined,
      infraType: selectedInfra?.type,
      advanced: {
        fcr: effectiveFcr,
        feed_price_per_kg: typeof feedPrice === 'number' ? feedPrice : null,
        sale_price_per_kg: typeof salePrice === 'number' ? salePrice : null,
        target_final_weight_g: typeof targetWeight === 'number' ? targetWeight : null,
        volume_m3: typeof volumeM3 === 'number' ? volumeM3 : null,
        surface_m2: typeof surfaceM2 === 'number' ? surfaceM2 : null,
      },
    });
    setAdvancedResult(r);
    setResult(r);
    if (r.warnings.length > 0) {
      toast({ title: 'Attention', description: r.warnings[0], variant: 'destructive' });
    }
    await autoSave(r, r);
  };

  const autoSave = async (r: FeedingResult, adv: AdvancedFeedingResult | null) => {
    if (!r || !user?.id) return;
    setLoading(true);
    const { error } = await supabase.from('feed_calculations').insert({
      user_id: user.id,
      unit_id: activeUnit?.id ?? null,
      species_id: speciesId || null,
      species_name: currentSpecies?.name ?? null,
      fish_count: fishCount,
      avg_weight_g: avgWeight,
      biomass_kg: r.biomass_kg,
      stage: r.stage,
      feed_rate_pct: r.feed_rate_pct,
      daily_ration_kg: r.daily_ration_kg,
      meals_per_day: r.meals_per_day,
      ration_per_meal_kg: r.ration_per_meal_kg,
      water_temp: typeof waterTemp === 'number' ? waterTemp : null,
      cycle_days: typeof cycleDays === 'number' ? cycleDays : (currentSpecies?.default_cycle_days ?? null),
      projected_final_weight_g: r.projected_final_weight_g,
      projected_total_feed_kg: r.projected_total_feed_kg,
      calc_mode: adv ? 'advanced' : 'basic',
      infrastructure_id: selectedInfra?.id ?? null,
      infrastructure_name: selectedInfra?.name ?? null,
      infrastructure_type: selectedInfra?.type ?? null,
      fcr: adv?.fcr_used ?? null,
      feed_price_per_kg: typeof feedPrice === 'number' ? feedPrice : null,
      sale_price_per_kg: typeof salePrice === 'number' ? salePrice : null,
      expected_cost: adv?.expected_cost ?? null,
      expected_revenue: adv?.expected_revenue ?? null,
      expected_margin: adv?.expected_margin ?? null,
      density_kg_per_m3: adv?.density_kg_per_m3 ?? null,
      density_fish_per_m2: adv?.density_fish_per_m2 ?? null,
      volume_m3: typeof volumeM3 === 'number' ? volumeM3 : null,
      surface_m2: typeof surfaceM2 === 'number' ? surfaceM2 : null,
      meal_schedule: (adv?.meal_schedule ?? null) as any,
    } as any);
    setLoading(false);
    if (error) toast({ title: 'Erreur sauvegarde', description: error.message, variant: 'destructive' });
    else {
      toast({ title: '✅ Ajouté à l\'historique', description: 'Votre calcul est conservé dans l\'onglet Historique.' });
      loadHistory();
    }
  };

  const handleClearHistory = async () => {
    if (!user?.id) return;
    if (!window.confirm('Vider tout l\'historique de vos calculs AquaFeed ? Cette action est irréversible.')) return;
    const { error } = await supabase.from('feed_calculations').delete().eq('user_id', user.id);
    if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Historique vidé', description: 'Tous vos calculs ont été supprimés.' });
      setHistory([]);
    }
  };

  // Options d'export pour le résultat courant
  const exportOptions = useMemo(() => {
    if (!result) return null;
    const adv = advancedResult;
    const rows: Array<{ label: string; value: string }> = [
      { label: 'Espèce', value: currentSpecies?.name ?? '—' },
      { label: 'Nombre de poissons', value: String(fishCount) },
      { label: 'Poids moyen (g)', value: String(avgWeight) },
      { label: 'Biomasse (kg)', value: String(result.biomass_kg) },
      { label: 'Stade', value: result.stage },
      { label: 'Taux d\'alimentation (%)', value: String(result.feed_rate_pct) },
      { label: 'Ration journalière (kg)', value: String(result.daily_ration_kg) },
      { label: 'Repas / jour', value: String(result.meals_per_day) },
      { label: 'Ration / repas (kg)', value: String(result.ration_per_meal_kg) },
      { label: 'Poids final projeté (g)', value: String(result.projected_final_weight_g) },
      { label: 'Aliment total prévu cycle (kg)', value: String(result.projected_total_feed_kg) },
    ];
    if (adv) {
      rows.push(
        { label: '── AVANCÉ ──', value: '' },
        { label: 'Infrastructure', value: `${selectedInfra?.name ?? '—'} (${selectedInfra?.type ?? '—'})` },
        { label: 'IC (FCR) utilisé', value: String(adv.fcr_used) },
        { label: 'Biomasse finale prévue (kg)', value: String(adv.expected_biomass_final_kg) },
        { label: 'Gain de biomasse (kg)', value: String(adv.expected_weight_gain_kg) },
        { label: 'Aliment nécessaire selon IC (kg)', value: String(adv.expected_feed_from_fcr_kg) },
        { label: 'Coût aliment prévu', value: formatCurrency(adv.expected_cost) },
        { label: 'Revenu prévu', value: formatCurrency(adv.expected_revenue) },
        { label: 'Marge prévue', value: formatCurrency(adv.expected_margin) },
        { label: 'Densité (kg/m³)', value: adv.density_kg_per_m3 !== null ? String(adv.density_kg_per_m3) : '—' },
        { label: 'Densité (poissons/m²)', value: adv.density_fish_per_m2 !== null ? String(adv.density_fish_per_m2) : '—' },
      );
      adv.meal_schedule.forEach(m => {
        rows.push({ label: `Repas ${m.meal} (${m.time})`, value: `${m.ration_kg} kg (${m.pct}%)` });
      });
      adv.warnings.forEach((w, i) => rows.push({ label: `⚠️ Alerte ${i + 1}`, value: w }));
    }
    return {
      title: 'Rapport AquaFeed AI',
      subtitle: `${currentSpecies?.name ?? ''}${selectedInfra ? ` — ${selectedInfra.name}` : ''}`,
      filename: `aquafeed-${(currentSpecies?.name ?? 'calcul').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`,
      unitName: activeUnit?.name,
      columns: [
        { key: 'label', label: 'Paramètre' },
        { key: 'value', label: 'Valeur' },
      ],
      data: rows,
    };
  }, [result, advancedResult, currentSpecies, selectedInfra, activeUnit, fishCount, avgWeight, formatCurrency]);

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowRight className="w-4 h-4 mr-1.5 rotate-180" />AquaFeed AI
              </Button>
            )}
            <div className="p-2 bg-primary/10 rounded-lg"><Calculator className="w-6 h-6 text-primary" /></div>
            <div>
              <CardTitle className="text-xl sm:text-2xl">Calculateur AquaFeed</CardTitle>
              <CardDescription>Calcul intelligent de la ration — mode basique et mode avancé (IC, densité, coûts, prévisions).</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="calculator" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="calculator"><Calculator className="w-4 h-4 mr-2" />Calculateur</TabsTrigger>
          <TabsTrigger value="advanced"><Sliders className="w-4 h-4 mr-2" />Avancé (IC)</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Fish className="w-4 h-4" />Paramètres</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Espèce</Label>
                  <Select value={speciesId} onValueChange={setSpeciesId}>
                    <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {species.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nombre de poissons</Label>
                  <Input type="number" min={1} placeholder="0" value={fishCount || ''} onChange={e => setFishCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Poids moyen (g)</Label>
                  <Input type="number" min={0} placeholder="0" value={avgWeight || ''} onChange={e => setAvgWeight(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Temp. (°C)</Label>
                    <Input type="number" value={waterTemp} onChange={e => setWaterTemp(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Cycle (j)</Label>
                    <Input type="number" placeholder={String(currentSpecies?.default_cycle_days ?? 180)}
                      value={cycleDays} onChange={e => setCycleDays(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleCompute} disabled={loading}><Calculator className="w-4 h-4 mr-2" />Calculer et enregistrer</Button>
                {result && exportOptions && (
                  <ExportDropdown options={exportOptions} label="Exporter" className="w-full" />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Résultat</CardTitle></CardHeader>
              <CardContent>
                {!result ? (
                  <div className="text-center py-12 text-muted-foreground">Lancez un calcul pour afficher la ration recommandée.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="Biomasse" value={`${result.biomass_kg} kg`} />
                      <Stat label="Stade" value={result.stage} />
                      <Stat label="Taux" value={`${result.feed_rate_pct}%`} />
                      <Stat label="Repas/jour" value={String(result.meals_per_day)} />
                      <Stat label="Ration/jour" value={`${result.daily_ration_kg} kg`} highlight />
                      <Stat label="Ration/repas" value={`${result.ration_per_meal_kg} kg`} highlight />
                      <Stat label="Poids final" value={`${result.projected_final_weight_g} g`} />
                      <Stat label="Aliment cycle" value={`${result.projected_total_feed_kg} kg`} />
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.growth_curve}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="day" label={{ value: 'Jour', position: 'insideBottom', offset: -2 }} />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="weight_g" name="Poids (g)" stroke="hsl(var(--primary))" />
                          <Line yAxisId="right" type="monotone" dataKey="cumulative_feed_kg" name="Aliment cumulé (kg)" stroke="hsl(var(--chart-2, 200 90% 50%))" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <AdvancedAquaFeedCalculator />
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />Calculs récents</CardTitle>
                {history.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Vider l'historique
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Aucun calcul enregistré.</div>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge>{h.species_name ?? '—'}</Badge>
                          <Badge variant="outline">{h.stage}</Badge>
                          {h.calc_mode === 'advanced' && <Badge className="bg-primary/15 text-primary border-primary/30">Avancé</Badge>}
                          {h.infrastructure_name && <Badge variant="secondary" className="text-[10px]">{h.infrastructure_name}</Badge>}
                          <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm mt-1">{h.fish_count} poissons × {h.avg_weight_g} g → biomasse {h.biomass_kg} kg</p>
                        {h.fcr && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            IC {h.fcr} · Aliment cycle {h.projected_total_feed_kg} kg
                            {h.expected_margin ? ` · Marge ${formatCurrency(Number(h.expected_margin))}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{h.daily_ration_kg} kg/j</p>
                        <p className="text-xs text-muted-foreground">{h.meals_per_day} repas</p>
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

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`p-3 rounded-lg border ${highlight ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-base font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</p>
  </div>
);

type FeedView = 'home' | 'calculator' | 'feedmill';

const AquaFeedAI: React.FC = () => {
  const [view, setView] = useState<FeedView>('home');

  if (view === 'calculator') return <FeedCalculatorSuite onBack={() => setView('home')} />;
  if (view === 'feedmill') return <FeedMillWorkspace onBack={() => setView('home')} />;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Sparkles className="w-6 h-6 text-primary" /></div>
            <div>
              <CardTitle className="text-xl sm:text-2xl">🐟 AquaFeed AI</CardTitle>
              <CardDescription>Calcul des besoins alimentaires et fabrication de vos propres aliments aquacoles.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button type="button" onClick={() => setView('calculator')} className="text-left">
          <Card className="h-full hover:border-primary hover:shadow-md transition-all">
            <CardHeader>
              <div className="p-2.5 bg-primary/10 rounded-lg w-fit mb-2"><Calculator className="w-6 h-6 text-primary" /></div>
              <CardTitle className="text-lg">🧮 Calculateur AquaFeed</CardTitle>
              <CardDescription>
                Calculez les besoins alimentaires et planifiez l'alimentation de vos poissons (rations, IC, densité, coûts, prévisions).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium inline-flex items-center">Ouvrir <ArrowRight className="w-4 h-4 ml-1.5" /></span>
            </CardContent>
          </Card>
        </button>

        <button type="button" onClick={() => setView('feedmill')} className="text-left">
          <Card className="h-full hover:border-primary hover:shadow-md transition-all">
            <CardHeader>
              <div className="p-2.5 bg-primary/10 rounded-lg w-fit mb-2"><FlaskConical className="w-6 h-6 text-primary" /></div>
              <CardTitle className="text-lg">🧪 Fabrication & Formulation d'aliments</CardTitle>
              <CardDescription>
                Créez, optimisez et gérez vos propres formulations : ingrédients, nutrition, coûts, lots de fabrication et transfert au stock.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-primary font-medium inline-flex items-center">Ouvrir l'atelier <ArrowRight className="w-4 h-4 ml-1.5" /></span>
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
};

export default AquaFeedAI;