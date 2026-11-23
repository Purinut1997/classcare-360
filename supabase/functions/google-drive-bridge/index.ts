import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type Action =
  | 'status'
  | 'get-auth-url'
  | 'exchange-code'
  | 'update-settings'
  | 'disconnect'
  | 'upload'
  | 'download'
  | 'list-backups'
  | 'migrate-batch';

type DriveFolderCategory =
  | 'student_avatar'
  | 'home_visit'
  | 'attendance_leave'
  | 'behavior_portfolio'
  | 'omr_score_scan'
  | 'daily_brief'
  | 'health_doc'
  | 'savings_slip'
  | 'official_document'
  | 'workspace_backup';

const DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

const FOLDER_BY_CATEGORY: Record<DriveFolderCategory, string> = {
  student_avatar: '01_ภาพประจำตัวนักเรียน',
  home_visit: '02_เยี่ยมบ้านและดูแลช่วยเหลือ',
  attendance_leave: '03_ใบลาและหลักฐานเวลาเรียน',
  behavior_portfolio: '04_พฤติกรรมและเกียรติบัตรผลงาน',
  omr_score_scan: '05_สแกน_OMR_และใบคะแนน_AI',
  daily_brief: '06_กิจกรรมและรายงานประจำวัน',
  health_doc: '07_สุขภาพและเงินออม',
  savings_slip: '07_สุขภาพและเงินออม',
  official_document: '08_เอกสารราชการ_ปพ5_ปพ6',
  workspace_backup: '09_สำรองข้อมูลอัตโนมัติ',
};

const MIGRATABLE_BUCKETS = new Set([
  'home-visit-photos',
  'student-avatars',
  'daily-briefs',
  'evidence-files',
]);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

function optionalEnv(name: string): string {
  return (Deno.env.get(name) || '').trim();
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < slice.length; j += 1) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveSecretKeyBytes(): Promise<Uint8Array> {
  const explicitKey = optionalEnv('GOOGLE_DRIVE_ENCRYPTION_KEY');
  if (explicitKey) {
    try {
      const raw = fromBase64(explicitKey);
      if (raw.byteLength === 32) return raw;
    } catch {
      // Fallback to SHA-256 derivation below if non-base64 secret string was provided
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(explicitKey));
    return new Uint8Array(digest);
  }
  const seed = `${env('SUPABASE_SERVICE_ROLE_KEY')}:classcare-google-drive-byos-v1`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return new Uint8Array(digest);
}

async function getAesKey() {
  const raw = await deriveSecretKeyBytes();
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function getHmacKey() {
  const raw = await deriveSecretKeyBytes();
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getAesKey(),
    new TextEncoder().encode(value),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decryptSecret(value: string): Promise<string> {
  const [ivText, encryptedText] = value.split('.');
  if (!ivText || !encryptedText) throw new Error('Encrypted Drive credential is malformed');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivText) },
    await getAesKey(),
    fromBase64(encryptedText),
  );
  return new TextDecoder().decode(plaintext);
}

interface SignedStatePayload {
  exp: number;
  nonce: string;
  profileId: string;
  redirectUri: string;
  workspaceId: string;
}

async function signState(payload: SignedStatePayload): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigBuffer = await crypto.subtle.sign('HMAC', await getHmacKey(), new TextEncoder().encode(encoded));
  const sig = toBase64Url(new Uint8Array(sigBuffer));
  return `${encoded}.${sig}`;
}

async function verifyState(state: string): Promise<SignedStatePayload> {
  const [encoded, sig] = state.split('.');
  if (!encoded || !sig) throw new Error('OAuth state ไม่ถูกต้อง');
  const valid = await crypto.subtle.verify(
    'HMAC',
    await getHmacKey(),
    fromBase64(sig),
    new TextEncoder().encode(encoded),
  );
  if (!valid) throw new Error('ลายเซ็น OAuth state ไม่ผ่านการตรวจสอบ');
  const parsed = JSON.parse(new TextDecoder().decode(fromBase64(encoded))) as SignedStatePayload;
  if (!parsed.exp || Date.now() > parsed.exp) {
    throw new Error('ลิงก์เชื่อมต่อ Google Drive หมดอายุ กรุณากดเชื่อมต่อใหม่อีกครั้ง');
  }
  return parsed;
}

function getOAuthCredentials() {
  const clientId = optionalEnv('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = optionalEnv('GOOGLE_DRIVE_CLIENT_SECRET');
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  };
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret, configured } = getOAuthCredentials();
  if (!configured) {
    throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET บน Supabase Edge Function');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    const code = data.error || `http_${response.status}`;
    const err = new Error(data.error_description || data.error || 'ไม่สามารถต่ออายุสิทธิ์ Google Drive ได้');
    (err as Error & { oauthCode?: string }).oauthCode = code;
    throw err;
  }

  return data.access_token;
}

async function getValidWorkspaceDriveAccess(serviceClient: SupabaseClient, workspaceId: string) {
  const [{ data: conn, error: connError }, { data: tokenRow, error: tokenError }] = await Promise.all([
    serviceClient.from('workspace_drive_connections').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    serviceClient
      .from('workspace_drive_tokens')
      .select('encrypted_refresh_token')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
  ]);

  if (connError) throw connError;
  if (tokenError) throw tokenError;
  if (!conn || conn.status !== 'connected' || !tokenRow?.encrypted_refresh_token) {
    throw new Error('โรงเรียนนี้ยังไม่ได้เชื่อมต่อ Google Drive หรือจำเป็นต้องเชื่อมต่อใหม่');
  }

  const refreshToken = await decryptSecret(tokenRow.encrypted_refresh_token);
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    return { accessToken, conn };
  } catch (err) {
    const oauthCode = (err as Error & { oauthCode?: string }).oauthCode || '';
    if (oauthCode === 'invalid_grant' || oauthCode === 'unauthorized_client') {
      await serviceClient
        .from('workspace_drive_connections')
        .update({
          last_error: 'สิทธิ์การเข้าถึง Google Drive หมดอายุหรือถูกยกเลิก กรุณากดเชื่อมต่อใหม่',
          status: 'reauth_required',
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId);
    }
    throw err;
  }
}

function escapeDriveQueryValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function ensureDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string | null,
): Promise<{ id: string; webViewLink?: string }> {
  const parentFilter = parentId ? `'${escapeDriveQueryValue(parentId)}' in parents and ` : `'root' in parents and `;
  const q = `${parentFilter}name = '${escapeDriveQueryValue(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const searchUrl = new URL('https://www.googleapis.com/drive/v3/files');
  searchUrl.searchParams.set('q', q);
  searchUrl.searchParams.set('fields', 'files(id,name,webViewLink)');
  searchUrl.searchParams.set('pageSize', '5');

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (searchRes.ok) {
    const parsed = (await searchRes.json()) as {
      files?: Array<{ id: string; webViewLink?: string }>;
    };
    if (parsed.files && parsed.files.length > 0) {
      return { id: parsed.files[0].id, webViewLink: parsed.files[0].webViewLink };
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mimeType: 'application/vnd.google-apps.folder',
      name,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => '');
    throw new Error(`สร้างโฟลเดอร์ Google Drive ไม่สำเร็จ (${createRes.status}): ${errBody.slice(0, 180)}`);
  }

  const created = (await createRes.json()) as { id: string; webViewLink?: string };
  return { id: created.id, webViewLink: created.webViewLink };
}

async function fetchDriveAboutQuota(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName,permissionId),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    storageQuota?: { limit?: string; usage?: string; usageInDrive?: string; usageInDriveTrash?: string };
    user?: { displayName?: string; emailAddress?: string; permissionId?: string };
  };
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((part) => {
    combined.set(part, offset);
    offset += part.byteLength;
  });
  return combined;
}

async function uploadBinaryToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  contentType: string,
  fileBytes: Uint8Array,
): Promise<{ id: string; size?: string; webViewLink?: string }> {
  const boundary = `classcare_drive_${crypto.randomUUID().replaceAll('-', '')}`;
  const encoder = new TextEncoder();

  const metadataPart = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n` +
      `--${boundary}\r\nContent-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);
  const multipartBody = concatUint8Arrays([prefix, fileBytes, suffix]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`อัปโหลดไฟล์เข้า Google Drive ไม่สำเร็จ (${uploadRes.status}): ${errText.slice(0, 200)}`);
  }

  return (await uploadRes.json()) as { id: string; size?: string; webViewLink?: string };
}

async function resolveCategoryFolderId(
  serviceClient: SupabaseClient,
  accessToken: string,
  conn: Record<string, unknown>,
  workspaceId: string,
  category: DriveFolderCategory,
): Promise<{ folderId: string; rootFolderId: string; subfolders: Record<string, string> }> {
  let rootFolderId = typeof conn.root_folder_id === 'string' ? conn.root_folder_id : '';
  const subfolders =
    conn.subfolders_json && typeof conn.subfolders_json === 'object'
      ? { ...(conn.subfolders_json as Record<string, string>) }
      : {};

  if (!rootFolderId) {
    const { data: ws } = await serviceClient.from('workspaces').select('name').eq('id', workspaceId).maybeSingle();
    const rootName = `ClassCare 360 - ${ws?.name || 'School'}`;
    const root = await ensureDriveFolder(accessToken, rootName, null);
    rootFolderId = root.id;
  }

  const folderName = FOLDER_BY_CATEGORY[category] || FOLDER_BY_CATEGORY.behavior_portfolio;
  let targetFolderId = subfolders[folderName] || '';
  if (!targetFolderId) {
    const folder = await ensureDriveFolder(accessToken, folderName, rootFolderId);
    targetFolderId = folder.id;
    subfolders[folderName] = targetFolderId;
    await serviceClient
      .from('workspace_drive_connections')
      .update({
        root_folder_id: rootFolderId,
        subfolders_json: subfolders,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);
  }

  return { folderId: targetFolderId, rootFolderId, subfolders };
}

async function computeWorkspaceFileStats(serviceClient: SupabaseClient, workspaceId: string) {
  const { data: rows, error } = await serviceClient
    .from('app_files')
    .select('bucket,size_bytes,storage_provider')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (error || !rows) {
    return {
      driveBytes: 0,
      driveCount: 0,
      migratableCount: 0,
      supabaseBytes: 0,
      supabaseCount: 0,
    };
  }

  let driveCount = 0;
  let driveBytes = 0;
  let supabaseCount = 0;
  let supabaseBytes = 0;
  let migratableCount = 0;

  rows.forEach((row) => {
    const size = typeof row.size_bytes === 'number' && Number.isFinite(row.size_bytes) ? row.size_bytes : 0;
    if (row.storage_provider === 'google_drive') {
      driveCount += 1;
      driveBytes += size;
    } else {
      supabaseCount += 1;
      supabaseBytes += size;
      if (MIGRATABLE_BUCKETS.has(String(row.bucket || ''))) {
        migratableCount += 1;
      }
    }
  });

  return {
    driveBytes,
    driveCount,
    migratableCount,
    supabaseBytes,
    supabaseCount,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    const jwt = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!jwt) return respond({ error: 'กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง' }, 401);

    const supabaseUrl = env('SUPABASE_URL');
    const anonKey = env('SUPABASE_ANON_KEY');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt);
    if (authError || !user) return respond({ error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่' }, 401);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as Action | undefined;
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';

    const allowedActions: Action[] = [
      'status',
      'get-auth-url',
      'exchange-code',
      'update-settings',
      'disconnect',
      'upload',
      'download',
      'list-backups',
      'migrate-batch',
    ];

    if (!workspaceId || !action || !allowedActions.includes(action)) {
      return respond({ error: 'ข้อมูลคำขอไม่ครบหรือไม่รองรับคำสั่งนี้' }, 400);
    }

    // Check caller authority in this workspace or superadmin_profiles
    const [{ data: superadminRow }, { data: membership, error: memberError }] = await Promise.all([
      serviceClient
        .from('superadmin_profiles')
        .select('profile_id,status')
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
      serviceClient
        .from('workspace_memberships')
        .select('role,status')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .maybeSingle(),
    ]);

    if (memberError) throw memberError;
    const isSuperadmin = Boolean(superadminRow);
    const role = membership?.role || null;

    if (!isSuperadmin && !membership) {
      return respond({ error: 'บัญชีนี้ไม่ได้เป็นสมาชิกของโรงเรียนที่เลือก' }, 403);
    }

    const isOwner = isSuperadmin || role === 'teacher_owner';
    const isTeacher = isOwner || role === 'teacher_member';

    if (['get-auth-url', 'exchange-code', 'update-settings', 'disconnect', 'migrate-batch'].includes(action) && !isOwner) {
      return respond({ error: 'เฉพาะเจ้าของพื้นที่โรงเรียน (teacher_owner) เท่านั้นที่ตั้งค่า Google Drive ได้' }, 403);
    }
    if (['upload', 'list-backups'].includes(action) && !isTeacher) {
      return respond({ error: 'ต้องมีสิทธิ์ครูผู้สอนในโรงเรียนจึงจะอัปโหลดหรือดูรายการสำรองได้' }, 403);
    }

    const oauthCreds = getOAuthCredentials();

    // ------------------------------------------------------------------
    // ACTION: STATUS
    // ------------------------------------------------------------------
    if (action === 'status') {
      const [{ data: conn }, fileStats] = await Promise.all([
        serviceClient.from('workspace_drive_connections').select('*').eq('workspace_id', workspaceId).maybeSingle(),
        computeWorkspaceFileStats(serviceClient, workspaceId),
      ]);

      let nextStatus = conn?.status || 'disconnected';
      let quota = (conn?.storage_quota_json as Record<string, unknown> | undefined) || null;
      let lastError = conn?.last_error || null;

      // Refresh live quota gracefully when connected & stale (> 15 mins)
      if (conn && conn.status === 'connected' && oauthCreds.configured) {
        const lastSyncedMs = conn.last_synced_at ? Date.parse(String(conn.last_synced_at)) : 0;
        const stale = !lastSyncedMs || Date.now() - lastSyncedMs > 15 * 60 * 1000;
        if (stale) {
          try {
            const { accessToken } = await getValidWorkspaceDriveAccess(serviceClient, workspaceId);
            const about = await fetchDriveAboutQuota(accessToken);
            if (about?.storageQuota) {
              quota = about.storageQuota;
              await serviceClient
                .from('workspace_drive_connections')
                .update({
                  google_email: about.user?.emailAddress || conn.google_email,
                  last_error: null,
                  last_synced_at: new Date().toISOString(),
                  storage_quota_json: about.storageQuota,
                  updated_at: new Date().toISOString(),
                })
                .eq('workspace_id', workspaceId);
              lastError = null;
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'ไม่สามารถซิงก์ข้อมูล Google Drive';
            lastError = message;
            const { data: refreshedConn } = await serviceClient
              .from('workspace_drive_connections')
              .select('status')
              .eq('workspace_id', workspaceId)
              .maybeSingle();
            if (refreshedConn?.status) nextStatus = refreshedConn.status;
          }
        }
      }

      return respond({
        autoBackupEnabled: Boolean(conn?.auto_backup_enabled),
        autoRouteUploads: conn ? Boolean(conn.auto_route_uploads) : true,
        connectedAt: conn?.connected_at || null,
        fileStats,
        googleEmail: conn?.google_email || null,
        lastError,
        lastSyncedAt: conn?.last_synced_at || null,
        oauthConfigured: oauthCreds.configured,
        rootFolderId: conn?.root_folder_id || null,
        rootFolderName: conn?.root_folder_name || null,
        status: nextStatus,
        storageQuota: quota,
        subfolders: conn?.subfolders_json || {},
      });
    }

    // ------------------------------------------------------------------
    // ACTION: GET-AUTH-URL
    // ------------------------------------------------------------------
    if (action === 'get-auth-url') {
      if (!oauthCreds.configured) {
        return respond(
          {
            error:
              'ยังไม่ได้ตั้งค่า GOOGLE_DRIVE_CLIENT_ID และ GOOGLE_DRIVE_CLIENT_SECRET ใน Supabase Edge Function Secrets',
          },
          400,
        );
      }

      const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : '';
      if (!redirectUri || !redirectUri.startsWith('http')) {
        return respond({ error: 'Redirect URI ไม่ถูกต้อง' }, 400);
      }

      const state = await signState({
        exp: Date.now() + 10 * 60 * 1000,
        nonce: crypto.randomUUID(),
        profileId: user.id,
        redirectUri,
        workspaceId,
      });

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('client_id', oauthCreds.clientId);
      authUrl.searchParams.set('include_granted_scopes', 'true');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', DRIVE_SCOPE);
      authUrl.searchParams.set('state', state);

      return respond({ authUrl: authUrl.toString() });
    }

    // ------------------------------------------------------------------
    // ACTION: EXCHANGE-CODE
    // ------------------------------------------------------------------
    if (action === 'exchange-code') {
      if (!oauthCreds.configured) {
        return respond({ error: 'Google Drive OAuth secrets ยังไม่ได้ตั้งค่า' }, 400);
      }
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const rawState = typeof body.state === 'string' ? body.state.trim() : '';
      if (!code || !rawState) {
        return respond({ error: 'ไม่พบ authorization code หรือ state จาก Google' }, 400);
      }

      const verifiedState = await verifyState(rawState);
      if (verifiedState.workspaceId !== workspaceId || verifiedState.profileId !== user.id) {
        return respond({ error: 'OAuth state ไม่ตรงกับโรงเรียนหรือผู้ใช้ปัจจุบัน' }, 403);
      }

      const tokenParams = new URLSearchParams({
        client_id: oauthCreds.clientId,
        client_secret: oauthCreds.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: verifiedState.redirectUri,
      });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });
      const tokenData = (await tokenRes.json().catch(() => ({}))) as {
        access_token?: string;
        error?: string;
        error_description?: string;
        refresh_token?: string;
        scope?: string;
      };

      if (!tokenRes.ok || !tokenData.access_token) {
        return respond(
          { error: tokenData.error_description || tokenData.error || 'แลกสิทธิ์ Google OAuth Token ไม่สำเร็จ' },
          400,
        );
      }

      let refreshTokenToSave = tokenData.refresh_token || '';
      if (!refreshTokenToSave) {
        const { data: existingToken } = await serviceClient
          .from('workspace_drive_tokens')
          .select('encrypted_refresh_token')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        if (existingToken?.encrypted_refresh_token) {
          refreshTokenToSave = await decryptSecret(existingToken.encrypted_refresh_token);
        }
      }

      if (!refreshTokenToSave) {
        return respond(
          { error: 'Google ไม่ได้ส่ง Refresh Token กลับมา กรุณาลองกดเชื่อมต่อและกดยินยอมสิทธิ์ใหม่อีกครั้ง' },
          400,
        );
      }

      const accessToken = tokenData.access_token;
      const [{ data: wsRow }, about] = await Promise.all([
        serviceClient.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
        fetchDriveAboutQuota(accessToken),
      ]);

      const rootFolderName = `ClassCare 360 - ${wsRow?.name || 'School'}`;
      const rootFolder = await ensureDriveFolder(accessToken, rootFolderName, null);

      const uniqueFolderNames = Array.from(new Set(Object.values(FOLDER_BY_CATEGORY)));
      const subfolderEntries = await Promise.all(
        uniqueFolderNames.map(async (folderName) => {
          const created = await ensureDriveFolder(accessToken, folderName, rootFolder.id);
          return [folderName, created.id] as const;
        }),
      );
      const subfoldersJson = Object.fromEntries(subfolderEntries);

      const nowIso = new Date().toISOString();
      const encryptedRefreshToken = await encryptSecret(refreshTokenToSave);

      const { error: tokenUpsertError } = await serviceClient.from('workspace_drive_tokens').upsert({
        encrypted_refresh_token: encryptedRefreshToken,
        token_scope: tokenData.scope || DRIVE_SCOPE,
        updated_at: nowIso,
        updated_by_profile_id: user.id,
        workspace_id: workspaceId,
      });
      if (tokenUpsertError) throw tokenUpsertError;

      const { error: connUpsertError } = await serviceClient.from('workspace_drive_connections').upsert(
        {
          auto_route_uploads: true,
          connected_at: nowIso,
          connected_by_profile_id: user.id,
          google_email: about?.user?.emailAddress || user.email || null,
          google_user_id: about?.user?.permissionId || null,
          last_error: null,
          last_synced_at: nowIso,
          root_folder_id: rootFolder.id,
          root_folder_name: rootFolderName,
          status: 'connected',
          storage_quota_json: about?.storageQuota || {},
          subfolders_json: subfoldersJson,
          updated_at: nowIso,
          workspace_id: workspaceId,
        },
        { onConflict: 'workspace_id' },
      );
      if (connUpsertError) throw connUpsertError;

      await serviceClient.from('audit_logs').insert({
        action: 'google_drive_connected',
        actor_profile_id: user.id,
        entity_id: rootFolder.id,
        entity_table: 'workspace_drive_connections',
        metadata: {
          google_email: about?.user?.emailAddress || user.email || null,
          root_folder_name: rootFolderName,
        },
        risk_level: 'normal',
        workspace_id: workspaceId,
      });

      return respond({
        connected: true,
        googleEmail: about?.user?.emailAddress || user.email || null,
        rootFolderId: rootFolder.id,
        rootFolderName,
        subfolders: subfoldersJson,
      });
    }

    // ------------------------------------------------------------------
    // ACTION: UPDATE-SETTINGS
    // ------------------------------------------------------------------
    if (action === 'update-settings') {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.autoRouteUploads === 'boolean') updates.auto_route_uploads = body.autoRouteUploads;
      if (typeof body.autoBackupEnabled === 'boolean') updates.auto_backup_enabled = body.autoBackupEnabled;

      const { error } = await serviceClient
        .from('workspace_drive_connections')
        .update(updates)
        .eq('workspace_id', workspaceId);
      if (error) throw error;

      return respond({ ok: true });
    }

    // ------------------------------------------------------------------
    // ACTION: DISCONNECT
    // ------------------------------------------------------------------
    if (action === 'disconnect') {
      await serviceClient.from('workspace_drive_tokens').delete().eq('workspace_id', workspaceId);
      const { error } = await serviceClient
        .from('workspace_drive_connections')
        .update({
          last_error: null,
          status: 'disconnected',
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId);
      if (error) throw error;

      await serviceClient.from('audit_logs').insert({
        action: 'google_drive_disconnected',
        actor_profile_id: user.id,
        entity_table: 'workspace_drive_connections',
        metadata: {},
        risk_level: 'normal',
        workspace_id: workspaceId,
      });

      return respond({ status: 'disconnected' });
    }

    // ------------------------------------------------------------------
    // ACTION: UPLOAD
    // ------------------------------------------------------------------
    if (action === 'upload') {
      const category = (typeof body.category === 'string' ? body.category : 'behavior_portfolio') as DriveFolderCategory;
      const fileName = typeof body.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : `file-${Date.now()}.webp`;
      const contentType = typeof body.contentType === 'string' && body.contentType.trim() ? body.contentType.trim() : 'application/octet-stream';
      const base64Data = typeof body.base64Data === 'string' ? body.base64Data : '';
      const fallbackBucket = typeof body.fallbackBucket === 'string' && body.fallbackBucket.trim() ? body.fallbackBucket.trim() : 'evidence-files';
      const storagePath =
        typeof body.storagePath === 'string' && body.storagePath.trim()
          ? body.storagePath.trim()
          : `${workspaceId}/${category}/${crypto.randomUUID()}-${fileName}`;
      const privacyLevel =
        typeof body.privacyLevel === 'string' && ['public', 'private', 'restricted', 'sensitive'].includes(body.privacyLevel)
          ? body.privacyLevel
          : 'sensitive';
      const metadata = body.metadata && typeof body.metadata === 'object' ? (body.metadata as Record<string, unknown>) : {};

      if (!base64Data) {
        return respond({ error: 'ไม่มีข้อมูลไฟล์สำหรับอัปโหลด' }, 400);
      }

      const fileBytes = fromBase64(base64Data);
      if (fileBytes.byteLength === 0 || fileBytes.byteLength > MAX_UPLOAD_BYTES) {
        return respond({ error: `ขนาดไฟล์ต้องไม่เกิน ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB` }, 400);
      }

      const { accessToken, conn } = await getValidWorkspaceDriveAccess(serviceClient, workspaceId);
      const { folderId } = await resolveCategoryFolderId(serviceClient, accessToken, conn, workspaceId, category);

      const driveFile = await uploadBinaryToDrive(accessToken, folderId, fileName, contentType, fileBytes);
      const driveWebViewLink =
        driveFile.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(driveFile.id)}/view`;

      const { data: fileRow, error: insertError } = await serviceClient
        .from('app_files')
        .insert({
          bucket: fallbackBucket,
          content_type: contentType,
          external_file_id: driveFile.id,
          external_folder_id: folderId,
          external_web_view_link: driveWebViewLink,
          folder_category: category,
          metadata: {
            ...metadata,
            drive_folder_name: FOLDER_BY_CATEGORY[category] || FOLDER_BY_CATEGORY.behavior_portfolio,
            storage_provider: 'google_drive',
          },
          original_filename: fileName,
          owner_profile_id: user.id,
          privacy_level: privacyLevel,
          size_bytes: fileBytes.byteLength,
          storage_path: storagePath,
          storage_provider: 'google_drive',
          workspace_id: workspaceId,
        })
        .select('id,storage_path,external_file_id,external_folder_id,external_web_view_link,size_bytes')
        .single();

      if (insertError) throw insertError;

      return respond({
        contentType,
        externalFileId: fileRow.external_file_id,
        externalFolderId: fileRow.external_folder_id,
        externalWebViewLink: fileRow.external_web_view_link,
        fileId: fileRow.id,
        sizeBytes: fileRow.size_bytes,
        storagePath: fileRow.storage_path,
        storageProvider: 'google_drive',
      });
    }

    // ------------------------------------------------------------------
    // ACTION: DOWNLOAD (Private authenticated stream proxy)
    // ------------------------------------------------------------------
    if (action === 'download') {
      const fileId = typeof body.fileId === 'string' ? body.fileId.trim() : '';
      if (!fileId) return respond({ error: 'ไม่พบรหัสไฟล์ (fileId)' }, 400);

      const { data: fileRow, error: fileError } = await serviceClient
        .from('app_files')
        .select('id,workspace_id,storage_provider,external_file_id,content_type,original_filename,deleted_at')
        .eq('id', fileId)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .maybeSingle();

      if (fileError) throw fileError;
      if (!fileRow || fileRow.storage_provider !== 'google_drive' || !fileRow.external_file_id) {
        return respond({ error: 'ไม่พบไฟล์บน Google Drive ในพื้นที่โรงเรียนนี้' }, 404);
      }

      const { accessToken } = await getValidWorkspaceDriveAccess(serviceClient, workspaceId);
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileRow.external_file_id)}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!driveRes.ok) {
        return respond({ error: `ไม่สามารถดึงไฟล์จาก Google Drive (${driveRes.status})` }, driveRes.status === 404 ? 404 : 502);
      }

      const buffer = await driveRes.arrayBuffer();
      const safeName = (fileRow.original_filename || 'file').replace(/["\r\n]/g, '_');

      return new Response(buffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'private, max-age=1800',
          'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`,
          'Content-Type': fileRow.content_type || 'application/octet-stream',
        },
      });
    }

    // ------------------------------------------------------------------
    // ACTION: LIST-BACKUPS
    // ------------------------------------------------------------------
    if (action === 'list-backups') {
      const { data: backups, error } = await serviceClient
        .from('app_files')
        .select('id,original_filename,size_bytes,storage_provider,external_web_view_link,created_at')
        .eq('workspace_id', workspaceId)
        .eq('folder_category', 'workspace_backup')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return respond({ backups: backups || [] });
    }

    // ------------------------------------------------------------------
    // ACTION: MIGRATE-BATCH (Move old Supabase Storage files to Drive)
    // ------------------------------------------------------------------
    if (action === 'migrate-batch') {
      const requestedLimit = typeof body.limit === 'number' ? Math.floor(body.limit) : 10;
      const batchLimit = Math.max(1, Math.min(20, requestedLimit));

      const { accessToken, conn } = await getValidWorkspaceDriveAccess(serviceClient, workspaceId);

      const { data: candidates, error: fetchError } = await serviceClient
        .from('app_files')
        .select('id,bucket,storage_path,original_filename,content_type,size_bytes,folder_category,metadata')
        .eq('workspace_id', workspaceId)
        .eq('storage_provider', 'supabase')
        .is('deleted_at', null)
        .in('bucket', Array.from(MIGRATABLE_BUCKETS))
        .order('created_at', { ascending: true })
        .limit(batchLimit);

      if (fetchError) throw fetchError;
      if (!candidates || candidates.length === 0) {
        return respond({ bytesFreed: 0, failed: 0, migrated: 0, remaining: 0 });
      }

      let migrated = 0;
      let failed = 0;
      let bytesFreed = 0;

      for (const row of candidates) {
        try {
          const { data: blob, error: dlError } = await serviceClient.storage
            .from(row.bucket)
            .download(row.storage_path);
          if (dlError || !blob) {
            failed += 1;
            continue;
          }

          const category: DriveFolderCategory =
            (row.folder_category as DriveFolderCategory | null) ||
            (row.bucket === 'student-avatars'
              ? 'student_avatar'
              : row.bucket === 'home-visit-photos'
                ? 'home_visit'
                : row.bucket === 'daily-briefs'
                  ? 'daily_brief'
                  : 'behavior_portfolio');

          const { folderId } = await resolveCategoryFolderId(serviceClient, accessToken, conn, workspaceId, category);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const fileName = row.original_filename || row.storage_path.split('/').pop() || `${row.id}.webp`;
          const contentType = row.content_type || blob.type || 'application/octet-stream';

          const driveFile = await uploadBinaryToDrive(accessToken, folderId, fileName, contentType, bytes);
          const driveLink =
            driveFile.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(driveFile.id)}/view`;

          const nextMetadata = {
            ...(row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {}),
            migrated_from_supabase_at: new Date().toISOString(),
            previous_bucket: row.bucket,
          };

          const { error: updateError } = await serviceClient
            .from('app_files')
            .update({
              external_file_id: driveFile.id,
              external_folder_id: folderId,
              external_web_view_link: driveLink,
              folder_category: category,
              metadata: nextMetadata,
              storage_provider: 'google_drive',
            })
            .eq('id', row.id)
            .eq('workspace_id', workspaceId);

          if (updateError) {
            failed += 1;
            continue;
          }

          // Delete old Supabase object only after Drive upload + DB update succeed
          await serviceClient.storage.from(row.bucket).remove([row.storage_path]);
          migrated += 1;
          bytesFreed += row.size_bytes || bytes.byteLength;
        } catch {
          failed += 1;
        }
      }

      const { count: remainingCount } = await serviceClient
        .from('app_files')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('storage_provider', 'supabase')
        .is('deleted_at', null)
        .in('bucket', Array.from(MIGRATABLE_BUCKETS));

      if (migrated > 0) {
        await serviceClient.from('audit_logs').insert({
          action: 'google_drive_cold_storage_migrated',
          actor_profile_id: user.id,
          entity_table: 'app_files',
          metadata: { bytes_freed: bytesFreed, failed, migrated },
          risk_level: 'normal',
          workspace_id: workspaceId,
        });
      }

      return respond({
        bytesFreed,
        failed,
        migrated,
        remaining: remainingCount || 0,
      });
    }

    return respond({ error: 'ไม่รองรับคำสั่งนี้' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Drive bridge error';
    return respond({ error: message }, 500);
  }
});
