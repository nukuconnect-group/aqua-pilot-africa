import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Activity, Search, Key, Trash2, BarChart3, AlertTriangle, Clock, Database, Wifi, Building2, Eye, Ban, PlayCircle, Globe, Shield, Headphones, CreditCard, ClipboardList, FileSpreadsheet, FileText } from 'lucide-react';
import { exportRowsToCsv, exportRowsToPdf, timestampSuffix, type ExportColumn } from '@/lib/adminExportUtils';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/clientConfig';
import { useLogs } from '@/contexts/LogsContext';
import { useProductionUnits, ProductionUnitType } from '@/contexts/ProductionUnitsContext';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import AdminAlertNotification from './AdminAlertNotification';
import DatabaseStatsPanel from './admin/DatabaseStatsPanel';
import DatabaseStoragePanel from './admin/DatabaseStoragePanel';
import OnlineUsersPanel from './admin/OnlineUsersPanel';
import UserSessionHistory from './admin/UserSessionHistory';
import UserUnitsDisplay from './admin/UserUnitsDisplay';
import AddUserWithUnitsDialog from './admin/AddUserWithUnitsDialog';
import SupportModule from './SupportModule';
import VisitsStatsPanel from './admin/VisitsStatsPanel';
import SubscriptionsPanel from './admin/SubscriptionsPanel';
import PendingActivations from './admin/PendingActivations';
import RegistrationsPanel from './admin/RegistrationsPanel';
import EmailStatusPanel from './admin/EmailStatusPanel';
import ManageUserUnitsDialog from './admin/ManageUserUnitsDialog';
import AccessStatsPanel from './admin/AccessStatsPanel';
import TeamMembersOverviewPanel from './admin/TeamMembersOverviewPanel';
import FinanceOverviewPanel from './admin/FinanceOverviewPanel';
import SecurityFindingsPanel from './admin/SecurityFindingsPanel';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'operator' | 'user';
  created_at: string;
}

interface UserUnit {
  id: string;
  name: string;
  type: ProductionUnitType;
  isActive: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'operator' | 'user';
  created_at: string;
  lastLogin?: string;
  isOnline?: boolean;
  units?: UserUnit[];
  isSuspended?: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  country?: string;
  countryCode?: string;
}

const AdminDashboard = () => {
  const { t } = useSettings();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { logs } = useLogs();
  const { units: productionUnits } = useProductionUnits();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('section') || 'overview';
  const setActiveTab = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('module', 'admin');
    next.set('section', v);
    setSearchParams(next, { replace: true });
  };
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<{ id: string; name: string } | null>(null);
  const [isPurgingErrors, setIsPurgingErrors] = useState(false);
  const [purgedAt, setPurgedAt] = useState<string | null>(null);

  // Bruit connu déjà corrigé côté code (scanner code-barres) : on ne l'affiche plus.
  const RESOLVED_ERROR_PATTERNS = [
    'Cannot stop, scanner is not running or paused',
  ];

  const formatErrorDetails = (details: string) => {
    if (!details) return 'Erreur interne sans détail disponible.';
    try {
      const payload = JSON.parse(details);
      const message = payload?.data?.message || payload?.message;
      return typeof message === 'string' ? message : 'Erreur interne détectée.';
    } catch {
      return details.length > 500 ? `${details.slice(0, 500)}…` : details;
    }
  };

  const visibleErrorLogs = React.useMemo(
    () =>
      logs.filter((log) => {
        if (log.severity !== 'error' && log.severity !== 'warning') return false;
        if (purgedAt && new Date(log.timestamp).getTime() <= new Date(purgedAt).getTime()) return false;
        const haystack = `${log.action} ${log.details}`;
        return !RESOLVED_ERROR_PATTERNS.some((p) => haystack.includes(p));
      }),
    [logs, purgedAt],
  );

  const purgeErrorLogs = async () => {
    setIsPurgingErrors(true);
    try {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .in('severity', ['error', 'warning']);
      if (error) throw error;
      setPurgedAt(new Date().toISOString());
      toast({ title: 'Journal vidé', description: 'Les erreurs et avertissements ont été supprimés.' });
    } catch (e: any) {
      // Même si la suppression serveur échoue (RLS), on masque localement.
      setPurgedAt(new Date().toISOString());
      toast({
        title: 'Journal masqué',
        description: e?.message || 'Suppression serveur indisponible, affichage réinitialisé.',
      });
    } finally {
      setIsPurgingErrors(false);
    }
  };

  const ERROR_LOG_COLUMNS: ExportColumn<(typeof logs)[number]>[] = [
    { header: 'Date', value: (l) => format(new Date(l.timestamp), 'dd/MM/yyyy HH:mm:ss'), width: 32 },
    { header: 'Gravité', value: (l) => (l.severity === 'error' ? 'ERREUR' : 'AVERTISSEMENT'), width: 26 },
    { header: 'Module', value: (l) => l.module || '-', width: 28 },
    { header: 'Action', value: (l) => l.action || '-', width: 50 },
    { header: 'Détails', value: (l) => formatErrorDetails(l.details) },
    { header: 'Utilisateur', value: (l) => l.userName || '-', width: 40 },
  ];

  const exportErrorLogs = (fileFormat: 'csv' | 'pdf') => {
    const rows = visibleErrorLogs;
    if (rows.length === 0) return;
    const fileName = `aquapilote-journal-erreurs-${timestampSuffix()}`;
    if (fileFormat === 'csv') {
      exportRowsToCsv(rows, ERROR_LOG_COLUMNS, fileName);
    } else {
      exportRowsToPdf(rows, ERROR_LOG_COLUMNS, fileName, {
        title: "Journal des erreurs et avertissements",
        subtitle: 'Administration AquaPilote',
      });
    }
    toast({ title: 'Export généré', description: `${rows.length} entrée(s) exportée(s) en ${fileFormat.toUpperCase()}.` });
  };
  const [selectedUserForUnits, setSelectedUserForUnits] = useState<AdminUser | null>(null);
  const [manageUnitsFor, setManageUnitsFor] = useState<{ id: string; name: string } | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isAssigningCountry, setIsAssigningCountry] = useState(false);
  const [defaultCountryDialogOpen, setDefaultCountryDialogOpen] = useState(false);
  const [selectedDefaultCountry, setSelectedDefaultCountry] = useState<string>('');

  // Statistiques calculées
  const stats = {
    totalUsers: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    managers: users.filter(u => u.role === 'manager').length,
    operators: users.filter(u => u.role === 'operator').length,
    regularUsers: users.filter(u => u.role === 'user').length,
    onlineUsers: onlineUserIds.size,
    recentUsers: users.filter(u => {
      const userDate = new Date(u.created_at);
      const weekAgo = subDays(new Date(), 7);
      return userDate >= weekAgo;
    }).length,
    errors: logs.filter(l => l.severity === 'error').length,
    warnings: logs.filter(l => l.severity === 'warning').length,
    activities: logs.filter(l => {
      const logDate = new Date(l.timestamp);
      const today = startOfDay(new Date());
      return logDate >= today;
    }).length,
    suspendedUsers: users.filter(u => u.isSuspended).length
  };

  // Country distribution
  const countryDistribution = users.reduce((acc, user) => {
    const country = user.country || 'Non spécifié';
    if (!acc[country]) {
      acc[country] = { count: 0, online: 0 };
    }
    acc[country].count++;
    if (onlineUserIds.has(user.id)) {
      acc[country].online++;
    }
    return acc;
  }, {} as Record<string, { count: number; online: number }>);

  const countryData = Object.entries(countryDistribution)
    .map(([country, data]) => ({
      name: country,
      count: data.count,
      online: data.online
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Données pour les graphiques
  const roleDistribution = [
    { name: 'Admins', value: stats.admins, color: 'hsl(var(--destructive))' },
    { name: 'Managers', value: stats.managers, color: 'hsl(var(--primary))' },
    { name: 'Operators', value: stats.operators, color: 'hsl(var(--aqua-primary))' },
    { name: 'Users', value: stats.regularUsers, color: 'hsl(var(--muted-foreground))' }
  ];

  const activityData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayLogs = logs.filter(l => {
      const logDate = new Date(l.timestamp);
      return logDate >= startOfDay(date) && logDate <= endOfDay(date);
    });
    
    return {
      date: format(date, 'dd/MM'),
      activities: dayLogs.length,
      errors: dayLogs.filter(l => l.severity === 'error').length,
      warnings: dayLogs.filter(l => l.severity === 'warning').length
    };
  });

  const moduleActivity = logs.reduce((acc, log) => {
    const module = log.module || 'Autre';
    if (!acc[module]) {
      acc[module] = 0;
    }
    acc[module]++;
    return acc;
  }, {} as Record<string, number>);

  const moduleData = Object.entries(moduleActivity)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const loadOnlineUsers = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('user_id, last_activity_at')
        .eq('is_active', true)
        .gte('last_activity_at', fiveMinutesAgo);

      if (sessions) {
        const onlineIds = new Set(sessions.map(s => s.user_id));
        setOnlineUserIds(onlineIds);
      }
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Récupérer les dernières sessions pour chaque utilisateur
      const { data: lastSessions } = await supabase
        .from('user_sessions')
        .select('user_id, login_at')
        .order('login_at', { ascending: false });

      const lastLoginMap = new Map<string, string>();
      lastSessions?.forEach(session => {
        if (!lastLoginMap.has(session.user_id)) {
          lastLoginMap.set(session.user_id, session.login_at);
        }
      });

      const usersData: AdminUser[] = (profiles || []).map((profile: any) => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name || profile.email,
          role: (userRole?.role || 'user') as 'admin' | 'manager' | 'operator' | 'user',
          created_at: profile.created_at,
          lastLogin: lastLoginMap.get(profile.id),
          isOnline: onlineUserIds.has(profile.id),
          isSuspended: profile.is_suspended || false,
          suspensionReason: profile.suspension_reason,
          suspendedAt: profile.suspended_at,
          country: profile.country,
          countryCode: profile.country_code
        };
      });

      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading users:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors du chargement des utilisateurs',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOnlineUsers();
    loadUsers();

    // Rafraîchir le statut en ligne toutes les 30 secondes
    const interval = setInterval(loadOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Mettre à jour le statut en ligne des utilisateurs
    setUsers(prev => prev.map(u => ({
      ...u,
      isOnline: onlineUserIds.has(u.id)
    })));
  }, [onlineUserIds]);

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }

    if (filterCountry !== 'all') {
      if (filterCountry === 'none') {
        filtered = filtered.filter(user => !user.country);
      } else {
        filtered = filtered.filter(user => user.countryCode === filterCountry);
      }
    }

    setFilteredUsers(filtered);
  }, [searchTerm, filterRole, filterCountry, users]);

  // Écouter les changements de sessions en temps réel
  useEffect(() => {
    const channel = supabase
      .channel(`admin-sessions-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_sessions'
        },
        () => {
          loadOnlineUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userEmail} ?`)) {
      return;
    }

    try {
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleError) {
        toast({
          title: t('error'),
          description: roleError.message,
          variant: 'destructive'
        });
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        toast({
          title: t('error'),
          description: profileError.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: 'Utilisateur supprimé avec succès'
      });

      loadUsers();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error deleting user:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors de la suppression',
        variant: 'destructive'
      });
    }
  };

  const handleSuspendUser = async (userId: string, userName: string, suspend: boolean, reason?: string) => {
    const action = suspend ? 'suspendre' : 'réactiver';
    if (!confirm(`Êtes-vous sûr de vouloir ${action} l'utilisateur ${userName} ?`)) {
      return;
    }

    try {
      const updateData: any = {
        is_suspended: suspend,
        suspension_reason: suspend ? (reason || 'Non-paiement') : null,
        suspended_at: suspend ? new Date().toISOString() : null
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: suspend 
          ? `Utilisateur ${userName} suspendu avec succès` 
          : `Utilisateur ${userName} réactivé avec succès`
      });

      loadUsers();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error suspending user:', error);
      toast({
        title: t('error'),
        description: `Erreur lors de la ${suspend ? 'suspension' : 'réactivation'}`,
        variant: 'destructive'
      });
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: 'Email de réinitialisation envoyé'
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error resetting password:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors de la réinitialisation',
        variant: 'destructive'
      });
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'manager' | 'operator' | 'user') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', userId);

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: 'Rôle modifié avec succès'
      });

      loadUsers();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error changing role:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors de la modification du rôle',
        variant: 'destructive'
      });
    }
  };

  const countryCodeToName: Record<string, string> = {
    'TG': 'Togo',
    'BJ': 'Bénin',
    'CI': "Côte d'Ivoire",
    'SN': 'Sénégal',
    'ML': 'Mali',
    'BF': 'Burkina Faso',
    'NE': 'Niger',
    'GN': 'Guinée',
    'CM': 'Cameroun',
    'GA': 'Gabon',
    'CG': 'Congo',
    'CD': 'RD Congo',
    'TD': 'Tchad',
    'CF': 'Centrafrique',
    'MG': 'Madagascar',
    'MU': 'Maurice',
    'MA': 'Maroc',
    'DZ': 'Algérie',
    'TN': 'Tunisie',
    'EG': 'Égypte',
    'FR': 'France',
    'BE': 'Belgique',
    'CH': 'Suisse',
    'CA': 'Canada'
  };

  const handleChangeCountry = async (userId: string, countryCode: string) => {
    if (countryCode === 'none') return;
    
    const countryName = countryCodeToName[countryCode] || countryCode;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          country: countryName,
          country_code: countryCode 
        })
        .eq('id', userId);

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: `Pays modifié en ${countryName}`
      });

      loadUsers();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error changing country:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors de la modification du pays',
        variant: 'destructive'
      });
    }
  };

  const usersWithoutCountry = users.filter(u => !u.country);

  const handleAssignDefaultCountry = async () => {
    if (!selectedDefaultCountry) {
      toast({
        title: t('error'),
        description: 'Veuillez sélectionner un pays',
        variant: 'destructive'
      });
      return;
    }

    const countryName = countryCodeToName[selectedDefaultCountry] || selectedDefaultCountry;
    const usersToUpdate = users.filter(u => !u.country);
    
    if (usersToUpdate.length === 0) {
      toast({
        title: 'Info',
        description: 'Tous les utilisateurs ont déjà un pays défini'
      });
      return;
    }

    setIsAssigningCountry(true);
    
    try {
      // Update all users without country in batch
      const { error } = await supabase
        .from('profiles')
        .update({ 
          country: countryName,
          country_code: selectedDefaultCountry 
        })
        .is('country', null);

      if (error) {
        toast({
          title: t('error'),
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: t('success'),
        description: `${usersToUpdate.length} utilisateur(s) mis à jour avec le pays ${countryName}`
      });

      setDefaultCountryDialogOpen(false);
      setSelectedDefaultCountry('');
      loadUsers();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error assigning default country:', error);
      toast({
        title: t('error'),
        description: 'Erreur lors de l\'attribution du pays',
        variant: 'destructive'
      });
    } finally {
      setIsAssigningCountry(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'operator': return 'secondary';
      default: return 'outline';
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications en temps réel */}
      <AdminAlertNotification />
      
      <div className="bg-gradient-to-r from-primary/90 to-aqua-primary/80 p-4 sm:p-6 rounded-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Tableau de bord administrateur</h2>
            <p className="text-primary-foreground/80 text-sm sm:text-base">
              Supervision complète de l'application avec alertes en temps réel
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 px-3 py-2 rounded-lg">
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">{stats.onlineUsers} en ligne</span>
            </div>
            <BarChart3 className="w-8 h-8 text-primary-foreground/80" />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Sub-navigation is rendered in the left sidebar (AppSidebar). Keep the
            Tabs wrapper for content switching but hide the inline TabsList. */}
        <TabsList className="hidden">
          <TabsTrigger value="overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Vue d'ensemble</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="activations">
            <UserPlus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Activations</span>
            <span className="sm:hidden">Act.</span>
          </TabsTrigger>
          <TabsTrigger value="registrations">
            <ClipboardList className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Inscriptions</span>
            <span className="sm:hidden">Insc.</span>
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Utilisateurs</span>
            <span className="sm:hidden">Users</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <CreditCard className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Abonnements</span>
            <span className="sm:hidden">Abo</span>
          </TabsTrigger>
          <TabsTrigger value="support">
            <Headphones className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Support</span>
            <span className="sm:hidden">Support</span>
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Base de données</span>
            <span className="sm:hidden">DB</span>
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Activités</span>
            <span className="sm:hidden">Logs</span>
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Eye className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Confidentialité</span>
            <span className="sm:hidden">RGPD</span>
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Erreurs</span>
            <span className="sm:hidden">Bugs</span>
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Sécurité</span>
            <span className="sm:hidden">Sécu</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Statistiques d'accès des abonnés */}
          <AccessStatsPanel />

          {/* Vue financière globale */}
          <FinanceOverviewPanel />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total utilisateurs</p>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                    <p className="text-xs text-muted-foreground mt-1">+{stats.recentUsers} cette semaine</p>
                  </div>
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">En ligne maintenant</p>
                    <p className="text-2xl font-bold text-green-600">{stats.onlineUsers}</p>
                    <p className="text-xs text-green-600 mt-1">Actifs dernières 5 min</p>
                  </div>
                  <Wifi className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Activités aujourd'hui</p>
                    <p className="text-2xl font-bold">{stats.activities}</p>
                  </div>
                  <Activity className="w-8 h-8 text-aqua-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Erreurs</p>
                    <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avertissements</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.warnings}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribution des rôles</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {roleDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Modules les plus utilisés</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={moduleData.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={10} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <OnlineUsersPanel />
          </div>

          {/* Geographic distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Répartition géographique
                  </CardTitle>
                  {usersWithoutCountry.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDefaultCountryDialogOpen(true)}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      {usersWithoutCountry.length} sans pays
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {countryData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune donnée de pays disponible</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {countryData.map((country, index) => (
                      <div key={country.name} className="flex items-center gap-3">
                        <div className="w-6 text-center font-mono text-sm text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{country.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {country.count} utilisateur{country.count > 1 ? 's' : ''}
                              </Badge>
                              {country.online > 0 && (
                                <Badge variant="default" className="bg-green-500 text-white text-xs">
                                  {country.online} en ligne
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all" 
                              style={{ width: `${(country.count / stats.totalUsers) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activité sur 7 jours</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="activities" stroke="hsl(var(--primary))" name="Activités" />
                    <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" name="Erreurs" />
                    <Line type="monotone" dataKey="warnings" stroke="#f59e0b" name="Avertissements" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Visits and Support Stats */}
          <VisitsStatsPanel />
        </TabsContent>

        <TabsContent value="activations" className="space-y-4">
          <PendingActivations />
        </TabsContent>
        <TabsContent value="emails" className="space-y-4">
          <EmailStatusPanel />
        </TabsContent>
        <TabsContent value="registrations" className="space-y-4">
          <RegistrationsPanel />
        </TabsContent>
        <TabsContent value="users" className="space-y-4">
          <TeamMembersOverviewPanel
            owners={users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))}
          />
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Gestion des utilisateurs</CardTitle>
                <Button onClick={() => setIsAddUserDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input 
                    placeholder="Rechercher un utilisateur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrer par rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les rôles</SelectItem>
                      <SelectItem value="admin">Administrateurs</SelectItem>
                      <SelectItem value="manager">Managers</SelectItem>
                      <SelectItem value="operator">Opérateurs</SelectItem>
                      <SelectItem value="user">Utilisateurs</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterCountry} onValueChange={setFilterCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrer par pays" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les pays</SelectItem>
                      <SelectItem value="none">Sans pays défini</SelectItem>
                      <SelectItem value="TG">🇹🇬 Togo</SelectItem>
                      <SelectItem value="BJ">🇧🇯 Bénin</SelectItem>
                      <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                      <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
                      <SelectItem value="ML">🇲🇱 Mali</SelectItem>
                      <SelectItem value="BF">🇧🇫 Burkina Faso</SelectItem>
                      <SelectItem value="NE">🇳🇪 Niger</SelectItem>
                      <SelectItem value="GN">🇬🇳 Guinée</SelectItem>
                      <SelectItem value="CM">🇨🇲 Cameroun</SelectItem>
                      <SelectItem value="GA">🇬🇦 Gabon</SelectItem>
                      <SelectItem value="CG">🇨🇬 Congo</SelectItem>
                      <SelectItem value="CD">🇨🇩 RD Congo</SelectItem>
                      <SelectItem value="MG">🇲🇬 Madagascar</SelectItem>
                      <SelectItem value="MA">🇲🇦 Maroc</SelectItem>
                      <SelectItem value="FR">🇫🇷 France</SelectItem>
                      <SelectItem value="BE">🇧🇪 Belgique</SelectItem>
                      <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statut</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Unités</TableHead>
                      <TableHead>Dernière connexion</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Chargement...
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Aucun utilisateur trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(user => (
                        <TableRow key={user.id} className={user.isSuspended ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {user.isSuspended ? (
                                <Badge variant="destructive" className="text-xs">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Suspendu
                                </Badge>
                              ) : onlineUserIds.has(user.id) ? (
                                <Badge variant="default" className="bg-green-500 text-white text-xs">
                                  <Wifi className="w-3 h-3 mr-1" />
                                  En ligne
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-xs">
                                  Hors ligne
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Select 
                              value={user.countryCode || 'none'} 
                              onValueChange={(value) => handleChangeCountry(user.id, value)}
                            >
                              <SelectTrigger className="w-36">
                                {user.country ? (
                                  <div className="flex items-center gap-1.5">
                                    <Globe className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-sm font-medium truncate">{user.country}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Globe className="w-3 h-3 text-muted-foreground opacity-50" />
                                    <span className="text-muted-foreground text-sm italic">Sélectionner</span>
                                  </div>
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" disabled>Sélectionner un pays</SelectItem>
                                <SelectItem value="TG">🇹🇬 Togo</SelectItem>
                                <SelectItem value="BJ">🇧🇯 Bénin</SelectItem>
                                <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                                <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
                                <SelectItem value="ML">🇲🇱 Mali</SelectItem>
                                <SelectItem value="BF">🇧🇫 Burkina Faso</SelectItem>
                                <SelectItem value="NE">🇳🇪 Niger</SelectItem>
                                <SelectItem value="GN">🇬🇳 Guinée</SelectItem>
                                <SelectItem value="CM">🇨🇲 Cameroun</SelectItem>
                                <SelectItem value="GA">🇬🇦 Gabon</SelectItem>
                                <SelectItem value="CG">🇨🇬 Congo</SelectItem>
                                <SelectItem value="CD">🇨🇩 RD Congo</SelectItem>
                                <SelectItem value="TD">🇹🇩 Tchad</SelectItem>
                                <SelectItem value="CF">🇨🇫 Centrafrique</SelectItem>
                                <SelectItem value="MG">🇲🇬 Madagascar</SelectItem>
                                <SelectItem value="MU">🇲🇺 Maurice</SelectItem>
                                <SelectItem value="MA">🇲🇦 Maroc</SelectItem>
                                <SelectItem value="DZ">🇩🇿 Algérie</SelectItem>
                                <SelectItem value="TN">🇹🇳 Tunisie</SelectItem>
                                <SelectItem value="EG">🇪🇬 Égypte</SelectItem>
                                <SelectItem value="FR">🇫🇷 France</SelectItem>
                                <SelectItem value="BE">🇧🇪 Belgique</SelectItem>
                                <SelectItem value="CH">🇨🇭 Suisse</SelectItem>
                                <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={user.role} 
                              onValueChange={(value: any) => handleChangeRole(user.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <Badge variant={getRoleBadgeVariant(user.role)}>
                                  {user.role}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Utilisateur</SelectItem>
                                <SelectItem value="operator">Opérateur</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="admin">Administrateur</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <UserUnitsDisplay 
                              units={user.units || productionUnits.map(u => ({
                                id: u.id,
                                name: u.name,
                                type: u.type,
                                isActive: u.isActive
                              }))}
                              compact
                            />
                          </TableCell>
                          <TableCell>
                            {user.lastLogin ? (
                              <div className="text-sm">
                                <p>{format(new Date(user.lastLogin), 'dd/MM/yyyy')}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true, locale: fr })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Jamais</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedUserForHistory({ id: user.id, name: user.full_name })}
                                title="Historique des connexions"
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setManageUnitsFor({ id: user.id, name: user.full_name })}
                                title="Gérer les unités"
                              >
                                <Building2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetPassword(user.id, user.email)}
                                title="Réinitialiser le mot de passe"
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                              {user.isSuspended ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuspendUser(user.id, user.full_name, false)}
                                  title="Réactiver l'utilisateur"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <PlayCircle className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSuspendUser(user.id, user.full_name, true, 'Non-paiement')}
                                  title="Suspendre l'utilisateur"
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                title="Supprimer l'utilisateur"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <SupportModule />
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <FinanceOverviewPanel />
          <SubscriptionsPanel
            users={users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))}
          />
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DatabaseStoragePanel />
            <DatabaseStatsPanel />
          </div>
          <OnlineUsersPanel />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Journal d'activités</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {logs.slice(0, 100).map(log => (
                  <div 
                    key={log.id} 
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`mt-1 rounded-full p-1 ${
                      log.severity === 'error' ? 'bg-destructive/20 text-destructive' :
                      log.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                      log.severity === 'success' ? 'bg-green-100 text-green-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {log.severity === 'error' ? <AlertTriangle className="w-4 h-4" /> :
                       log.severity === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                       <Activity className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.userName}</span>
                        <Badge variant="outline" className="text-xs">{log.module}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{log.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">{log.details}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune activité enregistrée
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Données de confidentialité collectées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Informations collectées lors de l'acceptation de la politique de confidentialité par les utilisateurs.
              </p>
              <div className="space-y-3">
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-2">Données collectées lors de l'inscription</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Nom complet</li>
                      <li>Adresse email</li>
                      <li>Pays de connexion (détection automatique)</li>
                      <li>Date et heure d'inscription</li>
                      <li>Acceptation des CGU et politique de confidentialité</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-2">Données de session</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Adresse IP de connexion</li>
                      <li>Agent utilisateur (navigateur)</li>
                      <li>Historique des connexions</li>
                      <li>Dernière activité</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <div className="rounded-md border overflow-x-auto mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Pays</TableHead>
                        <TableHead>Date d'inscription</TableHead>
                        <TableHead>Dernière connexion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.slice(0, 20).map(user => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.country ? (
                              <div className="flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-muted-foreground" />
                                <span>{user.country}</span>
                                {user.countryCode && (
                                  <Badge variant="outline" className="text-xs">
                                    {user.countryCode}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(user.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                          <TableCell>
                            {user.lastLogin ? format(new Date(user.lastLogin), 'dd/MM/yyyy HH:mm') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Erreurs et avertissements</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={visibleErrorLogs.length === 0}
                  onClick={() => exportErrorLogs('csv')}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={visibleErrorLogs.length === 0}
                  onClick={() => exportErrorLogs('pdf')}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPurgingErrors}
                  onClick={purgeErrorLogs}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isPurgingErrors ? 'Purge…' : 'Vider le journal'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {visibleErrorLogs
                  .slice(0, 100)
                  .map(log => (
                    <div 
                      key={log.id} 
                      className={`p-4 border-l-4 rounded-lg ${
                        log.severity === 'error' 
                          ? 'border-destructive bg-destructive/5' 
                          : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                          log.severity === 'error' ? 'text-destructive' : 'text-yellow-600'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge variant={log.severity === 'error' ? 'destructive' : 'default'}>
                              {log.severity === 'error' ? 'ERREUR' : 'AVERTISSEMENT'}
                            </Badge>
                            <Badge variant="outline">{log.module}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                            </span>
                          </div>
                          <p className="font-medium mb-1">{log.action}</p>
                          <p className="text-sm text-muted-foreground break-words">{formatErrorDetails(log.details)}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Utilisateur: {log.userName}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                {visibleErrorLogs.length === 0 && (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 mx-auto text-green-500 mb-3" />
                    <p className="text-lg font-medium text-green-600">Aucune erreur détectée</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      L'application fonctionne normalement
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecurityFindingsPanel />
        </TabsContent>
      </Tabs>

      {/* Dialog pour l'historique des sessions */}
      {selectedUserForHistory && (
        <UserSessionHistory
          userId={selectedUserForHistory.id}
          userName={selectedUserForHistory.name}
          isOpen={!!selectedUserForHistory}
          onClose={() => setSelectedUserForHistory(null)}
        />
      )}

      {/* Dialog pour ajouter un utilisateur avec unités */}
      <AddUserWithUnitsDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        onUserAdded={loadUsers}
      />

      {manageUnitsFor && (
        <ManageUserUnitsDialog
          open={!!manageUnitsFor}
          onOpenChange={(v) => !v && setManageUnitsFor(null)}
          userId={manageUnitsFor.id}
          userName={manageUnitsFor.name}
        />
      )}

      {/* Dialog pour attribuer un pays par défaut */}
      <Dialog open={defaultCountryDialogOpen} onOpenChange={setDefaultCountryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Attribuer un pays par défaut
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>{usersWithoutCountry.length}</strong> utilisateur(s) n'ont pas de pays défini. 
                Sélectionnez un pays à attribuer à tous ces utilisateurs.
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Pays par défaut</label>
              <Select value={selectedDefaultCountry} onValueChange={setSelectedDefaultCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TG">🇹🇬 Togo</SelectItem>
                  <SelectItem value="BJ">🇧🇯 Bénin</SelectItem>
                  <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                  <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
                  <SelectItem value="ML">🇲🇱 Mali</SelectItem>
                  <SelectItem value="BF">🇧🇫 Burkina Faso</SelectItem>
                  <SelectItem value="NE">🇳🇪 Niger</SelectItem>
                  <SelectItem value="GN">🇬🇳 Guinée</SelectItem>
                  <SelectItem value="CM">🇨🇲 Cameroun</SelectItem>
                  <SelectItem value="GA">🇬🇦 Gabon</SelectItem>
                  <SelectItem value="CG">🇨🇬 Congo</SelectItem>
                  <SelectItem value="CD">🇨🇩 RD Congo</SelectItem>
                  <SelectItem value="TD">🇹🇩 Tchad</SelectItem>
                  <SelectItem value="CF">🇨🇫 Centrafrique</SelectItem>
                  <SelectItem value="MG">🇲🇬 Madagascar</SelectItem>
                  <SelectItem value="MU">🇲🇺 Maurice</SelectItem>
                  <SelectItem value="MA">🇲🇦 Maroc</SelectItem>
                  <SelectItem value="DZ">🇩🇿 Algérie</SelectItem>
                  <SelectItem value="TN">🇹🇳 Tunisie</SelectItem>
                  <SelectItem value="EG">🇪🇬 Égypte</SelectItem>
                  <SelectItem value="FR">🇫🇷 France</SelectItem>
                  <SelectItem value="BE">🇧🇪 Belgique</SelectItem>
                  <SelectItem value="CH">🇨🇭 Suisse</SelectItem>
                  <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDefaultCountryDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleAssignDefaultCountry}
                disabled={!selectedDefaultCountry || isAssigningCountry}
              >
                {isAssigningCountry ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Attribution...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Attribuer à {usersWithoutCountry.length} utilisateur(s)
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
