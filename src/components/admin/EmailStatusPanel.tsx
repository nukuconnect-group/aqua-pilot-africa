import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { Mail, MailCheck, MailWarning, RefreshCw, Send, CheckCircle2, XCircle, Search, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EmailUser {
  id: string;
  email: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  confirmation_sent_at: string | null;
  full_name?: string | null;
  is_activated?: boolean | null;
}

interface EmailStatusResponse {
  total: number;
  confirmed_count: number;
  pending_count: number;
  never_signed_in_count: number;
  users: EmailUser[];
  config: {
    resend_configured: boolean;
    lovable_ai_configured: boolean;
    supabase_url: string;
  };
}

type Filter = 'all' | 'confirmed' | 'pending' | 'never_signed_in';

const EmailStatusPanel: React.FC = () => {
  const { toast } = useToast();
  const [data, setData] = useState<EmailStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke('admin-email-status');
      if (error) throw error;
      setData(resp as EmailStatusResponse);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message ?? 'Chargement impossible', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resend = async (email: string) => {
    setResending(email);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast({ title: 'Email renvoyé', description: `Un nouvel email de confirmation a été envoyé à ${email}.` });
    } catch (e: any) {
      toast({ title: 'Échec', description: e.message ?? 'Impossible de renvoyer', variant: 'destructive' });
    } finally {
      setResending(null);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.users;
    if (filter === 'confirmed') list = list.filter((u) => !!u.email_confirmed_at);
    else if (filter === 'pending') list = list.filter((u) => !u.email_confirmed_at);
    else if (filter === 'never_signed_in') list = list.filter((u) => !!u.email_confirmed_at && !u.last_sign_in_at);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((u) => u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q));
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [data, filter, search]);

  return (
    <div className="space-y-4">
      {/* Config check */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-primary" /> Configuration des emails
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
            {data?.config.resend_configured ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
            <span>Resend (SMTP) : <strong>{data?.config.resend_configured ? 'Configuré' : 'Manquant'}</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
            {data?.config.lovable_ai_configured ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
            <span>Lovable AI : <strong>{data?.config.lovable_ai_configured ? 'Configuré' : 'Manquant'}</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Auto-login à la confirmation : <strong>Activé</strong> (redirection vers <code>/dashboard</code>)</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total comptes</p><p className="text-2xl font-bold">{data?.total ?? '—'}</p></div><Mail className="w-8 h-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Emails confirmés</p><p className="text-2xl font-bold text-green-600">{data?.confirmed_count ?? '—'}</p></div><MailCheck className="w-8 h-8 text-green-500" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">En attente</p><p className="text-2xl font-bold text-amber-600">{data?.pending_count ?? '—'}</p></div><MailWarning className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Jamais connectés</p><p className="text-2xl font-bold">{data?.never_signed_in_count ?? '—'}</p></div><XCircle className="w-8 h-8 text-muted-foreground" /></div></CardContent></Card>
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Statut des emails utilisateurs</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Tous</Button>
              <Button size="sm" variant={filter === 'confirmed' ? 'default' : 'outline'} onClick={() => setFilter('confirmed')}>Confirmés</Button>
              <Button size="sm" variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>En attente</Button>
              <Button size="sm" variant={filter === 'never_signed_in' ? 'default' : 'outline'} onClick={() => setFilter('never_signed_in')}>Jamais connectés</Button>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par email ou nom..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun résultat.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => {
                const confirmed = !!u.email_confirmed_at;
                const neverIn = confirmed && !u.last_sign_in_at;
                return (
                  <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{u.full_name || 'Sans nom'}</p>
                        {confirmed ? (
                          <Badge className="bg-green-600 hover:bg-green-700">Confirmé</Badge>
                        ) : (
                          <Badge variant="destructive">Non confirmé</Badge>
                        )}
                        {neverIn && <Badge variant="outline">Jamais connecté</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {u.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inscrit {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: fr })}
                        {u.last_sign_in_at ? ` · Dernière connexion ${formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true, locale: fr })}` : ''}
                        {!confirmed && u.confirmation_sent_at ? ` · Email envoyé ${formatDistanceToNow(new Date(u.confirmation_sent_at), { addSuffix: true, locale: fr })}` : ''}
                      </p>
                    </div>
                    {!confirmed && u.email && (
                      <Button size="sm" variant="outline" onClick={() => resend(u.email!)} disabled={resending === u.email}>
                        <Send className="w-4 h-4 mr-1" />
                        {resending === u.email ? 'Envoi…' : 'Renvoyer'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailStatusPanel;
