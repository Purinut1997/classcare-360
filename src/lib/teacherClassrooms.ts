import type { AppSessionContext } from '../types/core';

export interface ScopedClassroom {
  academic_year?: string | null;
  grade_level?: string | null;
  homeroom_teacher_profile_id?: string | null;
  id: string;
  name: string;
  status?: string | null;
}

export interface TeacherClassroomScope<T extends ScopedClassroom = ScopedClassroom> {
  allClassrooms: T[];
  defaultClassroomId: string;
  hasHomeroom: boolean;
  hasMultipleScopes: boolean;
  homeroomClassrooms: T[];
  otherClassrooms: T[];
  teachingClassrooms: T[];
}

/**
 * Categorizes accessible classrooms for the current logged-in teacher:
 * 1. homeroomClassrooms: Classes where the user is designated as the homeroom teacher / advisor
 * 2. teachingClassrooms: Classes where the user teaches subjects but is not the homeroom advisor
 */
export function getTeacherClassroomScope<T extends ScopedClassroom>(
  session: AppSessionContext | null | undefined,
  classrooms: T[],
): TeacherClassroomScope<T> {
  const currentProfileId = session?.profile?.id || '';
  const isOwnerOrSuperadmin =
    session?.profile?.role === 'superadmin' || session?.profile?.role === 'teacher_owner';

  const activeClassrooms = classrooms.filter((c) => c.status !== 'archived');

  const workspaceClassroomName = session?.workspace?.classroomName?.trim().toLowerCase() || '';

  const homeroomClassrooms = activeClassrooms.filter(
    (c) =>
      (currentProfileId && c.homeroom_teacher_profile_id === currentProfileId) ||
      (workspaceClassroomName && c.name?.trim().toLowerCase() === workspaceClassroomName),
  );

  // If user is owner/superadmin and no classrooms explicitly set current user as homeroom,
  // the first classroom can act as primary or all can be accessed.
  const effectiveHomeroom =
    homeroomClassrooms.length > 0
      ? homeroomClassrooms
      : isOwnerOrSuperadmin && activeClassrooms.length > 0
        ? [activeClassrooms[0]]
        : [];

  const homeroomIds = new Set(effectiveHomeroom.map((c) => c.id));
  const teachingClassrooms = activeClassrooms.filter((c) => !homeroomIds.has(c.id));

  const defaultClassroomId =
    effectiveHomeroom[0]?.id || activeClassrooms[0]?.id || '';

  return {
    allClassrooms: activeClassrooms,
    defaultClassroomId,
    hasHomeroom: effectiveHomeroom.length > 0,
    hasMultipleScopes: effectiveHomeroom.length > 0 && teachingClassrooms.length > 0,
    homeroomClassrooms: effectiveHomeroom,
    otherClassrooms: teachingClassrooms,
    teachingClassrooms,
  };
}

/**
 * Formats classroom display text with a distinctive badge/indicator
 */
export function getClassroomScopeBadge(
  classroom: ScopedClassroom,
  currentProfileId?: string,
  workspaceClassroomName?: string,
): { isHomeroom: boolean; label: string; prefix: string } {
  const isHomeroom = Boolean(
    (currentProfileId && classroom.homeroom_teacher_profile_id === currentProfileId) ||
    (workspaceClassroomName && classroom.name?.trim().toLowerCase() === workspaceClassroomName.trim().toLowerCase()),
  );

  return {
    isHomeroom,
    label: isHomeroom ? 'ห้องที่ปรึกษา' : 'ห้องสอนวิชา',
    prefix: isHomeroom ? '⭐ ' : '📚 ',
  };
}
