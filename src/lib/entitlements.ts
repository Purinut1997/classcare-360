import type { ModuleKey, PlanCode, SubscriptionSummary } from '../types/core';

const freeModules: ModuleKey[] = ['payment', 'support'];

const trialModules: ModuleKey[] = ['dashboard', 'students', 'attendance', 'reports', 'payment', 'support'];

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
  FREE_LOGIN: 'Free Login',
  TRIAL_30: 'ทดลองใช้งาน 30 วัน',
  VIP_YEARLY: 'ClassCare 360 VIP',
};

export function getEnabledModules(planCode: PlanCode): ModuleKey[] {
  if (planCode === 'FREE_LOGIN') return freeModules;
  if (planCode === 'TRIAL_30') return trialModules;
  return vipModules;
}

export function isSubscriptionActive(subscription: SubscriptionSummary | null) {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trial';
}

export function canUseModule(subscription: SubscriptionSummary | null, moduleKey: ModuleKey) {
  if (!subscription) return false;
  if (!isSubscriptionActive(subscription) && !freeModules.includes(moduleKey)) return false;
  return getEnabledModules(subscription.planCode).includes(moduleKey);
}

export function getEntitlementSummary(subscription: SubscriptionSummary | null) {
  if (!subscription) {
    return {
      label: 'ยังไม่มีแพ็กเกจ',
      activeModules: 0,
      isActive: false,
    };
  }

  return {
    label: planLabels[subscription.planCode],
    activeModules: getEnabledModules(subscription.planCode).length,
    isActive: isSubscriptionActive(subscription),
  };
}
