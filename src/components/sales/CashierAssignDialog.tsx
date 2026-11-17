import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTeamMembers, type TeamMember } from '@/hooks/useTeamMembers';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { Users } from 'lucide-react';

/** L'administrateur choisit les membres de l'équipe autorisés à vendre dans cette caisse. */
export default function CashierAssignDialog({ sessionId, current, onSaved }: { sessionId: string; current: string[]; onSaved: () => void }) {
  const { teamMembers } = useTeamMembers();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setIds(current); }, [open, current]);
  const members = teamMembers.filter((member): member is TeamMember & { user_id: string } => member.status === 'active' && Boolean(member.user_id));

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('cash_sessions').update({ cashier_ids: ids }).eq('id', sessionId);
    setBusy(false);
    if (error) { toast({ title: 'Caissiers non enregistrés', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Caissiers enregistrés' });
    setOpen(false); onSaved();
  };

  return (
    <>
      <Button variant="registerAction" size="sm" onClick={() => setOpen(true)}><Users className="h-4 w-4" />Caissiers ({current.length})</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Caissiers de cette caisse</DialogTitle></DialogHeader>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ajoutez d’abord des utilisateurs dans le module Équipe, avec accès à cette unité. Ils apparaîtront ici.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <label key={m.user_id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                  <Checkbox checked={ids.includes(m.user_id)} onCheckedChange={(v) => setIds(p => v ? [...p, m.user_id] : p.filter(x => x !== m.user_id))} />
                  <div className="min-w-0"><p className="font-medium truncate">{m.member_name}</p><p className="text-xs text-muted-foreground truncate">{m.member_email}</p></div>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">Seuls les caissiers cochés verront cette caisse et pourront y vendre.</p>
              <Button className="w-full" disabled={busy} onClick={save}>Enregistrer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
