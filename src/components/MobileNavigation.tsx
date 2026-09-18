import React from 'react';
import { Button } from '@/components/ui/button';
import { Home, Factory, Wifi, Beef, ShoppingBag, Utensils, Heart, Package, FileText, Calculator } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import { hasAssignedModule } from '@/lib/moduleAccess';
import { useModuleAccess } from '@/contexts/ModuleAccessContext';

interface MobileNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MobileNavigation = ({ activeTab, onTabChange }: MobileNavigationProps) => {
  const { t } = useSettings();
  const { isTeamMember, hasAccessToModule } = useTeamMemberAccess();
  const { hasModuleAccess } = useModuleAccess();
  
  const isTabAllowed = (tabId: string): boolean => {
    if (!hasModuleAccess(tabId)) return false;
    if (!isTeamMember) return true;
    return hasAssignedModule(tabId, hasAccessToModule);
  };
  
  const allMainItems = [
    { id: 'dashboard', label: t('dashboard'), icon: Home },
    { id: 'iot-control', label: t('iot-control'), icon: Wifi },
    { id: 'units', label: t('units'), icon: Factory },
    { id: 'livestock', label: t('livestock'), icon: Beef },
    { id: 'feeding', label: t('feeding'), icon: Utensils },
    { id: 'health', label: t('health'), icon: Heart },
    { id: 'production', label: t('production'), icon: Package },
    { id: 'accounting', label: t('accounting'), icon: Calculator },
    { id: 'sales', label: t('sales'), icon: ShoppingBag },
    { id: 'reports', label: t('reports'), icon: FileText },
  ];

  const mainItems = allMainItems.filter(item => isTabAllowed(item.id)).slice(0, 5);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.08)] backdrop-blur-sm m-0"
        style={{ left: 0, right: 0, bottom: 0, margin: 0 }}>
        <div className="flex justify-around items-stretch w-full px-1 py-1 pb-0">
          {mainItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 h-auto text-[11px] min-w-0 flex-1 min-h-[52px] rounded-md ${
                activeTab === item.id 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground'
              }`}
              onClick={() => onTabChange(item.id)}
            >
              <item.icon className={`w-5 h-5 mb-0.5 ${
                activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <span className="text-[11px] leading-tight truncate max-w-full font-semibold">{item.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;
