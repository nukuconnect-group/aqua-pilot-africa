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
import { FlaskConical, Info, Play, Save, Trash2, Wand2, CheckCircle2, AlertTriangle, Plus, RotateCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import ExportDropdown from '@/components/ExportDropdown';
import {
  REFERENCE_INGREDIENTS, FEED_PARAMS, PARAM_HELP_PRICE, PARAM_HELP_INCORPORATION,
  INGREDIENT_CATEGORIES_LAB, SPECIES, STAGES, STAGE_PB_SUGGESTION, QUANTITY_PRESETS,
  COUNTRY_MARKETS, LabIngredient, LabMode, LabResult, TargetMap, ParamKey,
  optimizeLab, computeFormulation, parseRequest, parseCountry,
  buildRecommendations, buildProcessSteps, round,
} from '@/lib/feedLab';

const STORE_KEY = 'aquafeed-lab-formulations-v1';
const LIB_KEY = 'aquafeed-lab-library-v2';

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

const emptyIngredient = (): LabIngredient => ({
  id: `user-${crypto.randomUUID()}`,
  name: '', category: 'cereale', price_per_kg: null,
  ed: 0, eb: 0, pb: 0, cb: 0, fb: 0, ca: 0, ph: 0,
  lysine: 0, methionine: 0, meth_lys: 0, sel: 0,
  min_inclusion_pct: 0, max_inclusion_pct: 100,
  recommended_inclusion_pct: null, source: 'user', stock_kg: 0,
});

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
  const [draft, setDraft] = useState<LabIngredient | null>(null);

  useEffect(() => { writeStore(STORE_KEY, saved); }, [saved]);

  const chosen = useMemo(
    () => selected.map(id => library.find(i => i.id === id)).filter(Boolean) as LabIngredient[],
    [selected, library]
  );

  const patchIngredient = (id: string, patch: Partial<LabIngredient>) =>
    setLibrary(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const removeIngredient = (id: string) => {
    setLibrary(prev => prev.filter(i => i.id !== id));
    setSelected(prev => prev.filter(x => x !== id));
  };

  const resetLibrary = () => {
    setLibrary(REFERENCE_INGREDIENTS.map(i => ({ ...i })));
    toast({ title: 'Bibliothèque réinitialisée', description: 'Les valeurs de la fiche de référence ont été restaurées.' });
  };

  const setTarget = (key: ParamKey, field: 'min' | 'target' | 'max', raw: string) =>
    setTargets(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: raw === '' ? null : Number(raw) } }));

  const compute = (ings: LabIngredient[], tgts: TargetMap, qty: number, md: LabMode) => {
    const res = optimizeLab({ ingredients: ings, targets: tgts, totalQuantityKg: qty, mode: md });
    setResult(res);
    const m: Record<string, number> = {};
    res.lines.forEach(l => { m[l.ingredient_id] = round(l.inclusion_pct, 2); });
    ings.forEach(c => { if (!(c.id in m)) m[c.id] = 0; });
    setManual(m);
    if (!res.feasible) toast({ title: 'Objectifs non atteints', description: res.problems[0] ?? '', variant: 'destructive' });
    return res;
  };

  const runOptimize = () => {
    if (chosen.length < 2) { toast({ title: 'Sélection insuffisante', description: 'Choisissez au moins deux ingrédients.', variant: 'destructive' }); return; }
    if (!quantity || quantity <= 0) { toast({ title: 'Quantité invalide', description: 'Indiquez une quantité à produire supérieure à 0.', variant: 'destructive' }); return; }
    setBusy(true);
    setTimeout(() => { compute(chosen, targets, quantity, mode); setBusy(false); }, 10);
  };

  const runManual = (next: Record<string, number>) => {
    setManual(next);
    if (!chosen.length) return;
    setResult(computeFormulation(chosen, chosen.map(c => Number(next[c.id] || 0)), quantity, targets));
  };

  /** Interprète la demande en français ET lance immédiatement le calcul complet. */
  const applyRequest = () => {
    if (!request.trim()) return;
    const p = parseRequest(request, library);
    const ctry = parseCountry(request);

    const nextStage = p.stage ?? stage;
    const nextSpecies = p.species ?? species;
    const nextQty = p.quantityKg ?? quantity;
    const nextMode = p.mode ?? mode;
    const pb = p.pbTarget ?? STAGE_PB_SUGGESTION[nextStage] ?? 32;
    const nextTargets: TargetMap = { ...targets, pb: { min: pb, target: pb, max: pb + 4 } };

    let lib = library;
    if (ctry) {
      const market = COUNTRY_MARKETS.find(c => c.code === ctry);
      if (market) {
        setCountry(ctry);
        lib = library.map(i => {
          const s = market.suggestions.find(x => x.ref_id === i.id);
          return s ? { ...i, price_per_kg: Math.round((s.price_min + s.price_max) / 2) } : i;
        });
        setLibrary(lib);
      }
    }

    let ids = p.ingredientIds.filter(id => lib.some(i => i.id === id));
    if (ids.length < 2) {
      const base = ['ref-mais', 'ref-son-ble', 'ref-fp50', 'ref-tourteau-soja', 'ref-huile-rouge', 'ref-cmv'];
      ids = Array.from(new Set([...ids, ...base])).filter(id => lib.some(i => i.id === id));
    }

    setSpecies(nextSpecies); setStage(nextStage); setQuantity(nextQty);
    setMode(nextMode); setTargets(nextTargets); setSelected(ids);
    setName(`Aliment ${SPECIES.find(s => s.key === nextSpecies)?.label ?? nextSpecies} ${STAGES.find(s => s.key === nextStage)?.label ?? ''} ${nextQty} kg`.trim());

    const ings = ids.map(id => lib.find(i => i.id === id)!).filter(Boolean);
    setBusy(true);
    setTimeout(() => {
      compute(ings, nextTargets, nextQty, nextMode);
      setBusy(false);
      setResultTab('fiche');
      toast({ title: 'Formulation calculée', description: `${nextQty} kg · ${pb} % de protéines · consultez la fiche de fabrication.` });
    }, 10);
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

  /* ---------------- Export (PDF / Word / Excel / CSV) ---------------- */
  const exportOptions = useMemo(() => {
    const data = (result?.lines ?? []).map(l => ({
      ingredient: l.name,
      taux: round(l.inclusion_pct, 2),
      quantite: round(l.quantity_kg, 3),
      prix: round(l.price_per_kg, 2),
      cout: round(l.cost, 2),
      ...FEED_PARAMS.reduce((a, p) => {
        a[`c_${p.key}`] = round(l.contributions[p.key], p.decimals);
        return a;
      }, {} as Record<string, number>),
    }));
    if (result) {
      data.push({
        ingredient: 'TOTAL',
        taux: round(result.lines.reduce((s, l) => s + l.inclusion_pct, 0), 2),
        quantite: round(result.total_quantity_kg, 3),
        prix: 0,
        cout: round(result.total_cost, 2),
        ...FEED_PARAMS.reduce((a, p) => {
          a[`c_${p.key}`] = round(result.totals.values[p.key], p.decimals);
          return a;
        }, {} as Record<string, number>),
      } as any);
    }
    return {
      title: name || 'Formulation aliment poisson',
      subtitle: `${SPECIES.find(s => s.key === species)?.label} · ${STAGES.find(s => s.key === stage)?.label} · ${quantity} kg · Coût réel ${round(result?.cost_per_kg ?? 0, 2)} /kg`,
      filename: (name || 'formulation').replace(/\s+/g, '_'),
      unitName: activeUnit?.name,
      columns: [
        { key: 'ingredient', label: 'Ingrédient' },
        { key: 'taux', label: "Taux d'incorporation (%)" },
        { key: 'quantite', label: 'Quantité (kg)' },
        { key: 'prix', label: 'Prix/kg' },
        { key: 'cout', label: 'Coût' },
        ...FEED_PARAMS.map(p => ({ key: `c_${p.key}`, label: `${p.label} (${p.unit})` })),
      ],
      data,
    };
  }, [result, name, species, stage, quantity, activeUnit?.name]);

  const totalPct = useMemo(
    () => round(chosen.reduce((s, c) => s + Number(manual[c.id] || 0), 0), 2),
    [chosen, manual]
  );

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
                <Label className="flex items-center gap-1">Objectifs nutritionnels (11 paramètres)
                  <Tip text="Minimum, valeur recommandée et maximum. Laissez vide un paramètre que vous ne souhaitez pas contraindre." />
                </Label>
                <div className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  <div className="grid grid-cols-[1fr_repeat(3,3.5rem)] gap-1.5 text-[10px] text-muted-foreground">
                    <span>Paramètre</span><span>Min</span><span>Reco.</span><span>Max</span>
                  </div>
                  {FEED_PARAMS.map(p => (
                    <div key={p.key} className="grid grid-cols-[1fr_repeat(3,3.5rem)] items-center gap-1.5">
                      <span className="text-xs flex items-center gap-1">{p.label}<Tip text={`${p.full} (${p.unit}) — ${p.help}`} /></span>
                      <Input className="h-8 px-1.5 text-xs" placeholder="—" value={targets[p.key]?.min ?? ''} onChange={e => setTarget(p.key, 'min', e.target.value)} />
                      <Input className="h-8 px-1.5 text-xs" placeholder="—" value={targets[p.key]?.target ?? ''} onChange={e => setTarget(p.key, 'target', e.target.value)} />
                      <Input className="h-8 px-1.5 text-xs" placeholder="—" value={targets[p.key]?.max ?? ''} onChange={e => setTarget(p.key, 'max', e.target.value)} />
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
            <CardHeader className="pb-3 flex-row items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Bibliothèque d'ingrédients ({library.length})</CardTitle>
                <CardDescription>
                  Toutes les colonnes de la fiche de référence sont affichées et modifiables : prix, ED, EB, PB, CB, FB, Ca, Ph, Lysine, Méthionine, Méth.+Lys., Sel et taux d'incorporation.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft(emptyIngredient())}><Plus className="w-4 h-4 mr-1.5" />Ingrédient</Button>
                <Button size="sm" variant="ghost" onClick={resetLibrary}><RotateCcw className="w-4 h-4 mr-1.5" />Réinitialiser</Button>
              </div>
            </CardHeader>
            <CardContent>
              {draft && (
                <div className="border rounded-md p-3 mb-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">Nom de l'ingrédient</Label>
                      <Input className="h-8" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Catégorie</Label>
                      <Select value={draft.category} onValueChange={v => setDraft({ ...draft, category: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50">{INGREDIENT_CATEGORIES_LAB.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Prix/kg</Label>
                      <Input className="h-8" type="number" value={draft.price_per_kg ?? ''} onChange={e => setDraft({ ...draft, price_per_kg: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    {FEED_PARAMS.map(p => (
                      <div key={p.key}>
                        <Label className="text-xs">{p.label} ({p.unit})</Label>
                        <Input className="h-8" type="number" value={(draft as any)[p.key]} onChange={e => setDraft({ ...draft, [p.key]: Number(e.target.value) } as LabIngredient)} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!draft.name.trim()) { toast({ title: 'Nom requis', description: "Indiquez le nom de l'ingrédient.", variant: 'destructive' }); return; }
                      setLibrary(prev => [...prev, draft]); setDraft(null);
                      toast({ title: 'Ingrédient ajouté', description: draft.name });
                    }}>Ajouter</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Annuler</Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-xs min-w-[64rem]">
                  <thead className="sticky top-0 bg-background">
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-2">Utiliser</th>
                      <th className="py-2 pr-2 min-w-[11rem]">Ingrédient</th>
                      <th className="py-2 pr-2 whitespace-nowrap">Prix/kg <Tip text={PARAM_HELP_PRICE} /></th>
                      {FEED_PARAMS.map(p => (
                        <th key={p.key} className="py-2 pr-2 whitespace-nowrap">{p.label}<Tip text={`${p.full} (${p.unit}) — ${p.help}`} /></th>
                      ))}
                      <th className="py-2 pr-2 whitespace-nowrap">Min % <Tip text={PARAM_HELP_INCORPORATION} /></th>
                      <th className="py-2 pr-2 whitespace-nowrap">Reco. %</th>
                      <th className="py-2 pr-2 whitespace-nowrap">Max %</th>
                      <th className="py-2 pr-2"></th>
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
                          <div className="text-[10px] text-muted-foreground">
                            {INGREDIENT_CATEGORIES_LAB.find(c => c.key === i.category)?.label ?? i.category}
                            {i.price_per_kg == null && <span className="text-amber-600"> · prix à renseigner</span>}
                          </div>
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input className="h-7 w-20" type="number" value={i.price_per_kg ?? ''} placeholder="—"
                            onChange={e => patchIngredient(i.id, { price_per_kg: e.target.value === '' ? null : Number(e.target.value) })} />
                        </td>
                        {FEED_PARAMS.map(p => (
                          <td key={p.key} className="py-1.5 pr-2">
                            <Input className="h-7 w-20" type="number" value={(i as any)[p.key]}
                              onChange={e => patchIngredient(i.id, { [p.key]: Number(e.target.value) } as Partial<LabIngredient>)} />
                          </td>
                        ))}
                        <td className="py-1.5 pr-2">
                          <Input className="h-7 w-16" type="number" value={i.min_inclusion_pct}
                            onChange={e => patchIngredient(i.id, { min_inclusion_pct: Number(e.target.value) })} />
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">{i.recommended_inclusion_pct ?? '—'}</td>
                        <td className="py-1.5 pr-2">
                          <Input className="h-7 w-16" type="number" value={i.max_inclusion_pct}
                            onChange={e => patchIngredient(i.id, { max_inclusion_pct: Number(e.target.value) })} />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeIngredient(i.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {!result && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
            Sélectionnez vos matières premières, définissez vos objectifs puis lancez le calcul pour afficher la recette, les contributions, la valeur nutritionnelle et la vérification des objectifs.
          </CardContent></Card>
        )}

        {result && (
          <Tabs defaultValue="recette" className="space-y-3">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="recette">Recette</TabsTrigger>
              <TabsTrigger value="contributions">Contributions</TabsTrigger>
              <TabsTrigger value="nutrition">Valeur nutritionnelle</TabsTrigger>
              <TabsTrigger value="verification">Vérification des objectifs</TabsTrigger>
              <TabsTrigger value="historique">Historique ({saved.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="recette">
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" />{name}</CardTitle>
                  <div className="flex gap-2">
                    <ExportDropdown options={exportOptions} label="Exporter" />
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
                        <tr className="font-semibold">
                          <td className="py-1.5 pr-2">TOTAL</td>
                          <td className={`py-1.5 pr-2 ${Math.abs(totalPct - 100) > 0.5 ? 'text-destructive' : 'text-emerald-600'}`}>{totalPct} %</td>
                          <td className="py-1.5 pr-2">{round(result.total_quantity_kg, 3)}</td>
                          <td className="py-1.5 pr-2">—</td>
                          <td className="py-1.5 pr-2">{formatCurrency(result.total_cost)}</td>
                        </tr>
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

            <TabsContent value="contributions">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Contributions par ingrédient</CardTitle>
                  <CardDescription>Quantité × valeur de l'ingrédient, comme dans la fiche de référence.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[52rem]">
                      <thead><tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 pr-2 min-w-[11rem]">Ingrédient</th>
                        <th className="py-2 pr-2">Qté (kg)</th>
                        {FEED_PARAMS.map(p => <th key={p.key} className="py-2 pr-2 whitespace-nowrap">{p.label}</th>)}
                      </tr></thead>
                      <tbody>
                        {result.lines.map(l => (
                          <tr key={l.ingredient_id} className="border-b last:border-0">
                            <td className="py-1.5 pr-2">{l.name}</td>
                            <td className="py-1.5 pr-2">{round(l.quantity_kg, 3)}</td>
                            {FEED_PARAMS.map(p => <td key={p.key} className="py-1.5 pr-2">{round(l.contributions[p.key], p.decimals)}</td>)}
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-1.5 pr-2">Total contributions</td>
                          <td className="py-1.5 pr-2">{round(result.total_quantity_kg, 3)}</td>
                          {FEED_PARAMS.map(p => <td key={p.key} className="py-1.5 pr-2">{round(result.totals.contributions[p.key], p.decimals)}</td>)}
                        </tr>
                        <tr className="font-semibold text-primary">
                          <td className="py-1.5 pr-2">Valeur finale de l'aliment</td>
                          <td className="py-1.5 pr-2">/ kg</td>
                          {FEED_PARAMS.map(p => <td key={p.key} className="py-1.5 pr-2">{round(result.totals.values[p.key], p.decimals)}</td>)}
                        </tr>
                      </tbody>
                    </table>
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
                  <div key={s.id} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.quantity_kg} kg · {formatCurrency(s.cost_per_kg)}/kg · PB {round(Number(s.nutrition?.pb ?? 0), 2)} % · {new Date(s.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{SPECIES.find(x => x.key === s.species)?.label ?? s.species}</Badge>
                      <Button size="sm" variant="outline" onClick={() => {
                        setName(`${s.name} (copie)`); setSpecies(s.species); setStage(s.stage);
                        setQuantity(s.quantity_kg); setMode(s.mode); setTargets(s.targets);
                        const ids = s.lines.map((l: any) => l.ingredient_id).filter((id: string) => library.some(i => i.id === id));
                        if (ids.length) setSelected(ids);
                        const m: Record<string, number> = {};
                        s.lines.forEach((l: any) => { m[l.ingredient_id] = l.inclusion_pct; });
                        setManual(m);
                        toast({ title: 'Formulation chargée', description: s.name });
                      }}>Rouvrir</Button>
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
