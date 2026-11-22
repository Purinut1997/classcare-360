import { buildSchedulePeriods, makeScheduleCellKey, type DayName, type ScheduleCell, type SchedulePeriod, type ScheduleSettings } from './scheduleSettings';

export interface AttendanceSessionLite {
  id: string;
  attendance_date: string;
  subject_name?: string | null;
}

export interface AttendanceRecordLite {
  session_id: string;
  student_id: string;
  status: string;
}

export interface StudentAttendanceSummary {
  studentId: string;
  recordedDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveOrSickDays: number;
  attendanceRate: number;
  consecutiveAbsentDays: number;
  lastStatus: string | null;
  lastDate: string | null;
  isBelowMs: boolean;
  isNearMs: boolean;
}

const PRESENT_STATUSES = new Set(['present', 'late', 'activity']);

/**
 * Computes attendance rates (80% OBEC rule), late counts, and trailing consecutive absences
 * per student after deduplicating multiple sessions on the same calendar date (homeroom priority).
 */
export function computeAttendanceStreaksAndRates(
  sessions: AttendanceSessionLite[],
  records: AttendanceRecordLite[],
  studentIds: string[],
): Map<string, StudentAttendanceSummary> {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const dailyMapByStudent = new Map<string, Map<string, { status: string; isHomeroom: boolean }>>();

  studentIds.forEach((id) => dailyMapByStudent.set(id, new Map()));

  records.forEach((rec) => {
    const sess = sessionById.get(rec.session_id);
    if (!sess?.attendance_date) return;
    let studentDays = dailyMapByStudent.get(rec.student_id);
    if (!studentDays) {
      studentDays = new Map();
      dailyMapByStudent.set(rec.student_id, studentDays);
    }

    const isHomeroom = !sess.subject_name || sess.subject_name === 'โฮมรูม';
    const existing = studentDays.get(sess.attendance_date);
    if (!existing || (isHomeroom && !existing.isHomeroom)) {
      studentDays.set(sess.attendance_date, { status: rec.status, isHomeroom });
    }
  });

  const result = new Map<string, StudentAttendanceSummary>();

  dailyMapByStudent.forEach((daysMap, studentId) => {
    const sortedEntries = Array.from(daysMap.entries()).sort(([d1], [d2]) => d1.localeCompare(d2));
    const recordedDays = sortedEntries.length;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let leaveOrSickDays = 0;

    sortedEntries.forEach(([, info]) => {
      if (PRESENT_STATUSES.has(info.status)) presentDays += 1;
      if (info.status === 'absent') absentDays += 1;
      if (info.status === 'late') lateDays += 1;
      if (info.status === 'sick' || info.status === 'leave') leaveOrSickDays += 1;
    });

    let consecutiveAbsentDays = 0;
    for (let i = sortedEntries.length - 1; i >= 0; i -= 1) {
      if (sortedEntries[i][1].status === 'absent') {
        consecutiveAbsentDays += 1;
      } else {
        break;
      }
    }

    const attendanceRate = recordedDays > 0 ? Math.round((presentDays / recordedDays) * 1000) / 10 : 100;
    const latest = sortedEntries[sortedEntries.length - 1];

    result.set(studentId, {
      studentId,
      recordedDays,
      presentDays,
      absentDays,
      lateDays,
      leaveOrSickDays,
      attendanceRate,
      consecutiveAbsentDays,
      lastStatus: latest ? latest[1].status : null,
      lastDate: latest ? latest[0] : null,
      isBelowMs: recordedDays >= 5 && attendanceRate < 80,
      isNearMs: recordedDays >= 5 && attendanceRate >= 80 && attendanceRate < 85,
    });
  });

  return result;
}

export interface StudentRiskInputItem {
  id: string;
  first_name: string;
  last_name: string;
  student_code?: string | null;
}

export interface StudentRiskScoreStats {
  averagePercent: number | null;
  gradedCount: number;
}

export interface StudentRiskBehaviorStats {
  netPoints: number;
  urgentFollowUps: number;
}

export interface StudentRiskSignalItem {
  studentId: string;
  studentName: string;
  studentCode: string | null;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'watch';
  reasons: string[];
  attendanceRate: number;
  consecutiveAbsentDays: number;
  averageScorePercent: number | null;
  behaviorNet: number;
}

/**
 * Computes a unified 360-degree early warning risk profile across attendance, grades,
 * behavior, health flags, and open care cases.
 */
export function evaluateStudentRiskSignals(params: {
  students: StudentRiskInputItem[];
  attendanceMap: Map<string, StudentAttendanceSummary>;
  scoresByStudent: Map<string, StudentRiskScoreStats>;
  behaviorByStudent: Map<string, StudentRiskBehaviorStats>;
  attentionHealthStudentIds?: Set<string>;
  openCareCaseStudentIds?: Set<string>;
}): StudentRiskSignalItem[] {
  const results: StudentRiskSignalItem[] = [];

  params.students.forEach((student) => {
    const att = params.attendanceMap.get(student.id);
    const sc = params.scoresByStudent.get(student.id);
    const bh = params.behaviorByStudent.get(student.id);
    const hasAttentionHealth = params.attentionHealthStudentIds?.has(student.id) ?? false;
    const hasOpenCareCase = params.openCareCaseStudentIds?.has(student.id) ?? false;

    let riskScore = 0;
    const reasons: string[] = [];

    const streak = att?.consecutiveAbsentDays ?? 0;
    const attRate = att?.attendanceRate ?? 100;

    if (streak >= 3) {
      riskScore += 42;
      reasons.push(`ขาดเรียนติดกัน ${streak} วัน`);
    } else if (streak === 2) {
      riskScore += 22;
      reasons.push('ขาดเรียนติดกัน 2 วัน');
    }

    if (att?.isBelowMs) {
      riskScore += 36;
      reasons.push(`เวลาเรียน ${attRate.toFixed(0)}% (ต่ำกว่า 80%)`);
    } else if (att?.isNearMs) {
      riskScore += 18;
      reasons.push(`เวลาเรียน ${attRate.toFixed(0)}% (ใกล้เกณฑ์ มส)`);
    } else if (att && att.lateDays >= 3) {
      riskScore += 14;
      reasons.push(`มาสาย ${att.lateDays} ครั้ง`);
    }

    const avgScore = sc?.averagePercent ?? null;
    if (avgScore !== null && (sc?.gradedCount ?? 0) > 0) {
      if (avgScore < 50) {
        riskScore += 32;
        reasons.push(`คะแนนเฉลี่ย ${avgScore.toFixed(0)}% (<50%)`);
      } else if (avgScore < 60) {
        riskScore += 12;
        reasons.push(`คะแนนเฉลี่ย ${avgScore.toFixed(0)}% (ควรเสริม)`);
      }
    }

    const behaviorNet = bh?.netPoints ?? 0;
    const urgentFollowUps = bh?.urgentFollowUps ?? 0;
    if (behaviorNet < 0) {
      riskScore += 24;
      reasons.push(`พฤติกรรมสุทธิ ${behaviorNet} แต้ม`);
    }
    if (urgentFollowUps > 0) {
      riskScore += 18;
      reasons.push(`มีพฤติกรรมรอติดตาม (${urgentFollowUps})`);
    }

    if (hasAttentionHealth) {
      riskScore += 12;
      reasons.push('มีจุดสุขภาพต้องดูแล');
    }

    if (hasOpenCareCase) {
      riskScore += 16;
      reasons.push('เปิดเคสดูแลอยู่');
    }

    if (riskScore > 0 && reasons.length > 0) {
      const riskLevel: StudentRiskSignalItem['riskLevel'] =
        riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'watch';

      results.push({
        studentId: student.id,
        studentName: `${student.first_name} ${student.last_name}`.trim(),
        studentCode: student.student_code || null,
        riskScore,
        riskLevel,
        reasons,
        attendanceRate: attRate,
        consecutiveAbsentDays: streak,
        averageScorePercent: avgScore,
        behaviorNet,
      });
    }
  });

  return results.sort((a, b) => b.riskScore - a.riskScore);
}

export interface TraitSuggestionInput {
  attendanceRate: number;
  lateDays: number;
  behaviorNetPoints: number;
  positiveBehaviorCount: number;
  scoreCompletionPercent: number;
  scoreAveragePercent: number | null;
  savingsTxCount: number;
}

export interface TraitSuggestionOutput {
  traits: Record<number, number>;
  traitSummary: number;
  rationale: string;
}

/**
 * Generates evidence-based OBEC 8 Desirable Characteristics suggestions from cross-module records.
 */
export function suggestDesirableTraitsForStudent(metrics: TraitSuggestionInput): TraitSuggestionOutput {
  const {
    attendanceRate,
    lateDays,
    behaviorNetPoints,
    positiveBehaviorCount,
    scoreCompletionPercent,
    scoreAveragePercent,
    savingsTxCount,
  } = metrics;

  const avg = scoreAveragePercent ?? 70;

  const trait1 = attendanceRate >= 85 ? 3 : attendanceRate >= 75 ? 2 : 1; // รักชาติฯ
  const trait2 = behaviorNetPoints >= 0 ? 3 : behaviorNetPoints >= -4 ? 2 : 1; // ซื่อสัตย์สุจริต
  const trait3 =
    attendanceRate >= 92 && lateDays <= 1 && behaviorNetPoints >= 0
      ? 3
      : attendanceRate >= 80 && lateDays <= 4 && behaviorNetPoints >= -3
        ? 2
        : attendanceRate >= 65
          ? 1
          : 0; // มีวินัย
  const trait4 =
    scoreCompletionPercent >= 85 && avg >= 65
      ? 3
      : scoreCompletionPercent >= 60 && avg >= 50
        ? 2
        : scoreCompletionPercent > 0
          ? 1
          : 2; // ใฝ่เรียนรู้
  const trait5 = savingsTxCount >= 4 ? 3 : savingsTxCount >= 1 || behaviorNetPoints >= 0 ? 2 : 2; // อยู่อย่างพอเพียง
  const trait6 =
    scoreCompletionPercent >= 90 ? 3 : scoreCompletionPercent >= 70 ? 2 : scoreCompletionPercent > 0 ? 1 : 2; // มุ่งมั่นในการทำงาน
  const trait7 = attendanceRate >= 85 ? 3 : 2; // รักความเป็นไทย
  const trait8 = positiveBehaviorCount >= 2 || behaviorNetPoints >= 3 ? 3 : behaviorNetPoints >= 0 ? 2 : 1; // มีจิตสาธารณะ

  const traits: Record<number, number> = {
    1: trait1,
    2: trait2,
    3: trait3,
    4: trait4,
    5: trait5,
    6: trait6,
    7: trait7,
    8: trait8,
  };

  const vals = Object.values(traits);
  let traitSummary = 3;
  if (vals.some((v) => v === 0)) {
    traitSummary = 0;
  } else {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    traitSummary = mean >= 2.5 ? 3 : mean >= 1.75 ? 2 : 1;
  }

  const notes: string[] = [];
  notes.push(`มาเรียน ${attendanceRate.toFixed(0)}%`);
  if (scoreAveragePercent !== null) notes.push(`ส่งงาน ${scoreCompletionPercent.toFixed(0)}% (เฉลี่ย ${scoreAveragePercent.toFixed(0)}%)`);
  if (behaviorNetPoints !== 0) notes.push(`พฤติกรรม ${behaviorNetPoints > 0 ? `+${behaviorNetPoints}` : behaviorNetPoints}`);
  if (savingsTxCount > 0) notes.push(`ออม ${savingsTxCount} ครั้ง`);

  return {
    traits,
    traitSummary,
    rationale: notes.join(' · '),
  };
}

const THAI_WEEKDAYS_BY_JS_DAY: DayName[] = [
  'อาทิตย์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
];

function parseHhMmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => Number(v));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Matches current Asia/Bangkok wall-clock time against teacher timetable periods.
 */
export function detectActiveSchedulePeriod(
  scheduleSettings: ScheduleSettings,
  nowDate = new Date(),
): { dayName: DayName; period: SchedulePeriod; cell: ScheduleCell | null } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(nowDate);

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const wk = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const hr = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const mn = Number(parts.find((p) => p.type === 'minute')?.value || '0');

    const dayName = THAI_WEEKDAYS_BY_JS_DAY[weekdayMap[wk] ?? 1];
    const nowMinutes = (hr === 24 ? 0 : hr) * 60 + mn;
    const periods = buildSchedulePeriods(scheduleSettings);
    if (periods.length === 0) return null;

    // Exact active period or starting within 15 minutes
    const matched =
      periods.find((p) => {
        const s = parseHhMmToMinutes(p.start);
        const e = parseHhMmToMinutes(p.end);
        return nowMinutes >= s - 15 && nowMinutes < e;
      }) || null;

    if (!matched) return null;
    const cell = scheduleSettings.cells[makeScheduleCellKey(dayName, matched.index)] || null;
    return { dayName, period: matched, cell };
  } catch {
    return null;
  }
}
