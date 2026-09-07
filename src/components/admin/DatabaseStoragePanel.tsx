import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Database, RefreshCw, TrendingUp, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/appClient';

interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  tables: Array<{
    name: string;
    size: number;
    rows: number;
  }>;
}

const DatabaseStoragePanel: React.FC = () => {
  const [storage, setStorage] = useState<StorageInfo>({
    used: 0,
    total: 500, // 500 MB limite gratuite Supabase
    percentage: 0,
    tables: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadStorageInfo = async () => {
    setIsLoading(true);
    try {
      // Estimer la taille des données en fonction du nombre d'enregistrements
      const tables = [
        { name: 'profiles', avgRowSize: 0.5 },
        { name: 'production_cycles', avgRowSize: 0.8 },
        { name: 'feeding_records', avgRowSize: 0.6 },
        { name: 'health_records', avgRowSize: 0.7 },
        { name: 'livestock_batches', avgRowSize: 0.9 },
        { name: 'feed_stocks', avgRowSize: 0.5 },
        { name: 'ai_analyses', avgRowSize: 1.2 },
        { name: 'activity_logs', avgRowSize: 0.4 },
        { name: 'user_files', avgRowSize: 0.3 },
        { name: 'user_sessions', avgRowSize: 0.3 },
        { name: 'reproduction_records', avgRowSize: 0.8 },
        { name: 'cycle_infrastructures', avgRowSize: 0.5 },
        { name: 'feeding_plans', avgRowSize: 0.4 },
        { name: 'alert_history', avgRowSize: 0.5 },
        { name: 'user_roles', avgRowSize: 0.1 }
      ];

      const results = await Promise.all(
        tables.map(async (table) => {
          try {
            const { count } = await supabase
              .from(table.name as any)
              .select('*', { count: 'exact', head: true });
            
            return {
              name: table.name,
              rows: count || 0,
              size: ((count || 0) * table.avgRowSize) / 1024 // Taille estimée en MB
            };
          } catch {
            return { name: table.name, rows: 0, size: 0 };
          }
        })
      );

      const totalUsed = results.reduce((acc, t) => acc + t.size, 0);
      const totalLimit = 500; // 500 MB limite gratuite

      setStorage({
        used: totalUsed,
        total: totalLimit,
        percentage: (totalUsed / totalLimit) * 100,
        tables: results.sort((a, b) => b.size - a.size)
      });

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading storage info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const formatSize = (mb: number) => {
    if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-500';
    if (percentage < 75) return 'text-yellow-500';
    if (percentage < 90) return 'text-orange-500';
    return 'text-red-500';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 75) return 'bg-yellow-500';
    if (percentage < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Capacité de stockage
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadStorageInfo} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour: {lastRefresh.toLocaleTimeString('fr-FR')}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Jauge principale */}
        <div className="p-4 bg-gradient-to-br from-muted/30 to-muted/50 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <span className="font-medium">Base de données Supabase</span>
            </div>
            {storage.percentage > 80 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Espace limité
              </Badge>
            )}
          </div>
          
          <div className="relative pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{formatSize(storage.used)}</span>
              <span className="text-sm text-muted-foreground">/ {formatSize(storage.total)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(storage.percentage)}`}
                style={{ width: `${Math.min(storage.percentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className={getStatusColor(storage.percentage)}>
                {storage.percentage.toFixed(1)}% utilisé
              </span>
              <span className="text-muted-foreground">
                {formatSize(storage.total - storage.used)} disponible
              </span>
            </div>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <Database className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{storage.tables.length}</p>
            <p className="text-xs text-muted-foreground">Tables</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">
              {storage.tables.reduce((acc, t) => acc + t.rows, 0).toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-muted-foreground">Enregistrements</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <HardDrive className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-bold">{formatSize(storage.total - storage.used)}</p>
            <p className="text-xs text-muted-foreground">Restant</p>
          </div>
        </div>

        {/* Top tables par taille */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Tables par utilisation
          </h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : (
              storage.tables.slice(0, 8).map((table) => (
                <div key={table.name} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {table.name.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {table.rows.toLocaleString('fr-FR')} lignes
                    </Badge>
                    <span className="text-muted-foreground min-w-[60px] text-right">
                      {formatSize(table.size)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Avertissement si proche de la limite */}
        {storage.percentage > 75 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  Espace de stockage limité
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vous approchez de la limite du plan gratuit. Pensez à nettoyer les anciennes données ou à passer à un plan supérieur.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseStoragePanel;
