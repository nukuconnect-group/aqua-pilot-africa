// React core imports
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProductionUnitsProvider } from '@/contexts/ProductionUnitsContext';
import { IoTProvider } from '@/contexts/IoTContext';
import { LogsProvider } from '@/contexts/LogsContext';
import { ModuleAccessProvider } from '@/contexts/ModuleAccessContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import AutoTranslate from '@/i18n/AutoTranslate';
import { Toaster } from '@/components/ui/toaster';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';
import { ThemeProvider } from '@/components/ThemeProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import Welcome from '@/pages/Welcome';
import OnboardingFlow from '@/pages/OnboardingFlow';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import SubscriptionPage from '@/pages/SubscriptionPage';
import { useIOSDetection } from '@/hooks/useIOSDetection';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { useAnonymousVisitTracking } from '@/hooks/useAnonymousVisitTracking';

const AppContent: React.FC = () => {
  const { isIOSSafari } = useIOSDetection();
  
  // Track anonymous visits for analytics
  useAnonymousVisitTracking();

  useEffect(() => {
    // Log pour le débogage iOS
    if (isIOSSafari) {
      console.log('Running on iOS Safari - Optimizations active');
    }
  }, [isIOSSafari]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Routes>
        {/* Page d'accueil - Compatible iOS */}
        <Route path="/" element={<Welcome />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        
        {/* Page d'onboarding */}
        <Route path="/onboarding" element={<OnboardingFlow />} />
        
        {/* Page d'authentification */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/connexion" element={<Navigate to="/auth" replace />} />
        <Route path="/inscription" element={<Navigate to="/auth?mode=register" replace />} />
        
        {/* Dashboard protégé par authentification */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />

        {/* Accès direct au tableau de bord admin */}
        <Route path="/admin" element={<Navigate to="/dashboard?module=admin" replace />} />

        {/* Page d'abonnements */}
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <SubscriptionPage />
            </ProtectedRoute>
          }
        />

        {/* Alias inscription pour partage */}
        <Route path="/register" element={<Navigate to="/auth?mode=register" replace />} />
        <Route path="/signup" element={<Navigate to="/auth?mode=register" replace />} />
        
        {/* Page 404 */}
        <Route path="/404" element={<NotFound />} />
        
        {/* Redirection des routes inconnues vers la page d'accueil */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="light" storageKey="aqua-pilot-theme">
      <ErrorBoundary>
        <BrowserRouter>
          <SettingsProvider>
            <AutoTranslate />
            <AuthProvider>
              <ProductionUnitsProvider>
              <ModuleAccessProvider>
                <IoTProvider>
                  <LogsProvider>
                    <AppContent />
                  </LogsProvider>
                </IoTProvider>
              </ModuleAccessProvider>
              </ProductionUnitsProvider>
            </AuthProvider>
          </SettingsProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;
