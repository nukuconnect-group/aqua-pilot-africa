import React, { useState } from 'react';
import MobileNavigation from './MobileNavigation';
import MobileMenuModal from './MobileMenuModal';
import Header from './Header';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import IntelligentDashboard from './IntelligentDashboard';
import AdminDashboard from './AdminDashboard';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import IoTControlCenter from './IoTControlCenter';
import ProductionUnitsManagement from './ProductionUnitsManagement';
import InfrastructureManagement from './InfrastructureManagement';
import LivestockManagement from './LivestockManagement';
import FeedingManagement from './FeedingManagement';
import StockManagement from './StockManagement';
import ProphylaxieManagement from './ProphylaxieManagement';
import AquaHealthAI from './prophylaxie/AquaHealthAI';
import TransformationManagement from './TransformationManagement';
import ProductionManagement from './ProductionManagement';
import AccountingManagement from './AccountingManagement';
import SuppliersManagement from './SuppliersManagement';
import HRManagement from './HRManagement';
import SalesManagement from './SalesManagement';
import CrmManagement from './CrmManagement';
import PurchasesManagement from './PurchasesManagement';
import PlanningManagement from './PlanningManagement';
import WeatherDashboard from './WeatherDashboard';
import TeamManagement from './TeamManagement';
import ReportsManagement from './ReportsManagement';
import SettingsManagement from './SettingsManagement';
import SupportModule from './SupportModule';
import AquaAssistantModule from './AquaAssistantModule';
import OfflineDataManager from './OfflineDataManager';
import AnalyticsDashboard from './analytics/AnalyticsDashboard';
import BusinessIntelligenceModule from './analytics/BusinessIntelligenceModule';
import PerformanceAlertsConfig from './alerts/PerformanceAlertsConfig';
import PerformanceAlertsPanel from './alerts/PerformanceAlertsPanel';
import { hasAssignedModule } from '@/lib/moduleAccess';
import { useModuleAccess } from '@/contexts/ModuleAccessContext';
import ModuleNotIncluded from '@/components/subscription/ModuleNotIncluded';
import FarmJournalAlert from './reports/FarmJournalAlert';
import { useDailyFarmJournal } from '@/hooks/useDailyFarmJournal';

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isTeamMember, hasAccessToModule, isLoading: accessLoading } = useTeamMemberAccess();
  const { hasModuleAccess, isLoading: planLoading } = useModuleAccess();
  useDailyFarmJournal();

  const handleTabChange = (tab: string) => {
    if (tab === 'settings') {
      setShowMobileMenu(true);
    } else if (tab !== 'dashboard' && !hasModuleAccess(tab)) {
      setActiveTab(tab); // rendu bloqué par ModuleNotIncluded
    } else if (!isTeamMember || hasAssignedModule(tab, hasAccessToModule) || tab === 'dashboard') {
      setActiveTab(tab);
    } else {
      // Membre sans accès — on revient au tableau de bord membre
      setActiveTab('dashboard');
    }
  };

  const renderContent = () => {
    if (!planLoading && activeTab !== 'dashboard' && !hasModuleAccess(activeTab)) {
      return <ModuleNotIncluded moduleId={activeTab} onBack={() => setActiveTab('dashboard')} />;
    }

    // Tableau de bord unifié : tous les utilisateurs (admin, membres) partagent
    // la même vue. La visibilité des modules est pilotée par le RBAC dans la sidebar.
    // Blocage strict : un membre ne peut afficher qu'un module autorisé
    if (isTeamMember && !accessLoading && activeTab !== 'dashboard' && !hasAssignedModule(activeTab, hasAccessToModule)) {
      return (
        <div className="p-4">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-6 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-destructive mt-1" />
              <div>
                <p className="font-semibold text-foreground">Accès non autorisé</p>
                <p className="text-sm text-muted-foreground">
                  Ce module n'est pas inclus dans les permissions attribuées par votre responsable.
                  Retournez au tableau de bord pour voir vos modules accessibles.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <IntelligentDashboard />;
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
      case 'health':
        return <ProphylaxieManagement />;
      case 'aquahealth':
        return <AquaHealthAI />;
      case 'transformation':
        return <TransformationManagement />;
      case 'production':
        return <ProductionManagement />;
      case 'accounting':
        return <AccountingManagement />;
      case 'hr':
        return <HRManagement />;
      case 'purchases':
        return <PurchasesManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'crm':
        return <CrmManagement />;
      case 'suppliers':
        return <SuppliersManagement />;
      case 'planning':
        return <PlanningManagement />;
      case 'weather':
        return <WeatherDashboard />;
      case 'team':
        return <TeamManagement />;
      case 'reports':
        return <ReportsManagement />;
      case 'settings':
        return <SettingsManagement />;
      case 'admin':
        return <AdminDashboard />;
      case 'support':
        return <SupportModule />;
      case 'aqua-assistant':
        return <AquaAssistantModule />;
      case 'offline':
        return <OfflineDataManager />;
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
      default:
        return <IntelligentDashboard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        {/* Sidebar Navigation - masqué sur mobile */}
        <div className="hidden md:flex">
          <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* Conteneur principal avec header et contenu */}
        <div className="flex-1 flex flex-col min-w-0 mt-0 pt-0">
          {/* Header fixe en haut sans marges - pleine largeur sur mobile (100vw) */}
          <div
            className="fixed top-0 left-0 right-0 z-[1000] flex items-center bg-gradient-brand w-screen max-w-none m-0 p-0 border-0 md:border-b md:border-border md:bg-none md:bg-background md:left-auto md:w-auto md:max-w-full"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="hidden md:block">
              <SidebarTrigger className="ml-2" />
            </div>
            <div className="flex-1 w-full m-0 p-0">
              <Header onOpenMobileMenu={() => setShowMobileMenu(true)} />
            </div>
          </div>
          
          {/* Main Content avec padding-top pour compenser le header fixe */}
          <main className="flex-1 overflow-y-auto overscroll-contain p-0 sm:p-4 lg:p-6 pt-[3rem] md:pt-14 lg:pt-16 pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-8">
            <div className="w-full max-w-none pb-4 md:pb-0">
              <div className="px-2 sm:px-0 pt-2 sm:pt-0">
                <FarmJournalAlert onOpenJournal={() => setActiveTab('reports')} />
              </div>
              {renderContent()}
            </div>
          </main>
        </div>

        {/* Navigation mobile en bas */}
        <MobileNavigation activeTab={activeTab} onTabChange={handleTabChange} />
        
        {/* Modal menu mobile */}
        <MobileMenuModal 
          isOpen={showMobileMenu} 
          onClose={() => setShowMobileMenu(false)} 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />

      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
