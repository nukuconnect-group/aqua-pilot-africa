import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Activity, 
  Scale, 
  Utensils, 
  Calendar,
  Fish,
  Target,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import CycleEvolutionCharts from './CycleEvolutionCharts';
import CycleInfrastructuresList from './CycleInfrastructuresList';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useCycleBatchData } from '@/hooks/useCycleBatchData';

interface CycleDetailsProps {
  cycle: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate?: string;
    currentQuantity: number;
    targetQuantity: number;
    notes?: string;
    initialQuantity?: number;
    stockingDate?: string;
    fingerlingsCount?: number;
    species?: string;
    duration_months?: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (cycle: any) => void;
}

const ProductionCycleDetails: React.FC<CycleDetailsProps> = ({ cycle, isOpen, onClose, onEdit }) => {
  // Utilisation des hooks pour récupérer les données depuis Supabase
  const { records: feedingRecords } = useFeedingRecords(cycle.id);
  const { records: healthRecords } = useHealthRecords(cycle.id);
  
  // Utiliser le hook pour récupérer les données des lots et infrastructures
  const cycleBatchData = useCycleBatchData(cycle.id);
  
  // Données calculées
  const daysElapsed = Math.floor((new Date().getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const cycleDuration = cycle.endDate 
    ? Math.floor((new Date(cycle.endDate).getTime() - new Date(cycle.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : (cycle.duration_months ? cycle.duration_months * 30 : 180); // Utiliser la durée prévue ou 180 jours par défaut
  const expectedEndDate = cycle.endDate || 'Non défini';
  
  // Progression temporelle du cycle (basée sur le temps écoulé vs durée prévue)
  const timeProgress = Math.min(100, Math.max(0, (daysElapsed / cycleDuration) * 100));
  
  // Calcul du poids moyen basé sur les enregistrements de santé ou les lots rattachés
  const latestHealthRecord = healthRecords.length > 0 ? healthRecords[0] : null;
  
  // Poids moyen depuis les lots ou le dernier enregistrement de santé
  const averageWeight = latestHealthRecord?.average_weight 
    ? latestHealthRecord.average_weight
    : cycleBatchData.batchesDetails.length > 0
      ? cycleBatchData.batchesDetails.reduce((sum, d) => sum + (d?.batch?.average_weight || 0), 0) / cycleBatchData.batchesDetails.length
      : 0;
  
  // Croissance journalière
  const dailyGrowth = daysElapsed > 0 ? (averageWeight / daysElapsed).toFixed(2) : '0';
  
  // Calcul basé sur les enregistrements d'alimentation
  const feedConsumed = feedingRecords.reduce((sum, r) => sum + (r.quantity || 0), 0).toFixed(1);
  const avgFCR = feedingRecords.length > 0
    ? (feedingRecords.reduce((sum, r) => sum + (r.fcr || 0), 0) / feedingRecords.length).toFixed(2)
    : '1.2';
  const feedConversionRatio = parseFloat(avgFCR);
  
  // Calcul du taux de survie basé sur les lots rattachés et les mortalités
  const totalMortality = cycleBatchData.totalMortality || healthRecords.reduce((sum, record) => sum + (record.mortality || 0), 0);
  const initialQuantity = cycleBatchData.totalInitialQuantity || cycle.initialQuantity || cycle.targetQuantity;
  const currentAlive = cycleBatchData.totalCurrentQuantity > 0 
    ? cycleBatchData.totalCurrentQuantity 
    : (initialQuantity - totalMortality);
  const survivalRate = initialQuantity > 0 
    ? ((currentAlive / initialQuantity) * 100).toFixed(1)
    : '100.0';
  const expectedSurvivalRate = cycleBatchData.expectedSurvivalRate.toFixed(1);
  
  // Données environnementales basées sur le dernier enregistrement de santé
  const waterTemperature = latestHealthRecord?.temperature || 24.5;
  const dissolvedOxygen = latestHealthRecord?.oxygen || 7.2;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="text-xl font-bold">{cycle.name}</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge className={
                cycle.status === 'active' ? 'bg-green-100 text-green-800' :
                cycle.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }>
                {cycle.status}
              </Badge>
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit(cycle);
                    onClose();
                  }}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                >
                  Modifier
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="infrastructures">Infrastructures</TabsTrigger>
            <TabsTrigger value="evolution">
              <BarChart3 className="w-4 h-4 mr-2" />
              Évolution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Informations générales */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Informations du cycle
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {cycle.species && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Espèce</p>
                      <p className="font-medium text-lg">{cycle.species}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Date de début</p>
                    <p className="font-medium">{new Date(cycle.startDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fin prévue</p>
                    <p className="font-medium">
                      {expectedEndDate !== 'Non défini' 
                        ? new Date(expectedEndDate).toLocaleDateString('fr-FR')
                        : expectedEndDate}
                    </p>
                  </div>
                  {cycle.duration_months && (
                    <div>
                      <p className="text-muted-foreground">Durée prévue</p>
                      <p className="font-medium">{cycle.duration_months} mois</p>
                    </div>
                  )}
                  {cycle.stockingDate && (
                    <div>
                      <p className="text-muted-foreground">Date d'empoisonnement</p>
                      <p className="font-medium">{new Date(cycle.stockingDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Jours écoulés</p>
                    <p className="font-medium">{daysElapsed} jours</p>
                  </div>
                <div>
                  <p className="text-muted-foreground">Taux de survie</p>
                  <p className={`font-medium ${parseFloat(survivalRate) >= 90 ? 'text-green-600' : parseFloat(survivalRate) >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {survivalRate}%
                  </p>
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Production */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Fish className="w-4 h-4" />
                  Production
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {cycle.initialQuantity && (
                      <div>
                        <p className="text-muted-foreground">Objectif initial</p>
                        <p className="font-medium text-lg">{cycle.initialQuantity.toLocaleString()}</p>
                      </div>
                    )}
                    {cycle.fingerlingsCount && (
                      <div>
                        <p className="text-muted-foreground">Nombre d'alevins empoisonnés</p>
                        <p className="font-medium text-lg">{cycle.fingerlingsCount.toLocaleString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Quantité actuelle vivante</p>
                      <p className="font-medium text-lg">{currentAlive.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mortalités cumulées</p>
                      <p className="font-medium text-lg text-red-600">{totalMortality.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Objectif final prévu</p>
                      <p className="font-medium text-lg">{cycle.targetQuantity.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taux de survie actuel</p>
                      <p className={`font-medium text-lg ${parseFloat(survivalRate) >= 90 ? 'text-green-600' : parseFloat(survivalRate) >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {survivalRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taux de survie prévisionnel</p>
                      <p className="font-medium text-lg text-blue-600">
                        {expectedSurvivalRate}%
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-wrap justify-between gap-2 text-sm mb-1">
                      <span className="text-muted-foreground">Progression temporelle du cycle</span>
                      <span className="font-medium">{timeProgress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-primary h-3 rounded-full transition-all"
                        style={{ width: `${timeProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {daysElapsed} jours écoulés sur {cycleDuration} jours prévus
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Croissance */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Croissance
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Poids moyen actuel</p>
                    <p className="font-medium text-lg">{averageWeight.toFixed(1)}g</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Croissance journalière</p>
                    <p className="font-medium text-lg text-green-600">+{dailyGrowth}g/jour</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alimentation */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  Alimentation
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Aliment ingéré</p>
                    <p className="font-medium text-lg">{feedConsumed} kg</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taux de conversion (FCR)</p>
                    <p className="font-medium text-lg">{feedConversionRatio}</p>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <Target className="w-3 h-3 inline mr-1" />
                    Consommation moyenne: {(parseFloat(feedConsumed) / daysElapsed).toFixed(2)} kg/jour
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Paramètres environnementaux */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Conditions environnementales
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Température de l'eau</p>
                    <p className="font-medium">{waterTemperature}°C</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Oxygène dissous</p>
                    <p className="font-medium">{dissolvedOxygen} mg/L</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {cycle.notes && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Notes
                  </h3>
                  <p className="text-sm text-muted-foreground">{cycle.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="infrastructures" className="mt-4">
            <CycleInfrastructuresList cycleId={cycle.id} />
          </TabsContent>

          <TabsContent value="evolution" className="mt-4">
            <CycleEvolutionCharts 
              cycleId={cycle.id}
              cycleName={cycle.name}
              daysElapsed={daysElapsed}
              cycleDuration={cycleDuration}
              feedingRecords={feedingRecords}
              healthRecords={healthRecords}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionCycleDetails;