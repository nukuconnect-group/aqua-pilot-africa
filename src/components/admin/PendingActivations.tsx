import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, Clock, Mail, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PendingUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  country: string | null;
}

export const PendingActivations: React.FC = () => {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,created_at,country')
      .eq('is_activated', false)
      .order('created_at', { ascending: false });
    if (!error && data) setPending(data as PendingUser[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`pending-activations-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const activate = async (u: PendingUser) => {
    setActivatingId(u.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_activated: true })
        .eq('id', u.id);
      if (error) throw error;

      // Notifier l'utilisateur
      await supabase.from('notifications').insert({
        user_id: u.id,
        title: 'Compte activé ✅',
        message: 'Votre compte AquaPilote a été activé par un administrateur. Vous pouvez maintenant vous connecter et utiliser toutes les fonctionnalités.',
        type: 'success',
        module: 'Compte',
        is_critical: false,
      });

      toast({ title: 'Compte activé', description: `${u.full_name || u.email} peut maintenant se connecter.` });
      setPending((p) => p.filter((x) => x.id !== u.id));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Comptes en attente d'activation
          {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <span>
            Depuis la mise à jour SaaS, <strong>tous les nouveaux comptes sont activés automatiquement</strong> et reçoivent un essai gratuit de 30 jours. Cette liste ne devrait normalement pas contenir de comptes.
          </span>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">Chargement…</p>
        ) : pending.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Aucun compte en attente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((u) => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.full_name || 'Sans nom'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3" /> {u.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Inscrit {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: fr })}
                    {u.country ? ` · ${u.country}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={activatingId === u.id}
                  onClick={() => activate(u)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <UserCheck className="w-4 h-4 mr-1" />
                  {activatingId === u.id ? 'Activation…' : 'Activer'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingActivations;