import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { OfflineProvider } from './contexts/OfflineContext';
import { installDiagnostics } from './lib/appRecovery';
import { installDomMutationGuard } from './lib/domPatch';
import { registerAppServiceWorker } from './lib/pwaRegister';

installDomMutationGuard();

console.log('🚀 AQUA PILOT - Application complète restaurée');
installDiagnostics();

// Hors connexion + mises à jour en arrière-plan (désactivé sur les aperçus Lovable).
registerAppServiceWorker();

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
