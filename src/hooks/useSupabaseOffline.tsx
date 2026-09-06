import { SUPABASE_URL } from '@/integrations/supabase/env';
// Hook personnalisé pour gérer les requêtes Supabase avec support hors ligne
import { useOffline } from './useOffline';
import { supabase } from '@/integrations/supabase/clientConfig';

export const useSupabaseOffline = () => {
  const { isOnline, addOfflineAction, saveOfflineData, getOfflineData } = useOffline();

  /**
   * Insérer des données avec support hors ligne
   */
  const insertWithOffline = async (
    table: string,
    data: any
  ) => {
    const dataArray = Array.isArray(data) ? data : [data];

    if (isOnline) {
      try {
        const { data: result, error } = await (supabase as any)
          .from(table)
          .insert(dataArray)
          .select();

        if (error) throw error;

        // Sauvegarder en cache pour consultation hors ligne
        await saveOfflineData(`${table}_cache`, result);
        
        return { data: result, error: null };
      } catch (error) {
        console.error('Erreur lors de l\'insertion:', error);
        // Si échec en ligne, passer en mode hors ligne
      }
    }

    // Mode hors ligne : enregistrer l'action pour synchronisation ultérieure
    for (const item of dataArray) {
      await addOfflineAction(
        `insert_${table}`,
        item,
        `${SUPABASE_URL}/rest/v1/${table}`,
        'POST'
      );
    }

    // Sauvegarder temporairement en cache local
    const cached = await getOfflineData(`${table}_cache`) || [];
    await saveOfflineData(`${table}_cache`, [...cached, ...dataArray]);

    return { 
      data: dataArray, 
      error: null,
      offline: true 
    };
  };

  /**
   * Mettre à jour des données avec support hors ligne
   */
  const updateWithOffline = async (
    table: string,
    id: string,
    data: any
  ) => {
    if (isOnline) {
      try {
        const { data: result, error } = await (supabase as any)
          .from(table)
          .update(data)
          .eq('id', id)
          .select();

        if (error) throw error;

        // Mettre à jour le cache
        const cached = await getOfflineData(`${table}_cache`) || [];
        const updated = cached.map((item: any) => 
          item.id === id ? { ...item, ...data } : item
        );
        await saveOfflineData(`${table}_cache`, updated);

        return { data: result, error: null };
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error);
      }
    }

    // Mode hors ligne
    await addOfflineAction(
      `update_${table}`,
      data,
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
      'PATCH'
    );

    // Mettre à jour le cache local
    const cached = await getOfflineData(`${table}_cache`) || [];
    const updated = cached.map((item: any) => 
      item.id === id ? { ...item, ...data } : item
    );
    await saveOfflineData(`${table}_cache`, updated);

    return { 
      data: [{ ...data, id }], 
      error: null,
      offline: true 
    };
  };

  /**
   * Récupérer des données avec fallback sur le cache
   */
  const selectWithOffline = async (
    table: string,
    options: {
      select?: string;
      match?: Record<string, any>;
      limit?: number;
      order?: { column: string; ascending?: boolean };
    } = {}
  ) => {
    if (isOnline) {
      try {
        let query = (supabase as any).from(table).select(options.select || '*');

        if (options.match) {
          Object.entries(options.match).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        if (options.order) {
          query = query.order(options.order.column, { 
            ascending: options.order.ascending ?? true 
          });
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Mettre en cache pour utilisation hors ligne
        await saveOfflineData(`${table}_cache`, data);

        return { data, error: null };
      } catch (error) {
        console.error('Erreur lors de la récupération:', error);
      }
    }

    // Fallback sur le cache local
    const cached = await getOfflineData(`${table}_cache`);
    
    let result = cached || [];

    // Appliquer les filtres sur les données en cache
    if (options.match && result.length > 0) {
      result = result.filter((item: any) => 
        Object.entries(options.match!).every(([key, value]) => item[key] === value)
      );
    }

    if (options.limit && result.length > 0) {
      result = result.slice(0, options.limit);
    }

    return { 
      data: result, 
      error: null,
      offline: true,
      cached: true
    };
  };

  /**
   * Supprimer des données avec support hors ligne
   */
  const deleteWithOffline = async (table: string, id: string) => {
    if (isOnline) {
      try {
        const { error } = await (supabase as any)
          .from(table)
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Supprimer du cache
        const cached = await getOfflineData(`${table}_cache`) || [];
        const filtered = cached.filter((item: any) => item.id !== id);
        await saveOfflineData(`${table}_cache`, filtered);

        return { error: null };
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }

    // Mode hors ligne
    await addOfflineAction(
      `delete_${table}`,
      { id },
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
      'DELETE'
    );

    // Supprimer du cache local
    const cached = await getOfflineData(`${table}_cache`) || [];
    const filtered = cached.filter((item: any) => item.id !== id);
    await saveOfflineData(`${table}_cache`, filtered);

    return { 
      error: null,
      offline: true 
    };
  };

  return {
    insertWithOffline,
    updateWithOffline,
    selectWithOffline,
    deleteWithOffline,
    isOnline,
  };
};

