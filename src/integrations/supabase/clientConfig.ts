// Custom Supabase client configuration to avoid LockManager issues on iOS
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

// Custom lock function that bypasses LockManager for iOS compatibility
const customLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

// Export the configured supabase client
// LockManager is disabled for iOS compatibility
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'aqua-pilot-auth',
    lock: customLock as any
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'aqua-pilot-web'
    }
  }
});
