import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Database, Fish, Utensils, Activity, FileText, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/appClient';

interface TableStats {
  name: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

const DatabaseStatsPanel: React.FC = () => {
  const [stats, setStats] = useState<TableStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Charger les statistiques de chaque table en parallèle
      const [
        profilesResult,
        cyclesResult,
        feedingRecordsResult,
        healthRecordsResult,
        livestockResult,
        feedStocksResult,
        analysesResult,
        logsResult,
        filesResult,
        sessionsResult
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('production_cycles').select('id', { count: 'exact', head: true }),
        supabase.from('feeding_records').select('id', { count: 'exact', head: true }),
        supabase.from('health_records').select('id', { count: 'exact', head: true }),
        supabase.from('livestock_batches').select('id', { count: 'exact', head: true }),
        supabase.from('feed_stocks').select('id', { count: 'exact', head: true }),
        supabase.from('ai_analyses').select('id', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('id', { count: 'exact', head: true }),
        supabase.from('user_files').select('id', { count: 'exact', head: true }),
        supabase.from('user_sessions').select('id', { count: 'exact', head: true })
      ]);

      setStats([
        { 
          name: 'Utilisateurs', 
          count: profilesResult.count || 0, 
          icon: <Users className="w-4 h-4" />,
          color: 'text-blue-500'
        },
        { 
          name: 'Cycles de production', 
          count: cyclesResult.count || 0, 
          icon: <Activity className="w-4 h-4" />,
          color: 'text-green-500'
        },
        { 
          name: 'Lots de cheptel', 
          count: livestockResult.count || 0, 
          icon: <Fish className="w-4 h-4" />,
          color: 'text-cyan-500'
        },
        { 
          name: 'Enregistrements alimentation', 
          count: feedingRecordsResult.count || 0, 
          icon: <Utensils className="w-4 h-4" />,
          color: 'text-orange-500'
        },
        { 
          name: 'Stocks aliments', 
          count: feedStocksResult.count || 0, 
          icon: <Database className="w-4 h-4" />,
          color: 'text-yellow-500'
        },
        { 
          name: 'Enregistrements santé', 
          count: healthRecordsResult.count || 0, 
          icon: <Activity className="w-4 h-4" />,
          color: 'text-red-500'
        },
        { 
          name: 'Analyses IA', 
          count: analysesResult.count || 0, 
          icon: <Database className="w-4 h-4" />,
          color: 'text-purple-500'
        },
        { 
          name: 'Logs d\'activité', 
          count: logsResult.count || 0, 
          icon: <FileText className="w-4 h-4" />,
          color: 'text-gray-500'
        },
        { 
          name: 'Fichiers utilisateur', 
          count: filesResult.count || 0, 
          icon: <FileText className="w-4 h-4" />,
          color: 'text-indigo-500'
        },
        { 
          name: 'Sessions', 
          count: sessionsResult.count || 0, 
          icon: <Users className="w-4 h-4" />,
          color: 'text-teal-500'
        }
      ]);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading database stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totalRecords = stats.reduce((acc, stat) => acc + stat.count, 0);
  const maxCount = Math.max(...stats.map(s => s.count), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Statistiques de la base de données
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadStats} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour: {lastRefresh.toLocaleTimeString('fr-FR')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total des enregistrements</span>
            <Badge variant="secondary" className="text-lg font-bold">
              {totalRecords.toLocaleString('fr-FR')}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            stats.map((stat) => (
              <div key={stat.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={stat.color}>{stat.icon}</span>
                    <span>{stat.name}</span>
                  </div>
                  <span className="font-medium">{stat.count.toLocaleString('fr-FR')}</span>
                </div>
                <Progress 
                  value={(stat.count / maxCount) * 100} 
                  className="h-2"
                />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DatabaseStatsPanel;
