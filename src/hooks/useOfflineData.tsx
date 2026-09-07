// Hook pour gérer les données avec support offline automatique
import { useState, useEffect, useCallback } from 'react';
import { offlineStorage } from '@/lib/offlineStorage';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuthReady } from '@/hooks/useAuthReady';

interface UseOfflineDataOptions<T> {
  tableName: string;
  cacheKey: string;
  fetchQuery?: (query: any) => any;
  enabled?: boolean;
}

export function useOfflineData<T>({ 
  tableName, 
  cacheKey, 
  fetchQuery,
  enabled = true 
}: UseOfflineDataOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { isReady, isAuthenticated } = useAuthReady();

  // Surveiller le statut de connexion
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fonction pour charger depuis le cache
  const loadFromCache = useCallback(async (): Promise<T[] | null> => {
    try {
      const cachedData = await offlineStorage.getOfflineData(cacheKey);
      if (cachedData && Array.isArray(cachedData)) {
        return cachedData as T[];
      }
      return null;
    } catch (err) {
      console.error(`Erreur chargement cache ${cacheKey}:`, err);
      return null;
    }
  }, [cacheKey]);

  // Fonction pour sauvegarder dans le cache
  const saveToCache = useCallback(async (newData: T[]) => {
    try {
      await offlineStorage.saveOfflineData(cacheKey, newData);
    } catch (err) {
      console.error(`Erreur sauvegarde cache ${cacheKey}:`, err);
    }
  }, [cacheKey]);

  // Fonction principale de fetch
  const fetchData = useCallback(async () => {
    if (!enabled || !isReady) return;

    setLoading(true);
    setError(null);

    // Si hors ligne, charger depuis le cache
    if (isOffline || !isAuthenticated) {
      const cachedData = await loadFromCache();
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }
      setLoading(false);
      return;
    }

    // En ligne: charger depuis Supabase
    try {
      // @ts-ignore - table name is dynamic
      let query = supabase.from(tableName as any).select('*');
      
      if (fetchQuery) {
        query = fetchQuery(query);
      }

      const { data: fetchedData, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const resultData = fetchedData || [];
      setData(resultData as T[]);
      
      // Sauvegarder dans le cache
      await saveToCache(resultData as T[]);
    } catch (err: any) {
      console.error(`Erreur fetch ${tableName}:`, err);
      setError(err.message);
      
      // En cas d'erreur, essayer le cache
      const cachedData = await loadFromCache();
      if (cachedData) {
        setData(cachedData);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, isReady, isOffline, isAuthenticated, tableName, fetchQuery, loadFromCache, saveToCache]);

  // Charger les données au montage et quand la connexion change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Recharger quand on repasse en ligne
  useEffect(() => {
    if (!isOffline && isAuthenticated) {
      fetchData();
    }
  }, [isOffline, isAuthenticated, fetchData]);

  return {
    data,
    loading,
    error,
    isOffline,
    refetch: fetchData
  };
}

// Hook spécialisé pour les lots de poissons avec support offline
export function useOfflineLivestockBatches(unitId?: string) {
  return useOfflineData({
    tableName: 'livestock_batches',
    cacheKey: unitId ? `livestock_batches_${unitId}` : 'livestock_batches_all',
    fetchQuery: (query) => {
      if (unitId) {
        query = query.eq('unit_id', unitId);
      }
      return query.order('created_at', { ascending: false });
    }
  });
}

// Hook spécialisé pour les unités de production avec support offline
export function useOfflineProductionUnits() {
  return useOfflineData({
    tableName: 'production_units',
    cacheKey: 'production_units',
    fetchQuery: (query) => query.order('created_at', { ascending: false })
  });
}

// Hook spécialisé pour les infrastructures avec support offline
export function useOfflineInfrastructures(unitId?: string) {
  return useOfflineData({
    tableName: 'unit_infrastructures',
    cacheKey: unitId ? `infrastructures_${unitId}` : 'infrastructures_all',
    fetchQuery: (query) => {
      if (unitId) {
        query = query.eq('unit_id', unitId);
      }
      return query.order('created_at', { ascending: false });
    }
  });
}

// Hook spécialisé pour les cycles de production avec support offline
export function useOfflineProductionCycles(unitId?: string) {
  return useOfflineData({
    tableName: 'production_cycles',
    cacheKey: unitId ? `cycles_${unitId}` : 'cycles_all',
    fetchQuery: (query) => {
      if (unitId) {
        query = query.eq('unit_id', unitId);
      }
      return query.order('created_at', { ascending: false });
    }
  });
}

export default useOfflineData;
