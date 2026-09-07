import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, Plus, Pause, Play, Ban, Trash2, CheckCircle, Loader2, Clock, History, Filter, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, addYears } from 'date-fns';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: 'active' | 'suspended' | 'cancelled' | 'expired' | string;
  start_date: string;
  end_date: string;
  price: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
}

interface UserLite {
  id: string;
  email: string;
  full_name: string;
}

interface SubscriptionsPanelProps {
  users: UserLite[];
}

const PLANS = [
  { value: 'trial_discovery', label: 'Pack Découverte (30j)' },
  { value: 'annual_basic', label: 'Annuel - Basic' },
  { value: 'annual_pro', label: 'Annuel - Pro' },
  { value: 'annual_enterprise', label: 'Annuel - Enterprise' },
];

const STATUS_COLORS: Record<string, string> = {
  trial: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  active: 'bg-green-500/10 text-green-700 dark:text-green-400',
  suspended: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-400',
  expired: 'bg-muted text-muted-foreground',
};

const SubscriptionsPanel: React.FC<SubscriptionsPanelProps> = ({ users }) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'active' | 'history'>('all');

  const [form, setForm] = useState({
    userId: '',
    plan: 'annual_basic',
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    price: '',
    notes: '',
  });

  const usersById = useMemo(() => {
    const m = new Map<string, UserLite>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setSubs((data as SubscriptionRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      userId: '',
      plan: 'annual_basic',
      start: format(new Date(), 'yyyy-MM-dd'),
      end: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
      price: '',
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!form.userId) {
      toast({ title: 'Sélectionnez un utilisateur', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('subscriptions').insert({
      user_id: form.userId,
      plan: form.plan,
      status: 'active',
      start_date: form.start,
      end_date: form.end,
      price: form.price ? Number(form.price) : null,
      currency: 'XOF',
      notes: form.notes || null,
      created_by: currentUser?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Abonnement attribué', description: 'Le client a été abonné avec succès.' });
    setDialogOpen(false);
    resetForm();
    load();
  };

  const updateStatus = async (id: string, status: SubscriptionRow['status'], blockUserId?: string) => {
    const { error } = await supabase.from('subscriptions').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    // Optionally suspend/unsuspend the linked profile to block app access
    if (blockUserId) {
      const suspend = status === 'suspended' || status === 'cancelled';
      await supabase
        .from('profiles')
        .update({
          is_suspended: suspend,
          suspension_reason: suspend ? 'Abonnement ' + status : null,
          suspended_at: suspend ? new Date().toISOString() : null,
        })
        .eq('id', blockUserId);
    }
    toast({ title: 'Statut mis à jour' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet abonnement ?')) return;
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Abonnement supprimé' });
    load();
  };

  const extendTrial = async (id: string, days: number) => {
    const { error } = await supabase.rpc('extend_subscription', { _subscription_id: id, _days: days });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `+${days} jours ajoutés à l'abonnement` });
    load();
  };

  const simulateExpiration = async (id: string, userId: string) => {
    if (!confirm("Simuler l'expiration de cet abonnement ? L'utilisateur sera redirigé vers /subscription à sa prochaine navigation.")) return;
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'expired', end_date: yesterday })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Expiration simulée',
      description: "L'abonnement est marqué comme expiré. Rechargez le dashboard pour voir la redirection.",
    });
    load();
  };

  const displayedSubs = subs.filter((s) => {
    if (historyFilter === 'active') return s.status === 'active' || s.status === 'trial';
    if (historyFilter === 'history') return s.status === 'expired' || s.status === 'cancelled';
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-primary" /> Abonnements entreprises
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={historyFilter} onValueChange={(v: any) => setHistoryFilter(v)}>
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="w-3.5 h-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs & Essais</SelectItem>
                <SelectItem value="history">Historique</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Attribuer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
            </div>
          ) : displayedSubs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Aucun abonnement attribué pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise / Utilisateur</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedSubs.map((s) => {
                    const u = usersById.get(s.user_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{u?.full_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{u?.email || s.user_id.slice(0, 8)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{PLANS.find((p) => p.value === s.plan)?.label || s.plan}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(s.start_date), 'dd/MM/yyyy')}
                          <br />→ {format(new Date(s.end_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          {s.price ? `${s.price.toLocaleString('fr-FR')} ${s.currency || 'XOF'}` : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>
                            {s.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {s.status === 'trial' && (
                            <Button size="sm" variant="outline" title="Prolonger l'essai de 15 jours" onClick={() => extendTrial(s.id, 15)}>
                              <Clock className="w-3.5 h-3.5 mr-1" /> +15j
                            </Button>
                          )}
                          {(s.status === 'trial' || s.status === 'active') && (
                            <Button size="icon" variant="ghost" title="Simuler l'expiration (test)" onClick={() => simulateExpiration(s.id, s.user_id)}>
                              <FlaskConical className="w-4 h-4 text-purple-500" />
                            </Button>
                          )}
                          {s.status === 'active' ? (
                            <Button size="icon" variant="ghost" title="Suspendre" onClick={() => updateStatus(s.id, 'suspended', s.user_id)}>
                              <Pause className="w-4 h-4 text-orange-500" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" title="Réactiver" onClick={() => updateStatus(s.id, 'active', s.user_id)}>
                              <Play className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Bloquer (annuler)" onClick={() => updateStatus(s.id, 'cancelled', s.user_id)}>
                            <Ban className="w-4 h-4 text-red-500" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Supprimer" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Nouvel abonnement annuel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Utilisateur / Entreprise</Label>
              <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Début</Label>
                <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </div>
              <div>
                <Label>Fin</Label>
                <Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Prix (XOF)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="120000" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Créer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionsPanel;