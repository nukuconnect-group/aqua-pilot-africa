import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useProductionUnits, Infrastructure } from '@/contexts/ProductionUnitsContext';
import { useLogs } from '@/contexts/LogsContext';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { getUnitTerms } from '@/lib/unitContext';
import { Switch } from '@/components/ui/switch';
import { validateInfrastructureDepreciation, InfrastructureDepreciationInput } from '@/lib/infrastructureDepreciation';

interface InfrastructureFormProps {
  onSave?: (infrastructure: any) => void;
  infrastructure?: Infrastructure;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

const InfrastructureForm = ({ onSave, infrastructure, onClose, trigger }: InfrastructureFormProps) => {
  const { units, activeUnit, currency, addInfrastructure, updateInfrastructure, infrastructures: allInfrastructures } = useProductionUnits();
  const { addLog } = useLogs();
  const { batches } = useLivestockBatches();
  
  const [showDialog, setShowDialog] = useState(false);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [includeDepreciation, setIncludeDepreciation] = useState(Boolean(infrastructure?.specifications?.depreciation));
  const [depreciation, setDepreciation] = useState<InfrastructureDepreciationInput>(() => infrastructure?.specifications?.depreciation || {
    purchasePrice: 0, purchaseDate: '', usefulLife: 5, currency, method: 'linear',
  });
  
  const [showUnitCreation, setShowUnitCreation] = useState(false);
  const [newUnit, setNewUnit] = useState({
    name: '',
    type: 'grossissement' as any,
    description: ''
  });

  const createEmptyInfrastructure = (unitId = activeUnit?.id || units[0]?.id || '') => ({
    name: '',
    unitId,
    type: '',
    customTypeName: '',
    capacity: 0,
    status: 'active' as 'active' | 'maintenance' | 'inactive',
    suggestedBatchId: '',
    specifications: {
      volume: '',
      profondeur: '',
      materiau: '',
      temperature: '',
      ph: '',
      oxygenLevel: ''
    }
  });

  const [newInfrastructure, setNewInfrastructure] = useState(createEmptyInfrastructure);

  // Initialize form with existing infrastructure data if editing
  useEffect(() => {
    if (infrastructure) {
      setNewInfrastructure({
        name: infrastructure.name,
        unitId: infrastructure.unitId,
        type: infrastructure.type,
        customTypeName: infrastructure.customTypeName || '',
        capacity: infrastructure.capacity,
        status: infrastructure.status,
        suggestedBatchId: (infrastructure as any).suggestedBatchId || '',
        specifications: {
          volume: infrastructure.specifications?.volume || '',
          profondeur: infrastructure.specifications?.profondeur || '',
          materiau: infrastructure.specifications?.materiau || '',
          temperature: infrastructure.specifications?.temperature || '',
          ph: infrastructure.specifications?.ph || '',
          oxygenLevel: infrastructure.specifications?.oxygenLevel || ''
        }
      });
    }
  }, [infrastructure]);

  useEffect(() => {
    if (!infrastructure && !newInfrastructure.unitId && units[0]?.id) {
      setNewInfrastructure(prev => ({ ...prev, unitId: units[0].id }));
    }
  }, [infrastructure, newInfrastructure.unitId, units]);

  const handleDialogOpenChange = (open: boolean) => {
    if (open && !infrastructure && !newInfrastructure.unitId && units[0]?.id) {
      setNewInfrastructure(prev => ({ ...prev, unitId: units[0].id }));
    }
    setShowDialog(open);
  };

  const selectedUnitType = units.find(u => u.id === newInfrastructure.unitId)?.type;
  const formTerms = getUnitTerms(selectedUnitType);
  const predefinedTypes = [
    ...formTerms.infrastructureTypeOptions,
    { value: 'custom', label: 'Type personnalisé...' }
  ];

  const allTypes = [
    ...predefinedTypes.filter(t => t.value !== 'custom'),
    ...customTypes.map(type => ({ value: type, label: type })),
    { value: 'custom', label: 'Type personnalisé...' }
  ];

  const handleSaveCustomType = () => {
    if (customTypeName.trim()) {
      setCustomTypes(prev => [...prev, customTypeName.trim()]);
      setNewInfrastructure(prev => ({ 
        ...prev, 
        type: customTypeName.trim(),
        customTypeName: customTypeName.trim()
      }));
      setCustomTypeName('');
      setShowCustomTypeInput(false);
    }
  };

  const handleTypeChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomTypeInput(true);
    } else {
      setNewInfrastructure(prev => ({ 
        ...prev, 
        type: value,
        customTypeName: ''
      }));
      setShowCustomTypeInput(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaveError('');
    if (!newInfrastructure.name.trim() || !newInfrastructure.unitId || !newInfrastructure.type) {
      setSaveError('Indiquez le nom, l’unité et le type de l’infrastructure.'); return;
    }
    if (includeDepreciation) {
      const error = validateInfrastructureDepreciation(depreciation);
      if (error) { setSaveError(error); return; }
    }
    // Build specifications with attachedBatchId if a batch is selected
    const specs = { ...infrastructure?.specifications, ...Object.fromEntries(
      Object.entries(newInfrastructure.specifications).filter(([_, value]) => value !== '')
    ) };
    if (includeDepreciation) specs.depreciation = depreciation;
    if (newInfrastructure.suggestedBatchId) {
      (specs as any).attachedBatchId = newInfrastructure.suggestedBatchId;
    }
    
    const infrastructurePayload = {
      name: newInfrastructure.name,
      unitId: newInfrastructure.unitId,
      type: newInfrastructure.type,
      customTypeName: newInfrastructure.customTypeName || undefined,
      capacity: newInfrastructure.capacity,
      status: newInfrastructure.status,
      specifications: specs,
    };

    setSaving(true);
    try {
      if (infrastructure) {
        await updateInfrastructure(infrastructure.id, infrastructurePayload);
        addLog('Infrastructure modifiée', 'Infrastructures', `${infrastructurePayload.name} mise à jour`, 'success');
      } else {
        await addInfrastructure(infrastructurePayload);
        addLog('Infrastructure créée', 'Infrastructures', `${infrastructurePayload.name} ajoutée`, 'success');
      }

      onSave?.(infrastructure ? { ...infrastructure, ...infrastructurePayload } : infrastructurePayload);

      if (!infrastructure) {
        setNewInfrastructure(createEmptyInfrastructure());
        setIncludeDepreciation(false);
        setDepreciation({ purchasePrice: 0, purchaseDate: '', usefulLife: 5, currency, method: 'linear' });
      }

      setShowDialog(false);
      onClose?.();
    } catch (e) {
      console.error('Erreur sauvegarde infrastructure:', e);
      addLog('Erreur', 'Infrastructures', 'Impossible de sauvegarder l\'infrastructure', 'error');
      setSaveError('L’infrastructure et son amortissement n’ont pas pu être enregistrés. Vos saisies sont conservées.');
    } finally {
      setSaving(false);
    }
  };

  const formFields = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="infrastructure-name" className="text-sm">Nom de l'infrastructure</Label>
          <Input 
            id="infrastructure-name"
            value={newInfrastructure.name}
            onChange={(e) => setNewInfrastructure(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Bassin principal A1"
            className="text-sm"
          />
        </div>
        
        <div>
          <Label className="text-sm">Unité de production</Label>
          <Select value={newInfrastructure.unitId} onValueChange={(value) => setNewInfrastructure(prev => ({ ...prev, unitId: value }))}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Sélectionner une unité" />
            </SelectTrigger>
            <SelectContent>
              {units.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm">Type d'infrastructure</Label>
          <Select value={newInfrastructure.type} onValueChange={handleTypeChange}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Sélectionner le type" />
            </SelectTrigger>
            <SelectContent>
              {allTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showCustomTypeInput && (
          <div>
            <Label className="text-sm">Nom du type personnalisé</Label>
            <div className="flex gap-2">
              <Input 
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                placeholder="Ex: Bassin circulaire fibre"
                className="text-sm"
              />
              <Button size="sm" onClick={handleSaveCustomType}>
                Ajouter
              </Button>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="infrastructure-capacity" className="text-sm">Capacité</Label>
          <Input 
            id="infrastructure-capacity"
            type="number"
            value={newInfrastructure.capacity}
            onChange={(e) => setNewInfrastructure(prev => ({ ...prev, capacity: parseInt(e.target.value) || 0 }))}
            className="text-sm"
          />
        </div>

        <div>
          <Label className="text-sm">État</Label>
          <Select value={newInfrastructure.status} onValueChange={(value: 'active' | 'maintenance' | 'inactive') => 
            setNewInfrastructure(prev => ({ ...prev, status: value }))
          }>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label className="text-sm">{formTerms.attachedBatchLabel} (optionnel)</Label>
          <Select 
            value={newInfrastructure.suggestedBatchId || "none"} 
            onValueChange={(value) => setNewInfrastructure(prev => ({ ...prev, suggestedBatchId: value === "none" ? "" : value }))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Sélectionner un lot à rattacher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun lot</SelectItem>
              {batches
                .filter(batch => {
                  // Filter by unit
                  if (batch.unit_id !== newInfrastructure.unitId) return false;
                  
                  // If editing, allow current batch
                  const currentAttachedBatchId = (infrastructure?.specifications as any)?.attachedBatchId;
                  if (infrastructure && currentAttachedBatchId === batch.id) return true;
                  
                  // Check if batch is attached to another infrastructure
                  const isAttachedElsewhere = allInfrastructures.some(inf => {
                    // Skip current infrastructure if editing
                    if (infrastructure && inf.id === infrastructure.id) return false;
                    // Check if this infrastructure has the batch attached
                    return (inf.specifications as any)?.attachedBatchId === batch.id;
                  });
                  
                  return !isAttachedElsewhere;
                })
                .map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.species} - {batch.quantity} ind. ({batch.average_weight}g) - {batch.unit_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Ce lot sera affiché sur cette infrastructure. Un lot ne peut être rattaché qu'à une seule infrastructure.
          </p>
        </div>

        {/* Spécifications techniques */}
        <div className="sm:col-span-2">
          <Label className="text-sm font-medium">Spécifications techniques</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div>
              <Label className="text-xs text-gray-600">Volume (L ou m³)</Label>
              <Input 
                value={newInfrastructure.specifications.volume}
                onChange={(e) => setNewInfrastructure(prev => ({ 
                  ...prev, 
                  specifications: { ...prev.specifications, volume: e.target.value }
                }))}
                placeholder="Ex: 15000"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Profondeur (m)</Label>
              <Input 
                value={newInfrastructure.specifications.profondeur}
                onChange={(e) => setNewInfrastructure(prev => ({ 
                  ...prev, 
                  specifications: { ...prev.specifications, profondeur: e.target.value }
                }))}
                placeholder="Ex: 2.5"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Matériau</Label>
              <Input 
                value={newInfrastructure.specifications.materiau}
                onChange={(e) => setNewInfrastructure(prev => ({ 
                  ...prev, 
                  specifications: { ...prev.specifications, materiau: e.target.value }
                }))}
                placeholder="Ex: Béton, Fibre, Terre"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Température (°C)</Label>
              <Input 
                value={newInfrastructure.specifications.temperature}
                onChange={(e) => setNewInfrastructure(prev => ({ 
                  ...prev, 
                  specifications: { ...prev.specifications, temperature: e.target.value }
                }))}
                placeholder="Ex: 25-28"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">pH</Label>
              <Input 
                value={newInfrastructure.specifications.ph}
                onChange={(e) => setNewInfrastructure(prev => ({ 
                  ...prev, 
                  specifications: { ...prev.specifications, ph: e.target.value }
                }))}
                placeholder="Ex: 7.0-7.5"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Oxygène (mg/L)</Label>
              <Input 
                value={newInfrastructure.specifications.oxygenLevel}
                onChange={(e) => setNewInfrastructure(prev => ({ 
                  ...prev, 
                  specifications: { ...prev.specifications, oxygenLevel: e.target.value }
                }))}
                placeholder="Ex: 6-8"
                className="text-sm"
              />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 space-y-3 border-t pt-4">
          <div className="flex items-center justify-between gap-3"><Label htmlFor="infrastructure-amortissement">Ajouter aux amortissements</Label><Switch id="infrastructure-amortissement" checked={includeDepreciation} disabled={Boolean(infrastructure?.specifications?.depreciationAssetId)} onCheckedChange={setIncludeDepreciation} /></div>
          {includeDepreciation && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label htmlFor="infra-cost">Coût d’acquisition</Label><Input id="infra-cost" type="number" min="0" step="0.01" value={depreciation.purchasePrice || ''} onChange={e=>setDepreciation(d=>({...d,purchasePrice:Number(e.target.value)}))}/></div>
            <div><Label>Devise</Label><Select value={depreciation.currency} onValueChange={v=>setDepreciation(d=>({...d,currency:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['XOF','EUR','USD','MAD'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="infra-service-date">Date de mise en service</Label><Input id="infra-service-date" type="date" value={depreciation.purchaseDate} onChange={e=>setDepreciation(d=>({...d,purchaseDate:e.target.value}))}/></div>
            <div><Label htmlFor="infra-life">Durée d’amortissement (années)</Label><Input id="infra-life" type="number" min="1" max="50" value={depreciation.usefulLife} onChange={e=>setDepreciation(d=>({...d,usefulLife:Number(e.target.value)}))}/></div>
            <p className="text-sm text-muted-foreground sm:col-span-2">Méthode linéaire · {depreciation.usefulLife > 0 ? `${(100/depreciation.usefulLife).toLocaleString('fr-FR', {maximumFractionDigits:2})} % par an` : '—'}</p>
          </div>}
        </div>
        {saveError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{saveError}</p>}
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Enregistrement…' : infrastructure ? 'Mettre à jour' : 'Créer l\'infrastructure'}
          </Button>
          <Button variant="outline" onClick={() => {
            setShowDialog(false);
            if (onClose) onClose();
          }}>
            Annuler
          </Button>
        </div>
      </div>
  );

  const dialogContent = (
    <DialogContent
      hideClose
      className="max-w-full sm:max-w-3xl mx-2 max-h-[90vh] overflow-y-auto"
      onInteractOutside={(event) => event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{infrastructure ? 'Modifier l\'infrastructure' : 'Nouvelle Infrastructure'}</DialogTitle>
      </DialogHeader>
      {formFields}
    </DialogContent>
  );

  // If it's being used within another dialog (like in InfrastructureCard), don't nest Radix DialogContent.
  if (infrastructure && onClose) {
    return formFields;
  }

  // For new infrastructure creation, wrap in Dialog with trigger
  return (
    <Dialog open={showDialog} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="text-sm">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter infrastructure
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
};

export default InfrastructureForm;
