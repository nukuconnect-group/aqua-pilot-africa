import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Factory, Warehouse, FlaskConical, Package, Store, Settings, UserPlus } from 'lucide-react';
import { useProductionUnits, ProductionUnitType } from '@/contexts/ProductionUnitsContext';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/appClient';
import { userCreationSchema } from '@/lib/validation';

interface AddUserWithUnitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

const unitTypeIcons: Record<ProductionUnitType, React.ReactNode> = {
  ecloserie: <FlaskConical className="w-4 h-4" />,
  grossissement: <Building2 className="w-4 h-4" />,
  transformation: <Factory className="w-4 h-4" />,
  conservation: <Warehouse className="w-4 h-4" />,
  fabrication_aliment: <Package className="w-4 h-4" />,
  commercialisation: <Store className="w-4 h-4" />
};

const unitTypeLabels: Record<ProductionUnitType, string> = {
  ecloserie: 'Écloserie',
  grossissement: 'Grossissement',
  transformation: 'Transformation',
  conservation: 'Conservation',
  fabrication_aliment: 'Fabrication aliment',
  commercialisation: 'Commercialisation'
};

// Options disponibles par type d'unité
const unitTypeOptions: Record<ProductionUnitType, string[]> = {
  ecloserie: ['Gestion des reproducteurs', 'Suivi des pontes', 'Incubation', 'Alevinage', 'Rapports'],
  grossissement: ['Alimentation', 'Suivi sanitaire', 'Biométrie', 'Récolte', 'Rapports'],
  transformation: ['Réception', 'Transformation', 'Conditionnement', 'Qualité', 'Rapports'],
  conservation: ['Stockage', 'Température', 'Inventaire', 'Expédition', 'Rapports'],
  fabrication_aliment: ['Matières premières', 'Production', 'Contrôle qualité', 'Stock', 'Rapports'],
  commercialisation: ['Clients', 'Commandes', 'Facturation', 'Livraison', 'Rapports']
};

interface UnitPermission {
  unitId: string;
  unitName: string;
  unitType: ProductionUnitType;
  enabled: boolean;
  options: Record<string, boolean>;
}

const AddUserWithUnitsDialog: React.FC<AddUserWithUnitsDialogProps> = ({
  open,
  onOpenChange,
  onUserAdded
}) => {
  const { units } = useProductionUnits();
  const { t } = useSettings();
  const { toast } = useToast();
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as 'admin' | 'manager' | 'operator' | 'user'
  });
  
  const [unitPermissions, setUnitPermissions] = useState<UnitPermission[]>(() => 
    units.map(unit => ({
      unitId: unit.id,
      unitName: unit.name,
      unitType: unit.type,
      enabled: false,
      options: Object.fromEntries(
        unitTypeOptions[unit.type].map(opt => [opt, true])
      )
    }))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'units'>('info');

  const handleUnitToggle = (unitId: string) => {
    setUnitPermissions(prev => prev.map(up => 
      up.unitId === unitId ? { ...up, enabled: !up.enabled } : up
    ));
  };

  const handleOptionToggle = (unitId: string, option: string) => {
    setUnitPermissions(prev => prev.map(up => 
      up.unitId === unitId 
        ? { ...up, options: { ...up.options, [option]: !up.options[option] } }
        : up
    ));
  };

  const handleSelectAllOptions = (unitId: string, selectAll: boolean) => {
    setUnitPermissions(prev => prev.map(up => {
      if (up.unitId === unitId) {
        const newOptions = Object.fromEntries(
          Object.keys(up.options).map(opt => [opt, selectAll])
        );
        return { ...up, options: newOptions };
      }
      return up;
    }));
  };

  const handleAddUser = async () => {
    try {
      setIsLoading(true);
      
      const validation = userCreationSchema.safeParse(newUser);
      if (!validation.success) {
        toast({
          title: t('error'),
          description: validation.error.issues[0].message,
          variant: 'destructive'
        });
        return;
      }

      // Préparer les données des unités assignées
      const assignedUnits = unitPermissions
        .filter(up => up.enabled)
        .map(up => ({
          unitId: up.unitId,
          unitName: up.unitName,
          unitType: up.unitType,
          options: Object.entries(up.options)
            .filter(([_, enabled]) => enabled)
            .map(([opt]) => opt)
        }));

      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          role: newUser.role,
          assigned_units: assignedUnits
        }
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message || 'Erreur lors de la création de l\'utilisateur',
          variant: 'destructive'
        });
        return;
      }

      if (!data?.success) {
        toast({
          title: t('error'),
          description: data?.error || 'Erreur lors de la création de l\'utilisateur',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: `Utilisateur créé avec ${assignedUnits.length} unité(s) assignée(s)`
      });

      // Reset form
      setNewUser({ email: '', password: '', full_name: '', role: 'user' });
      setUnitPermissions(units.map(unit => ({
        unitId: unit.id,
        unitName: unit.name,
        unitType: unit.type,
        enabled: false,
        options: Object.fromEntries(
          unitTypeOptions[unit.type].map(opt => [opt, true])
        )
      })));
      setStep('info');
      onOpenChange(false);
      onUserAdded();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors de la création de l\'utilisateur',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const enabledUnitsCount = unitPermissions.filter(up => up.enabled).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Nouvel utilisateur
          </DialogTitle>
        </DialogHeader>

        {step === 'info' ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input 
                  id="full_name" 
                  value={newUser.full_name} 
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={newUser.email} 
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="jean@exemple.com"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input 
                  id="password" 
                  type="password"
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="role">Rôle</Label>
                <Select value={newUser.role} onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="operator">Opérateur</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Sélectionnez les unités auxquelles l'utilisateur aura accès et configurez les options disponibles.
              </p>
              
              {unitPermissions.map((up) => (
                <div key={up.unitId} className="border rounded-lg overflow-hidden">
                  <div 
                    className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                      up.enabled ? 'bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => handleUnitToggle(up.unitId)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox 
                        checked={up.enabled}
                        onCheckedChange={() => handleUnitToggle(up.unitId)}
                      />
                      <div className="p-2 rounded bg-muted">
                        {unitTypeIcons[up.unitType]}
                      </div>
                      <div>
                        <p className="font-medium">{up.unitName}</p>
                        <p className="text-xs text-muted-foreground">
                          {unitTypeLabels[up.unitType]}
                        </p>
                      </div>
                    </div>
                    {up.enabled && (
                      <Badge variant="default" className="text-xs">
                        {Object.values(up.options).filter(Boolean).length} options
                      </Badge>
                    )}
                  </div>
                  
                  {up.enabled && (
                    <div className="p-3 border-t bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-1">
                          <Settings className="w-3 h-3" />
                          Options disponibles
                        </span>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAllOptions(up.unitId, true);
                            }}
                          >
                            Tout
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAllOptions(up.unitId, false);
                            }}
                          >
                            Aucun
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(up.options).map(([option, enabled]) => (
                          <Badge
                            key={option}
                            variant={enabled ? 'default' : 'outline'}
                            className="cursor-pointer transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOptionToggle(up.unitId, option);
                            }}
                          >
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'info' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => setStep('units')}
                disabled={!newUser.email || !newUser.password || !newUser.full_name}
              >
                Suivant: Unités
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('info')}>
                Retour
              </Button>
              <Button onClick={handleAddUser} disabled={isLoading}>
                {isLoading ? 'Création...' : `Créer avec ${enabledUnitsCount} unité(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddUserWithUnitsDialog;
