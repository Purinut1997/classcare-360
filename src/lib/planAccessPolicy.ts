import { useEffect, useState } from 'react';
import { getEffectivePlanCode, isLifetimeVip } from './entitlements';
import { SYSTEM_MAINTENANCE_MODULES, type ManagedSystemModule } from './moduleMaintenance';
import { supabase } from './supabaseClient';
import type { AppSessionContext, ModuleKey } from '../types/core';

export type ConfigurableTierKey = 'free' | 'trial' | 'temp_vip';
export type UserAccessTier = ConfigurableTierKey | 'lifetime_vip' | 'superadmin';

export interface TierAccessPolicy {
  tierKey: ConfigurableTierKey;
  allowedViews: string[];
  allowAiGemini: boolean;
  updatedAt: string | null;
}

export type PlanAccessPolicyMap = Record<ConfigurableTierKey, TierAccessPolicy>;

/**
 * Modules configurable per tier (workspace-settings is excluded so every user can always
 * manage their own profile/password and never lock themselves out).
 */
export const PLAN_ACCESS_MANAGED_VIEWS: ManagedSystemModule[] = SYSTEM_MAINTENANCE_MODULES.filter(
  (m) => m.key !== 'workspace-settings',
);

export const ALL_CONFIGURABLE_VIEW_KEYS: string[] = PLAN_ACCESS_MANAGED_VIEWS.map((m) => m.key);

export const FREE_DEFAULT_VIEWS: string[] = [
  'students',
  'teacher-work',
  'student-health',
  'schedule',
  'school-calendar',
  'data-safety',
  'academic-year',
];

export const DEFAULT_PLAN_ACCESS_POLICIES: PlanAccessPolicyMap = {
  free: {
    tierKey: 'free',
    allowedViews: [...FREE_DEFAULT_VIEWS],
    allowAiGemini: false,
    updatedAt: null,
  },
  trial: {
    tierKey: 'trial',
    allowedViews: [...ALL_CONFIGURABLE_VIEW_KEYS],
    allowAiGemini: false,
    updatedAt: null,
  },
  temp_vip: {
    tierKey: 'temp_vip',
    allowedViews: [...ALL_CONFIGURABLE_VIEW_KEYS],
    allowAiGemini: true,
    updatedAt: null,
  },
};

const CORE_ALWAYS_ALLOWED_VIEWS = new Set([
  'overview',
  'system-overview',
  'workspace-settings',
  'help-center',
  'package',
  'workspace-switch',
  'superadmin-dashboard',
  'setup',
  'audit',
]);

const VIEW_ALIASES: Record<string, string> = {
  'period-locks': 'academic-year',
  automation: 'notifications',
  'parent-access': 'students',
};

const CACHE_KEY = 'classcare.plan_access_policies.v1';

function readCachedPolicies(): PlanAccessPolicyMap {
  if (typeof window === 'undefined') return DEFAULT_PLAN_ACCESS_POLICIES;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_PLAN_ACCESS_POLICIES;
    const parsed = JSON.parse(raw) as Partial<PlanAccessPolicyMap>;
    return {
      free: parsed.free?.allowedViews ? parsed.free : DEFAULT_PLAN_ACCESS_POLICIES.free,
      trial: parsed.trial?.allowedViews ? parsed.trial : DEFAULT_PLAN_ACCESS_POLICIES.trial,
      temp_vip: parsed.temp_vip?.allowedViews ? parsed.temp_vip : DEFAULT_PLAN_ACCESS_POLICIES.temp_vip,
    };
  } catch {
    return DEFAULT_PLAN_ACCESS_POLICIES;
  }
}

function writeCachedPolicies(map: PlanAccessPolicyMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

let currentPolicies: PlanAccessPolicyMap = readCachedPolicies();
let hasFetchedOnce = false;
let realtimeBound = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function getCurrentPlanAccessPolicies(): PlanAccessPolicyMap {
  return currentPolicies;
}

export async function loadPlanAccessPolicies(force = false): Promise<PlanAccessPolicyMap> {
  if (!supabase) return currentPolicies;
  if (hasFetchedOnce && !force) return currentPolicies;

  try {
    const { data, error } = await supabase
      .from('plan_access_policies')
      .select('tier_key, allowed_views, allow_ai_gemini, updated_at');

    if (error || !data || data.length === 0) {
      hasFetchedOnce = true;
      return currentPolicies;
    }

    const next: PlanAccessPolicyMap = {
      free: { ...DEFAULT_PLAN_ACCESS_POLICIES.free },
      trial: { ...DEFAULT_PLAN_ACCESS_POLICIES.trial },
      temp_vip: { ...DEFAULT_PLAN_ACCESS_POLICIES.temp_vip },
    };

    for (const row of data as Array<{
      tier_key: ConfigurableTierKey;
      allowed_views: string[] | null;
      allow_ai_gemini: boolean | null;
      updated_at: string | null;
    }>) {
      if (row.tier_key === 'free' || row.tier_key === 'trial' || row.tier_key === 'temp_vip') {
        next[row.tier_key] = {
          tierKey: row.tier_key,
          allowedViews: Array.isArray(row.allowed_views) ? row.allowed_views : [],
          allowAiGemini: Boolean(row.allow_ai_gemini),
          updatedAt: row.updated_at || null,
        };
      }
    }

    currentPolicies = next;
    hasFetchedOnce = true;
    writeCachedPolicies(next);
    notifyListeners();
    return next;
  } catch {
    hasFetchedOnce = true;
    return currentPolicies;
  }
}

function ensureRealtimeSubscription() {
  if (realtimeBound || !supabase) return;
  realtimeBound = true;
  try {
    supabase
      .channel('plan-access-policies-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_access_policies' },
        () => {
          void loadPlanAccessPolicies(true);
        },
      )
      .subscribe();
  } catch {
    // Non-blocking if realtime channel fails
  }
}

export function usePlanAccessPolicies(): PlanAccessPolicyMap {
  const [policies, setPolicies] = useState<PlanAccessPolicyMap>(() => currentPolicies);

  useEffect(() => {
    const onChange = () => setPolicies(currentPolicies);
    listeners.add(onChange);
    ensureRealtimeSubscription();
    void loadPlanAccessPolicies(false);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return policies;
}

export async function savePlanAccessPolicy(
  tierKey: ConfigurableTierKey,
  allowedViews: string[],
  allowAiGemini: boolean,
): Promise<TierAccessPolicy> {
  if (!supabase) {
    const updated: TierAccessPolicy = {
      tierKey,
      allowedViews,
      allowAiGemini,
      updatedAt: new Date().toISOString(),
    };
    currentPolicies = { ...currentPolicies, [tierKey]: updated };
    writeCachedPolicies(currentPolicies);
    notifyListeners();
    return updated;
  }

  const { data, error } = await supabase.rpc('superadmin_save_plan_access_policy', {
    p_tier_key: tierKey,
    p_allowed_views: allowedViews,
    p_allow_ai_gemini: allowAiGemini,
  });

  if (error) {
    throw new Error(error.message || 'บันทึกสิทธิ์แพ็กเกจไม่สำเร็จ');
  }

  const payload = (data || {}) as {
    tier_key?: ConfigurableTierKey;
    allowed_views?: string[];
    allow_ai_gemini?: boolean;
    updated_at?: string;
  };

  const updated: TierAccessPolicy = {
    tierKey,
    allowedViews: Array.isArray(payload.allowed_views) ? payload.allowed_views : allowedViews,
    allowAiGemini: typeof payload.allow_ai_gemini === 'boolean' ? payload.allow_ai_gemini : allowAiGemini,
    updatedAt: payload.updated_at || new Date().toISOString(),
  };

  currentPolicies = { ...currentPolicies, [tierKey]: updated };
  writeCachedPolicies(currentPolicies);
  notifyListeners();
  return updated;
}

export function getUserAccessTier(session: AppSessionContext | null | undefined): UserAccessTier {
  if (!session) return 'free';
  if (session.profile.role === 'superadmin') return 'superadmin';
  if (isLifetimeVip(session.subscription, session.profile.role)) return 'lifetime_vip';
  const effectivePlan = getEffectivePlanCode(session.subscription);
  if (effectivePlan === 'VIP_YEARLY') return 'temp_vip';
  if (effectivePlan === 'TRIAL_30') return 'trial';
  return 'free';
}

export function canAccessViewByPlan(
  session: AppSessionContext | null | undefined,
  viewKey?: string | null,
  _fallbackModuleKey?: ModuleKey,
  policies: PlanAccessPolicyMap = currentPolicies,
): boolean {
  if (!session) return false;
  const tier = getUserAccessTier(session);
  if (tier === 'superadmin' || tier === 'lifetime_vip') return true;
  if (!viewKey) return true;

  const normalizedKey = VIEW_ALIASES[viewKey] || viewKey;
  if (CORE_ALWAYS_ALLOWED_VIEWS.has(normalizedKey)) return true;

  const tierPolicy = policies[tier];
  if (!tierPolicy) return false;
  return tierPolicy.allowedViews.includes(normalizedKey);
}

export function canUseAiGeminiByPlan(
  session: AppSessionContext | null | undefined,
  policies: PlanAccessPolicyMap = currentPolicies,
): boolean {
  if (!session) return false;
  const tier = getUserAccessTier(session);
  if (tier === 'superadmin' || tier === 'lifetime_vip') return true;
  return Boolean(policies[tier]?.allowAiGemini);
}

export function getRequiredTierBadgeLabel(session: AppSessionContext | null | undefined): string {
  const tier = getUserAccessTier(session);
  if (tier === 'temp_vip') return 'VIP ถาวร';
  return 'VIP';
}
