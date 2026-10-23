import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Fish, Factory, Thermometer, Activity, TrendingUp, Settings, AlertTriangle, Clock, Heart, Egg, Scale, Droplets, UtensilsCrossed, DollarSign, ShoppingCart, Users, TrendingDown } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import RestockSummary from './dashboard/RestockSummary';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import ProductionUnitSelector from './ProductionUnitSelector';
import AlertsPanel from './AlertsPanel';
import farmBackground from '@/assets/aquaculture-cages-desktop.jpg';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useReproductionRecords } from '@/hooks/useReproductionRecords';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { differenceInDays, parseISO } from 'date-fns';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const IntelligentDashboard = () => {
  const {
    activeUnit,
    getUnitInfrastructures,
    getUnitEquipment,
    getUnitFinancialData,
    getGlobalFinancialData,
    depreciableAssets,
    calculateDepreciation,
    convertCurrency,
    currency
  } = useProductionUnits();
  const {
    formatCurrency,
    t,
    language,
  } = useSettings();
  const { isDemoMode } = useAuth();
  const [viewMode, setViewMode] = useState<'unit' | 'global'>('unit');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Hook pour les données financières consolidées
  const financialSummary = useFinancialSummary(activeUnit?.id);
  
  // Hooks pour récupérer les vraies données
  const { records: feedingRecords } = useFeedingRecords();
  const { records: healthRecords } = useHealthRecords();
  const { records: reproductionRecords } = useReproductionRecords();
  const { batches } = useLivestockBatches();
  
  // Hook pour les cycles de production (données réelles de la DB)
  const { cycles: allCycles } = useProductionCycles();
  
  const unitInfrastructures = activeUnit ? getUnitInfrastructures(activeUnit.id) : [];
  const unitEquipment = activeUnit ? getUnitEquipment(activeUnit.id) : [];
  
  // Utiliser les cycles réels de la base de données
  const unitCycles = activeUnit 
    ? allCycles.filter(c => c.unit_id === activeUnit.id) 
    : allCycles;
    
  const unitFinancialData = activeUnit ? getUnitFinancialData(activeUnit.id) : null;
  const globalFinancialData = getGlobalFinancialData();
  const currentFinancialData = viewMode === 'global' ? globalFinancialData : unitFinancialData;

  // Filtrer les données par unité active
  const unitFeedingRecords = activeUnit 
    ? feedingRecords.filter(r => r.unit_id === activeUnit.id) 
    : [];
  const unitHealthRecords = activeUnit 
    ? healthRecords.filter(r => r.unit_id === activeUnit.id) 
    : [];
  const unitReproductionRecords = activeUnit 
    ? reproductionRecords.filter(r => r.unit_id === activeUnit.id) 
    : [];
  const unitBatches = activeUnit 
    ? batches.filter(b => b.unit_id === activeUnit.id) 
    : [];

  // Synchroniser l'heure de dernière mise à jour
  useEffect(() => {
    setLastUpdate(new Date());
  }, [activeUnit, viewMode]);

  const formatLastUpdate = () => {
    const now = new Date();
    const isToday = now.toDateString() === lastUpdate.toDateString();
    const hours = lastUpdate.getHours().toString().padStart(2, '0');
    const minutes = lastUpdate.getMinutes().toString().padStart(2, '0');

    const locale =
      language === 'fr' ? 'fr-FR' :
      language === 'en' ? 'en-GB' :
      language === 'es' ? 'es-ES' :
      language === 'pt' ? 'pt-PT' :
      'ar';

    return isToday
      ? `${t('today')}, ${hours}:${minutes}`
      : `${lastUpdate.toLocaleDateString(locale)}, ${hours}:${minutes}`;
  };

  // Calculer les données d'alimentation des 7 derniers jours (vraies données)
  const feedingChartData = React.useMemo(() => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    return last7Days.map(date => {
      const dayRecords = unitFeedingRecords.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate.toDateString() === date.toDateString();
      });
      const totalQuantity = dayRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
      return {
        jour: days[date.getDay()],
        quantite: Math.round(totalQuantity * 100) / 100,
        cout: 0
      };
    });
  }, [unitFeedingRecords]);

  // Calculer les données de mortalité des 4 dernières semaines (vraies données)
  const mortalityData = React.useMemo(() => {
    const weeks: { semaine: string; mortalite: number; objectif: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - (i * 7));
      
      const weekRecords = unitHealthRecords.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= weekStart && recordDate < weekEnd;
      });
      
      const totalMortality = weekRecords.reduce((sum, r) => sum + (r.mortality || 0), 0);
      weeks.push({
        semaine: `S${4 - i}`,
        mortalite: totalMortality,
        objectif: 15
      });
    }
    return weeks;
  }, [unitHealthRecords]);

  // Calculer les données de qualité de l'eau (vraies données du jour)
  const waterQualityData = React.useMemo(() => {
    const today = new Date().toDateString();
    const todayRecords = unitHealthRecords.filter(r => 
      new Date(r.date).toDateString() === today
    );
    
    if (todayRecords.length === 0) return [];
    
    // Prendre les derniers enregistrements disponibles
    return todayRecords.slice(-6).map((r, i) => ({
      heure: `${(6 + i * 3).toString().padStart(2, '0')}h`,
      temperature: r.temperature || 0,
      ph: r.ph || 0,
      oxygene: r.oxygen || 0
    }));
  }, [unitHealthRecords]);

  // Calculer la production par espèce (vraies données)
  const productionBySpecies = React.useMemo(() => {
    const speciesCount: Record<string, number> = {};
    
    unitBatches.forEach(batch => {
      const species = batch.species || 'Autres';
      speciesCount[species] = (speciesCount[species] || 0) + (batch.quantity || 0);
    });
    
    return Object.entries(speciesCount).map(([name, value]) => ({ name, value }));
  }, [unitBatches]);

  // Vérifier si on a des données réelles pour afficher les graphiques
  const hasFeedingData = feedingChartData.some(d => d.quantite > 0);
  const hasMortalityData = mortalityData.some(d => d.mortalite > 0);
  const hasWaterQualityData = waterQualityData.length > 0;
  const hasProductionData = productionBySpecies.length > 0;

  const getUnitSpecificData = () => {
    if (!activeUnit) return {
      metrics: [],
      livestock: null
    };

    // Calculer les vraies métriques à partir des données
    const activeCycles = unitCycles.filter(c => c.status === 'active');
    const totalBatchQuantity = unitBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    
    const baseMetrics = [{
      title: t('active_cycles_label'),
      value: activeCycles.length.toString(),
      subtitle: `${unitCycles.length} ${t('total_label')}`,
      icon: Activity,
      color: "green"
    }];

    // Calculer les vraies données pour écloserie
    if (activeUnit.type === 'ecloserie') {
      const maleCount = unitBatches.filter(b => b.type === 'geniteurs' || b.species?.toLowerCase().includes('male')).reduce((sum, b) => sum + (b.quantity || 0), 0);
      const femaleCount = unitBatches.filter(b => b.type === 'geniteurs' || b.species?.toLowerCase().includes('femelle')).reduce((sum, b) => sum + (b.quantity || 0), 0);
      const alevinsCount = unitBatches.filter(b => b.type === 'alevins').reduce((sum, b) => sum + (b.quantity || 0), 0);
      
      // Données de reproduction
      const latestRepro = unitReproductionRecords.length > 0 ? unitReproductionRecords[0] : null;
      const fertilityRate = latestRepro?.fertilization_rate || 0;
      const fryCount = latestRepro?.fry_count || alevinsCount;

      return {
        metrics: [...baseMetrics, {
          title: t('male_breeders'),
          value: maleCount > 0 ? maleCount.toLocaleString() : "0",
          subtitle: maleCount > 0 ? t('mature_breeding') : t('none_registered'),
          icon: Fish,
          color: "blue"
        }, {
          title: t('female_breeders'),
          value: femaleCount > 0 ? femaleCount.toLocaleString() : "0",
          subtitle: femaleCount > 0 ? t('spawning_period') : t('none_registered'),
          icon: Heart,
          color: "pink"
        }, {
          title: t('fertility_rate'),
          value: fertilityRate > 0 ? `${fertilityRate}%` : "0%",
          subtitle: fertilityRate > 0 ? `${t('vs_previous_cycle')}` : t('no_data'),
          icon: Egg,
          color: "yellow"
        }, {
          title: t('fry_produced'),
          value: fryCount > 0 ? fryCount.toLocaleString() : "0",
          subtitle: fryCount > 0 ? t('this_cycle') : t('no_production'),
          icon: Activity,
          color: "green"
        }],
        livestock: unitBatches.length > 0 ? {
          geniteurs_males: maleCount,
          geniteurs_femelles: femaleCount,
          alevins_total: alevinsCount,
          larves_stade1: latestRepro?.larvae_count || 0,
          larves_stade2: 0,
          larves_stade3: 0,
          taux_fecondite: fertilityRate,
          taux_eclosion: latestRepro?.hatching_rate || 0,
          prochaine_eclosion: latestRepro?.hatching_date || null
        } : null
      };
    }

    // Données pour transformation
    if (activeUnit.type === 'transformation') {
      const activeEquipment = unitEquipment.filter(eq => eq.status === 'active').length;
      return {
        metrics: [...baseMetrics, {
          title: t('fish_transformed'),
          value: "0 kg",
          subtitle: t('this_week'),
          icon: Scale,
          color: "orange"
        }, {
          title: t('active_equipment_label'),
          value: activeEquipment.toString(),
          subtitle: `${unitEquipment.length} ${t('total_label')}`,
          icon: Factory,
          color: "purple"
        }, {
          title: t('yield_label'),
          value: "0%",
          subtitle: t('no_data'),
          icon: TrendingUp,
          color: "green"
        }],
        livestock: null
      };
    }

    // Données pour conservation
    if (activeUnit.type === 'conservation') {
      const coldRooms = unitEquipment.filter(eq => eq.type.includes('chambre_froide')).length;
      return {
        metrics: [...baseMetrics, {
          title: t('cold_rooms'),
          value: coldRooms.toString(),
          subtitle: coldRooms > 0 ? t('all_operational') : t('no_data_configured'),
          icon: Thermometer,
          color: "blue"
        }, {
          title: t('avg_temperature'),
          value: "--°C",
          subtitle: t('no_data'),
          icon: Thermometer,
          color: "cyan"
        }, {
          title: t('capacity_used'),
          value: "0%",
          subtitle: "0/0 kg",
          icon: Factory,
          color: "purple"
        }],
        livestock: null
      };
    }

    // Données pour grossissement
    if (activeUnit.type === 'grossissement') {
      const avgWeight = unitBatches.length > 0 
        ? Math.round(unitBatches.reduce((sum, b) => sum + (b.average_weight || 0), 0) / unitBatches.length)
        : 0;
      const totalMortality = unitHealthRecords.reduce((sum, r) => sum + (r.mortality || 0), 0);
      const totalStock = unitBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const mortalityRate = totalStock > 0 ? ((totalMortality / totalStock) * 100).toFixed(1) : "0";
      
      return {
        metrics: [...baseMetrics, {
          title: t('avg_growth'),
          value: avgWeight > 0 ? `${avgWeight}g` : "0g",
          subtitle: avgWeight > 0 ? t('current_avg_weight') : t('no_data'),
          icon: TrendingUp,
          color: "green"
        }, {
          title: t('mortality_label'),
          value: `${mortalityRate}%`,
          subtitle: parseFloat(mortalityRate) <= 5 ? t('acceptable_rate') : t('to_monitor'),
          icon: Activity,
          color: "red"
        }],
        livestock: null
      };
    }

    return {
      metrics: baseMetrics,
      livestock: null
    };
  };

  const {
    metrics,
    livestock
  } = getUnitSpecificData();
  if (!activeUnit && viewMode === 'unit') {
    return <div className="space-y-6">
        {/* En-tête amélioré du tableau de bord avec image de ferme */}
        <div className="relative rounded-xl shadow-lg overflow-hidden">
          {/* Image de fond floutée */}
          <div className="absolute inset-0 z-0">
            <img 
              src={farmBackground} 
              alt="Ferme aquacole" 
              className="w-full h-full object-cover blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/85 via-blue-800/85 to-blue-900/85" />
          </div>

          {/* Contenu */}
          <div className="relative z-10 p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm shadow-lg">
                  <Fish className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
                    {t('intelligent_dashboard')}
                  </h1>
                  <p className="text-blue-100 text-base font-medium">
                    {t('adapted_view')}
                  </p>
                </div>
              </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-lg px-4 py-3 border border-white/20">
              <Clock className="w-5 h-5 text-white/90" />
              <div className="text-left">
                <p className="text-xs text-blue-200 font-medium">{t('dashboard_last_update')}</p>
                <p className="font-bold text-sm">{formatLastUpdate()}</p>
              </div>
            </div>
            </div>
          </div>

          {/* Sélecteur d'unité intégré dans l'en-tête */}
          <div className="relative z-10 px-6 pb-6">
            <ProductionUnitSelector />
          </div>
        </div>

        <div className="text-center py-8 sm:py-12">
          <Fish className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-600 mb-2">
            {t('no_unit_selected')}
          </h3>
          <p className="text-sm sm:text-base text-gray-500">
            {t('select_unit_prompt')}
          </p>
        </div>
      </div>;
  }
  return <div className="space-y-4 sm:space-y-6">
      {/* En-tête compact avec arrière-plan réseau neuronal flouté */}
      <div className="relative rounded-xl shadow-lg overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        {/* Image de fond (tablette / desktop uniquement) */}
        <div className="absolute inset-0 z-0 hidden md:block">
          <img
            src={farmBackground}
            alt="Ferme aquacole"
            className="w-full h-full object-cover blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/85 via-blue-800/85 to-blue-900/85" />
        </div>
        {/* Arrière-plan réseau de courbes connectées (mobile uniquement) */}
        <div className="absolute inset-0 z-0 md:hidden" aria-hidden="true">
          <svg className="w-full h-full blur-[1.5px] opacity-90" viewBox="0 0 400 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="netLine" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.7" />
              </linearGradient>
              <radialGradient id="netNode">
                <stop offset="0%" stopColor="#a5f3fc" stopOpacity="1" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g stroke="url(#netLine)" strokeWidth="1.4" fill="none">
              <path d="M0,140 Q80,40 160,110 T320,80 T400,130" />
              <path d="M0,80 Q100,160 200,90 T400,60" />
              <path d="M20,180 Q120,80 220,160 T400,100" />
              <path d="M0,30 Q90,120 180,40 T380,150" />
            </g>
            <g fill="url(#netNode)">
              {[[40,120],[120,70],[200,110],[280,60],[340,130],[80,160],[240,40],[360,90]].map(([x,y],i)=>(
                <circle key={i} cx={x} cy={y} r="8" />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/40 via-blue-950/30 to-slate-950/50" />
        </div>

        {/* Contenu compact */}
        <div className="relative z-10 text-white p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="p-1.5 sm:p-3 bg-white/15 rounded-md sm:rounded-lg backdrop-blur-sm shrink-0 border border-white/10">
                <Fish className="w-4 h-4 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-2xl lg:text-3xl tracking-tight font-bold leading-tight truncate">
                  {t('intelligent_dashboard')}
                </h1>
                <p className="text-blue-100/90 font-medium text-[10px] sm:text-sm lg:text-base leading-tight truncate">
                  {t('adapted_view')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 bg-white/10 backdrop-blur-md rounded-md sm:rounded-lg px-2 py-1 sm:px-4 sm:py-3 border border-white/20 shrink-0">
              <Clock className="w-3 h-3 sm:w-5 sm:h-5 text-white/90" />
              <div className="text-left leading-tight">
                <p className="text-[9px] sm:text-xs text-blue-200 font-medium hidden sm:block">{t('dashboard_last_update')}</p>
                <p className="font-bold text-[10px] sm:text-sm">{formatLastUpdate()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sélecteur d'unité intégré dans l'en-tête */}
        <div className="relative z-10 px-3 sm:px-6 pb-3 sm:pb-6">
          <ProductionUnitSelector />
        </div>
      </div>

      {/* Sélecteur de vue */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Button variant={viewMode === 'unit' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('unit')} disabled={!activeUnit} className="text-xs sm:text-sm">
            {t('unit_view')}
          </Button>
          <Button variant={viewMode === 'global' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('global')} className="text-xs sm:text-sm">
            {t('global_view')}
          </Button>
        </div>

        {viewMode === 'unit' && activeUnit && <Badge variant="secondary" className="text-xs">
            {activeUnit.name}
          </Badge>}
      </div>

      <RestockSummary unitId={activeUnit?.id} />

      {/* Métriques dynamiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {viewMode === 'unit' ? metrics.map((metric, index) => {
        const IconComponent = metric.icon;
        return <Card key={index} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 text-aqua-600" />
                  </div>
                  <p className="text-base sm:text-xl font-bold truncate">{metric.value}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{metric.title}</p>
                  <p className="text-xs text-gray-500 truncate">{metric.subtitle}</p>
                </CardContent>
              </Card>;
      }) :
      // global metrics - utiliser les données réelles du hook useFinancialSummary
      [{
        title: t('revenue'),
        value: formatCurrency(financialSummary.totalRevenue),
        subtitle: `${financialSummary.confirmedSales} ${t('confirmed_sales')}`,
        icon: TrendingUp
      }, {
        title: t('expenses'),
        value: formatCurrency(financialSummary.totalExpenses),
        subtitle: `${financialSummary.purchasesCount} ${t('purchases_count')}`,
        icon: Activity
      }, {
        title: t('profit'),
        value: formatCurrency(financialSummary.netBalance),
        subtitle: financialSummary.netBalance >= 0 ? t('benefit') : t('deficit'),
        icon: Fish
      }, {
        title: t('profit_margin'),
        value: financialSummary.totalRevenue > 0 ? `${(financialSummary.netBalance / financialSummary.totalRevenue * 100).toFixed(1)}%` : "0%",
        subtitle: `${financialSummary.employeesCount} ${t('employees_count')}`,
        icon: Factory
      }].map((metric, index) => {
        const IconComponent = metric.icon;
        return <Card key={index} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <p className="text-base sm:text-xl font-bold truncate">{metric.value}</p>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">{metric.title}</p>
                  <p className="text-xs text-gray-500 truncate">{metric.subtitle}</p>
                </CardContent>
              </Card>;
      })}
      </div>

      {/* Section Financière - Résumé rapide */}
      {(financialSummary.totalRevenue > 0 || financialSummary.totalExpenses > 0 || financialSummary.salesCount > 0 || financialSummary.employeesCount > 0) && (
        <Card className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              {t('financial_summary')} - {viewMode === 'global' ? t('all_units_financial') : activeUnit?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-muted-foreground">{t('revenues')}</span>
                </div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(financialSummary.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">{financialSummary.confirmedSales} {t('confirmed_sales')}</p>
              </div>
              
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-muted-foreground">{t('expenses_label')}</span>
                </div>
                <p className="text-lg font-bold text-red-600">{formatCurrency(financialSummary.totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">{financialSummary.purchasesCount} {t('purchases_count')}</p>
              </div>
              
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-muted-foreground">{t('salaries')}</span>
                </div>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(financialSummary.totalSalaries)}</p>
                <p className="text-xs text-muted-foreground">{financialSummary.employeesCount} {t('employees_count')}</p>
              </div>
              
              <div className="bg-white/50 dark:bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-muted-foreground">{t('balance')}</span>
                </div>
                <p className={`text-lg font-bold ${financialSummary.netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(financialSummary.netBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {financialSummary.netBalance >= 0 ? t('benefit') : t('deficit')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Données spécifiques à l'écloserie - uniquement si données réelles */}
      {viewMode === 'unit' && activeUnit?.type === 'ecloserie' && livestock && (livestock.geniteurs_males > 0 || livestock.geniteurs_femelles > 0 || livestock.alevins_total > 0) && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">{t('hatchery_livestock_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* livestock display */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-1">{t('breeders_title')}</h4>
                <p className="text-xs text-blue-600 dark:text-blue-400">♂ {livestock.geniteurs_males} | ♀ {livestock.geniteurs_femelles}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-green-800 dark:text-green-300 mb-1">{t('production_title')}</h4>
                <p className="text-xs text-green-600 dark:text-green-400">{livestock.alevins_total.toLocaleString()} {t('fry_label')}</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-1">{t('performances_title')}</h4>
                <p className="text-xs text-yellow-600 dark:text-yellow-400">{t('fertility_label_short')}: {livestock.taux_fecondite}%</p>
              </div>
            </div>
            
            {livestock.larves_stade1 > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t('larval_stages_title')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs">{t('larvae')}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={100} className="w-16 h-2" />
                      <span className="text-xs">{livestock.larves_stade1.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>}

      {/* Évolution financière mensuelle */}
      {financialSummary.monthlyData.some(m => m.revenue > 0 || m.expenses > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              {t('financial_evolution_title')} - {viewMode === 'global' ? t('all_units_financial') : activeUnit?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={financialSummary.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name={t('revenue_chart_label')} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name={t('expenses_chart_label')} />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name={t('result_chart_label')} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Graphiques supplémentaires liés aux modules - uniquement si données réelles */}
      {(hasFeedingData || hasMortalityData || hasWaterQualityData || hasProductionData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Graphique Alimentation - uniquement si données */}
          {hasFeedingData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                  {t('feeding_week')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={feedingChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="jour" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="quantite" fill="#f97316" name={t('quantity_kg')} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Graphique Qualité de l'eau - uniquement si données */}
          {hasWaterQualityData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-600" />
                  {t('water_quality_today')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={waterQualityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="heure" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Area type="monotone" dataKey="temperature" stroke="#ef4444" fill="#fecaca" name={t('temp_label')} />
                    <Area type="monotone" dataKey="oxygene" stroke="#3b82f6" fill="#bfdbfe" name={t('o2_label')} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Graphique Mortalité - uniquement si données */}
          {hasMortalityData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-red-600" />
                  {t('mortality_4weeks')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={mortalityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semaine" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="mortalite" fill="#ef4444" name={t('mortality_chart_label')} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="objectif" fill="#d1d5db" name={t('objective_max')} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Graphique Production par espèce - uniquement si données */}
          {hasProductionData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Fish className="h-4 w-4 text-aqua-600" />
                  {t('production_by_species')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={productionBySpecies}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {productionBySpecies.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Message si aucune donnée */}
      {!hasFeedingData && !hasMortalityData && !hasWaterQualityData && !hasProductionData && viewMode === 'unit' && activeUnit && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h4 className="font-medium text-sm mb-1">{t('no_data_recorded')}</h4>
            <p className="text-xs text-muted-foreground">
              {t('start_recording_data')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Onglets pour données spécifiques à l'unité */}
      {viewMode === 'unit' && activeUnit && <Tabs defaultValue="cycles" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 text-xs sm:text-sm">
            <TabsTrigger value="cycles">{t('cycles_tab_label')}</TabsTrigger>
            <TabsTrigger value="equipment">{t('equipment_tab_label')}</TabsTrigger>
            <TabsTrigger value="infrastructure">{t('infrastructure_tab_label')}</TabsTrigger>
            <TabsTrigger value="depreciation">{t('depreciation_tab')}</TabsTrigger>
          </TabsList>

          {/* tabs content */}
          <TabsContent value="cycles" className="space-y-4">
            <div className="grid gap-3 sm:gap-4">
              {unitCycles.length > 0 ? unitCycles.map(cycle => {
                    // Calculer la progression temporelle basée sur la durée du cycle
                    const startDate = parseISO(cycle.start_date);
                    const today = new Date();
                    const daysPassed = differenceInDays(today, startDate);
                    const totalDays = (cycle.duration_months || 6) * 30;
                    const temporalProgress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
                    
                    // Progression par quantité
                    const quantityProgress = (cycle.current_quantity || 0) / (cycle.target_quantity || 1) * 100;
                    
                    return <Card key={cycle.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm sm:text-base truncate">{cycle.name}</h4>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {t('started_on_date')} {new Date(cycle.start_date).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR')} • {daysPassed} {t('days_label')}
                            </p>
                            <div className="mt-2 space-y-2">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{t('temporal_progress')}</span>
                                  <span>{temporalProgress.toFixed(0)}%</span>
                                </div>
                                <Progress value={temporalProgress} className="h-2" />
                              </div>
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{t('production_progress')}</span>
                                  <span>{(cycle.current_quantity || 0).toLocaleString()}/{(cycle.target_quantity || 0).toLocaleString()}</span>
                                </div>
                                <Progress value={quantityProgress} className="h-2 bg-blue-100 [&>div]:bg-blue-500" />
                              </div>
                            </div>
                          </div>
                          <Badge variant={cycle.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {cycle.status === 'active' ? t('in_progress_status') : cycle.status === 'completed' ? t('completed_status') : cycle.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>;
                  }) : <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                  <p className="text-sm">{t('no_active_cycles_msg')}</p>
                </div>}
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <div className="grid gap-3 sm:gap-4">
              {unitEquipment.length > 0 ? unitEquipment.map(eq => <Card key={eq.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm sm:text-base truncate">{eq.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 capitalize">
                            {eq.type.replace('_', ' ')}
                          </p>
                          {eq.specifications && <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(eq.specifications).slice(0, 3).map(([key, value]) => <span key={key} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs">
                                  {key}: {value}
                                </span>)}
                            </div>}
                        </div>
                        <Badge variant={eq.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {eq.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>) : <div className="text-center py-6 sm:py-8 text-gray-500">
                  <Settings className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                  <p className="text-sm">{t('no_equipment_configured')}</p>
                </div>}
            </div>
          </TabsContent>

          <TabsContent value="infrastructure" className="space-y-4">
            <div className="grid gap-3 sm:gap-4">
              {unitInfrastructures.length > 0 ? unitInfrastructures.map(infra => <Card key={infra.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm sm:text-base truncate">{infra.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {t('capacity')}: {infra.capacity.toLocaleString()}
                          </p>
                          {infra.specifications && <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(infra.specifications).slice(0, 3).map(([key, value]) => <span key={key} className="inline-block bg-gray-100 rounded px-2 py-1 text-xs">
                                  {key}: {value}
                                </span>)}
                            </div>}
                        </div>
                        <Badge variant={infra.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {infra.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>) : <div className="text-center py-6 sm:py-8 text-gray-500">
                  <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                  <p className="text-sm">{t('no_infrastructure_configured')}</p>
                </div>}
            </div>
          </TabsContent>

          <TabsContent value="depreciation" className="space-y-4">
            {(() => {
              const unitAssets = activeUnit 
                ? depreciableAssets.filter(a => a.unitId === activeUnit.id)
                : depreciableAssets;
              
              const getCurrencySymbol = (code: string) => {
                switch(code) {
                  case 'XOF': return 'F CFA';
                  case 'EUR': return '€';
                  case 'USD': return '$';
                  case 'MAD': return 'DH';
                  default: return code;
                }
              };

              const totalValue = unitAssets.reduce((sum, a) => sum + convertCurrency(a.purchasePrice, a.currency, currency), 0);
              const totalDepreciation = unitAssets.reduce((sum, a) => sum + convertCurrency(calculateDepreciation(a.id), a.currency, currency), 0);
              const totalCurrentValue = totalValue - totalDepreciation;

              return (
                <div className="space-y-4">
                  {/* Résumé des amortissements */}
                  {unitAssets.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Card className="bg-blue-50/50 dark:bg-blue-900/20">
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-muted-foreground">{t('acquisition_value')}</p>
                          <p className="text-lg font-bold text-blue-600">{totalValue.toLocaleString()} {getCurrencySymbol(currency)}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-orange-50/50 dark:bg-orange-900/20">
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-muted-foreground">{t('cumulated_depreciation')}</p>
                          <p className="text-lg font-bold text-orange-600">{totalDepreciation.toLocaleString()} {getCurrencySymbol(currency)}</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50/50 dark:bg-green-900/20">
                        <CardContent className="p-3 text-center">
                          <p className="text-xs text-muted-foreground">{t('current_net_value')}</p>
                          <p className="text-lg font-bold text-green-600">{totalCurrentValue.toLocaleString()} {getCurrencySymbol(currency)}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
                  <div className="grid gap-3 sm:gap-4">
                    {unitAssets.length > 0 ? unitAssets.map(asset => {
                      const depreciation = calculateDepreciation(asset.id);
                      const currentValue = Math.max(0, asset.purchasePrice - depreciation);
                      const depreciationPercent = asset.purchasePrice > 0 ? (depreciation / asset.purchasePrice) * 100 : 0;
                      
                      return <Card key={asset.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm sm:text-base truncate">{asset.name}</h4>
                                <Badge variant="outline" className="text-xs">{asset.category}</Badge>
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600">
                                Acquis le {new Date(asset.purchaseDate).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR')} • {asset.usefulLife} {t('years')}
                              </p>
                              <div className="mt-2">
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{t('depreciation_tab')}</span>
                                  <span>{depreciationPercent.toFixed(0)}%</span>
                                </div>
                                <Progress value={depreciationPercent} className="h-2 bg-orange-100 [&>div]:bg-orange-500" />
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-gray-500">{t('current_net_value')}</p>
                              <p className="font-semibold text-green-600">
                                {convertCurrency(currentValue, asset.currency, currency).toLocaleString()} {getCurrencySymbol(currency)}
                              </p>
                              <p className="text-xs text-gray-400 line-through">
                                {asset.purchasePrice.toLocaleString()} {getCurrencySymbol(asset.currency)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>;
                    }) : <div className="text-center py-6 sm:py-8 text-gray-500">
                      <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" />
                      <p className="text-sm">{t('no_depreciable_assets')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('add_assets_via_accounting')}</p>
                    </div>}
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>}

      {/* Panneau d'alertes déplacé en dernière position */}
      <AlertsPanel />
    </div>;
};
export default IntelligentDashboard;