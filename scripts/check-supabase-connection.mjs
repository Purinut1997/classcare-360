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

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function isMissingRpc(error) {
  const message = error?.message?.toLowerCase() || '';
  return error?.code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
}

async function assertRpcExists(name, args) {
  const { error } = await supabase.rpc(name, args);

  if (isMissingRpc(error)) {
    return {
      name,
      ok: false,
      reason: error.message,
    };
  }

  // anon users may get permission denied because the function is granted to
  // authenticated users only. That still proves the function exists.
  return {
    name,
    ok: true,
    reason: error?.message || 'visible',
  };
}

const { data, error } = await supabase.from('plans').select('code,name').limit(5);

if (error) {
  console.error('Supabase responded, but the app query failed:');
  console.error(error.message);
  console.error('');
  console.error('If the message mentions a missing relation/table, run the SQL migrations and seed.sql first.');
  process.exit(1);
}

const destructiveRpcChecks = await Promise.all([
  assertRpcExists('delete_classroom_safely', { target_classroom_id: NIL_UUID }),
  assertRpcExists('delete_workspace_safely', { target_workspace_id: NIL_UUID }),
  assertRpcExists('delete_score_assessment_safely', { target_assessment_id: NIL_UUID }),
  assertRpcExists('delete_score_entry_safely', { target_entry_id: NIL_UUID }),
  assertRpcExists('restore_workspace_safely', { target_workspace_id: NIL_UUID }),
  assertRpcExists('restore_classroom_safely', { target_classroom_id: NIL_UUID }),
  assertRpcExists('grant_workspace_lifetime_vip', { target_workspace_id: NIL_UUID }),
  assertRpcExists('set_superadmin_profile_status', { target_profile_id: NIL_UUID, next_is_active: true }),
  assertRpcExists('set_profile_account_status_by_email', {
    target_email: 'missing@example.invalid',
    next_account_status: 'active',
  }),
]);
const missingDestructiveRpcs = destructiveRpcChecks.filter((check) => !check.ok);

if (missingDestructiveRpcs.length > 0) {
  console.error('Supabase action RPCs are missing:');
  for (const check of missingDestructiveRpcs) {
    console.error(`- ${check.name}: ${check.reason}`);
  }
  console.error('');
  console.error('Run supabase/migrations/0020_harden_destructive_action_rpcs.sql and supabase/migrations/0021_role_operations_control_center.sql in Supabase SQL Editor, then re-run this check.');
  process.exit(1);
}

console.log('Supabase connection OK.');
console.log(`Plans visible through anon key: ${data?.map((plan) => plan.code).join(', ') || 'none'}`);
console.log(`Action RPCs visible: ${destructiveRpcChecks.map((check) => check.name).join(', ')}`);
