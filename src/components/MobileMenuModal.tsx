import React from 'react';
import menuLogoAsset from '@/assets/aquapilote-menu-logo.png.asset.json';
import AssistantNavIcon from '@/components/AssistantNavIcon';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Home,
  Wifi,
  Factory,
  Utensils, 
  Heart, 
  Building, 
  Calendar, 
  Users, 
  FileText,
  Beef,
  Package,
  Calculator,
  UserCheck,
  ShoppingCart,
  ShoppingBag,
  Settings,
  Truck,
  UserCog,
  Database,
  Shield,
  MessageCircle,
  Headphones,
  BarChart3,
  Bell,
  Sparkles,
  BookOpen,
  Stethoscope,
  Brain,
  Boxes,
} from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import { Badge } from '@/components/ui/badge';
import { hasAssignedModule } from '@/lib/moduleAccess';
import { useModuleAccess } from '@/contexts/ModuleAccessContext';

interface MobileMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MobileMenuModal = ({ isOpen, onClose, activeTab, onTabChange }: MobileMenuModalProps) => {
  const { t } = useSettings();
  const { user } = useAuth();
  const { isTeamMember, teamMemberInfo, hasAccessToModule } = useTeamMemberAccess();
  const { hasModuleAccess } = useModuleAccess();

  const isTabAllowed = (tabId: string): boolean => {
    if (!hasModuleAccess(tabId)) return false;
    if (!isTeamMember) return true;
    return hasAssignedModule(tabId, hasAccessToModule);
  };
  
  const menuItems = [
    // Tableau de bord
    {
      category: t('category_dashboard'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: Home },
        { id: 'performance-alerts', label: t('performance_alerts'), icon: Bell },
        { id: 'iot-control', label: t('iot-control'), icon: Wifi },
        { id: 'units', label: t('units'), icon: Factory },
      ]
    },
    // Production & Elevage
    { 
      category: t('category_production'),
      items: [
        { id: 'infrastructures', label: t('infrastructures'), icon: Building },
        { id: 'livestock', label: t('livestock'), icon: Beef },
        { id: 'feeding', label: t('feeding'), icon: Utensils },
        { id: 'stock', label: 'Stock', icon: Boxes },
        { id: 'aquafeed', label: 'AquaFeed AI', icon: Sparkles },
        { id: 'health', label: t('health'), icon: Heart },
        { id: 'aquahealth', label: 'AquaHealth AI', icon: Stethoscope },
        { id: 'production', label: t('production_cycles'), icon: Package },
      ]
    },
    // Gestion financiere
    {
      category: t('category_financial'),
      items: [
        { id: 'accounting', label: t('accounting'), icon: Calculator },
        { id: 'purchases', label: t('purchases'), icon: ShoppingCart },
        { id: 'sales', label: t('sales'), icon: ShoppingBag },
        { id: 'suppliers', label: t('suppliers'), icon: Truck },
      ]
    },
    // Ressources humaines
    {
      category: t('category_hr'),
      items: [
        { id: 'hr', label: t('hr'), icon: UserCheck },
        { id: 'team', label: t('team'), icon: Users },
      ]
    },
    // Planification et rapports
    {
      category: t('category_planning'),
      items: [
        { id: 'business-intelligence', label: 'Intelligence & Analyse', icon: Brain },
        { id: 'analytics', label: t('analytics'), icon: BarChart3 },
        { id: 'planning', label: t('planning'), icon: Calendar },
        { id: 'reports', label: t('reports'), icon: FileText }
        ,{ id: 'library', label: 'Bibliothèque Premium', icon: BookOpen }
      ]
    },
    // Outils & Aide
    {
      category: t('category_tools'),
      items: [
        { id: 'support', label: t('customer_support'), icon: Headphones }
      ]
    },
    // Configuration
    {
      category: t('category_config'),
      items: [
        { id: 'offline', label: t('offline_mode_menu'), icon: Database },
        { id: 'settings', label: t('settings'), icon: Settings },
        { id: 'aqua-assistant', label: 'AquaAssistant', icon: MessageCircle }
      ]
    }
  ];

  // Ajouter section Admin si l'utilisateur est admin et non membre d'equipe
  if (user?.role === 'admin' && !isTeamMember) {
    menuItems.push({
      category: t('category_admin'),
      items: [
        { id: 'admin', label: t('admin'), icon: UserCog }
      ]
    });
  }

  // Filtrer les items selon les permissions
  const filteredMenuItems = menuItems.map(category => ({
    ...category,
    items: category.items.filter(item => isTabAllowed(item.id))
  })).filter(category => category.items.length > 0);

  const handleItemClick = (tabId: string) => {
    onTabChange(tabId);
    onClose();
  };

  return (
    <Sheet modal={false} open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="left"
        className="z-[10010] p-0 m-0 left-0 top-0 h-dvh w-[min(210px,78vw)] sm:w-[min(300px,85vw)] max-w-none sm:max-w-none flex flex-col text-left bg-sidebar text-sidebar-foreground border-sidebar-border rounded-none [&>button]:text-sidebar-header-foreground [&>button]:hover:bg-sidebar-header-foreground/10"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-mobile-menu-trigger]')) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-mobile-menu-trigger]')) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="shrink-0 px-5 pt-4 pb-2 bg-sidebar-header border-b border-sidebar-border text-left">
          <SheetTitle className="flex justify-start">
            <img
              src={menuLogoAsset.url}
              alt="AquaPilote"
              className="h-10 w-auto max-w-[170px] object-contain"
            />
          </SheetTitle>

          {/* Indicateur membre d'equipe */}
          {isTeamMember && teamMemberInfo && (
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-4 h-4 text-sidebar-header-foreground" />
              <Badge variant="outline" className="text-xs text-sidebar-header-foreground border-sidebar-header-foreground/25 bg-sidebar-header-foreground/5">

                {teamMemberInfo.role === 'custom' ? teamMemberInfo.customRole : teamMemberInfo.role}
              </Badge>
            </div>
          )}
        </SheetHeader>
        
        <ScrollArea className="min-h-0 flex-1 px-3 pt-3 pb-6">
          <div className="space-y-3">
            {filteredMenuItems.map((category) => (
              <div key={category.category}>
                <h3 className="text-[11px] font-semibold text-sidebar-foreground/70 mb-1.5 uppercase px-1">
                  {category.category}
                </h3>
                <div className="flex flex-col gap-0.5">
                  {category.items.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full min-h-11 h-auto py-2 px-2 flex flex-row justify-start items-center gap-3 text-left rounded-md transition-colors touch-manipulation ${item.id === 'aqua-assistant' ? 'mt-2 min-h-16 border border-sidebar-border bg-sidebar-accent font-semibold' : ''} ${
                        activeTab === item.id
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      }`}
                    >
                      {item.id === 'aqua-assistant' ? <AssistantNavIcon className="assistant-nav-motion h-10 w-10" /> : <item.icon className="w-4 h-4 flex-shrink-0" />}
                      <span className="min-w-0 text-sm leading-snug whitespace-normal break-words">
                        {item.id === 'aqua-assistant' ? 'AquaAssistant' : item.label}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenuModal;
