import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionState {
  network: ConnectionStatus;
  database: ConnectionStatus;
  lastSync?: Date;
}

interface ConnectionStatusIndicatorProps {
  showTextOnMobile?: boolean;
  detailed?: boolean;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({ showTextOnMobile = false, detailed = false }) => {
  const { t } = useSettings();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    network: 'connected',
    database: 'connecting'
  });

  // Surveiller le statut réseau
  useEffect(() => {
    const updateNetworkStatus = () => {
      setConnectionState(prev => ({
        ...prev,
        network: navigator.onLine ? 'connected' : 'disconnected'
      }));
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  // Surveiller le statut de connexion Supabase
  useEffect(() => {
    let isSubscribed = true;

    // Fonction pour vérifier la connexion à Supabase
    const checkDatabaseConnection = async () => {
      try {
        setConnectionState(prev => ({ ...prev, database: 'connecting' }));
        
        // Faire une requête simple pour tester la connexion
        const { error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);

        if (!isSubscribed) return;

        if (error) {
          setConnectionState(prev => ({ 
            ...prev, 
            database: 'error',
            lastSync: new Date()
          }));
        } else {
          setConnectionState(prev => ({ 
            ...prev, 
            database: 'connected',
            lastSync: new Date()
          }));
        }
      } catch (error) {
        if (!isSubscribed) return;
        setConnectionState(prev => ({ 
          ...prev, 
          database: 'error',
          lastSync: new Date()
        }));
      }
    };

    // Vérifier la connexion toutes les 30 secondes
    checkDatabaseConnection();
    const interval = setInterval(checkDatabaseConnection, 30000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    if (connectionState.network === 'disconnected') return 'text-red-500';
    if (connectionState.database === 'error') return 'text-yellow-500';
    if (connectionState.database === 'connecting') return 'text-blue-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (connectionState.network === 'disconnected') {
      return <WifiOff className="w-4 h-4" />;
    }
    if (connectionState.database === 'error') {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (connectionState.database === 'connecting') {
      return <Database className="w-4 h-4 animate-pulse" />;
    }
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (connectionState.network === 'disconnected') return t('offline');
    if (connectionState.database === 'error') return t('database_error');
    if (connectionState.database === 'connecting') return t('loading');
    return t('online');
  };

  const getTooltipContent = () => {
    const networkStatus = connectionState.network === 'connected' 
      ? t('network_connected')
      : t('network_disconnected');

    const databaseStatus = connectionState.database === 'connected'
      ? t('database_connected')
      : connectionState.database === 'error'
      ? t('database_error')
      : t('database_connecting');

    const lastSyncText = connectionState.lastSync
      ? `${t('last_sync')}: ${connectionState.lastSync.toLocaleTimeString()}`
      : '';

    return (
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <Wifi className={cn(
            "w-3 h-3",
            connectionState.network === 'connected' ? 'text-green-500' : 'text-red-500'
          )} />
          <span>{networkStatus}</span>
        </div>
        <div className="flex items-center gap-2">
          <Database className={cn(
            "w-3 h-3",
            connectionState.database === 'connected' ? 'text-green-500' : 
            connectionState.database === 'error' ? 'text-yellow-500' : 'text-blue-500'
          )} />
          <span>{databaseStatus}</span>
        </div>
        {lastSyncText && (
          <div className="text-muted-foreground pt-1 border-t border-border">
            {lastSyncText}
          </div>
        )}
      </div>
    );
  };

  return (
    detailed ? (
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("transition-colors", getStatusColor())}>
            {getStatusIcon()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{getStatusText()}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {connectionState.network === 'disconnected'
                ? t('network_disconnected')
                : connectionState.database === 'connected'
                ? `${t('last_sync')}: ${connectionState.lastSync ? connectionState.lastSync.toLocaleTimeString() : '—'}`
                : connectionState.database === 'connecting'
                ? t('database_connecting')
                : t('database_error')}
            </p>
          </div>
        </div>
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0",
          connectionState.network === 'disconnected'
            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
            : connectionState.database === 'connected'
            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
            : connectionState.database === 'error'
            ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
        )}>
          {connectionState.network === 'connected' && connectionState.database === 'connected' ? '● Sync' : '○'}
        </span>
      </div>
    ) : (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors cursor-pointer">
            <div className={cn("transition-colors", getStatusColor())}>
              {getStatusIcon()}
            </div>
            <span className={`text-xs text-primary-foreground ${showTextOnMobile ? '' : 'hidden'} sm:inline`}>
              {getStatusText()}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-popover text-popover-foreground">
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    )
  );
};
