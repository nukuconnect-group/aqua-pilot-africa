import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';

export interface FeedingPlan {
  id: string;
  user_id: string;
  unit_id: string;
  cycle_id?: string;
  infrastructure_id?: string;
  time: string;
  feed_type: string;
  quantity: number;
  unit: string;
  days: string[];
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useFeedingPlans = (unitId?: string, cycleId?: string) => {
  const [plans, setPlans] = useState<FeedingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isReady, isAuthenticated } = useAuthReady();

  const fetchPlans = useCallback(async () => {
    if (!isReady) return;
    
    if (!isAuthenticated) {
      setPlans([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('feeding_plans')
        .select('*')
        .order('time', { ascending: true });

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }
      if (cycleId) {
        query = query.eq('cycle_id', cycleId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        throw fetchError;
      }
      
      if (data) {
        setPlans(data as FeedingPlan[]);
      }
    } catch (err: any) {
      console.error('Error fetching feeding plans:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les planifications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, unitId, cycleId, toast]);

  useEffect(() => {
    if (isReady) {
      fetchPlans();
    }
  }, [isReady, isAuthenticated, unitId, cycleId, fetchPlans]);

  // Sync feeding plan with planned_tasks table
  const syncWithPlannedTasks = async (plan: FeedingPlan) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current day and check if plan applies today
      const today = new Date();
      const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const currentDay = dayNames[today.getDay()];
      
      if (!plan.days.includes(currentDay) || !plan.is_active) return;

      const todayStr = today.toISOString().split('T')[0];

      // Check if task already exists for today
      const { data: existingTask } = await supabase
        .from('planned_tasks')
        .select('id')
        .eq('source', 'feeding_plan')
        .eq('source_id', plan.id)
        .eq('due_date', todayStr)
        .single();

      if (!existingTask) {
        // Create task for today
        await supabase
          .from('planned_tasks')
          .insert({
            user_id: user.id,
            title: `Alimentation: ${plan.feed_type}`,
            type: 'feeding',
            description: `${plan.quantity} ${plan.unit} - ${plan.notes || ''}`,
            due_date: todayStr,
            due_time: plan.time,
            priority: 'high',
            status: 'pending',
            unit_id: plan.unit_id,
            source: 'feeding_plan',
            source_id: plan.id,
          });
      }
    } catch (err) {
      console.error('Error syncing with planned tasks:', err);
    }
  };

  const createPlan = async (plan: Omit<FeedingPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('feeding_plans')
        .insert([{ ...plan, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Sync with planned_tasks
      if (data) {
        await syncWithPlannedTasks(data as FeedingPlan);
      }

      toast({
        title: 'Succès',
        description: 'Planning créé avec succès',
      });

      await fetchPlans();
      return data as FeedingPlan;
    } catch (error: any) {
      console.error('Error creating feeding plan:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le planning',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updatePlan = async (id: string, updates: Partial<FeedingPlan>) => {
    try {
      const { error } = await supabase
        .from('feeding_plans')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Planning mis à jour',
      });

      await fetchPlans();
    } catch (error: any) {
      console.error('Error updating feeding plan:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le planning',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feeding_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Planning supprimé',
      });

      await fetchPlans();
    } catch (error: any) {
      console.error('Error deleting feeding plan:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le planning',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    plans,
    loading,
    error,
    createPlan,
    updatePlan,
    deletePlan,
    refetch: fetchPlans,
  };
};
