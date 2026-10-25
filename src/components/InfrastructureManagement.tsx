import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building, Settings, Activity, Thermometer, MapPin, Calendar, Wrench } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import InfrastructureForm from './infrastructure/InfrastructureForm';
import InfrastructureCard from './infrastructure/InfrastructureCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getInfrastructureTypeLabel as getInfraLabel } from '@/lib/unitContext';

// Composant pour programmer la maintenance
const MaintenanceScheduleForm = ({ infrastructure }: { infrastructure: any }) => {
  const { updateInfrastructure } = useProductionUnits();
  const { toast } = useToast();
  const { t } = useSettings();
  const [nextDate, setNextDate] = useState(infrastructure.nextMaintenanceDate || '');
  const [frequency, setFrequency] = useState(infrastructure.maintenanceFrequencyDays?.toString() || '30');
  const [notes, setNotes] = useState(infrastructure.maintenanceNotes || '');

  const handleSave = async () => {
    await updateInfrastructure(infrastructure.id, {
      nextMaintenanceDate: nextDate || undefined,
      maintenanceFrequencyDays: parseInt(frequency) || undefined,
      maintenanceNotes: notes || undefined,
      lastMaintenanceDate: infrastructure.lastMaintenanceDate
    });
    toast({ title: t('success'), description: `${t('maintenance')} ${nextDate}` });
  };

  const handleMarkComplete = async () => {
    const today = new Date().toISOString().split('T')[0];
    const nextMaintDate = new Date();
    nextMaintDate.setDate(nextMaintDate.getDate() + (parseInt(frequency) || 30));
    
    await updateInfrastructure(infrastructure.id, {
      lastMaintenanceDate: today,
      nextMaintenanceDate: nextMaintDate.toISOString().split('T')[0],
      maintenanceFrequencyDays: parseInt(frequency) || 30
    });
    toast({ title: t('success'), description: t('maintenance') });
  };

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>{t('start_date')}</Label>
        <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
      </div>
      <div>
        <Label>{t('days')}</Label>
        <Input type="number" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="30" />
      </div>
      <div>
        <Label>{t('notes_label')}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">{t('save')}</Button>
        <Button variant="outline" onClick={handleMarkComplete}>{t('completed')}</Button>
      </div>
    </div>
  );
};

const InfrastructureManagement = () => {
  const { activeUnit, getUnitInfrastructures } = useProductionUnits();
  const { t } = useSettings();

  const handleInfrastructureSave = (infrastructure: any) => {
    console.log('Infrastructure saved:', infrastructure);
    // The form component already handles the saving logic
  };

  if (!activeUnit) {
    return (
      <div className="space-y-4 sm:space-y-6 p-2 sm:p-0">
        <div className="text-center py-8 sm:py-12 px-4">
          <Building className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-600 mb-2">
            {t('no_unit_selected')}
          </h3>
          <p className="text-sm sm:text-base text-gray-500">
            {t('select_production_unit')}
          </p>
        </div>
      </div>
    );
  }

  const infrastructures = getUnitInfrastructures(activeUnit.id);

  const getInfrastructureIcon = (type: string) => {
    if (type.includes('bassin')) return Activity;
    if (type.includes('chambre')) return Thermometer;
    return Building;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInfrastructureTypeLabel = (type: string) =>
    getInfraLabel(type, activeUnit.type);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* En-tête spécifique à l'unité */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-4 sm:p-6 rounded-lg sm:rounded-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 truncate">
              {t('infrastructures')} - {activeUnit.name}
            </h2>
            <p className="text-gray-100 text-sm sm:text-base">
              {t('infrastructure_management_desc')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
              <span className="truncate">
                {t('type')}: {activeUnit.type.charAt(0).toUpperCase() + activeUnit.type.slice(1)}
              </span>
              <Badge variant="secondary" className="bg-white/20 text-white text-xs sm:text-sm">
                {infrastructures.length} {t('infrastructures').toLowerCase()}
              </Badge>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <InfrastructureForm onSave={handleInfrastructureSave} />
          </div>
        </div>
      </div>

      {/* Statistiques des infrastructures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Building className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 flex-shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-bold truncate">{infrastructures.length}</p>
            <p className="text-xs sm:text-sm text-gray-600">{t('total')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-bold truncate">
              {infrastructures.filter(i => i.status === 'active').length}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">{t('active')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
            </div>
            <p className="text-xl sm:text-2xl font-bold truncate">
              {infrastructures.filter(i => i.status === 'maintenance').length}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">{t('maintenance')}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Thermometer className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-bold truncate">
              {infrastructures.reduce((sum, i) => sum + i.capacity, 0).toLocaleString()}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">{t('capacity')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des infrastructures */}
      <Tabs defaultValue="list" className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className="w-full sm:w-auto inline-flex">
            <TabsTrigger value="list" className="text-xs sm:text-sm px-2 sm:px-3">
              Liste complète
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs sm:text-sm px-2 sm:px-3">
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs sm:text-sm px-2 sm:px-3">
              Maintenance
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="space-y-4">
          {infrastructures.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {infrastructures.map((infrastructure) => (
                <InfrastructureCard key={infrastructure.id} infrastructure={infrastructure} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Building className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                Aucune infrastructure configurée
              </h3>
              <p className="text-gray-500 mb-4">
                Ajoutez des infrastructures pour l'unité {activeUnit.name}
              </p>
              <InfrastructureForm onSave={handleInfrastructureSave} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Monitoring en temps réel</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {infrastructures.filter(i => i.status === 'active').map((infrastructure) => (
                  <div key={infrastructure.id} className="p-3 sm:p-4 border rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                      <h4 className="font-medium text-sm sm:text-base truncate">
                        {infrastructure.name}
                      </h4>
                      <Badge variant="outline" className="w-fit text-xs sm:text-sm">
                        En ligne
                      </Badge>
                    </div>
                    
                    {infrastructure.specifications && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                        {Object.entries(infrastructure.specifications).filter(([key, value]) => !['depreciation', 'depreciationAssetId'].includes(key) && (typeof value === 'string' || typeof value === 'number')).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-2 min-w-0">
                            <span className="text-gray-600 truncate">{key}:</span>
                            <span className="font-medium truncate">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Wrench className="w-5 h-5" />
                Planning de maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {infrastructures.map((infrastructure) => {
                  const nextMaintenance = infrastructure.nextMaintenanceDate;
                  const isOverdue = nextMaintenance && new Date(nextMaintenance) < new Date();
                  
                  return (
                    <div key={infrastructure.id} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border rounded-lg ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base truncate flex items-center gap-2">
                          {infrastructure.name}
                          {isOverdue && <Badge variant="destructive" className="text-xs">En retard</Badge>}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          {getInfrastructureTypeLabel(infrastructure.type)}
                        </p>
                        {nextMaintenance && (
                          <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Prochaine maintenance: {new Date(nextMaintenance).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {infrastructure.lastMaintenanceDate && (
                          <p className="text-xs text-muted-foreground">
                            Dernière: {new Date(infrastructure.lastMaintenanceDate).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${getStatusColor(infrastructure.status)} text-xs sm:text-sm`}>
                          {infrastructure.status}
                        </Badge>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-xs sm:text-sm">
                              <Settings className="w-3 h-3 mr-1" />
                              Programmer
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Programmer maintenance - {infrastructure.name}</DialogTitle>
                            </DialogHeader>
                            <MaintenanceScheduleForm infrastructure={infrastructure} />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InfrastructureManagement;
