import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, Info } from 'lucide-react';
import { usePWAInstallState } from '@/hooks/usePWAInstallState';
import { installInstructions } from '@/lib/pwaInstallation';
import logo from '@/assets/aquapilote-logo.png';

export const InstallationInstructions = () => {
  const info = installInstructions();
  return <div className="space-y-2 border-t border-border pt-4 text-sm">
    <h4 className="font-medium">Installation — {info.title}</h4>
    <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">{info.steps.map(step => <li key={step}>{step}</li>)}</ol>
  </div>;
};
const PWAInstallCard = () => {
  const { status, canPromptInstall, promptInstall, busy, isStandalone } = usePWAInstallState();
  const [instructions, setInstructions] = useState(false);
  const [message, setMessage] = useState('');
  const install = async () => {
    if (!canPromptInstall) { setInstructions(true); return; }
    const outcome = await promptInstall();
    if (outcome === 'accepted') setMessage('Demande transmise au navigateur. Le statut sera mis à jour lorsque l’installation sera confirmée.');
    if (outcome === 'unavailable') setInstructions(true);
  };
  return <section aria-label="Installation de l’application" className="space-y-4 border-y border-border py-5">
    <div className="flex items-center gap-3">
      <img src={logo} alt="AquaPilote" width={64} height={64} className="h-14 w-14 shrink-0 rounded-md object-contain" />
      <div className="min-w-0"><h3 className="text-base font-semibold">Installation de l’application</h3>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">{status === 'installed' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
        {status === 'installed' ? 'Application installée sur cet appareil' : status === 'not-installed' ? 'Application non installée' : 'Statut d’installation non vérifiable'}</p>
      </div>
    </div>
    {status !== 'installed' && <>
      {status === 'unknown' && <p className="text-sm text-muted-foreground">{isStandalone ? 'AquaPilote est ouvert en mode application. ' : ''}Ce navigateur ne permet pas de confirmer une installation existante. Si vous disposez déjà de l’icône AquaPilote, ouvrez-la depuis votre appareil.</p>}
      <Button onClick={install} disabled={busy} className="w-full gap-2 sm:w-auto"><Download className="h-4 w-4" />{canPromptInstall || status === 'not-installed' ? 'Installer AquaPilote' : 'Voir les instructions d’installation'}</Button>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {instructions && <InstallationInstructions />}
    </>}
  </section>;
};
export default PWAInstallCard;
