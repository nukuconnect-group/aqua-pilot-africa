import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';
import { offlineStorage } from '@/lib/offlineStorage';
import { notificationHelpers } from '@/lib/notificationService';
import { useAuth } from '@/contexts/AuthContext';
import { getDemoData } from '@/lib/demoData';
import { emitDataMutation, recordHookState, requestDataRefresh } from '@/lib/appRecovery';

export interface LivestockBatch {
  id: string;
  user_id: string;
  species: string;
  variety: string | null;
  type: string | null;
  quantity: number;
  average_weight: number;
  total_weight: number;
  acquisition_date: string | null;
  source: string | null;
  unit_id: string;
  unit_name: string;
  status: string;
  notes: string | null;
  expected_harvest_date: string | null;
  current_age: number;
  feeding_plan: string | null;
  last_health_check: string | null;
  expected_survival_rate: number;
  created_at: string;
  updated_at: string;
  // Champ pour tracking infrastructure rattachée
  attached_infrastructure_id?: string | null;
  // Champs pour géniteurs (mâles/femelles)
  male_count: number;
  female_count: number;
  male_weight?: number;
  female_weight?: number;
}

export const useLivestockBatches = (unitId?: string) => {
  const [batches, setBatches] = useState<LivestockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { toast } = useToast();
  const { isReady, isAuthenticated, getUserId } = useAuthReady();
  const { isDemoMode } = useAuth();

  const cacheKey = unitId ? `livestock_batches_${unitId}` : 'livestock_batches_all';

  // Surveiller le statut connexion
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

  const fetchBatches = useCallback(async () => {
    if (!isReady) return;

    // Mode démonstration : charger les données fictives
    if (isDemoMode) {
      const demoData = getDemoData();
      const demoBatches = demoData.livestockBatches || [];
      setBatches(unitId ? demoBatches.filter((b: any) => b.unit_id === unitId) : demoBatches);
      setLoading(false);
      return;
    }

    // Si hors ligne, charger depuis le cache
    if (isOffline || !isAuthenticated) {
      try {
        const cachedData = await offlineStorage.getOfflineData(cacheKey);
        if (cachedData && Array.isArray(cachedData)) {
          setBatches(cachedData);
        }
      } catch (err) {
        console.error('Erreur chargement cache lots:', err);
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('livestock_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        throw fetchError;
      }
      
      const resultData = data || [];
      setBatches(resultData);
      
      // Sauvegarder dans le cache
      await offlineStorage.saveOfflineData(cacheKey, resultData);
    } catch (err: any) {
      console.error('Error fetching livestock batches:', err);
      // En cas d'erreur, essayer le cache
      const cachedData = await offlineStorage.getOfflineData(cacheKey);
      if (cachedData && Array.isArray(cachedData)) {
        setBatches(cachedData);
      } else {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les lots de poissons',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, isOffline, unitId, toast, cacheKey, isDemoMode]);

  useEffect(() => {
    recordHookState('useLivestockBatches', { unitId: unitId ?? null, batches: batches.length, loading, isOffline });
  }, [unitId, batches.length, loading, isOffline]);

  const createBatch = async (batch: Omit<LivestockBatch, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    // Mode démonstration : ne rien faire (ou simuler)
    if (isDemoMode) {
      toast({
        title: 'Mode Démonstration',
        description: 'Fonctionnalité désactivée en mode démonstration',
        variant: 'default'
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Strip client-only fields not present in DB schema
      const { attached_infrastructure_id, ...safeBatch } = batch as any;

      const { data, error } = await supabase
        .from('livestock_batches')
        .insert([{ ...safeBatch, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Lot de poissons créé avec succès'
      });

      // Create notification for batch creation
      await notificationHelpers.livestockBatchAdded(user.id, batch.species, batch.quantity, batch.unit_name);

      await fetchBatches();
      emitDataMutation({ table: 'livestock_batches', action: 'create', id: data.id, module: 'livestock' });
      requestDataRefresh('batch-created', ['livestock_batches', 'unit_infrastructures']);
      return data;
    } catch (error: any) {
      console.error('Error creating batch:', error);
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de créer le lot de poissons',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateBatch = async (id: string, updates: Partial<LivestockBatch>) => {
    try {
      // Strip client-only fields not present in the DB schema
      const { attached_infrastructure_id, unit_name, ...safeUpdates } = updates as any;
      const payload: any = { ...safeUpdates };
      if (unit_name !== undefined) payload.unit_name = unit_name;
      const { error } = await supabase
        .from('livestock_batches')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Lot de poissons mis à jour'
      });

      await fetchBatches();
      emitDataMutation({ table: 'livestock_batches', action: 'update', id, module: 'livestock' });
      requestDataRefresh('batch-updated', ['livestock_batches', 'unit_infrastructures']);
    } catch (error: any) {
      console.error('Error updating batch:', error);
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de mettre à jour le lot',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deleteBatch = async (id: string) => {
    try {
      const { error } = await supabase
        .from('livestock_batches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Lot de poissons supprimé'
      });

      await fetchBatches();
      emitDataMutation({ table: 'livestock_batches', action: 'delete', id, module: 'livestock' });
      requestDataRefresh('batch-deleted', ['livestock_batches', 'unit_infrastructures']);
    } catch (error: any) {
      console.error('Error deleting batch:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le lot',
        variant: 'destructive'
      });
      throw error;
    }
  };

  // Charger les données quand l'auth est prête
  useEffect(() => {
    if (isReady) {
      fetchBatches();
    }
  }, [isReady, isAuthenticated, unitId, fetchBatches, isDemoMode]);

  return {
    batches,
    loading,
    error,
    createBatch,
    updateBatch,
    deleteBatch,
    refetch: fetchBatches
  };
};
