import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePlannedTasks } from '@/hooks/usePlannedTasks';
import { useFeedingPlans } from '@/hooks/useFeedingPlans';
import { cn } from '@/lib/utils';

interface DueTask {
  id: string;
  title: string;
  time: string;
  type: string;
  unitName?: string;
}

const TaskAlertIndicator = () => {
  const { tasks, playAlertSound } = usePlannedTasks();
  const { plans } = useFeedingPlans();
  const [dueTasks, setDueTasks] = useState<DueTask[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const lastAlertRef = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Loud alert sound
  const playLoudAlert = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Play 3 beeps
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
          
          gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
        }, i * 500);
      }
    } catch (err) {
      console.error('Error playing alert sound:', err);
    }
  }, []);

  const checkDueTasks = useCallback(() => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    
    const currentDayName = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][now.getDay()];
    
    const alertTasks: DueTask[] = [];

    // Check planned tasks
    tasks.forEach(task => {
      if (task.status === 'completed') return;
      if (task.due_date !== currentDate) return;
      
      const [taskHours, taskMinutes] = task.due_time.split(':').map(Number);
      const taskTotalMinutes = taskHours * 60 + taskMinutes;
      
      // Alert if task is due within -2 to +10 minutes window
      const diff = taskTotalMinutes - currentTotalMinutes;
      if (diff >= -2 && diff <= 10) {
        alertTasks.push({
          id: task.id,
          title: task.title,
          time: task.due_time,
          type: task.type,
          unitName: task.unit_name || undefined,
        });
      }
    });

    // Check feeding plans
    plans.forEach(plan => {
      if (!plan.is_active) return;
      if (!plan.days.includes(currentDayName)) return;
      
      const [planHours, planMinutes] = plan.time.split(':').map(Number);
      const planTotalMinutes = planHours * 60 + planMinutes;
      
      const diff = planTotalMinutes - currentTotalMinutes;
      if (diff >= -2 && diff <= 10) {
        alertTasks.push({
          id: `feed-${plan.id}`,
          title: `Alimentation: ${plan.feed_type}`,
          time: plan.time,
          type: 'feeding',
        });
      }
    });

    // Check for new alerts
    const newAlertIds = alertTasks.map(t => t.id);
    const hasNewAlerts = alertTasks.some(t => !lastAlertRef.current.includes(t.id));
    
    if (hasNewAlerts && alertTasks.length > 0) {
      playLoudAlert();
      setIsAnimating(true);
      
      // Request browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        alertTasks.forEach(task => {
          if (!lastAlertRef.current.includes(task.id)) {
            new Notification('🔔 Tâche planifiée!', {
              body: `${task.title} à ${task.time}`,
              icon: '/favicon.png',
              requireInteraction: true,
              tag: task.id,
            });
          }
        });
      }
      
      // Stop animation after 5 seconds
      setTimeout(() => setIsAnimating(false), 5000);
    }
    
    lastAlertRef.current = newAlertIds;
    setDueTasks(alertTasks);
  }, [tasks, plans, playLoudAlert]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Check immediately
    checkDueTasks();
    
    // Check every 30 seconds
    const interval = setInterval(checkDueTasks, 30000);
    
    return () => clearInterval(interval);
  }, [checkDueTasks]);

  const dismissTask = (taskId: string) => {
    setDueTasks(prev => prev.filter(t => t.id !== taskId));
    lastAlertRef.current = lastAlertRef.current.filter(id => id !== taskId);
  };

  if (dueTasks.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "relative h-8 w-8 p-0 text-primary-foreground hover:bg-primary-foreground/20",
          isAnimating && "motion-safe:animate-pulse"
        )}
        onClick={() => setShowPopup(!showPopup)}
        aria-label="Tâches à suivre"
      >
        {isAnimating ? (
          <BellRing className="w-5 h-5 text-yellow-300 animate-pulse" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        <Badge 
          className="absolute top-0 right-0 h-4 min-w-4 px-0.5 flex items-center justify-center text-[9px] bg-destructive text-destructive-foreground border-0"
        >
          {dueTasks.length > 99 ? '99+' : dueTasks.length}
        </Badge>
      </Button>

      {showPopup && (
        <Card className="fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-10 sm:w-80 z-[9999] shadow-xl border-2 border-dashboard-warning animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <BellRing className="w-4 h-4 text-yellow-500" />
                Tâches en cours
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowPopup(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dueTasks.map(task => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {task.time}
                      </Badge>
                      {task.unitName && (
                        <Badge variant="secondary" className="text-xs">
                          {task.unitName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => dismissTask(task.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TaskAlertIndicator;
