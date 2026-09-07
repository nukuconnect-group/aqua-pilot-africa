import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Users, ChevronDown, ChevronRight, Search, Key, Ban, PlayCircle, Send, Copy, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';

interface Owner {
  id: string;
  email: string;
  full_name: string;
}

interface Member {
  id: string;
  owner_id: string;
  member_email: string;
  member_name: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  user_id: string | null;
  invited_at: string;
  accepted_at: string | null;
}

interface Props {
  owners: Owner[];
}

const TeamMembersOverviewPanel: React.FC<Props> = ({ owners }) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openOwner, setOpenOwner] = useState<string | null>(null);
  const [resetDialog, setResetDialog] = useState<Member | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('team_members')
      .select('id, owner_id, member_email, member_name, role, status, user_id, invited_at, accepted_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setMembers((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Member[]>();
    members.forEach((m) => {
      const arr = map.get(m.owner_id) || [];
      arr.push(m);
      map.set(m.owner_id, arr);
    });
    return owners
      .map((o) => ({ owner: o, members: map.get(o.id) || [] }))
      .filter((g) => g.members.length > 0)
      .filter((g) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          g.owner.full_name?.toLowerCase().includes(q) ||
          g.owner.email?.toLowerCase().includes(q) ||
          g.members.some(
            (m) =>
              m.member_email.toLowerCase().includes(q) ||
              m.member_name.toLowerCase().includes(q),
          )
        );
      })
      .sort((a, b) => b.members.length - a.members.length);
  }, [members, owners, search]);

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === 'active').length;
  const pendingMembers = members.filter((m) => m.status === 'pending' || !m.user_id).length;

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  };

  const handleToggleStatus = async (m: Member) => {
    const newStatus = m.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('team_members')
      .update({ status: newStatus })
      .eq('id', m.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: newStatus === 'active' ? 'Membre réactivé' : 'Membre désactivé' });
    load();
  };

  const handleResetPassword = async () => {
    if (!resetDialog) return;
    setProcessing(true);
    const pw = generatePassword();
    const { data, error } = await supabase.functions.invoke('reset-team-member-password', {
      body: { team_member_id: resetDialog.id, new_password: pw },
    });
    setProcessing(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Erreur',
        description: error?.message || (data as any)?.error || 'Impossible de réinitialiser le mot de passe',
        variant: 'destructive',
      });
      return;
    }
    setNewPassword(pw);
    toast({ title: 'Mot de passe généré', description: 'Communiquez-le en toute sécurité au membre.' });
  };

  const handleSendResetLink = async (m: Member) => {
    const { error } = await supabase.auth.resetPasswordForEmail(m.member_email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Lien envoyé', description: `Un lien de réinitialisation a été envoyé à ${m.member_email}` });
  };

  const copyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    toast({ title: 'Copié' });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Membres d'équipe par utilisateur
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{totalMembers} membres</Badge>
              <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">{activeMembers} actifs</Badge>
              {pendingMembers > 0 && (
                <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
                  {pendingMembers} en attente
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={load} title="Recharger">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un propriétaire ou un membre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Aucun utilisateur n'a encore ajouté de membres à son équipe.
            </p>
          ) : (
            <div className="space-y-2">
              {grouped.map(({ owner, members: teamMembers }) => {
                const active = teamMembers.filter((m) => m.status === 'active').length;
                const issues = teamMembers.filter((m) => !m.user_id || m.status === 'pending').length;
                const isOpen = openOwner === owner.id;
                return (
                  <Collapsible key={owner.id} open={isOpen} onOpenChange={(o) => setOpenOwner(o ? owner.id : null)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                          <div className="text-left min-w-0">
                            <div className="font-medium truncate">{owner.full_name || owner.email}</div>
                            <div className="text-xs text-muted-foreground truncate">{owner.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary">{teamMembers.length} membre{teamMembers.length > 1 ? 's' : ''}</Badge>
                          {active > 0 && (
                            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">{active} actifs</Badge>
                          )}
                          {issues > 0 && (
                            <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400 hidden sm:inline-flex">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {issues} à traiter
                            </Badge>
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 border rounded-lg overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nom</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Rôle</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Accès</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teamMembers.map((m) => (
                              <TableRow key={m.id}>
                                <TableCell className="font-medium">{m.member_name}</TableCell>
                                <TableCell className="text-sm">{m.member_email}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{m.role}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      m.status === 'active'
                                        ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                        : m.status === 'pending'
                                        ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                                        : 'bg-muted text-muted-foreground'
                                    }
                                  >
                                    {m.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {m.user_id ? (
                                    <Badge variant="secondary" className="text-xs">Compte OK</Badge>
                                  ) : (
                                    <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs">
                                      Sans compte
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Envoyer un lien de réinitialisation par email"
                                    onClick={() => handleSendResetLink(m)}
                                  >
                                    <Send className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Générer un nouveau mot de passe"
                                    disabled={!m.user_id}
                                    onClick={() => {
                                      setResetDialog(m);
                                      setNewPassword(null);
                                    }}
                                  >
                                    <Key className="w-4 h-4" />
                                  </Button>
                                  {m.status === 'active' ? (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Désactiver"
                                      className="text-orange-600"
                                      onClick={() => handleToggleStatus(m)}
                                    >
                                      <Ban className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      title="Réactiver"
                                      className="text-green-600"
                                      onClick={() => handleToggleStatus(m)}
                                    >
                                      <PlayCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetDialog} onOpenChange={(o) => { if (!o) { setResetDialog(null); setNewPassword(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer un nouveau mot de passe</DialogTitle>
            <DialogDescription>
              {resetDialog && `Pour ${resetDialog.member_name} (${resetDialog.member_email})`}
            </DialogDescription>
          </DialogHeader>
          {newPassword ? (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">{newPassword}</div>
              <p className="text-xs text-muted-foreground">
                Copiez ce mot de passe et transmettez-le au membre en toute sécurité. Il ne sera plus visible après.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Un nouveau mot de passe fort sera généré et appliqué immédiatement au compte.
            </p>
          )}
          <DialogFooter>
            {newPassword ? (
              <>
                <Button variant="outline" onClick={copyPassword}>
                  <Copy className="w-4 h-4 mr-2" /> Copier
                </Button>
                <Button onClick={() => { setResetDialog(null); setNewPassword(null); }}>Fermer</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setResetDialog(null)}>Annuler</Button>
                <Button onClick={handleResetPassword} disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                  Générer
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamMembersOverviewPanel;