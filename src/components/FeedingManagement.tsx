import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Plus, TrendingUp, Activity, Clock, AlertTriangle, Utensils, Printer, Mail, History, Package, Bell, Download, User, ClipboardList } from 'lucide-react';
import SmartAlerts from './alerts/SmartAlerts';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ProductionUnitSelector from './ProductionUnitSelector';
import ProductionCycleForm from './production/ProductionCycleForm';
import ProductionCycleDetails from './production/ProductionCycleDetails';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useSettings } from '@/contexts/SettingsContext';
import SimpleFeedingForm from './feeding/SimpleFeedingForm';
import DailyFeedingSummary from './feeding/DailyFeedingSummary';
import FeedStockManager from './feeding/FeedStockManager';
import FeedingChart from './feeding/FeedingChart';
import FeedingPlanScheduler from './feeding/FeedingPlanScheduler';
import FeedingAnalyticsDashboard from './feeding/FeedingAnalyticsDashboard';
import FeedingSheetsManager from './feeding/FeedingSheetsManager';
import { generateFeedingRecordHTML, printHTML } from '@/lib/feedingPrintUtils';
import { useToast } from '@/hooks/use-toast';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { createNotification } from '@/lib/notificationService';
import { supabase } from '@/integrations/supabase/appClient';
import ExportDropdown from './ExportDropdown';
import { ExportOptions } from '@/lib/dataExportUtils';
import { getUnitTerms } from '@/lib/unitContext';

const FeedingManagement = () => {
  const { activeUnit } = useProductionUnits();
  const { t } = useSettings();
  const { toast } = useToast();
  const [feedingTab, setFeedingTab] = useState('history');
  const unitTerms = getUnitTerms(activeUnit?.type);
  
  // Filtrer les enregistrements par unité active
  const { records: feedingRecords, loading, createRecord, updateRecord, deleteRecord } = useFeedingRecords(undefined, activeUnit?.id);
  const { cycles } = useProductionCycles(activeUnit?.id);
  const { stocks } = useFeedStocks(activeUnit?.id);
  
  const activeCycle = cycles.find(c => c.status === 'active');
  const { infrastructures } = useCycleInfrastructures(activeCycle?.id || '');

  if (!activeUnit) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 rounded-xl text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('feeding_management_title')}</h2>
              <p className="text-orange-100 text-sm sm:text-base">{t('feeding_management_desc')}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProductionUnitSelector />
          </div>
        </div>
        
        <div className="text-center py-12">
          <Utensils className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {t('no_unit_selected')}
          </h3>
          <p className="text-gray-500">
            {t('select_unit_for_feeding')}
          </p>
        </div>
      </div>
    );
  }

  // Les enregistrements sont déjà filtrés par l'unité active via le hook
  const unitRecords = feedingRecords;

  // Calculer les données réelles à partir des enregistrements
  const getFeedingData = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = unitRecords.filter(r => r.date === today);
    const dailyQuantity = todayRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
    
    // Trouver le dernier et prochain repas
    const sortedRecords = [...unitRecords].sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
      return dateB.getTime() - dateA.getTime();
    });
    
    const lastRecord = sortedRecords[0];
    const lastFeeding = lastRecord ? (lastRecord.time || 'N/A') : '-';
    
    const unitTypeLabels: Record<string, { title: string; subtitle: string }> = {
      ecloserie: { title: 'Alimentation - Écloserie', subtitle: 'Nourriture spécialisée pour alevins et géniteurs' },
      grossissement: { title: 'Alimentation - Grossissement', subtitle: 'Programme d\'alimentation pour la croissance' },
      fabrication_aliment: { title: 'Production d\'Aliment', subtitle: 'Fabrication et formulation' },
      algoculture: { title: 'Intrants & Nutriments', subtitle: 'Nutriments, fertilisants, minéraux, CO₂ et solutions nutritives' }
    };
    
    const typeInfo = unitTypeLabels[activeUnit.type] || { 
      title: `Alimentation - ${activeUnit.name}`, 
      subtitle: 'Gestion de l\'alimentation' 
    };
    
    return {
      title: typeInfo.title,
      subtitle: typeInfo.subtitle,
      dailyQuantity: dailyQuantity > 0 ? `${dailyQuantity} kg` : '-',
      feedType: lastRecord?.feed_type || '-',
      feedingTimes: todayRecords.length,
      lastFeeding,
      nextFeeding: '-',
      notes: activeCycle?.notes || ''
    };
  };

  const feedingData = getFeedingData();
  const lowStockItems = stocks.filter((stock) => (stock.quantity || 0) <= (stock.min_threshold || 50));

  if (!['ecloserie', 'grossissement', 'fabrication_aliment', 'algoculture'].includes(activeUnit.type)) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 rounded-xl text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('feeding_management_title')}</h2>
              <p className="text-orange-100 text-sm sm:text-base">{t('unit')}: {activeUnit.name}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProductionUnitSelector />
          </div>
        </div>
        
        <div className="text-center py-12">
          <Utensils className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {t('no_feeding_required')}
          </h3>
          <p className="text-gray-500">
            {t('units_not_needing_feeding')}
          </p>
        </div>
      </div>
    );
  }

  const handleSaveFeedingRecord = async (record: any) => {
    try {
      await createRecord({
        unit_id: activeUnit.id,
        cycle_id: activeCycle?.id || record.cycle_id,
        infrastructure_id: record.infrastructure_id,
        date: record.date,
        time: record.time,
        feed_type: record.feed_type,
        quantity: record.quantity,
        temperature: record.temperature || undefined,
        notes: record.notes || undefined,
        behavior: record.behavior || undefined,
        // Nouveaux champs pour les sessions détaillées
        session_type: record.session_type,
        feeder_name: record.feeder_name,
        prescribed_quantity: record.prescribed_quantity,
        actual_quantity: record.actual_quantity,
        remaining_quantity: record.remaining_quantity,
        mortality: record.mortality,
      });

      // Déduire du stock d'aliment
      const quantityUsed = record.quantity || record.actual_quantity || 0;
      const feedType = record.feed_type;
      if (quantityUsed > 0 && feedType) {
        // Trouver le stock correspondant au type d'aliment
        const matchingStock = stocks.find(s => 
          s.feed_type === feedType || 
          s.custom_name === feedType
        );
        
        if (matchingStock && matchingStock.quantity >= quantityUsed) {
          // Mettre à jour le stock
          const newQuantity = matchingStock.quantity - quantityUsed;
          await supabase
            .from('feed_stocks')
            .update({ quantity: newQuantity })
            .eq('id', matchingStock.id);
          
          // Créer une alerte de sortie d'aliment
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await createNotification({
              userId: user.id,
              title: 'Sortie d\'aliment',
              message: `${quantityUsed} ${matchingStock.unit} de ${feedType} utilisé. Stock restant: ${newQuantity.toFixed(1)} ${matchingStock.unit}`,
              type: 'info',
              module: activeUnit.type === 'algoculture' ? 'Intrants' : 'Alimentation',
              isCritical: false,
              metadata: {
                feedType: feedType,
                quantityUsed,
                remainingStock: newQuantity,
                unitId: activeUnit.id
              }
            });
            
            if (newQuantity <= (matchingStock.min_threshold || 50)) {
              await createNotification({
                userId: user.id,
                title: 'Stock d\'aliment bas',
                message: `Le stock de ${feedType} est bas (${newQuantity.toFixed(1)} ${matchingStock.unit}). Seuil minimum: ${matchingStock.min_threshold || 50}`,
                type: 'warning',
                module: activeUnit.type === 'algoculture' ? 'Intrants' : 'Alimentation',
                isCritical: newQuantity <= 0,
                metadata: {
                  feedType: feedType,
                  currentStock: newQuantity,
                  threshold: matchingStock.min_threshold || 50
                }
              });
            }
          }
          
          toast({
            title: 'Stock mis à jour',
            description: `${quantityUsed} kg déduit du stock. Reste: ${newQuantity.toFixed(1)} ${matchingStock.unit}`,
          });
        } else if (matchingStock && matchingStock.quantity < quantityUsed) {
          toast({
            title: 'Attention',
            description: `Stock insuffisant pour ${feedType}. Stock actuel: ${matchingStock.quantity} ${matchingStock.unit}`,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error saving feeding record:', error);
    }
  };

  const handleEditRecord = async (record: any) => {
    try {
      await updateRecord(record.id, {
        date: record.date,
        time: record.time,
        feed_type: record.feed_type,
        quantity: record.quantity,
        temperature: record.temperature || undefined,
        notes: record.notes || undefined,
        behavior: record.behavior || undefined,
        session_type: record.session_type,
        feeder_name: record.feeder_name,
        prescribed_quantity: record.prescribed_quantity,
        actual_quantity: record.actual_quantity,
        remaining_quantity: record.remaining_quantity,
        mortality: record.mortality,
      });
      
      toast({
        title: 'Fiche mise à jour',
        description: 'Les modifications ont été enregistrées',
      });
    } catch (error) {
      console.error('Error updating feeding record:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour la fiche',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await deleteRecord(id);
    } catch (error) {
      console.error('Error deleting feeding record:', error);
    }
  };

  const handleStockUpdate = (stocks: any[]) => {
    console.log('Stocks updated:', stocks);
  };

  const handlePlanUpdate = (plans: any[]) => {
    console.log('Plans updated:', plans);
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur d'unité */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">{feedingData.title}</h2>
            <p className="text-orange-100 text-sm sm:text-base">{feedingData.subtitle}</p>
            <div className="mt-2 flex flex-wrap items-center space-x-4 text-xs sm:text-sm">
              <span>Unité: {activeUnit.name}</span>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {activeUnit.type.charAt(0).toUpperCase() + activeUnit.type.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="mt-4 sm:mt-0">
            <SimpleFeedingForm 
              unitId={activeUnit.id}
              unitName={activeUnit.name}
              cycleId={activeCycle?.id}
              onSave={handleSaveFeedingRecord}
            />
          </div>
        </div>
        
        <ProductionUnitSelector />
      </div>

      {/* Métriques d'alimentation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{feedingData.dailyQuantity}</p>
            <p className="text-xs sm:text-sm text-gray-600">{unitTerms.feedingDailyQuantityLabel}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold">{feedingData.feedingTimes}</p>
            <p className="text-xs sm:text-sm text-gray-600">{unitTerms.feedingSessionsLabel}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <p className="text-sm sm:text-xl font-bold">{feedingData.lastFeeding}</p>
            <p className="text-xs sm:text-sm text-gray-600">{unitTerms.feedingLastLabel}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <p className="text-sm sm:text-xl font-bold">{feedingData.nextFeeding}</p>
            <p className="text-xs sm:text-sm text-gray-600">{unitTerms.feedingNextLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Onglets pour les détails */}
      <Tabs value={feedingTab} onValueChange={setFeedingTab} className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2">
          <TabsList className="w-full grid grid-cols-2 sm:inline-flex sm:w-auto gap-1">
            <TabsTrigger value="history" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              <History className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Historique</span>
              <span className="sm:hidden">Hist.</span>
            </TabsTrigger>
            {unitTerms.features.feedingSheets && (
              <TabsTrigger value="sheets" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Fiches</span>
                <span className="sm:hidden">Fiches</span>
              </TabsTrigger>
            )}
            {unitTerms.features.feedingPlanning && (
              <TabsTrigger value="planning" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Planification</span>
                <span className="sm:hidden">Plan.</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="stock" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{unitTerms.features.feedingSheets ? 'Stock aliment' : 'Stock intrants'}</span>
              <span className="sm:hidden">Stock</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              <Bell className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Alertes</span>
              <span className="sm:hidden">Alert.</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Suivi graphique</span>
              <span className="sm:hidden">Graph.</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sheets" className="space-y-4">
          <FeedingSheetsManager unitId={activeUnit.id} unitName={activeUnit.name} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Export button for feeding history */}
          {unitRecords.length > 0 && (
            <div className="flex justify-end">
              <ExportDropdown
                options={{
                  title: unitTerms.feedingHistoryTitle,
                  subtitle: `Période: ${new Date().toLocaleDateString('fr-FR')}`,
                  filename: `historique-nourrissage-${activeUnit.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`,
                  unitName: activeUnit.name,
                  companyName: 'AquaPilot',
                  columns: [
                    { key: 'date', label: 'Date' },
                    { key: 'time', label: 'Heure', format: (v) => v || '-' },
                    { key: 'feed_type', label: unitTerms.feedLabel, format: (v) => v || '-' },
                    { key: 'quantity', label: 'Quantité (kg)' },
                    { key: 'temperature', label: 'Température (°C)', format: (v) => v ? `${v}°C` : '-' },
                    { key: 'behavior', label: 'Comportement', format: (v) => v || '-' },
                    { key: 'notes', label: 'Notes', format: (v) => v || '-' },
                  ],
                  data: unitRecords,
                }}
                label="Télécharger"
              />
            </div>
          )}
          
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center">
                Chargement des enregistrements...
              </CardContent>
            </Card>
          ) : (
            <DailyFeedingSummary
              records={unitRecords}
              unitName={activeUnit.name}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
            />
          )}
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <FeedingPlanScheduler
            unitId={activeUnit.id}
            unitName={activeUnit.name}
            cycleId={activeCycle?.id}
            cycleName={activeCycle?.name || 'Aucun cycle actif'}
          />
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <FeedStockManager
            unitId={activeUnit.id}
            onStockUpdate={handleStockUpdate}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className={lowStockItems.length > 0 ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/20' : ''}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-md bg-amber-500/10 text-amber-600">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">Alertes stock aliment</p>
                    <p className="text-xs text-muted-foreground truncate">{lowStockItems.length} aliment(s) sous seuil</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setFeedingTab('stock')}>Stock</Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-semibold text-sm">Nourrissage</p>
                  <p className="text-xs text-muted-foreground">{feedingData.feedingTimes} repas enregistrés aujourd’hui</p>
                </div>
              </CardContent>
            </Card>
          </div>
          {lowStockItems.length > 0 && (
            <Card className="border-amber-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4 text-amber-600" /> Stocks à réapprovisionner</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {lowStockItems.map((stock) => (
                  <div key={stock.id} className="rounded-md border bg-card p-3 text-sm">
                    <p className="font-medium truncate">{stock.custom_name || stock.feed_type}</p>
                    <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                      <span>{stock.quantity} {stock.unit}</span>
                      <Badge variant="outline">Seuil {stock.min_threshold || 50}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <SmartAlerts
            unitId={activeUnit.id}
            data={{
              unitName: activeUnit.name,
              feedingEfficiency: feedingRecords.length > 0 ? Math.max(1, Number((feedingData.feedingTimes || 1)) / Math.max(1, lowStockItems.length + 1)) : undefined,
            }}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <FeedingAnalyticsDashboard
            records={unitRecords}
            stocks={stocks}
            infrastructures={infrastructures}
            cycles={cycles}
            unitName={activeUnit.name}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedingManagement;
