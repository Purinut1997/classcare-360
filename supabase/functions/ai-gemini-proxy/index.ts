import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

type ProxyMode = 'chat' | 'vision' | 'prompt';

interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface GeminiProxyPayload {
  mode?: ProxyMode;
  workspaceId?: string;
  model?: string;
  apiKey?: string;
  systemInstruction?: string;
  messages?: ChatMessageInput[];
  prompt?: string;
  imageBase64?: string;
  mimeType?: string;
  responseJson?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  allowFallback?: boolean;
}

const VALID_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
];

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

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function getOrderedModels(preferredModel?: string): string[] {
  const normalized = typeof preferredModel === 'string' ? preferredModel.trim() : '';
  const first = VALID_GEMINI_MODELS.includes(normalized)
    ? normalized
    : 'gemini-2.5-flash';

  return [first, ...VALID_GEMINI_MODELS].filter(
    (model, index, list) => Boolean(model) && list.indexOf(model) === index,
  );
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

    const payload = (await request.json()) as GeminiProxyPayload;
    const mode: ProxyMode = payload.mode || 'prompt';
    const workspaceId = payload.workspaceId?.trim() || undefined;

    const [{ data: superadmin }, membershipResult] = await Promise.all([
      serviceClient
        .from('superadmin_profiles')
        .select('profile_id,is_active')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      workspaceId
        ? serviceClient
            .from('workspace_memberships')
            .select('workspace_id,role,status')
            .eq('workspace_id', workspaceId)
            .eq('profile_id', user.id)
            .eq('status', 'active')
            .in('role', ['teacher_owner', 'teacher_member'])
            .maybeSingle()
        : serviceClient
            .from('workspace_memberships')
            .select('workspace_id,role,status')
            .eq('profile_id', user.id)
            .eq('status', 'active')
            .in('role', ['teacher_owner', 'teacher_member'])
            .limit(1)
            .maybeSingle(),
    ]);

    const membership = membershipResult.data as { workspace_id: string; role: string; status: string } | null;
    if (!superadmin && !membership) {
      return jsonResponse({ error: 'Active workspace staff membership or superadmin role required' }, 403);
    }

    const effectiveWorkspaceId = workspaceId || membership?.workspace_id;

    // Resolve API key server-side in strict priority order:
    // 1. User personal key -> 2. Workspace shared key -> 3. Server secret GEMINI_API_KEY -> 4. Request fallback
    let resolvedKey: string | null = null;
    let resolvedModel: string | undefined = payload.model;

    const { data: profileRow } = await serviceClient
      .from('profiles')
      .select('metadata,personal_gemini_api_key,personal_ai_model')
      .eq('id', user.id)
      .maybeSingle();

    const profMeta = (profileRow?.metadata as Record<string, unknown>) || {};
    const personalKeyFromCol =
      typeof profileRow?.personal_gemini_api_key === 'string'
        ? profileRow.personal_gemini_api_key.trim()
        : '';
    const personalKeyFromMeta =
      typeof profMeta.personal_gemini_api_key === 'string'
        ? profMeta.personal_gemini_api_key.trim()
        : '';
    const personalKey = personalKeyFromCol || personalKeyFromMeta;

    if (personalKey.length > 10) {
      resolvedKey = personalKey;
      if (!resolvedModel || resolvedModel === 'auto') {
        resolvedModel =
          (profileRow?.personal_ai_model as string | undefined) ||
          (profMeta.personal_ai_model as string | undefined);
      }
    }

    let workspaceAiDisabled = false;
    if (!resolvedKey && effectiveWorkspaceId) {
      const { data: wsRow } = await serviceClient
        .from('workspaces')
        .select('settings,gemini_api_key,ai_model,is_ai_enabled')
        .eq('id', effectiveWorkspaceId)
        .maybeSingle();

      const wsSettings = (wsRow?.settings as Record<string, unknown>) || {};
      const aiEnabled = wsRow?.is_ai_enabled !== false && wsSettings.is_ai_enabled !== false;
      workspaceAiDisabled = !aiEnabled;
      const wsKeyFromCol = typeof wsRow?.gemini_api_key === 'string' ? wsRow.gemini_api_key.trim() : '';
      const wsKeyFromSettings = typeof wsSettings.gemini_api_key === 'string' ? wsSettings.gemini_api_key.trim() : '';
      const wsKey = wsKeyFromCol || wsKeyFromSettings;

      if (aiEnabled && wsKey.length > 10) {
        resolvedKey = wsKey;
        if (!resolvedModel || resolvedModel === 'auto') {
          resolvedModel =
            (wsRow?.ai_model as string | undefined) ||
            (wsSettings.ai_model as string | undefined);
        }
      }
    }

    if (workspaceAiDisabled && !superadmin && !resolvedKey) {
      return jsonResponse({ error: 'ระบบ AI ของโรงเรียนถูกปิดใช้งานโดยผู้ดูแลระบบ' }, 403);
    }

    if (!resolvedKey) {
      const serverEnvKey = Deno.env.get('GEMINI_API_KEY')?.trim();
      if (serverEnvKey && serverEnvKey.length > 10) {
        resolvedKey = serverEnvKey;
      }
    }

    if (!resolvedKey && payload.apiKey && payload.apiKey.trim().length > 10) {
      resolvedKey = payload.apiKey.trim();
    }

    if (!resolvedKey) {
      return jsonResponse({ error: 'Gemini API Key is not configured for this workspace or user' }, 400);
    }

    const defaultMaxTokens = mode === 'chat' ? 2048 : 8192;
    const requestedMaxTokens = Number(payload.maxOutputTokens) || defaultMaxTokens;
    const safeMaxTokens = Math.min(Math.max(Math.floor(requestedMaxTokens), 64), 8192);

    // Build Gemini generateContent request body
    const generationConfig: Record<string, unknown> = {
      temperature: typeof payload.temperature === 'number'
        ? Math.min(Math.max(payload.temperature, 0), 2)
        : mode === 'vision'
          ? 0.2
          : mode === 'chat'
            ? 0.7
            : 0.4,
      maxOutputTokens: safeMaxTokens,
      ...(mode === 'chat' ? { topP: 0.95 } : {}),
      ...(payload.responseJson ? { responseMimeType: 'application/json' } : {}),
    };

    let contents: Array<Record<string, unknown>>;
    if (mode === 'vision') {
      let cleanBase64 = (payload.imageBase64 || '').trim();
      let mimeType = payload.mimeType || 'image/jpeg';
      const dataUrlMatch = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        cleanBase64 = dataUrlMatch[2];
      }
      if (!cleanBase64) {
        return jsonResponse({ error: 'imageBase64 is required for vision mode' }, 400);
      }
      contents = [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: payload.prompt || '' },
          ],
        },
      ];
    } else if (mode === 'chat' && Array.isArray(payload.messages) && payload.messages.length > 0) {
      contents = payload.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
    } else {
      if (!payload.prompt?.trim()) {
        return jsonResponse({ error: 'prompt is required' }, 400);
      }
      contents = [{ role: 'user', parts: [{ text: payload.prompt }] }];
    }

    const geminiBody: Record<string, unknown> = {
      contents,
      generationConfig,
    };
    if (payload.systemInstruction?.trim()) {
      geminiBody.systemInstruction = {
        parts: [{ text: payload.systemInstruction.trim() }],
      };
    }

    const candidates = getOrderedModels(resolvedModel);
    const modelsToTry = payload.allowFallback === false ? candidates.slice(0, 1) : candidates;

    let finalResponse: Response | null = null;
    let modelUsed = modelsToTry[0];

    for (const candidateModel of modelsToTry) {
      modelUsed = candidateModel;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${resolvedKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
      finalResponse = res;
      if (res.ok) break;
      if (![400, 404, 429].includes(res.status)) break;
    }

    if (!finalResponse || !finalResponse.ok) {
      const errJson = finalResponse ? await finalResponse.json().catch(() => ({})) : {};
      const status = finalResponse?.status || 502;
      const errMessage =
        (errJson as { error?: { message?: string } })?.error?.message ||
        `Gemini HTTP ${status}`;
      return jsonResponse({ error: errMessage, status }, status);
    }

    const resultJson = (await finalResponse.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return jsonResponse({ error: 'Gemini returned an empty response' }, 502);
    }

    return jsonResponse({
      ok: true,
      proxied: true,
      modelUsed,
      text: rawText,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Unexpected proxy error',
      },
      500,
    );
  }
});
