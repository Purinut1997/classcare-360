import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type Action = 'status' | 'connect' | 'start' | 'confirm' | 'disconnect' | 'test';

interface Payload {
  action?: Action;
  chatId?: string;
  code?: string;
  token?: string;
  workspaceId?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment setting: ${name}`);
  return value;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const raw = fromBase64(env('TELEGRAM_CONNECTION_ENCRYPTION_KEY'));
  if (raw.byteLength !== 32) throw new Error('Telegram encryption setting must be a base64 encoded 32-byte key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string) {
  const [ivText, encryptedText] = value.split('.');
  if (!ivText || !encryptedText) throw new Error('Encrypted Telegram credential is malformed');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivText) },
    await encryptionKey(),
    fromBase64(encryptedText),
  );
  return new TextDecoder().decode(plaintext);
}

async function hashCode(code: string, profileId: string, workspaceId: string) {
  const key = await crypto.subtle.importKey('raw', fromBase64(env('TELEGRAM_CONNECTION_ENCRYPTION_KEY')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${workspaceId}:${profileId}:${code}`));
  return toBase64(new Uint8Array(signature));
}

function makeStartNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function telegramRequest<T>(token: string, method: string, payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json().catch(() => ({})) as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || result.ok !== true) throw new Error(result.description || `Telegram could not complete ${method}`);
  return result.result as T;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return respond({ error: 'กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง' }, 401);

    const url = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const userClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return respond({ error: 'ยืนยันบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่' }, 401);

    const payload = await request.json() as Payload;
    const action = payload.action;
    const workspaceId = payload.workspaceId?.trim();
    if (!workspaceId || !['status', 'connect', 'start', 'confirm', 'disconnect', 'test'].includes(action || '')) {
      return respond({ error: 'ข้อมูลคำขอไม่ครบ' }, 400);
    }

    const { data: membership, error: membershipError } = await serviceClient
      .from('workspace_memberships')
      .select('role,status')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .in('role', ['teacher_owner', 'teacher_member'])
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return respond({ error: 'บัญชีนี้ไม่มีสิทธิ์ครูในโรงเรียนที่เลือก' }, 403);

    const connectionQuery = () => serviceClient
      .from('teacher_telegram_connections')
      .select('workspace_id,profile_id,encrypted_bot_token,encrypted_chat_id,bot_username,status,verification_code_hash,verification_expires_at,start_nonce_hash,encrypted_start_nonce,verification_attempts')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (action === 'status') {
      const { data, error } = await connectionQuery();
      if (error && error.code !== 'PGRST116') throw error;
      const expired = data?.status === 'pending' && data.verification_expires_at
        && new Date(data.verification_expires_at).getTime() <= Date.now();
      if (expired) {
        const { error: clearError } = await serviceClient.from('teacher_telegram_connections').update({
          encrypted_bot_token: null,
          encrypted_chat_id: null,
          status: 'disconnected',
          verification_code_hash: null,
          verification_expires_at: null,
          start_nonce_hash: null,
          encrypted_start_nonce: null,
          verification_attempts: 0,
          updated_at: new Date().toISOString(),
        }).eq('workspace_id', workspaceId).eq('profile_id', user.id).eq('status', 'pending');
        if (clearError) throw clearError;
      }
      const status = expired ? 'disconnected' : data?.status || 'disconnected';
      const botUrl = status === 'pending' && !data?.encrypted_chat_id && data?.encrypted_start_nonce
        ? `https://t.me/${data.bot_username}?start=${await decrypt(data.encrypted_start_nonce)}`
        : null;
      return respond({ status, botUsername: expired ? null : data?.bot_username || null, botUrl });
    }

    if (action === 'disconnect') {
      const { error } = await serviceClient.from('teacher_telegram_connections').upsert({
        workspace_id: workspaceId,
        profile_id: user.id,
        encrypted_bot_token: null,
        encrypted_chat_id: null,
        bot_username: null,
        status: 'disconnected',
        verification_code_hash: null,
        verification_expires_at: null,
        start_nonce_hash: null,
        encrypted_start_nonce: null,
        verification_attempts: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,profile_id' });
      if (error) throw error;
      return respond({ status: 'disconnected' });
    }

    if (action === 'connect') {
      const token = payload.token?.trim();
      const chatId = payload.chatId?.trim();
      if (!token || token.length > 256) return respond({ error: 'กรุณากรอก Bot Token ให้ครบ' }, 400);
      if (!chatId || !/^-?\d{1,20}$/.test(chatId)) return respond({ error: 'กรุณากรอก Chat ID ที่เป็นตัวเลข' }, 400);

      const bot = await telegramRequest<{ id: number; username?: string }>(token, 'getMe');
      if (!bot.username) return respond({ error: 'บอตนี้ไม่มีชื่อผู้ใช้ Telegram ที่ใช้เชื่อมบัญชี' }, 422);

      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      try {
        await telegramRequest(token, 'sendMessage', {
          chat_id: chatId,
          text: `รหัสยืนยัน ClassCare 360: ${code}\nรหัสใช้ได้ 10 นาที และใช้ได้ครั้งเดียว`,
        });
      } catch {
        return respond({ error: 'ส่งรหัสไม่ได้ ตรวจว่า Chat ID ถูกต้องและได้กด Start ในแชตบอตแล้ว' }, 422);
      }

      const { error: saveError } = await serviceClient.from('teacher_telegram_connections').upsert({
        workspace_id: workspaceId,
        profile_id: user.id,
        encrypted_bot_token: await encrypt(token),
        encrypted_chat_id: await encrypt(chatId),
        bot_username: bot.username,
        status: 'pending',
        verification_code_hash: await hashCode(code, user.id, workspaceId),
        verification_expires_at: expiresAt,
        start_nonce_hash: null,
        encrypted_start_nonce: null,
        verification_attempts: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,profile_id' });
      if (saveError) throw saveError;
      return respond({ status: 'pending', botUsername: bot.username, expiresAt });
    }

    if (action === 'start') {
      const token = payload.token?.trim();
      if (!token || token.length > 256) return respond({ error: 'กรุณากรอก Bot Token ให้ครบ' }, 400);
      const bot = await telegramRequest<{ id: number; username?: string; first_name?: string }>(token, 'getMe');
      if (!bot.username) return respond({ error: 'บอตนี้ไม่มีชื่อผู้ใช้ Telegram ที่ใช้เชื่อมบัญชี' }, 422);

      const { data: current, error: currentError } = await connectionQuery();
      if (currentError) throw currentError;
      const waitingForStart = current?.status === 'pending'
        && !current.encrypted_chat_id
        && current.start_nonce_hash
        && current.verification_expires_at
        && new Date(current.verification_expires_at).getTime() > Date.now();

      if (!waitingForStart) {
        const nonce = makeStartNonce();
        const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
        const { error: saveError } = await serviceClient.from('teacher_telegram_connections').upsert({
          workspace_id: workspaceId,
          profile_id: user.id,
          encrypted_bot_token: await encrypt(token),
          encrypted_chat_id: null,
          bot_username: bot.username,
          status: 'pending',
          verification_code_hash: null,
          verification_expires_at: expiresAt,
          start_nonce_hash: await hashCode(nonce, user.id, workspaceId),
          encrypted_start_nonce: await encrypt(nonce),
          verification_attempts: 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'workspace_id,profile_id' });
        if (saveError) throw saveError;
        return respond({ status: 'needs_start', botUsername: bot.username, botUrl: `https://t.me/${bot.username}?start=${nonce}` });
      }

      let updates: Array<{ update_id: number; message?: { text?: string; date?: number; chat?: { id?: number; type?: string } } }>;
      try {
        updates = await telegramRequest(token, 'getUpdates', { allowed_updates: ['message'], limit: 100, timeout: 0 });
      } catch {
        return respond({ error: 'ตรวจข้อความเริ่มต้นไม่ได้ กรุณาใช้บอตนี้เฉพาะกับ ClassCare และตรวจว่าไม่ได้ตั้ง webhook ไว้' }, 422);
      }

      let startUpdate: (typeof updates)[number] | undefined;
      for (const update of [...updates].reverse()) {
        const startPayload = update.message?.text?.split(' ')[1];
        if (update.message?.chat?.type !== 'private' || !update.message.chat.id
          || update.message.text?.split(' ')[0].split('@')[0] !== '/start'
          || !startPayload
          || (update.message.date && Date.now() / 1000 - update.message.date >= 60 * 60)) continue;
        if (await hashCode(startPayload, user.id, workspaceId) === current.start_nonce_hash) {
          startUpdate = update;
          break;
        }
      }
      const chatId = startUpdate?.message?.chat?.id;
      if (!chatId) {
        const nonce = await decrypt(current.encrypted_start_nonce);
        return respond({ status: 'needs_start', botUsername: bot.username, botUrl: `https://t.me/${bot.username}?start=${nonce}` });
      }

      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const row = {
        workspace_id: workspaceId,
        profile_id: user.id,
        encrypted_bot_token: await encrypt(token),
        encrypted_chat_id: await encrypt(String(chatId)),
        bot_username: bot.username,
        status: 'pending',
        verification_code_hash: await hashCode(code, user.id, workspaceId),
        verification_expires_at: expiresAt,
        start_nonce_hash: null,
        encrypted_start_nonce: null,
        verification_attempts: 0,
        updated_at: new Date().toISOString(),
      };
      const { error: saveError } = await serviceClient.from('teacher_telegram_connections').upsert(row, { onConflict: 'workspace_id,profile_id' });
      if (saveError) throw saveError;
      try {
        await telegramRequest(token, 'sendMessage', { chat_id: chatId, text: `รหัสยืนยัน ClassCare 360: ${code}\nรหัสใช้ได้ 10 นาที และใช้ได้ครั้งเดียว` });
      } catch (error) {
        await serviceClient.from('teacher_telegram_connections').update({ status: 'disconnected', encrypted_bot_token: null, encrypted_chat_id: null, verification_code_hash: null, verification_expires_at: null, start_nonce_hash: null, encrypted_start_nonce: null, verification_attempts: 0 }).eq('workspace_id', workspaceId).eq('profile_id', user.id);
        throw error;
      }
      return respond({ status: 'pending', botUsername: bot.username, expiresAt });
    }

    const { data: connection, error: connectionError } = await connectionQuery();
    if (connectionError) throw connectionError;
    if (!connection?.encrypted_bot_token || !connection.encrypted_chat_id) return respond({ error: 'ยังไม่มีการเชื่อมบัญชีที่รอยืนยัน' }, 409);

    if (action === 'confirm') {
      const code = payload.code?.trim() || '';
      if (!/^\d{6}$/.test(code)) return respond({ error: 'กรอกรหัส 6 หลักจาก Telegram' }, 400);
      if (connection.status !== 'pending' || !connection.verification_expires_at || new Date(connection.verification_expires_at).getTime() < Date.now()) {
        return respond({ error: 'รหัสหมดอายุแล้ว กรุณาเริ่มเชื่อมบัญชีใหม่' }, 410);
      }
      if ((connection.verification_attempts || 0) >= 5) return respond({ error: 'กรอกรหัสผิดครบจำนวนแล้ว กรุณาเริ่มเชื่อมบัญชีใหม่' }, 429);
      if (connection.verification_code_hash !== await hashCode(code, user.id, workspaceId)) {
        const { error: attemptError } = await serviceClient.from('teacher_telegram_connections').update({ verification_attempts: (connection.verification_attempts || 0) + 1 })
          .eq('workspace_id', workspaceId).eq('profile_id', user.id).eq('status', 'pending');
        if (attemptError) throw attemptError;
        return respond({ error: 'รหัสยืนยันไม่ถูกต้อง' }, 422);
      }
      const { data: confirmed, error } = await serviceClient.from('teacher_telegram_connections').update({
        status: 'connected',
        verification_code_hash: null,
        verification_expires_at: null,
        start_nonce_hash: null,
        encrypted_start_nonce: null,
        verification_attempts: 0,
        updated_at: new Date().toISOString(),
      }).eq('workspace_id', workspaceId).eq('profile_id', user.id).eq('status', 'pending').select('profile_id').maybeSingle();
      if (error) throw error;
      if (!confirmed) return respond({ error: 'คำขอยืนยันหมดอายุหรือถูกยกเลิกแล้ว กรุณาเริ่มใหม่' }, 409);
      return respond({ status: 'connected', botUsername: connection.bot_username });
    }

    if (action === 'test') {
      if (connection.status !== 'connected') return respond({ error: 'ยืนยันการเชื่อม Telegram ก่อนส่งข้อความทดสอบ' }, 409);
      const token = await decrypt(connection.encrypted_bot_token);
      const chatId = await decrypt(connection.encrypted_chat_id);
      await telegramRequest(token, 'sendMessage', { chat_id: chatId, text: 'เชื่อม Telegram กับ ClassCare 360 สำเร็จแล้ว ✅' });
      return respond({ status: 'sent', botUsername: connection.bot_username });
    }

    return respond({ error: 'คำสั่งไม่รองรับ' }, 400);
  } catch (error) {
    console.error('manage-telegram-account failed:', error);
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเชื่อม Telegram';
    return respond({ error: message }, 500);
  }
});
