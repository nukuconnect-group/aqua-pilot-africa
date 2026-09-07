import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { offlineStorage } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActionsCount: number;
  lastSyncTime: Date | null;
  cachedDataInfo: CachedDataInfo;
  syncData: () => Promise<void>;
  preloadData: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCachedData: (key: string) => Promise<any>;
  setCachedData: (key: string, data: any) => Promise<void>;
}

interface CachedDataInfo {
  totalSize: number;
  tables: { [key: string]: { count: number; lastUpdate: Date | null } };
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

/** Valeurs neutres utilisées si React n'est pas correctement résolu (double instance, chunk obsolète) */
const FALLBACK_CONTEXT: OfflineContextType = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingActionsCount: 0,
  lastSyncTime: null,
  cachedDataInfo: { totalSize: 0, tables: {} },
  syncData: async () => {},
  preloadData: async () => {},
  clearCache: async () => {},
  getCachedData: async () => null,
  setCachedData: async () => {},
};

/** Vérifie que les hooks React sont réellement disponibles avant de les appeler */
const areHooksAvailable = () => {
  try {
    return typeof useState === 'function' && typeof useEffect === 'function' && typeof useContext === 'function';
  } catch {
    return false;
  }
};

export const useOfflineContext = () => {
  if (!areHooksAvailable()) return FALLBACK_CONTEXT;
  const context = useContext(OfflineContext);
  if (!context) {
    console.warn('useOfflineContext utilisé hors OfflineProvider : valeurs par défaut appliquées');
    return FALLBACK_CONTEXT;
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

const OfflineProviderInner: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cachedDataInfo, setCachedDataInfo] = useState<CachedDataInfo>({
    totalSize: 0,
    tables: {}
  });
  const { toast } = useToast();

  // Tables importantes à mettre en cache
  const CACHE_TABLES = [
    'profiles',
    'activity_logs',
  ];

  // Mettre à jour le statut de connexion
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (online) {
        // Synchroniser automatiquement quand la connexion revient
        syncData();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Mettre à jour le nombre d'actions en attente
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const actions = await offlineStorage.getPendingActions();
        setPendingActionsCount(actions.length);
      } catch (error) {
        console.error('Erreur lors du comptage des actions:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 10000);

    return () => clearInterval(interval);
  }, []);

  // Mettre à jour les infos sur le cache
  useEffect(() => {
    updateCacheInfo();
  }, []);

  const updateCacheInfo = async () => {
    try {
      const info: CachedDataInfo = {
        totalSize: 0,
        tables: {}
      };

      for (const table of CACHE_TABLES) {
        const data = await offlineStorage.getOfflineData(`${table}_cache`);
        if (data) {
          info.tables[table] = {
            count: Array.isArray(data) ? data.length : 1,
            lastUpdate: new Date()
          };
          info.totalSize += JSON.stringify(data).length;
        }
      }

      // Ajouter les données des contextes locaux
      const localTables = ['production_units', 'infrastructures', 'feeding_records'];
      for (const table of localTables) {
        const data = await offlineStorage.getOfflineData(table);
        if (data) {
          info.tables[table] = {
            count: Array.isArray(data) ? data.length : 1,
            lastUpdate: new Date()
          };
          info.totalSize += JSON.stringify(data).length;
        }
      }

      setCachedDataInfo(info);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des infos de cache:', error);
    }
  };

  // Synchroniser les données
  const syncData = async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      // Synchroniser les actions en attente
      await offlineStorage.syncPendingActions();
      
      // Recharger les données depuis le serveur
      await preloadData();
      
      setLastSyncTime(new Date());
      setPendingActionsCount(0);
      
      toast({
        title: "✅ Synchronisation terminée",
        description: "Toutes vos données sont à jour",
      });
    } catch (error) {
      console.error('Erreur de synchronisation:', error);
      toast({
        title: "⚠️ Erreur de synchronisation",
        description: "Certaines données n'ont pas pu être synchronisées",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
      await updateCacheInfo();
    }
  };

  // Précharger les données importantes
  const preloadData = async () => {
    if (!isOnline) {
      console.log('Mode hors-ligne : utilisation des données en cache');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('Non authentifié : pas de préchargement');
        return;
      }

      // Charger les données des tables Supabase
      for (const table of CACHE_TABLES) {
        try {
          const { data, error } = await (supabase as any)
            .from(table)
            .select('*')
            .limit(1000); // Limiter pour éviter de surcharger

          if (!error && data) {
            await offlineStorage.saveOfflineData(`${table}_cache`, data);
            console.log(`✅ ${table}: ${data.length} enregistrements en cache`);
          }
        } catch (error) {
          console.warn(`⚠️ Impossible de charger ${table}:`, error);
        }
      }

      // Charger les données des contextes locaux depuis localStorage
      const localStorageKeys = ['production_units', 'infrastructures', 'feeding_records', 'treatments'];
      for (const key of localStorageKeys) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            await offlineStorage.saveOfflineData(key, JSON.parse(data));
          }
        } catch (error) {
          console.warn(`⚠️ Impossible de charger ${key}:`, error);
        }
      }

      await updateCacheInfo();
      console.log('✅ Préchargement des données terminé');
    } catch (error) {
      console.error('❌ Erreur lors du préchargement:', error);
    }
  };

  // Vider le cache
  const clearCache = async () => {
    try {
      // Vider toutes les données en cache
      for (const table of [...CACHE_TABLES, 'production_units', 'infrastructures', 'feeding_records', 'treatments']) {
        try {
          await offlineStorage.saveOfflineData(`${table}_cache`, null);
          await offlineStorage.saveOfflineData(table, null);
        } catch (error) {
          console.warn(`Erreur lors du nettoyage de ${table}:`, error);
        }
      }

      await updateCacheInfo();
      
      toast({
        title: "🗑️ Cache vidé",
        description: "Toutes les données hors-ligne ont été supprimées",
      });
    } catch (error) {
      console.error('Erreur lors du nettoyage du cache:', error);
      toast({
        title: "Erreur",
        description: "Impossible de vider le cache",
        variant: "destructive",
      });
    }
  };

  // Récupérer des données du cache
  const getCachedData = async (key: string) => {
    return await offlineStorage.getOfflineData(key);
  };

  // Sauvegarder des données dans le cache
  const setCachedData = async (key: string, data: any) => {
    await offlineStorage.saveOfflineData(key, data);
    await updateCacheInfo();
  };

  // Précharger les données au démarrage si en ligne
  useEffect(() => {
    if (isOnline) {
      preloadData();
    }
  }, []);

  const value: OfflineContextType = {
    isOnline,
    isSyncing,
    pendingActionsCount,
    lastSyncTime,
    cachedDataInfo,
    syncData,
    preloadData,
    clearCache,
    getCachedData,
    setCachedData,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

/**
 * Provider résilient : si les hooks React ne sont pas résolus correctement
 * (double instance de React, cache de dépendances obsolète), on rend les enfants
 * avec un contexte neutre au lieu de planter sur `useState` de null.
 */
export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  if (!areHooksAvailable()) {
    console.error('[OfflineProvider] Hooks React indisponibles — mode dégradé activé');
    return <OfflineContext.Provider value={FALLBACK_CONTEXT}>{children}</OfflineContext.Provider>;
  }
  return <OfflineProviderInner>{children}</OfflineProviderInner>;
};
