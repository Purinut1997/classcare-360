import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type ReviewAction = 'approve' | 'reject';

interface ReviewPayload {
  action?: ReviewAction;
  paymentRequestId?: string;
  reviewNote?: string;
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

    const payload = (await request.json()) as ReviewPayload;
    const paymentRequestId = payload.paymentRequestId?.trim();
    const action = payload.action;

    if (!paymentRequestId || (action !== 'approve' && action !== 'reject')) {
      return jsonResponse({ error: 'paymentRequestId and action=approve|reject are required' }, 400);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: { Authorization: authorization },
      },
    });

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
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

    if (!superadmin) {
      return jsonResponse({ error: 'Superadmin role required' }, 403);
    }

    const { data: paymentRequest, error: paymentError } = await serviceClient
      .from('payment_requests')
      .select(
        'id,workspace_id,profile_id,plan_id,status,payable_amount_thb,slip_file_id,submitted_at,plans(code,duration_days)',
      )
      .eq('id', paymentRequestId)
      .single();

    if (paymentError) throw paymentError;

    if (!paymentRequest) {
      return jsonResponse({ error: 'Payment request not found' }, 404);
    }

    if (paymentRequest.status !== 'pending_review') {
      return jsonResponse({ error: `Payment request is ${paymentRequest.status}, not pending_review` }, 409);
    }

    const reviewedAt = new Date();
    const reviewNote = payload.reviewNote?.trim() || null;

    if (action === 'reject') {
      const { error: rejectError } = await serviceClient
        .from('payment_requests')
        .update({
          reviewed_at: reviewedAt.toISOString(),
          reviewed_by: user.id,
          review_note: reviewNote || 'Rejected by approve-payment-request Edge Function.',
          status: 'rejected',
        })
        .eq('id', paymentRequest.id);

      if (rejectError) throw rejectError;

      await serviceClient.from('audit_logs').insert({
        action: 'payment_request.rejected',
        actor_profile_id: user.id,
        actor_role: superadmin.level,
        entity_id: paymentRequest.id,
        entity_table: 'payment_requests',
        metadata: {
          source: 'approve-payment-request',
        },
        risk_level: 'high',
        workspace_id: paymentRequest.workspace_id,
      });

      return jsonResponse({ ok: true, status: 'rejected' });
    }

    if (Number(paymentRequest.payable_amount_thb) > 0 && !paymentRequest.slip_file_id) {
      return jsonResponse({ error: 'Slip file is required before approval' }, 422);
    }

    const plan = Array.isArray(paymentRequest.plans) ? paymentRequest.plans[0] : paymentRequest.plans;
    const durationDays = Number(plan?.duration_days || 365);
    const startsAt = reviewedAt;
    const endsAt = addDays(startsAt, durationDays);

    const { error: approveError } = await serviceClient
      .from('payment_requests')
      .update({
        reviewed_at: reviewedAt.toISOString(),
        reviewed_by: user.id,
        review_note: reviewNote || 'Approved by approve-payment-request Edge Function.',
        status: 'approved',
      })
      .eq('id', paymentRequest.id);

    if (approveError) throw approveError;

    const { error: closeSubscriptionError } = await serviceClient
      .from('subscriptions')
      .update({
        cancelled_at: reviewedAt.toISOString(),
        metadata: {
          replaced_by_payment_request_id: paymentRequest.id,
          replaced_by_source: 'approve-payment-request',
        },
        status: 'cancelled',
      })
      .eq('workspace_id', paymentRequest.workspace_id)
      .in('status', ['trial', 'active']);

    if (closeSubscriptionError) throw closeSubscriptionError;

    const { data: subscription, error: subscriptionError } = await serviceClient
      .from('subscriptions')
      .insert({
        ends_at: endsAt.toISOString(),
        metadata: {
          approved_by: user.id,
          approved_from: 'approve-payment-request',
          payment_request_id: paymentRequest.id,
        },
        payment_request_id: paymentRequest.id,
        plan_id: paymentRequest.plan_id,
        profile_id: paymentRequest.profile_id,
        source: 'payment_approval_edge_function',
        starts_at: startsAt.toISOString(),
        status: 'active',
        trial_used: false,
        workspace_id: paymentRequest.workspace_id,
      })
      .select('id,status,starts_at,ends_at')
      .single();

    if (subscriptionError) throw subscriptionError;

    await serviceClient.from('audit_logs').insert({
      action: 'payment_request.approved',
      actor_profile_id: user.id,
      actor_role: superadmin.level,
      entity_id: paymentRequest.id,
      entity_table: 'payment_requests',
      metadata: {
        payable_amount_thb: paymentRequest.payable_amount_thb,
        source: 'approve-payment-request',
        subscription_id: subscription.id,
      },
      risk_level: 'critical',
      workspace_id: paymentRequest.workspace_id,
    });

    return jsonResponse({
      ok: true,
      status: 'approved',
      subscription,
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
