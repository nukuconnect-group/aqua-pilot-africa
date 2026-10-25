import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Building, Trash2, Power, PowerOff, Edit, MapPin, Fish, Plus, Eye, X, Droplets, Thermometer, Ruler, RefreshCw } from 'lucide-react';
import { Infrastructure, useProductionUnits } from '@/contexts/ProductionUnitsContext';
import InfrastructureForm from './InfrastructureForm';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import InfrastructureLivestockCard from './InfrastructureLivestockCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettings } from '@/contexts/SettingsContext';
import { getUnitTerms, getInfrastructureTypeLabel as getInfraLabel } from '@/lib/unitContext';
import { computeFishCounts } from '@/lib/feedingSheetUtils';
import InfrastructureQRCode from './InfrastructureQRCode';

interface InfrastructureCardProps {
  infrastructure: Infrastructure;
}

const InfrastructureCard = ({ infrastructure }: InfrastructureCardProps) => {
  const {
    infrastructures,
    setInfrastructures,
    activeUnit,
    deleteInfrastructure: deleteUnitInfrastructure,
    updateInfrastructure: updateUnitInfrastructure,
  } = useProductionUnits();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateBatchOpen, setIsCreateBatchOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useSettings();
  // Fetch all cycle infrastructures for this user to find attached batches
  const { infrastructures: cycleInfras, updateInfrastructure } = useCycleInfrastructures(undefined, true);
  // Fetch ALL batches (not filtered by unit) to find attached batch by ID
  const { batches: allBatches, createBatch } = useLivestockBatches();
  const { cycles } = useProductionCycles();
  
  // Find attached batch from specifications - this is set when user attaches a batch to infrastructure
  const attachedBatchId = (infrastructure.specifications as any)?.attachedBatchId;
  const attachedBatch = attachedBatchId 
    ? allBatches.find(b => b.id === attachedBatchId)
    : null;
  
  // Find cycle infrastructure - ONLY match if this exact infrastructure is registered in cycle_infrastructures
  // Match by: infrastructure name AND the infrastructure must belong to the same unit
  // AND the cycle it's attached to must also belong to the same unit
  const cycleInfra = cycleInfras.find(ci => {
    // The name must match exactly
    if (ci.infrastructure_name !== infrastructure.name) return false;
    
    // Must have a cycle_id to be considered attached
    if (!ci.cycle_id) return false;
    
    // Find the cycle this infrastructure is attached to
    const cycle = cycles.find(c => c.id === ci.cycle_id);
    
    // The cycle must exist and belong to the same unit as this infrastructure
    if (!cycle || cycle.unit_id !== activeUnit?.id) return false;
    
    return true;
  });
  
  // Find the associated production cycle - ONLY if infrastructure is explicitly attached to a cycle
  // A new infrastructure should NEVER show a cycle unless it was explicitly attached
  const associatedCycle = cycleInfra 
    ? cycles.find(c => c.id === cycleInfra.cycle_id)
    : null;

  const activeCycleIds = new Set(cycles.filter(c => c.unit_id === infrastructure.unitId && c.status === 'active').map(c => c.id));
  const countedInfras = cycleInfras.filter(ci => activeCycleIds.has(ci.cycle_id));
  const availableSubjects = computeFishCounts([infrastructure], countedInfras, allBatches)[infrastructure.id] || 0;
  const directBatchQuantity = attachedBatch && attachedBatch.unit_id === infrastructure.unitId && !['sold', 'harvested'].includes(attachedBatch.status)
    ? Math.max(0, Number(attachedBatch.quantity) || 0) : 0;
  const hasCountedInfra = countedInfras.some(ci => ci.infrastructure_name.trim().toLowerCase() === infrastructure.name.trim().toLowerCase());
  const subjects = hasCountedInfra ? availableSubjects : directBatchQuantity;

  const [batchFormData, setBatchFormData] = useState({
    species: '',
    variety: '',
    type: '',
    quantity: 0,
    averageWeight: 0,
    acquisitionDate: new Date().toISOString().split('T')[0],
    source: '',
    notes: '',
    expectedHarvestDate: '',
    feedingPlan: '',
    status: 'healthy' as const
  });

  const unitTerms = getUnitTerms(activeUnit?.type);
  const species = [...unitTerms.speciesOptions, 'Autre'];

  const getInfrastructureIcon = (type: string) => {
    if (type.includes('bassin')) return Droplets;
    if (type.includes('chambre')) return Thermometer;
    return Building;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'maintenance': return 'Maintenance';
      case 'inactive': return 'Inactif';
      default: return status;
    }
  };

  const getInfrastructureTypeLabel = (type: string) => {
    const legacy: Record<string, string> = {
      'bassin_quarantaine': 'Bassin de quarantaine',
      'salle_transformation': 'Salle de transformation',
      'pompe_oxygene': 'Pompe à oxygène',
      'generateur': 'Générateur électrique',
      'autre': 'Autre'
    };
    return legacy[type] || getInfraLabel(type, activeUnit?.type);
  };

  const toggleStatus = (newStatus: 'active' | 'inactive') => {
    const updatedInfrastructures = infrastructures.map(inf =>
      inf.id === infrastructure.id 
        ? { ...inf, status: newStatus }
        : inf
    );
    setInfrastructures(updatedInfrastructures);
  };

  const handleDeleteInfrastructure = async () => {
    try {
      await deleteUnitInfrastructure(infrastructure.id);
      toast({
        title: 'Succès',
        description: 'Infrastructure supprimée',
      });
    } catch (error) {
      console.error('Error deleting infrastructure:', error);
      toast({
        title: 'Erreur',
        description: "Impossible de supprimer l'infrastructure",
        variant: 'destructive',
      });
    }
  };

  const handleEditSave = (updatedInfrastructure: any) => {
    console.log('Infrastructure updated:', updatedInfrastructure);
  };

  const handleCreateAndAttachBatch = async () => {
    if (!batchFormData.species || !batchFormData.quantity) {
      toast({
        title: t('error'),
        description: t('fill_species_quantity'),
        variant: "destructive"
      });
      return;
    }

    if (!activeUnit) {
      toast({
        title: t('error'),
        description: t('no_unit_selected'),
        variant: "destructive"
      });
      return;
    }

    try {
      const currentAge = batchFormData.acquisitionDate 
        ? Math.floor((Date.now() - new Date(batchFormData.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const totalWeight = batchFormData.quantity * batchFormData.averageWeight / 1000;

      const newBatch = await createBatch({
        species: batchFormData.species,
        variety: batchFormData.variety,
        type: batchFormData.type,
        quantity: batchFormData.quantity,
        average_weight: batchFormData.averageWeight,
        total_weight: totalWeight,
        acquisition_date: batchFormData.acquisitionDate || null,
        source: batchFormData.source,
        unit_id: activeUnit.id,
        unit_name: activeUnit.name,
        status: batchFormData.status,
        notes: batchFormData.notes,
        expected_harvest_date: batchFormData.expectedHarvestDate || null,
        current_age: currentAge,
        feeding_plan: batchFormData.feedingPlan,
        last_health_check: new Date().toISOString().split('T')[0],
        expected_survival_rate: 95,
        male_count: 0,
        female_count: 0
      });

      if (cycleInfra && newBatch) {
        await updateInfrastructure(cycleInfra.id, {
          livestock_batch_id: newBatch.id
        });
      }

      if (newBatch) {
        await updateUnitInfrastructure(infrastructure.id, {
          specifications: {
            ...(infrastructure.specifications || {}),
            attachedBatchId: newBatch.id,
          },
        });
      }

      toast({
        title: t('success'),
        description: t('batch_created_success')
      });

      setBatchFormData({
        species: '',
        variety: '',
        type: '',
        quantity: 0,
        averageWeight: 0,
        acquisitionDate: new Date().toISOString().split('T')[0],
        source: '',
        notes: '',
        expectedHarvestDate: '',
        feedingPlan: '',
        status: 'healthy'
      });
      setIsCreateBatchOpen(false);
    } catch (error) {
      console.error('Error creating batch:', error);
    }
  };

  const IconComponent = getInfrastructureIcon(infrastructure.type);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader className="pb-2 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base font-semibold truncate">
                  {infrastructure.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground truncate">
                  {getInfrastructureTypeLabel(infrastructure.type)}
                </p>
              </div>
            </div>
            <Badge className={`${getStatusColor(infrastructure.status)} text-xs flex-shrink-0`}>
              {getStatusLabel(infrastructure.status)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-3 sm:p-4 pt-0">
          <div className="mb-3 flex justify-center"><InfrastructureQRCode infrastructure={infrastructure} /></div>
          {/* Infos principales */}
          <div className="space-y-2 text-xs sm:text-sm flex-1">
            {unitTerms.features.feedingSheets && <div className="flex items-center gap-2">
              <Fish className="w-4 h-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Sujets disponibles :</span>
              <strong>{subjects.toLocaleString('fr-FR')}</strong>
            </div>}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Ruler className="w-3 h-3 flex-shrink-0" />
              <span>Capacité: {infrastructure.capacity.toLocaleString()}</span>
            </div>
            
            {infrastructure.specifications?.location && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-1">{infrastructure.specifications.location}</span>
              </div>
            )}
            
            {/* Spécifications compactes */}
            {infrastructure.specifications && Object.keys(infrastructure.specifications).filter(k => !['location', 'usage', 'description', 'depreciation', 'depreciationAssetId'].includes(k)).length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(infrastructure.specifications)
                  .filter(([key]) => !['location', 'usage', 'description', 'depreciation', 'depreciationAssetId'].includes(key))
                  .slice(0, 2)
                  .map(([key, value]) => (
                    <span 
                      key={key} 
                      className="inline-block bg-muted rounded px-1.5 py-0.5 text-xs truncate max-w-[120px]"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                {Object.entries(infrastructure.specifications).filter(([key]) => !['location', 'usage', 'description', 'depreciation', 'depreciationAssetId'].includes(key)).length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{Object.entries(infrastructure.specifications).filter(([key]) => !['location', 'usage', 'description', 'depreciation', 'depreciationAssetId'].includes(key)).length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Cycle de production associé */}
          {associatedCycle && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg">
                <RefreshCw className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Cycle de production</p>
                  <p className="text-sm font-medium truncate">{associatedCycle.name}</p>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {associatedCycle.status === 'active' ? 'Actif' : associatedCycle.status === 'completed' ? 'Terminé' : associatedCycle.status}
                </Badge>
              </div>
            </div>
          )}
          
          {/* Lot rattaché */}
          <div className={associatedCycle ? "mt-2" : "mt-3 pt-3 border-t"}>
            {attachedBatch ? (
              <InfrastructureLivestockCard 
                batch={attachedBatch} 
                infrastructureId={infrastructure.id}
                compact={true}
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Fish className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Aucun lot rattaché</span>
              </div>
            )}
          </div>
          
          {/* Boutons d'action */}
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsDetailsOpen(true)}
              className="text-xs h-8"
            >
              <Eye className="w-3 h-3 mr-1" />
              Détails
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setIsEditOpen(true)}
              className="text-xs h-8"
            >
              <Edit className="w-3 h-3 mr-1" />
              Modifier
            </Button>
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => toggleStatus(infrastructure.status === 'active' ? 'inactive' : 'active')}
              className="text-xs h-8"
            >
              {infrastructure.status === 'active' ? (
                <>
                  <PowerOff className="w-3 h-3 mr-1" />
                  Désactiver
                </>
              ) : (
                <>
                  <Power className="w-3 h-3 mr-1" />
                  Activer
                </>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="text-xs h-8">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-md mx-4">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base">
                    Confirmer la suppression
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm">
                    Supprimer "{infrastructure.name}" ? Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2">
                  <AlertDialogCancel className="flex-1">Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteInfrastructure} className="flex-1">
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Vue Détaillée */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0 sm:p-6 sm:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 sm:p-3 bg-primary/10 rounded-xl flex-shrink-0">
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg sm:text-xl font-bold truncate">
                    {infrastructure.name}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {getInfrastructureTypeLabel(infrastructure.type)}
                  </p>
                </div>
              </div>
              <Badge className={`${getStatusColor(infrastructure.status)} text-sm flex-shrink-0`}>
                {getStatusLabel(infrastructure.status)}
              </Badge>
            </div>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] p-4 sm:p-6">
            <div className="space-y-6">
              <div className="flex justify-center"><InfrastructureQRCode infrastructure={infrastructure} size={176} /></div>
              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Capacité</p>
                  <p className="text-lg font-semibold">{infrastructure.capacity.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Statut</p>
                  <p className="text-lg font-semibold">{getStatusLabel(infrastructure.status)}</p>
                </div>
              </div>
              
              {/* Cycle de production associé */}
              {associatedCycle && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Cycle de production associé
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Nom du cycle</p>
                      <p className="text-sm font-medium">{associatedCycle.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Statut</p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {associatedCycle.status === 'active' ? 'Actif' : associatedCycle.status === 'completed' ? 'Terminé' : associatedCycle.status}
                      </Badge>
                    </div>
                    {associatedCycle.species && (
                      <div>
                        <p className="text-xs text-muted-foreground">Espèce</p>
                        <p className="text-sm font-medium">{associatedCycle.species}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Quantité actuelle</p>
                      <p className="text-sm font-medium">{associatedCycle.current_quantity.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Localisation */}
              {infrastructure.specifications?.location && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Localisation
                  </h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {infrastructure.specifications.location}
                  </p>
                </div>
              )}
              
              {/* Usage */}
              {infrastructure.specifications?.usage && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Usage</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {infrastructure.specifications.usage}
                  </p>
                </div>
              )}
              
              {/* Description */}
              {infrastructure.specifications?.description && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {infrastructure.specifications.description}
                  </p>
                </div>
              )}
              
              {/* Spécifications techniques */}
              {infrastructure.specifications && Object.keys(infrastructure.specifications).filter(k => !['location', 'usage', 'description', 'depreciation', 'depreciationAssetId'].includes(k)).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Spécifications techniques</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(infrastructure.specifications)
                      .filter(([key]) => !['location', 'usage', 'description', 'depreciation', 'depreciationAssetId'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground capitalize">{key}</span>
                          <span className="break-words text-right text-sm font-medium">{String(value)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Lot rattaché */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Fish className="w-4 h-4" />
                  {unitTerms.attachedBatchLabel}
                </h4>
                {attachedBatch ? (
                  <InfrastructureLivestockCard 
                    batch={attachedBatch} 
                    infrastructureId={infrastructure.id}
                  />
                ) : (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/30">
                    <Fish className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Aucun lot rattaché
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {unitTerms.attachedBatchEmptyText}
                    </p>
                    <Button 
                      size="sm"
                      onClick={() => { setIsDetailsOpen(false); setIsCreateBatchOpen(true); }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Créer et rattacher un lot
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex gap-2 p-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsDetailsOpen(false)}
              className="flex-1"
            >
              Fermer
            </Button>
            <Button 
              onClick={() => { setIsDetailsOpen(false); setIsEditOpen(true); }}
              className="flex-1"
            >
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de modification */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'infrastructure</DialogTitle>
          </DialogHeader>
          <InfrastructureForm 
            infrastructure={infrastructure} 
            onSave={handleEditSave}
            onClose={() => setIsEditOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de création de lot */}
      <Dialog open={isCreateBatchOpen} onOpenChange={setIsCreateBatchOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 sm:p-6 pb-0">
            <DialogTitle>{unitTerms.createBatchTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-4 sm:p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Espèce *</Label>
                  <Select 
                    value={batchFormData.species} 
                    onValueChange={(value) => setBatchFormData({...batchFormData, species: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {species.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Souche/Variété</Label>
                  <Input
                    value={batchFormData.variety}
                    onChange={(e) => setBatchFormData({...batchFormData, variety: e.target.value})}
                    placeholder="Ex: Monosex, Red, etc."
                  />
                </div>
              </div>

              <div>
                <Label>Type de lot *</Label>
                <Select 
                  value={batchFormData.type} 
                  onValueChange={(value) => setBatchFormData({...batchFormData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitTerms.batchTypeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Quantité *</Label>
                  <Input
                    type="number"
                    value={batchFormData.quantity || ''}
                    onChange={(e) => setBatchFormData({...batchFormData, quantity: parseInt(e.target.value) || 0})}
                    placeholder={unitTerms.quantityLabel}
                  />
                </div>
                <div>
                  <Label>Poids moyen (g)</Label>
                  <Input
                    type="number"
                    value={batchFormData.averageWeight || ''}
                    onChange={(e) => setBatchFormData({...batchFormData, averageWeight: parseInt(e.target.value) || 0})}
                    placeholder="Poids en grammes"
                  />
                </div>
              </div>

              <div>
                <Label>Date d'acquisition</Label>
                <Input
                  type="date"
                  value={batchFormData.acquisitionDate}
                  onChange={(e) => setBatchFormData({...batchFormData, acquisitionDate: e.target.value})}
                />
              </div>

              <div>
                <Label>Source/Fournisseur</Label>
                <Input
                  value={batchFormData.source}
                  onChange={(e) => setBatchFormData({...batchFormData, source: e.target.value})}
                  placeholder="Nom du fournisseur"
                />
              </div>

              <div>
                <Label>Plan d'alimentation</Label>
                <Input
                  value={batchFormData.feedingPlan}
                  onChange={(e) => setBatchFormData({...batchFormData, feedingPlan: e.target.value})}
                  placeholder="Ex: Standard croissance"
                />
              </div>

              <div>
                <Label>Date de récolte prévue</Label>
                <Input
                  type="date"
                  value={batchFormData.expectedHarvestDate}
                  onChange={(e) => setBatchFormData({...batchFormData, expectedHarvestDate: e.target.value})}
                />
              </div>

              <div>
                <Label>Statut</Label>
                <Select 
                  value={batchFormData.status} 
                  onValueChange={(value) => setBatchFormData({...batchFormData, status: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthy">En bonne santé</SelectItem>
                    <SelectItem value="sick">Malade</SelectItem>
                    <SelectItem value="quarantine">Quarantaine</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={batchFormData.notes}
                  onChange={(e) => setBatchFormData({...batchFormData, notes: e.target.value})}
                  placeholder="Notes supplémentaires..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex gap-2 p-4 border-t">
            <Button 
              variant="outline"
              onClick={() => setIsCreateBatchOpen(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleCreateAndAttachBatch}
              className="flex-1"
            >
              <Fish className="w-4 h-4 mr-2" />
              Créer et rattacher
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InfrastructureCard;
