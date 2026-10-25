import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';

export interface AIAnalysis {
  id: string;
  user_id: string;
  unit_id: string | null;
  temperature: number;
  oxygene_dissous: number;
  ph: number;
  ammonium: number;
  nitrite: number;
  alerte: boolean;
  conseil: string;
  created_at: string;
}

export const useAIAnalyses = (limit: number = 10, unitId?: string) => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyses = async () => {
    if (!user) {
      setAnalyses([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('ai_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching analyses:', error);
        return;
      }

      if (data) {
        setAnalyses(data as unknown as AIAnalysis[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useManualRefresh(fetchAnalyses);

  const deleteAnalysis = async (id: string) => {
    if (!user) return;

      const { error } = await supabase
        .from('ai_analyses')
        .delete()
        .eq('id', id as any);

    if (error) {
      console.error('Error deleting analysis:', error);
      throw error;
    }

    // Refresh the list
    await fetchAnalyses();
  };

  useEffect(() => {
    fetchAnalyses();
  }, [user, unitId, limit]);

  return {
    analyses,
    loading,
    refetch: fetchAnalyses,
    deleteAnalysis
  };
};
