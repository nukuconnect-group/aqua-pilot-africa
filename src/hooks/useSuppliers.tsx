import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { notificationHelpers } from '@/lib/notificationService';
import { getDemoData } from '@/lib/demoData';

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive' | 'pending';
  category: string;
  products: string[];
  rating: number;
  notes: string;
  unitId: string;
}

export interface SupplierOrder {
  id: string;
  supplierId: string;
  date: string;
  products: string;
  quantity: number;
  amount: number;
  status: 'pending' | 'delivered' | 'cancelled';
  deliveryDate: string;
  unitId: string;
}

const getDemoOrders = (): SupplierOrder[] => [
  {
    id: '1',
    supplierId: '1',
    date: '2024-03-10',
    products: 'Granulés flottants 25kg',
    quantity: 50,
    amount: 125000,
    status: 'delivered',
    deliveryDate: '2024-03-15',
    unitId: 'DEMO001'
  }
];

export const useSuppliers = () => {
  const { isDemoMode, user, isAuthenticated } = useAuth();
  const { activeUnit } = useProductionUnits();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    if (isDemoMode) {
      const demoData = getDemoData();
      const demoSuppliers = (demoData.suppliers || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        contact: s.contact || '',
        email: s.email || '',
        phone: s.phone || '',
        address: s.address || '',
        status: s.status as Supplier['status'],
        category: s.category,
        products: s.products || [],
        rating: s.rating,
        notes: s.notes || '',
        unitId: s.unit_id
      }));
      setSuppliers(demoSuppliers);
      setOrders(getDemoOrders());
      return;
    }
    if (!user?.id || !isAuthenticated) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSuppliers((data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        contact: s.contact || '',
        email: s.email || '',
        phone: s.phone || '',
        address: s.address || '',
        status: s.status as Supplier['status'],
        category: s.category,
        products: s.products || [],
        rating: s.rating,
        notes: s.notes || '',
        unitId: s.unit_id
      })));

      const { data: ordersData, error: ordersError } = await supabase
        .from('supplier_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders((ordersData || []).map((o: any) => ({
        id: o.id,
        supplierId: o.supplier_id,
        date: o.date,
        products: o.products,
        quantity: o.quantity,
        amount: o.amount,
        status: o.status as SupplierOrder['status'],
        deliveryDate: o.delivery_date || '',
        unitId: o.unit_id
      })));
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, user?.id, isAuthenticated]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!activeUnit?.id) return suppliers;
    return suppliers.filter(s => s.unitId === activeUnit.id);
  }, [suppliers, activeUnit?.id]);

  const filteredOrders = useMemo(() => {
    if (!activeUnit?.id) return orders;
    return orders.filter(o => o.unitId === activeUnit.id);
  }, [orders, activeUnit?.id]);

  const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
    if (isDemoMode) {
      const newSupplier: Supplier = { ...supplier, id: Date.now().toString() };
      setSuppliers(prev => [newSupplier, ...prev]);
      return newSupplier;
    }
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          user_id: user.id,
          unit_id: supplier.unitId,
          name: supplier.name,
          contact: supplier.contact,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          status: supplier.status,
          category: supplier.category,
          products: supplier.products,
          rating: supplier.rating,
          notes: supplier.notes
        })
        .select()
        .single();

      if (error) throw error;

      const newSupplier: Supplier = {
        id: data.id,
        name: data.name,
        contact: data.contact || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        status: data.status as Supplier['status'],
        category: data.category,
        products: data.products || [],
        rating: data.rating,
        notes: data.notes || '',
        unitId: data.unit_id
      };
      setSuppliers(prev => [newSupplier, ...prev]);
      
      // Create notification for supplier addition
      await notificationHelpers.supplierAdded(user.id, supplier.name, supplier.category);
      
      return newSupplier;
    } catch (err) {
      console.error('Error adding supplier:', err);
      return null;
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    if (isDemoMode) {
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      return true;
    }

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.contact !== undefined) dbUpdates.contact = updates.contact;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.products !== undefined) dbUpdates.products = updates.products;
      if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      const { error } = await supabase
        .from('suppliers')
        .update(dbUpdates as never)
        .eq('id', id);

      if (error) throw error;

      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      return true;
    } catch (err) {
      console.error('Error updating supplier:', err);
      return false;
    }
  };

  const deleteSupplier = async (id: string) => {
    if (isDemoMode) {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      return true;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuppliers(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting supplier:', err);
      return false;
    }
  };

  const addOrder = async (order: Omit<SupplierOrder, 'id'>) => {
    if (isDemoMode) {
      const newOrder: SupplierOrder = { ...order, id: Date.now().toString() };
      setOrders(prev => [newOrder, ...prev]);
      return newOrder;
    }
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('supplier_orders')
        .insert({
          user_id: user.id,
          unit_id: order.unitId,
          supplier_id: order.supplierId,
          date: order.date,
          products: order.products,
          quantity: order.quantity,
          amount: order.amount,
          status: order.status,
          delivery_date: order.deliveryDate || null
        })
        .select()
        .single();

      if (error) throw error;

      const newOrder: SupplierOrder = {
        id: data.id,
        supplierId: data.supplier_id,
        date: data.date,
        products: data.products,
        quantity: data.quantity,
        amount: data.amount,
        status: data.status as SupplierOrder['status'],
        deliveryDate: data.delivery_date || '',
        unitId: data.unit_id
      };
      setOrders(prev => [newOrder, ...prev]);
      return newOrder;
    } catch (err) {
      console.error('Error adding order:', err);
      return null;
    }
  };

  return {
    suppliers: filteredSuppliers,
    orders: filteredOrders,
    allSuppliers: suppliers,
    allOrders: orders,
    loading,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addOrder,
    refetch: fetchSuppliers
  };
};
