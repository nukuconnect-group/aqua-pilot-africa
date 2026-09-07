import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, ShieldCheck, ShieldOff, Trash2, AlertTriangle, Key, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';
import MFAEnrollment from './MFAEnrollment';
import RecoveryCodesDisplay from './RecoveryCodesDisplay';
import { useRecoveryCodes } from '@/hooks/useRecoveryCodes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  created_at: string;
}

const MFASettings: React.FC = () => {
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [isDisabling, setIsDisabling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useSettings();
  const { 
    generateRecoveryCodes, 
    checkRecoveryCodes, 
    isGenerating,
    hasRecoveryCodes,
    remainingCodes 
  } = useRecoveryCodes();

  const fetchFactors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        throw error;
      }

      if (data) {
        // Filter to only show TOTP factors
        const totpFactors = data.totp.map(f => ({
          ...f,
          created_at: f.created_at || new Date().toISOString()
        }));
        setFactors(totpFactors);
      }
      
      // Check recovery codes status
      await checkRecoveryCodes();
    } catch (err: any) {
      console.error('Error fetching MFA factors:', err);
      setError(err.message || 'Erreur lors du chargement des paramètres 2FA');
    } finally {
      setIsLoading(false);
    }
  }, [checkRecoveryCodes]);

  useEffect(() => {
    fetchFactors();
  }, [fetchFactors]);

  const handleUnenroll = async (factorId: string) => {
    setIsDisabling(factorId);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId
      });

      if (error) {
        throw error;
      }

      toast({
        title: "2FA désactivé",
        description: "L'authentification à deux facteurs a été désactivée.",
      });

      await fetchFactors();
    } catch (err: any) {
      console.error('Error disabling MFA:', err);
      toast({
        title: t('error'),
        description: err.message || t('mfa_disable_error'),
        variant: "destructive",
      });
    } finally {
      setIsDisabling(null);
    }
  };

  const handleEnrollmentComplete = () => {
    setShowEnrollment(false);
    fetchFactors();
  };

  const handleGenerateNewCodes = async () => {
    const codes = await generateRecoveryCodes();
    if (codes) {
      setNewRecoveryCodes(codes);
      setShowRecoveryCodes(true);
    }
  };

  const handleRecoveryCodesComplete = () => {
    setShowRecoveryCodes(false);
    setNewRecoveryCodes([]);
    checkRecoveryCodes();
    toast({
      title: "Codes de récupération mis à jour",
      description: "Vos nouveaux codes de récupération ont été sauvegardés.",
    });
  };

  const verifiedFactors = factors.filter(f => f.status === 'verified');
  const hasMFA = verifiedFactors.length > 0;

  if (showEnrollment) {
    return (
      <MFAEnrollment
        onComplete={handleEnrollmentComplete}
        onCancel={() => setShowEnrollment(false)}
      />
    );
  }

  if (showRecoveryCodes && newRecoveryCodes.length > 0) {
    return (
      <RecoveryCodesDisplay
        codes={newRecoveryCodes}
        onComplete={handleRecoveryCodesComplete}
        isNewEnrollment={false}
      />
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasMFA ? (
                <ShieldCheck className="h-6 w-6 text-green-500" />
              ) : (
                <ShieldOff className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <CardTitle className="text-lg">Authentification à deux facteurs (2FA)</CardTitle>
                <CardDescription>
                  Ajoutez une couche de sécurité supplémentaire à votre compte
                </CardDescription>
              </div>
            </div>
            <Badge variant={hasMFA ? "default" : "secondary"}>
              {hasMFA ? "Activé" : "Désactivé"}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!hasMFA && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Protégez votre compte en activant l'authentification à deux facteurs. 
                Vous aurez besoin d'une application comme Google Authenticator ou Authy.
              </AlertDescription>
            </Alert>
          )}

          {verifiedFactors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Méthodes configurées</h4>
              {verifiedFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">
                        {factor.friendly_name || 'Application Authenticator'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Configuré le {new Date(factor.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={isDisabling === factor.id}
                      >
                        {isDisabling === factor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Désactiver le 2FA ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action supprimera l'authentification à deux facteurs de votre compte. 
                          Votre compte sera moins sécurisé. Vous pourrez le réactiver à tout moment.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleUnenroll(factor.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Désactiver
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => setShowEnrollment(true)}
            className="w-full"
            variant={hasMFA ? "outline" : "default"}
          >
            <Shield className="h-4 w-4 mr-2" />
            {hasMFA ? "Ajouter une autre méthode" : "Activer le 2FA"}
          </Button>
        </CardContent>
      </Card>

      {/* Recovery Codes Section */}
      {hasMFA && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="h-6 w-6 text-amber-500" />
              <div>
                <CardTitle className="text-lg">Codes de récupération</CardTitle>
                <CardDescription>
                  Utilisez ces codes pour accéder à votre compte si vous perdez votre téléphone
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {hasRecoveryCodes ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${remainingCodes <= 2 ? 'bg-amber-500' : 'bg-green-500'}`} />
                  <div>
                    <p className="font-medium text-sm">
                      {remainingCodes} code{remainingCodes > 1 ? 's' : ''} restant{remainingCodes > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {remainingCodes <= 2 
                        ? 'Pensez à régénérer vos codes' 
                        : 'Codes de secours disponibles'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Aucun code de récupération configuré. Générez des codes de secours pour pouvoir 
                  accéder à votre compte en cas de perte de votre téléphone.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleGenerateNewCodes}
              variant="outline"
              className="w-full"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {hasRecoveryCodes ? 'Régénérer les codes' : 'Générer des codes de récupération'}
                </>
              )}
            </Button>
            
            {hasRecoveryCodes && (
              <p className="text-xs text-muted-foreground text-center">
                La régénération invalidera tous les anciens codes
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MFASettings;
