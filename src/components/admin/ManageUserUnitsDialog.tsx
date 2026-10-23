import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2, Plus, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
}

interface UnitRow {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

const UNIT_TYPES = [
  { value: 'ecloserie', label: 'Écloserie' },
  { value: 'grossissement', label: 'Grossissement' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'conservation', label: 'Conservation' },
  { value: 'fabrication_aliment', label: "Fabrication d'aliments" },
  { value: 'algoculture', label: 'Algoculture' },
  { value: 'commercialisation', label: 'Commercialisation' },
];

const typeLabel = (value: string) => UNIT_TYPES.find((t) => t.value === value)?.label || value;

const ManageUserUnitsDialog: React.FC<Props> = ({ open, onOpenChange, userId, userName }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);

  // Compte
  const [isActivated, setIsActivated] = useState<boolean>(true);
  const [savingAccount, setSavingAccount] = useState(false);

  // Types autorisés (abonnement)
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [savingTypes, setSavingTypes] = useState(false);

  // Création d'unité par l'admin
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: unitsData, error: unitsError }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from('production_units')
        .select('id, name, type, is_active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('is_activated, production_units')
        .eq('id', userId)
        .maybeSingle(),
    ]);
    if (unitsError) {
      toast({ title: 'Erreur', description: unitsError.message, variant: 'destructive' });
    } else {
      setUnits((unitsData || []) as UnitRow[]);
    }
    if (profileError) {
      toast({ title: 'Erreur', description: profileError.message, variant: 'destructive' });
    } else if (profile) {
      setIsActivated(profile.is_activated ?? true);
      setAllowedTypes((profile.production_units as string[] | null) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && userId) load();
  }, [open, userId]);

  const toggle = async (unit: UnitRow, next: boolean) => {
    setSaving(unit.id);
    const { error } = await supabase
      .from('production_units')
      .update({ is_active: next })
      .eq('id', unit.id);
    setSaving(null);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setUnits((prev) => prev.map((u) => (u.id === unit.id ? { ...u, is_active: next } : u)));
    toast({
      title: next ? 'Unité activée' : 'Unité désactivée',
      description: unit.name,
    });
  };

  const toggleAccount = async (next: boolean) => {
    setSavingAccount(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_activated: next })
      .eq('id', userId);
    setSavingAccount(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setIsActivated(next);
    toast({ title: next ? 'Compte activé' : 'Compte désactivé', description: userName });
  };

  const toggleAllowedType = (type: string, checked: boolean) => {
    setAllowedTypes((prev) =>
      checked ? [...new Set([...prev, type])] : prev.filter((t) => t !== type)
    );
  };

  const saveAllowedTypes = async () => {
    setSavingTypes(true);
    const { error } = await supabase
      .from('profiles')
      .update({ production_units: allowedTypes })
      .eq('id', userId);
    setSavingTypes(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Abonnement mis à jour',
      description: allowedTypes.length
        ? `Types autorisés : ${allowedTypes.map(typeLabel).join(', ')}`
        : 'Aucun type autorisé',
    });
  };

  const createUnit = async () => {
    if (!newUnitName.trim() || !newUnitType) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('production_units')
      .insert({
        user_id: userId,
        name: newUnitName.trim(),
        type: newUnitType,
        is_active: true,
      })
      .select('id, name, type, is_active')
      .single();
    setCreating(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    setUnits((prev) => [data as UnitRow, ...prev]);
    setNewUnitName('');
    setNewUnitType('');
    toast({ title: 'Unité créée', description: `${data.name} rattachée à ${userName}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compte et unités de {userName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Activation du compte */}
            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div className="flex items-center gap-3">
                {isActivated ? (
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <UserX className="w-4 h-4 text-red-600" />
                )}
                <div>
                  <p className="text-sm font-medium">Compte {isActivated ? 'actif' : 'désactivé'}</p>
                  <p className="text-xs text-muted-foreground">
                    Un compte désactivé ne peut plus utiliser l'application.
                  </p>
                </div>
              </div>
              <Switch checked={isActivated} disabled={savingAccount} onCheckedChange={toggleAccount} />
            </div>

            {/* Types d'unités autorisés par l'abonnement */}
            <div className="p-3 rounded-md border bg-muted/30 space-y-3">
              <div>
                <p className="text-sm font-medium">Types d'unités autorisés (abonnement)</p>
                <p className="text-xs text-muted-foreground">
                  Le compte ne peut créer que ces types d'unités. Cochez pour étendre son abonnement.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {UNIT_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={allowedTypes.includes(t.value)}
                      onCheckedChange={(v) => toggleAllowedType(t.value, v === true)}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={saveAllowedTypes} disabled={savingTypes}>
                {savingTypes && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer les types autorisés
              </Button>
            </div>

            {/* Création d'une unité par l'admin */}
            <div className="p-3 rounded-md border bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Créer une unité pour ce compte</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nom de l'unité</Label>
                  <Input
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="Ex. Bassin principal"
                  />
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={newUnitType} onValueChange={setNewUnitType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={createUnit}
                disabled={creating || !newUnitName.trim() || !newUnitType}
              >
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Créer et rattacher
              </Button>
            </div>

            {/* Liste des unités */}
            {units.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Cet utilisateur n'a créé aucune unité de production.
              </p>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{unit.name}</p>
                        <p className="text-xs text-muted-foreground">{typeLabel(unit.type)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                        {unit.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Switch
                        checked={unit.is_active}
                        disabled={saving === unit.id}
                        onCheckedChange={(v) => toggle(unit, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageUserUnitsDialog;
