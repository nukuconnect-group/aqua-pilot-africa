import { isCommercialStock } from '@/lib/stockPurpose';
import { SUPABASE_URL } from '@/integrations/supabase/env';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Plus, Clock, Bell, Printer, Trash2, Download, Sparkles, Wand2 } from 'lucide-react';
import { useFeedingPlans } from '@/hooks/useFeedingPlans';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { generateFeedingPlanHTML, generateFeedingSheetHTML, printHTML, downloadHTML } from '@/lib/feedingPrintUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';

interface FeedingPlanSchedulerProps {
  unitId: string;
  unitName: string;
  cycleId?: string;
  cycleName: string;
}

interface FeedingSheetRow {
  id: string;
  time: string;
  feedType: string;
  quantity: string;
  unit: string;
  daysText: string;
  infrastructureId: string;
  notes: string;
}

const createEmptySheetRow = (): FeedingSheetRow => ({
  id: Math.random().toString(36).slice(2, 9),
  time: '',
  feedType: '',
  quantity: '',
  unit: 'kg',
  daysText: 'lundi,mardi,mercredi,jeudi,vendredi,samedi,dimanche',
  infrastructureId: '',
  notes: '',
});

const FeedingPlanScheduler = ({ unitId, unitName, cycleId, cycleName }: FeedingPlanSchedulerProps) => {
  const { plans, loading, createPlan, updatePlan, deletePlan } = useFeedingPlans(unitId, cycleId);
  const { infrastructures } = useCycleInfrastructures(cycleId || '');
  const { stocks: allUnitStocks } = useFeedStocks(unitId);
  const stocks = useMemo(() => allUnitStocks.filter(s => !isCommercialStock(s)), [allUnitStocks]);
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [formData, setFormData] = useState({
    time: '',
    feedType: '',
    quantity: '',
    unit: 'kg',
    days: [] as string[],
    infrastructureId: '',
    notes: ''
  });
  const [sheetRows, setSheetRows] = useState<FeedingSheetRow[]>([
    createEmptySheetRow(),
    createEmptySheetRow(),
    createEmptySheetRow(),
  ]);

  const weekDays = [
    { key: 'lundi', label: 'Lundi' },
    { key: 'mardi', label: 'Mardi' },
    { key: 'mercredi', label: 'Mercredi' },
    { key: 'jeudi', label: 'Jeudi' },
    { key: 'vendredi', label: 'Vendredi' },
    { key: 'samedi', label: 'Samedi' },
    { key: 'dimanche', label: 'Dimanche' }
  ];

  // Combiner les types d'aliment prédéfinis avec ceux en stock
  const stockFeedTypes = stocks.map(stock => stock.custom_name || stock.feed_type);
  const defaultFeedTypes = [
    'Aliment starter (0.5-1mm)',
    'Aliment croissance (2-3mm)',
    'Aliment finition (4-6mm)',
    'Aliment reproducteurs',
    'Aliment médiqué',
    'Complément vitaminé'
  ];
  
  // Afficher d'abord les aliments en stock, puis les types par défaut
  const feedTypes = [...new Set([...stockFeedTypes, ...defaultFeedTypes])];

  const feedingSheetRows = useMemo(() => plans.map((plan) => ({
    time: plan.time,
    infrastructureName: infrastructures.find((infra) => infra.id === plan.infrastructure_id)?.infrastructure_name,
    feedType: plan.feed_type,
    quantity: plan.quantity,
    unit: plan.unit,
    days: plan.days,
    notes: plan.notes,
  })), [plans, infrastructures]);

  const handleDownloadSheet = () => {
    const html = generateFeedingSheetHTML(feedingSheetRows, unitName, 'Fiche de nourrissage');
    downloadHTML(html, `fiche-nourrissage-${unitName.replace(/\s+/g, '-').toLowerCase()}.html`);
  };

  const handlePrintSheet = () => {
    const html = generateFeedingSheetHTML(feedingSheetRows, unitName, 'Fiche de nourrissage');
    printHTML(html);
  };

  const handleGenerateWithAI = async () => {
    try {
      setIsAiGenerating(true);
      setIsSheetOpen(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Connexion requise', description: 'Connectez-vous pour générer une fiche IA.', variant: 'destructive' });
        return;
      }

      const infraSummary = infrastructures.slice(0, 8).map((infra) => `${infra.infrastructure_name} (${infra.infrastructure_type})`).join(', ') || 'Aucune infrastructure';
      const stockSummary = stocks.slice(0, 10).map((stock) => `${stock.custom_name || stock.feed_type}: ${stock.quantity} ${stock.unit}`).join(', ') || 'Aucun stock';

      const prompt = `Crée une fiche de nourrissage aquacole professionnelle pour l'unité ${unitName}, cycle ${cycleName || 'actif'}.
Infrastructures: ${infraSummary}.
Stocks disponibles: ${stockSummary}.
Réponds avec EXACTEMENT 4 lignes maximum, au format:
heure | infrastructure | aliment | quantite_kg | jours | note
Exemple:
08:00 | Bassin A | Aliment croissance 3mm | 12 | lundi,mardi,mercredi | ration matin
Utilise seulement du texte brut.`;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/aqua-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          language: 'Français',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Impossible de générer la fiche');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Réponse IA indisponible');

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) assistantContent += content;
          } catch {
            continue;
          }
        }
      }

      const parsedRows = assistantContent
        .split('\n')
        .map((row) => row.trim())
        .filter((row) => row.includes('|'))
        .slice(0, 4)
        .map((row) => row.split('|').map((cell) => cell.trim()));

      if (parsedRows.length === 0) throw new Error('Aucune ligne exploitable générée par l’IA');

      const daysMap = weekDays.map((day) => day.key);
      const firstInfrastructureId = infrastructures[0]?.id || '';

      setSheetRows(parsedRows.map((row) => {
        const [time, infraName, feedType, quantityKg, days, note] = row;
        const infra = infrastructures.find((item) => item.infrastructure_name.toLowerCase() === (infraName || '').toLowerCase());
        return {
          id: Math.random().toString(36).slice(2, 9),
          time: time || '08:00',
          feedType: feedType || feedTypes[0] || 'Aliment croissance (2-3mm)',
          quantity: quantityKg || '1',
          unit: 'kg',
          daysText: (days || 'lundi,mardi,mercredi').split(',').map((day) => day.trim().toLowerCase()).filter((day) => daysMap.includes(day)).join(','),
          infrastructureId: infra?.id || firstInfrastructureId,
          notes: note || 'Fiche générée par IA',
        };
      }));

      toast({ title: 'Proposition IA prête', description: 'Relisez puis enregistrez la fiche.' });
    } catch (error: any) {
      toast({ title: 'Erreur IA', description: error?.message || 'Impossible de générer la fiche.', variant: 'destructive' });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const updateSheetRow = (rowId: string, field: keyof FeedingSheetRow, value: string) => {
    setSheetRows((prev) => prev.map((row) => row.id === rowId ? { ...row, [field]: value } : row));
  };

  const addSheetRow = () => setSheetRows((prev) => [...prev, createEmptySheetRow()]);

  const removeSheetRow = (rowId: string) => {
    setSheetRows((prev) => prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId));
  };

  const handleSaveSheet = async () => {
    const validRows = sheetRows.filter((row) => row.time && row.feedType && Number(row.quantity) > 0);

    if (validRows.length === 0) {
      toast({ title: 'Fiche vide', description: 'Ajoutez au moins une ligne valide.', variant: 'destructive' });
      return;
    }

    for (const row of validRows) {
      await createPlan({
        unit_id: unitId,
        cycle_id: cycleId,
        infrastructure_id: row.infrastructureId || undefined,
        time: row.time,
        feed_type: row.feedType,
        quantity: Number(row.quantity),
        unit: row.unit,
        days: row.daysText.split(',').map((day) => day.trim().toLowerCase()).filter(Boolean),
        is_active: true,
        notes: row.notes,
      });
    }

    setIsSheetOpen(false);
    setSheetRows([createEmptySheetRow(), createEmptySheetRow(), createEmptySheetRow()]);
    toast({ title: 'Fiche enregistrée', description: `${validRows.length} ligne(s) ajoutée(s) au planning.` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createPlan({
        unit_id: unitId,
        cycle_id: cycleId,
        infrastructure_id: formData.infrastructureId || undefined,
        time: formData.time,
        feed_type: formData.feedType,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        days: formData.days,
        is_active: true,
        notes: formData.notes
      });

      setIsOpen(false);
      setFormData({
        time: '',
        feedType: '',
        quantity: '',
        unit: 'kg',
        days: [],
        infrastructureId: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error creating plan:', error);
    }
  };

  const togglePlanStatus = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      await updatePlan(planId, { is_active: !plan.is_active });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce planning ?')) {
      await deletePlan(planId);
    }
  };

  const handlePrint = () => {
    const html = generateFeedingPlanHTML(plans, unitName);
    printHTML(html);
  };

  const toggleDay = (day: string) => {
    const updatedDays = formData.days.includes(day)
      ? formData.days.filter(d => d !== day)
      : [...formData.days, day];
    setFormData({ ...formData, days: updatedDays });
  };

  const getNextFeedingTime = () => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDay = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][now.getDay()];
    
    const activePlans = plans.filter(p => p.is_active && p.days.includes(currentDay));
    const upcomingPlans = activePlans.filter(p => {
      const [hours, minutes] = p.time.split(':').map(Number);
      const planTime = hours * 60 + minutes;
      return planTime > currentTime;
    });

    if (upcomingPlans.length > 0) {
      upcomingPlans.sort((a, b) => {
        const [aHours, aMinutes] = a.time.split(':').map(Number);
        const [bHours, bMinutes] = b.time.split(':').map(Number);
        return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
      });
      return upcomingPlans[0];
    }

    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          Chargement des planifications...
        </CardContent>
      </Card>
    );
  }

  const nextFeeding = getNextFeedingTime();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold truncate">Planification des nourrissages</h3>
          <p className="text-xs sm:text-sm text-gray-600 truncate">Unité: {unitName}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {plans.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                <Printer className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Imprimer</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadSheet} className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                <Download className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Télécharger fiche</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrintSheet} className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Imprimer fiche</span>
              </Button>
            </>
          )}
          <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Créer fiche</span>
                <span className="sm:hidden">Fiche</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[98vw] max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Fiche de nourrissage — saisie tabulaire</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="text-sm text-muted-foreground">Renseignez la fiche comme un tableau de gestion, puis enregistrez en une seule fois.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={handleGenerateWithAI} disabled={isAiGenerating}>
                      {isAiGenerating ? <Sparkles className="w-4 h-4 mr-2 animate-pulse" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      IA proposer la fiche
                    </Button>
                    <Button variant="outline" size="sm" onClick={addSheetRow}>
                      <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[110px]">Heure</TableHead>
                        <TableHead className="min-w-[180px]">Infrastructure</TableHead>
                        <TableHead className="min-w-[220px]">Aliment</TableHead>
                        <TableHead className="min-w-[110px]">Qté</TableHead>
                        <TableHead className="min-w-[90px]">Unité</TableHead>
                        <TableHead className="min-w-[220px]">Jours</TableHead>
                        <TableHead className="min-w-[220px]">Notes</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheetRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell><Input type="time" value={row.time} onChange={(e) => updateSheetRow(row.id, 'time', e.target.value)} /></TableCell>
                          <TableCell>
                            <Select value={row.infrastructureId || undefined} onValueChange={(value) => updateSheetRow(row.id, 'infrastructureId', value)}>
                              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                              <SelectContent>
                                {infrastructures.filter((infra) => Boolean(infra.id)).map((infra) => (
                                  <SelectItem key={infra.id} value={infra.id}>{infra.infrastructure_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={row.feedType || undefined} onValueChange={(value) => updateSheetRow(row.id, 'feedType', value)}>
                              <SelectTrigger><SelectValue placeholder="Choisir un aliment" /></SelectTrigger>
                              <SelectContent>
                                {feedTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Input type="number" step="0.1" value={row.quantity} onChange={(e) => updateSheetRow(row.id, 'quantity', e.target.value)} placeholder="0" /></TableCell>
                          <TableCell>
                            <Select value={row.unit} onValueChange={(value) => updateSheetRow(row.id, 'unit', value)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="g">g</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Input value={row.daysText} onChange={(e) => updateSheetRow(row.id, 'daysText', e.target.value)} placeholder="lundi,mardi,mercredi" /></TableCell>
                          <TableCell><Input value={row.notes} onChange={(e) => updateSheetRow(row.id, 'notes', e.target.value)} placeholder="Observation ou consigne" /></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeSheetRow(row.id)} className="text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-3 border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    Total prévisionnel: <span className="font-semibold text-foreground">{sheetRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0).toLocaleString('fr-FR')} kg</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Fermer</Button>
                    <Button onClick={handleSaveSheet}>Enregistrer la fiche</Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="secondary" onClick={handleGenerateWithAI} disabled={isAiGenerating} className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
            {isAiGenerating ? <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1 animate-pulse" /> : <Wand2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />}
            <span className="hidden sm:inline">IA créer la fiche</span>
            <span className="sm:hidden">IA</span>
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">Nouveau planning</span>
              <span className="sm:hidden">Nouveau</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Nouveau planning de nourrissage</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="time" className="text-xs sm:text-sm">Heure</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  required
                  className="text-xs sm:text-sm h-9 sm:h-10"
                />
              </div>

              <div>
                <Label htmlFor="feedType" className="text-xs sm:text-sm">Type d'aliment</Label>
                <Select value={formData.feedType} onValueChange={(value) => setFormData({...formData, feedType: value})}>
                  <SelectTrigger className="text-xs sm:text-sm h-9 sm:h-10">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {stocks.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                          Aliments en stock
                        </div>
                        {stocks.map((stock) => (
                          <SelectItem 
                            key={stock.id} 
                            value={stock.custom_name || stock.feed_type} 
                            className="text-xs sm:text-sm"
                          >
                            {stock.custom_name || stock.feed_type} ({stock.quantity} {stock.unit})
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted mt-1">
                          Autres types
                        </div>
                      </>
                    )}
                    {defaultFeedTypes.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs sm:text-sm">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stocks.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aucun stock d'aliment ajouté. Ajoutez des stocks pour les voir ici.
                  </p>
                )}
              </div>

              {cycleId && infrastructures.length > 0 && (
                <div>
                  <Label htmlFor="infrastructure" className="text-xs sm:text-sm">Infrastructure</Label>
                  <Select
                    value={formData.infrastructureId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, infrastructureId: value })}
                  >
                    <SelectTrigger className="text-xs sm:text-sm h-9 sm:h-10">
                      <SelectValue placeholder="Sélectionner une infrastructure (optionnel)" />
                    </SelectTrigger>
                    <SelectContent>
                      {infrastructures.filter((infra) => Boolean(infra.id)).map((infra) => (
                        <SelectItem key={infra.id} value={infra.id} className="text-xs sm:text-sm">
                          {infra.infrastructure_name} ({infra.infrastructure_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="quantity" className="text-xs sm:text-sm">Quantité</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    required
                    className="text-xs sm:text-sm h-9 sm:h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="unit" className="text-xs sm:text-sm">Unité</Label>
                  <Select value={formData.unit} onValueChange={(value) => setFormData({...formData, unit: value})}>
                    <SelectTrigger className="text-xs sm:text-sm h-9 sm:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg" className="text-xs sm:text-sm">kg</SelectItem>
                      <SelectItem value="g" className="text-xs sm:text-sm">g</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Jours de la semaine</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {weekDays.map((day) => (
                    <div key={day.key} className="flex items-center space-x-2">
                      <Switch
                        id={day.key}
                        checked={formData.days.includes(day.key)}
                        onCheckedChange={() => toggleDay(day.key)}
                      />
                      <Label htmlFor={day.key} className="text-xs sm:text-sm">{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs sm:text-sm">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Notes sur ce planning..."
                  className="text-xs sm:text-sm h-9 sm:h-10"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 sm:pt-4">
                <Button type="submit" className="flex-1 h-9 sm:h-10 text-xs sm:text-sm">
                  Créer planning
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="h-9 sm:h-10 text-xs sm:text-sm">
                  Annuler
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {nextFeeding && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" />
              <h4 className="font-medium text-orange-800 text-xs sm:text-sm">Prochain nourrissage</h4>
            </div>
            <div className="text-xs sm:text-sm">
              <p className="font-medium truncate">{nextFeeding.time} - {nextFeeding.feed_type}</p>
              <p className="text-orange-700">{nextFeeding.quantity} {nextFeeding.unit}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {plans.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Aucun planning configuré. Créez votre premier planning de nourrissage.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2 sm:space-y-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                    <h4 className="font-medium text-sm sm:text-base">{plan.time}</h4>
                    <Badge variant={plan.is_active ? "default" : "secondary"} className="text-xs">
                      {plan.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{plan.feed_type}</p>
                  <p className="text-xs sm:text-sm font-medium mb-2">{plan.quantity} {plan.unit}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {plan.days.map((day) => (
                      <Badge key={day} variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </Badge>
                    ))}
                  </div>
                  {plan.notes && (
                    <p className="text-xs text-gray-500 line-clamp-2">{plan.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={() => togglePlanStatus(plan.id)}
                  />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleDeletePlan(plan.id)}
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FeedingPlanScheduler;
