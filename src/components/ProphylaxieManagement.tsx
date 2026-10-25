import React, { useState } from 'react';
import { getUnitTerms } from '@/lib/unitContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { 
  Heart, 
  AlertTriangle, 
  Plus,
  Calendar as CalendarIcon,
  Syringe,
  Shield,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Wifi,
  Brain,
  Activity
} from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLogs } from '@/contexts/LogsContext';
import IoTModeAnalysis from './prophylaxie/IoTModeAnalysis';
import ReportGenerator from './prophylaxie/ReportGenerator';
import DiseaseManager from './prophylaxie/DiseaseManager';
import CheptelSante from './prophylaxie/CheptelSante';

interface Treatment {
  id: string;
  date: string;
  unitId: string;
  type: 'vaccination' | 'treatment' | 'disinfection';
  product: string;
  dosage: string;
  lot: string;
  operator: string;
  notes: string;
  status: 'planned' | 'completed' | 'cancelled';
}

interface HealthAlert {
  id: string;
  date: string;
  unitId: string;
  severity: 'low' | 'medium' | 'high';
  type: string;
  description: string;
  status: 'active' | 'resolved';
}

const ProphylaxieManagement = () => {
  const { units, activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);
  const isAlgae = activeUnit?.type === 'algoculture';
  const { addLog } = useLogs();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [showTreatmentDialog, setShowTreatmentDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [showIoTDialog, setShowIoTDialog] = useState(false);

  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [alerts, setAlerts] = useState<HealthAlert[]>([]);

  const [newTreatment, setNewTreatment] = useState({
    unitId: activeUnit?.id || '',
    type: 'treatment' as Treatment['type'],
    product: '',
    dosage: '',
    lot: '',
    operator: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSaveTreatment = () => {
    const treatment: Treatment = {
      id: Date.now().toString(),
      ...newTreatment,
      status: 'planned'
    };

    setTreatments(prev => [treatment, ...prev]);
    addLog('Traitement ajouté', 'Prophylaxie', `${treatment.type} planifié pour ${treatment.unitId}`, 'info');
    
    setNewTreatment({
      unitId: activeUnit?.id || '',
      type: 'treatment',
      product: '',
      dosage: '',
      lot: '',
      operator: '',
      notes: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowTreatmentDialog(false);
  };

  const toggleTreatmentStatus = (id: string) => {
    setTreatments(prev => prev.map(t => 
      t.id === id 
        ? { ...t, status: t.status === 'completed' ? 'planned' : 'completed' as Treatment['status'] }
        : t
    ));
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'resolved' as const } : a
    ));
    addLog('Alerte résolue', 'Prophylaxie', 'Une alerte sanitaire a été marquée comme résolue', 'success');
  };

  const filteredTreatments = selectedUnitFilter === 'all' 
    ? treatments 
    : treatments.filter(t => t.unitId === selectedUnitFilter);

  const filteredAlerts = selectedUnitFilter === 'all' 
    ? alerts 
    : alerts.filter(a => a.unitId === selectedUnitFilter);

  const getTypeIcon = (type: Treatment['type']) => {
    switch (type) {
      case 'vaccination':
        return <Syringe className="w-4 h-4" />;
      case 'treatment':
        return <Heart className="w-4 h-4" />;
      case 'disinfection':
        return <Shield className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: Treatment['type']) => {
    switch (type) {
      case 'vaccination':
        return 'bg-blue-100 text-blue-800';
      case 'treatment':
        return 'bg-red-100 text-red-800';
      case 'disinfection':
        return 'bg-green-100 text-green-800';
    }
  };

  const getSeverityColor = (severity: HealthAlert['severity']) => {
    switch (severity) {
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'medium':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const upcomingTreatments = treatments
    .filter(t => t.status === 'planned' && new Date(t.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6 p-2 sm:p-0">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-red-500 to-pink-600 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 break-words">
              {unitTerms.healthTitle}
            </h2>
            <p className="text-red-100 text-sm sm:text-base">
              {unitTerms.healthSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs sm:text-sm"
              onClick={() => setShowIoTDialog(true)}
            >
              <Wifi className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Analyser avec IoT
            </Button>
            <Dialog open={showTreatmentDialog} onOpenChange={setShowTreatmentDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs sm:text-sm">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Nouveau traitement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Planifier un traitement</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm">Unité de production</Label>
                  <Select value={newTreatment.unitId} onValueChange={(value) => setNewTreatment(prev => ({ ...prev, unitId: value }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id} className="text-sm">{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Type de traitement</Label>
                  <Select value={newTreatment.type} onValueChange={(value: Treatment['type']) => setNewTreatment(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!isAlgae && <SelectItem value="vaccination" className="text-sm">Vaccination</SelectItem>}
                      <SelectItem value="treatment" className="text-sm">Traitement</SelectItem>
                      <SelectItem value="disinfection" className="text-sm">{isAlgae ? 'Assainissement du milieu' : 'Désinfection'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Date prévue</Label>
                  <Input 
                    type="date"
                    value={newTreatment.date}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, date: e.target.value }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">Produit</Label>
                  <Input 
                    value={newTreatment.product}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, product: e.target.value }))}
                    placeholder="Nom du produit"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">Dosage</Label>
                  <Input 
                    value={newTreatment.dosage}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, dosage: e.target.value }))}
                     placeholder={isAlgae ? 'Ex : 2 g/L pendant 24 h' : 'ex: 0.5 ml/kg'}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">Numéro de lot</Label>
                  <Input 
                    value={newTreatment.lot}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, lot: e.target.value }))}
                    placeholder="LOT-XXXX"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">Opérateur</Label>
                  <Input 
                    value={newTreatment.operator}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, operator: e.target.value }))}
                    placeholder="Nom de l'opérateur"
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">Notes</Label>
                  <Textarea 
                    value={newTreatment.notes}
                    onChange={(e) => setNewTreatment(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Instructions et observations..."
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={handleSaveTreatment} className="w-full text-sm">
                    Enregistrer le traitement
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>

      {/* Filtre */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Label className="flex items-center gap-2 font-medium text-sm sm:text-base flex-shrink-0">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
              Filtrer par unité :
            </Label>
            <Select value={selectedUnitFilter} onValueChange={setSelectedUnitFilter}>
              <SelectTrigger className="w-full sm:w-64 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-sm">Toutes les unités</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.id} className="text-sm">{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="calendar" className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className={`grid h-auto grid-cols-2 gap-1 ${isAlgae ? 'sm:grid-cols-5' : 'sm:grid-cols-6'} w-full min-w-0`}>
            {!isAlgae && <TabsTrigger value="cheptel" className="text-xs sm:text-sm px-1 sm:px-3">
              {unitTerms.healthCheptelTabLabel}
            </TabsTrigger>}
            <TabsTrigger value="calendar" className="text-xs sm:text-sm px-1 sm:px-3">
              Calendrier
            </TabsTrigger>
            <TabsTrigger value="treatments" className="text-xs sm:text-sm px-1 sm:px-3">
              Traitements
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs sm:text-sm px-1 sm:px-3">
              Alertes
              {alerts.filter(a => a.status === 'active').length > 0 && (
                <Badge className="ml-1 sm:ml-2 bg-red-500 text-white text-[10px] sm:text-xs px-1">
                  {alerts.filter(a => a.status === 'active').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="diseases" className="text-xs sm:text-sm px-1 sm:px-3">
              {unitTerms.healthDiseasesTabLabel}
            </TabsTrigger>
            <TabsTrigger value="planning" className="text-xs sm:text-sm px-1 sm:px-3">
              Planning
            </TabsTrigger>
          </TabsList>
        </div>

        {!isAlgae && <TabsContent value="cheptel"><CheptelSante /></TabsContent>}

        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  Calendrier sanitaire
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border w-full"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  Traitements à venir
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="space-y-2 sm:space-y-3">
                  {upcomingTreatments.length === 0 ? (
                    <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                      Aucun traitement planifié
                    </p>
                  ) : (
                    upcomingTreatments.map(treatment => (
                      <div key={treatment.id} className="border rounded-lg p-2 sm:p-3">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {getTypeIcon(treatment.type)}
                            <span className="font-medium text-xs sm:text-sm break-words">
                              {treatment.product}
                            </span>
                          </div>
                          <Badge className={getTypeColor(treatment.type)}>
                            {treatment.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(treatment.date).toLocaleDateString('fr-FR')} • {units.find(u => u.id === treatment.unitId)?.name}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="treatments" className="space-y-4">
          <div className="space-y-3 sm:space-y-4">
            {filteredTreatments.map(treatment => (
              <Card key={treatment.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className={`p-1.5 sm:p-2 rounded-lg ${getTypeColor(treatment.type).replace('text-', 'bg-').replace('800', '100')} flex-shrink-0`}>
                        {getTypeIcon(treatment.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm sm:text-base break-words">
                          {treatment.product}
                        </h4>
                        <p className="text-xs sm:text-sm text-muted-foreground break-words">
                          {new Date(treatment.date).toLocaleDateString('fr-FR')} • {units.find(u => u.id === treatment.unitId)?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`${getTypeColor(treatment.type)} text-xs`}>
                        {treatment.type}
                      </Badge>
                      <Button
                        size="sm"
                        variant={treatment.status === 'completed' ? 'default' : 'outline'}
                        onClick={() => toggleTreatmentStatus(treatment.id)}
                        className="text-xs sm:text-sm"
                      >
                        {treatment.status === 'completed' ? (
                          <><CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Effectué</>
                        ) : (
                          <><Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Planifié</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-muted-foreground">Dosage:</span>
                      <p className="font-medium break-words">{treatment.dosage}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lot:</span>
                      <p className="font-medium break-words">{treatment.lot}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Opérateur:</span>
                      <p className="font-medium break-words">{treatment.operator}</p>
                    </div>
                  </div>
                  {treatment.notes && (
                    <div className="mt-3 p-2 bg-muted rounded text-xs sm:text-sm break-words">
                      <span className="font-medium">Notes: </span>
                      {treatment.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="space-y-3 sm:space-y-4">
            {filteredAlerts.map(alert => (
              <Card key={alert.id} className={`border-l-4 ${alert.severity === 'high' ? 'border-l-red-500' : alert.severity === 'medium' ? 'border-l-orange-500' : 'border-l-yellow-500'}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                      <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${alert.severity === 'high' ? 'text-red-600' : alert.severity === 'medium' ? 'text-orange-600' : 'text-yellow-600'} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm sm:text-base break-words">
                            {alert.type}
                          </h4>
                          <Badge className={`${getSeverityColor(alert.severity)} text-xs`}>
                            {alert.severity === 'high' ? 'Élevé' : alert.severity === 'medium' ? 'Moyen' : 'Faible'}
                          </Badge>
                          {alert.status === 'resolved' && (
                            <Badge className="bg-green-100 text-green-800 text-xs">Résolu</Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2 break-words">
                          {alert.description}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                          {new Date(alert.date).toLocaleDateString('fr-FR')} • {units.find(u => u.id === alert.unitId)?.name}
                        </p>
                      </div>
                    </div>
                    {alert.status === 'active' && (
                      <Button
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                        className="w-full sm:w-auto text-xs sm:text-sm"
                      >
                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        Résoudre
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="text-base sm:text-lg">Planning de prophylaxie par unité</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="space-y-3 sm:space-y-4">
                {units.map(unit => {
                  const unitTreatments = treatments.filter(t => t.unitId === unit.id && t.status === 'planned');
                  return (
                    <div key={unit.id} className="border rounded-lg p-3 sm:p-4">
                      <h4 className="font-medium mb-3 text-sm sm:text-base break-words">{unit.name}</h4>
                      {unitTreatments.length === 0 ? (
                        <p className="text-xs sm:text-sm text-muted-foreground">Aucun traitement planifié</p>
                      ) : (
                        <div className="space-y-2">
                          {unitTreatments.map(treatment => (
                            <div key={treatment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 bg-muted rounded">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {getTypeIcon(treatment.type)}
                                <span className="text-xs sm:text-sm break-words">{treatment.product}</span>
                              </div>
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                {new Date(treatment.date).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="diseases">
          <DiseaseManager />
        </TabsContent>
      </Tabs>

      {/* Génération de rapports */}
      <ReportGenerator />

      {/* Dialog IoT Analysis */}
      <IoTModeAnalysis showDialog={showIoTDialog} onClose={() => setShowIoTDialog(false)} />
    </div>
  );
};

export default ProphylaxieManagement;