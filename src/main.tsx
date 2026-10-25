import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { OfflineProvider } from './contexts/OfflineContext';
import { installDiagnostics } from './lib/appRecovery';
import { installDomMutationGuard } from './lib/domPatch';
import { registerAppServiceWorker } from './lib/pwaRegister';
import { initializePWAInstallation } from './hooks/usePWAInstallState';
import ErrorBoundary from './components/ErrorBoundary';

installDomMutationGuard();
// Capture the one-shot native installation event before the React tree mounts.
initializePWAInstallation();

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
    <ErrorBoundary>
    <OfflineProvider>
      <App />
    </OfflineProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
