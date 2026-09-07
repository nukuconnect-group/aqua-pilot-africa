import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, DollarSign, Package, FileText, FileSpreadsheet, File } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/appClient';
import { 
  exportToCSV, 
  exportToExcel, 
  exportToWord, 
  exportToPDF,
  getReportFilename,
  type ReportData 
} from '@/lib/reportExportUtils';
import { toast } from 'sonner';

interface ProductionCycleData {
  id: string;
  name: string;
  status: string;
  start_date: string;
  current_quantity: number;
  target_quantity: number;
  species: string;
}

interface FeedingData {
  date: string;
  quantity: number;
  feed_type: string;
}

interface HealthData {
  date: string;
  temperature: number;
  ph: number;
  oxygen: number;
  mortality: number;
}

const UnitReportGenerator = () => {
  const { units, getUnitFinancialData, getGlobalFinancialData, transactions, purchases } = useProductionUnits();
  const { formatCurrency } = useSettings();
  const { user } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [reportType, setReportType] = useState<string>('financial');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [isGenerating, setIsGenerating] = useState(false);

  // Données réelles depuis la base
  const [productionCycles, setProductionCycles] = useState<ProductionCycleData[]>([]);
  const [feedingRecords, setFeedingRecords] = useState<FeedingData[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthData[]>([]);

  // Charger les données depuis Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        // Cycles de production
        const { data: cycles } = await supabase
          .from('production_cycles')
          .select('*')
          .order('created_at', { ascending: false });
        if (cycles) setProductionCycles(cycles);

        // Enregistrements d'alimentation
        const { data: feeding } = await supabase
          .from('feeding_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(100);
        if (feeding) setFeedingRecords(feeding);

        // Enregistrements de santé
        const { data: health } = await supabase
          .from('health_records')
          .select('*')
          .order('date', { ascending: false })
          .limit(100);
        if (health) setHealthRecords(health);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    fetchData();
  }, [user?.id]);

  const getReportData = () => {
    if (selectedUnit === 'all') {
      return getGlobalFinancialData();
    }
    return getUnitFinancialData(selectedUnit);
  };

  const reportData = getReportData();

  const getPeriodLabel = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'week':
        return `Semaine du ${new Date(now.setDate(now.getDate() - 7)).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}`;
      case 'month':
        return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `T${quarter} ${now.getFullYear()}`;
      case 'year':
        return now.getFullYear().toString();
      default:
        return 'Période personnalisée';
    }
  };

  const getUnitName = () => {
    if (selectedUnit === 'all') return 'Toutes les unités';
    return units.find(u => u.id === selectedUnit)?.name || 'Unité inconnue';
  };

  const buildReportData = (): ReportData => {
    const unitName = getUnitName();
    const period = getPeriodLabel();
    const generatedAt = new Date().toLocaleString('fr-FR');

    const sections: ReportData['sections'] = [];

    // Section résumé financier
    if (reportType === 'financial' || reportType === 'comprehensive') {
      sections.push({
        title: 'Résumé Financier',
        type: 'summary',
        summary: [
          { label: 'Revenus totaux', value: formatCurrency(reportData?.revenue || 0) },
          { label: 'Dépenses totales', value: formatCurrency(reportData?.expenses || 0) },
          { label: 'Bénéfice net', value: formatCurrency(reportData?.profit || 0) },
          { label: 'Marge bénéficiaire', value: reportData?.revenue ? `${((reportData.profit / reportData.revenue) * 100).toFixed(1)}%` : '0%' }
        ]
      });

      // Détails des transactions
      const filteredTransactions = selectedUnit === 'all' 
        ? transactions 
        : transactions.filter(t => t.unitId === selectedUnit);
      
      if (filteredTransactions.length > 0) {
        sections.push({
          title: 'Détail des Transactions',
          type: 'table',
          headers: ['Date', 'Type', 'Catégorie', 'Description', 'Montant (F CFA)'],
          rows: filteredTransactions.slice(0, 50).map(t => [
            t.date,
            t.type === 'revenue' ? 'Revenu' : 'Dépense',
            t.category,
            t.description || '-',
            t.amount.toLocaleString('fr-FR')
          ])
        });
      }
    }

    // Section production
    if (reportType === 'production' || reportType === 'comprehensive') {
      const filteredCycles = selectedUnit === 'all'
        ? productionCycles
        : productionCycles.filter(c => c.id.includes(selectedUnit));

      sections.push({
        title: 'Cycles de Production',
        type: 'summary',
        summary: [
          { label: 'Cycles actifs', value: filteredCycles.filter(c => c.status === 'active').length },
          { label: 'Cycles terminés', value: filteredCycles.filter(c => c.status === 'completed').length },
          { label: 'Total cycles', value: filteredCycles.length }
        ]
      });

      if (filteredCycles.length > 0) {
        sections.push({
          title: 'Détail des Cycles',
          type: 'table',
          headers: ['Nom', 'Espèce', 'Statut', 'Date début', 'Quantité actuelle', 'Objectif'],
          rows: filteredCycles.map(c => [
            c.name,
            c.species || '-',
            c.status === 'active' ? 'Actif' : 'Terminé',
            c.start_date,
            c.current_quantity.toLocaleString('fr-FR'),
            c.target_quantity.toLocaleString('fr-FR')
          ])
        });
      }
    }

    // Section santé
    if (reportType === 'health' || reportType === 'comprehensive') {
      const filteredHealth = selectedUnit === 'all'
        ? healthRecords
        : healthRecords.filter(h => (h as any).unit_id === selectedUnit);

      if (filteredHealth.length > 0) {
        const avgTemp = filteredHealth.reduce((sum, h) => sum + (h.temperature || 0), 0) / filteredHealth.length;
        const avgPh = filteredHealth.reduce((sum, h) => sum + (h.ph || 0), 0) / filteredHealth.length;
        const avgOxygen = filteredHealth.reduce((sum, h) => sum + (h.oxygen || 0), 0) / filteredHealth.length;
        const totalMortality = filteredHealth.reduce((sum, h) => sum + (h.mortality || 0), 0);

        sections.push({
          title: 'Indicateurs Sanitaires',
          type: 'summary',
          summary: [
            { label: 'Température moyenne', value: `${avgTemp.toFixed(1)}°C` },
            { label: 'pH moyen', value: avgPh.toFixed(2) },
            { label: 'Oxygène dissous moyen', value: `${avgOxygen.toFixed(1)} mg/L` },
            { label: 'Mortalité totale', value: totalMortality }
          ]
        });

        sections.push({
          title: 'Historique Sanitaire',
          type: 'table',
          headers: ['Date', 'Température (°C)', 'pH', 'Oxygène (mg/L)', 'Mortalité'],
          rows: filteredHealth.slice(0, 30).map(h => [
            h.date,
            h.temperature?.toFixed(1) || '-',
            h.ph?.toFixed(2) || '-',
            h.oxygen?.toFixed(1) || '-',
            h.mortality || 0
          ])
        });
      } else {
        sections.push({
          title: 'Indicateurs Sanitaires',
          type: 'summary',
          summary: [{ label: 'Statut', value: 'Aucune donnée sanitaire disponible' }]
        });
      }
    }

    // Section alimentation
    if (reportType === 'comprehensive') {
      const filteredFeeding = selectedUnit === 'all'
        ? feedingRecords
        : feedingRecords.filter(f => (f as any).unit_id === selectedUnit);

      if (filteredFeeding.length > 0) {
        const totalFeed = filteredFeeding.reduce((sum, f) => sum + f.quantity, 0);
        
        sections.push({
          title: 'Alimentation',
          type: 'summary',
          summary: [
            { label: 'Total aliment distribué', value: `${totalFeed.toLocaleString('fr-FR')} kg` },
            { label: 'Nombre de distributions', value: filteredFeeding.length }
          ]
        });
      }
    }

    return {
      title: getReportTitle(),
      period,
      generatedAt,
      unitName: selectedUnit !== 'all' ? unitName : undefined,
      sections
    };
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'financial': return 'Rapport Financier';
      case 'production': return 'Rapport de Production';
      case 'health': return 'Rapport Sanitaire';
      case 'comprehensive': return 'Rapport Complet';
      default: return 'Rapport';
    }
  };

  const handleExport = async (format: 'pdf' | 'excel' | 'word' | 'csv') => {
    setIsGenerating(true);
    
    try {
      const data = buildReportData();
      const filename = getReportFilename(reportType, selectedUnit !== 'all' ? getUnitName() : undefined);

      switch (format) {
        case 'pdf':
          await exportToPDF(data, filename);
          break;
        case 'excel':
          exportToExcel(data, filename);
          break;
        case 'word':
          exportToWord(data, filename);
          break;
        case 'csv':
          exportToCSV(data, filename);
          break;
      }

      toast.success(`Rapport ${format.toUpperCase()} généré avec succès`);
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sélecteurs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Unité de production</label>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une unité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les unités</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Type de rapport</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="financial">Rapport Financier</SelectItem>
              <SelectItem value="production">Rapport de Production</SelectItem>
              <SelectItem value="health">Rapport Sanitaire</SelectItem>
              <SelectItem value="comprehensive">Rapport Complet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Période</label>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="quarter">Ce trimestre</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Format d'export</label>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleExport('pdf')}
              disabled={isGenerating}
              title="Exporter en PDF"
            >
              <FileText className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleExport('excel')}
              disabled={isGenerating}
              title="Exporter en Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleExport('word')}
              disabled={isGenerating}
              title="Exporter en Word"
            >
              <File className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleExport('csv')}
              disabled={isGenerating}
              title="Exporter en CSV"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Résumé financier */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(reportData.revenue)}
                  </p>
                  <p className="text-sm text-muted-foreground">Revenus totaux</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(reportData.expenses)}
                  </p>
                  <p className="text-sm text-muted-foreground">Dépenses totales</p>
                </div>
                <Package className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(reportData.profit)}
                  </p>
                  <p className="text-sm text-muted-foreground">Bénéfice net</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aperçu du rapport */}
      <Card>
        <CardHeader>
          <CardTitle>Aperçu du rapport</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Unité sélectionnée:</span>
              <Badge variant="outline">{getUnitName()}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Type de rapport:</span>
              <Badge variant="secondary">{getReportTitle()}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Période:</span>
              <Badge>{getPeriodLabel()}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Cycles de production:</span>
              <Badge variant="outline">{productionCycles.length} cycle(s)</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Transactions:</span>
              <Badge variant="outline">{transactions.length} transaction(s)</Badge>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              Cliquez sur un bouton d'export ci-dessus pour générer le rapport dans le format souhaité.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleExport('pdf')} disabled={isGenerating}>
                <FileText className="w-4 h-4 mr-2" />
                Générer PDF
              </Button>
              <Button variant="outline" onClick={() => handleExport('excel')} disabled={isGenerating}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exporter Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport('word')} disabled={isGenerating}>
                <File className="w-4 h-4 mr-2" />
                Exporter Word
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnitReportGenerator;
