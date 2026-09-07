import { SUPABASE_URL } from '@/integrations/supabase/env';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Smartphone, X, Monitor } from 'lucide-react';
import aquaPilotLogo from '@/assets/aqua-pilot-logo-small.webp';
import { supabase } from '@/integrations/supabase/appClient';
import { detectDevice } from '@/lib/deviceDetection';
import { usePWAInstallState, supportsInstallPrompt } from '@/hooks/usePWAInstallState';

const PWAInstallPrompt: React.FC = () => {
  const { isInstalled, canPromptInstall, isReady, promptInstall } = usePWAInstallState();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem('pwa-install-dismissed') === 'true'; } catch { return false; }
  });
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDelayElapsed(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

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

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setDismissed(true);
      trackInstall();
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    try { sessionStorage.setItem('pwa-install-dismissed', 'true'); } catch {}
  };

  // Ne jamais proposer l'installation si l'app est déjà installée / lancée en mode app
  if (isInstalled || dismissed || !isReady || !delayElapsed) return null;

  // Sur navigateurs Chromium, on n'affiche la bannière que si une installation
  // native est réellement possible (sinon = déjà installée ou non éligible).
  const manualOnly = !supportsInstallPrompt();
  if (!canPromptInstall && !manualOnly) return null;

  const isMobile = /mobile|android|iphone|ipad|phone/.test(navigator.userAgent.toLowerCase());
  const DeviceIcon = isMobile ? Smartphone : Monitor;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center md:left-auto md:right-4 md:max-w-sm">
      <Card className="w-full max-w-sm shadow-2xl border-aqua-200 bg-card/95 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <img src={aquaPilotLogo} alt="AQUAPILOTE" className="w-10 h-10 rounded-lg flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold truncate">Installer AQUAPILOTE</h3>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {isMobile
                  ? "Installez l'app sur votre téléphone pour un accès rapide et hors-ligne"
                  : "Installez l'app sur votre ordinateur pour un accès rapide depuis le bureau"}
                {manualOnly && " (via le menu de votre navigateur)"}
              </p>

              <div className="flex gap-2">
                {canPromptInstall ? (
                  <Button onClick={handleInstallClick} size="sm" className="flex-1 bg-gradient-aqua text-primary-foreground text-xs h-8">
                    <Download className="w-3 h-3 mr-1" />
                    Installer
                  </Button>
                ) : (
                  <Button onClick={handleDismiss} size="sm" className="flex-1 bg-gradient-aqua text-primary-foreground text-xs h-8">
                    J'ai compris
                  </Button>
                )}
                <Button onClick={handleDismiss} variant="ghost" size="sm" className="text-xs h-8 px-3">
                  Plus tard
                </Button>
              </div>

              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <DeviceIcon className="w-3 h-3" />
                <span>{isMobile ? "Ajout à l'écran d'accueil" : 'Application de bureau'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
