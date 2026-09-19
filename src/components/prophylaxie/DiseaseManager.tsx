import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  AlertTriangle, 
  Camera,
  Wifi,
  Edit,
  Trash2,
  Fish,
  Activity
} from 'lucide-react';
import { getUnitTerms } from '@/lib/unitContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLogs } from '@/contexts/LogsContext';
import { useToast } from '@/hooks/use-toast';

interface Disease {
  id: string;
  name: string;
  species: string[];
  symptoms: string[];
  treatment: string;
  severity: 'low' | 'medium' | 'high';
  source: 'manual' | 'iot' | 'camera';
  unitId: string;
  detectedDate: string;
  status: 'active' | 'treated' | 'resolved';
  notes: string;
}

const DiseaseManager = () => {
  const { units, activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);
  const { addLog } = useLogs();
  const { toast } = useToast();
  
  const [showDialog, setShowDialog] = useState(false);
  const [diseases, setDiseases] = useState<Disease[]>([]);

  const [newDisease, setNewDisease] = useState({
    name: '',
    species: [] as string[],
    symptoms: [] as string[],
    treatment: '',
    severity: 'medium' as Disease['severity'],
    source: 'manual' as Disease['source'],
    unitId: activeUnit?.id || '',
    notes: ''
  });

  const [symptomInput, setSymptomInput] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);

  const fishSpecies = [...unitTerms.speciesOptions, 'Autre'];

  const commonDiseases = unitTerms.commonDiseasePresets;

  const handleAddSymptom = () => {
    if (symptomInput.trim() && !newDisease.symptoms.includes(symptomInput.trim())) {
      setNewDisease(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, symptomInput.trim()]
      }));
      setSymptomInput('');
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setNewDisease(prev => ({
      ...prev,
      symptoms: prev.symptoms.filter(s => s !== symptom)
    }));
  };

  const handleSpeciesChange = (species: string) => {
    const updated = selectedSpecies.includes(species)
      ? selectedSpecies.filter(s => s !== species)
      : [...selectedSpecies, species];
    setSelectedSpecies(updated);
    setNewDisease(prev => ({ ...prev, species: updated }));
  };

  const handleSelectCommonDisease = (disease: typeof commonDiseases[0]) => {
    setNewDisease(prev => ({
      ...prev,
      name: disease.name,
      symptoms: disease.symptoms,
      treatment: disease.treatment
    }));
  };

  const handleSaveDisease = () => {
    if (!newDisease.name || newDisease.species.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez renseigner le nom et au moins une espèce",
        variant: "destructive"
      });
      return;
    }

    const disease: Disease = {
      id: Date.now().toString(),
      ...newDisease,
      detectedDate: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    setDiseases(prev => [disease, ...prev]);
    addLog('Maladie enregistrée', 'Prophylaxie', `${disease.name} ajoutée`, 'warning');
    
    toast({
      title: "Maladie enregistrée",
      description: `${disease.name} a été ajoutée au registre`
    });

    // Reset form
    setNewDisease({
      name: '',
      species: [],
      symptoms: [],
      treatment: '',
      severity: 'medium',
      source: 'manual',
      unitId: activeUnit?.id || '',
      notes: ''
    });
    setSelectedSpecies([]);
    setShowDialog(false);
  };

  const handleDeleteDisease = (id: string) => {
    setDiseases(prev => prev.filter(d => d.id !== id));
    toast({
      title: "Maladie supprimée",
      description: "La maladie a été retirée du registre"
    });
  };

  const handleUpdateStatus = (id: string, status: Disease['status']) => {
    setDiseases(prev => prev.map(d => 
      d.id === id ? { ...d, status } : d
    ));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'camera': return <Camera className="w-4 h-4" />;
      case 'iot': return <Wifi className="w-4 h-4" />;
      default: return <Edit className="w-4 h-4" />;
    }
  };

  const filteredDiseases = diseases.filter(d => 
    !activeUnit || d.unitId === activeUnit.id
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Gestion des {unitTerms.healthDiseasesTabLabel.toLowerCase()}s</h3>
          <p className="text-sm text-muted-foreground">
            Enregistrez et suivez les {unitTerms.healthDiseasesTabLabel.toLowerCase()}s par espèce
          </p>
        </div>
        
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une entrée
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enregistrer une {unitTerms.healthDiseasesTabLabel.toLowerCase()}</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="manual" className="space-y-4">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="manual">Saisie manuelle</TabsTrigger>
                <TabsTrigger value="predefined">{unitTerms.healthDiseasesTabLabel} courantes</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Désignation</Label>
                    <Input
                      value={newDisease.name}
                      onChange={(e) => setNewDisease(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Ichtyophthirius"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Espèces concernées</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {fishSpecies.map(species => (
                        <Badge
                          key={species}
                          variant={selectedSpecies.includes(species) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => handleSpeciesChange(species)}
                        >
                          {activeUnit?.type === 'algoculture' ? <Leaf className="w-3 h-3 mr-1" /> : <Fish className="w-3 h-3 mr-1" />}
                          {species}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label>Symptômes</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={symptomInput}
                        onChange={(e) => setSymptomInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddSymptom()}
                        placeholder="Ajouter un symptôme"
                      />
                      <Button type="button" size="sm" onClick={handleAddSymptom}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newDisease.symptoms.map(symptom => (
                        <Badge key={symptom} variant="secondary" className="cursor-pointer">
                          {symptom}
                          <button
                            onClick={() => handleRemoveSymptom(symptom)}
                            className="ml-2 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label>Traitement recommandé</Label>
                    <Textarea
                      value={newDisease.treatment}
                      onChange={(e) => setNewDisease(prev => ({ ...prev, treatment: e.target.value }))}
                      placeholder="Décrivez le traitement recommandé"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Gravité</Label>
                    <Select 
                      value={newDisease.severity} 
                      onValueChange={(value: Disease['severity']) => 
                        setNewDisease(prev => ({ ...prev, severity: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Élevée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Source de détection</Label>
                    <Select 
                      value={newDisease.source} 
                      onValueChange={(value: Disease['source']) => 
                        setNewDisease(prev => ({ ...prev, source: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Saisie manuelle</SelectItem>
                        <SelectItem value="camera">Détection caméra</SelectItem>
                        <SelectItem value="iot">Détection IoT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={newDisease.notes}
                      onChange={(e) => setNewDisease(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes supplémentaires..."
                      rows={2}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveDisease} className="w-full">
                  Enregistrer
                </Button>
              </TabsContent>

              <TabsContent value="predefined" className="space-y-3">
                {commonDiseases.map((disease, idx) => (
                  <Card 
                    key={idx} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleSelectCommonDisease(disease)}
                  >
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">{disease.name}</h4>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="font-medium">Symptômes:</span>
                          <p className="text-muted-foreground">{disease.symptoms.join(', ')}</p>
                        </div>
                        <div>
                          <span className="font-medium">Traitement:</span>
                          <p className="text-muted-foreground">{disease.treatment}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des maladies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDiseases.map(disease => (
          <Card key={disease.id} className={`border-l-4 ${
            disease.severity === 'high' ? 'border-l-red-500' :
            disease.severity === 'medium' ? 'border-l-orange-500' :
            'border-l-yellow-500'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base mb-2">{disease.name}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {disease.species.map(species => (
                      <Badge key={species} variant="outline" className="text-xs">
                        {activeUnit?.type === 'algoculture' ? <Leaf className="w-3 h-3 mr-1" /> : <Fish className="w-3 h-3 mr-1" />}
                        {species}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className={getSeverityColor(disease.severity)}>
                    {disease.severity === 'high' ? 'Élevée' :
                     disease.severity === 'medium' ? 'Moyenne' : 'Faible'}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Symptômes:</div>
                <div className="flex flex-wrap gap-1">
                  {disease.symptoms.map((symptom, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {symptom}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Traitement:</div>
                <p className="text-sm">{disease.treatment}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {getSourceIcon(disease.source)}
                  <span>
                    {disease.source === 'manual' ? 'Manuel' :
                     disease.source === 'camera' ? 'Caméra' : 'IoT'}
                  </span>
                </div>
                <span>Détecté le {new Date(disease.detectedDate).toLocaleDateString('fr-FR')}</span>
              </div>

              {disease.notes && (
                <div className="text-xs bg-muted p-2 rounded">
                  <span className="font-medium">Notes:</span> {disease.notes}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Select
                  value={disease.status}
                  onValueChange={(value: Disease['status']) => handleUpdateStatus(disease.id, value)}
                >
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="treated">Traitée</SelectItem>
                    <SelectItem value="resolved">Résolue</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDeleteDisease(disease.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDiseases.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucune maladie enregistrée</h3>
            <p className="text-muted-foreground mb-4">
              Commencez par ajouter une maladie détectée
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une entrée
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DiseaseManager;
