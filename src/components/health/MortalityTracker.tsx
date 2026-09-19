
import React, { useState } from 'react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { getUnitTerms, isAlgaeUnitType } from '@/lib/unitContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  Plus, 
  TrendingUp,
  Activity,
  Droplets,
  Thermometer
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MortalityRecord {
  id: string;
  date: string;
  unitId: string;
  basinId: string;
  mortalityCount: number;
  totalPopulation: number;
  mortalityRate: number;
  primaryCause: string;
  secondaryCauses: string[];
  waterQuality: {
    temperature: number;
    ph: number;
    oxygen: number;
    ammonia: number;
  };
  treatment: string;
  preventiveMeasures: string;
  notes: string;
  followUpRequired: boolean;
}

interface MortalityTrackerProps {
  unitId: string;
  unitName: string;
  onMortalityRecorded: (record: MortalityRecord) => void;
}

const MortalityTracker = ({ unitId, unitName, onMortalityRecorded }: MortalityTrackerProps) => {
  const { activeUnit } = useProductionUnits();
  const isAlgae = isAlgaeUnitType(activeUnit?.type);
  const [mortalityRecords, setMortalityRecords] = useState<MortalityRecord[]>([]);

  const [showDialog, setShowDialog] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    basinId: '',
    mortalityCount: 0,
    totalPopulation: 0,
    primaryCause: '',
    secondaryCauses: [] as string[],
    waterQuality: {
      temperature: 0,
      ph: 0,
      oxygen: 0,
      ammonia: 0
    },
    treatment: '',
    preventiveMeasures: '',
    notes: '',
    followUpRequired: false
  });

  const mortalityCauses = [
    'Maladie bactérienne',
    'Maladie virale',
    'Maladie parasitaire',
    'Qualité de l\'eau',
    'Stress',
    'Malnutrition',
    'Température extrême',
    'Manque d\'oxygène',
    'Prédation',
    'Manipulation',
    'Vieillesse',
    'Cause inconnue'
  ];

  const handleSaveRecord = () => {
    const mortalityRate = newRecord.totalPopulation > 0 ? 
      (newRecord.mortalityCount / newRecord.totalPopulation) * 100 : 0;

    const record: MortalityRecord = {
      id: Date.now().toString(),
      unitId,
      mortalityRate,
      ...newRecord
    };

    setMortalityRecords(prev => [record, ...prev]);
    onMortalityRecorded(record);
    
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      basinId: '',
      mortalityCount: 0,
      totalPopulation: 0,
      primaryCause: '',
      secondaryCauses: [],
      waterQuality: {
        temperature: 0,
        ph: 0,
        oxygen: 0,
        ammonia: 0
      },
      treatment: '',
      preventiveMeasures: '',
      notes: '',
      followUpRequired: false
    });
    setShowDialog(false);
  };

  const getStats = () => {
    const totalMortality = mortalityRecords.reduce((sum, record) => sum + record.mortalityCount, 0);
    const averageMortalityRate = mortalityRecords.length > 0 ? 
      mortalityRecords.reduce((sum, record) => sum + record.mortalityRate, 0) / mortalityRecords.length : 0;
    
    const followUpRequired = mortalityRecords.filter(record => record.followUpRequired).length;
    
    const causeDistribution = mortalityRecords.reduce((acc, record) => {
      acc[record.primaryCause] = (acc[record.primaryCause] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMortality,
      averageMortalityRate: averageMortalityRate.toFixed(2),
      followUpRequired,
      mainCause: Object.entries(causeDistribution).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'
    };
  };

  const stats = getStats();

  // Données pour le graphique
  const chartData = mortalityRecords
    .slice()
    .reverse()
    .map(record => ({
      date: new Date(record.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      mortalite: record.mortalityCount,
      taux: record.mortalityRate
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Suivi de Mortalité - {unitName}
          </h3>
          <p className="text-sm text-gray-600">Analyse des causes et mesures préventives</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="text-sm bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              {isAlgae ? 'Enregistrer perte' : 'Enregistrer mortalité'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-full sm:max-w-3xl mx-2 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enregistrer un Épisode de Mortalité</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Date</Label>
                <Input 
                  type="date"
                  value={newRecord.date}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, date: e.target.value }))}
                  className="text-sm"
                />
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
                <Label className="text-sm">{isAlgae ? 'Perte de biomasse (kg)' : 'Nombre de mortalités'}</Label>
                <Input 
                  type="number"
                  value={newRecord.mortalityCount}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, mortalityCount: parseInt(e.target.value) || 0 }))}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-sm">Population totale</Label>
                <Input 
                  type="number"
                  value={newRecord.totalPopulation}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, totalPopulation: parseInt(e.target.value) || 0 }))}
                  className="text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm">Cause principale</Label>
                <Select value={newRecord.primaryCause} onValueChange={(value) => setNewRecord(prev => ({ ...prev, primaryCause: value }))}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Sélectionner la cause principale" />
                  </SelectTrigger>
                  <SelectContent>
                    {mortalityCauses.map(cause => (
                      <SelectItem key={cause} value={cause}>{cause}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Qualité de l'eau */}
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium">Paramètres de l'eau au moment de l'incident</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  <div>
                    <Label className="text-xs text-gray-600">Température (°C)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={newRecord.waterQuality.temperature}
                      onChange={(e) => setNewRecord(prev => ({ 
                        ...prev, 
                        waterQuality: { ...prev.waterQuality, temperature: parseFloat(e.target.value) || 0 }
                      }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">pH</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={newRecord.waterQuality.ph}
                      onChange={(e) => setNewRecord(prev => ({ 
                        ...prev, 
                        waterQuality: { ...prev.waterQuality, ph: parseFloat(e.target.value) || 0 }
                      }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">O₂ (mg/L)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={newRecord.waterQuality.oxygen}
                      onChange={(e) => setNewRecord(prev => ({ 
                        ...prev, 
                        waterQuality: { ...prev.waterQuality, oxygen: parseFloat(e.target.value) || 0 }
                      }))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600">NH₃ (mg/L)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={newRecord.waterQuality.ammonia}
                      onChange={(e) => setNewRecord(prev => ({ 
                        ...prev, 
                        waterQuality: { ...prev.waterQuality, ammonia: parseFloat(e.target.value) || 0 }
                      }))}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-sm">Traitement appliqué</Label>
                <Textarea 
                  value={newRecord.treatment}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, treatment: e.target.value }))}
                  placeholder="Décrivez le traitement appliqué..."
                  className="text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm">Mesures préventives</Label>
                <Textarea 
                  value={newRecord.preventiveMeasures}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, preventiveMeasures: e.target.value }))}
                  placeholder="Mesures pour éviter la récidive..."
                  className="text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm">Notes et observations</Label>
                <Textarea 
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observations détaillées..."
                  className="text-sm"
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button onClick={handleSaveRecord} className="flex-1 bg-red-600 hover:bg-red-700">
                  Enregistrer l'épisode de mortalité
                </Button>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{stats.totalMortality}</p>
            <p className="text-xs sm:text-sm text-gray-600">{isAlgae ? 'Pertes totales (kg)' : 'Total mortalités'}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{stats.averageMortalityRate}%</p>
            <p className="text-xs sm:text-sm text-gray-600">Taux moyen</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{stats.followUpRequired}</p>
            <p className="text-xs sm:text-sm text-gray-600">Suivi requis</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <p className="text-sm sm:text-lg font-bold">{stats.mainCause}</p>
            <p className="text-xs sm:text-sm text-gray-600">Cause principale</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique de mortalité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Évolution de la Mortalité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="mortalite" fill="#ef4444" name="Mortalités" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Liste des enregistrements */}
      <div className="space-y-4">
        {mortalityRecords.map(record => (
          <Card key={record.id} className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Bassin {record.basinId}</CardTitle>
                  <p className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-red-100 text-red-800">
                    {record.mortalityCount} mortalités ({record.mortalityRate.toFixed(2)}%)
                  </Badge>
                  {record.followUpRequired && (
                    <Badge className="bg-orange-100 text-orange-800">Suivi requis</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-sm"><strong>Cause principale:</strong> {record.primaryCause}</p>
                  {record.treatment && (
                    <p className="text-sm mt-1"><strong>Traitement:</strong> {record.treatment}</p>
                  )}
                </div>
                <div className="text-sm">
                  <p><strong>Paramètres eau:</strong></p>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <span>T°: {record.waterQuality.temperature}°C</span>
                    <span>pH: {record.waterQuality.ph}</span>
                    <span>O₂: {record.waterQuality.oxygen} mg/L</span>
                    <span>NH₃: {record.waterQuality.ammonia} mg/L</span>
                  </div>
                </div>
              </div>
              {record.notes && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs sm:text-sm">
                  <strong>Notes:</strong> {record.notes}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MortalityTracker;
