import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';

export interface ProductionUnitDB {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string | null;
  is_active: boolean;
  capacity: number;
  current_stock: number;
  manager: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useProductionUnitsData = () => {
  const [units, setUnits] = useState<ProductionUnitDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isReady, isAuthenticated, user } = useAuthReady();

  const fetchUnits = useCallback(async () => {
    if (!isReady) return;
    
    if (!isAuthenticated) {
      setUnits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await (supabase as any)
        .from('production_units')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        throw fetchError;
      }
      
      setUnits(data || []);
    } catch (err: any) {
      console.error('Error fetching production units:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les unités de production',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, toast]);

  useEffect(() => {
    if (isReady) {
      fetchUnits();
    }
  }, [isReady, isAuthenticated, fetchUnits]);

  const createUnit = async (unitData: {
    name: string;
    type: string;
    description?: string;
    is_active?: boolean;
    capacity?: number;
    current_stock?: number;
    manager?: string;
    photo_url?: string;
  }) => {
    if (!user?.id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être connecté pour créer une unité',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('production_units')
        .insert({
          user_id: user.id,
          name: unitData.name,
          type: unitData.type,
          description: unitData.description || null,
          is_active: unitData.is_active ?? true,
          capacity: unitData.capacity || 0,
          current_stock: unitData.current_stock || 0,
          manager: unitData.manager || null,
          photo_url: unitData.photo_url || null,
        })
        .select()
        .single();

      if (error) throw error;

      setUnits(prev => [data, ...prev]);
      toast({
        title: 'Succès',
        description: 'Unité de production créée avec succès',
      });
      
      return data;
    } catch (err: any) {
      console.error('Error creating production unit:', err);
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de créer l\'unité',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateUnit = async (id: string, updates: Partial<Omit<ProductionUnitDB, 'id' | 'user_id' | 'created_at'>>) => {
    try {
      const { data, error } = await (supabase as any)
        .from('production_units')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setUnits(prev => prev.map(unit => unit.id === id ? data : unit));
      toast({
        title: 'Succès',
        description: 'Unité mise à jour avec succès',
      });
      
      return data;
    } catch (err: any) {
      console.error('Error updating production unit:', err);
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de mettre à jour l\'unité',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteUnit = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('production_units')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setUnits(prev => prev.filter(unit => unit.id !== id));
      toast({
        title: 'Succès',
        description: 'Unité supprimée avec succès',
      });
      
      return true;
    } catch (err: any) {
      console.error('Error deleting production unit:', err);
      toast({
        title: 'Erreur',
        description: err.message || 'Impossible de supprimer l\'unité',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    units,
    loading,
    error,
    createUnit,
    updateUnit,
    deleteUnit,
    refetch: fetchUnits,
  };
};
