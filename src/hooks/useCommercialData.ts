import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import type { CommercialSale, CommercialPurchase, CommercialItem } from '@/lib/commercialAnalytics';

async function allRows(makeQuery: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await makeQuery().range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

export function useCommercialData(unitId?: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['commercial-performance', user?.id, unitId],
    enabled: enabled && Boolean(user?.id && unitId),
    queryFn: async () => {
      if (!unitId) throw new Error('Sélectionnez une unité.');
      const [sales, purchases] = await Promise.all([
        allRows(() => supabase.from('sales').select('id,unit_id,date,total_amount,status,paid_amount,is_credit').eq('unit_id', unitId).order('id')),
        allRows(() => supabase.from('purchases').select('id,unit_id,date,amount,currency,status').eq('unit_id', unitId).order('id')),
      ]);
      const items: CommercialItem[] = [];
      for (let offset = 0; offset < sales.length; offset += 100) {
        const ids = sales.slice(offset, offset + 100).map(s => s.id);
        items.push(...await allRows(() => supabase.from('sale_items').select('id,sale_id,name,quantity,total').in('sale_id', ids).order('id')));
      }
      return { sales: sales as CommercialSale[], purchases: purchases as CommercialPurchase[], items };
    },
  });
}