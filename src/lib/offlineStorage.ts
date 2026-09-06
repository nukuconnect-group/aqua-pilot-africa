import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/env';
// Gestion du stockage hors ligne avec IndexedDB et synchronisation

const DB_NAME = 'aqua-pilot-offline';
const DB_VERSION = 1;
const PENDING_ACTIONS_STORE = 'pendingActions';
const OFFLINE_DATA_STORE = 'offlineData';

interface PendingAction {
  id: string;
  timestamp: number;
  type: string;
  data: any;
  endpoint: string;
  method: string;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store pour les actions en attente
        if (!db.objectStoreNames.contains(PENDING_ACTIONS_STORE)) {
          const pendingStore = db.createObjectStore(PENDING_ACTIONS_STORE, { keyPath: 'id' });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store pour les données en cache
        if (!db.objectStoreNames.contains(OFFLINE_DATA_STORE)) {
          const dataStore = db.createObjectStore(OFFLINE_DATA_STORE, { keyPath: 'key' });
          dataStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Ajouter une action en attente
  async addPendingAction(action: Omit<PendingAction, 'id' | 'timestamp'>): Promise<void> {
    if (!this.db) await this.init();

    const pendingAction: PendingAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_ACTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);
      const request = store.add(pendingAction);

      request.onsuccess = () => {
        if (import.meta.env.DEV) console.log('✅ Action mise en file d\'attente:', pendingAction);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Récupérer toutes les actions en attente
  async getPendingActions(): Promise<PendingAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_ACTIONS_STORE], 'readonly');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Supprimer une action en attente
  async removePendingAction(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PENDING_ACTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_ACTIONS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sauvegarder des données en cache
  async saveOfflineData(key: string, data: any): Promise<void> {
    if (!this.db) await this.init();

    const cacheEntry = {
      key,
      data,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([OFFLINE_DATA_STORE], 'readwrite');
      const store = transaction.objectStore(OFFLINE_DATA_STORE);
      const request = store.put(cacheEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Récupérer des données du cache
  async getOfflineData(key: string): Promise<any | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([OFFLINE_DATA_STORE], 'readonly');
      const store = transaction.objectStore(OFFLINE_DATA_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Synchroniser toutes les actions en attente
  async syncPendingActions(): Promise<void> {
    const pendingActions = await this.getPendingActions();
    
    if (pendingActions.length === 0) {
      if (import.meta.env.DEV) console.log('✅ Aucune action en attente');
      return;
    }

    if (import.meta.env.DEV) console.log(`🔄 Synchronisation de ${pendingActions.length} action(s) en attente...`);

    // Get authentication session for sync
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.warn('Cannot sync without authentication - clearing offline queue');
      return;
    }

    for (const action of pendingActions) {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        // Add authentication headers for Supabase endpoints
        if (action.endpoint.includes(SUPABASE_URL)) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
          headers['apikey'] = SUPABASE_ANON_KEY;
        }

        const response = await fetch(action.endpoint, {
          method: action.method,
          headers,
          body: JSON.stringify(action.data),
        });

        if (response.ok) {
          await this.removePendingAction(action.id);
          if (import.meta.env.DEV) console.log('✅ Action synchronisée:', action.type);
        } else {
          if (import.meta.env.DEV) console.warn('⚠️ Échec de synchronisation:', action.type, response.status);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('❌ Erreur lors de la synchronisation:', error);
      }
    }
  }
}

// Instance singleton
export const offlineStorage = new OfflineStorage();

// Initialiser le stockage hors ligne
offlineStorage.init().catch(console.error);

// Écouter le retour de la connexion
window.addEventListener('online', async () => {
  if (import.meta.env.DEV) console.log('🌐 Connexion rétablie - Synchronisation...');
  try {
    await offlineStorage.syncPendingActions();
    if (import.meta.env.DEV) console.log('✅ Synchronisation terminée');
  } catch (error) {
    if (import.meta.env.DEV) console.error('❌ Erreur de synchronisation:', error);
  }
});

window.addEventListener('offline', () => {
  if (import.meta.env.DEV) console.log('📴 Mode hors ligne activé');
});

// Exposer les informations de connexion
export const getConnectionStatus = () => ({
  isOnline: navigator.onLine,
  effectiveType: (navigator as any).connection?.effectiveType || 'unknown',
});
