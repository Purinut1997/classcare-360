import type { ModuleKey, PlanCode, SubscriptionSummary } from '../types/core';

const freeModules: ModuleKey[] = ['dashboard', 'students', 'attendance', 'payment', 'support'];

const trialModules: ModuleKey[] = [
  'dashboard',
  'students',
  'attendance',
  'scores',
  'savings',
  'behavior',
  'student_care',
  'home_visits',
  'reports',
  'import_export',
  'notifications',
  'parent_portal',
  'student_portal',
  'google_drive_cold_storage',
  'teacher_backup',
  'classroom_randomizer',
  'payment',
  'support',
];

const vipModules: ModuleKey[] = [
  'dashboard',
  'students',
  'attendance',
  'scores',
  'savings',
  'behavior',
  'student_care',
  'home_visits',
  'reports',
  'import_export',
  'notifications',
  'parent_portal',
  'student_portal',
  'google_drive_cold_storage',
  'teacher_backup',
  'classroom_randomizer',
  'payment',
  'support',
];

export const planLabels: Record<PlanCode, string> = {
  FREE_LOGIN: 'ClassCare 360 Free',
  TRIAL_30: 'ทดลองใช้งาน',
  VIP_YEARLY: 'ClassCare 360 VIP',
};

export const planLimits: Record<PlanCode, { activeClassrooms: number; activeStudents: number; collaborators: number }> = {
  FREE_LOGIN: { activeClassrooms: 1, activeStudents: 40, collaborators: 1 },
  TRIAL_30: { activeClassrooms: 10, activeStudents: 500, collaborators: 10 },
  VIP_YEARLY: { activeClassrooms: 100, activeStudents: 5000, collaborators: 100 },
};

export function getWorkspaceLimitErrorMessage(message: string, planCode: PlanCode) {
  const limits = planLimits[planCode];
  if (message.includes('workspace_student_limit_reached')) {
    return `ใช้โควตานักเรียน active ครบ ${limits.activeStudents} คนตามแพ็กเกจ ${planLabels[planCode]} แล้ว`;
  }
  if (message.includes('workspace_classroom_limit_reached')) {
    return `ใช้โควตาห้อง active ครบ ${limits.activeClassrooms} ห้องตามแพ็กเกจ ${planLabels[planCode]} แล้ว`;
  }
  if (message.includes('workspace_collaborator_limit_reached')) {
    return `ใช้โควตาผู้ร่วมงานครบ ${limits.collaborators} คนตามแพ็กเกจ ${planLabels[planCode]} แล้ว`;
  }
  return message;
}

export function getEnabledModules(planCode: PlanCode): ModuleKey[] {
  if (planCode === 'FREE_LOGIN') return freeModules;
  if (planCode === 'TRIAL_30') return trialModules;
  return vipModules;
}

export function isSubscriptionActive(subscription: SubscriptionSummary | null) {
  if (!subscription) return false;
  if (subscription.status !== 'active' && subscription.status !== 'trial') return false;
  return !subscription.endsAt || new Date(subscription.endsAt).getTime() > Date.now();
}

export function getEffectivePlanCode(subscription: SubscriptionSummary | null): PlanCode {
  return subscription && isSubscriptionActive(subscription) ? subscription.planCode : 'FREE_LOGIN';
}

export function canUseModule(subscription: SubscriptionSummary | null, moduleKey: ModuleKey) {
  return getEnabledModules(getEffectivePlanCode(subscription)).includes(moduleKey);
}

export function getEntitlementSummary(subscription: SubscriptionSummary | null) {
  if (!subscription) {
    return {
      label: planLabels.FREE_LOGIN,
      activeModules: freeModules.length,
      isActive: true,
    };
  }

  const isActive = isSubscriptionActive(subscription);
  const effectivePlan = getEffectivePlanCode(subscription);
  return {
    label: isActive ? planLabels[effectivePlan] : `${planLabels.FREE_LOGIN} (สิทธิ์เดิมหมดอายุ)`,
    activeModules: getEnabledModules(effectivePlan).length,
    isActive: true,
  };
}
