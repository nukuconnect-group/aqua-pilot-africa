import React, { useState } from 'react';
import { 
  Heart, Plus, Calendar, Thermometer, Egg, Fish, 
  TrendingUp, Eye, Edit, Trash2, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useReproductionRecords, ReproductionRecord } from '@/hooks/useReproductionRecords';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import HarvestTransferDialog from '@/components/production/HarvestTransferDialog';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReproductionManagementProps {
  selectedUnitId: string;
}

const ReproductionManagement: React.FC<ReproductionManagementProps> = ({ selectedUnitId }) => {
  const { units } = useProductionUnits();
  const hatcheryUnits = units.filter(u => u.type === 'ecloserie');
  
  const effectiveUnitId = selectedUnitId === 'all' 
    ? hatcheryUnits[0]?.id 
    : selectedUnitId;
  
  const { records, loading, createRecord, updateRecord, deleteRecord } = useReproductionRecords(effectiveUnitId);
  const { batches } = useLivestockBatches(effectiveUnitId);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ReproductionRecord | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [editFormData, setEditFormData] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    species: '',
    broodstock_male_count: 0,
    broodstock_female_count: 0,
    broodstock_batch_id: '',
    reproduction_date: new Date().toISOString().split('T')[0],
    reproduction_method: 'hormonal',
    hormone_used: '',
    hormone_dose: 0,
    spawning_date: '',
    egg_count: 0,
    spawning_rate: 0,
    fertilization_rate: 0,
    incubation_start_date: '',
    incubation_temperature: 0,
    hatching_date: '',
    hatching_rate: 0,
    larvae_count: 0,
    larvae_transfer_date: '',
    fry_count: 0,
    survival_rate: 0,
    status: 'en_cours',
    notes: ''
  });

  const species = ['Tilapia', 'Carpe', 'Truite', 'Poisson-chat', 'Bar', 'Daurade', 'Clarias'];
  const methods = [
    { value: 'hormonal', label: 'Induction hormonale' },
    { value: 'naturel', label: 'Reproduction naturelle' },
    { value: 'strip_spawning', label: 'Stripping (expression manuelle)' }
  ];
  const hormones = ['Ovaprim', 'HCG', 'LHRHa', 'Hypophyse de carpe', 'Autre'];

  const resetForm = () => {
    setFormData({
      species: '',
      broodstock_male_count: 0,
      broodstock_female_count: 0,
      broodstock_batch_id: '',
      reproduction_date: new Date().toISOString().split('T')[0],
      reproduction_method: 'hormonal',
      hormone_used: '',
      hormone_dose: 0,
      spawning_date: '',
      egg_count: 0,
      spawning_rate: 0,
      fertilization_rate: 0,
      incubation_start_date: '',
      incubation_temperature: 0,
      hatching_date: '',
      hatching_rate: 0,
      larvae_count: 0,
      larvae_transfer_date: '',
      fry_count: 0,
      survival_rate: 0,
      status: 'en_cours',
      notes: ''
    });
  };

  const handleSubmit = async () => {
    if (!formData.species || !formData.reproduction_date || !effectiveUnitId) return;
    
    const selectedUnit = units.find(u => u.id === effectiveUnitId);
    
    await createRecord({
      unit_id: effectiveUnitId,
      unit_name: selectedUnit?.name || '',
      species: formData.species,
      broodstock_male_count: formData.broodstock_male_count,
      broodstock_female_count: formData.broodstock_female_count,
      broodstock_batch_id: formData.broodstock_batch_id || null,
      reproduction_date: formData.reproduction_date,
      reproduction_method: formData.reproduction_method,
      hormone_used: formData.hormone_used || null,
      hormone_dose: formData.hormone_dose || null,
      spawning_date: formData.spawning_date || null,
      egg_count: formData.egg_count || null,
      spawning_rate: formData.spawning_rate || null,
      fertilization_rate: formData.fertilization_rate || null,
      incubation_start_date: formData.incubation_start_date || null,
      incubation_temperature: formData.incubation_temperature || null,
      hatching_date: formData.hatching_date || null,
      hatching_rate: formData.hatching_rate || null,
      larvae_count: formData.larvae_count || null,
      larvae_transfer_date: formData.larvae_transfer_date || null,
      fry_count: formData.fry_count || null,
      survival_rate: formData.survival_rate || null,
      status: formData.status,
      notes: formData.notes || null
    });
    
    resetForm();
    setShowAddDialog(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await updateRecord(id, { status: newStatus });
  };

  const handleOpenEdit = (record: ReproductionRecord) => {
    setEditFormData({
      species: record.species,
      broodstock_male_count: record.broodstock_male_count || 0,
      broodstock_female_count: record.broodstock_female_count || 0,
      broodstock_batch_id: record.broodstock_batch_id || '',
      reproduction_date: record.reproduction_date,
      reproduction_method: record.reproduction_method,
      hormone_used: record.hormone_used || '',
      hormone_dose: record.hormone_dose || 0,
      spawning_date: record.spawning_date || '',
      egg_count: record.egg_count || 0,
      spawning_rate: record.spawning_rate || 0,
      fertilization_rate: record.fertilization_rate || 0,
      incubation_start_date: record.incubation_start_date || '',
      incubation_temperature: record.incubation_temperature || 0,
      hatching_date: record.hatching_date || '',
      hatching_rate: record.hatching_rate || 0,
      larvae_count: record.larvae_count || 0,
      larvae_transfer_date: record.larvae_transfer_date || '',
      fry_count: record.fry_count || 0,
      survival_rate: record.survival_rate || 0,
      status: record.status,
      notes: record.notes || ''
    });
    setSelectedRecord(record);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord || !editFormData) return;
    
    await updateRecord(selectedRecord.id, {
      species: editFormData.species,
      broodstock_male_count: editFormData.broodstock_male_count,
      broodstock_female_count: editFormData.broodstock_female_count,
      broodstock_batch_id: editFormData.broodstock_batch_id || null,
      reproduction_date: editFormData.reproduction_date,
      reproduction_method: editFormData.reproduction_method,
      hormone_used: editFormData.hormone_used || null,
      hormone_dose: editFormData.hormone_dose || null,
      spawning_date: editFormData.spawning_date || null,
      egg_count: editFormData.egg_count || null,
      spawning_rate: editFormData.spawning_rate || null,
      fertilization_rate: editFormData.fertilization_rate || null,
      incubation_start_date: editFormData.incubation_start_date || null,
      incubation_temperature: editFormData.incubation_temperature || null,
      hatching_date: editFormData.hatching_date || null,
      hatching_rate: editFormData.hatching_rate || null,
      larvae_count: editFormData.larvae_count || null,
      larvae_transfer_date: editFormData.larvae_transfer_date || null,
      fry_count: editFormData.fry_count || null,
      survival_rate: editFormData.survival_rate || null,
      status: editFormData.status,
      notes: editFormData.notes || null
    });
    
    setShowEditDialog(false);
    setEditFormData(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_cours':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" /> En cours</Badge>;
      case 'terminé':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Terminé</Badge>;
      case 'échoué':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateStats = () => {
    if (records.length === 0) return null;
    
    const completedRecords = records.filter(r => r.status === 'terminé');
    const avgHatchingRate = completedRecords.length > 0
      ? completedRecords.reduce((sum, r) => sum + (r.hatching_rate || 0), 0) / completedRecords.length
      : 0;
    const avgSurvivalRate = completedRecords.length > 0
      ? completedRecords.reduce((sum, r) => sum + (r.survival_rate || 0), 0) / completedRecords.length
      : 0;
    const totalFry = records.reduce((sum, r) => sum + (r.fry_count || 0), 0);
    const totalEggs = records.reduce((sum, r) => sum + (r.egg_count || 0), 0);
    // Statistiques mâles/femelles
    const totalMales = records.reduce((sum, r) => sum + (r.broodstock_male_count || 0), 0);
    const totalFemales = records.reduce((sum, r) => sum + (r.broodstock_female_count || 0), 0);
    
    return { avgHatchingRate, avgSurvivalRate, totalFry, totalEggs, completedCount: completedRecords.length, totalMales, totalFemales };
  };

  const stats = calculateStats();

  // Géniteurs disponibles
  const broodstockBatches = batches.filter(b => 
    b.type === 'geniteurs' || b.type === 'adultes'
  );

  if (hatcheryUnits.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Module Reproduction</h3>
          <p className="text-sm text-muted-foreground">
            Ce module est réservé aux unités de type "Écloserie".<br />
            Créez d'abord une unité de type Écloserie pour accéder à ce module.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentUnit = units.find(u => u.id === effectiveUnitId);
  const isHatchery = currentUnit?.type === 'ecloserie';

  if (!isHatchery && selectedUnitId !== 'all') {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Module non disponible</h3>
          <p className="text-sm text-muted-foreground">
            Le module de reproduction artificielle est uniquement disponible pour les unités de type "Écloserie".
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Reproduction Artificielle
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestion des cycles de reproduction - {currentUnit?.name || hatcheryUnits[0]?.name}
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau cycle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Nouveau cycle de reproduction</DialogTitle>
              <DialogDescription>
                Enregistrez un nouveau cycle de reproduction artificielle
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Géniteurs */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Fish className="w-4 h-4" />
                    Informations géniteurs
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Espèce *</Label>
                      <Select 
                        value={formData.species} 
                        onValueChange={(v) => setFormData({...formData, species: v})}
                      >
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>
                          {species.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Lot de géniteurs</Label>
                      <Select 
                        value={formData.broodstock_batch_id} 
                        onValueChange={(v) => setFormData({...formData, broodstock_batch_id: v})}
                      >
                        <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
                        <SelectContent>
                          {broodstockBatches.map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.species} - {b.quantity} ind.
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre de mâles</Label>
                      <Input 
                        type="number" 
                        value={formData.broodstock_male_count}
                        onChange={(e) => setFormData({...formData, broodstock_male_count: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label>Nombre de femelles</Label>
                      <Input 
                        type="number" 
                        value={formData.broodstock_female_count}
                        onChange={(e) => setFormData({...formData, broodstock_female_count: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Reproduction */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Reproduction
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date de reproduction *</Label>
                      <Input 
                        type="date" 
                        value={formData.reproduction_date}
                        onChange={(e) => setFormData({...formData, reproduction_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Méthode</Label>
                      <Select 
                        value={formData.reproduction_method} 
                        onValueChange={(v) => setFormData({...formData, reproduction_method: v})}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {methods.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {formData.reproduction_method === 'hormonal' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Hormone utilisée</Label>
                        <Select 
                          value={formData.hormone_used} 
                          onValueChange={(v) => setFormData({...formData, hormone_used: v})}
                        >
                          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent>
                            {hormones.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Dose (ml/kg)</Label>
                        <Input 
                          type="number" 
                          step="0.1"
                          value={formData.hormone_dose}
                          onChange={(e) => setFormData({...formData, hormone_dose: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Ponte */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Egg className="w-4 h-4" />
                    Ponte & Fécondation
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date de ponte</Label>
                      <Input 
                        type="date" 
                        value={formData.spawning_date}
                        onChange={(e) => setFormData({...formData, spawning_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Nombre d'œufs estimé</Label>
                      <Input 
                        type="number" 
                        value={formData.egg_count}
                        onChange={(e) => setFormData({...formData, egg_count: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Taux de ponte (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        max="100"
                        value={formData.spawning_rate}
                        onChange={(e) => setFormData({...formData, spawning_rate: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label>Taux de fécondation (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        max="100"
                        value={formData.fertilization_rate}
                        onChange={(e) => setFormData({...formData, fertilization_rate: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Incubation */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Thermometer className="w-4 h-4" />
                    Incubation
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date début incubation</Label>
                      <Input 
                        type="date" 
                        value={formData.incubation_start_date}
                        onChange={(e) => setFormData({...formData, incubation_start_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Température (°C)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={formData.incubation_temperature}
                        onChange={(e) => setFormData({...formData, incubation_temperature: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Éclosion */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Fish className="w-4 h-4" />
                    Éclosion & Alevinage
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date d'éclosion</Label>
                      <Input 
                        type="date" 
                        value={formData.hatching_date}
                        onChange={(e) => setFormData({...formData, hatching_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Taux d'éclosion (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        max="100"
                        value={formData.hatching_rate}
                        onChange={(e) => setFormData({...formData, hatching_rate: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre de larves</Label>
                      <Input 
                        type="number" 
                        value={formData.larvae_count}
                        onChange={(e) => setFormData({...formData, larvae_count: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label>Date transfert larves</Label>
                      <Input 
                        type="date" 
                        value={formData.larvae_transfer_date}
                        onChange={(e) => setFormData({...formData, larvae_transfer_date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre d'alevins final</Label>
                      <Input 
                        type="number" 
                        value={formData.fry_count}
                        onChange={(e) => setFormData({...formData, fry_count: parseInt(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <Label>Taux de survie global (%)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        max="100"
                        value={formData.survival_rate}
                        onChange={(e) => setFormData({...formData, survival_rate: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div>
                  <Label>Notes et observations</Label>
                  <Textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Observations, problèmes rencontrés, etc."
                    rows={3}
                  />
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { resetForm(); setShowAddDialog(false); }}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Stats Géniteurs mâles/femelles */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">♂</span>
                <div>
                  <p className="text-xs text-muted-foreground">Mâles utilisés</p>
                  <p className="text-xl font-bold text-blue-600">{stats.totalMales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-950 dark:to-pink-900 border-pink-200 dark:border-pink-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">♀</span>
                <div>
                  <p className="text-xs text-muted-foreground">Femelles utilisées</p>
                  <p className="text-xl font-bold text-pink-600">{stats.totalFemales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Cycles terminés</p>
                  <p className="text-xl font-bold">{stats.completedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Egg className="w-5 h-5 text-cyan-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total œufs</p>
                  <p className="text-xl font-bold">{stats.totalEggs.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Fish className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total alevins</p>
                  <p className="text-xl font-bold">{stats.totalFry.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Taux éclosion</p>
                  <p className="text-xl font-bold">{stats.avgHatchingRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des cycles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historique des cycles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Aucun cycle de reproduction enregistré</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Démarrer un cycle
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map(record => (
                <div 
                  key={record.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{record.species}</span>
                        {getStatusBadge(record.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          Reproduction: {format(new Date(record.reproduction_date), 'dd MMM yyyy', { locale: fr })}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {record.broodstock_female_count > 0 && (
                            <span>♀ {record.broodstock_female_count} • ♂ {record.broodstock_male_count}</span>
                          )}
                          {record.egg_count && <span>🥚 {record.egg_count.toLocaleString()} œufs</span>}
                          {record.fry_count && <span>🐟 {record.fry_count.toLocaleString()} alevins</span>}
                          {record.hatching_rate && <span>Éclosion: {record.hatching_rate}%</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => { setSelectedRecord(record); setShowDetailsDialog(true); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenEdit(record)}
                        title="Modifier l'historique"
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </Button>
                      {record.status === 'terminé' && (record.fry_count || 0) > 0 && record.unit_id && (
                        <HarvestTransferDialog kind="fry" cycleId={record.id} cycleName="" species={record.species} unitId={record.unit_id} defaultQuantity={record.fry_count || undefined} />
                      )}
                      {record.status === 'en_cours' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleUpdateStatus(record.id, 'terminé')}
                        >
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteRecord(record.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Détails du cycle de reproduction</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedRecord.species}</h3>
                    <p className="text-sm text-muted-foreground">{selectedRecord.unit_name}</p>
                  </div>
                  {getStatusBadge(selectedRecord.status)}
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date reproduction</p>
                    <p className="font-medium">{format(new Date(selectedRecord.reproduction_date), 'dd MMMM yyyy', { locale: fr })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Méthode</p>
                    <p className="font-medium capitalize">{selectedRecord.reproduction_method.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Géniteurs</p>
                    <p className="font-medium">♀ {selectedRecord.broodstock_female_count} • ♂ {selectedRecord.broodstock_male_count}</p>
                  </div>
                  {selectedRecord.hormone_used && (
                    <div>
                      <p className="text-muted-foreground">Hormone</p>
                      <p className="font-medium">{selectedRecord.hormone_used} ({selectedRecord.hormone_dose} ml/kg)</p>
                    </div>
                  )}
                </div>

                {selectedRecord.spawning_date && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Date ponte</p>
                        <p className="font-medium">{format(new Date(selectedRecord.spawning_date), 'dd MMM yyyy', { locale: fr })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Œufs</p>
                        <p className="font-medium">{selectedRecord.egg_count?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taux de ponte</p>
                        <p className="font-medium">{selectedRecord.spawning_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taux fécondation</p>
                        <p className="font-medium">{selectedRecord.fertilization_rate}%</p>
                      </div>
                    </div>
                  </>
                )}

                {selectedRecord.hatching_date && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Date éclosion</p>
                        <p className="font-medium">{format(new Date(selectedRecord.hatching_date), 'dd MMM yyyy', { locale: fr })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taux éclosion</p>
                        <p className="font-medium">{selectedRecord.hatching_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Larves</p>
                        <p className="font-medium">{selectedRecord.larvae_count?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Alevins final</p>
                        <p className="font-medium">{selectedRecord.fry_count?.toLocaleString()}</p>
                      </div>
                    </div>
                  </>
                )}

                {selectedRecord.survival_rate && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Taux de survie global</p>
                      <p className="text-2xl font-bold text-green-600">{selectedRecord.survival_rate}%</p>
                    </div>
                  </>
                )}

                {selectedRecord.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{selectedRecord.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditFormData(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Modifier l'enregistrement
            </DialogTitle>
          </DialogHeader>
          {editFormData && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Informations de base */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Espèce</Label>
                    <Select 
                      value={editFormData.species} 
                      onValueChange={(v) => setEditFormData({...editFormData, species: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {species.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select 
                      value={editFormData.status} 
                      onValueChange={(v) => setEditFormData({...editFormData, status: v})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_cours">En cours</SelectItem>
                        <SelectItem value="terminé">Terminé</SelectItem>
                        <SelectItem value="échoué">Échoué</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Géniteurs */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre de mâles</Label>
                    <Input 
                      type="number" 
                      value={editFormData.broodstock_male_count}
                      onChange={(e) => setEditFormData({...editFormData, broodstock_male_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Nombre de femelles</Label>
                    <Input 
                      type="number" 
                      value={editFormData.broodstock_female_count}
                      onChange={(e) => setEditFormData({...editFormData, broodstock_female_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Ponte */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre d'œufs</Label>
                    <Input 
                      type="number" 
                      value={editFormData.egg_count}
                      onChange={(e) => setEditFormData({...editFormData, egg_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Taux de fécondation (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      max="100" 
                      value={editFormData.fertilization_rate}
                      onChange={(e) => setEditFormData({...editFormData, fertilization_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Éclosion */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date d'éclosion</Label>
                    <Input 
                      type="date" 
                      value={editFormData.hatching_date}
                      onChange={(e) => setEditFormData({...editFormData, hatching_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Taux d'éclosion (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      max="100" 
                      value={editFormData.hatching_rate}
                      onChange={(e) => setEditFormData({...editFormData, hatching_rate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Alevins */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre de larves</Label>
                    <Input 
                      type="number" 
                      value={editFormData.larvae_count}
                      onChange={(e) => setEditFormData({...editFormData, larvae_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label>Nombre d'alevins final</Label>
                    <Input 
                      type="number" 
                      value={editFormData.fry_count}
                      onChange={(e) => setEditFormData({...editFormData, fry_count: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div>
                  <Label>Taux de survie global (%)</Label>
                  <Input 
                    type="number"
                    step="0.1"
                    max="100" 
                    value={editFormData.survival_rate}
                    onChange={(e) => setEditFormData({...editFormData, survival_rate: parseFloat(e.target.value) || 0})}
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label>Notes et observations</Label>
                  <Textarea 
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    placeholder="Observations, mises à jour, etc."
                    rows={3}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditFormData(null); }}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit}>
              Enregistrer les modifications
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReproductionManagement;
