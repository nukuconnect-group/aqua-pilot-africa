
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Wifi, Settings, Plus, Trash2 } from 'lucide-react';
import { useIoT } from '@/contexts/IoTContext';

interface MqttConfig {
  brokerUrl: string;
  port: string;
  username: string;
  password: string;
  topics: string[];
  connected: boolean;
}

const MqttConfiguration = () => {
  const { connectToMqtt } = useIoT();
  const [config, setConfig] = useState<MqttConfig>({
    brokerUrl: 'mqtt://localhost',
    port: '1883',
    username: '',
    password: '',
    topics: [
      'sensors/basin/+/oxygen',
      'sensors/basin/+/temperature',
      'sensors/basin/+/ph',
      'sensors/basin/+/turbidity'
    ],
    connected: false
  });
  
  const [showConfig, setShowConfig] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  const handleConnect = () => {
    const fullBrokerUrl = `${config.brokerUrl}:${config.port}`;
    connectToMqtt(fullBrokerUrl, config.topics);
    setConfig(prev => ({ ...prev, connected: true }));
  };

  const handleDisconnect = () => {
    setConfig(prev => ({ ...prev, connected: false }));
  };

  const addTopic = () => {
    if (newTopic.trim()) {
      setConfig(prev => ({
        ...prev,
        topics: [...prev.topics, newTopic.trim()]
      }));
      setNewTopic('');
    }
  };

  const removeTopic = (index: number) => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== index)
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base sm:text-2xl">
          <div className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-blue-600" />
            <span>Connexion IoT</span>
          </div>
          <Badge className={config.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {config.connected ? 'Connecté' : 'Déconnecté'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Broker MQTT</p>
            <p className="break-all text-sm text-muted-foreground">{config.brokerUrl}:{config.port}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Dialog open={showConfig} onOpenChange={setShowConfig}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Config
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Configuration MQTT</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="broker">Broker URL</Label>
                      <Input
                        id="broker"
                        value={config.brokerUrl}
                        onChange={(e) => setConfig(prev => ({ ...prev, brokerUrl: e.target.value }))}
                        placeholder="mqtt://192.168.1.100"
                      />
                    </div>
                    <div>
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        value={config.port}
                        onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))}
                        placeholder="1883"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="username">Utilisateur</Label>
                      <Input
                        id="username"
                        value={config.username}
                        onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Mot de passe</Label>
                      <Input
                        id="password"
                        type="password"
                        value={config.password}
                        onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Topics MQTT</Label>
                    <div className="space-y-2 mt-2">
                      {config.topics.map((topic, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="min-w-0 break-all text-sm font-mono">{topic}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeTopic(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex space-x-2">
                        <Input
                          value={newTopic}
                          onChange={(e) => setNewTopic(e.target.value)}
                          placeholder="sensors/basin/001/oxygen"
                          className="text-sm"
                        />
                        <Button size="sm" onClick={addTopic}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button onClick={() => setShowConfig(false)} className="w-full">
                    Sauvegarder
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {config.connected ? (
              <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                Déconnecter
              </Button>
            ) : (
              <Button size="sm" onClick={handleConnect}>
                Connecter
              </Button>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Topics actifs:</strong> {config.topics.length}</p>
          <p><strong>ESP32/Pi connectés:</strong> {config.connected ? '2 appareils' : '0 appareil'}</p>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg text-sm">
          <p className="font-medium text-blue-800 mb-1">Guide de configuration rapide:</p>
          <ul className="text-blue-700 space-y-1 text-xs">
            <li>• Configurez votre ESP32/Raspberry Pi avec le même broker</li>
            <li>• Utilisez les topics: sensors/basin/[ID]/[paramètre]</li>
            <li>• Format JSON: {`{"value": 7.2, "unit": "mg/L", "timestamp": "..."}`}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MqttConfiguration;
