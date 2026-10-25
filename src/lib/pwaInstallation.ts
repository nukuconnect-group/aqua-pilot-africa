export type InstallationStatus = 'installed' | 'not-installed' | 'unknown';
export const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'aqua-install-dismissed-at';

export function installationStatus(confirmed: boolean, nativePrompt: boolean): InstallationStatus {
  return confirmed ? 'installed' : nativePrompt ? 'not-installed' : 'unknown';
}

export function canInvite(status: InstallationStatus, standalone: boolean, dismissedAt: number, now: number): boolean {
  return status === 'not-installed' && !standalone && (!dismissedAt || now - dismissedAt >= INSTALL_DISMISS_MS);
}

export function dismissedAt(): number {
  try { return Number(localStorage.getItem(DISMISS_KEY)) || 0; } catch { return 0; }
}
export function rememberDismissal(): void {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Storage is optional, never installation evidence. */ }
}

export function installInstructions(): { title: string; steps: string[] } {
  const ua = navigator.userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return { title: 'iPhone / iPad', steps: ['Ouvrez AquaPilote dans Safari.', 'Touchez Partager, puis « Sur l’écran d’accueil » (ou « Ajouter à l’écran d’accueil »).', 'Activez « Ouvrir comme app » si proposé, puis touchez « Ajouter ».'] };
  if (/android/.test(ua)) return { title: 'Android', steps: ['Ouvrez le menu ⋮ de votre navigateur.', 'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil », si disponible.', 'Confirmez l’ajout d’AquaPilote.'] };
  if (/safari/.test(ua) && !/chrome|chromium|edg/.test(ua)) return { title: 'Mac — Safari', steps: ['Dans Safari récent, ouvrez le menu Fichier.', 'Choisissez « Ajouter au Dock… », si disponible, puis confirmez.'] };
  if (/firefox/.test(ua)) return { title: 'Ordinateur — Firefox', steps: ['Si votre navigateur propose une option d’installation, choisissez-la dans son menu.', 'Sinon, ouvrez AquaPilote dans Chrome ou Edge pour disposer de l’installation native.'] };
  return { title: 'Ordinateur / navigateur compatible', steps: ['Cliquez sur l’icône d’installation dans la barre d’adresse, si disponible.', 'Sinon, ouvrez le menu du navigateur et cherchez « Installer AquaPilote » ou « Ajouter aux applications ».', 'Confirmez l’installation si cette option est proposée.'] };
}