import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ComposedChart,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Droplets,
  Fish,
  Thermometer,
  Scale,
  Calendar,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useSales } from '@/hooks/useSales';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { getUnitTerms } from '@/lib/unitContext';
import CommercialPerformance from './CommercialPerformance';

import { useSettings } from '@/contexts/SettingsContext';
import { format, subDays, subMonths, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';

// Couleurs du thème
const COLORS = {
  primary: '#14b8a6',
  secondary: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1'
};

const CHART_COLORS = [COLORS.primary, COLORS.secondary, COLORS.purple, COLORS.warning, COLORS.pink, COLORS.indigo];

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, changeLabel, icon: Icon, color, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = change !== undefined && change >= 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(1)}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground ml-1">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className={`p-3 sm:p-4 rounded-full bg-opacity-10`} style={{ backgroundColor: `${color}20` }}>
            <Icon className="h-6 w-6 sm:h-8 sm:w-8" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProductionAnalyticsDashboard: React.FC = () => {
  const { t, language } = useSettings();
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const { cycles, loading: cyclesLoading } = useProductionCycles();
  const { records: feedingRecords, loading: feedingLoading } = useFeedingRecords();
  const { records: healthRecords, loading: healthLoading } = useHealthRecords();
  const { batches, loading: batchesLoading } = useLivestockBatches();
  const { sales, loading: salesLoading } = useSales();
  const { units, activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);

  
  const dateLocale = language === 'fr' ? frLocale : undefined;

  const isLoading = cyclesLoading || feedingLoading || healthLoading || batchesLoading || salesLoading;

  // Calculer les dates de filtrage
  const dateFilters = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      case '90d':
        return { start: subDays(now, 90), end: now };
      case '12m':
        return { start: subMonths(now, 12), end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  }, [dateRange]);

  // Filtrer les données par unité
  const filteredCycles = useMemo(() => {
    if (selectedUnit === 'all') return cycles;
    return cycles.filter(c => c.unit_id === selectedUnit);
  }, [cycles, selectedUnit]);

  const filteredFeedingRecords = useMemo(() => {
    let records = feedingRecords;
    if (selectedUnit !== 'all') {
      records = records.filter(r => r.unit_id === selectedUnit);
    }
    return records.filter(r => {
      const date = parseISO(r.date);
      return date >= dateFilters.start && date <= dateFilters.end;
    });
  }, [feedingRecords, selectedUnit, dateFilters]);

  const filteredHealthRecords = useMemo(() => {
    let records = healthRecords;
    if (selectedUnit !== 'all') {
      records = records.filter(r => r.unit_id === selectedUnit);
    }
    return records.filter(r => {
      const date = parseISO(r.date);
      return date >= dateFilters.start && date <= dateFilters.end;
    });
  }, [healthRecords, selectedUnit, dateFilters]);

  // KPIs calculés - REAL DATA ONLY, no demo values
  const kpis = useMemo(() => {
    const activeCycles = filteredCycles.filter(c => c.status === 'active' || c.status === 'en_cours');
    const totalQuantity = activeCycles.reduce((sum, c) => sum + (c.current_quantity || 0), 0);
    const targetQuantity = activeCycles.reduce((sum, c) => sum + (c.target_quantity || 0), 0);
    
    const totalFeeding = filteredFeedingRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const fcrRecords = filteredFeedingRecords.filter(r => r.fcr && r.fcr > 0);
    const avgFCR = fcrRecords.length > 0
      ? fcrRecords.reduce((sum, r) => sum + (r.fcr || 0), 0) / fcrRecords.length
      : 0;

    const tempRecords = filteredHealthRecords.filter(r => r.temperature && r.temperature > 0);
    const avgTemperature = tempRecords.length > 0
      ? tempRecords.reduce((sum, r) => sum + (r.temperature || 0), 0) / tempRecords.length
      : 0;

    const totalMortality = filteredHealthRecords.reduce((sum, r) => sum + (r.mortality || 0), 0);
    const initialQuantity = activeCycles.reduce((sum, c) => sum + (c.initial_quantity || c.current_quantity || 0), 0);
    const survivalRate = initialQuantity > 0 ? ((initialQuantity - totalMortality) / initialQuantity) * 100 : 0;

    const totalSales = sales?.reduce((sum, s) => sum + (s.totalAmount || 0), 0) || 0;

    // NO DEMO DATA - show real values only (0 if no data)
    return {
      activeCycles: activeCycles.length,
      totalQuantity,
      targetQuantity,
      progressRate: targetQuantity > 0 ? (totalQuantity / targetQuantity) * 100 : 0,
      totalFeeding,
      avgFCR,
      avgTemperature,
      survivalRate,
      totalSales,
      // No hardcoded changes - would need historical data comparison
      productionChange: undefined,
      feedingChange: undefined,
      survivalChange: undefined,
      salesChange: undefined
    };
  }, [filteredCycles, filteredFeedingRecords, filteredHealthRecords, sales]);

  // Données pour le graphique de production
  const productionChartData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFilters.start, end: dateFilters.end });
    
    return days.slice(-14).map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayFeeding = filteredFeedingRecords.filter(r => r.date === dateStr);
      const dayHealth = filteredHealthRecords.filter(r => r.date === dateStr);
      
      return {
        date: format(day, 'dd/MM', { locale: dateLocale }),
        alimentation: dayFeeding.reduce((sum, r) => sum + (r.quantity || 0), 0),
        temperature: dayHealth.length > 0 
          ? dayHealth.reduce((sum, r) => sum + (r.temperature || 0), 0) / dayHealth.length 
          : null,
        mortalite: dayHealth.reduce((sum, r) => sum + (r.mortality || 0), 0)
      };
    });
  }, [dateFilters, filteredFeedingRecords, filteredHealthRecords]);

  // Évolution du FCR - uniquement à partir des FCR réellement enregistrés
  const fcrChartData = useMemo(() => {
    const byDate = new Map<string, { sum: number; count: number }>();
    filteredFeedingRecords.forEach(r => {
      if (!r.fcr || r.fcr <= 0 || !r.date) return;
      const entry = byDate.get(r.date) || { sum: 0, count: 0 };
      entry.sum += r.fcr;
      entry.count += 1;
      byDate.set(r.date, entry);
    });
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date: format(parseISO(date), 'dd/MM', { locale: dateLocale }),
        fcr: Number((sum / count).toFixed(2))
      }));
  }, [filteredFeedingRecords, dateLocale]);

  // Données pour le graphique mensuel
  const monthlyChartData = useMemo(() => {
    const months = eachMonthOfInterval({ 
      start: subMonths(new Date(), 5), 
      end: new Date() 
    });
    
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthFeeding = feedingRecords.filter(r => {
        const date = parseISO(r.date);
        return date >= monthStart && date <= monthEnd;
      });
      
      const monthCycles = cycles.filter(c => {
        const date = parseISO(c.start_date);
        return date >= monthStart && date <= monthEnd;
      });

      return {
        month: format(month, 'MMM', { locale: dateLocale }),
        production: monthCycles.reduce((sum, c) => sum + (c.current_quantity || 0), 0),
        objectif: monthCycles.reduce((sum, c) => sum + (c.target_quantity || 0), 0),
        alimentation: monthFeeding.reduce((sum, r) => sum + (r.quantity || 0), 0)
      };
    });
  }, [feedingRecords, cycles]);

  // Données pour le graphique par espèce
  const speciesData = useMemo(() => {
    const speciesMap = new Map<string, number>();
    
    filteredCycles.forEach(cycle => {
      const species = cycle.species || 'Non spécifié';
      speciesMap.set(species, (speciesMap.get(species) || 0) + (cycle.current_quantity || 0));
    });

    return Array.from(speciesMap.entries()).map(([name, value], index) => ({
      name,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [filteredCycles]);

  // Données pour le graphique par unité
  const unitData = useMemo(() => {
    const unitMap = new Map<string, { production: number; capacity: number }>();
    
    filteredCycles.forEach(cycle => {
      const unitName = cycle.unit_name || 'Non spécifié';
      const existing = unitMap.get(unitName) || { production: 0, capacity: 0 };
      unitMap.set(unitName, {
        production: existing.production + (cycle.current_quantity || 0),
        capacity: existing.capacity + (cycle.target_quantity || 0)
      });
    });

    return Array.from(unitMap.entries()).map(([name, data]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      production: data.production,
      capacite: data.capacity,
      taux: data.capacity > 0 ? Math.round((data.production / data.capacity) * 100) : 0
    }));
  }, [filteredCycles]);

  // Données pour le radar de performance - REAL DATA ONLY
  const performanceRadarData = useMemo(() => {
    // Calculate real metrics from actual data
    const feedingEfficiency = kpis.avgFCR > 0 ? Math.max(0, 100 - (kpis.avgFCR - 1) * 50) : 0;
    const waterQuality = filteredHealthRecords.length > 0 
      ? filteredHealthRecords.filter(r => r.oxygen && r.oxygen >= 5 && r.ph && r.ph >= 6.5 && r.ph <= 8.5).length / filteredHealthRecords.length * 100
      : 0;
    
    return [
      { metric: 'Production', value: Math.min(kpis.progressRate, 100), fullMark: 100 },
      { metric: 'Survie', value: kpis.survivalRate, fullMark: 100 },
      { metric: unitTerms.conversionLabel, value: feedingEfficiency, fullMark: 100 },
      { metric: unitTerms.analyticsInputsTabLabel, value: kpis.totalFeeding > 0 ? Math.min((kpis.totalFeeding / 1000) * 10, 100) : 0, fullMark: 100 },
      { metric: 'Qualité eau', value: waterQuality, fullMark: 100 },
      { metric: 'Croissance', value: kpis.avgTemperature > 0 ? Math.min(kpis.avgTemperature * 3, 100) : 0, fullMark: 100 }
    ];
  }, [kpis, filteredHealthRecords]);

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t('analytics_dashboard_title')}</h2>
          <p className="text-muted-foreground mt-1">{t('performance_indicators')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('days_7')}</SelectItem>
              <SelectItem value="30d">{t('days_30')}</SelectItem>
              <SelectItem value="90d">{t('days_90')}</SelectItem>
              <SelectItem value="12m">{t('months_12')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('all_units')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_units')}</SelectItem>
              {units.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" aria-label="Actualiser les analyses" onClick={() => window.dispatchEvent(new Event('aqua:data-refresh'))}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards - Real data only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('total_production_kpi')}
          value={kpis.totalQuantity > 0 ? `${(kpis.totalQuantity / 1000).toFixed(1)}T` : '0'}
          change={kpis.productionChange}
          changeLabel={kpis.productionChange !== undefined ? t('vs_last_month') : undefined}
          icon={Fish}
          color={COLORS.primary}
          loading={isLoading}
        />
        <KPICard
          title={t('survival_rate')}
          value={kpis.survivalRate > 0 ? `${kpis.survivalRate.toFixed(1)}%` : '-'}
          change={kpis.survivalChange}
          changeLabel={kpis.survivalChange !== undefined ? t('vs_last_month') : undefined}
          icon={Activity}
          color={COLORS.success}
          loading={isLoading}
        />
        <KPICard
          title={t('average_fcr')}
          value={kpis.avgFCR > 0 ? kpis.avgFCR.toFixed(2) : '-'}
          change={kpis.feedingChange}
          changeLabel={kpis.feedingChange !== undefined ? t('improvement') : undefined}
          icon={Target}
          color={COLORS.secondary}
          loading={isLoading}
        />
        <KPICard
          title={t('total_sales_kpi')}
          value={kpis.totalSales > 0 ? `${(kpis.totalSales / 1000).toFixed(0)}K` : '0'}
          change={kpis.salesChange}
          changeLabel={kpis.salesChange !== undefined ? t('vs_last_month') : undefined}
          icon={TrendingUp}
          color={COLORS.warning}
          loading={isLoading}
        />
      </div>

      {/* Graphiques principaux */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('overview_tab')}</span>
            <span className="sm:hidden">{t('general')}</span>
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Fish className="h-4 w-4" />
            <span>{t('production')}</span>
          </TabsTrigger>
          <TabsTrigger value="feeding" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">{unitTerms.analyticsInputsTabLabel}</span>
            <span className="sm:hidden">{unitTerms.analyticsInputsTabLabel}</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span>{t('performance_kpi')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Production vs Objectifs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t('production_vs_objectives')}
                </CardTitle>
                <CardDescription>{t('monthly_production_evolution')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyChartData}>
                      <defs>
                        <linearGradient id="productionGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="production"
                        name={t('production')}
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        fill="url(#productionGrad)"
                      />
                      <Line
                        type="monotone"
                        dataKey="objectif"
                        name={t('objective_label')}
                        stroke={COLORS.secondary}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Répartition par espèce */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  {t('species_distribution')}
                </CardTitle>
                <CardDescription>{t('current_distribution')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={speciesData.length > 0 ? speciesData : [{ name: 'Aucune donnée', value: 1, color: '#e5e7eb' }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {(speciesData.length > 0 ? speciesData : [{ name: 'Aucune donnée', value: 1, color: '#e5e7eb' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {speciesData.map((species, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: species.color }}
                      />
                      <span className="truncate">{species.name}: {species.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Production par unité */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Production par Unité
              </CardTitle>
              <CardDescription>Comparaison des unités de production</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="production" name="Production" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="capacite" name="Capacité" fill={COLORS.secondary} radius={[0, 4, 4, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production */}
        <TabsContent value="production" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Évolution quotidienne */}
            <Card>
              <CardHeader>
                <CardTitle>Évolution Quotidienne</CardTitle>
                <CardDescription>{`${unitTerms.analyticsInputsTabLabel} et pertes sur 14 jours`}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={productionChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="alimentation" name={`${unitTerms.analyticsInputsTabLabel} (kg)`} fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="mortalite" name="Mortalité" stroke={COLORS.danger} strokeWidth={2} dot />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cycles actifs */}
            <Card>
              <CardHeader>
                <CardTitle>Cycles de Production Actifs</CardTitle>
                <CardDescription>{kpis.activeCycles} cycles en cours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-72 overflow-y-auto">
                  {filteredCycles.filter(c => c.status === 'active' || c.status === 'en_cours').slice(0, 5).map((cycle, index) => {
                    const progress = cycle.target_quantity > 0 
                      ? (cycle.current_quantity / cycle.target_quantity) * 100 
                      : 0;
                    return (
                      <div key={cycle.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{cycle.name}</p>
                            <p className="text-xs text-muted-foreground">{cycle.unit_name}</p>
                          </div>
                          <Badge variant={progress >= 80 ? "default" : progress >= 50 ? "secondary" : "outline"}>
                            {progress.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(progress, 100)}%`,
                              backgroundColor: progress >= 80 ? COLORS.success : progress >= 50 ? COLORS.warning : COLORS.primary
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{cycle.current_quantity.toLocaleString()} unités</span>
                          <span>Objectif: {cycle.target_quantity.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredCycles.filter(c => c.status === 'active' || c.status === 'en_cours').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Fish className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Aucun cycle actif</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alimentation */}
        <TabsContent value="feeding" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tendance FCR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Évolution du {unitTerms.conversionLabel}
                </CardTitle>
                <CardDescription>{unitTerms.conversionDescription}</CardDescription>

              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {fcrChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground px-4">
                      Aucun indice de conversion enregistré sur la période sélectionnée.
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fcrChartData}>
                      <defs>
                        <linearGradient id="fcrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-50" />
                      <XAxis dataKey="date" />
                      <YAxis domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="fcr"
                        name={unitTerms.conversionLabel}
                        stroke={COLORS.secondary}
                        strokeWidth={2}
                        fill="url(#fcrGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Statistiques alimentation */}
            <Card>
              <CardHeader>
                <CardTitle>Statistiques {unitTerms.feedingTitle}</CardTitle>
                <CardDescription>Résumé de la période sélectionnée</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">{kpis.totalFeeding.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">kg distribués</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-secondary">{kpis.avgFCR.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{unitTerms.conversionLabel} moyen</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-success">{filteredFeedingRecords.length}</p>
                      <p className="text-sm text-muted-foreground">sessions</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-warning">
                        {filteredFeedingRecords.length > 0 
                          ? (kpis.totalFeeding / filteredFeedingRecords.length).toFixed(1) 
                          : 0}
                      </p>
                      <p className="text-sm text-muted-foreground">kg/session</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Radar de performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Score de Performance Global
                </CardTitle>
                <CardDescription>Évaluation multi-critères</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={performanceRadarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" className="text-sm" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name="Performance"
                        dataKey="value"
                        stroke={COLORS.primary}
                        fill={COLORS.primary}
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Score global */}
            <Card>
              <CardHeader>
                <CardTitle>Indicateurs Clés</CardTitle>
                <CardDescription>Métriques de performance détaillées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceRadarData.map((item, index) => (
                    <div key={item.metric} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.metric}</span>
                        <span className={`text-sm font-bold ${
                          item.value >= 80 ? 'text-green-500' : 
                          item.value >= 60 ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {item.value.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all"
                          style={{ 
                            width: `${item.value}%`,
                            backgroundColor: item.value >= 80 ? COLORS.success : 
                              item.value >= 60 ? COLORS.warning : COLORS.danger
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-primary/10 rounded-lg">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary">
                      {Math.round(performanceRadarData.reduce((sum, d) => sum + d.value, 0) / performanceRadarData.length)}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Score de performance global</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const AnalyticsDashboard = () => {
  const { activeUnit } = useProductionUnits();
  return activeUnit?.type === 'commercialisation' ? <CommercialPerformance title="Analytique" presentation="analytics" /> : <ProductionAnalyticsDashboard />;
};
export default AnalyticsDashboard;
