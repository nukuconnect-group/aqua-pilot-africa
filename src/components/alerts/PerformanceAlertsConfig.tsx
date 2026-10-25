import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings2, 
  Target, 
  Thermometer, 
  Droplets, 
  Activity, 
  Package, 
  Bell, 
  Save,
  RefreshCw,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { usePerformanceAlerts, AlertThresholds } from '@/hooks/usePerformanceAlerts';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';

interface ThresholdInputProps {
  label: string;
  warningValue: number;
  criticalValue: number;
  onWarningChange: (value: number) => void;
  onCriticalChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}

const ThresholdInput: React.FC<ThresholdInputProps> = ({
  label,
  warningValue,
  criticalValue,
  onWarningChange,
  onCriticalChange,
  unit = '',
  step = 0.1,
  min = 0,
  max = 100,
}) => (
  <div className="space-y-3">
    <Label className="text-sm font-medium">{label}</Label>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
          Alerte
        </Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={warningValue}
            onChange={(e) => onWarningChange(parseFloat(e.target.value) || 0)}
            step={step}
            min={min}
            max={max}
            className="h-9"
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          Critique
        </Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={criticalValue}
            onChange={(e) => onCriticalChange(parseFloat(e.target.value) || 0)}
            step={step}
            min={min}
            max={max}
            className="h-9"
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  </div>
);

const PerformanceAlertsConfig: React.FC = () => {
  const { t } = useSettings();
  const { thresholds, updateThresholds, checkThresholds, checking, criticalAlerts } = usePerformanceAlerts();
  const { toast } = useToast();
  const [localThresholds, setLocalThresholds] = useState<AlertThresholds>(thresholds);
  const [hasChanges, setHasChanges] = useState(false);

  React.useEffect(() => {
    setLocalThresholds(thresholds);
  }, [thresholds]);

  const handleChange = (key: keyof AlertThresholds, value: any) => {
    setLocalThresholds(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateThresholds(localThresholds);
    setHasChanges(false);
  };

  const handleCheckNow = async () => {
    await checkThresholds();
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            {t('alerts_config_title')}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t('alerts_config_desc')}
          </p>
        </div>
        <div className="mobile-action-grid grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {criticalAlerts.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {criticalAlerts.length} {t('critical_alerts_badge')}
            </Badge>
          )}
          <Button 
            variant="outline" 
            onClick={handleCheckNow}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('check_now')}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {t('save')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fcr" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="fcr" className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            <span>FCR</span>
          </TabsTrigger>
          <TabsTrigger value="water" className="flex items-center gap-1">
            <Droplets className="h-4 w-4" />
            <span>{t('water')}</span>
          </TabsTrigger>
          <TabsTrigger value="mortality" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            <span>{t('mortality_type')}</span>
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span>{t('production')}</span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-1">
            <Package className="h-4 w-4" />
            <span>{t('stock')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            <span>{t('notifications')}</span>
          </TabsTrigger>
        </TabsList>

        {/* FCR */}
        <TabsContent value="fcr">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Indice de Conversion Alimentaire (FCR)
                  </CardTitle>
                  <CardDescription>
                    Alertes basées sur le ratio alimentation/croissance
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="fcr-enabled">Activé</Label>
                  <Switch
                    id="fcr-enabled"
                    checked={localThresholds.fcr_enabled}
                    onCheckedChange={(checked) => handleChange('fcr_enabled', checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ThresholdInput
                label="Seuils FCR"
                warningValue={localThresholds.fcr_warning_threshold}
                criticalValue={localThresholds.fcr_critical_threshold}
                onWarningChange={(v) => handleChange('fcr_warning_threshold', v)}
                onCriticalChange={(v) => handleChange('fcr_critical_threshold', v)}
                step={0.1}
                min={1}
                max={5}
              />
              <p className="text-sm text-muted-foreground">
                Un FCR optimal se situe généralement entre 1.2 et 1.8. 
                Une valeur supérieure indique une efficacité alimentaire réduite.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Water Quality */}
        <TabsContent value="water">
          <div className="grid gap-4">
            {/* Temperature */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5 text-orange-500" />
                      Température
                    </CardTitle>
                    <CardDescription>Plage de température acceptable</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="temp-enabled">Activé</Label>
                    <Switch
                      id="temp-enabled"
                      checked={localThresholds.temp_enabled}
                      onCheckedChange={(checked) => handleChange('temp_enabled', checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>Température minimale</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Alerte</Label>
                        <Input
                          type="number"
                          value={localThresholds.temp_min_warning}
                          onChange={(e) => handleChange('temp_min_warning', parseFloat(e.target.value))}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Critique</Label>
                        <Input
                          type="number"
                          value={localThresholds.temp_min_critical}
                          onChange={(e) => handleChange('temp_min_critical', parseFloat(e.target.value))}
                          step={0.5}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Température maximale</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Alerte</Label>
                        <Input
                          type="number"
                          value={localThresholds.temp_max_warning}
                          onChange={(e) => handleChange('temp_max_warning', parseFloat(e.target.value))}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Critique</Label>
                        <Input
                          type="number"
                          value={localThresholds.temp_max_critical}
                          onChange={(e) => handleChange('temp_max_critical', parseFloat(e.target.value))}
                          step={0.5}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Oxygen */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Droplets className="h-5 w-5 text-blue-500" />
                      Oxygène Dissous
                    </CardTitle>
                    <CardDescription>Niveaux minimaux d'oxygène en mg/L</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="oxygen-enabled">Activé</Label>
                    <Switch
                      id="oxygen-enabled"
                      checked={localThresholds.oxygen_enabled}
                      onCheckedChange={(checked) => handleChange('oxygen_enabled', checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ThresholdInput
                  label="Seuils d'oxygène (mg/L)"
                  warningValue={localThresholds.oxygen_warning}
                  criticalValue={localThresholds.oxygen_critical}
                  onWarningChange={(v) => handleChange('oxygen_warning', v)}
                  onCriticalChange={(v) => handleChange('oxygen_critical', v)}
                  unit="mg/L"
                  step={0.5}
                  min={0}
                  max={15}
                />
              </CardContent>
            </Card>

            {/* pH */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-500" />
                      pH
                    </CardTitle>
                    <CardDescription>Plage de pH acceptable</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ph-enabled">Activé</Label>
                    <Switch
                      id="ph-enabled"
                      checked={localThresholds.ph_enabled}
                      onCheckedChange={(checked) => handleChange('ph_enabled', checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>pH minimum</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Alerte</Label>
                        <Input
                          type="number"
                          value={localThresholds.ph_min_warning}
                          onChange={(e) => handleChange('ph_min_warning', parseFloat(e.target.value))}
                          step={0.1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Critique</Label>
                        <Input
                          type="number"
                          value={localThresholds.ph_min_critical}
                          onChange={(e) => handleChange('ph_min_critical', parseFloat(e.target.value))}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>pH maximum</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Alerte</Label>
                        <Input
                          type="number"
                          value={localThresholds.ph_max_warning}
                          onChange={(e) => handleChange('ph_max_warning', parseFloat(e.target.value))}
                          step={0.1}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Critique</Label>
                        <Input
                          type="number"
                          value={localThresholds.ph_max_critical}
                          onChange={(e) => handleChange('ph_max_critical', parseFloat(e.target.value))}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mortality */}
        <TabsContent value="mortality">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-red-500" />
                    Taux de Mortalité
                  </CardTitle>
                  <CardDescription>
                    Seuils de mortalité journalière en pourcentage
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="mortality-enabled">Activé</Label>
                  <Switch
                    id="mortality-enabled"
                    checked={localThresholds.mortality_enabled}
                    onCheckedChange={(checked) => handleChange('mortality_enabled', checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ThresholdInput
                label="Mortalité journalière (%)"
                warningValue={localThresholds.mortality_daily_warning}
                criticalValue={localThresholds.mortality_daily_critical}
                onWarningChange={(v) => handleChange('mortality_daily_warning', v)}
                onCriticalChange={(v) => handleChange('mortality_daily_critical', v)}
                unit="%"
                step={0.1}
                min={0}
                max={10}
              />
              <p className="text-sm text-muted-foreground">
                Un taux de mortalité normal est généralement inférieur à 0.1% par jour.
                Une mortalité supérieure à 1% nécessite une intervention immédiate.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Production */}
        <TabsContent value="production">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Retard de Production
                  </CardTitle>
                  <CardDescription>
                    Seuils de retard par rapport aux objectifs de production
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="production-enabled">Activé</Label>
                  <Switch
                    id="production-enabled"
                    checked={localThresholds.production_enabled}
                    onCheckedChange={(checked) => handleChange('production_enabled', checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ThresholdInput
                label="Retard de production (%)"
                warningValue={localThresholds.production_behind_warning}
                criticalValue={localThresholds.production_behind_critical}
                onWarningChange={(v) => handleChange('production_behind_warning', v)}
                onCriticalChange={(v) => handleChange('production_behind_critical', v)}
                unit="%"
                step={5}
                min={0}
                max={100}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock */}
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-500" />
                    Niveaux de Stock
                  </CardTitle>
                  <CardDescription>
                    Alertes basées sur les jours de stock restants
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="stock-enabled">Activé</Label>
                  <Switch
                    id="stock-enabled"
                    checked={localThresholds.stock_enabled}
                    onCheckedChange={(checked) => handleChange('stock_enabled', checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Alerte (jours)
                  </Label>
                  <Input
                    type="number"
                    value={localThresholds.stock_days_warning}
                    onChange={(e) => handleChange('stock_days_warning', parseInt(e.target.value))}
                    min={1}
                    max={30}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Critique (jours)
                  </Label>
                  <Input
                    type="number"
                    value={localThresholds.stock_days_critical}
                    onChange={(e) => handleChange('stock_days_critical', parseInt(e.target.value))}
                    min={1}
                    max={30}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Préférences de Notification
              </CardTitle>
              <CardDescription>
                Choisissez comment recevoir les alertes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>Notifications par email</Label>
                  <p className="text-sm text-muted-foreground">
                    Recevez les alertes critiques par email
                  </p>
                </div>
                <Switch
                  checked={localThresholds.email_notifications}
                  onCheckedChange={(checked) => handleChange('email_notifications', checked)}
                />
              </div>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>Notifications push</Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications dans l'application et sur le bureau
                  </p>
                </div>
                <Switch
                  checked={localThresholds.push_notifications}
                  onCheckedChange={(checked) => handleChange('push_notifications', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceAlertsConfig;
