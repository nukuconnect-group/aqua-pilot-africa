import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';
import { useAuth } from '@/contexts/AuthContext';
import { getDemoData } from '@/lib/demoData';

export interface FeedingRecord {
  id: string;
  user_id: string;
  cycle_id?: string;
  infrastructure_id?: string;
  unit_id: string;
  date: string;
  time?: string;
  feed_type?: string;
  quantity: number;
  fcr?: number;
  temperature?: number;
  behavior?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Nouveaux champs pour les sessions détaillées
  session_type?: string;
  feeder_name?: string;
  prescribed_quantity?: number;
  actual_quantity?: number;
  remaining_quantity?: number;
  mortality?: number;
}

export const useFeedingRecords = (cycleId?: string, unitId?: string) => {
  const [records, setRecords] = useState<FeedingRecord[]>([]);
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
      let demoRecords = demoData.feedingRecords || [];
      
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
        .from('feeding_records')
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
        setRecords(data as unknown as FeedingRecord[]);
      }
    } catch (err: any) {
      console.error('Error fetching feeding records:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les enregistrements d\'alimentation',
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

  const createRecord = async (record: Omit<FeedingRecord, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
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
        .from('feeding_records')
        .insert([{ ...record, user_id: user.id }] as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Enregistrement d\'alimentation créé',
      });

      await fetchRecords();
      return data;
    } catch (error: any) {
      console.error('Error creating feeding record:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer l\'enregistrement',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateRecord = async (id: string, updates: Partial<FeedingRecord>) => {
    try {
      const { error } = await supabase
        .from('feeding_records')
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
        .from('feeding_records')
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
