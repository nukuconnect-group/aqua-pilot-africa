import React, { useState, useEffect, useMemo } from 'react';
import { getUnitTerms } from '@/lib/unitContext';
import { Fish, Plus, Edit, Trash2, Calendar, TrendingUp, Activity, BarChart3, Heart, Printer, FileText, QrCode, Download, ChevronDown, Search, ScanBarcode, Link2, Repeat, Shield, AlertTriangle, HeartPulse, Stethoscope, ArrowRight, Eye, Waves } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLogs } from '@/contexts/LogsContext';
import { useToast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import ControlFishingForm from './ControlFishingForm';
import AlgaeCultureTracking from './algae/AlgaeCultureTracking';
import InfrastructureMortalityForm from './health/InfrastructureMortalityForm';
import ReproductionManagement from './reproduction/ReproductionManagement';
import { generateControlFishingPdf } from '@/lib/controlFishingPdf';
import { exportControlFishingToPDF, exportControlFishingToWord, exportControlFishingToExcel, exportControlFishingToCSV, printControlFishing } from '@/lib/controlFishingExport';
import { QRCodeSVG } from 'qrcode.react';
import ExportDropdown from './ExportDropdown';

interface LivestockBatch {
  id: string;
  species: string;
  variety: string;
  type?: string;
  quantity: number;
  averageWeight: number;
  totalWeight: number;
  acquisitionDate: string;
  source: string;
  unitId: string;
  unitName: string;
  status: 'healthy' | 'sick' | 'quarantine' | 'sold';
  notes: string;
  expectedHarvestDate: string;
  currentAge: number; // en jours
  feedingPlan: string;
  lastHealthCheck: string;
  controlRecords?: ControlFishing[];
  // Pour géniteurs
  maleCount?: number;
  femaleCount?: number;
}

interface ControlFishing {
  id: string;
  date: string;
  bassinId: string;
  bassinName: string;
  sampleSize: number;
  totalWeight: number;
  estimatedTotal: number;
  waterTemp: number;
  season: string;
  mortality: number;
  mortalityCause?: string;
  feedingAdjustment?: string;
  notes: string;
  averageWeight?: number;
  rendementM2?: number;
}

// Composant de formulaire d'édition de lot
interface EditBatchFormProps {
  batch: LivestockBatch;
  units: any[];
  allSuppliers: any[];
  feedStocks: any[];
  onSave: (updates: any) => Promise<void>;
  onCancel: () => void;
}

const EditBatchForm: React.FC<EditBatchFormProps> = ({ batch, units, allSuppliers, feedStocks, onSave, onCancel }) => {
  const editTerms = getUnitTerms(units.find((u: any) => u.id === batch.unitId)?.type);
  const [formData, setFormData] = useState({
    species: batch.species,
    variety: batch.variety,
    type: 'adultes', // Par défaut
    sex: '' as '' | 'male' | 'female' | 'mixed',
    quantity: batch.quantity,
    averageWeight: batch.averageWeight,
    acquisitionDate: batch.acquisitionDate,
    source: batch.source,
    unitId: batch.unitId,
    unitName: batch.unitName,
    notes: batch.notes,
    expectedHarvestDate: batch.expectedHarvestDate,
    feedingPlan: batch.feedingPlan,
    status: batch.status as 'healthy' | 'sick' | 'quarantine' | 'sold',
    expectedSurvivalRate: 95
  });
  const [saving, setSaving] = useState(false);
  const speciesList = editTerms.speciesOptions;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Espèce *</Label>
          <Select value={formData.species} onValueChange={(value) => setFormData({...formData, species: value})}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              {speciesList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Souche/Variété</Label>
          <Input value={formData.variety} onChange={(e) => setFormData({...formData, variety: e.target.value})} placeholder="Ex: Monosex, Red, etc." />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Type de lot</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value, sex: value === 'geniteurs' ? formData.sex : ''})}>
            <SelectTrigger><SelectValue placeholder="Sélectionner le type" /></SelectTrigger>
            <SelectContent>
              {editTerms.batchTypeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Sexe pour géniteurs */}
        {formData.type === 'geniteurs' && (
          <div>
            <Label>Sexe des géniteurs</Label>
            <Select value={formData.sex} onValueChange={(value: '' | 'male' | 'female' | 'mixed') => setFormData({...formData, sex: value})}>
              <SelectTrigger><SelectValue placeholder="Sélectionner le sexe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Mâle</SelectItem>
                <SelectItem value="female">Femelle</SelectItem>
                <SelectItem value="mixed">Mixte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label>Unité de production *</Label>
        <Select value={formData.unitId} onValueChange={(value) => {
          const unit = units.find((u: any) => u.id === value);
          setFormData({...formData, unitId: value, unitName: unit?.name || ''});
        }}>
          <SelectTrigger><SelectValue placeholder="Sélectionner une unité" /></SelectTrigger>
          <SelectContent>
            {units.map((unit: any) => (
              <SelectItem key={unit.id} value={unit.id}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{unit.type}</Badge>
                  {unit.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Quantité *</Label>
          <Input type="number" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} placeholder="Nombre d'individus" />
        </div>
        <div>
          <Label>Poids moyen (g)</Label>
          <Input type="number" value={formData.averageWeight} onChange={(e) => setFormData({...formData, averageWeight: parseInt(e.target.value) || 0})} placeholder="Poids en grammes" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Date d'acquisition</Label>
          <Input type="date" value={formData.acquisitionDate} onChange={(e) => setFormData({...formData, acquisitionDate: e.target.value})} />
        </div>
        <div>
          <Label>Date de récolte prévue</Label>
          <Input type="date" value={formData.expectedHarvestDate} onChange={(e) => setFormData({...formData, expectedHarvestDate: e.target.value})} />
        </div>
      </div>

      <div>
        <Label>Source/Fournisseur</Label>
        <Select value={formData.source} onValueChange={(value) => setFormData({...formData, source: value})}>
          <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger>
          <SelectContent>
            {allSuppliers.filter((s: any) => s.status === 'active').length > 0 ? (
              <>
                {allSuppliers.filter((s: any) => s.status === 'active').map((supplier: any) => (
                  <SelectItem key={supplier.id} value={supplier.name}>{supplier.name}</SelectItem>
                ))}
                <SelectItem value="Autre">Autre</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="Production interne">Production interne</SelectItem>
                <SelectItem value="Écloserie partenaire">Écloserie partenaire</SelectItem>
                <SelectItem value="Achat externe">Achat externe</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Statut</Label>
        <Select value={formData.status} onValueChange={(value: 'healthy' | 'sick' | 'quarantine' | 'sold') => setFormData({...formData, status: value})}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="healthy">Sain</SelectItem>
            <SelectItem value="sick">Malade</SelectItem>
            <SelectItem value="quarantine">Quarantaine</SelectItem>
            <SelectItem value="sold">Vendu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Plan d'alimentation</Label>
        <Select value={formData.feedingPlan} onValueChange={(value) => setFormData({...formData, feedingPlan: value})}>
          <SelectTrigger><SelectValue placeholder="Sélectionner un aliment en stock" /></SelectTrigger>
          <SelectContent>
            {feedStocks.length > 0 ? (
              feedStocks.map((stock: any) => (
                <SelectItem key={stock.id} value={stock.custom_name || stock.feed_type}>
                  <div className="flex items-center gap-2">
                    <span>{stock.custom_name || stock.feed_type}</span>
                    <Badge variant="outline" className="text-xs">
                      {stock.quantity} {stock.unit}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                Aucun stock d'aliment créé
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Observations, remarques..." rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </div>
  );
};

const LivestockManagement = () => {
  const { addLog } = useLogs();
  const { toast } = useToast();
  const { units, activeUnit, setActiveUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);
  const { t } = useSettings();
  const { isDemoMode } = useAuth();
  const navigate = useNavigate();
  
  // Utiliser l'unité active du contexte
  const selectedUnit = activeUnit?.id || 'all';
  
  // Filtrer par unité active
  const { batches: dbBatches, loading: batchesLoading, createBatch, deleteBatch, updateBatch, refetch: refetchBatches } = useLivestockBatches(activeUnit?.id);
  
  // Charger les pêches de contrôle (health records) depuis la DB - sans filtre de cycle pour voir toutes les pêches
  const { records: healthRecords, refetch: refetchHealthRecords } = useHealthRecords(undefined, activeUnit?.id);
  
  // Charger les infrastructures pour les noms
  const { infrastructures: allCycleInfras } = useCycleInfrastructures(undefined, true);
  
  // Charger les cycles de production pour afficher les dates de fin
  const { cycles: allCycles } = useProductionCycles();
  
  // Charger les fournisseurs pour le formulaire d'ajout
  const { allSuppliers } = useSuppliers();
  
  // Charger les stocks d'aliments pour le plan d'alimentation
  const { stocks: feedStocks } = useFeedStocks(activeUnit?.id);
  
  // Helper pour trouver le cycle associé à un lot via infrastructure
  const getBatchCycleInfo = (batchId: string) => {
    // Trouver l'infrastructure qui a ce lot rattaché
    const infra = allCycleInfras.find(i => i.livestock_batch_id === batchId);
    if (!infra) return null;
    
    // Trouver le cycle associé
    const cycle = allCycles.find(c => c.id === infra.cycle_id);
    if (!cycle) return null;
    
    // Calculer la date de fin si elle n'est pas définie
    let endDate = cycle.end_date;
    if (!endDate && cycle.start_date && cycle.duration_months) {
      const start = new Date(cycle.start_date);
      start.setMonth(start.getMonth() + cycle.duration_months);
      endDate = start.toISOString().split('T')[0];
    }
    
    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      cycleStatus: cycle.status,
      endDate,
      infrastructureName: infra.infrastructure_name
    };
  };
  
  // Fonction pour changer l'unité sélectionnée
  const handleUnitChange = (unitId: string) => {
    if (unitId === 'all') {
      setActiveUnit(null);
    } else {
      const unit = units.find(u => u.id === unitId);
      setActiveUnit(unit || null);
    }
  };
  
  // Convertir les lots de la DB au format local pour compatibilité
  const livestockBatches: LivestockBatch[] = dbBatches.map(batch => ({
    id: batch.id,
    species: batch.species,
    variety: batch.variety || '',
    type: batch.type || '',
    quantity: batch.quantity,
    averageWeight: batch.average_weight,
    totalWeight: batch.total_weight,
    acquisitionDate: batch.acquisition_date || '',
    source: batch.source || '',
    unitId: batch.unit_id,
    unitName: batch.unit_name,
    status: batch.status as 'healthy' | 'sick' | 'quarantine' | 'sold',
    notes: batch.notes || '',
    expectedHarvestDate: batch.expected_harvest_date || '',
    currentAge: batch.current_age,
    feedingPlan: batch.feeding_plan || '',
    lastHealthCheck: batch.last_health_check || '',
    maleCount: batch.male_count || 0,
    femaleCount: batch.female_count || 0
  }));

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState<LivestockBatch | null>(null);
  const [showControlForm, setShowControlForm] = useState(false);
  
  // États de recherche pour les lots
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'barcode' | 'lot' | 'species'>('all');
  
  // État de recherche pour pêches de contrôle par date
  const [controlSearchDate, setControlSearchDate] = useState('');
  
  // Données de contrôle de pêche - vides par défaut, remplies en mode démo
  const getDemoControlRecords = (): ControlFishing[] => isDemoMode ? [
    {
      id: '1',
      date: '2024-03-15',
      bassinId: 'unit1',
      bassinName: 'Bassin BAS001',
      sampleSize: 50,
      totalWeight: 6.25,
      estimatedTotal: 1500,
      waterTemp: 26.5,
      season: 'Printemps',
      mortality: 2,
      mortalityCause: 'Stress manipulation',
      feedingAdjustment: 'Maintenir ration actuelle',
      notes: 'Croissance satisfaisante, poissons en bonne santé',
      averageWeight: 125,
      rendementM2: 15.2
    },
    {
      id: '2',
      date: '2024-02-28',
      bassinId: 'unit1',
      bassinName: 'Bassin BAS001',
      sampleSize: 50,
      totalWeight: 5.5,
      estimatedTotal: 1480,
      waterTemp: 24.5,
      season: 'Hiver',
      mortality: 3,
      mortalityCause: 'Naturelle',
      feedingAdjustment: 'Augmenter légèrement',
      notes: 'Adaptation aux conditions hivernales',
      averageWeight: 110,
      rendementM2: 13.8
    }
  ] : [];
  
  const [controlRecords, setControlRecords] = useState<ControlFishing[]>(getDemoControlRecords());
  const [selectedBatchPreview, setSelectedBatchPreview] = useState<LivestockBatch | null>(null);
  const [selectedFishingPreview, setSelectedFishingPreview] = useState<any | null>(null);
  
  // Mettre à jour les données de contrôle quand le mode démo change
  useEffect(() => {
    setControlRecords(getDemoControlRecords());
  }, [isDemoMode]);
  
  const [controlFormData, setControlFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    bassinId: '',
    sampleSize: 0,
    totalWeight: 0,
    estimatedTotal: 0,
    waterTemp: 0,
    season: '',
    mortality: 0,
    mortalityCause: '',
    feedingAdjustment: 'Maintenir ration actuelle',
    notes: ''
  });
  const [formData, setFormData] = useState({
    species: '',
    variety: '',
    type: '',
    sex: '' as '' | 'male' | 'female' | 'mixed',
    maleCount: 0,
    femaleCount: 0,
    quantity: 0,
    averageWeight: 0,
    acquisitionDate: '',
    source: '',
    unitId: '',
    unitName: '',
    notes: '',
    expectedHarvestDate: '',
    feedingPlan: '',
    status: 'healthy' as const,
    expectedSurvivalRate: 95
  });

  const species = unitTerms.speciesOptions;

  const handleAddBatch = async (keepOpen: boolean = false) => {
    if (!formData.species || !formData.quantity || !formData.unitId) {
      toast({
        title: "Erreur",
        description: "Renseignez l'espèce, la quantité et l'unité de production.",
        variant: "destructive"
      });
      return;
    }
    const selectedUnitCheck = units.find(u => u.id === formData.unitId);
    if (!selectedUnitCheck) {
      toast({
        title: "Unité introuvable",
        description: "L'unité sélectionnée est invalide. Rechargez la page et réessayez.",
        variant: "destructive"
      });
      return;
    }

    if (formData.type === 'geniteurs') {
      const total = (formData.maleCount || 0) + (formData.femaleCount || 0);
      if (total <= 0) {
        toast({
          title: "Erreur",
          description: "Indiquez au moins un géniteur (mâle ou femelle).",
          variant: "destructive"
        });
        return;
      }
      if (total !== formData.quantity) {
        toast({
          title: "Quantité incohérente",
          description: `Total géniteurs (${total}) ≠ quantité (${formData.quantity}).`,
          variant: "destructive"
        });
        return;
      }
    }

    const selectedUnit = units.find(u => u.id === formData.unitId);
    const currentAge = formData.acquisitionDate 
      ? Math.floor((Date.now() - new Date(formData.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    try {
      await createBatch({
        species: formData.species,
        variety: formData.variety,
        type: formData.type,
        quantity: formData.quantity,
        average_weight: formData.averageWeight,
        total_weight: formData.quantity * formData.averageWeight / 1000,
        acquisition_date: formData.acquisitionDate || null,
        source: formData.source,
        unit_id: formData.unitId,
        unit_name: selectedUnit?.name || '',
        status: formData.status,
        notes: formData.notes,
        expected_harvest_date: formData.expectedHarvestDate || null,
        current_age: currentAge,
        feeding_plan: formData.feedingPlan,
        last_health_check: new Date().toISOString().split('T')[0],
        expected_survival_rate: formData.expectedSurvivalRate,
        male_count: formData.type === 'geniteurs' ? formData.maleCount : 0,
        female_count: formData.type === 'geniteurs' ? formData.femaleCount : 0,
        male_weight: formData.type === 'geniteurs' ? ((formData as any).maleWeight ?? 0) : 0,
        female_weight: formData.type === 'geniteurs' ? ((formData as any).femaleWeight ?? 0) : 0
      });

      addLog('Ajout cheptel', 'Cheptel', `Nouveau lot: ${formData.species} - ${formData.quantity} individus - Unité: ${selectedUnit?.name}`, 'success');

      // Conserve l'unité et le type pour la saisie en chaîne.
      const keepUnitId = formData.unitId;
      const keepUnitName = formData.unitName;
      const keepType = formData.type;
      setFormData({
        species: '',
        variety: '',
        type: keepOpen ? keepType : 'alevins',
        sex: '' as '' | 'male' | 'female' | 'mixed',
        maleCount: 0,
        femaleCount: 0,
        quantity: 0,
        averageWeight: 0,
        acquisitionDate: '',
        source: '',
        unitId: keepOpen ? keepUnitId : '',
        unitName: keepOpen ? keepUnitName : '',
        notes: '',
        expectedHarvestDate: '',
        feedingPlan: '',
        status: 'healthy',
        expectedSurvivalRate: 95
      });
      if (!keepOpen) setShowAddForm(false);
    } catch (error) {
      console.error('Error adding batch:', error);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    const batch = livestockBatches.find(b => b.id === id);
    try {
      await deleteBatch(id);
      addLog('Suppression cheptel', 'Cheptel', `Lot supprimé: ${batch?.species} - ${batch?.quantity} individus`, 'info');
    } catch (error) {
      console.error('Error deleting batch:', error);
    }
  };

  // Handler for batch status change (quarantine/sick/healthy)
  const handleBatchStatusChange = async (batchId: string, newStatus: 'healthy' | 'sick' | 'quarantine' | 'sold', notes?: string) => {
    try {
      const batch = livestockBatches.find(b => b.id === batchId);
      if (!batch) return;
      
      await updateBatch(batchId, { 
        status: newStatus,
        notes: notes ? `${batch.notes ? batch.notes + '\n' : ''}[${new Date().toLocaleDateString('fr-FR')}] ${t(`status_${newStatus}`)}: ${notes}` : batch.notes
      });
      
      addLog(
        newStatus === 'quarantine' ? t('quarantine_applied') : 
        newStatus === 'sick' ? t('disease_declared') : t('batch_recovered'),
        'Cheptel',
        `${batch.species} - ${batch.quantity} ${t('individuals')} - ${t(`status_${newStatus}`)}`,
        newStatus === 'healthy' ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('Error updating batch status:', error);
      throw error;
    }
  };

  // Navigate to prophylaxis module
  const goToProphylaxis = () => {
    navigate('/dashboard?module=prophylaxis');
  };

  const handleAddControlFishing = () => {
    if (!controlFormData.bassinId || !controlFormData.sampleSize || !controlFormData.totalWeight) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    const selectedUnit = units.find(u => u.id === controlFormData.bassinId);
    const averageWeight = controlFormData.sampleSize > 0 
      ? (controlFormData.totalWeight / controlFormData.sampleSize) * 1000 
      : 0;

    const newRecord: ControlFishing = {
      id: Date.now().toString(),
      ...controlFormData,
      bassinName: selectedUnit?.name || '',
      averageWeight: Math.round(averageWeight),
      rendementM2: 0 // À calculer selon la surface disponible
    };

    setControlRecords(prev => [newRecord, ...prev]);
    addLog('Pêche contrôle', 'Cheptel', `Nouvelle pêche de contrôle enregistrée - ${selectedUnit?.name}`, 'success');
    
    toast({
      title: "Pêche de contrôle enregistrée",
      description: `Données enregistrées pour ${selectedUnit?.name}`
    });

    setControlFormData({
      date: new Date().toISOString().split('T')[0],
      bassinId: '',
      sampleSize: 0,
      totalWeight: 0,
      estimatedTotal: 0,
      waterTemp: 0,
      season: '',
      mortality: 0,
      mortalityCause: '',
      feedingAdjustment: 'Maintenir ration actuelle',
      notes: ''
    });
    setShowControlForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'sick': return 'bg-red-100 text-red-800';
      case 'quarantine': return 'bg-yellow-100 text-yellow-800';
      case 'sold': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Les données sont déjà filtrées par le hook via activeUnit.id
  // Puis filtrer par recherche
  const filteredBatches = useMemo(() => {
    let result = livestockBatches;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((batch, index) => {
        const lotNumber = `LOT-${String(index + 1).padStart(4, '0')}`.toLowerCase();
        const barcodeId = `LOT${String(index + 1).padStart(4, '0')}${batch.id.slice(0, 8)}`.toLowerCase();
        
        switch (searchType) {
          case 'barcode':
            return barcodeId.includes(query) || batch.id.toLowerCase().includes(query);
          case 'lot':
            return lotNumber.includes(query);
          case 'species':
            return batch.species.toLowerCase().includes(query) || 
                   (batch.variety?.toLowerCase().includes(query) || false);
          default: // 'all'
            return lotNumber.includes(query) ||
                   barcodeId.includes(query) ||
                   batch.species.toLowerCase().includes(query) ||
                   (batch.variety?.toLowerCase().includes(query) || false) ||
                   batch.unitName.toLowerCase().includes(query) ||
                   (batch.source?.toLowerCase().includes(query) || false) ||
                   batch.id.toLowerCase().includes(query);
        }
      });
    }
    
    return result;
  }, [livestockBatches, searchQuery, searchType]);

  // Filtrer les pêches de contrôle par unité et date
  const filteredControlRecords = useMemo(() => {
    let records = activeUnit
      ? controlRecords.filter(record => record.bassinId === activeUnit.id)
      : controlRecords;
    
    if (controlSearchDate) {
      records = records.filter(record => record.date === controlSearchDate);
    }
    
    return records;
  }, [controlRecords, activeUnit, controlSearchDate]);

  // Filtrer les health records par date aussi
  const filteredHealthRecords = useMemo(() => {
    let records = healthRecords;
    if (controlSearchDate) {
      records = records.filter(r => r.date === controlSearchDate);
    }
    return records;
  }, [healthRecords, controlSearchDate]);

  const totalQuantity = filteredBatches.reduce((sum, batch) => sum + batch.quantity, 0);
  const totalWeight = filteredBatches.reduce((sum, batch) => sum + batch.totalWeight, 0);
  const healthyBatches = filteredBatches.filter(batch => batch.status === 'healthy').length;

  // Calcul des métriques de pêche de contrôle
  const avgWeight = filteredControlRecords.length > 0
    ? filteredControlRecords.reduce((sum, r) => sum + (r.averageWeight || 0), 0) / filteredControlRecords.length
    : 0;
  const avgRendement = filteredControlRecords.length > 0
    ? filteredControlRecords.reduce((sum, r) => sum + (r.rendementM2 || 0), 0) / filteredControlRecords.length
    : 0;
  const totalMortality = filteredControlRecords.reduce((sum, r) => sum + r.mortality, 0);
  const growthEvolution = filteredControlRecords.length > 1
    ? ((filteredControlRecords[0].averageWeight || 0) - (filteredControlRecords[filteredControlRecords.length - 1].averageWeight || 0)) / 
      (filteredControlRecords[filteredControlRecords.length - 1].averageWeight || 1) * 100
    : 0;

  // Calcul des métriques pour les alertes
  const [alertsData, setAlertsData] = useState<any>(null);

  useEffect(() => {
    if (filteredBatches.length > 0) {
      // Calcul des métriques moyennes
      const totalMortality = filteredBatches.reduce((sum, batch) => {
        const mortality = batch.controlRecords?.reduce((s, r) => s + r.mortality, 0) || 0;
        return sum + mortality;
      }, 0);

      const avgGrowthRate = filteredBatches.reduce((sum, batch) => {
        if (batch.controlRecords && batch.controlRecords.length > 1) {
          const records = batch.controlRecords.sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          const lastRecord = records[records.length - 1];
          const firstRecord = records[0];
          const days = Math.max(1, Math.floor(
            (new Date(lastRecord.date).getTime() - new Date(firstRecord.date).getTime()) / (1000 * 60 * 60 * 24)
          ));
          const growth = (lastRecord.averageWeight - firstRecord.averageWeight) / days;
          return sum + growth;
        }
        return sum;
      }, 0) / Math.max(1, filteredBatches.filter(b => b.controlRecords && b.controlRecords.length > 1).length);

      // Paramètres eau moyens (simulation - à remplacer par vraies données)
      const avgTemp = 26.5;
      const avgPh = 7.2;
      const avgOxygen = 6.5;

      setAlertsData({
        quantity: totalQuantity,
        mortality: totalMortality,
        growthRate: avgGrowthRate,
        temperature: avgTemp,
        ph: avgPh,
        oxygen: avgOxygen,
        feedingEfficiency: 1.52,
        unitName: selectedUnit === 'all' ? 'Toutes les unités' : units.find(u => u.id === selectedUnit)?.name
      });
    }
  }, [filteredBatches, selectedUnit, units]);

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-1">{unitTerms.livestockTitle}</h2>
            <p className="text-green-100 text-xs sm:text-sm">{unitTerms.livestockSubtitle}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Select value={selectedUnit} onValueChange={handleUnitChange}>
              <SelectTrigger className="w-full bg-white/20 border-white/30 text-white text-sm">
                <SelectValue placeholder="Sélectionner une unité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les unités</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30 text-sm">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  <span className="truncate">Ajouter un lot</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ajouter un nouveau lot</DialogTitle>
                  <DialogDescription>
                    Enregistrez un nouveau {unitTerms.batchLabel.toLowerCase()} dans une unité
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Espèce *</Label>
                      <Select value={formData.species} onValueChange={(value) => setFormData({...formData, species: value})}>
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
                        value={formData.variety}
                        onChange={(e) => setFormData({...formData, variety: e.target.value})}
                        placeholder="Ex: Monosex, Red, etc."
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Type de lot *</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value, sex: value === 'geniteurs' ? formData.sex : ''})}>
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

                  {/* Champs pour géniteurs - nombre de mâles et femelles */}
                  {formData.type === 'geniteurs' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Nombre de géniteurs mâles *</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.maleCount}
                            onChange={(e) => {
                              const maleCount = parseInt(e.target.value) || 0;
                              const femaleCount = formData.femaleCount;
                              setFormData({
                                ...formData, 
                                maleCount,
                                quantity: maleCount + femaleCount,
                                sex: maleCount > 0 && femaleCount > 0 ? 'mixed' : (maleCount > 0 ? 'male' : 'female')
                              });
                            }}
                            placeholder="Nombre de mâles"
                          />
                        </div>
                        <div>
                          <Label>Nombre de géniteurs femelles *</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.femaleCount}
                            onChange={(e) => {
                              const femaleCount = parseInt(e.target.value) || 0;
                              const maleCount = formData.maleCount;
                              setFormData({
                                ...formData, 
                                femaleCount,
                                quantity: maleCount + femaleCount,
                                sex: maleCount > 0 && femaleCount > 0 ? 'mixed' : (femaleCount > 0 ? 'female' : 'male')
                              });
                            }}
                            placeholder="Nombre de femelles"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Poids total mâles (kg)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={(formData as any).maleWeight ?? 0}
                            onChange={(e) => {
                              const maleWeight = parseFloat(e.target.value) || 0;
                              const femaleWeight = (formData as any).femaleWeight ?? 0;
                              const totalCount = formData.maleCount + formData.femaleCount;
                              const totalKg = maleWeight + femaleWeight;
                              setFormData({
                                ...formData,
                                maleWeight,
                                averageWeight: totalCount > 0 ? Math.round((totalKg * 1000) / totalCount) : 0
                              } as any);
                            }}
                            placeholder="Poids cumulé des mâles"
                          />
                        </div>
                        <div>
                          <Label>Poids total femelles (kg)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={(formData as any).femaleWeight ?? 0}
                            onChange={(e) => {
                              const femaleWeight = parseFloat(e.target.value) || 0;
                              const maleWeight = (formData as any).maleWeight ?? 0;
                              const totalCount = formData.maleCount + formData.femaleCount;
                              const totalKg = maleWeight + femaleWeight;
                              setFormData({
                                ...formData,
                                femaleWeight,
                                averageWeight: totalCount > 0 ? Math.round((totalKg * 1000) / totalCount) : 0
                              } as any);
                            }}
                            placeholder="Poids cumulé des femelles"
                          />
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Total géniteurs:</strong> {formData.maleCount + formData.femaleCount} 
                          ({formData.maleCount} ♂ mâles, {formData.femaleCount} ♀ femelles)
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          <strong>Biomasse totale :</strong> {(((formData as any).maleWeight ?? 0) + ((formData as any).femaleWeight ?? 0)).toFixed(1)} kg
                          {' '}— <strong>Poids moyen :</strong> {formData.averageWeight} g/individu
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ces données seront synchronisées avec le tableau de bord reproduction.
                        </p>
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Unité de production *</Label>
                    <Select value={formData.unitId} onValueChange={(value) => {
                      const unit = units.find(u => u.id === value);
                      setFormData({...formData, unitId: value, unitName: unit?.name || ''});
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une unité" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {unit.type}
                              </Badge>
                              {unit.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantité - caché pour géniteurs car calculée automatiquement */}
                  {formData.type !== 'geniteurs' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Quantité *</Label>
                        <Input
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                          placeholder="Nombre d'individus"
                        />
                      </div>
                      <div>
                        <Label>Poids moyen (g)</Label>
                        <Input
                          type="number"
                          value={formData.averageWeight}
                          onChange={(e) => setFormData({...formData, averageWeight: parseInt(e.target.value) || 0})}
                          placeholder="Poids en grammes"
                        />
                      </div>
                    </div>
                  )}
                  {formData.type === 'geniteurs' && (
                    <div>
                      <Label>Poids moyen (g)</Label>
                      <Input
                        type="number"
                        value={formData.averageWeight}
                        onChange={(e) => setFormData({...formData, averageWeight: parseInt(e.target.value) || 0})}
                        placeholder="Poids en grammes"
                      />
                    </div>
                  )}

                  <div>
                    <Label>Date d'acquisition</Label>
                    <Input
                      type="date"
                      value={formData.acquisitionDate}
                      onChange={(e) => setFormData({...formData, acquisitionDate: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label>Source/Fournisseur</Label>
                    <Select 
                      value={formData.source} 
                      onValueChange={(value) => setFormData({...formData, source: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un fournisseur" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSuppliers.filter(s => s.status === 'active').length > 0 ? (
                          <>
                            {allSuppliers.filter(s => s.status === 'active').map(supplier => (
                              <SelectItem key={supplier.id} value={supplier.name}>
                                <div className="flex items-center gap-2">
                                  <span>{supplier.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {supplier.category}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="Autre">Autre (saisie libre)</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="Production interne">Production interne</SelectItem>
                            <SelectItem value="Écloserie partenaire">Écloserie partenaire</SelectItem>
                            <SelectItem value="Achat externe">Achat externe</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {formData.source === 'Autre' && (
                      <Input
                        className="mt-2"
                        value=""
                        onChange={(e) => setFormData({...formData, source: e.target.value})}
                        placeholder="Nom du fournisseur personnalisé"
                      />
                    )}
                  </div>

                  {units.find(u => u.id === formData.unitId)?.type !== 'transformation' && 
                   units.find(u => u.id === formData.unitId)?.type !== 'conservation' && (
                    <div>
                      <Label>Plan d'alimentation</Label>
                      <Select value={formData.feedingPlan} onValueChange={(value) => setFormData({...formData, feedingPlan: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un aliment en stock" />
                        </SelectTrigger>
                        <SelectContent>
                          {feedStocks.length > 0 ? (
                            <>
                              {feedStocks.map(stock => (
                                <SelectItem key={stock.id} value={stock.custom_name || stock.feed_type}>
                                  <div className="flex items-center gap-2">
                                    <span>{stock.custom_name || stock.feed_type}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {stock.quantity} {stock.unit}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          ) : (
                            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                              Aucun stock d'aliment créé.<br />
                              <span className="text-xs">Ajoutez des aliments dans le module Alimentation &gt; Stock</span>
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>
                      {formData.type === 'geniteurs'
                        ? 'Taux de participation prévisionnel (%)'
                        : 'Taux de survie prévisionnel (%)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.expectedSurvivalRate}
                      onChange={(e) => setFormData({...formData, expectedSurvivalRate: parseFloat(e.target.value) || 95})}
                      placeholder="Ex: 95"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.type === 'geniteurs'
                        ? 'Pourcentage de géniteurs participant effectivement à la reproduction (par défaut 95%)'
                        : 'Taux de survie attendu pour ce lot (par défaut 95%)'}
                    </p>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      placeholder="Observations, remarques..."
                      rows={3}
                    />
                  </div>
                </div>
                 <div className="flex justify-end gap-2">
                   <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    Annuler
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleAddBatch(true)}>
                    Enregistrer et nouveau
                  </Button>
                  <Button type="button" onClick={() => handleAddBatch(false)}>
                    Ajouter le lot
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Dialog d'édition de lot */}
            <Dialog open={!!editingBatch} onOpenChange={(open) => !open && setEditingBatch(null)}>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Edit className="w-5 h-5" />
                    Modifier le lot
                  </DialogTitle>
                  <DialogDescription>
                    Modifiez les informations du {unitTerms.batchLabel.toLowerCase()}
                  </DialogDescription>
                </DialogHeader>
                {editingBatch && (
                  <EditBatchForm 
                    batch={editingBatch}
                    units={units}
                    allSuppliers={allSuppliers}
                    feedStocks={feedStocks}
                    onSave={async (updates) => {
                      await updateBatch(editingBatch.id, {
                        species: updates.species,
                        variety: updates.variety,
                        type: updates.type,
                        quantity: updates.quantity,
                        average_weight: updates.averageWeight,
                        total_weight: updates.quantity * updates.averageWeight / 1000,
                        acquisition_date: updates.acquisitionDate || null,
                        source: updates.source,
                        unit_id: updates.unitId,
                        unit_name: updates.unitName,
                        status: updates.status,
                        notes: updates.notes,
                        expected_harvest_date: updates.expectedHarvestDate || null,
                        feeding_plan: updates.feedingPlan,
                        expected_survival_rate: updates.expectedSurvivalRate
                      });
                      setEditingBatch(null);
                      addLog('Modification cheptel', 'Cheptel', `Lot modifié: ${updates.species} - ${updates.quantity} individus`, 'info');
                    }}
                    onCancel={() => setEditingBatch(null)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>


      {/* Statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Fish className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{totalQuantity.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Individus total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{totalWeight.toFixed(1)}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Kg total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-600 rounded-full"></div>
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{healthyBatches}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Lots sains</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold truncate">{filteredBatches.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Lots actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets de gestion - Reproduction visible uniquement pour écloserie */}
      <Tabs defaultValue="lots" className="space-y-3 sm:space-y-4">
        <TabsList className={`w-full grid h-auto ${activeUnit?.type === 'ecloserie' ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="lots" className="text-xs sm:text-sm px-2 py-2">Lots</TabsTrigger>
          {activeUnit?.type === 'ecloserie' && (
            <TabsTrigger value="reproduction" className="text-xs sm:text-sm px-2 py-2">
              <Heart className="w-3 h-3 mr-1 hidden sm:inline" />
              Reproduction
            </TabsTrigger>
          )}
          <TabsTrigger value="control" className="text-xs sm:text-sm px-2 py-2">{unitTerms.samplingTabLabel}</TabsTrigger>
          <TabsTrigger value="charts" className="text-xs sm:text-sm px-2 py-2">Graphiques</TabsTrigger>
        </TabsList>

        {/* Onglet Liste des lots */}
        <TabsContent value="lots">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3">
                <div>
                  <CardTitle>{unitTerms.livestockTitle}</CardTitle>
                  <CardDescription>
                    Gestion et suivi de tous les lots par unité de production
                  </CardDescription>
                </div>
                {/* Barre de recherche avancée */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher par lot, code-barres, espèce..."
                      className="pl-9 text-sm"
                    />
                  </div>
                  <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
                    <SelectTrigger className="w-full sm:w-40 text-sm">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Search className="w-3 h-3" />
                          Tous
                        </div>
                      </SelectItem>
                      <SelectItem value="barcode">
                        <div className="flex items-center gap-2">
                          <ScanBarcode className="w-3 h-3" />
                          Code-barres
                        </div>
                      </SelectItem>
                      <SelectItem value="lot">
                        <div className="flex items-center gap-2">
                          <Fish className="w-3 h-3" />
                          N° Lot
                        </div>
                      </SelectItem>
                      <SelectItem value="species">
                        <div className="flex items-center gap-2">
                          <Fish className="w-3 h-3" />
                          Espèce
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {searchQuery && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSearchQuery('')}
                      className="text-xs"
                    >
                      Effacer
                    </Button>
                  )}
                </div>
                {searchQuery && (
                  <p className="text-xs text-muted-foreground">
                    {filteredBatches.length} lot(s) trouvé(s) sur {livestockBatches.length}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {filteredBatches.length === 0 && searchQuery ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Aucun lot trouvé pour "{searchQuery}"</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => setSearchQuery('')}
                      className="mt-2"
                    >
                      Effacer la recherche
                    </Button>
                  </div>
                ) : filteredBatches.map((batch, index) => {
                  // Récupérer les infos du cycle rattaché
                  const cycleInfo = getBatchCycleInfo(batch.id);
                  
                  return (
                  <div key={batch.id} className="border rounded-lg p-3 sm:p-4 hover:bg-accent/50">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className="bg-primary text-primary-foreground text-xs font-mono">
                            LOT-{String(index + 1).padStart(4, '0')}
                          </Badge>
                          <h3 className="font-semibold text-base sm:text-lg">{batch.species}</h3>
                          {batch.variety && (
                            <Badge variant="secondary" className="text-xs">{batch.variety}</Badge>
                          )}
                          {/* Badge type géniteurs */}
                          {batch.type === 'geniteurs' && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-pink-500 text-white text-xs">
                              ♂♀ Géniteurs
                            </Badge>
                          )}
                          <Badge className={`${getStatusColor(batch.status)} text-xs`}>
                            {batch.status === 'healthy' ? 'Sain' : 
                             batch.status === 'sick' ? 'Malade' :
                             batch.status === 'quarantine' ? 'Quarantaine' : 'Vendu'}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                            {batch.unitName}
                          </Badge>
                          {/* Indicateur de cycle rattaché */}
                          {cycleInfo && (
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              {cycleInfo.cycleName}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Info cycle rattaché avec date de fin */}
                        {cycleInfo && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-2 mb-3">
                            <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                              <Link2 className="w-3 h-3 flex-shrink-0" />
                              <span className="font-medium">Cycle: {cycleInfo.cycleName}</span>
                              <span className="text-purple-500">•</span>
                              <span>Infra: {cycleInfo.infrastructureName}</span>
                              {cycleInfo.endDate && (
                                <>
                                  <span className="text-purple-500">•</span>
                                  <span className="font-semibold">
                                    Fin: {new Date(cycleInfo.endDate).toLocaleDateString('fr-FR')}
                                  </span>
                                </>
                              )}
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] ml-auto ${
                                  cycleInfo.cycleStatus === 'active' 
                                    ? 'bg-green-50 text-green-700 border-green-200' 
                                    : cycleInfo.cycleStatus === 'completed'
                                    ? 'bg-gray-50 text-gray-700 border-gray-200'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }`}
                              >
                                {cycleInfo.cycleStatus === 'active' ? 'Actif' : 
                                 cycleInfo.cycleStatus === 'completed' ? 'Terminé' : 'Planifié'}
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        {/* Affichage spécial pour géniteurs - mâles/femelles */}
                        {batch.type === 'geniteurs' && (batch.maleCount || batch.femaleCount) ? (
                          <div className="bg-gradient-to-r from-blue-50 to-pink-50 dark:from-blue-900/20 dark:to-pink-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">♂</span>
                                <div>
                                  <p className="text-blue-700 dark:text-blue-300 font-bold text-lg">{batch.maleCount}</p>
                                  <p className="text-xs text-muted-foreground">Mâles</p>
                                </div>
                              </div>
                              <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">♀</span>
                                <div>
                                  <p className="text-pink-700 dark:text-pink-300 font-bold text-lg">{batch.femaleCount}</p>
                                  <p className="text-xs text-muted-foreground">Femelles</p>
                                </div>
                              </div>
                              <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />
                              <div>
                                <p className="font-bold text-lg text-foreground">{(batch.maleCount || 0) + (batch.femaleCount || 0)}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm mb-3">
                          <div>
                            <p className="text-muted-foreground">Quantité</p>
                            <p className="font-medium truncate">{batch.quantity.toLocaleString()} individus</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Poids moyen ind.</p>
                            <p className="font-medium">{batch.averageWeight} g</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Poids total</p>
                            <p className="font-medium">{batch.totalWeight.toFixed(1)} kg</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Âge</p>
                            <p className="font-medium">{batch.currentAge} jours</p>
                          </div>
                          {batch.feedingPlan && (
                            <div>
                              <p className="text-muted-foreground">Plan aliment.</p>
                              <p className="font-medium truncate">{batch.feedingPlan}</p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Acquisition</p>
                            <p className="font-medium">{new Date(batch.acquisitionDate).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Récolte prévue</p>
                            <p className="font-medium">{new Date(batch.expectedHarvestDate).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Source</p>
                            <p className="font-medium truncate">{batch.source}</p>
                          </div>
                        </div>

                        {batch.notes && (
                          <div className="mt-2">
                            <p className="text-muted-foreground text-xs">Notes</p>
                            <p className="text-xs line-clamp-2">{batch.notes}</p>
                          </div>
                        )}

                        <div className="mobile-action-grid mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => setSelectedBatchPreview(batch)}>
                            <Eye className="w-3 h-3 mr-1" /> Visualiser
                          </Button>
                          <Button variant="outline" size="sm" className="border-primary/30 text-primary" onClick={() => setSelectedBatchPreview(batch)}>
                            <Fish className="w-3 h-3 mr-1" /> Miniature lot
                          </Button>
                        </div>
                        
                        {/* QR Code et Code-barres pour traçabilité avancée */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="mt-2 h-auto min-h-10 w-full whitespace-normal sm:w-auto">
                              <QrCode className="w-3 h-3 mr-1" />
                              Traçabilité
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <Fish className="w-5 h-5 text-cyan-600" />
                                Traçabilité - LOT-{String(index + 1).padStart(4, '0')}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 p-2">
                              {/* Code-barres */}
                              <div className="bg-white p-4 rounded-lg border text-center">
                                <p className="text-xs text-muted-foreground mb-2">Code-barres</p>
                                <div className="flex justify-center items-center gap-0.5 h-12">
                                  {`LOT${String(index + 1).padStart(4, '0')}${batch.id.slice(0, 8)}`.split('').map((char, i) => (
                                    <div 
                                      key={i} 
                                      className="bg-black" 
                                      style={{ 
                                        width: (i % 3 === 0) ? '2px' : '1px', 
                                        height: '100%' 
                                      }} 
                                    />
                                  ))}
                                </div>
                                <p className="text-xs font-mono mt-1">LOT-{String(index + 1).padStart(4, '0')}-{batch.id.slice(0, 8).toUpperCase()}</p>
                              </div>

                              {/* QR Code professionnel */}
                              <div className="bg-white p-6 rounded-lg border-2 border-primary/20 shadow-sm">
                                <p className="text-sm font-medium text-center mb-3 text-primary">QR Code - Traçabilité</p>
                                <div id={`qr-code-${batch.id}`} className="flex justify-center qr-code-container bg-white p-4 rounded-lg">
                                  <QRCodeSVG 
                                    value={`AQUAPILOT|LOT-${String(index + 1).padStart(4, '0')}|${batch.species}|${batch.quantity}|${batch.unitName}|${batch.acquisitionDate || 'N/A'}|${batch.source || 'Interne'}`}
                                    size={200}
                                    level="H"
                                    includeMargin
                                    bgColor="#ffffff"
                                    fgColor="#1e3a5f"
                                  />
                                </div>
                                <div className="text-center mt-3">
                                  <p className="text-xs font-mono font-bold text-primary">LOT-{String(index + 1).padStart(4, '0')}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{batch.species} • {batch.quantity} ind.</p>
                                </div>
                              </div>

                              {/* Détails de traçabilité */}
                              <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Informations de Traçabilité
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-muted-foreground">Espèce</p>
                                    <p className="font-medium">{batch.species}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Variété</p>
                                    <p className="font-medium">{batch.variety || 'Standard'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Fournisseur/Source</p>
                                    <p className="font-medium">{batch.source || 'Production interne'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Lieu de production</p>
                                    <p className="font-medium">{batch.unitName}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Date d'acquisition</p>
                                    <p className="font-medium">{batch.acquisitionDate ? new Date(batch.acquisitionDate).toLocaleDateString('fr-FR') : 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Âge du lot</p>
                                    <p className="font-medium">{batch.currentAge} jours</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Quantité</p>
                                    <p className="font-medium">{batch.quantity.toLocaleString()} ind.</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Poids moyen</p>
                                    <p className="font-medium">{batch.averageWeight} g</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Poids total</p>
                                    <p className="font-medium">{batch.totalWeight.toFixed(1)} kg</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Récolte prévue</p>
                                    <p className="font-medium">{batch.expectedHarvestDate ? new Date(batch.expectedHarvestDate).toLocaleDateString('fr-FR') : 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Plan alimentaire</p>
                                    <p className="font-medium">{batch.feedingPlan || 'Standard'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Dernier contrôle</p>
                                    <p className="font-medium">{batch.lastHealthCheck ? new Date(batch.lastHealthCheck).toLocaleDateString('fr-FR') : 'N/A'}</p>
                                  </div>
                                </div>
                                {batch.notes && (
                                  <div className="pt-2 border-t">
                                    <p className="text-muted-foreground text-xs">Notes</p>
                                    <p className="text-xs">{batch.notes}</p>
                                  </div>
                                )}
                              </div>

                              {/* Boutons d'action */}
                              <div className="flex gap-2">
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    // Utiliser un ID unique pour le QR code de ce lot
                                    const qrContainer = document.getElementById(`qr-code-${batch.id}`);
                                    const svg = qrContainer?.querySelector('svg');
                                    if (svg) {
                                      // Cloner le SVG pour éviter les problèmes de rendu
                                      const svgClone = svg.cloneNode(true) as SVGElement;
                                      const svgData = new XMLSerializer().serializeToString(svgClone);
                                      const canvas = document.createElement('canvas');
                                      const scale = 3; // Haute résolution
                                      canvas.width = 200 * scale;
                                      canvas.height = 200 * scale;
                                      const ctx = canvas.getContext('2d');
                                      if (ctx) {
                                        ctx.fillStyle = '#ffffff';
                                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                                        ctx.scale(scale, scale);
                                      }
                                      const img = new Image();
                                      img.onload = () => {
                                        ctx?.drawImage(img, 0, 0, 200, 200);
                                        const a = document.createElement('a');
                                        a.download = `QR-LOT-${String(index + 1).padStart(4, '0')}-${batch.species}.png`;
                                        a.href = canvas.toDataURL('image/png', 1.0);
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        toast({
                                          title: "QR Code téléchargé ✓",
                                          description: `Image haute résolution sauvegardée`
                                        });
                                      };
                                      img.onerror = () => {
                                        toast({
                                          title: "Erreur",
                                          description: "Impossible de générer l'image",
                                          variant: "destructive"
                                        });
                                      };
                                      const base64 = btoa(unescape(encodeURIComponent(svgData)));
                                      img.src = `data:image/svg+xml;base64,${base64}`;
                                    } else {
                                      toast({
                                        title: "Erreur",
                                        description: "QR Code non trouvé",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Télécharger QR
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    window.print();
                                  }}
                                >
                                  <Printer className="w-4 h-4 mr-2" />
                                  Imprimer
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {/* Health Actions */}
                      <div className="mobile-action-grid grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-3 pt-3 border-t border-dashed">
                        {batch.status === 'healthy' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-300 hover:bg-orange-50 text-xs"
                              onClick={() => handleBatchStatusChange(batch.id, 'quarantine', t('preventive_quarantine'))}
                            >
                              <Shield className="w-3 h-3 mr-1" />
                              {t('put_in_quarantine')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                              onClick={() => handleBatchStatusChange(batch.id, 'sick')}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {t('declare_sick')}
                            </Button>
                          </>
                        )}
                        {batch.status === 'quarantine' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                              onClick={() => handleBatchStatusChange(batch.id, 'sick')}
                            >
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {t('declare_sick')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50 text-xs"
                              onClick={() => handleBatchStatusChange(batch.id, 'healthy')}
                            >
                              <HeartPulse className="w-3 h-3 mr-1" />
                              {t('mark_healthy')}
                            </Button>
                          </>
                        )}
                        {batch.status === 'sick' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-300 hover:bg-orange-50 text-xs"
                              onClick={() => handleBatchStatusChange(batch.id, 'quarantine')}
                            >
                              <Shield className="w-3 h-3 mr-1" />
                              {t('put_in_quarantine')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-300 hover:bg-green-50 text-xs"
                              onClick={() => handleBatchStatusChange(batch.id, 'healthy')}
                            >
                              <HeartPulse className="w-3 h-3 mr-1" />
                              {t('mark_recovered')}
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="text-xs"
                              onClick={goToProphylaxis}
                            >
                              <Stethoscope className="w-3 h-3 mr-1" />
                              {t('go_to_prophylaxis')}
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="flex sm:flex-col gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingBatch(batch)} className="flex-1 sm:flex-none">
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteBatch(batch.id)} className="flex-1 sm:flex-none">
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Reproduction (uniquement pour écloseries) */}
        <TabsContent value="reproduction">
          <ReproductionManagement selectedUnitId={selectedUnit} />
        </TabsContent>

        {/* Onglet Pêche de contrôle */}
        <TabsContent value="control">
          {activeUnit?.type === 'algoculture' ? (
            <AlgaeCultureTracking unitId={activeUnit.id} />
          ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg flex-wrap">
                      <Fish className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 flex-shrink-0" />
                      <span className="text-sm sm:text-base">{unitTerms.samplingTitle}</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                      {unitTerms.samplingSubtitle}
                    </CardDescription>
                  </div>
                </div>
                
                {/* Recherche par date */}
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-xs whitespace-nowrap">Filtrer par date:</Label>
                    <Input
                      type="date"
                      value={controlSearchDate}
                      onChange={(e) => setControlSearchDate(e.target.value)}
                      className="w-full sm:w-auto text-sm"
                    />
                    {controlSearchDate && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setControlSearchDate('')}
                        className="text-xs px-2"
                      >
                        Effacer
                      </Button>
                    )}
                  </div>
                  {controlSearchDate && (
                    <Badge variant="secondary" className="text-xs">
                      {filteredHealthRecords.length} enregistrement(s) le {new Date(controlSearchDate).toLocaleDateString('fr-FR')}
                    </Badge>
                  )}
                </div>
                
                {filteredHealthRecords.length > 0 && (
                    <div className="mobile-action-grid grid grid-cols-2 gap-2 sm:flex">
                      <ExportDropdown
                        options={{
                          title: 'Historique Pêche de Contrôle',
                          subtitle: `${healthRecords.length} enregistrements`,
                          filename: `peche-controle-${activeUnit?.name?.replace(/\s+/g, '-') || 'tous'}-${new Date().toISOString().split('T')[0]}`,
                          unitName: activeUnit?.name,
                          companyName: 'AquaPilot',
                          columns: [
                            { key: 'date', label: 'Date', format: (v) => new Date(v).toLocaleDateString('fr-FR') },
                            { key: 'basin_id', label: 'Infrastructure', format: (v, row) => {
                              const infra = allCycleInfras.find(i => i.id === v);
                              return infra?.infrastructure_name || 'N/A';
                            }},
                            { key: 'sample_count', label: 'Échantillon', format: (v) => v ? `${v} sujets` : '-' },
                            { key: 'average_weight', label: 'PMI (g)', format: (v) => v?.toFixed(1) || '-' },
                            { key: 'feeding', label: 'Poids Total (kg)', format: (v) => v?.toFixed(2) || '-' },
                            { key: 'density', label: '% Prélevé', format: (v) => v?.toFixed(1) + '%' || '-' },
                            { key: 'temperature', label: 'Temp °C', format: (v) => v || '-' },
                            { key: 'ph', label: 'pH', format: (v) => v || '-' },
                            { key: 'oxygen', label: 'O₂ (mg/L)', format: (v) => v || '-' },
                          ],
                          data: healthRecords,
                        }}
                        label="Télécharger"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const recordsWithNames = healthRecords.map(r => {
                            const infra = allCycleInfras.find(i => i.id === r.basin_id);
                            return {
                              ...r,
                              infrastructureName: infra?.infrastructure_name || 'N/A'
                            };
                          });
                          generateControlFishingPdf({
                            records: recordsWithNames,
                            unitName: activeUnit?.name
                          });
                        }}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimer
                      </Button>
                    </div>
                  )}
              </div>
              <div className="mobile-action-grid grid grid-cols-2 sm:flex gap-2">
                <ControlFishingForm 
                  unitId={selectedUnit === 'all' ? (units[0]?.id || '') : selectedUnit}
                  onRecordCreated={refetchHealthRecords}
                />
                <InfrastructureMortalityForm
                  unitId={selectedUnit === 'all' ? (units[0]?.id || '') : selectedUnit}
                  onRecorded={() => { void refetchHealthRecords(); void refetchBatches(); }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredHealthRecords.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Historique des pêches ({filteredHealthRecords.length})</h4>
                  {(() => {
                    // Grouper par date
                    const recordsByDate = filteredHealthRecords.reduce((acc, record) => {
                      const dateKey = record.date;
                      if (!acc[dateKey]) acc[dateKey] = [];
                      acc[dateKey].push(record);
                      return acc;
                    }, {} as Record<string, typeof healthRecords>);
                    
                    return Object.entries(recordsByDate)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .slice(0, 10)
                      .map(([date, records]) => (
                        <div key={date} className="border rounded-lg overflow-hidden" id={`control-date-${date}`}>
                          <div className="flex justify-between items-center p-3 bg-muted/50">
                            <span className="font-semibold text-sm">{new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{records.length} pêche(s)</Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Download className="w-3 h-3 mr-1" />
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    const recordsWithNames = records.map(r => {
                                      const infra = allCycleInfras.find(i => i.id === r.basin_id);
                                      return { ...r, infrastructureName: infra?.infrastructure_name || 'N/A' };
                                    });
                                    exportControlFishingToPDF({ records: recordsWithNames, unitName: activeUnit?.name, date });
                                  }}>
                                    <FileText className="w-4 h-4 mr-2" /> PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    const recordsWithNames = records.map(r => {
                                      const infra = allCycleInfras.find(i => i.id === r.basin_id);
                                      return { ...r, infrastructureName: infra?.infrastructure_name || 'N/A' };
                                    });
                                    exportControlFishingToWord({ records: recordsWithNames, unitName: activeUnit?.name, date });
                                  }}>
                                    <FileText className="w-4 h-4 mr-2" /> Word
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    const recordsWithNames = records.map(r => {
                                      const infra = allCycleInfras.find(i => i.id === r.basin_id);
                                      return { ...r, infrastructureName: infra?.infrastructure_name || 'N/A' };
                                    });
                                    exportControlFishingToExcel({ records: recordsWithNames, unitName: activeUnit?.name, date });
                                  }}>
                                    <FileText className="w-4 h-4 mr-2" /> Excel
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    const recordsWithNames = records.map(r => {
                                      const infra = allCycleInfras.find(i => i.id === r.basin_id);
                                      return { ...r, infrastructureName: infra?.infrastructure_name || 'N/A' };
                                    });
                                    exportControlFishingToCSV({ records: recordsWithNames, unitName: activeUnit?.name, date });
                                  }}>
                                    <FileText className="w-4 h-4 mr-2" /> CSV
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    const recordsWithNames = records.map(r => {
                                      const infra = allCycleInfras.find(i => i.id === r.basin_id);
                                      return { ...r, infrastructureName: infra?.infrastructure_name || 'N/A' };
                                    });
                                    printControlFishing({ records: recordsWithNames, unitName: activeUnit?.name, date });
                                  }}>
                                    <Printer className="w-4 h-4 mr-2" /> Imprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="divide-y">
                            {records.map((record) => {
                              const infra = allCycleInfras.find(i => i.id === record.basin_id);
                              return (
                                <details key={record.id} className="group">
                                  <summary className="p-3 text-sm hover:bg-accent/30 cursor-pointer list-none [&::-webkit-details-marker]:hidden"
                                    onClick={(e) => {
                                      // Empêcher le scroll vers le haut
                                      e.stopPropagation();
                                    }}
                                  >
                                   <div className="flex justify-between items-start mb-2">
                                     <div className="flex gap-2 flex-wrap">
                                       {infra && <Badge variant="outline">{infra.infrastructure_name}</Badge>}
                                       {record.density && (
                                         <Badge variant="secondary" className="text-xs">
                                           {record.density.toFixed(1)}% prélevé
                                         </Badge>
                                       )}
                                       <span className="text-xs text-muted-foreground">▶ Cliquer pour détails</span>
                                     </div>
                                   </div>
                                   <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                                     <div className="bg-muted/50 p-2 rounded">
                                       <span className="text-muted-foreground block">PMI</span>
                                       <span className="font-bold text-primary">{record.average_weight?.toFixed(1) ?? '-'}g</span>
                                     </div>
                                     <div className="bg-muted/50 p-2 rounded">
                                       <span className="text-muted-foreground block">Échantillon</span>
                                       <span className="font-medium">{record.sample_count ?? '-'} sujets</span>
                                     </div>
                                     <div className="bg-muted/50 p-2 rounded">
                                       <span className="text-muted-foreground block">Poids total</span>
                                       <span className="font-medium">{record.feeding?.toFixed(2) ?? '-'} kg</span>
                                     </div>
                                     <div className="bg-muted/50 p-2 rounded">
                                       <span className="text-muted-foreground block">Temp</span>
                                       <span className="font-medium">{record.temperature ?? '-'}°C</span>
                                     </div>
                                     <div className="bg-muted/50 p-2 rounded">
                                       <span className="text-muted-foreground block">pH / O₂</span>
                                       <span className="font-medium">{record.ph ?? '-'} / {record.oxygen ?? '-'}</span>
                                     </div>
                                   </div>
                                  </summary>
                                   <div className="px-3 pb-3 pt-1 flex flex-wrap gap-2">
                                     <Button variant="outline" size="sm" onClick={() => setSelectedFishingPreview({ ...record, infrastructureName: infra?.infrastructure_name || 'N/A' })}>
                                       <Eye className="w-3 h-3 mr-1" /> Visualiser
                                     </Button>
                                     <Button variant="outline" size="sm" className="border-cyan-500/30 text-cyan-700" onClick={() => setSelectedFishingPreview({ ...record, infrastructureName: infra?.infrastructure_name || 'N/A' })}>
                                       <Waves className="w-3 h-3 mr-1" /> Miniature
                                     </Button>
                                   </div>
                                   {record.notes && (
                                    <div className="px-3 pb-3">
                                      <pre className="text-xs p-2 bg-muted rounded whitespace-pre-wrap">
                                        {record.notes}
                                      </pre>
                                    </div>
                                  )}
                                  {record.mortality != null && record.mortality > 0 && (
                                    <div className="px-3 pb-3">
                                      <Badge variant="destructive" className="text-xs">
                                        Mortalité: {record.mortality}
                                      </Badge>
                                    </div>
                                  )}
                                </details>
                              );
                            })}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <Fish className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Aucune pêche de contrôle enregistrée. Utilisez le formulaire ci-dessus pour en ajouter.
                  </p>
                </div>
              )}

              <Dialog open={!!selectedFishingPreview} onOpenChange={(open) => !open && setSelectedFishingPreview(null)}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Waves className="w-4 h-4 text-cyan-600" /> Détail pêche de contrôle</DialogTitle>
                  </DialogHeader>
                  {selectedFishingPreview && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Infrastructure</p><p className="font-semibold">{selectedFishingPreview.infrastructureName}</p></div>
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">PMI</p><p className="font-semibold">{selectedFishingPreview.average_weight?.toFixed(1) ?? '-'} g</p></div>
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Échantillon</p><p className="font-semibold">{selectedFishingPreview.sample_count ?? '-'}</p></div>
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Poids total</p><p className="font-semibold">{selectedFishingPreview.feeding?.toFixed(2) ?? '-'} kg</p></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Température</p><p className="text-lg font-bold">{selectedFishingPreview.temperature ?? '-'}°C</p></div>
                        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">pH</p><p className="text-lg font-bold">{selectedFishingPreview.ph ?? '-'}</p></div>
                        <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">O₂</p><p className="text-lg font-bold">{selectedFishingPreview.oxygen ?? '-'} mg/L</p></div>
                      </div>
                      {selectedFishingPreview.notes && <div className="rounded-lg border p-3 bg-muted/20 text-sm whitespace-pre-wrap">{selectedFishingPreview.notes}</div>}
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={!!selectedBatchPreview} onOpenChange={(open) => !open && setSelectedBatchPreview(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Fish className="w-4 h-4 text-primary" /> Vue détaillée du lot</DialogTitle>
                  </DialogHeader>
                  {selectedBatchPreview && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Espèce</p><p className="font-semibold">{selectedBatchPreview.species}</p></div>
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Quantité</p><p className="font-semibold">{selectedBatchPreview.quantity.toLocaleString()} ind.</p></div>
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Poids moyen</p><p className="font-semibold">{selectedBatchPreview.averageWeight} g</p></div>
                        <div className="rounded-lg border p-3 bg-muted/20"><p className="text-xs text-muted-foreground">Biomasse</p><p className="font-semibold">{selectedBatchPreview.totalWeight.toFixed(1)} kg</p></div>
                      </div>
                      <div className="rounded-xl border p-4 bg-gradient-to-br from-primary/10 via-background to-cyan-500/10">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Miniature opérationnelle</p>
                            <p className="text-lg font-semibold">{selectedBatchPreview.unitName}</p>
                          </div>
                          <Badge className={getStatusColor(selectedBatchPreview.status)}>
                            {selectedBatchPreview.status === 'healthy' ? 'Sain' : selectedBatchPreview.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 items-end h-40">
                          {[0, 1, 2].map((column) => {
                            const height = Math.max(28, Math.min(100, (selectedBatchPreview.averageWeight / 5) + (column * 8)));
                            return (
                              <div key={column} className="flex flex-col items-center gap-2">
                                <div className="w-full max-w-[70px] rounded-t-[24px] border border-cyan-500/30 bg-cyan-500/10 relative overflow-hidden" style={{ height: 120 }}>
                                  <div className="absolute bottom-0 inset-x-0 bg-cyan-500/25" style={{ height: `${height}%` }} />
                                  <Fish className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-cyan-700" />
                                </div>
                                <span className="text-[11px] text-muted-foreground">Zone {column + 1}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {selectedBatchPreview.notes && <div className="rounded-lg border p-3 text-sm bg-muted/20">{selectedBatchPreview.notes}</div>}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Onglet Graphiques & Évolution */}
        <TabsContent value="charts">
          <div className="grid gap-3 sm:gap-4">
            {/* Message si pas de données */}
            {filteredBatches.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center">
                  <Fish className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Aucune donnée disponible</h3>
                  <p className="text-muted-foreground">
                    Ajoutez des {unitTerms.batchLabel.toLowerCase()}s pour voir les graphiques de performance.
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Graphique performance par espèce - données réelles */}
            {filteredBatches.length > 0 && (
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Performance par espèce</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Comparaison des performances des différentes espèces</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="w-full overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={
                        // Agréger les données par espèce
                        Object.values(filteredBatches.reduce((acc, batch) => {
                          const species = batch.species || 'Autres';
                          if (!acc[species]) {
                            acc[species] = { espece: species, quantite: 0, poids: 0 };
                          }
                          acc[species].quantite += batch.quantity;
                          acc[species].poids += batch.totalWeight;
                          return acc;
                        }, {} as Record<string, { espece: string; quantite: number; poids: number }>))
                      }>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="espece" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="quantite" fill="#3b82f6" name="Quantité" />
                        <Bar dataKey="poids" fill="#10b981" name="Poids total (kg)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Graphique tendances temporelles - données réelles */}
            {filteredBatches.length > 0 && (
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Tendances de croissance globale</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{unitTerms.livestockSubtitle}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="w-full overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={[
                        { mois: 'Actuel', individus: totalQuantity, biomasse: totalWeight }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="left" type="monotone" dataKey="individus" stroke="#8b5cf6" name="Individus" strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="biomasse" stroke="#f59e0b" name="Biomasse (kg)" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KPIs additionnels - calculés à partir des vraies données */}
            {filteredBatches.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-lg sm:text-2xl font-bold truncate">
                          {healthyBatches > 0 ? ((healthyBatches / filteredBatches.length) * 100).toFixed(1) : 0}%
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">Taux survie</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-lg sm:text-2xl font-bold truncate">
                          {totalQuantity > 0 ? (totalWeight / (totalQuantity / 1000)).toFixed(2) : '0'}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">Poids moy. (g)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-base sm:text-2xl font-bold truncate">{filteredBatches.length}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">Lots actifs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-lg sm:text-2xl font-bold truncate">
                          {filteredBatches.length > 0 
                            ? Math.round(filteredBatches.reduce((sum, b) => sum + b.currentAge, 0) / filteredBatches.length) 
                            : 0}j
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">Âge moy.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LivestockManagement;
