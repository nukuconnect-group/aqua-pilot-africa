
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  Plus, 
  AlertTriangle, 
  TrendingDown,
  Edit,
  Trash2,
  BarChart3,
  Loader2,
  Bell,
  History,
  Search,
  Boxes,
  ShieldCheck
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import AlertHistory from '@/components/alerts/AlertHistory';
import { notificationHelpers } from '@/lib/notificationService';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { getUnitTerms } from '@/lib/unitContext';
import { Checkbox } from '@/components/ui/checkbox';
import { getStockPurpose, getSalePrice, cleanStockNotes, STOCK_PURPOSE_LABELS, type StockPurpose } from '@/lib/stockPurpose';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';


interface FeedStockManagerProps {
  unitId: string;
  onStockUpdate?: (stocks: any[]) => void;
}

const FeedStockManager = ({ unitId, onStockUpdate }: FeedStockManagerProps) => {
  const { activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);
  const { stocks, loading, error, refetch, createStock, updateStock, deleteStocks } = useFeedStocks(unitId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletion, setDeletion] = useState<{ ids: string[]; reset: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    setSelectedIds(ids => ids.filter(id => stocks.some(stock => stock.id === id)));
  }, [stocks]);

  const { toast } = useToast();
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const [customFeedTypes, setCustomFeedTypes] = useState<string[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingStock, setEditingStock] = useState<any | null>(null);
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customFeedTypeName, setCustomFeedTypeName] = useState('');
  const [stockSearch, setStockSearch] = useState('');

  const [newStock, setNewStock] = useState({
    custom_name: '',
    feed_type: '',
    quantity: 0,
    unit: 'kg',
    expiration_date: '',
    supplier: '',
    cost: 0,
    protein_content: 0,
    fat_content: 0,
    notes: '',
    min_threshold: 50,
    bag_count: 0,
    kg_per_bag: 0,
    stock_purpose: '' as StockPurpose | '',
    sale_price: 0
  });

  const predefinedFeedTypes = [
    ...unitTerms.stockTypeOptions,
    { value: 'custom', label: 'Type personnalisé...' }
  ];


  const allFeedTypes = [
    ...predefinedFeedTypes.filter(t => t.value !== 'custom'),
    ...customFeedTypes.map(type => ({ value: type, label: type })),
    { value: 'custom', label: 'Type personnalisé...' }
  ];

  const handleSaveCustomFeedType = () => {
    if (customFeedTypeName.trim()) {
      setCustomFeedTypes(prev => [...prev, customFeedTypeName.trim()]);
      setNewStock(prev => ({ ...prev, feed_type: customFeedTypeName.trim() }));
      setCustomFeedTypeName('');
      setShowCustomTypeInput(false);
    }
  };

  const handleFeedTypeChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomTypeInput(true);
    } else {
      setNewStock(prev => ({ ...prev, feed_type: value }));
      setShowCustomTypeInput(false);
    }
  };

  const resetStockForm = () => {
    setEditingStock(null);
    setShowCustomTypeInput(false);
    setCustomFeedTypeName('');
    setNewStock({ custom_name: '', feed_type: '', quantity: 0, unit: 'kg', expiration_date: '', supplier: '', cost: 0, protein_content: 0, fat_content: 0, notes: '', min_threshold: 50, bag_count: 0, kg_per_bag: 0, stock_purpose: '', sale_price: 0 });
  };

  const handleSaveStock = async () => {
    try {
      if (!unitId) {
        toast({
          title: 'Unité manquante',
          description: 'Sélectionnez d\'abord une unité de production active.',
          variant: 'destructive',
        });
        return;
      }
      if (!newStock.feed_type && !newStock.custom_name) {
        toast({
          title: 'Type d\'aliment requis',
          description: 'Choisissez un type d\'aliment ou saisissez un nom personnalisé.',
          variant: 'destructive',
        });
        return;
      }
      if (!newStock.stock_purpose) {
        toast({ title: 'Destination du stock requise', description: 'Indiquez s’il s’agit d’un stock commercial (à vendre) ou d’un stock de production.', variant: 'destructive' });
        return;
      }
      // Validation cohérence sacs ↔ kg
      const bags = newStock.bag_count || 0;
      const kgPerBag = newStock.kg_per_bag || 0;
      if ((bags > 0) !== (kgPerBag > 0)) {
        toast({
          title: 'Conditionnement incomplet',
          description: 'Renseignez à la fois le nombre de sacs ET les kg par sac, ou laissez les deux vides.',
          variant: 'destructive',
        });
        return;
      }
      if (bags > 0 && kgPerBag > 0) {
        const expected = +(bags * kgPerBag).toFixed(2);
        if (Math.abs(expected - (newStock.quantity || 0)) > 0.01) {
          toast({
            title: 'Quantité incohérente',
            description: `La quantité saisie (${newStock.quantity} kg) ne correspond pas à ${bags} sacs × ${kgPerBag} kg = ${expected} kg.`,
            variant: 'destructive',
          });
          return;
        }
      }
      if (!Number.isFinite(newStock.quantity) || newStock.quantity < 0 || (!editingStock && newStock.quantity === 0)) {
        toast({
          title: 'Quantité requise',
          description: editingStock ? 'La quantité doit être un nombre positif ou nul.' : 'La quantité doit être strictement positive.',
          variant: 'destructive',
        });
        return;
      }

      const stockData = {
        unit_id: unitId,
        custom_name: newStock.custom_name,
        feed_type: newStock.feed_type || newStock.custom_name || 'autre',
        quantity: newStock.quantity,
        unit: newStock.unit,
        expiration_date: newStock.expiration_date || null,
        supplier: newStock.supplier.trim() || null,
        cost: newStock.cost,
        protein_content: newStock.protein_content,
        fat_content: newStock.fat_content,
        notes: newStock.notes.trim() || null,
        min_threshold: newStock.min_threshold ?? 50,
        bag_count: newStock.bag_count || null,
        kg_per_bag: newStock.kg_per_bag || null,
        stock_purpose: newStock.stock_purpose as StockPurpose,
        sale_price: newStock.stock_purpose === 'commercial' ? (newStock.sale_price || null) : null
      };

      const { data: { user } } = await supabase.auth.getUser();

      if (editingStock) {
        await updateStock(editingStock.id, stockData);
        toast({
          title: 'Stock modifié',
          description: `${newStock.custom_name || newStock.feed_type} mis à jour`,
        });
      } else {
        await createStock(stockData);
        toast({
          title: 'Stock ajouté',
          description: `${newStock.quantity} ${newStock.unit} de ${newStock.custom_name || newStock.feed_type} ajouté`,
        });
        
        // Create notification for stock addition
        if (user?.id) {
          notificationHelpers.stockAdded(
            user.id, 
            newStock.custom_name || newStock.feed_type, 
            newStock.quantity, 
            newStock.unit
          );
        }
      }

      if (onStockUpdate) {
        onStockUpdate(stocks);
      }
      
      setNewStock({
        custom_name: '',
        feed_type: '',
        quantity: 0,
        unit: 'kg',
        expiration_date: '',
        supplier: '',
        cost: 0,
        protein_content: 0,
        fat_content: 0,
        notes: '',
        min_threshold: 50,
        bag_count: 0,
        kg_per_bag: 0,
        stock_purpose: '',
        sale_price: 0
      });
      setEditingStock(null);
      setShowDialog(false);
    } catch (error) {
      console.error('Error saving stock:', error);
    }
  };

  const handleEditStock = (stock: any) => {
    setEditingStock(stock);
    setNewStock({
      custom_name: stock.custom_name || '',
      feed_type: stock.feed_type,
      quantity: stock.quantity,
      unit: stock.unit,
      expiration_date: stock.expiration_date || '',
      supplier: stock.supplier || '',
      cost: stock.cost || 0,
      protein_content: stock.protein_content || 0,
      fat_content: stock.fat_content || 0,
      notes: cleanStockNotes(stock.notes),
      stock_purpose: getStockPurpose(stock),
      sale_price: getSalePrice(stock),
      min_threshold: stock.min_threshold ?? 50,
      bag_count: stock.bag_count || 0,
      kg_per_bag: stock.kg_per_bag || 0
    });
    setShowDialog(true);
  };

  const handleDeleteStock = async (stockId: string) => {
    setDeletion({ ids: [stockId], reset: false });
  };

  const confirmDeletion = async () => {
    if (!deletion || deleting) return;
    setDeleting(true);
    try {
      const removed = await deleteStocks(deletion.ids);
      setSelectedIds(ids => ids.filter(id => !removed.includes(id)));
      setDeletion(null);
      onStockUpdate?.(stocks.filter(stock => !removed.includes(stock.id)));
    } catch (error) {
      console.error('Error deleting stock:', error);
    } finally { setDeleting(false); }
  };

  const getLowStockItems = () => stocks.filter(stock => stock.quantity <= (stock.min_threshold || 50));
  const getExpiringItems = () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return stocks.filter(stock => stock.expiration_date && new Date(stock.expiration_date) <= thirtyDaysFromNow);
  };

  // Calculs des totaux
  const getTotalValue = () => stocks.reduce((total, stock) => total + (stock.quantity * (stock.cost || 0)), 0);
  const getTotalQuantity = () => stocks.reduce((total, stock) => total + stock.quantity, 0);
  const getTotalStocks = () => stocks.length;
  const getAverageCost = () => {
    const totalQty = getTotalQuantity();
    return totalQty > 0 ? getTotalValue() / totalQty : 0;
  };

  const filteredStocks = stocks.filter((stock) => {
    const query = stockSearch.trim().toLowerCase();
    if (!query) return true;
    return [stock.custom_name, stock.feed_type, stock.supplier, stock.notes]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));
  });

  const stockHealthRate = stocks.length > 0
    ? Math.round(((stocks.length - getLowStockItems().length) / stocks.length) * 100)
    : 100;

  const handleCheckAlerts = async () => {
    try {
      setSendingAlerts(true);
      console.log('Checking stock alerts manually...');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erreur',
          description: 'Vous devez être connecté pour envoyer des alertes',
          variant: 'destructive',
        });
        return;
      }

      const lowStocks = getLowStockItems();
      if (lowStocks.length === 0) {
        toast({ title: 'Stock conforme', description: 'Aucun stock aliment sous le seuil minimum.' });
        return;
      }

      await Promise.all(lowStocks.map((stock) =>
        notificationHelpers.stockAlert(
          user.id,
          stock.custom_name || stock.feed_type,
          stock.quantity,
          stock.min_threshold || 50,
        )
      ));

      const { data, error } = await supabase.functions.invoke('send-stock-alert', {
        body: { user_id: user.id, unit_id: unitId, manual_check: true }
      });

      if (error) throw error;

      toast({
        title: 'Vérification terminée',
        description: `${lowStocks.length} alerte(s) stock créée(s). ${data?.message || ''}`,
      });

      console.log('Alert check result:', data);
    } catch (error: any) {
      console.error('Error checking alerts:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de vérifier les alertes',
        variant: 'destructive',
      });
    } finally {
      setSendingAlerts(false);
    }
  };

  // Données pour le graphique d'évolution (simulé avec dates créées)
  const stockEvolutionData = stocks
    .slice()
    .sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime())
    .map(stock => ({
      date: new Date(stock.created_at || '').toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      quantite: stock.quantity,
      nom: stock.custom_name || stock.feed_type
    }));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Chargement des stocks...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <AlertDialog open={!!deletion} onOpenChange={open => { if (!open && !deleting) setDeletion(null); }}>
        <AlertDialogContent><AlertDialogHeader>
          <AlertDialogTitle>{deletion?.reset ? 'Réinitialiser le stock de cette unité ?' : 'Supprimer les articles sélectionnés ?'}</AlertDialogTitle>
          <AlertDialogDescription>{deletion?.ids.length || 0} article(s) seront retirés de {activeUnit?.name}. Leurs quantités ne seront pas simplement mises à zéro. Cette suppression est définitive ; les ventes et les écritures comptables ne seront pas effacées.</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter>
          <Button variant="outline" disabled={deleting} onClick={() => setDeletion(null)}>Annuler</Button>
          <Button variant="destructive" disabled={deleting} onClick={confirmDeletion}>{deleting ? 'Suppression…' : 'Confirmer la suppression'}</Button>
        </AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      {error && <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm"><p>Impossible de charger les articles de cette unité.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Réessayer</Button></div>}
      {!error && stocks.length === 0 && <p className="text-sm text-muted-foreground">Aucun article enregistré dans cette unité.</p>}
      {/* Carte récapitulative du stock */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Stock total</span>
            </div>
            <p className="break-words text-xl font-bold text-primary">{getTotalQuantity().toLocaleString('fr-FR')} kg</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Valeur totale</span>
            </div>
            <p className="break-words text-xl font-bold text-green-600">{getTotalValue().toLocaleString('fr-FR')} F</p>
          </CardContent>
        </Card>
        
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Types {unitTerms.feedLabel.toLowerCase()}s</span>
            </div>
            <p className="break-words text-xl font-bold text-blue-600">{getTotalStocks()}</p>
          </CardContent>
        </Card>
        
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-muted-foreground">Coût moyen/kg</span>
            </div>
            <p className="break-words text-xl font-bold text-orange-600">{getAverageCost().toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4 items-start">
        <Card className="min-w-0 border-border/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Articles en stock</h3>
                <p className="text-sm text-muted-foreground">{activeUnit?.name}</p>
              </div>
              <div className="relative min-w-0 w-full md:max-w-[280px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Rechercher un article, fournisseur…" className="pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Boxes className="w-4 h-4" /> Références</div>
                <p className="break-words text-xl font-bold">{stocks.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Package className="w-4 h-4" /> Couverture</div>
                <p className="break-words text-xl font-bold">{getTotalQuantity().toLocaleString('fr-FR')} kg</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><ShieldCheck className="w-4 h-4" /> Santé stock</div>
                <p className="break-words text-xl font-bold">{stockHealthRate}%</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><AlertTriangle className="w-4 h-4" /> À traiter</div>
                <p className="break-words text-xl font-bold">{getLowStockItems().length + getExpiringItems().length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {getLowStockItems().length > 0 && (
              <span className="text-yellow-600 mr-2">⚠️ {getLowStockItems().length} stock(s) faible(s)</span>
            )}
            {getExpiringItems().length > 0 && (
              <span className="text-red-600">🕐 {getExpiringItems().length} expiration(s) proche(s)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCheckAlerts}
            disabled={sendingAlerts}
            className="text-sm"
          >
            {sendingAlerts ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bell className="w-4 h-4 mr-2" />
            )}
            Vérifier alertes
          </Button>
          <Dialog open={showDialog} onOpenChange={open => { setShowDialog(open); if (!open) resetStockForm(); }}>
            <DialogTrigger asChild>
              <Button className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Ajouter stock</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{editingStock ? 'Modifier le stock' : 'Ajouter un article'}</DialogTitle>
            </DialogHeader>
            
            {/* Formulaire simplifié - champs essentiels uniquement */}
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 space-y-2">
                <Label className="text-sm">Ce stock est destiné à… *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['production', 'commercial'] as StockPurpose[]).map(p => (
                    <Button key={p} type="button" variant={newStock.stock_purpose === p ? 'default' : 'outline'} className="h-auto py-2 flex-col items-start text-left whitespace-normal" onClick={() => setNewStock(prev => ({ ...prev, stock_purpose: p }))}>
                      <span className="font-medium">{STOCK_PURPOSE_LABELS[p]}</span>
                      <span className="text-xs opacity-80">{p === 'production' ? 'Aliments et intrants pour nourrir mes poissons. Non vendu en caisse.' : 'Poissons, alevins, aliments ou produits à vendre en caisse.'}</span>
                    </Button>
                  ))}
                </div>
                {newStock.stock_purpose === 'commercial' && (
                  <div>
                    <Label className="text-sm">Prix de vente unitaire</Label>
                    <Input type="number" min="0" value={newStock.sale_price || ''} onChange={e => setNewStock(prev => ({ ...prev, sale_price: parseFloat(e.target.value) || 0 }))} className="text-sm" placeholder="Prix proposé en caisse" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Nom de l’article *</Label>
                  <Input 
                    value={newStock.custom_name}
                    onChange={(e) => setNewStock(prev => ({ ...prev, custom_name: e.target.value }))}
                    placeholder="Ex: Granulés Tilapia 3mm"
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label className="text-sm">Type *</Label>
                  <Select value={newStock.feed_type} onValueChange={handleFeedTypeChange}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      {allFeedTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showCustomTypeInput && (
                  <div className="sm:col-span-2">
                    <Label className="text-sm">Nom du type personnalisé</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={customFeedTypeName}
                        onChange={(e) => setCustomFeedTypeName(e.target.value)}
                        placeholder="Ex: Granulés bio"
                        className="text-sm"
                      />
                      <Button size="sm" onClick={handleSaveCustomFeedType}>OK</Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm">Quantité *</Label>
                  <Input 
                    type="number"
                    value={newStock.quantity}
                    onChange={(e) => setNewStock(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                    className="text-sm"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total en kg (calculé automatiquement si vous renseignez sacs × kg/sac)
                  </p>
                </div>

                <div>
                  <Label className="text-sm">Unité</Label>
                  <Select value={newStock.unit} onValueChange={(value) => setNewStock(prev => ({ ...prev, unit: value }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="tonnes">tonnes</SelectItem>
                      <SelectItem value="sacs">sacs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm">Fournisseur</Label>
                  <Input 
                    value={newStock.supplier}
                    onChange={(e) => setNewStock(prev => ({ ...prev, supplier: e.target.value }))}
                    placeholder="Nom du fournisseur"
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label className="text-sm">Coût/kg (FCFA)</Label>
                  <Input 
                    type="number"
                    value={newStock.cost}
                    onChange={(e) => setNewStock(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                    className="text-sm"
                    placeholder="0"
                  />
                </div>

                <div className="sm:col-span-2 border-t pt-3 mt-1">
                  <Label className="text-sm font-semibold">Conditionnement en sacs (optionnel)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Renseignez le nombre de sacs et les kg par sac, la quantité totale (kg) sera calculée automatiquement.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Nombre de sacs</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newStock.bag_count || ''}
                        onChange={(e) => {
                          const bag_count = parseFloat(e.target.value) || 0;
                          const kg_per_bag = newStock.kg_per_bag || 0;
                          const computedQty = bag_count * kg_per_bag;
                          setNewStock(prev => ({
                            ...prev,
                            bag_count,
                            quantity: computedQty > 0 ? computedQty : prev.quantity,
                            unit: 'kg'
                          }));
                        }}
                        placeholder="Ex: 10"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Kg par sac</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={newStock.kg_per_bag || ''}
                        onChange={(e) => {
                          const kg_per_bag = parseFloat(e.target.value) || 0;
                          const bag_count = newStock.bag_count || 0;
                          const computedQty = bag_count * kg_per_bag;
                          setNewStock(prev => ({
                            ...prev,
                            kg_per_bag,
                            quantity: computedQty > 0 ? computedQty : prev.quantity,
                            unit: 'kg'
                          }));
                        }}
                        placeholder="Ex: 25"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Total calculé</Label>
                      <div className="text-sm font-semibold p-2 bg-muted rounded border">
                        {((newStock.bag_count || 0) * (newStock.kg_per_bag || 0)).toLocaleString('fr-FR')} kg
                      </div>
                    </div>
                  </div>
                  {(newStock.bag_count || 0) > 0 && (newStock.kg_per_bag || 0) > 0 && (newStock.cost || 0) > 0 && (
                    <p className="text-xs text-primary mt-2">
                      Prix par sac : {((newStock.cost || 0) * (newStock.kg_per_bag || 0)).toLocaleString('fr-FR')} F CFA
                    </p>
                  )}
                </div>
              </div>
              
              {/* Options avancées dans un collapsible */}
              <details className="border rounded-lg p-3">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground font-medium">
                  ▶ Options avancées (composition, seuil d'alerte...)
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label className="text-sm">Seuil minimum (alerte stock bas)</Label>
                    <Input 
                      type="number"
                      value={newStock.min_threshold}
                      onChange={(e) => setNewStock(prev => ({ ...prev, min_threshold: parseFloat(e.target.value) || 0 }))}
                      className="text-sm"
                      placeholder="50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Alerte déclenchée quand le stock atteint ce seuil
                    </p>
                  </div>
                  
                  <div className="hidden">
                    {/* Date d'expiration masquée - les stocks s'épuisent par utilisation */}
                    <Label className="text-sm">Date d'expiration (optionnel)</Label>
                    <Input 
                      type="date"
                      value={newStock.expiration_date}
                      onChange={(e) => setNewStock(prev => ({ ...prev, expiration_date: e.target.value }))}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Taux de protéines (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={newStock.protein_content}
                      onChange={(e) => setNewStock(prev => ({ ...prev, protein_content: parseFloat(e.target.value) || 0 }))}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Taux de matières grasses (%)</Label>
                    <Input 
                      type="number"
                      step="0.1"
                      value={newStock.fat_content}
                      onChange={(e) => setNewStock(prev => ({ ...prev, fat_content: parseFloat(e.target.value) || 0 }))}
                      className="text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-sm">Notes</Label>
                    <Textarea 
                      value={newStock.notes}
                      onChange={(e) => setNewStock(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Informations complémentaires..."
                      className="text-sm"
                    />
                  </div>
                </div>
              </details>
              
              {/* Boutons toujours visibles */}
              <div className="flex flex-col gap-2 pt-4 border-t sm:flex-row sm:flex-wrap">
                <Button 
                  onClick={handleSaveStock} 
                  className="flex-1 min-h-[44px]"
                  disabled={!newStock.stock_purpose || !(newStock.feed_type || newStock.custom_name.trim()) || !Number.isFinite(newStock.quantity) || newStock.quantity < 0 || (!editingStock && newStock.quantity === 0)}
                >
                  {editingStock ? 'Modifier' : 'Ajouter'} le stock
                </Button>
                {!editingStock && (
                  <Button
                    variant="secondary"
                    className="min-h-[44px]"
                    disabled={!newStock.stock_purpose || !(newStock.feed_type || newStock.custom_name.trim()) || !Number.isFinite(newStock.quantity) || newStock.quantity < 0 || (!editingStock && newStock.quantity === 0)}
                    onClick={async () => {
                      await handleSaveStock();
                      // handleSaveStock closes the dialog ; rouvre immédiatement
                      setShowDialog(true);
                    }}
                  >
                    Enregistrer et nouveau
                  </Button>
                )}
                <Button variant="outline" className="min-h-[44px]" onClick={() => {
                  setShowDialog(false);
                  setEditingStock(null);
                  setNewStock({
                    custom_name: '',
                    feed_type: '',
                    quantity: 0,
                    unit: 'kg',
                    expiration_date: '',
                    supplier: '',
                    cost: 0,
                    protein_content: 0,
                    fat_content: 0,
                    notes: '',
                    min_threshold: 50,
                    bag_count: 0,
                    kg_per_bag: 0
                  });
                }}>
                  Annuler
                </Button>
              </div>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>
      </div>

      {/* Tabs for Stocks, Movement History, and Alert History */}
      <Tabs defaultValue="stocks" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="stocks" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Stocks
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Mouvements
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Alertes
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="stocks" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Sélectionner tous les articles affichés" disabled={!filteredStocks.length || deleting} checked={filteredStocks.length > 0 && filteredStocks.every(stock => selectedIds.includes(stock.id))} onCheckedChange={checked => setSelectedIds(ids => checked ? [...new Set([...ids, ...filteredStocks.map(stock => stock.id)])] : ids.filter(id => !filteredStocks.some(stock => stock.id === id)))} />Tout sélectionner{stockSearch ? ' (résultats)' : ''}</label>
            <span className="text-sm text-muted-foreground">{selectedIds.length} sélectionné(s)</span>
            <Button variant="outline" size="sm" disabled={!selectedIds.length || deleting} onClick={() => setDeletion({ ids: selectedIds, reset: false })}><Trash2 className="mr-2 h-4 w-4" />Supprimer la sélection</Button>
            <Button variant="destructive" size="sm" disabled={!stocks.length || deleting} onClick={() => setDeletion({ ids: stocks.map(stock => stock.id), reset: true })}>Réinitialiser le stock</Button>
          </div>
          {/* Alertes */}
          {(getLowStockItems().length > 0 || getExpiringItems().length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getLowStockItems().length > 0 && (
                <Card className="border-yellow-300 bg-yellow-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-yellow-800 text-sm">
                      <TrendingDown className="w-4 h-4" />
                      Stock faible ({getLowStockItems().length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {getLowStockItems().map(item => (
                        <div key={item.id} className="text-xs">
                          <strong>{item.custom_name || item.feed_type}</strong>: {item.quantity} {item.unit}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {getExpiringItems().length > 0 && (
                <Card className="border-red-300 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-red-800 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Expiration proche ({getExpiringItems().length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {getExpiringItems().map(item => (
                        <div key={item.id} className="text-xs">
                          <strong>{item.custom_name || item.feed_type}</strong>: {item.expiration_date ? new Date(item.expiration_date).toLocaleDateString('fr-FR') : 'N/A'}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Graphique d'évolution des stocks */}
          {stocks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="w-5 h-5" />
                  Évolution des Stocks d'Aliment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stockEvolutionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} label={{ value: 'Quantité (kg)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }} />
                      <Tooltip 
                        contentStyle={{ fontSize: 12 }}
                        formatter={(value: any, name: string) => [
                          `${value} kg`,
                          'Quantité'
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line 
                        type="monotone" 
                        dataKey="quantite" 
                        stroke="#f97316" 
                        strokeWidth={2}
                        name="Stock"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des stocks */}
          <div className="grid gap-4">
            {filteredStocks.map(stock => {
              const stockValue = stock.quantity * (stock.cost || 0);
              const isLow = stock.quantity <= (stock.min_threshold || 50);
              return (
                <Card key={stock.id} className={isLow ? 'border-yellow-300' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <CardTitle className="break-words text-base">{stock.custom_name || stock.feed_type}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {predefinedFeedTypes.find(t => t.value === stock.feed_type)?.label || stock.feed_type}
                          </Badge>
                          <Badge variant={getStockPurpose(stock) === 'commercial' ? 'default' : 'secondary'} className="text-xs">{STOCK_PURPOSE_LABELS[getStockPurpose(stock)]}</Badge>
                          <Badge className={isLow ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                            Stock: {stock.quantity} {stock.unit}
                          </Badge>
                          {stock.min_threshold && (
                            <Badge variant="secondary" className="text-xs">
                              Seuil: {stock.min_threshold} {stock.unit}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox aria-label={`Sélectionner ${stock.custom_name || stock.feed_type}`} checked={selectedIds.includes(stock.id)} onCheckedChange={checked => setSelectedIds(ids => checked ? [...new Set([...ids, stock.id])] : ids.filter(id => id !== stock.id))} />
                        <Button variant="ghost" size="sm" aria-label={`Modifier ${stock.custom_name || stock.feed_type}`} title="Modifier l’article" onClick={() => handleEditStock(stock)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Supprimer ${stock.custom_name || stock.feed_type}`} title="Supprimer l’article" onClick={() => handleDeleteStock(stock.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 break-words text-xs sm:grid-cols-3 sm:text-sm xl:grid-cols-5">
                      <div className="p-2 bg-primary/5 rounded">
                        <span className="text-muted-foreground block text-xs">Stock restant</span>
                        <span className="font-bold text-primary text-lg">{stock.quantity} {stock.unit}</span>
                      </div>
                      <div className="p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground block text-xs">Valeur stock</span>
                        <span className="font-semibold text-green-600">{stockValue.toLocaleString('fr-FR')} F</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block text-xs">Expiration:</span>
                        <span className="font-medium">
                          {stock.expiration_date ? new Date(stock.expiration_date).toLocaleDateString('fr-FR') : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 block text-xs">Coût unitaire:</span>
                        <span className="font-medium">{(stock.cost || 0).toLocaleString('fr-FR')} F/{stock.unit}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block text-xs">Fournisseur:</span>
                        <span className="font-medium">{stock.supplier || 'N/A'}</span>
                      </div>
                    </div>
                    {isLow && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Stock inférieur au seuil minimum ({stock.min_threshold} {stock.unit})
                      </div>
                    )}
                    {stock.notes && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <strong>Notes:</strong> {stock.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5" />
                Historique des Mouvements de Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun stock enregistré. Ajoutez des stocks pour voir l'historique.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tableau récapitulatif des stocks par type */}
                  <div className="min-w-0 max-w-full overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Type d'aliment</th>
                          <th className="text-right py-2 px-2">Quantité</th>
                          <th className="text-right py-2 px-2">Coût unitaire</th>
                          <th className="text-right py-2 px-2">Valeur</th>
                          <th className="text-center py-2 px-2">Statut</th>
                          <th className="text-center py-2 px-2">Dernière MAJ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map(stock => {
                          const isLow = stock.quantity <= (stock.min_threshold || 50);
                          const isExpiring = stock.expiration_date && new Date(stock.expiration_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                          return (
                            <tr key={stock.id} className="border-b hover:bg-muted/50">
                              <td className="py-2 px-2">
                                <div>
                                  <p className="font-medium">{stock.custom_name || stock.feed_type}</p>
                                  <p className="text-xs text-muted-foreground">{stock.supplier || 'Sans fournisseur'}</p>
                                </div>
                              </td>
                              <td className="text-right py-2 px-2 font-medium">{stock.quantity} {stock.unit}</td>
                              <td className="text-right py-2 px-2">{(stock.cost || 0).toLocaleString('fr-FR')} F</td>
                              <td className="text-right py-2 px-2 font-medium">{(stock.quantity * (stock.cost || 0)).toLocaleString('fr-FR')} F</td>
                              <td className="text-center py-2 px-2">
                                {isLow ? (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">Stock bas</Badge>
                                ) : isExpiring ? (
                                  <Badge variant="outline" className="bg-red-100 text-red-800 text-xs">Expire bientôt</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 text-xs">OK</Badge>
                                )}
                              </td>
                              <td className="text-center py-2 px-2 text-xs text-muted-foreground">
                                {stock.updated_at ? new Date(stock.updated_at).toLocaleDateString('fr-FR') : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/30 font-medium">
                          <td className="py-2 px-2">Total</td>
                          <td className="text-right py-2 px-2">{getTotalQuantity().toLocaleString('fr-FR')} kg</td>
                          <td className="text-right py-2 px-2">{getAverageCost().toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F (moy)</td>
                          <td className="text-right py-2 px-2">{getTotalValue().toLocaleString('fr-FR')} F</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  
                  {/* Graphique d'évolution */}
                  {stocks.length > 0 && (
                    <div className="h-64 mt-4">
                      <p className="text-sm font-medium mb-2">Évolution des stocks</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stockEvolutionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="quantite" 
                            stroke="#f97316" 
                            strokeWidth={2}
                            name="Quantité (kg)"
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <AlertHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedStockManager;
