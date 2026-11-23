import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type UserAdminAction =
  | 'create_user'
  | 'set_password'
  | 'generate_recovery_link'
  | 'confirm_email'
  | 'update_profile'
  | 'set_status'
  | 'delete_user';

interface ManageUserPayload {
  action?: UserAdminAction;
  targetProfileId?: string;
  email?: string;
  displayName?: string;
  phone?: string;
  password?: string;
  emailConfirm?: boolean;
  accountStatus?: 'active' | 'suspended';
  redirectTo?: string;
  workspaceStrategy?: 'transfer' | 'delete' | 'block';
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user: actor },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !actor) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is an active SuperAdmin
    const { data: superadminRow, error: saError } = await adminClient
      .from('superadmin_profiles')
      .select('level, is_active')
      .eq('profile_id', actor.id)
      .maybeSingle();

    if (saError || !superadminRow?.is_active || superadminRow.level !== 'superadmin') {
      return jsonResponse({ error: 'not_allowed: SuperAdmin access required' }, 403);
    }

    const payload = (await request.json()) as ManageUserPayload;
    const action = payload.action;

    if (!action) {
      return jsonResponse({ error: 'Missing action' }, 400);
    }

    if (action === 'create_user') {
      const email = payload.email?.trim().toLowerCase() || '';
      const password = payload.password || '';
      const displayName = payload.displayName?.trim() || email.split('@')[0] || 'ผู้ใช้ใหม่';
      const phone = payload.phone?.trim() || null;

      if (!email || !email.includes('@')) {
        return jsonResponse({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' }, 400);
      }
      if (password.length < 8) {
        return jsonResponse({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400);
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: payload.emailConfirm !== false,
        user_metadata: { display_name: displayName },
      });

      if (createErr || !created.user) {
        return jsonResponse({ error: createErr?.message || 'สร้างบัญชีผู้ใช้ไม่สำเร็จ' }, 400);
      }

      await adminClient.from('profiles').upsert(
        {
          id: created.user.id,
          email,
          display_name: displayName,
          phone,
          account_status: 'active',
        },
        { onConflict: 'id' },
      );

      await adminClient.from('audit_logs').insert({
        actor_profile_id: actor.id,
        entity_table: 'profiles',
        entity_id: created.user.id,
        action: 'superadmin_user_created',
        risk_level: 'high',
        metadata: { email, display_name: displayName },
      });

      return jsonResponse({
        created: true,
        profile_id: created.user.id,
        email,
        display_name: displayName,
      });
    }

    if (action === 'generate_recovery_link') {
      const email = payload.email?.trim().toLowerCase() || '';
      if (!email) {
        return jsonResponse({ error: 'กรุณาระบุอีเมลผู้ใช้' }, 400);
      }

      let safeRedirectTo: string | undefined;
      if (payload.redirectTo) {
        try {
          const parsedRedirect = new URL(payload.redirectTo);
          const isLocal =
            parsedRedirect.protocol === 'http:' &&
            (parsedRedirect.hostname === 'localhost' || parsedRedirect.hostname === '127.0.0.1');
          const isProd =
            parsedRedirect.protocol === 'https:' &&
            (parsedRedirect.hostname === 'classcare-360.pages.dev' ||
              parsedRedirect.hostname.endsWith('.classcare-360.pages.dev'));
          const extraAllowed = (Deno.env.get('ALLOWED_OAUTH_ORIGINS') || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const isExtra = parsedRedirect.protocol === 'https:' && extraAllowed.includes(parsedRedirect.origin);
          if (!isLocal && !isProd && !isExtra) {
            return jsonResponse({ error: 'redirectTo ไม่อยู่ในโดเมนที่อนุญาต' }, 400);
          }
          safeRedirectTo = parsedRedirect.toString();
        } catch {
          return jsonResponse({ error: 'รูปแบบ redirectTo ไม่ถูกต้อง' }, 400);
        }
      }

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: safeRedirectTo ? { redirectTo: safeRedirectTo } : undefined,
      });

      if (linkErr || !linkData?.properties?.action_link) {
        return jsonResponse({ error: linkErr?.message || 'สร้างลิงก์ตั้งรหัสผ่านใหม่ไม่สำเร็จ' }, 400);
      }

      await adminClient.from('audit_logs').insert({
        actor_profile_id: actor.id,
        entity_table: 'profiles',
        entity_id: linkData.user?.id || null,
        action: 'superadmin_recovery_link_generated',
        risk_level: 'high',
        metadata: { email },
      });

      return jsonResponse({
        action_link: linkData.properties.action_link,
        email,
      });
    }

    const targetId = payload.targetProfileId?.trim();
    if (!targetId) {
      return jsonResponse({ error: 'Missing targetProfileId' }, 400);
    }

    if (action === 'set_password') {
      const password = payload.password || '';
      if (password.length < 8) {
        return jsonResponse({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400);
      }

      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(targetId, {
        password,
        email_confirm: true,
      });

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 400);
      }

      await adminClient.from('audit_logs').insert({
        actor_profile_id: actor.id,
        entity_table: 'profiles',
        entity_id: targetId,
        action: 'superadmin_password_reset_direct',
        risk_level: 'high',
        metadata: { target_email: updated.user?.email || payload.email || null },
      });

      return jsonResponse({ updated: true, profile_id: targetId });
    }

    if (action === 'confirm_email') {
      const { error: confirmErr } = await adminClient.auth.admin.updateUserById(targetId, {
        email_confirm: true,
      });

      if (confirmErr) {
        return jsonResponse({ error: confirmErr.message }, 400);
      }

      await adminClient.from('audit_logs').insert({
        actor_profile_id: actor.id,
        entity_table: 'profiles',
        entity_id: targetId,
        action: 'superadmin_email_confirmed',
        risk_level: 'normal',
        metadata: { target_email: payload.email || null },
      });

      return jsonResponse({ confirmed: true, profile_id: targetId });
    }

    if (action === 'update_profile') {
      const displayName = payload.displayName?.trim() || '';
      const phone = payload.phone?.trim() || null;
      const email = payload.email?.trim().toLowerCase() || '';

      if (!displayName) {
        return jsonResponse({ error: 'กรุณากรอกชื่อแสดงผล' }, 400);
      }

      const authUpdates: { email?: string; email_confirm?: boolean; user_metadata: Record<string, unknown> } = {
        user_metadata: { display_name: displayName },
      };
      if (email && email.includes('@')) {
        authUpdates.email = email;
        authUpdates.email_confirm = true;
      }

      const { error: authUpdErr } = await adminClient.auth.admin.updateUserById(targetId, authUpdates);
      if (authUpdErr) {
        return jsonResponse({ error: authUpdErr.message }, 400);
      }

      const profileUpdates: Record<string, unknown> = {
        display_name: displayName,
        phone,
        updated_at: new Date().toISOString(),
      };
      if (email && email.includes('@')) {
        profileUpdates.email = email;
      }

      const { error: profErr } = await adminClient.from('profiles').update(profileUpdates).eq('id', targetId);
      if (profErr) {
        return jsonResponse({ error: profErr.message }, 400);
      }

      await adminClient.from('audit_logs').insert({
        actor_profile_id: actor.id,
        entity_table: 'profiles',
        entity_id: targetId,
        action: 'superadmin_user_profile_updated',
        risk_level: 'normal',
        metadata: { display_name: displayName, phone, email: email || undefined },
      });

      return jsonResponse({ updated: true, profile_id: targetId });
    }

    if (action === 'set_status') {
      const nextStatus = payload.accountStatus;
      if (nextStatus !== 'active' && nextStatus !== 'suspended') {
        return jsonResponse({ error: 'Invalid accountStatus' }, 400);
      }
      if (targetId === actor.id && nextStatus === 'suspended') {
        return jsonResponse({ error: 'cannot_disable_yourself' }, 400);
      }

      const { error: banErr } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: nextStatus === 'suspended' ? '876000h' : 'none',
      });
      if (banErr) {
        return jsonResponse({ error: banErr.message }, 400);
      }

      const { error: statusErr } = await adminClient
        .from('profiles')
        .update({ account_status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', targetId);
      if (statusErr) {
        return jsonResponse({ error: statusErr.message }, 400);
      }

      await adminClient.from('audit_logs').insert({
        actor_profile_id: actor.id,
        entity_table: 'profiles',
        entity_id: targetId,
        action: nextStatus === 'suspended' ? 'superadmin_user_suspended' : 'superadmin_user_restored',
        risk_level: 'high',
        metadata: { next_account_status: nextStatus },
      });

      return jsonResponse({ updated: true, profile_id: targetId, account_status: nextStatus });
    }

    if (action === 'delete_user') {
      if (targetId === actor.id) {
        return jsonResponse({ error: 'cannot_delete_yourself' }, 400);
      }

      // Prepare FK cleanup via authenticated user's RPC (preserves auth.uid() for workspace transfer & audit logs)
      const { data: prepData, error: prepErr } = await userClient.rpc('superadmin_prepare_delete_user', {
        target_profile_id: targetId,
        workspace_strategy: payload.workspaceStrategy || 'transfer',
      });

      if (prepErr) {
        return jsonResponse({ error: prepErr.message }, 400);
      }

      const prep = prepData as { prepared?: boolean; reason?: string } | null;
      if (prep && prep.prepared === false) {
        return jsonResponse({ deleted: false, ...prep }, 409);
      }

      const { error: delErr } = await adminClient.auth.admin.deleteUser(targetId);
      if (delErr) {
        return jsonResponse({ error: delErr.message }, 400);
      }

      return jsonResponse({ deleted: true, profile_id: targetId, ...prep });
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});
