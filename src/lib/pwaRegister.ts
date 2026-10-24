/**
 * Enregistrement unique du service worker hors connexion (/sw.js, généré par vite-plugin-pwa).
 * Jamais en dev ni dans les aperçus Lovable ; ?sw=off désactive tout et nettoie.
 * Les mises à jour s'installent en arrière-plan et ne s'appliquent que quand
 * l'application n'est pas à l'écran, pour ne jamais effacer une saisie en cours.
 */

const PROJECT_ID = 'b2c5432d-e362-4fa8-8b60-f39686099c32';

const isRefusedHost = () => {
  const h = window.location.hostname.toLowerCase();
  const first = h.split('.')[0];
  const pwaDomain = h.endsWith('.lovable.app') || h.endsWith('.gpt-eng.com') || h.endsWith('.gptengineer.run');
  if (pwaDomain && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(first)) return true;
  if (pwaDomain && first === `project--${PROJECT_ID}-dev`) return true;
  if (h === 'lovableproject.com' || h.endsWith('.lovableproject.com')) return true;
  if (h === 'lovableproject-dev.com' || h.endsWith('.lovableproject-dev.com')) return true;
  if (h === 'beta.lovable.dev' || h.endsWith('.beta.lovable.dev')) return true;
  return false;
};

const unregisterAppWorkers = () => {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => {
      const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || '';
      if (url.endsWith('/sw.js')) r.unregister();
    });
  });
};

export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    isRefusedHost() ||
    new URLSearchParams(window.location.search).has('sw', 'off');
  if (refused) {
    window.addEventListener('load', unregisterAppWorkers);
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.update();
        setInterval(() => registration.update(), 2 * 60 * 1000);
        window.addEventListener('focus', () => registration.update());
        window.addEventListener('online', () => registration.update());
      })
      .catch(() => { /* hors connexion indisponible : l'application reste utilisable en ligne */ });
  });
  // The new worker may control the page in the background, but never reload it.
  // Hiding the tab is not proof that edits were saved. The new app shell is used
  // on the next navigation/reopening initiated by the user.
}
