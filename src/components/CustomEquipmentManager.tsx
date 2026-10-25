
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { COMMERCIAL_INFRASTRUCTURE_TYPES } from '@/lib/commercialInfrastructure';

const CustomEquipmentManager = () => {
  const { activeUnit, getUnitEquipment, addEquipment, updateEquipment } = useProductionUnits();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    specifications: {} as Record<string, string>
  });

  const unitEquipment = activeUnit ? getUnitEquipment(activeUnit.id) : [];

  const getEquipmentTypesForUnit = () => {
    if (!activeUnit) return [];

    switch (activeUnit.type) {
      case 'commercialisation':
        return [...COMMERCIAL_INFRASTRUCTURE_TYPES, { value: 'autre', label: 'Autre équipement / matériel' }];
      case 'transformation':
        return [
          { value: 'four_electrique', label: 'Four Électrique' },
          { value: 'machine_decoupe', label: 'Machine de Découpe' },
          { value: 'balance_industrielle', label: 'Balance Industrielle' },
          { value: 'emballeuse', label: 'Machine d\'Emballage' }
        ];
      
      case 'conservation':
        return [
          { value: 'chambre_froide_positive', label: 'Chambre Froide Positive (0-4°C)' },
          { value: 'chambre_froide_negative', label: 'Chambre Froide Négative (-18°C)' },
          { value: 'frigo_standard', label: 'Frigo Standard' },
          { value: 'congelateur', label: 'Congélateur' }
        ];
      
      case 'fabrication_aliment':
        return [
          { value: 'melangeur', label: 'Mélangeur' },
          { value: 'broyeur', label: 'Broyeur' },
          { value: 'extrudeur', label: 'Extrudeur' },
          { value: 'sechoir', label: 'Séchoir' }
        ];

      case 'algoculture':
        return [
          { value: 'bassin_raceway', label: 'Bassin raceway' },
          { value: 'photobioreacteur', label: 'Photobioréacteur' },
          { value: 'pompe', label: 'Pompe de circulation' },
          { value: 'aerateur', label: 'Aérateur / injection CO₂' },
          { value: 'filtre', label: 'Système de filtration' },
          { value: 'recolteuse', label: 'Équipement de récolte' },
          { value: 'sechoir_algues', label: 'Séchoir à algues' },
          { value: 'broyeur_algues', label: 'Broyeur / transformation' },
          { value: 'autre', label: 'Autre' }
        ];
      
      
      default:
        return [
          { value: 'pompe', label: 'Pompe' },
          { value: 'aerateur', label: 'Aérateur' },
          { value: 'filtre', label: 'Système de Filtration' },
          { value: 'autre', label: 'Autre' }
        ];
    }
  };

  const getSpecificationFields = (equipmentType: string) => {
    switch (equipmentType) {
      case 'four_electrique':
        return [
          { key: 'power', label: 'Puissance (kW)', placeholder: '15' },
          { key: 'capacity', label: 'Capacité (kg/h)', placeholder: '500' },
          { key: 'temperature_max', label: 'Température Max (°C)', placeholder: '200' }
        ];
      
      case 'chambre_froide_positive':
      case 'chambre_froide_negative':
        return [
          { key: 'temperature', label: 'Température', placeholder: '0-4°C' },
          { key: 'capacity', label: 'Capacité (kg)', placeholder: '2000' },
          { key: 'humidity', label: 'Humidité (%)', placeholder: '85' }
        ];
      
      case 'melangeur':
        return [
          { key: 'capacity', label: 'Capacité (kg)', placeholder: '1000' },
          { key: 'power', label: 'Puissance (kW)', placeholder: '10' },
          { key: 'mixing_time', label: 'Temps mélange (min)', placeholder: '15' }
        ];
      
      default:
        return [
          { key: 'capacity', label: 'Capacité', placeholder: 'Capacité' },
          { key: 'power', label: 'Puissance', placeholder: 'Puissance' }
        ];
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!activeUnit || !formData.name.trim() || !formData.type) { setSaveError('Indiquez le nom et le type du matériel.'); return; }
    setSaving(true); setSaveError('');

    const equipmentData = {
      name: formData.name,
      type: formData.type,
      unitId: activeUnit.id,
      status: formData.status,
      specifications: formData.specifications
    };

    try {
    if (editingEquipment) {
      await updateEquipment(editingEquipment, equipmentData);
      setEditingEquipment(null);
    } else {
      await addEquipment(equipmentData);
    }

    setFormData({
      name: '',
      type: '',
      status: 'active',
      specifications: {}
    });
    setShowAddDialog(false);
    } catch { setSaveError('Le matériel n’a pas pu être enregistré. Vos saisies sont conservées.'); }
    finally { setSaving(false); }
  };

  const handleEdit = (equipment: any) => {
    setFormData({
      name: equipment.name,
      type: equipment.type,
      status: equipment.status,
      specifications: equipment.specifications || {}
    });
    setEditingEquipment(equipment.id);
    setShowAddDialog(true);
  };

  if (!activeUnit) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Sélectionnez une unité pour gérer ses équipements</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Équipements et matériel</h3>
          <p className="text-sm text-gray-600">
            {activeUnit.name} - Gérez vos équipements spécifiques
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter Équipement
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEquipment ? 'Modifier' : 'Ajouter'} un Équipement
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="equipment-name">Nom de l'équipement</Label>
                <Input
                  id="equipment-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Four électrique principal"
                />
              </div>
              
              <div>
                <Label htmlFor="equipment-type">Type d'équipement</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData({...formData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {getEquipmentTypesForUnit().map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="equipment-status">Statut</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: 'active' | 'maintenance' | 'inactive') => 
                    setFormData({...formData, status: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="maintenance">En maintenance</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Champs de spécifications dynamiques */}
              {formData.type && (
                <div className="space-y-3">
                  <Label>Spécifications</Label>
                  {getSpecificationFields(formData.type).map((field) => (
                    <div key={field.key}>
                      <Label htmlFor={field.key} className="text-xs">
                        {field.label}
                      </Label>
                      <Input
                        id={field.key}
                        placeholder={field.placeholder}
                        value={formData.specifications[field.key] || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          specifications: {
                            ...formData.specifications,
                            [field.key]: e.target.value
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? 'Enregistrement…' : `${editingEquipment ? 'Modifier' : 'Ajouter'} le matériel`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {unitEquipment.length > 0 ? (
          unitEquipment.map((equipment) => (
            <Card key={equipment.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{equipment.name}</h4>
                      <Badge 
                        variant={equipment.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {equipment.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 capitalize mb-2">
                      {equipment.type.replace('_', ' ')}
                    </p>
                    
                    {equipment.specifications && Object.keys(equipment.specifications).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(equipment.specifications).map(([key, value]) => (
                          <span 
                            key={key} 
                            className="inline-block bg-gray-100 rounded px-2 py-1 text-xs"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(equipment)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h4 className="font-medium mb-2">Aucun équipement configuré</h4>
              <p className="text-sm text-gray-600 mb-4">
                Ajoutez des équipements spécifiques à votre unité {activeUnit.name}
              </p>
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter le premier équipement
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CustomEquipmentManager;
