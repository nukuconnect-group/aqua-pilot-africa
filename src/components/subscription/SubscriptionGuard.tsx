import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Wraps a module. If the current subscription is expired/cancelled,
 * shows a blocking screen with a CTA to the subscription page.
 * Admin & team members are exempt.
 */
export const SubscriptionGuard: React.FC<{ children: React.ReactNode; moduleId?: string }> = ({ children, moduleId }) => {
  const { subscription, loading } = useCurrentSubscription();
  const { user, isDemoMode } = useAuth();
  const navigate = useNavigate();

  if (moduleId === 'aqua-assistant' || loading || isDemoMode || !user) return <>{children}</>;
  if (user.role === 'admin' || user.isTeamMember) return <>{children}</>;
  if (!subscription || subscription.isActive) return <>{children}</>;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 border-primary/30">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Votre essai est terminé</h2>
          <p className="text-muted-foreground">
            Votre Pack Découverte a expiré. Vos données sont conservées en sécurité.
            Souscrivez à un plan pour continuer à profiter d'AquaPilote.
          </p>
          <Button size="lg" onClick={() => navigate('/subscription')} className="w-full">
            <Sparkles className="w-4 h-4 mr-2" />
            Voir les abonnements
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionGuard;
