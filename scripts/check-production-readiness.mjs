import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const isCi = process.env.CI === 'true';

const requiredMigrations = [
  '0001_core_foundation.sql',
  '0002_student_care_cases.sql',
  '0003_student_home_visits.sql',
  '0004_home_visit_photo_storage.sql',
  '0005_teacher_audit_logs.sql',
  '0006_teacher_audit_log_read.sql',
  '0007_scorebook_foundation.sql',
  '0008_savings_behavior_foundation.sql',
  '0009_randomizer_foundation.sql',
  '0010_api_grants.sql',
  '0010_payment_slip_storage.sql',
  '0011_admin_lifetime_access.sql',
  '0012_workspace_member_admin.sql',
  '0013_payment_qr_storage.sql',
  '0014_workspace_join_requests.sql',
  '0015_student_delete_owner_policy.sql',
  '0016_workspace_classroom_delete_policy.sql',
  '0017_score_assessment_exam_terms.sql',
  '0018_safe_delete_rpc.sql',
  '0019_score_delete_rpc.sql',
  '0020_harden_destructive_action_rpcs.sql',
  '0021_role_operations_control_center.sql',
  '0022_public_report_lookup.sql',
];

const requiredFunctions = [
  'accept-portal-invitation',
  'approve-payment-request',
  'dispatch-notification',
];

const requiredPublicEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_APP_NAME',
  'VITE_APP_TIMEZONE',
];

const serverOnlyEnv = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'ENCRYPTION_KEY',
];

function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout || result.stderr || ''}`.trim().split('\n')[0] || null,
  };
}

function parseEnvFile(path) {
  if (!existsSync(path)) return new Map();
  const content = readFileSync(path, 'utf8');
  return new Map(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function check(ok, label, detail = '', severity = 'error') {
  return { detail, label, ok, severity };
}

const envLocalPath = join(root, '.env.local');
const envExamplePath = join(root, '.env.example');
const envLocal = parseEnvFile(envLocalPath);
const envExample = parseEnvFile(envExamplePath);
const hasEnvLocal = existsSync(envLocalPath);
const migrationsDir = join(root, 'supabase', 'migrations');
const functionsDir = join(root, 'supabase', 'functions');

const migrationFiles = existsSync(migrationsDir) ? new Set(readdirSync(migrationsDir)) : new Set();
const functionFolders = existsSync(functionsDir)
  ? new Set(readdirSync(functionsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name))
  : new Set();

const supabaseCli = commandExists('supabase');
const deno = commandExists('deno');

const checks = [
  check(existsSync(envExamplePath), '.env.example exists', envExamplePath),
  check(
    hasEnvLocal || isCi,
    '.env.local exists or CI env is available',
    hasEnvLocal ? envLocalPath : isCi ? 'CI mode: use repository/host environment variables' : 'Create from .env.example',
    isCi ? 'warn' : 'error',
  ),
  ...requiredPublicEnv.map((key) =>
    check(
      envLocal.has(key) || Boolean(process.env[key]) || envExample.has(key),
      `public env: ${key}`,
      envLocal.has(key) ? '.env.local' : process.env[key] ? 'process.env' : envExample.has(key) ? '.env.example only' : 'missing',
    ),
  ),
  ...serverOnlyEnv.map((key) =>
    check(!envLocal.has(key), `server secret not in .env.local: ${key}`, envLocal.has(key) ? 'Remove from frontend env' : 'ok'),
  ),
  ...requiredMigrations.map((file) =>
    check(migrationFiles.has(file), `migration: ${file}`, migrationFiles.has(file) ? 'found' : 'missing'),
  ),
  ...requiredFunctions.map((name) => {
    const indexPath = join(functionsDir, name, 'index.ts');
    return check(functionFolders.has(name) && existsSync(indexPath), `edge function: ${name}`, indexPath);
  }),
  check(supabaseCli.ok, 'Supabase CLI available', supabaseCli.output || 'Install Supabase CLI before deploy', 'warn'),
  check(deno.ok, 'Deno available', deno.output || 'Install Deno before local function type checks', 'warn'),
];

const requiredChecks = checks.filter((item) => item.severity !== 'warn');
const optionalChecks = checks.filter((item) => item.severity === 'warn');
const passed = requiredChecks.filter((item) => item.ok).length;
const failed = requiredChecks.length - passed;
const warnings = optionalChecks.filter((item) => !item.ok).length;

console.log(`ClassCare 360 production readiness: ${passed}/${requiredChecks.length} required checks passed`);
if (warnings > 0) {
  console.log(`${warnings}/${optionalChecks.length} optional tooling checks need attention`);
}
console.log('');

for (const item of checks) {
  const mark = item.ok ? 'PASS' : item.severity === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[${mark}] ${item.label}${item.detail ? ` - ${item.detail}` : ''}`);
}

console.log('');
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      failed,
      passed,
      total: requiredChecks.length,
      warnings,
    },
    null,
    2,
  ),
);

process.exit(failed > 0 ? 1 : 0);
