import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type PortalRole = 'parent' | 'student';

interface AcceptInvitationPayload {
  invitationId?: string;
}

interface PortalInvitationRow {
  expires_at: string | null;
  id: string;
  invite_email: string;
  portal_role: PortalRole;
  relation: string | null;
  status: 'invited' | 'accepted' | 'revoked' | 'expired';
  student_id: string;
  workspace_id: string;
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

function normalizeEmail(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
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

    const payload = (await request.json()) as AcceptInvitationPayload;
    const invitationId = payload.invitationId?.trim();

    if (!invitationId) {
      return jsonResponse({ error: 'invitationId is required' }, 400);
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

    const { data: existingProfile, error: profileLookupError } = await serviceClient
      .from('profiles')
      .select('id,email,display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileLookupError) throw profileLookupError;

    const fallbackEmail = normalizeEmail(user.email);
    if (!fallbackEmail) {
      return jsonResponse({ error: 'User email is required before accepting invitation' }, 422);
    }

    const profile =
      existingProfile ||
      (
        await serviceClient
          .from('profiles')
          .insert({
            account_status: 'registered',
            display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || fallbackEmail,
            email: fallbackEmail,
            first_login_at: new Date().toISOString(),
            id: user.id,
            metadata: {
              created_by: 'accept-portal-invitation',
            },
          })
          .select('id,email,display_name')
          .single()
      ).data;

    if (!profile) {
      return jsonResponse({ error: 'Unable to create user profile' }, 500);
    }

    const userEmail = normalizeEmail(profile.email || user.email);
    if (!userEmail) {
      return jsonResponse({ error: 'User profile email is required before accepting invitation' }, 422);
    }

    const { data: invitation, error: invitationError } = await serviceClient
      .from('portal_invitations')
      .select('id,workspace_id,student_id,portal_role,invite_email,relation,status,expires_at')
      .eq('id', invitationId)
      .single<PortalInvitationRow>();

    if (invitationError) throw invitationError;

    if (!invitation) {
      return jsonResponse({ error: 'Invitation not found' }, 404);
    }

    if (normalizeEmail(invitation.invite_email) !== userEmail) {
      return jsonResponse({ error: 'Invitation email does not match signed-in user' }, 403);
    }

    if (invitation.status !== 'invited') {
      return jsonResponse({ error: `Invitation is ${invitation.status}, not invited` }, 409);
    }

    const acceptedAt = new Date();
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < acceptedAt.getTime()) {
      await serviceClient
        .from('portal_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      return jsonResponse({ error: 'Invitation expired' }, 410);
    }

    const { data: existingMembership, error: membershipLookupError } = await serviceClient
      .from('workspace_memberships')
      .select('id,role,status')
      .eq('workspace_id', invitation.workspace_id)
      .eq('profile_id', user.id)
      .maybeSingle();

    if (membershipLookupError) throw membershipLookupError;

    if (!existingMembership) {
      const { error: membershipInsertError } = await serviceClient.from('workspace_memberships').insert({
        joined_at: acceptedAt.toISOString(),
        profile_id: user.id,
        role: invitation.portal_role,
        status: 'active',
        workspace_id: invitation.workspace_id,
      });

      if (membershipInsertError) throw membershipInsertError;
    } else if (['parent', 'student'].includes(String(existingMembership.role)) && existingMembership.status !== 'active') {
      const { error: membershipUpdateError } = await serviceClient
        .from('workspace_memberships')
        .update({ joined_at: acceptedAt.toISOString(), status: 'active' })
        .eq('id', existingMembership.id);

      if (membershipUpdateError) throw membershipUpdateError;
    }

    if (invitation.portal_role === 'parent') {
      const { data: existingGuardian, error: guardianLookupError } = await serviceClient
        .from('student_guardians')
        .select('id')
        .eq('workspace_id', invitation.workspace_id)
        .eq('student_id', invitation.student_id)
        .eq('profile_id', user.id)
        .maybeSingle();

      if (guardianLookupError) throw guardianLookupError;

      if (existingGuardian) {
        const { error: guardianUpdateError } = await serviceClient
          .from('student_guardians')
          .update({
            consent_status: 'granted',
            relation: invitation.relation || 'ผู้ปกครอง',
          })
          .eq('id', existingGuardian.id);

        if (guardianUpdateError) throw guardianUpdateError;
      } else {
        const { error: guardianInsertError } = await serviceClient.from('student_guardians').insert({
          consent_status: 'granted',
          display_name: profile?.display_name || userEmail,
          is_primary: false,
          profile_id: user.id,
          relation: invitation.relation || 'ผู้ปกครอง',
          student_id: invitation.student_id,
          workspace_id: invitation.workspace_id,
        });

        if (guardianInsertError) throw guardianInsertError;
      }
    } else {
      const { data: existingStudentLink, error: studentLinkLookupError } = await serviceClient
        .from('student_profile_links')
        .select('id,profile_id,status')
        .eq('workspace_id', invitation.workspace_id)
        .eq('student_id', invitation.student_id)
        .maybeSingle();

      if (studentLinkLookupError) throw studentLinkLookupError;

      if (existingStudentLink && existingStudentLink.profile_id !== user.id) {
        return jsonResponse({ error: 'This student is already linked to another profile' }, 409);
      }

      const { data: existingProfileLink, error: profileLinkLookupError } = await serviceClient
        .from('student_profile_links')
        .select('id,student_id,status')
        .eq('workspace_id', invitation.workspace_id)
        .eq('profile_id', user.id)
        .maybeSingle();

      if (profileLinkLookupError) throw profileLinkLookupError;

      if (existingProfileLink && existingProfileLink.student_id !== invitation.student_id) {
        return jsonResponse({ error: 'This profile is already linked to another student' }, 409);
      }

      if (existingStudentLink) {
        const { error: studentLinkUpdateError } = await serviceClient
          .from('student_profile_links')
          .update({
            linked_by: user.id,
            status: 'active',
          })
          .eq('id', existingStudentLink.id);

        if (studentLinkUpdateError) throw studentLinkUpdateError;
      } else {
        const { error: studentLinkInsertError } = await serviceClient.from('student_profile_links').insert({
          linked_by: user.id,
          profile_id: user.id,
          status: 'active',
          student_id: invitation.student_id,
          workspace_id: invitation.workspace_id,
        });

        if (studentLinkInsertError) throw studentLinkInsertError;
      }
    }

    const { error: invitationUpdateError } = await serviceClient
      .from('portal_invitations')
      .update({
        accepted_at: acceptedAt.toISOString(),
        accepted_by: user.id,
        status: 'accepted',
      })
      .eq('id', invitation.id);

    if (invitationUpdateError) throw invitationUpdateError;

    await serviceClient.from('audit_logs').insert({
      action: 'portal_invitation.accepted',
      actor_profile_id: user.id,
      actor_role: invitation.portal_role,
      entity_id: invitation.id,
      entity_table: 'portal_invitations',
      metadata: {
        portal_role: invitation.portal_role,
        student_id: invitation.student_id,
        source: 'accept-portal-invitation',
      },
      risk_level: 'normal',
      workspace_id: invitation.workspace_id,
    });

    return jsonResponse({
      destination: invitation.portal_role === 'parent' ? '/portal/parent' : '/portal/student',
      ok: true,
      portalRole: invitation.portal_role,
      status: 'accepted',
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
