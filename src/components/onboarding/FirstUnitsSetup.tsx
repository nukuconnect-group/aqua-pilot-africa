import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { signupUnitLabel, signupUnitTypes } from '@/lib/signupUnits';

/** Crée, à la première connexion, les unités choisies à l'inscription, puis informe sur le multi-unités. */
export default function FirstUnitsSetup({ onRequest }: { onRequest: () => void }) {
  const { user } = useAuth();
  const { units, isLoadingUnits, addUnit, setActiveUnit } = useProductionUnits() as any;
  const [created, setCreated] = useState<string[]>([]);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !user?.id || (user as any).isTeamMember || isLoadingUnits || units.length > 0) return;
    const doneKey = `aquapilote.firstUnits.${user.id}`;
    if (localStorage.getItem(doneKey)) return;
    ran.current = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const types = signupUnitTypes(data.user?.user_metadata?.production_units);
      if (!types.length) return;
      const company = (data.user?.user_metadata?.company_name as string | undefined)?.trim();
      const names: string[] = [];
      for (const type of types) {
        const name = company ? `${signupUnitLabel(type)} — ${company}` : signupUnitLabel(type);
        try {
          await addUnit({ name, type, description: '', isActive: true, capacity: 0, currentStock: 0, manager: '' });
          names.push(name);
        } catch { /* l'unité pourra être créée manuellement */ }
      }
      localStorage.setItem(doneKey, '1');
      if (names.length) { setActiveUnit?.(null); setCreated(names); }
    })();
  }, [user?.id, isLoadingUnits, units.length]);

  return (
    <Dialog open={created.length > 0} onOpenChange={(o) => !o && setCreated([])}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-primary" />Vos unités sont prêtes</DialogTitle>
          <DialogDescription>Les modules de chaque unité sont disponibles dans le menu.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 text-sm space-y-1">{created.map((n) => <li key={n}>{n}</li>)}</ul>
        <p className="text-sm text-muted-foreground">
          Vous pouvez gérer plusieurs unités ou plusieurs fermes au même endroit. Pour en ajouter, envoyez-nous une demande et nous les ajoutons à votre compte.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setCreated([])}>Plus tard</Button>
          <Button onClick={() => { setCreated([]); onRequest(); }}>Envoyer une demande</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
