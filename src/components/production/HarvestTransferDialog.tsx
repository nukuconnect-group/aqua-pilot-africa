import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PackageCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isHarvestTransferred, transferHarvest } from '@/lib/harvestTransfer';

interface Props { cycleId: string; cycleName: string; species?: string; unitId: string }

/** Propose de verser la récolte d'un cycle dans le stock commercial pour la vendre en caisse. */
const HarvestTransferDialog: React.FC<Props> = ({ cycleId, cycleName, species, unitId }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(species ? `${species} — ${cycleName}` : cycleName);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');

  useEffect(() => {
    isHarvestTransferred(cycleId, unitId).then(setDone).catch(() => setDone(false));
  }, [cycleId, unitId]);

  const submit = async () => {
    setBusy(true);
    try {
      const qty = Number(quantity) * (unit === 'tonnes' ? 1000 : 1);
      await transferHarvest({ cycleId, unitId, productName: name, quantity: qty, unit: 'kg', salePrice: Number(price) || 0 });
      setDone(true); setOpen(false);
      toast({ title: 'Récolte transférée', description: `${qty} kg de ${name} sont maintenant disponibles à la vente en caisse.` });
    } catch (e: any) {
      toast({ title: 'Transfert impossible', description: e?.message || 'Réessayez.', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (done) return <span className="text-xs text-muted-foreground">Récolte en stock commercial</span>;

  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        <PackageCheck className="w-4 h-4 mr-1" /><span>Vendre la récolte</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transférer la récolte vers le stock commercial ?</DialogTitle>
            <DialogDescription>Indiquez la quantité réellement récoltée. Elle sera disponible en caisse et vendue au poids choisi par le client (1 kg, 5 kg, 1 tonne…).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom du produit</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Quantité récoltée</Label><Input type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
              <div><Label>Unité</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="tonnes">tonnes</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Prix de vente par kg</Label><Input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Plus tard</Button>
              <Button disabled={busy || !(Number(quantity) > 0) || !name.trim()} onClick={submit}>Accepter le transfert</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HarvestTransferDialog;
