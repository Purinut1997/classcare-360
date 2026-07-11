const env = import.meta.env;

export const appEnv = {
  appName: env.VITE_APP_NAME || 'ClassCare 360',
  timezone: env.VITE_APP_TIMEZONE || 'Asia/Bangkok',
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
};

export function hasSupabaseConfig() {
  return Boolean(appEnv.supabaseUrl && appEnv.supabaseAnonKey);
}
