import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, Download, FileSpreadsheet, Printer, Search, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface ReportsPageProps {
  session: AppSessionContext;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';
type ReportView = 'attendance' | 'savings' | 'scores' | 'individual' | 'behavior' | 'settings';
type ReportPeriod = 'month' | 'term' | 'year';
type TermKey = 'term1' | 'term2';

interface ClassroomRow {
  academic_year: string | null;
  id: string;
  name: string;
}

interface StudentRow {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  student_code: string | null;
}

interface AttendanceSessionRow {
  attendance_date: string;
  classroom_id: string;
  id: string;
  period_label: string;
  subject_name: string | null;
}

interface AttendanceRecordRow {
  note: string | null;
  session_id: string;
  status: AttendanceStatus;
  student_id: string;
}

interface SavingsAccountRow {
  balance: number | string;
  id: string;
  status: 'active' | 'frozen' | 'closed';
  student_id: string;
}

interface SavingsTransactionRow {
  amount: number | string;
  created_at: string;
  id: string;
  note: string | null;
  student_id: string;
  transaction_date: string;
  transaction_type: 'deposit' | 'withdrawal' | 'adjustment';
}

interface ScoreAssessmentRow {
  assessment_date: string;
  category: 'quiz' | 'assignment' | 'midterm' | 'final' | 'exam' | 'project' | 'reading' | 'other';
  classroom_id: string;
  id: string;
  max_score: number | string;
  status: 'draft' | 'published' | 'archived';
  subject_name: string;
  title: string;
  weight: number | string;
}

interface ScoreEntryRow {
  assessment_id: string;
  id: string;
  note: string | null;
  score: number | string | null;
  student_id: string;
}

interface BehaviorRecordRow {
  behavior_date: string;
  category: string;
  created_at: string;
  description: string;
  follow_up_status: 'none' | 'watch' | 'contact_guardian' | 'referred' | 'resolved';
  id: string;
  points: number | string;
  student_id: string;
  tone: 'positive' | 'concern' | 'support' | 'discipline';
}

interface HomeVisitReportRow {
  academic_year: string | null;
  completion_percent: number | null;
  id: string;
  status: 'draft' | 'ready' | 'submitted' | 'certified' | 'archived';
  student_id: string;
  term: string | null;
  visited_at: string | null;
}

interface CoreReportMetrics {
  attendance: {
    presentRate: number;
    riskCount: number;
    total: number;
  };
  behavior: {
    followUps: number;
    positiveCount: number;
    totalPoints: number;
  };
  savings: {
    accountCount: number;
    totalBalance: number;
  };
  scores: {
    assessmentCount: number;
    averagePercent: number;
    belowHalfCount: number;
  };
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
];

const demoSessions: AttendanceSessionRow[] = [
  { attendance_date: new Date().toISOString().slice(0, 10), classroom_id: 'demo-classroom', id: 'demo-session-1', period_label: 'เช้า', subject_name: 'โฮมรูม' },
];

const demoRecords: AttendanceRecordRow[] = [
  { note: null, session_id: 'demo-session-1', status: 'present', student_id: 'demo-student-1' },
  { note: 'มาสาย 10 นาที', session_id: 'demo-session-1', status: 'late', student_id: 'demo-student-2' },
  { note: 'ผู้ปกครองแจ้งลา', session_id: 'demo-session-1', status: 'leave', student_id: 'demo-student-3' },
];

const demoSavingsAccounts: SavingsAccountRow[] = [
  { balance: 420, id: 'demo-saving-account-1', status: 'active', student_id: 'demo-student-1' },
  { balance: 260, id: 'demo-saving-account-2', status: 'active', student_id: 'demo-student-2' },
  { balance: 315, id: 'demo-saving-account-3', status: 'active', student_id: 'demo-student-3' },
];

const demoSavingsTransactions: SavingsTransactionRow[] = [
  { amount: 20, created_at: new Date().toISOString(), id: 'demo-saving-tx-1', note: 'ฝากประจำวัน', student_id: 'demo-student-1', transaction_date: getTodayDate(), transaction_type: 'deposit' },
  { amount: 10, created_at: new Date().toISOString(), id: 'demo-saving-tx-2', note: 'ถอนซื้ออุปกรณ์', student_id: 'demo-student-2', transaction_date: getTodayDate(), transaction_type: 'withdrawal' },
];

const demoScoreAssessments: ScoreAssessmentRow[] = [
  { assessment_date: getTodayDate(), category: 'midterm', classroom_id: 'demo-classroom', id: 'demo-score-1', max_score: 20, status: 'published', subject_name: 'คณิตศาสตร์', title: 'กลางภาค', weight: 30 },
  { assessment_date: getTodayDate(), category: 'final', classroom_id: 'demo-classroom', id: 'demo-score-2', max_score: 30, status: 'published', subject_name: 'คณิตศาสตร์', title: 'ปลายภาค', weight: 30 },
];

const demoScoreEntries: ScoreEntryRow[] = [
  { assessment_id: 'demo-score-1', id: 'demo-entry-1', note: null, score: 16, student_id: 'demo-student-1' },
  { assessment_id: 'demo-score-1', id: 'demo-entry-2', note: null, score: 14, student_id: 'demo-student-2' },
  { assessment_id: 'demo-score-2', id: 'demo-entry-3', note: null, score: 25, student_id: 'demo-student-1' },
];

const demoBehaviorRecords: BehaviorRecordRow[] = [
  { behavior_date: getTodayDate(), category: 'ช่วยเหลือเพื่อน', created_at: new Date().toISOString(), description: 'ช่วยเพื่อนเก็บอุปกรณ์หลังเลิกเรียน', follow_up_status: 'none', id: 'demo-behavior-1', points: 3, student_id: 'demo-student-1', tone: 'positive' },
  { behavior_date: getTodayDate(), category: 'งานไม่ครบ', created_at: new Date().toISOString(), description: 'ค้างใบงาน นัดติดตามในคาบโฮมรูม', follow_up_status: 'watch', id: 'demo-behavior-2', points: -2, student_id: 'demo-student-2', tone: 'concern' },
];

const demoHomeVisits: HomeVisitReportRow[] = [
  { academic_year: '2569', completion_percent: 43, id: 'demo-home-visit-1', status: 'draft', student_id: 'demo-student-1', term: '1', visited_at: getTodayDate() },
];

const emptyCoreMetrics: CoreReportMetrics = {
  attendance: {
    presentRate: 0,
    riskCount: 0,
    total: 0,
  },
  behavior: {
    followUps: 0,
    positiveCount: 0,
    totalPoints: 0,
  },
  savings: {
    accountCount: 0,
    totalBalance: 0,
  },
  scores: {
    assessmentCount: 0,
    averagePercent: 0,
    belowHalfCount: 0,
  },
};

const statusLabels: Record<AttendanceStatus, string> = {
  present: 'มา',
  absent: 'ขาด',
  late: 'สาย',
  leave: 'ลา',
  sick: 'ป่วย',
  activity: 'กิจกรรม',
};

const statusOrder: AttendanceStatus[] = ['present', 'absent', 'late', 'leave', 'sick', 'activity'];

const reportViews: Array<{ description: string; label: string; value: ReportView }> = [
  { description: 'รายเดือน / เทอม / ปีการศึกษา', label: 'เวลาเรียน', value: 'attendance' },
  { description: 'เงินฝาก ถอน และยอดคงเหลือ', label: 'เงินออม', value: 'savings' },
  { description: 'สรุปคะแนนรวมห้องและรายชั้น', label: 'คะแนนรวมห้อง', value: 'scores' },
  { description: 'รวมเวลาเรียน คะแนน เงินออม พฤติกรรม', label: 'รายบุคคล', value: 'individual' },
  { description: 'เคสดูแลและพฤติกรรมที่ต้องติดตาม', label: 'พฤติกรรม/เคสดูแล', value: 'behavior' },
  { description: 'ห้วงเวลาเทอม โลโก้ ลายเซ็น template', label: 'ตั้งค่ารายงาน', value: 'settings' },
];

const reportPeriods: Array<{ label: string; value: ReportPeriod }> = [
  { label: 'เดือน', value: 'month' },
  { label: 'เทอม', value: 'term' },
  { label: 'ปีการศึกษา', value: 'year' },
];

const scoreCategoryLabels: Record<ScoreAssessmentRow['category'], string> = {
  assignment: 'งาน/ใบงาน',
  exam: 'สอบ',
  final: 'ปลายภาค',
  midterm: 'กลางภาค',
  other: 'อื่น ๆ',
  project: 'โครงงาน',
  quiz: 'แบบทดสอบ',
  reading: 'อ่านเขียน',
};

const savingsTransactionLabels: Record<SavingsTransactionRow['transaction_type'], string> = {
  adjustment: 'ปรับยอด',
  deposit: 'ฝาก',
  withdrawal: 'ถอน',
};

const toneLabels: Record<BehaviorRecordRow['tone'], string> = {
  concern: 'ต้องดูแล',
  discipline: 'วินัย',
  positive: 'เชิงบวก',
  support: 'สนับสนุน',
};

const followUpLabels: Record<BehaviorRecordRow['follow_up_status'], string> = {
  contact_guardian: 'ติดต่อผู้ปกครอง',
  none: 'ไม่ต้องติดตาม',
  referred: 'ส่งต่อ',
  resolved: 'ปิดเคสแล้ว',
  watch: 'เฝ้าดู',
};

const monthlyStatusLabels: Record<'absent' | 'late' | 'leave' | 'present', string> = {
  present: 'มา',
  late: 'สาย',
  leave: 'ลา',
  absent: 'ขาด',
};

const monthlyStatusAbbreviations: Record<AttendanceStatus, string> = {
  present: 'มา',
  late: 'ส',
  leave: 'ล',
  sick: 'ป',
  absent: 'ข',
  activity: 'ก',
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function formatBaht(value: number) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getReportMonthContext(dateValue: string) {
  const monthDate = parseLocalDate(dateValue);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const days = Array.from({ length: new Date(year, monthIndex + 1, 0).getDate() }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, monthIndex, day);

    return {
      day,
      dateKey: formatDateKey(year, monthIndex, day),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });

  return {
    days,
    monthLabel: new Intl.DateTimeFormat('th-TH', {
      month: 'long',
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
    }).format(monthDate),
    year,
  };
}

function getMonthDateRange(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  const safeDate = year && month ? new Date(year, month - 1, 1) : new Date();
  const safeYear = safeDate.getFullYear();
  const safeMonth = safeDate.getMonth();

  return {
    from: formatDateKey(safeYear, safeMonth, 1),
    to: formatDateKey(safeYear, safeMonth, new Date(safeYear, safeMonth + 1, 0).getDate()),
  };
}

function academicYearToGregorianStart(academicYear: string | null | undefined) {
  const numericYear = Number(String(academicYear || '').replace(/\D/g, ''));
  if (!numericYear) return new Date().getFullYear();
  return numericYear > 2400 ? numericYear - 543 : numericYear;
}

function isReportView(value: string | null): value is ReportView {
  return reportViews.some((item) => item.value === value);
}

function isReportPeriod(value: string | null): value is ReportPeriod {
  return reportPeriods.some((item) => item.value === value);
}

function buildReportRows(
  classrooms: ClassroomRow[],
  students: StudentRow[],
  sessions: AttendanceSessionRow[],
  records: AttendanceRecordRow[],
) {
  return records.map((record) => {
    const session = sessions.find((item) => item.id === record.session_id);
    const student = students.find((item) => item.id === record.student_id);
    const classroom = classrooms.find((item) => item.id === session?.classroom_id || item.id === student?.classroom_id);

    return {
      classroomName: classroom?.name || '-',
      date: session?.attendance_date || '-',
      note: record.note || '',
      periodLabel: session?.period_label || '-',
      status: record.status,
      studentCode: student?.student_code || '-',
      studentName: student ? `${student.first_name} ${student.last_name}` : '-',
      subjectName: session?.subject_name || '-',
    };
  });
}

interface MonthlyAttendanceRow {
  dailyStatuses: Record<string, AttendanceStatus | null>;
  studentCode: string;
  studentName: string;
  totals: Record<'absent' | 'late' | 'leave' | 'present', number>;
}

interface MonthlyAttendanceGrid {
  classroom: ClassroomRow | null;
  dayTotals: Record<number, number>;
  rows: MonthlyAttendanceRow[];
  summary: Record<'absent' | 'late' | 'leave' | 'present', number>;
}

function toMonthlySummaryStatus(status: AttendanceStatus | null): 'absent' | 'late' | 'leave' | 'present' | null {
  if (!status) return null;
  if (status === 'present' || status === 'activity') return 'present';
  if (status === 'late') return 'late';
  if (status === 'leave' || status === 'sick') return 'leave';
  return 'absent';
}

function buildMonthlyAttendanceGrid({
  attendanceRecords,
  attendanceSessions,
  classroomId,
  classrooms,
  dateFrom,
  students,
}: {
  attendanceRecords: AttendanceRecordRow[];
  attendanceSessions: AttendanceSessionRow[];
  classroomId: string;
  classrooms: ClassroomRow[];
  dateFrom: string;
  students: StudentRow[];
}): MonthlyAttendanceGrid {
  const { days } = getReportMonthContext(dateFrom);
  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId) || classrooms[0] || null;
  const selectedClassroomId = selectedClassroom?.id || classroomId;
  const classroomStudents = students.filter((student) => !selectedClassroomId || student.classroom_id === selectedClassroomId);
  const sessionsByDate = new Map(
    attendanceSessions
      .filter((session) => !selectedClassroomId || session.classroom_id === selectedClassroomId)
      .map((session) => [session.attendance_date, session]),
  );
  const recordsBySessionStudent = new Map(
    attendanceRecords.map((record) => [`${record.session_id}:${record.student_id}`, record]),
  );
  const summary: MonthlyAttendanceGrid['summary'] = {
    present: 0,
    late: 0,
    leave: 0,
    absent: 0,
  };
  const dayTotals: MonthlyAttendanceGrid['dayTotals'] = {};

  const rows = classroomStudents.map((student) => {
    const dailyStatuses: MonthlyAttendanceRow['dailyStatuses'] = {};
    const totals: MonthlyAttendanceRow['totals'] = {
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
    };

    days.forEach((day) => {
      const session = sessionsByDate.get(day.dateKey);
      const record = session ? recordsBySessionStudent.get(`${session.id}:${student.id}`) : null;
      const status = record?.status || null;
      const summaryStatus = toMonthlySummaryStatus(status);
      dailyStatuses[day.dateKey] = status;

      if (summaryStatus) {
        totals[summaryStatus] += 1;
        summary[summaryStatus] += 1;
        dayTotals[day.day] = (dayTotals[day.day] || 0) + 1;
      }
    });

    return {
      dailyStatuses,
      studentCode: student.student_code || '-',
      studentName: `${student.first_name} ${student.last_name}`,
      totals,
    };
  });

  return {
    classroom: selectedClassroom,
    dayTotals,
    rows,
    summary,
  };
}

function buildPrintableReportHtml({
  attendanceGrid,
  dateFrom,
  teacherName,
  schoolName,
  workspaceName,
}: {
  attendanceGrid: MonthlyAttendanceGrid;
  dateFrom: string;
  teacherName: string;
  schoolName: string;
  workspaceName: string;
}) {
  const { days, monthLabel } = getReportMonthContext(dateFrom);
  const dayHeaders = days
    .map(
      (day) => `
        <th class="${day.isWeekend ? 'weekend' : ''}">${day.day}</th>
      `,
    )
    .join('');
  const studentRows = attendanceGrid.rows
    .map((row, index) => {
      const dayCells = days
        .map((day) => {
          const status = row.dailyStatuses[day.dateKey];
          return `<td class="day ${day.isWeekend ? 'weekend' : ''}">${status ? escapeHtml(monthlyStatusAbbreviations[status]) : ''}</td>`;
        })
        .join('');

      return `
        <tr>
          <td class="number">${index + 1}</td>
          <td class="name">${escapeHtml(row.studentName)}</td>
          ${dayCells}
          <td class="sum present">${row.totals.present}</td>
          <td class="sum late">${row.totals.late}</td>
          <td class="sum leave">${row.totals.leave}</td>
          <td class="sum absent">${row.totals.absent}</td>
        </tr>
      `;
    })
    .join('');
  const totalCells = days
    .map((day) => `<td class="day total ${day.isWeekend ? 'weekend' : ''}">${attendanceGrid.dayTotals[day.day] || ''}</td>`)
    .join('');
  const summaryCards = (['present', 'late', 'leave', 'absent'] as const)
    .map(
      (key) => `
        <div class="summary-card">
          <span>${monthlyStatusLabels[key]}</span>
          <strong>${attendanceGrid.summary[key].toLocaleString('th-TH')}</strong>
        </div>
      `,
    )
    .join('');
  const classroomName = attendanceGrid.classroom?.name || workspaceName || '-';
  const academicYear = attendanceGrid.classroom?.academic_year || '-';

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ClassCare 360 - รายงานเวลาเรียนรายเดือน</title>
        <style>
          @page { margin: 8mm; size: A4 landscape; }
          * { box-sizing: border-box; }
          body {
            color: #07111f;
            font-family: "TH Sarabun New", "Noto Sans Thai", Tahoma, Arial, sans-serif;
            line-height: 1.25;
            margin: 0;
          }
          header {
            border-bottom: 3px solid #2458ff;
            display: grid;
            gap: 12px;
            grid-template-columns: 74px minmax(0,1fr) 74px;
            padding: 10px 0 8px;
            text-align: center;
          }
          .logo {
            align-items: center;
            border: 1px solid #bfdbfe;
            border-radius: 18px;
            color: #0369a1;
            display: flex;
            font-size: 14px;
            font-weight: 900;
            height: 56px;
            justify-content: center;
            width: 56px;
          }
          h1 { font-size: 24px; margin: 0; }
          .subtitle { font-size: 15px; font-weight: 700; margin: 2px 0; }
          .classline { font-size: 14px; font-weight: 700; margin: 8px 0 6px; }
          .summary-grid {
            display: grid;
            gap: 6px;
            grid-template-columns: repeat(4, 1fr);
            margin: 8px 0;
          }
          .summary-card {
            background: #eff6ff;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            padding: 8px;
            text-align: center;
          }
          .summary-card span { display: block; font-size: 13px; font-weight: 800; }
          .summary-card strong { color: #1d4ed8; display: block; font-size: 20px; margin-top: 2px; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          th, td {
            border: 1px solid #111827;
            font-size: 11px;
            height: 18px;
            padding: 2px 3px;
            text-align: center;
            vertical-align: middle;
          }
          th { background: #f4a3cf; font-weight: 900; }
          th.name, td.name { text-align: left; width: 190px; }
          th.number, td.number { width: 34px; }
          .day { width: 22px; }
          .weekend { background: #cfd6df !important; }
          .present { color: #047857; font-weight: 900; }
          .late { color: #b45309; font-weight: 900; }
          .leave { color: #075985; font-weight: 900; }
          .absent { color: #be123c; font-weight: 900; }
          .sum { background: #fff7cc; width: 38px; }
          .total { background: #ffe4e6; font-weight: 900; }
          tfoot td { background: #ffe4e6; font-weight: 900; }
          .signatures {
            display: grid;
            gap: 100px;
            grid-template-columns: 1fr 1fr;
            margin-top: 28px;
            text-align: center;
          }
          .signature-line { border-bottom: 1px dotted #111827; display: inline-block; min-width: 230px; }
          .role { font-weight: 800; margin-top: 5px; }
        </style>
      </head>
      <body>
        <header>
          <div class="logo">C360</div>
          <div>
            <h1>รายงานเวลาเรียนระดับชั้น ${escapeHtml(classroomName)} ประจำเดือน ${escapeHtml(monthLabel)}</h1>
            <p class="subtitle">${escapeHtml(schoolName)} · ภาคเรียนที่ 1 ปีการศึกษา ${escapeHtml(academicYear)}</p>
            <p class="subtitle">เดือน${escapeHtml(monthLabel)}</p>
          </div>
          <div></div>
        </header>
        <p class="classline">ระดับชั้น: ${escapeHtml(classroomName)}</p>
        <section class="summary-grid">${summaryCards}</section>
        <table>
          <thead>
            <tr>
              <th class="number">เลขที่</th>
              <th class="name">ชื่อ-นามสกุล</th>
              ${dayHeaders}
              <th>มา</th>
              <th>สาย</th>
              <th>ลา</th>
              <th>ขาด</th>
            </tr>
          </thead>
          <tbody>${studentRows}</tbody>
          <tfoot>
            <tr>
              <td></td>
              <td class="name">รวม</td>
              ${totalCells}
              <td>${attendanceGrid.summary.present}</td>
              <td>${attendanceGrid.summary.late}</td>
              <td>${attendanceGrid.summary.leave}</td>
              <td>${attendanceGrid.summary.absent}</td>
            </tr>
          </tfoot>
        </table>
        <section class="signatures">
          <div>
            <span>ลงชื่อ</span><span class="signature-line"></span>
            <div>(${escapeHtml(teacherName)})</div>
            <div class="role">ครูประจำชั้น</div>
          </div>
          <div>
            <span>ลงชื่อ</span><span class="signature-line"></span>
            <div>(................................................)</div>
            <div class="role">ผู้อำนวยการโรงเรียน</div>
          </div>
        </section>
      </body>
    </html>`;
}

export function ReportsPage({ session }: ReportsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const reportViewParam = searchParams.get('reportView');
  const reportPeriodParam = searchParams.get('reportPeriod');
  const initialReportView: ReportView = isReportView(reportViewParam) ? reportViewParam : 'attendance';
  const initialReportPeriod: ReportPeriod = isReportPeriod(reportPeriodParam) ? reportPeriodParam : 'month';
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionRow[]>(demoSessions);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>(demoRecords);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccountRow[]>(demoSavingsAccounts);
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransactionRow[]>(demoSavingsTransactions);
  const [scoreAssessments, setScoreAssessments] = useState<ScoreAssessmentRow[]>(demoScoreAssessments);
  const [scoreEntries, setScoreEntries] = useState<ScoreEntryRow[]>(demoScoreEntries);
  const [behaviorRecords, setBehaviorRecords] = useState<BehaviorRecordRow[]>(demoBehaviorRecords);
  const [homeVisits, setHomeVisits] = useState<HomeVisitReportRow[]>(demoHomeVisits);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [reportView, setReportView] = useState<ReportView>(initialReportView);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>(initialReportPeriod);
  const [reportMonth, setReportMonth] = useState(getTodayDate().slice(0, 7));
  const [selectedTerm, setSelectedTerm] = useState<TermKey>('term1');
  const [termRanges, setTermRanges] = useState<Record<TermKey, { end: string; start: string }>>({
    term1: { end: '2026-10-10', start: '2026-05-16' },
    term2: { end: '2027-03-31', start: '2026-11-01' },
  });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [dateFrom, setDateFrom] = useState(getTodayDate());
  const [dateTo, setDateTo] = useState(getTodayDate());
  const [query, setQuery] = useState('');
  const [coreMetrics, setCoreMetrics] = useState<CoreReportMetrics>(emptyCoreMetrics);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อออกรายงานจาก Supabase จริง',
  );

  useEffect(() => {
    const nextView = searchParams.get('reportView');
    const nextPeriod = searchParams.get('reportPeriod');
    if (isReportView(nextView)) setReportView(nextView);
    if (isReportPeriod(nextPeriod)) setReportPeriod(nextPeriod);
  }, [searchParams]);

  function updateReportSearch(next: Partial<{ reportPeriod: ReportPeriod; reportView: ReportView }>) {
    const params = new URLSearchParams(location.search);
    if (next.reportView) {
      params.set('view', 'reports');
      params.set('reportView', next.reportView);
      setReportView(next.reportView);
    }
    if (next.reportPeriod) {
      params.set('reportPeriod', next.reportPeriod);
      setReportPeriod(next.reportPeriod);
    }
    navigate(`/app/dashboard?${params.toString()}`, { replace: false });
  }

  useEffect(() => {
    if (reportPeriod === 'month') {
      const range = getMonthDateRange(reportMonth);
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    }

    if (reportPeriod === 'term') {
      setDateFrom(termRanges[selectedTerm].start);
      setDateTo(termRanges[selectedTerm].end);
      return;
    }

    const academicYear = classrooms.find((classroom) => classroom.id === classroomId)?.academic_year || session.workspace?.academicYear;
    const startYear = academicYearToGregorianStart(academicYear);
    setDateFrom(`${startYear}-05-01`);
    setDateTo(`${startYear + 1}-04-30`);
  }, [classroomId, classrooms, reportMonth, reportPeriod, selectedTerm, session.workspace?.academicYear, termRanges]);

  useEffect(() => {
    let isMounted = true;

    async function loadReportData() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setAttendanceSessions(demoSessions);
        setAttendanceRecords(demoRecords);
        setSavingsAccounts(demoSavingsAccounts);
        setSavingsTransactions(demoSavingsTransactions);
        setScoreAssessments(demoScoreAssessments);
        setScoreEntries(demoScoreEntries);
        setBehaviorRecords(demoBehaviorRecords);
        setHomeVisits(demoHomeVisits);
        setCoreMetrics({
          attendance: {
            presentRate: 67,
            riskCount: 2,
            total: demoRecords.length,
          },
          behavior: {
            followUps: 1,
            positiveCount: demoBehaviorRecords.filter((record) => record.tone === 'positive').length,
            totalPoints: demoBehaviorRecords.reduce((sum, record) => sum + Number(record.points || 0), 0),
          },
          savings: {
            accountCount: demoSavingsAccounts.length,
            totalBalance: demoSavingsAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
          },
          scores: {
            assessmentCount: demoScoreAssessments.length,
            averagePercent: 80,
            belowHalfCount: 0,
          },
        });
        setClassroomId(demoClassrooms[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: sessionRows, error: sessionError },
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id,name,academic_year')
          .eq('workspace_id', session.workspace.id)
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,classroom_id')
          .eq('workspace_id', session.workspace.id)
          .order('student_code', { ascending: true }),
        supabase
          .from('attendance_sessions')
          .select('id,classroom_id,attendance_date,period_label,subject_name')
          .eq('workspace_id', session.workspace.id)
          .gte('attendance_date', dateFrom)
          .lte('attendance_date', dateTo)
          .order('attendance_date', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || sessionError) {
        setNotice(classroomError?.message || studentError?.message || sessionError?.message || 'โหลดข้อมูลรายงานไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextSessions = (sessionRows || []) as AttendanceSessionRow[];
      const sessionIds = nextSessions.map((item) => item.id);
      let nextRecords: AttendanceRecordRow[] = [];

      if (sessionIds.length > 0) {
        const { data: recordRows, error: recordError } = await supabase
          .from('attendance_records')
          .select('session_id,student_id,status,note')
          .eq('workspace_id', session.workspace.id)
          .in('session_id', sessionIds);

        if (!isMounted) return;

        if (recordError) {
          setNotice(recordError.message);
          setIsLoading(false);
          return;
        }

        nextRecords = (recordRows || []) as AttendanceRecordRow[];
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      setClassrooms(nextClassrooms);
      setStudents((studentRows || []) as StudentRow[]);
      setAttendanceSessions(nextSessions);
      setAttendanceRecords(nextRecords);
      setClassroomId((current) => current || nextClassrooms[0]?.id || '');

      const [
        { data: assessmentRows, error: assessmentError },
        { data: accountRows, error: accountError },
        { data: transactionRows, error: transactionError },
        { data: behaviorRows, error: behaviorError },
        { data: homeVisitRows, error: homeVisitError },
      ] = await Promise.all([
        supabase
          .from('score_assessments')
          .select('id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status')
          .eq('workspace_id', session.workspace.id)
          .gte('assessment_date', dateFrom)
          .lte('assessment_date', dateTo)
          .order('assessment_date', { ascending: false })
          .limit(1000),
        supabase
          .from('savings_accounts')
          .select('id,student_id,balance,status')
          .eq('workspace_id', session.workspace.id)
          .limit(1000),
        supabase
          .from('savings_transactions')
          .select('id,student_id,transaction_type,amount,transaction_date,note,created_at')
          .eq('workspace_id', session.workspace.id)
          .gte('transaction_date', dateFrom)
          .lte('transaction_date', dateTo)
          .order('transaction_date', { ascending: false })
          .limit(1000),
        supabase
          .from('behavior_records')
          .select('id,student_id,tone,category,description,points,follow_up_status,behavior_date,created_at')
          .eq('workspace_id', session.workspace.id)
          .gte('behavior_date', dateFrom)
          .lte('behavior_date', dateTo)
          .order('behavior_date', { ascending: false })
          .limit(1000),
        supabase
          .from('student_home_visits')
          .select('id,student_id,academic_year,term,status,completion_percent,visited_at')
          .eq('workspace_id', session.workspace.id)
          .limit(1000),
      ]);

      if (assessmentError || accountError || transactionError || behaviorError || homeVisitError) {
        setNotice(
          assessmentError?.message ||
            accountError?.message ||
            transactionError?.message ||
            behaviorError?.message ||
            homeVisitError?.message ||
            'โหลดข้อมูลรายงานบางส่วนไม่สำเร็จ',
        );
      }

      const nextAssessments = (assessmentRows || []) as ScoreAssessmentRow[];
      const nextAssessmentIds = nextAssessments.map((assessment) => assessment.id);
      let nextScoreEntries: ScoreEntryRow[] = [];

      if (nextAssessmentIds.length > 0) {
        const { data: entryRows, error: entryError } = await supabase
          .from('score_entries')
          .select('id,assessment_id,student_id,score,note')
          .eq('workspace_id', session.workspace.id)
          .in('assessment_id', nextAssessmentIds);

        if (!isMounted) return;

        if (entryError) {
          setNotice(entryError.message);
        } else {
          nextScoreEntries = (entryRows || []) as ScoreEntryRow[];
        }
      }

      const nextSavingsAccounts = (accountRows || []) as SavingsAccountRow[];
      const nextSavingsTransactions = (transactionRows || []) as SavingsTransactionRow[];
      const nextBehaviorRecords = (behaviorRows || []) as BehaviorRecordRow[];
      const nextHomeVisits = (homeVisitRows || []) as HomeVisitReportRow[];
      setScoreAssessments(nextAssessments);
      setScoreEntries(nextScoreEntries);
      setSavingsAccounts(nextSavingsAccounts);
      setSavingsTransactions(nextSavingsTransactions);
      setBehaviorRecords(nextBehaviorRecords);
      setHomeVisits(nextHomeVisits);

      const scorePercents = nextScoreEntries
        .map((row) => {
          const assessment = nextAssessments.find((item) => item.id === row.assessment_id);
          const maxScore = Number(assessment?.max_score || 0);
          const score = Number(row.score || 0);
          return maxScore > 0 ? (score / maxScore) * 100 : null;
        })
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const presentCount = nextRecords.filter((record) => record.status === 'present').length;
      const riskCount = nextRecords.filter((record) => ['absent', 'late', 'leave', 'sick'].includes(record.status)).length;

      setCoreMetrics({
        attendance: {
          presentRate: nextRecords.length > 0 ? Math.round((presentCount / nextRecords.length) * 100) : 0,
          riskCount,
          total: nextRecords.length,
        },
        behavior: {
          followUps: nextBehaviorRecords.filter((row) => row.follow_up_status && !['none', 'resolved'].includes(row.follow_up_status)).length,
          positiveCount: nextBehaviorRecords.filter((row) => row.tone === 'positive').length,
          totalPoints: nextBehaviorRecords.reduce((sum, row) => sum + Number(row.points || 0), 0),
        },
        savings: {
          accountCount: nextSavingsAccounts.filter((row) => row.status === 'active').length,
          totalBalance: round(nextSavingsAccounts.reduce((sum, row) => sum + Number(row.balance || 0), 0)),
        },
        scores: {
          assessmentCount: nextAssessments.length,
          averagePercent: scorePercents.length > 0 ? round(scorePercents.reduce((sum, value) => sum + value, 0) / scorePercents.length) : 0,
          belowHalfCount: scorePercents.filter((value) => value < 50).length,
        },
      });
      setIsLoading(false);
    }

    void loadReportData();

    return () => {
      isMounted = false;
    };
  }, [dateFrom, dateTo, session.workspace]);

  const reportRows = useMemo(() => {
    const rows = buildReportRows(classrooms, students, attendanceSessions, attendanceRecords);
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (classroomId && row.classroomName !== classrooms.find((item) => item.id === classroomId)?.name) return false;
      if (!normalizedQuery) return true;

      return [row.studentCode, row.studentName, row.status, statusLabels[row.status], row.note]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [attendanceRecords, attendanceSessions, classroomId, classrooms, query, students]);

  const summary = useMemo(
    () =>
      statusOrder.map((status) => ({
        count: reportRows.filter((row) => row.status === status).length,
        label: statusLabels[status],
        status,
      })),
    [reportRows],
  );

  const monthlyAttendanceGrid = useMemo(
    () =>
      buildMonthlyAttendanceGrid({
        attendanceRecords,
        attendanceSessions,
        classroomId,
        classrooms,
        dateFrom,
        students,
      }),
    [attendanceRecords, attendanceSessions, classroomId, classrooms, dateFrom, students],
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === classroomId) || classrooms[0] || null,
    [classroomId, classrooms],
  );
  const classroomStudents = useMemo(
    () => students.filter((student) => !selectedClassroom || student.classroom_id === selectedClassroom.id),
    [selectedClassroom, students],
  );
  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || classroomStudents[0] || students[0] || null,
    [classroomStudents, selectedStudentId, students],
  );
  const classroomStudentIds = useMemo(() => new Set(classroomStudents.map((student) => student.id)), [classroomStudents]);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const savingsAccountByStudent = useMemo(
    () => new Map(savingsAccounts.map((account) => [account.student_id, account])),
    [savingsAccounts],
  );
  const classroomSavingsTransactions = useMemo(
    () => savingsTransactions.filter((transaction) => classroomStudentIds.has(transaction.student_id)),
    [classroomStudentIds, savingsTransactions],
  );
  const savingsReportRows = useMemo(
    () =>
      classroomStudents.map((student) => {
        const account = savingsAccountByStudent.get(student.id);
        const transactions = classroomSavingsTransactions.filter((transaction) => transaction.student_id === student.id);
        const deposits = transactions
          .filter((transaction) => transaction.transaction_type === 'deposit')
          .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const withdrawals = transactions
          .filter((transaction) => transaction.transaction_type === 'withdrawal')
          .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

        return {
          balance: Number(account?.balance || 0),
          deposits,
          latestDate: transactions[0]?.transaction_date || '-',
          student,
          transactionCount: transactions.length,
          withdrawals,
        };
      }),
    [classroomSavingsTransactions, classroomStudents, savingsAccountByStudent],
  );
  const classroomScoreAssessments = useMemo(
    () =>
      scoreAssessments.filter(
        (assessment) =>
          (!selectedClassroom || assessment.classroom_id === selectedClassroom.id) &&
          assessment.status !== 'archived',
      ),
    [scoreAssessments, selectedClassroom],
  );
  const scoreEntriesByAssessment = useMemo(() => {
    const map = new Map<string, ScoreEntryRow[]>();
    scoreEntries.forEach((entry) => {
      const rows = map.get(entry.assessment_id) || [];
      rows.push(entry);
      map.set(entry.assessment_id, rows);
    });
    return map;
  }, [scoreEntries]);
  const scoreAssessmentRows = useMemo(
    () =>
      classroomScoreAssessments.map((assessment) => {
        const entries = (scoreEntriesByAssessment.get(assessment.id) || []).filter((entry) => classroomStudentIds.has(entry.student_id));
        const enteredEntries = entries.filter((entry) => entry.score !== null && entry.score !== undefined);
        const maxScore = Number(assessment.max_score || 0);
        const averageScore =
          enteredEntries.length > 0
            ? enteredEntries.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / enteredEntries.length
            : 0;

        return {
          assessment,
          averagePercent: maxScore > 0 ? round((averageScore / maxScore) * 100) : 0,
          averageScore: round(averageScore),
          enteredCount: enteredEntries.length,
          missingCount: Math.max(classroomStudents.length - enteredEntries.length, 0),
        };
      }),
    [classroomScoreAssessments, classroomStudentIds, classroomStudents.length, scoreEntriesByAssessment],
  );
  const scoreSubjectRows = useMemo(() => {
    const map = new Map<string, { assessmentCount: number; averagePercent: number; enteredCount: number; subject: string }>();
    scoreAssessmentRows.forEach((row) => {
      const current = map.get(row.assessment.subject_name) || {
        assessmentCount: 0,
        averagePercent: 0,
        enteredCount: 0,
        subject: row.assessment.subject_name,
      };
      current.assessmentCount += 1;
      current.enteredCount += row.enteredCount;
      current.averagePercent += row.averagePercent;
      map.set(row.assessment.subject_name, current);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      averagePercent: row.assessmentCount > 0 ? round(row.averagePercent / row.assessmentCount) : 0,
    }));
  }, [scoreAssessmentRows]);
  const behaviorReportRows = useMemo(
    () => behaviorRecords.filter((record) => classroomStudentIds.has(record.student_id)),
    [behaviorRecords, classroomStudentIds],
  );
  const selectedStudentAttendanceRecords = useMemo(
    () => (selectedStudent ? attendanceRecords.filter((record) => record.student_id === selectedStudent.id) : []),
    [attendanceRecords, selectedStudent],
  );
  const selectedStudentScoreEntries = useMemo(() => {
    if (!selectedStudent) return [];
    const assessmentById = new Map(classroomScoreAssessments.map((assessment) => [assessment.id, assessment]));
    return scoreEntries
      .filter((entry) => entry.student_id === selectedStudent.id && assessmentById.has(entry.assessment_id))
      .map((entry) => ({ assessment: assessmentById.get(entry.assessment_id), entry }));
  }, [classroomScoreAssessments, scoreEntries, selectedStudent]);
  const selectedStudentSavingsTransactions = useMemo(
    () => (selectedStudent ? classroomSavingsTransactions.filter((transaction) => transaction.student_id === selectedStudent.id) : []),
    [classroomSavingsTransactions, selectedStudent],
  );
  const selectedStudentBehaviorRecords = useMemo(
    () => (selectedStudent ? behaviorReportRows.filter((record) => record.student_id === selectedStudent.id) : []),
    [behaviorReportRows, selectedStudent],
  );
  const selectedHomeVisit = useMemo(
    () => (selectedStudent ? homeVisits.find((visit) => visit.student_id === selectedStudent.id && visit.status !== 'archived') || null : null),
    [homeVisits, selectedStudent],
  );
  const selectedStudentScoreAverage = useMemo(() => {
    const percents = selectedStudentScoreEntries
      .map(({ assessment, entry }) => {
        const maxScore = Number(assessment?.max_score || 0);
        return maxScore > 0 && entry.score !== null && entry.score !== undefined ? (Number(entry.score || 0) / maxScore) * 100 : null;
      })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return percents.length > 0 ? round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : 0;
  }, [selectedStudentScoreEntries]);
  const activeReportConfig = reportViews.find((item) => item.value === reportView) || reportViews[0];
  const periodLabel = reportPeriods.find((item) => item.value === reportPeriod)?.label || 'เดือน';
  const activeReportRowCount =
    reportView === 'attendance'
      ? reportRows.length
      : reportView === 'savings'
        ? classroomSavingsTransactions.length
        : reportView === 'scores'
          ? scoreAssessmentRows.length
          : reportView === 'behavior'
            ? behaviorReportRows.length
            : reportView === 'individual' && selectedStudent
              ? 1
              : 0;
  const exportableAttendance = reportView === 'attendance' && reportRows.length > 0;
  const readinessItems = [
    { label: 'ตั้งค่าห้วงเวลาเทอม', ready: Boolean(termRanges.term1.start && termRanges.term1.end && termRanges.term2.start && termRanges.term2.end) },
    { label: 'เลือกห้อง/ช่วงข้อมูล', ready: Boolean(classroomId && dateFrom && dateTo) },
    { label: 'มีรายชื่อนักเรียนในห้อง', ready: classroomStudents.length > 0 },
    { label: 'มีข้อมูลรายงานช่วงนี้', ready: activeReportRowCount > 0 || reportView === 'settings' },
  ];

  useEffect(() => {
    if (!selectedStudentId && students[0]) {
      setSelectedStudentId(students[0].id);
      return;
    }
    if (selectedStudentId && !students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0]?.id || '');
    }
  }, [selectedStudentId, students]);

  function exportCsv() {
    const headers = ['วันที่', 'ช่วงเวลา', 'ห้องเรียน', 'รหัส', 'นักเรียน', 'สถานะ', 'หมายเหตุ', 'เครดิต'];
    const lines = [
      headers.map(escapeCsv).join(','),
      ...reportRows.map((row) =>
        [
          row.date,
          row.periodLabel,
          row.classroomName,
          row.studentCode,
          row.studentName,
          statusLabels[row.status],
          row.note,
          'Created by MIKPURINUT',
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ];
    downloadBlob(
      `classcare-attendance-${dateFrom}-${dateTo}.csv`,
      new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }),
    );
  }

  function exportExcel() {
    const html = buildPrintableReportHtml({
      attendanceGrid: monthlyAttendanceGrid,
      dateFrom,
      schoolName: session.workspace?.schoolName || 'Demo Workspace',
      teacherName: session.profile.displayName,
      workspaceName: session.workspace?.name || 'Demo Workspace',
    });
    downloadBlob(
      `classcare-attendance-monthly-${dateFrom.slice(0, 7)}.xls`,
      new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    );
  }

  function exportJsonPackage() {
    const activeRows =
      reportView === 'attendance'
        ? reportRows.map((row) => ({ ...row, statusLabel: statusLabels[row.status] }))
        : reportView === 'savings'
          ? savingsReportRows.map((row) => ({
              balance: row.balance,
              deposits: row.deposits,
              latestDate: row.latestDate,
              studentCode: row.student.student_code,
              studentName: `${row.student.first_name} ${row.student.last_name}`,
              transactionCount: row.transactionCount,
              withdrawals: row.withdrawals,
            }))
          : reportView === 'scores'
            ? scoreAssessmentRows.map((row) => ({
                assessmentDate: row.assessment.assessment_date,
                averagePercent: row.averagePercent,
                averageScore: row.averageScore,
                category: row.assessment.category,
                categoryLabel: scoreCategoryLabels[row.assessment.category],
                enteredCount: row.enteredCount,
                missingCount: row.missingCount,
                subjectName: row.assessment.subject_name,
                title: row.assessment.title,
              }))
            : reportView === 'behavior'
              ? behaviorReportRows.map((row) => {
                  const student = studentById.get(row.student_id);
                  return {
                    behaviorDate: row.behavior_date,
                    category: row.category,
                    description: row.description,
                    followUp: followUpLabels[row.follow_up_status],
                    points: row.points,
                    studentCode: student?.student_code || null,
                    studentName: student ? `${student.first_name} ${student.last_name}` : null,
                    tone: toneLabels[row.tone],
                  };
                })
              : reportView === 'individual' && selectedStudent
                ? [
                    {
                      attendanceRecords: selectedStudentAttendanceRecords.length,
                      behaviorRecords: selectedStudentBehaviorRecords.length,
                      homeVisitCompletion: selectedHomeVisit?.completion_percent || 0,
                      savingsBalance: Number(savingsAccountByStudent.get(selectedStudent.id)?.balance || 0),
                      savingsTransactions: selectedStudentSavingsTransactions.length,
                      scoreAverage: selectedStudentScoreAverage,
                      studentCode: selectedStudent.student_code,
                      studentName: `${selectedStudent.first_name} ${selectedStudent.last_name}`,
                    },
                  ]
                : [];
    const payload = {
      createdAt: new Date().toISOString(),
      credit: 'Created by MIKPURINUT',
      filters: {
        classroomId,
        dateFrom,
        dateTo,
        query,
        reportPeriod,
        reportView,
      },
      reportType: reportView,
      coreMetrics,
      rows: activeRows,
      schoolName: session.workspace?.schoolName || 'Demo Workspace',
      summary,
      termRanges,
      timezone: 'Asia/Bangkok',
      workspaceId: session.workspace?.id || 'demo-workspace',
    };

    downloadBlob(
      `classcare-${reportView}-package-${dateFrom}-${dateTo}.json`,
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    );
  }

  function printReport() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNotice('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup แล้วลองอีกครั้ง');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      buildPrintableReportHtml({
        attendanceGrid: monthlyAttendanceGrid,
        dateFrom,
        schoolName: session.workspace?.schoolName || 'Demo Workspace',
        teacherName: session.profile.displayName,
        workspaceName: session.workspace?.name || 'Demo Workspace',
      }),
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="nexus-kicker">
            <FileSpreadsheet size={18} aria-hidden="true" />
            Report Center
          </div>
          <h1 className="app-page-title">
            ศูนย์รายงานโรงเรียน
          </h1>
          <p className="mt-3 max-w-4xl text-sm font-bold leading-7 text-slate-600">
            {session.workspace?.schoolName || 'Demo Workspace'} | เลือกรายงานหลัก แยกช่วงเดือน/เทอม/ปีการศึกษา และเตรียม export จากข้อมูลจริงใน workspace เดียวกัน
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!exportableAttendance}
            onClick={printReport}
            type="button"
          >
            <Printer size={17} aria-hidden="true" />
            PDF/พิมพ์
          </button>
          <button
            className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!exportableAttendance}
            onClick={exportCsv}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            CSV
          </button>
          <button
            className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!exportableAttendance}
            onClick={exportExcel}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            Excel
          </button>
          <button
            className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={activeReportRowCount === 0 && reportView !== 'settings'}
            onClick={exportJsonPackage}
            type="button"
          >
            <Download size={17} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { detail: `${coreMetrics.attendance.riskCount} รายการต้องติดตาม`, label: 'เวลาเรียน', value: `${coreMetrics.attendance.presentRate}%` },
          { detail: `${coreMetrics.scores.assessmentCount} ชุดคะแนน | ต่ำกว่า 50% ${coreMetrics.scores.belowHalfCount}`, label: 'คะแนนเฉลี่ย', value: `${coreMetrics.scores.averagePercent}%` },
          { detail: `${coreMetrics.savings.accountCount} บัญชี active`, label: 'เงินออมรวม', value: coreMetrics.savings.totalBalance.toLocaleString('th-TH') },
          { detail: `ติดตามต่อ ${coreMetrics.behavior.followUps} | เชิงบวก ${coreMetrics.behavior.positiveCount}`, label: 'พฤติกรรม', value: coreMetrics.behavior.totalPoints.toLocaleString('th-TH') },
        ].map((item) => (
          <article className="nexus-card p-4 transition hover:-translate-y-1" key={item.label}>
            <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="nexus-card mt-5 p-3 sm:p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {reportViews.map((item) => {
            const isActive = item.value === reportView;

            return (
              <button
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  isActive
                    ? 'border-amber-300 bg-amber-100 text-amber-950 shadow-[0_14px_28px_rgba(217,119,6,0.12)]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200'
                }`}
                key={item.value}
                onClick={() => updateReportSearch({ reportView: item.value })}
                type="button"
              >
                <span className="text-sm font-black">{item.label}</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{item.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-workbench">
        <aside className="grid gap-4">
          <section className="nexus-card p-4 sm:p-5">
            <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
              <CalendarRange size={16} className="text-amber-600" aria-hidden="true" />
              ตัวกรองรายงาน
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ประเภทรายงาน
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => updateReportSearch({ reportView: event.target.value as ReportView })}
                  value={reportView}
                >
                  {reportViews.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                {reportPeriods.map((period) => (
                  <button
                    className={`h-11 rounded-2xl px-3 text-sm font-black transition ${
                      reportPeriod === period.value ? 'bg-slate-950 text-white shadow-lg' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950'
                    }`}
                    key={period.value}
                    onClick={() => updateReportSearch({ reportPeriod: period.value })}
                    type="button"
                  >
                    {period.label}
                  </button>
                ))}
              </div>

              {reportPeriod === 'month' ? (
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เดือนรายงาน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setReportMonth(event.target.value)}
                    type="month"
                    value={reportMonth}
                  />
                </label>
              ) : null}

              {reportPeriod === 'term' ? (
                <div className="grid gap-3 rounded-3xl border border-amber-200 bg-amber-50/60 p-3">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ภาคเรียน
                    <select
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setSelectedTerm(event.target.value as TermKey)}
                      value={selectedTerm}
                    >
                      <option value="term1">ภาคเรียนที่ 1</option>
                      <option value="term2">ภาคเรียนที่ 2</option>
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      เริ่มเทอม
                      <input
                        className="nexus-field h-11 px-3"
                        onChange={(event) => setTermRanges((current) => ({ ...current, [selectedTerm]: { ...current[selectedTerm], start: event.target.value } }))}
                        type="date"
                        value={termRanges[selectedTerm].start}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      สิ้นสุดเทอม
                      <input
                        className="nexus-field h-11 px-3"
                        onChange={(event) => setTermRanges((current) => ({ ...current, [selectedTerm]: { ...current[selectedTerm], end: event.target.value } }))}
                        type="date"
                        value={termRanges[selectedTerm].end}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <label className="grid gap-2 text-sm font-black text-slate-700">
                ห้องเรียน
                <select className="nexus-field h-11 px-3" onChange={(event) => setClassroomId(event.target.value)} value={classroomId}>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {reportView === 'individual' || reportView === 'behavior' ? (
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  นักเรียน
                  <select className="nexus-field h-11 px-3" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudent?.id || ''}>
                    {classroomStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.student_code || '-'} {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  จากวันที่
                  <input className="nexus-field h-11 px-3" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ถึงวันที่
                  <input className="nexus-field h-11 px-3" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
                </label>
              </div>

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input className="nexus-field h-11 w-full pl-10 pr-3" onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ รหัส สถานะ" value={query} />
              </label>
            </div>
          </section>

          <section className="nexus-card p-4 sm:p-5">
            <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
              <ShieldCheck size={16} className="text-teal-600" aria-hidden="true" />
              Report readiness
            </div>
            <div className="mt-4 grid gap-2">
              {readinessItems.map((item) => (
                <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm font-bold" key={item.label}>
                  <span className="text-slate-600">{item.label}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-black ${item.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.ready ? 'พร้อม' : 'ต้องตั้งค่า'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black text-teal-700">{activeReportConfig.label} / {periodLabel}</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {activeReportConfig.description}
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {selectedClassroom?.name || '-'} | {dateFrom} ถึง {dateTo}
              </p>
            </div>
            <p className="text-xs font-bold text-slate-500">Created by MIKPURINUT</p>
          </div>

          {reportView === 'attendance' ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {summary.map((item) => (
                  <div className="nexus-muted-box p-3 text-center transition hover:-translate-y-1" key={item.status}>
                    <p className="text-2xl font-black text-slate-950">{item.count}</p>
                    <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead>
                    <tr className="text-xs font-black uppercase text-slate-500">
                      <th className="px-3 py-3">วันที่</th>
                      <th className="px-3 py-3">ห้อง</th>
                      <th className="px-3 py-3">นักเรียน</th>
                      <th className="px-3 py-3">สถานะ</th>
                      <th className="px-3 py-3">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {reportRows.map((row, index) => (
                      <tr className="hover:bg-amber-50/50" key={`${row.date}-${row.studentCode}-${index}`}>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">
                          {row.date}
                          <span className="block text-xs text-slate-400">{row.periodLabel}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.classroomName}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">{row.studentName}</p>
                          <p className="text-xs font-bold text-slate-500">{row.studentCode}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                            {statusLabels[row.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-600">{row.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isLoading && reportRows.length === 0 ? (
                <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีข้อมูลเวลาเรียนตามช่วงวันที่และตัวกรองนี้
                </div>
              ) : null}
            </>
          ) : null}

          {reportView === 'savings' ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase text-amber-700">ยอดคงเหลือห้อง</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">{formatBaht(savingsReportRows.reduce((sum, row) => sum + row.balance, 0))}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">บาท</p>
                </article>
                <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase text-emerald-700">ฝากช่วงนี้</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">{formatBaht(savingsReportRows.reduce((sum, row) => sum + row.deposits, 0))}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">บาท</p>
                </article>
                <article className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black uppercase text-rose-700">ถอนช่วงนี้</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">{formatBaht(savingsReportRows.reduce((sum, row) => sum + row.withdrawals, 0))}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">บาท</p>
                </article>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead>
                    <tr className="text-xs font-black uppercase text-slate-500">
                      <th className="px-3 py-3">นักเรียน</th>
                      <th className="px-3 py-3">ฝาก</th>
                      <th className="px-3 py-3">ถอน</th>
                      <th className="px-3 py-3">ยอดคงเหลือ</th>
                      <th className="px-3 py-3">รายการ</th>
                      <th className="px-3 py-3">ล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {savingsReportRows.map((row) => (
                      <tr className="hover:bg-amber-50/50" key={row.student.id}>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">{row.student.first_name} {row.student.last_name}</p>
                          <p className="text-xs font-bold text-slate-500">{row.student.student_code || '-'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-black text-emerald-700">{formatBaht(row.deposits)} ฿</td>
                        <td className="whitespace-nowrap px-3 py-3 font-black text-rose-700">{formatBaht(row.withdrawals)} ฿</td>
                        <td className="whitespace-nowrap px-3 py-3 font-black text-slate-950">{formatBaht(row.balance)} ฿</td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.transactionCount}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.latestDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isLoading && classroomSavingsTransactions.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีรายการฝาก/ถอนในช่วงเวลานี้ แต่ยังแสดงยอดคงเหลือจากบัญชีเงินออมได้
                </div>
              ) : null}
            </div>
          ) : null}

          {reportView === 'scores' ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 lg:grid-cols-3">
              <article className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase text-slate-400">ชุดคะแนน</p>
                <p className="mt-2 text-4xl font-black text-slate-950">{scoreAssessmentRows.length}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">ชุดในห้อง/ช่วงนี้</p>
              </article>
              <article className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase text-slate-400">เฉลี่ย</p>
                <p className="mt-2 text-4xl font-black text-slate-950">
                  {scoreAssessmentRows.length > 0 ? round(scoreAssessmentRows.reduce((sum, row) => sum + row.averagePercent, 0) / scoreAssessmentRows.length) : 0}%
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">รวมชุดคะแนนที่มีคะแนนแล้ว</p>
              </article>
              <article className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-black uppercase text-rose-700">ยังไม่กรอก</p>
                <p className="mt-2 text-4xl font-black text-slate-950">{scoreAssessmentRows.reduce((sum, row) => sum + row.missingCount, 0)}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">ช่องคะแนนที่ยังว่าง</p>
              </article>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-950">สรุปรายวิชา</h3>
                  <div className="mt-3 grid gap-2">
                    {scoreSubjectRows.map((row) => (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2" key={row.subject}>
                        <div>
                          <p className="font-black text-slate-950">{row.subject}</p>
                          <p className="text-xs font-bold text-slate-500">{row.assessmentCount} ชุด | กรอกแล้ว {row.enteredCount}</p>
                        </div>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{row.averagePercent}%</span>
                      </div>
                    ))}
                    {scoreSubjectRows.length === 0 ? <p className="nexus-muted-box p-3 text-sm font-bold text-slate-600">ยังไม่มีชุดคะแนนในช่วงนี้</p> : null}
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-950">ชุดคะแนนล่าสุด</h3>
                  <div className="mt-3 grid gap-2">
                    {scoreAssessmentRows.slice(0, 6).map((row) => (
                      <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2" key={row.assessment.id}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black text-slate-950">{row.assessment.title}</p>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{scoreCategoryLabels[row.assessment.category]}</span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {row.assessment.subject_name} | เฉลี่ย {row.averageScore}/{row.assessment.max_score} | ยังไม่กรอก {row.missingCount}
                        </p>
                      </div>
                    ))}
                    {scoreAssessmentRows.length === 0 ? <p className="nexus-muted-box p-3 text-sm font-bold text-slate-600">ยังไม่มีชุดคะแนนในช่วงนี้</p> : null}
                  </div>
                </article>
              </div>
            </div>
          ) : null}

          {reportView === 'individual' ? (
            <div className="mt-5 grid gap-4">
              <article className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-teal-700">Student Report</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'ยังไม่ได้เลือกนักเรียน'}
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-500">{selectedStudent?.student_code || '-'} | {selectedClassroom?.name || '-'}</p>
              </article>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { detail: 'บันทึกเวลาเรียน', label: 'เวลาเรียน', value: selectedStudentAttendanceRecords.length },
                  { detail: 'คะแนนเฉลี่ย', label: 'คะแนน', value: `${selectedStudentScoreAverage}%` },
                  { detail: 'ยอดคงเหลือ', label: 'เงินออม', value: `${formatBaht(Number(selectedStudent ? savingsAccountByStudent.get(selectedStudent.id)?.balance || 0 : 0))} ฿` },
                  { detail: 'แบบเยี่ยมบ้าน', label: 'กสศ.01', value: `${selectedHomeVisit?.completion_percent || 0}%` },
                ].map((item) => (
                  <article className="rounded-3xl border border-slate-200 bg-white p-4" key={item.label}>
                    <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.detail}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-950">เคสดูแลล่าสุด</h3>
                  <div className="mt-3 grid gap-2">
                    {selectedStudentBehaviorRecords.slice(0, 5).map((record) => (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2" key={record.id}>
                        <p className="font-black text-slate-950">{record.category}</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{record.behavior_date} | {toneLabels[record.tone]} | {followUpLabels[record.follow_up_status]}</p>
                      </div>
                    ))}
                    {selectedStudentBehaviorRecords.length === 0 ? <p className="nexus-muted-box p-3 text-sm font-bold text-slate-600">ยังไม่มีเคสดูแลในช่วงนี้</p> : null}
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-950">เงินออมล่าสุด</h3>
                  <div className="mt-3 grid gap-2">
                    {selectedStudentSavingsTransactions.slice(0, 5).map((transaction) => (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2" key={transaction.id}>
                        <div>
                          <p className="font-black text-slate-950">{savingsTransactionLabels[transaction.transaction_type]} {formatBaht(Number(transaction.amount || 0))} ฿</p>
                          <p className="text-xs font-bold text-slate-500">{transaction.transaction_date}</p>
                        </div>
                      </div>
                    ))}
                    {selectedStudentSavingsTransactions.length === 0 ? <p className="nexus-muted-box p-3 text-sm font-bold text-slate-600">ยังไม่มีรายการเงินออมในช่วงนี้</p> : null}
                  </div>
                </article>
              </div>
            </div>
          ) : null}

          {reportView === 'behavior' ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'เคสติดตาม', value: coreMetrics.behavior.followUps },
                  { label: 'เชิงบวก', value: coreMetrics.behavior.positiveCount },
                  { label: 'คะแนนพฤติกรรม', value: coreMetrics.behavior.totalPoints },
                ].map((item) => (
                  <article className="rounded-3xl border border-slate-200 bg-white p-4" key={item.label}>
                    <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
                    <p className="mt-2 text-4xl font-black text-slate-950">{item.value.toLocaleString('th-TH')}</p>
                  </article>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead>
                    <tr className="text-xs font-black uppercase text-slate-500">
                      <th className="px-3 py-3">วันที่</th>
                      <th className="px-3 py-3">นักเรียน</th>
                      <th className="px-3 py-3">ประเภท</th>
                      <th className="px-3 py-3">ติดตาม</th>
                      <th className="px-3 py-3">บันทึก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {behaviorReportRows.map((record) => {
                      const student = studentById.get(record.student_id);

                      return (
                        <tr className="hover:bg-amber-50/50" key={record.id}>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{record.behavior_date}</td>
                          <td className="px-3 py-3">
                            <p className="font-black text-slate-950">{student ? `${student.first_name} ${student.last_name}` : '-'}</p>
                            <p className="text-xs font-bold text-slate-500">{student?.student_code || '-'}</p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{toneLabels[record.tone]}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{followUpLabels[record.follow_up_status]}</td>
                          <td className="min-w-56 px-3 py-3 font-bold text-slate-600">{record.category}: {record.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!isLoading && behaviorReportRows.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีบันทึกพฤติกรรมหรือเคสดูแลในช่วงนี้
                </div>
              ) : null}
            </div>
          ) : null}

          {reportView === 'settings' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {(['term1', 'term2'] as TermKey[]).map((term) => (
                <article className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4" key={term}>
                  <h3 className="text-lg font-black text-slate-950">{term === 'term1' ? 'ภาคเรียนที่ 1' : 'ภาคเรียนที่ 2'}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      เริ่ม
                      <input
                        className="nexus-field h-11 px-3"
                        onChange={(event) => setTermRanges((current) => ({ ...current, [term]: { ...current[term], start: event.target.value } }))}
                        type="date"
                        value={termRanges[term].start}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      สิ้นสุด
                      <input
                        className="nexus-field h-11 px-3"
                        onChange={(event) => setTermRanges((current) => ({ ...current, [term]: { ...current[term], end: event.target.value } }))}
                        type="date"
                        value={termRanges[term].end}
                      />
                    </label>
                  </div>
                </article>
              ))}
              <article className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-2">
                <h3 className="text-lg font-black text-slate-950">Template รายงานที่ควรตั้งค่าต่อ</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  โลโก้โรงเรียน ชื่อครูประจำชั้น ชื่อผู้อำนวยการ ลายเซ็น ขนาดกระดาษ A4 แนวตั้ง/แนวนอน และ footer Created by MIKPURINUT
                </p>
              </article>
            </div>
          ) : null}
        </section>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
