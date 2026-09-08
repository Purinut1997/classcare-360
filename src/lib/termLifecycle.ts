/**
 * Term Lifecycle, Pre-Closing Audit & Grade Promotion Wizard Engine
 * Compliant with OBEC (สพฐ.) graduation & promotion criteria.
 */

export interface AuditIssue {
  type: 'critical' | 'warning';
  category: 'score' | 'attendance' | 'characteristic' | 'competency' | 'activity';
  studentId?: string;
  studentName?: string;
  classroomName?: string;
  subjectName?: string;
  message: string;
}

export interface TermClosingAuditResult {
  canClose: boolean;
  totalStudentsChecked: number;
  criticalIssues: AuditIssue[];
  warnings: AuditIssue[];
}

export interface StudentPromotionStatus {
  studentId: string;
  studentCode: string;
  studentName: string;
  currentClassroom: string;
  currentGradeLevel: string;
  attendancePercentage: number;
  hasPassedAllBasicSubjects: boolean;
  hasPassedCharacteristics: boolean;
  hasPassedActivities: boolean;
  decision: 'promoted' | 'retained' | 'graduated' | 'pending';
  targetGradeLevel?: string;
  notes?: string;
}

/**
 * Standard Grade level promotion mapping
 */
export const NEXT_GRADE_LEVEL_MAP: Record<string, { nextLevel: string; isGraduation: boolean }> = {
  'อนุบาล 1': { nextLevel: 'อนุบาล 2', isGraduation: false },
  'อนุบาล 2': { nextLevel: 'อนุบาล 3', isGraduation: false },
  'อนุบาล 3': { nextLevel: 'ประถมศึกษาปีที่ 1', isGraduation: false },
  'ประถมศึกษาปีที่ 1': { nextLevel: 'ประถมศึกษาปีที่ 2', isGraduation: false },
  'ประถมศึกษาปีที่ 2': { nextLevel: 'ประถมศึกษาปีที่ 3', isGraduation: false },
  'ประถมศึกษาปีที่ 3': { nextLevel: 'ประถมศึกษาปีที่ 4', isGraduation: false },
  'ประถมศึกษาปีที่ 4': { nextLevel: 'ประถมศึกษาปีที่ 5', isGraduation: false },
  'ประถมศึกษาปีที่ 5': { nextLevel: 'ประถมศึกษาปีที่ 6', isGraduation: false },
  'ประถมศึกษาปีที่ 6': { nextLevel: 'จบการศึกษาระดับประถมศึกษา', isGraduation: true },
  'มัธยมศึกษาปีที่ 1': { nextLevel: 'มัธยมศึกษาปีที่ 2', isGraduation: false },
  'มัธยมศึกษาปีที่ 2': { nextLevel: 'มัธยมศึกษาปีที่ 3', isGraduation: false },
  'มัธยมศึกษาปีที่ 3': { nextLevel: 'จบการศึกษาระดับมัธยมศึกษาตอนต้น', isGraduation: true },
  // Short codes
  'ป.1': { nextLevel: 'ป.2', isGraduation: false },
  'ป.2': { nextLevel: 'ป.3', isGraduation: false },
  'ป.3': { nextLevel: 'ป.4', isGraduation: false },
  'ป.4': { nextLevel: 'ป.5', isGraduation: false },
  'ป.5': { nextLevel: 'ป.6', isGraduation: false },
  'ป.6': { nextLevel: 'จบการศึกษา', isGraduation: true },
  'ม.1': { nextLevel: 'ม.2', isGraduation: false },
  'ม.2': { nextLevel: 'ม.3', isGraduation: false },
  'ม.3': { nextLevel: 'จบการศึกษา', isGraduation: true },
};

/**
 * Evaluates student promotion decision based on OBEC standard criteria.
 */
export function evaluatePromotionDecision(params: {
  attendancePercentage: number;
  failedBasicSubjectCount: number;
  hasPassedCharacteristics: boolean;
  hasPassedActivities: boolean;
  currentGradeLevel: string;
}): { decision: 'promoted' | 'retained' | 'graduated' | 'pending'; targetGradeLevel?: string; reasons: string[] } {
  const reasons: string[] = [];

  const gradeInfo = NEXT_GRADE_LEVEL_MAP[params.currentGradeLevel] || {
    nextLevel: 'เลื่อนชั้นถัดไป',
    isGraduation: false,
  };

  if (params.attendancePercentage < 80) {
    reasons.push(`เวลาเรียนไม่ถึง 80% (ได้ ${params.attendancePercentage}%)`);
  }

  if (params.failedBasicSubjectCount > 0) {
    reasons.push(`มีวิชาพื้นฐานไม่ผ่านเกณฑ์ ${params.failedBasicSubjectCount} วิชา`);
  }

  if (!params.hasPassedCharacteristics) {
    reasons.push('ผลการประเมินคุณลักษณะอันพึงประสงค์ไม่ผ่านเกณฑ์');
  }

  if (!params.hasPassedActivities) {
    reasons.push('ผลการประเมินกิจกรรมพัฒนาผู้เรียนไม่ผ่านเกณฑ์ (มผ)');
  }

  if (reasons.length > 0) {
    return {
      decision: 'retained',
      reasons,
    };
  }

  if (gradeInfo.isGraduation) {
    return {
      decision: 'graduated',
      targetGradeLevel: gradeInfo.nextLevel,
      reasons: ['ผ่านเกณฑ์การจบหลักสูตรครบถ้วน'],
    };
  }

  return {
    decision: 'promoted',
    targetGradeLevel: gradeInfo.nextLevel,
    reasons: ['ผ่านเกณฑ์การเลื่อนชั้นครบทุกข้อกำหนด'],
  };
}
