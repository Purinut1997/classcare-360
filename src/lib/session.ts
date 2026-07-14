import { useEffect, useMemo, useState } from 'react';

import { demoModeQueryKey, getDemoSession } from './auth';
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

interface UseAppSessionResult {
  error: string | null;
  isDemoMode: boolean;
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

function getStoredActiveWorkspaceId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(activeWorkspaceStorageKey);
}

export function setStoredActiveWorkspaceId(workspaceId: string | null) {
  if (typeof window === 'undefined') return;

  if (workspaceId) {
    window.localStorage.setItem(activeWorkspaceStorageKey, workspaceId);
  } else {
    window.localStorage.removeItem(activeWorkspaceStorageKey);
  }
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

  if (superadminProfile) {
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('workspace_id,role,workspaces(id,name,school_name,academic_year,settings)')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<MembershipRow[]>();

    if (membershipError) throw membershipError;

    const storedWorkspaceId = getStoredActiveWorkspaceId();
    const membership =
      memberships?.find((item) => item.workspace_id === storedWorkspaceId) ||
      memberships?.find((item) => item.workspaces) ||
      null;

    if (!membership?.workspaces) {
      setStoredActiveWorkspaceId(null);
      return {
        profile: {
          ...baseProfile,
          role: 'superadmin',
        },
        workspace: null,
        subscription: lifetimeVipSubscription,
      };
    }

    setStoredActiveWorkspaceId(membership.workspace_id);

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
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_memberships')
    .select('workspace_id,role,workspaces(id,name,school_name,academic_year,settings)')
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .returns<MembershipRow[]>();

  if (membershipError) throw membershipError;

  const storedWorkspaceId = getStoredActiveWorkspaceId();
  const membership =
    memberships?.find((item) => item.workspace_id === storedWorkspaceId) ||
    memberships?.find((item) => item.workspaces) ||
    null;

  if (!membership?.workspaces) {
    const preferredRole = getPreferredRole(profile?.metadata || null);
    setStoredActiveWorkspaceId(null);
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
    };
  }

  setStoredActiveWorkspaceId(membership.workspace_id);

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
  };
}

export function useAppSession(search: string): UseAppSessionResult {
  const demoMode = useMemo(() => new URLSearchParams(search).get(demoModeQueryKey), [search]);
  const forcedDemo = !supabase && demoMode !== null;
  const [session, setSession] = useState<AppSessionContext | null>(() =>
    !supabase || forcedDemo ? getDemoSession(demoMode) : null,
  );
  const [state, setState] = useState<SessionLoadState>(() => (!supabase || forcedDemo ? 'demo' : 'loading'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!supabase || forcedDemo) {
      setSession(getDemoSession(demoMode));
      setState('demo');
      setError(null);
      return undefined;
    }

    async function loadSession() {
      setState('loading');
      setError(null);

      try {
        const nextSession = await resolveSupabaseSession();
        if (!isMounted) return;
        setSession(nextSession);
        setState('ready');
      } catch (loadError) {
        if (!isMounted) return;
        setSession(null);
        setState('error');
        setError(loadError instanceof Error ? loadError.message : 'โหลด session ไม่สำเร็จ');
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [demoMode, forcedDemo]);

  return {
    error,
    isDemoMode: !supabase || forcedDemo,
    session,
    state,
  };
}
