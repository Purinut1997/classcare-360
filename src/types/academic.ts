export type ObecLearningArea =
  | 'ภาษาไทย'
  | 'คณิตศาสตร์'
  | 'วิทยาศาสตร์และเทคโนโลยี'
  | 'สังคมศึกษา ศาสนาและวัฒนธรรม'
  | 'สุขศึกษาและพลศึกษา'
  | 'ศิลปะ'
  | 'การงานอาชีพ'
  | 'ภาษาต่างประเทศ';

export const OBEC_LEARNING_AREAS: ObecLearningArea[] = [
  'ภาษาไทย',
  'คณิตศาสตร์',
  'วิทยาศาสตร์และเทคโนโลยี',
  'สังคมศึกษา ศาสนาและวัฒนธรรม',
  'สุขศึกษาและพลศึกษา',
  'ศิลปะ',
  'การงานอาชีพ',
  'ภาษาต่างประเทศ',
];

export type SubjectType = 'basic' | 'additional' | 'activity';

export interface AcademicYear {
  id: string;
  workspace_id: string;
  year_name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  status: 'open' | 'locked' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface AcademicTerm {
  id: string;
  workspace_id: string;
  academic_year_id: string;
  term_name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  status: 'open' | 'locked' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface SchoolSubject {
  id: string;
  workspace_id: string;
  subject_code: string;
  subject_name: string;
  learning_area: ObecLearningArea | string;
  subject_type: SubjectType;
  grade_level: string;
  hours_per_year: number;
  hours_per_week: number;
  credit: number;
  teacher_profile_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectIndicator {
  id: string;
  workspace_id: string;
  subject_id: string;
  standard_code: string;
  indicator_code: string;
  indicator_name: string;
  term: '1' | '2' | 'yearly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GradeRule {
  id: string;
  workspace_id: string;
  min_score: number;
  max_score: number;
  grade: string;
  description: string | null;
  is_active: boolean;
}

export interface StudentOfficialGrade {
  id: string;
  workspace_id: string;
  student_id: string;
  subject_id: string;
  classroom_id: string;
  academic_year: string;
  term: '1' | '2' | 'yearly';
  accumulated_score: number | null;
  midterm_score: number | null;
  final_score: number | null;
  total_score: number;
  percentage: number | null;
  grade: string;
  status: 'draft' | 'approved' | 'locked';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Standard OBEC 8-level grading scale rules */
export const DEFAULT_OBEC_GRADE_RULES: Omit<GradeRule, 'id' | 'workspace_id'>[] = [
  { min_score: 80, max_score: 100, grade: '4', description: 'ดีเยี่ยม', is_active: true },
  { min_score: 75, max_score: 79.99, grade: '3.5', description: 'ดีมาก', is_active: true },
  { min_score: 70, max_score: 74.99, grade: '3', description: 'ดี', is_active: true },
  { min_score: 65, max_score: 69.99, grade: '2.5', description: 'ค่อนข้างดี', is_active: true },
  { min_score: 60, max_score: 64.99, grade: '2', description: 'ปานกลาง', is_active: true },
  { min_score: 55, max_score: 59.99, grade: '1.5', description: 'พอใช้', is_active: true },
  { min_score: 50, max_score: 54.99, grade: '1', description: 'ผ่านเกณฑ์ขั้นต่ำ', is_active: true },
  { min_score: 0, max_score: 49.99, grade: '0', description: 'ต่ำกว่าเกณฑ์ขั้นต่ำ', is_active: true },
];

/** Standard OBEC Primary School Subjects Template */
export const DEFAULT_PRIMARY_SUBJECTS_TEMPLATE: {
  code: string;
  name: string;
  area: ObecLearningArea;
  hours: number;
  credit: number;
}[] = [
  { code: 'ท11101', name: 'ภาษาไทย', area: 'ภาษาไทย', hours: 200, credit: 5.0 },
  { code: 'ค11101', name: 'คณิตศาสตร์', area: 'คณิตศาสตร์', hours: 200, credit: 5.0 },
  { code: 'ว11101', name: 'วิทยาศาสตร์และเทคโนโลยี', area: 'วิทยาศาสตร์และเทคโนโลยี', hours: 80, credit: 2.0 },
  { code: 'ส11101', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', area: 'สังคมศึกษา ศาสนาและวัฒนธรรม', hours: 80, credit: 2.0 },
  { code: 'ส11102', name: 'ประวัติศาสตร์', area: 'สังคมศึกษา ศาสนาและวัฒนธรรม', hours: 40, credit: 1.0 },
  { code: 'พ11101', name: 'สุขศึกษาและพลศึกษา', area: 'สุขศึกษาและพลศึกษา', hours: 80, credit: 2.0 },
  { code: 'ศ11101', name: 'ศิลปะ', area: 'ศิลปะ', hours: 80, credit: 2.0 },
  { code: 'ง11101', name: 'การงานอาชีพ', area: 'การงานอาชีพ', hours: 40, credit: 1.0 },
  { code: 'อ11101', name: 'ภาษาอังกฤษ', area: 'ภาษาต่างประเทศ', hours: 120, credit: 3.0 },
];
