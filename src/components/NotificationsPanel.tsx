import React, { useState, useMemo } from 'react';
import { Bell, X, Check, AlertTriangle, Info, Loader2, BellRing, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

const moduleToTab: Record<string, string> = {
  Alimentation: 'feeding',
  Stock: 'feeding',
  Surveillance: 'iot-control',
  Production: 'production',
  Santé: 'health',
  Équipe: 'team',
  Ventes: 'sales',
  Achats: 'purchases',
  Fournisseurs: 'suppliers',
  Planification: 'planning',
};

const NotificationsPanel = ({ onNavigate }: { onNavigate?: (tab: string) => void }) => {
  const { isAuthenticated, isDemoMode } = useAuth();
  const { t } = useSettings();
  const {
    notifications: realNotifications,
    loading,
    unreadCount: realUnreadCount,
    criticalCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Pas de données démo - utiliser les vraies données uniquement
  const notifications = isAuthenticated ? realNotifications : [];
  const unreadCount = isAuthenticated ? realUnreadCount : 0;
  
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('all');

  // Grouper les notifications par module/catégorie
  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    
    notifications.forEach(notification => {
      const category = notification.module || 'Autres';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(notification);
    });
    
    // Trier par nombre de non lues
    const sortedEntries = Object.entries(groups).sort((a, b) => {
      const unreadA = a[1].filter(n => !n.is_read).length;
      const unreadB = b[1].filter(n => !n.is_read).length;
      return unreadB - unreadA;
    });
    
    return Object.fromEntries(sortedEntries);
  }, [notifications]);

  // Filtrer les notifications critiques
  const criticalNotifications = useMemo(() => 
    notifications.filter(n => n.is_critical),
    [notifications]
  );

  const handleMarkAsRead = (id: string) => {
    if (isAuthenticated) {
      markAsRead(id);
    }
  };

  const handleMarkAllAsRead = () => {
    if (isAuthenticated) {
      markAllAsRead();
    }
  };

  const handleDelete = (id: string) => {
    if (isAuthenticated) {
      deleteNotification(id);
    }
  };

  const handleOpenNotification = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    const target = moduleToTab[notification.module || ''];
    if (target) onNavigate?.(target);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getIcon = (type: string, isCritical: boolean) => {
    if (isCritical) return <BellRing className="w-4 h-4 text-red-600 animate-pulse" />;
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'error': return <X className="w-4 h-4 text-red-600" />;
      case 'success': return <Check className="w-4 h-4 text-green-600" />;
      default: return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeColor = (type: string, isCritical: boolean) => {
    if (isCritical) return 'border-l-red-500 bg-red-50 dark:bg-red-950/30';
    switch (type) {
      case 'warning': return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30';
      case 'error': return 'border-l-red-500 bg-red-50 dark:bg-red-950/30';
      case 'success': return 'border-l-green-500 bg-green-50 dark:bg-green-950/30';
      default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Alimentation': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'Surveillance': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'Production': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Équipe': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Stock': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Santé': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  };

  const renderNotificationItem = (notification: Notification) => (
    <div
      key={notification.id}
      role="button"
      tabIndex={0}
      onClick={() => handleOpenNotification(notification)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') handleOpenNotification(notification);
      }}
      className={`border-l-4 p-3 rounded-r-lg transition-all ${getTypeColor(notification.type, notification.is_critical)} ${
        !notification.is_read ? 'bg-opacity-100' : 'bg-opacity-50 opacity-75'
      } cursor-pointer`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="shrink-0 mt-0.5">
            {getIcon(notification.type, notification.is_critical)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'}`}>
              {notification.title}
              {notification.is_critical && (
                <Badge variant="destructive" className="ml-2 text-[10px] py-0">
                  CRITIQUE
                </Badge>
              )}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">
                {new Date(notification.created_at).toLocaleString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-1 shrink-0">
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => { event.stopPropagation(); handleMarkAsRead(notification.id); }}
              className="h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900"
              title="Marquer comme lu"
            >
              <Check className="w-4 h-4 text-green-600" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => { event.stopPropagation(); handleDelete(notification.id); }}
            className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900"
            title={t('delete')}
          >
            <X className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative shrink-0 text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8 sm:h-9 sm:w-9">
          {criticalCount > 0 ? (
            <BellRing className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          ) : (
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
          {unreadCount > 0 && (
            <Badge className={`absolute top-0 right-0 min-w-4 h-4 bg-destructive text-destructive-foreground ${criticalCount > 0 ? 'motion-safe:animate-pulse' : ''} text-[9px] font-bold flex items-center justify-center px-0.5 rounded-full`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notifications.length}
                </Badge>
              )}
              {criticalCount > 0 && (
                <Badge variant="destructive" className="ml-1 animate-pulse">
                  {criticalCount} critique{criticalCount > 1 ? 's' : ''}
                </Badge>
              )}
            </span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
                Tout marquer comme lu
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-2">
            <TabsTrigger value="all" className="text-xs">
              Toutes ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">
              <Filter className="w-3 h-3 mr-1" />
              Catégories
            </TabsTrigger>
            <TabsTrigger value="critical" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Critiques ({criticalNotifications.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[50vh] sm:h-80 pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="all" className="mt-0 space-y-3">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Aucune notification</p>
                    </div>
                  ) : (
                    notifications.map(renderNotificationItem)
                  )}
                </TabsContent>

                <TabsContent value="categories" className="mt-0 space-y-2">
                  {Object.keys(groupedNotifications).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Aucune notification</p>
                    </div>
                  ) : (
                    Object.entries(groupedNotifications).map(([category, categoryNotifications]) => {
                      const unreadInCategory = categoryNotifications.filter(n => !n.is_read).length;
                      const isExpanded = expandedCategories[category] !== false;
                      
                      return (
                        <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              className="w-full justify-between p-3 h-auto"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <Badge className={getCategoryColor(category)}>
                                  {category}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  ({categoryNotifications.length})
                                </span>
                              </div>
                              {unreadInCategory > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {unreadInCategory} non lue{unreadInCategory > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 pl-4 pt-2">
                            {categoryNotifications.map(renderNotificationItem)}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="critical" className="mt-0 space-y-3">
                  {criticalNotifications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Check className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                      <p>Aucune alerte critique</p>
                    </div>
                  ) : (
                    criticalNotifications.map(renderNotificationItem)
                  )}
                </TabsContent>
              </>
            )}
          </ScrollArea>
        </Tabs>
        
        {notifications.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-center text-muted-foreground">
              {unreadCount > 0 
                ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes les notifications sont lues'
              }
            </p>
            {!isAuthenticated && (
              <p className="text-xs text-center text-muted-foreground mt-1">
                Connectez-vous pour recevoir vos notifications en temps réel
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NotificationsPanel;
