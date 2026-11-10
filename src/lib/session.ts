import { useCallback, useEffect, useMemo, useState } from 'react';

import { demoModeQueryKey, demoWorkspaceQueryKey, getDemoSession } from './auth';
import { supabase } from './supabaseClient';
import type {
  AccountStatus,
  AppSessionContext,
  PlanCode,
  SubscriptionStatus,
  WorkspaceRole,
} from '../types/core';

type SessionLoadState = 'demo' | 'loading' | 'ready' | 'error';

export const activeWorkspaceStorageKey = 'classcare360.activeWorkspaceId';
const sessionRefreshEvent = 'classcare:session-refresh';

export function requestAppSessionRefresh() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(sessionRefreshEvent));
}

interface UseAppSessionResult {
  error: string | null;
  isDemoMode: boolean;
  retry: () => void;
  session: AppSessionContext | null;
  state: SessionLoadState;
}

interface ProfileRow {
  account_status: AccountStatus;
  display_name: string | null;
  email: string;
  id: string;
  metadata: {
    preferred_role?: WorkspaceRole;
    school_name?: string;
  } | null;
}

interface MembershipRow {
  permissions: Record<string, boolean> | null;
  role: Exclude<WorkspaceRole, 'superadmin'>;
  workspace_id: string;
  workspaces: {
    academic_year: string | null;
    id: string;
    name: string;
    school_name: string | null;
    settings: {
      classroom_name?: string;
    } | null;
  } | null;
}

interface SubscriptionRow {
  ends_at: string | null;
  plans: {
    code: PlanCode;
  } | null;
  status: SubscriptionStatus;
}

interface WorkspacePreferenceRow {
  last_active_workspace_id: string | null;
  primary_workspace_id: string | null;
}

const defaultSubscription = {
  planCode: 'FREE_LOGIN' as const,
  status: 'active' as const,
  endsAt: null,
};

const lifetimeVipSubscription = {
  planCode: 'VIP_YEARLY' as const,
  status: 'active' as const,
  endsAt: null,
};

function getActiveWorkspaceStorageKey(profileId: string) {
  return `${activeWorkspaceStorageKey}.${profileId}`;
}

function getStoredActiveWorkspaceId(profileId: string) {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem(getActiveWorkspaceStorageKey(profileId)) ||
    window.localStorage.getItem(activeWorkspaceStorageKey)
  );
}

export function setStoredActiveWorkspaceId(workspaceId: string | null, profileId?: string | null) {
  if (typeof window === 'undefined') return;

  const storageKey = profileId ? getActiveWorkspaceStorageKey(profileId) : activeWorkspaceStorageKey;

  if (workspaceId) {
    window.localStorage.setItem(storageKey, workspaceId);
  } else {
    window.localStorage.removeItem(storageKey);
  }

  if (profileId) window.localStorage.removeItem(activeWorkspaceStorageKey);
}

export async function activateWorkspace(profileId: string, workspaceId: string) {
  setStoredActiveWorkspaceId(workspaceId, profileId);
  if (!supabase) return;

  const { error } = await supabase.rpc('set_active_workspace', {
    target_workspace_id: workspaceId,
  });
  if (error) throw error;
}

function getMetadataName(metadata: Record<string, unknown> | undefined) {
  const displayName = metadata?.display_name || metadata?.full_name || metadata?.name;
  return typeof displayName === 'string' ? displayName : null;
}

function getProfileSchoolName(metadata: ProfileRow['metadata']) {
  const schoolName = metadata?.school_name;
  return typeof schoolName === 'string' && schoolName.trim() ? schoolName.trim() : null;
}

function getPreferredRole(metadata: ProfileRow['metadata']): WorkspaceRole {
  const preferredRole = metadata?.preferred_role;
  if (
    preferredRole === 'teacher_owner' ||
    preferredRole === 'teacher_member' ||
    preferredRole === 'parent' ||
    preferredRole === 'student' ||
    preferredRole === 'viewer'
  ) {
    return preferredRole;
  }

  return 'teacher_owner';
}

async function resolveSupabaseSession(): Promise<AppSessionContext | null> {
  if (!supabase) return null;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.user) return null;

  const { user } = session;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,display_name,account_status,metadata')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) throw profileError;

  const fallbackName = getMetadataName(user.user_metadata) || user.email || 'ผู้ใช้ ClassCare 360';
  const baseProfile = {
    id: user.id,
    email: profile?.email || user.email || '',
    displayName: profile?.display_name || fallbackName,
    accountStatus: profile?.account_status || ('registered' as const),
    needsProfile: !profile,
    schoolName: getProfileSchoolName(profile?.metadata || null),
  };

  const { data: superadminProfile, error: superadminError } = await supabase
    .from('superadmin_profiles')
    .select('profile_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (superadminError) throw superadminError;

  const { data: workspacePreference, error: preferenceError } = await supabase
    .from('profile_workspace_preferences')
    .select('primary_workspace_id,last_active_workspace_id')
    .eq('profile_id', user.id)
    .maybeSingle<WorkspacePreferenceRow>();
  // Workspace preferences only remember the last selected workspace. They are
  // not an access grant, so a missing/temporarily unreadable preference row
  // must not block an existing user from signing in. Memberships below remain
  // the source of truth for workspace access.
  const resolvedWorkspacePreference = preferenceError ? null : workspacePreference;

  if (superadminProfile) {
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('workspace_id,role,permissions,workspaces(id,name,school_name,academic_year,settings)')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<MembershipRow[]>();

    if (membershipError) throw membershipError;

    const storedWorkspaceId = getStoredActiveWorkspaceId(user.id);
    let membership =
      memberships?.find((item) => item.workspace_id === storedWorkspaceId) ||
      memberships?.find((item) => item.workspace_id === resolvedWorkspacePreference?.last_active_workspace_id) ||
      memberships?.find((item) => item.workspace_id === resolvedWorkspacePreference?.primary_workspace_id) ||
      memberships?.find((item) => item.workspaces) ||
      null;

    const requestedWorkspaceId =
      storedWorkspaceId || resolvedWorkspacePreference?.last_active_workspace_id || resolvedWorkspacePreference?.primary_workspace_id;
    if (!membership && requestedWorkspaceId) {
      const { data: targetWorkspace, error: targetWorkspaceError } = await supabase
        .from('workspaces')
        .select('id,name,school_name,academic_year,settings')
        .eq('id', requestedWorkspaceId)
        .is('archived_at', null)
        .maybeSingle<MembershipRow['workspaces']>();

      if (targetWorkspaceError) throw targetWorkspaceError;
      if (targetWorkspace) {
        membership = {
          permissions: {},
          role: 'teacher_owner',
          workspace_id: targetWorkspace.id,
          workspaces: targetWorkspace,
        };
      }
    }

    if (!membership?.workspaces) {
      setStoredActiveWorkspaceId(null, user.id);
      return {
        profile: {
          ...baseProfile,
          role: 'superadmin',
        },
        workspace: null,
        subscription: lifetimeVipSubscription,
        primaryWorkspaceId: resolvedWorkspacePreference?.primary_workspace_id || null,
        workspaceCount: memberships?.length || 0,
      };
    }

    setStoredActiveWorkspaceId(membership.workspace_id, user.id);

    return {
      profile: {
        ...baseProfile,
        role: 'superadmin',
      },
      workspace: {
        id: membership.workspaces.id,
        name: membership.workspaces.name,
        schoolName: membership.workspaces.school_name || 'ยังไม่ได้ระบุโรงเรียน',
        academicYear: membership.workspaces.academic_year || 'ยังไม่ได้ระบุปีการศึกษา',
        classroomName: membership.workspaces.settings?.classroom_name || 'ยังไม่ได้ระบุห้องเรียน',
      },
      subscription: lifetimeVipSubscription,
    primaryWorkspaceId: resolvedWorkspacePreference?.primary_workspace_id || membership.workspace_id,
      workspaceCount: memberships?.length || 0,
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_memberships')
    .select('workspace_id,role,permissions,workspaces(id,name,school_name,academic_year,settings)')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .returns<MembershipRow[]>();

  if (membershipError) throw membershipError;

  const storedWorkspaceId = getStoredActiveWorkspaceId(user.id);
  const membership =
    memberships?.find((item) => item.workspace_id === storedWorkspaceId) ||
    memberships?.find((item) => item.workspace_id === resolvedWorkspacePreference?.last_active_workspace_id) ||
    memberships?.find((item) => item.workspace_id === resolvedWorkspacePreference?.primary_workspace_id) ||
    memberships?.find((item) => item.workspaces) ||
    null;

  if (!membership?.workspaces) {
    const preferredRole = getPreferredRole(profile?.metadata || null);
    setStoredActiveWorkspaceId(null, user.id);
    return {
      profile: {
        ...baseProfile,
        role: preferredRole,
      },
      workspace: null,
      subscription:
        preferredRole === 'parent' || preferredRole === 'student' || preferredRole === 'viewer'
          ? defaultSubscription
          : {
              planCode: 'TRIAL_30',
              status: 'trial',
              endsAt: null,
            },
      primaryWorkspaceId: resolvedWorkspacePreference?.primary_workspace_id || null,
      workspaceCount: memberships?.length || 0,
    };
  }

  setStoredActiveWorkspaceId(membership.workspace_id, user.id);

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('status,ends_at,plans(code)')
    .eq('workspace_id', membership.workspace_id)
    .in('status', ['trial', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  if (subscriptionError) throw subscriptionError;

  return {
    permissions: membership.permissions || {},
    profile: {
      ...baseProfile,
      role: membership.role,
    },
    workspace: {
      id: membership.workspaces.id,
      name: membership.workspaces.name,
      schoolName: membership.workspaces.school_name || 'ยังไม่ได้ระบุโรงเรียน',
      academicYear: membership.workspaces.academic_year || 'ยังไม่ได้ระบุปีการศึกษา',
      classroomName: membership.workspaces.settings?.classroom_name || 'ยังไม่ได้ระบุห้องเรียน',
    },
    subscription: subscription?.plans
      ? {
          planCode: subscription.plans.code,
          status: subscription.status,
          endsAt: subscription.ends_at,
        }
      : defaultSubscription,
    primaryWorkspaceId: resolvedWorkspacePreference?.primary_workspace_id || membership.workspace_id,
    workspaceCount: memberships?.length || 0,
  };
}

export function useAppSession(search: string): UseAppSessionResult {
  const demoSelection = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      mode: params.get(demoModeQueryKey),
      workspaceId: params.get(demoWorkspaceQueryKey),
    };
  }, [search]);
  const demoMode = demoSelection.mode;
  const demoWorkspaceId = demoSelection.workspaceId;
  const forcedDemo = import.meta.env.DEV && demoMode !== null;
  const [session, setSession] = useState<AppSessionContext | null>(() =>
    !supabase || forcedDemo ? getDemoSession(demoMode, demoWorkspaceId) : null,
  );
  const [state, setState] = useState<SessionLoadState>(() => (!supabase || forcedDemo ? 'demo' : 'loading'));
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setState('loading');
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let hasResolvedSession = false;

    if (!supabase || forcedDemo) {
      setSession(getDemoSession(demoMode, demoWorkspaceId));
      setState('demo');
      setError(null);
      return undefined;
    }

    async function loadSession(isBackground = false) {
      if (!isBackground) {
        setState('loading');
      }
      setError(null);

      try {
        const nextSession = await resolveSupabaseSession();
        if (!isMounted) return;
        hasResolvedSession = true;
        setSession(nextSession);
        setState('ready');
      } catch (loadError) {
        if (!isMounted) return;
        // A failed initial auth/profile lookup must leave a recoverable error
        // state. Background refresh failures after a successful load should not
        // tear down a teacher's active screen.
        if (!isBackground || !hasResolvedSession) {
          setSession(null);
          setState('error');
          setError(loadError instanceof Error ? loadError.message : 'โหลด session ไม่สำเร็จ');
        }
      }
    }

    void loadSession(false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setState('ready');
        return;
      }
      if (event === 'TOKEN_REFRESHED') {
        // Token refreshed silently in background — do NOT unmount the app or reset UI
        return;
      }
      void loadSession(true);
    });

    const handleSessionRefresh = () => {
      void loadSession(true);
    };
    window.addEventListener(sessionRefreshEvent, handleSessionRefresh);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener(sessionRefreshEvent, handleSessionRefresh);
    };
  }, [demoMode, demoWorkspaceId, forcedDemo, retryCount]);

  return {
    error,
    isDemoMode: !supabase || forcedDemo,
    retry,
    session,
    state,
  };
}

export function getSessionLoadErrorMessage(rawError?: string | null) {
  const message = (rawError || '').toLowerCase();

  if (/failed to fetch|fetch failed|network error|load failed|timeout|timed out/.test(message)) {
    return 'เชื่อมต่อบริการบัญชีไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
  }
  if (/refresh token|jwt expired|invalid.*token|session.*expired/.test(message)) {
    return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ แล้วลองเปิดหน้านี้อีกครั้ง';
  }
  if (/pgrst205|42p01|schema cache|does not exist/.test(message)) {
    return 'ข้อมูลบัญชีบางส่วนยังอัปเดตไม่ครบ กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้ผู้ดูแลตรวจการอัปเดตระบบ';
  }

  return 'ตรวจสอบบัญชีและสิทธิ์การใช้งานไม่สำเร็จ กรุณาลองอีกครั้ง';
}
