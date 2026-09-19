import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ProductionUnitSelector from './ProductionUnitSelector';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSuppliers, Supplier, SupplierOrder } from '@/hooks/useSuppliers';
import { 
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Package,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit,
  Trash2,
  Bell,
  Filter
} from 'lucide-react';
import { useLogs } from '@/contexts/LogsContext';
import { useToast } from '@/hooks/use-toast';
import { getUnitTerms } from '@/lib/unitContext';


const SuppliersManagement = () => {
  const { addLog } = useLogs();
  const { toast } = useToast();
  const { activeUnit } = useProductionUnits();
  const unitTerms = getUnitTerms(activeUnit?.type);

  const { 
    suppliers, 
    orders, 
    allSuppliers,
    loading,
    addSupplier, 
    updateSupplier, 
    deleteSupplier,
    addOrder
  } = useSuppliers();
  
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    products: '',
    rating: '5',
    notes: '',
    unitId: activeUnit?.id || ''
  });

  const [newOrder, setNewOrder] = useState({
    supplierId: '',
    products: '',
    quantity: '',
    amount: '',
    deliveryDate: '',
    unitId: activeUnit?.id || ''
  });

  // Synchroniser avec l'unité active
  useEffect(() => {
    if (activeUnit?.id) {
      setNewSupplier(prev => ({ ...prev, unitId: activeUnit.id }));
      setNewOrder(prev => ({ ...prev, unitId: activeUnit.id }));
    }
  }, [activeUnit?.id]);

  const handleSaveSupplier = async () => {
    if (editingSupplier) {
      await updateSupplier(editingSupplier.id, {
        name: newSupplier.name,
        contact: newSupplier.contact,
        email: newSupplier.email,
        phone: newSupplier.phone,
        address: newSupplier.address,
        category: newSupplier.category,
        products: newSupplier.products.split(',').map(p => p.trim()),
        rating: parseFloat(newSupplier.rating),
        notes: newSupplier.notes
      });
      addLog('Fournisseur modifié', 'Fournisseurs', `${newSupplier.name} a été mis à jour`, 'info');
      toast({ title: "Fournisseur mis à jour", description: `${newSupplier.name} a été modifié` });
    } else {
      const result = await addSupplier({
        name: newSupplier.name,
        contact: newSupplier.contact,
        email: newSupplier.email,
        phone: newSupplier.phone,
        address: newSupplier.address,
        status: 'pending',
        category: newSupplier.category,
        products: newSupplier.products.split(',').map(p => p.trim()),
        rating: parseFloat(newSupplier.rating),
        notes: newSupplier.notes,
        unitId: newSupplier.unitId
      });
      if (result) {
        addLog('Fournisseur ajouté', 'Fournisseurs', `${newSupplier.name} a été ajouté`, 'success');
        toast({ title: "Fournisseur ajouté", description: `${newSupplier.name} a été créé` });
      }
    }
    
    setNewSupplier({
      name: '',
      contact: '',
      email: '',
      phone: '',
      address: '',
      category: '',
      products: '',
      rating: '5',
      notes: '',
      unitId: activeUnit?.id || ''
    });
    setEditingSupplier(null);
    setShowSupplierDialog(false);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNewSupplier({
      name: supplier.name,
      contact: supplier.contact,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      category: supplier.category,
      products: supplier.products.join(', '),
      rating: supplier.rating.toString(),
      notes: supplier.notes,
      unitId: supplier.unitId || activeUnit?.id || ''
    });
    setShowSupplierDialog(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    await deleteSupplier(id);
    addLog('Fournisseur supprimé', 'Fournisseurs', 'Un fournisseur a été retiré', 'warning');
    setDeletingSupplier(null);
    toast({ title: "Fournisseur supprimé" });
  };

  const handleToggleStatus = async (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    if (supplier) {
      await updateSupplier(id, { 
        status: supplier.status === 'active' ? 'inactive' : 'active' 
      });
    }
  };

  const handleSaveOrder = async () => {
    const result = await addOrder({
      supplierId: newOrder.supplierId,
      date: new Date().toISOString().split('T')[0],
      products: newOrder.products,
      quantity: parseInt(newOrder.quantity),
      amount: parseFloat(newOrder.amount),
      status: 'pending',
      deliveryDate: newOrder.deliveryDate,
      unitId: newOrder.unitId
    });

    if (result) {
      addLog('Commande créée', 'Fournisseurs', `Commande pour ${allSuppliers.find(s => s.id === newOrder.supplierId)?.name}`, 'info');
      toast({ title: "Commande créée" });
    }
    
    setNewOrder({
      supplierId: '',
      products: '',
      quantity: '',
      amount: '',
      deliveryDate: '',
      unitId: activeUnit?.id || ''
    });
    setShowOrderDialog(false);
  };

  // Filtrer localement par recherche et catégorie (le filtrage par unité est dans le hook)
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         supplier.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         supplier.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const filteredOrders = orders;

  const getStatusColor = (status: Supplier['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
    }
  };

  const getStatusIcon = (status: Supplier['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'inactive':
        return <XCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
    }
  };

  const getOrderStatusColor = (status: SupplierOrder['status']) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
    }
  };

  const categories = [...new Set(suppliers.map(s => s.category))];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 truncate">Gestion des Fournisseurs</h2>
              <p className="text-sm sm:text-base text-blue-100">Base de données et historique des commandes</p>
            </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Dialog open={showSupplierDialog} onOpenChange={(open) => {
              setShowSupplierDialog(open);
              if (!open) {
                setEditingSupplier(null);
                setNewSupplier({
                  name: '',
                  contact: '',
                  email: '',
                  phone: '',
                  address: '',
                  category: '',
                  products: '',
                  rating: '5',
                  notes: '',
                  unitId: activeUnit?.id || ''
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 w-full sm:w-auto text-sm sm:text-base">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nouveau fournisseur</span>
                  <span className="sm:hidden">Nouveau</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">{editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Nom de l'entreprise</Label>
                    <Input 
                      value={newSupplier.name}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nom du fournisseur"
                    />
                  </div>
                  <div>
                    <Label>Contact principal</Label>
                    <Input 
                      value={newSupplier.contact}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, contact: e.target.value }))}
                      placeholder="Nom du contact"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input 
                      value={newSupplier.phone}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+228 XX XX XX XX"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Adresse</Label>
                    <Input 
                      value={newSupplier.address}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Adresse complète"
                    />
                  </div>
                  <div>
                    <Label>Catégorie</Label>
                    <Select value={newSupplier.category} onValueChange={(value) => setNewSupplier(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitTerms.supplierCategoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}

                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Évaluation (1-5)</Label>
                    <Select value={newSupplier.rating} onValueChange={(value) => setNewSupplier(prev => ({ ...prev, rating: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n} ⭐</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Catalogue de produits</Label>
                    <Textarea 
                      value={newSupplier.products}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, products: e.target.value }))}
                      placeholder="Produit 1, Produit 2, Produit 3..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Séparez les produits par des virgules</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Textarea 
                      value={newSupplier.notes}
                      onChange={(e) => setNewSupplier(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Informations complémentaires..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveSupplier} className="w-full">
                    {editingSupplier ? 'Mettre à jour' : 'Ajouter le fournisseur'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30 w-full sm:w-auto text-sm sm:text-base">
                  <Package className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nouvelle commande</span>
                  <span className="sm:hidden">Commande</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>Créer une commande</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div>
                    <Label>Fournisseur</Label>
                    <Select value={newOrder.supplierId} onValueChange={(value) => setNewOrder(prev => ({ ...prev, supplierId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un fournisseur" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.filter(s => s.status === 'active').map(supplier => (
                          <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Produits</Label>
                    <Input 
                      value={newOrder.products}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, products: e.target.value }))}
                      placeholder="Description des produits"
                    />
                  </div>
                  <div>
                    <Label>Quantité</Label>
                    <Input 
                      type="number"
                      value={newOrder.quantity}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, quantity: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Montant (FCFA)</Label>
                    <Input 
                      type="number"
                      value={newOrder.amount}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Date de livraison prévue</Label>
                    <Input 
                      type="date"
                      value={newOrder.deliveryDate}
                      onChange={(e) => setNewOrder(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleSaveOrder} className="w-full">
                    Créer la commande
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          </div>
          <ProductionUnitSelector />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
              <span className="truncate">Total fournisseurs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <p className="text-xl sm:text-3xl font-bold">{suppliers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {suppliers.filter(s => s.status === 'active').length} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <Package className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 flex-shrink-0" />
              <span className="truncate">Commandes en cours</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <p className="text-xl sm:text-3xl font-bold text-orange-600">
              {orders.filter(o => o.status === 'pending').length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              À réceptionner
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
              <span className="truncate">Livraisons</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <p className="text-xl sm:text-3xl font-bold text-green-600">
              {orders.filter(o => o.status === 'delivered').length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ce mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
              <span className="truncate">Montant total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <p className="text-xl sm:text-3xl font-bold text-purple-600">
              {(orders.reduce((sum, o) => sum + o.amount, 0) / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              FCFA ce mois
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher un fournisseur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs sm:text-sm">Tous les statuts</SelectItem>
                  <SelectItem value="active" className="text-xs sm:text-sm">Actif</SelectItem>
                  <SelectItem value="inactive" className="text-xs sm:text-sm">Inactif</SelectItem>
                  <SelectItem value="pending" className="text-xs sm:text-sm">En attente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs sm:text-sm">Toutes catégories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs sm:text-sm">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="suppliers" className="space-y-3 sm:space-y-4">
        <TabsList className="grid grid-cols-2 w-full bg-muted">
          <TabsTrigger value="suppliers" className="text-xs sm:text-sm">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Fournisseurs
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs sm:text-sm">
            <Package className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Commandes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {filteredSuppliers.map(supplier => (
              <Card key={supplier.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-base sm:text-lg truncate">{supplier.name}</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{supplier.contact}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge className={getStatusColor(supplier.status) + " text-xs"}>
                        {getStatusIcon(supplier.status)}
                        <span className="ml-1">
                          {supplier.status === 'active' ? 'Actif' : supplier.status === 'inactive' ? 'Inactif' : 'En attente'}
                        </span>
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{supplier.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs sm:text-sm">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{supplier.address}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <Badge className="mb-2 text-xs">{supplier.category}</Badge>
                    <div className="text-xs sm:text-sm">
                      <span className="font-medium">Produits: </span>
                      <span className="text-muted-foreground line-clamp-2">{supplier.products.join(', ')}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs sm:text-sm font-medium">Évaluation: </span>
                      <span className="text-yellow-600 text-sm">{'⭐'.repeat(Math.floor(supplier.rating))}</span>
                      <span className="text-xs text-muted-foreground">({supplier.rating})</span>
                    </div>
                  </div>

                  {supplier.notes && (
                    <div className="p-2 bg-muted rounded text-xs sm:text-sm mb-3 line-clamp-3">
                      {supplier.notes}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(supplier.id)}
                      className="flex-1 text-xs sm:text-sm"
                    >
                      {supplier.status === 'active' ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditSupplier(supplier)}
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeletingSupplier(supplier.id)}
                    >
                      <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-3 sm:space-y-4">
          <div className="space-y-3 sm:space-y-4">
            {orders.map(order => {
              const supplier = suppliers.find(s => s.id === order.supplierId);
              return (
                <Card key={order.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base truncate">{supplier?.name}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Commande #{order.id} • {new Date(order.date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Badge className={getOrderStatusColor(order.status) + " text-xs flex-shrink-0"}>
                        {order.status === 'delivered' ? 'Livré' : order.status === 'pending' ? 'En cours' : 'Annulé'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Produits:</span>
                        <p className="font-medium line-clamp-2">{order.products}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Quantité:</span>
                        <p className="font-medium">{order.quantity}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Montant:</span>
                        <p className="font-medium">{order.amount.toLocaleString()} FCFA</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Livraison:</span>
                        <p className="font-medium">{new Date(order.deliveryDate).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deletingSupplier} onOpenChange={() => setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingSupplier && handleDeleteSupplier(deletingSupplier)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuppliersManagement;