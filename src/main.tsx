import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { OfflineProvider } from './contexts/OfflineContext';
import { installDiagnostics } from './lib/appRecovery';
import { installDomMutationGuard } from './lib/domPatch';

installDomMutationGuard();

console.log('🚀 AQUA PILOT - Application complète restaurée');
installDiagnostics();

// Enregistrement du Service Worker avec gestion améliorée des mises à jour
const isPreviewHost = () => {
  const h = window.location.hostname;
  return (
    h.startsWith('id-preview--') ||
    h.startsWith('preview--') ||
    h === 'lovableproject.com' ||
    h.endsWith('.lovableproject.com') ||
    h === 'lovableproject-dev.com' ||
    h.endsWith('.lovableproject-dev.com') ||
    h === 'beta.lovable.dev' ||
    h.endsWith('.beta.lovable.dev') ||
    window.self !== window.top
  );
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isPreviewHost()) {
      console.info('ℹ️ Service Worker désactivé sur le preview Lovable pour éviter les erreurs de redirection.');
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('✅ Service Worker enregistré avec succès:', registration.scope);
        
        // Vérifier les mises à jour immédiatement
        registration.update();
        
        // Écouter les mises à jour du SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('🔄 Nouvelle version du Service Worker trouvée');
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✅ Nouvelle version installée et prête');
                // Le message SW_UPDATED sera envoyé par le service worker
              }
            });
          }
        });
        
        // Vérifier les mises à jour périodiquement (toutes les 2 minutes)
        setInterval(() => {
          registration.update();
        }, 2 * 60 * 1000);

        // Vérifier aussi lors du retour de focus / reconnexion
        window.addEventListener('focus', () => registration.update());
        window.addEventListener('online', () => registration.update());
      })
      .catch((error) => {
        console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
      });
  });
  
  // Recharger automatiquement la page dès qu'un nouveau SW prend le contrôle,
  // sauf sur les previews Lovable pour éviter les reloads en boucle.
  if (!isPreviewHost()) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('🔄 Nouveau contrôleur détecté, rechargement...');
        window.location.reload();
      }
    });
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <OfflineProvider>
      <App />
    </OfflineProvider>
  </React.StrictMode>
);
