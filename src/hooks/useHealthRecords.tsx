import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';
import { useAuth } from '@/contexts/AuthContext';
import { getDemoData } from '@/lib/demoData';

export interface HealthRecord {
  id: string;
  user_id: string;
  cycle_id?: string;
  unit_id: string;
  basin_id?: string;
  date: string;
  temperature?: number;
  ph?: number;
  oxygen?: number;
  density?: number;
  mortality?: number;
  feeding?: number;
  average_weight?: number;
  sample_count?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useHealthRecords = (cycleId?: string, unitId?: string) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isReady, isAuthenticated } = useAuthReady();
  const { isDemoMode } = useAuth();

  const backgroundRead = useRef(false);
  const fetchRecords = useCallback(async () => {
    // Attendre que l'auth soit prête
    if (!isReady) return;

    // Mode démonstration : charger les données fictives
    if (isDemoMode) {
      const demoData = getDemoData();
      let demoRecords = demoData.healthRecords || [];
      
      if (cycleId) {
        demoRecords = demoRecords.filter((r: any) => r.cycle_id === cycleId);
      }
      if (unitId) {
        demoRecords = demoRecords.filter((r: any) => r.unit_id === unitId);
      }
      
      setRecords(demoRecords);
      setLoading(false);
      return;
    }
    
    // Ne pas charger si non authentifié
    if (!isAuthenticated) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      if (!backgroundRead.current) setLoading(true);
      setError(null);
      
      let query = supabase
        .from('health_records')
        .select('*')
        .order('date', { ascending: false });

      if (cycleId) {
        query = query.eq('cycle_id', cycleId as any);
      }

      if (unitId) {
        query = query.eq('unit_id', unitId as any);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        throw fetchError;
      }
      
      if (data) {
        setRecords(data as unknown as HealthRecord[]);
      }
    } catch (err: any) {
      console.error('Error fetching health records:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les enregistrements de santé',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, cycleId, unitId, toast, isDemoMode]);

  useManualRefresh(async () => {
    backgroundRead.current = true;
    try { await fetchRecords(); } finally { backgroundRead.current = false; }
  });

  // Charger les données quand l'auth est prête
  useEffect(() => {
    if (isReady) {
      fetchRecords();
    }
  }, [isReady, isAuthenticated, cycleId, unitId, fetchRecords, isDemoMode]);

  const createRecord = async (record: Omit<HealthRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    // Mode démonstration : ne rien faire
    if (isDemoMode) {
      toast({
        title: 'Mode Démonstration',
        description: 'Fonctionnalité désactivée en mode démonstration'
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('health_records')
        .insert([{ ...record, user_id: user.id }] as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Enregistrement de santé créé',
      });

      await fetchRecords();
      return data;
    } catch (error: any) {
      console.error('Error creating health record:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer l\'enregistrement',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateRecord = async (id: string, updates: Partial<HealthRecord>) => {
    try {
      const { error } = await supabase
        .from('health_records')
        .update(updates)
        .eq('id', id as any);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Enregistrement mis à jour',
      });

      await fetchRecords();
    } catch (error: any) {
      console.error('Error updating record:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour l\'enregistrement',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const { error } = await supabase
        .from('health_records')
        .delete()
        .eq('id', id as any);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Enregistrement supprimé',
      });

      await fetchRecords();
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'enregistrement',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    records,
    loading,
    error,
    createRecord,
    updateRecord,
    deleteRecord,
    refetch: fetchRecords,
  };
};
