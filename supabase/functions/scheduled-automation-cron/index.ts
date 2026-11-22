import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type CronJobType = 'early_warning' | 'morning_digest' | 'evening_digest' | 'all';

interface CronPayload {
  job?: CronJobType;
  workspaceId?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function getBangkokDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptTelegramSecret(value: string): Promise<string> {
  const keyText = Deno.env.get('TELEGRAM_CONNECTION_ENCRYPTION_KEY');
  if (!keyText) throw new Error('Telegram account encryption is not configured');
  const keyBytes = fromBase64(keyText);
  if (keyBytes.byteLength !== 32) throw new Error('Telegram account encryption key is invalid');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const [ivText, encryptedText] = value.split('.');
  if (!ivText || !encryptedText) throw new Error('Encrypted Telegram credential is malformed');
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivText) },
    key,
    fromBase64(encryptedText),
  );
  return new TextDecoder().decode(clear);
}

async function buildWorkspaceDigestBody(
  serviceClient: ReturnType<typeof createClient>,
  workspaceId: string,
  bangkokDate: string,
  kind: 'morning_digest' | 'evening_digest',
  reportClassroomIds: string[] | null,
): Promise<{ title: string; body: string }> {
  const [{ data: wsRow }, { data: students }, { data: openSignals }, { data: calendarToday }, { data: sessionsToday }] =
    await Promise.all([
      serviceClient.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
      serviceClient
        .from('students')
        .select('id,classroom_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active'),
      serviceClient
        .from('early_warning_signals')
        .select('id,severity')
        .eq('workspace_id', workspaceId)
        .eq('status', 'open'),
      serviceClient
        .from('school_calendar_days')
        .select('title,day_type')
        .eq('workspace_id', workspaceId)
        .eq('calendar_date', bangkokDate),
      serviceClient
        .from('attendance_sessions')
        .select('id,classroom_id')
        .eq('workspace_id', workspaceId)
        .eq('attendance_date', bangkokDate),
    ]);

  const wsName = (wsRow?.name as string | undefined) || 'ClassCare 360';
  const filteredStudents =
    Array.isArray(reportClassroomIds) && reportClassroomIds.length > 0
      ? (students || []).filter((s) => reportClassroomIds.includes(String(s.classroom_id)))
      : students || [];
  const filteredSessions =
    Array.isArray(reportClassroomIds) && reportClassroomIds.length > 0
      ? (sessionsToday || []).filter((s) => reportClassroomIds.includes(String(s.classroom_id)))
      : sessionsToday || [];

  let absentToday = 0;
  let lateToday = 0;
  if (filteredSessions.length > 0) {
    const { data: attRecs } = await serviceClient
      .from('attendance_records')
      .select('status')
      .eq('workspace_id', workspaceId)
      .in(
        'session_id',
        filteredSessions.map((s) => s.id),
      );
    (attRecs || []).forEach((r) => {
      if (r.status === 'absent') absentToday += 1;
      if (r.status === 'late') lateToday += 1;
    });
  }

  const highSignals = (openSignals || []).filter((s) => s.severity === 'high').length;
  const totalOpenSignals = (openSignals || []).length;
  const eventsText =
    (calendarToday || []).length > 0
      ? (calendarToday || []).map((e) => e.title).join(', ')
      : 'เรียนตามตารางปกติ';

  if (kind === 'morning_digest') {
    return {
      title: `สรุปเช้าประจำวัน · ${wsName} (${bangkokDate})`,
      body: [
        `ปฏิทินวันนี้: ${eventsText}`,
        `นักเรียนในความดูแล: ${filteredStudents.length} คน`,
        `สัญญาณเฝ้าระวัง 360° ที่เปิดอยู่: ${totalOpenSignals} รายการ${highSignals > 0 ? ` (เร่งด่วน ${highSignals})` : ''}`,
      ].join('\n'),
    };
  }

  return {
    title: `สรุปช่วงเย็นประจำวัน · ${wsName} (${bangkokDate})`,
    body: [
      `รอบเช็กชื่อวันนี้: ${filteredSessions.length} รอบ`,
      `สถิติวันนี้: ขาด ${absentToday} · มาสาย ${lateToday}`,
      `สัญญาณเฝ้าระวังค้างดูแล: ${totalOpenSignals} รายการ${highSignals > 0 ? ` (เร่งด่วน ${highSignals})` : ''}`,
    ].join('\n'),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const cronSecret = Deno.env.get('CRON_SECRET')?.trim();

    const headerSecret = request.headers.get('x-cron-secret')?.trim();
    const authHeader = request.headers.get('Authorization')?.trim() || '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const isCronAuthorized = Boolean(
      cronSecret && ((headerSecret && headerSecret === cronSecret) || (bearerToken && bearerToken === cronSecret)),
    );

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (!isCronAuthorized) {
      if (!authHeader) {
        return jsonResponse({ error: 'Missing Authorization or x-cron-secret header' }, 401);
      }

      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return jsonResponse({ error: 'Invalid user token' }, 401);
      }

      const { data: superadmin } = await serviceClient
        .from('superadmin_profiles')
        .select('profile_id,is_active')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!superadmin) {
        return jsonResponse({ error: 'Superadmin role or valid x-cron-secret required' }, 403);
      }
    }

    const payload = (await request.json().catch(() => ({}))) as CronPayload;
    const job: CronJobType = payload.job || 'all';
    const targetWorkspaceId = payload.workspaceId?.trim();
    const bangkokDate = getBangkokDate();

    const summary = {
      ok: true,
      bangkokDate,
      job,
      evaluatedWorkspaces: 0,
      digestsSent: 0,
      digestsSkipped: 0,
      digestsFailed: 0,
    };

    // 1. Evaluate early warning signals across workspaces with active rules
    if (job === 'early_warning' || job === 'all') {
      let rulesQuery = serviceClient
        .from('automation_rules')
        .select('workspace_id')
        .eq('is_active', true);

      if (targetWorkspaceId) {
        rulesQuery = rulesQuery.eq('workspace_id', targetWorkspaceId);
      }

      const { data: activeRuleRows, error: rulesError } = await rulesQuery;
      if (rulesError) throw rulesError;

      const workspaceIds = Array.from(
        new Set(((activeRuleRows || []) as Array<{ workspace_id: string }>).map((r) => r.workspace_id)),
      );

      for (const wsId of workspaceIds) {
        const { error: evalError } = await serviceClient.rpc('evaluate_early_warning_signals', {
          target_workspace_id: wsId,
        });
        if (!evalError) {
          summary.evaluatedWorkspaces += 1;
        }
      }
    }

    // 2. Dispatch scheduled morning / evening Telegram digests
    const digestKinds: Array<'morning_digest' | 'evening_digest'> =
      job === 'morning_digest'
        ? ['morning_digest']
        : job === 'evening_digest'
          ? ['evening_digest']
          : job === 'all'
            ? ['morning_digest', 'evening_digest']
            : [];

    if (digestKinds.length > 0 && Deno.env.get('TELEGRAM_CONNECTION_ENCRYPTION_KEY')) {
      let prefQuery = serviceClient
        .from('teacher_notification_preferences')
        .select('workspace_id,profile_id,preferences');

      if (targetWorkspaceId) {
        prefQuery = prefQuery.eq('workspace_id', targetWorkspaceId);
      }

      const { data: prefRows, error: prefError } = await prefQuery;
      if (prefError) throw prefError;

      for (const row of (prefRows || []) as Array<{
        workspace_id: string;
        profile_id: string;
        preferences: Record<string, unknown> | null;
      }>) {
        const prefs = row.preferences || {};
        if (prefs.telegramEnabled !== true) continue;

        for (const kind of digestKinds) {
          const morningEnabled =
            (prefs.morningDigest as Record<string, unknown> | undefined)?.enabled === true ||
            (prefs.calendar as Record<string, unknown> | undefined)?.enabled === true;
          const eveningEnabled = (prefs.eveningDigest as Record<string, unknown> | undefined)?.enabled === true;

          if (kind === 'morning_digest' && !morningEnabled) continue;
          if (kind === 'evening_digest' && !eveningEnabled) continue;

          const deliveryKey = `${kind}:${bangkokDate}`;
          const { error: markerError } = await serviceClient.from('teacher_notification_delivery_log').insert({
            workspace_id: row.workspace_id,
            profile_id: row.profile_id,
            delivery_key: deliveryKey,
            delivery_kind: kind,
          });

          if (markerError?.code === '23505') {
            summary.digestsSkipped += 1;
            continue;
          }
          if (markerError) {
            summary.digestsFailed += 1;
            continue;
          }

          const { data: conn } = await serviceClient
            .from('teacher_telegram_connections')
            .select('encrypted_bot_token,encrypted_chat_id')
            .eq('workspace_id', row.workspace_id)
            .eq('profile_id', row.profile_id)
            .eq('status', 'connected')
            .maybeSingle();

          const nowIso = new Date().toISOString();
          if (!conn?.encrypted_bot_token || !conn.encrypted_chat_id) {
            await serviceClient
              .from('teacher_notification_delivery_log')
              .update({
                status: 'skipped',
                error_message: 'Telegram connection not linked',
                completed_at: nowIso,
              })
              .eq('workspace_id', row.workspace_id)
              .eq('profile_id', row.profile_id)
              .eq('delivery_key', deliveryKey);
            summary.digestsSkipped += 1;
            continue;
          }

          try {
            const token = await decryptTelegramSecret(conn.encrypted_bot_token);
            const chatId = await decryptTelegramSecret(conn.encrypted_chat_id);
            const selectedRooms = Array.isArray(prefs.reportClassroomIds)
              ? (prefs.reportClassroomIds as string[])
              : null;
            const digest = await buildWorkspaceDigestBody(
              serviceClient,
              row.workspace_id,
              bangkokDate,
              kind,
              selectedRooms,
            );

            const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                disable_web_page_preview: true,
                text: `${digest.title}\n\n${digest.body}`,
              }),
            });
            const tgJson = (await tgRes.json().catch(() => ({}))) as {
              ok?: boolean;
              description?: string;
              result?: { message_id?: number };
            };

            if (!tgRes.ok || tgJson.ok !== true) {
              await serviceClient
                .from('teacher_notification_delivery_log')
                .update({
                  status: 'failed',
                  error_message: tgJson.description || `Telegram HTTP ${tgRes.status}`,
                  completed_at: nowIso,
                })
                .eq('workspace_id', row.workspace_id)
                .eq('profile_id', row.profile_id)
                .eq('delivery_key', deliveryKey);
              summary.digestsFailed += 1;
            } else {
              await serviceClient
                .from('teacher_notification_delivery_log')
                .update({
                  status: 'sent',
                  provider_message_id: tgJson.result?.message_id ? String(tgJson.result.message_id) : null,
                  completed_at: nowIso,
                })
                .eq('workspace_id', row.workspace_id)
                .eq('profile_id', row.profile_id)
                .eq('delivery_key', deliveryKey);
              summary.digestsSent += 1;
            }
          } catch (err) {
            await serviceClient
              .from('teacher_notification_delivery_log')
              .update({
                status: 'failed',
                error_message: err instanceof Error ? err.message : 'Telegram dispatch error',
                completed_at: new Date().toISOString(),
              })
              .eq('workspace_id', row.workspace_id)
              .eq('profile_id', row.profile_id)
              .eq('delivery_key', deliveryKey);
            summary.digestsFailed += 1;
          }
        }
      }
    }

    return jsonResponse(summary);
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected scheduled cron error',
      },
      500,
    );
  }
});
