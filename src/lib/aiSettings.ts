import { supabase, isSupabaseReady } from './supabaseClient';
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
  if (!session) return false;
  if (session.profile?.role === 'superadmin') return true;
  return session.subscription?.planCode === 'VIP_YEARLY';
}

/**
 * Resolves the effective AI Key and Model following the priority hierarchy:
 * 1. Personal Key (if configured by user or granted by superadmin)
 * 2. Workspace School Key (if configured by workspace owner or granted by superadmin)
 * 3. None (fallback knowledge engine)
 */
export async function getEffectiveAiConfig(session: AppSessionContext | null | undefined): Promise<EffectiveAiConfig> {
  const isVip = isUserVip(session);
  const isSuperadmin = session?.profile?.role === 'superadmin';
  const isWorkspaceOwner = session?.profile?.role === 'teacher_owner';

  const result: EffectiveAiConfig = {
    apiKey: null,
    model: 'gemini-1.5-flash',
    source: 'none',
    isVip,
    canConfigureWorkspace: isSuperadmin || (isVip && isWorkspaceOwner),
    canConfigurePersonal: isSuperadmin || isVip,
  };

  if (!session) return result;

  const workspaceId = session.workspace?.id;
  const profileId = session.profile?.id;

  // 1. Check Personal Key from local cache first
  const cachedPersonalKey = localStorage.getItem(`classcare_personal_ai_key_${profileId}`);
  const cachedPersonalModel = localStorage.getItem(`classcare_personal_ai_model_${profileId}`) as GeminiModelId | null;

  if (cachedPersonalKey && cachedPersonalKey.trim().length > 10) {
    result.apiKey = cachedPersonalKey.trim();
    result.model = cachedPersonalModel || 'gemini-1.5-flash';
    result.source = 'personal';
    return result;
  }

  // 2. Check Workspace Key from local cache
  const cachedWorkspaceKey = workspaceId ? localStorage.getItem(`classcare_workspace_ai_key_${workspaceId}`) : null;
  const cachedWorkspaceModel = workspaceId ? (localStorage.getItem(`classcare_workspace_ai_model_${workspaceId}`) as GeminiModelId | null) : null;

  if (cachedWorkspaceKey && cachedWorkspaceKey.trim().length > 10) {
    result.apiKey = cachedWorkspaceKey.trim();
    result.model = cachedWorkspaceModel || 'gemini-1.5-flash';
    result.source = 'workspace';
    return result;
  }

  // 3. If Supabase is available, query database
  if (isSupabaseReady && supabase) {
    try {
      // Check personal key from profiles table
      if (profileId) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('personal_gemini_api_key, personal_ai_model')
          .eq('id', profileId)
          .single();

        if (profData?.personal_gemini_api_key) {
          result.apiKey = profData.personal_gemini_api_key;
          result.model = (profData.personal_ai_model as GeminiModelId) || 'gemini-1.5-flash';
          result.source = 'personal';
          localStorage.setItem(`classcare_personal_ai_key_${profileId}`, profData.personal_gemini_api_key);
          return result;
        }
      }

      // Check workspace key from workspaces table
      if (workspaceId) {
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('gemini_api_key, ai_model, is_ai_enabled')
          .eq('id', workspaceId)
          .single();

        if (wsData?.gemini_api_key && wsData.is_ai_enabled !== false) {
          result.apiKey = wsData.gemini_api_key;
          result.model = (wsData.ai_model as GeminiModelId) || 'gemini-1.5-flash';
          result.source = 'workspace';
          localStorage.setItem(`classcare_workspace_ai_key_${workspaceId}`, wsData.gemini_api_key);
          return result;
        }
      }
    } catch {
      // Table columns may still be pending migration; local storage fallback works seamlessly
    }
  }

  return result;
}

/**
 * Saves personal AI Key and Model for a teacher.
 */
export async function savePersonalAiConfig(
  session: AppSessionContext,
  apiKey: string,
  model: GeminiModelId = 'gemini-1.5-flash'
): Promise<void> {
  const profileId = session.profile.id;
  localStorage.setItem(`classcare_personal_ai_key_${profileId}`, apiKey.trim());
  localStorage.setItem(`classcare_personal_ai_model_${profileId}`, model);

  if (isSupabaseReady && supabase) {
    try {
      await supabase
        .from('profiles')
        .update({
          personal_gemini_api_key: apiKey.trim(),
          personal_ai_model: model,
        })
        .eq('id', profileId);
    } catch (e) {
      console.warn('Could not update profile AI key in database, saved locally:', e);
    }
  }
}

/**
 * Saves workspace-level AI Key and Model (School Shared Key).
 */
export async function saveWorkspaceAiConfig(
  session: AppSessionContext,
  apiKey: string,
  model: GeminiModelId = 'gemini-1.5-flash'
): Promise<void> {
  const workspaceId = session.workspace?.id;
  if (!workspaceId) return;

  localStorage.setItem(`classcare_workspace_ai_key_${workspaceId}`, apiKey.trim());
  localStorage.setItem(`classcare_workspace_ai_model_${workspaceId}`, model);

  if (isSupabaseReady && supabase) {
    try {
      await supabase
        .from('workspaces')
        .update({
          gemini_api_key: apiKey.trim(),
          ai_model: model,
          is_ai_enabled: true,
        })
        .eq('id', workspaceId);
    } catch (e) {
      console.warn('Could not update workspace AI key in database, saved locally:', e);
    }
  }
}

/**
 * Superadmin function to inject/grant an AI Key to a workspace.
 */
export async function superadminGrantWorkspaceAiKey(
  targetWorkspaceId: string,
  apiKey: string,
  model: GeminiModelId = 'gemini-1.5-flash'
): Promise<void> {
  localStorage.setItem(`classcare_workspace_ai_key_${targetWorkspaceId}`, apiKey.trim());
  localStorage.setItem(`classcare_workspace_ai_model_${targetWorkspaceId}`, model);

  if (isSupabaseReady && supabase) {
    await supabase.rpc('set_workspace_ai_key', {
      target_workspace_id: targetWorkspaceId,
      new_api_key: apiKey.trim(),
      new_model: model,
    });
  }
}
