import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FlaskConical, Info, Play, Save, Trash2, Wand2, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  REFERENCE_INGREDIENTS, FEED_PARAMS, PARAM_HELP_PRICE, PARAM_HELP_INCORPORATION,
  SPECIES, STAGES, STAGE_PB_SUGGESTION, QUANTITY_PRESETS,
  LabIngredient, LabMode, LabResult, TargetMap, ParamKey,
  optimizeLab, computeFormulation, parseRequest, round,
} from '@/lib/feedLab';

const STORE_KEY = 'aquafeed-lab-formulations-v1';
const LIB_KEY = 'aquafeed-lab-library-v1';

interface SavedLab {
  id: string;
  name: string;
  species: string;
  stage: string;
  quantity_kg: number;
  mode: LabMode;
  targets: TargetMap;
  lines: any[];
  nutrition: Record<string, number>;
  total_cost: number;
  cost_per_kg: number;
  created_at: string;
}

const readStore = <T,>(key: string, fallback: T): T => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fallback; } catch { return fallback; }
};
const writeStore = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
};

const FeedLabStudio: React.FC = () => {
  const { formatCurrency, activeUnit } = useProductionUnits();
  const { user } = useAuth();

  const [library, setLibrary] = useState<LabIngredient[]>(() => {
    const saved = readStore<LabIngredient[] | null>(LIB_KEY, null);
    return saved && saved.length ? saved : REFERENCE_INGREDIENTS.map(i => ({ ...i }));
  });
  useEffect(() => { writeStore(LIB_KEY, library); }, [library]);

  const [selected, setSelected] = useState<string[]>(
    () => ['ref-mais', 'ref-son-ble', 'ref-fp50', 'ref-tourteau-soja', 'ref-huile-rouge', 'ref-cmv']
  );
  const [name, setName] = useState('Formulation croissance tilapia');
  const [species, setSpecies] = useState('tilapia');
  const [stage, setStage] = useState('croissance');
  const [quantity, setQuantity] = useState<number>(100);
  const [mode, setMode] = useState<LabMode>('balanced');
  const [targets, setTargets] = useState<TargetMap>({ pb: { min: 32, target: 32, max: 36 } });
  const [result, setResult] = useState<LabResult | null>(null);
  const [manual, setManual] = useState<Record<string, number>>({});
  const [request, setRequest] = useState('');
  const [saved, setSaved] = useState<SavedLab[]>(() => readStore<SavedLab[]>(STORE_KEY, []));
  const [busy, setBusy] = useState(false);

  useEffect(() => { writeStore(STORE_KEY, saved); }, [saved]);

  const chosen = useMemo(
    () => selected.map(id => library.find(i => i.id === id)).filter(Boolean) as LabIngredient[],
    [selected, library]
  );

  const patchIngredient = (id: string, patch: Partial<LabIngredient>) =>
    setLibrary(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const setTarget = (key: ParamKey, field: 'min' | 'target' | 'max', raw: string) =>
    setTargets(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: raw === '' ? null : Number(raw) } }));

  const runOptimize = () => {
    if (chosen.length < 2) { toast({ title: 'Sélection insuffisante', description: 'Choisissez au moins deux ingrédients.', variant: 'destructive' }); return; }
    if (!quantity || quantity <= 0) { toast({ title: 'Quantité invalide', description: 'Indiquez une quantité à produire supérieure à 0.', variant: 'destructive' }); return; }
    setBusy(true);
    setTimeout(() => {
      const res = optimizeLab({ ingredients: chosen, targets, totalQuantityKg: quantity, mode });
      setResult(res);
      const m: Record<string, number> = {};
      res.lines.forEach(l => { m[l.ingredient_id] = round(l.inclusion_pct, 2); });
      chosen.forEach(c => { if (!(c.id in m)) m[c.id] = 0; });
      setManual(m);
      setBusy(false);
      if (!res.feasible) toast({ title: 'Objectifs non atteints', description: res.problems[0] ?? '', variant: 'destructive' });
    }, 10);
  };

  const runManual = (next: Record<string, number>) => {
    setManual(next);
    if (!chosen.length) return;
    setResult(computeFormulation(chosen, chosen.map(c => Number(next[c.id] || 0)), quantity, targets));
  };

  const applyRequest = () => {
    if (!request.trim()) return;
    const p = parseRequest(request, library);
    if (p.species) setSpecies(p.species);
    if (p.stage) { setStage(p.stage); setTargets(prev => ({ ...prev, pb: { ...(prev.pb || {}), min: STAGE_PB_SUGGESTION[p.stage!], target: STAGE_PB_SUGGESTION[p.stage!] } })); }
    if (p.quantityKg) setQuantity(p.quantityKg);
    if (p.pbTarget) setTargets(prev => ({ ...prev, pb: { ...(prev.pb || {}), min: p.pbTarget!, target: p.pbTarget! } }));
    if (p.mode) setMode(p.mode);
    if (p.ingredientIds.length >= 2) setSelected(p.ingredientIds);
    toast({ title: 'Demande interprétée', description: "Vérifiez les paramètres puis lancez le calcul." });
  };

  const saveFormulation = async () => {
    if (!result) return;
    const row: SavedLab = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Formulation sans nom',
      species, stage, quantity_kg: quantity, mode, targets,
      lines: result.lines.map(l => ({ ingredient_id: l.ingredient_id, name: l.name, inclusion_pct: round(l.inclusion_pct, 2), quantity_kg: round(l.quantity_kg, 3), price_per_kg: l.price_per_kg, cost: round(l.cost, 2) })),
      nutrition: result.totals.values as any,
      total_cost: round(result.total_cost, 2),
      cost_per_kg: round(result.cost_per_kg, 2),
      created_at: new Date().toISOString(),
    };
    setSaved(prev => [row, ...prev]);
    try {
      await (supabase as any).from('feed_formulations').insert({
        user_id: user?.id, unit_id: activeUnit?.id ?? null, name: row.name, species, stage,
        batch_size_kg: quantity, mode, targets, lines: row.lines, nutrition: row.nutrition,
        total_cost: row.total_cost, cost_per_kg: row.cost_per_kg, status: 'active',
      });
    } catch { /* base indisponible : conservé sur l'appareil */ }
    toast({ title: 'Formulation enregistrée', description: row.name });
  };

  const exportCsv = () => {
    if (!result) return;
    const head = ['Ingrédient', 'Prix/kg', "Taux d'incorporation (%)", 'Quantité (kg)', 'Coût'];
    const rows = result.lines.map(l => [l.name, l.price_per_kg, round(l.inclusion_pct, 2), round(l.quantity_kg, 3), round(l.cost, 2)]);
    const nut = FEED_PARAMS.map(p => [p.full, round(result.totals.values[p.key], p.decimals), p.unit]);
    const csv = [
      [name], [],
      head, ...rows, [],
      ['Quantité totale (kg)', round(result.total_quantity_kg, 2)],
      ['Coût total', round(result.total_cost, 2)],
      ['Coût réel par kg', round(result.cost_per_kg, 2)], [],
      ['Valeur nutritionnelle finale'], ...nut,
    ].map(r => r.map(c => `"${String(c ?? '')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/\s+/g, '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="w-4 h-4 text-primary" />Décrivez votre besoin (facultatif)
            </CardTitle>
            <CardDescription>
              Exemple : « Formule-moi 500 kg d'aliment tilapia grossissement à 32 % de protéines avec des matières premières locales, le moins cher possible. »
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Textarea value={request} onChange={e => setRequest(e.target.value)} rows={2} className="flex-1" placeholder="Votre demande en français…" />
            <Button variant="outline" onClick={applyRequest}>Interpréter</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3"><CardTitle className="text-base">Paramètres de la formulation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Nom</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Espèce</Label>
                  <Select value={species} onValueChange={setSpecies}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50">{SPECIES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Stade</Label>
                  <Select value={stage} onValueChange={v => { setStage(v); setTargets(p => ({ ...p, pb: { ...(p.pb || {}), min: STAGE_PB_SUGGESTION[v], target: STAGE_PB_SUGGESTION[v] } })); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50">{STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Quantité à produire (kg)</Label>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                <div className="flex flex-wrap gap-1 mt-2">
                  {QUANTITY_PRESETS.map(q => (
                    <Button key={q} type="button" size="sm" variant={quantity === q ? 'default' : 'outline'} onClick={() => setQuantity(q)}>{q} kg</Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Mode de calcul</Label>
                <Select value={mode} onValueChange={v => setMode(v as LabMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="cost">Coût minimum</SelectItem>
                    <SelectItem value="balanced">Équilibré</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Label className="flex items-center gap-1">Objectifs nutritionnels
                  <Tip text="Laissez vide un paramètre que vous ne souhaitez pas contraindre." />
                </Label>
                <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {FEED_PARAMS.map(p => (
                    <div key={p.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
                      <span className="text-xs flex items-center gap-1">{p.label}<Tip text={`${p.full} (${p.unit}) — ${p.help}`} /></span>
                      <Input className="h-8 w-20 text-xs" placeholder="min" value={targets[p.key]?.min ?? ''} onChange={e => setTarget(p.key, 'min', e.target.value)} />
                      <Input className="h-8 w-20 text-xs" placeholder="max" value={targets[p.key]?.max ?? ''} onChange={e => setTarget(p.key, 'max', e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={runOptimize} disabled={busy}>
                <Play className="w-4 h-4 mr-2" />{busy ? 'Calcul en cours…' : 'Calculer la formulation'}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bibliothèque d'ingrédients (fiche de référence)</CardTitle>
              <CardDescription>
                Cochez les matières premières disponibles, ajustez le prix et les taux d'incorporation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Utiliser</th>
                      <th className="py-2 pr-2">Ingrédient</th>
                      <th className="py-2 pr-2 whitespace-nowrap">Prix/kg <Tip text={PARAM_HELP_PRICE} /></th>
                      <th className="py-2 pr-2">PB %</th>
                      <th className="py-2 pr-2">ED</th>
                      <th className="py-2 pr-2 whitespace-nowrap">Min % <Tip text={PARAM_HELP_INCORPORATION} /></th>
                      <th className="py-2 pr-2">Max %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {library.map(i => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">
                          <Checkbox
                            checked={selected.includes(i.id)}
                            onCheckedChange={c => setSelected(prev => (c ? [...prev, i.id] : prev.filter(x => x !== i.id)))}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="font-medium">{i.name}</div>
                          {i.price_per_kg == null && <span className="text-[10px] text-amber-600">Prix à renseigner</span>}
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input className="h-7 w-20" type="number" value={i.price_per_kg ?? ''} placeholder="—"
                            onChange={e => patchIngredient(i.id, { price_per_kg: e.target.value === '' ? null : Number(e.target.value) })} />
                        </td>
                        <td className="py-1.5 pr-2">{i.pb}</td>
                        <td className="py-1.5 pr-2">{i.ed}</td>
                        <td className="py-1.5 pr-2">
                          <Input className="h-7 w-16" type="number" value={i.min_inclusion_pct}
                            onChange={e => patchIngredient(i.id, { min_inclusion_pct: Number(e.target.value) })} />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input className="h-7 w-16" type="number" value={i.max_inclusion_pct}
                            onChange={e => patchIngredient(i.id, { max_inclusion_pct: Number(e.target.value) })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {result && (
          <Tabs defaultValue="recette" className="space-y-3">
            <TabsList>
              <TabsTrigger value="recette">Recette</TabsTrigger>
              <TabsTrigger value="nutrition">Valeur nutritionnelle</TabsTrigger>
              <TabsTrigger value="verification">Vérification des objectifs</TabsTrigger>
              <TabsTrigger value="historique">Historique ({saved.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="recette">
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" />{name}</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1.5" />Exporter</Button>
                    <Button size="sm" onClick={saveFormulation}><Save className="w-4 h-4 mr-1.5" />Enregistrer</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{w}</p>
                  ))}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 pr-2">Ingrédient</th><th className="py-2 pr-2">Taux %</th>
                        <th className="py-2 pr-2">Quantité (kg)</th><th className="py-2 pr-2">Prix/kg</th><th className="py-2 pr-2">Coût</th>
                      </tr></thead>
                      <tbody>
                        {chosen.map(c => {
                          const l = result.lines.find(x => x.ingredient_id === c.id);
                          return (
                            <tr key={c.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-2">{c.name}</td>
                              <td className="py-1.5 pr-2">
                                <Input className="h-7 w-20" type="number" value={manual[c.id] ?? 0}
                                  onChange={e => runManual({ ...manual, [c.id]: Number(e.target.value) })} />
                              </td>
                              <td className="py-1.5 pr-2">{round(l?.quantity_kg ?? 0, 3)}</td>
                              <td className="py-1.5 pr-2">{formatCurrency(c.price_per_kg ?? 0)}</td>
                              <td className="py-1.5 pr-2">{formatCurrency(l?.cost ?? 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <Stat label="Quantité totale" value={`${round(result.total_quantity_kg, 2)} kg`} />
                    <Stat label="Coût total" value={formatCurrency(result.total_cost)} />
                    <Stat label="Coût réel / kg" value={formatCurrency(result.cost_per_kg)} />
                    <Stat label="Protéines finales" value={`${round(result.totals.values.pb, 2)} %`} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="nutrition">
              <Card><CardContent className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {FEED_PARAMS.map(p => (
                  <div key={p.key} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <span className="text-xs flex items-center gap-1">{p.full}<Tip text={p.help} /></span>
                    <span className="text-sm font-semibold">{round(result.totals.values[p.key], p.decimals)} {p.unit}</span>
                  </div>
                ))}
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="verification">
              <Card><CardContent className="p-4 space-y-2">
                {result.conformity.map(c => (
                  <div key={c.key} className="flex items-start gap-2 text-sm">
                    {c.status === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                      : c.status === 'none' ? <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />}
                    <span className={c.status === 'low' || c.status === 'high' ? 'text-destructive' : ''}>{c.message}</span>
                  </div>
                ))}
                {!!result.suggestions.length && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-1">Solutions proposées</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                      {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="historique">
              <Card><CardContent className="p-4 space-y-2">
                {saved.length === 0 && <p className="text-sm text-muted-foreground">Aucune formulation enregistrée pour l'instant.</p>}
                {saved.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.quantity_kg} kg · {formatCurrency(s.cost_per_kg)}/kg · {new Date(s.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{s.species}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => setSaved(prev => prev.filter(x => x.id !== s.id))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </TooltipProvider>
  );
};

const Tip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip>
    <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground cursor-help inline" /></TooltipTrigger>
    <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
  </Tooltip>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border rounded-md px-3 py-2">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

export default FeedLabStudio;
