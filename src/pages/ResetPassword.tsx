import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(!!session);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        toast({ title: 'Erreur de vérification', description: error.message, variant: 'destructive' });
      }
      setHasSession(!!data.session);
    }).catch((error: unknown) => {
      if (!active) return;
      toast({
        title: 'Erreur de vérification',
        description: error instanceof Error ? error.message : 'Impossible de vérifier le lien.',
        variant: 'destructive',
      });
      setHasSession(false);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Mot de passe trop court', description: 'Utilisez au moins 8 caractères.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Les mots de passe ne correspondent pas', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        setHasSession(false);
        throw new Error('Le lien a expiré ou a déjà été utilisé. Demandez un nouveau lien de réinitialisation.');
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({ title: 'Mot de passe modifié', description: 'Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.' });
      navigate('/auth', { replace: true });
    } catch (error) {
      toast({
        title: 'Impossible de modifier le mot de passe',
        description: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <KeyRound className="w-10 h-10 mx-auto text-primary mb-2" />
          <CardTitle>Modifier votre mot de passe</CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte AquaPilote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession === null ? (
            <p className="text-center text-sm text-muted-foreground">Vérification du lien...</p>
          ) : !hasSession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis la page de connexion.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Retour à la connexion</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPassword;
