
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Plus, TrendingUp, Activity, Clock, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import SmartAlerts from './alerts/SmartAlerts';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ProductionUnitSelector from './ProductionUnitSelector';
import ProductionCycleForm from './production/ProductionCycleForm';
import ProductionCycleDetails from './production/ProductionCycleDetails';
import HarvestTransferDialog from './production/HarvestTransferDialog';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const ProductionManagement = () => {
  const { activeUnit, infrastructures: unitInfrastructures } = useProductionUnits();
  const { cycles, loading: cyclesLoading, refetch: refetchCycles, deleteCycle } = useProductionCycles(activeUnit?.id);
  const { infrastructures: allCycleInfrastructures } = useCycleInfrastructures(undefined, true);
  const { batches } = useLivestockBatches(activeUnit?.id);
  const { records: healthRecords } = useHealthRecords(undefined, activeUnit?.id);
  
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Convertir les cycles DB en format utilisé par le composant avec calculs automatiques
  // IMPORTANT: Utiliser les mêmes calculs que ProductionCycleDetails pour la concordance
  const unitCycles = useMemo(() => {
    return cycles.map(cycle => {
      // Trouver les infrastructures rattachées à ce cycle
      const cycleInfras = allCycleInfrastructures.filter(infra => infra.cycle_id === cycle.id);
      
      // Récupérer les health records pour ce cycle (mortalités, poids moyen)
      const cycleHealthRecords = healthRecords.filter(r => r.cycle_id === cycle.id);
      
      // Calculer les totaux à partir des lots rattachés via cycle_infrastructures
      let totalInitialQuantity = 0;
      let totalWeight = 0;
      let avgExpectedSurvival = 0;
      let batchCount = 0;
      let totalBatchWeight = 0;
      
      cycleInfras.forEach(infra => {
        const batch = infra.livestock_batch_id ? batches.find(b => b.id === infra.livestock_batch_id) : null;
        if (batch) {
          totalInitialQuantity += batch.quantity;
          totalWeight += batch.quantity * (batch.average_weight || 0);
          totalBatchWeight += batch.average_weight || 0;
          avgExpectedSurvival += batch.expected_survival_rate || 95;
          batchCount++;
        } else {
          // Utiliser current_quantity de l'infrastructure si pas de lot
          totalInitialQuantity += infra.current_quantity || 0;
        }
      });
      
      if (batchCount > 0) {
        avgExpectedSurvival = avgExpectedSurvival / batchCount;
        totalBatchWeight = totalBatchWeight / batchCount;
      } else {
        avgExpectedSurvival = 95;
      }
      
      // Calculer les mortalités cumulées depuis les health records
      const totalMortality = cycleHealthRecords.reduce((sum, r) => sum + (r.mortality || 0), 0);
      
      // Quantité initiale: priorité aux lots, sinon valeurs du cycle
      const initialQty = totalInitialQuantity > 0 
        ? totalInitialQuantity 
        : (cycle.initial_quantity || cycle.fingerlings_count || cycle.target_quantity || 0);
      
      // Quantité actuelle = initiale - mortalités
      const currentQty = Math.max(0, initialQty - totalMortality);
      
      // Taux de survie réel
      const survivalRate = initialQty > 0 ? (currentQty / initialQty) * 100 : 100;
      
      // Objectif final (utilisé pour l'affichage)
      const targetQty = cycle.target_quantity || Math.round(initialQty * (avgExpectedSurvival / 100));
      
      // Poids moyen depuis le dernier health record
      const latestHealthRecord = cycleHealthRecords.length > 0 
        ? cycleHealthRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        : null;
      const currentAverageWeight = latestHealthRecord?.average_weight || totalBatchWeight || 0;
      
      // Progression temporelle du cycle
      const startDate = new Date(cycle.start_date);
      const cycleDuration = cycle.duration_months ? cycle.duration_months * 30 : 180;
      const endDate = cycle.end_date 
        ? new Date(cycle.end_date) 
        : new Date(startDate.getTime() + cycleDuration * 24 * 60 * 60 * 1000);
      const now = new Date();
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      const timeProgress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
      
      return {
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
        startDate: cycle.start_date,
        endDate: cycle.end_date,
        currentQuantity: currentQty,
        targetQuantity: targetQty,
        initialQuantity: initialQty,
        initialWeight: totalWeight,
        currentAverageWeight,
        notes: cycle.notes,
        species: cycle.species,
        species: cycle.species,
        duration_months: cycle.duration_months,
        stockingDate: cycle.stocking_date,
        fingerlingsCount: cycle.fingerlings_count,
        unitId: cycle.unit_id,
        infrastructureCount: cycleInfras.length,
        totalMortality,
        avgSurvivalRate: survivalRate, // Taux réel, pas attendu
        expectedSurvivalRate: avgExpectedSurvival,
        timeProgress
      };
    });
  }, [cycles, allCycleInfrastructures, batches, healthRecords]);

  const [cycleAlertsData, setCycleAlertsData] = useState<any>(null);

  useEffect(() => {
    if (!activeUnit) return;
    if (unitCycles.length > 0) {
      const activeCycles = unitCycles.filter(c => c.status === 'active');
      const totalCurrent = activeCycles.reduce((sum, c) => sum + c.currentQuantity, 0);
      const totalTarget = activeCycles.reduce((sum, c) => sum + c.targetQuantity, 0);
      const avgProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

      const performanceIndex = activeCycles.reduce((sum, c) => {
        const progress = (c.currentQuantity / Math.max(1, c.targetQuantity)) * 100;
        const daysElapsed = Math.floor(
          (new Date().getTime() - new Date(c.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        const expectedProgress = Math.min(100, (daysElapsed / 150) * 100);
        return sum + (progress / Math.max(1, expectedProgress));
      }, 0) / Math.max(1, activeCycles.length);

      setCycleAlertsData({
        quantity: totalCurrent,
        mortality: totalCurrent * 0.018,
        growthRate: 2.5,
        temperature: 25,
        ph: 7.5,
        oxygen: 6.8,
        feedingEfficiency: 1.45,
        unitName: activeUnit.name,
        production: {
          current: totalCurrent,
          target: totalTarget,
          progress: avgProgress,
          performance: performanceIndex
        }
      });
    }
  }, [unitCycles, activeUnit]);

  if (!activeUnit) {
    return (
      <div className="space-y-responsive">
        <div className="bg-gradient-ocean p-responsive rounded-xl text-primary-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-responsive">
            <div>
              <h2 className="text-responsive-title font-bold mb-2">Gestion des Cycles</h2>
              <p className="text-primary-foreground/80 text-responsive">Suivi des cycles et performances</p>
            </div>
          </div>
          <div className="mt-4">
            <ProductionUnitSelector />
          </div>
        </div>

        <div className="text-center py-12">
          <BarChart3 className="icon-responsive-lg mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-responsive-subtitle font-semibold text-foreground mb-2">
            Aucune unité sélectionnée
          </h3>
          <p className="text-muted-foreground text-responsive">
            Sélectionnez une unité pour voir sa production
          </p>
        </div>
      </div>
    );
  }

  const handleSaveCycle = async (cycle) => {
    // Refetch cycles from database to get the newly created cycle
    await refetchCycles();
  };

  const handleShowDetails = (cycle) => {
    setSelectedCycle(cycle);
    setShowDetails(true);
  };

  const handleEditCycle = (cycle) => {
    // Future: Implement cycle editing
    console.log('Edit cycle:', cycle);
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur d'unité */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Cycles - {activeUnit.name}</h2>
            <p className="text-green-100 text-sm sm:text-base">Suivi des cycles et performances</p>
            <div className="mt-2 flex flex-wrap items-center space-x-4 text-xs sm:text-sm">
              <span>Type: {activeUnit.type.charAt(0).toUpperCase() + activeUnit.type.slice(1)}</span>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {unitCycles.length} cycles
              </Badge>
            </div>
          </div>
          <div className="mt-4 sm:mt-0">
            <ProductionCycleForm 
              unitId={activeUnit.id}
              unitName={activeUnit.name}
              unitType={activeUnit.type}
              onSave={handleSaveCycle}
            />
          </div>
        </div>
        
        <ProductionUnitSelector />
      </div>

      {/* Alertes intelligentes pour les cycles */}
      {cycleAlertsData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Surveillance des cycles
            </CardTitle>
            <CardDescription>Alertes automatiques sur les performances des cycles</CardDescription>
          </CardHeader>
          <CardContent>
            <SmartAlerts data={cycleAlertsData} unitId={activeUnit.id} />
          </CardContent>
        </Card>
      )}

      {/* Métriques de production */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{unitCycles.filter(c => c.status === 'active').length}</p>
            <p className="text-xs sm:text-sm text-gray-600">Cycles actifs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{unitCycles.reduce((sum, c) => sum + c.currentQuantity, 0).toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600">Production actuelle</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{unitCycles.reduce((sum, c) => sum + c.targetQuantity, 0).toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-gray-600">Objectif total</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{unitCycles.filter(c => c.status === 'completed').length}</p>
            <p className="text-xs sm:text-sm text-gray-600">Cycles terminés</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des cycles */}
      <Tabs defaultValue="active" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active">Cycles actifs</TabsTrigger>
            <TabsTrigger value="all">Tous les cycles</TabsTrigger>
            <TabsTrigger value="planning">Planification</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="space-y-4">
          {unitCycles.filter(c => c.status === 'active').length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unitCycles.filter(c => c.status === 'active').map((cycle) => (
                <Card key={cycle.id} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg">{cycle.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 w-fit">
                          {cycle.status}
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="outline" className="h-7 w-7 text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer le cycle ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action supprimera définitivement le cycle "{cycle.name}" et toutes ses données associées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCycle(cycle.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div>
                        <p className="text-gray-600">Qté initiale</p>
                        <p className="font-medium">{cycle.initialQuantity.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Poids moy. actuel</p>
                        <p className="font-medium">{cycle.currentAverageWeight ? `${cycle.currentAverageWeight.toFixed(1)} g` : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Qté actuelle/cible</p>
                        <p className="font-medium">
                          {cycle.currentQuantity.toLocaleString()} / {cycle.targetQuantity.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Taux survie</p>
                        <p className="font-medium">{cycle.avgSurvivalRate.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    {/* Barre de progression temporelle */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progression du cycle</span>
                        <span>{cycle.timeProgress}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all" 
                          style={{ width: `${cycle.timeProgress}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {cycle.notes && (
                      <p className="text-xs sm:text-sm text-gray-500">{cycle.notes}</p>
                    )}
                    
                    <div className="pt-2 border-t flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => handleShowDetails(cycle)}
                      >
                        Détails
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 sm:flex-none"
                        onClick={() => handleEditCycle(cycle)}
                      >
                        Modifier
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Aucun cycle actif
              </h3>
              <p className="text-gray-500 mb-4">
                Aucun cycle de production en cours pour {activeUnit.name}
              </p>
              <ProductionCycleForm 
                unitId={activeUnit.id}
                unitName={activeUnit.name}
                unitType={activeUnit.type}
                onSave={handleSaveCycle}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          <div className="space-y-4">
            {unitCycles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun cycle de production
              </div>
            ) : unitCycles.map((cycle) => (
              <Card key={cycle.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm sm:text-base">{cycle.name}</h4>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {cycle.startDate} - {cycle.endDate || 'En cours'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        <span>Init: {cycle.initialQuantity.toLocaleString()}</span>
                        <span>Poids moy: {cycle.currentAverageWeight ? `${cycle.currentAverageWeight.toFixed(1)}g` : 'N/A'}</span>
                        <span>Survie: {cycle.avgSurvivalRate.toFixed(0)}%</span>
                      </div>
                      {/* Barre de progression */}
                      <div className="mt-2">
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all" 
                            style={{ width: `${cycle.timeProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        className={
                          cycle.status === 'active' ? 'bg-green-100 text-green-800' :
                          cycle.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {cycle.status}
                      </Badge>
                      {activeUnit?.id && (cycle.status === 'completed' || cycle.timeProgress >= 100) && (
                        <HarvestTransferDialog cycleId={cycle.id} cycleName={cycle.name} species={cycle.species} unitId={activeUnit.id} />
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline" className="h-8 w-8 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer le cycle ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action supprimera définitivement le cycle "{cycle.name}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCycle(cycle.id)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="planning">
          <div className="space-y-4">
            {/* Graphique de planification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Planification des cycles</CardTitle>
                <CardDescription>Vue d'ensemble des cycles planifiés et en cours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Timeline des cycles */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-4">Timeline des cycles pour {activeUnit.name}</h4>
                    <div className="space-y-3">
                      {unitCycles.slice(0, 5).map((cycle, idx) => (
                        <div key={cycle.id} className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            cycle.status === 'active' ? 'bg-green-500' :
                            cycle.status === 'completed' ? 'bg-blue-500' :
                            'bg-yellow-500'
                          }`} />
                          <div className="flex-1 border-l-2 border-gray-200 pl-4 pb-3">
                            <p className="font-medium">{cycle.name}</p>
                            <p className="text-sm text-gray-600">
                              {cycle.startDate} → {cycle.endDate || 'En cours'}
                            </p>
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full" 
                                style={{ width: `${Math.min(100, (cycle.currentQuantity / cycle.targetQuantity) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Graphique de capacité */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Utilisation de la capacité</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-end justify-around gap-2">
                        {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'].map((month, idx) => {
                          const height = Math.random() * 80 + 20;
                          return (
                            <div key={month} className="flex-1 flex flex-col items-center gap-2">
                              <div className="w-full bg-primary/20 rounded-t" style={{ height: `${height}%` }}>
                                <div className="w-full bg-primary rounded-t h-3/4" />
                              </div>
                              <span className="text-xs text-gray-600">{month}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prévisions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <BarChart3 className="w-8 h-8 text-blue-600" />
                          <div>
                            <p className="text-2xl font-bold">{unitCycles.filter(c => c.status === 'planned').length}</p>
                            <p className="text-sm text-gray-600">Cycles planifiés</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-8 h-8 text-green-600" />
                          <div>
                            <p className="text-2xl font-bold">
                              {unitCycles.reduce((sum, c) => sum + c.targetQuantity, 0).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">Production prévue</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Clock className="w-8 h-8 text-orange-600" />
                          <div>
                            <p className="text-2xl font-bold">
                              {Math.round(unitCycles.reduce((sum, c) => {
                                const start = new Date(c.startDate);
                                const end = c.endDate ? new Date(c.endDate) : new Date();
                                return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                              }, 0) / unitCycles.length)}j
                            </p>
                            <p className="text-sm text-gray-600">Durée moyenne</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal des détails du cycle */}
      {selectedCycle && (
        <ProductionCycleDetails
          cycle={selectedCycle}
          isOpen={showDetails}
          onClose={() => {
            setShowDetails(false);
            setSelectedCycle(null);
          }}
          onEdit={handleEditCycle}
        />
      )}
    </div>
  );
};

export default ProductionManagement;
