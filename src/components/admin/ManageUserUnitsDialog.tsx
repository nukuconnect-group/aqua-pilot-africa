import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2 } from 'lucide-react';
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

const ManageUserUnitsDialog: React.FC<Props> = ({ open, onOpenChange, userId, userName }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_units')
      .select('id, name, type, is_active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setUnits((data || []) as UnitRow[]);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unités de {userName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : units.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Cet utilisateur n'a créé aucune unité de production.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">{unit.type}</p>
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