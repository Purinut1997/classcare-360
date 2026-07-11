import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          if (separatorIndex < 0) return [line, ''];
          return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
        }),
    );
  } catch {
    return null;
  }
}

const envPath = resolve(process.cwd(), '.env.local');
const env = readEnvFile(envPath);

if (!env) {
  console.error('Missing .env.local. Create it with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local.');
  process.exit(1);
}

if (supabaseUrl.includes('your-project') || supabaseAnonKey.includes('your-anon-key')) {
  console.error('Replace placeholder Supabase values in .env.local before checking.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const { data, error } = await supabase.from('plans').select('code,name').limit(5);

if (error) {
  console.error('Supabase responded, but the app query failed:');
  console.error(error.message);
  console.error('');
  console.error('If the message mentions a missing relation/table, run the SQL migrations and seed.sql first.');
  process.exit(1);
}

console.log('Supabase connection OK.');
console.log(`Plans visible through anon key: ${data?.map((plan) => plan.code).join(', ') || 'none'}`);
