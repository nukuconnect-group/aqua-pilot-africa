import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';

export interface CycleInfrastructure {
  id: string;
  cycle_id: string;
  infrastructure_name: string;
  infrastructure_type: string;
  current_quantity: number;
  notes?: string;
  livestock_batch_id?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const useCycleInfrastructures = (cycleId?: string, fetchAll: boolean = false) => {
  const [infrastructures, setInfrastructures] = useState<CycleInfrastructure[]>([]);
  const [allCycleInfrastructures, setAllCycleInfrastructures] = useState<CycleInfrastructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isReady, isAuthenticated } = useAuthReady();

  const fetchInfrastructures = useCallback(async () => {
    if (!isReady) return;
    
    if (!isAuthenticated) {
      setInfrastructures([]);
      setLoading(false);
      return;
    }

    // If no cycleId and not fetchAll, return empty
    if (!cycleId && !fetchAll) {
      setInfrastructures([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Toujours charger toutes les infrastructures pour vérifier les doublons
      const { data: allData, error: allError } = await supabase
        .from('cycle_infrastructures')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (allError) {
        setError(allError.message);
        throw allError;
      }
      
      if (allData) {
        setAllCycleInfrastructures(allData as unknown as CycleInfrastructure[]);
      }
      
      // Filtrer par cycle si nécessaire
      let filteredData = allData || [];
      if (cycleId) {
        filteredData = filteredData.filter(item => item.cycle_id === cycleId);
      } else if (!fetchAll) {
        filteredData = [];
      }
      
      setInfrastructures(filteredData as unknown as CycleInfrastructure[]);
    } catch (err: any) {
      console.error('Error fetching infrastructures:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les infrastructures',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, cycleId, fetchAll, toast]);

  useEffect(() => {
    if (isReady) {
      fetchInfrastructures();
    }
  }, [isReady, isAuthenticated, cycleId, fetchAll, fetchInfrastructures]);

  const createInfrastructures = async (
    cycleId: string, 
    infrastructureNames: string[], 
    infrastructureType: string,
    batchMapping?: Record<string, string>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const infrastructuresToCreate = infrastructureNames.map(name => ({
        cycle_id: cycleId,
        infrastructure_name: name,
        infrastructure_type: infrastructureType,
        current_quantity: 0,
        user_id: user.id,
        livestock_batch_id: batchMapping?.[name] || null
      }));

      const { data, error } = await supabase
        .from('cycle_infrastructures')
        .insert(infrastructuresToCreate as any)
        .select();

      if (error) throw error;

      toast({
        title: 'Succès',
        description: `${infrastructureNames.length} infrastructure(s) rattachée(s) au cycle`,
      });

      await fetchInfrastructures();
      return data;
    } catch (error: any) {
      console.error('Error creating infrastructures:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de rattacher les infrastructures',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateInfrastructure = async (id: string, updates: Partial<CycleInfrastructure>) => {
    try {
      const { error } = await supabase
        .from('cycle_infrastructures')
        .update(updates)
        .eq('id', id as any);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Infrastructure mise à jour',
      });

      await fetchInfrastructures();
    } catch (error: any) {
      console.error('Error updating infrastructure:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'infrastructure',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteInfrastructure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cycle_infrastructures')
        .delete()
        .eq('id', id as any);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Infrastructure retirée du cycle',
      });

      await fetchInfrastructures();
    } catch (error: any) {
      console.error('Error deleting infrastructure:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer l\'infrastructure',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Fonction pour vérifier si une infrastructure est déjà rattachée à un cycle actif
  const isInfrastructureInActiveCycle = useCallback((infrastructureName: string, excludeCycleId?: string): { isAttached: boolean; cycleName?: string } => {
    const found = allCycleInfrastructures.find(ci => 
      ci.infrastructure_name === infrastructureName && 
      (excludeCycleId ? ci.cycle_id !== excludeCycleId : true)
    );
    return { isAttached: !!found, cycleName: found ? `Cycle ${found.cycle_id.slice(0, 8)}` : undefined };
  }, [allCycleInfrastructures]);

  return {
    infrastructures,
    allCycleInfrastructures,
    loading,
    error,
    createInfrastructures,
    updateInfrastructure,
    deleteInfrastructure,
    isInfrastructureInActiveCycle,
    refetch: fetchInfrastructures,
  };
};
