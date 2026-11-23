import { supabase, isSupabaseReady } from './supabaseClient';
import { canUseAiGeminiByPlan } from './planAccessPolicy';
import type { AppSessionContext } from '../types/core';
import type { GeminiModelId } from './geminiClient';

export interface EffectiveAiConfig {
  apiKey: string | null;
  model: GeminiModelId;
  source: 'personal' | 'workspace' | 'superadmin_grant' | 'none';
  isVip: boolean;
  canConfigureWorkspace: boolean;
  canConfigurePersonal: boolean;
}

export function isUserVip(session: AppSessionContext | null | undefined): boolean {
  return canUseAiGeminiByPlan(session);
}

function normalizeStoredModel(m?: string | null): GeminiModelId {
  if (!m || (m as string) === 'gemini-1.5-flash' || (m as string) === 'gemini-1.5-pro') {
    return 'gemini-2.5-flash';
  }
  return m as GeminiModelId;
}

/**
 * Resolves the effective AI Key and Model for the current session.
 * Prioritizes:
 * 1. Personal Key (LocalStorage -> Profile Metadata)
 * 2. Workspace Shared Key (LocalStorage -> Workspace Settings)
 * 3. Fallback to empty (Requires user or admin to provide a key)
 */
export async function getEffectiveAiConfig(session: AppSessionContext | null | undefined): Promise<EffectiveAiConfig> {
  const isVip = isUserVip(session);
  const isSuperadmin = session?.profile?.role === 'superadmin';
  const isWorkspaceOwner = session?.profile?.role === 'teacher_owner';

  const result: EffectiveAiConfig = {
    apiKey: null,
    model: 'gemini-2.5-flash',
    source: 'none',
    isVip,
    canConfigureWorkspace: isSuperadmin || (isVip && isWorkspaceOwner),
    canConfigurePersonal: isSuperadmin || isVip,
  };

  // Enforce VIP entitlement strictly: non-VIP / expired accounts never receive or execute Gemini API keys
  if (!session || !isVip) return result;

  const workspaceId = session.workspace?.id;
  const profileId = session.profile?.id;

  // 1. Check Personal Key from local cache first
  const cachedPersonalKey = localStorage.getItem(`classcare_personal_ai_key_${profileId}`);
  const cachedPersonalModel = localStorage.getItem(`classcare_personal_ai_model_${profileId}`) as GeminiModelId | null;

  if (cachedPersonalKey && cachedPersonalKey.trim().length > 10) {
    result.apiKey = cachedPersonalKey.trim();
    result.model = normalizeStoredModel(cachedPersonalModel);
    result.source = 'personal';

    // Proactively sync local key to cloud profile metadata in background so other devices receive it
    if (isSupabaseReady && supabase && profileId) {
      void syncPersonalKeyToCloud(profileId, cachedPersonalKey.trim(), result.model);
    }

    return result;
  }

  // 2. Check Workspace Key from local cache (only owners/superadmins cache raw workspace key locally)
  const canHoldRawWorkspaceKey = isSuperadmin || isWorkspaceOwner;
  if (!canHoldRawWorkspaceKey && workspaceId) {
    localStorage.removeItem(`classcare_workspace_ai_key_${workspaceId}`);
  }
  const cachedWorkspaceKey =
    canHoldRawWorkspaceKey && workspaceId
      ? localStorage.getItem(`classcare_workspace_ai_key_${workspaceId}`)
      : null;
  const cachedWorkspaceModel = workspaceId ? (localStorage.getItem(`classcare_workspace_ai_model_${workspaceId}`) as GeminiModelId | null) : null;

  if (cachedWorkspaceKey && cachedWorkspaceKey.trim().length > 10) {
    result.apiKey = cachedWorkspaceKey.trim();
    result.model = normalizeStoredModel(cachedWorkspaceModel);
    result.source = 'workspace';

    // Proactively sync local workspace key to cloud workspace vault in background
    if (isSupabaseReady && supabase && workspaceId) {
      void syncWorkspaceKeyToCloud(workspaceId, cachedWorkspaceKey.trim(), result.model);
    }

    return result;
  }

  // 3. If local cache was empty (e.g. logged in on a new device/machine), query Supabase
  if (isSupabaseReady && supabase) {
    try {
      // 3.1 Check Personal Key in Supabase (from profiles.metadata which is always available across all instances)
      if (profileId) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', profileId)
          .maybeSingle();

        const meta = (profData?.metadata as Record<string, unknown>) || {};
        const personalKey = typeof meta.personal_gemini_api_key === 'string' ? meta.personal_gemini_api_key.trim() : null;
        const personalModel = normalizeStoredModel(meta.personal_ai_model as string);

        if (personalKey && personalKey.length > 10) {
          result.apiKey = personalKey;
          result.model = personalModel;
          result.source = 'personal';
          localStorage.setItem(`classcare_personal_ai_key_${profileId}`, personalKey);
          localStorage.setItem(`classcare_personal_ai_model_${profileId}`, personalModel);
          return result;
        }

        // Also check if dedicated column personal_gemini_api_key exists
        try {
          const { data: directProf } = await supabase
            .from('profiles')
            .select('personal_gemini_api_key, personal_ai_model')
            .eq('id', profileId)
            .maybeSingle();

          if (directProf?.personal_gemini_api_key) {
            result.apiKey = directProf.personal_gemini_api_key;
            result.model = normalizeStoredModel(directProf.personal_ai_model);
            result.source = 'personal';
            localStorage.setItem(`classcare_personal_ai_key_${profileId}`, directProf.personal_gemini_api_key);
            localStorage.setItem(`classcare_personal_ai_model_${profileId}`, result.model);
            return result;
          }
        } catch {
          // Dedicated column might not exist, metadata already handled it
        }
      }

      // 3.2 Check Workspace Key in Supabase via server-side vault RPC (with legacy fallback)
      if (workspaceId) {
        try {
          const { data: vaultStatus, error: vaultError } = await supabase.rpc(
            'get_workspace_ai_config_status',
            { target_workspace_id: workspaceId },
          );
          if (!vaultError && vaultStatus && typeof vaultStatus === 'object') {
            const statusObj = vaultStatus as {
              ai_model?: string | null;
              api_key?: string | null;
              has_key?: boolean;
              is_ai_enabled?: boolean;
            };
            if (statusObj.has_key && statusObj.is_ai_enabled !== false) {
              const resolvedWsModel = normalizeStoredModel(statusObj.ai_model);
              result.model = resolvedWsModel;
              result.source = 'workspace';
              if (typeof statusObj.api_key === 'string' && statusObj.api_key.trim().length > 10) {
                result.apiKey = statusObj.api_key.trim();
                if (canHoldRawWorkspaceKey) {
                  localStorage.setItem(`classcare_workspace_ai_key_${workspaceId}`, result.apiKey);
                }
              } else {
                // Non-owner teachers receive opaque proxy token; ai-gemini-proxy resolves the secret server-side
                result.apiKey = 'SERVER_MANAGED_WORKSPACE_KEY';
              }
              localStorage.setItem(`classcare_workspace_ai_model_${workspaceId}`, resolvedWsModel);
              return result;
            }
          }
        } catch {
          // Fallback to legacy workspaces.settings if migration 0100 is not applied yet
        }

        const { data: wsData } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', workspaceId)
          .maybeSingle();

        const wsSettings = (wsData?.settings as Record<string, unknown>) || {};
        const wsKey = typeof wsSettings.gemini_api_key === 'string' ? wsSettings.gemini_api_key.trim() : null;
        const hasVaultFlag = wsSettings.has_workspace_ai_key === true;
        const wsModel = normalizeStoredModel(wsSettings.ai_model as string);

        if ((wsKey && wsKey.length > 10 || hasVaultFlag) && wsSettings.is_ai_enabled !== false) {
          result.apiKey = canHoldRawWorkspaceKey && wsKey ? wsKey : 'SERVER_MANAGED_WORKSPACE_KEY';
          result.model = wsModel;
          result.source = 'workspace';
          if (canHoldRawWorkspaceKey && wsKey) {
            localStorage.setItem(`classcare_workspace_ai_key_${workspaceId}`, wsKey);
          }
          localStorage.setItem(`classcare_workspace_ai_model_${workspaceId}`, wsModel);
          return result;
        }
      }
    } catch (err) {
      console.warn('Could not query cloud AI settings:', err);
    }
  }

  return result;
}

/**
 * Background helper to sync local personal key into user's profile metadata in Supabase
 */
async function syncPersonalKeyToCloud(profileId: string, apiKey: string, model: GeminiModelId): Promise<void> {
  if (!isSupabaseReady || !supabase) return;
  try {
    const { data: prof } = await supabase.from('profiles').select('metadata').eq('id', profileId).maybeSingle();
    const currentMeta = (prof?.metadata as Record<string, unknown>) || {};
    if (currentMeta.personal_gemini_api_key !== apiKey || currentMeta.personal_ai_model !== model) {
      await supabase
        .from('profiles')
        .update({
          metadata: {
            ...currentMeta,
            personal_gemini_api_key: apiKey.trim(),
            personal_ai_model: model,
          },
        })
        .eq('id', profileId);
    }
  } catch {
    // Non-blocking background sync
  }
}

/**
 * Background helper to sync local workspace key into workspace settings in Supabase
 */
async function syncWorkspaceKeyToCloud(workspaceId: string, apiKey: string, model: GeminiModelId): Promise<void> {
  if (!isSupabaseReady || !supabase || !apiKey || apiKey === 'SERVER_MANAGED_WORKSPACE_KEY' || apiKey.startsWith('••••')) return;
  try {
    await supabase.rpc('set_workspace_ai_key', {
      target_workspace_id: workspaceId,
      new_api_key: apiKey.trim(),
      new_model: model,
    });
  } catch {
    // Non-blocking background sync
  }
}

/**
 * Saves personal AI Key and Model for a teacher.
 * Saves both to local device cache and permanently to cloud database (profile metadata).
 */
export async function savePersonalAiConfig(
  session: AppSessionContext,
  apiKey: string,
  model: GeminiModelId = 'gemini-2.5-flash'
): Promise<void> {
  const profileId = session.profile.id;
  const cleanKey = apiKey.trim();

  if (cleanKey.length > 0 && !isUserVip(session)) {
    throw new Error('สิทธิ์การตั้งค่า Google Gemini API Key สงวนไว้สำหรับสมาชิกแพ็กเกจ VIP เท่านั้น');
  }

  // 1. Immediate local cache for responsive UI
  if (cleanKey.length > 5) {
    localStorage.setItem(`classcare_personal_ai_key_${profileId}`, cleanKey);
    localStorage.setItem(`classcare_personal_ai_model_${profileId}`, model);
  } else {
    localStorage.removeItem(`classcare_personal_ai_key_${profileId}`);
    localStorage.removeItem(`classcare_personal_ai_model_${profileId}`);
  }

  // 2. Permanent cloud sync to profiles.metadata (persists across all devices/machines for this user ID)
  if (isSupabaseReady && supabase) {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', profileId)
        .maybeSingle();

      const existingMeta = (prof?.metadata as Record<string, unknown>) || {};
      const updatedMeta = {
        ...existingMeta,
        personal_gemini_api_key: cleanKey.length > 5 ? cleanKey : null,
        personal_ai_model: model,
      };

      await supabase
        .from('profiles')
        .update({ metadata: updatedMeta })
        .eq('id', profileId);

      // Also attempt update on direct column if migrated
      try {
        await supabase
          .from('profiles')
          .update({
            personal_gemini_api_key: cleanKey.length > 5 ? cleanKey : null,
            personal_ai_model: model,
          })
          .eq('id', profileId);
      } catch {
        // Safe to ignore if direct column is not in DB schema yet
      }
    } catch (e) {
      console.warn('Could not update profile AI key in database:', e);
    }
  }
}

/**
 * Saves workspace-level AI Key and Model (School Shared Key).
 * Saves both to local device cache and permanently to cloud database (workspace settings).
 */
export async function saveWorkspaceAiConfig(
  session: AppSessionContext,
  apiKey: string,
  model: GeminiModelId = 'gemini-2.5-flash'
): Promise<void> {
  const workspaceId = session.workspace?.id;
  if (!workspaceId) return;
  const cleanKey = apiKey.trim();

  if (cleanKey.length > 0 && !isUserVip(session)) {
    throw new Error('สิทธิ์การตั้งค่า Google Gemini API Key ประจำโรงเรียนสงวนไว้สำหรับสมาชิกแพ็กเกจ VIP เท่านั้น');
  }

  // 1. Immediate local cache
  if (cleanKey.length > 5) {
    localStorage.setItem(`classcare_workspace_ai_key_${workspaceId}`, cleanKey);
    localStorage.setItem(`classcare_workspace_ai_model_${workspaceId}`, model);
  } else {
    localStorage.removeItem(`classcare_workspace_ai_key_${workspaceId}`);
    localStorage.removeItem(`classcare_workspace_ai_model_${workspaceId}`);
  }

  // 2. Permanent cloud sync to server-side workspace_ai_secrets vault via set_workspace_ai_key RPC
  if (isSupabaseReady && supabase) {
    try {
      const { error: rpcError } = await supabase.rpc('set_workspace_ai_key', {
        target_workspace_id: workspaceId,
        new_api_key: cleanKey.length > 5 ? cleanKey : '',
        new_model: model,
      });

      if (rpcError) {
        // Fallback if RPC not yet available
        const { data: ws } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', workspaceId)
          .maybeSingle();

        const existingSettings = (ws?.settings as Record<string, unknown>) || {};
        const updatedSettings = {
          ...existingSettings,
          gemini_api_key: cleanKey.length > 5 ? cleanKey : null,
          ai_model: model,
          is_ai_enabled: cleanKey.length > 5,
        };

        await supabase
          .from('workspaces')
          .update({ settings: updatedSettings })
          .eq('id', workspaceId);
      }
    } catch (e) {
      console.warn('Could not update workspace AI key in database:', e);
    }
  }
}

/**
 * Deletes workspace-level AI Key (removes from device and cloud).
 */
export async function deleteWorkspaceAiConfig(session: AppSessionContext): Promise<void> {
  await saveWorkspaceAiConfig(session, '', 'gemini-2.5-flash');
}

/**
 * Deletes personal AI Key (removes from device and cloud).
 */
export async function deletePersonalAiConfig(session: AppSessionContext): Promise<void> {
  await savePersonalAiConfig(session, '', 'gemini-2.5-flash');
}

/**
 * Superadmin function to inject/grant an AI Key to a workspace.
 */
export async function superadminGrantWorkspaceAiKey(
  targetWorkspaceId: string,
  apiKey: string,
  model: GeminiModelId = 'gemini-2.5-flash'
): Promise<void> {
  const cleanKey = apiKey.trim();
  localStorage.setItem(`classcare_workspace_ai_key_${targetWorkspaceId}`, cleanKey);
  localStorage.setItem(`classcare_workspace_ai_model_${targetWorkspaceId}`, model);

  if (isSupabaseReady && supabase) {
    try {
      await supabase.rpc('set_workspace_ai_key', {
        target_workspace_id: targetWorkspaceId,
        new_api_key: cleanKey,
        new_model: model,
      });
    } catch {
      // Ignored if RPC doesn't exist
    }
  }
}
