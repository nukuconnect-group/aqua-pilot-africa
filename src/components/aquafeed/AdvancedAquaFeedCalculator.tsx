import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calculator, Target, Utensils, Fish, Wallet, Package, Info, AlertTriangle, Ruler, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ExportDropdown from '@/components/ExportDropdown';

type Species = 'tilapia' | 'clarias';
type InfraType = 'etang' | 'bassin_beton' | 'bac_hors_sol' | 'biofloc' | 'ras' | 'cage_flottante';

const INFRA_LABELS: Record<InfraType, string> = {
  etang: 'Étang',
  bassin_beton: 'Bassin béton',
  bac_hors_sol: 'Bac hors-sol',
  biofloc: 'Biofloc',
  ras: 'RAS (recirculation)',
  cage_flottante: 'Cage flottante',
};

const FCR_PRESETS = [1.0, 1.2, 1.3, 1.5, 1.8];
const BAG_PRESETS = [15, 25, 50];

interface ObjectiveResult {
  productionTargetKg: number;
  finalWeightKg: number;
  initialWeightKg: number;
  survivalRate: number;
  fcr: number;
  feedPrice: number;
  bagWeight: number;
  fishToHarvest: number;
  fingerlings: number;
  initialBiomass: number;
  biomassGain: number;
  totalFeedKg: number;
  totalCost: number;
  bagsNeeded: number;
}

interface DailyResult {
  fishCount: number;
  avgWeightG: number;
  biomassKg: number;
  feedRatePct: number;
  dailyRationKg: number;
  monthlyRationKg: number;
  cost: number;
  bagsPerMonth: number;
}

const AdvancedAquaFeedCalculator: React.FC = () => {
  const { formatCurrency, activeUnit } = useProductionUnits();

  const STORAGE_KEY = `aquafeed_calc_${activeUnit?.id ?? 'global'}`;
  const initial = (() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  // Mode 1: production objective — plus de valeurs de démo, tout part à 0/vide
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'tilapia');
  const [infra, setInfra] = useState<InfraType>(initial?.infra ?? 'bassin_beton');
  const [productionTarget, setProductionTarget] = useState<number>(initial?.productionTarget ?? 0);
  const [finalWeight, setFinalWeight] = useState<number>(initial?.finalWeight ?? 0);
  const [initialWeight, setInitialWeight] = useState<number>(initial?.initialWeight ?? 0);
  const [survivalRate, setSurvivalRate] = useState<number>(initial?.survivalRate ?? 0);
  const [fcr, setFcr] = useState<number>(initial?.fcr ?? 0);
  const [feedPrice, setFeedPrice] = useState<number>(initial?.feedPrice ?? 0);
  const [bagWeight, setBagWeight] = useState<number>(initial?.bagWeight ?? 25);
  const [customBag, setCustomBag] = useState<number | ''>(initial?.customBag ?? '');

  // Mode 2: daily ration from biomass
  const [dFishCount, setDFishCount] = useState<number>(initial?.dFishCount ?? 0);
  const [dAvgWeight, setDAvgWeight] = useState<number>(initial?.dAvgWeight ?? 0);
  const [dFeedRate, setDFeedRate] = useState<number>(initial?.dFeedRate ?? 0);
  const [dFeedPrice, setDFeedPrice] = useState<number>(initial?.dFeedPrice ?? 0);
  const [dBagWeight, setDBagWeight] = useState<number>(initial?.dBagWeight ?? 25);

  // Auto-sauvegarde locale à chaque changement, restauration au retour
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        species, infra, productionTarget, finalWeight, initialWeight, survivalRate,
        fcr, feedPrice, bagWeight, customBag,
        dFishCount, dAvgWeight, dFeedRate, dFeedPrice, dBagWeight,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* quota / private mode */ }
  }, [STORAGE_KEY, species, infra, productionTarget, finalWeight, initialWeight, survivalRate, fcr, feedPrice, bagWeight, customBag, dFishCount, dAvgWeight, dFeedRate, dFeedPrice, dBagWeight]);

  const resetAll = () => {
    setSpecies('tilapia');
    setInfra('bassin_beton');
    setProductionTarget(0); setFinalWeight(0); setInitialWeight(0);
    setSurvivalRate(0); setFcr(0); setFeedPrice(0); setBagWeight(25); setCustomBag('');
    setDFishCount(0); setDAvgWeight(0); setDFeedRate(0); setDFeedPrice(0); setDBagWeight(25);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  };

  // ---------- Validation stricte ----------
  const objectiveErrors = useMemo(() => {
    const errs: string[] = [];
    const bag = typeof customBag === 'number' && customBag > 0 ? customBag : bagWeight;
    if (!(productionTarget > 0)) errs.push("L'objectif de production doit être supérieur à 0 kg.");
    if (!(finalWeight > 0)) errs.push('Le poids moyen final doit être supérieur à 0 g.');
    if (!(initialWeight > 0)) errs.push("Le poids moyen de l'alevin doit être supérieur à 0 g.");
    if (finalWeight > 0 && initialWeight > 0 && initialWeight >= finalWeight) {
      errs.push('Le poids alevin doit être inférieur au poids final visé.');
    }
    if (!(survivalRate >= 1 && survivalRate <= 100)) errs.push('Le taux de survie doit être compris entre 1 % et 100 %.');
    if (!(fcr > 0)) errs.push("L'IC (indice de conversion) doit être supérieur à 0.");
    if (!(feedPrice > 0)) errs.push("Le prix de l'aliment doit être supérieur à 0.");
    if (!(bag > 0)) errs.push('Le poids du sac doit être supérieur à 0 kg.');
    return errs;
  }, [productionTarget, finalWeight, initialWeight, survivalRate, fcr, feedPrice, bagWeight, customBag]);

  const dailyErrors = useMemo(() => {
    const errs: string[] = [];
    if (!(dFishCount > 0)) errs.push('Le nombre de poissons doit être supérieur à 0.');
    if (!(dAvgWeight > 0)) errs.push('Le poids moyen individuel doit être supérieur à 0 g.');
    if (!(dFeedRate > 0 && dFeedRate <= 20)) errs.push("Le % d'alimentation doit être compris entre 0 et 20 %.");
    if (!(dFeedPrice > 0)) errs.push("Le prix de l'aliment doit être supérieur à 0.");
    if (!(dBagWeight > 0)) errs.push('Le poids du sac doit être supérieur à 0 kg.');
    return errs;
  }, [dFishCount, dAvgWeight, dFeedRate, dFeedPrice, dBagWeight]);

  const objectiveResult: ObjectiveResult | null = useMemo(() => {
    const bag = typeof customBag === 'number' && customBag > 0 ? customBag : bagWeight;
    if (objectiveErrors.length > 0) return null;
    const finalKg = finalWeight / 1000;
    const initialKg = initialWeight / 1000;
    const fishToHarvest = productionTarget / finalKg;
    const fingerlings = (fishToHarvest * 100) / survivalRate;
    const initialBiomass = fingerlings * initialKg;
    const biomassGain = productionTarget - initialBiomass;
    const totalFeedKg = biomassGain * fcr;
    const totalCost = totalFeedKg * feedPrice;
    const bagsNeeded = Math.ceil(totalFeedKg / bag);
    return {
      productionTargetKg: productionTarget,
      finalWeightKg: finalKg,
      initialWeightKg: initialKg,
      survivalRate,
      fcr,
      feedPrice,
      bagWeight: bag,
      fishToHarvest: Math.round(fishToHarvest),
      fingerlings: Math.ceil(fingerlings),
      initialBiomass: Math.round(initialBiomass * 100) / 100,
      biomassGain: Math.round(biomassGain * 100) / 100,
      totalFeedKg: Math.round(totalFeedKg * 100) / 100,
      totalCost: Math.round(totalCost),
      bagsNeeded,
    };
  }, [productionTarget, finalWeight, initialWeight, survivalRate, fcr, feedPrice, bagWeight, customBag, objectiveErrors]);

  const dailyResult: DailyResult | null = useMemo(() => {
    if (dailyErrors.length > 0) return null;
    const biomassKg = (dFishCount * dAvgWeight) / 1000;
    const dailyRationKg = biomassKg * (dFeedRate / 100);
    const monthlyRationKg = dailyRationKg * 30;
    const cost = monthlyRationKg * dFeedPrice;
    const bagsPerMonth = Math.ceil(monthlyRationKg / dBagWeight);
    return {
      fishCount: dFishCount,
      avgWeightG: dAvgWeight,
      biomassKg: Math.round(biomassKg * 1000) / 1000,
      feedRatePct: dFeedRate,
      dailyRationKg: Math.round(dailyRationKg * 1000) / 1000,
      monthlyRationKg: Math.round(monthlyRationKg * 100) / 100,
      cost: Math.round(cost),
      bagsPerMonth,
    };
  }, [dFishCount, dAvgWeight, dFeedRate, dFeedPrice, dBagWeight, dailyErrors]);

  const exportOptions = useMemo(() => {
    if (!objectiveResult) return null;
    const r = objectiveResult;
    const rows = [
      { label: 'Espèce', value: species === 'tilapia' ? 'Tilapia' : 'Clarias' },
      { label: 'Infrastructure', value: INFRA_LABELS[infra] },
      { label: 'Objectif de production', value: `${r.productionTargetKg} kg` },
      { label: 'Poids moyen final', value: `${finalWeight} g` },
      { label: 'Poids moyen initial (alevin)', value: `${initialWeight} g` },
      { label: 'Taux de survie', value: `${r.survivalRate} %` },
      { label: 'IC (Indice de Conversion)', value: String(r.fcr) },
      { label: 'Prix aliment / kg', value: formatCurrency(r.feedPrice) },
      { label: 'Poids du sac', value: `${r.bagWeight} kg` },
      { label: 'Poissons à récolter', value: `${r.fishToHarvest.toLocaleString('fr-FR')} poissons` },
      { label: 'Alevins à empoissonner', value: `${r.fingerlings.toLocaleString('fr-FR')} alevins` },
      { label: 'Biomasse initiale', value: `${r.initialBiomass} kg` },
      { label: 'Gain de biomasse', value: `${r.biomassGain} kg` },
      { label: "Quantité totale d'aliment", value: `${r.totalFeedKg} kg` },
      { label: "Coût total de l'alimentation", value: formatCurrency(r.totalCost) },
      { label: 'Nombre de sacs à acheter', value: `${r.bagsNeeded} sacs de ${r.bagWeight} kg` },
    ];
    return {
      title: 'AquaFeed AI — Plan de production',
      subtitle: `${species === 'tilapia' ? 'Tilapia' : 'Clarias'} · ${INFRA_LABELS[infra]} · Objectif ${r.productionTargetKg} kg`,
      filename: `aquafeed-objectif-${species}-${new Date().toISOString().slice(0, 10)}`,
      unitName: activeUnit?.name,
      columns: [
        { key: 'label', label: 'Paramètre' },
        { key: 'value', label: 'Valeur' },
      ],
      data: rows,
    };
  }, [objectiveResult, species, infra, finalWeight, initialWeight, formatCurrency, activeUnit]);

  const dailyExportOptions = useMemo(() => {
    if (!dailyResult) return null;
    const d = dailyResult;
    const rows = [
      { label: 'Nombre de poissons', value: d.fishCount.toLocaleString('fr-FR') },
      { label: 'Poids moyen individuel', value: `${d.avgWeightG} g` },
      { label: "% d'alimentation appliqué", value: `${d.feedRatePct} %` },
      { label: 'Prix aliment / kg', value: formatCurrency(dFeedPrice) },
      { label: 'Poids du sac', value: `${dBagWeight} kg` },
      { label: 'Biomasse totale', value: `${d.biomassKg} kg` },
      { label: 'Ration journalière', value: `${d.dailyRationKg} kg/j` },
      { label: 'Ration mensuelle', value: `${d.monthlyRationKg} kg` },
      { label: 'Coût mensuel', value: formatCurrency(d.cost) },
      { label: 'Sacs / mois', value: `${d.bagsPerMonth} sacs de ${dBagWeight} kg` },
    ];
    return {
      title: 'AquaFeed AI — Ration journalière',
      subtitle: `${d.fishCount.toLocaleString('fr-FR')} poissons · ${d.avgWeightG} g/pce · ${d.feedRatePct} %`,
      filename: `aquafeed-ration-${new Date().toISOString().slice(0, 10)}`,
      unitName: activeUnit?.name,
      columns: [
        { key: 'label', label: 'Paramètre' },
        { key: 'value', label: 'Valeur' },
      ],
      data: rows,
    };
  }, [dailyResult, dFeedPrice, dBagWeight, formatCurrency, activeUnit]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Calculateur professionnel Tilapia / Clarias
              </CardTitle>
              <CardDescription>
                Vos saisies sont <strong>automatiquement conservées</strong> et retrouvées à votre retour. Utilisez « Vider » pour repartir de zéro.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetAll}
              className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/40 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Vider les calculs
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="objective" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:w-auto sm:grid-cols-2">
          <TabsTrigger className="min-w-0 whitespace-normal py-2 text-center" value="objective"><Target className="mr-2 size-4 shrink-0" />Objectif de production</TabsTrigger>
          <TabsTrigger className="min-w-0 whitespace-normal py-2 text-center" value="daily"><Utensils className="mr-2 size-4 shrink-0" />Biomasse & ration/jour</TabsTrigger>
        </TabsList>

        {/* MODE 1 : OBJECTIF DE PRODUCTION */}
        <TabsContent value="objective" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Fish className="w-4 h-4" />Paramètres</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Espèce</Label>
                    <Select value={species} onValueChange={v => setSpecies(v as Species)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tilapia">Tilapia</SelectItem>
                        <SelectItem value="clarias">Clarias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Infrastructure</Label>
                    <Select value={infra} onValueChange={v => setInfra(v as InfraType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(INFRA_LABELS) as InfraType[]).map(k => (
                          <SelectItem key={k} value={k}>{INFRA_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Objectif de production (kg)</Label>
                  <Input type="number" min={0} placeholder="0" value={productionTarget || ''}
                    onChange={e => setProductionTarget(Number(e.target.value))} />
                  <p className="text-[11px] text-muted-foreground mt-1">= {(productionTarget / 1000).toLocaleString('fr-FR')} tonnes</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Poids final (g)</Label>
                    <Input type="number" min={0} placeholder="0" value={finalWeight || ''}
                      onChange={e => setFinalWeight(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Poids alevin (g)</Label>
                    <Input type="number" min={0} placeholder="0" value={initialWeight || ''}
                      onChange={e => setInitialWeight(Number(e.target.value))} />
                  </div>
                </div>

                <div>
                  <Label>Taux de survie (%)</Label>
                  <Input type="number" min={1} max={100} placeholder="0" value={survivalRate || ''}
                    onChange={e => setSurvivalRate(Number(e.target.value))} />
                </div>

                <div>
                  <Label>IC (Indice de Conversion)</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {FCR_PRESETS.map(v => (
                      <Button key={v} type="button" size="sm"
                        variant={fcr === v ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        onClick={() => setFcr(v)}>{v}</Button>
                    ))}
                  </div>
                  <Input type="number" step="0.01" min={0.1} placeholder="0" value={fcr || ''}
                    onChange={e => setFcr(Number(e.target.value))} />
                </div>

                <div>
                  <Label>Prix aliment / kg</Label>
                  <Input type="number" min={0} placeholder="0" value={feedPrice || ''}
                    onChange={e => setFeedPrice(Number(e.target.value))} />
                </div>

                <div>
                  <Label>Poids du sac (kg)</Label>
                  <RadioGroup
                    value={customBag === '' || customBag === 0 ? String(bagWeight) : 'custom'}
                    onValueChange={(v) => {
                      if (v === 'custom') {
                        if (customBag === '' || customBag === 0) setCustomBag(20);
                      } else {
                        setBagWeight(Number(v));
                        setCustomBag('');
                      }
                    }}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    {BAG_PRESETS.map(b => (
                      <div key={b} className="flex items-center gap-1">
                        <RadioGroupItem value={String(b)} id={`bag-${b}`} />
                        <Label htmlFor={`bag-${b}`} className="text-xs cursor-pointer">{b} kg</Label>
                      </div>
                    ))}
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="custom" id="bag-custom" />
                      <Label htmlFor="bag-custom" className="text-xs cursor-pointer">Autre (kg)</Label>
                    </div>
                  </RadioGroup>
                  {(customBag !== '' && customBag !== 0) && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input type="number" min={1} step="0.1" placeholder="Poids personnalisé"
                        value={customBag}
                        onChange={e => setCustomBag(e.target.value === '' ? '' : Number(e.target.value))} />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">Choisissez un format standard ou saisissez votre propre poids de sac (kg).</p>
                </div>

                {exportOptions && (
                  <ExportDropdown options={exportOptions} label="Exporter le plan" className="w-full" />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4" />Résultats</CardTitle>
                <CardDescription className="text-xs">Recalcul automatique à chaque modification d'un paramètre.</CardDescription>
              </CardHeader>
              <CardContent>
                {objectiveErrors.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Paramètres invalides</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm">
                        {objectiveErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : !objectiveResult ? (
                  <div className="text-center py-12 text-muted-foreground">Renseignez les paramètres pour voir le plan.</div>
                ) : (
                  <div className="space-y-5">
                    {/* Synthèse */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <ResultStat icon={<Fish className="w-3.5 h-3.5" />} label="Poissons à récolter" value={objectiveResult.fishToHarvest.toLocaleString('fr-FR')} />
                      <ResultStat icon={<Fish className="w-3.5 h-3.5" />} label="Alevins à stocker" value={objectiveResult.fingerlings.toLocaleString('fr-FR')} highlight />
                      <ResultStat label="Biomasse initiale" value={`${objectiveResult.initialBiomass} kg`} />
                      <ResultStat label="Gain de biomasse" value={`${objectiveResult.biomassGain} kg`} />
                      <ResultStat icon={<Package className="w-3.5 h-3.5" />} label="Aliment total" value={`${objectiveResult.totalFeedKg} kg`} highlight />
                      <ResultStat icon={<Package className="w-3.5 h-3.5" />} label="Sacs à acheter" value={`${objectiveResult.bagsNeeded} sacs`} highlight />
                      <ResultStat icon={<Wallet className="w-3.5 h-3.5" />} label="Coût aliment total" value={formatCurrency(objectiveResult.totalCost)} highlight />
                      <ResultStat label="Coût / kg produit" value={formatCurrency(Math.round(objectiveResult.totalCost / Math.max(1, objectiveResult.productionTargetKg)))} />
                    </div>

                    {/* Résumé des unités */}
                    <UnitsSummary items={[
                      `Poids : g convertis en kg (÷ 1 000)`,
                      `Biomasse & aliment : kg${objectiveResult.productionTargetKg >= 1000 ? ` (${(objectiveResult.productionTargetKg / 1000).toLocaleString('fr-FR')} t)` : ''}`,
                      `Sacs : ${objectiveResult.bagWeight} kg / sac`,
                      `Prix : ${formatCurrency(objectiveResult.feedPrice)} / kg`,
                    ]} />

                    {/* Tableau récapitulatif */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tableau récapitulatif des résultats</p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr className="text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Paramètre</th>
                              <th className="px-3 py-2 text-right font-medium">Valeur</th>
                            </tr>
                          </thead>
                          <tbody>
                            <RecapRow label="Espèce" value={species === 'tilapia' ? 'Tilapia' : 'Clarias'} />
                            <RecapRow label="Infrastructure" value={INFRA_LABELS[infra]} />
                            <RecapRow label="Objectif de production" value={`${objectiveResult.productionTargetKg} kg`} />
                            <RecapRow label="Poids moyen final visé" value={`${finalWeight} g`} />
                            <RecapRow label="Poids moyen initial (alevin)" value={`${initialWeight} g`} />
                            <RecapRow label="Taux de survie" value={`${objectiveResult.survivalRate} %`} />
                            <RecapRow label="IC (FCR)" value={String(objectiveResult.fcr)} />
                            <RecapRow label="Prix aliment / kg" value={formatCurrency(objectiveResult.feedPrice)} />
                            <RecapRow label="Poids du sac" value={`${objectiveResult.bagWeight} kg`} />
                            <RecapRow label="Poissons à récolter" value={objectiveResult.fishToHarvest.toLocaleString('fr-FR')} bold />
                            <RecapRow label="Alevins à empoissonner" value={objectiveResult.fingerlings.toLocaleString('fr-FR')} bold />
                            <RecapRow label="Biomasse initiale" value={`${objectiveResult.initialBiomass} kg`} />
                            <RecapRow label="Gain de biomasse" value={`${objectiveResult.biomassGain} kg`} />
                            <RecapRow label="Quantité totale d'aliment" value={`${objectiveResult.totalFeedKg} kg`} bold />
                            <RecapRow label="Coût total de l'alimentation" value={formatCurrency(objectiveResult.totalCost)} bold />
                            <RecapRow label="Nombre de sacs à acheter" value={`${objectiveResult.bagsNeeded} sacs de ${objectiveResult.bagWeight} kg`} bold />
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MODE 2 : RATION JOURNALIÈRE */}
        <TabsContent value="daily" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4" />Ration journalière</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Nombre de poissons</Label>
                  <Input type="number" min={0} placeholder="0" value={dFishCount || ''} onChange={e => setDFishCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Poids moyen individuel (g)</Label>
                  <Input type="number" min={0} placeholder="0" value={dAvgWeight || ''} onChange={e => setDAvgWeight(Number(e.target.value))} />
                </div>
                <div>
                  <Label>% d'alimentation appliqué</Label>
                  <Input type="number" step="0.1" min={0} placeholder="0" value={dFeedRate || ''} onChange={e => setDFeedRate(Number(e.target.value))} />
                  <p className="text-[11px] text-muted-foreground mt-1">Ex. alevins 8-10%, juvéniles 4-6%, grossissement 2-3%.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Prix aliment/kg</Label>
                    <Input type="number" min={0} placeholder="0" value={dFeedPrice || ''} onChange={e => setDFeedPrice(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Poids sac (kg)</Label>
                    <Input type="number" min={1} placeholder="25" value={dBagWeight || ''} onChange={e => setDBagWeight(Number(e.target.value))} />
                    <p className="text-[11px] text-muted-foreground mt-1">Ex. 15, 25, 50 kg — ou votre propre format.</p>
                  </div>
                </div>
                {dailyExportOptions && (
                  <ExportDropdown options={dailyExportOptions} label="Exporter le plan" className="w-full" />
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Résultat journalier & mensuel</CardTitle></CardHeader>
              <CardContent>
                {dailyErrors.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Paramètres invalides</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-sm">
                        {dailyErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : !dailyResult ? (
                  <div className="text-center py-12 text-muted-foreground">Renseignez les paramètres.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <ResultStat label="Biomasse" value={`${dailyResult.biomassKg} kg`} />
                      <ResultStat label="Taux appliqué" value={`${dailyResult.feedRatePct} %`} />
                      <ResultStat label="Ration / jour" value={`${dailyResult.dailyRationKg} kg`} highlight />
                      <ResultStat label="Ration / mois" value={`${dailyResult.monthlyRationKg} kg`} />
                      <ResultStat label="Coût / mois" value={formatCurrency(dailyResult.cost)} highlight />
                      <ResultStat label="Sacs / mois" value={`${dailyResult.bagsPerMonth} sacs`} />
                    </div>
                    <UnitsSummary items={[
                      `Poids individuel : g → kg (÷ 1 000)`,
                      `Biomasse & rations : kg`,
                      `Sacs : ${dBagWeight} kg / sac`,
                      `Prix : ${formatCurrency(dFeedPrice)} / kg`,
                    ]} />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Tableau récapitulatif des résultats</p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr className="text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Paramètre</th>
                              <th className="px-3 py-2 text-right font-medium">Valeur</th>
                            </tr>
                          </thead>
                          <tbody>
                            <RecapRow label="Nombre de poissons" value={dailyResult.fishCount.toLocaleString('fr-FR')} />
                            <RecapRow label="Poids moyen individuel" value={`${dailyResult.avgWeightG} g`} />
                            <RecapRow label="% d'alimentation" value={`${dailyResult.feedRatePct} %`} />
                            <RecapRow label="Prix aliment / kg" value={formatCurrency(dFeedPrice)} />
                            <RecapRow label="Poids du sac" value={`${dBagWeight} kg`} />
                            <RecapRow label="Biomasse totale" value={`${dailyResult.biomassKg} kg`} bold />
                            <RecapRow label="Ration journalière" value={`${dailyResult.dailyRationKg} kg/j`} bold />
                            <RecapRow label="Ration mensuelle" value={`${dailyResult.monthlyRationKg} kg`} />
                            <RecapRow label="Coût mensuel" value={formatCurrency(dailyResult.cost)} bold />
                            <RecapRow label="Sacs / mois" value={`${dailyResult.bagsPerMonth} sacs de ${dBagWeight} kg`} bold />
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ResultStat: React.FC<{ label: string; value: string; icon?: React.ReactNode; highlight?: boolean }> = ({ label, value, icon, highlight }) => (
  <div className={`p-3 rounded-lg border ${highlight ? 'bg-primary/10 border-primary/30' : 'bg-card'}`}>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</p>
    <p className={`text-base font-semibold mt-0.5 ${highlight ? 'text-primary' : ''}`}>{value}</p>
  </div>
);

const RecapRow: React.FC<{ label: string; value: string; bold?: boolean; formula?: string }> = ({ label, value, bold, formula }) => (
  <tr className="border-b last:border-b-0">
    <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
    <td className={`px-3 py-1.5 text-right ${bold ? 'font-semibold text-primary' : ''}`}>{value}</td>
    <td className="px-3 py-1.5 text-xs text-muted-foreground font-mono hidden sm:table-cell">{formula ?? ''}</td>
  </tr>
);

const UnitsSummary: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="rounded-lg border bg-muted/30 p-3">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
      <Ruler className="w-3 h-3" /> Résumé des unités utilisées
    </p>
    <ul className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
      {items.map((it, i) => <li key={i}>• {it}</li>)}
    </ul>
  </div>
);

const FormulaStep: React.FC<{ n: number; title: string; formula: string; calc: string }> = ({ n, title, formula, calc }) => (
  <div className="p-3 rounded-lg border bg-muted/30">
    <div className="flex items-center gap-2 mb-1">
      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Étape {n}</Badge>
      <p className="text-sm font-medium">{title}</p>
    </div>
    <p className="text-xs text-muted-foreground font-mono">Formule : {formula}</p>
    <p className="text-sm font-mono mt-0.5">= {calc}</p>
  </div>
);

export default AdvancedAquaFeedCalculator;