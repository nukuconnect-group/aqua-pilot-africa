import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Plus, Save, User, Clock, Utensils } from 'lucide-react';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { getUnitTerms, isAlgaeUnitType } from '@/lib/unitContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';

interface SimpleFeedingFormProps {
  unitId: string;
  unitName: string;
  cycleId?: string;
  onSave: (record: any) => void;
}

const SESSION_TYPES = [
  { value: 'matin', label: 'Matin', icon: '🌅', timeHint: '6h-10h' },
  { value: 'midi', label: 'Midi', icon: '☀️', timeHint: '11h-14h' },
  { value: 'apres-midi', label: 'Après-midi', icon: '🌤️', timeHint: '15h-17h' },
  { value: 'soir', label: 'Soir', icon: '🌆', timeHint: '18h-20h' },
  { value: 'nuit', label: 'Nuit', icon: '🌙', timeHint: '21h-5h' },
];

const FEED_TYPES = [
  'Aliment starter (0.5-1mm)',
  'Aliment croissance (2-3mm)',
  'Aliment finition (4-6mm)',
  'Aliment reproducteurs',
  'Aliment médiqué',
  'Complément vitaminé'
];

const BEHAVIORS = [
  { value: 'normal', label: 'Normal - Bon appétit' },
  { value: 'actif', label: 'Très actifs' },
  { value: 'lent', label: 'Peu actifs / Lents' },
  { value: 'refus_partiel', label: 'Refus partiel' },
  { value: 'refus_total', label: 'Refus total' },
  { value: 'stress', label: 'Stress visible' },
];

const SimpleFeedingForm = ({ unitId, unitName, cycleId, onSave }: SimpleFeedingFormProps) => {
  const { units: allUnits } = useProductionUnits();
  const unitType = allUnits.find((u) => u.id === unitId)?.type;
  const terms = getUnitTerms(unitType);
  const isAlgae = isAlgaeUnitType(unitType);
  const isAlgae = isAlgaeUnitType(allUnits.find((u) => u.id === unitId)?.type);
  const feedTypes = terms.features.feedingSheets ? FEED_TYPES : terms.feedOptions;
  const [isOpen, setIsOpen] = useState(false);
  const { infrastructures } = useCycleInfrastructures(cycleId || '');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    sessionType: '',
    feederName: '',
    infrastructureId: '',
    feedType: '',
    prescribedQuantity: '',
    actualQuantity: '',
    temperature: '',
    behavior: 'normal',
    mortality: '0',
    notes: ''
  });

  const remainingQuantity = Math.max(0, 
    (parseFloat(formData.prescribedQuantity) || 0) - (parseFloat(formData.actualQuantity) || 0)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const record = {
      date: formData.date,
      time: formData.time,
      session_type: formData.sessionType,
      feeder_name: formData.feederName,
      infrastructure_id: formData.infrastructureId || undefined,
      feed_type: formData.feedType,
      prescribed_quantity: parseFloat(formData.prescribedQuantity) || 0,
      actual_quantity: parseFloat(formData.actualQuantity) || 0,
      remaining_quantity: remainingQuantity,
      quantity: parseFloat(formData.actualQuantity) || 0,
      temperature: parseFloat(formData.temperature) || undefined,
      behavior: formData.behavior,
      mortality: parseInt(formData.mortality) || 0,
      notes: formData.notes,
      unit_id: unitId,
      cycle_id: cycleId
    };

    onSave(record);
    setIsOpen(false);
    
    // Reset form but keep date
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      sessionType: '',
      feederName: '',
      infrastructureId: '',
      feedType: '',
      prescribedQuantity: '',
      actualQuantity: '',
      temperature: '',
      behavior: 'normal',
      mortality: '0',
      notes: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {terms.feedSessionButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary" />
            {terms.feedSessionTitle}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Session type - Grand choix visuel */}
          <div>
            <Label className="text-sm font-medium mb-2 block">{isAlgae ? 'Moment de l’apport *' : 'Session du jour *'}</Label>
            <div className="grid grid-cols-5 gap-2">
              {SESSION_TYPES.map((session) => (
                <button
                  key={session.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, sessionType: session.value })}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${
                    formData.sessionType === session.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="text-xl">{session.icon}</div>
                  <div className="text-xs font-medium">{session.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date et heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date" className="text-xs">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="time" className="text-xs">Heure</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
                className="h-9"
              />
            </div>
          </div>

          {/* Nom du nourrisseur - Champ important */}
          <div>
            <Label htmlFor="feederName" className="text-sm font-medium flex items-center gap-1">
              <User className="w-4 h-4" />
              {isAlgae ? 'Opérateur de culture *' : 'Qui a nourri ? *'}
            </Label>
            <Input
              id="feederName"
              value={formData.feederName}
              onChange={(e) => setFormData({ ...formData, feederName: e.target.value })}
              placeholder={isAlgae ? "Nom de l’opérateur" : 'Nom de la personne'}
              required
              className="h-10 text-base"
            />
          </div>

          {/* Infrastructure si disponible */}
          {infrastructures.length > 0 && (
            <div>
              <Label className="text-xs">{isAlgae ? 'Bassin / réacteur traité' : 'Infrastructure utilisée'}</Label>
              <Select 
                value={formData.infrastructureId || undefined} 
                onValueChange={(value) => setFormData({ ...formData, infrastructureId: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  {infrastructures.filter(infra => infra.id).map((infra) => (
                    <SelectItem key={infra.id} value={infra.id}>
                      {infra.infrastructure_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* {terms.feedLabel} */}
          <div>
            <Label className="text-xs">{terms.feedLabel}</Label>
            <Select 
              value={formData.feedType || undefined} 
              onValueChange={(value) => setFormData({ ...formData, feedType: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={isAlgae ? 'Sélectionner le nutriment ou produit' : "Sélectionner l'aliment"} />
              </SelectTrigger>
              <SelectContent>
                {feedTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantités - Affichage clair */}
          <Card className="p-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prescribedQuantity" className="text-xs">{isAlgae ? 'Dose prévue (kg ou L)' : 'Qté prescrite (kg)'}</Label>
                <Input
                  id="prescribedQuantity"
                  type="number"
                  step="0.1"
                  value={formData.prescribedQuantity}
                  onChange={(e) => setFormData({ ...formData, prescribedQuantity: e.target.value })}
                  placeholder="0"
                  className="h-9 font-medium"
                />
              </div>
              <div>
                <Label htmlFor="actualQuantity" className="text-xs">{isAlgae ? 'Dose appliquée (kg ou L) *' : 'Qté servie (kg) *'}</Label>
                <Input
                  id="actualQuantity"
                  type="number"
                  step="0.1"
                  value={formData.actualQuantity}
                  onChange={(e) => setFormData({ ...formData, actualQuantity: e.target.value })}
                  placeholder="0"
                  required
                  className="h-9 font-medium"
                />
              </div>
            </div>
            {remainingQuantity > 0 && (
              <div className="mt-2 text-sm text-orange-600 font-medium">
                Reste prévu : {remainingQuantity.toFixed(1)} {isAlgae ? 'kg ou L non appliqué' : 'kg non servi'}
              </div>
            )}
          </Card>

          {/* Observations rapides */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="temperature" className="text-xs">Température de culture (°C)</Label>
              <Input
                id="temperature"
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                placeholder="--"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="mortality" className="text-xs">{isAlgae ? 'Pertes observées (kg)' : '{isAlgae ? 'Perte observée (kg)' : 'Mortalité observée'}'}</Label>
              <Input
                id="mortality"
                type="number"
                min="0"
                value={formData.mortality}
                onChange={(e) => setFormData({ ...formData, mortality: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          {/* Comportement */}
          <div>
            <Label className="text-xs">{terms.behaviorLabel}</Label>
            <Select 
              value={formData.behavior || 'normal'} 
              onValueChange={(value) => setFormData({ ...formData, behavior: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {terms.behaviorOptions.map((b) => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observations particulières..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleFeedingForm;
