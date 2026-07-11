import type { WorkspaceRole } from '../types/core';

export const roleLabels: Record<WorkspaceRole, string> = {
  superadmin: 'ผู้ดูแลระบบ',
  teacher_owner: 'ครู + เจ้าของ workspace',
  teacher_member: 'ครูร่วม',
  parent: 'ผู้ปกครอง',
  student: 'นักเรียน',
  viewer: 'ผู้ดูรายงาน',
};

const workspaceWriteRoles: WorkspaceRole[] = ['teacher_owner', 'teacher_member'];

export function canManageWorkspace(role: WorkspaceRole) {
  return role === 'superadmin' || role === 'teacher_owner';
}

export function canWriteWorkspaceData(role: WorkspaceRole) {
  return role === 'superadmin' || workspaceWriteRoles.includes(role);
}

export function canViewReports(role: WorkspaceRole) {
  return ['superadmin', 'teacher_owner', 'teacher_member', 'viewer'].includes(role);
}
