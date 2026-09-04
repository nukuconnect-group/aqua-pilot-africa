import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, Calendar, AlertCircle, Lock } from 'lucide-react';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { Checkbox } from '@/components/ui/checkbox';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ProductionCycleFormProps {
  unitId: string;
  unitName: string;
  unitType: string;
  onSave?: (cycle: any) => void;
}

const ProductionCycleForm = ({ unitId, unitName, unitType, onSave }: ProductionCycleFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { toast } = useToast();
  const { createCycle } = useProductionCycles();
  const { createInfrastructures, isInfrastructureInActiveCycle, allCycleInfrastructures } = useCycleInfrastructures(undefined, true);
  const { getUnitInfrastructures } = useProductionUnits();
  const { batches } = useLivestockBatches(unitId);
  
  // Récupérer les infrastructures réelles de l'unité
  const unitInfrastructures = getUnitInfrastructures(unitId);
  
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    customSpecies: '',
    startDate: '',
    expectedDuration: '6',
    initialQuantity: '',
    targetQuantity: '',
    initialWeight: '',
    targetWeight: '',
    expectedSurvivalRate: '85', // Taux de survie attendu en %
    targetAverageWeight: '', // Poids moyen individuel visé en g
    feedType: '',
    notes: '',
    infrastructures: [] as string[],
    infrastructureBatches: {} as Record<string, string>
  });
  
  // Auto-calculer quantité et poids initiaux basés sur les lots sélectionnés
  React.useEffect(() => {
    const selectedBatchIds = Object.values(formData.infrastructureBatches).filter(id => id);
    if (selectedBatchIds.length > 0) {
      const selectedBatches = batches.filter(b => selectedBatchIds.includes(b.id));
      
      // Somme des quantités de tous les lots
      const totalQuantity = selectedBatches.reduce((sum, b) => sum + b.quantity, 0);
      
      // Poids initial total (quantité * poids moyen pour chaque lot)
      const totalWeight = selectedBatches.reduce((sum, b) => 
        sum + (b.quantity * (b.average_weight || 0)), 0
      );
      
      // Récupérer le taux de survie attendu moyen des lots (si disponible)
      const avgSurvivalRate = selectedBatches.length > 0
        ? selectedBatches.reduce((sum, b) => sum + (b.expected_survival_rate || 85), 0) / selectedBatches.length
        : 85;
      
      setFormData(prev => ({
        ...prev,
        initialQuantity: totalQuantity.toString(),
        initialWeight: totalWeight.toFixed(2),
        expectedSurvivalRate: avgSurvivalRate.toFixed(0)
      }));
    }
  }, [formData.infrastructureBatches, batches]);

  // Auto-calculer objectif quantité et poids objectif (biomasse)
  React.useEffect(() => {
    const initialQty = parseFloat(formData.initialQuantity) || 0;
    const survivalRate = parseFloat(formData.expectedSurvivalRate) || 85;
    const targetAvgWeight = parseFloat(formData.targetAverageWeight) || 0;
    
    if (initialQty > 0 && survivalRate > 0) {
      // Objectif quantité = Quantité initiale × (taux de survie / 100)
      const targetQty = Math.round(initialQty * (survivalRate / 100));
      
      // Poids objectif (biomasse en kg) = Quantité finale × Poids moyen individuel visé / 1000
      const targetBiomass = targetAvgWeight > 0 
        ? (targetQty * targetAvgWeight / 1000).toFixed(2)
        : '';
      
      setFormData(prev => ({
        ...prev,
        targetQuantity: targetQty.toString(),
        targetWeight: targetBiomass
      }));
    }
  }, [formData.initialQuantity, formData.expectedSurvivalRate, formData.targetAverageWeight]);

  // Calcul automatique de la date de fin
  const calculateEndDate = () => {
    if (!formData.startDate || !formData.expectedDuration) return '';
    const startDate = new Date(formData.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + parseInt(formData.expectedDuration));
    return endDate.toISOString().split('T')[0];
  };

  const calculatedEndDate = calculateEndDate();

  const speciesByType = {
    ecloserie: ['Carpe commune', 'Tilapia', 'Truite arc-en-ciel', 'Saumon', 'Bar'],
    grossissement: ['Carpe commune', 'Tilapia', 'Truite arc-en-ciel', 'Saumon', 'Bar', 'Dorade'],
    transformation: ['Produits transformés', 'Filets', 'Entiers vidés'],
    conservation: ['Produits frais', 'Produits congelés', 'Produits fumés'],
    fabrication_aliment: ['Aliment starter', 'Aliment croissance', 'Aliment finition'],
    commercialisation: ['Vente directe', 'Grossistes', 'Restauration']
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation : aucune valeur numérique ne doit être vide / NaN / négative
    const toNumber = (value: string) => {
      const n = Number(String(value ?? '').replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    };
    const initialQuantity = toNumber(formData.initialQuantity);
    const targetQuantity = toNumber(formData.targetQuantity);
    const durationMonths = toNumber(formData.expectedDuration);

    if (!formData.name.trim()) {
      setSubmitError('Le nom du cycle est obligatoire.');
      return;
    }
    if (!formData.startDate) {
      setSubmitError('La date de début est obligatoire.');
      return;
    }
    if (!Number.isFinite(initialQuantity) || initialQuantity <= 0) {
      setSubmitError('La quantité initiale doit être un nombre supérieur à 0.');
      return;
    }
    if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
      setSubmitError("L'objectif de quantité doit être un nombre supérieur à 0.");
      return;
    }
    if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
      setSubmitError('La durée prévue est invalide.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // Déterminer l'espèce finale (personnalisée ou prédéfinie)
      const finalSpecies = formData.species === 'custom' 
        ? formData.customSpecies 
        : formData.species;
      
      const cycleData = {
        unit_id: unitId,
        unit_name: unitName,
        unit_type: unitType,
        name: formData.name,
        status: 'active',
        start_date: formData.startDate,
        end_date: calculatedEndDate,
        current_quantity: Math.round(initialQuantity),
        target_quantity: Math.round(targetQuantity),
        initial_quantity: Math.round(initialQuantity),
        fingerlings_count: Math.round(initialQuantity),
        stocking_date: formData.startDate,
        notes: formData.notes,
        species: finalSpecies,
        duration_months: Math.round(durationMonths),
      };

      const savedCycle = await createCycle(cycleData);
      
      if (!savedCycle) {
        throw new Error('Failed to create cycle');
      }
      
      // Créer les infrastructures rattachées au cycle avec leurs lots
      if (formData.infrastructures.length > 0) {
        await createInfrastructures(savedCycle.id, formData.infrastructures, unitType, formData.infrastructureBatches);
      }
      
      // Appeler onSave si fourni (pour compatibilité avec l'ancien code)
      if (onSave) {
        onSave({
          id: savedCycle.id,
          name: savedCycle.name,
          species: formData.species,
          startDate: savedCycle.start_date,
          endDate: savedCycle.end_date,
          expectedDuration: parseInt(formData.expectedDuration),
          initialQuantity: savedCycle.initial_quantity || 0,
          targetQuantity: savedCycle.target_quantity || 0,
          currentQuantity: savedCycle.current_quantity || 0,
          initialWeight: parseFloat(formData.initialWeight) || 0,
          targetWeight: parseFloat(formData.targetWeight) || 0,
          feedType: formData.feedType,
          notes: savedCycle.notes || '',
          infrastructures: formData.infrastructures,
          unitId: savedCycle.unit_id,
          status: savedCycle.status,
          progress: 0
        });
      }
      
      setIsOpen(false);
      
      // Reset form
      setFormData({
        name: '',
        species: '',
        customSpecies: '',
        startDate: '',
        expectedDuration: '6',
        initialQuantity: '',
        targetQuantity: '',
        initialWeight: '',
        targetWeight: '',
        expectedSurvivalRate: '85',
        targetAverageWeight: '',
        feedType: '',
        notes: '',
        infrastructures: [],
        infrastructureBatches: {}
      });
    } catch (error: any) {
      console.error('Error creating cycle:', error);
      const message = error?.message || error?.details || 'Erreur inconnue lors de la création du cycle.';
      setSubmitError(message);
      toast({
        title: 'Cycle non finalisé',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const species = speciesByType[unitType] || [];
  // Utiliser les infrastructures réelles de l'unité au lieu des hardcodées
  const infrastructures = unitInfrastructures.filter(inf => inf.status === 'active');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau cycle
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Créer un cycle - {unitName}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nom du cycle</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder={`Cycle ${unitName} ${new Date().getFullYear()}`}
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="species">Espèce/Produit</Label>
                  <Select 
                    value={formData.species} 
                    onValueChange={(value) => setFormData({...formData, species: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {species.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                      <SelectItem value="custom">➕ Espèce personnalisée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.species === 'custom' && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="customSpecies">Nom de l'espèce</Label>
                    <Input
                      id="customSpecies"
                      value={formData.customSpecies}
                      onChange={(e) => setFormData({...formData, customSpecies: e.target.value})}
                      placeholder="Ex: Tilapia du Nil"
                      required
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Infrastructures rattachées */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Infrastructures rattachées au cycle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Sélectionnez une ou plusieurs infrastructures qui feront partie de ce cycle de production. Les lots seront automatiquement rattachés.
                </p>
                
                {infrastructures.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Aucune infrastructure active disponible. Créez d'abord des infrastructures dans le module Infrastructure pour pouvoir les rattacher à un cycle.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-3">
                      {infrastructures.map((infra) => {
                        // Trouver le lot attaché à cette infrastructure via specifications.attachedBatchId
                        const attachedBatchId = (infra.specifications as any)?.attachedBatchId;
                        const attachedBatch = attachedBatchId 
                          ? batches.find(b => b.id === attachedBatchId)
                          : null;
                        
                        // Vérifier si cette infrastructure est déjà rattachée à un autre cycle
                        const cycleCheck = isInfrastructureInActiveCycle(infra.name);
                        const isAlreadyInCycle = cycleCheck.isAttached;
                        
                        return (
                          <div key={infra.id} className={`p-3 border rounded-lg space-y-2 ${isAlreadyInCycle ? 'opacity-60 bg-muted/50' : ''}`}>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`infra-${infra.id}`}
                                checked={formData.infrastructures.includes(infra.name)}
                                disabled={isAlreadyInCycle}
                                onCheckedChange={(checked) => {
                                  if (isAlreadyInCycle) return;
                                  if (checked) {
                                    // Auto-sélectionner le lot attaché à cette infrastructure
                                    const batchIdToUse = attachedBatchId || '';
                                    setFormData({
                                      ...formData,
                                      infrastructures: [...formData.infrastructures, infra.name],
                                      infrastructureBatches: {
                                        ...formData.infrastructureBatches,
                                        [infra.name]: batchIdToUse
                                      }
                                    });
                                  } else {
                                    const newBatches = { ...formData.infrastructureBatches };
                                    delete newBatches[infra.name];
                                    setFormData({
                                      ...formData,
                                      infrastructures: formData.infrastructures.filter(i => i !== infra.name),
                                      infrastructureBatches: newBatches
                                    });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`infra-${infra.id}`}
                                className={`text-sm font-normal flex-1 ${isAlreadyInCycle ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {infra.name}
                                    {isAlreadyInCycle && (
                                      <Badge variant="secondary" className="text-xs gap-1">
                                        <Lock className="w-3 h-3" />
                                        Déjà rattachée
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {infra.customTypeName || infra.type} - Capacité: {infra.capacity}
                                  </div>
                                  {isAlreadyInCycle && (
                                    <div className="text-xs text-orange-600 mt-1">
                                      ⚠️ Cette infrastructure est déjà utilisée dans un autre cycle
                                    </div>
                                  )}
                                  {attachedBatch && !isAlreadyInCycle && (
                                    <div className="text-xs text-primary mt-1 font-medium">
                                      → Lot attaché: {attachedBatch.species} - {attachedBatch.quantity.toLocaleString()} individus ({attachedBatch.average_weight || 0}g)
                                    </div>
                                  )}
                                </div>
                              </Label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {formData.infrastructures.length > 0 && (
                      <div className="mt-3 p-3 bg-primary/10 rounded-lg">
                        <p className="text-sm font-medium text-primary">
                          {formData.infrastructures.length} infrastructure(s) sélectionnée(s)
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Planification */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Planification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Date de début</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="expectedDuration">Durée prévue (mois)</Label>
                  <Select value={formData.expectedDuration} onValueChange={(value) => setFormData({...formData, expectedDuration: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24].map((months) => (
                        <SelectItem key={months} value={months.toString()}>
                          {months} mois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {calculatedEndDate && (
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium text-primary">
                    📅 Date de fin calculée : {new Date(calculatedEndDate).toLocaleDateString('fr-FR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Objectifs de production */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Objectifs de production</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Données initiales calculées */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="initialQuantity">Quantité initiale</Label>
                  <Input
                    id="initialQuantity"
                    type="number"
                    value={formData.initialQuantity}
                    onChange={(e) => setFormData({...formData, initialQuantity: e.target.value})}
                    placeholder="1000"
                    required
                    className="bg-muted"
                    title="Calculé automatiquement d'après les lots rattachés"
                  />
                  {formData.infrastructureBatches && Object.keys(formData.infrastructureBatches).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">✓ Calculé automatiquement</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="initialWeight">Poids initial total (g)</Label>
                  <Input
                    id="initialWeight"
                    type="number"
                    step="0.01"
                    value={formData.initialWeight}
                    onChange={(e) => setFormData({...formData, initialWeight: e.target.value})}
                    placeholder="10000"
                    className="bg-muted"
                    title="Calculé automatiquement d'après les lots rattachés"
                  />
                  {formData.infrastructureBatches && Object.keys(formData.infrastructureBatches).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">✓ Calculé automatiquement</p>
                  )}
                </div>
              </div>

              {/* Paramètres de calcul des objectifs */}
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <p className="text-sm font-medium text-primary">📊 Paramètres pour calcul automatique des objectifs</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expectedSurvivalRate">Taux de survie attendu (%)</Label>
                    <Input
                      id="expectedSurvivalRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.expectedSurvivalRate}
                      onChange={(e) => setFormData({...formData, expectedSurvivalRate: e.target.value})}
                      placeholder="85"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ex: 85% = 15% de mortalité attendue
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="targetAverageWeight">Poids moyen individuel visé (g)</Label>
                    <Input
                      id="targetAverageWeight"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.targetAverageWeight}
                      onChange={(e) => setFormData({...formData, targetAverageWeight: e.target.value})}
                      placeholder="350"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Poids moyen par individu à la récolte
                    </p>
                  </div>
                </div>
              </div>

              {/* Objectifs calculés automatiquement */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="targetQuantity">🎯 Objectif quantité (individus)</Label>
                  <Input
                    id="targetQuantity"
                    type="number"
                    value={formData.targetQuantity}
                    onChange={(e) => setFormData({...formData, targetQuantity: e.target.value})}
                    placeholder="Calculé automatiquement"
                    required
                    className="bg-primary/5 border-primary/30"
                  />
                  {formData.initialQuantity && formData.expectedSurvivalRate && (
                    <p className="text-xs text-primary mt-1">
                      ✓ = {formData.initialQuantity} × {formData.expectedSurvivalRate}%
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="targetWeight">🎯 Biomasse finale visée (kg)</Label>
                  <Input
                    id="targetWeight"
                    type="number"
                    step="0.1"
                    value={formData.targetWeight}
                    onChange={(e) => setFormData({...formData, targetWeight: e.target.value})}
                    placeholder="Calculé automatiquement"
                    className="bg-primary/5 border-primary/30"
                  />
                  {formData.targetQuantity && formData.targetAverageWeight && (
                    <p className="text-xs text-primary mt-1">
                      ✓ = {formData.targetQuantity} × {formData.targetAverageWeight}g / 1000
                    </p>
                  )}
                </div>
              </div>
              
              {unitType === 'ecloserie' || unitType === 'grossissement' ? (
                <div>
                  <Label htmlFor="feedType">Programme alimentaire</Label>
                  <Select onValueChange={(value) => setFormData({...formData, feedType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un aliment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Programme Starter</SelectItem>
                      <SelectItem value="croissance">Programme Croissance</SelectItem>
                      <SelectItem value="finition">Programme Finition</SelectItem>
                      <SelectItem value="reproducteur">Programme Reproducteur</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Créez vos stocks d'aliments dans le module Alimentation
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes et observations</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Objectifs spécifiques, contraintes, observations..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Créer le cycle
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

export default ProductionCycleForm;
