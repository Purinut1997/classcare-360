export type DutyStatus = "assigned" | "completed" | "missed" | "excused" | "substituted";
export type DutyGenerationScope = "day" | "month" | "term" | "custom";
export type DutyRotationStrategy = "balanced" | "random" | "fixed" | "manual";

export interface Classroom {
  academic_year: string | null;
  homeroom_teacher_profile_id?: string | null;
  id: string;
  name: string;
  status: string;
}

export interface Student {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  student_code: string | null;
}

export interface DutyTask {
  active_weekdays: number[];
  allow_substitute: boolean;
  checklist: string[];
  classroom_id: string;
  evidence_required: boolean;
  id: string;
  instructions: string | null;
  is_active: boolean;
  location: string | null;
  missed_points: number;
  name: string;
  positive_points: number;
  rotation_strategy: DutyRotationStrategy;
  slots_per_day: number;
  sort_order: number;
}

export interface DutyAssignment {
  duty_date: string;
  duty_task_id: string;
  id: string;
  status: DutyStatus;
  student_id: string;
  substitute_student_id: string | null;
  note?: string | null;
  checklist_result?: Array<{ label: string; checked: boolean }>;
  evidence_paths?: string[];
}

export interface DutyWeek {
  id: string;
  workspace_id: string;
  classroom_id: string;
  week_start: string;
  strategy: string;
  status: string;
}

export interface DutyTaskForm {
  activeWeekdays: number[];
  allowSubstitute: boolean;
  checklist: string;
  evidenceRequired: boolean;
  instructions: string;
  isActive: boolean;
  location: string;
  missedPoints: number;
  name: string;
  positivePoints: number;
  rotationStrategy: DutyRotationStrategy;
  slotsPerDay: number;
}

export const DUTY_STATUS_CONFIG: Record<DutyStatus, { label: string; tone: string; badgeClass: string }> = {
  assigned: {
    label: "รอตรวจ",
    tone: "cyan",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  completed: {
    label: "ทำเรียบร้อย",
    tone: "emerald",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  missed: {
    label: "ไม่ทำเวร",
    tone: "rose",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
  },
  excused: {
    label: "ลาเวร",
    tone: "slate",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
  substituted: {
    label: "มีคนทำแทน",
    tone: "amber",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
};
