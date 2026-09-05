import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Eye, Users, Clock, Globe, TrendingUp, Calendar, Headphones, MessageSquare, CheckCircle, Smartphone, Tablet, Monitor, HelpCircle, MapPin, RefreshCw, Wifi, LayoutDashboard, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/clientConfig';
import { format, subDays, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSettings } from '@/contexts/SettingsContext';
import { getDeviceTypeLabel } from '@/lib/deviceDetection';

const WorldMap = lazy(() => import('./WorldMap'));

interface VisitStats {
  totalVisits: number;
  uniqueVisitors: number;
  averageSessionDuration: number;
  todayVisits: number;
  weeklyVisits: number;
  monthlyVisits: number;
  anonymousVisits: number;
  authenticatedVisits: number;
  liveVisitors: number;
}

interface SupportStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResponseTime: number;
  ticketsByCategory: { name: string; value: number }[];
  ticketsByPriority: { name: string; value: number; color: string }[];
  ticketsByDevice: { name: string; value: number; color: string }[];
}

interface CountryStats {
  country: string;
  countryCode: string;
  visits: number;
}

interface DeviceStats {
  deviceType: string;
  count: number;
  percentage: number;
}

interface ModuleStats {
  module: string;
  visits: number;
}

interface RecentVisit {
  id: string;
  country: string;
  countryCode: string;
  deviceType: string;
  deviceInfo: string;
  createdAt: string;
  isAnonymous: boolean;
  pagePath: string;
}

const DEVICE_COLORS: Record<string, string> = {
  phone: 'hsl(var(--primary))',
  tablet: '#8b5cf6',
  desktop: 'hsl(var(--aqua-primary))',
  other: 'hsl(var(--muted-foreground))'
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--aqua-primary))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'];

// Country code to flag emoji
const countryCodeToFlag = (code: string): string => {
  if (!code || code === 'XX') return '🌍';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Map page paths to readable module names
const getModuleName = (path: string): string => {
  const moduleMap: Record<string, string> = {
    '/': 'Accueil',
    '/auth': 'Authentification',
    '/onboarding': 'Onboarding',
    '/dashboard': 'Tableau de bord',
  };
  if (moduleMap[path]) return moduleMap[path];
  // Extract module from dashboard hash routes
  if (path.includes('#') || path.includes('?tab=')) {
    const parts = path.split(/[#?]/);
    return parts[1] || 'Tableau de bord';
  }
  return path || 'Accueil';
};

const VisitsStatsPanel: React.FC = () => {
  const { t, language } = useSettings();
  const [visitStats, setVisitStats] = useState<VisitStats>({
    totalVisits: 0,
    uniqueVisitors: 0,
    averageSessionDuration: 0,
    todayVisits: 0,
    weeklyVisits: 0,
    monthlyVisits: 0,
    anonymousVisits: 0,
    authenticatedVisits: 0,
    liveVisitors: 0
  });
  const [supportStats, setSupportStats] = useState<SupportStats>({
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    avgResponseTime: 0,
    ticketsByCategory: [],
    ticketsByPriority: [],
    ticketsByDevice: []
  });
  const [dailyVisits, setDailyVisits] = useState<{ date: string; visits: number; uniqueUsers: number; anonymous: number }[]>([]);
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats[]>([]);
  const [moduleStats, setModuleStats] = useState<ModuleStats[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [pwaInstallCount, setPwaInstallCount] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVisitStats = useCallback(async () => {
    try {
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('*')
        .order('login_at', { ascending: false });

      const { data: anonymousVisits } = await supabase
        .from('anonymous_visits')
        .select('*')
        .order('created_at', { ascending: false });

      const authSessions = sessions || [];
      const anonVisits = anonymousVisits || [];

      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = subDays(now, 7);
      const monthStart = subDays(now, 30);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const sessionDurations = authSessions
        .filter(s => s.logout_at)
        .map(s => differenceInMinutes(new Date(s.logout_at!), new Date(s.login_at)))
        .filter(d => d > 0 && d < 480);

      const avgDuration = sessionDurations.length > 0
        ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
        : 0;

      const uniqueUserIds = new Set(authSessions.map(s => s.user_id));
      const uniqueAnonSessions = new Set(anonVisits.map(v => v.session_id));

      const todayAuthVisits = authSessions.filter(s => new Date(s.login_at) >= todayStart).length;
      const todayAnonVisits = anonVisits.filter(v => new Date(v.created_at) >= todayStart).length;

      const weeklyAuthVisits = authSessions.filter(s => new Date(s.login_at) >= weekStart).length;
      const weeklyAnonVisits = anonVisits.filter(v => new Date(v.created_at) >= weekStart).length;

      const monthlyAuthVisits = authSessions.filter(s => new Date(s.login_at) >= monthStart).length;
      const monthlyAnonVisits = anonVisits.filter(v => new Date(v.created_at) >= monthStart).length;

      const liveAuthVisitors = authSessions.filter(s => 
        s.is_active && new Date(s.last_activity_at) >= fiveMinutesAgo
      ).length;
      const liveAnonVisitors = anonVisits.filter(v => 
        new Date(v.last_activity_at) >= fiveMinutesAgo
      ).length;

      setVisitStats({
        totalVisits: authSessions.length + anonVisits.length,
        uniqueVisitors: uniqueUserIds.size + uniqueAnonSessions.size,
        averageSessionDuration: avgDuration,
        todayVisits: todayAuthVisits + todayAnonVisits,
        weeklyVisits: weeklyAuthVisits + weeklyAnonVisits,
        monthlyVisits: monthlyAuthVisits + monthlyAnonVisits,
        anonymousVisits: anonVisits.length,
        authenticatedVisits: authSessions.length,
        liveVisitors: liveAuthVisitors + liveAnonVisitors
      });

      // Daily visits chart (last 14 days)
      const dailyData: { date: string; visits: number; uniqueUsers: number; anonymous: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const day = subDays(now, i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        
        const dayAuthSessions = authSessions.filter(s => {
          const loginDate = new Date(s.login_at);
          return loginDate >= dayStart && loginDate <= dayEnd;
        });
        
        const dayAnonVisits = anonVisits.filter(v => {
          const visitDate = new Date(v.created_at);
          return visitDate >= dayStart && visitDate <= dayEnd;
        });
        
        const uniqueUsersThisDay = new Set(dayAuthSessions.map(s => s.user_id));
        
        dailyData.push({
          date: format(day, 'dd/MM', { locale: fr }),
          visits: dayAuthSessions.length + dayAnonVisits.length,
          uniqueUsers: uniqueUsersThisDay.size,
          anonymous: dayAnonVisits.length
        });
      }
      setDailyVisits(dailyData);

      // Country statistics
      const countryCounts: Record<string, { country: string; countryCode: string; count: number }> = {};
      
      authSessions.forEach(s => {
        const country = (s as any).country || 'Inconnu';
        const countryCode = (s as any).country_code || 'XX';
        if (!countryCounts[country]) {
          countryCounts[country] = { country, countryCode, count: 0 };
        }
        countryCounts[country].count++;
      });
      
      anonVisits.forEach(v => {
        const country = v.country || 'Inconnu';
        const countryCode = v.country_code || 'XX';
        if (!countryCounts[country]) {
          countryCounts[country] = { country, countryCode, count: 0 };
        }
        countryCounts[country].count++;
      });
      
      const sortedCountries = Object.values(countryCounts)
        .map(c => ({ country: c.country, countryCode: c.countryCode, visits: c.count }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10);
      setCountryStats(sortedCountries);

      // Device statistics
      const deviceCounts: Record<string, number> = { phone: 0, tablet: 0, desktop: 0, other: 0 };
      
      authSessions.forEach(s => {
        const deviceType = (s as any).device_type || 'other';
        deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
      });
      
      anonVisits.forEach(v => {
        const deviceType = v.device_type || 'other';
        deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
      });
      
      const totalDevices = Object.values(deviceCounts).reduce((a, b) => a + b, 0);
      const deviceData = Object.entries(deviceCounts)
        .filter(([_, count]) => count > 0)
        .map(([deviceType, count]) => ({
          deviceType,
          count,
          percentage: totalDevices > 0 ? Math.round((count / totalDevices) * 100) : 0
        }));
      setDeviceStats(deviceData);

      // Module/page statistics
      const moduleCounts: Record<string, number> = {};
      anonVisits.forEach(v => {
        const moduleName = getModuleName(v.page_path || '/');
        moduleCounts[moduleName] = (moduleCounts[moduleName] || 0) + 1;
      });
      const moduleData = Object.entries(moduleCounts)
        .map(([module, visits]) => ({ module, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10);
      setModuleStats(moduleData);

    } catch (error) {
      console.error('Error loading visit stats:', error);
    }
  }, []);

  const loadSupportStats = useCallback(async () => {
    try {
      const { data: tickets } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (!tickets) return;

      const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

      const respondedTickets = tickets.filter(t => t.responded_at);
      const avgResponseTime = respondedTickets.length > 0
        ? Math.round(respondedTickets.reduce((acc, t) => {
            const created = new Date(t.created_at);
            const responded = new Date(t.responded_at!);
            return acc + differenceInMinutes(responded, created) / 60;
          }, 0) / respondedTickets.length)
        : 0;

      const categoryCount: Record<string, number> = {};
      tickets.forEach(t => {
        const cat = t.category || 'Autre';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      const ticketsByCategory = Object.entries(categoryCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      const priorityColors: Record<string, string> = {
        'low': 'hsl(var(--muted-foreground))',
        'normal': 'hsl(var(--primary))',
        'high': '#f59e0b',
        'urgent': 'hsl(var(--destructive))'
      };
      const priorityLabels: Record<string, string> = {
        'low': 'Basse',
        'normal': 'Normale',
        'high': 'Haute',
        'urgent': 'Urgente'
      };
      const priorityCount: Record<string, number> = {};
      tickets.forEach(t => {
        const priority = t.priority || 'normal';
        priorityCount[priority] = (priorityCount[priority] || 0) + 1;
      });
      const ticketsByPriority = Object.entries(priorityCount)
        .map(([name, value]) => ({ 
          name: priorityLabels[name] || name, 
          value,
          color: priorityColors[name] || 'hsl(var(--muted-foreground))'
        }));

      setSupportStats({
        totalTickets: tickets.length,
        openTickets,
        resolvedTickets,
        avgResponseTime,
        ticketsByCategory,
        ticketsByPriority,
        ticketsByDevice: []
      });

    } catch (error) {
      console.error('Error loading support stats:', error);
    }
  }, []);

  const loadRecentVisits = useCallback(async () => {
    try {
      const { data: anonVisits } = await supabase
        .from('anonymous_visits')
        .select('id, country, country_code, device_type, device_info, created_at, page_path')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: authSessions } = await supabase
        .from('user_sessions')
        .select('id, country, country_code, device_type, device_info, login_at')
        .order('login_at', { ascending: false })
        .limit(10);

      const combined: RecentVisit[] = [];
      
      (anonVisits || []).forEach(v => {
        combined.push({
          id: v.id,
          country: v.country || 'Inconnu',
          countryCode: v.country_code || 'XX',
          deviceType: v.device_type || 'other',
          deviceInfo: v.device_info || '',
          createdAt: v.created_at,
          isAnonymous: true,
          pagePath: v.page_path || '/'
        });
      });
      
      (authSessions || []).forEach(s => {
        combined.push({
          id: s.id,
          country: (s as any).country || 'Inconnu',
          countryCode: (s as any).country_code || 'XX',
          deviceType: (s as any).device_type || 'other',
          deviceInfo: (s as any).device_info || '',
          createdAt: s.login_at,
          isAnonymous: false,
          pagePath: '/dashboard'
        });
      });

      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentVisits(combined.slice(0, 20));
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading recent visits:', error);
    }
  }, []);

  const loadPwaInstalls = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('pwa_installs' as any)
        .select('*', { count: 'exact', head: true });
      setPwaInstallCount(count || 0);
    } catch (error) {
      console.error('Error loading PWA installs:', error);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadVisitStats(), loadSupportStats(), loadRecentVisits(), loadPwaInstalls()]);
    setIsRefreshing(false);
  }, [loadVisitStats, loadSupportStats, loadRecentVisits, loadPwaInstalls]);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([loadVisitStats(), loadSupportStats(), loadRecentVisits(), loadPwaInstalls()]);
      setIsLoading(false);
    };
    loadAll();

    const sessionsChannel = supabase
      .channel(`admin-sessions-realtime-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
        loadVisitStats();
        loadRecentVisits();
      })
      .subscribe();

    const anonChannel = supabase
      .channel(`admin-anon-visits-realtime-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anonymous_visits' }, () => {
        loadVisitStats();
        loadRecentVisits();
      })
      .subscribe();

    const ticketsChannel = supabase
      .channel(`admin-tickets-realtime-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        loadSupportStats();
      })
      .subscribe();

    pollingRef.current = setInterval(() => {
      loadVisitStats();
      loadRecentVisits();
    }, 30000);

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(anonChannel);
      supabase.removeChannel(ticketsChannel);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadVisitStats, loadSupportStats, loadRecentVisits]);

  const DeviceIcon = ({ type, className }: { type: string; className?: string }) => {
    switch (type) {
      case 'phone': return <Smartphone className={className || "w-5 h-5 text-primary"} />;
      case 'tablet': return <Tablet className={className || "w-5 h-5 text-purple-500"} />;
      case 'desktop': return <Monitor className={className || "w-5 h-5 text-aqua-primary"} />;
      default: return <HelpCircle className={className || "w-5 h-5 text-muted-foreground"} />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Chargement des statistiques...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live indicator and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
            <Wifi className="w-4 h-4 text-green-600 animate-pulse" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              {visitStats.liveVisitors} en ligne
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            MAJ: {format(lastUpdate, 'HH:mm:ss')}
          </span>
        </div>
        <button
          onClick={refreshAll}
          disabled={isRefreshing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <Tabs defaultValue="visits" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visits" className="gap-2">
            <Eye className="w-4 h-4" />
            Visites
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2">
            <Headphones className="w-4 h-4" />
            Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="space-y-4 mt-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Eye className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.totalVisits}</p>
                <p className="text-xs text-muted-foreground">Visites totales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 text-aqua-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.uniqueVisitors}</p>
                <p className="text-xs text-muted-foreground">Visiteurs uniques</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-4 text-center">
                <Wifi className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{visitStats.liveVisitors}</p>
                <p className="text-xs text-muted-foreground">En ligne</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.todayVisits}</p>
                <p className="text-xs text-muted-foreground">Aujourd'hui</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.weeklyVisits}</p>
                <p className="text-xs text-muted-foreground">Cette semaine</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Globe className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.monthlyVisits}</p>
                <p className="text-xs text-muted-foreground">Ce mois</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <HelpCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.anonymousVisits}</p>
                <p className="text-xs text-muted-foreground">Anonymes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{visitStats.averageSessionDuration}m</p>
                <p className="text-xs text-muted-foreground">Session moy.</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Visits with dates */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-green-500" />
                  Visites récentes (temps réel)
                </div>
                <Badge variant="secondary" className="animate-pulse">Live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentVisits.length > 0 ? (
                  recentVisits.map((visit) => (
                    <div 
                      key={visit.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <DeviceIcon type={visit.deviceType} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {getDeviceTypeLabel(visit.deviceType, language === 'en' ? 'en' : 'fr')}
                            </span>
                            {visit.isAnonymous ? (
                              <Badge variant="outline" className="text-xs">Anonyme</Badge>
                            ) : (
                              <Badge variant="default" className="text-xs bg-green-600">Connecté</Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {getModuleName(visit.pagePath)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{visit.deviceInfo}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-sm">
                          <span>{countryCodeToFlag(visit.countryCode)}</span>
                          {visit.country}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                          {format(new Date(visit.createdAt), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(visit.createdAt), 'HH:mm:ss', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucune visite récente</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* World Map - Interactive Geographic Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Carte mondiale des visiteurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countryStats.length > 0 ? (
                <Suspense fallback={<div className="h-[300px] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
                  <WorldMap countryStats={countryStats} />
                </Suspense>
              ) : (
                <p className="text-center text-muted-foreground py-8">Aucune donnée de pays</p>
              )}
            </CardContent>
          </Card>

          {/* PWA Installations */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Download className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">{pwaInstallCount}</p>
                  <p className="text-sm text-muted-foreground">Installations PWA totales</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device & Module Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Appareils utilisés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deviceStats.length > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={deviceStats.map(d => ({
                            name: getDeviceTypeLabel(d.deviceType, language === 'en' ? 'en' : 'fr'),
                            value: d.count,
                            color: DEVICE_COLORS[d.deviceType] || DEVICE_COLORS.other
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={65}
                          dataKey="value"
                        >
                          {deviceStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DEVICE_COLORS[entry.deviceType] || DEVICE_COLORS.other} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {deviceStats.map((device) => (
                        <div key={device.deviceType} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <DeviceIcon type={device.deviceType} className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {getDeviceTypeLabel(device.deviceType, language === 'en' ? 'en' : 'fr')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{device.count}</span>
                            <Badge variant="outline" className="text-xs">{device.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucune donnée d'appareil</p>
                )}
              </CardContent>
            </Card>

            {/* Module/Page visits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5" />
                  Modules visités
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moduleStats.length > 0 ? (
                  <div className="space-y-2">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={moduleStats.slice(0, 6)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="module" type="category" fontSize={11} width={100} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))' 
                          }}
                        />
                        <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {moduleStats.map((mod, index) => (
                        <div key={mod.module} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 text-center text-xs">{index + 1}</Badge>
                            <span className="text-sm">{mod.module}</span>
                          </div>
                          <span className="text-sm font-bold">{mod.visits} visites</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucune donnée de module</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Country Distribution Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Pays des visiteurs - Classement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countryStats.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {countryStats.map((country, index) => {
                    const maxVisits = countryStats[0]?.visits || 1;
                    const percentage = Math.round((country.visits / maxVisits) * 100);
                    return (
                      <div key={country.country} className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 text-center text-xs">
                          {index + 1}
                        </Badge>
                        <span className="text-lg">{countryCodeToFlag(country.countryCode)}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{country.country}</span>
                            <span className="text-sm text-muted-foreground">{country.visits} visites</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Aucune donnée de pays</p>
              )}
            </CardContent>
          </Card>

          {/* Visits Evolution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Évolution des visites (14 derniers jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyVisits}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} name="Toutes visites" />
                  <Line type="monotone" dataKey="anonymous" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="Anonymes" />
                  <Line type="monotone" dataKey="uniqueUsers" stroke="hsl(var(--aqua-primary))" strokeWidth={2} name="Utilisateurs uniques" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <MessageSquare className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{supportStats.totalTickets}</p>
                <p className="text-xs text-muted-foreground">Tickets total</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardContent className="p-4 text-center">
                <Headphones className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{supportStats.openTickets}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{supportStats.resolvedTickets}</p>
                <p className="text-xs text-muted-foreground">Résolus</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{supportStats.avgResponseTime}h</p>
                <p className="text-xs text-muted-foreground">Temps réponse moy.</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tickets par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {supportStats.ticketsByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={supportStats.ticketsByCategory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucun ticket</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tickets par priorité</CardTitle>
              </CardHeader>
              <CardContent>
                {supportStats.ticketsByPriority.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={supportStats.ticketsByPriority}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={70}
                        dataKey="value"
                      >
                        {supportStats.ticketsByPriority.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Aucun ticket</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VisitsStatsPanel;
