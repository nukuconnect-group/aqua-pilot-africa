import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Search, PackageCheck, Boxes } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ExportDropdown from '@/components/ExportDropdown';
import { getSpecies } from '@/lib/feedFormulation';
import { StoredBatch } from './useFeedMill';

interface Props {
  batches: StoredBatch[];
  onDelete: (id: string) => void;
}

const ManufacturingHistory: React.FC<Props> = ({ batches, onDelete }) => {
  const { formatCurrency } = useProductionUnits();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => batches.filter(b =>
    b.batch_number.toLowerCase().includes(search.toLowerCase()) ||
    (b.formulation_name ?? '').toLowerCase().includes(search.toLowerCase())
  ), [batches, search]);

  const totalKg = filtered.reduce((s, b) => s + Number(b.quantity_kg || 0), 0);
  const totalCost = filtered.reduce((s, b) => s + Number(b.total_cost || 0), 0);

  const exportOptions = {
    title: 'Historique des fabrications',
    filename: `fabrications-${new Date().toISOString().slice(0, 10)}`,
    columns: [
      { key: 'batch_number', label: 'N° de lot' }, { key: 'manufactured_at', label: 'Date' },
      { key: 'formulation_name', label: 'Formulation' }, { key: 'quantity_kg', label: 'Quantité (kg)' },
      { key: 'cost_per_kg', label: 'Coût/kg' }, { key: 'total_cost', label: 'Coût total' },
      { key: 'responsible', label: 'Responsable' }, { key: 'status', label: 'Statut' },
    ],
    data: filtered as any[],
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Historique des fabrications</CardTitle>
            <CardDescription className="text-xs">
              {filtered.length} lots · {totalKg.toFixed(1)} kg produits · {formatCurrency(totalCost)} de coût cumulé
            </CardDescription>
          </div>
          <ExportDropdown options={exportOptions as any} />
        </div>
        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-2.5 top-4.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher un lot…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.length === 0 && <p className="py-10 text-center text-muted-foreground text-sm">Aucune fabrication enregistrée.</p>}
        {filtered.map(b => (
          <div key={b.id} className="border rounded-lg">
            <button className="w-full text-left p-3 flex flex-col lg:flex-row lg:items-center gap-2" onClick={() => setOpenId(openId === b.id ? null : b.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{b.batch_number}</span>
                  <Badge variant="outline">{b.formulation_name}</Badge>
                  {b.species && <Badge variant="secondary" className="text-[10px]">{getSpecies(b.species).label}</Badge>}
                  {b.stock_transferred && <Badge className="text-[10px] bg-green-600"><PackageCheck className="w-3 h-3 mr-1" />Stock alimenté</Badge>}
                  {b.raw_deducted && <Badge className="text-[10px]" variant="secondary"><Boxes className="w-3 h-3 mr-1" />MP déduites</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(b.manufactured_at).toLocaleDateString('fr-FR')} · {b.quantity_kg} kg ·
                  {' '}{formatCurrency(Number(b.cost_per_kg))}/kg · total {formatCurrency(Number(b.total_cost))}
                  {b.responsible ? ` · ${b.responsible}` : ''}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); onDelete(b.id); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </button>
            {openId === b.id && (
              <div className="px-3 pb-3 overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-1.5">Matière première</th><th className="py-1.5 text-right">Quantité</th>
                      <th className="py-1.5 text-right">%</th><th className="py-1.5 text-right">Coût</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(b.lines ?? []).map((l: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{l.name}</td>
                        <td className="py-1 text-right">{l.quantity_kg} kg</td>
                        <td className="py-1 text-right">{l.percent} %</td>
                        <td className="py-1 text-right">{formatCurrency(Number(l.cost || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {b.nutrition && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Nutrition : {b.nutrition.protein} % PB · {b.nutrition.lipid} % MG · {b.nutrition.fiber} % fibres · {b.nutrition.energy} kcal/kg
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ManufacturingHistory;
