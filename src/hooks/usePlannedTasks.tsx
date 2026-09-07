import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
export interface PlannedTask {
  id: string;
  user_id: string;
  title: string;
  type: 'feeding' | 'purchase' | 'sale' | 'monitoring' | 'maintenance' | 'health';
  description: string | null;
  assigned_to: string | null;
  due_date: string;
  due_time: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  unit_id: string | null;
  unit_name: string | null;
  source: 'manual' | 'feeding_plan';
  source_id: string | null;
  alert_sent: boolean;
  created_at: string;
  updated_at: string;
}

export const usePlannedTasks = (unitId?: string) => {
  const [tasks, setTasks] = useState<PlannedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const tasksRef = useRef<PlannedTask[]>([]);
  const alertIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const playAlertSound = useCallback(() => {
    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Create an attention-grabbing sound pattern
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(1200, ctx.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      
      // Play second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1000, ctx.currentTime);
        gain2.gain.setValueAtTime(0.5, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.3);
      }, 600);
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const user = session?.user;
      if (!user) {
        setTasks([]);
        setError(null);
        return;
      }

      // IMPORTANT:
      // - We rely on RLS to scope data. We don't hard-filter on user_id so the app can
      //   support shared/team visibility via policies without code changes.
      let query = supabase
        .from('planned_tasks')
        .select('*')
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true });

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setTasks((data as PlannedTask[]) || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err?.message ?? 'Erreur lors du chargement des tâches');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [unitId]);
  const createTask = useCallback(
    async (task: Omit<PlannedTask, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'alert_sent'>) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Utilisateur non connecté');

        const { data, error: insertError } = await supabase
          .from('planned_tasks')
          .insert({
            ...task,
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setTasks(prev => [...prev, data as PlannedTask]);
        toast({
          title: 'Tâche créée',
          description: `${task.title} programmée pour ${task.due_date} à ${task.due_time}`,
        });

        return data as PlannedTask;
      } catch (err: any) {
        console.error('Error creating task:', err);
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<PlannedTask>) => {
      try {
        const { error: updateError } = await supabase
          .from('planned_tasks')
          .update(updates)
          .eq('id', id);

        if (updateError) throw updateError;

        setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
        return true;
      } catch (err: any) {
        console.error('Error updating task:', err);
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      try {
        const { error: deleteError } = await supabase
          .from('planned_tasks')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        setTasks(prev => prev.filter(t => t.id !== id));
        toast({
          title: 'Tâche supprimée',
        });
        return true;
      } catch (err: any) {
        console.error('Error deleting task:', err);
        toast({
          title: 'Erreur',
          description: err.message,
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  const checkDueTasks = useCallback(async () => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const currentTasks = tasksRef.current;

    const dueTasks = currentTasks.filter(task => {
      if (task.status === 'completed' || task.alert_sent) return false;
      if (task.due_date !== currentDate) return false;

      const [taskHours, taskMinutes] = task.due_time.split(':').map(Number);
      const [nowHours, nowMinutes] = currentTime.split(':').map(Number);

      const taskTotalMinutes = taskHours * 60 + taskMinutes;
      const nowTotalMinutes = nowHours * 60 + nowMinutes;

      // Alert if task is due within -5 to +5 minutes window
      return Math.abs(taskTotalMinutes - nowTotalMinutes) <= 5;
    });

    for (const task of dueTasks) {
      if (!task.alert_sent) {
        playAlertSound();

        toast({
          title: '🔔 Tâche programmée !',
          description: `${task.title} - ${task.due_time}`,
          duration: 10000,
        });

        if (Notification.permission === 'granted') {
          new Notification('AquaPilote - Tâche programmée', {
            body: `${task.title} à ${task.due_time}`,
            icon: '/favicon.png',
            requireInteraction: true,
          });
        }

        await updateTask(task.id, { alert_sent: true });
      }
    }
  }, [playAlertSound, toast, updateTask]);
  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Charger les tâches au montage + quand l'unité change
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Vérifier les tâches échues toutes les 30 secondes (interval stable)
  useEffect(() => {
    alertIntervalRef.current = window.setInterval(checkDueTasks, 30000);

    return () => {
      if (alertIntervalRef.current !== null) {
        window.clearInterval(alertIntervalRef.current);
        alertIntervalRef.current = null;
      }
    };
  }, [checkDueTasks]);
  // Get upcoming tasks (next 24 hours)
  const upcomingTasks = tasks.filter(task => {
    if (task.status === 'completed') return false;
    const now = new Date();
    const taskDate = new Date(`${task.due_date}T${task.due_time}`);
    const diff = taskDate.getTime() - now.getTime();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  });

  // Get today's tasks
  const todayTasks = tasks.filter(task => {
    const today = new Date().toISOString().split('T')[0];
    return task.due_date === today;
  });

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
    upcomingTasks,
    todayTasks,
    playAlertSound,
  };
};
