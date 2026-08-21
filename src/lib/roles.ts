import type { AppSessionContext, WorkspaceRole } from '../types/core';

export const roleLabels: Record<WorkspaceRole, string> = {
  superadmin: 'ผู้ดูแลระบบ',
  teacher_owner: 'ครู + เจ้าของ workspace',
  teacher_member: 'ครูร่วม',
  parent: 'ผู้ปกครอง',
  student: 'นักเรียน',
  viewer: 'ผู้ดูรายงาน',
};

const workspaceWriteRoles: WorkspaceRole[] = ['teacher_owner', 'teacher_member'];

export type WorkspaceCapabilityKey =
  | 'students.write' | 'attendance.write' | 'scores.write' | 'behavior.write'
  | 'student_care.write' | 'home_visits.write' | 'savings.write'
  | 'duty.manage' | 'daily_brief.write' | 'reports.export'
  | 'communications.prepare' | 'communications.approve' | 'automation.manage'
  | 'members.manage' | 'workspace.manage' | 'recovery.restore' | 'data.bulk';

const teacherMemberDefaults: Partial<Record<WorkspaceCapabilityKey, boolean>> = {
  'students.write': true, 'attendance.write': true, 'scores.write': true, 'behavior.write': true,
  'student_care.write': true, 'home_visits.write': true, 'savings.write': false,
  'duty.manage': true, 'daily_brief.write': true, 'reports.export': true,
  'communications.prepare': true, 'communications.approve': false, 'automation.manage': false,
  'members.manage': false, 'workspace.manage': false, 'recovery.restore': false, 'data.bulk': true,
};

const viewerDefaults: Partial<Record<WorkspaceCapabilityKey, boolean>> = { 'reports.export': true };

export function hasWorkspaceCapability(session: AppSessionContext, capability: WorkspaceCapabilityKey) {
  if (session.profile.role === 'superadmin' || session.profile.role === 'teacher_owner') return true;
  if (capability in (session.permissions ?? {})) return session.permissions?.[capability] === true;
  if (session.profile.role === 'teacher_member') return teacherMemberDefaults[capability] ?? false;
  if (session.profile.role === 'viewer') return viewerDefaults[capability] ?? false;
  return false;
}

export function canManageWorkspace(role: WorkspaceRole) {
  return role === 'superadmin' || role === 'teacher_owner';
}

export function canWriteWorkspaceData(role: WorkspaceRole) {
  return role === 'superadmin' || workspaceWriteRoles.includes(role);
}

export function canWriteStudentRoster(session: AppSessionContext) {
  return hasWorkspaceCapability(session, 'students.write');
}

export function canViewReports(role: WorkspaceRole) {
  return ['superadmin', 'teacher_owner', 'teacher_member', 'viewer'].includes(role);
}
