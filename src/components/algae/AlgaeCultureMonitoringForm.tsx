import React, { useState } from 'react';
import { Activity, Plus, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useToast } from '@/hooks/use-toast';

interface AlgaeCultureMonitoringFormProps {
  unitId: string;
  onRecordCreated?: () => void;
}

const initialForm = () => ({
  cycleId: '',
  basinId: '',
  date: new Date().toISOString().split('T')[0],
  biomass: '',
  density: '',
  temperature: '',
  ph: '',
  salinity: '',
  losses: '',
  contamination: 'none',
  observations: '',
});

const AlgaeCultureMonitoringForm = ({ unitId, onRecordCreated }: AlgaeCultureMonitoringFormProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const { cycles } = useProductionCycles(unitId);
  const { infrastructures } = useCycleInfrastructures(form.cycleId);
  const { createRecord } = useHealthRecords(form.cycleId, unitId);
  const { toast } = useToast();
  const activeCycles = cycles.filter((cycle) => cycle.status === 'active');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.cycleId || !form.basinId) return;
    setSaving(true);
    try {
      const contamination = form.contamination === 'none' ? 'Aucune contamination observée' : `Contamination : ${form.contamination}`;
      await createRecord({
        cycle_id: form.cycleId,
        unit_id: unitId,
        basin_id: form.basinId,
        date: form.date,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        ph: form.ph ? Number(form.ph) : undefined,
        oxygen: form.salinity ? Number(form.salinity) : undefined,
        mortality: form.losses ? Number(form.losses) : undefined,
        average_weight: form.biomass ? Number(form.biomass) : undefined,
        density: form.density ? Number(form.density) : undefined,
        notes: [contamination, form.observations].filter(Boolean).join('\n'),
      });
      toast({ title: 'Suivi de culture enregistré', description: 'Les mesures du bassin ont été ajoutées au cycle.' });
      setForm(initialForm());
      setOpen(false);
      onRecordCreated?.();
    } catch (error) {
      console.error('Error creating algae culture monitoring record:', error);
      toast({ title: 'Enregistrement impossible', description: 'Vérifiez les mesures puis réessayez.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><Activity className="w-4 h-4 mr-2" />Nouveau suivi de culture</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Contrôle de croissance de la culture</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Cycle actif *</Label>
              {activeCycles.length === 0 ? (
                <Alert><AlertDescription>Créez d’abord un cycle de culture actif.</AlertDescription></Alert>
              ) : (
                <Select value={form.cycleId} onValueChange={(cycleId) => setForm({ ...form, cycleId, basinId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un cycle" /></SelectTrigger>
                  <SelectContent>{activeCycles.map((cycle) => <SelectItem key={cycle.id} value={cycle.id}>{cycle.name} — {cycle.species}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Bassin ou réacteur *</Label>
              <Select value={form.basinId} onValueChange={(basinId) => setForm({ ...form, basinId })} disabled={!form.cycleId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{infrastructures.filter((infra) => Boolean(infra.id)).map((infra) => <SelectItem key={infra.id} value={infra.id}>{infra.infrastructure_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div><Label>Biomasse estimée (kg)</Label><Input type="number" min="0" step="0.01" value={form.biomass} onChange={(e) => setForm({ ...form, biomass: e.target.value })} /></div>
            <div><Label>Densité de culture (g/L)</Label><Input type="number" min="0" step="0.01" value={form.density} onChange={(e) => setForm({ ...form, density: e.target.value })} /></div>
            <div><Label>Température (°C)</Label><Input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
            <div><Label>pH</Label><Input type="number" step="0.1" value={form.ph} onChange={(e) => setForm({ ...form, ph: e.target.value })} /></div>
            <div><Label>Salinité (g/L)</Label><Input type="number" min="0" step="0.1" value={form.salinity} onChange={(e) => setForm({ ...form, salinity: e.target.value })} /></div>
            <div><Label>Pertes de biomasse (kg)</Label><Input type="number" min="0" step="0.01" value={form.losses} onChange={(e) => setForm({ ...form, losses: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>État sanitaire</Label>
              <Select value={form.contamination} onValueChange={(contamination) => setForm({ ...form, contamination })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune contamination observée</SelectItem>
                  <SelectItem value="algues concurrentes">Algues concurrentes</SelectItem>
                  <SelectItem value="brouteurs ou protozoaires">Brouteurs / protozoaires</SelectItem>
                  <SelectItem value="bactérienne ou fongique">Contamination bactérienne / fongique</SelectItem>
                  <SelectItem value="épiphytes">Épiphytes</SelectItem>
                  <SelectItem value="ice-ice">Maladie ice-ice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Observations</Label><Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Couleur, croissance, aspect, odeur, actions réalisées…" /></div>
          <Button type="submit" className="w-full" disabled={saving || !form.cycleId || !form.basinId}>
            {saving ? <Activity className="w-4 h-4 mr-2 animate-pulse" /> : <Save className="w-4 h-4 mr-2" />}{saving ? 'Enregistrement…' : 'Enregistrer le suivi'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AlgaeCultureMonitoringForm;