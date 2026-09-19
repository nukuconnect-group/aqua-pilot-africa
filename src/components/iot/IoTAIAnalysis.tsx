import { getRuntimeLanguage } from '@/i18n/runtime';
import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, Loader2, History, Trash2, TrendingUp, Zap, RefreshCw, 
  Cpu, Radio, Clock, ChevronRight, Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { toast } from 'sonner';
import { useAIAnalyses } from '@/hooks/useAIAnalyses';
import { useIoT } from '@/contexts/IoTContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { cn } from '@/lib/utils';
import { diagnoseWaterQuality, type WaterQualityDiagnosis } from '@/lib/waterQualityThresholds';

// Composants professionnels
import { HealthScoreCard } from './analysis/HealthScoreCard';
import { ParametersDashboard } from './analysis/ParametersDashboard';
import { AlertCard } from './analysis/AlertCard';
import { AIRecommendationCard } from './analysis/AIRecommendationCard';
import { ManualInputForm } from './analysis/ManualInputForm';

interface IoTData {
  temperature: number;
  oxygene_dissous: number;
  ph: number;
  ammonium: number;
  nitrite: number;
}

interface AquapiloteResponse {
  alerte: boolean;
  conseil: string;
}

const IoTAIAnalysis = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AquapiloteResponse | null>(null);
  const [autoAnalysisResult, setAutoAnalysisResult] = useState<AquapiloteResponse | null>(null);
  const [localDiagnosis, setLocalDiagnosis] = useState<WaterQualityDiagnosis | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [lastAutoUpdate, setLastAutoUpdate] = useState<Date | null>(null);
  const { analyses, loading: loadingHistory, refetch, deleteAnalysis } = useAIAnalyses(20);
  const { basins, sensorReadings } = useIoT();
  
  const [iotData, setIotData] = useState<IoTData>({
    temperature: 25,
    oxygene_dissous: 7.5,
    ph: 7.2,
    ammonium: 0.5,
    nitrite: 0.2
  });

  // Récupérer les dernières données des capteurs IoT automatiquement
  const latestSensorData = useMemo(() => {
    if (basins.length === 0) return null;
    
    const latestReadings = {
      temperature: 0,
      oxygene_dissous: 0,
      ph: 0,
      count: { temp: 0, oxygen: 0, ph: 0 }
    };

    basins.forEach(basin => {
      const basinReadings = sensorReadings
        .filter(r => r.basinId === basin.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const tempReading = basinReadings.find(r => r.sensorType === 'temperature');
      const oxygenReading = basinReadings.find(r => r.sensorType === 'oxygen');
      const phReading = basinReadings.find(r => r.sensorType === 'ph');

      if (tempReading) {
        latestReadings.temperature += tempReading.value;
        latestReadings.count.temp++;
      }
      if (oxygenReading) {
        latestReadings.oxygene_dissous += oxygenReading.value;
        latestReadings.count.oxygen++;
      }
      if (phReading) {
        latestReadings.ph += phReading.value;
        latestReadings.count.ph++;
      }
    });

    if (latestReadings.count.temp === 0 && latestReadings.count.oxygen === 0 && latestReadings.count.ph === 0) {
      return null;
    }

    return {
      temperature: latestReadings.count.temp > 0 ? latestReadings.temperature / latestReadings.count.temp : 25,
      oxygene_dissous: latestReadings.count.oxygen > 0 ? latestReadings.oxygene_dissous / latestReadings.count.oxygen : 7.5,
      ph: latestReadings.count.ph > 0 ? latestReadings.ph / latestReadings.count.ph : 7.2,
      ammonium: 0.5,
      nitrite: 0.2
    };
  }, [sensorReadings, basins]);

  // Réinitialiser les résultats quand on change de mode
  useEffect(() => {
    setResult(null);
    setAutoAnalysisResult(null);
    setLocalDiagnosis(null);
  }, [mode]);

  // Diagnostic local instantané
  useEffect(() => {
    if (latestSensorData) {
      const diagnosis = diagnoseWaterQuality({
        temperature: latestSensorData.temperature,
        ph: latestSensorData.ph,
        oxygen: latestSensorData.oxygene_dissous,
        ammonia: latestSensorData.ammonium,
        nitrite: latestSensorData.nitrite
      });
      setLocalDiagnosis(diagnosis);

      if (diagnosis.overallStatus === 'critical') {
        diagnosis.alerts
          .filter(a => a.level === 'critical')
          .forEach(alert => {
            toast.error(`${alert.icon} ${alert.message}`, {
              duration: 10000,
              description: alert.urgency
            });
          });
      }
    }
  }, [latestSensorData]);

  // Analyse automatique
  useEffect(() => {
    if (mode === 'auto' && latestSensorData) {
      const analyzeAuto = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('aquapilote-recommendation', {
            body: { iotData: latestSensorData, language: getRuntimeLanguage() }
          });

          if (!error && !data.error) {
            setAutoAnalysisResult(data);
            setLastAutoUpdate(new Date());
          }
        } catch (error) {
          console.error('Erreur analyse automatique:', error);
        }
      };

      const interval = setInterval(analyzeAuto, 30000);
      analyzeAuto();

      return () => clearInterval(interval);
    }
  }, [mode, latestSensorData]);

  const handleAnalyze = async () => {
    if (!user) {
      toast.error('Vous devez être connecté pour utiliser l\'analyse IA');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('aquapilote-recommendation', {
        body: { iotData, language: getRuntimeLanguage() }
      });

      if (error) {
        toast.error(`Erreur lors de l'analyse: ${error.message}`);
        return;
      }

      if (data && data.error) {
        toast.error(`Erreur: ${data.error}`);
        return;
      }

      if (data) {
        setResult(data);
        toast.success('✅ Analyse terminée avec succès');
        await refetch();
      }
    } catch (error) {
      toast.error(`Une erreur est survenue`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnalysis(id);
      toast.success('Analyse supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setIotData(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  // Données pour les graphiques
  const chartData = useMemo(() => {
    return [...analyses]
      .reverse()
      .map(analysis => ({
        date: format(new Date(analysis.created_at), 'dd/MM HH:mm', { locale: fr }),
        temperature: Number(analysis.temperature),
        oxygene: Number(analysis.oxygene_dissous),
        ph: Number(analysis.ph),
        ammonium: Number(analysis.ammonium),
        nitrite: Number(analysis.nitrite),
        alerte: analysis.alerte
      }));
  }, [analyses]);

  // Diagnostic manuel instantané
  const manualDiagnosis = useMemo(() => {
    return diagnoseWaterQuality({
      temperature: iotData.temperature,
      ph: iotData.ph,
      oxygen: iotData.oxygene_dissous,
      ammonia: iotData.ammonium,
      nitrite: iotData.nitrite
    });
  }, [iotData]);

  return (
    <div className="space-y-6">
      {/* En-tête avec titre et badge de mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analyse IA Aquaculture</h1>
            <p className="text-sm text-muted-foreground">
              Diagnostic intelligent et recommandations en temps réel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            <Radio className={cn(
              "w-3 h-3",
              mode === 'auto' ? "text-emerald-500 animate-pulse" : "text-muted-foreground"
            )} />
            {mode === 'auto' ? 'Temps réel' : 'Manuel'}
          </Badge>
          {lastAutoUpdate && mode === 'auto' && (
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(lastAutoUpdate, { addSuffix: true, locale: fr })}
            </Badge>
          )}
        </div>
      </div>

      {/* Sélection du mode */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'auto' | 'manual')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-muted/50">
          <TabsTrigger 
            value="auto" 
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm h-full rounded-lg"
          >
            <Zap className="w-5 h-5" />
            <div className="text-left">
              <div className="font-semibold">Mode Automatique</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Capteurs IoT en temps réel</div>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="manual" 
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm h-full rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
            <div className="text-left">
              <div className="font-semibold">Mode Manuel</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Saisie personnalisée</div>
            </div>
          </TabsTrigger>
        </TabsList>

        {/* Contenu Mode Automatique */}
        <TabsContent value="auto" className="mt-6 space-y-6">
          {!latestSensorData ? (
            <Card className="border-2 border-dashed">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center gap-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Cpu className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">En attente des capteurs IoT</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Les données des capteurs seront analysées automatiquement dès leur réception
                    </p>
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Score de santé global */}
              {localDiagnosis && (
                <HealthScoreCard 
                  score={localDiagnosis.healthScore}
                  status={localDiagnosis.overallStatus}
                  summary={localDiagnosis.summary}
                />
              )}

              {/* Dashboard des paramètres */}
              <ParametersDashboard 
                data={latestSensorData} 
                lastUpdate={lastAutoUpdate || undefined}
              />

              {/* Alertes détaillées */}
              {localDiagnosis && localDiagnosis.alerts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Alertes et Recommandations
                      <Badge variant="destructive" className="ml-2">
                        {localDiagnosis.alerts.length}
                      </Badge>
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {localDiagnosis.alerts.map((alert, idx) => (
                      <AlertCard key={idx} alert={alert} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommandation IA */}
              {autoAnalysisResult && (
                <AIRecommendationCard 
                  hasAlert={autoAnalysisResult.alerte}
                  recommendation={autoAnalysisResult.conseil}
                  isAutomatic
                />
              )}
            </>
          )}
        </TabsContent>

        {/* Contenu Mode Manuel */}
        <TabsContent value="manual" className="mt-6 space-y-6">
          {/* Score de santé pour données manuelles */}
          {manualDiagnosis && (
            <HealthScoreCard 
              score={manualDiagnosis.healthScore}
              status={manualDiagnosis.overallStatus}
              summary={manualDiagnosis.summary}
            />
          )}

          {/* Formulaire de saisie */}
          <ManualInputForm 
            data={iotData}
            onChange={handleInputChange}
            onSubmit={handleAnalyze}
            isLoading={loading}
          />

          {/* Alertes pour données manuelles */}
          {manualDiagnosis.alerts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Diagnostic instantané
                <Badge variant="secondary">{manualDiagnosis.alerts.length} alerte(s)</Badge>
              </h2>
              {manualDiagnosis.alerts.map((alert, idx) => (
                <AlertCard key={idx} alert={alert} index={idx} />
              ))}
            </div>
          )}

          {/* Résultat de l'analyse IA */}
          {result && (
            <AIRecommendationCard 
              hasAlert={result.alerte}
              recommendation={result.conseil}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Graphiques d'évolution */}
      {analyses.length >= 2 && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Évolution des paramètres
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Visualisez les tendances sur les dernières analyses
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Graphique combiné */}
            <div>
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Vue d'ensemble</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOxygen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
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
                    dataKey="temperature" 
                    name="Température (°C)"
                    stroke="#f97316" 
                    fillOpacity={1}
                    fill="url(#colorTemp)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="oxygene" 
                    name="Oxygène (mg/L)"
                    stroke="#3b82f6" 
                    fillOpacity={1}
                    fill="url(#colorOxygen)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* pH */}
            <div>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                pH - Acidité
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} domain={[6, 9]} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="ph" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Ammoniaque et Nitrite */}
            <div>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                Composés azotés
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="ammonium" 
                    name="NH₃/NH₄⁺"
                    stroke="#a855f7" 
                    strokeWidth={2}
                    dot={{ fill: '#a855f7', r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="nitrite" 
                    name="NO₂⁻"
                    stroke="#ec4899" 
                    strokeWidth={2}
                    dot={{ fill: '#ec4899', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique des analyses */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Historique des analyses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Aucune analyse enregistrée</p>
              <p className="text-sm mt-1">Les analyses apparaîtront ici</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Card 
                    key={analysis.id}
                    className={cn(
                      "transition-all hover:shadow-md cursor-pointer",
                      analysis.alerte && "border-l-4 border-l-red-500"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={analysis.alerte ? "destructive" : "secondary"}>
                              {analysis.alerte ? '⚠️ Alerte' : '✅ Normal'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
                            <span className="bg-muted px-2 py-0.5 rounded">T: {analysis.temperature}°C</span>
                            <span className="bg-muted px-2 py-0.5 rounded">O₂: {analysis.oxygene_dissous} mg/L</span>
                            <span className="bg-muted px-2 py-0.5 rounded">pH: {analysis.ph}</span>
                            <span className="bg-muted px-2 py-0.5 rounded">NH₃: {analysis.ammonium} mg/L</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {analysis.conseil}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(analysis.id)}
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IoTAIAnalysis;
