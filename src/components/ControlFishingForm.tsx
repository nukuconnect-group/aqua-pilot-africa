import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Fish, Trash2, Calculator, Scale, Info, FileDown, AlertTriangle } from 'lucide-react';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportControlFishingPDF } from '@/lib/controlFishingPdf';
import { useToast } from '@/hooks/use-toast';

interface ControlFishingFormProps {
  unitId: string;
  onRecordCreated?: () => void;
}

interface SampleBatch {
  id: string;
  species: string;
  subjectCount: number;
  totalWeight: number; // grammes (poids moyen général saisi pour le lot)
  individualWeight: number; // grammes, calculé automatiquement (totalWeight / subjectCount)
  sourceId: string; // infrastructure d'origine du prélèvement
  sourceName: string;
}

const ControlFishingForm = ({ unitId, onRecordCreated }: ControlFishingFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { cycles } = useProductionCycles(unitId);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const { infrastructures } = useCycleInfrastructures(selectedCycleId);
  const { createRecord, records: allHealthRecords } = useHealthRecords(selectedCycleId, unitId);
  const { batches: livestockBatches } = useLivestockBatches(unitId);
  
  const [formData, setFormData] = useState({
    infrastructureId: '',
    date: new Date().toISOString().split('T')[0],
    temperature: '',
    ph: '',
    oxygen: '',
    mortality: '',
    notes: ''
  });

  // Sélection multiple d'infrastructures pour la pêche de contrôle
  const [selectedInfraIds, setSelectedInfraIds] = useState<string[]>([]);

  // Système de prélèvement par lots
  const [sampleBatches, setSampleBatches] = useState<SampleBatch[]>([]);
  const [newBatch, setNewBatch] = useState({
    species: '',
    subjectCount: '',
    totalWeight: '',
    sourceId: ''
  });
  const [batchError, setBatchError] = useState<string | null>(null);

  const activeCycles = cycles.filter(c => c.status === 'active');
  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  // Disponibilité par infrastructure du cycle — affichée AVANT toute saisie
  const infraAvailability = useMemo(() => {
    return infrastructures
      .filter((infra) => Boolean(infra.id))
      .map((infra) => {
        const batch = livestockBatches.find((b) => b.id === infra.livestock_batch_id) || null;
        return {
          id: infra.id,
          name: infra.infrastructure_name,
          type: infra.infrastructure_type,
          batch,
          available: batch?.quantity ?? infra.current_quantity ?? 0,
        };
      });
  }, [infrastructures, livestockBatches]);

  const selectedInfraList = useMemo(
    () => infraAvailability.filter((i) => selectedInfraIds.includes(i.id)),
    [infraAvailability, selectedInfraIds]
  );

  const selectedInfrastructure = infrastructures.find((i) => i.id === formData.infrastructureId);
  const attachedBatch = selectedInfraList[0]?.batch || null;

  // Sujets disponibles = somme des infrastructures sélectionnées
  const availableSubjects = useMemo(
    () => selectedInfraList.reduce((sum, i) => sum + (i.available || 0), 0),
    [selectedInfraList]
  );

  // Sujets déjà prélevés par infrastructure (calcul intelligent multi-sources)
  const subjectsBySource = useMemo(() => {
    const map: Record<string, number> = {};
    sampleBatches.forEach((b) => {
      map[b.sourceId] = (map[b.sourceId] || 0) + b.subjectCount;
    });
    return map;
  }, [sampleBatches]);

  const toggleInfrastructure = (id: string) => {
    const next = selectedInfraIds.includes(id)
      ? selectedInfraIds.filter((x) => x !== id)
      : [...selectedInfraIds, id];
    setSelectedInfraIds(next);
    setFormData((f) => ({ ...f, infrastructureId: next[0] || '' }));
    setSampleBatches((prev) => prev.filter((b) => next.includes(b.sourceId)));
    setNewBatch((prev) => ({ ...prev, sourceId: next.includes(prev.sourceId) ? prev.sourceId : (next[0] || '') }));
    setBatchError(null);
  };
  
  // Filtrer les pêches de contrôle passées pour l'infrastructure sélectionnée
  const pastControlRecords = allHealthRecords.filter(r => r.basin_id === formData.infrastructureId);
  
  // Calculs automatiques pour les lots prélevés
  const batchCalculations = useMemo(() => {
    const totalSubjects = sampleBatches.reduce((sum, b) => sum + b.subjectCount, 0);
    const totalWeight = sampleBatches.reduce((sum, b) => sum + b.totalWeight, 0);
    const pmi = totalSubjects > 0 ? totalWeight / totalSubjects : 0;
    const samplePercentage = availableSubjects > 0 
      ? ((totalSubjects / availableSubjects) * 100)
      : 0;
    
    return {
      totalSubjects,
      totalWeight, // en grammes
      totalWeightKg: totalWeight / 1000,
      pmi, // Poids Moyen Individuel en grammes
      samplePercentage
    };
  }, [sampleBatches, availableSubjects]);

  // PMI par espèce (recalculé en temps réel)
  const speciesCalculations = useMemo(() => {
    const map = new Map<string, { species: string; subjects: number; weight: number }>();
    sampleBatches.forEach((b) => {
      const key = (b.species || 'Non précisée').trim() || 'Non précisée';
      const entry = map.get(key) || { species: key, subjects: 0, weight: 0 };
      entry.subjects += b.subjectCount;
      entry.weight += b.totalWeight;
      map.set(key, entry);
    });
    return Array.from(map.values()).map((e) => ({
      ...e,
      pmi: e.subjects > 0 ? e.weight / e.subjects : 0,
    }));
  }, [sampleBatches]);

  // Erreurs de saisie sur les lots déjà ajoutés (recalculées en temps réel)
  const rowErrors = useMemo(() => {
    const map: Record<string, string> = {};
    sampleBatches.forEach((b) => {
      if (!Number.isFinite(b.subjectCount) || b.subjectCount <= 0) {
        map[b.id] = 'Le nombre de sujets doit être un entier supérieur à 0.';
      } else if (!Number.isFinite(b.totalWeight) || b.totalWeight <= 0) {
        map[b.id] = 'Le poids total du lot doit être supérieur à 0 g.';
      } else if (b.totalWeight / b.subjectCount > 100000) {
        map[b.id] = 'PMI incohérent : vérifiez le poids total (en grammes) et le nombre de sujets.';
      }
    });
    return map;
  }, [sampleBatches]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;

  const overSampled =
    availableSubjects > 0 && batchCalculations.totalSubjects > availableSubjects;

  // Validation de la saisie d'un nouveau lot
  const validateNewBatch = (): string | null => {
    if (selectedInfraIds.length === 0) {
      return 'Sélectionnez au moins une infrastructure avant de prélever.';
    }
    const sourceId = newBatch.sourceId || selectedInfraIds[0];
    const source = selectedInfraList.find((i) => i.id === sourceId);
    if (!source) return 'Sélectionnez l’infrastructure d’origine du prélèvement.';
    if (!newBatch.subjectCount.trim() && !newBatch.totalWeight.trim()) {
      return 'Renseignez le nombre de sujets et le poids total du lot.';
    }
    const subjectCount = Number(newBatch.subjectCount);
    const totalWeight = Number(newBatch.totalWeight);
    if (!newBatch.subjectCount.trim() || !Number.isFinite(subjectCount)) {
      return 'Le nombre de sujets prélevés est obligatoire.';
    }
    if (!Number.isInteger(subjectCount)) return 'Le nombre de sujets doit être un nombre entier.';
    if (subjectCount <= 0) return 'Le nombre de sujets doit être supérieur à 0 (valeur négative ou nulle refusée).';
    if (!newBatch.totalWeight.trim() || !Number.isFinite(totalWeight)) {
      return 'Le poids TOTAL du lot (en grammes) est obligatoire.';
    }
    if (totalWeight <= 0) return 'Le poids total doit être supérieur à 0 g (valeur négative ou nulle refusée).';
    const alreadyFromSource = subjectsBySource[sourceId] || 0;
    if (source.available > 0 && alreadyFromSource + subjectCount > source.available) {
      return `${source.name} : ${alreadyFromSource + subjectCount} sujets prélevés pour seulement ${source.available} disponibles.`;
    }
    if (availableSubjects > 0 && batchCalculations.totalSubjects + subjectCount > availableSubjects) {
      return `Le total prélevé (${batchCalculations.totalSubjects + subjectCount}) dépasse les ${availableSubjects} sujets disponibles.`;
    }
    return null;
  };

  // Ajouter un lot prélevé
  const handleAddSampleBatch = () => {
    const error = validateNewBatch();
    if (error) {
      setBatchError(error);
      return;
    }
    setBatchError(null);
    const subjectCount = parseInt(newBatch.subjectCount, 10);
    const totalWeight = parseFloat(newBatch.totalWeight);
    const sourceId = newBatch.sourceId || selectedInfraIds[0];
    const source = selectedInfraList.find((i) => i.id === sourceId);

    const newSampleBatch: SampleBatch = {
      id: Date.now().toString(),
      species: (newBatch.species || source?.batch?.species || attachedBatch?.species || 'Non précisée').trim(),
      subjectCount,
      totalWeight,
      individualWeight: totalWeight / subjectCount,
      sourceId,
      sourceName: source?.name || ''
    };
    
    setSampleBatches([...sampleBatches, newSampleBatch]);
    setNewBatch({ species: newBatch.species, subjectCount: '', totalWeight: '', sourceId });
  };

  // Modifier un lot existant : le PMI est toujours recalculé
  const handleUpdateSampleBatch = (id: string, field: 'species' | 'subjectCount' | 'totalWeight', value: string) => {
    setSampleBatches((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const updated: SampleBatch = {
          ...b,
          species: field === 'species' ? value : b.species,
          subjectCount: field === 'subjectCount' ? parseInt(value) || 0 : b.subjectCount,
          totalWeight: field === 'totalWeight' ? parseFloat(value) || 0 : b.totalWeight,
          individualWeight: 0,
        };
        updated.individualWeight = updated.subjectCount > 0 ? updated.totalWeight / updated.subjectCount : 0;
        return updated;
      })
    );
  };

  // Supprimer un lot prélevé
  const handleRemoveSampleBatch = (id: string) => {
    setSampleBatches(sampleBatches.filter(b => b.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (sampleBatches.length === 0) {
      return;
    }

    if (hasRowErrors) {
      toast({
        title: 'Saisie invalide',
        description: 'Corrigez les lots en erreur avant d’enregistrer la pêche de contrôle.',
        variant: 'destructive',
      });
      return;
    }

    if (overSampled) {
      toast({
        title: 'Échantillon trop important',
        description: `Le total prélevé dépasse les ${availableSubjects} sujets disponibles.`,
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Créer les notes avec les détails des lots prélevés
      const batchDetails = sampleBatches.map((b, i) => 
        `Lot ${i + 1} (${b.species || 'Non précisée'}): ${b.subjectCount} sujets — poids total ${b.totalWeight}g → PMI ${b.individualWeight.toFixed(2)}g`
      ).join('\n');

      const speciesDetails = speciesCalculations.map((s) =>
        `${s.species}: ${s.subjects} sujets — ${s.weight.toFixed(0)}g → PMI ${s.pmi.toFixed(2)}g`
      ).join('\n');

      const calculationNotes = `
=== PRÉLÈVEMENT PAR LOTS ===
${batchDetails}

=== PMI PAR ESPÈCE ===
${speciesDetails}

=== CALCULS ===
Total sujets prélevés: ${batchCalculations.totalSubjects}
Poids total: ${batchCalculations.totalWeight.toFixed(0)}g (${batchCalculations.totalWeightKg.toFixed(2)}kg)
PMI (Poids Moyen Individuel): ${batchCalculations.pmi.toFixed(2)}g
Pourcentage prélevé: ${batchCalculations.samplePercentage.toFixed(2)}%
Sujets disponibles dans l'infrastructure: ${availableSubjects}

${formData.notes ? `=== OBSERVATIONS ===\n${formData.notes}` : ''}
      `.trim();
      
      await createRecord({
        cycle_id: selectedCycleId,
        unit_id: unitId,
        basin_id: formData.infrastructureId,
        date: formData.date,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        ph: formData.ph ? parseFloat(formData.ph) : undefined,
        oxygen: formData.oxygen ? parseFloat(formData.oxygen) : undefined,
        mortality: formData.mortality ? parseFloat(formData.mortality) : undefined,
        average_weight: batchCalculations.pmi,
        sample_count: batchCalculations.totalSubjects,
        density: batchCalculations.samplePercentage, // Utiliser density pour stocker le % prélevé
        feeding: batchCalculations.totalWeightKg, // Utiliser feeding pour stocker le poids total en kg
        notes: calculationNotes
      });
      
      onRecordCreated?.();
      
      setIsOpen(false);
      
      // Reset form
      setFormData({
        infrastructureId: '',
        date: new Date().toISOString().split('T')[0],
        temperature: '',
        ph: '',
        oxygen: '',
        mortality: '',
        notes: ''
      });
      setSampleBatches([]);
      setSelectedCycleId('');
    } catch (error) {
      console.error('Error creating control fishing record:', error);
    }
  };

  const handleExportPDF = () => {
    if (sampleBatches.length === 0) {
      toast({ title: 'Aucun lot', description: 'Ajoutez au moins un lot prélevé avant d’exporter.', variant: 'destructive' });
      return;
    }
    try {
      exportControlFishingPDF({
        cycleName: selectedCycle ? `${selectedCycle.name} - ${selectedCycle.species}` : undefined,
        infrastructureName: selectedInfrastructure?.infrastructure_name,
        date: formData.date,
        availableSubjects,
        batches: sampleBatches.map((b) => ({
          species: b.species,
          subjectCount: b.subjectCount,
          totalWeight: b.totalWeight,
          individualWeight: b.individualWeight,
        })),
        speciesRows: speciesCalculations,
        totals: batchCalculations,
        environment: {
          temperature: formData.temperature,
          ph: formData.ph,
          oxygen: formData.oxygen,
          mortality: formData.mortality,
        },
        notes: formData.notes,
      });
      toast({ title: 'PDF généré', description: 'Le rapport de pêche de contrôle a été téléchargé.' });
    } catch (err) {
      console.error('Erreur export PDF pêche de contrôle', err);
      toast({ title: 'Export impossible', description: 'Une erreur est survenue pendant la génération du PDF.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Fish className="w-4 h-4 mr-2" />
          Pêche de contrôle
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fish className="w-5 h-5" />
            Enregistrer une pêche de contrôle
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Récapitulatif global en haut du formulaire */}
          {sampleBatches.length > 0 && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Récapitulatif en temps réel
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={handleExportPDF}>
                    <FileDown className="w-4 h-4 mr-1" />
                    Exporter en PDF
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-background p-2">
                    <span className="text-[11px] text-muted-foreground block">Total sujets</span>
                    <p className="font-bold text-lg">{batchCalculations.totalSubjects.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-background p-2">
                    <span className="text-[11px] text-muted-foreground block">Poids total</span>
                    <p className="font-bold text-lg">{batchCalculations.totalWeightKg.toFixed(2)} kg</p>
                  </div>
                  <div className="rounded-lg bg-background p-2">
                    <span className="text-[11px] text-muted-foreground block">PMI global</span>
                    <p className="font-bold text-lg text-primary">{batchCalculations.pmi.toFixed(2)} g</p>
                  </div>
                  <div className="rounded-lg bg-background p-2">
                    <span className="text-[11px] text-muted-foreground block">% prélevé</span>
                    <p className="font-bold text-lg">{batchCalculations.samplePercentage.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Détail par espèce</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {speciesCalculations.map((s) => (
                      <div key={s.species} className="flex items-center justify-between gap-2 text-xs bg-background rounded p-2">
                        <span className="font-medium truncate">{s.species}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {s.subjects} sujets · {(s.weight / 1000).toFixed(2)} kg
                        </span>
                        <span className="font-bold text-primary whitespace-nowrap">PMI {s.pmi.toFixed(2)} g</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(hasRowErrors || overSampled) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription className="text-xs">
                      {overSampled
                        ? `Le total prélevé (${batchCalculations.totalSubjects}) dépasse les ${availableSubjects} sujets disponibles.`
                        : 'Certains lots contiennent des valeurs invalides (vides, nulles ou négatives).'}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sélection du cycle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cycle de production</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="cycle">Cycle actif</Label>
                {activeCycles.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Aucun cycle actif disponible. Créez d'abord un cycle de production.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select 
                    value={selectedCycleId} 
                    onValueChange={(value) => {
                      setSelectedCycleId(value);
                      setFormData({...formData, infrastructureId: ''});
                      setSampleBatches([]);
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCycles.map((cycle) => (
                        <SelectItem key={cycle.id} value={cycle.id}>
                          {cycle.name} - {cycle.species}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedCycleId && (
                <div>
                  <Label htmlFor="infrastructure">Infrastructure</Label>
                  {infrastructures.length === 0 ? (
                    <Alert>
                      <AlertDescription>
                        Aucune infrastructure rattachée à ce cycle.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Select 
                      value={formData.infrastructureId || undefined}
                      onValueChange={(value) => {
                        setFormData({ ...formData, infrastructureId: value });
                        setSampleBatches([]);
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une infrastructure" />
                      </SelectTrigger>
                      <SelectContent>
                        {infrastructures
                          .filter((infra) => Boolean(infra.id))
                          .map((infra) => {
                            const batch = livestockBatches.find((b) => b.id === infra.livestock_batch_id);
                            const subjectCount = batch?.quantity || infra.current_quantity || 0;
                            return (
                              <SelectItem key={infra.id} value={infra.id}>
                                {infra.infrastructure_name} ({infra.infrastructure_type}) - {subjectCount} sujets
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              
              {/* Informations détaillées sur l'infrastructure sélectionnée */}
              {selectedInfrastructure && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Détails de l'infrastructure
                  </h4>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground block text-xs">Sujets disponibles</span>
                      <p className="font-bold text-lg text-primary">{availableSubjects.toLocaleString()}</p>
                    </div>
                    
                    {attachedBatch && (
                      <>
                        <div>
                          <span className="text-muted-foreground block text-xs">Espèce</span>
                          <p className="font-medium">{attachedBatch.species}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">Poids moyen actuel</span>
                          <p className="font-medium">{attachedBatch.average_weight}g</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">Biomasse totale</span>
                          <p className="font-medium">{attachedBatch.total_weight?.toFixed(2)}kg</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-xs">Statut du lot</span>
                          <Badge variant={attachedBatch.status === 'healthy' ? 'default' : 'destructive'}>
                            {attachedBatch.status === 'healthy' ? 'Sain' : attachedBatch.status}
                          </Badge>
                        </div>
                      </>
                    )}
                    
                    <div>
                      <span className="text-muted-foreground block text-xs">Pêches précédentes</span>
                      <p className="font-medium">{pastControlRecords.length} enregistrement(s)</p>
                    </div>
                  </div>
                  
                  {/* Dernières pêches de contrôle */}
                  {pastControlRecords.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-xs font-medium text-muted-foreground">Dernières pêches</span>
                      <div className="space-y-2 mt-2">
                        {pastControlRecords.slice(0, 3).map((record, idx) => (
                          <div key={record.id} className="text-xs flex justify-between items-center bg-background/50 p-2 rounded">
                            <span>{new Date(record.date).toLocaleDateString('fr-FR')}</span>
                            <div className="flex gap-3">
                              <span>PMI: <strong>{record.average_weight?.toFixed(1) || '-'}g</strong></span>
                              <span>Échant: <strong>{record.sample_count || '-'}</strong></span>
                              <span>%: <strong>{record.density?.toFixed(1) || '-'}%</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prélèvement par lots */}
          {formData.infrastructureId && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Prélèvement par lots
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      Saisissez l'espèce, le nombre de sujets prélevés et le <strong>poids TOTAL du lot pesé (pas le poids d'un poisson)</strong>.
                      Le <strong>PMI (Poids Moyen Individuel)</strong> est calculé automatiquement : poids total ÷ nombre de sujets.
                      Vous pouvez ajouter plusieurs lots (une ou plusieurs espèces) : le PMI est recalculé par espèce et au global.
                    </p>
                  </div>
                  
                  {/* Formulaire d'ajout de lot */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-3">
                      <Label className="text-xs">Espèce</Label>
                      <Input
                        value={newBatch.species}
                        onChange={(e) => setNewBatch({...newBatch, species: e.target.value})}
                        placeholder={attachedBatch?.species || 'Tilapia'}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <Label className="text-xs">Nb sujets</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newBatch.subjectCount}
                        onChange={(e) => { setBatchError(null); setNewBatch({...newBatch, subjectCount: e.target.value}); }}
                        placeholder="200"
                      />
                    </div>
                    <div className="col-span-8 sm:col-span-4">
                      <Label className="text-xs">Poids TOTAL du lot (g)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={newBatch.totalWeight}
                        onChange={(e) => { setBatchError(null); setNewBatch({...newBatch, totalWeight: e.target.value}); }}
                        placeholder="10000"
                      />
                      {Number(newBatch.subjectCount) > 0 && Number(newBatch.totalWeight) > 0 && (
                        <p className="text-[11px] text-primary font-medium mt-1">
                          PMI ≈ {(Number(newBatch.totalWeight) / Number(newBatch.subjectCount)).toFixed(2)} g
                        </p>
                      )}
                    </div>
                    <div className="col-span-12 sm:col-span-2">
                      <Button 
                        type="button" 
                        onClick={handleAddSampleBatch}
                        className="w-full"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                  </div>

                  {batchError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription className="text-xs">{batchError}</AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Tableau des lots prélevés */}
                  {sampleBatches.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Lot</TableHead>
                            <TableHead className="text-xs">Espèce</TableHead>
                            <TableHead className="text-xs text-right">Sujets</TableHead>
                            <TableHead className="text-xs text-right">Poids total (g)</TableHead>
                            <TableHead className="text-xs text-right">PMI calculé (g)</TableHead>
                            <TableHead className="text-xs w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleBatches.map((batch, idx) => (
                            <TableRow key={batch.id}>
                              <TableCell className="font-medium">Lot {idx + 1}</TableCell>
                              <TableCell>
                                <Input
                                  className="h-8 text-xs"
                                  value={batch.species}
                                  onChange={(e) => handleUpdateSampleBatch(batch.id, 'species', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="1"
                                  className="h-8 text-xs text-right"
                                  value={batch.subjectCount || ''}
                                  onChange={(e) => handleUpdateSampleBatch(batch.id, 'subjectCount', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  className="h-8 text-xs text-right"
                                  value={batch.totalWeight || ''}
                                  onChange={(e) => handleUpdateSampleBatch(batch.id, 'totalWeight', e.target.value)}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium text-primary">
                                {batch.individualWeight.toFixed(2)}
                                {rowErrors[batch.id] && (
                                  <span className="block text-[10px] text-destructive font-normal">{rowErrors[batch.id]}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleRemoveSampleBatch(batch.id)}
                                >
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* Résumé des calculs */}
                  {sampleBatches.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-2">
                      <h5 className="text-xs font-semibold text-muted-foreground">PMI par espèce (temps réel)</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {speciesCalculations.map((s) => (
                          <div key={s.species} className="flex items-center justify-between text-sm bg-muted/50 rounded p-2">
                            <span className="font-medium">{s.species}</span>
                            <span className="text-xs text-muted-foreground">
                              {s.subjects} sujets · {(s.weight / 1000).toFixed(2)} kg
                            </span>
                            <span className="font-bold text-primary">PMI {s.pmi.toFixed(2)} g</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sampleBatches.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                      <h5 className="font-semibold text-sm flex items-center gap-2 text-green-800">
                        <Calculator className="w-4 h-4" />
                        Calculs automatiques (global)
                      </h5>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs block">Total sujets</span>
                          <p className="font-bold text-lg">{batchCalculations.totalSubjects}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">Poids total</span>
                          <p className="font-bold text-lg">{batchCalculations.totalWeightKg.toFixed(2)} kg</p>
                          <p className="text-xs text-muted-foreground">{batchCalculations.totalWeight.toLocaleString()} g</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">PMI</span>
                          <p className="font-bold text-lg text-primary">{batchCalculations.pmi.toFixed(2)} g</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">% prélevé</span>
                          <p className="font-bold text-lg">{batchCalculations.samplePercentage.toFixed(2)}%</p>
                          <p className="text-xs text-muted-foreground">sur {availableSubjects} sujets</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Données environnementales */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Paramètres environnementaux</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="date">Date de la pêche</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="temperature">Température (°C)</Label>
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                        placeholder="25.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="ph">pH</Label>
                      <Input
                        id="ph"
                        type="number"
                        step="0.1"
                        value={formData.ph}
                        onChange={(e) => setFormData({...formData, ph: e.target.value})}
                        placeholder="7.2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="oxygen">Oxygène dissous (mg/L)</Label>
                      <Input
                        id="oxygen"
                        type="number"
                        step="0.1"
                        value={formData.oxygen}
                        onChange={(e) => setFormData({...formData, oxygen: e.target.value})}
                        placeholder="6.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="mortality">Mortalité observée</Label>
                      <Input
                        id="mortality"
                        type="number"
                        step="1"
                        value={formData.mortality}
                        onChange={(e) => setFormData({...formData, mortality: e.target.value})}
                        placeholder="5"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Observations</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Notes et observations sur la pêche de contrôle..."
                    rows={3}
                  />
                </CardContent>
              </Card>

              <Button 
                type="submit" 
                className="w-full"
                disabled={sampleBatches.length === 0 || hasRowErrors || overSampled}
              >
                {sampleBatches.length === 0 
                  ? 'Ajoutez au moins un lot prélevé' 
                  : `Enregistrer la pêche (${batchCalculations.totalSubjects} sujets, PMI: ${batchCalculations.pmi.toFixed(2)}g)`
                }
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ControlFishingForm;
