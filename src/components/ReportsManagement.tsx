import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, BarChart3, PieChart, TrendingUp, Filter, FileSpreadsheet, File, Printer, Edit2, Eye, ChevronDown, ChevronUp, Check, Building2, Fish, DollarSign, Droplets, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import UnitReportGenerator from './reports/UnitReportGenerator';
import FarmJournal from './reports/FarmJournal';
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
import CycleFinancialReport from './reports/CycleFinancialReport';
import { useCommercialData } from '@/hooks/useCommercialData';
import { buildCommercialReport, commercialReportRange, commercialReportTemplates } from '@/lib/commercialReports';

interface ReportPreviewData {
  id: string;
  title: string;
  period: string;
  generatedAt: string;
  companyName: string;
  companyAddress: string;
  notes: string;
  sections: ReportData['sections'];
}

const ProductionReportsManagement = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const { units, activeUnit, transactions, purchases, getGlobalFinancialData, convertCurrency } = useProductionUnits();
  const isCommercial = activeUnit?.type === 'commercialisation';
  const commercial = useCommercialData(activeUnit?.id, isCommercial);
  const { formatCurrency, currency } = useSettings();
  const { user } = useAuth();

  // Données réelles
  const [productionCycles, setProductionCycles] = useState<any[]>([]);
  const [healthRecords, setHealthRecords] = useState<any[]>([]);
  const [feedingRecords, setFeedingRecords] = useState<any[]>([]);
  const [livestockBatches, setLivestockBatches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [generatedReports, setGeneratedReports] = useState<any[]>([]);

  // Charger les données
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id || isCommercial) return;

      try {
        const [cyclesRes, healthRes, feedingRes, livestockRes, employeesRes] = await Promise.all([
          supabase.from('production_cycles').select('*').order('created_at', { ascending: false }),
          supabase.from('health_records').select('*').order('date', { ascending: false }).limit(200),
          supabase.from('feeding_records').select('*').order('date', { ascending: false }).limit(200),
          supabase.from('livestock_batches').select('*').order('created_at', { ascending: false }),
          supabase.from('employees').select('*').order('created_at', { ascending: false })
        ]);

        if (cyclesRes.data) setProductionCycles(cyclesRes.data);
        if (healthRes.data) setHealthRecords(healthRes.data);
        if (feedingRes.data) setFeedingRecords(feedingRes.data);
        if (livestockRes.data) setLivestockBatches(livestockRes.data);
        if (employeesRes.data) setEmployees(employeesRes.data);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
      }
    };

    fetchData();
  }, [user?.id, isCommercial]);

  const reportTypes = isCommercial ? commercialReportTemplates.map((template) => ({
    ...template, icon: template.id === 'financial' ? TrendingUp : FileText,
    frequency: 'Selon la période sélectionnée', status: commercial.error ? 'error' : commercial.isPending ? 'processing' : 'ready',
    dataCount: template.id === 'purchases' ? commercial.data?.purchases.length || 0 : template.id === 'products' ? commercial.data?.items.length || 0 : commercial.data?.sales.length || 0,
    color: 'from-primary to-ocean-primary',
  })) : [
    {
      id: 'comprehensive',
      title: 'Rapport Complet',
      description: 'Vue d\'ensemble complète de toute l\'exploitation',
      icon: FileText,
      frequency: 'Mensuel',
      status: 'ready',
      dataCount: productionCycles.length + healthRecords.length + feedingRecords.length,
      color: 'from-purple-500 to-indigo-600'
    },
    {
      id: 'production',
      title: 'Rapport de Production',
      description: 'Analyse détaillée de la production piscicole',
      icon: BarChart3,
      frequency: 'Hebdomadaire',
      status: 'ready',
      dataCount: productionCycles.length,
      color: 'from-blue-500 to-cyan-600'
    },
    {
      id: 'financial',
      title: 'Rapport Financier',
      description: 'Revenus, dépenses, bénéfices et rentabilité',
      icon: TrendingUp,
      frequency: 'Mensuel',
      status: 'ready',
      dataCount: transactions.length,
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 'health',
      title: 'Rapport Sanitaire',
      description: 'État de santé, mortalité et traitements',
      icon: Activity,
      frequency: 'Bi-hebdomadaire',
      status: 'ready',
      dataCount: healthRecords.length,
      color: 'from-red-500 to-pink-600'
    },
    {
      id: 'quality',
      title: 'Qualité de l\'Eau',
      description: 'Paramètres physicochimiques et tendances',
      icon: Droplets,
      frequency: 'Quotidien',
      status: 'ready',
      dataCount: healthRecords.length,
      color: 'from-cyan-500 to-blue-600'
    },
    {
      id: 'livestock',
      title: 'Rapport Cheptel',
      description: 'Inventaire et évolution des stocks de poissons',
      icon: Fish,
      frequency: 'Hebdomadaire',
      status: 'ready',
      dataCount: livestockBatches.length,
      color: 'from-orange-500 to-amber-600'
    }
  ];

  const getPeriodLabel = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'week':
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        return `Semaine du ${weekStart.toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')}`;
      case 'month':
        return now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      case 'quarter':
        const quarter = Math.floor(new Date().getMonth() / 3) + 1;
        return `T${quarter} ${new Date().getFullYear()}`;
      case 'year':
        return new Date().getFullYear().toString();
      default:
        return 'Période personnalisée';
    }
  };

  const buildReportData = (reportId: string): ReportData => {
    if (isCommercial) {
      if (!activeUnit || !commercial.data || commercial.error) throw new Error('Les données commerciales ne sont pas disponibles.');
      const range = commercialReportRange(selectedPeriod);
      return buildCommercialReport({ id: reportId, unitId: activeUnit.id, unitName: activeUnit.name, ...range, ...commercial.data, money: formatCurrency, convert: (amount, from) => convertCurrency(amount, from, currency) });
    }
    const financialData = getGlobalFinancialData();
    const period = getPeriodLabel();
    const generatedAt = new Date().toLocaleString('fr-FR');

    const sections: ReportData['sections'] = [];

    // Helper to calculate stats
    const calcStats = (values: number[]) => {
      if (values.length === 0) return { avg: 0, min: 0, max: 0 };
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return { avg, min: Math.min(...values), max: Math.max(...values) };
    };

    switch (reportId) {
      case 'comprehensive':
        // Section 1: Résumé exécutif
        sections.push({
          title: '📊 Résumé Exécutif',
          type: 'summary',
          summary: [
            { label: 'Unités de production', value: units.length },
            { label: 'Cycles actifs', value: productionCycles.filter(c => c.status === 'active').length },
            { label: 'Lots de poissons', value: livestockBatches.length },
            { label: 'Revenus totaux', value: formatCurrency(financialData.revenue) },
            { label: 'Bénéfice net', value: formatCurrency(financialData.profit) },
            { label: 'Employés', value: employees.length }
          ]
        });

        // Section 2: Production
        if (productionCycles.length > 0) {
          sections.push({
            title: '🐟 Production',
            type: 'table',
            headers: ['Cycle', 'Unité', 'Espèce', 'Statut', 'Quantité actuelle', 'Objectif', 'Progression'],
            rows: productionCycles.slice(0, 15).map(c => {
              const progress = c.target_quantity ? ((c.current_quantity || 0) / c.target_quantity * 100).toFixed(0) + '%' : '-';
              return [
                c.name,
                c.unit_name || '-',
                c.species || '-',
                c.status === 'active' ? '✅ Actif' : '⏹️ Terminé',
                c.current_quantity?.toLocaleString('fr-FR') || '0',
                c.target_quantity?.toLocaleString('fr-FR') || '0',
                progress
              ];
            })
          });
        }

        // Section 3: Finances
        sections.push({
          title: '💰 Finances',
          type: 'summary',
          summary: [
            { label: 'Revenus', value: formatCurrency(financialData.revenue) },
            { label: 'Dépenses', value: formatCurrency(financialData.expenses) },
            { label: 'Bénéfice', value: formatCurrency(financialData.profit) },
            { label: 'Marge bénéficiaire', value: financialData.revenue ? `${((financialData.profit / financialData.revenue) * 100).toFixed(1)}%` : '0%' }
          ]
        });

        // Section 4: Santé
        if (healthRecords.length > 0) {
          const temps = healthRecords.filter(h => h.temperature).map(h => h.temperature);
          const phs = healthRecords.filter(h => h.ph).map(h => h.ph);
          const oxygens = healthRecords.filter(h => h.oxygen).map(h => h.oxygen);
          const tempStats = calcStats(temps);
          const phStats = calcStats(phs);
          const oxygenStats = calcStats(oxygens);
          const totalMortality = healthRecords.reduce((sum, h) => sum + (h.mortality || 0), 0);

          sections.push({
            title: '🏥 Indicateurs Sanitaires',
            type: 'summary',
            summary: [
              { label: 'Température moyenne', value: `${tempStats.avg.toFixed(1)}°C (min: ${tempStats.min.toFixed(1)}, max: ${tempStats.max.toFixed(1)})` },
              { label: 'pH moyen', value: `${phStats.avg.toFixed(2)} (min: ${phStats.min.toFixed(2)}, max: ${phStats.max.toFixed(2)})` },
              { label: 'Oxygène moyen', value: `${oxygenStats.avg.toFixed(1)} mg/L` },
              { label: 'Mortalité totale période', value: totalMortality.toLocaleString('fr-FR') }
            ]
          });
        }

        // Section 5: Alimentation
        if (feedingRecords.length > 0) {
          const totalFeed = feedingRecords.reduce((sum, f) => sum + (f.quantity || 0), 0);
          const avgFCR = feedingRecords.filter(f => f.fcr).reduce((sum, f, _, arr) => sum + (f.fcr || 0) / arr.length, 0);

          sections.push({
            title: '🍽️ Alimentation',
            type: 'summary',
            summary: [
              { label: 'Distributions', value: feedingRecords.length },
              { label: 'Quantité totale distribuée', value: `${totalFeed.toLocaleString('fr-FR')} kg` },
              { label: 'FCR moyen', value: avgFCR ? avgFCR.toFixed(2) : 'N/A' },
              { label: 'Distribution moyenne/jour', value: `${(totalFeed / 30).toFixed(1)} kg` }
            ]
          });
        }
        break;

      case 'production':
        sections.push({
          title: '📊 Résumé de Production',
          type: 'summary',
          summary: [
            { label: 'Cycles actifs', value: productionCycles.filter(c => c.status === 'active').length },
            { label: 'Cycles terminés', value: productionCycles.filter(c => c.status === 'completed').length },
            { label: 'Total unités', value: units.length },
            { label: 'Distributions d\'aliment', value: feedingRecords.length },
            { label: 'Lots de poissons', value: livestockBatches.length }
          ]
        });

        if (productionCycles.length > 0) {
          sections.push({
            title: '🐟 Détail des Cycles de Production',
            type: 'table',
            headers: ['Nom', 'Unité', 'Espèce', 'Statut', 'Date début', 'Quantité actuelle', 'Objectif', 'Progression'],
            rows: productionCycles.map(c => {
              const progress = c.target_quantity ? ((c.current_quantity || 0) / c.target_quantity * 100).toFixed(0) + '%' : '-';
              return [
                c.name,
                c.unit_name || '-',
                c.species || '-',
                c.status === 'active' ? '✅ Actif' : '⏹️ Terminé',
                c.start_date,
                c.current_quantity?.toLocaleString('fr-FR') || '0',
                c.target_quantity?.toLocaleString('fr-FR') || '0',
                progress
              ];
            })
          });
        }

        // Stats par espèce
        const speciesStats: Record<string, { count: number; quantity: number }> = productionCycles.reduce((acc, c) => {
          const species = c.species || 'Autre';
          if (!acc[species]) acc[species] = { count: 0, quantity: 0 };
          acc[species].count++;
          acc[species].quantity += c.current_quantity || 0;
          return acc;
        }, {} as Record<string, { count: number; quantity: number }>);

        if (Object.keys(speciesStats).length > 0) {
          sections.push({
            title: '📈 Répartition par Espèce',
            type: 'table',
            headers: ['Espèce', 'Nombre de cycles', 'Quantité totale'],
            rows: Object.entries(speciesStats).map(([species, stats]) => [
              species,
              stats.count.toString(),
              stats.quantity.toLocaleString('fr-FR')
            ])
          });
        }
        break;

      case 'financial':
        sections.push({
          title: '💰 Résumé Financier',
          type: 'summary',
          summary: [
            { label: 'Revenus totaux', value: formatCurrency(financialData.revenue) },
            { label: 'Dépenses totales', value: formatCurrency(financialData.expenses) },
            { label: 'Bénéfice net', value: formatCurrency(financialData.profit) },
            { label: 'Marge bénéficiaire', value: financialData.revenue ? `${((financialData.profit / financialData.revenue) * 100).toFixed(1)}%` : '0%' },
            { label: 'Nombre de transactions', value: transactions.length }
          ]
        });

        if (transactions.length > 0) {
          const revenues = transactions.filter(t => t.type === 'revenue');
          const expenses = transactions.filter(t => t.type === 'expense');
          
          // Répartition par catégorie (revenus)
          const revenueByCategory = revenues.reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
          }, {} as Record<string, number>);

          if (Object.keys(revenueByCategory).length > 0) {
            sections.push({
              title: '📈 Revenus par Catégorie',
              type: 'table',
              headers: ['Catégorie', 'Montant', 'Part'],
              rows: Object.entries(revenueByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => [
                  cat,
                  formatCurrency(amount),
                  `${((amount / financialData.revenue) * 100).toFixed(1)}%`
                ])
            });
          }

          // Répartition par catégorie (dépenses)
          const expenseByCategory = expenses.reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
            return acc;
          }, {} as Record<string, number>);

          if (Object.keys(expenseByCategory).length > 0) {
            sections.push({
              title: '📉 Dépenses par Catégorie',
              type: 'table',
              headers: ['Catégorie', 'Montant', 'Part'],
              rows: Object.entries(expenseByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => [
                  cat,
                  formatCurrency(amount),
                  `${((amount / financialData.expenses) * 100).toFixed(1)}%`
                ])
            });
          }

          // Dernières transactions
          sections.push({
            title: '📋 Dernières Transactions',
            type: 'table',
            headers: ['Date', 'Type', 'Catégorie', 'Description', 'Montant'],
            rows: transactions.slice(0, 20).map(t => [
              t.date,
              t.type === 'revenue' ? '💵 Revenu' : '💸 Dépense',
              t.category,
              t.description || '-',
              formatCurrency(t.amount)
            ])
          });
        }
        break;

      case 'health':
        if (healthRecords.length > 0) {
          const temps = healthRecords.filter(h => h.temperature).map(h => h.temperature);
          const phs = healthRecords.filter(h => h.ph).map(h => h.ph);
          const oxygens = healthRecords.filter(h => h.oxygen).map(h => h.oxygen);
          const tempStats = calcStats(temps);
          const phStats = calcStats(phs);
          const oxygenStats = calcStats(oxygens);
          const totalMortality = healthRecords.reduce((sum, h) => sum + (h.mortality || 0), 0);

          sections.push({
            title: '🏥 Indicateurs Sanitaires Globaux',
            type: 'summary',
            summary: [
              { label: 'Nombre d\'enregistrements', value: healthRecords.length },
              { label: 'Température moyenne', value: `${tempStats.avg.toFixed(1)}°C` },
              { label: 'Plage de température', value: `${tempStats.min.toFixed(1)}°C - ${tempStats.max.toFixed(1)}°C` },
              { label: 'pH moyen', value: phStats.avg.toFixed(2) },
              { label: 'Plage pH', value: `${phStats.min.toFixed(2)} - ${phStats.max.toFixed(2)}` },
              { label: 'Oxygène moyen', value: `${oxygenStats.avg.toFixed(1)} mg/L` },
              { label: 'Mortalité totale', value: totalMortality.toLocaleString('fr-FR') }
            ]
          });

          // Alertes potentielles
          const alerts: string[] = [];
          if (tempStats.max > 32) alerts.push(`⚠️ Température maximale élevée: ${tempStats.max.toFixed(1)}°C`);
          if (tempStats.min < 20) alerts.push(`⚠️ Température minimale basse: ${tempStats.min.toFixed(1)}°C`);
          if (phStats.max > 9) alerts.push(`⚠️ pH maximum élevé: ${phStats.max.toFixed(2)}`);
          if (phStats.min < 6) alerts.push(`⚠️ pH minimum bas: ${phStats.min.toFixed(2)}`);
          if (oxygenStats.min < 4) alerts.push(`⚠️ Oxygène minimum critique: ${oxygenStats.min.toFixed(1)} mg/L`);

          if (alerts.length > 0) {
            sections.push({
              title: '⚠️ Alertes et Points d\'Attention',
              type: 'summary',
              summary: alerts.map((a, i) => ({ label: `Alerte ${i + 1}`, value: a }))
            });
          }

          sections.push({
            title: '📋 Historique Sanitaire Détaillé',
            type: 'table',
            headers: ['Date', 'Température (°C)', 'pH', 'Oxygène (mg/L)', 'Mortalité', 'Notes'],
            rows: healthRecords.slice(0, 50).map(h => [
              h.date,
              h.temperature ? h.temperature.toFixed(1) : '-',
              h.ph?.toFixed(2) || '-',
              h.oxygen ? h.oxygen.toFixed(1) : '-',
              h.mortality || '0',
              h.notes || '-'
            ])
          });
        } else {
          sections.push({
            title: '🏥 Indicateurs Sanitaires',
            type: 'summary',
            summary: [{ label: 'Statut', value: 'Aucune donnée sanitaire disponible pour cette période' }]
          });
        }
        break;

      case 'quality':
        if (healthRecords.length > 0) {
          const temps = healthRecords.filter(h => h.temperature).map(h => h.temperature);
          const phs = healthRecords.filter(h => h.ph).map(h => h.ph);
          const oxygens = healthRecords.filter(h => h.oxygen).map(h => h.oxygen);
          const tempStats = calcStats(temps);
          const phStats = calcStats(phs);
          const oxygenStats = calcStats(oxygens);

          sections.push({
            title: '💧 Qualité de l\'Eau - Synthèse',
            type: 'summary',
            summary: [
              { label: 'Mesures analysées', value: healthRecords.length },
              { label: 'Température', value: `Moy: ${tempStats.avg.toFixed(1)}°C | Min: ${tempStats.min.toFixed(1)}°C | Max: ${tempStats.max.toFixed(1)}°C` },
              { label: 'pH', value: `Moy: ${phStats.avg.toFixed(2)} | Min: ${phStats.min.toFixed(2)} | Max: ${phStats.max.toFixed(2)}` },
              { label: 'Oxygène dissous', value: `Moy: ${oxygenStats.avg.toFixed(1)} mg/L | Min: ${oxygenStats.min.toFixed(1)} mg/L | Max: ${oxygenStats.max.toFixed(1)} mg/L` }
            ]
          });

          // Évaluation de la qualité
          let qualityScore = 100;
          const issues: string[] = [];
          
          if (tempStats.max > 32 || tempStats.min < 18) {
            qualityScore -= 20;
            issues.push('Température hors plage optimale');
          }
          if (phStats.max > 9 || phStats.min < 6.5) {
            qualityScore -= 20;
            issues.push('pH hors plage optimale');
          }
          if (oxygenStats.min < 5) {
            qualityScore -= 30;
            issues.push('Oxygène insuffisant détecté');
          }

          sections.push({
            title: '📊 Évaluation Qualité',
            type: 'summary',
            summary: [
              { label: 'Score qualité', value: `${qualityScore}%` },
              { label: 'État général', value: qualityScore >= 80 ? '✅ Bon' : qualityScore >= 60 ? '⚠️ Attention' : '❌ Critique' },
              { label: 'Points d\'attention', value: issues.length > 0 ? issues.join(', ') : 'Aucun problème détecté' }
            ]
          });

          sections.push({
            title: '📈 Relevés Détaillés',
            type: 'table',
            headers: ['Date', 'Température (°C)', 'pH', 'Oxygène (mg/L)', 'Statut'],
            rows: healthRecords.slice(0, 60).map(h => {
              let status = '✅';
              if ((h.temperature && (h.temperature > 32 || h.temperature < 18)) ||
                  (h.ph && (h.ph > 9 || h.ph < 6.5)) ||
                  (h.oxygen && h.oxygen < 5)) {
                status = '⚠️';
              }
              return [
                h.date,
                h.temperature?.toFixed(1) || '-',
                h.ph?.toFixed(2) || '-',
                h.oxygen?.toFixed(1) || '-',
                status
              ];
            })
          });
        } else {
          sections.push({
            title: '💧 Qualité de l\'Eau',
            type: 'summary',
            summary: [{ label: 'Statut', value: 'Aucune mesure de qualité d\'eau disponible' }]
          });
        }
        break;

      case 'livestock':
        sections.push({
          title: '🐟 Inventaire du Cheptel',
          type: 'summary',
          summary: [
            { label: 'Nombre de lots', value: livestockBatches.length },
            { label: 'Lots actifs', value: livestockBatches.filter(l => l.status === 'active').length },
            { label: 'Quantité totale', value: livestockBatches.reduce((sum, l) => sum + (l.quantity || 0), 0).toLocaleString('fr-FR') },
            { label: 'Poids total', value: `${livestockBatches.reduce((sum, l) => sum + (l.total_weight || 0), 0).toLocaleString('fr-FR')} kg` }
          ]
        });

        if (livestockBatches.length > 0) {
          sections.push({
            title: '📋 Détail des Lots',
            type: 'table',
            headers: ['Espèce', 'Variété', 'Unité', 'Quantité', 'Poids moyen', 'Statut', 'Date acquisition'],
            rows: livestockBatches.map(l => [
              l.species || '-',
              l.variety || '-',
              l.unit_name || '-',
              l.quantity?.toLocaleString('fr-FR') || '0',
              l.average_weight ? `${l.average_weight.toFixed(1)} g` : '-',
              l.status === 'active' ? '✅ Actif' : '⏹️ Terminé',
              l.acquisition_date || '-'
            ])
          });

          // Stats par espèce
          const speciesData: Record<string, { count: number; quantity: number; weight: number }> = livestockBatches.reduce((acc, l) => {
            const species = l.species || 'Autre';
            if (!acc[species]) acc[species] = { count: 0, quantity: 0, weight: 0 };
            acc[species].count++;
            acc[species].quantity += l.quantity || 0;
            acc[species].weight += l.total_weight || 0;
            return acc;
          }, {} as Record<string, { count: number; quantity: number; weight: number }>);

          sections.push({
            title: '📊 Répartition par Espèce',
            type: 'table',
            headers: ['Espèce', 'Nombre de lots', 'Quantité totale', 'Poids total'],
            rows: Object.entries(speciesData).map(([species, data]) => [
              species,
              data.count.toString(),
              data.quantity.toLocaleString('fr-FR'),
              `${data.weight.toLocaleString('fr-FR')} kg`
            ])
          });
        }
        break;
    }

    return {
      title: reportTypes.find(r => r.id === reportId)?.title || 'Rapport',
      period,
      generatedAt,
      sections,
      companyInfo: {
        name: user?.name || 'Mon Exploitation',
        address: ''
      }
    };
  };

  const openPreview = (reportId: string) => {
    if (isCommercial && (!commercial.data || commercial.error)) {
      toast.error('Les données commerciales ne sont pas disponibles. Réessayez.');
      return;
    }
    const data = buildReportData(reportId);
    setPreviewData({
      id: reportId,
      title: data.title,
      period: data.period,
      generatedAt: data.generatedAt,
      companyName: data.companyInfo?.name || user?.name || 'Mon Exploitation',
      companyAddress: data.companyInfo?.address || '',
      notes: '',
      sections: data.sections
    });
    setExpandedSections(data.sections.reduce((acc, _, i) => ({ ...acc, [i]: true }), {}));
    setPreviewOpen(true);
    setEditMode(false);
  };

  const handleExportFromPreview = async (format: string) => {
    if (!previewData) return;

    const data: ReportData = {
      title: previewData.title,
      period: previewData.period,
      generatedAt: previewData.generatedAt,
      sections: previewData.sections,
      companyInfo: {
        name: previewData.companyName,
        address: previewData.companyAddress
      }
    };

    const filename = getReportFilename(previewData.id);

    switch (format) {
      case 'pdf':
        await exportToPDF(data, filename);
        break;
      case 'excel':
        exportToExcel(data, filename);
        break;
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'word':
        exportToWord(data, filename);
        break;
    }

    // Ajouter à l'historique
    const newReport = {
      id: Date.now(),
      name: `${previewData.title} - ${previewData.period}`,
      type: format.toUpperCase(),
      date: new Date().toLocaleDateString('fr-FR'),
      size: '~50 KB',
      downloads: 1
    };
    setGeneratedReports(prev => [newReport, ...prev].slice(0, 20));

    toast.success(`${previewData.title} exporté en ${format.toUpperCase()}`);
  };

  const handleGenerateReport = async (reportId: string, format: string) => {
    setIsGenerating(reportId);

    try {
      const data = buildReportData(reportId);
      const filename = getReportFilename(reportId);

      switch (format) {
        case 'pdf':
          await exportToPDF(data, filename);
          break;
        case 'excel':
          exportToExcel(data, filename);
          break;
        case 'csv':
          exportToCSV(data, filename);
          break;
        case 'word':
          exportToWord(data, filename);
          break;
      }

      const newReport = {
        id: Date.now(),
        name: `${data.title} - ${data.period}`,
        type: format.toUpperCase(),
        date: new Date().toLocaleDateString('fr-FR'),
        size: '~50 KB',
        downloads: 1
      };
      setGeneratedReports(prev => [newReport, ...prev].slice(0, 20));

      toast.success(`${data.title} généré en ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la génération du rapport');
    } finally {
      setIsGenerating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready': return 'Prêt';
      case 'processing': return 'En cours';
      case 'error': return 'Erreur';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 rounded-xl text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <FileText className="w-7 h-7" />
              {isCommercial ? 'Journal commercial' : 'Journal de ferme'}
            </h2>
            <p className="text-indigo-100">{isCommercial ? `${activeUnit?.name} · Journal des ventes, achats et rapports détaillés` : 'Journal quotidien par unité et rapports détaillés (jour, semaine, mois, trimestre)'}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-36 bg-white/20 border-white/30 text-white">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Année</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger className="w-28 bg-white/20 border-white/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="word">Word</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="flex items-center p-4 md:p-6">
            <div className="p-3 bg-blue-500 rounded-xl mr-3">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-blue-900">{generatedReports.length}</p>
              <p className="text-xs text-blue-600">Rapports générés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="flex items-center p-4 md:p-6">
            <div className="p-3 bg-green-500 rounded-xl mr-3">
              <Download className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-green-900">{generatedReports.reduce((sum, r) => sum + r.downloads, 0)}</p>
              <p className="text-xs text-green-600">Téléchargements</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="flex items-center p-4 md:p-6">
            <div className="p-3 bg-purple-500 rounded-xl mr-3">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-purple-900">{isCommercial ? (commercial.data ? commercial.data.sales.filter(s => s.status !== 'cancelled').length : '—') : productionCycles.filter(c => c.status === 'active').length}</p>
              <p className="text-xs text-purple-600">{isCommercial ? 'Ventes enregistrées' : 'Cycles actifs'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="flex items-center p-4 md:p-6">
            <div className="p-3 bg-orange-500 rounded-xl mr-3">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg md:text-2xl font-bold text-orange-900">{reportTypes.length}</p>
              <p className="text-xs text-orange-600">Types de rapports</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      {isCommercial && commercial.error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">Les données commerciales sont indisponibles.<Button variant="outline" size="sm" onClick={() => void commercial.refetch()}>Réessayer</Button></div>}
      <Tabs defaultValue="journal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
          <TabsTrigger value="journal" className="text-sm">📔 Journal</TabsTrigger>
          <TabsTrigger value="finance" className="text-sm">💰 Financier</TabsTrigger>
          <TabsTrigger value="generate" className="text-sm">📄 Générer</TabsTrigger>
          <TabsTrigger value="units" className="text-sm">🏢 Par Unité</TabsTrigger>
          <TabsTrigger value="history" className="text-sm">📚 Historique</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-sm">⏰ Programmés</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          {isCommercial ? <Card><CardHeader><CardTitle className="text-lg">Journal commercial</CardTitle><CardDescription>{activeUnit?.name} · {getPeriodLabel()}</CardDescription></CardHeader><CardContent className="space-y-4">{commercial.isPending ? <p className="text-muted-foreground">Chargement des opérations…</p> : commercial.data && !commercial.error ? <><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Date</th><th className="text-left">Opération</th><th className="text-right">Montant</th></tr></thead><tbody>{[...commercial.data.sales.filter(s => s.status !== 'cancelled').map(s => ({ date: s.date, type: 'Vente', amount: Number(s.total_amount) })), ...commercial.data.purchases.filter(p => p.status !== 'cancelled').map(p => ({ date: p.date, type: 'Achat', amount: convertCurrency(Number(p.amount), p.currency || 'XOF', currency) }))].filter(r => { const range = commercialReportRange(selectedPeriod); return r.date >= range.start && r.date <= range.end; }).sort((a,b) => b.date.localeCompare(a.date)).map((r,i) => <tr key={i} className="border-b"><td className="py-3">{r.date}</td><td>{r.type}</td><td className="text-right tabular-nums">{formatCurrency(r.amount)}</td></tr>)}</tbody></table></div><Button variant="outline" onClick={() => openPreview('comprehensive')}><Eye className="size-4"/>Aperçu du journal</Button><Button onClick={() => handleGenerateReport('comprehensive', selectedFormat)}><Download className="size-4"/>{selectedFormat.toUpperCase()}</Button></> : null}</CardContent></Card> : <FarmJournal />}
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          {isCommercial ? <Card><CardHeader><CardTitle>Rapport Financier</CardTitle><CardDescription>{activeUnit?.name} · {getPeriodLabel()}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openPreview('financial')}><Eye className="size-4"/>Aperçu</Button><Button disabled={!commercial.data || Boolean(commercial.error)} onClick={() => handleGenerateReport('financial', selectedFormat)}><Download className="size-4"/>{selectedFormat.toUpperCase()}</Button></CardContent></Card> : <CycleFinancialReport />}
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {reportTypes.map((report) => {
              const IconComponent = report.icon;
              return (
                <Card key={report.id} className="hover:shadow-lg transition-all duration-300 overflow-hidden group">
                  <div className={`h-2 bg-gradient-to-r ${report.color}`} />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${report.color} shadow-lg`}>
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{report.title}</CardTitle>
                          <CardDescription className="text-sm mt-1">{report.description}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Données disponibles:</span>
                        <Badge variant="secondary" className="font-semibold">{report.dataCount}</Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Fréquence:</span>
                        <span className="font-medium">{report.frequency}</span>
                      </div>
                      <Separator />
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => openPreview(report.id)}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Aperçu
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleGenerateReport(report.id, selectedFormat)}
                          disabled={isGenerating === report.id || (isCommercial && (!commercial.data || Boolean(commercial.error)))}
                          className={`flex-1 bg-gradient-to-r ${report.color} hover:opacity-90`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          {selectedFormat.toUpperCase()}
                        </Button>
                      </div>
                      <div className="flex justify-center gap-1 pt-2">
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleGenerateReport(report.id, 'pdf')}
                          disabled={isGenerating === report.id}
                          title="PDF"
                        >
                          <FileText className="w-4 h-4 text-red-600" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleGenerateReport(report.id, 'excel')}
                          disabled={isGenerating === report.id}
                          title="Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleGenerateReport(report.id, 'word')}
                          disabled={isGenerating === report.id}
                          title="Word"
                        >
                          <File className="w-4 h-4 text-blue-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          {isCommercial ? <Card><CardHeader><CardTitle>{activeUnit?.name}</CardTitle><CardDescription>Rapports de l’unité commerciale active · {getPeriodLabel()}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{reportTypes.map(r => <Button key={r.id} variant="outline" onClick={() => openPreview(r.id)}><FileText className="size-4"/>{r.title}</Button>)}</CardContent></Card> : <UnitReportGenerator />}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="text-lg font-medium">📚 Rapports Générés</h3>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtrer
            </Button>
          </div>
          
          <Card>
            <CardContent className={generatedReports.length === 0 ? "p-8" : "p-0"}>
              {generatedReports.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Aucun rapport généré</p>
                  <p className="text-sm mt-2">Les rapports que vous générez apparaîtront ici</p>
                </div>
              ) : (
                <div className="divide-y">
                  {generatedReports.map((report) => (
                    <div key={report.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{report.name}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <span>Format: {report.type}</span>
                              <span>Taille: {report.size}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{report.date}</span>
                          <Badge variant="outline">{report.type}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>⏰ Rapports Programmés</CardTitle>
              <CardDescription>Configuration des générations automatiques</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Fonctionnalité en développement</p>
                <p className="text-sm mt-2">La programmation automatique des rapports sera bientôt disponible</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Aperçu du rapport */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {previewData?.title}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  {editMode ? 'Terminer' : 'Modifier'}
                </Button>
              </div>
            </div>
            {previewData && (
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">📅 {previewData.period}</Badge>
                <Badge variant="secondary">🕐 Généré le {previewData.generatedAt}</Badge>
              </div>
            )}
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {previewData && (
              <div className="space-y-6 py-4">
                {/* En-tête entreprise */}
                <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
                  <CardContent className="p-4">
                    {editMode ? (
                      <div className="grid gap-4">
                        <div>
                          <Label>Nom de l'entreprise</Label>
                          <Input 
                            value={previewData.companyName}
                            onChange={(e) => setPreviewData({ ...previewData, companyName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Adresse</Label>
                          <Input 
                            value={previewData.companyAddress}
                            onChange={(e) => setPreviewData({ ...previewData, companyAddress: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <h3 className="text-xl font-bold text-slate-800">{previewData.companyName}</h3>
                        {previewData.companyAddress && (
                          <p className="text-sm text-slate-600">{previewData.companyAddress}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sections du rapport */}
                {previewData.sections.map((section, index) => (
                  <Collapsible 
                    key={index}
                    open={expandedSections[index]}
                    onOpenChange={(open) => setExpandedSections({ ...expandedSections, [index]: open })}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{section.title}</CardTitle>
                            {expandedSections[index] ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          {section.type === 'summary' && section.summary && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {section.summary.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">{item.label}</span>
                                  <span className="font-semibold">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {section.type === 'table' && section.headers && section.rows && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50">
                                    {section.headers.map((header, i) => (
                                      <th key={i} className="p-2 text-left font-semibold">{header}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rows.slice(0, 20).map((row, i) => (
                                    <tr key={i} className="border-b hover:bg-muted/30">
                                      {row.map((cell, j) => (
                                        <td key={j} className="p-2">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {section.rows.length > 20 && (
                                <p className="text-sm text-muted-foreground text-center mt-2">
                                  ... et {section.rows.length - 20} lignes supplémentaires
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}

                {/* Notes */}
                {editMode && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">📝 Notes additionnelles</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea 
                        placeholder="Ajoutez des notes ou commentaires au rapport..."
                        value={previewData.notes}
                        onChange={(e) => setPreviewData({ ...previewData, notes: e.target.value })}
                        rows={4}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <div className="flex flex-wrap gap-2 w-full justify-between">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Fermer
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleExportFromPreview('pdf')}>
                  <FileText className="w-4 h-4 mr-1 text-red-600" />
                  PDF
                </Button>
                <Button variant="outline" onClick={() => handleExportFromPreview('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
                  Excel
                </Button>
                <Button variant="outline" onClick={() => handleExportFromPreview('word')}>
                  <File className="w-4 h-4 mr-1 text-blue-600" />
                  Word
                </Button>
                <Button onClick={() => handleExportFromPreview('pdf')} className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  <Printer className="w-4 h-4 mr-1" />
                  Imprimer
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ReportsManagement = () => {
  const { activeUnit } = useProductionUnits();
  return <ProductionReportsManagement key={activeUnit?.id} />;
};
export default ReportsManagement;
