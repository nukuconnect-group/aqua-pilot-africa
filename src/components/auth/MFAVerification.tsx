import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertTriangle, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import RecoveryCodeLogin from './RecoveryCodeLogin';

interface MFAVerificationProps {
  factorId: string;
  onVerified: () => void;
  onCancel: () => void;
  onVerifyRecoveryCode?: (code: string) => Promise<boolean>;
}

const MFAVerification: React.FC<MFAVerificationProps> = ({ 
  factorId, 
  onVerified, 
  onCancel,
  onVerifyRecoveryCode
}) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const { toast } = useToast();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      setError('Veuillez entrer un code à 6 chiffres');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code
      });

      if (verifyError) {
        throw verifyError;
      }

      toast({
        title: "✅ Vérification réussie",
        description: "Connexion autorisée.",
      });

      onVerified();
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Code invalide. Veuillez réessayer.');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecoveryCodeVerify = async (recoveryCode: string): Promise<boolean> => {
    if (onVerifyRecoveryCode) {
      return await onVerifyRecoveryCode(recoveryCode);
    }
    return false;
  };

  if (showRecoveryCode) {
    return (
      <RecoveryCodeLogin
        onVerified={onVerified}
        onBack={() => setShowRecoveryCode(false)}
        onVerifyCode={handleRecoveryCodeVerify}
      />
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Vérification 2FA requise</CardTitle>
        <CardDescription>
          Entrez le code à 6 chiffres de votre application d'authentification
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mfaCode" className="sr-only">Code 2FA</Label>
            <Input
              id="mfaCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-3xl tracking-widest font-mono h-16"
              autoComplete="one-time-code"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Ouvrez Google Authenticator, Authy ou votre app 2FA
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : (
                'Vérifier'
              )}
            </Button>
          </div>
        </form>

        {onVerifyRecoveryCode && (
          <div className="mt-4 pt-4 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowRecoveryCode(true)}
              className="w-full text-muted-foreground"
            >
              <Key className="h-4 w-4 mr-2" />
              Utiliser un code de récupération
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MFAVerification;
