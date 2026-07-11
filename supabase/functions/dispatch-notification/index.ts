import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type NotificationChannel = 'in_app' | 'telegram' | 'line';
type PrivacyLevel = 'normal' | 'restricted' | 'sensitive';

interface DispatchNotificationPayload {
  body?: string;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
  lineUserId?: string;
  privacyLevel?: PrivacyLevel;
  profileId?: string;
  telegramChatId?: string;
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

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function optionalEnv(name: string) {
  return Deno.env.get(name) || null;
}

function normalizeChannels(channels: NotificationChannel[] | undefined): NotificationChannel[] {
  const validChannels = new Set<NotificationChannel>(['in_app', 'telegram', 'line']);
  const normalized = (channels?.length ? channels : ['in_app'])
    .filter((channel): channel is NotificationChannel => validChannels.has(channel as NotificationChannel))
    .filter((channel, index, list) => list.indexOf(channel) === index);

  return normalized.length > 0 ? normalized : ['in_app'];
}

function buildMessage(title: string, body: string) {
  return `${title}\n\n${body}`;
}

async function sendTelegramMessage(chatId: string | undefined, title: string, body: string): Promise<DispatchResult> {
  const token = optionalEnv('TELEGRAM_BOT_TOKEN');

  if (!token) {
    return { channel: 'telegram', errorMessage: 'TELEGRAM_BOT_TOKEN is not configured', status: 'skipped' };
  }

  if (!chatId) {
    return { channel: 'telegram', errorMessage: 'telegramChatId is required', status: 'skipped' };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      disable_web_page_preview: true,
      text: buildMessage(title, body),
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const metadata = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    return {
      channel: 'telegram',
      errorMessage: typeof metadata.description === 'string' ? metadata.description : `Telegram HTTP ${response.status}`,
      responseMetadata: metadata,
      status: 'failed',
    };
  }

  const result = metadata.result && typeof metadata.result === 'object' ? metadata.result as Record<string, unknown> : {};
  return {
    channel: 'telegram',
    providerMessageId: result.message_id ? String(result.message_id) : undefined,
    responseMetadata: metadata,
    status: 'sent',
  };
}

async function sendLineMessage(lineUserId: string | undefined, title: string, body: string): Promise<DispatchResult> {
  const token = optionalEnv('LINE_CHANNEL_ACCESS_TOKEN');

  if (!token) {
    return { channel: 'line', errorMessage: 'LINE_CHANNEL_ACCESS_TOKEN is not configured', status: 'skipped' };
  }

  if (!lineUserId) {
    return { channel: 'line', errorMessage: 'lineUserId is required', status: 'skipped' };
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    body: JSON.stringify({
      messages: [
        {
          text: buildMessage(title, body),
          type: 'text',
        },
      ],
      to: lineUserId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const text = await response.text();
  const metadata = text ? { response: text } : {};

  if (!response.ok) {
    return {
      channel: 'line',
      errorMessage: `LINE HTTP ${response.status}`,
      responseMetadata: metadata,
      status: 'failed',
    };
  }

  return {
    channel: 'line',
    responseMetadata: metadata,
    status: 'sent',
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
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const payload = (await request.json()) as DispatchNotificationPayload;
    const workspaceId = payload.workspaceId?.trim();
    const profileId = payload.profileId?.trim();
    const title = payload.title?.trim();
    const body = payload.body?.trim();
    const type = payload.type?.trim() || 'manual';
    const privacyLevel = payload.privacyLevel || 'normal';
    const channels = normalizeChannels(payload.channels);

    if (!workspaceId || !profileId || !title || !body) {
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

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid user token' }, 401);
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
      .select('id,role,status')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .in('role', ['teacher_owner', 'teacher_member'])
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!superadmin && !membership) {
      return jsonResponse({ error: 'Workspace teacher or superadmin role required' }, 403);
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
        dispatchResults.push(await sendTelegramMessage(payload.telegramChatId, title, body));
      }

      if (channel === 'line') {
        dispatchResults.push(await sendLineMessage(payload.lineUserId, title, body));
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

    return jsonResponse({
      dispatchResults,
      notification,
      ok: true,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      500,
    );
  }
});
