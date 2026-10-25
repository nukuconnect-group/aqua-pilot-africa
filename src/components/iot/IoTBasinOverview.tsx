import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { 
  Thermometer, 
  Droplets, 
  Activity, 
  Wind,
  TrendingUp,
  TrendingDown,
  Minus,
  Wifi,
  WifiOff,
  AlertTriangle,
  Fish,
  FlaskConical,
  Waves,
  Beaker,
  Play
} from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useIoT } from '@/contexts/IoTContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { getDemoData, DemoIoTBasin } from '@/lib/demoData';

// 6 paramètres IoT requis
const IOT_PARAMETERS = [
  { id: 'oxygen', name: 'Oxygène', unit: 'mg/L', icon: Wind, color: '#3b82f6', optimal: { min: 6, max: 10 } },
  { id: 'temperature', name: 'Température', unit: '°C', icon: Thermometer, color: '#ef4444', optimal: { min: 24, max: 28 } },
  { id: 'ph', name: 'pH', unit: '', icon: Droplets, color: '#8b5cf6', optimal: { min: 6.5, max: 8.0 } },
  { id: 'nitrite', name: 'Nitrite', unit: 'mg/L', icon: FlaskConical, color: '#f97316', optimal: { min: 0, max: 0.5 } },
  { id: 'nitrate', name: 'Nitrate', unit: 'mg/L', icon: Beaker, color: '#10b981', optimal: { min: 0, max: 50 } },
  { id: 'ammonia', name: 'Ammoniac', unit: 'mg/L', icon: Activity, color: '#ec4899', optimal: { min: 0, max: 0.02 } },
  { id: 'salinity', name: 'Salinité', unit: 'ppt', icon: Waves, color: '#06b6d4', optimal: { min: 0, max: 35 } },
];

interface BasinData {
  id: string;
  name: string;
  infrastructure_id: string;
  fish_count: number;
  fish_status: 'healthy' | 'warning' | 'critical';
  parameters: Record<string, { value: number; status: 'normal' | 'warning' | 'critical'; history: { time: string; value: number }[] }>;
}

interface Infrastructure {
  id: string;
  name: string;
  type: string;
  status: string | null;
  capacity: number | null;
}

const IoTBasinOverview: React.FC = () => {
  const { activeUnit } = useProductionUnits();
  const { sensorReadings, basins: contextBasins, realTimeData, getActiveAlerts } = useIoT();
  const { t } = useSettings();
  const { user, isDemoMode } = useAuth();
  
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
  const [selectedBasin, setSelectedBasin] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealSensors, setHasRealSensors] = useState(false);
  const [basinsData, setBasinsData] = useState<BasinData[]>([]);

  // Mode démonstration - charger les données IoT de démo
  useEffect(() => {
    if (isDemoMode) {
      const demoData = getDemoData();
      
      // Convertir les infrastructures de démo
      const demoInfrastructures: Infrastructure[] = demoData.infrastructures.map((infra: any) => ({
        id: infra.id,
        name: infra.name,
        type: infra.type,
        status: infra.status,
        capacity: infra.capacity
      }));
      
      setInfrastructures(demoInfrastructures);
      
      // Convertir les bassins IoT de démo
      const demoBasinsData: BasinData[] = demoData.iotBasins.map((basin: DemoIoTBasin) => ({
        id: basin.id,
        name: basin.name,
        infrastructure_id: basin.id,
        fish_count: basin.fishCount,
        fish_status: basin.fishStatus,
        parameters: basin.parameters
      }));
      
      setBasinsData(demoBasinsData);
      setHasRealSensors(true); // En démo, simuler des capteurs connectés
      setIsLoading(false);
      return;
    }
  }, [isDemoMode]);

  // Récupérer les infrastructures (bassins) depuis Supabase
  useEffect(() => {
    if (isDemoMode) return; // Skip si en mode démo
    
    const fetchInfrastructures = async () => {
      if (!user?.id || !activeUnit?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('unit_infrastructures')
          .select('id, name, type, status, capacity')
          .eq('unit_id', activeUnit.id)
          .eq('user_id', user.id)
          .order('name');

        if (error) throw error;

        setInfrastructures(data || []);
        
        // Pour l'instant, on considère qu'il n'y a pas de capteurs IoT réels
        // car la table iot_sensor_readings n'existe probablement pas
        setHasRealSensors(false);
      } catch (error) {
        console.error('Error fetching infrastructures:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInfrastructures();
  }, [user?.id, activeUnit?.id, isDemoMode]);

  // Construire les données des bassins (uniquement en mode non-démo)
  useEffect(() => {
    if (isDemoMode) return; // Skip si en mode démo
    
    if (infrastructures.length === 0) {
      setBasinsData([]);
      return;
    }

    const buildBasinsData = async () => {
      const data: BasinData[] = await Promise.all(
        infrastructures.map(async (infra) => {
          // Récupérer le nombre de poissons (depuis livestock_batches)
          let fishCount = 0;
          try {
            const { data: batchData } = await supabase
              .from('livestock_batches')
              .select('quantity')
              .eq('unit_id', activeUnit?.id || '')
              .eq('status', 'active');
            
            fishCount = batchData?.reduce((sum, batch) => sum + (batch.quantity || 0), 0) || 0;
          } catch (e) {
            console.error('Error fetching fish count:', e);
          }

          // Déterminer le statut des poissons
          let fishStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
          if (fishCount === 0) fishStatus = 'warning';

          // Les paramètres seront vides si pas de capteurs réels
          const parameters: Record<string, { value: number; status: 'normal' | 'warning' | 'critical'; history: { time: string; value: number }[] }> = {};

          return {
            id: infra.id,
            name: infra.name,
            infrastructure_id: infra.id,
            fish_count: fishCount,
            fish_status: fishStatus,
            parameters
          };
        })
      );

      setBasinsData(data);
    };

    buildBasinsData();
  }, [infrastructures, hasRealSensors, sensorReadings, realTimeData, activeUnit?.id, isDemoMode]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'warning':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal':
      case 'healthy':
        return 'Normal';
      case 'warning':
        return 'Attention';
      case 'critical':
        return 'Critique';
      default:
        return 'Inconnu';
    }
  };

  const filteredBasins = selectedBasin === 'all' 
    ? basinsData 
    : basinsData.filter(b => b.id === selectedBasin);

  const totalFishCount = basinsData.reduce((sum, b) => sum + b.fish_count, 0);
  const connectedSensors = hasRealSensors 
    ? basinsData.reduce((sum, b) => sum + Object.keys(b.parameters).length, 0) 
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Badge mode démonstration */}
      {isDemoMode && (
        <Card className="border-2 border-green-300 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Play className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  Mode Démonstration IoT
                </h3>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Données simulées pour illustrer les fonctionnalités de monitoring en temps réel
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                {hasRealSensors ? (
                  <Wifi className="w-5 h-5 text-blue-600" />
                ) : (
                  <WifiOff className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capteurs connectés</p>
                <p className="text-2xl font-bold">{connectedSensors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <Waves className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bassins</p>
                <p className="text-2xl font-bold">{infrastructures.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Fish className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Poissons totaux</p>
                <p className="text-2xl font-bold">{totalFishCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alertes actives</p>
                <p className="text-2xl font-bold">{isDemoMode ? 2 : getActiveAlerts().length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message si aucun capteur connecté (seulement en mode non-démo) */}
      {!hasRealSensors && !isDemoMode && (
        <Card className="border-2 border-dashed border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-6 text-center">
            <WifiOff className="w-12 h-12 mx-auto mb-4 text-orange-500" />
            <h3 className="text-lg font-semibold mb-2 text-orange-800 dark:text-orange-200">
              Aucun capteur connecté
            </h3>
            <p className="text-sm text-orange-600 dark:text-orange-300 mb-4">
              Connectez vos capteurs IoT pour visualiser les données en temps réel de vos bassins.
            </p>
            <p className="text-xs text-muted-foreground">
              Allez dans l'onglet "Configuration" pour paramétrer votre connexion MQTT.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Message si aucune infrastructure (seulement en mode non-démo) */}
      {infrastructures.length === 0 && !isDemoMode && (
        <Card className="border-2 border-dashed border-muted-foreground/25">
          <CardContent className="p-6 text-center">
            <Waves className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucune infrastructure</h3>
            <p className="text-sm text-muted-foreground">
              Créez des bassins dans le module "Infrastructures" pour les voir ici.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sélecteur de bassin et affichage des données */}
      {(infrastructures.length > 0 || isDemoMode) && basinsData.length > 0 && (
        <>
          <Tabs value={selectedBasin} onValueChange={setSelectedBasin}>
            <div className="min-w-0 max-w-full overflow-x-auto">
              <TabsList className="inline-flex w-auto min-w-full gap-1 mb-4">
                <TabsTrigger value="all" className="text-xs sm:text-sm whitespace-nowrap">
                  Tous les bassins
                </TabsTrigger>
                {basinsData.map((basin) => (
                  <TabsTrigger 
                    key={basin.id} 
                    value={basin.id}
                    className="text-xs sm:text-sm whitespace-nowrap"
                  >
                    {basin.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Grille des 6 paramètres */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {IOT_PARAMETERS.slice(0, 6).map((param) => {
                const IconComponent = param.icon;
                
                // Calculer la valeur moyenne si "tous les bassins" est sélectionné
                let displayValue: number | null = null;
                let status: 'normal' | 'warning' | 'critical' = 'normal';
                
                if (hasRealSensors) {
                  if (selectedBasin === 'all') {
                    const values = basinsData
                      .map(b => b.parameters[param.id]?.value)
                      .filter((v): v is number => v !== undefined);
                    
                    if (values.length > 0) {
                      displayValue = values.reduce((a, b) => a + b, 0) / values.length;
                    }
                  } else {
                    const basin = basinsData.find(b => b.id === selectedBasin);
                    displayValue = basin?.parameters[param.id]?.value ?? null;
                    status = basin?.parameters[param.id]?.status ?? 'normal';
                  }
                }

                return (
                  <Card 
                    key={param.id} 
                    className="border-l-4 transition-all hover:shadow-md"
                    style={{ borderLeftColor: param.color }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="p-1.5 rounded-lg"
                          style={{ backgroundColor: `${param.color}20` }}
                        >
                          <IconComponent className="w-4 h-4" style={{ color: param.color }} />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{param.name}</span>
                      </div>
                      <div className="text-lg font-bold">
                        {displayValue !== null ? (
                          <>
                            {displayValue.toFixed(1)}
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              {param.unit}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </div>
                      {displayValue !== null && (
                        <Badge className={`mt-1 text-xs ${getStatusColor(status)}`}>
                          {getStatusText(status)}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Tabs>

          {/* Détails des bassins avec courbes - Affiche les courbes par paramètre */}
          {hasRealSensors && filteredBasins.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Évolution des paramètres (24h)
              </h3>
              
              {/* Courbes par paramètre */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {IOT_PARAMETERS.slice(0, 6).map((param) => {
                  const IconComponent = param.icon;
                  
                  // Collecter les données de tous les bassins filtrés pour ce paramètre
                  const hasData = filteredBasins.some(b => b.parameters[param.id]?.history?.length > 0);
                  if (!hasData) return null;
                  
                  // Pour un seul bassin, utiliser directement ses données
                  // Pour "tous", prendre le premier bassin avec des données
                  const basinWithData = filteredBasins.find(b => b.parameters[param.id]?.history?.length > 0);
                  const chartData = basinWithData?.parameters[param.id]?.history || [];
                  
                  return (
                    <Card key={param.id} className="border-l-4" style={{ borderLeftColor: param.color }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <IconComponent className="w-4 h-4" style={{ color: param.color }} />
                          {param.name}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {param.optimal.min} - {param.optimal.max} {param.unit}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id={`gradient-${param.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={param.color} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={param.color} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="time" 
                                tick={{ fontSize: 9 }} 
                                tickFormatter={(value) => value.split(':')[0] + 'h'}
                                interval="preserveStartEnd"
                              />
                              <YAxis 
                                tick={{ fontSize: 9 }} 
                                domain={['dataMin - 1', 'dataMax + 1']}
                                width={35}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  background: 'white', 
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '11px'
                                }}
                                formatter={(value: number) => [`${value.toFixed(2)} ${param.unit}`, param.name]}
                                labelFormatter={(label) => `Heure: ${label}`}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke={param.color}
                                strokeWidth={2}
                                fill={`url(#gradient-${param.id})`}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Courbes comparatives par bassin */}
              {selectedBasin === 'all' && filteredBasins.length > 1 && (
                <div className="space-y-4 mt-6">
                  <h4 className="text-md font-semibold flex items-center gap-2">
                    <Waves className="w-4 h-4 text-cyan-600" />
                    Comparaison par bassin
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredBasins.map((basin) => (
                      <Card key={basin.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Waves className="w-5 h-5 text-cyan-600" />
                              <CardTitle className="text-base">{basin.name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              <Fish className="w-4 h-4 text-emerald-600" />
                              <span className="text-sm font-medium">{basin.fish_count.toLocaleString()}</span>
                              <Badge className={getStatusColor(basin.fish_status)}>
                                {getStatusText(basin.fish_status)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-2">
                            {IOT_PARAMETERS.slice(0, 6).map((param) => {
                              const data = basin.parameters[param.id];
                              if (!data) return null;
                              const IconComp = param.icon;
                              
                              return (
                                <div 
                                  key={param.id} 
                                  className="p-2 rounded-lg text-center"
                                  style={{ backgroundColor: `${param.color}15` }}
                                >
                                  <IconComp className="w-3 h-3 mx-auto mb-1" style={{ color: param.color }} />
                                  <p className="text-xs font-bold" style={{ color: param.color }}>
                                    {data.value.toFixed(param.id === 'ammonia' ? 3 : 1)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{param.name}</p>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Liste des bassins avec infos poissons */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">État des bassins</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBasins.map((basin) => (
                <Card key={basin.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                          <Waves className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{basin.name}</h4>
                          <p className="text-xs text-muted-foreground">Infrastructure</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(basin.fish_status)}>
                        {getStatusText(basin.fish_status)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Fish className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs text-muted-foreground">Poissons</span>
                        </div>
                        <p className="text-lg font-bold">{basin.fish_count.toLocaleString()}</p>
                      </div>
                      
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Wifi className="w-4 h-4 text-blue-600" />
                          <span className="text-xs text-muted-foreground">Capteurs</span>
                        </div>
                        <p className="text-lg font-bold">{Object.keys(basin.parameters).length}</p>
                      </div>
                    </div>

                    {hasRealSensors && Object.keys(basin.parameters).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Paramètres actuels</p>
                        <div className="flex flex-wrap gap-1">
                          {IOT_PARAMETERS.slice(0, 4).map((param) => {
                            const data = basin.parameters[param.id];
                            if (!data) return null;
                            
                            return (
                              <Badge 
                                key={param.id}
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: param.color, color: param.color }}
                              >
                                {param.name}: {data.value.toFixed(1)} {param.unit}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IoTBasinOverview;
