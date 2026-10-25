
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building, 
  Plus, 
  Edit,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  AlertTriangle,
  Camera,
  X,
  Activity,
  Gauge,
  Users,
  BarChart3,
  Search,
  Lock
} from 'lucide-react';
import { useProductionUnits, ProductionUnitType } from '@/contexts/ProductionUnitsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/appClient';
import { isUnitTypeAllowed, unitCreationLimit } from '@/lib/unitTypeAccess';
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription';
import { useLogs } from '@/contexts/LogsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

const ProductionUnitsManagement = () => {
  const { units, addUnit, updateUnit, deleteUnit } = useProductionUnits();
  const { addLog } = useLogs();
  const { t, language } = useSettings();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configUnit, setConfigUnit] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Types d'unités couverts par l'abonnement du compte (profil).
  // null = pas de restriction (comptes anciens sans liste enregistrée).
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { subscription, loading: subscriptionLoading } = useCurrentSubscription();
  const [allowedTypes, setAllowedTypes] = useState<string[] | null>(null);
  const [typesLoaded, setTypesLoaded] = useState(false);

  useEffect(() => {
    setAllowedTypes(null);
    setTypesLoaded(false);
    if (!user?.id || isAdmin) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('production_units')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          toast.error("Impossible de vérifier les types d’unités autorisés. Réessayez en rouvrant ce module.");
          return;
        }
        setAllowedTypes((data.production_units as string[] | null) ?? null);
        setTypesLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user?.id, isAdmin]);

  const isTypeAllowed = (type: string) => isUnitTypeAllowed(allowedTypes, type, isAdmin, subscription);
  
  const [newUnit, setNewUnit] = useState({
    name: '',
    type: '' as ProductionUnitType,
    description: '',
    capacity: 0,
    currentStock: 0,
    manager: '',
    isActive: true,
    photoUrl: ''
  });

  const unitTypes = [
    { value: 'ecloserie', label: t('ecloserie') },
    { value: 'grossissement', label: t('grossissement') },
    { value: 'transformation', label: t('transformation') },
    { value: 'conservation', label: t('conservation') },
    { value: 'fabrication_aliment', label: t('fabrication_aliment') },
    { value: 'algoculture', label: t('algoculture') },
    { value: 'commercialisation', label: t('commercialisation') }
  ];

  const activeUnits = units.filter((unit) => unit.isActive).length;
  const totalCapacity = units.reduce((sum, unit) => sum + (unit.capacity || 0), 0);
  const totalStock = units.reduce((sum, unit) => sum + (unit.currentStock || 0), 0);
  const capacityUsage = totalCapacity > 0 ? Math.round((totalStock / totalCapacity) * 100) : 0;
  const filteredUnits = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return units.filter((unit) => {
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? unit.isActive : !unit.isActive);
      const typeLabel = unitTypes.find((type) => type.value === unit.type)?.label || unit.type;
      const matchesSearch = !query || [unit.name, unit.description, unit.manager, typeLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [units, unitSearch, statusFilter, unitTypes]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('select_image'));
      return;
    }

    setUploadingPhoto(true);
    try {
      // Import supabase client for direct upload to public avatars bucket
      const { supabase } = await import('@/integrations/supabase/appClient');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error(t('must_be_connected'));
        return;
      }

      const fileName = `unit_${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to avatars bucket (public)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL from avatars bucket
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path);

      if (urlData?.publicUrl) {
        setSelectedPhoto(urlData.publicUrl);
        setNewUnit(prev => ({ ...prev, photoUrl: urlData.publicUrl }));
        toast.success(t('photo_uploaded'));
      }
    } catch (error) {
      toast.error(t('upload_error'));
      console.error(error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setNewUnit(prev => ({ ...prev, photoUrl: '' }));
  };

  const handleSaveUnit = async () => {
    if (!isAdmin && (subscriptionLoading || (!subscription?.isTrial && !typesLoaded))) {
      toast.error("Les types d’unités autorisés n’ont pas encore pu être vérifiés. Réessayez en rouvrant ce module.");
      return;
    }
    if (!isAdmin && subscription && !subscription.isActive) {
      toast.error("Votre essai ou abonnement est terminé. Souscrivez à un abonnement payant pour réactiver vos unités. Vos données sont conservées.");
      return;
    }
    const unitLimit = unitCreationLimit(subscription, isAdmin);
    if (!editingUnit && unitLimit !== null && units.length >= unitLimit) {
      toast.error(`Votre abonnement couvre ${unitLimit} unité${unitLimit > 1 ? 's' : ''}. Choisissez une offre supérieure pour en ajouter. Vos unités existantes sont conservées.`);
      return;
    }
    // Refus côté client : type non couvert par l'abonnement (le serveur bloque aussi).
    const typeChanged = !editingUnit || editingUnit.type !== newUnit.type;
    if (typeChanged && newUnit.type && !isTypeAllowed(newUnit.type)) {
      toast.error("Ce type d'unité n'est pas couvert par votre abonnement. Écrivez à l'administration pour étendre votre abonnement.");
      return;
    }
    const unitToSave = {
      ...newUnit,
      photoUrl: selectedPhoto || newUnit.photoUrl || ''
    };
    
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, unitToSave);
        addLog('Unité modifiée', 'Infrastructures', `Unité ${unitToSave.name} mise à jour`, 'info');
        setEditingUnit(null);
        toast.success(t('unit_modified'));
      } else {
        await addUnit(unitToSave);
        addLog('Unité créée', 'Infrastructures', `Nouvelle unité ${unitToSave.name} ajoutée`, 'success');
        toast.success(t('unit_created'));
      }
      
      setNewUnit({
        name: '',
        type: '' as ProductionUnitType,
        description: '',
        capacity: 0,
        currentStock: 0,
        manager: '',
        isActive: true,
        photoUrl: ''
      });
      setSelectedPhoto(null);
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error saving unit:', error);
      const message = error && typeof error === 'object' && 'message' in error
        && typeof error.message === 'string' ? error.message : t('unit_save_error');
      toast.error(message);
    }
  };

  const handleEditUnit = (unit: any) => {
    setEditingUnit(unit);
    setNewUnit({
      name: unit.name,
      type: unit.type,
      description: unit.description,
      capacity: unit.capacity,
      currentStock: unit.currentStock,
      manager: unit.manager,
      isActive: unit.isActive,
      photoUrl: unit.photoUrl || ''
    });
    setSelectedPhoto(unit.photoUrl || null);
    setShowAddDialog(true);
  };

  const handleDeleteUnit = async (unitId: string, unitName: string) => {
    try {
      await deleteUnit(unitId);
      addLog('Unité supprimée', 'Infrastructures', `Unité ${unitName} supprimée définitivement`, 'info');
      toast.success(t('unit_deleted'));
    } catch (error) {
      console.error('Error deleting unit:', error);
      toast.error(t('unit_delete_error'));
    }
  };

  const handleToggleUnit = async (unitId: string, unitName: string, isActive: boolean) => {
    try {
      await updateUnit(unitId, { isActive: !isActive });
      addLog(
        isActive ? 'Unité désactivée' : 'Unité activée', 
        'Infrastructures', 
        `Unité ${unitName} ${isActive ? 'désactivée' : 'activée'}`, 
        'info'
      );
    } catch (error) {
      console.error('Error toggling unit:', error);
      toast.error(t('unit_toggle_error'));
    }
  };

  const openConfigDialog = (unit: any) => {
    setConfigUnit(unit);
    setShowConfigDialog(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('production_units')}</h2>
            <p className="text-purple-100 text-sm sm:text-base">{t('production_units_management_desc')}</p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <Plus className="w-4 h-4 mr-2" />
                {t('add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full sm:max-w-2xl mx-2">
              <DialogHeader>
                <DialogTitle>{editingUnit ? t('edit') : t('create')}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">{t('unit_name_label')}</Label>
                  <Input 
                    value={newUnit.name}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('unit_name_label')}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">{t('unit_type_label')}</Label>
                  <Select value={newUnit.type} onValueChange={(value: ProductionUnitType) => setNewUnit(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={t('select_type')} />
                    </SelectTrigger>
                    <SelectContent>
                      {unitTypes.map(type => {
                        const allowed = isTypeAllowed(type.value) || editingUnit?.type === type.value;
                        return (
                          <SelectItem key={type.value} value={type.value} disabled={!allowed}>
                            <span className="flex items-center gap-2">
                              {type.label}
                              {!allowed && <Lock className="w-3 h-3 text-muted-foreground" />}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {allowedTypes && allowedTypes.length > 0 && !isAdmin && !subscription?.isTrial && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Votre abonnement couvre : {allowedTypes.map((v) => unitTypes.find((ut) => ut.value === v)?.label || v).join(', ')}.
                      Pour créer un autre type d'unité, écrivez à l'administration afin d'étendre votre abonnement.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm">{t('capacity')}</Label>
                  <Input 
                    type="number"
                    value={newUnit.capacity}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">{t('current_stock_label')}</Label>
                  <Input 
                    type="number"
                    value={newUnit.currentStock}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, currentStock: parseInt(e.target.value) }))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-sm">{t('manager_label')}</Label>
                  <Input 
                    value={newUnit.manager}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, manager: e.target.value }))}
                    placeholder={t('manager_placeholder')}
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={newUnit.isActive}
                    onCheckedChange={(checked) => setNewUnit(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label className="text-sm">{t('unit_active')}</Label>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">{t('unit_description')}</Label>
                  <Textarea 
                    value={newUnit.description}
                    onChange={(e) => setNewUnit(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('description_placeholder')}
                    className="text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">{t('unit_photo')}</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div className="space-y-3">
                    {selectedPhoto ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative w-full max-w-md">
                          <img
                            src={selectedPhoto}
                            alt={t('unit_photo')}
                            className="w-full h-32 sm:h-48 object-cover rounded-lg border-2 border-border"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={handleRemovePhoto}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('photo_selected')}</p>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        {uploadingPhoto ? t('uploading') : t('add_photo')}
                      </Button>
                    )}
                  </div>
                </div>
                {/* Boutons TOUJOURS visibles - fixés en bas */}
                <div className="sm:col-span-2 flex gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
                  <Button onClick={handleSaveUnit} className="flex-1 min-h-[44px]" disabled={!newUnit.name || !newUnit.type}>
                    {editingUnit ? t('edit') : t('create')}
                  </Button>
                  <Button variant="outline" className="min-h-[44px]" onClick={() => {
                    setShowAddDialog(false);
                    setEditingUnit(null);
                    setSelectedPhoto(null);
                    setNewUnit({
                      name: '',
                      type: '' as ProductionUnitType,
                      description: '',
                      capacity: 0,
                      currentStock: 0,
                      manager: '',
                      isActive: true,
                      photoUrl: ''
                    });
                  }}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Building className="w-4 h-4 text-primary" /> Unités</div><p className="text-xl sm:text-2xl font-bold mt-1">{units.length}</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="w-4 h-4 text-emerald-600" /> Actives</div><p className="text-xl sm:text-2xl font-bold mt-1 text-emerald-600">{activeUnits}</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="w-4 h-4 text-sky-600" /> Occupation</div><p className="text-xl sm:text-2xl font-bold mt-1">{capacityUsage}%</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="w-4 h-4 text-amber-600" /> Capacité</div><p className="text-xl sm:text-2xl font-bold mt-1">{totalCapacity.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} placeholder="Rechercher une unité, type ou responsable..." className="pl-9" />
          </div>
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')} className="w-full lg:w-auto">
            <TabsList className="grid grid-cols-3 w-full lg:w-[320px]">
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="active">Actives</TabsTrigger>
              <TabsTrigger value="inactive">Inactives</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-5">
        {filteredUnits.map(unit => {
          const unitRatio = unit.capacity > 0 ? Math.min(100, Math.round((unit.currentStock / unit.capacity) * 100)) : 0;
          return (
          <Card key={unit.id} className={`overflow-hidden transition-shadow hover:shadow-md ${!unit.isActive ? 'opacity-60 border-border' : 'border-l-4 border-l-primary'}`}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 min-w-0 h-full">
                <div className="flex items-start gap-3 min-w-0 w-full">
                  <Avatar className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg shrink-0 ring-1 ring-border" key={unit.photoUrl || unit.id}>
                    <AvatarImage 
                      src={unit.photoUrl || ''} 
                      alt={unit.name}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                      <Building className="w-6 h-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle
                      className="text-base sm:text-lg leading-tight break-words hyphens-auto whitespace-normal"
                      style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                      title={unit.name}
                    >
                      {unit.name}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant={unit.isActive ? 'default' : 'secondary'}>
                        {unit.isActive ? t('active') : t('inactive')}
                      </Badge>
                      <Badge variant="outline" className="text-xs max-w-full break-words">
                        {unitTypes.find(type => type.value === unit.type)?.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end w-full border-t pt-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleToggleUnit(unit.id, unit.name, unit.isActive)}
                    className="text-xs"
                  >
                    {unit.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openConfigDialog(unit)}
                    className="text-xs"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditUnit(unit)}
                    className="text-xs"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 text-xs">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('confirm_delete')} "{unit.name}"?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteUnit(unit.id, unit.name)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {t('delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2 text-sm">
                <div className="rounded-md bg-muted/50 p-2 min-w-0">
                   <span className="block text-muted-foreground text-xs">{t('capacity')}</span>
                  <span className="block font-medium break-words">{unit.capacity.toLocaleString()}</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2 min-w-0">
                  <span className="block text-muted-foreground text-xs">{t('stock')}</span>
                  <span className="block font-medium break-words">{unit.currentStock.toLocaleString()}</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2 min-w-0">
                  <span className="block text-muted-foreground text-xs">Occupation</span>
                  <span className="block font-medium">{unit.capacity > 0 ? ((unit.currentStock / unit.capacity) * 100).toFixed(1) : '0.0'}%</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2 min-w-0">
                  <span className="block text-muted-foreground text-xs">{t('manager_label')}</span>
                  <span className="block font-medium break-words">{unit.manager || '—'}</span>
                </div>
              </div>
              {unit.description && (
                <div className="mt-3 p-2 bg-muted/50 rounded-md text-xs sm:text-sm break-words">
                  <strong>{t('description')}:</strong> {unit.description}
                </div>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Taux d’occupation</span><span className="font-medium">{unitRatio}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full ${unitRatio > 85 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${unitRatio}%` }} /></div>
              </div>
            </CardContent>
          </Card>
        )})}
        {filteredUnits.length === 0 && (
          <Card className="xl:col-span-2"><CardContent className="p-8 text-center text-muted-foreground">Aucune unité ne correspond aux filtres.</CardContent></Card>
        )}
      </div>

      {/* Dialog/Sheet de configuration selon le device */}
      {isMobile ? (
        <Sheet open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader>
              <SheetTitle>{t('unit_config')} - {configUnit?.name}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>{t('unit_state')}</Label>
                <Switch 
                  checked={configUnit?.isActive}
                  onCheckedChange={(checked) => {
                    handleToggleUnit(configUnit.id, configUnit.name, configUnit.isActive);
                    setConfigUnit({...configUnit, isActive: checked});
                  }}
                />
              </div>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>{t('type')}:</strong> {unitTypes.find(tp => tp.value === configUnit?.type)?.label}</p>
                <p><strong>{t('created_on')}:</strong> {new Date(configUnit?.createdAt).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR')}</p>
                <p><strong>{t('total_capacity')}:</strong> {configUnit?.capacity?.toLocaleString()}</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
          <DialogContent className="max-w-full sm:max-w-lg mx-2">
            <DialogHeader>
              <DialogTitle>{t('unit_config')} - {configUnit?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('unit_state')}</Label>
                <Switch 
                  checked={configUnit?.isActive}
                  onCheckedChange={(checked) => {
                    handleToggleUnit(configUnit.id, configUnit.name, configUnit.isActive);
                    setConfigUnit({...configUnit, isActive: checked});
                  }}
                />
              </div>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>{t('type')}:</strong> {unitTypes.find(tp => tp.value === configUnit?.type)?.label}</p>
                <p><strong>{t('created_on')}:</strong> {new Date(configUnit?.createdAt).toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR')}</p>
                <p><strong>{t('total_capacity')}:</strong> {configUnit?.capacity?.toLocaleString()}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ProductionUnitsManagement;
