import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getModuleDefinition } from '@/lib/planModules';

interface ModuleNotIncludedProps {
  moduleId: string;
  onBack?: () => void;
}

/** Écran affiché quand un module n'est pas inclus dans l'abonnement. */
export const ModuleNotIncluded: React.FC<ModuleNotIncludedProps> = ({ moduleId, onBack }) => {
  const navigate = useNavigate();
  const definition = getModuleDefinition(moduleId);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4" data-module-locked={moduleId}>
      <Card className="max-w-lg w-full border-2 border-muted">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Fonctionnalité non disponible</h2>
          <p className="text-muted-foreground">
            {definition ? `Le module « ${definition.name} » n'est pas inclus` : "Cette fonctionnalité n'est pas incluse"} dans
            votre abonnement actuel. Vos données existantes restent conservées et redeviendront accessibles si le module est
            réactivé.
          </p>
          <p className="text-sm text-muted-foreground">
            Contactez l'administrateur de votre organisation pour modifier votre abonnement.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate('/subscription')}>
              <Sparkles className="w-4 h-4 mr-2" />
              Voir les abonnements
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                Retour au tableau de bord
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ModuleNotIncluded;
