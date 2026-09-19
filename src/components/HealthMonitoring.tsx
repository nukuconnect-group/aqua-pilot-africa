
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Heart, 
  AlertTriangle, 
  TrendingUp, 
  FileText, 
  Plus,
  Thermometer,
  Droplets,
  Activity,
  Fish,
  BarChart3,
  Building2,
  Filter
} from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLogs } from '@/contexts/LogsContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import ProductionUnitSelector from './ProductionUnitSelector';

const HealthMonitoring = () => {
  const { activeUnit, units, setActiveUnit } = useProductionUnits();
  const { addLog } = useLogs();
  
  // Utiliser le hook pour récupérer les données filtrées par unité
  const { records: healthRecords, loading, createRecord } = useHealthRecords(undefined, activeUnit?.id);
  
  const [showRecordDialog, setShowRecordDialog] = useState(false);

  const [newRecord, setNewRecord] = useState({
    unitId: activeUnit?.id || '',
    basinId: '',
    temperature: '',
    ph: '',
    oxygen: '',
    density: '',
    mortality: '',
    feeding: '',
    notes: ''
  });

  // Mettre à jour le formulaire quand l'unité active change
  useEffect(() => {
    if (activeUnit) {
      setNewRecord(prev => ({ ...prev, unitId: activeUnit.id }));
    }
  }, [activeUnit]);

  // Fonction pour changer l'unité
  const handleUnitChange = (unitId: string) => {
    if (unitId === 'all') {
      setActiveUnit(null);
    } else {
      const unit = units.find(u => u.id === unitId);
      setActiveUnit(unit || null);
    }
  };

  // Calculer les moyennes à partir des enregistrements de la DB
  const getUnitStats = (unitId: string) => {
    const unitRecords = healthRecords.filter(r => r.unit_id === unitId);
    if (unitRecords.length === 0) return null;
    
    return {
      avgTemp: (unitRecords.reduce((sum, r) => sum + (r.temperature || 0), 0) / unitRecords.length).toFixed(1),
      avgPh: (unitRecords.reduce((sum, r) => sum + (r.ph || 0), 0) / unitRecords.length).toFixed(1),
      avgOxygen: (unitRecords.reduce((sum, r) => sum + (r.oxygen || 0), 0) / unitRecords.length).toFixed(1),
      avgMortality: (unitRecords.reduce((sum, r) => sum + (r.mortality || 0), 0) / unitRecords.length).toFixed(1),
      recordCount: unitRecords.length
    };
  };

  const handleSaveRecord = async () => {
    if (!activeUnit) return;
    
    try {
      await createRecord({
        unit_id: activeUnit.id,
        basin_id: newRecord.basinId,
        date: new Date().toISOString().split('T')[0],
        temperature: parseFloat(newRecord.temperature) || undefined,
        ph: parseFloat(newRecord.ph) || undefined,
        oxygen: parseFloat(newRecord.oxygen) || undefined,
        density: parseFloat(newRecord.density) || undefined,
        mortality: parseFloat(newRecord.mortality) || undefined,
        feeding: parseFloat(newRecord.feeding) || undefined,
        notes: newRecord.notes || undefined
      });

      addLog('Enregistrement zootechnique', 'Prophylaxie', `Données enregistrées pour ${newRecord.basinId}`, 'info');
      
      setNewRecord({
        unitId: activeUnit?.id || '',
        basinId: '',
        temperature: '',
        ph: '',
        oxygen: '',
        density: '',
        mortality: '',
        feeding: '',
        notes: ''
      });
      setShowRecordDialog(false);
    } catch (error) {
      console.error('Error saving health record:', error);
    }
  };

  const getStatusColor = (value: number, type: string) => {
    switch (type) {
      case 'temperature':
        if (activeUnit?.type === "algoculture") return value < 25 || value > 35 ? "text-red-600" : value < 28 || value > 32 ? "text-yellow-600" : "text-green-600";
        return value < 20 || value > 30 ? 'text-red-600' : value < 22 || value > 28 ? 'text-yellow-600' : 'text-green-600';
      case 'ph':
        if (activeUnit?.type === "algoculture") return value < 8 || value > 11 ? "text-red-600" : value < 9 || value > 10.5 ? "text-yellow-600" : "text-green-600";
        return value < 6.5 || value > 8.5 ? 'text-red-600' : value < 7 || value > 8 ? 'text-yellow-600' : 'text-green-600';
      case 'oxygen':
        if (activeUnit?.type === "algoculture") return value < 2 ? "text-red-600" : value < 4 ? "text-yellow-600" : "text-green-600";
        return value < 5 ? 'text-red-600' : value < 6 ? 'text-yellow-600' : 'text-green-600';
      case 'mortality':
        return value > 2 ? 'text-red-600' : value > 1 ? 'text-yellow-600' : 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
      {/* En-tête responsive */}
      <div className="bg-gradient-to-r from-red-500 to-pink-600 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Prophylaxie & Surveillance</h2>
            <p className="text-red-100 text-sm sm:text-base">Suivi sanitaire et données zootechniques</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Enregistrer données
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-full sm:max-w-2xl mx-2">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">Enregistrement Zootechnique</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <Label className="text-sm">Unité de production</Label>
                    <Select value={newRecord.unitId} onValueChange={(value) => setNewRecord(prev => ({ ...prev, unitId: value }))}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Sélectionner une unité" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id} className="text-sm">{unit.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Bassin</Label>
                    <Input 
                      value={newRecord.basinId}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, basinId: e.target.value }))}
                      placeholder="ID du bassin"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Température (°C)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={newRecord.temperature}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, temperature: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">pH</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={newRecord.ph}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, ph: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Oxygène (mg/L)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={newRecord.oxygen}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, oxygen: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Densité (kg/m³)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={newRecord.density}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, density: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Mortalité (%)</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={newRecord.mortality}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, mortality: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">{activeUnit?.type === 'algoculture' ? 'Intrants (kg)' : 'Alimentation (kg)'}</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={newRecord.feeding}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, feeding: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm">Observations</Label>
                    <Textarea 
                      value={newRecord.notes}
                      onChange={(e) => setNewRecord(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes et observations..."
                      className="text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button onClick={handleSaveRecord} className="w-full text-sm">
                      Enregistrer les données
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Sélecteur d'unité */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Filter className="w-4 h-4" />
              Unité de production :
            </Label>
            <ProductionUnitSelector />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="surveillance" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full text-xs sm:text-sm">
          <TabsTrigger value="surveillance" className="text-xs sm:text-sm">Surveillance</TabsTrigger>
          <TabsTrigger value="records" className="text-xs sm:text-sm">Données</TabsTrigger>
          <TabsTrigger value="analysis" className="text-xs sm:text-sm">Analyses</TabsTrigger>
          <TabsTrigger value="treatments" className="text-xs sm:text-sm">Traitements</TabsTrigger>
        </TabsList>

        <TabsContent value="surveillance" className="space-y-4">
          {/* Vue d'ensemble par unité */}
          <div className="grid gap-4">
            {units.map(unit => {
              const stats = getUnitStats(unit.id);
              if (!stats) return null;
              
              return (
                <Card key={unit.id} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      {unit.name}
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        {stats.recordCount} enregistrements
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                      <div className="text-center p-2 bg-red-50 rounded">
                        <Thermometer className="w-4 h-4 sm:w-6 sm:h-6 text-red-600 mx-auto mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{stats.avgTemp}°C</p>
                        <p className="text-xs text-gray-600">Temp. moy.</p>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <Activity className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600 mx-auto mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{stats.avgPh}</p>
                        <p className="text-xs text-gray-600">pH moyen</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded">
                        <Droplets className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 mx-auto mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{stats.avgOxygen}</p>
                        <p className="text-xs text-gray-600">O₂ (mg/L)</p>
                      </div>
                      <div className="text-center p-2 bg-orange-50 rounded">
                        <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600 mx-auto mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{stats.avgMortality}%</p>
                        <p className="text-xs text-gray-600">Mortalité</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Enregistrements Zootechniques
                {activeUnit && (
                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                    {activeUnit.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : healthRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {activeUnit ? 'Aucun enregistrement pour cette unité' : 'Sélectionnez une unité pour voir les enregistrements'}
                </div>
              ) : (
                <div className="space-y-4">
                  {healthRecords.map(record => (
                    <div key={record.id} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-2">
                        <div>
                          <h4 className="font-medium text-sm sm:text-base">Bassin {record.basin_id || 'N/A'}</h4>
                          <p className="text-xs sm:text-sm text-gray-600">{new Date(record.date).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          {units.find(u => u.id === record.unit_id)?.name || 'N/A'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div>
                          <span className="text-gray-600">Temp:</span>
                          <span className={`ml-1 font-medium ${getStatusColor(record.temperature || 0, 'temperature')}`}>
                            {record.temperature || '-'}°C
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">pH:</span>
                          <span className={`ml-1 font-medium ${getStatusColor(record.ph || 0, 'ph')}`}>
                            {record.ph || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">O₂:</span>
                          <span className={`ml-1 font-medium ${getStatusColor(record.oxygen || 0, 'oxygen')}`}>
                            {record.oxygen || '-'} mg/L
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Densité:</span>
                          <span className="ml-1 font-medium">{record.density || '-'} kg/m³</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Mortalité:</span>
                          <span className={`ml-1 font-medium ${getStatusColor(record.mortality || 0, 'mortality')}`}>
                            {record.mortality || '-'}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">{activeUnit?.type === 'algoculture' ? 'Intrant:' : 'Aliment:'}</span>
                          <span className="ml-1 font-medium">{record.feeding || '-'} kg</span>
                        </div>
                      </div>
                      {record.notes && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs sm:text-sm">
                          <strong>Notes:</strong> {record.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Analyses de Laboratoire</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">Module d'analyses en développement...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treatments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Traitements Vétérinaires</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">Module de traitements en développement...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HealthMonitoring;
