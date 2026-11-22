import { isSupabaseReady, supabase } from './supabaseClient';
import { saveSchoolReportIdentity, type SchoolReportIdentity } from './scheduleSettings';

export interface ScoreRatioConfig {
  coursework: number;
  midterm: number;
  final: number;
}

const SCORE_RATIO_LOCAL_KEY = 'classcare_score_ratio';

function getWorkspaceRatioLocalKey(workspaceId: string, subjectKey?: string) {
  const subj = (subjectKey || 'default').trim().toLowerCase() || 'default';
  return `classcare_score_ratio:${workspaceId}:${subj}`;
}

export function getLocalScoreRatio(workspaceId?: string, subjectKey?: string): ScoreRatioConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    if (workspaceId) {
      const scoped = window.localStorage.getItem(getWorkspaceRatioLocalKey(workspaceId, subjectKey));
      if (scoped) return JSON.parse(scoped) as ScoreRatioConfig;
    }
    const legacy = window.localStorage.getItem(SCORE_RATIO_LOCAL_KEY);
    if (legacy) return JSON.parse(legacy) as ScoreRatioConfig;
  } catch {
    // Ignore invalid storage
  }
  return null;
}

export async function loadCloudScoreRatio(
  workspaceId: string,
  subjectKey?: string,
): Promise<ScoreRatioConfig | null> {
  if (!isSupabaseReady || !supabase || !workspaceId) return null;
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error || !data?.settings || typeof data.settings !== 'object') return null;

    const settings = data.settings as Record<string, unknown>;
    const scoreRatios = (settings.score_ratios as Record<string, ScoreRatioConfig> | undefined) || {};
    const subj = (subjectKey || 'default').trim() || 'default';
    const matched = scoreRatios[subj] || scoreRatios.default || null;
    if (matched && typeof matched.coursework === 'number') {
      try {
        window.localStorage.setItem(getWorkspaceRatioLocalKey(workspaceId, subjectKey), JSON.stringify(matched));
        window.localStorage.setItem(SCORE_RATIO_LOCAL_KEY, JSON.stringify(matched));
      } catch {
        // ignore storage errors
      }
      return matched;
    }
  } catch {
    // Non-blocking cloud fallback
  }
  return null;
}

export async function saveCloudScoreRatio(
  workspaceId: string,
  subjectKey: string | undefined,
  ratio: ScoreRatioConfig,
): Promise<boolean> {
  try {
    window.localStorage.setItem(SCORE_RATIO_LOCAL_KEY, JSON.stringify(ratio));
    if (workspaceId) {
      window.localStorage.setItem(getWorkspaceRatioLocalKey(workspaceId, subjectKey), JSON.stringify(ratio));
    }
  } catch {
    // ignore storage errors
  }

  if (!isSupabaseReady || !supabase || !workspaceId) return false;
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .maybeSingle();

    const currentSettings = (data?.settings as Record<string, unknown>) || {};
    const currentRatios = (currentSettings.score_ratios as Record<string, ScoreRatioConfig>) || {};
    const key = (subjectKey || 'default').trim() || 'default';
    const nextSettings = {
      ...currentSettings,
      score_ratios: {
        ...currentRatios,
        [key]: ratio,
        default: ratio,
      },
    };

    const { error } = await supabase
      .from('workspaces')
      .update({ settings: nextSettings })
      .eq('id', workspaceId);

    return !error;
  } catch {
    return false;
  }
}

export async function saveCloudReportIdentity(
  workspaceId: string,
  identity: SchoolReportIdentity,
): Promise<boolean> {
  saveSchoolReportIdentity(identity, workspaceId);
  if (!isSupabaseReady || !supabase || !workspaceId) return false;

  try {
    const { data } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .maybeSingle();

    const currentSettings = (data?.settings as Record<string, unknown>) || {};
    const nextSettings = {
      ...currentSettings,
      classroom_name: identity.classroomName,
      report_identity: identity,
    };

    const { error } = await supabase
      .from('workspaces')
      .update({
        academic_year: identity.academicYear,
        school_name: identity.schoolName,
        settings: nextSettings,
      })
      .eq('id', workspaceId);

    return !error;
  } catch {
    return false;
  }
}

export async function hydrateHiddenClassroomsFromCloud(
  profileId: string,
  workspaceId: string,
): Promise<string[] | null> {
  if (!isSupabaseReady || !supabase || !profileId || !workspaceId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', profileId)
      .maybeSingle();
    if (error || !data?.metadata || typeof data.metadata !== 'object') return null;
    const meta = data.metadata as Record<string, unknown>;
    const byWs = (meta.hidden_classrooms_by_workspace as Record<string, unknown> | undefined) || {};
    const list = byWs[workspaceId];
    if (!Array.isArray(list)) return null;
    const clean = list.filter((id): id is string => typeof id === 'string');
    try {
      window.localStorage.setItem(`classcare:hidden_empty_classrooms:${workspaceId}`, JSON.stringify(clean));
    } catch {
      // ignore
    }
    return clean;
  } catch {
    return null;
  }
}

export async function syncHiddenClassroomsToCloud(
  profileId: string,
  workspaceId: string,
  hiddenIds: string[],
): Promise<boolean> {
  if (!isSupabaseReady || !supabase || !profileId || !workspaceId) return false;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', profileId)
      .maybeSingle();

    const currentMeta = (data?.metadata as Record<string, unknown>) || {};
    const byWs = (currentMeta.hidden_classrooms_by_workspace as Record<string, unknown>) || {};
    const nextMeta = {
      ...currentMeta,
      hidden_classrooms_by_workspace: {
        ...byWs,
        [workspaceId]: hiddenIds,
      },
    };

    const { error } = await supabase
      .from('profiles')
      .update({ metadata: nextMeta })
      .eq('id', profileId);
    return !error;
  } catch {
    return false;
  }
}
