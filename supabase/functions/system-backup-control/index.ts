import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

async function fetchManagedBackups(projectRef: string, accessToken: string) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/backups`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Supabase Management API backups request failed (${response.status})`);
  return data as {
    backups?: Array<{ id?: number; inserted_at?: string; is_physical_backup?: boolean; status?: string }>;
    physical_backup_data?: { earliest_physical_backup_date_unix?: number; latest_physical_backup_date_unix?: number };
    pitr_enabled?: boolean;
    region?: string;
    walg_enabled?: boolean;
  };
}

async function requestBackupSchedule(projectRef: string, accessToken: string, scheduleFor?: string) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/backups/schedule`, {
    ...(scheduleFor ? { body: JSON.stringify({ schedule_for: scheduleFor }), method: 'PATCH' } : { method: 'GET' }),
    headers: { Authorization: `Bearer ${accessToken}`, ...(scheduleFor ? { 'Content-Type': 'application/json' } : {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`backup_schedule_request_failed_${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data as { schedule_for?: string; updated_at?: string };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const jwt = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return jsonResponse({ error: 'unauthorized' }, 401);

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const supabaseAnonKey = requiredEnv('SUPABASE_ANON_KEY');
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  const user = userData.user;
  if (userError || !user) return jsonResponse({ error: 'unauthorized' }, 401);

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'superadmin') return jsonResponse({ error: 'superadmin_only' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  let accessToken: string;
  let projectRef: string;
  try {
    accessToken = requiredEnv('SUPABASE_ACCESS_TOKEN');
    projectRef = requiredEnv('SUPABASE_PROJECT_REF');
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'backup_control_not_configured' }, 503);
  }

  try {
    if (body.action === 'status') {
      const backupStatus = await fetchManagedBackups(projectRef, accessToken);
      let schedule: { schedule_for?: string; updated_at?: string } | null = null;
      let scheduleAvailable = true;
      try {
        schedule = await requestBackupSchedule(projectRef, accessToken);
      } catch (error) {
        const status = Number((error as { status?: number }).status);
        if (status === 402 || status === 403 || status === 404) scheduleAvailable = false;
        else throw error;
      }
      return jsonResponse({
        backups: backupStatus.backups || [],
        physical_backup_data: backupStatus.physical_backup_data || null,
        pitr_enabled: Boolean(backupStatus.pitr_enabled),
        region: backupStatus.region || null,
        walg_enabled: Boolean(backupStatus.walg_enabled),
        schedule,
        schedule_available: scheduleAvailable,
      });
    }

    if (body.action === 'update-schedule') {
      const scheduleFor = typeof body.scheduleFor === 'string' ? body.scheduleFor : '';
      if (!/^([01]\d|2[0-3]):[0-5]\d:00$/.test(scheduleFor)) return jsonResponse({ error: 'invalid_backup_time' }, 400);
      if (body.confirmation !== 'UPDATE BACKUP SCHEDULE') return jsonResponse({ error: 'confirmation_required' }, 400);
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (reason.length < 10 || reason.length > 300) return jsonResponse({ error: 'reason_must_be_10_to_300_characters' }, 400);
      const requestId = crypto.randomUUID();
      console.warn(JSON.stringify({ action: 'daily_backup_schedule_change_requested', actor_profile_id: user.id, reason, schedule_for: scheduleFor, request_id: requestId, project_ref: projectRef, requested_at: new Date().toISOString() }));
      const schedule = await requestBackupSchedule(projectRef, accessToken, scheduleFor);
      console.warn(JSON.stringify({ action: 'daily_backup_schedule_change_accepted', actor_profile_id: user.id, schedule_for: schedule.schedule_for || scheduleFor, request_id: requestId }));
      return jsonResponse({ updated: true, request_id: requestId, schedule }, 200);
    }

    const backupStatus = await fetchManagedBackups(projectRef, accessToken);

    if (body.action !== 'restore-pitr') return jsonResponse({ error: 'unsupported_action' }, 400);
    if (!backupStatus.pitr_enabled) return jsonResponse({ error: 'pitr_not_enabled_use_supabase_dashboard_for_daily_restore' }, 409);
    if (body.confirmation !== 'ROLLBACK PRODUCTION') return jsonResponse({ error: 'confirmation_required' }, 400);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 10 || reason.length > 300) return jsonResponse({ error: 'restore_reason_must_be_10_to_300_characters' }, 400);

    const target = Number(body.recoveryTimeTargetUnix);
    if (!Number.isInteger(target)) return jsonResponse({ error: 'invalid_recovery_time' }, 400);
    const earliest = Number(backupStatus.physical_backup_data?.earliest_physical_backup_date_unix || 0);
    const latest = Number(backupStatus.physical_backup_data?.latest_physical_backup_date_unix || 0);
    if (!earliest || !latest || target < earliest || target > latest) {
      return jsonResponse({ error: 'recovery_time_outside_available_window', earliest, latest }, 400);
    }

    const requestId = crypto.randomUUID();
    console.warn(JSON.stringify({
      action: 'production_pitr_restore_requested',
      actor_profile_id: user.id,
      reason,
      recovery_time_target_unix: target,
      request_id: requestId,
      project_ref: projectRef,
      requested_at: new Date().toISOString(),
    }));

    const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/backups/restore-pitr`, {
      body: JSON.stringify({ recovery_time_target_unix: target }),
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error(JSON.stringify({ action: 'production_pitr_restore_rejected', request_id: requestId, status: response.status, response: responseText.slice(0, 1000) }));
      return jsonResponse({ error: `supabase_restore_rejected_${response.status}`, details: responseText.slice(0, 500) }, response.status);
    }

    console.warn(JSON.stringify({ action: 'production_pitr_restore_accepted', request_id: requestId, actor_profile_id: user.id }));
    return jsonResponse({ accepted: true, request_id: requestId, recovery_time_target_unix: target, status: response.status }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'backup_control_failed';
    console.error(JSON.stringify({ action: 'system_backup_control_error', actor_profile_id: user.id, message }));
    return jsonResponse({ error: message }, 502);
  }
});
