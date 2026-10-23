import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import Header from '@/components/Header';
import AssistantFloatingBubble from '@/components/AssistantFloatingBubble';
import MobileNavigation from '@/components/MobileNavigation';
import MobileMenuModal from '@/components/MobileMenuModal';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import GlobalSearchResults from '@/components/GlobalSearchResults';
import OfflineDataManager from '@/components/OfflineDataManager';
import IntelligentDashboard from '@/components/IntelligentDashboard';
import ModernDashboard from '@/components/ModernDashboard';
import SensorsCTABanner from '@/components/dashboard/SensorsCTABanner';
import AdminDashboard from '@/components/AdminDashboard';
import IoTControlCenter from '@/components/IoTControlCenter';
import ProductionUnitsManagement from '@/components/ProductionUnitsManagement';
import InfrastructureManagement from '@/components/InfrastructureManagement';
import LivestockManagement from '@/components/LivestockManagement';
import FeedingManagement from '@/components/FeedingManagement';
import StockManagement from '@/components/StockManagement';
import AquaFeedAI from '@/components/aquafeed/AquaFeedAI';
import PremiumLibrary from '@/components/library/PremiumLibrary';
import ProphylaxieManagement from '@/components/ProphylaxieManagement';
import FeedProphylaxisManagement from '@/components/feedmill/FeedProphylaxisManagement';
import FeedProductionManagement from '@/components/feedmill/FeedProductionManagement';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import AquaHealthAI from '@/components/prophylaxie/AquaHealthAI';
import TransformationManagement from '@/components/TransformationManagement';
import ProductionManagement from '@/components/ProductionManagement';
import AccountingManagement from '@/components/AccountingManagement';
import SuppliersManagement from '@/components/SuppliersManagement';
import CrmManagement from '@/components/CrmManagement';
import HRManagement from '@/components/HRManagement';
import SalesManagement from '@/components/SalesManagement';
import PurchasesManagement from '@/components/PurchasesManagement';
import PlanningManagement from '@/components/PlanningManagement';
import WeatherDashboard from '@/components/WeatherDashboard';
import TeamManagement from '@/components/TeamManagement';
import ReportsManagement from '@/components/ReportsManagement';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import BusinessIntelligenceModule from '@/components/analytics/BusinessIntelligenceModule';
import PerformanceAlertsPanel from '@/components/alerts/PerformanceAlertsPanel';
import PerformanceAlertsConfig from '@/components/alerts/PerformanceAlertsConfig';
import SettingsManagement from '@/components/SettingsManagement';
import SupportModule from '@/components/SupportModule';
import AquaAssistant from '@/components/AquaAssistant';
import AquaAssistantModule from '@/components/AquaAssistantModule';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import SubscriptionGuard from '@/components/subscription/SubscriptionGuard';
import ModuleErrorBoundary from '@/components/ModuleErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Building2, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { APP_MODULE_PERMISSIONS, hasAssignedModule, moduleParamToTabId, tabToModuleId } from '@/lib/moduleAccess';
import { useModuleAccess } from '@/contexts/ModuleAccessContext';
import FirstUnitsSetup from '@/components/onboarding/FirstUnitsSetup';
import ModuleNotIncluded from '@/components/subscription/ModuleNotIncluded';
import {
  beginRouteTransition,
  cleanupBlockingOverlays,
  completeRouteTransition,
  hasOpenTransientOverlay,
  isRouteTransitionActive,
  recordDiagnostic,
  requestDataRefresh,
} from '@/lib/appRecovery';

/**
 * Page principale du dashboard
 * Accessible uniquement aux utilisateurs authentifiés
 * Les membres d'équipe ont un accès restreint selon leurs permissions
 */
const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Source unique de vérité : l'onglet actif est dérivé du paramètre `module`
  // de l'URL. Cela évite les courses entre `setActiveTab` et `setSearchParams`
  // qui faisaient revenir l'utilisateur au tableau de bord après un clic.
  const activeTab = moduleParamToTabId(searchParams.get('module'));
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [moduleResetKey, setModuleResetKey] = useState(0);
  const { isTeamMember, teamMemberInfo, isLoading: isLoadingAccess, hasAccessToModule, getAllowedModulesList } = useTeamMemberAccess();
  const { hasModuleAccess, isLoading: isLoadingPlan } = useModuleAccess();
  const { activeUnit } = useProductionUnits();
  const isFeedMillUnit = activeUnit?.type === 'fabrication_aliment';

  const getFirstAllowedTab = () => {
    const allowed = getAllowedModulesList();
    const firstModule = APP_MODULE_PERMISSIONS.find((module) => allowed.includes(module.id));
    return firstModule?.tabIds[0] ?? 'dashboard';
  };

  const canAccessTab = (tab: string) => {
    if (!hasModuleAccess(tab)) return false;
    if (!isTeamMember) return true;
    if (tab === 'dashboard' && getAllowedModulesList().length === 0) return true;
    return hasAssignedModule(tab, hasAccessToModule);
  };

  const commitTabChange = (tab: string) => {
    const nextParams = tab === 'dashboard' ? '' : tab;
    if ((searchParams.get('module') || '') === nextParams) return;
    beginRouteTransition(activeTab, tab);
    recordDiagnostic('navigation', 'tab change requested', { from: activeTab, to: tab });
    window.dispatchEvent(new CustomEvent('aqua:close-transient-ui', { detail: { from: activeTab, to: tab } }));
    setSearchParams(tab === 'dashboard' ? {} : { module: tab }, { replace: true });

    const verifyNotFrozen = (delay: number) => {
      window.setTimeout(() => {
        const urlModule = moduleParamToTabId(new URLSearchParams(window.location.search).get('module'));
        const renderedModule = document.querySelector('[data-module-content]')?.getAttribute('data-module-content');
        if (renderedModule && renderedModule !== urlModule && !hasOpenTransientOverlay()) {
          recordDiagnostic('watchdog', 'module mismatch after navigation', {
            expected: urlModule,
            rendered: renderedModule,
            delay,
            href: window.location.href,
          });
          completeRouteTransition(urlModule);
          cleanupBlockingOverlays(`module-mismatch:${urlModule}`);
          setModuleResetKey((key) => key + 1);
        }
      }, delay);
    };
    verifyNotFrozen(650);
    verifyNotFrozen(1400);
  };

  const handleTabChange = (tab: string) => {
    if (!isLoadingAccess && !canAccessTab(tab)) {
      commitTabChange(getFirstAllowedTab());
      setShowMobileMenu(false);
      return;
    }

    commitTabChange(tab);
    setShowMobileMenu(false);
  };

  // Si un membre d'équipe atterrit sur un module non autorisé, on le ramène
  // vers son premier module autorisé. On évite tout effet pour les utilisateurs
  // non restreints afin de ne pas perturber la navigation.
  useEffect(() => {
    if (isLoadingAccess) return;
    if (!isTeamMember || !teamMemberInfo) return;
    if (canAccessTab(activeTab)) return;
    const fallback = getFirstAllowedTab();
    if (fallback !== activeTab) commitTabChange(fallback);
  }, [isTeamMember, teamMemberInfo, activeTab, isLoadingAccess, hasAccessToModule]);

  // Sécurité anti-blocage : à chaque changement de module, on termine la
  // transition et on libère uniquement les anciens verrous de page orphelins.
  // Le nettoyage ignore les Dialog/Sheet/Select Radix réellement ouverts afin
  // de ne plus démonter un formulaire pendant la saisie.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      completeRouteTransition(activeTab);
      cleanupBlockingOverlays(`module-change-raf:${activeTab}`);
    });
    const delayed = window.setTimeout(() => {
      if (!isRouteTransitionActive()) cleanupBlockingOverlays(`module-change-delayed:${activeTab}`);
    }, 350);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(delayed);
    };
  }, [activeTab]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const bodyBlocked = document.body.style.pointerEvents === 'none';
      const loadingText = document.querySelector('[data-module-content]')?.textContent?.toLowerCase() || '';
      const seemsStuckLoading = loadingText.includes('chargement') && loadingText.length < 180;

      const overlayOpen = hasOpenTransientOverlay();

      if (!overlayOpen && (bodyBlocked || seemsStuckLoading)) {
        recordDiagnostic('watchdog', 'controlled module reset', { activeTab, bodyBlocked, seemsStuckLoading });
        cleanupBlockingOverlays(`watchdog:${activeTab}`);
        setModuleResetKey((key) => key + 1);
      }
    }, 4500);
    return () => window.clearTimeout(timeout);
  }, [activeTab]);

  const renderTeamMemberWelcome = () => {
    if (!isTeamMember || !teamMemberInfo) return null;

    return (
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" />
            Bienvenue, {teamMemberInfo.memberName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {teamMemberInfo.role === 'custom' ? teamMemberInfo.customRole : teamMemberInfo.role}
              </Badge>
              {teamMemberInfo.department && (
                <Badge variant="secondary">{teamMemberInfo.department}</Badge>
              )}
            </div>
            
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Vous avez accès aux unités de production assignées par votre responsable.
              </span>
            </div>

            {teamMemberInfo.assignedUnits.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium mb-2">Unités assignées :</p>
                <div className="flex flex-wrap gap-2">
                  {teamMemberInfo.assignedUnits.map(unit => (
                    <Badge key={unit.unitId} variant="default" className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {unit.unitName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // État pour afficher le module AquaAssistant en page complète
  const [showAquaAssistantModule, setShowAquaAssistantModule] = useState(false);
  // Fenêtre de discussion par-dessus le module en cours (le module reste visible derrière).
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Detecter le changement d'onglet vers aqua-assistant
  useEffect(() => {
    const onNav = (e: Event) => { const t = (e as CustomEvent<string>).detail; if (t) handleTabChange(t); };
    window.addEventListener('aquapilote:navigate', onNav);
    return () => window.removeEventListener('aquapilote:navigate', onNav);
  });

  useEffect(() => {
    if (activeTab === 'aqua-assistant') {
      setShowAquaAssistantModule(true);
    } else {
      setShowAquaAssistantModule(false);
    }
  }, [activeTab]);

  const renderContent = () => {
    // Abonnement : module non inclus -> aucun rendu du module, aucune donnée exposée.
    if (!isLoadingAccess && !isLoadingPlan && activeTab !== 'dashboard' && !hasModuleAccess(activeTab)) {
      return <ModuleNotIncluded moduleId={tabToModuleId(activeTab)} onBack={() => handleTabChange('dashboard')} />;
    }

    if (isTeamMember && !isLoadingAccess && !canAccessTab(activeTab)) {
      return (
        <>
          {renderTeamMemberWelcome()}
          <ModernDashboard onNavigate={handleTabChange} canAccessModule={(id) => canAccessTab(id)} />
        </>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            {/* Single unified RBAC dashboard — visibility & navigation are
                already filtered by useTeamMemberAccess + hasAccessToModule. */}
            {renderTeamMemberWelcome()}
            <ModernDashboard onNavigate={handleTabChange} canAccessModule={(id) => canAccessTab(id)} />
          </>
        );
      case 'iot-control':
        return <IoTControlCenter />;
      case 'units':
        return <ProductionUnitsManagement />;
      case 'infrastructures':
        return <InfrastructureManagement />;
      case 'livestock':
        return <LivestockManagement />;
      case 'feeding':
        return <FeedingManagement />;
      case 'stock':
        return <StockManagement />;
      case 'aquafeed':
        return <AquaFeedAI />;
      case 'library':
        return <PremiumLibrary />;
      case 'health':
        return isFeedMillUnit ? <FeedProphylaxisManagement /> : <ProphylaxieManagement />;
      case 'aquahealth':
        return <AquaHealthAI />;
      case 'transformation':
        return <TransformationManagement />;
      case 'production':
        return isFeedMillUnit ? <FeedProductionManagement /> : <ProductionManagement />;
      case 'accounting':
        return <AccountingManagement />;
      case 'hr':
        return <HRManagement />;
      case 'purchases':
        return <PurchasesManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'suppliers':
        return <SuppliersManagement />;
      case 'crm':
        return <CrmManagement />;
      case 'planning':
        return <PlanningManagement />;
      case 'weather':
        return <WeatherDashboard />;
      case 'team':
        return <TeamManagement />;
      case 'reports':
        return <ReportsManagement />;
      case 'business-intelligence':
        return <BusinessIntelligenceModule />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'performance-alerts':
        return (
          <div className="space-y-6">
            <PerformanceAlertsPanel />
            <PerformanceAlertsConfig />
          </div>
        );
      case 'offline':
        return <OfflineDataManager />;
      case 'settings':
        return <SettingsManagement />;
      case 'support':
        return <SupportModule />;
      case 'admin':
        return <AdminDashboard />;
      case 'aqua-assistant':
        return <AquaAssistantModule />;
      default:
        return (
          <>
            {renderTeamMemberWelcome()}
            <SensorsCTABanner onNavigate={handleTabChange} />
            <ModernDashboard onNavigate={handleTabChange} canAccessModule={(id) => canAccessTab(id)} />
          </>
        );
    }
  };

  return (
    <SidebarProvider>
      <FirstUnitsSetup onRequest={() => handleTabChange('support')} />
      <div className="min-h-screen bg-background flex w-full m-0 p-0 overflow-x-hidden">
        {/* Sidebar Navigation - masqué sur mobile */}
        <div className="hidden md:flex">
          <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* Conteneur principal avec header et contenu */}
        <div className="flex-1 flex flex-col min-w-0 mt-0 pt-0">
          {/* Header fixe pleine largeur sur mobile (100vw, bord à bord) */}
          <div
            className="fixed top-0 left-0 right-0 z-[1000] flex items-center bg-sidebar w-full max-w-none m-0 p-0 border-0 md:border-b md:border-border md:bg-background md:left-auto md:right-auto md:top-auto md:w-full md:max-w-full md:relative md:z-40"
            style={{ top: 0, left: 0, right: 0 }}
          >
            <div className="hidden md:block">
              <SidebarTrigger className="ml-2" />
            </div>
            <div className="flex-1 w-full m-0 p-0">
            <Header onNavigate={handleTabChange} onOpenMobileMenu={() => setShowMobileMenu(prev => !prev)} />
            </div>
          </div>

          {/* Main Content avec padding-top pour compenser le header fixe sur mobile */}
          <main
            className="flex-1 overflow-y-auto px-2 sm:p-4 lg:p-6 pt-[3.75rem] sm:pt-[5rem] md:pt-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
          >
            <div className="w-full max-w-none pb-6 md:pb-0">
              {isLoadingAccess ? (
                <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Chargement des permissions…
                </div>
              ) : (
                <SubscriptionGuard>
                  {/* key={activeTab} force le remontage du module courant à chaque
                      changement d'onglet : évite les états bloqués et les données
                      résiduelles de l'ancien module qui persistaient après navigation.
                      ModuleErrorBoundary isole les crashs d'un module : les autres
                      restent accessibles depuis le menu. */}
                  <ModuleErrorBoundary
                    resetKey={`realtime-recovery-v2-${activeTab}-${moduleResetKey}`}
                    moduleLabel={activeTab}
                    onRecover={() => {
                      cleanupBlockingOverlays(`manual-recover:${activeTab}`);
                      requestDataRefresh(`manual-recover:${activeTab}`);
                      setModuleResetKey((key) => key + 1);
                    }}
                  >
                    <div key={`realtime-recovery-v2-${activeTab}-${moduleResetKey}`} className="w-full" data-module-content={activeTab}>
                      {renderContent()}
                    </div>
                  </ModuleErrorBoundary>
                </SubscriptionGuard>
              )}
            </div>
          </main>
        </div>

        {/* Navigation mobile en bas */}
        <MobileNavigation activeTab={activeTab} onTabChange={handleTabChange} />

        {canAccessTab('aqua-assistant') && (
          assistantOpen && activeTab !== 'aqua-assistant'
            ? <AquaAssistantModule onClose={() => setAssistantOpen(false)} />
            : <AssistantFloatingBubble activeTab={activeTab} onOpen={() => setAssistantOpen(true)} />
        )}
        
        {/* Modal menu mobile */}
        <MobileMenuModal 
          isOpen={showMobileMenu} 
          onClose={() => setShowMobileMenu(false)} 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />

        {/* PWA Install Prompt */}
        <PWAInstallPrompt />

        {/* Résultats de recherche globale (module quick-nav) */}
        <GlobalSearchResults
          onNavigate={handleTabChange}
          canAccessTab={(id) => canAccessTab(id)}
        />
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
