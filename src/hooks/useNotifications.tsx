import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  module: string;
  is_read: boolean;
  is_critical: boolean;
  metadata: Record<string, any>;
  created_at: string;
  read_at: string | null;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Show browser notification for critical alerts
  const showBrowserNotification = useCallback((notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotif = new window.Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.png',
        tag: notification.id,
        requireInteraction: notification.is_critical,
      });

      browserNotif.onclick = () => {
        window.focus();
        browserNotif.close();
      };

      // Auto close after 10 seconds for non-critical
      if (!notification.is_critical) {
        setTimeout(() => browserNotif.close(), 10000);
      }
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio notification not supported');
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user?.id]);

  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  // Create notification (for internal use)
  const createNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'user_id' | 'is_read' | 'created_at' | 'read_at'>
  ) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          user_id: user.id,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Fetch initial notifications
    fetchNotifications();
    
    // Request notification permission
    requestNotificationPermission();

    // Polling avoids channel reuse races during React StrictMode remounts while
    // keeping the dashboard notifications automatically synchronized.
    const refreshInterval = window.setInterval(fetchNotifications, 15_000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [user?.id, fetchNotifications, requestNotificationPermission, playNotificationSound, showBrowserNotification, toast]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const criticalCount = notifications.filter(n => n.is_critical && !n.is_read).length;

  return {
    notifications,
    loading,
    unreadCount,
    criticalCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    refetch: fetchNotifications,
  };
};
