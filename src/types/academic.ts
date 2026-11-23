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
  subjectType?: SubjectType;
}[] = [
  { code: 'ท11101', name: 'ภาษาไทย', area: 'ภาษาไทย', hours: 200, credit: 5.0, subjectType: 'basic' },
  { code: 'ค11101', name: 'คณิตศาสตร์', area: 'คณิตศาสตร์', hours: 200, credit: 5.0, subjectType: 'basic' },
  { code: 'ว11101', name: 'วิทยาศาสตร์และเทคโนโลยี', area: 'วิทยาศาสตร์และเทคโนโลยี', hours: 80, credit: 2.0, subjectType: 'basic' },
  { code: 'ส11101', name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', area: 'สังคมศึกษา ศาสนาและวัฒนธรรม', hours: 80, credit: 2.0, subjectType: 'basic' },
  { code: 'ส11102', name: 'ประวัติศาสตร์', area: 'สังคมศึกษา ศาสนาและวัฒนธรรม', hours: 40, credit: 1.0, subjectType: 'basic' },
  { code: 'พ11101', name: 'สุขศึกษาและพลศึกษา', area: 'สุขศึกษาและพลศึกษา', hours: 80, credit: 2.0, subjectType: 'basic' },
  { code: 'ศ11101', name: 'ศิลปะ', area: 'ศิลปะ', hours: 80, credit: 2.0, subjectType: 'basic' },
  { code: 'ง11101', name: 'การงานอาชีพ', area: 'การงานอาชีพ', hours: 40, credit: 1.0, subjectType: 'basic' },
  { code: 'อ11101', name: 'ภาษาอังกฤษ', area: 'ภาษาต่างประเทศ', hours: 120, credit: 3.0, subjectType: 'basic' },
];

export const OBEC_PRIMARY_GRADES = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'] as const;
export const OBEC_SECONDARY_GRADES = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'] as const;
export const OBEC_ALL_GRADE_LEVELS = [...OBEC_PRIMARY_GRADES, ...OBEC_SECONDARY_GRADES] as const;

export interface ObecSubjectCatalogItem {
  code: string;
  name: string;
  area: ObecLearningArea;
  subjectType: SubjectType;
  hours: number;
  credit: number;
  gradeLevel: string;
}

export const REMEDIAL_LEARNING_AREA = 'หมวดวิชาซ่อมเสริม';
export const REMEDIAL_NO_CODE_PREFIX = 'NO_CODE::';

export function buildRemedialNoCodeSentinel(subjectName: string, gradeLevel: string): string {
  return `${REMEDIAL_NO_CODE_PREFIX}${subjectName.trim()}::${gradeLevel.trim()}`;
}

export function isNoSubjectCode(code?: string | null): boolean {
  if (!code) return true;
  const clean = code.trim();
  return !clean || clean === '-' || clean.startsWith(REMEDIAL_NO_CODE_PREFIX);
}

export function formatDisplaySubjectCode(code?: string | null): string | null {
  if (isNoSubjectCode(code)) return null;
  return code!.trim();
}

export function isRemedialSubjectRecord(subject: {
  subject_name?: string | null;
  learning_area?: string | null;
  subject_type?: string | null;
  subject_code?: string | null;
}): boolean {
  const name = (subject.subject_name || '').trim().toLowerCase();
  const area = (subject.learning_area || '').trim().toLowerCase();
  const code = (subject.subject_code || '').trim();
  return (
    name.includes('ซ่อมเสริม') ||
    area.includes('ซ่อมเสริม') ||
    code.startsWith(REMEDIAL_NO_CODE_PREFIX)
  );
}

export function generateRemedialAdditionalCode(
  learningAreaOrName: string,
  gradeLevel: string,
  seq = '01',
): string {
  const text = (learningAreaOrName || '').trim();
  let prefix = 'ก';
  if (text.includes('คณิต')) prefix = 'ค';
  else if (text.includes('ไทย')) prefix = 'ท';
  else if (text.includes('วิทย') || text.includes('เทคโน') || text.includes('คอม')) prefix = 'ว';
  else if (text.includes('สังคม') || text.includes('ประวัติ') || text.includes('หน้าที่')) prefix = 'ส';
  else if (text.includes('สุข') || text.includes('พล')) prefix = 'พ';
  else if (text.includes('ศิลป') || text.includes('ดนตรี')) prefix = 'ศ';
  else if (text.includes('การงาน') || text.includes('อาชีพ')) prefix = 'ง';
  else if (text.includes('อังกฤษ') || text.includes('ต่างประเทศ') || text.includes('จีน')) prefix = 'อ';
  return adaptObecSubjectCode(`${prefix}112${seq}`, gradeLevel);
}

/**
 * Converts a base OBEC code (e.g. ท11101 or ว11201) to the official 6-character OBEC code
 * for the target grade level:
 * - ป.1–ป.6 -> level digit '1', year digit '1'..'6' (e.g. ป.5 -> ท15101)
 * - ม.1–ม.3 -> level digit '2', year digit '1'..'3' (e.g. ม.2 -> ท22101)
 * - ม.4–ม.6 -> level digit '3', year digit '1'..'3' (e.g. ม.4 -> ท31101)
 */
export function adaptObecSubjectCode(baseCode: string, gradeLevel: string): string {
  if (isNoSubjectCode(baseCode)) {
    return baseCode;
  }
  const cleanGrade = (gradeLevel || '').replace(/\s+/g, '');
  const pMatch = cleanGrade.match(/^(?:ป\.|ประถมศึกษาปีที่)?([1-6])$/);
  const mMatch = cleanGrade.match(/^(?:ม\.|มัธยมศึกษาปีที่)([1-6])$/);
  const codeMatch = baseCode.match(/^([^\d]+)\d{2}(\d{3})$/);
  if (!codeMatch) return baseCode;

  const prefix = codeMatch[1];
  const suffix = codeMatch[2];

  if (pMatch) {
    return `${prefix}1${pMatch[1]}${suffix}`;
  }
  if (mMatch) {
    const mYear = Number(mMatch[1]);
    if (mYear >= 1 && mYear <= 3) {
      return `${prefix}2${mYear}${suffix}`;
    }
    return `${prefix}3${mYear - 3}${suffix}`;
  }
  return baseCode;
}

/**
 * Infers the Thai grade level label (e.g. 'ป.1', 'ป.5', 'ม.1', 'ม.4') from an OBEC 6-character subject code.
 */
export function inferGradeLevelFromObecCode(subjectCode: string, fallbackGrade = 'ป.5'): string {
  const match = (subjectCode || '').trim().match(/^[^\d]+([123])([1-6])\d{3}$/);
  if (!match) return fallbackGrade;
  const levelDigit = match[1];
  const yearDigit = Number(match[2]);
  if (levelDigit === '1' && yearDigit >= 1 && yearDigit <= 6) {
    return `ป.${yearDigit}`;
  }
  if (levelDigit === '2' && yearDigit >= 1 && yearDigit <= 3) {
    return `ม.${yearDigit}`;
  }
  if (levelDigit === '3' && yearDigit >= 1 && yearDigit <= 3) {
    return `ม.${yearDigit + 3}`;
  }
  return fallbackGrade;
}

const ADDITIONAL_SUBJECTS_TEMPLATE: {
  code: string;
  name: string;
  area: ObecLearningArea;
  hours: number;
  credit: number;
  subjectType: SubjectType;
}[] = [
  { code: 'ว11201', name: 'วิทยาการคำนวณ / คอมพิวเตอร์', area: 'วิทยาศาสตร์และเทคโนโลยี', hours: 40, credit: 1.0, subjectType: 'additional' },
  { code: 'ส11201', name: 'หน้าที่พลเมือง', area: 'สังคมศึกษา ศาสนาและวัฒนธรรม', hours: 40, credit: 1.0, subjectType: 'additional' },
  { code: 'อ11201', name: 'ภาษาอังกฤษเพื่อการสื่อสาร', area: 'ภาษาต่างประเทศ', hours: 40, credit: 1.0, subjectType: 'additional' },
  { code: 'ค11201', name: 'คณิตศาสตร์เพิ่มเติม', area: 'คณิตศาสตร์', hours: 40, credit: 1.0, subjectType: 'additional' },
  { code: 'ท11201', name: 'การอ่านและการเขียนภาษาไทย', area: 'ภาษาไทย', hours: 40, credit: 1.0, subjectType: 'additional' },
];

/**
 * Generates the selectable OBEC subject catalog (9 core subjects + 5 popular additional subjects)
 * tailored to the specified grade level (ป.1–ป.6, ม.1–ม.6).
 */
export function getObecSubjectCatalogByGrade(gradeLevel: string): ObecSubjectCatalogItem[] {
  const normalizedGrade = OBEC_ALL_GRADE_LEVELS.includes(gradeLevel as (typeof OBEC_ALL_GRADE_LEVELS)[number])
    ? gradeLevel
    : 'ป.5';
  const isUpperPrimary = ['ป.4', 'ป.5', 'ป.6'].includes(normalizedGrade);
  const isSecondary = normalizedGrade.startsWith('ม.');

  const allTemplates = [...DEFAULT_PRIMARY_SUBJECTS_TEMPLATE, ...ADDITIONAL_SUBJECTS_TEMPLATE];

  return allTemplates.map((tpl) => {
    let hours = tpl.hours;
    let credit = tpl.credit;

    if (tpl.subjectType !== 'additional') {
      if (isSecondary) {
        if (tpl.area === 'ภาษาไทย' || tpl.area === 'คณิตศาสตร์' || tpl.area === 'วิทยาศาสตร์และเทคโนโลยี') {
          hours = 120;
          credit = 3.0;
        } else if (tpl.name === 'ประวัติศาสตร์' || tpl.area === 'การงานอาชีพ' || tpl.area === 'สุขศึกษาและพลศึกษา' || tpl.area === 'ศิลปะ') {
          hours = 40;
          credit = 1.0;
        } else {
          hours = 120;
          credit = 3.0;
        }
      } else if (isUpperPrimary) {
        if (tpl.area === 'ภาษาไทย' || tpl.area === 'คณิตศาสตร์') {
          hours = 160;
          credit = 4.0;
        } else if (tpl.area === 'วิทยาศาสตร์และเทคโนโลยี') {
          hours = 120;
          credit = 3.0;
        }
      }
    }

    return {
      code: adaptObecSubjectCode(tpl.code, normalizedGrade),
      name: tpl.name,
      area: tpl.area,
      subjectType: tpl.subjectType || 'basic',
      hours,
      credit,
      gradeLevel: normalizedGrade,
    };
  });
}
