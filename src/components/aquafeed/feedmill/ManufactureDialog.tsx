import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Factory } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { buildBatchNumber } from '@/lib/feedFormulation';
import { StoredFormulation, StoredIngredient } from './useFeedMill';

interface Props {
  formulation: StoredFormulation | null;
  ingredients: StoredIngredient[];
  batchCount: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (opts: {
    formulation: StoredFormulation; quantityKg: number; responsible: string;
    deductRaw: boolean; transferStock: boolean; batchNumber: string; notes?: string;
  }) => Promise<any>;
}

const ManufactureDialog: React.FC<Props> = ({ formulation, ingredients, batchCount, open, onOpenChange, onConfirm }) => {
  const { user } = useAuth();
  const { activeUnit, formatCurrency } = useProductionUnits();
  const [quantity, setQuantity] = useState(100);
  const [responsible, setResponsible] = useState('');
  const [deductRaw, setDeductRaw] = useState(true);
  const [transferStock, setTransferStock] = useState(true);
  const [notes, setNotes] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!formulation || !open) return;
    setQuantity(Number(formulation.batch_size_kg) || 100);
    setResponsible(user?.name || '');
    setNotes('');
    setBatchNumber(buildBatchNumber(batchCount + 1, formulation.species || 'ali'));
  }, [formulation, open, user?.name, batchCount]);

  if (!formulation) return null;

  const ratio = Number(formulation.batch_size_kg) > 0 ? quantity / Number(formulation.batch_size_kg) : 1;
  const lines = (formulation.lines ?? []).map((l: any) => ({
    ...l, need: Number(l.quantity_kg) * ratio,
  }));
  const totalCost = lines.reduce((s: number, l: any) => s + l.need * Number(l.price_per_kg || 0), 0);
  const shortages = lines.filter((l: any) => {
    const ing = ingredients.find(i => i.id === l.ingredient_id);
    return deductRaw && ing && Number(ing.stock_kg || 0) < l.need;
  });

  const submit = async () => {
    setBusy(true);
    const res = await onConfirm({
      formulation, quantityKg: quantity, responsible, deductRaw, transferStock,
      batchNumber, notes: notes || undefined,
    });
    setBusy(false);
    if (res) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Factory className="w-5 h-5" />Fabriquer « {formulation.name} »</DialogTitle>
          <DialogDescription>Le lot est enregistré et peut alimenter automatiquement vos stocks.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Numéro de lot</Label>
              <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
            </div>
            <div>
              <Label>Quantité à produire (kg)</Label>
              <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Responsable de la fabrication</Label>
            <Input value={responsible} onChange={e => setResponsible(e.target.value)} />
          </div>

          <div className="rounded-md border p-3 space-y-1 text-sm">
            <p className="font-medium mb-1">Matières premières nécessaires</p>
            {lines.map((l: any) => {
              const ing = ingredients.find(i => i.id === l.ingredient_id);
              const short = deductRaw && ing && Number(ing.stock_kg || 0) < l.need;
              return (
                <div key={l.ingredient_id} className="flex justify-between">
                  <span className={short ? 'text-amber-600' : ''}>{l.name}</span>
                  <span className={short ? 'text-amber-600' : ''}>
                    {l.need.toFixed(2)} kg{ing ? ` / ${Number(ing.stock_kg || 0)} kg en stock` : ''}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Coût total estimé</span><span>{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Coût par kg</span><span>{formatCurrency(quantity > 0 ? totalCost / quantity : 0)}</span>
            </div>
          </div>

          {shortages.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Stock insuffisant pour {shortages.length} matière(s) première(s). La déduction ramènera le stock à 0.</span>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={deductRaw} onCheckedChange={v => setDeductRaw(!!v)} />
            Déduire les matières premières du stock
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={transferStock} onCheckedChange={v => setTransferStock(!!v)} />
            Transférer l'aliment produit vers le stock d'aliments{activeUnit ? ` (${activeUnit.name})` : ''}
          </label>
          {transferStock && !activeUnit && (
            <p className="text-xs text-destructive">Sélectionnez une unité de production pour permettre le transfert.</p>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={busy || quantity <= 0}>
            {busy ? 'Fabrication…' : 'Lancer la fabrication'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManufactureDialog;
