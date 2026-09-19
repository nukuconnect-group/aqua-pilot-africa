import React, { useMemo, useState } from 'react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { getUnitTerms, isAlgaeUnitType } from '@/lib/unitContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Skull, TrendingDown, Leaf } from 'lucide-react';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useToast } from '@/hooks/use-toast';

interface InfrastructureMortalityFormProps {
  unitId: string;
  onRecorded?: () => void;
}

const MORTALITY_CAUSES = isAlgae ? ['Contamination', 'Mauvaise qualité d'eau', 'Température extrême', 'Manque de nutriments', 'Parasites', 'Vénusté', 'Cause inconnue'] : [
  'Maladie bactérienne',
  'Maladie virale',
  'Maladie parasitaire',
  "Qualité de l'eau",
  'Stress',
  'Malnutrition',
  'Température extrême',
  "Manque d'oxygène",
  'Prédation',
  'Manipulation',
  'Cause inconnue',
];

const InfrastructureMortalityForm = ({ unitId, onRecorded }: InfrastructureMortalityFormProps) => {
  const { activeUnit } = useProductionUnits();
  const isAlgae = isAlgaeUnitType(activeUnit?.type);
  const { activeUnit } = useProductionUnits();
  const isAlgae = isAlgaeUnitType(activeUnit?.type);
  const { activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);
  const isAlgae = isAlgaeUnitType(activeUnit?.type);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { cycles, updateCycle } = useProductionCycles(unitId);
  const [cycleId, setCycleId] = useState('');
  const { infrastructures, updateInfrastructure } = useCycleInfrastructures(cycleId);
  const { createRecord } = useHealthRecords(cycleId, unitId);
  const { batches, updateBatch, refetch: refetchBatches } = useLivestockBatches(unitId);

  const [infraId, setInfraId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [count, setCount] = useState('');
  const [cause, setCause] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCycles = cycles.filter((c) => c.status === 'active');
  const cycle = cycles.find((c) => c.id === cycleId);

  const infraRows = useMemo(
    () =>
      infrastructures.map((infra) => {
        const batch = batches.find((b) => b.id === infra.livestock_batch_id) || null;
        return {
          id: infra.id,
          name: infra.infrastructure_name,
          type: infra.infrastructure_type,
          batch,
          available: batch?.quantity ?? infra.current_quantity ?? 0,
        };
      }),
    [infrastructures, batches]
  );

  const selected = infraRows.find((i) => i.id === infraId) || null;
  const mortalityCount = Number(count);
  const validCount = Number.isFinite(mortalityCount) && mortalityCount > 0;
  const rate = selected && selected.available > 0 && validCount
    ? (mortalityCount / selected.available) * 100
    : 0;

  const reset = () => {
    setInfraId('');
    setCount('');
    setCause('');
    setNotes('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!cycleId) return setError('Sélectionnez un cycle de production actif.');
    if (!selected) return setError("Sélectionnez l'infrastructure concernée.");
    if (!count.trim() || !validCount || !Number.isInteger(mortalityCount)) {
      return setError('Le nombre de mortalités doit être un entier supérieur à 0.');
    }
    if (selected.available > 0 && mortalityCount > selected.available) {
      return setError(
        `${selected.name} ne contient que ${selected.available}  {isAlgae ? 'kg' : 'sujets'}  : impossible d'y déclarer ${mortalityCount} mortalités.`
      );
    }
    if (!cause) return setError('Indiquez la cause principale de la mortalité.');

    setError(null);
    setSaving(true);
    try {
      // 1) Enregistrement santé (traçabilité)
      await createRecord({
        cycle_id: cycleId,
        unit_id: unitId,
        basin_id: selected.id,
        date,
        mortality: mortalityCount,
        notes: [
          `=== DÉCLARATION DE MORTALITÉ ===`,
          `Infrastructure: ${selected.name} (${selected.type})`,
          `Mortalités: ${mortalityCount}  {isAlgae ? 'kg' : 'sujets'} `,
          `Effectif avant: ${selected.available}`,
          `Effectif après: ${Math.max(0, selected.available - mortalityCount)}`,
          `Taux: ${rate.toFixed(2)}%`,
          `Cause: ${cause}`,
          notes ? `Observations: ${notes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      } as any);

      // 2) Décrémenter le lot rattaché (effectif + biomasse recalculée)
      if (selected.batch) {
        const newQuantity = Math.max(0, (selected.batch.quantity || 0) - mortalityCount);
        const avgWeight = selected.batch.average_weight || 0;
        await updateBatch(selected.batch.id, {
          quantity: newQuantity,
          total_weight: Number(((newQuantity * avgWeight) / 1000).toFixed(3)),
        });
      }

      // 3) Répercuter sur l'infrastructure du cycle
      await updateInfrastructure(selected.id, {
        current_quantity: Math.max(0, (selected.available || 0) - mortalityCount),
      });

      // 4) Répercuter sur le cycle de production
      if (cycle) {
        await updateCycle(cycle.id, {
          current_quantity: Math.max(0, (cycle.current_quantity || 0) - mortalityCount),
        });
      }

      await refetchBatches();
      toast({
        title: 'Mortalité enregistrée',
        description: `${mortalityCount}  {isAlgae ? 'kg' : 'sujets'}  retirés de ${selected.name}. Lot, unité et cycle mis à jour.`,
      });
      onRecorded?.();
      reset();
      setIsOpen(false);
    } catch (err: any) {
      console.error('Erreur déclaration mortalité:', err);
      setError(err?.message || "Impossible d'enregistrer la mortalité.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full sm:w-auto">
           {isAlgae ? <TrendingDown className="w-4 h-4 mr-2" /> : {isAlgae ? <TrendingDown className="w-4 h-4 mr-2" /> : <Skull className="w-4 h-4 mr-2" />}}
           {isAlgae ? 'Déclarer une perte de biomasse' : 'Déclarer une mortalité'} 
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             {isAlgae ? <TrendingDown className="w-5 h-5 text-destructive" /> : {isAlgae ? <TrendingDown className="w-5 h-5 text-destructive" /> : <Skull className="w-5 h-5 text-destructive" />}}
             {isAlgae ? 'Déclarer une perte de biomasse' : 'Déclarer une mortalité'}  par infrastructure
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Localisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Cycle de production actif</Label>
                {activeCycles.length === 0 ? (
                  <Alert>
                    <AlertDescription>Aucun cycle actif sur cette unité.</AlertDescription>
                  </Alert>
                ) : (
                  <Select
                    value={cycleId}
                    onValueChange={(v) => {
                      setCycleId(v);
                      setInfraId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCycles.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.species ? ` - ${c.species}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {cycleId && (
                <div>
                  <Label>Infrastructure concernée</Label>
                  {infraRows.length === 0 ? (
                    <Alert>
                      <AlertDescription>Aucune infrastructure rattachée à ce cycle.</AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={infraId} onValueChange={setInfraId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner l'infrastructure" />
                      </SelectTrigger>
                      <SelectContent>
                        {infraRows.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} — {i.available.toLocaleString()}  {isAlgae ? 'kg' : 'sujets'} 
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {selected && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted rounded-lg text-sm">
                  <div>
                    <span className="block text-xs text-muted-foreground">Effectif actuel</span>
                    <p className="font-bold">{selected.available.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Espèce</span>
                    <p className="font-medium">{selected.batch?.species || '—'}</p>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Après déclaration</span>
                    <p className="font-bold">
                      {Math.max(0, selected.available - (validCount ? mortalityCount : 0)).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground"> {isAlgae ? 'Taux de perte' : '{isAlgae ? 'Taux de perte' : 'Taux de mortalité'}'} </span>
                    <p className="font-bold text-destructive">{rate.toFixed(2)}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Déclaration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mortality-date">Date</Label>
                  <Input id="mortality-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="mortality-count"> {isAlgae ? 'Perte de biomasse (kg)' : 'Nombre de  {isAlgae ? 'kg' : 'sujets'}  morts'} </Label>
                  <Input
                    id="mortality-count"
                    type="number"
                    min="1"
                    value={count}
                    onChange={(e) => {
                      setError(null);
                      setCount(e.target.value);
                    }}
                    placeholder="25"
                  />
                </div>
              </div>

              <div>
                <Label>Cause principale</Label>
                <Select value={cause} onValueChange={setCause}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner la cause" />
                  </SelectTrigger>
                  <SelectContent>
                    {MORTALITY_CAUSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mortality-notes">Observations</Label>
                <Textarea
                  id="mortality-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Traitement appliqué, mesures préventives..."
                  rows={3}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" variant="destructive" className="flex-1" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer la mortalité'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InfrastructureMortalityForm;
