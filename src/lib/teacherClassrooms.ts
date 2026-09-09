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

const HIDDEN_CLASSROOMS_KEY = (workspaceId?: string) =>
  workspaceId ? `classcare:hidden_empty_classrooms:${workspaceId}` : 'classcare:hidden_empty_classrooms';

export function getHiddenClassroomIds(workspaceId?: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_CLASSROOMS_KEY(workspaceId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function hideClassroomIdLocally(workspaceId: string | undefined, classroomId: string): void {
  if (typeof window === 'undefined' || !classroomId) return;
  try {
    const set = getHiddenClassroomIds(workspaceId);
    set.add(classroomId);
    window.localStorage.setItem(HIDDEN_CLASSROOMS_KEY(workspaceId), JSON.stringify([...set]));
  } catch (e) {
    console.error('Failed to save hidden classroom ID:', e);
  }
}

export function unhideAllClassroomsLocally(workspaceId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(HIDDEN_CLASSROOMS_KEY(workspaceId));
  } catch {}
}

/**
 * Checks if a classroom is an obsolete ghost duplicate (e.g. "ป.5" with 0 students when "ป.5/1" exists)
 * or marked as archived / hidden in local storage.
 */
export function isObsoleteGhostClassroom(
  classroom: ScopedClassroom,
  allClassrooms: ScopedClassroom[],
  studentCounts?: Map<string, number> | Array<{ classroomId: string; count: number }>,
  workspaceId?: string,
): boolean {
  if (!classroom) return false;

  // 1. Check local storage hidden list
  const hiddenIds = getHiddenClassroomIds(workspaceId);
  if (hiddenIds.has(classroom.id)) return true;

  // 2. Check DB status
  if (classroom.status === 'archived' || classroom.status === 'inactive') return true;

  const count = studentCounts
    ? studentCounts instanceof Map
      ? studentCounts.get(classroom.id) ?? 0
      : studentCounts.find((item) => item.classroomId === classroom.id)?.count ?? 0
    : 0;

  // If the classroom has enrolled students, it's definitely not a ghost room
  if (count > 0) return false;

  const name = (classroom.name || '').trim();

  // 3. Obsolete default names
  if (name === 'demo-classroom' || name === 'ห้องเรียนตัวอย่าง') return true;

  // 4. Check for duplicate root grade (e.g. "ป.5", "ป.4", "ป.6", "ม.1") when a slash room ("ป.5/1", "5/1") exists
  const cleanName = name.replace(/\s+/g, '');
  const rootMatch = cleanName.match(/^(?:ป\.|ประถมศึกษาปีที่|ม\.|มัธยมศึกษาปีที่)?([1-6])$/);
  if (rootMatch) {
    const gradeNum = rootMatch[1];
    const hasSpecificRoom = allClassrooms.some((other) => {
      if (other.id === classroom.id) return false;
      const otherName = (other.name || '').replace(/\s+/g, '');
      return (
        otherName.includes(`ป.${gradeNum}/`) ||
        otherName.includes(`${gradeNum}/`) ||
        otherName.includes(`ประถมศึกษาปีที่${gradeNum}/`) ||
        otherName.includes(`ม.${gradeNum}/`) ||
        otherName.includes(`มัธยมศึกษาปีที่${gradeNum}/`)
      );
    });
    if (hasSpecificRoom) {
      return true;
    }
  }

  return false;
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

  const hiddenIds = getHiddenClassroomIds(session?.workspace?.id);
  const activeClassrooms = classrooms.filter((c) => {
    if (c.status === 'archived' || c.status === 'inactive') return false;
    if (hiddenIds.has(c.id)) return false;
    return true;
  });

  const workspaceClassroomName = session?.workspace?.classroomName?.trim().toLowerCase() || '';

  const isHomeroomMatch = (c: T) => {
    if (currentProfileId && c.homeroom_teacher_profile_id === currentProfileId) return true;
    if (workspaceClassroomName) {
      const cName = c.name?.trim().toLowerCase() || '';
      if (cName === workspaceClassroomName) return true;
      if (cName.startsWith(workspaceClassroomName + '/') || cName.replace(/\s+/g, '') === workspaceClassroomName.replace(/\s+/g, '')) {
        return true;
      }
    }
    return false;
  };

  const homeroomClassrooms = activeClassrooms.filter(isHomeroomMatch);

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
