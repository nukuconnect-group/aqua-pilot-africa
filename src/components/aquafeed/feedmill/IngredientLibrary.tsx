import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, ListPlus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ExportDropdown from '@/components/ExportDropdown';
import { INGREDIENT_CATEGORIES } from '@/lib/feedFormulation';
import { StoredIngredient } from './useFeedMill';

interface Props {
  ingredients: StoredIngredient[];
  onSave: (payload: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  /** Envoie les ingrédients cochés vers la liste de travail de formulation. */
  onUseSelection?: (ids: string[]) => void;
}

const empty = {
  name: '', category: 'proteine', price_per_kg: 0, protein_pct: 0, lipid_pct: 0, fiber_pct: 0,
  energy_kcal_kg: 0, calcium_pct: 0, phosphorus_pct: 0, ash_pct: 0, moisture_pct: 10,
  min_inclusion_pct: 0, max_inclusion_pct: 100, stock_kg: 0, supplier: '', notes: '', is_active: true,
};

const IngredientLibrary: React.FC<Props> = ({ ingredients, onSave, onDelete, onUseSelection }) => {
  const { formatCurrency } = useProductionUnits();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [picked, setPicked] = useState<string[]>([]);

  const togglePick = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const filtered = useMemo(() => ingredients.filter(i =>
    (category === 'all' || i.category === category) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  ), [ingredients, search, category]);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (i: StoredIngredient) => { setForm({ ...i, supplier: i.supplier ?? '', notes: i.notes ?? '' }); setOpen(true); };

  const submit = async () => {
    if (!form.name?.trim()) return;
    await onSave({ ...form, name: form.name.trim() });
    setOpen(false);
  };

  const exportOptions = {
    title: 'Bibliothèque des matières premières',
    filename: `ingredients-aquafeed-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'name', label: 'Ingrédient' }, { key: 'category', label: 'Catégorie' },
      { key: 'price_per_kg', label: 'Prix/kg' }, { key: 'protein_pct', label: 'Protéines %' },
      { key: 'lipid_pct', label: 'Lipides %' }, { key: 'fiber_pct', label: 'Fibres %' },
      { key: 'energy_kcal_kg', label: 'Énergie kcal/kg' }, { key: 'stock_kg', label: 'Stock kg' },
    ],
    data: filtered as any[],
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Matières premières</CardTitle>
            <CardDescription className="text-xs">{ingredients.length} ingrédients — prix, valeurs nutritionnelles et stocks.</CardDescription>
          </div>
          <div className="flex gap-2">
            {onUseSelection && (
              <Button size="sm" variant="secondary" disabled={picked.length === 0}
                onClick={() => { onUseSelection(picked); setPicked([]); }}>
                <ListPlus className="w-4 h-4 mr-1.5" />Formuler ({picked.length})
              </Button>
            )}
            <ExportDropdown options={exportOptions as any} />
            <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1.5" />Nouvel ingrédient</Button>
          </div>
        </div>
        <div className="flex gap-2 pt-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {INGREDIENT_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              {onUseSelection && (
                <th className="py-2 w-8">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every(i => picked.includes(i.id))}
                    onCheckedChange={(v) => setPicked(v ? filtered.map(i => i.id) : [])}
                  />
                </th>
              )}
              <th className="py-2">Ingrédient</th><th className="py-2">Catégorie</th>
              <th className="py-2 text-right">Prix/kg</th><th className="py-2 text-right">PB %</th>
              <th className="py-2 text-right">MG %</th><th className="py-2 text-right">Fibres %</th>
              <th className="py-2 text-right">kcal/kg</th><th className="py-2 text-right">Incorp.</th>
              <th className="py-2 text-right">Stock</th><th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id} className={`border-b last:border-0 ${picked.includes(i.id) ? 'bg-muted/50' : ''}`}>
                {onUseSelection && (
                  <td className="py-1.5">
                    <Checkbox checked={picked.includes(i.id)} onCheckedChange={() => togglePick(i.id)} />
                  </td>
                )}
                <td className="py-1.5 font-medium cursor-pointer" onClick={() => onUseSelection && togglePick(i.id)}>{i.name}</td>
                <td className="py-1.5"><Badge variant="outline" className="text-[10px]">{INGREDIENT_CATEGORIES.find(c => c.key === i.category)?.label ?? i.category}</Badge></td>
                <td className="py-1.5 text-right">{formatCurrency(i.price_per_kg)}</td>
                <td className="py-1.5 text-right">{i.protein_pct}</td>
                <td className="py-1.5 text-right">{i.lipid_pct}</td>
                <td className="py-1.5 text-right">{i.fiber_pct}</td>
                <td className="py-1.5 text-right">{i.energy_kcal_kg}</td>
                <td className="py-1.5 text-right text-xs text-muted-foreground">{i.min_inclusion_pct}–{i.max_inclusion_pct} %</td>
                <td className="py-1.5 text-right">{i.stock_kg} kg</td>
                <td className="py-1.5 text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={11} className="py-10 text-center text-muted-foreground">Aucun ingrédient.</td></tr>}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Nom</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INGREDIENT_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {([
              ['price_per_kg', 'Prix par kg'], ['protein_pct', 'Protéines (%)'], ['lipid_pct', 'Lipides (%)'],
              ['fiber_pct', 'Fibres (%)'], ['energy_kcal_kg', 'Énergie (kcal/kg)'], ['calcium_pct', 'Calcium (%)'],
              ['phosphorus_pct', 'Phosphore (%)'], ['ash_pct', 'Cendres (%)'], ['moisture_pct', 'Humidité (%)'],
              ['min_inclusion_pct', 'Incorporation min (%)'], ['max_inclusion_pct', 'Incorporation max (%)'],
              ['stock_kg', 'Stock disponible (kg)'],
            ] as [string, string][]).map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <Input type="number" value={form[k] ?? 0} onChange={e => setForm({ ...form, [k]: Number(e.target.value) })} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label>Fournisseur</Label>
              <Input value={form.supplier ?? ''} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default IngredientLibrary;
