
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, TrendingUp, Users, FileText, Download, Calendar, DollarSign, Eye, CreditCard, Pencil, Trash2, AlertTriangle, ScanLine, Tag, Store, Zap } from 'lucide-react';
import { useLogs } from '@/contexts/LogsContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import ProductionUnitSelector from './ProductionUnitSelector';
import ReceiptPreview, { ReceiptData } from './economics/ReceiptPreview';
import BarcodeScanner from './sales/BarcodeScanner';
import CashRegisterPOS, { type PosView } from './sales/CashRegisterPOS';

const POS_TABS = ['registers', 'pos', 'multi', 'ai'];
import CashClosures from './sales/CashClosures';
import SalesDashboard, { CancelledSales } from './sales/SalesDashboard';
import { useSales, Sale, SaleItem } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/notificationService';
import { supabase } from '@/integrations/supabase/appClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { getCompanyDocumentFields, isSaleSettled } from '@/lib/salesDocumentUtils';
import { SalesDocumentType, generateNextDocumentNumber, getDefaultLegalMentions, validateSalesDocumentDraft } from '@/lib/salesDocumentHelpers';
import { getUnitTerms } from '@/lib/unitContext';


interface SaleFormState {
  clientName: string;
  clientContact: string;
  unitId: string;
  products: Array<{ name: string; quantity: number; unitPrice: number }>;
  paymentMethod: string;
  notes: string;
  isCredit: boolean;
  dueDate: string;
  paymentTerms: string;
  documentType: SalesDocumentType;
  taxRate: number;
  legalMentions: string;
}

const createEmptySale = (unitId = '', documentType: SalesDocumentType = 'receipt'): SaleFormState => ({
  clientName: '',
  clientContact: '',
  unitId,
  products: [{ name: '', quantity: 0, unitPrice: 0 }],
  paymentMethod: 'Espèces',
  notes: '',
  isCredit: false,
  dueDate: '',
  paymentTerms: '',
  documentType,
  taxRate: documentType === 'receipt' ? 0 : 20,
  legalMentions: getDefaultLegalMentions(documentType),
});

const SalesManagement = () => {
  const { addLog } = useLogs();
  const { units, activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);

  const { formatCurrency, t, currency, companyInfo } = useSettings();
  const { toast } = useToast();
  const { sales, loading, addSale, updateSale, cancelSale } = useSales();
  
  const [salesTab, setSalesTab] = useState('pos');
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewReceiptData, setPreviewReceiptData] = useState<ReceiptData | null>(null);
  const [viewingSaleReceipt, setViewingSaleReceipt] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [pdfInitialAction, setPdfInitialAction] = useState<'download' | 'print' | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [newSale, setNewSale] = useState<SaleFormState>(createEmptySale(activeUnit?.id || ''));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Synchroniser la vente avec l'unité active
  useEffect(() => {
    if (!activeUnit?.id) return;
    setNewSale((prev) => ({ ...prev, unitId: activeUnit.id }));
  }, [activeUnit?.id]);

  // Les données affichées sont déjà filtrées par unité dans le hook
  const filteredSales = sales;

  // Une vente est "effectuée" si c'est un reçu (paiement direct) ou
  // une facture/proforma déjà soldée. Les factures en attente ne comptent
  // pas dans le chiffre d'affaires tant qu'elles ne sont pas payées.
  const settledSales = useMemo(
    () =>
      filteredSales.filter((s) => {
        if (s.status === 'cancelled') return false;
        const type = s.documentType ?? 'receipt';
        if (type === 'receipt') return true;
        return s.status === 'paid';
      }),
    [filteredSales]
  );

  // Calcul des stats basées sur les ventes effectivement réalisées
  const salesData = useMemo(() => {
    const totalRevenue = settledSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalOrders = settledSales.length;
    const totalClients = [...new Set(settledSales.map((s) => s.clientName))].length;
    const avgOrderValue = settledSales.length > 0 ? totalRevenue / settledSales.length : 0;
    
    // Calculer les produits les plus vendus à partir des vraies données
    const productsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    settledSales.forEach(sale => {
      sale.products.forEach(product => {
        const existing = productsMap.get(product.name);
        if (existing) {
          existing.quantity += product.quantity;
          existing.revenue += product.total;
        } else {
          productsMap.set(product.name, {
            name: product.name,
            quantity: product.quantity,
            revenue: product.total
          });
        }
      });
    });
    
    const topProducts = Array.from(productsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Calculer les ventes par unité à partir des vraies données
    const salesByUnit = units.map(unit => {
      const unitSales = settledSales.filter(s => s.unitId === unit.id);
      const unitRevenue = unitSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
      return {
        id: unit.id,
        name: unit.name,
        type: unit.type,
        revenue: unitRevenue,
        salesCount: unitSales.length
      };
    }).filter(u => u.salesCount > 0);

    return {
      totalRevenue,
      totalOrders,
      totalClients,
      avgOrderValue,
      monthlyGrowth: 0,
      topProducts,
      salesByUnit
    };
  }, [settledSales, units]);

  const buildReceiptData = (baseData: Omit<ReceiptData, 'companyName' | 'companyAddress' | 'companyContact'>): ReceiptData => ({
    ...baseData,
    ...getCompanyDocumentFields(companyInfo),
  });

  const isBillingDocument = (type: SalesDocumentType) => type === 'invoice' || type === 'proforma';

  const applyDocumentType = (type: SalesDocumentType) => {
    setValidationErrors([]);
    setNewSale((prev) => ({
      ...prev,
      documentType: type,
      taxRate: type === 'receipt' ? 0 : prev.taxRate || 20,
      legalMentions:
        prev.legalMentions.trim().length > 0 && prev.documentType === type
          ? prev.legalMentions
          : getDefaultLegalMentions(type),
      notes: prev.notes,
    }));
  };

  const auditDocumentAction = async (action: string, details: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    await addLog(action, 'Vente', details, severity);
  };

  const validateCurrentDraft = () => {
    const result = validateSalesDocumentDraft(newSale);
    setValidationErrors(result.errors);
    if (!result.valid) {
      toast({ title: 'Champs obligatoires manquants', description: result.errors[0], variant: 'destructive' });
    }
    return result.valid;
  };

  const handlePreviewReceipt = () => {
    if (!validateCurrentDraft()) return;

    const subtotal = newSale.products.reduce((sum, product) => sum + (product.quantity * product.unitPrice), 0);
    const taxRate = isBillingDocument(newSale.documentType) ? (newSale.taxRate || 0) : 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    const documentNumber = generateNextDocumentNumber(sales, newSale.documentType);

    const receiptData = buildReceiptData({
      type: newSale.documentType,
      number: documentNumber,
      date: new Date().toISOString(),
      dueDate: isBillingDocument(newSale.documentType) ? (newSale.dueDate || undefined) : undefined,
      clientName: newSale.clientName,
      clientContact: newSale.clientContact,
      items: newSale.products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        total: product.quantity * product.unitPrice
      })),
      subtotal,
      tax,
      taxRate,
      total,
      paymentMethod: newSale.paymentMethod,
      notes: newSale.legalMentions || newSale.notes,
      isPaid: isBillingDocument(newSale.documentType) ? false : !newSale.isCredit,
    });

    setPreviewReceiptData(receiptData);
    setViewingSaleReceipt(null);
    setPdfInitialAction(null);
    setShowReceiptPreview(true);
  };

  const handleConfirmSale = async () => {
    if (isSavingSale) return;
    if (!validateCurrentDraft()) return;

    setIsSavingSale(true);
    const totalAmount = newSale.products.reduce((sum, product) => sum + (product.quantity * product.unitPrice), 0);
    const taxRate = isBillingDocument(newSale.documentType) ? (newSale.taxRate || 0) : 0;
    const previewDocumentNumber = previewReceiptData?.number || generateNextDocumentNumber(sales, newSale.documentType);
    const finalAmount = totalAmount + totalAmount * (taxRate / 100);
    const isBilling = isBillingDocument(newSale.documentType);
    const clientRequestId = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const result = await addSale({
        clientRequestId,
        date: new Date().toISOString().split('T')[0],
        clientName: newSale.clientName,
        clientContact: newSale.clientContact,
        unitId: newSale.unitId,
        products: newSale.products.map(p => ({
          ...p,
          total: p.quantity * p.unitPrice
        })),
        totalAmount: finalAmount,
        // Les factures / proformas restent toujours en attente jusqu'à
        // ce qu'elles soient marquées comme payées manuellement.
        status: isBilling
          ? 'pending'
          : (newSale.isCredit ? 'confirmed' : 'paid'),
        paymentMethod: newSale.paymentMethod,
        notes: newSale.legalMentions || newSale.notes,
        isCredit: newSale.isCredit,
        dueDate: isBilling ? (newSale.dueDate || undefined) : undefined,
        paymentTerms: newSale.paymentTerms || undefined,
        paidAmount: isBilling
          ? 0
          : (newSale.isCredit ? 0 : finalAmount),
        documentType: newSale.documentType,
        documentNumber: previewDocumentNumber,
        taxRate,
      });

      if (result) {
        const savedDocumentNumber = result.documentNumber || previewDocumentNumber;
        const label = newSale.documentType === 'invoice' ? 'Facture' : newSale.documentType === 'proforma' ? 'Proforma' : 'Reçu';
        await auditDocumentAction(`${label} créé`, `${savedDocumentNumber} créé pour ${newSale.clientName}`, 'success');
        toast({ title: `${label} enregistré`, description: `${savedDocumentNumber} créé avec succès` });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await createNotification({
            userId: user.id,
            title: `${label} créé`,
            message: `${savedDocumentNumber} pour ${newSale.clientName} - ${formatCurrency(finalAmount)}`,
            type: 'success',
            module: 'Ventes',
            isCritical: false,
            metadata: {
              clientName: newSale.clientName,
              totalAmount: finalAmount,
              paymentMethod: newSale.paymentMethod,
              documentNumber: savedDocumentNumber,
              documentType: newSale.documentType,
            }
          });
        }

        setNewSale(createEmptySale(activeUnit?.id || ''));
        setValidationErrors([]);
        setShowSaleDialog(false);
        setShowReceiptPreview(false);
      } else {
        toast({ title: 'Vente non enregistrée', description: 'Réessayez dans un instant.', variant: 'destructive' });
      }
    } finally {
      setIsSavingSale(false);
    }
  };

  const addProduct = () => {
    setNewSale(prev => ({
      ...prev,
      products: [...prev.products, { name: '', quantity: 0, unitPrice: 0 }]
    }));
  };

  // Add or increment a product from a scanned code. Tries to find an existing
  // entry matching the catalog (top products), otherwise inserts a new line.
  const handleScannedCode = (code: string) => {
    const trimmed = (code || '').trim();
    if (!trimmed) return;
    setShowSaleDialog(true);
    const catalogMatch = salesData.topProducts.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const productName = catalogMatch?.name || trimmed;
    const lastUnitPrice = catalogMatch ? Math.round(catalogMatch.revenue / Math.max(1, catalogMatch.quantity)) : 0;
    setNewSale((prev) => {
      const idx = prev.products.findIndex((p) => p.name.toLowerCase() === productName.toLowerCase());
      if (idx >= 0) {
        const products = prev.products.map((p, i) => (i === idx ? { ...p, quantity: (p.quantity || 0) + 1 } : p));
        return { ...prev, products };
      }
      // remove empty leading row if present
      const base = prev.products.length === 1 && !prev.products[0].name ? [] : prev.products;
      return {
        ...prev,
        products: [...base, { name: productName, quantity: 1, unitPrice: lastUnitPrice }],
      };
    });
    toast({ title: 'Produit scanné', description: productName });
  };

  const updateProduct = (index: number, field: string, value: any) => {
    setNewSale(prev => ({
      ...prev,
      products: prev.products.map((product, i) => 
        i === index ? { ...product, [field]: value } : product
      )
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'cancelled': return 'Annulée';
      case 'pending': return t('status_pending');
      case 'confirmed': return t('status_confirmed');
      case 'delivered': return t('status_delivered');
      case 'paid': return t('status_paid');
      default: return status;
    }
  };

  const handleStatusChange = async (saleId: string, newStatus: string) => {
    const sale = sales.find(s => s.id === saleId);
    await updateSale(saleId, {
      status: newStatus as 'pending' | 'confirmed' | 'delivered' | 'paid',
      paidAmount: sale && newStatus === 'paid' ? sale.totalAmount : sale?.paidAmount,
    });
    if (sale) {
      addLog('Statut vente modifié', 'Vente', `${sale.clientName} - Statut: ${getStatusText(newStatus)}`, 'info');
      toast({ title: "Statut modifié", description: `Vente passée à "${getStatusText(newStatus)}"` });
    }
  };

  // Generate receipt data for a sale
  const generateSaleReceipt = (sale: Sale): ReceiptData => {
    const stored = (sale.documentType ?? 'receipt') === 'receipt' && sale.documentNumber
      ? sale.documentNumber
      : `REC-${sale.date.split('-').join('')}-${sale.id.slice(0, 6).toUpperCase()}`;
    return buildReceiptData({
      id: sale.id,
      type: 'receipt',
      number: stored,
      date: sale.date,
      clientName: sale.clientName,
      clientContact: sale.clientContact || undefined,
      items: sale.products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        total: product.total
      })),
      subtotal: sale.totalAmount,
      tax: 0,
      taxRate: 0,
      total: sale.totalAmount,
      paymentMethod: sale.paymentMethod || undefined,
      notes: sale.notes || undefined,
      isPaid: isSaleSettled(sale),
    });
  };

  const handleViewSaleReceipt = (sale: Sale, action: 'download' | 'print' | null = null) => {
    const receiptData = generateSaleReceipt(sale);
    setPreviewReceiptData(receiptData);
    setViewingSaleReceipt(sale);
    setPdfInitialAction(action);
    setShowReceiptPreview(true);
  };

  // Génère une vraie facture (différente du reçu) : numérotation FAC-, TVA détaillée, échéance, mentions légales
  const generateSaleInvoice = (sale: Sale): ReceiptData => {
    const taxRate = sale.taxRate ?? 20;
    const subtotal = taxRate > 0
      ? +(sale.totalAmount / (1 + taxRate / 100)).toFixed(2)
      : sale.totalAmount;
    const tax = +(sale.totalAmount - subtotal).toFixed(2);
    const stored = (sale.documentType === 'invoice' || sale.documentType === 'proforma') && sale.documentNumber
      ? sale.documentNumber
      : `${sale.documentType === 'proforma' ? 'PRO' : 'FAC'}-${sale.date.split('-').join('')}-${sale.id.slice(0, 6).toUpperCase()}`;
    return buildReceiptData({
      id: sale.id,
      type: (sale.documentType === 'proforma' ? 'proforma' : 'invoice'),
      number: stored,
      date: sale.date,
      dueDate: sale.dueDate || undefined,
      clientName: sale.clientName,
      clientContact: sale.clientContact || undefined,
      items: sale.products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        total: product.total,
      })),
      subtotal,
      tax,
      taxRate,
      total: sale.totalAmount,
      paymentMethod: sale.paymentMethod || undefined,
      notes: sale.notes || 'Paiement à réception sauf accord écrit. Tout retard de paiement entraînera l\'application de pénalités au taux légal en vigueur.',
      isPaid: isSaleSettled(sale),
    });
  };

  const handleViewSaleInvoice = (sale: Sale, action: 'download' | 'print' | null = null) => {
    const invoiceData = generateSaleInvoice(sale);
    setPreviewReceiptData(invoiceData);
    setViewingSaleReceipt(sale);
    setPdfInitialAction(action);
    setShowReceiptPreview(true);
  };

  const handleEditSale = (sale: Sale) => {
    setEditingSale({ ...sale });
    setShowEditDialog(true);
  };

  const handleSaveEditSale = async () => {
    if (!editingSale) return;
    const totalAmount = editingSale.products.reduce((sum, p) => sum + p.total, 0);
    const result = await updateSale(editingSale.id, {
      clientName: editingSale.clientName,
      clientContact: editingSale.clientContact,
      paymentMethod: editingSale.paymentMethod,
      notes: editingSale.notes,
      totalAmount,
      products: editingSale.products,
      isCredit: editingSale.isCredit,
      dueDate: editingSale.dueDate,
      paymentTerms: editingSale.paymentTerms,
    });
    if (result) {
      await auditDocumentAction('Document modifié', `${editingSale.documentNumber || editingSale.id} modifié`, 'info');
      toast({ title: "Vente modifiée", description: "Les modifications ont été enregistrées" });
      setShowEditDialog(false);
      setEditingSale(null);
    } else {
      toast({ title: "Erreur", description: "Impossible de modifier la vente", variant: "destructive" });
    }
  };

  const handleCancelSale = async () => {
    if (!cancellingSale || isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelSale(cancellingSale.id, cancellationReason);
      await auditDocumentAction('Vente annulée', `${cancellingSale.documentNumber || cancellingSale.id} : ${cancellationReason}`, 'warning');
      toast({ title: 'Vente annulée', description: 'La vente est conservée et ses écritures sont contrepassées.' });
      setCancellingSale(null);
    } catch (e: any) { toast({ title: 'Annulation non enregistrée', description: e.message, variant: 'destructive' }); }
    finally { setIsCancelling(false); }
  };

  const getCurrencySymbol = () => {
    switch (currency) {
      case 'XOF': return 'F CFA';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return currency;
    }
  };

  const generateSalesReport = () => {
    const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const reportData = {
      period: currentMonth,
      revenue: salesData.totalRevenue,
      orders: salesData.totalOrders,
      clients: salesData.totalClients,
      products: salesData.topProducts,
      units: salesData.salesByUnit
    };

    const currencySymbol = currency === 'XOF' ? 'CFA' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    
    const csvContent = [
      ['Rapport de Ventes - ' + reportData.period],
      [''],
      ['Résumé Global'],
      ['Chiffre d\'affaires total', reportData.revenue + ' ' + currencySymbol],
      ['Nombre de commandes', reportData.orders],
      ['Nombre de clients', reportData.clients],
      [''],
      ['Produits les plus vendus'],
      ['Produit', 'Quantité', 'Chiffre d\'affaires'],
      ...reportData.products.map(p => [p.name, p.quantity, p.revenue + ' ' + currencySymbol]),
      [''],
      ['Ventes par unité'],
      ['Unité', 'Type', 'Chiffre d\'affaires'],
      ...reportData.units.map(u => [u.name, u.type, u.revenue + ' ' + currencySymbol])
    ].map(row => Array.isArray(row) ? row.join(',') : row).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_ventes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addLog('Export rapport', 'Vente', 'Rapport de ventes exporté en CSV', 'info');
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!cancellingSale} onOpenChange={v => { if (!v && !isCancelling) setCancellingSale(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Annuler la vente · {cancellingSale?.clientName}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{cancellingSale ? formatCurrency(cancellingSale.totalAmount) : ''} · La vente et ses écritures initiales restent dans l’historique. Les encaissements de caisse liés seront remboursés.</p>
          <Label htmlFor="cancellation-reason">Motif de l’annulation</Label><Textarea id="cancellation-reason" value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} />
          <Button variant="destructive" disabled={isCancelling || !cancellationReason.trim()} onClick={handleCancelSale}>{isCancelling ? 'Enregistrement…' : 'Confirmer l’annulation'}</Button>
        </DialogContent>
      </Dialog>
      {/* En-tête */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-white">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">Ventes &amp; Caisse</h2>
            </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-sm sm:text-base"
                  onClick={() => {
                    applyDocumentType('receipt');
                    setShowSaleDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span>Nouvelle vente</span>
                </Button>
              </div>
              <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">
                    {isBillingDocument(newSale.documentType) ? 'Créer une facture / proforma' : 'Créer un reçu (REC-)'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 sm:space-y-4">
                  {/* Type de document : Reçu ou Facture */}
                  <div className="p-3 border rounded-lg bg-primary/5 space-y-3">
                    <Label className="text-sm font-semibold">Type de document à générer</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => applyDocumentType('receipt')}
                        className={`p-3 rounded-md border-2 transition-all text-left ${
                          newSale.documentType === 'receipt'
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Reçu (REC-)
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Justificatif de paiement simple, non-contractuel.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDocumentType('invoice')}
                        className={`p-3 rounded-md border-2 transition-all text-left ${
                           newSale.documentType === 'invoice'
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-background hover:bg-muted/40'
                        }`}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Facture (FAC-)
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Document légal avec TVA et mentions obligatoires.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyDocumentType('proforma')}
                        className={`p-3 rounded-md border-2 transition-all text-left ${
                          newSale.documentType === "proforma"
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:bg-muted/40"
                        }`}
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Proforma (PRO-)
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Devis / Facture proforma pour devis client.</p>
                      </button>
                    </div>
                    {isBillingDocument(newSale.documentType) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-primary/20">
                        <div>
                          <Label className="text-sm">Taux de TVA</Label>
                          <Select
                            value={String(newSale.taxRate)}
                            onValueChange={(v) => setNewSale(prev => ({ ...prev, taxRate: parseFloat(v) || 0 }))}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0 % (exonéré)</SelectItem>
                              <SelectItem value="10">10 %</SelectItem>
                              <SelectItem value="18">18 %</SelectItem>
                              <SelectItem value="20">20 %</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm">Date d'échéance</Label>
                          <Input
                            type="date"
                            value={newSale.dueDate}
                            onChange={(e) => setNewSale(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label>Nom du client</Label>
                      <Input 
                        value={newSale.clientName}
                        onChange={(e) => setNewSale(prev => ({ ...prev, clientName: e.target.value }))}
                        placeholder="Nom du client"
                      />
                    </div>
                    <div>
                      <Label>Contact</Label>
                      <Input 
                        value={newSale.clientContact}
                        onChange={(e) => setNewSale(prev => ({ ...prev, clientContact: e.target.value }))}
                        placeholder="Téléphone ou email"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Unité de production</Label>
                    <Select value={newSale.unitId} onValueChange={(value) => setNewSale(prev => ({ ...prev, unitId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une unité" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} - {unit.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm sm:text-base">Produits</Label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowScanner(true)} className="text-xs sm:text-sm">
                          <ScanLine className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          Scanner
                        </Button>
                        <Button size="sm" variant="outline" onClick={addProduct} className="text-xs sm:text-sm">
                          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      {newSale.products.map((product, index) => (
                        <div key={index} className="flex flex-col gap-2 p-2 sm:p-3 border rounded">
                          <Input 
                            placeholder={unitTerms.salesProductOptions[0] || 'Produit'}
                            list="unit-sale-products"
                            value={product.name}
                            onChange={(e) => updateProduct(index, 'name', e.target.value)}
                            className="text-sm sm:text-base"
                          />
                          <datalist id="unit-sale-products">
                            {unitTerms.salesProductOptions.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <Input 
                              type="number"
                              placeholder="Quantité"
                              value={product.quantity || ''}
                              onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="text-sm sm:text-base"
                            />
                            <Input 
                              type="number"
                              step="0.01"
                              placeholder="Prix unitaire"
                              value={product.unitPrice || ''}
                              onChange={(e) => updateProduct(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="text-sm sm:text-base"
                            />
                          </div>
                          <div className="flex items-center justify-end">
                            <span className="text-sm sm:text-base font-medium">
                              Total: {formatCurrency(product.quantity * product.unitPrice)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-right mt-2 sm:mt-3 p-2 bg-muted rounded">
                      <span className="text-base sm:text-lg font-bold">
                        Total: {formatCurrency(newSale.products.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0))}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-sm sm:text-base">Mode de paiement</Label>
                      <Select value={newSale.paymentMethod} onValueChange={(value) => setNewSale(prev => ({ ...prev, paymentMethod: value }))}>
                        <SelectTrigger className="text-sm sm:text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Espèces" className="text-sm sm:text-base">Espèces</SelectItem>
                          <SelectItem value="Mobile Money" className="text-sm sm:text-base">Mobile Money</SelectItem>
                          <SelectItem value="Virement" className="text-sm sm:text-base">Virement</SelectItem>
                          <SelectItem value="Carte" className="text-sm sm:text-base">Carte bancaire</SelectItem>
                          <SelectItem value="Chèque" className="text-sm sm:text-base">Chèque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm sm:text-base">Notes</Label>
                      <Textarea
                        value={newSale.notes}
                        onChange={(e) => setNewSale(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Notes additionnelles"
                        className="text-sm sm:text-base min-h-[88px]"
                      />
                    </div>
                  </div>

                  {isBillingDocument(newSale.documentType) && (
                    <div>
                      <Label className="text-sm sm:text-base">Mentions légales</Label>
                      <Textarea
                        value={newSale.legalMentions}
                        onChange={(e) => setNewSale((prev) => ({ ...prev, legalMentions: e.target.value }))}
                        placeholder="Mentions légales obligatoires"
                        className="text-sm sm:text-base min-h-[96px]"
                      />
                    </div>
                  )}

                  {/* Section Crédit et Échéance */}
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        id="isCredit"
                        checked={newSale.isCredit}
                        onChange={(e) => setNewSale(prev => ({ ...prev, isCredit: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="isCredit" className="flex items-center gap-2 cursor-pointer">
                        <CreditCard className="w-4 h-4 text-orange-600" />
                        Vente à crédit
                      </Label>
                    </div>
                    
                    {newSale.isCredit && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-sm">Date d'échéance</Label>
                          <Input 
                            type="date"
                            value={newSale.dueDate}
                            onChange={(e) => setNewSale(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Conditions de paiement</Label>
                          <Select value={newSale.paymentTerms} onValueChange={(value) => setNewSale(prev => ({ ...prev, paymentTerms: value }))}>
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="net_7">Net 7 jours</SelectItem>
                              <SelectItem value="net_15">Net 15 jours</SelectItem>
                              <SelectItem value="net_30">Net 30 jours</SelectItem>
                              <SelectItem value="net_60">Net 60 jours</SelectItem>
                              <SelectItem value="net_90">Net 90 jours</SelectItem>
                              <SelectItem value="custom">Personnalisé</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {validationErrors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Champs obligatoires</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-5 space-y-1">
                          {validationErrors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={handlePreviewReceipt} 
                      className="flex-1"
                      disabled={!newSale.clientName || newSale.products.some(p => !p.name || p.quantity <= 0 || p.unitPrice <= 0)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {newSale.documentType === 'proforma' ? 'Prévisualiser la proforma' : isBillingDocument(newSale.documentType) ? 'Prévisualiser la facture' : 'Prévisualiser le reçu'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 w-full sm:w-auto text-sm sm:text-base" onClick={generateSalesReport}>
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Rapport</span>
            </Button>
          </div>
          </div>
          <ProductionUnitSelector />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-base sm:text-2xl font-bold truncate">{formatCurrency(salesData.totalRevenue)}</p>
                <p className="text-xs sm:text-sm text-gray-600">Chiffre d'affaires</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-base sm:text-2xl font-bold truncate">{salesData.totalOrders}</p>
                <p className="text-xs sm:text-sm text-gray-600">Commandes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-base sm:text-2xl font-bold truncate">{salesData.totalClients}</p>
                <p className="text-xs sm:text-sm text-gray-600">Clients actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-base sm:text-2xl font-bold truncate">{formatCurrency(salesData.avgOrderValue)}</p>
                <p className="text-xs sm:text-sm text-gray-600">Panier moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs pour les différentes fonctionnalités */}
      <Tabs value={salesTab} onValueChange={setSalesTab} className="space-y-3 sm:space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-full sm:w-auto min-w-full bg-muted rounded-xl">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Tableau de bord
            </TabsTrigger>
            {([['registers', 'Gestion des caisses', Store], ['pos', 'Caisse', CreditCard], ['multi', 'Multi-caisses', Users], ['ai', 'Vente IA', Zap]] as const).map(([v, label, Icon]) => (
              <TabsTrigger key={v} value={v} className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
                <Icon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                {label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="history" className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="overview" className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Analyses
            </TabsTrigger>
            <TabsTrigger value="credits" className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Échéances</span>
              <span className="sm:hidden">Éch.</span>
            </TabsTrigger>
            <TabsTrigger value="closures" className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Clôtures
            </TabsTrigger>
            <TabsTrigger value="returns" className="text-xs sm:text-sm flex-1 sm:flex-none px-3 sm:px-4 whitespace-nowrap">
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Annulations
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-3 sm:space-y-4">
          <SalesDashboard sales={filteredSales} />
        </TabsContent>

        <TabsContent value="returns" className="space-y-3 sm:space-y-4">
          <CancelledSales sales={filteredSales} />
        </TabsContent>

        {POS_TABS.includes(salesTab) && (
          <CashRegisterPOS view={salesTab === 'pos' ? 'checkout' : salesTab as PosView} onNavigate={(v) => setSalesTab(v === 'checkout' ? 'pos' : v)} />
        )}

        <TabsContent value="closures" className="space-y-3 sm:space-y-4">
          <CashClosures />
        </TabsContent>

        <TabsContent value="history" className="space-y-3 sm:space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                Historique Détaillé des Ventes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {filteredSales.length === 0 ? (
                <div className="p-8 text-center">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune vente enregistrée</p>
                  <p className="text-sm text-muted-foreground mt-2">Cliquez sur "Nouvelle Vente" pour enregistrer votre première vente</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filteredSales.map(sale => (
                    <div key={sale.id} className="border rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base truncate">{sale.clientName}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {new Date(sale.date).toLocaleDateString('fr-FR')} - {sale.clientContact}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap sm:flex-col sm:items-end">
                          <div className="relative z-50">
                            <Select
                              disabled={sale.status === 'cancelled'}
                              value={sale.status}
                              onValueChange={(value) => handleStatusChange(sale.id, value)}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                                {sale.status === 'cancelled' && <SelectItem value="cancelled">Annulée</SelectItem>}
                                <SelectItem value="pending">En attente</SelectItem>
                                <SelectItem value="confirmed">Confirmée</SelectItem>
                                <SelectItem value="delivered">Livrée</SelectItem>
                                <SelectItem value="paid">Payée</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-base sm:text-lg font-bold text-green-600">
                            {formatCurrency(sale.totalAmount)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-muted rounded p-2 sm:p-3 mb-3">
                        <p className="text-xs sm:text-sm font-medium mb-2">Produits vendus:</p>
                        {sale.products.map((product, idx) => (
                          <div key={idx} className="flex justify-between text-xs sm:text-sm gap-2">
                            <span className="truncate">{product.name} x {product.quantity}</span>
                            <span className="flex-shrink-0 font-medium">{formatCurrency(product.total)}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Unité:</span>
                          <Badge variant="outline" className="text-xs">
                            {units.find(u => u.id === sale.unitId)?.name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Paiement:</span>
                          <span className="font-medium">{sale.paymentMethod}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Statut:</span>
                          <Badge className={getStatusColor(sale.status)}>
                            {getStatusText(sale.status)}
                          </Badge>
                        </div>
                      </div>
                      
                      {sale.cancellationReason && <p className="mt-3 text-sm text-destructive">Annulée le {sale.cancelledAt?.slice(0, 10)} · {sale.cancellationReason}</p>}
                      {sale.notes && (
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs sm:text-sm">
                          <strong>Notes:</strong> {sale.notes}
                        </div>
                      )}
                      
                      {/* Receipt actions */}
                      <div className="mt-3 pt-3 border-t flex gap-2 justify-end flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sale.status === 'cancelled'}
                          onClick={() => handleEditSale(sale)}
                          className="text-xs"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSaleReceipt(sale)}
                          className="text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Voir Reçu
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSaleInvoice(sale)}
                          className="text-xs border-primary text-primary hover:bg-primary/10"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Facture
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if ((sale.documentType ?? 'receipt') === 'invoice') {
                              handleViewSaleInvoice(sale, 'download');
                            } else {
                              handleViewSaleReceipt(sale, 'download');
                            }
                          }}
                          className="text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                          title="Télécharger le PDF"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sale.status === 'cancelled'}
                          onClick={() => { setCancellationReason(''); setCancellingSale(sale); }}
                          className="text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Annuler la vente
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Produits les plus vendus
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesData.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {salesData.topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{product.quantity} unités vendues</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(product.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Aucune vente enregistrée</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  Ventes par unité
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesData.salesByUnit.length > 0 ? (
                  <div className="space-y-3">
                    {salesData.salesByUnit.map((unit) => (
                      <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <p className="font-medium">{unit.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {unit.type} • {unit.salesCount} ventes
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">
                            {formatCurrency(unit.revenue)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Aucune vente par unité</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Catalogue de Produits Vendus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesData.topProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {salesData.topProducts.map((product, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="space-y-2">
                        <h4 className="font-semibold">{product.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Vendus: {product.quantity} unités</p>
                        <div className="flex items-center justify-between">
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            {product.quantity > 0 ? formatCurrency(product.revenue / product.quantity) : '0'} {getCurrencySymbol()}/unité
                          </Badge>
                          <span className="font-bold text-green-600">{formatCurrency(product.revenue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucun produit vendu</p>
                  <p className="text-sm text-muted-foreground mt-2">Enregistrez des ventes pour voir les produits ici</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Échéances et Crédits */}
        <TabsContent value="credits" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                Ventes à Crédit & Échéances
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {(() => {
                const creditSales = filteredSales.filter(s => s.isCredit && s.status !== 'cancelled');
                const today = new Date().toISOString().split('T')[0];
                const overdueSales = creditSales.filter(s => s.dueDate && s.dueDate < today && s.status !== 'paid');
                const pendingSales = creditSales.filter(s => !s.dueDate || s.dueDate >= today || s.status === 'paid');
                
                return (
                  <>
                    {/* Statistiques rapides */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Total crédits</p>
                        <p className="text-lg font-bold text-orange-600">{creditSales.length}</p>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">En retard</p>
                        <p className="text-lg font-bold text-red-600">{overdueSales.length}</p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Montant dû</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(creditSales.reduce((sum, s) => sum + (s.totalAmount - (s.paidAmount || 0)), 0))}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs text-muted-foreground">Encaissé</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(creditSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0))}
                        </p>
                      </div>
                    </div>

                    {creditSales.length === 0 ? (
                      <div className="p-8 text-center">
                        <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Aucune vente à crédit</p>
                        <p className="text-sm text-muted-foreground mt-2">Les ventes marquées "à crédit" apparaîtront ici</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* En retard d'abord */}
                        {overdueSales.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              En retard de paiement
                            </h4>
                            {overdueSales.map(sale => (
                              <div key={sale.id} className="border border-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div>
                                    <h5 className="font-semibold">{sale.clientName}</h5>
                                    <p className="text-sm text-muted-foreground">
                                      Échéance: {sale.dueDate} • Vente du {sale.date}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-red-600">{formatCurrency(sale.totalAmount - (sale.paidAmount || 0))}</p>
                                    <Badge variant="destructive">En retard</Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Autres crédits */}
                        {pendingSales.filter(s => s.status !== 'paid').map(sale => (
                          <div key={sale.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <h5 className="font-semibold">{sale.clientName}</h5>
                                <p className="text-sm text-muted-foreground">
                                  {sale.dueDate ? `Échéance: ${sale.dueDate}` : 'Sans échéance'} • Vente du {sale.date}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">{formatCurrency(sale.totalAmount - (sale.paidAmount || 0))}</p>
                                <Badge variant="outline" className={getStatusColor(sale.status)}>
                                  {getStatusText(sale.status)}
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

      </Tabs>

      {/* Edit Sale Dialog */}
      {editingSale && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Modifier la vente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label>Nom du client</Label>
                  <Input
                    value={editingSale.clientName}
                    onChange={(e) => setEditingSale({ ...editingSale, clientName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact</Label>
                  <Input
                    value={editingSale.clientContact}
                    onChange={(e) => setEditingSale({ ...editingSale, clientContact: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Produits</Label>
                  <Button size="sm" variant="outline" onClick={() => setEditingSale({
                    ...editingSale,
                    products: [...editingSale.products, { name: '', quantity: 0, unitPrice: 0, total: 0 }]
                  })}>
                    <Plus className="w-3 h-3 mr-1" /> Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingSale.products.map((product, index) => (
                    <div key={index} className="flex flex-col gap-2 p-2 border rounded">
                      <Input
                        placeholder="Produit"
                        value={product.name}
                        onChange={(e) => {
                          const prods = [...editingSale.products];
                          prods[index] = { ...prods[index], name: e.target.value };
                          setEditingSale({ ...editingSale, products: prods });
                        }}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          type="number"
                          placeholder="Quantité"
                          value={product.quantity || ''}
                          onChange={(e) => {
                            const prods = [...editingSale.products];
                            const qty = parseInt(e.target.value) || 0;
                            prods[index] = { ...prods[index], quantity: qty, total: qty * prods[index].unitPrice };
                            setEditingSale({ ...editingSale, products: prods });
                          }}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Prix unitaire"
                          value={product.unitPrice || ''}
                          onChange={(e) => {
                            const prods = [...editingSale.products];
                            const price = parseFloat(e.target.value) || 0;
                            prods[index] = { ...prods[index], unitPrice: price, total: prods[index].quantity * price };
                            setEditingSale({ ...editingSale, products: prods });
                          }}
                        />
                      </div>
                      <div className="text-right text-sm font-medium">
                        Total: {formatCurrency(product.quantity * product.unitPrice)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-2 p-2 bg-muted rounded">
                  <span className="text-lg font-bold">
                    Total: {formatCurrency(editingSale.products.reduce((s, p) => s + (p.quantity * p.unitPrice), 0))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Mode de paiement</Label>
                  <Select value={editingSale.paymentMethod} onValueChange={(v) => setEditingSale({ ...editingSale, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Espèces">Espèces</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                      <SelectItem value="Virement">Virement</SelectItem>
                      <SelectItem value="Carte">Carte bancaire</SelectItem>
                      <SelectItem value="Chèque">Chèque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={editingSale.notes}
                    onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annuler</Button>
                <Button onClick={handleSaveEditSale}>Enregistrer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Receipt Preview Dialog */}
      {previewReceiptData && (
        <ReceiptPreview
          open={showReceiptPreview}
          onOpenChange={setShowReceiptPreview}
          data={previewReceiptData}
          onConfirm={viewingSaleReceipt ? undefined : handleConfirmSale}
          showConfirmButton={!viewingSaleReceipt && validationErrors.length === 0}
          confirmDisabled={isSavingSale}
          confirmLabel={isSavingSale ? 'Enregistrement...' : 'Confirmer et enregistrer'}
          initialAction={pdfInitialAction}
          onInitialActionComplete={() => setPdfInitialAction(null)}
        />
      )}

      <BarcodeScanner
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScannedCode}
      />
    </div>
  );
};

export default SalesManagement;
