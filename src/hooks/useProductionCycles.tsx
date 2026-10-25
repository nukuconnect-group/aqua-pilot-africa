import { requireFreshRead } from '@/lib/manualRefresh';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';
import { notificationHelpers } from '@/lib/notificationService';

export interface ProductionCycle {
  id: string;
  user_id: string;
  unit_id: string;
  unit_name: string;
  unit_type: string;
  name: string;
  status: string;
  start_date: string;
  end_date?: string;
  current_quantity: number;
  target_quantity: number;
  initial_quantity?: number;
  fingerlings_count?: number;
  stocking_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  species?: string;
  duration_months?: number;
}

export const useProductionCycles = (unitId?: string) => {
  const [cycles, setCycles] = useState<ProductionCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isReady, isAuthenticated } = useAuthReady();

  const backgroundRead = useRef(false);
  const fetchCycles = useCallback(async () => {
    // Attendre que l'auth soit prête
    if (!isReady) return;
    
    // Ne pas charger si non authentifié
    if (!isAuthenticated) {
      setCycles([]);
      setLoading(false);
      return;
    }

    try {
      if (!backgroundRead.current) setLoading(true);
      setError(null);
      
      let query = supabase
        .from('production_cycles')
        .select('*')
        .order('created_at', { ascending: false });

      if (unitId) {
        query = query.eq('unit_id', unitId as any);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        throw fetchError;
      }
      
      if (data) {
        setCycles(data as unknown as ProductionCycle[]);
      }
    } catch (err: any) {
      console.error('Error fetching cycles:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les cycles de production',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, unitId, toast]);

  useManualRefresh(async () => {
    backgroundRead.current = true;
    try { requireFreshRead(await fetchCycles()); } finally { backgroundRead.current = false; }
  });

  // Charger les données quand l'auth est prête
  useEffect(() => {
    if (isReady) {
      fetchCycles();
    }
  }, [isReady, isAuthenticated, unitId, fetchCycles]);

  const createCycle = async (cycle: Omit<ProductionCycle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('production_cycles')
        .insert([{ ...cycle, user_id: user.id }] as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Cycle de production créé avec succès',
      });

      // Les notifications ne doivent JAMAIS faire échouer la création du cycle
      try {
        await notificationHelpers.cycleCreated(user.id, cycle.name, cycle.unit_name);
      } catch (notifyError) {
        console.warn('Notification cycle non envoyée (non bloquant):', notifyError);
      }

      await fetchCycles();
      return data as unknown as ProductionCycle;
    } catch (error: any) {
      console.error('Error creating cycle:', error);
      toast({
        title: 'Impossible de créer le cycle',
        description: error?.message || error?.details || 'Erreur inconnue côté base de données',
        variant: 'destructive',
      });
      throw error;
    }

  };

  const updateCycle = async (id: string, updates: Partial<ProductionCycle>) => {
    try {
      const { error } = await supabase
        .from('production_cycles')
        .update(updates as any)
        .eq('id', id as any);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Cycle de production mis à jour',
      });

      await fetchCycles();
    } catch (error: any) {
      console.error('Error updating cycle:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le cycle',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteCycle = async (id: string) => {
    try {
      const { error } = await supabase
        .from('production_cycles')
        .delete()
        .eq('id', id as any);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Cycle de production supprimé',
      });

      await fetchCycles();
    } catch (error: any) {
      console.error('Error deleting cycle:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le cycle',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    cycles,
    loading,
    error,
    createCycle,
    updateCycle,
    deleteCycle,
    refetch: fetchCycles,
  };
};
