import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Wifi, WifiOff, RefreshCw, Clock, Globe, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/clientConfig';

interface OnlineUser {
  userId: string;
  userName: string;
  email: string;
  lastActivity: string;
  isOnline: boolean;
  country?: string;
  countryCode?: string;
}

// Simple country code to flag emoji converter
const getCountryFlag = (countryCode?: string) => {
  if (!countryCode) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const OnlineUsersPanel: React.FC = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOnlineUsers = async () => {
    setIsLoading(true);
    try {
      // Récupérer les sessions actives des 5 dernières minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('user_id, last_activity_at')
        .eq('is_active', true)
        .gte('last_activity_at', fiveMinutesAgo);

      if (sessionsError) throw sessionsError;

      if (sessions && sessions.length > 0) {
        const userIds = [...new Set(sessions.map(s => s.user_id))];
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email, country, country_code')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const onlineUsersList = (profiles || []).map(profile => {
          const session = sessions.find(s => s.user_id === profile.id);
          return {
            userId: profile.id,
            userName: profile.full_name || profile.email,
            email: profile.email,
            lastActivity: session?.last_activity_at || new Date().toISOString(),
            isOnline: true,
            country: profile.country,
            countryCode: profile.country_code
          };
        });

        setOnlineUsers(onlineUsersList);
      } else {
        setOnlineUsers([]);
      }
    } catch (error) {
      console.error('Error loading online users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOnlineUsers();
    
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadOnlineUsers, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Écouter les changements en temps réel
  useEffect(() => {
    const channel = supabase
      .channel(`online-users-changes-${Math.random().toString(36).slice(2)}`)
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-green-500" />
            Utilisateurs en ligne
            <Badge variant="secondary" className="ml-2">
              {onlineUsers.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadOnlineUsers} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <WifiOff className="w-8 h-8 mb-2" />
            <p className="text-sm">Aucun utilisateur en ligne</p>
          </div>
        ) : (
          <div className="space-y-3">
            {onlineUsers.map((user) => (
              <div
                key={user.userId}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.userName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{user.userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {user.country && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm">{getCountryFlag(user.countryCode)}</span>
                      <span className="text-xs text-muted-foreground">{user.country}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(new Date(user.lastActivity), { 
                      addSuffix: false, 
                      locale: fr 
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OnlineUsersPanel;
