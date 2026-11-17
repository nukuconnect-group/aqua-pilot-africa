import { requireFreshRead } from '@/lib/manualRefresh';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { getDemoData } from '@/lib/demoData';
import { emitDataMutation } from '@/lib/appRecovery';
import { getCurrency } from '@/lib/currency';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import type { PostgrestError } from '@supabase/supabase-js';

const RETRYABLE_SALE_ERROR_CODES = new Set(['23505', '40001', '40P01', '57014']);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export interface SaleItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  clientRequestId?: string;
  date: string;
  clientName: string;
  clientContact: string;
  unitId: string;
  products: SaleItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'paid' | 'cancelled';
  cancelledAt?: string;
  cancellationReason?: string;
  statusBeforeCancellation?: string;
  paymentMethod: string;
  notes: string;
  dueDate?: string;
  isCredit?: boolean;
  paidAmount?: number;
  paymentTerms?: string;
  documentType?: 'receipt' | 'invoice' | 'proforma';
  documentNumber?: string;
  taxRate?: number;
}

type SaleRow = Pick<Tables<'sales'>, 'id' | 'date' | 'client_name' | 'unit_id' | 'status' | 'total_amount'> & Partial<Tables<'sales'>> & { sale_items?: unknown };

const mapSaleItem = (item: unknown): SaleItem | null => {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  if (typeof row.name !== 'string') return null;
  const quantity = Number(row.quantity);
  const unitPrice = Number(row.unit_price);
  const total = Number(row.total);
  return { name: row.name, quantity: Number.isFinite(quantity) ? quantity : 0, unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0, total: Number.isFinite(total) ? total : 0 };
};

const mapSaleRow = (s: SaleRow, fallbackProducts: SaleItem[] = []): Sale => ({
  id: s.id,
  clientRequestId: s.client_request_id || undefined,
  date: s.date,
  clientName: s.client_name,
  clientContact: s.client_contact || '',
  unitId: s.unit_id,
  products: Array.isArray(s.sale_items)
    ? s.sale_items.map(mapSaleItem).filter((item): item is SaleItem => item !== null)
    : fallbackProducts,
  totalAmount: Number(s.total_amount) || 0,
  status: s.status as Sale['status'],
  paymentMethod: s.payment_method || '',
  notes: s.notes || '',
  dueDate: s.due_date || undefined,
  isCredit: s.is_credit || false,
  paidAmount: Number(s.paid_amount) || 0,
  paymentTerms: s.payment_terms || undefined,
  documentType: (s.document_type as Sale['documentType']) || 'receipt',
  documentNumber: s.document_number || undefined,
  taxRate: Number(s.tax_rate) || 0,
  cancelledAt: s.cancelled_at || undefined,
  cancellationReason: s.cancellation_reason || undefined,
  statusBeforeCancellation: s.status_before_cancellation || undefined,
});

export const useSales = () => {
  const { isDemoMode, user, isAuthenticated } = useAuth();
  const { activeUnit, addTransaction } = useProductionUnits();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const backgroundRead = useRef(false);
  const fetchSales = useCallback(async () => {
    if (isDemoMode) {
      const demoData = getDemoData();
      const demoSales = ((demoData.sales || []) as unknown as SaleRow[]).map((row) => mapSaleRow(row));
      setSales(demoSales);
      return;
    }
    if (!user?.id || !isAuthenticated) return;

    if (!backgroundRead.current) setLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSales((data || []).map((row) => mapSaleRow(row)));
    } catch (err) {
      setFetchError('Impossible de charger les ventes.');
      console.error('Error fetching sales:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, user?.id, isAuthenticated]);

  useManualRefresh(async () => {
    backgroundRead.current = true;
    try { requireFreshRead(await fetchSales()); } finally { backgroundRead.current = false; }
  });

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filteredSales = useMemo(() => {
    if (!activeUnit?.id) return sales;
    return sales.filter(s => s.unitId === activeUnit.id);
  }, [sales, activeUnit?.id]);

  const addSale = async (sale: Omit<Sale, 'id'>) => {
    if (isDemoMode) {
      const newSale: Sale = { ...sale, id: `V${Date.now()}` };
      setSales(prev => [newSale, ...prev]);
      return newSale;
    }
    if (!user?.id) return null;

    const clientRequestId = sale.clientRequestId || `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      let saleData: SaleRow | null = null;
      let lastError: PostgrestError | null = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data, error } = await supabase.rpc('create_sale_idempotent', {
          _client_request_id: clientRequestId,
          _unit_id: sale.unitId,
          _date: sale.date,
          _client_name: sale.clientName,
          _client_contact: sale.clientContact || null,
          _total_amount: sale.totalAmount,
          _status: sale.status,
          _payment_method: sale.paymentMethod || null,
          _notes: sale.notes || null,
          _due_date: sale.dueDate || null,
          _is_credit: sale.isCredit || false,
          _paid_amount: sale.paidAmount || 0,
          _payment_terms: sale.paymentTerms || null,
          _document_type: sale.documentType || 'receipt',
          _document_number: sale.documentNumber || null,
          _tax_rate: sale.taxRate ?? 0,
          _items: sale.products.map((item) => ({ name: item.name, quantity: item.quantity, unit_price: item.unitPrice, total: item.total })),
        });

        if (!error) {
          saleData = data?.[0] ?? null;
          break;
        }

        lastError = error;
        if (!RETRYABLE_SALE_ERROR_CODES.has(error.code) || attempt === 2) break;
        await wait(300 * (attempt + 1));
      }

      if (lastError && !saleData) throw lastError;
      if (!saleData) throw new Error('Vente non enregistrée');

      const newSale: Sale = mapSaleRow(saleData, sale.products);

      setSales(prev => [newSale, ...prev.filter((existing) => existing.id !== newSale.id)]);
      emitDataMutation({ table: 'sales', action: 'create', id: newSale.id, module: 'sales' });

      // Create revenue transaction in accounting (best-effort — ne doit pas
      // masquer le succès de l'enregistrement de la vente si la compta échoue)
      if (sale.status === 'confirmed' || sale.status === 'paid') {
        try {
          await addTransaction({
            date: sale.date,
            type: 'revenue',
            category: 'Vente de poissons',
            description: `Vente à ${sale.clientName}`,
            amount: sale.totalAmount,
            currency: getCurrency(),
            paymentMethod: sale.paymentMethod,
            client: sale.clientName,
            status: sale.status === 'paid' ? 'confirmed' : 'pending',
            unitId: sale.unitId,
            unitName: activeUnit?.name
          });
        } catch (txErr) {
          console.error('Sale saved but accounting transaction failed:', txErr);
        }
      }

      // Force refresh pour garantir la synchronisation avec la base
      await fetchSales();

      return newSale;
    } catch (err) {
      console.error('Error adding sale:', err);
      return null;
    }
  };

  // Synchronisation temps réel : rafraîchit la liste dès qu'une vente est
  // ajoutée/modifiée/supprimée côté base (autre onglet, autre membre équipe, etc.)
  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    const channel = supabase
      .channel(`sales-realtime-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => { fetchSales(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_items' },
        () => { fetchSales(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDemoMode, user?.id, fetchSales]);

  const updateSale = async (id: string, updates: Partial<Sale>) => {
    const sale = sales.find(s => s.id === id);
    if (!sale || sale.status === 'cancelled' || updates.status === 'cancelled') return null;

    if (isDemoMode) {
      const updatedSale = { ...sale, ...updates };
      setSales(prev => prev.map(s => s.id === id ? updatedSale : s));
      emitDataMutation({ table: 'sales', action: 'update', id, module: 'sales' });

      // If status changed to confirmed or paid and wasn't before, create transaction
      const wasNotConfirmed = sale.status !== 'confirmed' && sale.status !== 'paid';
      const isNowConfirmed = updates.status === 'confirmed' || updates.status === 'paid';
      
      if (wasNotConfirmed && isNowConfirmed) {
        await addTransaction({
          date: updatedSale.date,
          type: 'revenue',
          category: 'Vente de poissons',
          description: `Vente à ${updatedSale.clientName}`,
          amount: updatedSale.totalAmount,
          currency: getCurrency(),
          paymentMethod: updatedSale.paymentMethod,
          client: updatedSale.clientName,
          status: updates.status === 'paid' ? 'confirmed' : 'pending',
          unitId: updatedSale.unitId,
          unitName: activeUnit?.name
        });
      }

      return updatedSale;
    }

    if (!user?.id) return null;

    try {
      const dbUpdates: TablesUpdate<'sales'> = {};
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
      if (updates.clientContact !== undefined) dbUpdates.client_contact = updates.clientContact;
      if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.isCredit !== undefined) dbUpdates.is_credit = updates.isCredit;
      if (updates.paidAmount !== undefined) dbUpdates.paid_amount = updates.paidAmount;
      if (updates.paymentTerms !== undefined) dbUpdates.payment_terms = updates.paymentTerms;

      const { error } = await supabase
        .from('sales')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      const updatedSale = { ...sale, ...updates };
      setSales(prev => prev.map(s => s.id === id ? updatedSale : s));

      // If status changed to confirmed or paid and wasn't before, create transaction
      const wasNotConfirmed = sale.status !== 'confirmed' && sale.status !== 'paid';
      const isNowConfirmed = updates.status === 'confirmed' || updates.status === 'paid';
      
      if (wasNotConfirmed && isNowConfirmed) {
        await addTransaction({
          date: updatedSale.date,
          type: 'revenue',
          category: 'Vente de poissons',
          description: `Vente à ${updatedSale.clientName}`,
          amount: updatedSale.totalAmount,
          currency: getCurrency(),
          paymentMethod: updatedSale.paymentMethod,
          client: updatedSale.clientName,
          status: updates.status === 'paid' ? 'confirmed' : 'pending',
          unitId: updatedSale.unitId,
          unitName: activeUnit?.name
        });
      }

      return updatedSale;
    } catch (err) {
      console.error('Error updating sale:', err);
      return null;
    }
  };

  const cancelSale = async (id: string, reason: string) => {
    if (!user?.id || isDemoMode || !activeUnit?.id) throw new Error('Connectez-vous et sélectionnez une unité.');
    const sale = sales.find(s => s.id === id && s.unitId === activeUnit.id);
    if (!sale) throw new Error('Vente inaccessible pour cette unité.');
    if (!reason.trim()) throw new Error('Indiquez le motif de l’annulation.');
    const { error } = await supabase.rpc('cancel_sale', { _sale_id: id, _reason: reason.trim() });
    if (error) throw error;
    await fetchSales();
    emitDataMutation({ table: 'sales', action: 'update', id, module: 'sales' });
    return true;
  };
  // Compatibility: old callers cannot erase posted business history.
  const deleteSale = async (_id: string) => { throw new Error('Utilisez Annuler la vente et indiquez un motif.'); };

  return {
    sales: filteredSales,
    allSales: sales,
    loading,
    error: fetchError,
    addSale,
    updateSale,
    deleteSale,
    cancelSale,
    refetch: fetchSales
  };
};
