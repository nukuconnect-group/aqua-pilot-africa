import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ParameterGauge } from './ParameterGauge';
import { Activity, Thermometer, Droplets, Wind, FlaskConical, TestTube } from 'lucide-react';

interface ParametersDashboardProps {
  data: {
    temperature: number;
    oxygene_dissous: number;
    ph: number;
    ammonium: number;
    nitrite: number;
  };
  lastUpdate?: Date;
}

export const ParametersDashboard: React.FC<ParametersDashboardProps> = ({ data, lastUpdate }) => {
  const parameters = [
    { key: 'temperature', value: data.temperature, icon: Thermometer, label: 'Température' },
    { key: 'oxygen', value: data.oxygene_dissous, icon: Wind, label: 'Oxygène' },
    { key: 'ph', value: data.ph, icon: FlaskConical, label: 'pH' },
    { key: 'ammonia', value: data.ammonium, icon: Droplets, label: 'Ammoniaque' },
    { key: 'nitrite', value: data.nitrite, icon: TestTube, label: 'Nitrite' },
  ];

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            Paramètres en temps réel
          </CardTitle>
          {lastUpdate && (
            <Badge variant="outline" className="text-xs font-mono">
              {lastUpdate.toLocaleTimeString('fr-FR')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grille des valeurs principales */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {parameters.map(({ key, value, icon: Icon, label }) => (
            <div 
              key={key}
              className="relative p-3 rounded-xl bg-background border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-2 mb-1">
                <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {value.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {key === 'temperature' ? '°C' : key === 'ph' ? '' : 'mg/L'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Jauges détaillées */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Analyse détaillée
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <ParameterGauge paramKey="temperature" value={data.temperature} />
              <ParameterGauge paramKey="oxygen" value={data.oxygene_dissous} />
              <ParameterGauge paramKey="ph" value={data.ph} />
            </div>
            <div className="space-y-4">
              <ParameterGauge paramKey="ammonia" value={data.ammonium} />
              <ParameterGauge paramKey="nitrite" value={data.nitrite} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
