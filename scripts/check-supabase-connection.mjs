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

async function assertTableShape(name, columns) {
  const { error } = await supabase.from(name).select(columns).limit(1);

  return {
    name,
    ok: !error,
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

const dashboardSchemaChecks = await Promise.all([
  assertTableShape('attendance_records', 'session_id,student_id,status'),
  assertTableShape('student_care_cases', 'id,student_id,summary,status,risk_level'),
  assertTableShape('score_entries', 'student_id,score,assessment_id'),
  assertTableShape('savings_accounts', 'student_id,balance,status'),
  assertTableShape('student_health_records', 'student_id,record_date,record_type,status,weight_kg,height_cm,bmi,inspection_results'),
]);
const workspaceMemberRpcChecks = await Promise.all([
  assertRpcExists('can_manage_workspace_members', { target_workspace_id: NIL_UUID }),
  assertRpcExists('get_workspace_members', { target_workspace_id: NIL_UUID }),
  assertRpcExists('add_workspace_member_by_email', {
    target_workspace_id: NIL_UUID,
    target_email: 'missing@example.invalid',
    target_role: 'viewer',
  }),
  assertRpcExists('set_workspace_member_status', {
    target_workspace_id: NIL_UUID,
    target_profile_id: NIL_UUID,
    next_status: 'active',
  }),
]);
const rosterSafetyChecks = await Promise.all([
  assertTableShape('student_roster_reviews', 'workspace_id,student_id,classification,note,reviewed_at'),
  assertRpcExists('set_student_roster_reviews', {
    target_workspace_id: NIL_UUID,
    target_student_ids: [NIL_UUID],
    target_classification: 'pending',
    target_note: null,
  }),
  assertRpcExists('delete_reviewed_duplicate_students', {
    target_workspace_id: NIL_UUID,
    target_student_ids: [NIL_UUID],
  }),
]);
const publicReportRpcChecks = await Promise.all([
  assertRpcExists('get_public_report_schools'),
  assertRpcExists('lookup_public_student_report', {
    target_workspace_id: NIL_UUID,
    citizen_id: '0000000000000',
    target_birth_date: '2000-01-01',
  }),
]);
const failedDashboardChecks = dashboardSchemaChecks.filter((check) => !check.ok);
const missingWorkspaceMemberRpcs = workspaceMemberRpcChecks.filter((check) => !check.ok);
const missingPublicReportRpcs = publicReportRpcChecks.filter((check) => !check.ok);
const missingRosterSafetyChecks = rosterSafetyChecks.filter((check) => !check.ok);

if (missingDestructiveRpcs.length > 0) {
  console.error('Supabase action RPCs are missing:');
  for (const check of missingDestructiveRpcs) {
    console.error(`- ${check.name}: ${check.reason}`);
  }
  console.error('');
  console.error('Run supabase/migrations/0020_harden_destructive_action_rpcs.sql and supabase/migrations/0021_role_operations_control_center.sql in Supabase SQL Editor, then re-run this check.');
  process.exit(1);
}

if (failedDashboardChecks.length > 0 || missingWorkspaceMemberRpcs.length > 0 || missingPublicReportRpcs.length > 0 || missingRosterSafetyChecks.length > 0) {
  console.error('Supabase dashboard schema is incomplete:');
  for (const check of [...failedDashboardChecks, ...missingWorkspaceMemberRpcs, ...missingPublicReportRpcs, ...missingRosterSafetyChecks]) {
    console.error(`- ${check.name}: ${check.reason}`);
  }
  console.error('');
  console.error('Apply pending repair migrations, then re-run this check.');
  process.exit(1);
}

console.log('Supabase connection OK.');
console.log(`Plans visible through anon key: ${data?.map((plan) => plan.code).join(', ') || 'none'}`);
console.log(`Action RPCs visible: ${destructiveRpcChecks.map((check) => check.name).join(', ')}`);
console.log(`Dashboard tables visible: ${dashboardSchemaChecks.map((check) => check.name).join(', ')}`);
console.log(`Workspace member RPCs visible: ${workspaceMemberRpcChecks.map((check) => check.name).join(', ')}`);
console.log(`Public report RPCs visible: ${publicReportRpcChecks.map((check) => check.name).join(', ')}`);
console.log(`Roster safety layer visible: ${rosterSafetyChecks.map((check) => check.name).join(', ')}`);
