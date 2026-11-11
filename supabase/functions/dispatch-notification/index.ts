import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type NotificationChannel = 'in_app' | 'telegram' | 'line';
type PrivacyLevel = 'normal' | 'restricted' | 'sensitive';

interface DispatchNotificationPayload {
  body?: string;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
  eventId?: string;
  personalReport?: boolean;
  privacyLevel?: PrivacyLevel;
  profileId?: string;
  queueId?: string;
  title?: string;
  type?: string;
  workspaceId?: string;
}

interface DispatchResult {
  channel: NotificationChannel;
  errorMessage?: string;
  providerMessageId?: string;
  responseMetadata?: Record<string, unknown>;
  status: 'queued' | 'sent' | 'skipped' | 'failed';
}

interface ApprovalQueueItem {
  body: string;
  channels: NotificationChannel[];
  dispatch_result: Record<string, unknown>;
  id: string;
  recipient_profile_id: string | null;
  source_type: string;
  status: string;
  student_id: string | null;
  title: string;
  workspace_id: string;
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-silent',
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

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function normalizeChannels(channels: NotificationChannel[] | undefined): NotificationChannel[] {
  const validChannels = new Set<NotificationChannel>(['in_app', 'telegram', 'line']);
  const normalized = (channels?.length ? channels : ['in_app'])
    .filter((channel): channel is NotificationChannel => validChannels.has(channel as NotificationChannel))
    .filter((channel, index, list) => list.indexOf(channel) === index);

  return normalized.length > 0 ? normalized : ['in_app'];
}

async function skipUnlinkedChannel(channel: 'telegram' | 'line'): Promise<DispatchResult> {
  // A destination must come from a verified, profile-scoped link on the server.
  // Never send private school/student data to an ID supplied by a browser.
  return {
    channel,
    errorMessage: `${channel} delivery requires a verified account link for this recipient`,
    status: 'skipped',
  };
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptTelegramSecret(value: string) {
  const keyText = Deno.env.get('TELEGRAM_CONNECTION_ENCRYPTION_KEY');
  if (!keyText) throw new Error('Telegram account encryption is not configured');
  const keyBytes = fromBase64(keyText);
  if (keyBytes.byteLength !== 32) throw new Error('Telegram account encryption key is invalid');
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const [ivText, encryptedText] = value.split('.');
  if (!ivText || !encryptedText) throw new Error('Encrypted Telegram credential is malformed');
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivText) }, key, fromBase64(encryptedText));
  return new TextDecoder().decode(clear);
}

async function sendLinkedTelegramMessage(
  serviceClient: ReturnType<typeof createClient>,
  workspaceId: string,
  profileId: string,
  title: string,
  body: string,
  type: string,
  personalReport = false,
): Promise<DispatchResult> {
  const { data: preference, error: preferenceError } = await serviceClient
    .from('teacher_notification_preferences')
    .select('preferences')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .maybeSingle();
  const preferences = preference?.preferences as Record<string, unknown> | null;
  if (preferenceError || preferences?.telegramEnabled !== true) {
    return { channel: 'telegram', errorMessage: 'Telegram report is not enabled for this teacher', status: 'skipped' };
  }
  if (personalReport) {
    const attendance = preferences?.attendance as Record<string, unknown> | undefined;
    const allowed = type === 'attendance_homeroom' ? attendance?.homeroomEnabled === true
      : type === 'attendance_subject' ? attendance?.subjectEnabled === true
      : type === 'savings_saved' ? false
      : type === 'savings_daily_summary' || type === 'daily_report_test' || type === 'daily_report_today' ? true
      : type === 'daily_brief_saved' ? preferences?.afterDailyBrief === true
      : false;
    if (!allowed) return { channel: 'telegram', errorMessage: 'This report is disabled in the teacher settings', status: 'skipped' };
  }

  const { data: connection, error } = await serviceClient
    .from('teacher_telegram_connections')
    .select('encrypted_bot_token,encrypted_chat_id')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .eq('status', 'connected')
    .maybeSingle();
  if (error || !connection?.encrypted_bot_token || !connection.encrypted_chat_id) {
    return { channel: 'telegram', errorMessage: 'Telegram account is not connected for this teacher', status: 'skipped' };
  }

  try {
    const token = await decryptTelegramSecret(connection.encrypted_bot_token);
    const chatId = await decryptTelegramSecret(connection.encrypted_chat_id);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, disable_web_page_preview: true, text: `${title}\n\n${body}` }),
    });
    const result = await response.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!response.ok || result.ok !== true) {
      return { channel: 'telegram', errorMessage: result.description || `Telegram HTTP ${response.status}`, status: 'failed' };
    }
    return { channel: 'telegram', providerMessageId: result.result?.message_id ? String(result.result.message_id) : undefined, status: 'sent' };
  } catch (error) {
    return { channel: 'telegram', errorMessage: error instanceof Error ? error.message : 'Telegram delivery failed', status: 'failed' };
  }
}

Deno.serve(async (request) => {
  let activeQueueId: string | null = null;
  let queueFailureClient: ReturnType<typeof createClient> | null = null;
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
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const payload = (await request.json()) as DispatchNotificationPayload;
    let workspaceId = payload.workspaceId?.trim();
    let profileId = payload.profileId?.trim();
    let title = payload.title?.trim();
    let body = payload.body?.trim();
    let type = payload.type?.trim() || 'manual';
    let privacyLevel = payload.privacyLevel || 'normal';
    let channels = normalizeChannels(payload.channels);
    const queueId = payload.queueId?.trim();
    const personalReport = payload.personalReport === true;
    const eventId = payload.eventId?.trim();
    const personalReportTypes = new Set(['attendance_homeroom', 'attendance_subject', 'savings_saved', 'savings_daily_summary', 'daily_report_test', 'daily_report_today', 'daily_brief_saved']);

    if (personalReport && (!eventId || eventId.length > 180 || !personalReportTypes.has(type) || channels.length !== 1 || channels[0] !== 'telegram')) {
      return jsonResponse({ error: 'Personal report payload is invalid' }, 400);
    }

    if (!queueId && (!workspaceId || !profileId || !title || !body)) {
      return jsonResponse({ error: 'workspaceId, profileId, title, and body are required' }, 400);
    }

    if (!['normal', 'restricted', 'sensitive'].includes(privacyLevel)) {
      return jsonResponse({ error: 'privacyLevel must be normal, restricted, or sensitive' }, 400);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    queueFailureClient = serviceClient;

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid user token' }, 401);
    }

    let queueItem: ApprovalQueueItem | null = null;

    if (queueId) {
      const { data: queueRow, error: queueError } = await serviceClient
        .from('communication_approval_queue')
        .select('id,workspace_id,student_id,recipient_profile_id,channels,title,body,source_type,status,dispatch_result')
        .eq('id', queueId)
        .maybeSingle<ApprovalQueueItem>();
      if (queueError) throw queueError;
      if (!queueRow) return jsonResponse({ error: 'Approval queue item not found' }, 404);
      queueItem = queueRow;
      workspaceId = queueItem.workspace_id;
      profileId = queueItem.recipient_profile_id || undefined;
      title = queueItem.title;
      body = queueItem.body;
      type = queueItem.source_type || 'automation';
      privacyLevel = 'restricted';
      channels = normalizeChannels(queueItem.channels);
    }

    if (!workspaceId || !profileId || !title || !body) {
      return jsonResponse({ error: 'Resolved notification payload is incomplete' }, 400);
    }
    if (personalReport && profileId !== user.id) {
      return jsonResponse({ error: 'A personal report can only be sent to the signed-in teacher' }, 403);
    }

    const { data: superadmin, error: superadminError } = await serviceClient
      .from('superadmin_profiles')
      .select('profile_id,is_active,level')
      .eq('profile_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (superadminError) throw superadminError;

    const { data: membership, error: membershipError } = await serviceClient
      .from('workspace_memberships')
      .select('id,role,status,permissions')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .in('role', ['teacher_owner', 'teacher_member'])
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!superadmin && !membership) {
      return jsonResponse({ error: 'Workspace teacher or superadmin role required' }, 403);
    }

    const { data: canApproveCommunications, error: capabilityError } = await userClient.rpc(
      'has_workspace_capability',
      {
        capability_key: 'communications.approve',
        target_workspace_id: workspaceId,
      },
    );

    if (capabilityError) throw capabilityError;
    if (!personalReport && !superadmin && canApproveCommunications !== true) {
      return jsonResponse({ error: 'Communications approval permission required' }, 403);
    }

    if (!personalReport && !queueId && !superadmin && membership?.role !== 'teacher_owner') {
      return jsonResponse({ error: 'Teacher members must send from an approved communication queue' }, 403);
    }

    if (personalReport) {
      const { data: preferences, error: preferencesError } = await serviceClient
        .from('teacher_notification_preferences')
        .select('preferences')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .maybeSingle();
      if (preferencesError) throw preferencesError;
      const settings = preferences?.preferences as Record<string, unknown> | undefined;
      const attendance = settings?.attendance as Record<string, unknown> | undefined;
      const enabled = settings?.telegramEnabled === true && (type === 'attendance_homeroom' ? attendance?.homeroomEnabled === true
        : type === 'attendance_subject' ? attendance?.subjectEnabled === true
        : type === 'savings_saved' ? false
        : type === 'savings_daily_summary' || type === 'daily_report_test' || type === 'daily_report_today' ? true
        : settings?.afterDailyBrief === true);
      if (!enabled) return jsonResponse({ ok: true, dispatchResults: [{ channel: 'telegram', status: 'skipped', errorMessage: 'Report is disabled in teacher settings' }] });

      const { error: markerError } = await serviceClient.from('teacher_notification_delivery_log').insert({
        workspace_id: workspaceId,
        profile_id: user.id,
        delivery_key: `${type}:${eventId}`,
        delivery_kind: type,
      });
      if (markerError?.code === '23505') return jsonResponse({ ok: true, duplicate: true, dispatchResults: [] });
      if (markerError) throw markerError;
    }

    if (queueItem?.student_id && !superadmin) {
      const { data: canAccessStudent, error: studentScopeError } = await userClient.rpc('can_access_student', {
        target_student_id: queueItem.student_id,
        target_workspace_id: workspaceId,
      });
      if (studentScopeError) throw studentScopeError;
      if (canAccessStudent !== true) {
        return jsonResponse({ error: 'Student is outside the caller classroom scope' }, 403);
      }
    }

    const [recipientMembershipResult, recipientGuardianResult] = await Promise.all([
      serviceClient
        .from('workspace_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .maybeSingle(),
      queueItem?.student_id
        ? serviceClient
          .from('student_guardians')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('student_id', queueItem.student_id)
          .eq('profile_id', profileId)
          .eq('consent_status', 'granted')
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (recipientMembershipResult.error) throw recipientMembershipResult.error;
    if (recipientGuardianResult.error) throw recipientGuardianResult.error;
    if (!recipientMembershipResult.data && !recipientGuardianResult.data) {
      return jsonResponse({ error: 'Notification recipient is outside the workspace or student guardian scope' }, 422);
    }

    if (queueItem) {
      if (queueItem.status !== 'approved') {
        return jsonResponse({ error: `Queue item must be approved before sending (current: ${queueItem.status})` }, 409);
      }

      const { data: claimed, error: claimError } = await serviceClient
        .from('communication_approval_queue')
        .update({ status: 'sending', dispatch_result: { claimed_at: new Date().toISOString(), claimed_by: user.id } })
        .eq('id', queueItem.id)
        .eq('status', 'approved')
        .select('id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return jsonResponse({ error: 'Queue item is already being sent' }, 409);
      activeQueueId = queueItem.id;
    }

    const notificationData = {
      ...(payload.data || {}),
      channels,
      dispatch_source: 'dispatch-notification',
    };

    const { data: notification, error: notificationError } = await serviceClient
      .from('notifications')
      .insert({
        body,
        data: notificationData,
        privacy_level: privacyLevel,
        profile_id: profileId,
        title,
        type,
        workspace_id: workspaceId,
      })
      .select('id,created_at')
      .single();

    if (notificationError) throw notificationError;

    const dispatchResults: DispatchResult[] = [];

    for (const channel of channels) {
      if (channel === 'in_app') {
        dispatchResults.push({ channel, status: 'queued' });
      }

      if (channel === 'telegram') {
        dispatchResults.push(await sendLinkedTelegramMessage(serviceClient, workspaceId, profileId, title, body, type, personalReport));
      }

      if (channel === 'line') {
        dispatchResults.push(await skipUnlinkedChannel('line'));
      }
    }

    const now = new Date().toISOString();
    const { error: logError } = await serviceClient.from('notification_dispatch_logs').insert(
      dispatchResults.map((result) => ({
        channel: result.channel,
        dispatched_at: result.status === 'sent' || result.status === 'failed' || result.status === 'skipped' ? now : null,
        error_message: result.errorMessage || null,
        notification_id: notification.id,
        profile_id: profileId,
        provider_message_id: result.providerMessageId || null,
        response_metadata: result.responseMetadata || {},
        status: result.status,
        workspace_id: workspaceId,
      })),
    );

    if (logError) throw logError;

    if (personalReport) {
      const telegramResult = dispatchResults.find((result) => result.channel === 'telegram');
      await serviceClient.from('teacher_notification_delivery_log').update({
        status: telegramResult?.status === 'sent' ? 'sent' : telegramResult?.status === 'skipped' ? 'skipped' : 'failed',
        error_message: telegramResult?.errorMessage || null,
        provider_message_id: telegramResult?.providerMessageId || null,
        completed_at: now,
      }).eq('workspace_id', workspaceId).eq('profile_id', user.id).eq('delivery_key', `${type}:${eventId}`);
    }

    await serviceClient.from('audit_logs').insert({
      action: 'notification.dispatched',
      actor_profile_id: user.id,
      actor_role: superadmin?.level || membership?.role || 'teacher_member',
      entity_id: notification.id,
      entity_table: 'notifications',
      metadata: {
        channels,
        dispatch_results: dispatchResults.map(({ channel, status }) => ({ channel, status })),
        source: 'dispatch-notification',
        type,
      },
      risk_level: privacyLevel === 'sensitive' ? 'high' : 'normal',
      workspace_id: workspaceId,
    });

    if (queueId) {
      await serviceClient.from('communication_approval_queue').update({
        status: 'sent',
        sent_at: now,
        dispatch_result: { dispatch_results: dispatchResults, notification_id: notification.id },
      }).eq('id', queueId).eq('status', 'sending');
    }

    return jsonResponse({
      dispatchResults,
      notification,
      ok: true,
    });
  } catch (error) {
    if (activeQueueId && queueFailureClient) {
      await queueFailureClient.from('communication_approval_queue').update({
        status: 'failed',
        dispatch_result: {
          error: error instanceof Error ? error.message : 'Unexpected error',
          failed_at: new Date().toISOString(),
        },
      }).eq('id', activeQueueId).eq('status', 'sending');
    }
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      500,
    );
  }
});
