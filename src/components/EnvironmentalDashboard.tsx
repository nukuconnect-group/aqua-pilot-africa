
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Droplets, 
  Thermometer, 
  Activity, 
  AlertTriangle, 
  Settings,
  TrendingUp,
  Waves,
  Bell,
  CheckCircle,
  Eye
} from 'lucide-react';
import { useIoT, SensorReading } from '@/contexts/IoTContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts';

const EnvironmentalDashboard = () => {
  const { 
    activeUnit, 
    units,
    setActiveUnit 
  } = useProductionUnits();
  
  const { 
    getUnitBasins, 
    realTimeData, 
    getBasinReadings, 
    updateThreshold,
    getActiveAlerts,
    connectToMqtt 
  } = useIoT();
  
  const [selectedBasin, setSelectedBasin] = useState<string>('');
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [showMqttDialog, setShowMqttDialog] = useState(false);
  const [thresholdValues, setThresholdValues] = useState({ min: '', max: '' });
  const [mqttConfig, setMqttConfig] = useState({ broker: '', topics: '' });

  const unitBasins = activeUnit ? getUnitBasins(activeUnit.id) : [];
  const activeAlerts = getActiveAlerts().filter(alert => 
    unitBasins.some(basin => basin.id === alert.basinId)
  );

  const getSensorIcon = (sensorType: string) => {
    switch (sensorType) {
      case 'oxygen': return <Droplets className="w-4 h-4" />;
      case 'temperature': return <Thermometer className="w-4 h-4" />;
      case 'ph': return <Activity className="w-4 h-4" />;
      case 'turbidity': return <Waves className="w-4 h-4" />;
      case 'mortality': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSensorLabel = (sensorType: string) => {
    switch (sensorType) {
      case 'oxygen': return 'Oxygène dissous';
      case 'temperature': return 'Température';
      case 'ph': return 'pH de l\'eau';
      case 'turbidity': return 'Turbidité';
      case 'mortality': return 'Mortalité';
      default: return sensorType;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const formatChartData = (readings: SensorReading[]) => {
    return readings
      .slice(0, 20)
      .reverse()
      .map((reading, index) => ({
        time: new Date(reading.timestamp).toLocaleTimeString(),
        value: reading.value,
        status: reading.status
      }));
  };

  const handleMqttConnect = () => {
    const topics = mqttConfig.topics.split(',').map(t => t.trim());
    connectToMqtt(mqttConfig.broker, topics);
    setShowMqttDialog(false);
  };

  if (!activeUnit) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 rounded-xl text-white">
          <h2 className="text-2xl font-bold mb-2">Surveillance Environnementale</h2>
          <p className="text-emerald-100">Monitoring en temps réel des paramètres de vos bassins</p>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Sélectionnez une unité de production
            </h3>
            <p className="text-gray-500 mb-6">
              Choisissez une unité pour voir ses données environnementales
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {units.map(unit => (
                <Button
                  key={unit.id}
                  onClick={() => setActiveUnit(unit)}
                  variant="outline"
                  className="text-sm"
                >
                  {unit.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 rounded-xl text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Surveillance Environnementale</h2>
            <p className="text-emerald-100">Unité: {activeUnit.name}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showMqttDialog} onOpenChange={setShowMqttDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-200">
                  <Settings className="w-4 h-4 mr-2" />
                  Configuration MQTT
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configuration MQTT</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>URL du Broker MQTT</Label>
                    <Input
                      placeholder="ws://localhost:9001"
                      value={mqttConfig.broker}
                      onChange={(e) => setMqttConfig(prev => ({ ...prev, broker: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Topics (séparés par des virgules)</Label>
                    <Input
                      placeholder="sensors/oxygen, sensors/ph, sensors/temp"
                      value={mqttConfig.topics}
                      onChange={(e) => setMqttConfig(prev => ({ ...prev, topics: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleMqttConnect} className="w-full">
                    Connecter
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Alertes environnementales */}
      {activeAlerts.length > 0 ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alertes Environnementales ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeAlerts.slice(0, 5).map(alert => {
                const basin = unitBasins.find(b => b.id === alert.basinId);
                return (
                  <Alert key={alert.id} className={`border-red-200 ${alert.status === 'critical' ? 'bg-red-100' : 'bg-yellow-100'}`}>
                    {getSensorIcon(alert.sensorType)}
                    <AlertDescription className="ml-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-red-800">
                            {basin?.name} - {getSensorLabel(alert.sensorType)}
                          </div>
                          <div className="text-sm text-red-700">
                            Valeur: {alert.value}{alert.unit}
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant={alert.status === 'critical' ? 'destructive' : 'default'} className="text-xs">
                          {alert.status === 'critical' ? 'Critique' : 'Attention'}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-green-700">Tous les paramètres sont dans les normes</p>
          </CardContent>
        </Card>
      )}

      {/* Monitoring par bassin */}
      <Tabs defaultValue={unitBasins[0]?.id || ''} className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-auto gap-1" style={{ gridTemplateColumns: `repeat(${unitBasins.length}, 1fr)` }}>
            {unitBasins.map(basin => (
              <TabsTrigger key={basin.id} value={basin.id} className="text-xs">
                {basin.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <Dialog open={showThresholdDialog} onOpenChange={setShowThresholdDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Seuils d'alerte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurer les Seuils d'Alerte</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valeur Min</Label>
                    <Input
                      type="number"
                      value={thresholdValues.min}
                      onChange={(e) => setThresholdValues(prev => ({ ...prev, min: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Valeur Max</Label>
                    <Input
                      type="number"
                      value={thresholdValues.max}
                      onChange={(e) => setThresholdValues(prev => ({ ...prev, max: e.target.value }))}
                    />
                  </div>
                </div>
                <Button className="w-full">Sauvegarder</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {unitBasins.map(basin => (
          <TabsContent key={basin.id} value={basin.id} className="space-y-4">
            {/* Valeurs actuelles */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {basin.sensors.map(sensorType => {
                const latestReading = realTimeData[basin.id]?.find(r => r.sensorType === sensorType);
                return (
                  <Card key={sensorType} className={latestReading ? getStatusColor(latestReading.status) : 'border-gray-200'}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 mb-2">
                        {getSensorIcon(sensorType)}
                        <span className="text-xs font-medium">
                          {getSensorLabel(sensorType)}
                        </span>
                      </div>
                      <div className="text-lg font-bold">
                        {latestReading ? `${latestReading.value}${latestReading.unit}` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {latestReading ? new Date(latestReading.timestamp).toLocaleTimeString() : 'Pas de données'}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Graphiques historiques */}
            <div className="grid gap-4">
              {basin.sensors.map(sensorType => {
                const readings = realTimeData[basin.id]?.filter(r => r.sensorType === sensorType) || [];
                const chartData = formatChartData(readings);
                
                return (
                  <Card key={`chart-${sensorType}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getSensorIcon(sensorType)}
                        Historique - {getSensorLabel(sensorType)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#10b981" 
                            fill="#10b981" 
                            fillOpacity={0.2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default EnvironmentalDashboard;
