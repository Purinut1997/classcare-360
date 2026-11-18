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

/**
 * Returns true if the account has permanent / lifetime VIP access (or is superadmin),
 * so upgrade/renewal VIP menus are not shown to them.
 */
export function isLifetimeVip(subscription: SubscriptionSummary | null | undefined, role?: string | null): boolean {
  if (role === 'superadmin') return true;
  if (!subscription) return false;
  if (subscription.planCode !== 'VIP_YEARLY' || subscription.status !== 'active') return false;
  if (!subscription.endsAt) return true;
  const fiftyYearsMs = 50 * 365 * 24 * 60 * 60 * 1000;
  return new Date(subscription.endsAt).getTime() - Date.now() > fiftyYearsMs;
}

/**
 * Concise Thai status subtitle for the Sidebar VIP upgrade / renewal menu.
 */
export function getVipUpgradeMeta(subscription: SubscriptionSummary | null | undefined): {
  label: string;
  subtitle: string;
} {
  const effectivePlan = getEffectivePlanCode(subscription ?? null);
  if (effectivePlan === 'VIP_YEARLY' && subscription?.endsAt) {
    const endsDate = new Date(subscription.endsAt);
    const valid = !Number.isNaN(endsDate.getTime());
    const daysLeft = valid
      ? Math.max(1, Math.ceil((endsDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;
    const formatted = !valid
      ? 'มีกำหนดหมดอายุ'
      : new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(endsDate);
    return {
      label: 'ต่ออายุ VIP',
      subtitle: daysLeft !== null ? `เหลือ ${daysLeft.toLocaleString('th-TH')} วัน · หมดอายุ ${formatted}` : `หมดอายุ ${formatted}`,
    };
  }
  if (effectivePlan === 'TRIAL_30' && subscription?.endsAt) {
    const daysLeft = Math.max(1, Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return { label: 'สมัคร VIP', subtitle: `ทดลองใช้ · เหลือ ${daysLeft} วัน` };
  }
  return { label: 'สมัคร VIP', subtitle: 'ปลดล็อกทุกโมดูล + AI' };
}

export interface VipBadgeInfo {
  tier: 'lifetime_vip' | 'temp_vip' | 'trial' | 'free';
  isVip: boolean;
  isLifetime: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  badgeText: string;
  daysText: string;
  shortLabel: string;
  tooltip: string;
  expiresAtLabel: string | null;
}

/**
 * Returns structured VIP badge and remaining-day metadata for Topbar, Sidebar, and Dashboard greeting.
 */
export function getVipBadgeInfo(
  subscription: SubscriptionSummary | null | undefined,
  role?: string | null,
): VipBadgeInfo {
  const effectivePlan = getEffectivePlanCode(subscription ?? null);
  const fiftyYearsMs = 50 * 365 * 24 * 60 * 60 * 1000;

  if (effectivePlan === 'VIP_YEARLY') {
    const endsDate = subscription?.endsAt ? new Date(subscription.endsAt) : null;
    const validEnd = endsDate && !Number.isNaN(endsDate.getTime()) ? endsDate : null;
    const isPermanent = !validEnd || validEnd.getTime() - Date.now() > fiftyYearsMs;

    if (isPermanent) {
      return {
        tier: 'lifetime_vip',
        isVip: true,
        isLifetime: true,
        isExpiringSoon: false,
        daysRemaining: null,
        badgeText: 'VIP',
        daysText: 'ตลอดชีพ',
        shortLabel: 'VIP ตลอดชีพ',
        tooltip: 'สมาชิก ClassCare 360 VIP ถาวร (ไม่มีวันหมดอายุ)',
        expiresAtLabel: null,
      };
    }

    const daysRemaining = Math.max(1, Math.ceil((validEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const expiresAtLabel = new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(validEnd);
    const daysFormatted = daysRemaining.toLocaleString('th-TH');

    return {
      tier: 'temp_vip',
      isVip: true,
      isLifetime: false,
      isExpiringSoon: daysRemaining <= 14,
      daysRemaining,
      badgeText: 'VIP',
      daysText: `เหลือ ${daysFormatted} วัน`,
      shortLabel: `VIP · ${daysFormatted} วัน`,
      tooltip: `สมาชิก ClassCare 360 VIP · คงเหลือ ${daysFormatted} วัน (หมดอายุ ${expiresAtLabel})`,
      expiresAtLabel,
    };
  }

  if (role === 'superadmin') {
    return {
      tier: 'lifetime_vip',
      isVip: true,
      isLifetime: true,
      isExpiringSoon: false,
      daysRemaining: null,
      badgeText: 'VIP',
      daysText: 'ตลอดชีพ',
      shortLabel: 'VIP ตลอดชีพ',
      tooltip: 'สิทธิ์ผู้ดูแลระบบ · ClassCare 360 VIP ถาวร',
      expiresAtLabel: null,
    };
  }

  if (effectivePlan === 'TRIAL_30' && subscription?.endsAt) {
    const endsDate = new Date(subscription.endsAt);
    const validEnd = !Number.isNaN(endsDate.getTime()) ? endsDate : null;
    const daysRemaining = validEnd
      ? Math.max(1, Math.ceil((validEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 30;
    const expiresAtLabel = validEnd
      ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(validEnd)
      : null;
    return {
      tier: 'trial',
      isVip: false,
      isLifetime: false,
      isExpiringSoon: daysRemaining <= 7,
      daysRemaining,
      badgeText: 'ทดลองใช้',
      daysText: `เหลือ ${daysRemaining} วัน`,
      shortLabel: `ทดลองใช้ · ${daysRemaining} วัน`,
      tooltip: expiresAtLabel
        ? `ช่วงทดลองใช้งาน · คงเหลือ ${daysRemaining} วัน (สิ้นสุด ${expiresAtLabel})`
        : `ช่วงทดลองใช้งาน · คงเหลือ ${daysRemaining} วัน`,
      expiresAtLabel,
    };
  }

  return {
    tier: 'free',
    isVip: false,
    isLifetime: false,
    isExpiringSoon: false,
    daysRemaining: null,
    badgeText: 'Free',
    daysText: '',
    shortLabel: 'Free',
    tooltip: 'แพ็กเกจ Free · คลิกเพื่ออัปเกรดเป็น VIP',
    expiresAtLabel: null,
  };
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
