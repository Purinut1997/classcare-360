import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function decodeXml(value: string) {
  return value.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&amp;', '&');
}

function xmlTag(value: string, name: string) {
  const match = value.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match ? decodeXml(match[1]) : '';
}

async function listBackups() {
  const accountId = requiredEnv('R2_ACCOUNT_ID');
  const bucket = requiredEnv('R2_BUCKET');
  const client = new AwsClient({
    accessKeyId: requiredEnv('R2_READ_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('R2_READ_SECRET_ACCESS_KEY'),
    service: 's3',
    region: 'auto',
  });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}`;
  const results: Array<{ key: string; created_at: string; size_bytes: number }> = [];
  const presentKeys = new Set<string>();
  let continuationToken: string | null = null;

  do {
    const url = new URL(endpoint);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', 'backups/');
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);
    const response = await client.fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error(`R2 list request failed (${response.status})`);
    const xml = await response.text();
    if (!xml.includes('<ListBucketResult')) throw new Error('R2 returned an invalid list response');

    for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = xmlTag(item, 'Key');
      presentKeys.add(key);
      if (!key.endsWith('.tar.gz.age')) continue;
      const createdAt = xmlTag(item, 'LastModified');
      const size = Number(xmlTag(item, 'Size') || 0);
      if (!/^backups\/\d{8}T\d{6}Z\/classcare-backup\.tar\.gz\.age$/.test(key)) continue;
      results.push({ key, created_at: createdAt, size_bytes: size });
    }

    continuationToken = xmlTag(xml, 'NextContinuationToken') || null;
  } while (continuationToken);

  return results
    .filter((backup) => presentKeys.has(`${backup.key}.sha256`))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 90);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const jwt = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return jsonResponse({ error: 'unauthorized' }, 401);

  const userClient = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401);
  const { data: profile, error: profileError } = await userClient.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'superadmin') return jsonResponse({ error: 'superadmin_only' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  try {
    if (body.action === 'status') return jsonResponse({ backups: await listBackups(), retention_days: 30 });
    if (body.action !== 'request-restore') return jsonResponse({ error: 'unsupported_action' }, 400);
    if (body.confirmation !== 'RESTORE TO RECOVERY PROJECT') return jsonResponse({ error: 'confirmation_required' }, 400);

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 10 || reason.length > 300) return jsonResponse({ error: 'reason_must_be_10_to_300_characters' }, 400);
    const backupKey = typeof body.backupKey === 'string' ? body.backupKey : '';
    const backups = await listBackups();
    if (!backups.some((backup) => backup.key === backupKey)) return jsonResponse({ error: 'backup_not_found_or_expired' }, 404);

    const owner = requiredEnv('GITHUB_REPOSITORY_OWNER');
    const repository = requiredEnv('GITHUB_REPOSITORY_NAME');
    const token = requiredEnv('GITHUB_ACTIONS_TOKEN');
    const runUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/workflows/restore-from-r2.yml`;
    const requestId = crypto.randomUUID();
    console.warn(JSON.stringify({ action: 'r2_backup_restore_requested', actor_profile_id: userData.user.id, backup_key: backupKey, reason_length: reason.length, request_id: requestId, requested_at: new Date().toISOString() }));

    const dispatch = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/workflows/restore-from-r2.yml/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs: { backup_key: backupKey, confirmation: 'RESTORE TO RECOVERY PROJECT' } }),
    });
    if (!dispatch.ok) {
      console.error(JSON.stringify({ action: 'r2_backup_restore_dispatch_failed', request_id: requestId, status: dispatch.status }));
      return jsonResponse({ error: `github_workflow_dispatch_failed_${dispatch.status}` }, 502);
    }

    console.warn(JSON.stringify({ action: 'r2_backup_restore_dispatched', actor_profile_id: userData.user.id, backup_key: backupKey, request_id: requestId }));
    return jsonResponse({ accepted: true, request_id: requestId, backup_key: backupKey, workflow_url: runUrl }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'r2_backup_control_failed';
    console.error(JSON.stringify({ action: 'r2_backup_control_error', actor_profile_id: userData.user.id, message: escapeXml(message).slice(0, 250) }));
    return jsonResponse({ error: message }, 502);
  }
});
