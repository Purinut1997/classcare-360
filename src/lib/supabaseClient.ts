import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { appEnv, hasSupabaseConfig } from './env';

export const supabase: SupabaseClient | null = hasSupabaseConfig()
  ? createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseReady = Boolean(supabase);
