
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/appClient';

interface LogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

interface LogsContextType {
  logs: LogEntry[];
  addLog: (action: string, module: string, details: string, severity?: 'info' | 'warning' | 'error' | 'success') => Promise<void>;
  clearLogs: () => Promise<void>;
  getLogsByModule: (module: string) => LogEntry[];
  getLogsByUser: (userId: string) => LogEntry[];
}

const OBSOLETE_ERROR_PATTERNS = [
  'Cannot stop, scanner is not running or paused',
  'postgres_changes',
  'Stethoscope is not defined',
  'useAuth must be used within an AuthProvider',
  'useLogs must be used within a LogsProvider',
  'useProductionUnits must be used within a ProductionUnitsProvider',
  'Minified React error #310',
  'invariant=310',
  'dev-sw.js',
  'ServiceWorker',
];

const isObsoleteError = (log: { action?: string | null; details?: string | null }) => {
  const content = `${log.action || ''} ${log.details || ''}`;
  return OBSOLETE_ERROR_PATTERNS.some((pattern) => content.includes(pattern));
};

const PURGED_AT_KEY = 'aquapilote-error-log-purged-at';

const isAfterLastPurge = (timestamp?: string | null) => {
  try {
    const purgedAt = localStorage.getItem(PURGED_AT_KEY);
    if (!purgedAt || !timestamp) return true;
    return new Date(timestamp).getTime() > new Date(purgedAt).getTime();
  } catch {
    return true;
  }
};

const EMPTY_LOGS_CONTEXT: LogsContextType = {
  logs: [],
  addLog: async () => undefined,
  clearLogs: async () => undefined,
  getLogsByModule: () => [],
  getLogsByUser: () => [],
};

// A safe default prevents a transient provider remount (notably during HMR or
// route recovery) from crashing the whole application.
const LogsContext = createContext<LogsContextType>(EMPTY_LOGS_CONTEXT);

export const useLogs = () => {
  return useContext(LogsContext);
};

export const LogsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const { user } = useAuth();

  // Charger les logs depuis Supabase
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1000);

        if (error) {
          console.error('Error loading logs:', error);
          return;
        }

        if (data && Array.isArray(data)) {
          const formattedLogs = data.filter((log: any) => !isObsoleteError(log) && isAfterLastPurge(log.timestamp)).map((log: any) => ({
            id: log.id,
            timestamp: log.timestamp,
            userId: log.user_id || '',
            userName: log.user_name,
            action: log.action,
            module: log.module,
            details: log.details || '',
            severity: log.severity as 'info' | 'warning' | 'error' | 'success'
          }));
          setLogs(formattedLogs);
        }
      } catch (error) {
        console.error('Error loading logs:', error);
      }
    };

    loadLogs();
  }, []);

  // Écouter les nouveaux logs en temps réel (Supabase Realtime)
  useEffect(() => {
    const channel = supabase
      .channel(`activity-logs-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs'
        },
        (payload) => {
          console.log('New log received:', payload);
          const newLog = payload.new as any;
          if (isObsoleteError(newLog) || !isAfterLastPurge(newLog.timestamp)) return;
          const formattedLog: LogEntry = {
            id: newLog.id,
            timestamp: newLog.timestamp,
            userId: newLog.user_id || '',
            userName: newLog.user_name,
            action: newLog.action,
            module: newLog.module,
            details: newLog.details || '',
            severity: newLog.severity
          };
          setLogs(prev => [formattedLog, ...prev].slice(0, 1000));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addLog = async (action: string, module: string, details: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: user.id,
          user_name: user.name,
          action,
          module,
          details,
          severity,
          timestamp: new Date().toISOString()
        } as any);

      if (error) {
        console.error('Error adding log:', error);
      }
    } catch (error) {
      console.error('Error adding log:', error);
    }
  };

  const clearLogs = async () => {
    const ts = new Date().toISOString();
    try {
      await supabase.from('activity_logs').delete().in('severity', ['error', 'warning']);
    } catch {
      /* Le marqueur local garantit la purge visuelle si la règle serveur refuse la suppression. */
    }
    try { localStorage.setItem(PURGED_AT_KEY, ts); } catch { /* ignore */ }
    setLogs([]);
  };

  const getLogsByModule = (module: string) => {
    return logs.filter(log => log.module === module);
  };

  const getLogsByUser = (userId: string) => {
    return logs.filter(log => log.userId === userId);
  };

  return (
    <LogsContext.Provider value={{
      logs,
      addLog,
      clearLogs,
      getLogsByModule,
      getLogsByUser
    }}>
      {children}
    </LogsContext.Provider>
  );
};
