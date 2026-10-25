import React, { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Activity, 
  Thermometer,
  Droplets,
  Fish,
  Weight,
  X,
  Bell,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { createNotification } from '@/lib/notificationService';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'growth' | 'mortality' | 'water_quality' | 'feeding' | 'production' | 'anomaly';
  title: string;
  description: string;
  timestamp: string;
  unitId?: string;
  unitName?: string;
  metrics?: {
    current: number;
    threshold: number;
    unit: string;
  };
  suggestion?: string;
  acknowledged?: boolean;
}

interface SmartAlertsProps {
  data?: any;
  unitId?: string;
  onDismiss?: (alertId: string) => void;
}

interface AlertThresholds {
  mortalityRate: number;
  growthRateMin: number;
  temperatureMin: number;
  temperatureMax: number;
  phMin: number;
  phMax: number;
  oxygenMin: number;
  feedingEfficiencyMin: number;
}

const SmartAlerts: React.FC<SmartAlertsProps> = ({ data, unitId, onDismiss }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [enabledCategories, setEnabledCategories] = useState({
    growth: true,
    mortality: true,
    water_quality: true,
    feeding: true,
    production: true,
    anomaly: true
  });
  
  // Track sent notifications to avoid duplicates
  const sentNotificationsRef = useRef<Set<string>>(new Set());
  
  const [thresholds, setThresholds] = useState<AlertThresholds>({
    mortalityRate: 2.5,
    growthRateMin: 2.0,
    temperatureMin: 18,
    temperatureMax: 32,
    phMin: 6.5,
    phMax: 8.5,
    oxygenMin: 5.0,
    feedingEfficiencyMin: 1.8
  });

  // Analyse automatique des données
  useEffect(() => {
    if (data) {
      analyzeData(data);
    }
  }, [data, thresholds, enabledCategories]);

  const analyzeData = (analysisData: any) => {
    const newAlerts: Alert[] = [];

    // Analyse de la mortalité
    if (enabledCategories.mortality && analysisData.mortality) {
      const mortalityRate = (analysisData.mortality / analysisData.quantity) * 100;
      if (mortalityRate > thresholds.mortalityRate) {
        newAlerts.push({
          id: `mort-${Date.now()}`,
          type: mortalityRate > thresholds.mortalityRate * 2 ? 'critical' : 'warning',
          category: 'mortality',
          title: 'Taux de mortalité élevé',
          description: `Le taux de mortalité de ${mortalityRate.toFixed(1)}% dépasse le seuil de ${thresholds.mortalityRate}%`,
          timestamp: new Date().toISOString(),
          unitName: analysisData.unitName,
          metrics: {
            current: mortalityRate,
            threshold: thresholds.mortalityRate,
            unit: '%'
          },
          suggestion: 'Vérifiez la qualité de l\'eau et les conditions d\'élevage. Consultez un vétérinaire si nécessaire.'
        });
      }
    }

    // Analyse de la croissance
    if (enabledCategories.growth && analysisData.growthRate !== undefined) {
      if (analysisData.growthRate < thresholds.growthRateMin) {
        newAlerts.push({
          id: `growth-${Date.now()}`,
          type: 'warning',
          category: 'growth',
          title: 'Croissance ralentie',
          description: `Taux de croissance de ${analysisData.growthRate.toFixed(1)}g/jour inférieur au minimum de ${thresholds.growthRateMin}g/jour`,
          timestamp: new Date().toISOString(),
          unitName: analysisData.unitName,
          metrics: {
            current: analysisData.growthRate,
            threshold: thresholds.growthRateMin,
            unit: 'g/jour'
          },
          suggestion: 'Ajustez la ration alimentaire et vérifiez les paramètres de l\'eau.'
        });
      }
    }

    // Analyse de la qualité de l'eau
    if (enabledCategories.water_quality) {
      if (analysisData.temperature !== undefined) {
        if (analysisData.temperature < thresholds.temperatureMin) {
          newAlerts.push({
            id: `temp-low-${Date.now()}`,
            type: 'warning',
            category: 'water_quality',
            title: 'Température basse',
            description: `Température de ${analysisData.temperature}°C en dessous du minimum de ${thresholds.temperatureMin}°C`,
            timestamp: new Date().toISOString(),
            unitName: analysisData.unitName,
            suggestion: 'Augmentez la température de l\'eau progressivement.'
          });
        } else if (analysisData.temperature > thresholds.temperatureMax) {
          newAlerts.push({
            id: `temp-high-${Date.now()}`,
            type: 'critical',
            category: 'water_quality',
            title: 'Température élevée',
            description: `Température de ${analysisData.temperature}°C au-dessus du maximum de ${thresholds.temperatureMax}°C`,
            timestamp: new Date().toISOString(),
            unitName: analysisData.unitName,
            suggestion: 'Augmentez l\'aération et réduisez l\'exposition au soleil.'
          });
        }
      }

      if (analysisData.ph !== undefined) {
        if (analysisData.ph < thresholds.phMin || analysisData.ph > thresholds.phMax) {
          newAlerts.push({
            id: `ph-${Date.now()}`,
            type: 'warning',
            category: 'water_quality',
            title: 'pH hors limites',
            description: `pH de ${analysisData.ph} hors de la plage optimale [${thresholds.phMin} - ${thresholds.phMax}]`,
            timestamp: new Date().toISOString(),
            unitName: analysisData.unitName,
            suggestion: 'Ajustez le pH avec des produits adaptés.'
          });
        }
      }

      if (analysisData.oxygen !== undefined && analysisData.oxygen < thresholds.oxygenMin) {
        newAlerts.push({
          id: `oxygen-${Date.now()}`,
          type: 'critical',
          category: 'water_quality',
          title: 'Oxygène bas',
          description: `Niveau d\'oxygène de ${analysisData.oxygen}mg/L inférieur au minimum de ${thresholds.oxygenMin}mg/L`,
          timestamp: new Date().toISOString(),
          unitName: analysisData.unitName,
          suggestion: 'Augmentez l\'aération immédiatement.'
        });
      }
    }

    // Analyse de l'efficacité alimentaire
    if (enabledCategories.feeding && analysisData.feedingEfficiency !== undefined) {
      if (analysisData.feedingEfficiency > thresholds.feedingEfficiencyMin) {
        newAlerts.push({
          id: `feeding-${Date.now()}`,
          type: 'info',
          category: 'feeding',
          title: 'Indice de conversion élevé',
          description: `Indice de conversion de ${analysisData.feedingEfficiency.toFixed(2)} supérieur à ${thresholds.feedingEfficiencyMin}`,
          timestamp: new Date().toISOString(),
          unitName: analysisData.unitName,
          suggestion: 'Optimisez la formulation de l\'aliment et les horaires de distribution.'
        });
      }
    }

    // Détection d'anomalies dans les tendances
    if (enabledCategories.anomaly && analysisData.trend) {
      const { values, expectedRange } = analysisData.trend;
      if (values && values.length > 2) {
        const lastValues = values.slice(-3);
        const trend = lastValues[2] - lastValues[0];
        
        if (Math.abs(trend) > expectedRange) {
          newAlerts.push({
            id: `anomaly-${Date.now()}`,
            type: 'warning',
            category: 'anomaly',
            title: 'Anomalie détectée',
            description: `Variation inhabituelle détectée dans les données récentes`,
            timestamp: new Date().toISOString(),
            unitName: analysisData.unitName,
            suggestion: 'Vérifiez les enregistrements et inspectez l\'unité.'
          });
        }
      }
    }

    setAlerts(prev => {
      // Éviter les doublons
      const existingIds = prev.map(a => a.id);
      const filtered = newAlerts.filter(a => !existingIds.includes(a.id));
      return [...prev, ...filtered].slice(-20); // Garder les 20 dernières alertes
    });

    // Notification toast et push pour les alertes critiques
    newAlerts.forEach(async (alert) => {
      if (alert.type === 'critical') {
        toast({
          title: '🚨 ' + alert.title,
          description: alert.description,
          variant: 'destructive'
        });
        
        // Send push notification to database (only once per alert)
        if (user?.id && !sentNotificationsRef.current.has(alert.id)) {
          sentNotificationsRef.current.add(alert.id);
          
          const categoryModules: Record<string, string> = {
            mortality: 'Santé',
            growth: 'Production',
            water_quality: 'Surveillance',
            feeding: 'Alimentation',
            production: 'Production',
            anomaly: 'Système'
          };
          
          await createNotification({
            userId: user.id,
            title: alert.title,
            message: alert.description + (alert.suggestion ? ` 💡 ${alert.suggestion}` : ''),
            type: 'error',
            module: categoryModules[alert.category] || 'Système',
            isCritical: true,
            metadata: {
              alertId: alert.id,
              category: alert.category,
              metrics: alert.metrics,
              unitName: alert.unitName
            }
          });
        }
      } else if (alert.type === 'warning' && user?.id && !sentNotificationsRef.current.has(alert.id)) {
        // Also send warnings to database
        sentNotificationsRef.current.add(alert.id);
        
        const categoryModules: Record<string, string> = {
          mortality: 'Santé',
          growth: 'Production',
          water_quality: 'Surveillance',
          feeding: 'Alimentation',
          production: 'Production',
          anomaly: 'Système'
        };
        
        await createNotification({
          userId: user.id,
          title: alert.title,
          message: alert.description + (alert.suggestion ? ` 💡 ${alert.suggestion}` : ''),
          type: 'warning',
          module: categoryModules[alert.category] || 'Système',
          isCritical: false,
          metadata: {
            alertId: alert.id,
            category: alert.category,
            metrics: alert.metrics,
            unitName: alert.unitName
          }
        });
      }
    });
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
    onDismiss?.(alertId);
  };

  const getAlertIcon = (category: string) => {
    switch (category) {
      case 'mortality': return Fish;
      case 'growth': return TrendingUp;
      case 'water_quality': return Droplets;
      case 'feeding': return Activity;
      case 'production': return Weight;
      case 'anomaly': return AlertTriangle;
      default: return Bell;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const criticalCount = activeAlerts.filter(a => a.type === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.type === 'warning').length;

  return (
    <>
      {/* Badge résumé des alertes */}
      {activeAlerts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {criticalCount} critique{criticalCount > 1 ? 's' : ''}
          </Badge>
          {warningCount > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 flex items-center gap-1">
              <Bell className="w-3 h-3" />
              {warningCount} avertissement{warningCount > 1 ? 's' : ''}
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSettings(true)}
            className="ml-auto"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configurer
          </Button>
        </div>
      )}

      {/* Liste des alertes actives */}
      <div className="space-y-3">
        {activeAlerts.slice(0, 5).map((alert) => {
          const Icon = getAlertIcon(alert.category);
          return (
            <Alert key={alert.id} className={getAlertColor(alert.type)}>
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <AlertTitle className="flex flex-wrap items-center gap-2 mb-1">
                    {alert.title}
                    {alert.unitName && (
                      <Badge variant="outline" className="text-xs">
                        {alert.unitName}
                      </Badge>
                    )}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {alert.description}
                    {alert.metrics && (
                      <div className="mt-2 text-xs font-medium">
                        Valeur actuelle: {alert.metrics.current.toFixed(1)}{alert.metrics.unit} 
                        {' / '}
                        Seuil: {alert.metrics.threshold}{alert.metrics.unit}
                      </div>
                    )}
                    {alert.suggestion && (
                      <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                        💡 {alert.suggestion}
                      </div>
                    )}
                  </AlertDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alert.id)}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Alert>
          );
        })}
      </div>

      {/* Modal de configuration */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Configuration des alertes</DialogTitle>
            <DialogDescription>
              Personnalisez les seuils et les catégories d'alertes
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="thresholds">
            <TabsList className="w-full">
              <TabsTrigger value="thresholds" className="flex-1">Seuils</TabsTrigger>
              <TabsTrigger value="categories" className="flex-1">Catégories</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="thresholds" className="space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  <div>
                    <Label>Taux de mortalité maximum (%)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.mortalityRate]}
                        onValueChange={([v]) => setThresholds({...thresholds, mortalityRate: v})}
                        max={10}
                        min={0.5}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.mortalityRate}%</span>
                    </div>
                  </div>

                  <div>
                    <Label>Taux de croissance minimum (g/jour)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.growthRateMin]}
                        onValueChange={([v]) => setThresholds({...thresholds, growthRateMin: v})}
                        max={5}
                        min={0.5}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.growthRateMin}g</span>
                    </div>
                  </div>

                  <div>
                    <Label>Température minimale (°C)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.temperatureMin]}
                        onValueChange={([v]) => setThresholds({...thresholds, temperatureMin: v})}
                        max={30}
                        min={10}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.temperatureMin}°C</span>
                    </div>
                  </div>

                  <div>
                    <Label>Température maximale (°C)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.temperatureMax]}
                        onValueChange={([v]) => setThresholds({...thresholds, temperatureMax: v})}
                        max={40}
                        min={25}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.temperatureMax}°C</span>
                    </div>
                  </div>

                  <div>
                    <Label>pH minimum</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.phMin]}
                        onValueChange={([v]) => setThresholds({...thresholds, phMin: v})}
                        max={8}
                        min={5}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.phMin}</span>
                    </div>
                  </div>

                  <div>
                    <Label>pH maximum</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.phMax]}
                        onValueChange={([v]) => setThresholds({...thresholds, phMax: v})}
                        max={10}
                        min={7}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.phMax}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Oxygène minimum (mg/L)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.oxygenMin]}
                        onValueChange={([v]) => setThresholds({...thresholds, oxygenMin: v})}
                        max={10}
                        min={3}
                        step={0.5}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.oxygenMin}</span>
                    </div>
                  </div>

                  <div>
                    <Label>Indice de conversion maximum</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[thresholds.feedingEfficiencyMin]}
                        onValueChange={([v]) => setThresholds({...thresholds, feedingEfficiencyMin: v})}
                        max={3}
                        min={1.2}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="w-12 text-sm font-medium">{thresholds.feedingEfficiencyMin}</span>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes de croissance</p>
                    <p className="text-sm text-muted-foreground">Taux de croissance anormal</p>
                  </div>
                  <Switch
                    checked={enabledCategories.growth}
                    onCheckedChange={(v) => setEnabledCategories({...enabledCategories, growth: v})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes de mortalité</p>
                    <p className="text-sm text-muted-foreground">Taux de mortalité élevé</p>
                  </div>
                  <Switch
                    checked={enabledCategories.mortality}
                    onCheckedChange={(v) => setEnabledCategories({...enabledCategories, mortality: v})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes de qualité d'eau</p>
                    <p className="text-sm text-muted-foreground">Paramètres hors limites</p>
                  </div>
                  <Switch
                    checked={enabledCategories.water_quality}
                    onCheckedChange={(v) => setEnabledCategories({...enabledCategories, water_quality: v})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes d'alimentation</p>
                    <p className="text-sm text-muted-foreground">Efficacité alimentaire</p>
                  </div>
                  <Switch
                    checked={enabledCategories.feeding}
                    onCheckedChange={(v) => setEnabledCategories({...enabledCategories, feeding: v})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Alertes de production</p>
                    <p className="text-sm text-muted-foreground">Objectifs et rendements</p>
                  </div>
                  <Switch
                    checked={enabledCategories.production}
                    onCheckedChange={(v) => setEnabledCategories({...enabledCategories, production: v})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Détection d'anomalies</p>
                    <p className="text-sm text-muted-foreground">Variations inhabituelles</p>
                  </div>
                  <Switch
                    checked={enabledCategories.anomaly}
                    onCheckedChange={(v) => setEnabledCategories({...enabledCategories, anomaly: v})}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const Icon = getAlertIcon(alert.category);
                    return (
                      <div key={alert.id} className={`p-3 rounded-lg border ${alert.acknowledged ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          <Icon className="w-4 h-4 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{alert.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleString('fr-FR')}
                            </p>
                          </div>
                          <Badge variant={alert.acknowledged ? 'outline' : 'default'}>
                            {alert.acknowledged ? 'Acquittée' : alert.type}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SmartAlerts;
