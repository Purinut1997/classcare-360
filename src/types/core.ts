export type WorkspaceRole =
  | 'superadmin'
  | 'teacher_owner'
  | 'teacher_member'
  | 'parent'
  | 'student'
  | 'viewer';

export type AccountStatus =
  | 'registered'
  | 'pending_approval'
  | 'trial'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'cancelled';

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'expired'
  | 'suspended'
  | 'cancelled'
  | 'refunded';

export type PlanCode = 'FREE_LOGIN' | 'TRIAL_30' | 'VIP_YEARLY';

export type ModuleKey =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'scores'
  | 'savings'
  | 'behavior'
  | 'student_care'
  | 'home_visits'
  | 'reports'
  | 'import_export'
  | 'notifications'
  | 'parent_portal'
  | 'student_portal'
  | 'google_drive_cold_storage'
  | 'teacher_backup'
  | 'classroom_randomizer'
  | 'payment'
  | 'support';

export interface AppProfile {
  id: string;
  email: string;
  displayName: string;
  accountStatus: AccountStatus;
  role: WorkspaceRole;
  schoolName?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  schoolName: string;
  academicYear: string;
  classroomName: string;
}

export interface SubscriptionSummary {
  planCode: PlanCode;
  status: SubscriptionStatus;
  endsAt: string | null;
}

export interface AppSessionContext {
  profile: AppProfile;
  workspace: WorkspaceSummary | null;
  subscription: SubscriptionSummary | null;
}
