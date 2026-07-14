import type { AppSessionContext, ModuleKey } from '../types/core';
import { canUseModule } from './entitlements';

export type DemoSessionMode =
  | 'teacher'
  | 'free'
  | 'expired'
  | 'no-workspace'
  | 'parent'
  | 'student'
  | 'viewer'
  | 'superadmin'
  | 'signed-out';

export const demoSessions: Record<Exclude<DemoSessionMode, 'signed-out'>, AppSessionContext> = {
  teacher: {
    profile: {
      id: 'demo-teacher',
      email: 'teacher@classcare.local',
      displayName: 'ครูประจำชั้น',
      accountStatus: 'active',
      role: 'teacher_owner',
    },
    workspace: {
      id: 'demo-workspace',
      name: 'ห้องเรียนตัวอย่าง',
      schoolName: 'โรงเรียนตัวอย่าง ClassCare',
      academicYear: '2569',
      classroomName: 'ป.5/2',
    },
    subscription: {
      planCode: 'VIP_YEARLY',
      status: 'active',
      endsAt: '2027-06-24T00:00:00+07:00',
    },
  },
  free: {
    profile: {
      id: 'demo-free-teacher',
      email: 'free.teacher@classcare.local',
      displayName: 'ครูทดลองระบบ',
      accountStatus: 'registered',
      role: 'teacher_owner',
    },
    workspace: {
      id: 'demo-free-workspace',
      name: 'ห้องเรียนรออัปเกรด',
      schoolName: 'โรงเรียนตัวอย่าง ClassCare',
      academicYear: '2569',
      classroomName: 'ป.4/1',
    },
    subscription: {
      planCode: 'FREE_LOGIN',
      status: 'active',
      endsAt: null,
    },
  },
  expired: {
    profile: {
      id: 'demo-expired-teacher',
      email: 'expired.teacher@classcare.local',
      displayName: 'ครูสิทธิ์หมดอายุ',
      accountStatus: 'expired',
      role: 'teacher_owner',
    },
    workspace: {
      id: 'demo-expired-workspace',
      name: 'ห้องเรียนหมดอายุ',
      schoolName: 'โรงเรียนตัวอย่าง ClassCare',
      academicYear: '2569',
      classroomName: 'ม.1/3',
    },
    subscription: {
      planCode: 'VIP_YEARLY',
      status: 'expired',
      endsAt: '2026-05-24T00:00:00+07:00',
    },
  },
  'no-workspace': {
    profile: {
      id: 'demo-no-workspace',
      email: 'new.teacher@classcare.local',
      displayName: 'ครูรอสร้าง workspace',
      accountStatus: 'active',
      role: 'teacher_owner',
    },
    workspace: null,
    subscription: {
      planCode: 'TRIAL_30',
      status: 'trial',
      endsAt: '2026-07-24T00:00:00+07:00',
    },
  },
  parent: {
    profile: {
      id: 'demo-parent',
      email: 'parent@classcare.local',
      displayName: 'ผู้ปกครองตัวอย่าง',
      accountStatus: 'active',
      role: 'parent',
    },
    workspace: {
      id: 'demo-workspace',
      name: 'ห้องเรียนตัวอย่าง',
      schoolName: 'โรงเรียนตัวอย่าง ClassCare',
      academicYear: '2569',
      classroomName: 'ป.5/2',
    },
    subscription: {
      planCode: 'VIP_YEARLY',
      status: 'active',
      endsAt: '2027-06-24T00:00:00+07:00',
    },
  },
  student: {
    profile: {
      id: 'demo-student',
      email: 'student@classcare.local',
      displayName: 'นักเรียนตัวอย่าง',
      accountStatus: 'active',
      role: 'student',
    },
    workspace: {
      id: 'demo-workspace',
      name: 'ห้องเรียนตัวอย่าง',
      schoolName: 'โรงเรียนตัวอย่าง ClassCare',
      academicYear: '2569',
      classroomName: 'ป.5/2',
    },
    subscription: {
      planCode: 'VIP_YEARLY',
      status: 'active',
      endsAt: '2027-06-24T00:00:00+07:00',
    },
  },
  viewer: {
    profile: {
      id: 'demo-viewer',
      email: 'viewer@classcare.local',
      displayName: 'ผู้ดูรายงาน',
      accountStatus: 'active',
      role: 'viewer',
    },
    workspace: {
      id: 'demo-workspace',
      name: 'ห้องเรียนตัวอย่าง',
      schoolName: 'โรงเรียนตัวอย่าง ClassCare',
      academicYear: '2569',
      classroomName: 'ป.5/2',
    },
    subscription: {
      planCode: 'VIP_YEARLY',
      status: 'active',
      endsAt: '2027-06-24T00:00:00+07:00',
    },
  },
  superadmin: {
    profile: {
      id: 'demo-superadmin',
      email: 'admin@classcare.local',
      displayName: 'ผู้ดูแลระบบ',
      accountStatus: 'active',
      role: 'superadmin',
    },
    workspace: null,
    subscription: {
      planCode: 'VIP_YEARLY',
      status: 'active',
      endsAt: null,
    },
  },
};

export const demoSession: AppSessionContext = demoSessions.teacher;

export function getDemoSession(mode: string | null): AppSessionContext | null {
  if (mode === 'signed-out') return null;
  if (mode && mode in demoSessions) {
    return demoSessions[mode as Exclude<DemoSessionMode, 'signed-out'>];
  }

  return demoSession;
}

export const demoModeOptions: Array<{ label: string; mode: DemoSessionMode }> = [
  { label: 'ครู VIP', mode: 'teacher' },
  { label: 'Free Login', mode: 'free' },
  { label: 'หมดอายุ', mode: 'expired' },
  { label: 'ยังไม่มี workspace', mode: 'no-workspace' },
  { label: 'ผู้ปกครอง', mode: 'parent' },
  { label: 'นักเรียน', mode: 'student' },
  { label: 'ผู้ดูรายงาน', mode: 'viewer' },
  { label: 'Superadmin', mode: 'superadmin' },
  { label: 'ยังไม่ Login', mode: 'signed-out' },
];

export const demoModeQueryKey = 'demo';

export function getDemoModeSearch(currentSearch: string, mode: DemoSessionMode) {
  const params = new URLSearchParams(currentSearch);
  if (mode === 'teacher') {
    params.delete(demoModeQueryKey);
  } else {
    params.set(demoModeQueryKey, mode);
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : '';
}

export function getInitialRouteForSession(session: AppSessionContext) {
  if (session.profile.needsProfile) return '/auth/complete-profile';
  if (session.profile.role === 'parent') return session.workspace ? '/portal/parent' : '/portal/invitations';
  if (session.profile.role === 'student') return session.workspace ? '/portal/student' : '/portal/invitations';
  if (session.profile.role === 'viewer') return session.workspace ? '/app/dashboard?view=reports' : '/app/select-workspace';
  if (session.profile.role === 'superadmin') return session.workspace ? '/app/dashboard' : '/app/select-workspace';
  if (!session.workspace) return '/app/select-workspace';
  if (!canUseModule(session.subscription, 'dashboard')) return '/app/package';
  return '/app/dashboard';
}

export function getSafeInternalRedirect(value: string | null) {
  if (!value) return null;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
    if (decoded.startsWith('/login') || decoded.startsWith('/auth/complete-profile')) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getPostAuthRouteForSession(session: AppSessionContext, requestedRedirect: string | null) {
  if (session.profile.needsProfile) return '/auth/complete-profile';
  return getSafeInternalRedirect(requestedRedirect) || getInitialRouteForSession(session);
}

export function getRouteGuardPreview(session: AppSessionContext, moduleKey: ModuleKey) {
  return [
    { label: 'Session', passed: Boolean(session.profile.id) },
    { label: 'Workspace', passed: Boolean(session.workspace?.id) },
    { label: 'Subscription', passed: canUseModule(session.subscription, moduleKey) },
    { label: 'Role', passed: session.profile.role === 'teacher_owner' },
    { label: 'Audit', passed: true },
  ];
}
