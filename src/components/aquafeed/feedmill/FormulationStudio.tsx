import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Wand2, Save, Factory, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ExportDropdown from '@/components/ExportDropdown';
import {
  SPECIES_PROFILES, QUANTITY_PRESETS, FormulationMode, NutrientProfile,
  getStage, optimizeFormulation, FormulationResult, round,
} from '@/lib/feedFormulation';
import { StoredIngredient, StoredFormulation } from './useFeedMill';

interface Props {
  ingredients: StoredIngredient[];
  onSave: (payload: any) => Promise<StoredFormulation | null>;
  onManufacture: (formulation: StoredFormulation) => void;
  editing?: StoredFormulation | null;
  onClearEditing?: () => void;
}

const MODES: { key: FormulationMode; label: string; hint: string; icon: string }[] = [
  { key: 'cost', label: 'Coût minimum', hint: "Priorité au prix de revient", icon: '💰' },
  { key: 'balanced', label: 'Équilibrée', hint: 'Compromis nutrition / coût', icon: '⚖️' },
  { key: 'performance', label: 'Performance', hint: 'Priorité aux objectifs nutritionnels', icon: '⭐' },
];

const FormulationStudio: React.FC<Props> = ({ ingredients, onSave, onManufacture, editing, onClearEditing }) => {
  const { formatCurrency } = useProductionUnits();
  const [name, setName] = useState('');
  const [speciesKey, setSpeciesKey] = useState('tilapia');
  const [stageKey, setStageKey] = useState('croissance');
  const [batchSize, setBatchSize] = useState<number>(100);
  const [mode, setMode] = useState<FormulationMode>('balanced');
  const [targets, setTargets] = useState<NutrientProfile>(getStage('tilapia', 'croissance').targets);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<FormulationResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [saved, setSaved] = useState<StoredFormulation | null>(null);

  const species = useMemo(() => SPECIES_PROFILES.find(s => s.key === speciesKey)!, [speciesKey]);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setSpeciesKey(editing.species);
    setStageKey(editing.stage);
    setBatchSize(Number(editing.batch_size_kg));
    setMode((editing.mode as FormulationMode) || 'balanced');
    if (editing.targets) setTargets(editing.targets);
    setNotes(editing.notes ?? '');
    setSelected((editing.lines ?? []).map((l: any) => l.ingredient_id));
    setSaved(editing);
    setResult({
      lines: editing.lines ?? [],
      nutrition: editing.nutrition ?? { protein: 0, lipid: 0, fiber: 0, energy: 0, calcium: 0, phosphorus: 0 },
      total_cost: Number(editing.total_cost || 0),
      cost_per_kg: Number(editing.cost_per_kg || 0),
      cost_per_100kg: Number(editing.cost_per_kg || 0) * 100,
      cost_per_ton: Number(editing.cost_per_kg || 0) * 1000,
      feasible: true,
      messages: [],
    });
  }, [editing]);

  const applyProfile = (sp: string, st: string) => {
    setTargets({ ...getStage(sp, st).targets });
  };

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedIngredients = useMemo(
    () => ingredients.filter(i => selected.includes(i.id)),
    [ingredients, selected]
  );

  const generate = () => {
    if (selectedIngredients.length < 2) {
      toast({ title: 'Ingrédients insuffisants', description: 'Sélectionnez au moins 2 ingrédients.', variant: 'destructive' });
      return;
    }
    if (!batchSize || batchSize <= 0) {
      toast({ title: 'Quantité invalide', description: 'Indiquez une quantité à fabriquer supérieure à 0.', variant: 'destructive' });
      return;
    }
    setComputing(true);
    setTimeout(() => {
      const res = optimizeFormulation({ ingredients: selectedIngredients, targets, batchSizeKg: batchSize, mode });
      setResult(res);
      setComputing(false);
      setSaved(null);
      if (!res.feasible) toast({ title: 'Formulation impossible', description: res.messages.find(m => m.level === 'error')?.text, variant: 'destructive' });
    }, 30);
  };

  const save = async () => {
    if (!result || result.lines.length === 0) {
      toast({ title: 'Générez d\'abord une formulation', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: 'Nom requis', description: 'Donnez un nom à votre formulation.', variant: 'destructive' });
      return;
    }
    const payload: any = {
      ...(editing?.id ? { id: editing.id } : {}),
      name: name.trim(),
      species: speciesKey,
      stage: stageKey,
      batch_size_kg: batchSize,
      mode,
      targets,
      lines: result.lines,
      nutrition: result.nutrition,
      total_cost: result.total_cost,
      cost_per_kg: result.cost_per_kg,
      status: 'active',
      notes: notes || null,
    };
    const res = await onSave(payload);
    if (res) {
      setSaved(res);
      toast({ title: 'Formulation enregistrée', description: `${name} — ${batchSize} kg` });
      onClearEditing?.();
    }
  };

  const exportData = useMemo(() => {
    const rows: { label: string; value: string }[] = [
      { label: 'Formulation', value: name || '—' },
      { label: 'Espèce', value: species.label },
      { label: 'Stade', value: getStage(speciesKey, stageKey).label },
      { label: 'Quantité fabriquée', value: `${batchSize} kg` },
      { label: 'Mode', value: MODES.find(m => m.key === mode)?.label ?? mode },
      { label: '── INGRÉDIENTS ──', value: '' },
    ];
    (result?.lines ?? []).forEach(l => {
      rows.push({ label: l.name, value: `${l.quantity_kg} kg — ${l.percent} % — ${formatCurrency(l.cost)}` });
    });
    if (result) {
      rows.push(
        { label: '── NUTRITION ──', value: '' },
        { label: 'Protéines', value: `${result.nutrition.protein} % (objectif ${targets.protein} %)` },
        { label: 'Lipides', value: `${result.nutrition.lipid} % (objectif ${targets.lipid} %)` },
        { label: 'Fibres', value: `${result.nutrition.fiber} % (max ${targets.fiber_max} %)` },
        { label: 'Énergie', value: `${result.nutrition.energy} kcal/kg` },
        { label: 'Calcium', value: `${result.nutrition.calcium} %` },
        { label: 'Phosphore', value: `${result.nutrition.phosphorus} %` },
        { label: '── COÛTS ──', value: '' },
        { label: 'Coût total', value: formatCurrency(result.total_cost) },
        { label: 'Coût par kg', value: formatCurrency(result.cost_per_kg) },
        { label: 'Coût 100 kg', value: formatCurrency(result.cost_per_100kg) },
        { label: 'Coût 1 tonne', value: formatCurrency(result.cost_per_ton) },
        { label: '── RECOMMANDATIONS ──', value: '' },
      );
      result.messages.forEach((m, i) => rows.push({ label: `${m.level === 'ok' ? '✅' : '⚠️'} ${i + 1}`, value: m.text }));
    }
    return {
      title: 'Formulation d\'aliment — AquaFeed AI',
      subtitle: `${name || 'Formulation'} · ${species.label} · ${getStage(speciesKey, stageKey).label}`,
      filename: `formulation-${(name || 'aliment').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`,
      columns: [{ key: 'label', label: 'Élément' }, { key: 'value', label: 'Valeur' }],
      data: rows,
    };
  }, [result, name, species, speciesKey, stageKey, batchSize, mode, targets, formatCurrency]);

  const totalPercent = round((result?.lines ?? []).reduce((s, l) => s + l.percent, 0), 2);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Paramètres */}
      <div className="xl:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4" />Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Nom de la formulation</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Tilapia Croissance 32 %" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Espèce</Label>
                <Select value={speciesKey} onValueChange={v => { setSpeciesKey(v); const st = SPECIES_PROFILES.find(s => s.key === v)!.stages[0]; setStageKey(stageKey); applyProfile(v, stageKey || st.key); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIES_PROFILES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stade</Label>
                <Select value={stageKey} onValueChange={v => { setStageKey(v); applyProfile(speciesKey, v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {species.stages.map(s => <SelectItem key={s.key} value={s.key}>{s.label} · {s.weight_range}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Quantité à fabriquer (kg)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                {QUANTITY_PRESETS.map(q => (
                  <Button key={q} type="button" size="sm" variant={batchSize === q ? 'default' : 'outline'} onClick={() => setBatchSize(q)}>
                    {q >= 1000 ? '1 tonne' : `${q} kg`}
                  </Button>
                ))}
              </div>
              <Input type="number" min={1} value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} />
            </div>
            <div>
              <Label>Mode de formulation</Label>
              <div className="grid grid-cols-1 gap-1.5 mt-1">
                {MODES.map(m => (
                  <button
                    key={m.key} type="button" onClick={() => setMode(m.key)}
                    className={`text-left px-3 py-2 rounded-md border text-sm transition-colors ${mode === m.key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                  >
                    <span className="mr-2">{m.icon}</span>
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations, contraintes…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Objectifs nutritionnels</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => applyProfile(speciesKey, stageKey)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Profil de référence
              </Button>
            </div>
            <CardDescription className="text-xs">Valeurs proposées automatiquement — modifiables.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <NumField label="Protéines (%)" value={targets.protein} onChange={v => setTargets({ ...targets, protein: v })} />
            <NumField label="Lipides (%)" value={targets.lipid} onChange={v => setTargets({ ...targets, lipid: v })} />
            <NumField label="Fibres max (%)" value={targets.fiber_max} onChange={v => setTargets({ ...targets, fiber_max: v })} />
            <NumField label="Énergie (kcal/kg)" value={targets.energy} onChange={v => setTargets({ ...targets, energy: v })} />
            <NumField label="Calcium (%)" value={targets.calcium} onChange={v => setTargets({ ...targets, calcium: v })} />
            <NumField label="Phosphore (%)" value={targets.phosphorus} onChange={v => setTargets({ ...targets, phosphorus: v })} />
          </CardContent>
        </Card>
      </div>

      {/* Ingrédients + résultat */}
      <div className="xl:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base">Ingrédients disponibles ({selected.length} sélectionnés)</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelected(ingredients.filter(i => i.is_active).map(i => i.id))}>Tout</Button>
                <Button size="sm" variant="outline" onClick={() => setSelected([])}>Aucun</Button>
                <Button size="sm" onClick={generate} disabled={computing}>
                  <Wand2 className="w-4 h-4 mr-1.5" />{computing ? 'Calcul…' : 'Générer'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
              {ingredients.filter(i => i.is_active).map(i => (
                <label key={i.id} className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer text-sm ${selected.includes(i.id) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <Checkbox checked={selected.includes(i.id)} onCheckedChange={() => toggle(i.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium block truncate">{i.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.protein_pct}% PB · {i.lipid_pct}% MG · {formatCurrency(i.price_per_kg)}/kg
                      {i.stock_kg > 0 ? ` · stock ${i.stock_kg} kg` : ''}
                    </span>
                  </span>
                </label>
              ))}
              {ingredients.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-2 py-6 text-center">Aucun ingrédient. Ajoutez-en dans la bibliothèque.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {result && result.lines.length > 0 && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">Formulation obtenue</CardTitle>
                  <div className="flex gap-2">
                    <ExportDropdown options={exportData as any} />
                    <Button size="sm" variant="outline" onClick={save}><Save className="w-4 h-4 mr-1.5" />Enregistrer</Button>
                    <Button size="sm" disabled={!saved} onClick={() => saved && onManufacture(saved)}>
                      <Factory className="w-4 h-4 mr-1.5" />Fabriquer
                    </Button>
                  </div>
                </div>
                {!saved && <CardDescription className="text-xs">Enregistrez la formulation pour pouvoir lancer une fabrication.</CardDescription>}
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2">Ingrédient</th><th className="py-2 text-right">Quantité</th>
                      <th className="py-2 text-right">%</th><th className="py-2 text-right">Prix/kg</th><th className="py-2 text-right">Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map(l => (
                      <tr key={l.ingredient_id} className="border-b last:border-0">
                        <td className="py-1.5">{l.name}</td>
                        <td className="py-1.5 text-right">{l.quantity_kg} kg</td>
                        <td className="py-1.5 text-right">{l.percent} %</td>
                        <td className="py-1.5 text-right">{formatCurrency(l.price_per_kg)}</td>
                        <td className="py-1.5 text-right font-medium">{formatCurrency(l.cost)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-right">{round(batchSize, 2)} kg</td>
                      <td className="py-2 text-right">{totalPercent} %</td>
                      <td />
                      <td className="py-2 text-right">{formatCurrency(result.total_cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Résultat nutritionnel</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <NutRow label="Protéines" got={result.nutrition.protein} target={targets.protein} unit="%" />
                  <NutRow label="Lipides" got={result.nutrition.lipid} target={targets.lipid} unit="%" />
                  <NutRow label="Fibres" got={result.nutrition.fiber} target={targets.fiber_max} unit="%" max />
                  <NutRow label="Énergie" got={result.nutrition.energy} target={targets.energy} unit="kcal/kg" />
                  <NutRow label="Calcium" got={result.nutrition.calcium} target={targets.calcium} unit="%" tol={0.25} />
                  <NutRow label="Phosphore" got={result.nutrition.phosphorus} target={targets.phosphorus} unit="%" tol={0.25} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Coût de fabrication</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <Stat label="Coût total" value={formatCurrency(result.total_cost)} highlight />
                  <Stat label="Coût / kg" value={formatCurrency(result.cost_per_kg)} highlight />
                  <Stat label="Coût / 100 kg" value={formatCurrency(result.cost_per_100kg)} />
                  <Stat label="Coût / tonne" value={formatCurrency(result.cost_per_ton)} />
                </CardContent>
              </Card>
            </div>

            {result.messages.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Analyse & recommandations</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {result.messages.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      {m.level === 'ok'
                        ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        : <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${m.level === 'error' ? 'text-destructive' : 'text-amber-500'}`} />}
                      <span>{m.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const NumField: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type="number" value={value} onChange={e => onChange(Number(e.target.value))} />
  </div>
);

const NutRow: React.FC<{ label: string; got: number; target: number; unit: string; max?: boolean; tol?: number }> = ({ label, got, target, unit, max, tol = 0.05 }) => {
  const ok = max ? got <= target : target <= 0 || Math.abs((got - target) / target) <= tol;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-medium">{got} {unit}</span>
        <Badge variant="outline" className="text-[10px]">{max ? 'max' : 'obj.'} {target} {unit}</Badge>
        {ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
      </span>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`p-2.5 rounded-md border ${highlight ? 'bg-primary/5 border-primary/30' : ''}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

export default FormulationStudio;
