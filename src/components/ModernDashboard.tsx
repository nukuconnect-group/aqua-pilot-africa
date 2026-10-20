import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity, AlertTriangle, Building2, Droplets, Factory, FileText,
  Fish, Plus, Settings, Sparkles, Thermometer, TrendingUp, Users,
  Wind, BarChart3, Bell, Map as MapIcon, Download, ArrowRight,
  Wallet, ArrowDownRight, ArrowUpRight, PiggyBank, ChevronDown, ChevronUp,
  Gauge, DollarSign, ShoppingCart, UserCog, Wrench, Layers, CircleDollarSign
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Legend,
  PieChart, Pie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { useAIAnalyses } from '@/hooks/useAIAnalyses';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import AlertsPanel from './AlertsPanel';
import FarmsMap from './dashboard/FarmsMap';
import { analyzeParameter } from '@/lib/waterQualityThresholds';

interface ModernDashboardProps {
  onNavigate?: (tab: string) => void;
  canAccessModule?: (tabOrModuleId: string) => boolean;
}

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ElementType;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  trend?: { value: number; positive: boolean };
}> = ({ label, value, hint, icon: Icon, tone = 'primary', trend }) => {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600',
    warning: 'bg-amber-500/10 text-amber-600',
    danger: 'bg-red-500/10 text-red-600',
    info: 'bg-sky-500/10 text-sky-600',
  };
  return (
    <Card className="relative overflow-hidden border-border/60 hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 tracking-tight">{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
          </div>
          <div className={`p-2 rounded-lg ${tones[tone]} shrink-0`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        {trend && (
          <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
            <TrendingUp className={`w-3 h-3 ${trend.positive ? '' : 'rotate-180'}`} />
            {trend.positive ? '+' : ''}{trend.value}% vs période préc.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const QuickAction: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  tone?: string;
}> = ({ icon: Icon, label, onClick, tone = 'bg-primary/10 text-primary' }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl border border-border/60 bg-card hover:bg-accent hover:border-primary/40 transition-all text-center"
  >
    <div className={`p-2.5 rounded-lg ${tone} group-hover:scale-110 transition-transform`}>
      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
    </div>
    <span className="text-[11px] sm:text-xs font-medium leading-tight">{label}</span>
  </button>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const ModernDashboard: React.FC<ModernDashboardProps> = ({ onNavigate, canAccessModule = () => true }) => {
  const { activeUnit, setActiveUnit, units, getUnitEquipment, getUnitInfrastructures, getUnitDepreciableAssets, calculateDepreciation } = useProductionUnits();
  const { formatCurrency } = useSettings();
  const [showMap, setShowMap] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFarmFilter = searchParams.get('farm') || 'all';
  const selectedBasinFilter = searchParams.get('basin') || 'all';
  const periodParam = searchParams.get('period');
  const selectedPeriodFilter: '7' | '14' | '30' | '365' =
    periodParam === '14' || periodParam === '30' || periodParam === '365' ? periodParam : '7';
  

  const updateFilterParam = (key: 'farm' | 'basin' | 'period', value: string) => {
    const next = new URLSearchParams(searchParams);
    const isDefault =
      (key === 'farm' && value === 'all') ||
      (key === 'basin' && value === 'all') ||
      (key === 'period' && value === '7');
    if (isDefault) next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setSelectedFarmFilter = (v: string) => updateFilterParam('farm', v);
  const setSelectedBasinFilter = (v: string) => updateFilterParam('basin', v);
  const setSelectedPeriodFilter = (v: '7' | '14' | '30' | '365') => updateFilterParam('period', v);

  // Restaure l'unité active depuis l'URL (persiste les filtres entre modules)
  useEffect(() => {
    if (selectedFarmFilter === 'all') return;
    if (activeUnit?.id === selectedFarmFilter) return;
    const unit = units.find((u) => u.id === selectedFarmFilter);
    if (unit) setActiveUnit(unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmFilter, units]);

  const { cycles } = useProductionCycles(activeUnit?.id);
  const { batches } = useLivestockBatches(activeUnit?.id);
  const { records: healthRecords } = useHealthRecords(undefined, activeUnit?.id);
  const { records: feedingRecords } = useFeedingRecords(undefined, activeUnit?.id);
  const financial = useFinancialSummary(activeUnit?.id);
  const { analyses } = useAIAnalyses(8, activeUnit?.id);
  const { stocks: feedStocks } = useFeedStocks(activeUnit?.id);

  const go = (tab: string) => {
    if (canAccessModule(tab)) onNavigate?.(tab);
  };
  const canViewUnits = canAccessModule('units');
  const canViewProduction = canAccessModule('production') || canAccessModule('livestock');
  const canViewInfrastructure = canAccessModule('infrastructure');
  const canViewFeeding = canAccessModule('feeding');
  const canViewAlerts = canAccessModule('performance-alerts');
  const canViewFinance = ['accounting', 'sales', 'purchases', 'suppliers', 'hr'].some(canAccessModule);
  const defaultOperationalTab = canViewProduction ? 'cycles' : canViewInfrastructure ? 'equipment' : 'depreciation';
  const quickActions = [
    { id: 'livestock', icon: Plus, label: 'Ajouter une donnée', tone: 'bg-primary/10 text-primary' },
    { id: 'units', icon: Building2, label: 'Mes fermes', tone: 'bg-sky-500/10 text-sky-600' },
    { id: 'reports', icon: FileText, label: 'Générer un rapport', tone: 'bg-emerald-500/10 text-emerald-600' },
    { id: 'performance-alerts', icon: Bell, label: 'Voir les alertes', tone: 'bg-amber-500/10 text-amber-600' },
    { id: 'team', icon: Users, label: 'Utilisateurs', tone: 'bg-purple-500/10 text-purple-600' },
    { id: 'settings', icon: Settings, label: 'Paramètres', tone: 'bg-slate-500/10 text-slate-600' },
  ].filter((action) => canAccessModule(action.id));
  const basinOptions = useMemo(() => {
    const unitInfrastructures = activeUnit ? (getUnitInfrastructures?.(activeUnit.id) || []) : [];
    return unitInfrastructures.filter((infra: any) => infra.infrastructure_name);
  }, [activeUnit, getUnitInfrastructures]);

  // KPIs
  const activeCycles = cycles.filter((c) => c.status === 'active').length;
  const totalStock = batches.reduce((s, b) => s + (b.quantity || 0), 0);
  const estimatedProduction = batches.reduce(
    (s, b) => s + ((b.quantity || 0) * (b.average_weight || 0)) / 1000, 0
  );
  const criticalAlerts = analyses.filter((a) => a.alerte).length;
  const totalBiomassKg = batches.reduce(
    (sum, batch) => sum + (((batch.quantity || 0) * (batch.average_weight || 0)) / 1000),
    0,
  );
  const totalFeedRemaining = feedStocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);
  const lowFeedAlerts = feedStocks.filter((stock) => (stock.quantity || 0) <= (stock.min_threshold || 50)).length;
  const totalInitialStock = batches.reduce((sum, batch) => sum + ((batch as any).initial_quantity || batch.quantity || 0), 0);
  const survivalRate = totalInitialStock > 0
    ? Math.max(0, Math.min(100, Math.round((totalStock / totalInitialStock) * 100)))
    : 100;

  const filteredHealthRecords = useMemo(() => {
    const periodDays = Number(selectedPeriodFilter);
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - periodDays);

    return healthRecords.filter((record: any) => {
      const matchesBasin = selectedBasinFilter === 'all' || record.basin_id === selectedBasinFilter;
      const matchesPeriod = !record.date || new Date(record.date) >= minDate;
      return matchesBasin && matchesPeriod;
    });
  }, [healthRecords, selectedBasinFilter, selectedPeriodFilter]);

  const latestWater = useMemo(() => {
    const recent = filteredHealthRecords.slice(0, 10);
    if (recent.length === 0) return { temp: 0, oxy: 0, ph: 0 };
    const avg = (k: 'temperature' | 'oxygen' | 'ph') =>
      recent.reduce((s, r) => s + ((r as any)[k] || 0), 0) / recent.length;
    return {
      temp: +avg('temperature').toFixed(1),
      oxy: +avg('oxygen').toFixed(2),
      ph: +avg('ph').toFixed(2),
    };
  }, [filteredHealthRecords]);

  // Chart data — water quality last 14 records
  const waterChart = useMemo(() => {
    const recs = [...filteredHealthRecords]
      .slice(0, Number(selectedPeriodFilter))
      .reverse()
      .map((r, i) => ({
        label: r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : `J${i + 1}`,
        temperature: r.temperature || 0,
        oxygene: r.oxygen || 0,
        ph: r.ph || 0,
        timestamp: r.date || '',
      }));
    return recs;
  }, [filteredHealthRecords, selectedPeriodFilter]);

  // Production / mortality monthly
  const productionChart = useMemo(() => {
    return financial.monthlyData.map((m) => {
      const mortality = healthRecords
        .filter((r) => r.date?.includes(m.month))
        .reduce((s, r) => s + (r.mortality || 0), 0);
      const feed = feedingRecords
        .filter((r) => r.date?.includes(m.month))
        .reduce((s, r) => s + (r.quantity || 0), 0);
      return {
        month: m.month,
        production: Math.round(m.sales / 1000),
        mortalite: mortality,
        aliment: Math.round(feed),
      };
    });
  }, [financial.monthlyData, healthRecords, feedingRecords]);

  const unitReports = units.map((u) => {
    const uBatches = batches.filter((b) => b.unit_id === u.id);
    const uCycles = cycles.filter((c) => c.unit_id === u.id);
    const uStock = uBatches.reduce((s, b) => s + (b.quantity || 0), 0);
    const ratio = u.capacity ? Math.min(100, Math.round((uStock / u.capacity) * 100)) : 0;
    const status = !u.isActive ? 'critical' : ratio > 85 ? 'warning' : 'normal';
    return { unit: u, activeCycles: uCycles.filter((c) => c.status === 'active').length, stock: uStock, ratio, status };
  });

  const thresholdRecommendations = useMemo(() => {
    if (filteredHealthRecords.length === 0) return [];

    return [
      analyzeParameter('oxygen', latestWater.oxy),
      analyzeParameter('temperature', latestWater.temp),
      analyzeParameter('ph', latestWater.ph),
    ].filter(Boolean);
  }, [latestWater, filteredHealthRecords.length]);

  const recommendations = useMemo(() => {
    const list: { title: string; detail: string; tone: 'danger' | 'warning' | 'info' }[] = [];

    thresholdRecommendations.forEach((alert: any) => {
      list.push({
        title: alert.message,
        detail: alert.recommendation,
        tone: alert.level === 'critical' ? 'danger' : 'warning',
      });
    });

    analyses
      .filter((analysis) => analysis.alerte)
      .slice(0, 2)
      .forEach((analysis) => {
        list.push({
          title: 'Analyse IA requise',
          detail: analysis.conseil,
          tone: 'danger',
        });
      });

    return list;
  }, [thresholdRecommendations, analyses]);

  const latestRecordDate = filteredHealthRecords[0]?.date;
  const freshnessLabel = latestRecordDate
    ? new Date(latestRecordDate).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Aucun relevé';
  const isConnected = filteredHealthRecords.length > 0;

  // Cycles progression (temporelle + production)
  const cycleProgress = useMemo(() => {
    return cycles
      .filter((c) => c.status === 'active')
      .slice(0, 5)
      .map((c: any) => {
        const start = c.start_date ? new Date(c.start_date) : null;
        const durationDays = c.expected_duration || c.duration || 0;
        const elapsed = start ? Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000)) : 0;
        const timeProgress = durationDays > 0 ? Math.min(100, Math.round((elapsed / durationDays) * 100)) : 0;
        const target = c.target_production || c.expected_production || 0;
        const current = c.current_production || 0;
        const prodProgress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        return { id: c.id, name: c.name || c.cycle_name || `Cycle ${c.id?.slice(0, 4)}`, startDate: start, elapsed, timeProgress, current, target, prodProgress };
      });
  }, [cycles]);

  const unitEquipment = activeUnit ? (getUnitEquipment?.(activeUnit.id) || []) : [];
  const unitInfra = activeUnit ? (getUnitInfrastructures?.(activeUnit.id) || []) : [];
  const unitAssets = activeUnit ? (getUnitDepreciableAssets?.(activeUnit.id) || []) : [];
  const unitLabel = activeUnit?.name?.toUpperCase() || 'GLOBAL';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Bandeau de pilotage */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-brand text-white px-3 py-2.5 sm:px-5 sm:py-3 shadow-lg">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/20 blur-3xl" aria-hidden />

        <div className="relative flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white ring-1 ring-white/30">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              {isConnected ? 'En direct' : 'Hors ligne'}
            </span>
            <h1 className="mt-1 text-base sm:text-2xl font-bold tracking-tight text-white leading-tight">Centre de pilotage</h1>
            <p className="text-[10px] sm:text-xs text-white/80 truncate">
              {unitLabel} · Dernier relevé : {freshnessLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Sélecteur de période façon segment Jour / Mois / Année */}
            <div className="flex items-center rounded-full bg-white/15 p-0.5">
              {([['7', 'Jour'], ['30', 'Mois'], ['365', 'Année']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedPeriodFilter(value as any)}
                  className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-colors ${
                    selectedPeriodFilter === value ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Petite icône pour choisir l'unité de production */}
            <Select
              value={activeUnit?.id || 'all'}
              onValueChange={(v) => {
                if (v === 'all') { setActiveUnit(null); setSelectedFarmFilter('all'); return; }
                const u = units.find((x) => x.id === v);
                if (u) { setActiveUnit(u); setSelectedFarmFilter(v); }
              }}
            >
              <SelectTrigger
                aria-label="Choisir l'unité de production"
                className="h-8 w-8 p-0 justify-center rounded-full bg-white/15 border-white/25 text-white [&>svg:last-child]:hidden"
              >
                <Building2 className="w-4 h-4" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Toutes les unités</SelectItem>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>


      {/* KPIs — 4 cartes principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Fermes */}
        {canViewUnits && <Card className="relative overflow-hidden border-l-4 border-l-indigo-500 border-y-border/60 border-r-border/60 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-indigo-950/20 hover:shadow-md transition-shadow">
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-indigo-700 dark:text-indigo-300 font-semibold uppercase tracking-wide truncate">Fermes</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 tracking-tight leading-tight text-slate-900 dark:text-white">{units.length}</p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-md bg-indigo-500 text-white shadow-sm shrink-0">
                <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 truncate font-medium">{units.filter((u) => u.isActive).length} actives</p>
            <div className="mt-2 grid grid-cols-1 gap-1 text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-500 dark:text-slate-400">Active</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{activeUnit?.name || 'Globale'}</span>
              </div>
            </div>
          </CardContent>
        </Card>}
        {/* Cycles actifs */}
        {canViewProduction && <Card className="relative overflow-hidden border-l-4 border-l-sky-500 border-y-border/60 border-r-border/60 bg-gradient-to-br from-sky-50 via-white to-sky-50/40 dark:from-sky-950/40 dark:via-slate-900 dark:to-sky-950/20 hover:shadow-md transition-shadow">
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-sky-700 dark:text-sky-300 font-semibold uppercase tracking-wide truncate">Cycles actifs</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 tracking-tight leading-tight text-slate-900 dark:text-white">{activeCycles}</p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-md bg-sky-500 text-white shadow-sm shrink-0">
                <Factory className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 truncate font-medium">{cycles.length} cycles total</p>
            <div className="mt-2 rounded-md border border-sky-200/70 dark:border-sky-800/60 bg-white/70 dark:bg-slate-900/40 p-1.5 text-[10px]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">Effectifs</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{totalStock.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>}
        {/* Biomasse */}
        {canViewProduction && <Card className="relative overflow-hidden border-l-4 border-l-emerald-500 border-y-border/60 border-r-border/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20 hover:shadow-md transition-shadow">
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wide truncate">Biomasse</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 tracking-tight leading-tight text-slate-900 dark:text-white">{totalBiomassKg.toFixed(1)}<span className="text-[10px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-300 ml-1">kg</span></p>
              </div>
              <div className="p-1.5 sm:p-2 rounded-md bg-emerald-500 text-white shadow-sm shrink-0">
                <Fish className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 truncate font-medium">Estimée en cours</p>
            <div className="mt-2 rounded-md border border-emerald-200/70 dark:border-emerald-800/60 bg-white/70 dark:bg-slate-900/40 p-1.5 text-[10px]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">Survie</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{survivalRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>}
        {/* Alertes */}
        {(canViewAlerts || canViewFeeding) && <Card className={`relative overflow-hidden border-l-4 border-y-border/60 border-r-border/60 hover:shadow-md transition-shadow ${criticalAlerts > 0 ? 'border-l-red-500 bg-gradient-to-br from-red-50 via-white to-red-50/40 dark:from-red-950/40 dark:via-slate-900 dark:to-red-950/20' : 'border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-emerald-950/20'}`}>
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate ${criticalAlerts > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>Alertes</p>
                <p className="text-lg sm:text-2xl font-bold mt-0.5 tracking-tight leading-tight text-slate-900 dark:text-white">{criticalAlerts}</p>
              </div>
              <div className={`p-1.5 sm:p-2 rounded-md shadow-sm shrink-0 text-white ${criticalAlerts > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}>
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-1 truncate font-medium">24 dernières heures</p>
            <div className={`mt-2 rounded-md border p-1.5 text-[10px] bg-white/70 dark:bg-slate-900/40 ${criticalAlerts > 0 ? 'border-red-200/70 dark:border-red-800/60' : 'border-emerald-200/70 dark:border-emerald-800/60'}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-500 dark:text-slate-400">Stocks bas</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{lowFeedAlerts}</span>
              </div>
            </div>
          </CardContent>
        </Card>}
      </div>


      {/* Quick access */}
      {quickActions.length > 0 && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Accès rapides
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
            {quickActions.map((action) => (
              <QuickAction key={action.id} icon={action.icon} label={action.label} onClick={() => go(action.id)} tone={action.tone} />
            ))}
          </div>
        </CardContent>
      </Card>}

      {/* Finance evolution + Donut (placés au-dessus) */}
      {canViewFinance && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> Évolution financière (6 derniers mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financial.monthlyData}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenus" stroke="#10b981" fill="url(#gRev)" />
                  <Area type="monotone" dataKey="expenses" name="Dépenses" stroke="#ef4444" fill="url(#gExp)" />
                  <Line type="monotone" dataKey="profit" name="Bénéfice" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" /> Répartition des dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financial.expenseBreakdown.length ? financial.expenseBreakdown : [{ name: 'Aucune', value: 1, color: '#e5e7eb' }]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {(financial.expenseBreakdown.length ? financial.expenseBreakdown : [{ name: 'Aucune', value: 1, color: '#e5e7eb' }]).map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>}

      {/* Résumé Financier — déplacé sous l'évolution financière et la répartition des dépenses */}
      {canViewFinance && <Card className="border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/10 dark:border-emerald-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" /> Résumé Financier — {unitLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <TrendingUp className="w-3.5 h-3.5" /> Revenus
              </div>
              <p className="text-lg sm:text-xl font-bold mt-1 text-emerald-600">{formatCurrency(financial.totalRevenue)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{financial.confirmedSales} ventes</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                <ShoppingCart className="w-3.5 h-3.5" /> Dépenses
              </div>
              <p className="text-lg sm:text-xl font-bold mt-1 text-red-600">{formatCurrency(financial.totalExpenses)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{financial.purchasesCount} achats</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium">
                <UserCog className="w-3.5 h-3.5" /> Salaires
              </div>
              <p className="text-lg sm:text-xl font-bold mt-1 text-purple-600">{formatCurrency(financial.totalSalaries)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{financial.employeesCount} employés</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <CircleDollarSign className="w-3.5 h-3.5" /> Solde
              </div>
              <p className={`text-lg sm:text-xl font-bold mt-1 ${financial.netBalance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(financial.netBalance)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{financial.netBalance >= 0 ? 'Bénéfice' : 'Perte'}</p>
            </div>
          </div>
        </CardContent>
      </Card>}

      {/* Analytics + Finance details + AI reco */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {canViewFinance && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Indicateurs comparatifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Revenus', value: financial.totalRevenue },
                    { name: 'Dépenses', value: financial.totalExpenses },
                    { name: 'Stock alim.', value: financial.feedStockValue },
                    { name: 'Conso alim.', value: financial.feedConsumed },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-600" /> Paramètres en direct
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 mb-3 text-[10px] sm:text-xs text-muted-foreground">
              <span>Dernier relevé: <span className="font-medium text-foreground">{freshnessLabel}</span></span>
              <span className={`inline-flex items-center gap-1 ${isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isConnected ? 'Connecté' : 'Déconnecté'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-center min-h-[78px] flex flex-col justify-center">
                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Thermometer className="w-3 h-3" /> Temp.</p>
                <p className={`text-sm font-bold ${latestWater.temp > 30 || latestWater.temp < 22 ? 'text-red-600' : 'text-foreground'}`}>{latestWater.temp}°C</p>
                {waterChart.length > 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    {waterChart[waterChart.length - 1].temperature >= waterChart[waterChart.length - 2].temperature ? '↗' : '↘'}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-center min-h-[78px] flex flex-col justify-center">
                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Wind className="w-3 h-3" /> O₂</p>
                <p className={`text-sm font-bold ${latestWater.oxy < 5 ? 'text-red-600' : 'text-foreground'}`}>{latestWater.oxy} mg/L</p>
                {waterChart.length > 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    {waterChart[waterChart.length - 1].oxygene >= waterChart[waterChart.length - 2].oxygene ? '↗' : '↘'}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-center min-h-[78px] flex flex-col justify-center">
                <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Droplets className="w-3 h-3" /> pH</p>
                <p className={`text-sm font-bold ${latestWater.ph < 6.5 || latestWater.ph > 8.5 ? 'text-red-600' : 'text-foreground'}`}>{latestWater.ph}</p>
                {waterChart.length > 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    {waterChart[waterChart.length - 1].ph >= waterChart[waterChart.length - 2].ph ? '↗' : '↘'}
                  </p>
                )}
              </div>
            </div>
            <div className="h-[90px] sm:h-[96px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waterChart.slice(-7)}>
                  <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="oxygene" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ph" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">Tendances sur 7 derniers jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" /> Recommandations IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 mb-3 text-[10px] sm:text-xs text-muted-foreground">
              <span>Signal: <span className="font-medium text-foreground">{recommendations.length > 0 ? 'Action requise' : 'RAS'}</span></span>
              <span className={`inline-flex items-center gap-1 ${isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isConnected ? 'Flux actif' : 'Hors ligne'}
              </span>
            </div>
            {/* Mini paramètres en ligne */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Temp.</span>
                  <span className={`text-xs font-bold ${latestWater.temp > 30 || latestWater.temp < 22 ? 'text-red-600' : 'text-foreground'}`}>{latestWater.temp}°C</span>
                </div>
                <div className="h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waterChart.slice(-7)}>
                      <Area type="monotone" dataKey="temperature" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">O₂</span>
                  <span className={`text-xs font-bold ${latestWater.oxy < 5 ? 'text-red-600' : 'text-foreground'}`}>{latestWater.oxy} mg/L</span>
                </div>
                <div className="h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waterChart.slice(-7)}>
                      <Area type="monotone" dataKey="oxygene" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">pH</span>
                  <span className={`text-xs font-bold ${latestWater.ph < 6.5 || latestWater.ph > 8.5 ? 'text-red-600' : 'text-foreground'}`}>{latestWater.ph}</span>
                </div>
                <div className="h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waterChart.slice(-7)}>
                      <Area type="monotone" dataKey="ph" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[190px] overflow-y-auto pr-1">
              {recommendations.length > 0 ? recommendations.map((r, i) => {
              const tones: Record<string, string> = {
                danger: 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900',
                warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900',
                info: 'border-sky-200 bg-sky-50 dark:bg-sky-950/20 dark:border-sky-900',
              };
              return (
                <div key={i} className={`p-2.5 rounded-lg border ${tones[r.tone]}`}>
                  <p className="font-semibold text-xs">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{r.detail}</p>
                </div>
              );
              }) : (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="font-semibold text-xs text-emerald-700 dark:text-emerald-300">Aucune recommandation nécessaire</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Les recommandations IA restent masquées tant qu'aucun seuil critique ou d'avertissement n'est franchi.</p>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => go('aqua-assistant')}>
              Ouvrir AquaAssistant
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Reports per unit */}
      {(canViewProduction || canViewInfrastructure || canViewFinance) && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-600" /> Suivi opérationnel — {unitLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultOperationalTab} className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
              {canViewProduction && <TabsTrigger value="cycles" className="text-xs sm:text-sm">Cycles</TabsTrigger>}
              {canViewInfrastructure && <TabsTrigger value="equipment" className="text-xs sm:text-sm">Équipements</TabsTrigger>}
              {canViewInfrastructure && <TabsTrigger value="infrastructure" className="text-xs sm:text-sm">Infrastructures</TabsTrigger>}
              {canViewFinance && <TabsTrigger value="depreciation" className="text-xs sm:text-sm">Amortissements</TabsTrigger>}
            </TabsList>

            {canViewProduction && <TabsContent value="cycles" className="space-y-3 mt-4">
              {cycleProgress.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun cycle actif en cours.</p>
              ) : (
                cycleProgress.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        {c.startDate && (
                          <p className="text-[11px] text-muted-foreground">
                            Démarré le {c.startDate.toLocaleDateString('fr-FR')} • {c.elapsed} jours
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-[10px]">En cours</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Progression temporelle</span>
                          <span className="font-medium">{c.timeProgress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-cyan-500" style={{ width: `${c.timeProgress}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Production</span>
                          <span className="font-medium">{c.current.toLocaleString()}/{c.target.toLocaleString()}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${c.prodProgress}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>}

            {canViewInfrastructure && <TabsContent value="equipment" className="space-y-3 mt-4">
              {unitEquipment.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun équipement enregistré pour cette unité.</p>
              ) : (
                unitEquipment.slice(0, 8).map((e: any) => {
                  const cap = Number(e.capacity || e.maxCapacity || 0);
                  const used = Number(e.currentUsage || e.usage || 0);
                  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
                  return (
                    <div key={e.id} className="p-3 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-2"><Wrench className="w-3.5 h-3.5 text-muted-foreground" />{e.name || e.type}</p>
                          <p className="text-[11px] text-muted-foreground">{e.type} {e.brand ? `• ${e.brand}` : ''}</p>
                        </div>
                        <Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {e.status || 'actif'}
                        </Badge>
                      </div>
                      {cap > 0 && (
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">Utilisation</span>
                            <span className="font-medium">{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>}

            {canViewInfrastructure && <TabsContent value="infrastructure" className="space-y-3 mt-4">
              {unitInfra.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune infrastructure enregistrée.</p>
              ) : (
                unitInfra.slice(0, 8).map((inf: any) => {
                  const cap = Number(inf.capacity || 0);
                  const occ = Number(inf.currentOccupancy || inf.occupancy || 0);
                  const pct = cap > 0 ? Math.min(100, Math.round((occ / cap) * 100)) : 0;
                  return (
                    <div key={inf.id} className="p-3 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-muted-foreground" />{inf.name}</p>
                          <p className="text-[11px] text-muted-foreground">{inf.type} {cap ? `• capacité ${cap.toLocaleString()}` : ''}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{inf.status || 'actif'}</Badge>
                      </div>
                      {cap > 0 && (
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">Occupation</span>
                            <span className="font-medium">{occ.toLocaleString()}/{cap.toLocaleString()}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full ${pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>}

            {canViewFinance && <TabsContent value="depreciation" className="space-y-3 mt-4">
              {unitAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun actif amortissable enregistré.</p>
              ) : (
                unitAssets.slice(0, 8).map((a: any) => {
                  const depRaw: any = calculateDepreciation ? calculateDepreciation(a) : null;
                  const dep = depRaw && typeof depRaw === 'object'
                    ? depRaw
                    : { currentValue: a.purchaseValue || 0, totalDepreciated: 0, percentageDepreciated: 0 };
                  return (
                    <div key={a.id} className="p-3 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm flex items-center gap-2"><PiggyBank className="w-3.5 h-3.5 text-muted-foreground" />{a.name}</p>
                          <p className="text-[11px] text-muted-foreground">Valeur initiale : {formatCurrency(a.purchaseValue || 0)}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-700">{formatCurrency(dep.currentValue)}</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Amortissement cumulé</span>
                          <span className="font-medium">{Math.round(dep.percentageDepreciated || 0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, dep.percentageDepreciated || 0)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>}
          </Tabs>
        </CardContent>
      </Card>}

      {(canViewUnits || canAccessModule('reports')) && <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Rapports des unités de production
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => go('reports')}>
            <Download className="w-3.5 h-3.5 mr-1" /> Exporter
          </Button>
        </CardHeader>
        <CardContent>
          {unitReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune unité de production enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Unité</th>
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 font-medium">Cycles actifs</th>
                    <th className="py-2 font-medium">Stock</th>
                    <th className="py-2 font-medium">Occupation</th>
                    <th className="py-2 font-medium">Statut</th>
                    <th className="py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unitReports.map((r) => (
                    <tr key={r.unit.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="py-2.5 font-medium">{r.unit.name}</td>
                      <td className="py-2.5 text-muted-foreground capitalize">{r.unit.type}</td>
                      <td className="py-2.5">{r.activeCycles}</td>
                      <td className="py-2.5">{r.stock.toLocaleString()}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full ${r.ratio > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${r.ratio}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{r.ratio}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge variant={r.status === 'critical' ? 'destructive' : r.status === 'warning' ? 'secondary' : 'default'} className="text-[10px]">
                          {r.status === 'critical' ? 'Critique' : r.status === 'warning' ? 'Attention' : 'Normal'}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => go('reports')}>
                          Détails <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Alerts panel */}
      {canViewAlerts && <AlertsPanel />}

      {/* Map (option) */}
      {canViewUnits && <div>
        <Button variant="outline" size="sm" onClick={() => setShowMap((v) => !v)} className="gap-2">
          <MapIcon className="w-4 h-4" />
          {showMap ? 'Masquer la carte des fermes' : 'Afficher la carte des fermes'}
          {showMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
        {showMap && (
          <div className="mt-3">
            <FarmsMap />
          </div>
        )}
      </div>}
    </div>
  );
};

export default ModernDashboard;