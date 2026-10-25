import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wifi, 
  Activity, 
  Shield, 
  AlertTriangle,
  Settings,
  Thermometer,
  Droplets,
  Waves,
  Brain
} from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useIoT } from '@/contexts/IoTContext';
import { useSettings } from '@/contexts/SettingsContext';
import EnvironmentalDashboard from './EnvironmentalDashboard';
import MqttConfiguration from './MqttConfiguration';
import IoTAIAnalysis from './iot/IoTAIAnalysis';
import IoTBasinOverview from './iot/IoTBasinOverview';
import ColdStorageOverview from './iot/ColdStorageOverview';

const IoTControlCenter = () => {
  const { activeUnit, units } = useProductionUnits();
  const { getActiveAlerts } = useIoT();
  const { t } = useSettings();

  const [automationRules, setAutomationRules] = useState([
    { id: 1, name: t('low_oxygen') || 'Alerte Oxygène Critique', active: true, conditions: 'O2 < 5mg/L' },
    { id: 2, name: 'pH Auto', active: true, conditions: 'pH < 6.5 / pH > 8.0' },
    { id: 3, name: t('temperature_warning') || 'Notification Température', active: false, conditions: 'Temp > 28°C' }
  ]);

  const alerts = getActiveAlerts();
  const commercial = activeUnit?.type === 'commercialisation';

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-primary p-responsive rounded-lg text-primary-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-responsive">
          <div className="flex-1">
            <h2 className="text-responsive-title font-bold mb-2">{t('iot_title')}</h2>
            <p className="text-primary-foreground/80 text-responsive">{commercial ? activeUnit.name : t('iot_subtitle')}</p>
          </div>
          {!commercial && <div className="flex items-center gap-2 sm:gap-4 justify-end sm:justify-center">
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold">{alerts.length}</div>
              <div className="text-xs text-primary-foreground/80">{t('active_alerts')}</div>
            </div>
          </div>}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 gap-1">
              {commercial ? <Thermometer className="w-4 h-4" /> : <Waves className="w-4 h-4" />}
              {commercial ? 'Températures des infrastructures' : t('basins_parameters')}
            </TabsTrigger>
            <TabsTrigger value="ai-analysis" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 gap-1">
              <Brain className="w-4 h-4" />
              {commercial ? 'Analyse thermique' : t('ai_analysis')}
            </TabsTrigger>
            {!commercial && <TabsTrigger value="environmental" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 gap-1">
              <Thermometer className="w-4 h-4" />
              {t('environmental')}
            </TabsTrigger>}
            {!commercial && <TabsTrigger value="automation" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 gap-1">
              <Settings className="w-4 h-4" />
              {t('automation')}
            </TabsTrigger>}
            <TabsTrigger value="config" className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0 gap-1">
              <Wifi className="w-4 h-4" />
              {t('configuration')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {commercial ? <ColdStorageOverview /> : <IoTBasinOverview />}
        </TabsContent>

        <TabsContent value="ai-analysis">
          {commercial ? <ColdStorageOverview analysisOnly /> : <IoTAIAnalysis />}
        </TabsContent>

        {!commercial && <TabsContent value="environmental">
          <EnvironmentalDashboard />
        </TabsContent>}


        {!commercial && <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-orange-600" />
                {t('automation_rules')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {automationRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{rule.name}</h4>
                      <p className="text-sm text-gray-600">{rule.conditions}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={rule.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {rule.active ? t('active_status') : t('inactive_status')}
                      </Badge>
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>}

        <TabsContent value="config">
          <MqttConfiguration />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IoTControlCenter;
