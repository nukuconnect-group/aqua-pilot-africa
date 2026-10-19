import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Home, Building2, Wrench, Utensils, Heart, Package, Calendar, Users, FileText, Settings, Beef, Calculator, UserCheck, ShoppingCart, Wifi, ShoppingBag, Truck, UserCog, Database, Shield, MessageCircle, Headphones, BarChart3, Bell, ArrowLeft, UserPlus, ClipboardList, CreditCard, Activity, Eye, AlertTriangle, Mail } from 'lucide-react';
import { Sparkles, BookOpen, Stethoscope, Layers, Brain } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import { Badge } from '@/components/ui/badge';
import { hasAssignedModule } from '@/lib/moduleAccess';
import { useModuleAccess } from '@/contexts/ModuleAccessContext';
import { useSecurityFindings } from '@/components/admin/SecurityFindingsPanel';

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { open } = useSidebar();
  const { t, language } = useSettings();
  const { user } = useAuth();
  const { isTeamMember, teamMemberInfo, hasAccessToModule } = useTeamMemberAccess();
  const { hasModuleAccess } = useModuleAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdminView = activeTab === 'admin';
  const adminSection = searchParams.get('section') || 'overview';
  const { newCount: newSecurityFindings } = useSecurityFindings();

  const goToAdminSection = (section: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('module', 'admin');
    next.set('section', section);
    setSearchParams(next, { replace: true });
  };

  const exitAdmin = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('module');
    next.delete('section');
    setSearchParams(next, { replace: true });
    onTabChange('dashboard');
  };

  const adminGroups = [
    {
      label: t('admin') || 'Administration',
      items: [
        { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
        { id: 'activations', label: 'Activations', icon: UserPlus },
        { id: 'emails', label: 'Emails', icon: Mail },
        { id: 'registrations', label: 'Inscriptions', icon: ClipboardList },
        { id: 'users', label: 'Utilisateurs', icon: Users },
        { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
        { id: 'plans', label: 'Plans & Modules', icon: Layers },
        { id: 'support', label: 'Support', icon: Headphones },
        { id: 'database', label: 'Base de données', icon: Database },
        { id: 'activity', label: 'Activités', icon: Activity },
        { id: 'privacy', label: 'Confidentialité', icon: Eye },
        { id: 'errors', label: 'Erreurs', icon: AlertTriangle },
        { id: 'security', label: 'Sécurité', icon: Shield, badge: newSecurityFindings },
      ],
    },
  ];

  if (isAdminView) {
    return (
      <Sidebar collapsible="icon" variant="floating" className="[&>div>div]:rounded-2xl [&_button]:rounded-xl">
        <SidebarContent className="overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="sm"
                    onClick={exitAdmin}
                    tooltip={open ? undefined : 'Retour'}
                    className="text-white hover:bg-white/10 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">Retour au tableau de bord</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {adminGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-white/80 font-semibold tracking-wide uppercase text-[11px]">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = adminSection === item.id;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          size="sm"
                          onClick={() => goToAdminSection(item.id)}
                          isActive={isActive}
                          tooltip={open ? undefined : item.label}
                          className="text-white hover:bg-white/10 hover:text-white data-[active=true]:bg-white/20 data-[active=true]:text-white"
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {'badge' in item && (item as { badge?: number }).badge ? (
                            <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                              {(item as { badge?: number }).badge}
                            </Badge>
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
    );
  }

  // Verifier si un tab est accessible
  const isTabAllowed = (tabId: string): boolean => {
    if (!hasModuleAccess(tabId)) return false; // Abonnement
    if (!isTeamMember) return true; // Non-membre = acces complet
    return hasAssignedModule(tabId, hasAccessToModule);
  };

  const navigationGroups = [
    {
      label: t('category_dashboard'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: Home },
        { id: 'performance-alerts', label: t('performance_alerts'), icon: Bell },
        { id: 'iot-control', label: t('iot-control'), icon: Wifi },
        { id: 'units', label: t('units'), icon: Building2 },
      ]
    },
    {
      label: t('category_production'),
      items: [
        { id: 'infrastructures', label: t('infrastructures'), icon: Wrench },
        { id: 'livestock', label: t('livestock'), icon: Beef },
        { id: 'feeding', label: t('feeding'), icon: Utensils },
        { id: 'stock', label: 'Stock', icon: Boxes },
        { id: 'aquafeed', label: 'AquaFeed AI', icon: Sparkles },
        { id: 'health', label: t('health'), icon: Heart },
        { id: 'aquahealth', label: 'AquaHealth AI', icon: Stethoscope },
        { id: 'production', label: t('production'), icon: Package },
      ]
    },
    {
      label: t('category_financial'),
      items: [
        { id: 'accounting', label: t('accounting'), icon: Calculator },
        { id: 'purchases', label: t('purchases'), icon: ShoppingCart },
        { id: 'sales', label: t('sales'), icon: ShoppingBag },
        { id: 'suppliers', label: t('suppliers'), icon: Truck },
      ]
    },
    {
      label: t('category_hr'),
      items: [
        { id: 'hr', label: t('hr'), icon: UserCheck },
        { id: 'team', label: t('team'), icon: Users },
      ]
    },
    {
      label: t('category_planning'),
      items: [
        { id: 'business-intelligence', label: 'Intelligence & Analyse', icon: Brain },
        { id: 'analytics', label: t('analytics'), icon: BarChart3 },
        { id: 'planning', label: t('planning'), icon: Calendar },
        { id: 'reports', label: t('reports'), icon: FileText },
        { id: 'library', label: 'Bibliothèque Premium', icon: BookOpen },
      ]
    },
    {
      label: t('category_tools'),
      items: [
        { id: 'aqua-assistant', label: t('aqua_assistant'), icon: MessageCircle },
        { id: 'support', label: t('customer_support'), icon: Headphones },
      ]
    },
    {
      label: t('category_config'),
      items: [
        { id: 'offline', label: t('offline_mode_menu'), icon: Database },
        { id: 'settings', label: t('settings'), icon: Settings },
      ]
    }
  ];

  // Ajouter l'option admin si l'utilisateur est admin
  if (user?.role === 'admin' && !isTeamMember) {
    navigationGroups.push({
      label: t('category_admin'),
      items: [
        { id: 'admin', label: t('admin'), icon: UserCog }
      ]
    });
  }

  // Filtrer les groupes et items selon les permissions du membre d'equipe
  const filteredGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => isTabAllowed(item.id))
  })).filter(group => group.items.length > 0);

  return (
    <Sidebar collapsible="icon" variant="floating" className="[&>div>div]:rounded-2xl [&_button]:rounded-xl">
      <SidebarContent className="overflow-y-auto">
        {/* Indicateur membre d'equipe */}
        {isTeamMember && teamMemberInfo && open && (
          <div className="px-3 py-2 border-b border-sidebar-border/50">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Shield className="w-3 h-3" />
              <span>{t('team_member')}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs text-white border-white/30 bg-white/10">
                {teamMemberInfo.role === 'custom' ? teamMemberInfo.customRole : teamMemberInfo.role}
              </Badge>
              {(teamMemberInfo.dashboardRoles ?? []).map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px] bg-white/20 text-white">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-white/80 font-semibold tracking-wide uppercase text-[11px]">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        size="sm"
                        onClick={() => onTabChange(item.id)}
                        isActive={isActive}
                        tooltip={open ? undefined : item.label}
                        className="text-white hover:bg-white/10 hover:text-white data-[active=true]:bg-white/20 data-[active=true]:text-white"
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
