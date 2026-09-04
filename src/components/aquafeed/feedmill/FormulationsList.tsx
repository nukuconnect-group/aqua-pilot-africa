import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Pencil, Trash2, Factory, Archive, ArchiveRestore, Search, Scale } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ExportDropdown from '@/components/ExportDropdown';
import { getSpecies, getStage } from '@/lib/feedFormulation';
import { StoredFormulation } from './useFeedMill';

interface Props {
  formulations: StoredFormulation[];
  onEdit: (f: StoredFormulation) => void;
  onDuplicate: (f: StoredFormulation) => void;
  onDelete: (id: string) => void;
  onStatus: (id: string, status: string) => void;
  onManufacture: (f: StoredFormulation) => void;
}

const FormulationsList: React.FC<Props> = ({ formulations, onEdit, onDuplicate, onDelete, onStatus, onManufacture }) => {
  const { formatCurrency } = useProductionUnits();
  const [search, setSearch] = useState('');
  const [compare, setCompare] = useState<string[]>([]);

  const filtered = useMemo(
    () => formulations.filter(f => f.name.toLowerCase().includes(search.toLowerCase())),
    [formulations, search]
  );

  const compared = formulations.filter(f => compare.includes(f.id));

  const exportOptions = {
    title: 'Mes formulations',
    filename: `formulations-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'name', label: 'Formulation' }, { key: 'species', label: 'Espèce' },
      { key: 'stage', label: 'Stade' }, { key: 'batch_size_kg', label: 'Quantité (kg)' },
      { key: 'cost_per_kg', label: 'Coût/kg' }, { key: 'total_cost', label: 'Coût total' },
      { key: 'status', label: 'Statut' },
    ],
    data: filtered as any[],
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">Mes formulations</CardTitle>
              <CardDescription className="text-xs">{formulations.length} enregistrées — consultez, modifiez, dupliquez, comparez ou archivez.</CardDescription>
            </div>
            <ExportDropdown options={exportOptions as any} />
          </div>
          <div className="relative pt-2">
            <Search className="w-4 h-4 absolute left-2.5 top-4.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher une formulation…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground text-sm">Aucune formulation enregistrée.</p>}
          {filtered.map(f => (
            <div key={f.id} className={`p-3 border rounded-lg flex flex-col lg:flex-row lg:items-center gap-2 ${f.status === 'archived' ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{f.name}</span>
                  <Badge variant="outline">{getSpecies(f.species).label}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{getStage(f.species, f.stage).label}</Badge>
                  {f.status === 'archived' && <Badge className="text-[10px]">Archivée</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.batch_size_kg} kg · {f.nutrition?.protein ?? '—'} % PB · {f.nutrition?.lipid ?? '—'} % MG ·
                  {' '}{formatCurrency(Number(f.cost_per_kg))}/kg · total {formatCurrency(Number(f.total_cost))} ·
                  {' '}{new Date(f.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button size="sm" variant={compare.includes(f.id) ? 'default' : 'outline'}
                  onClick={() => setCompare(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id].slice(-3))}>
                  <Scale className="w-3.5 h-3.5 mr-1" />Comparer
                </Button>
                <Button size="sm" variant="outline" onClick={() => onManufacture(f)}><Factory className="w-3.5 h-3.5 mr-1" />Fabriquer</Button>
                <Button size="icon" variant="ghost" onClick={() => onEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDuplicate(f)}><Copy className="w-3.5 h-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onStatus(f.id, f.status === 'archived' ? 'active' : 'archived')}>
                  {f.status === 'archived' ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {compared.length >= 2 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Comparaison ({compared.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2">Critère</th>
                  {compared.map(f => <th key={f.id} className="py-2 text-right">{f.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {([
                  ['Protéines (%)', (f: StoredFormulation) => f.nutrition?.protein],
                  ['Lipides (%)', (f: StoredFormulation) => f.nutrition?.lipid],
                  ['Fibres (%)', (f: StoredFormulation) => f.nutrition?.fiber],
                  ['Énergie (kcal/kg)', (f: StoredFormulation) => f.nutrition?.energy],
                  ['Coût / kg', (f: StoredFormulation) => formatCurrency(Number(f.cost_per_kg))],
                  ['Quantité (kg)', (f: StoredFormulation) => f.batch_size_kg],
                  ['Ingrédients', (f: StoredFormulation) => (f.lines ?? []).length],
                ] as [string, (f: StoredFormulation) => any][]).map(([label, get]) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="py-1.5 text-muted-foreground">{label}</td>
                    {compared.map(f => <td key={f.id} className="py-1.5 text-right font-medium">{String(get(f) ?? '—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FormulationsList;
