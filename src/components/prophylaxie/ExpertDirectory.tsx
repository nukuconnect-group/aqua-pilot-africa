import { useEffect, useState } from 'react';
import { UserRound, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import ContactActions from '@/components/crm/ContactActions';

interface Expert {
  id: string; full_name: string; specialty: string; organization: string | null; city: string | null;
  country: string | null; phone: string | null; whatsapp: string | null; email: string | null;
  services: string | null; provides_products: boolean;
}

const EMPTY = { full_name: '', specialty: 'Expert en aquaculture', organization: '', city: '', country: '', phone: '', whatsapp: '', email: '', services: '', provides_products: false };

export default function ExpertDirectory({ context }: { context?: string }) {
  const { user } = useAuth();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('aqua_experts' as any).select('*').eq('is_active', true).order('full_name');
    setExperts((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (user?.id) {
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    }
  }, [user?.id]);

  const save = async () => {
    if (!form.full_name.trim() || !(form.phone.trim() || form.email.trim() || form.whatsapp.trim())) {
      toast({ title: 'Nom et au moins un moyen de contact requis', variant: 'destructive' }); return;
    }
    setSaving(true);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? (v.trim() || null) : v]));
    const { error } = await supabase.from('aqua_experts' as any).insert(payload as any);
    setSaving(false);
    if (error) { toast({ title: 'Enregistrement impossible', description: 'Seul un administrateur peut ajouter un expert.', variant: 'destructive' }); return; }
    setOpen(false); setForm(EMPTY); load();
  };

  const message = `Bonjour, j'utilise AquaPilote et j'ai besoin d'aide pour un problème sanitaire sur mes poissons${context ? ` (${context})` : ''}. Pouvez-vous m'accompagner pour le traitement ou les produits ?`;
  const set = (k: keyof typeof EMPTY, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><UserRound className="w-4 h-4" />Contactez un expert en aquaculture</CardTitle>
            <CardDescription>Experts, consultants et techniciens pouvant aider au traitement ou à trouver les produits.</CardDescription>
          </div>
          {isAdmin && <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Ajouter un expert</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : experts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun expert n'est encore inscrit dans l'annuaire.</p>
        ) : <div className="grid gap-3 sm:grid-cols-2">{experts.map((e) => {
          const photo = (e as any).photo_url || (e as any).avatar_url;
          const wa = (e.whatsapp || e.phone || '').replace(/\D/g, '');
          const initials = e.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
          return (
          <div key={e.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {photo ? <img src={photo} alt={e.full_name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
                : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{initials}</span>}
              <div className="min-w-0">
                <p className="font-semibold break-words">{e.full_name}</p>
                <p className="text-sm text-primary">{e.specialty}</p>
                <p className="text-xs text-muted-foreground">{[e.organization, e.city, e.country].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            {e.services && <p className="text-xs">{e.services}</p>}
            {(e.whatsapp || e.phone) && <p className="text-sm">WhatsApp : <a className="font-medium text-primary" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">{e.whatsapp || e.phone}</a></p>}
            {e.provides_products && <Badge variant="secondary" className="w-fit">Fournit des produits</Badge>}
            <ContactActions name={e.full_name} phone={e.whatsapp || e.phone || ''} email={e.email || ''} message={message} />
          </div>
          );
        })}</div>}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ajouter un expert</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {([
              ['full_name', 'Nom complet'], ['specialty', 'Spécialité (expert, consultant, technicien)'], ['organization', 'Structure'],
              ['city', 'Ville'], ['country', 'Pays'], ['phone', 'Téléphone'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['services', 'Services proposés'],
            ] as const).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={`exp-${k}`}>{label}</Label>
                <Input id={`exp-${k}`} value={form[k] as string} onChange={(ev) => set(k, ev.target.value)} />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.provides_products} onCheckedChange={(v) => set('provides_products', !!v)} />Fournit des produits de traitement
            </label>
          </div>
          <DialogFooter><Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
