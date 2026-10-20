
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Filter, Download, Edit, Trash2, Search, ShoppingCart, CheckCircle, Clock, XCircle, Package, DollarSign, FileText, UserPlus, CreditCard, AlertTriangle, CalendarClock } from 'lucide-react';
import { useLogs } from '@/contexts/LogsContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { createNotification } from '@/lib/notificationService';
import { supabase } from '@/integrations/supabase/appClient';
import PurchaseInvoice from './PurchaseInvoice';
import { useSuppliers, Supplier } from '@/hooks/useSuppliers';
import { useTreasury } from '@/hooks/useTreasury';
import { expenseAccount } from '@/lib/syscohada';
import { getUnitTerms } from '@/lib/unitContext';


const PurchaseManager = () => {
  const { addLog } = useLogs();
  const { toast } = useToast();
  const {
    purchases,
    units,
    activeUnit,
    currency,
    setCurrency,
    addPurchase,
    updatePurchase,
    deletePurchase,
    convertCurrency,
  } = useProductionUnits();
  
  const { suppliers, addSupplier, refetch: refetchSuppliers } = useSuppliers();
  const treasury = useTreasury(activeUnit?.id);
  const [treasuryAccountId, setTreasuryAccountId] = useState('');

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [selectedInvoicePurchase, setSelectedInvoicePurchase] = useState<any>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customSubcategories, setCustomSubcategories] = useState<Record<string, string[]>>({});
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [showCustomSubcategoryInput, setShowCustomSubcategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    supplier: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    unitId: activeUnit?.id || 'all',
    status: '',
  });


  const [newPurchase, setNewPurchase] = useState({
    category: '',
    subcategory: '',
    description: '',
    supplier: '',
    amount: 0,
    currency: currency,
    quantity: 0,
    unit: '',
    paymentMethod: '',
    reference: '',
    unitId: activeUnit?.id || '',
    deliveryDate: '',
    notes: '',
    isCredit: false,
    dueDate: '',
    paymentTerms: ''
  });

  useEffect(() => {
    if (!activeUnit?.id) return;
    setFilters((prev) => ({ ...prev, unitId: activeUnit.id }));
    setNewPurchase((prev) => ({ ...prev, unitId: activeUnit.id }));
  }, [activeUnit?.id]);

  const predefinedPurchaseCategories = getUnitTerms(activeUnit?.type).purchaseCategoryMap;


  // Merge predefined and custom categories
  const purchaseCategories = useMemo(() => {
    const merged = { ...predefinedPurchaseCategories };
    customCategories.forEach(cat => {
      if (!merged[cat]) {
        merged[cat] = customSubcategories[cat] || [];
      }
    });
    // Add custom subcategories to existing categories
    Object.keys(customSubcategories).forEach(cat => {
      if (merged[cat]) {
        merged[cat] = [...new Set([...merged[cat], ...(customSubcategories[cat] || [])])];
      }
    });
    return merged;
  }, [customCategories, customSubcategories, predefinedPurchaseCategories]);

  const paymentMethods = [
    'Espèces',
    'Carte bancaire',
    'Virement',
    'Chèque',
    'Prélèvement',
    'Crédit fournisseur',
    'Mobile Money'
  ];

  const currencies = [
    { code: 'XOF', symbol: 'F CFA', name: 'Franc CFA' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dollar US' }
  ];

  const handleAddPurchase = async () => {
    const selectedUnit = units.find(u => u.id === newPurchase.unitId);
    addPurchase({
      date: new Date().toISOString().split('T')[0],
      category: newPurchase.category,
      subcategory: newPurchase.subcategory,
      description: newPurchase.description,
      supplier: newPurchase.supplier,
      amount: Number(newPurchase.amount),
      currency: newPurchase.currency as 'XOF' | 'EUR' | 'USD' | 'MAD',
      quantity: newPurchase.quantity || undefined,
      unit: newPurchase.unit || undefined,
      paymentMethod: newPurchase.paymentMethod,
      reference: newPurchase.reference,
      unitId: newPurchase.unitId || undefined,
      unitName: selectedUnit?.name || undefined,
      status: 'pending',
      deliveryDate: newPurchase.deliveryDate || undefined,
      notes: newPurchase.notes || undefined,
      isCredit: newPurchase.isCredit || false,
      dueDate: newPurchase.isCredit ? newPurchase.dueDate : undefined,
      paymentTerms: newPurchase.isCredit ? newPurchase.paymentTerms : undefined
    });

    // Prélèvement dans la caisse / le compte choisi (achat payé comptant)
    if (treasuryAccountId && !newPurchase.isCredit) {
      try {
        await treasury.recordMovement({
          requestId: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind: 'payment',
          sourceId: treasuryAccountId,
          destinationId: '',
          amount: Number(newPurchase.amount),
          date: new Date().toISOString().split('T')[0],
          label: `Achat — ${newPurchase.description || newPurchase.category}`,
          counterpart: expenseAccount(newPurchase.category),
        });
      } catch (e: any) {
        toast({ title: 'Achat enregistré, caisse non mise à jour', description: e.message, variant: 'destructive' });
      }
    }

    
    addLog('Achat enregistré', 'Achats', `${newPurchase.category}: ${newPurchase.description} - ${newPurchase.amount} ${newPurchase.currency}`, 'success');
    
    // Create notification for the purchase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await createNotification({
        userId: user.id,
        title: 'Nouvel achat',
        message: `${newPurchase.category}: ${newPurchase.description} - ${newPurchase.amount} ${newPurchase.currency}`,
        type: 'info',
        module: 'Achats',
        isCritical: false,
        metadata: {
          category: newPurchase.category,
          amount: newPurchase.amount,
          supplier: newPurchase.supplier
        }
      });
    }
    
    resetForm();
  };

  const handleUpdatePurchase = () => {
    if (!editingPurchase) return;
    
    const selectedUnit = units.find(u => u.id === newPurchase.unitId);
    updatePurchase(editingPurchase.id, {
      category: newPurchase.category,
      subcategory: newPurchase.subcategory,
      description: newPurchase.description,
      supplier: newPurchase.supplier,
      amount: Number(newPurchase.amount),
      currency: newPurchase.currency as 'XOF' | 'EUR' | 'USD' | 'MAD',
      quantity: newPurchase.quantity || undefined,
      unit: newPurchase.unit || undefined,
      paymentMethod: newPurchase.paymentMethod,
      reference: newPurchase.reference,
      unitId: newPurchase.unitId || undefined,
      unitName: selectedUnit?.name || undefined,
      deliveryDate: newPurchase.deliveryDate || undefined,
      notes: newPurchase.notes || undefined,
      isCredit: newPurchase.isCredit || false,
      dueDate: newPurchase.isCredit ? newPurchase.dueDate : undefined,
      paymentTerms: newPurchase.isCredit ? newPurchase.paymentTerms : undefined
    });
    
    addLog('Achat modifié', 'Achats', `Achat modifié: ${newPurchase.description}`, 'info');
    resetForm();
  };

  const resetForm = () => {
    setNewPurchase({
      category: '',
      subcategory: '',
      description: '',
      supplier: '',
      amount: 0,
      currency: currency,
      quantity: 0,
      unit: '',
      paymentMethod: '',
      reference: '',
      unitId: activeUnit?.id || '',
      deliveryDate: '',
      notes: '',
      isCredit: false,
      dueDate: '',
      paymentTerms: ''
    });
    setShowPurchaseForm(false);
    setEditingPurchase(null);
  };

  const handleEditPurchase = (purchase: any) => {
    setEditingPurchase(purchase);
    setNewPurchase({
      category: purchase.category,
      subcategory: purchase.subcategory || '',
      description: purchase.description,
      supplier: purchase.supplier,
      amount: purchase.amount,
      currency: purchase.currency,
      quantity: purchase.quantity || 0,
      unit: purchase.unit || '',
      paymentMethod: purchase.paymentMethod,
      reference: purchase.reference || '',
      unitId: purchase.unitId || '',
      deliveryDate: purchase.deliveryDate || '',
      notes: purchase.notes || '',
      isCredit: purchase.isCredit || false,
      dueDate: purchase.dueDate || '',
      paymentTerms: purchase.paymentTerms || ''
    });
    setShowPurchaseForm(true);
  };

  const handleStatusChange = async (
    purchaseId: string,
    newStatus: 'pending' | 'received' | 'cancelled'
  ) => {
    setStatusOverrides((prev) => ({ ...prev, [purchaseId]: newStatus }));

    try {
      await updatePurchase(purchaseId, { status: newStatus });
      setStatusOverrides((prev) => {
        const { [purchaseId]: _removed, ...rest } = prev;
        return rest;
      });

      const purchase = purchases.find((p) => p.id === purchaseId);
      addLog(
        'Statut achat modifié',
        'Achats',
        `${purchase?.description ?? 'Achat'} - Statut: ${getStatusLabel(newStatus)}`,
        'info'
      );
      toast({
        title: 'Statut mis à jour',
        description: `Achat marqué "${getStatusLabel(newStatus)}"`,
      });
    } catch (err) {
      console.error('Purchase status change failed:', err);
      setStatusOverrides((prev) => {
        const { [purchaseId]: _removed, ...rest } = prev;
        return rest;
      });
      toast({
        title: 'Erreur',
        description: "Impossible de confirmer l'achat. Vérifiez votre connexion et vos droits.",
        variant: 'destructive',
      });
    }
  };

  const filteredPurchases = purchases.filter(purchase => {
    return (
      (!filters.category || filters.category === 'all' || purchase.category === filters.category) &&
      (!filters.supplier || purchase.supplier.toLowerCase().includes(filters.supplier.toLowerCase())) &&
      (!filters.search || purchase.description.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.dateFrom || purchase.date >= filters.dateFrom) &&
      (!filters.dateTo || purchase.date <= filters.dateTo) &&
      (!filters.unitId || filters.unitId === 'all' || purchase.unitId === filters.unitId) &&
      (!filters.status || filters.status === 'all' || purchase.status === filters.status)
    );
  });

  const exportPurchases = () => {
    const csvContent = [
      ['Date', 'Catégorie', 'Sous-catégorie', 'Description', 'Fournisseur', 'Montant', 'Devise', 'Quantité', 'Unité', 'Mode de paiement', 'Statut'].join(','),
      ...filteredPurchases.map(p => [
        p.date,
        p.category,
        p.subcategory || '',
        p.description,
        p.supplier,
        p.amount,
        p.currency,
        p.quantity || '',
        p.unit || '',
        p.paymentMethod,
        p.status
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `achats_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    addLog('Export achats', 'Achats', 'Export CSV des achats généré', 'info');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received': return 'Reçu';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'received': return CheckCircle;
      case 'pending': return Clock;
      case 'cancelled': return XCircle;
      default: return Package;
    }
  };

  const getCurrencySymbol = (currencyCode: string) => {
    return currencies.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  const totalAmount = filteredPurchases.reduce((sum, p) => 
    sum + convertCurrency(p.amount, p.currency, currency), 0);
  const pendingAmount = filteredPurchases.filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + convertCurrency(p.amount, p.currency, currency), 0);
  const receivedAmount = filteredPurchases.filter(p => p.status === 'received')
    .reduce((sum, p) => sum + convertCurrency(p.amount, p.currency, currency), 0);

  const categoryData = Object.keys(purchaseCategories).map(category => ({
    name: category,
    value: filteredPurchases.filter(p => p.category === category)
      .reduce((sum, p) => sum + convertCurrency(p.amount, p.currency, currency), 0)
  })).filter(item => item.value > 0);

  const monthlyData = filteredPurchases.reduce((acc, purchase) => {
    const month = new Date(purchase.date).toLocaleDateString('fr-FR', { month: 'short' });
    const amount = convertCurrency(purchase.amount, purchase.currency, currency);
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.amount += amount;
    } else {
      acc.push({ month, amount });
    }
    return acc;
  }, [] as { month: string; amount: number }[]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur de devise */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="hidden">
            <h3 className="text-base md:text-lg font-semibold">Gestion des Achats</h3>
            <p className="text-xs md:text-sm text-gray-600">Suivi et catégorisation des dépenses d'exploitation</p>
          </div>
          <Select value={currency} onValueChange={(value) => setCurrency(value as 'XOF' | 'EUR' | 'USD' | 'MAD')}>
            <SelectTrigger className="w-full sm:w-40 text-sm md:text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map(curr => (
                <SelectItem key={curr.code} value={curr.code} className="text-sm md:text-base">
                  {curr.symbol} {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-red-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-gray-600">Total Dépenses</p>
                <p className="text-base md:text-2xl font-bold text-red-600 truncate">
                  {totalAmount.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-yellow-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-gray-600">En Attente</p>
                <p className="text-base md:text-2xl font-bold text-yellow-600 truncate">
                  {pendingAmount.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-gray-600">Reçus</p>
                <p className="text-base md:text-2xl font-bold text-green-600 truncate">
                  {receivedAmount.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <ShoppingCart className="w-6 h-6 md:w-8 md:h-8 text-blue-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-gray-600">Commandes</p>
                <p className="text-base md:text-2xl font-bold truncate">{filteredPurchases.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="overflow-x-auto">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="list" className="text-xs sm:text-sm">Liste des achats</TabsTrigger>
              <TabsTrigger value="credits" className="text-xs sm:text-sm">
                <CreditCard className="w-3 h-3 mr-1" />
                Échéances
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analyses</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={exportPurchases} className="w-full sm:w-auto text-sm">
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Exporter
            </Button>
            <Button onClick={() => setShowPurchaseForm(true)} className="w-full sm:w-auto text-sm">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Nouvel achat
            </Button>
          </div>
        </div>

        <TabsContent value="list" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
                <div>
                  <Label>Catégorie</Label>
                  <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {Object.keys(purchaseCategories).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="received">Reçu</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unité</Label>
                  <Select value={filters.unitId} onValueChange={(value) => setFilters({...filters, unitId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date début</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Date fin</Label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Fournisseur</Label>
                  <Input
                    placeholder="Nom du fournisseur"
                    value={filters.supplier}
                    onChange={(e) => setFilters({...filters, supplier: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Description..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique des achats ({filteredPurchases.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredPurchases.map((purchase) => {
                  const StatusIcon = getStatusIcon(purchase.status);
                  const currentStatus = statusOverrides[purchase.id] ?? purchase.status;
                  return (
                    <div key={purchase.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <StatusIcon className="w-4 h-4" />
                          <Badge variant="outline">{purchase.category}</Badge>
                          {purchase.subcategory && (
                            <Badge variant="secondary" className="text-xs">{purchase.subcategory}</Badge>
                          )}
                          <Badge className={getStatusColor(currentStatus)}>
                            {getStatusLabel(currentStatus)}
                          </Badge>
                          <span className="text-sm text-gray-500">{purchase.date}</span>
                        </div>
                        <h4 className="font-medium">{purchase.description}</h4>
                        <p className="text-sm text-gray-600">
                          Fournisseur: {purchase.supplier}
                          {purchase.quantity && ` • Quantité: ${purchase.quantity} ${purchase.unit}`}
                          {purchase.reference && ` • Réf: ${purchase.reference}`}
                          {purchase.unitName && ` • Unité: ${purchase.unitName}`}
                        </p>
                        {purchase.deliveryDate && currentStatus === 'pending' && (
                          <p className="text-xs text-blue-600">Livraison prévue: {purchase.deliveryDate}</p>
                        )}
                        
                        {/* Status action buttons */}
                        {currentStatus === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStatusChange(purchase.id, 'received');
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Confirmer réception
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStatusChange(purchase.id, 'cancelled');
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Annuler
                            </Button>
                          </div>
                        )}
                        
                        {currentStatus === 'received' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStatusChange(purchase.id, 'pending');
                              }}
                            >
                              <Clock className="w-4 h-4 mr-1" />
                              Remettre en attente
                            </Button>
                          </div>
                        )}
                        
                        {currentStatus === 'cancelled' && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleStatusChange(purchase.id, 'pending');
                              }}
                            >
                              <Clock className="w-4 h-4 mr-1" />
                              Réactiver
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <span className="text-lg font-bold text-red-600">
                            {convertCurrency(purchase.amount, purchase.currency, currency).toLocaleString()} {getCurrencySymbol(currency)}
                          </span>
                          {purchase.currency !== currency && (
                            <p className="text-xs text-gray-500">
                              ({purchase.amount.toLocaleString()} {getCurrencySymbol(purchase.currency)})
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedInvoicePurchase(purchase)}
                            title="Voir facture"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPurchase(purchase)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              deletePurchase(purchase.id);
                              addLog('Achat supprimé', 'Achats', `Achat supprimé: ${purchase.description}`, 'warning');
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Échéances et Crédits Fournisseurs */}
        <TabsContent value="credits" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                Achats à Crédit & Échéances Fournisseurs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {(() => {
                const creditPurchases = filteredPurchases.filter(p => p.isCredit);
                const today = new Date().toISOString().split('T')[0];
                const overduePurchases = creditPurchases.filter(p => p.dueDate && p.dueDate < today && p.status !== 'received');
                const pendingCredit = creditPurchases.filter(p => !p.dueDate || p.dueDate >= today || p.status === 'received');
                
                return (
                  <>
                    {/* Statistiques rapides */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Achats à crédit</p>
                        <p className="text-lg font-bold text-orange-600">{creditPurchases.length}</p>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Échéances dépassées</p>
                        <p className="text-lg font-bold text-red-600">{overduePurchases.length}</p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Montant dû</p>
                        <p className="text-lg font-bold text-blue-600">
                          {creditPurchases.reduce((sum, p) => sum + (p.amount - (p.paidAmount || 0)), 0).toLocaleString()} {getCurrencySymbol(currency)}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Déjà payé</p>
                        <p className="text-lg font-bold text-green-600">
                          {creditPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0).toLocaleString()} {getCurrencySymbol(currency)}
                        </p>
                      </div>
                    </div>

                    {creditPurchases.length === 0 ? (
                      <div className="p-8 text-center">
                        <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Aucun achat à crédit</p>
                        <p className="text-sm text-muted-foreground mt-2">Les achats avec "Crédit fournisseur" apparaîtront ici</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Échéances dépassées d'abord */}
                        {overduePurchases.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              Échéances dépassées
                            </h4>
                            {overduePurchases.map(purchase => (
                              <div key={purchase.id} className="border border-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div>
                                    <h5 className="font-semibold">{purchase.description}</h5>
                                    <p className="text-sm text-muted-foreground">
                                      Fournisseur: {purchase.supplier} • Échéance: {purchase.dueDate}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-red-600">
                                      {(purchase.amount - (purchase.paidAmount || 0)).toLocaleString()} {getCurrencySymbol(purchase.currency)}
                                    </p>
                                    <Badge variant="destructive">En retard</Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Autres crédits */}
                        {pendingCredit.filter(p => p.status !== 'received').map(purchase => (
                          <div key={purchase.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <h5 className="font-semibold">{purchase.description}</h5>
                                <p className="text-sm text-muted-foreground">
                                  Fournisseur: {purchase.supplier} • {purchase.dueDate ? `Échéance: ${purchase.dueDate}` : 'Sans échéance'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">
                                  {(purchase.amount - (purchase.paidAmount || 0)).toLocaleString()} {getCurrencySymbol(purchase.currency)}
                                </p>
                                <Badge variant="outline" className={getStatusColor(purchase.status)}>
                                  {getStatusLabel(purchase.status)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} ${getCurrencySymbol(currency)}`, 'Montant']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Évolution mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} ${getCurrencySymbol(currency)}`, 'Montant']} />
                    <Bar dataKey="amount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showPurchaseForm} onOpenChange={setShowPurchaseForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? 'Modifier l\'achat' : 'Nouvel achat'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Catégorie *</Label>
                <div className="space-y-2">
                  <Select
                    value={newPurchase.category}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setShowCustomCategoryInput(true);
                      } else {
                        setNewPurchase({...newPurchase, category: value, subcategory: ''});
                        setShowCustomCategoryInput(false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(purchaseCategories).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="__custom__" className="text-primary font-medium">
                        + Ajouter une catégorie personnalisée
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {showCustomCategoryInput && (
                    <div className="flex gap-2">
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nom de la catégorie"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (newCategoryName.trim()) {
                            setCustomCategories(prev => [...new Set([...prev, newCategoryName.trim()])]);
                            setNewPurchase({...newPurchase, category: newCategoryName.trim(), subcategory: ''});
                            setNewCategoryName('');
                            setShowCustomCategoryInput(false);
                          }
                        }}
                      >
                        Ajouter
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Sous-catégorie</Label>
                <div className="space-y-2">
                  <Select
                    value={newPurchase.subcategory}
                    onValueChange={(value) => {
                      if (value === '__custom__') {
                        setShowCustomSubcategoryInput(true);
                      } else {
                        setNewPurchase({...newPurchase, subcategory: value});
                        setShowCustomSubcategoryInput(false);
                      }
                    }}
                    disabled={!newPurchase.category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {newPurchase.category && purchaseCategories[newPurchase.category as keyof typeof purchaseCategories]?.map(subcat => (
                        <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
                      ))}
                      {newPurchase.category && (
                        <SelectItem value="__custom__" className="text-primary font-medium">
                          + Ajouter une sous-catégorie
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {showCustomSubcategoryInput && newPurchase.category && (
                    <div className="flex gap-2">
                      <Input
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        placeholder="Nom de la sous-catégorie"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (newSubcategoryName.trim()) {
                            setCustomSubcategories(prev => ({
                              ...prev,
                              [newPurchase.category]: [...(prev[newPurchase.category] || []), newSubcategoryName.trim()]
                            }));
                            setNewPurchase({...newPurchase, subcategory: newSubcategoryName.trim()});
                            setNewSubcategoryName('');
                            setShowCustomSubcategoryInput(false);
                          }
                        }}
                      >
                        Ajouter
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                value={newPurchase.description}
                onChange={(e) => setNewPurchase({...newPurchase, description: e.target.value})}
                placeholder="Description détaillée de l'achat"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fournisseur *</Label>
                <div className="flex gap-2">
                  <Select
                    value={newPurchase.supplier}
                    onValueChange={(value) => {
                      if (value === '__new__') {
                        setShowNewSupplierForm(true);
                      } else {
                        setNewPurchase({...newPurchase, supplier: value});
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sélectionner ou ajouter..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.name}>
                          <div className="flex items-center gap-2">
                            <span>{supplier.name}</span>
                            {supplier.category && (
                              <Badge variant="outline" className="text-xs">{supplier.category}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__" className="text-primary font-medium">
                        <div className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          Ajouter un nouveau fournisseur
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={newPurchase.supplier}
                    onChange={(e) => setNewPurchase({...newPurchase, supplier: e.target.value})}
                    placeholder="Ou saisir le nom"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Montant *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPurchase.amount}
                    onChange={(e) => setNewPurchase({...newPurchase, amount: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Devise</Label>
                  <Select
                    value={newPurchase.currency}
                    onValueChange={(value) => setNewPurchase({...newPurchase, currency: value as 'XOF' | 'EUR' | 'USD' | 'MAD'})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(curr => (
                        <SelectItem key={curr.code} value={curr.code}>
                          {curr.symbol} {curr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Quantité</Label>
                <Input
                  type="number"
                  value={newPurchase.quantity}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value) || 0;
                    // Calcul auto du montant si prix unitaire déjà défini
                    const unitPrice = newPurchase.amount && newPurchase.quantity > 0 
                      ? newPurchase.amount / newPurchase.quantity 
                      : 0;
                    setNewPurchase({
                      ...newPurchase, 
                      quantity: qty,
                      amount: unitPrice > 0 ? qty * unitPrice : newPurchase.amount
                    });
                  }}
                />
              </div>
              <div>
                <Label>Prix Unitaire</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPurchase.quantity > 0 ? (newPurchase.amount / newPurchase.quantity).toFixed(2) : '0'}
                  onChange={(e) => {
                    const unitPrice = parseFloat(e.target.value) || 0;
                    setNewPurchase({
                      ...newPurchase,
                      amount: unitPrice * (newPurchase.quantity || 1)
                    });
                  }}
                  placeholder="Prix par unité"
                />
              </div>
              <div>
                <Label>Unité</Label>
                <Input
                  value={newPurchase.unit}
                  onChange={(e) => setNewPurchase({...newPurchase, unit: e.target.value})}
                  placeholder="kg, L, unités..."
                />
              </div>
              <div>
                <Label>Mode de paiement *</Label>
                <Select
                  value={newPurchase.paymentMethod}
                  onValueChange={(value) => setNewPurchase({...newPurchase, paymentMethod: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Caisse / compte de prélèvement</Label>
                <Select
                  value={treasuryAccountId}
                  onValueChange={setTreasuryAccountId}
                  disabled={newPurchase.isCredit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={newPurchase.isCredit ? 'Aucun (achat à crédit)' : 'Choisir la caisse…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {treasury.accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.kind === 'cash' ? 'Caisse' : 'Banque'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!newPurchase.isCredit && treasury.accounts.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aucune caisse créée. Créez d'abord un compte dans Comptabilité → Trésorerie.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Référence</Label>
                <Input
                  value={newPurchase.reference}
                  onChange={(e) => setNewPurchase({...newPurchase, reference: e.target.value})}
                  placeholder="Numéro de commande"
                />
              </div>
              <div>
                <Label>Unité d'affectation</Label>
                <Select
                  value={newPurchase.unitId}
                  onValueChange={(value) => setNewPurchase({...newPurchase, unitId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date de livraison prévue</Label>
                <Input
                  type="date"
                  value={newPurchase.deliveryDate}
                  onChange={(e) => setNewPurchase({...newPurchase, deliveryDate: e.target.value})}
                />
              </div>
            </div>

            {/* Section Crédit Fournisseur */}
            <div className="border rounded-lg p-4 bg-orange-50/50 dark:bg-orange-900/10">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="isCredit"
                  checked={newPurchase.isCredit}
                  onChange={(e) => setNewPurchase({...newPurchase, isCredit: e.target.checked})}
                  className="w-4 h-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                />
                <Label htmlFor="isCredit" className="flex items-center gap-2 cursor-pointer font-medium text-orange-700 dark:text-orange-400">
                  <CreditCard className="w-4 h-4" />
                  Achat à crédit (échéance fournisseur)
                </Label>
              </div>
              
              {newPurchase.isCredit && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label className="text-sm">Date d'échéance *</Label>
                    <Input
                      type="date"
                      value={newPurchase.dueDate}
                      onChange={(e) => setNewPurchase({...newPurchase, dueDate: e.target.value})}
                      className="border-orange-200"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Conditions de paiement</Label>
                    <Select
                      value={newPurchase.paymentTerms}
                      onValueChange={(value) => setNewPurchase({...newPurchase, paymentTerms: value})}
                    >
                      <SelectTrigger className="border-orange-200">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30_jours">30 jours</SelectItem>
                        <SelectItem value="60_jours">60 jours</SelectItem>
                        <SelectItem value="90_jours">90 jours</SelectItem>
                        <SelectItem value="fin_mois">Fin de mois</SelectItem>
                        <SelectItem value="reception">À réception</SelectItem>
                        <SelectItem value="personnalise">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={newPurchase.notes}
                onChange={(e) => setNewPurchase({...newPurchase, notes: e.target.value})}
                placeholder="Notes complémentaires..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={editingPurchase ? handleUpdatePurchase : handleAddPurchase}>
                {editingPurchase ? 'Modifier' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de facture */}
      {selectedInvoicePurchase && (
        <PurchaseInvoice
          purchase={selectedInvoicePurchase}
          isOpen={!!selectedInvoicePurchase}
          onClose={() => setSelectedInvoicePurchase(null)}
        />
      )}

      {/* Dialog Nouveau Fournisseur */}
      <Dialog open={showNewSupplierForm} onOpenChange={setShowNewSupplierForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom du fournisseur *</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Nom du fournisseur"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Le fournisseur sera ajouté au module Fournisseurs. Vous pourrez compléter ses informations (contact, adresse, etc.) depuis ce module.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowNewSupplierForm(false);
                setNewSupplierName('');
              }}>
                Annuler
              </Button>
              <Button onClick={async () => {
                if (!newSupplierName.trim()) {
                  toast({ title: "Erreur", description: "Veuillez saisir un nom", variant: "destructive" });
                  return;
                }
                const result = await addSupplier({
                  name: newSupplierName.trim(),
                  contact: '',
                  email: '',
                  phone: '',
                  address: '',
                  status: 'pending',
                  category: newPurchase.category || '',
                  products: [],
                  rating: 5,
                  notes: 'Ajouté depuis le module Achats',
                  unitId: activeUnit?.id || ''
                });
                if (result) {
                  setNewPurchase({...newPurchase, supplier: newSupplierName.trim()});
                  toast({ title: "Fournisseur ajouté", description: "Complétez ses informations dans le module Fournisseurs" });
                  refetchSuppliers();
                }
                setShowNewSupplierForm(false);
                setNewSupplierName('');
              }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseManager;
