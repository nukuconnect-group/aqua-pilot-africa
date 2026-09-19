
import React, { useState } from 'react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { getUnitTerms, isAlgaeUnitType } from '@/lib/unitContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, AlertTriangle, Activity, Calendar, Pill } from 'lucide-react';

interface Disease {
  id: string;
  name: string;
  type: 'bacterial' | 'viral' | 'parasitic' | 'fungal' | 'nutritional';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFish: number;
  unitId: string;
  unitName: string;
  symptoms: string;
  dateDetected: string;
  status: 'active' | 'treated' | 'resolved';
  notes: string;
}

interface Treatment {
  id: string;
  diseaseId: string;
  productName: string;
  productType: 'antibiotic' | 'antifungal' | 'antiparasitic' | 'vaccine' | 'supplement';
  dosage: string;
  applicationMethod: string;
  startDate: string;
  endDate: string;
  frequency: string;
  administeredBy: string;
  notes: string;
  status: 'planned' | 'ongoing' | 'completed';
}

interface Alert {
  id: string;
  type: 'treatment_due' | 'mortality_high' | 'symptoms_detected' | 'follow_up';
  message: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
  unitId: string;
  resolved: boolean;
}

const DiseaseTracker = () => {
  const { activeUnit } = useProductionUnits();
  const isAlgae = isAlgaeUnitType(activeUnit?.type);
  const [diseases, setDiseases] = useState<Disease[]>([]);

  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [showAddDisease, setShowAddDisease] = useState(false);
  const [showAddTreatment, setShowAddTreatment] = useState(false);

  const [newDisease, setNewDisease] = useState({
    name: '',
    type: 'bacterial' as Disease['type'],
    severity: 'medium' as Disease['severity'],
    affectedFish: 0,
    unitId: '',
    unitName: '',
    symptoms: '',
    notes: ''
  });

  const [newTreatment, setNewTreatment] = useState({
    diseaseId: '',
    productName: '',
    productType: 'antibiotic' as Treatment['productType'],
    dosage: '',
    applicationMethod: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    frequency: '',
    administeredBy: '',
    notes: ''
  });

  const addDisease = () => {
    const disease: Disease = {
      id: Date.now().toString(),
      ...newDisease,
      dateDetected: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    setDiseases([...diseases, disease]);
    setNewDisease({
      name: '',
      type: 'bacterial',
      severity: 'medium',
      affectedFish: 0,
      unitId: '',
      unitName: '',
      symptoms: '',
      notes: ''
    });
    setShowAddDisease(false);
  };

  const addTreatment = () => {
    const treatment: Treatment = {
      id: Date.now().toString(),
      ...newTreatment,
      status: 'planned'
    };
    setTreatments([...treatments, treatment]);
    setNewTreatment({
      diseaseId: '',
      productName: '',
      productType: 'antibiotic',
      dosage: '',
      applicationMethod: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      frequency: '',
      administeredBy: '',
      notes: ''
    });
    setShowAddTreatment(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800';
      case 'treated': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="diseases" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="diseases">Maladies</TabsTrigger>
          <TabsTrigger value="treatments">Traitements</TabsTrigger>
          <TabsTrigger value="alerts">Alertes</TabsTrigger>
        </TabsList>

        <TabsContent value="diseases" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-600" />
              Suivi des Maladies
            </h3>
            <Button onClick={() => setShowAddDisease(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Maladie
            </Button>
          </div>

          {showAddDisease && (
            <Card>
              <CardHeader>
                <CardTitle>Déclarer une nouvelle maladie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="diseaseName">Nom de la maladie</Label>
                    <Input
                      id="diseaseName"
                      value={newDisease.name}
                      onChange={(e) => setNewDisease({...newDisease, name: e.target.value})}
                      placeholder="Ex: Infection bactérienne"
                    />
                  </div>

                  <div>
                    <Label htmlFor="diseaseType">Type</Label>
                    <Select 
                      value={newDisease.type} 
                      onValueChange={(value) => setNewDisease({...newDisease, type: value as Disease['type']})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bacterial">Bactérienne</SelectItem>
                        <SelectItem value="viral">Virale</SelectItem>
                        <SelectItem value="parasitic">Parasitaire</SelectItem>
                        <SelectItem value="fungal">Fongique</SelectItem>
                        <SelectItem value="nutritional">Nutritionnelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="diseaseSeverity">Sévérité</Label>
                    <Select 
                      value={newDisease.severity} 
                      onValueChange={(value) => setNewDisease({...newDisease, severity: value as Disease['severity']})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Élevée</SelectItem>
                        <SelectItem value="critical">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="affectedFish">{isAlgae ? 'Quantité affectée (kg)' : 'Poissons affectés'}</Label>
                    <Input
                      id="affectedFish"
                      type="number"
                      value={newDisease.affectedFish}
                      onChange={(e) => setNewDisease({...newDisease, affectedFish: parseInt(e.target.value) || 0})}
                      min="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="unitName">Unité affectée</Label>
                    <Input
                      id="unitName"
                      value={newDisease.unitName}
                      onChange={(e) => setNewDisease({...newDisease, unitName: e.target.value})}
                      placeholder="Nom de l'unité"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="symptoms">Symptômes observés</Label>
                    <Textarea
                      id="symptoms"
                      value={newDisease.symptoms}
                      onChange={(e) => setNewDisease({...newDisease, symptoms: e.target.value})}
                      placeholder="Décrire les symptômes observés..."
                      rows={3}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="diseaseNotes">Notes</Label>
                    <Textarea
                      id="diseaseNotes"
                      value={newDisease.notes}
                      onChange={(e) => setNewDisease({...newDisease, notes: e.target.value})}
                      placeholder="Notes additionnelles..."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={addDisease}>Ajouter</Button>
                  <Button variant="outline" onClick={() => setShowAddDisease(false)}>
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {diseases.map((disease) => (
              <Card key={disease.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-semibold">{disease.name}</h4>
                        <Badge className={getSeverityColor(disease.severity)}>
                          {disease.severity}
                        </Badge>
                        <Badge className={getStatusColor(disease.status)}>
                          {disease.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">{disease.symptoms}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-500">
                        <span>Unité: <strong>{disease.unitName}</strong></span>
                        <span>{isAlgae ? 'Quantité affectée (kg)' : 'Poissons affectés'}: <strong>{disease.affectedFish}</strong></span>
                        <span>Détecté le: <strong>{disease.dateDetected}</strong></span>
                      </div>
                    </div>
                    
                    <Button 
                      size="sm" 
                      onClick={() => {
                        setNewTreatment({...newTreatment, diseaseId: disease.id});
                        setShowAddTreatment(true);
                      }}
                    >
                      <Pill className="w-4 h-4 mr-2" />
                      Traiter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="treatments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Pill className="w-5 h-5 text-blue-600" />
              Traitements Appliqués
            </h3>
            <Button onClick={() => setShowAddTreatment(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Traitement
            </Button>
          </div>

          {showAddTreatment && (
            <Card>
              <CardHeader>
                <CardTitle>Nouveau traitement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="productName">Produit vétérinaire</Label>
                    <Input
                      id="productName"
                      value={newTreatment.productName}
                      onChange={(e) => setNewTreatment({...newTreatment, productName: e.target.value})}
                      placeholder="Nom du médicament"
                    />
                  </div>

                  <div>
                    <Label htmlFor="productType">Type de produit</Label>
                    <Select 
                      value={newTreatment.productType} 
                      onValueChange={(value) => setNewTreatment({...newTreatment, productType: value as Treatment['productType']})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="antibiotic">Antibiotique</SelectItem>
                        <SelectItem value="antifungal">Antifongique</SelectItem>
                        <SelectItem value="antiparasitic">Antiparasitaire</SelectItem>
                        <SelectItem value="vaccine">Vaccin</SelectItem>
                        <SelectItem value="supplement">Complément</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dosage">Dosage</Label>
                    <Input
                      id="dosage"
                      value={newTreatment.dosage}
                      onChange={(e) => setNewTreatment({...newTreatment, dosage: e.target.value})}
                      placeholder="Ex: 50mg/kg"
                    />
                  </div>

                  <div>
                    <Label htmlFor="frequency">Fréquence</Label>
                    <Input
                      id="frequency"
                      value={newTreatment.frequency}
                      onChange={(e) => setNewTreatment({...newTreatment, frequency: e.target.value})}
                      placeholder="Ex: 2 fois par jour"
                    />
                  </div>

                  <div>
                    <Label htmlFor="startDate">Date de début</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newTreatment.startDate}
                      onChange={(e) => setNewTreatment({...newTreatment, startDate: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={newTreatment.endDate}
                      onChange={(e) => setNewTreatment({...newTreatment, endDate: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="administeredBy">Administré par</Label>
                    <Input
                      id="administeredBy"
                      value={newTreatment.administeredBy}
                      onChange={(e) => setNewTreatment({...newTreatment, administeredBy: e.target.value})}
                      placeholder="Nom de la personne"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="applicationMethod">Méthode d'application</Label>
                    <Input
                      id="applicationMethod"
                      value={newTreatment.applicationMethod}
                      onChange={(e) => setNewTreatment({...newTreatment, applicationMethod: e.target.value})}
                      placeholder="Ex: Mélangé à la nourriture"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="treatmentNotes">Notes</Label>
                    <Textarea
                      id="treatmentNotes"
                      value={newTreatment.notes}
                      onChange={(e) => setNewTreatment({...newTreatment, notes: e.target.value})}
                      placeholder="Instructions spéciales..."
                      rows={2}
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={addTreatment}>Ajouter</Button>
                  <Button variant="outline" onClick={() => setShowAddTreatment(false)}>
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {treatments.map((treatment) => (
              <Card key={treatment.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{treatment.productName}</h4>
                        <Badge className={getStatusColor(treatment.status)}>
                          {treatment.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                        <span>Dosage: <strong>{treatment.dosage}</strong></span>
                        <span>Fréquence: <strong>{treatment.frequency}</strong></span>
                        <span>Du {treatment.startDate} au {treatment.endDate}</span>
                        <span>Par: <strong>{treatment.administeredBy}</strong></span>
                      </div>
                      
                      <p className="text-sm text-gray-500">{treatment.applicationMethod}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Alertes Sanitaires
            </h3>
          </div>

          <div className="grid gap-4">
            {alerts.filter(alert => !alert.resolved).map((alert) => (
              <Card key={alert.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPriorityColor(alert.priority)}>
                          {alert.priority}
                        </Badge>
                        <span className="text-sm text-gray-500">{alert.date}</span>
                      </div>
                      <p className="font-medium">{alert.message}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setAlerts(alerts.map(a => 
                          a.id === alert.id ? {...a, resolved: true} : a
                        ));
                      }}
                    >
                      Résoudre
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DiseaseTracker;
