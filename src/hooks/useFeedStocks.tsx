import { requireFreshRead } from '@/lib/manualRefresh';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuthReady } from '@/hooks/useAuthReady';
import { isMissingColumnError, toLegacyStockRow, type StockPurpose } from '@/lib/stockPurpose';

export interface FeedStock {
  id: string;
  user_id: string;
  unit_id: string;
  custom_name?: string;
  feed_type: string;
  quantity: number;
  unit: string;
  expiration_date?: string | null;
  supplier?: string | null;
  cost?: number | null;
  protein_content?: number | null;
  fat_content?: number | null;
  notes?: string | null;
  min_threshold?: number;
  bag_count?: number | null;
  kg_per_bag?: number | null;
  stock_purpose?: StockPurpose | null;
  sale_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

export const useFeedStocks = (unitId?: string) => {
  const [stocks, setStocks] = useState<FeedStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const loadedKey = useRef<string | null>(null);
  const { isReady, isAuthenticated } = useAuthReady();

  const fetchStocks = useCallback(async () => {
    // Attendre que l'auth soit prête
    if (!isReady) return;
    
    // Ne pas charger si non authentifié
    if (!isAuthenticated) {
      setStocks([]);
      setLoading(false);
      return;
    }

    try {
      // Refreshes after a save keep the screen (and any open form) mounted.
      if (loadedKey.current !== (unitId ?? '')) setLoading(true);
      setError(null);
      
      let query = supabase
        .from('feed_stocks')
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
      
      if (data) {
        setStocks(data as FeedStock[]);
        loadedKey.current = unitId ?? '';
      }
    } catch (err: any) {
      console.error('Error fetching feed stocks:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les stocks d\'aliments',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [isReady, isAuthenticated, unitId, toast]);

  useManualRefresh(async () => {
    requireFreshRead(await fetchStocks());
  });

  // Charger les données quand l'auth est prête
  useEffect(() => {
    if (isReady) {
      fetchStocks();
    }
  }, [isReady, isAuthenticated, unitId, fetchStocks]);

  const createStock = async (stock: Omit<FeedStock, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      if ((stock as any).stock_purpose === 'commercial' && !(Number((stock as any).sale_price) > 0)) {
        throw new Error('Indiquez d’abord le prix de vente : un produit commercial ne peut pas être enregistré sans prix.');
      }

      const row: any = { ...stock, user_id: user.id };
      let { data, error } = await (supabase as any).from('feed_stocks').insert([row]).select().single();
      if (isMissingColumnError(error)) {
        ({ data, error } = await (supabase as any).from('feed_stocks').insert([toLegacyStockRow(row)]).select().single());
      }

      if (error) throw error;

      // Stock initial : enregistre l'entrée correspondante dans les mouvements.
      if (data?.id && Number(data.quantity) > 0 && data.unit_id) {
        await (supabase as any).from('stock_movements').insert({
          user_id: user.id, unit_id: data.unit_id, stock_id: data.id, type: 'in',
          quantity: Number(data.quantity), quantity_after: Number(data.quantity), reason: 'Stock initial',
        });
      }

      toast({
        title: 'Succès',
        description: 'Stock d\'aliment créé avec succès',
      });

      await fetchStocks();
      return data as FeedStock;
    } catch (error: any) {
      console.error('Error creating feed stock:', error);
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de créer le stock d\'aliment',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateStock = async (id: string, updates: Partial<FeedStock>) => {
    try {
      if (!unitId) throw new Error('Sélectionnez une unité de production.');
      let { error } = await (supabase as any).from('feed_stocks')
        .update(updates).eq('id', id).eq('unit_id', unitId).select('id').single();
      if (isMissingColumnError(error)) {
        ({ error } = await (supabase as any).from('feed_stocks')
          .update(toLegacyStockRow(updates as any)).eq('id', id).eq('unit_id', unitId).select('id').single());
      }

      if (error) throw error;

      toast({
        title: 'Succès',
        description: 'Stock d\'aliment mis à jour',
      });

      await fetchStocks();
    } catch (error: any) {
      console.error('Error updating feed stock:', error);
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de mettre à jour le stock',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteStocks = async (ids: string[]) => {
    try {
      if (!unitId) throw new Error('Sélectionnez une unité de production.');
      const selectedIds = [...new Set(ids)].filter(Boolean);
      if (!selectedIds.length) return [];
      const { data, error } = await supabase
        .from('feed_stocks')
        .delete()
        .eq('unit_id', unitId).in('id', selectedIds).select('id');

      if (error) throw error;

      toast({
        title: 'Succès',
        description: `${data?.length || 0} article(s) retiré(s) du stock`,
      });

      await fetchStocks();
      return (data || []).map(stock => stock.id);
    } catch (error: any) {
      console.error('Error deleting feed stock:', error);
      toast({
        title: 'Erreur',
        description: error?.code === '23503'
          ? 'Un article est lié à une opération existante. Corrigez-le plutôt que le supprimer ; aucun article de cette sélection n’a été supprimé.'
          : 'Suppression non confirmée. Vérifiez votre connexion et votre accès à cette unité, puis rechargez la liste.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    stocks,
    loading,
    error,
    createStock,
    updateStock,
    deleteStock: (id: string) => deleteStocks([id]),
    deleteStocks,
    refetch: fetchStocks,
  };
};
