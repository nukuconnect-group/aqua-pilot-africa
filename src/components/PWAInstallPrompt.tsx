import { SUPABASE_URL } from '@/integrations/supabase/env';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, X } from 'lucide-react';
import logo from '@/assets/aquapilote-logo.png';
import engineer from '@/assets/install-aquaculture-engineer.jpg';
import { supabase } from '@/integrations/supabase/appClient';
import { detectDevice } from '@/lib/deviceDetection';
import { usePWAInstallState } from '@/hooks/usePWAInstallState';
import { canInvite, dismissedAt, rememberDismissal } from '@/lib/pwaInstallation';
import { InstallationInstructions } from './PWAInstallCard';

const PWAInstallPrompt = () => {
  const { status, isStandalone, isReady, canPromptInstall, promptInstall, busy } = usePWAInstallState();
  const [dismissed, setDismissed] = useState(() => dismissedAt());
  const [delayElapsed, setDelayElapsed] = useState(false);
  const [instructions, setInstructions] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setDelayElapsed(true), 30000); return () => window.clearTimeout(timer); }, []);
  const dismiss = () => { rememberDismissal(); setDismissed(Date.now()); };
  const trackInstall = async () => {
    try {
      const device = detectDevice(navigator.userAgent);
      let country = 'Inconnu';
      let countryCode = 'XX';
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/detect-country`);
        if (resp.ok) {
          const data = await resp.json();
          country = data.country || 'Inconnu';
          countryCode = data.countryCode || 'XX';
        }
      } catch {}
      await supabase.from('pwa_installs' as any).insert({
        session_id: `pwa-${Date.now()}`,
        device_type: device.deviceType,
        device_info: device.deviceInfo,
        country,
        country_code: countryCode,
        user_agent: navigator.userAgent.substring(0, 500),
      });
    } catch (e) {
      console.error('Error tracking PWA install:', e);
    }
  };

  const install = async () => {
    if (!canPromptInstall) { setInstructions(true); return; }
    const outcome = await promptInstall();
    if (outcome === 'accepted') { void trackInstall(); dismiss(); }
    else if (outcome === 'dismissed') dismiss();
    else setInstructions(true);
  };
  const open = isReady && delayElapsed && canInvite(status, isStandalone, dismissed, Date.now());
  return <Dialog open={open} onOpenChange={value => { if (!value) dismiss(); }}>
    <DialogContent hideClose className="z-[10050] top-auto bottom-[max(1rem,env(safe-area-inset-bottom))] w-[calc(100%-1.5rem)] max-w-md translate-y-0 gap-0 overflow-hidden rounded-lg p-0 max-h-[calc(100dvh-2rem)] overflow-y-auto sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2">
      <div className="relative">
        <img src={engineer} alt="Ingénieure aquacole auprès de bassins piscicoles" width={1200} height={800} loading="lazy" className="h-32 w-full object-cover object-top sm:h-48" />
        <Button variant="secondary" size="icon" onClick={dismiss} aria-label="Fermer l’invitation" className="absolute right-2 top-2 h-11 w-11 shadow-sm"><X className="h-5 w-5" /></Button>
      </div>
      <div className="space-y-3 p-4 sm:p-6">
        <img src={logo} alt="AquaPilote" width={56} height={56} className="h-12 w-12 object-contain" />
        <DialogTitle className="text-lg leading-snug tracking-normal sm:text-xl">Emportez AquaPilote partout avec vous</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">Accédez rapidement à votre exploitation aquacole, suivez vos indicateurs et consultez vos recommandations intelligentes directement depuis votre appareil.</DialogDescription>
        {instructions && <InstallationInstructions />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={install} disabled={busy} className="min-h-11 flex-1 gap-2"><Download className="h-4 w-4" />Installer AquaPilote</Button>
          <Button variant="outline" onClick={dismiss} className="min-h-11">Plus tard</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
};
export default PWAInstallPrompt;
