import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Smartphone, Copy, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useRecoveryCodes } from '@/hooks/useRecoveryCodes';
import RecoveryCodesDisplay from './RecoveryCodesDisplay';

interface MFAEnrollmentProps {
  onComplete: () => void;
  onCancel: () => void;
}

type QrPayload =
  | { kind: 'uri'; value: string }
  | { kind: 'img'; src: string }
  | { kind: 'svg'; svg: string }
  | null;

function buildQrPayload(totp: { uri?: string | null; qr_code?: string | null }): QrPayload {
  const uri = (totp.uri ?? '').trim();
  if (uri) return { kind: 'uri', value: uri };

  const qr = (totp.qr_code ?? '').trim();
  if (!qr) return null;

  if (qr.startsWith('otpauth://')) return { kind: 'uri', value: qr };
  if (qr.startsWith('data:image/')) return { kind: 'img', src: qr };
  if (qr.startsWith('<svg')) return { kind: 'svg', svg: qr };

  // Fallback: treat as URI content
  return { kind: 'uri', value: qr };
}

const MFAEnrollment: React.FC<MFAEnrollmentProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'loading' | 'qr' | 'verify' | 'recovery'>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<QrPayload>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const { toast } = useToast();
  const { generateRecoveryCodes, isGenerating } = useRecoveryCodes();

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    try {
      setStep('loading');
      setError(null);

      // First, check for existing unverified factors and remove them
      const { data: existingFactors } = await supabase.auth.mfa.listFactors();

      if (existingFactors?.totp) {
        // Remove any unverified factors to allow re-enrollment
        for (const factor of existingFactors.totp) {
          // Check if factor is not verified (status can be 'verified' or other values)
          const isVerified = factor.status === 'verified';
          if (!isVerified) {
            console.log('Removing unverified factor:', factor.id);
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
          }
        }
      }

      // Generate a unique friendly name to avoid conflicts
      const timestamp = Date.now();
      const friendlyName = `AQUA PILOT ${timestamp}`;

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      });

      if (error) {
        // If still getting conflict, try with a different approach
        if (error.message?.includes('already exists') || error.code === 'mfa_factor_name_conflict') {
          // Try to find and use existing unverified factor
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const unverifiedFactor = factors?.totp?.find((f) => f.status !== 'verified');

          if (unverifiedFactor) {
            // We need to re-enroll, so delete and retry
            await supabase.auth.mfa.unenroll({ factorId: unverifiedFactor.id });

            // Retry enrollment with new name
            const retryResult = await supabase.auth.mfa.enroll({
              factorType: 'totp',
              friendlyName: `AQUA PILOT App ${Date.now()}`,
            });

            if (retryResult.error) {
              throw retryResult.error;
            }

            if (retryResult.data) {
              setFactorId(retryResult.data.id);
              setQrPayload(buildQrPayload(retryResult.data.totp));
              setSecret(retryResult.data.totp.secret);
              setStep('qr');
              return;
            }
          }
        }
        throw error;
      }

      if (data) {
        setFactorId(data.id);
        setQrPayload(buildQrPayload(data.totp));
        setSecret(data.totp.secret);
        setStep('qr');
      }
    } catch (err: any) {
      console.error('MFA enrollment error:', err);
      setError(err.message || 'Erreur lors de la configuration 2FA');
      setStep('qr');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!factorId || verifyCode.length !== 6) {
      setError('Veuillez entrer un code à 6 chiffres');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        throw challengeError;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) {
        throw verifyError;
      }

      // Generate recovery codes after successful MFA enrollment
      const codes = await generateRecoveryCodes();
      if (codes) {
        setRecoveryCodes(codes);
        setStep('recovery');
      } else {
        // If code generation fails, still complete but warn user
        toast({
          title: "⚠️ 2FA activé",
          description:
            "L'authentification à deux facteurs est active, mais les codes de récupération n'ont pas pu être générés.",
          variant: 'destructive',
        });
        onComplete();
      }
    } catch (err: any) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Code invalide. Vérifiez et réessayez.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecoveryComplete = () => {
    toast({
      title: '✅ 2FA activé',
      description: "L'authentification à deux facteurs et les codes de récupération sont configurés.",
    });
    onComplete();
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copié !',
        description: 'La clé secrète a été copiée dans le presse-papiers.',
      });
    }
  };

  if (step === 'loading') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Configuration du 2FA...</p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'recovery') {
    return (
      <RecoveryCodesDisplay codes={recoveryCodes} onComplete={handleRecoveryComplete} isNewEnrollment={true} />
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Configurer l'authentification 2FA</CardTitle>
        <CardDescription>
          Scannez le QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {(qrPayload?.kind === 'uri' || qrPayload?.kind === 'img' || qrPayload?.kind === 'svg') && (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-white rounded-lg border" aria-label="QR code 2FA" role="img">
              {qrPayload?.kind === 'uri' && <QRCodeSVG value={qrPayload.value} size={200} />}
              {qrPayload?.kind === 'img' && (
                <img src={qrPayload.src} alt="QR code 2FA" width={200} height={200} loading="lazy" />
              )}
              {qrPayload?.kind === 'svg' && (
                <div className="w-[200px] h-[200px]" dangerouslySetInnerHTML={{ __html: qrPayload.svg }} />
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Scannez avec votre application</span>
            </div>
          </div>
        )}

        {secret && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Ou entrez la clé manuellement :</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">{secret}</code>
              <Button type="button" variant="outline" size="icon" onClick={copySecret}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verifyCode">Code de vérification</Label>
            <Input
              id="verifyCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest font-mono"
              autoComplete="one-time-code"
            />
            <p className="text-xs text-muted-foreground text-center">
              Entrez le code à 6 chiffres de votre application
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || isGenerating || verifyCode.length !== 6}
              className="flex-1"
            >
              {isVerifying || isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isGenerating ? 'Génération codes...' : 'Vérification...'}
                </>
              ) : (
                'Activer 2FA'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default MFAEnrollment;

