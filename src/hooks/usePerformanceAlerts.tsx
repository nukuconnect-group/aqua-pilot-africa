import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { createNotification } from '@/lib/notificationService';
import { format, subDays, parseISO } from 'date-fns';

export interface AlertThresholds {
  id?: string;
  user_id?: string;
  // FCR
  fcr_warning_threshold: number;
  fcr_critical_threshold: number;
  fcr_enabled: boolean;
  // Mortality
  mortality_daily_warning: number;
  mortality_daily_critical: number;
  mortality_enabled: boolean;
  // Temperature
  temp_min_warning: number;
  temp_min_critical: number;
  temp_max_warning: number;
  temp_max_critical: number;
  temp_enabled: boolean;
  // Oxygen
  oxygen_warning: number;
  oxygen_critical: number;
  oxygen_enabled: boolean;
  // pH
  ph_min_warning: number;
  ph_min_critical: number;
  ph_max_warning: number;
  ph_max_critical: number;
  ph_enabled: boolean;
  // Production
  production_behind_warning: number;
  production_behind_critical: number;
  production_enabled: boolean;
  // Stock
  stock_days_warning: number;
  stock_days_critical: number;
  stock_enabled: boolean;
  // Notifications
  email_notifications: boolean;
  push_notifications: boolean;
}

export interface PerformanceAlert {
  id: string;
  user_id: string;
  alert_type: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  metric_name?: string;
  metric_value?: number;
  threshold_value?: number;
  unit_id?: string;
  unit_name?: string;
  cycle_id?: string;
  cycle_name?: string;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  fcr_warning_threshold: 2.0,
  fcr_critical_threshold: 2.5,
  fcr_enabled: true,
  mortality_daily_warning: 0.5,
  mortality_daily_critical: 1.0,
  mortality_enabled: true,
  temp_min_warning: 20,
  temp_min_critical: 18,
  temp_max_warning: 30,
  temp_max_critical: 32,
  temp_enabled: true,
  oxygen_warning: 5.0,
  oxygen_critical: 4.0,
  oxygen_enabled: true,
  ph_min_warning: 6.5,
  ph_min_critical: 6.0,
  ph_max_warning: 8.5,
  ph_max_critical: 9.0,
  ph_enabled: true,
  production_behind_warning: 10,
  production_behind_critical: 25,
  production_enabled: true,
  stock_days_warning: 7,
  stock_days_critical: 3,
  stock_enabled: true,
  email_notifications: true,
  push_notifications: true,
};

export const usePerformanceAlerts = () => {
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { cycles } = useProductionCycles();
  const { records: feedingRecords } = useFeedingRecords();
  const { records: healthRecords } = useHealthRecords();
  const { stocks } = useFeedStocks();

  // Fetch thresholds
  const fetchThresholds = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('performance_alert_thresholds')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setThresholds(data as AlertThresholds);
      } else {
        // Create default thresholds for user
        const { error: insertError } = await supabase
          .from('performance_alert_thresholds')
          .insert({ ...DEFAULT_THRESHOLDS, user_id: user.id });

        if (insertError) console.error('Error creating default thresholds:', insertError);
      }
    } catch (error) {
      console.error('Error fetching thresholds:', error);
    }
  }, [user?.id]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('performance_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAlerts((data as PerformanceAlert[]) || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Update thresholds
  const updateThresholds = useCallback(async (newThresholds: Partial<AlertThresholds>) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('performance_alert_thresholds')
        .upsert({
          ...thresholds,
          ...newThresholds,
          user_id: user.id,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setThresholds(prev => ({ ...prev, ...newThresholds }));
      toast({
        title: 'Seuils mis à jour',
        description: 'Les seuils d\'alerte ont été enregistrés',
      });
    } catch (error) {
      console.error('Error updating thresholds:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour les seuils',
        variant: 'destructive',
      });
    }
  }, [user?.id, thresholds, toast]);

  // Create alert
  const createAlert = useCallback(async (alert: Omit<PerformanceAlert, 'id' | 'user_id' | 'created_at' | 'is_acknowledged'>) => {
    if (!user?.id) return;

    try {
      // Check if similar alert exists in last 24h
      const yesterday = subDays(new Date(), 1).toISOString();
      const { data: existing } = await supabase
        .from('performance_alerts')
        .select('id')
        .eq('user_id', user.id)
        .eq('alert_type', alert.alert_type)
        .eq('unit_id', alert.unit_id || '')
        .gte('created_at', yesterday)
        .limit(1);

      if (existing && existing.length > 0) {
        // Skip duplicate alert
        return;
      }

      const { error } = await supabase
        .from('performance_alerts')
        .insert({
          ...alert,
          user_id: user.id,
        });

      if (error) throw error;

      // Also create a notification
      await createNotification({
        userId: user.id,
        title: alert.title,
        message: alert.message,
        type: alert.severity === 'critical' ? 'error' : 'warning',
        module: 'Performance',
        isCritical: alert.severity === 'critical',
        metadata: alert.metadata,
      });

      await fetchAlerts();
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }, [user?.id, fetchAlerts]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('performance_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.name || user.email,
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(a => 
        a.id === alertId 
          ? { ...a, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
          : a
      ));
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }, [user?.id, user?.name, user?.email]);

  // Delete alert
  const deleteAlert = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('performance_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  }, []);

  // Check all thresholds
  const checkThresholds = useCallback(async () => {
    if (!user?.id || checking) return;

    setChecking(true);
    const newAlerts: Omit<PerformanceAlert, 'id' | 'user_id' | 'created_at' | 'is_acknowledged'>[] = [];

    try {
      // Check FCR
      if (thresholds.fcr_enabled && feedingRecords.length > 0) {
        const recentRecords = feedingRecords.filter(r => {
          const date = parseISO(r.date);
          return date >= subDays(new Date(), 7);
        });

        const avgFCR = recentRecords.reduce((sum, r) => sum + (r.fcr || 0), 0) / 
          (recentRecords.filter(r => r.fcr).length || 1);

        if (avgFCR >= thresholds.fcr_critical_threshold) {
          newAlerts.push({
            alert_type: 'fcr',
            severity: 'critical',
            title: 'FCR critique',
            message: `Le FCR moyen (${avgFCR.toFixed(2)}) dépasse le seuil critique de ${thresholds.fcr_critical_threshold}`,
            metric_name: 'FCR',
            metric_value: avgFCR,
            threshold_value: thresholds.fcr_critical_threshold,
          });
        } else if (avgFCR >= thresholds.fcr_warning_threshold) {
          newAlerts.push({
            alert_type: 'fcr',
            severity: 'warning',
            title: 'FCR élevé',
            message: `Le FCR moyen (${avgFCR.toFixed(2)}) dépasse le seuil d'alerte de ${thresholds.fcr_warning_threshold}`,
            metric_name: 'FCR',
            metric_value: avgFCR,
            threshold_value: thresholds.fcr_warning_threshold,
          });
        }
      }

      // Check Temperature & Oxygen & pH from health records
      if (healthRecords.length > 0) {
        const todayRecords = healthRecords.filter(r => r.date === format(new Date(), 'yyyy-MM-dd'));

        for (const record of todayRecords) {
          // Temperature
          if (thresholds.temp_enabled && record.temperature) {
            if (record.temperature <= thresholds.temp_min_critical || record.temperature >= thresholds.temp_max_critical) {
              newAlerts.push({
                alert_type: 'temperature',
                severity: 'critical',
                title: 'Température critique',
                message: `Température de ${record.temperature}°C détectée (seuil: ${thresholds.temp_min_critical}-${thresholds.temp_max_critical}°C)`,
                metric_name: 'Température',
                metric_value: record.temperature,
                unit_id: record.unit_id,
              });
            } else if (record.temperature <= thresholds.temp_min_warning || record.temperature >= thresholds.temp_max_warning) {
              newAlerts.push({
                alert_type: 'temperature',
                severity: 'warning',
                title: 'Température anormale',
                message: `Température de ${record.temperature}°C détectée (seuil: ${thresholds.temp_min_warning}-${thresholds.temp_max_warning}°C)`,
                metric_name: 'Température',
                metric_value: record.temperature,
                unit_id: record.unit_id,
              });
            }
          }

          // Oxygen
          if (thresholds.oxygen_enabled && record.oxygen) {
            if (record.oxygen <= thresholds.oxygen_critical) {
              newAlerts.push({
                alert_type: 'oxygen',
                severity: 'critical',
                title: 'Oxygène critique',
                message: `Niveau d'oxygène critique: ${record.oxygen} mg/L (minimum: ${thresholds.oxygen_critical} mg/L)`,
                metric_name: 'Oxygène',
                metric_value: record.oxygen,
                threshold_value: thresholds.oxygen_critical,
                unit_id: record.unit_id,
              });
            } else if (record.oxygen <= thresholds.oxygen_warning) {
              newAlerts.push({
                alert_type: 'oxygen',
                severity: 'warning',
                title: 'Oxygène bas',
                message: `Niveau d'oxygène bas: ${record.oxygen} mg/L (alerte: ${thresholds.oxygen_warning} mg/L)`,
                metric_name: 'Oxygène',
                metric_value: record.oxygen,
                threshold_value: thresholds.oxygen_warning,
                unit_id: record.unit_id,
              });
            }
          }

          // pH
          if (thresholds.ph_enabled && record.ph) {
            if (record.ph <= thresholds.ph_min_critical || record.ph >= thresholds.ph_max_critical) {
              newAlerts.push({
                alert_type: 'ph',
                severity: 'critical',
                title: 'pH critique',
                message: `pH de ${record.ph} détecté (seuil: ${thresholds.ph_min_critical}-${thresholds.ph_max_critical})`,
                metric_name: 'pH',
                metric_value: record.ph,
                unit_id: record.unit_id,
              });
            } else if (record.ph <= thresholds.ph_min_warning || record.ph >= thresholds.ph_max_warning) {
              newAlerts.push({
                alert_type: 'ph',
                severity: 'warning',
                title: 'pH anormal',
                message: `pH de ${record.ph} détecté (seuil: ${thresholds.ph_min_warning}-${thresholds.ph_max_warning})`,
                metric_name: 'pH',
                metric_value: record.ph,
                unit_id: record.unit_id,
              });
            }
          }

          // Mortality
          if (thresholds.mortality_enabled && record.mortality) {
            // Assume mortality is a count, calculate percentage if we have cycle data
            if (record.mortality >= thresholds.mortality_daily_critical) {
              newAlerts.push({
                alert_type: 'mortality',
                severity: 'critical',
                title: 'Mortalité critique',
                message: `${record.mortality} morts enregistrées aujourd'hui (seuil critique: ${thresholds.mortality_daily_critical}%)`,
                metric_name: 'Mortalité',
                metric_value: record.mortality,
                threshold_value: thresholds.mortality_daily_critical,
                unit_id: record.unit_id,
              });
            } else if (record.mortality >= thresholds.mortality_daily_warning) {
              newAlerts.push({
                alert_type: 'mortality',
                severity: 'warning',
                title: 'Mortalité élevée',
                message: `${record.mortality} morts enregistrées aujourd'hui (seuil: ${thresholds.mortality_daily_warning}%)`,
                metric_name: 'Mortalité',
                metric_value: record.mortality,
                threshold_value: thresholds.mortality_daily_warning,
                unit_id: record.unit_id,
              });
            }
          }
        }
      }

      // Check Production progress
      if (thresholds.production_enabled && cycles.length > 0) {
        const activeCycles = cycles.filter(c => c.status === 'active' || c.status === 'en_cours');
        
        for (const cycle of activeCycles) {
          if (cycle.target_quantity > 0 && cycle.current_quantity > 0) {
            const progress = (cycle.current_quantity / cycle.target_quantity) * 100;
            const expectedProgress = 100; // Simplified - should calculate based on time elapsed
            const behind = expectedProgress - progress;

            if (behind >= thresholds.production_behind_critical) {
              newAlerts.push({
                alert_type: 'production',
                severity: 'critical',
                title: 'Retard de production critique',
                message: `Cycle "${cycle.name}" en retard de ${behind.toFixed(0)}% par rapport à l'objectif`,
                metric_name: 'Progression',
                metric_value: progress,
                threshold_value: expectedProgress - thresholds.production_behind_critical,
                cycle_id: cycle.id,
                cycle_name: cycle.name,
                unit_id: cycle.unit_id,
                unit_name: cycle.unit_name,
              });
            } else if (behind >= thresholds.production_behind_warning) {
              newAlerts.push({
                alert_type: 'production',
                severity: 'warning',
                title: 'Retard de production',
                message: `Cycle "${cycle.name}" en retard de ${behind.toFixed(0)}% par rapport à l'objectif`,
                metric_name: 'Progression',
                metric_value: progress,
                threshold_value: expectedProgress - thresholds.production_behind_warning,
                cycle_id: cycle.id,
                cycle_name: cycle.name,
                unit_id: cycle.unit_id,
                unit_name: cycle.unit_name,
              });
            }
          }
        }
      }

      // Check Stock levels
      if (thresholds.stock_enabled && stocks.length > 0) {
        for (const stock of stocks) {
          const threshold = stock.min_threshold || 100;
          if (stock.quantity <= threshold * 0.3) {
            newAlerts.push({
              alert_type: 'stock',
              severity: 'critical',
              title: 'Stock critique',
              message: `Stock de ${stock.custom_name || stock.feed_type} critique: ${stock.quantity} ${stock.unit} restants`,
              metric_name: 'Stock',
              metric_value: stock.quantity,
              threshold_value: threshold * 0.3,
              unit_id: stock.unit_id,
              metadata: { stockId: stock.id, feedType: stock.feed_type },
            });
          } else if (stock.quantity <= threshold) {
            newAlerts.push({
              alert_type: 'stock',
              severity: 'warning',
              title: 'Stock bas',
              message: `Stock de ${stock.custom_name || stock.feed_type} bas: ${stock.quantity} ${stock.unit} restants (seuil: ${threshold})`,
              metric_name: 'Stock',
              metric_value: stock.quantity,
              threshold_value: threshold,
              unit_id: stock.unit_id,
              metadata: { stockId: stock.id, feedType: stock.feed_type },
            });
          }
        }
      }

      // Create all new alerts
      for (const alert of newAlerts) {
        await createAlert(alert);
      }

      if (newAlerts.length > 0) {
        toast({
          title: `${newAlerts.length} alerte(s) détectée(s)`,
          description: 'Consultez le panneau des alertes pour plus de détails',
          variant: newAlerts.some(a => a.severity === 'critical') ? 'destructive' : 'default',
        });
      }
    } catch (error) {
      console.error('Error checking thresholds:', error);
    } finally {
      setChecking(false);
    }
  }, [user?.id, checking, thresholds, feedingRecords, healthRecords, cycles, stocks, createAlert, toast]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      fetchThresholds();
      fetchAlerts();
    }
  }, [user?.id, fetchThresholds, fetchAlerts]);

  // Computed values
  const unacknowledgedAlerts = useMemo(() => 
    alerts.filter(a => !a.is_acknowledged),
    [alerts]
  );

  const criticalAlerts = useMemo(() => 
    alerts.filter(a => a.severity === 'critical' && !a.is_acknowledged),
    [alerts]
  );

  return {
    thresholds,
    alerts,
    unacknowledgedAlerts,
    criticalAlerts,
    loading,
    checking,
    updateThresholds,
    acknowledgeAlert,
    deleteAlert,
    checkThresholds,
    refetch: fetchAlerts,
  };
};
