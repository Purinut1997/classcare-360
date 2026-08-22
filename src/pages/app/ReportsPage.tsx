import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, Download, FileSpreadsheet, ImagePlus, Printer, Save, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';

import { getBangkokDate } from '../../lib/date';
import { isDemoSession } from '../../lib/auth';
import {
  buildOfficialDocumentCode,
  buildOfficialFooterHtml,
  buildOfficialHeaderHtml,
  buildOfficialReportCss,
  buildOfficialSignaturesHtml,
  formatThaiOfficialDate,
  formatThaiOfficialShortDate,
  maskThaiCitizenId,
} from '../../lib/officialReport';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { compressImageFile, loadSchoolReportIdentity, saveSchoolReportIdentity, type SchoolReportIdentity } from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';

interface ReportsPageProps {
  session: AppSessionContext;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';
type ReportView = 'attendance' | 'subject-attendance' | 'savings' | 'scores' | 'subject-scores' | 'health' | 'student-register' | 'executive' | 'individual' | 'behavior' | 'settings';
type ReportPeriod = 'month' | 'term' | 'year';
type TermKey = 'term1' | 'term2';
type RegisterOrientation = 'portrait' | 'landscape';
type RegisterOptionalField = 'address' | 'citizenId' | 'family' | 'health';

type RegisterFieldSelection = Record<RegisterOptionalField, boolean>;

interface ClassroomRow {
  academic_year: string | null;
  id: string;
  name: string;
}

interface StudentRow {
  birth_date: string | null;
  classroom_id: string | null;
  first_name: string;
  gender: 'male' | 'female' | 'other' | 'unspecified' | null;
  health_flags: Record<string, unknown> | null;
  id: string;
  last_name: string;
  metadata: Record<string, unknown> | null;
  nickname: string | null;
  status: string | null;
  student_code: string | null;
}

interface StudentGuardianReportRow {
  display_name: string;
  is_primary: boolean;
  phone: string | null;
  relation: string | null;
  student_id: string;
}

interface StudentRegisterHealthRow {
  heightCm: number | string | null;
  recordDate: string | null;
  studentId: string;
  weightKg: number | string | null;
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

type HealthRecordType = 'growth' | 'toothbrushing' | 'milk' | 'lunch' | 'hygiene';
type HealthInspectionStatus = 'pass' | 'attention' | 'not_checked';

interface StudentHealthRecordRow {
  bmi: number | string | null;
  height_cm: number | string | null;
  id: string;
  inspection_results: Record<string, HealthInspectionStatus>;
  note: string | null;
  record_date: string;
  record_type: HealthRecordType;
  status: 'recorded' | 'completed' | 'missed' | 'exempt' | 'normal' | 'attention' | 'not_checked';
  student_id: string;
  weight_kg: number | string | null;
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
  { birth_date: '2015-01-12', classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', gender: 'male', health_flags: { height_cm: 142, weight_kg: 35.5 }, id: 'demo-student-1', last_name: 'ใจดี', metadata: { dmc_address: { district: 'เมือง', house_no: '12', province: 'นครราชสีมา', subdistrict: 'ในเมือง', village_no: '3' }, dmc_father: { first_name: 'สมชาย', last_name: 'ใจดี', prefix: 'นาย' }, dmc_id_card: '1100100000001', dmc_mother: { first_name: 'สมใจ', last_name: 'ใจดี', prefix: 'นาง' } }, nickname: 'นัท', status: 'active', student_code: '001' },
  { birth_date: '2015-03-03', classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', gender: 'female', health_flags: { height_cm: 138, weight_kg: 34.4 }, id: 'demo-student-2', last_name: 'แสงทอง', metadata: { dmc_address: { district: 'เมือง', house_no: '25/1', province: 'นครราชสีมา', subdistrict: 'โคกสูง', village_no: '2' }, dmc_father: { first_name: 'ประสงค์', last_name: 'แสงทอง', prefix: 'นาย' }, dmc_id_card: '1100100000002', dmc_mother: { first_name: 'มาลี', last_name: 'แสงทอง', prefix: 'นาง' } }, nickname: 'พิม', status: 'active', student_code: '002' },
  { birth_date: '2015-07-27', classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', gender: 'male', health_flags: { height_cm: 141, weight_kg: 36.1 }, id: 'demo-student-3', last_name: 'สุขใจ', metadata: { dmc_address: { district: 'เมือง', house_no: '41', province: 'นครราชสีมา', subdistrict: 'โคกสูง', village_no: '5' }, dmc_father: { first_name: 'มนตรี', last_name: 'สุขใจ', prefix: 'นาย' }, dmc_id_card: '1100100000003', dmc_mother: { first_name: 'รัตนา', last_name: 'สุขใจ', prefix: 'นาง' } }, nickname: 'ก้อง', status: 'active', student_code: '003' },
];

const demoGuardians: StudentGuardianReportRow[] = [
  { display_name: 'นางสมใจ ใจดี', is_primary: true, phone: '08x-xxx-1101', relation: 'มารดา', student_id: 'demo-student-1' },
  { display_name: 'นายประสงค์ แสงทอง', is_primary: true, phone: '08x-xxx-1102', relation: 'บิดา', student_id: 'demo-student-2' },
  { display_name: 'นางรัตนา สุขใจ', is_primary: true, phone: '08x-xxx-1103', relation: 'มารดา', student_id: 'demo-student-3' },
];

const demoSessions: AttendanceSessionRow[] = [
  { attendance_date: getBangkokDate(), classroom_id: 'demo-classroom', id: 'demo-session-1', period_label: 'เช้า', subject_name: 'โฮมรูม' },
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

const demoHealthRecords: StudentHealthRecordRow[] = [
  { bmi: 17.61, height_cm: 142, id: 'demo-health-1', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'growth', status: 'recorded', student_id: 'demo-student-1', weight_kg: 35.5 },
  { bmi: null, height_cm: null, id: 'demo-health-2', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'toothbrushing', status: 'completed', student_id: 'demo-student-1', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-3', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'milk', status: 'completed', student_id: 'demo-student-1', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-4', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'lunch', status: 'completed', student_id: 'demo-student-1', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-5', inspection_results: { hair: 'pass', nails: 'attention', skin: 'pass', teeth: 'pass' }, note: 'ติดตามความสะอาดเล็บ', record_date: getTodayDate(), record_type: 'hygiene', status: 'attention', student_id: 'demo-student-1', weight_kg: null },
  { bmi: 18.07, height_cm: 138, id: 'demo-health-6', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'growth', status: 'recorded', student_id: 'demo-student-2', weight_kg: 34.4 },
  { bmi: null, height_cm: null, id: 'demo-health-7', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'toothbrushing', status: 'missed', student_id: 'demo-student-2', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-8', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'milk', status: 'completed', student_id: 'demo-student-2', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-9', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'lunch', status: 'completed', student_id: 'demo-student-2', weight_kg: null },
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
  { description: 'แยกวิชา คาบ และช่วงเวลา พร้อม export', label: 'เวลาเรียนรายวิชา', value: 'subject-attendance' },
  { description: 'เงินฝาก ถอน และยอดคงเหลือ', label: 'เงินออม', value: 'savings' },
  { description: 'สรุปคะแนนรวมห้องและรายชั้น', label: 'คะแนนรวมห้อง', value: 'scores' },
    { description: 'ตารางคะแนนรวมและงานค้างแยกรายวิชา', label: 'คะแนนรายวิชา', value: 'subject-scores' },
  { description: 'การเจริญเติบโต สุขอนามัย แปรงฟัน ดื่มนม และอาหารกลางวัน', label: 'สุขภาพและกิจวัตร', value: 'health' },
  { description: 'บัญชีรายชื่อนักเรียนพร้อมข้อมูลผู้ปกครองและการรับรอง', label: 'ทะเบียนนักเรียน', value: 'student-register' },
  { description: 'ภาพรวมผลดำเนินงาน ประเด็นเฝ้าระวัง และข้อเสนอเพื่อพิจารณา', label: 'สรุปผู้บริหาร', value: 'executive' },
  { description: 'รวมเวลาเรียน คะแนน เงินออม พฤติกรรม', label: 'รายบุคคล', value: 'individual' },
  { description: 'เคสดูแลและพฤติกรรมที่ต้องติดตาม', label: 'พฤติกรรม/เคสดูแล', value: 'behavior' },
  { description: 'ห้วงเวลาเทอม โลโก้ ลายเซ็น template', label: 'ตั้งค่ารายงาน', value: 'settings' },
];

const registerFieldOptions: Array<{ description: string; label: string; value: RegisterOptionalField }> = [
  { description: 'ปกปิดบางส่วนโดยค่าเริ่มต้น', label: 'เลขบัตรประชาชน', value: 'citizenId' },
  { description: 'ข้อมูลวัดล่าสุดหรือข้อมูลนำเข้า DMC', label: 'น้ำหนักและส่วนสูง', value: 'health' },
  { description: 'บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด', label: 'ที่อยู่นักเรียน', value: 'address' },
  { description: 'บิดา มารดา ผู้ปกครอง และเบอร์ติดต่อ', label: 'ข้อมูลครอบครัว', value: 'family' },
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

const monthlyStatusAbbreviations: Record<AttendanceStatus, string> = {
  present: 'มา',
  late: 'ส',
  leave: 'ล',
  sick: 'ป',
  absent: 'ข',
  activity: 'ก',
};

function getTodayDate() {
  return getBangkokDate();
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
  periodLabel,
  sessionKind,
  subjectName,
  students,
}: {
  attendanceRecords: AttendanceRecordRow[];
  attendanceSessions: AttendanceSessionRow[];
  classroomId: string;
  classrooms: ClassroomRow[];
  dateFrom: string;
  periodLabel?: string;
  sessionKind: 'daily' | 'subject';
  subjectName?: string;
  students: StudentRow[];
}): MonthlyAttendanceGrid {
  const { days } = getReportMonthContext(dateFrom);
  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId) || classrooms[0] || null;
  const selectedClassroomId = selectedClassroom?.id || classroomId;
  const classroomStudents = students.filter((student) => !selectedClassroomId || student.classroom_id === selectedClassroomId);
  const sessionsByDate = new Map(
    attendanceSessions
      .filter((session) => !selectedClassroomId || session.classroom_id === selectedClassroomId)
      .filter((session) => {
        const isLegacyHomeroom = session.subject_name === 'โฮมรูม';
        return sessionKind === 'subject' ? Boolean(session.subject_name) && !isLegacyHomeroom : !session.subject_name || isLegacyHomeroom;
      })
      .filter((session) => !subjectName || session.subject_name === subjectName)
      .filter((session) => !periodLabel || session.period_label === periodLabel)
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

interface MonthlySavingsRow {
  dailyAmounts: Record<string, number>;
  studentCode: string;
  studentId: string;
  studentName: string;
  totalBalance: number;
  totalMonth: number;
}

interface MonthlySavingsGrid {
  classroom: ClassroomRow | null;
  dayTotals: Record<number, number>;
  rows: MonthlySavingsRow[];
  totalActiveSavingsStudents: number;
  totalCumulativeBalance: number;
  totalMonthSavings: number;
  totalStudents: number;
}

function buildMonthlySavingsGrid({
  savingsAccounts,
  savingsTransactions,
  classroomId,
  classrooms,
  dateFrom,
  students,
}: {
  savingsAccounts: SavingsAccountRow[];
  savingsTransactions: SavingsTransactionRow[];
  classroomId: string;
  classrooms: ClassroomRow[];
  dateFrom: string;
  students: StudentRow[];
}): MonthlySavingsGrid {
  const { days } = getReportMonthContext(dateFrom);
  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId) || classrooms[0] || null;
  const selectedClassroomId = selectedClassroom?.id || classroomId;
  const classroomStudents = students.filter((student) => !selectedClassroomId || student.classroom_id === selectedClassroomId);
  const savingsAccountByStudent = new Map(savingsAccounts.map((account) => [account.student_id, account]));

  const dayTotals: Record<number, number> = {};
  let totalMonthSavings = 0;
  let totalCumulativeBalance = 0;
  let totalActiveSavingsStudents = 0;

  const rows = classroomStudents.map((student) => {
    const account = savingsAccountByStudent.get(student.id);
    const totalBalance = Number(account?.balance || 0);
    totalCumulativeBalance += totalBalance;

    const studentTx = savingsTransactions.filter((tx) => tx.student_id === student.id);
    const dailyAmounts: Record<string, number> = {};
    let totalMonth = 0;

    days.forEach((day) => {
      const dayTxs = studentTx.filter((tx) => tx.transaction_date === day.dateKey);
      const dayNet = dayTxs.reduce((sum, tx) => {
        const amt = Number(tx.amount || 0);
        if (tx.transaction_type === 'deposit') return sum + amt;
        if (tx.transaction_type === 'withdrawal') return sum - amt;
        return sum + amt;
      }, 0);

      if (dayNet !== 0) {
        dailyAmounts[day.dateKey] = dayNet;
        totalMonth += dayNet;
        dayTotals[day.day] = (dayTotals[day.day] || 0) + dayNet;
      }
    });

    if (totalMonth > 0) {
      totalActiveSavingsStudents += 1;
    }
    totalMonthSavings += totalMonth;

    return {
      dailyAmounts,
      studentCode: student.student_code || '-',
      studentId: student.id,
      studentName: `${student.first_name} ${student.last_name}`,
      totalBalance,
      totalMonth,
    };
  });

  return {
    classroom: selectedClassroom,
    dayTotals,
    rows,
    totalActiveSavingsStudents,
    totalCumulativeBalance,
    totalMonthSavings,
    totalStudents: classroomStudents.length,
  };
}

function buildPrintableReportHtml({
  attendanceGrid,
  dateFrom,
  teacherName,
  schoolName,
  workspaceName,
  reportIdentity,
}: {
  attendanceGrid: MonthlyAttendanceGrid;
  dateFrom: string;
  teacherName: string;
  schoolName: string;
  workspaceName: string;
  reportIdentity: SchoolReportIdentity;
}) {
  const { days, monthLabel } = getReportMonthContext(dateFrom);
  const dayHeaders = days
    .map((day) => `<th class="${day.isWeekend ? 'weekend' : ''}">${day.day}</th>`)
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

  const classroomName = attendanceGrid.classroom?.name || workspaceName || '-';
  const academicYear = attendanceGrid.classroom?.academic_year || '2569';
  const dateTo = days[days.length - 1]?.dateKey || dateFrom;
  const documentCode = buildOfficialDocumentCode('CC-ATT', dateFrom, classroomName);

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ClassCare 360 - รายงานเวลาเรียนรายเดือน</title>
        <style>
          @page { margin: 15mm 20mm; size: A4 landscape; }
          * { box-sizing: border-box; }
          body {
            color: #07111f;
            font-family: "TH Sarabun New", "Noto Sans Thai", Tahoma, Arial, sans-serif;
            line-height: 1.2;
            margin: 0;
            font-size: 11px;
          }
          header {
            border-bottom: 3px solid #2458ff;
            display: grid;
            gap: 8px;
            grid-template-columns: 60px minmax(0,1fr) 60px;
            padding: 6px 0 6px;
            text-align: center;
          }
          .logo {
            align-items: center;
            border: 1px solid #bfdbfe;
            border-radius: 50%;
            color: #0369a1;
            display: flex;
            font-size: 12px;
            font-weight: 900;
            height: 48px;
            justify-content: center;
            margin: 0 auto;
            width: 48px;
          }
          .logo img {
            border-radius: 50%;
            height: 100%;
            object-fit: cover;
            width: 100%;
          }
          h1 { font-size: 18px; margin: 0; }
          .subtitle { font-size: 12px; font-weight: 700; margin: 1px 0; }
          .classline { font-size: 11px; font-weight: 700; margin: 6px 0 4px; }
          .summary-grid {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(4, 1fr);
            margin: 6px 0 10px;
          }
          .summary-card {
            background: #f0f7ff;
            border: 1px solid #c7e0fe;
            border-radius: 8px;
            padding: 4px 8px;
            text-align: center;
          }
          .summary-card span { display: block; font-size: 10px; font-weight: 700; color: #1e40af; }
          .summary-card strong { color: #1d4ed8; display: block; font-size: 14px; margin-top: 1px; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          th, td {
            border: 1px solid #111827;
            font-size: 9px;
            height: 16px;
            padding: 1px 2px;
            text-align: center;
            vertical-align: middle;
          }
          th { background: #f4a3cf; font-weight: 900; }
          th.name, td.name { text-align: left; width: 160px; }
          th.number, td.number { width: 28px; }
          .day { width: 18px; }
          .weekend { background: #cfd6df !important; }
          .present { color: #047857; font-weight: 900; }
          .late { color: #b45309; font-weight: 900; }
          .leave { color: #075985; font-weight: 900; }
          .absent { color: #be123c; font-weight: 900; }
          .sum { background: #fff7cc; width: 30px; font-weight: 700; }
          .total { background: #ffe4e6; font-weight: 900; }
          tfoot td { background: #ffe4e6; font-weight: 900; }
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 16px;
          }
          .signatures {
            display: grid;
            gap: 80px;
            grid-template-columns: 1fr 1fr;
            text-align: center;
            width: 70%;
          }
          .signature-line { border-bottom: 1px dotted #111827; display: inline-block; min-width: 140px; }
          .role { font-weight: 800; margin-top: 3px; font-size: 10px; }
          .footer-meta {
            text-align: right;
            font-size: 9px;
            color: #64748b;
          }
          .footer-meta .credit {
            margin-top: 8px;
            font-weight: 700;
            color: #94a3b8;
          }
          ${buildOfficialReportCss({ dense: true, marginMm: 12, orientation: 'landscape' })}
          .summary-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 2.5mm; }
          .summary-card span, .summary-card strong, .present, .late, .leave, .absent { color: #111; }
          th { background: #e6f7fb !important; border-top: .8mm solid #0f2742 !important; color: #0f2742 !important; }
          .weekend, .sum, .total, tfoot td { background: #e6f7fb !important; color: #0f2742 !important; }
          th.name, td.name { width: 42mm; }
        </style>
      </head>
      <body>
        <main class="official-sheet">
        ${buildOfficialHeaderHtml({ classroomName, dateFrom, dateTo, documentCode, identity: { ...reportIdentity, academicYear }, schoolName, subtitle: `ประจำเดือน${monthLabel}`, title: `รายงานเวลาเรียนระดับชั้น ${classroomName}` })}
        <section class="summary-grid">
          <div class="summary-card">
            <span>มา</span>
            <strong>${attendanceGrid.summary.present.toLocaleString('th-TH')}</strong>
          </div>
          <div class="summary-card">
            <span>สาย</span>
            <strong>${attendanceGrid.summary.late.toLocaleString('th-TH')}</strong>
          </div>
          <div class="summary-card">
            <span>ลา</span>
            <strong>${attendanceGrid.summary.leave.toLocaleString('th-TH')}</strong>
          </div>
          <div class="summary-card">
            <span>ขาด</span>
            <strong>${attendanceGrid.summary.absent.toLocaleString('th-TH')}</strong>
          </div>
        </section>
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
        <div class="official-certification">หมายเหตุ: มา = เข้าเรียน, ส = สาย, ล = ลา, ข = ขาด · ขอรับรองว่าข้อมูลเวลาเรียนตรงกับรายการที่บันทึกในระบบ ณ วันตัดยอด</div>
        ${buildOfficialSignaturesHtml([
          { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำ / ครูประจำชั้น' },
          ...(reportIdentity.coAdvisorName?.trim() ? [{ name: reportIdentity.coAdvisorName, role: 'ที่ปรึกษาร่วม' }] : []),
          { name: reportIdentity.academicHeadName, role: 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ' },
          { name: reportIdentity.directorName, role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน' },
        ])}
        ${buildOfficialFooterHtml({ confidential: true, documentCode })}
        </main>
      </body>
    </html>`;
}

function buildPrintableSavingsReportHtml({
  savingsGrid,
  dateFrom,
  teacherName,
  schoolName,
  workspaceName,
  reportIdentity,
}: {
  savingsGrid: MonthlySavingsGrid;
  dateFrom: string;
  teacherName: string;
  schoolName: string;
  workspaceName: string;
  reportIdentity: SchoolReportIdentity;
}) {
  const { days, monthLabel } = getReportMonthContext(dateFrom);
  const dayHeaders = days
    .map((day) => `<th class="${day.isWeekend ? 'weekend' : ''}">${day.day}</th>`)
    .join('');

  const studentRows = savingsGrid.rows
    .map((row, index) => {
      const dayCells = days
        .map((day) => {
          const amt = row.dailyAmounts[day.dateKey];
          return `<td class="day ${day.isWeekend ? 'weekend' : ''}">${amt ? amt : ''}</td>`;
        })
        .join('');

      return `
        <tr>
          <td class="number">${index + 1}</td>
          <td class="name">${escapeHtml(row.studentName)}</td>
          ${dayCells}
          <td class="sum month-total">${row.totalMonth ? row.totalMonth.toLocaleString('th-TH') : ''}</td>
          <td class="sum balance-total">${row.totalBalance ? row.totalBalance.toLocaleString('th-TH') : ''}</td>
        </tr>
      `;
    })
    .join('');

  const totalCells = days
    .map((day) => `<td class="day total ${day.isWeekend ? 'weekend' : ''}">${savingsGrid.dayTotals[day.day] ? savingsGrid.dayTotals[day.day].toLocaleString('th-TH') : ''}</td>`)
    .join('');

  const classroomName = savingsGrid.classroom?.name || workspaceName || '-';
  const academicYear = savingsGrid.classroom?.academic_year || '2569';
  const dateTo = days[days.length - 1]?.dateKey || dateFrom;
  const documentCode = buildOfficialDocumentCode('CC-SAV', dateFrom, classroomName);

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ClassCare 360 - รายงานการบันทึกการออมเงิน</title>
        <style>
          @page { margin: 15mm 20mm; size: A4 landscape; }
          * { box-sizing: border-box; }
          body {
            color: #07111f;
            font-family: "TH Sarabun New", "Noto Sans Thai", Tahoma, Arial, sans-serif;
            line-height: 1.2;
            margin: 0;
            font-size: 11px;
          }
          header {
            border-bottom: 3px solid #2458ff;
            display: grid;
            gap: 8px;
            grid-template-columns: 60px minmax(0,1fr) 60px;
            padding: 6px 0 6px;
            text-align: center;
          }
          .logo {
            align-items: center;
            border: 1px solid #bfdbfe;
            border-radius: 50%;
            color: #0369a1;
            display: flex;
            font-size: 12px;
            font-weight: 900;
            height: 48px;
            justify-content: center;
            margin: 0 auto;
            width: 48px;
          }
          .logo img {
            border-radius: 50%;
            height: 100%;
            object-fit: cover;
            width: 100%;
          }
          h1 { font-size: 18px; margin: 0; }
          .subtitle { font-size: 12px; font-weight: 700; margin: 1px 0; }
          .classline { font-size: 11px; font-weight: 700; margin: 6px 0 4px; }
          .summary-grid {
            display: grid;
            gap: 8px;
            grid-template-columns: repeat(4, 1fr);
            margin: 6px 0 10px;
          }
          .summary-card {
            background: #f0f7ff;
            border: 1px solid #c7e0fe;
            border-radius: 8px;
            padding: 4px 8px;
            text-align: center;
          }
          .summary-card span { display: block; font-size: 10px; font-weight: 700; color: #1e40af; }
          .summary-card strong { color: #1d4ed8; display: block; font-size: 14px; margin-top: 1px; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          th, td {
            border: 1px solid #111827;
            font-size: 9px;
            height: 16px;
            padding: 1px 2px;
            text-align: center;
            vertical-align: middle;
          }
          th { background: #f4a3cf; font-weight: 900; }
          th.name, td.name { text-align: left; width: 160px; }
          th.number, td.number { width: 28px; }
          .day { width: 18px; }
          .weekend { background: #cfd6df !important; }
          .sum { background: #fff7cc; width: 35px; font-weight: 700; }
          .month-total { background: #e0f2fe; color: #0369a1; font-weight: 800; }
          .balance-total { background: #fce7f3; color: #be185d; font-weight: 800; }
          .total { background: #ffe4e6; font-weight: 900; }
          tfoot td { background: #ffe4e6; font-weight: 900; }
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 16px;
          }
          .signatures {
            display: grid;
            gap: 80px;
            grid-template-columns: 1fr 1fr;
            text-align: center;
            width: 70%;
          }
          .signature-line { border-bottom: 1px dotted #111827; display: inline-block; min-width: 140px; }
          .role { font-weight: 800; margin-top: 3px; font-size: 10px; }
          .footer-meta {
            text-align: right;
            font-size: 9px;
            color: #64748b;
          }
          .footer-meta .credit {
            margin-top: 8px;
            font-weight: 700;
            color: #94a3b8;
          }
          ${buildOfficialReportCss({ dense: true, marginMm: 12, orientation: 'landscape' })}
          .summary-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 2.5mm; }
          .summary-card span, .summary-card strong, .month-total, .balance-total { color: #111; }
          th { background: #e6f7fb !important; border-top: .8mm solid #0f2742 !important; color: #0f2742 !important; }
          .weekend, .sum, .month-total, .balance-total, .total, tfoot td { background: #e6f7fb !important; color: #0f2742 !important; }
          th.name, td.name { width: 42mm; }
        </style>
      </head>
      <body>
        <main class="official-sheet">
        ${buildOfficialHeaderHtml({ classroomName, dateFrom, dateTo, documentCode, identity: { ...reportIdentity, academicYear }, schoolName, subtitle: `ประจำเดือน${monthLabel}`, title: `รายงานการออมเงินระดับชั้น ${classroomName}` })}
        <section class="summary-grid">
          <div class="summary-card">
            <span>นักเรียนทั้งหมด</span>
            <strong>${savingsGrid.totalStudents}</strong>
          </div>
          <div class="summary-card">
            <span>มีการออมเดือนนี้</span>
            <strong>${savingsGrid.totalActiveSavingsStudents}</strong>
          </div>
          <div class="summary-card">
            <span>ยอดรวมเดือนนี้</span>
            <strong>${savingsGrid.totalMonthSavings.toLocaleString('th-TH')}</strong>
          </div>
          <div class="summary-card">
            <span>ยอดสะสม/คงเหลือรวม</span>
            <strong>${savingsGrid.totalCumulativeBalance.toLocaleString('th-TH')}</strong>
          </div>
        </section>
        <table>
          <thead>
            <tr>
              <th class="number">เลขที่</th>
              <th class="name">ชื่อ-นามสกุล</th>
              ${dayHeaders}
              <th>รวม</th>
              <th>ยอดสะสม/คงเหลือ</th>
            </tr>
          </thead>
          <tbody>${studentRows}</tbody>
          <tfoot>
            <tr>
              <td></td>
              <td class="name">รวม</td>
              ${totalCells}
              <td>${savingsGrid.totalMonthSavings.toLocaleString('th-TH')}</td>
              <td>${savingsGrid.totalCumulativeBalance.toLocaleString('th-TH')}</td>
            </tr>
          </tfoot>
        </table>
        <div class="official-certification">ขอรับรองว่ารายการฝาก ถอน และยอดคงเหลือในรายงานฉบับนี้ตรงกับข้อมูลที่บันทึกในระบบ ณ วันตัดยอด</div>
        ${buildOfficialSignaturesHtml([
          { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำ / ครูประจำชั้น' },
          ...(reportIdentity.coAdvisorName?.trim() ? [{ name: reportIdentity.coAdvisorName, role: 'ที่ปรึกษาร่วม' }] : []),
          { name: reportIdentity.academicHeadName, role: 'ผู้ตรวจสอบ / หัวหน้างานการเงินหรือวิชาการ' },
          { name: reportIdentity.directorName, role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน' },
        ])}
        ${buildOfficialFooterHtml({ confidential: true, documentCode })}
        </main>
      </body>
    </html>`;
}

interface PrintableTableReportOptions {
  columns: string[];
  confidential?: boolean;
  dateFrom: string;
  dateTo: string;
  documentPrefix?: string;
  reportIdentity: SchoolReportIdentity;
  rows: Array<Array<number | string | null | undefined>>;
  schoolName: string;
  subtitle: string;
  teacherName: string;
  title: string;
  workspaceName: string;
}

function buildPrintableTableReportHtml({
  columns,
  confidential = true,
  dateFrom,
  dateTo,
  documentPrefix = 'CC-RPT',
  reportIdentity,
  rows,
  schoolName,
  subtitle,
  teacherName,
  title,
  workspaceName,
}: PrintableTableReportOptions) {
  const documentCode = buildOfficialDocumentCode(documentPrefix, dateFrom, workspaceName);
  const tableRows = rows.length > 0
    ? rows.map((row, index) => `<tr><td class="official-center">${index + 1}</td>${row.map((cell) => `<td>${escapeHtml(String(cell ?? '-'))}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="official-center" colspan="${columns.length + 1}">ยังไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>`;

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          ${buildOfficialReportCss({ dense: true, marginMm: 12, orientation: 'landscape' })}
          .official-table th:first-child, .official-table td:first-child { width: 9mm; }
        </style>
      </head>
      <body>
        <main class="official-sheet">
        ${buildOfficialHeaderHtml({ classroomName: workspaceName, dateFrom, dateTo, documentCode, identity: reportIdentity, schoolName, subtitle, title })}
        <table class="official-table">
          <thead><tr><th>ที่</th>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="official-certification">ขอรับรองว่าข้อมูลในรายงานฉบับนี้ตรวจสอบจากข้อมูลที่บันทึกในระบบตามช่วงเวลาที่ระบุ และถูกต้องตามข้อมูลที่มีอยู่ ณ วันตัดยอด</div>
        ${buildOfficialSignaturesHtml([
          { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำรายงาน / ครูประจำชั้น' },
          ...(reportIdentity.coAdvisorName?.trim() ? [{ name: reportIdentity.coAdvisorName, role: 'ที่ปรึกษาร่วม' }] : []),
          { name: reportIdentity.academicHeadName, role: 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ' },
          { name: reportIdentity.directorName, role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน' },
        ])}
        ${buildOfficialFooterHtml({ confidential, documentCode })}
        </main>
      </body>
    </html>`;
}

function asReportRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function reportText(value: unknown) {
  return String(value ?? '').trim();
}

function formatDmcPerson(value: unknown) {
  const person = asReportRecord(value);
  return [person.prefix, person.first_name, person.last_name].map(reportText).filter(Boolean).join(' ') || '-';
}

function formatRegisterAddress(student: StudentRow) {
  const address = asReportRecord(student.metadata?.dmc_address);
  const parts = [
    address.house_no ? `บ้านเลขที่ ${reportText(address.house_no)}` : '',
    address.village_no ? `หมู่ ${reportText(address.village_no)}` : '',
    reportText(address.road_or_soi),
    address.subdistrict ? `ต.${reportText(address.subdistrict)}` : '',
    address.district ? `อ.${reportText(address.district)}` : '',
    address.province ? `จ.${reportText(address.province)}` : '',
  ].filter(Boolean);
  return parts.join(' ') || reportText(student.metadata?.address || student.metadata?.current_address) || '-';
}

function getRegisterFamilyLines(student: StudentRow, guardians: StudentGuardianReportRow[]) {
  const metadata = student.metadata || {};
  const father = formatDmcPerson(metadata.dmc_father);
  const mother = formatDmcPerson(metadata.dmc_mother);
  const guardian = guardians.find((item) => item.student_id === student.id && item.is_primary)
    || guardians.find((item) => item.student_id === student.id);
  const lines = [
    father !== '-' ? `บิดา: ${father}` : '',
    mother !== '-' ? `มารดา: ${mother}` : '',
    guardian ? `ผู้ปกครอง: ${guardian.display_name}${guardian.relation ? ` (${guardian.relation})` : ''}${guardian.phone ? ` โทร. ${guardian.phone}` : ''}` : '',
  ].filter(Boolean);
  return lines.length > 0 ? lines : ['-'];
}

function getRegisterHealthText(student: StudentRow, healthRows: StudentRegisterHealthRow[]) {
  const latest = healthRows.find((row) => row.studentId === student.id);
  const flags = student.health_flags || {};
  const weight = latest?.weightKg ?? flags.weight_kg ?? null;
  const height = latest?.heightCm ?? flags.height_cm ?? null;
  const values = [
    weight ? `น้ำหนัก ${weight} กก.` : '',
    height ? `ส่วนสูง ${height} ซม.` : '',
  ].filter(Boolean);
  return values.join(' / ') || '-';
}

const registerFieldLabels: Record<RegisterOptionalField, string> = {
  address: 'ที่อยู่ตามทะเบียน',
  citizenId: 'เลขประจำตัวประชาชน',
  family: 'บิดา มารดา หรือผู้ปกครอง / เบอร์ติดต่อ',
  health: 'น้ำหนัก / ส่วนสูง',
};

function getRegisterFieldValue(
  student: StudentRow,
  field: RegisterOptionalField,
  guardians: StudentGuardianReportRow[],
  healthRows: StudentRegisterHealthRow[],
  revealCitizenIds: boolean,
) {
  if (field === 'citizenId') return maskThaiCitizenId(student.metadata?.dmc_id_card, revealCitizenIds);
  if (field === 'health') return getRegisterHealthText(student, healthRows);
  if (field === 'address') return formatRegisterAddress(student);
  return getRegisterFamilyLines(student, guardians).join(' | ');
}

function buildPrintableStudentRegisterHtml({
  classroomName,
  dateFrom,
  dateTo,
  fields,
  guardians,
  healthRows,
  orientation,
  reportIdentity,
  revealCitizenIds,
  schoolName,
  students,
  teacherName,
}: {
  classroomName: string;
  dateFrom: string;
  dateTo: string;
  fields: RegisterFieldSelection;
  guardians: StudentGuardianReportRow[];
  healthRows: StudentRegisterHealthRow[];
  orientation: RegisterOrientation;
  reportIdentity: SchoolReportIdentity;
  revealCitizenIds: boolean;
  schoolName: string;
  students: StudentRow[];
  teacherName: string;
}) {
  const documentCode = buildOfficialDocumentCode('CC-REG', dateFrom, classroomName);
  const genderLabel = (gender: StudentRow['gender']) => gender === 'male' ? 'ชาย' : gender === 'female' ? 'หญิง' : gender === 'other' ? 'อื่น ๆ' : '-';
  const studentPrefix = (gender: StudentRow['gender']) => gender === 'male' ? 'เด็กชาย' : gender === 'female' ? 'เด็กหญิง' : '';
  const enabledFields = registerFieldOptions.filter((field) => fields[field.value]).map((field) => field.value);
  const rows = students.map((student, index) => {
    const studentName = `${studentPrefix(student.gender)}${student.first_name} ${student.last_name}`;
    if (orientation === 'portrait') {
      const details = enabledFields.length > 0
        ? enabledFields.map((field) => `<div class="register-detail"><strong>${registerFieldLabels[field]}:</strong> ${escapeHtml(getRegisterFieldValue(student, field, guardians, healthRows, revealCitizenIds))}</div>`).join('')
        : '<span class="register-muted">ไม่มีข้อมูลเพิ่มเติมที่เลือก</span>';
      return `<tr><td class="official-center">${index + 1}</td><td class="official-center">${escapeHtml(student.student_code || '-')}</td><td><strong>${escapeHtml(studentName)}</strong><small class="register-student-meta">${genderLabel(student.gender)} · เกิด ${escapeHtml(formatThaiOfficialShortDate(student.birth_date))}</small></td><td>${details}</td><td></td></tr>`;
    }
    return `<tr><td class="official-center">${index + 1}</td><td class="official-center">${escapeHtml(student.student_code || '-')}</td><td><strong>${escapeHtml(studentName)}</strong><small class="register-student-meta">${genderLabel(student.gender)} · เกิด ${escapeHtml(formatThaiOfficialShortDate(student.birth_date))}</small></td>${enabledFields.map((field) => `<td>${escapeHtml(getRegisterFieldValue(student, field, guardians, healthRows, revealCitizenIds))}</td>`).join('')}<td></td></tr>`;
  }).join('');
  const maleCount = students.filter((student) => student.gender === 'male').length;
  const femaleCount = students.filter((student) => student.gender === 'female').length;

  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>ทะเบียนนักเรียน ${escapeHtml(classroomName)}</title><style>
    ${buildOfficialReportCss({ dense: true, marginMm: orientation === 'portrait' ? 12 : 8, orientation })}
    .official-header { grid-template-columns: 23mm 1fr 23mm; padding-bottom: 2mm; }
    .official-title { font-size: 18pt; }
    .official-school { font-size: 14pt; }
    .official-subtitle { font-size: 11pt; }
    .official-meta { font-size: 10pt; margin-bottom: 2mm; padding: 1.5mm 0; }
    .register-summary { align-items: stretch; border: 1px solid #555; display: grid; font-size: 10.5pt; grid-template-columns: repeat(4, 1fr); margin: 2mm 0; }
    .register-summary span { padding: 1.2mm 2mm; text-align: center; }
    .register-summary span + span { border-left: 1px solid #777; }
    .register-summary strong { font-size: 12pt; }
    .register-table th, .register-table td { font-size: ${orientation === 'portrait' ? '10.5pt' : '9.25pt'}; line-height: 1.08; padding: ${orientation === 'portrait' ? '1.2mm 1mm' : '.75mm .8mm'}; vertical-align: middle; }
    .register-table thead { display: table-header-group; }
    .register-table strong { font-weight: 700; }
    .register-student-meta { color: #444; display: block; font-size: 8.75pt; font-weight: 400; margin-top: .3mm; }
    .register-detail + .register-detail { border-top: .5px dotted #aaa; margin-top: .5mm; padding-top: .5mm; }
    .register-muted { color: #666; }
    .register-table tbody tr:nth-child(even) td { background: #f7f7f7; }
    .official-certification { font-size: 9.75pt; margin-top: 1.5mm; padding: 1mm 2mm; }
    .official-signatures { font-size: 10pt; margin-top: 4mm; }
    .official-footer { font-size: 8pt; position: static; margin-top: 3mm; }
    ${orientation === 'portrait' ? '.official-title { font-size: 17pt; } .official-school { font-size: 13.5pt; } .register-summary { font-size: 10pt; } .register-summary strong { font-size: 11.5pt; }' : ''}
  </style></head><body><main class="official-sheet">
    ${buildOfficialHeaderHtml({ classroomName, dateFrom, dateTo, documentCode, identity: reportIdentity, schoolName, subtitle: `ทะเบียนนักเรียนประจำปีการศึกษา ${reportIdentity.academicYear || '-'}`, title: 'ทะเบียนนักเรียน' })}
    <div class="register-summary"><span>นักเรียนทั้งหมด<br><strong>${students.length}</strong> คน</span><span>ชาย<br><strong>${maleCount}</strong> คน</span><span>หญิง<br><strong>${femaleCount}</strong> คน</span><span>ข้อมูล ณ<br><strong>${formatThaiOfficialShortDate(dateTo)}</strong></span></div>
    <table class="official-table register-table"><colgroup>${orientation === 'portrait' ? '<col style="width:10mm"><col style="width:20mm"><col style="width:48mm"><col><col style="width:24mm">' : `<col style="width:8mm"><col style="width:18mm"><col style="width:48mm">${enabledFields.map(() => '<col>').join('')}<col style="width:24mm">`}</colgroup><thead><tr><th>ที่</th><th>เลขประจำตัว<br>นักเรียน</th><th>ชื่อ–สกุลนักเรียน</th>${orientation === 'portrait' ? '<th>รายละเอียดข้อมูลที่เลือก</th>' : enabledFields.map((field) => `<th>${registerFieldLabels[field]}</th>`).join('')}<th>หมายเหตุ</th></tr></thead><tbody>${rows || `<tr><td colspan="${orientation === 'portrait' ? 5 : enabledFields.length + 4}" class="official-center">ยังไม่มีข้อมูลนักเรียน</td></tr>`}</tbody></table>
    <div class="official-certification">ขอรับรองว่ารายชื่อนักเรียนข้างต้นตรงกับทะเบียนนักเรียนของสถานศึกษา ณ วันที่ระบุ · รูปแบบ A4 ${orientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'} · ${fields.citizenId ? (revealCitizenIds ? 'แสดงเลขประจำตัวประชาชนเต็มตามสิทธิ์ผู้พิมพ์' : 'ปกปิดเลขประจำตัวประชาชน') : 'ไม่ได้เลือกแสดงเลขประจำตัวประชาชน'}</div>
    ${buildOfficialSignaturesHtml([
      { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำ / ครูประจำชั้น' },
      ...(reportIdentity.coAdvisorName?.trim() ? [{ name: reportIdentity.coAdvisorName, role: 'ที่ปรึกษาร่วม' }] : []),
      { name: reportIdentity.registrarName || reportIdentity.academicHeadName, role: 'ผู้ตรวจสอบ / นายทะเบียนโรงเรียน' },
      { name: reportIdentity.directorName, role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน' },
    ])}
    ${buildOfficialFooterHtml({ confidential: true, documentCode })}
  </main></body></html>`;
}

interface ExecutiveReportMetrics {
  attendanceRate: number;
  behaviorFollowUps: number;
  healthCompletionRate: number;
  healthFollowUps: number;
  savingsTotal: number;
  scoreAverage: number;
  studentCount: number;
}

function buildPrintableExecutiveReportHtml({
  classroomName,
  dateFrom,
  dateTo,
  metrics,
  reportIdentity,
  schoolName,
  teacherName,
}: {
  classroomName: string;
  dateFrom: string;
  dateTo: string;
  metrics: ExecutiveReportMetrics;
  reportIdentity: SchoolReportIdentity;
  schoolName: string;
  teacherName: string;
}) {
  const documentCode = buildOfficialDocumentCode('CC-EXE', dateFrom, classroomName);
  const status = (value: number, target: number) => value >= target ? 'เป็นไปตามเป้าหมาย' : value >= target - 10 ? 'ควรเฝ้าระวัง' : 'ต้องเร่งติดตาม';
  const executiveRows = [
    ['เวลาเรียน', `${metrics.attendanceRate}%`, 'ไม่น้อยกว่า 90%', status(metrics.attendanceRate, 90), metrics.attendanceRate < 90 ? 'ติดตามนักเรียนขาดเรียนและประสานผู้ปกครอง' : 'รักษาระดับและติดตามรายบุคคล'],
    ['ผลการเรียน', `${metrics.scoreAverage}%`, 'ไม่น้อยกว่า 70%', status(metrics.scoreAverage, 70), metrics.scoreAverage < 70 ? 'จัดกิจกรรมสอนเสริมรายวิชาที่ต่ำกว่าเกณฑ์' : 'ติดตามชุดคะแนนที่ยังกรอกไม่ครบ'],
    ['สุขภาพและกิจวัตร', `${metrics.healthCompletionRate}%`, 'ไม่น้อยกว่า 90%', status(metrics.healthCompletionRate, 90), `มีนักเรียนต้องติดตามสุขอนามัย ${metrics.healthFollowUps} คน`],
    ['พฤติกรรม/การดูแล', `${metrics.behaviorFollowUps} เคส`, 'ปิดเคสตามกำหนด', metrics.behaviorFollowUps === 0 ? 'เป็นไปตามเป้าหมาย' : 'ควรเฝ้าระวัง', 'มอบหมายครูประจำชั้นติดตามและบันทึกผลดำเนินงาน'],
    ['การออม', `${metrics.savingsTotal.toLocaleString('th-TH')} บาท`, 'รายงานครบถ้วน', 'ข้อมูลประกอบ', 'ตรวจสอบยอดกับบัญชีรายบุคคลก่อนรับรอง'],
  ];
  const proposedAction = [
    metrics.attendanceRate < 90 ? 'เร่งติดตามนักเรียนที่มีเวลาเรียนต่ำกว่าเกณฑ์' : '',
    metrics.scoreAverage < 70 ? 'จัดกิจกรรมสอนเสริมและติดตามผลสัมฤทธิ์' : '',
    metrics.healthFollowUps > 0 ? `ติดตามสุขอนามัยนักเรียน ${metrics.healthFollowUps} คน` : '',
    metrics.behaviorFollowUps > 0 ? `ทบทวนแผนช่วยเหลือนักเรียน ${metrics.behaviorFollowUps} เคส` : '',
  ].filter(Boolean).join(' · ') || 'ผลดำเนินงานโดยรวมเป็นไปตามเป้าหมาย ให้ดำเนินงานตามแผนและติดตามต่อเนื่อง';

  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>รายงานสรุปผู้บริหาร</title><style>
    ${buildOfficialReportCss({ dense: false, marginMm: 14, orientation: 'portrait' })}
    .official-table th:nth-child(1) { width: 27mm; }
    .official-table th:nth-child(2) { width: 25mm; }
    .official-table th:nth-child(3) { width: 28mm; }
    .official-table th:nth-child(4) { width: 31mm; }
  </style></head><body><main class="official-sheet">
    ${buildOfficialHeaderHtml({ classroomName, dateFrom, dateTo, documentCode, identity: reportIdentity, schoolName, subtitle: 'รายงานผลดำเนินงานจากข้อมูลในระบบ ClassCare 360', title: 'รายงานสรุปผลการดำเนินงานสำหรับผู้บริหาร' })}
    <section class="official-kpi-grid">
      <div class="official-kpi"><span>นักเรียนทั้งหมด</span><strong>${metrics.studentCount} คน</strong></div>
      <div class="official-kpi"><span>อัตรามาเรียน</span><strong>${metrics.attendanceRate}%</strong></div>
      <div class="official-kpi"><span>คะแนนเฉลี่ย</span><strong>${metrics.scoreAverage}%</strong></div>
      <div class="official-kpi"><span>ต้องติดตาม</span><strong>${metrics.behaviorFollowUps + metrics.healthFollowUps} รายการ</strong></div>
    </section>
    <h2 class="official-section-title">1. สรุปผลตามภารกิจ</h2>
    <table class="official-table"><thead><tr><th>ด้าน</th><th>ผลช่วงนี้</th><th>เกณฑ์กำกับ</th><th>สถานะ</th><th>สาระสำคัญ/แนวทางดำเนินงาน</th></tr></thead><tbody>${executiveRows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index > 0 && index < 4 ? 'official-center' : ''}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <h2 class="official-section-title">2. ประเด็นเสนอเพื่อพิจารณาและข้อสั่งการ</h2>
    <div class="official-decision">${escapeHtml(proposedAction)}<br /><br />ข้อสั่งการผู้บริหาร ........................................................................................................................................................................</div>
    <div class="official-certification">รายงานฉบับนี้ประมวลผลจากข้อมูลเวลาเรียน คะแนน สุขภาพ พฤติกรรม และการออมที่บันทึกใน workspace เดียวกัน ณ วันตัดยอด</div>
    ${buildOfficialSignaturesHtml([
      { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำรายงาน' },
      ...(reportIdentity.coAdvisorName?.trim() ? [{ name: reportIdentity.coAdvisorName, role: 'ที่ปรึกษาร่วม' }] : []),
      { name: reportIdentity.academicHeadName, role: 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ' },
      { name: reportIdentity.directorName, role: 'ทราบ / อนุมัติ' },
    ])}
    ${buildOfficialFooterHtml({ confidential: true, documentCode })}
  </main></body></html>`;
}

interface ViewerReportSummaryData {
  attendance: { absent: number; activity: number; late: number; leave: number; present: number; present_rate: number; sick: number; total: number };
  behavior: { points: number; record_count: number };
  classroom_count: number;
  health: { record_count: number };
  home_visits: { completed: number; visit_count: number };
  range: { from: string; to: string };
  savings: { account_count: number; total_balance: number };
  scores: { assessment_count: number; average_percent: number; entry_count: number };
  student_count: number;
}

function ViewerReportSummary({ session }: ReportsPageProps) {
  const demoMode = isDemoSession(session);
  const initialRange = getMonthDateRange(getTodayDate().slice(0, 7));
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [summary, setSummary] = useState<ViewerReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSummary() {
      if (!supabase || !session.workspace || demoMode) {
        if (mounted) {
          if (demoMode) {
            setSummary({
              attendance: { absent: 0, activity: 0, late: 1, leave: 1, present: 1, present_rate: 66.67, sick: 0, total: 3 },
              behavior: { points: 1, record_count: 2 },
              classroom_count: 1,
              health: { record_count: 10 },
              home_visits: { completed: 1, visit_count: 1 },
              range: { from: dateFrom, to: dateTo },
              savings: { account_count: 3, total_balance: 995 },
              scores: { assessment_count: 2, average_percent: 80, entry_count: 3 },
              student_count: 3,
            });
            setNotice(null);
          } else {
            setSummary(null);
            setNotice('ต้องเชื่อม Supabase และเลือก workspace ก่อนจึงจะดูรายงานได้');
          }
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setNotice(null);
      const { data, error } = await supabase.rpc('get_workspace_viewer_report_summary', {
        target_workspace_id: session.workspace.id,
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (!mounted) return;
      if (error) {
        setSummary(null);
        setNotice(`โหลดรายงานสรุปไม่สำเร็จ: ${error.message}`);
      } else {
        setSummary(data as unknown as ViewerReportSummaryData);
      }
      setLoading(false);
    }
    void loadSummary();
    return () => { mounted = false; };
  }, [dateFrom, dateTo, demoMode, session.workspace]);

  const cards = summary ? [
    { label: 'นักเรียนในขอบเขต', value: summary.student_count.toLocaleString('th-TH'), detail: `${summary.classroom_count} ห้องเรียน` },
    { label: 'มาเรียน', value: `${Number(summary.attendance.present_rate).toLocaleString('th-TH')}%`, detail: `${summary.attendance.present + summary.attendance.late}/${summary.attendance.total} รายการ` },
    { label: 'คะแนนเฉลี่ย', value: `${Number(summary.scores.average_percent).toLocaleString('th-TH')}%`, detail: `${summary.scores.assessment_count} แบบประเมิน` },
    { label: 'เงินออมรวม', value: `${Number(summary.savings.total_balance).toLocaleString('th-TH')} บาท`, detail: `${summary.savings.account_count} บัญชี` },
  ] : [];

  return (
    <main className="app-page space-y-5">
      <section className="nexus-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="bg-slate-950 p-5 text-white sm:p-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-lime-900"><ShieldCheck size={16} aria-hidden="true" /> Viewer Report</span>
            <h1 className="mt-4 text-4xl font-black tracking-tight !text-white sm:text-5xl">รายงานสรุปสำหรับผู้บริหาร</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 !text-slate-300">แสดงเฉพาะข้อมูลรวมของห้องเรียนที่ได้รับสิทธิ์ ไม่เปิดรายชื่อนักเรียน เลขประจำตัว หรือรายละเอียดสุขภาพรายบุคคล</p>
          </div>
          <div className="bg-slate-950 p-5 text-white sm:p-7">
            <p className="text-sm font-black text-cyan-200">{session.workspace?.schoolName || 'โรงเรียน'}</p>
            <p className="mt-2 text-2xl font-black">ขอบเขตข้อมูลที่ได้รับมอบหมาย</p>
            <p className="mt-4 text-sm font-bold leading-7 text-slate-300">สิทธิ์ถูกตรวจทั้งในหน้าเว็บและฐานข้อมูลตาม workspace, บทบาท และห้องเรียน</p>
          </div>
        </div>
      </section>

      <section className="app-panel-pad">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2 text-sm font-black text-slate-700">ตั้งแต่วันที่<ThaiDatePicker onValueChange={setDateFrom} value={dateFrom} /></label>
          <label className="grid gap-2 text-sm font-black text-slate-700">ถึงวันที่<ThaiDatePicker onValueChange={setDateTo} value={dateTo} /></label>
        </div>
      </section>

      {loading ? <section className="app-panel-pad text-sm font-bold text-slate-600">กำลังรวบรวมรายงานที่ได้รับสิทธิ์…</section> : null}
      {notice ? <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><AlertTriangle className="shrink-0" size={18} aria-hidden="true" />{notice}</div> : null}
      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => <article className="app-panel-pad" key={card.label}><p className="text-xs font-black text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p><p className="mt-2 text-xs font-bold text-slate-500">{card.detail}</p></article>)}
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="app-panel-pad"><h2 className="text-xl font-black">เวลาเรียน</h2><div className="mt-4 grid grid-cols-3 gap-2 text-center">{[['ขาด', summary.attendance.absent], ['สาย', summary.attendance.late], ['ลา/ป่วย', summary.attendance.leave + summary.attendance.sick]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-3" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div></article>
            <article className="app-panel-pad"><h2 className="text-xl font-black">การดูแลนักเรียน</h2><div className="mt-4 grid grid-cols-3 gap-2 text-center">{[['พฤติกรรม', summary.behavior.record_count], ['สุขภาพ', summary.health.record_count], ['เยี่ยมบ้านแล้ว', summary.home_visits.completed]].map(([label, value]) => <div className="rounded-2xl bg-slate-50 p-3" key={label}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div></article>
          </section>
        </>
      ) : null}
    </main>
  );
}

function TeacherReportsPage({ session }: ReportsPageProps) {
  const demoMode = isDemoSession(session);
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
  const [healthRecords, setHealthRecords] = useState<StudentHealthRecordRow[]>(demoHealthRecords);
  const [guardians, setGuardians] = useState<StudentGuardianReportRow[]>(demoGuardians);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [reportView, setReportView] = useState<ReportView>(initialReportView);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>(initialReportPeriod);
  const [reportMonth, setReportMonth] = useState(getTodayDate().slice(0, 7));
  const [selectedTerm, setSelectedTerm] = useState<TermKey>('term1');
  const [termRanges, setTermRanges] = useState<Record<TermKey, { end: string; start: string }>>({
    term1: { end: '2026-10-10', start: '2026-05-16' },
    term2: { end: '2027-03-31', start: '2026-11-01' },
  });
  const [reportIdentity, setReportIdentity] = useState<SchoolReportIdentity>(() => loadSchoolReportIdentity(session.workspace?.id));
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [dateFrom, setDateFrom] = useState(getTodayDate());
  const [dateTo, setDateTo] = useState(getTodayDate());
  const [query, setQuery] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState('');
  const [registerOrientation, setRegisterOrientation] = useState<RegisterOrientation>('portrait');
  const [registerFields, setRegisterFields] = useState<RegisterFieldSelection>({
    address: false,
    citizenId: false,
    family: false,
    health: false,
  });
  const [revealCitizenIds, setRevealCitizenIds] = useState(false);
  const [coreMetrics, setCoreMetrics] = useState<CoreReportMetrics>(emptyCoreMetrics);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อออกรายงานจาก Supabase จริง',
  );

  useEffect(() => {
    let mounted = true;
    async function loadWorkspaceIdentity() {
      if (!supabase || !session.workspace || demoMode) return;
      const { data, error } = await supabase
        .from('workspaces')
        .select('school_name,academic_year,settings')
        .eq('id', session.workspace.id)
        .maybeSingle();
      if (!mounted || error || !data) return;
      const settings = (data.settings || {}) as { classroom_name?: string; report_identity?: Partial<SchoolReportIdentity> };
      const identity = {
        ...loadSchoolReportIdentity(session.workspace.id),
        ...(settings.report_identity || {}),
        academicYear: data.academic_year || session.workspace.academicYear,
        classroomName: settings.classroom_name || session.workspace.classroomName,
        schoolName: data.school_name || session.workspace.schoolName,
      };
      setReportIdentity(identity);
      saveSchoolReportIdentity(identity, session.workspace.id);
    }
    void loadWorkspaceIdentity();
    return () => { mounted = false; };
  }, [demoMode, session.workspace]);

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
      if (!supabase || !session.workspace || demoMode) {
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
        setHealthRecords(demoHealthRecords);
        setGuardians(demoGuardians);
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
          .select('id,student_code,first_name,last_name,nickname,classroom_id,birth_date,gender,status,health_flags,metadata')
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
      setClassroomId((current) =>
        current && nextClassrooms.some((classroom) => classroom.id === current) ? current : nextClassrooms[0]?.id || '',
      );

      const [
        { data: assessmentRows, error: assessmentError },
        { data: accountRows, error: accountError },
        { data: transactionRows, error: transactionError },
        { data: behaviorRows, error: behaviorError },
        { data: homeVisitRows, error: homeVisitError },
        { data: healthRows, error: healthError },
        { data: guardianRows, error: guardianError },
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
        supabase
          .from('student_health_records')
          .select('id,student_id,record_date,record_type,status,weight_kg,height_cm,bmi,inspection_results,note')
          .eq('workspace_id', session.workspace.id)
          .gte('record_date', dateFrom)
          .lte('record_date', dateTo)
          .order('record_date', { ascending: false })
          .limit(3000),
        supabase
          .from('student_guardians')
          .select('student_id,display_name,relation,phone,is_primary')
          .eq('workspace_id', session.workspace.id)
          .order('is_primary', { ascending: false })
          .limit(3000),
      ]);

      if (assessmentError || accountError || transactionError || behaviorError || homeVisitError || healthError || guardianError) {
        setNotice(
          assessmentError?.message ||
            accountError?.message ||
            transactionError?.message ||
            behaviorError?.message ||
            homeVisitError?.message ||
            healthError?.message ||
            guardianError?.message ||
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
      const nextHealthRecords = (healthRows || []) as StudentHealthRecordRow[];
      const nextGuardians = (guardianRows || []) as StudentGuardianReportRow[];
      setScoreAssessments(nextAssessments);
      setScoreEntries(nextScoreEntries);
      setSavingsAccounts(nextSavingsAccounts);
      setSavingsTransactions(nextSavingsTransactions);
      setBehaviorRecords(nextBehaviorRecords);
      setHomeVisits(nextHomeVisits);
      setHealthRecords(nextHealthRecords);
      setGuardians(nextGuardians);

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
  }, [dateFrom, dateTo, demoMode, session.workspace]);

  const reportRows = useMemo(() => {
    const rows = buildReportRows(classrooms, students, attendanceSessions, attendanceRecords);
    const normalizedQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      const targetClassroom = classrooms.find((item) => item.id === classroomId) || classrooms[0];
      if (targetClassroom && row.classroomName !== targetClassroom.name) return false;
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

  const subjectOptions = useMemo(
    () => Array.from(new Set(attendanceSessions.map((item) => item.subject_name).filter((item): item is string => Boolean(item) && item !== 'โฮมรูม'))).sort(),
    [attendanceSessions],
  );
  const periodOptions = useMemo(
    () => Array.from(new Set(attendanceSessions.map((item) => item.period_label).filter(Boolean))).sort(),
    [attendanceSessions],
  );
  const subjectReportRows = useMemo(
    () =>
      reportRows.filter(
        (row) =>
          (!selectedSubjectName || row.subjectName === selectedSubjectName) &&
          (!selectedPeriodLabel || row.periodLabel === selectedPeriodLabel),
      ),
    [reportRows, selectedPeriodLabel, selectedSubjectName],
  );
  const subjectAttendanceGrid = useMemo(
    () =>
      buildMonthlyAttendanceGrid({
        attendanceRecords,
        attendanceSessions,
        classroomId,
        classrooms,
        dateFrom,
        periodLabel: selectedPeriodLabel,
        sessionKind: 'subject',
        students,
        subjectName: selectedSubjectName,
      }),
    [attendanceRecords, attendanceSessions, classroomId, classrooms, dateFrom, selectedPeriodLabel, selectedSubjectName, students],
  );
  useEffect(() => {
    if (reportView !== 'subject-attendance') return;
    if (!selectedSubjectName && subjectOptions[0]) setSelectedSubjectName(subjectOptions[0]);
    if (!selectedPeriodLabel && periodOptions[0]) setSelectedPeriodLabel(periodOptions[0]);
  }, [periodOptions, reportView, selectedPeriodLabel, selectedSubjectName, subjectOptions]);

  const monthlyAttendanceGrid = useMemo(
    () =>
      buildMonthlyAttendanceGrid({
        attendanceRecords,
        attendanceSessions,
        classroomId,
        classrooms,
        dateFrom,
        sessionKind: 'daily',
        students,
      }),
    [attendanceRecords, attendanceSessions, classroomId, classrooms, dateFrom, students],
  );
  const activeAttendanceGrid = reportView === 'subject-attendance' ? subjectAttendanceGrid : monthlyAttendanceGrid;

  const monthlySavingsGrid = useMemo(
    () =>
      buildMonthlySavingsGrid({
        classroomId,
        classrooms,
        dateFrom,
        savingsAccounts,
        savingsTransactions,
        students,
      }),
    [classroomId, classrooms, dateFrom, savingsAccounts, savingsTransactions, students],
  );

  const monthContext = useMemo(() => getReportMonthContext(dateFrom), [dateFrom]);

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
  const scoreSubjectOptions = useMemo(
    () => Array.from(new Set(classroomScoreAssessments.map((item) => item.subject_name).filter(Boolean))).sort(),
    [classroomScoreAssessments]
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
  const classroomHealthRecords = useMemo(
    () => healthRecords.filter((record) => classroomStudentIds.has(record.student_id)),
    [classroomStudentIds, healthRecords],
  );
  const healthSummaryRows = useMemo(
    () => classroomStudents.map((student) => {
      const records = classroomHealthRecords.filter((record) => record.student_id === student.id);
      const summarizeRoutine = (recordType: HealthRecordType) => {
        const routineRecords = records.filter((record) => record.record_type === recordType);
        return {
          completed: routineRecords.filter((record) => record.status === 'completed').length,
          total: routineRecords.filter((record) => record.status !== 'exempt' && record.status !== 'not_checked').length,
        };
      };
      const latestGrowth = records.find((record) => record.record_type === 'growth') || null;
      const latestHygiene = records.find((record) => record.record_type === 'hygiene') || null;
      const attentionItems = Object.entries(latestHygiene?.inspection_results || {})
        .filter(([, status]) => status === 'attention')
        .map(([key]) => ({ hair: 'ผม', nails: 'เล็บ', skin: 'ผิวหนัง', teeth: 'ฟัน', uniform: 'เครื่องแต่งกาย', ears: 'หู', eyes: 'ตา' })[key] || key);

      return {
        attentionItems,
        brushing: summarizeRoutine('toothbrushing'),
        latestGrowth,
        latestHygiene,
        lunch: summarizeRoutine('lunch'),
        milk: summarizeRoutine('milk'),
        student,
      };
    }),
    [classroomHealthRecords, classroomStudents],
  );
  const registerHealthRows = useMemo<StudentRegisterHealthRow[]>(
    () => healthSummaryRows.map((row) => ({
      heightCm: row.latestGrowth?.height_cm ?? null,
      recordDate: row.latestGrowth?.record_date ?? null,
      studentId: row.student.id,
      weightKg: row.latestGrowth?.weight_kg ?? null,
    })),
    [healthSummaryRows],
  );
  const classroomGuardians = useMemo(
    () => guardians.filter((guardian) => classroomStudentIds.has(guardian.student_id)),
    [classroomStudentIds, guardians],
  );
  const activeRegisterFields = useMemo(
    () => registerFieldOptions.filter((field) => registerFields[field.value]).map((field) => field.value),
    [registerFields],
  );
  const executiveMetrics = useMemo<ExecutiveReportMetrics>(() => {
    const routineRecords = classroomHealthRecords.filter((record) => ['toothbrushing', 'milk', 'lunch'].includes(record.record_type));
    const routineCount = routineRecords.filter((record) => record.status !== 'exempt' && record.status !== 'not_checked').length;
    const completedCount = routineRecords.filter((record) => record.status === 'completed').length;
    return {
      attendanceRate: coreMetrics.attendance.presentRate,
      behaviorFollowUps: coreMetrics.behavior.followUps,
      healthCompletionRate: routineCount > 0 ? round((completedCount / routineCount) * 100) : 0,
      healthFollowUps: healthSummaryRows.filter((row) => row.attentionItems.length > 0 || row.latestHygiene?.status === 'attention').length,
      savingsTotal: coreMetrics.savings.totalBalance,
      scoreAverage: coreMetrics.scores.averagePercent,
      studentCount: classroomStudents.length,
    };
  }, [classroomHealthRecords, classroomStudents.length, coreMetrics, healthSummaryRows]);
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
      : reportView === 'subject-attendance'
        ? subjectReportRows.length
      : reportView === 'savings'
        ? classroomSavingsTransactions.length
        : reportView === 'scores'
          ? scoreAssessmentRows.length
          : reportView === 'health'
            ? classroomHealthRecords.length
          : reportView === 'student-register'
            ? classroomStudents.length
          : reportView === 'executive'
            ? classroomStudents.length
          : reportView === 'behavior'
            ? behaviorReportRows.length
            : reportView === 'individual' && selectedStudent
              ? 1
              : 0;
  const exportableAttendance =
    ((reportView === 'attendance' && monthlyAttendanceGrid.rows.length > 0) ||
      (reportView === 'subject-attendance' && activeAttendanceGrid.rows.length > 0)) ||
    (reportView === 'savings' && monthlySavingsGrid.rows.length > 0);
  const printableReport = reportView !== 'settings' && activeReportRowCount > 0;
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

  function buildActiveReportHtml() {
    const common = {
      dateFrom,
      dateTo,
      reportIdentity,
      schoolName: session.workspace?.schoolName || 'Demo Workspace',
      teacherName: session.profile.displayName,
      workspaceName: selectedClassroom?.name || session.workspace?.name || 'Demo Workspace',
    };

    if (reportView === 'savings') {
      return buildPrintableSavingsReportHtml({
        dateFrom,
        savingsGrid: monthlySavingsGrid,
        schoolName: common.schoolName,
        teacherName: common.teacherName,
        workspaceName: common.workspaceName,
        reportIdentity,
      });
    }

    if (reportView === 'attendance') {
      return buildPrintableReportHtml({
        attendanceGrid: activeAttendanceGrid,
        dateFrom,
        schoolName: common.schoolName,
        teacherName: common.teacherName,
        workspaceName: common.workspaceName,
        reportIdentity,
      });
    }

    if (reportView === 'subject-attendance') {
      // Build one attendance grid per subject — each gets its own page
      const gridHtmlParts = subjectOptions.map((subject, index) => {
        const subjectGrid = buildMonthlyAttendanceGrid({
          attendanceRecords,
          attendanceSessions,
          classroomId,
          classrooms,
          dateFrom,
          sessionKind: 'subject',
          subjectName: subject,
          students,
        });
        const html = buildPrintableReportHtml({
          attendanceGrid: subjectGrid,
          dateFrom,
          schoolName: common.schoolName,
          teacherName: common.teacherName,
          workspaceName: `${common.workspaceName} · ${subject}`,
          reportIdentity,
        });
        // Extract body content for all-in-one HTML
        const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
        const styleMatch = index === 0 ? html.match(/<style>([\s\S]*?)<\/style>/) : null;
        return { body: bodyMatch?.[1] ?? html, style: styleMatch?.[1] ?? '' };
      });

      if (gridHtmlParts.length === 0) {
        return buildPrintableReportHtml({
          attendanceGrid: activeAttendanceGrid,
          dateFrom,
          schoolName: common.schoolName,
          teacherName: common.teacherName,
          workspaceName: common.workspaceName,
          reportIdentity,
        });
      }

      // Combine all subjects into single printable HTML with page breaks
      const combinedStyle = gridHtmlParts[0].style;
      const combinedBody = gridHtmlParts
        .map((part, i) => `<div style="${i > 0 ? 'page-break-before:always;' : ''}">${part.body}</div>`)
        .join('');

      return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>รายงานเวลาเรียนรายวิชา</title><style>${combinedStyle}</style></head><body>${combinedBody}</body></html>`;
    }

    if (reportView === 'scores') {
      // Build the summary table HTML
      const summaryHtml = buildPrintableTableReportHtml({
        ...common,
        columns: ['วันที่', 'รายวิชา', 'รายการประเมิน', 'ประเภท', 'เต็ม', 'เฉลี่ย', 'เฉลี่ย %', 'กรอกแล้ว', 'ยังว่าง'],
        documentPrefix: 'CC-SCO',
        rows: scoreAssessmentRows.map((row) => [
          formatThaiOfficialDate(row.assessment.assessment_date),
          row.assessment.subject_name,
          row.assessment.title,
          scoreCategoryLabels[row.assessment.category],
          row.assessment.max_score,
          row.averageScore,
          `${row.averagePercent}%`,
          row.enteredCount,
          row.missingCount,
        ]),
        subtitle: `${periodLabel} | สรุป ${scoreAssessmentRows.length} ชุดคะแนน`,
        title: 'รายงานสรุปคะแนนประจำชั้น',
      });

      if (scoreAssessmentRows.length === 0) return summaryHtml;

      // Extract style from summary HTML (use only once)
      const summaryStyleMatch = summaryHtml.match(/<style>([\s\S]*?)<\/style>/);
      const sharedStyle = summaryStyleMatch?.[1] ?? '';
      const summaryBodyMatch = summaryHtml.match(/<body>([\s\S]*?)<\/body>/);
      const summaryBody = summaryBodyMatch?.[1] ?? summaryHtml;

      // Build per-assessment student breakdown pages
      const detailPages = scoreAssessmentRows.map((row) => {
        const assessmentEntries = (scoreEntriesByAssessment.get(row.assessment.id) || [])
          .filter((e) => classroomStudentIds.has(e.student_id));
        const entryByStudent = new Map(assessmentEntries.map((e) => [e.student_id, e]));
        const studentTableRows = classroomStudents.map((student, idx) => {
          const entry = entryByStudent.get(student.id);
          const scoreVal = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : null;
          const maxScore = Number(row.assessment.max_score || 0);
          const pct = scoreVal !== null && maxScore > 0 ? `${round((scoreVal / maxScore) * 100)}%` : '-';
          return `<tr>
            <td style="text-align:center;width:8mm">${idx + 1}</td>
            <td style="text-align:center;width:22mm">${escapeHtml(student.student_code || '-')}</td>
            <td>${escapeHtml(`${student.first_name} ${student.last_name}`)}</td>
            <td style="text-align:center;width:16mm;font-weight:700;color:${scoreVal === null ? '#94a3b8' : scoreVal >= maxScore * 0.5 ? '#065f46' : '#be123c'}">${scoreVal !== null ? scoreVal : '-'}</td>
            <td style="text-align:center;width:14mm">${pct}</td>
            <td style="width:36mm">${escapeHtml(entry?.note || '-')}</td>
          </tr>`;
        }).join('');
        return `<div style="page-break-before:always;">
          <div style="font-family:'TH Sarabun New',Tahoma,sans-serif;padding:8mm 12mm;">
            <div style="border-bottom:2px solid #0ea5e9;padding-bottom:4mm;margin-bottom:4mm;">
              <div style="font-size:14pt;font-weight:900">${escapeHtml(common.workspaceName)}</div>
              <div style="font-size:11pt;font-weight:700">ตารางคะแนน: ${escapeHtml(row.assessment.title)}</div>
              <div style="font-size:9pt;color:#475569">วิชา: ${escapeHtml(row.assessment.subject_name)} · ประเภท: ${escapeHtml(scoreCategoryLabels[row.assessment.category])} · คะแนนเต็ม: ${row.assessment.max_score} · วันที่: ${formatThaiOfficialDate(row.assessment.assessment_date)}</div>
              <div style="font-size:9pt;color:#475569">กรอกแล้ว ${row.enteredCount} คน · เฉลี่ย ${row.averageScore} คะแนน (${row.averagePercent}%)</div>
            </div>
            <table style="border-collapse:collapse;width:100%;font-size:9pt">
              <thead>
                <tr style="background:#e0f2fe">
                  <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">ที่</th>
                  <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">รหัส</th>
                  <th style="border:1px solid #334155;padding:2mm 3mm;text-align:left">ชื่อ-สกุล</th>
                  <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">คะแนน</th>
                  <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">%</th>
                  <th style="border:1px solid #334155;padding:2mm 2mm;text-align:left">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>${studentTableRows}</tbody>
            </table>
          </div>
        </div>`;
      }).join('');

      return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>รายงานคะแนนประจำชั้น</title><style>${sharedStyle}td,th{border:1px solid #334155;padding:1mm 2mm;font-size:9pt}</style></head><body><div>${summaryBody}</div>${detailPages}</body></html>`;
    }

    if (reportView === 'health') {
      return buildPrintableTableReportHtml({
        ...common,
        columns: ['รหัส', 'ชื่อ-สกุล', 'แปรงฟัน', 'ดื่มนม', 'อาหารกลางวัน', 'น้ำหนัก', 'ส่วนสูง', 'BMI', 'ตรวจสุขภาพล่าสุด', 'จุดติดตาม'],
        documentPrefix: 'CC-HLT',
        rows: healthSummaryRows.map((row) => [
          row.student.student_code || '-',
          `${row.student.first_name} ${row.student.last_name}`,
          `${row.brushing.completed}/${row.brushing.total}`,
          `${row.milk.completed}/${row.milk.total}`,
          `${row.lunch.completed}/${row.lunch.total}`,
          row.latestGrowth?.weight_kg ? `${row.latestGrowth.weight_kg} กก.` : '-',
          row.latestGrowth?.height_cm ? `${row.latestGrowth.height_cm} ซม.` : '-',
          row.latestGrowth?.bmi ?? '-',
          formatThaiOfficialDate(row.latestHygiene?.record_date),
          row.attentionItems.join(', ') || row.latestHygiene?.note || '-',
        ]),
        subtitle: `${periodLabel} | กิจวัตรที่ทำสำเร็จ/จำนวนครั้งที่บันทึก`,
        title: 'รายงานสุขภาพและกิจวัตรนักเรียน',
      });
    }

    if (reportView === 'student-register') {
      return buildPrintableStudentRegisterHtml({
        classroomName: common.workspaceName,
        dateFrom,
        dateTo,
        fields: registerFields,
        guardians: classroomGuardians,
        healthRows: registerHealthRows,
        orientation: registerOrientation,
        reportIdentity,
        revealCitizenIds,
        schoolName: common.schoolName,
        students: classroomStudents,
        teacherName: common.teacherName,
      });
    }

    if (reportView === 'executive') {
      return buildPrintableExecutiveReportHtml({
        classroomName: common.workspaceName,
        dateFrom,
        dateTo,
        metrics: executiveMetrics,
        reportIdentity,
        schoolName: common.schoolName,
        teacherName: common.teacherName,
      });
    }

    if (reportView === 'behavior') {
      return buildPrintableTableReportHtml({
        ...common,
        columns: ['วันที่', 'รหัส', 'นักเรียน', 'ประเภท', 'หมวด', 'คะแนน', 'การติดตาม', 'รายละเอียด'],
        documentPrefix: 'CC-BHV',
        rows: behaviorReportRows.map((row) => {
          const student = studentById.get(row.student_id);
          return [
            formatThaiOfficialDate(row.behavior_date),
            student?.student_code || '-',
            student ? `${student.first_name} ${student.last_name}` : '-',
            toneLabels[row.tone],
            row.category,
            row.points,
            followUpLabels[row.follow_up_status],
            row.description,
          ];
        }),
        subtitle: `${periodLabel} | คะแนนรวม ${coreMetrics.behavior.totalPoints} | ต้องติดตาม ${coreMetrics.behavior.followUps} รายการ`,
        title: 'รายงานพฤติกรรมและเคสดูแลนักเรียน',
      });
    }

    if (reportView === 'subject-scores') {
      const assessments = classroomScoreAssessments.filter((a) => a.subject_name === selectedSubjectName);
      const totalMaxScore = assessments.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
      
      const rowsHtml = classroomStudents.map((student, idx) => {
        let totalScore = 0;
        let missingCount = 0;
        
        const scoreColsHtml = assessments.map((a) => {
          const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
          const score = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : null;
          if (score !== null) {
            totalScore += score;
          } else {
            missingCount += 1;
          }
          return `<td style="text-align:center;width:12mm">${score !== null ? score : '-'}</td>`;
        }).join('');
        
        return `<tr style="page-break-inside:avoid;">
          <td style="text-align:center;width:8mm">${idx + 1}</td>
          <td style="text-align:center;width:18mm">${escapeHtml(student.student_code || '-')}</td>
          <td>${escapeHtml(`${student.first_name} ${student.last_name}`)}</td>
          ${scoreColsHtml}
          <td style="text-align:center;width:15mm;font-weight:700">${totalScore}</td>
          <td style="text-align:center;width:15mm;color:#be123c">${missingCount > 0 ? missingCount : '-'}</td>
        </tr>`;
      }).join('');
      
      const headerColsHtml = assessments.map((a) => `<th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">${escapeHtml(a.title)}<br/>(${a.max_score})</th>`).join('');

      return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>รายงานคะแนนรายวิชา</title><style>body{margin:0;color:#0f172a;}td,th{border:1px solid #334155;padding:1.5mm 1mm;font-size:10pt}table{width:100%;border-collapse:collapse;}</style></head><body>
        <div style="font-family:'TH Sarabun New',Tahoma,sans-serif;padding:8mm 12mm;">
          <div style="border-bottom:2px solid #0ea5e9;padding-bottom:4mm;margin-bottom:4mm;display:flex;justify-content:space-between;align-items:flex-end;">
            <div>
              <div style="font-size:16pt;font-weight:900">${escapeHtml(common.workspaceName)}</div>
              <div style="font-size:12pt;font-weight:700">ตารางคะแนนรวมและงานค้างแยกรายวิชา</div>
              <div style="font-size:10pt;color:#475569">วิชา: ${escapeHtml(selectedSubjectName || '-')} &middot; คะแนนเต็มรวม: ${totalMaxScore}</div>
            </div>
          </div>
          <table>
            <thead style="display:table-header-group">
              <tr style="background:#e0f2fe;page-break-inside:avoid;">
                <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">ที่</th>
                <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">รหัส</th>
                <th style="border:1px solid #334155;padding:2mm 3mm;text-align:left">ชื่อ-สกุล</th>
                ${headerColsHtml}
                <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">รวม<br/>(${totalMaxScore})</th>
                <th style="border:1px solid #334155;padding:2mm 1mm;text-align:center">ค้าง</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </body></html>`;
    }

    return buildPrintableTableReportHtml({
      ...common,
      columns: ['หัวข้อ', 'ผลสรุป', 'รายละเอียด'],
      documentPrefix: 'CC-IND',
      rows: selectedStudent
        ? [
            ['นักเรียน', `${selectedStudent.first_name} ${selectedStudent.last_name}`, `รหัส ${selectedStudent.student_code || '-'}`],
            ['เวลาเรียน', `${selectedStudentAttendanceRecords.length} รายการ`, `ช่วง ${formatThaiOfficialDate(dateFrom)} ถึง ${formatThaiOfficialDate(dateTo)}`],
            ['คะแนนเฉลี่ย', `${selectedStudentScoreAverage}%`, `${selectedStudentScoreEntries.length} รายการคะแนน`],
            ['เงินออม', `${formatBaht(Number(savingsAccountByStudent.get(selectedStudent.id)?.balance || 0))} บาท`, `${selectedStudentSavingsTransactions.length} รายการในช่วงนี้`],
            ['พฤติกรรม/เคสดูแล', `${selectedStudentBehaviorRecords.length} รายการ`, `ต้องติดตาม ${selectedStudentBehaviorRecords.filter((row) => !['none', 'resolved'].includes(row.follow_up_status)).length} รายการ`],
            ['เยี่ยมบ้าน กสศ.01', `${selectedHomeVisit?.completion_percent || 0}%`, selectedHomeVisit?.status || 'ยังไม่มีข้อมูล'],
          ]
        : [],
      subtitle: `${periodLabel} | ${selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'ยังไม่ได้เลือกนักเรียน'}`,
      title: 'รายงานสรุปรายบุคคล',
    });
  }

  function exportCsv() {
    const headers = ['วันที่', 'ช่วงเวลา', 'ห้องเรียน', 'รหัส', 'นักเรียน', 'สถานะ', 'หมายเหตุ', 'แหล่งข้อมูล'];
    const lines = [
      headers.map(escapeCsv).join(','),
      ...(reportView === 'subject-attendance' ? subjectReportRows : reportRows).map((row) =>
        [
          row.date,
          row.periodLabel,
          row.classroomName,
          row.studentCode,
          row.studentName,
          statusLabels[row.status],
          row.note,
          'พิมพ์จากระบบ ClassCare 360',
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
    const html = buildActiveReportHtml();

    downloadBlob(
      `classcare-${reportView}-monthly-${dateFrom.slice(0, 7)}.xls`,
      new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    );
  }

  function exportJsonPackage() {
    const activeRows =
      reportView === 'attendance' || reportView === 'subject-attendance'
        ? (reportView === 'subject-attendance' ? subjectReportRows : reportRows).map((row) => ({ ...row, statusLabel: statusLabels[row.status] }))
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
            : reportView === 'health'
              ? healthSummaryRows.map((row) => ({
                  bmi: row.latestGrowth?.bmi ?? null,
                  brushingCompleted: row.brushing.completed,
                  brushingRecorded: row.brushing.total,
                  heightCm: row.latestGrowth?.height_cm ?? null,
                  hygieneAttentionItems: row.attentionItems,
                  hygieneDate: row.latestHygiene?.record_date ?? null,
                  lunchCompleted: row.lunch.completed,
                  lunchRecorded: row.lunch.total,
                  milkCompleted: row.milk.completed,
                  milkRecorded: row.milk.total,
                  studentCode: row.student.student_code,
                  studentName: `${row.student.first_name} ${row.student.last_name}`,
                  weightKg: row.latestGrowth?.weight_kg ?? null,
                }))
            : reportView === 'student-register'
              ? classroomStudents.map((student) => ({
                  fields: Object.fromEntries(activeRegisterFields.map((field) => [field, getRegisterFieldValue(student, field, classroomGuardians, registerHealthRows, revealCitizenIds)])),
                  studentCode: student.student_code,
                  studentName: `${student.first_name} ${student.last_name}`,
                }))
            : reportView === 'executive'
              ? [executiveMetrics]
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
      source: 'ClassCare 360',
      filters: {
        classroomId,
        dateFrom,
        dateTo,
        query,
        registerFields,
        registerOrientation,
        reportPeriod,
        reportView,
        selectedPeriodLabel,
        selectedSubjectName,
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

    const html = buildActiveReportHtml();

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 350);
  }

  const saveReportIdentitySettings = () => {
    saveSchoolReportIdentity(reportIdentity, session.workspace?.id);
    setNotice('บันทึกตั้งค่าผู้ลงนามในรายงานแล้ว');
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageFile(file);
      setReportIdentity((current) => ({ ...current, schoolLogoDataUrl: compressedDataUrl }));
    } catch (error) {
      setNotice(`อัปโหลดโลโก้ไม่สำเร็จ: ${String(error)}`);
    }
  };

  return (
    <main className="report-v2 app-page">
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
            disabled={!printableReport}
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
            disabled={!printableReport}
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

      <nav aria-label="ประเภทรายงาน" className="mt-5 flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-hide">
        {reportViews.map((item) => {
          const icons: Record<string, string> = {
            'attendance': '📅',
            'subject-attendance': '📖',
            'savings': '🐷',
            'scores': '🎯',
            'subject-scores': '📊',
            'health': '🏥',
            'student-register': '📋',
            'executive': '👔',
            'individual': '👤',
            'behavior': '💬',
            'settings': '⚙️',
          };
          const isActive = reportView === item.value;
          return (
            <button
              key={item.value}
              type="button"
              title={item.description}
              onClick={() => updateReportSearch({ reportView: item.value })}
              className={`group flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-all duration-200 snap-start ${
                isActive
                  ? 'border-cyan-500 bg-cyan-50 shadow-sm ring-1 ring-cyan-500/20'
                  : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-slate-50'
              }`}
            >
              <span className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110 drop-shadow-sm' : 'group-hover:scale-110'}`}>
                {icons[item.value] || '📄'}
              </span>
              <strong className={`font-black ${isActive ? 'text-cyan-800' : 'text-slate-600 group-hover:text-cyan-700'}`}>
                {item.label}
              </strong>
            </button>
          );
        })}
      </nav>

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

      <section className="app-workbench">
        <aside className="grid gap-4">
          <section className="nexus-card p-4 sm:p-5">
            <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
              <CalendarRange size={16} className="text-amber-600" aria-hidden="true" />
              ตัวกรองรายงาน
            </div>

            <div className="mt-4 grid gap-3">
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
                  <ThaiDatePicker className="h-11 px-3" mode="month" onValueChange={setReportMonth} value={reportMonth} />
                </label>
              ) : null}

              {reportView === 'subject-attendance' ? (
                <div className="grid gap-3 rounded-3xl border border-cyan-200 bg-cyan-50/60 p-3">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    รายวิชา
                    <select className="nexus-field h-11 px-3" onChange={(event) => setSelectedSubjectName(event.target.value)} value={selectedSubjectName}>
                      {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    คาบเรียน
                    <select className="nexus-field h-11 px-3" onChange={(event) => setSelectedPeriodLabel(event.target.value)} value={selectedPeriodLabel}>
                      {periodOptions.map((period) => <option key={period} value={period}>{period}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}
              {reportView === 'subject-scores' ? (
                <div className="grid gap-3 rounded-3xl border border-cyan-200 bg-cyan-50/60 p-3 mt-3">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    เลือกวิชาที่ต้องการดูคะแนน
                    <select className="nexus-field h-11 px-3" onChange={(event) => setSelectedSubjectName(event.target.value)} value={selectedSubjectName}>
                      <option value="">-- กรุณาเลือกวิชา --</option>
                      {scoreSubjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}

              {reportView === 'student-register' ? (
                <section className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                  <div>
                    <p className="text-sm font-black text-slate-950">รูปแบบกระดาษ A4</p>
                    <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="แนวกระดาษทะเบียนนักเรียน">
                      {([
                        ['portrait', 'แนวตั้ง', 'บัญชีรายชื่อแบบกระชับ'],
                        ['landscape', 'แนวนอน', 'ตารางรายละเอียดหลายช่อง'],
                      ] as const).map(([value, label, description]) => (
                        <button
                          aria-pressed={registerOrientation === value}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${registerOrientation === value ? 'border-cyan-500 bg-cyan-50 text-cyan-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700'}`}
                          key={value}
                          onClick={() => setRegisterOrientation(value)}
                          type="button"
                        >
                          <strong className="block text-sm">{label}</strong>
                          <small className="mt-1 block text-[11px] font-bold opacity-75">{description}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-950">ข้อมูลที่ต้องการแสดง</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">เลขประจำตัวนักเรียนและชื่อ–สกุลจะแสดงเสมอ</p>
                    <div className="mt-2 grid gap-2">
                      {registerFieldOptions.map((field) => (
                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3" key={field.value}>
                          <input
                            checked={registerFields[field.value]}
                            className="mt-1 h-4 w-4"
                            onChange={(event) => setRegisterFields((current) => ({ ...current, [field.value]: event.target.checked }))}
                            type="checkbox"
                          />
                          <span><strong className="block text-sm text-slate-900">{field.label}</strong><small className="mt-0.5 block text-[11px] font-bold text-slate-500">{field.description}</small></span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {registerFields.citizenId ? (
                    <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-sm font-bold text-slate-700">
                      <input
                        checked={revealCitizenIds}
                        className="mt-1 h-4 w-4"
                        onChange={(event) => setRevealCitizenIds(event.target.checked)}
                        type="checkbox"
                      />
                      <span>แสดงเลขบัตรประชาชนเต็ม <small className="mt-1 block font-bold text-amber-700">ค่าเริ่มต้นปกปิดเพื่อคุ้มครองข้อมูลส่วนบุคคล</small></span>
                    </label>
                  ) : null}
                </section>
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
                      <ThaiDatePicker className="h-11 px-3" onValueChange={(value) => setTermRanges((current) => ({ ...current, [selectedTerm]: { ...current[selectedTerm], start: value } }))} value={termRanges[selectedTerm].start} />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      สิ้นสุดเทอม
                      <ThaiDatePicker className="h-11 px-3" onValueChange={(value) => setTermRanges((current) => ({ ...current, [selectedTerm]: { ...current[selectedTerm], end: value } }))} value={termRanges[selectedTerm].end} />
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
                  <ThaiDatePicker className="h-11 px-3" onValueChange={setDateFrom} value={dateFrom} />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ถึงวันที่
                  <ThaiDatePicker className="h-11 px-3" onValueChange={setDateTo} value={dateTo} />
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
              <p className="text-sm font-black text-teal-700">
          {activeReportConfig.label}{reportView === 'subject-scores' ? '' : ` / ${periodLabel}`}
        </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {activeReportConfig.description}
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {selectedClassroom?.name || '-'} | {dateFrom} ถึง {dateTo}
              </p>
            </div>
            <p className="text-xs font-bold text-slate-500">ระบบสารสนเทศ ClassCare 360</p>
          </div>

          {reportView === 'attendance' || reportView === 'subject-attendance' ? (
            <>
              {/* Dark Mode Monthly Attendance Grid (Reference Image #1) */}
              <div className="mt-5 rounded-3xl border border-slate-800 bg-[#080d1a] p-4 text-white shadow-2xl md:p-6">
                <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {reportView === 'subject-attendance'
                        ? `รายงานเวลาเรียน ${selectedSubjectName || 'รายวิชา'} / ${selectedPeriodLabel || 'คาบเรียน'}`
                        : `รายงานเวลาเรียนระดับชั้น ${selectedClassroom?.name || 'ประถมศึกษาปีที่ 5'} ประจำเดือน ${dateFrom.slice(0, 7)}`}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {session.workspace?.schoolName || 'โรงเรียนบ้านโคกสูง'} · ช่วงวันที่ {dateFrom} ถึง {dateTo}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-900/60 bg-[#0e1d20] px-3 py-1.5 text-xs font-black text-[#4ade80]">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#0a3525] text-sm font-black text-[#4ade80]">
                        {activeAttendanceGrid.summary.present}
                      </span>
                      มา
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-amber-900/60 bg-[#271d0e] px-3 py-1.5 text-xs font-black text-[#facc15]">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#452e0a] text-sm font-black text-[#facc15]">
                        {activeAttendanceGrid.summary.late}
                      </span>
                      สาย
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-sky-900/60 bg-[#0f2136] px-3 py-1.5 text-xs font-black text-[#38bdf8]">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#0b3356] text-sm font-black text-[#38bdf8]">
                        {activeAttendanceGrid.summary.leave}
                      </span>
                      ลา
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-900/60 bg-[#2e0f19] px-3 py-1.5 text-xs font-black text-[#f87171]">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#4c1021] text-sm font-black text-[#f87171]">
                        {activeAttendanceGrid.summary.absent}
                      </span>
                      ขาด
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="w-10 px-2 py-3 text-center">เลขที่</th>
                        <th className="w-48 px-3 py-3 text-left">ชื่อ-สกุล</th>
                        {monthContext.days.map((day) => (
                          <th
                            className={`w-8 px-1 py-3 text-center ${day.isWeekend ? 'bg-slate-900/60 text-slate-600' : ''}`}
                            key={day.day}
                          >
                            {day.day}
                          </th>
                        ))}
                        <th className="w-10 px-1 py-3 text-center font-black text-emerald-400">มา</th>
                        <th className="w-10 px-1 py-3 text-center font-black text-amber-400">สาย</th>
                        <th className="w-10 px-1 py-3 text-center font-black text-sky-400">ลา</th>
                        <th className="w-10 px-1 py-3 text-center font-black text-rose-400">ขาด</th>
                        <th className="w-16 px-2 py-3 text-center font-black text-slate-300">รวมบันทึก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-bold">
                      {activeAttendanceGrid.rows.map((row, index) => (
                        <tr className="transition hover:bg-slate-800/40" key={row.studentCode + index}>
                          <td className="px-2 py-2.5 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-black text-slate-200">{row.studentName}</td>
                          {monthContext.days.map((day) => {
                            const status = row.dailyStatuses[day.dateKey];
                            return (
                              <td
                                className={`px-0.5 py-1 text-center ${day.isWeekend ? 'bg-slate-900/40' : ''}`}
                                key={day.dateKey}
                              >
                                {status === 'present' || status === 'activity' ? (
                                  <span className="inline-flex h-6 w-7 items-center justify-center rounded-lg bg-[#0e3a29] text-[10px] font-black text-[#4ade80] ring-1 ring-emerald-500/30">
                                    มา
                                  </span>
                                ) : status === 'late' ? (
                                  <span className="inline-flex h-6 w-7 items-center justify-center rounded-lg bg-[#3a280c] text-[10px] font-black text-[#facc15] ring-1 ring-amber-500/30">
                                    สาย
                                  </span>
                                ) : status === 'leave' || status === 'sick' ? (
                                  <span className="inline-flex h-6 w-7 items-center justify-center rounded-lg bg-[#0d2a45] text-[10px] font-black text-[#38bdf8] ring-1 ring-sky-500/30">
                                    ลา
                                  </span>
                                ) : status === 'absent' ? (
                                  <span className="inline-flex h-6 w-7 items-center justify-center rounded-lg bg-[#450d1b] text-[10px] font-black text-[#f87171] ring-1 ring-rose-500/30">
                                    ขาด
                                  </span>
                                ) : null}
                              </td>
                            );
                          })}
                          <td className="px-1 py-2.5 text-center font-black text-emerald-400">{row.totals.present}</td>
                          <td className="px-1 py-2.5 text-center font-black text-amber-400">{row.totals.late}</td>
                          <td className="px-1 py-2.5 text-center font-black text-sky-400">{row.totals.leave}</td>
                          <td className="px-1 py-2.5 text-center font-black text-rose-400">{row.totals.absent}</td>
                          <td className="px-2 py-2.5 text-center font-black text-slate-200">
                            {row.totals.present + row.totals.late + row.totals.leave + row.totals.absent}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {!isLoading && monthlyAttendanceGrid.rows.length === 0 ? (
                <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีข้อมูลเวลาเรียนตามช่วงวันที่และตัวกรองนี้
                </div>
              ) : null}
            </>
          ) : null}

          {reportView === 'savings' ? (
            <>
              {/* Dark Mode Monthly Savings Grid (Reference Image #3 & #4) */}
              <div className="mt-5 rounded-3xl border border-slate-800 bg-[#080d1a] p-4 text-white shadow-2xl md:p-6">
                <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white">
                      รายงานการบันทึกการออมเงินระดับชั้น {selectedClassroom?.name || 'ประถมศึกษาปีที่ 5'}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {session.workspace?.schoolName || 'โรงเรียนบ้านโคกสูง'} · ภาคเรียนที่ 1 ปีการศึกษา {selectedClassroom?.academic_year || '2569'} · เดือน{monthContext.monthLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-cyan-900/60 bg-[#0c2b35] px-3 py-1.5 text-xs font-black text-[#22d3ee]">
                      <span className="text-[11px] font-bold text-slate-400">นักเรียน</span>
                      <span className="text-sm font-black text-[#22d3ee]">{monthlySavingsGrid.totalStudents}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-cyan-900/60 bg-[#0c2b35] px-3 py-1.5 text-xs font-black text-[#22d3ee]">
                      <span className="text-[11px] font-bold text-slate-400">ออมแล้ว</span>
                      <span className="text-sm font-black text-[#22d3ee]">{monthlySavingsGrid.totalActiveSavingsStudents}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-cyan-900/60 bg-[#0c2b35] px-3 py-1.5 text-xs font-black text-[#22d3ee]">
                      <span className="text-[11px] font-bold text-slate-400">ยอดรวม</span>
                      <span className="text-sm font-black text-[#22d3ee]">{monthlySavingsGrid.totalMonthSavings.toLocaleString('th-TH')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="w-10 px-2 py-3 text-center">เลขที่</th>
                        <th className="w-48 px-3 py-3 text-left">ชื่อ-สกุล</th>
                        {monthContext.days.map((day) => (
                          <th
                            className={`w-8 px-1 py-3 text-center ${day.isWeekend ? 'bg-slate-900/60 text-slate-600' : ''}`}
                            key={day.day}
                          >
                            {day.day}
                          </th>
                        ))}
                        <th className="w-24 px-3 py-3 text-right font-black text-cyan-400">รวมเดือนนี้</th>
                        <th className="w-28 px-3 py-3 text-right font-black text-emerald-400">ยอดสะสม/คงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-bold">
                      {monthlySavingsGrid.rows.map((row, index) => (
                        <tr className="transition hover:bg-slate-800/40" key={row.studentId + index}>
                          <td className="px-2 py-2.5 text-center font-bold text-slate-400">{index + 1}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-black text-slate-200">{row.studentName}</td>
                          {monthContext.days.map((day) => {
                            const amt = row.dailyAmounts[day.dateKey];
                            return (
                              <td
                                className={`px-0.5 py-1 text-center font-bold ${day.isWeekend ? 'bg-slate-900/40 text-slate-700' : 'text-slate-300'}`}
                                key={day.dateKey}
                              >
                                {amt ? amt : ''}
                              </td>
                            );
                          })}
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-[#22d3ee]">
                            {row.totalMonth ? row.totalMonth.toLocaleString('th-TH') : '0'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-black text-emerald-400">
                            {row.totalBalance ? row.totalBalance.toLocaleString('th-TH') : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {!isLoading && monthlySavingsGrid.rows.length === 0 ? (
                <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีรายการฝาก/ถอนในช่วงเวลานี้
                </div>
              ) : null}
            </>
          ) : null}

          {reportView === 'student-register' ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'นักเรียนทั้งหมด', value: classroomStudents.length, detail: selectedClassroom?.name || '-' },
                  { label: 'ชาย', value: classroomStudents.filter((student) => student.gender === 'male').length, detail: 'ตามข้อมูลทะเบียน' },
                  { label: 'หญิง', value: classroomStudents.filter((student) => student.gender === 'female').length, detail: 'ตามข้อมูลทะเบียน' },
                ].map((item) => (
                  <article className="rounded-3xl border border-slate-200 bg-white p-4" key={item.label}>
                    <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
                    <p className="mt-2 text-4xl font-black text-slate-950">{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.detail}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div><p className="font-black text-slate-950">ตัวอย่างข้อมูลก่อนพิมพ์</p><p className="text-xs font-bold text-slate-500">A4 {registerOrientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'} · เลือกข้อมูลเพิ่มเติม {activeRegisterFields.length} รายการ</p></div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-black text-white">รหัสนักเรียน</span>
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-black text-white">ชื่อ–สกุล</span>
                    {activeRegisterFields.map((field) => <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-black text-cyan-800" key={field}>{registerFieldLabels[field]}</span>)}
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[760px] divide-y divide-slate-100 text-left text-sm">
                    <thead className="bg-slate-50"><tr className="text-xs font-black uppercase text-slate-500"><th className="px-3 py-3">ที่</th><th className="px-3 py-3">เลขประจำตัวนักเรียน</th><th className="px-3 py-3">ชื่อ–สกุลนักเรียน</th><th className="px-3 py-3">รายละเอียดที่เลือก</th><th className="px-3 py-3">หมายเหตุ</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {classroomStudents.map((student, index) => (
                        <tr key={student.id}>
                          <td className="px-3 py-3 text-center font-bold text-slate-500">{index + 1}</td>
                          <td className="px-3 py-3 font-black">{student.student_code || '-'}</td>
                          <td className="px-3 py-3"><p className="font-black text-slate-950">{student.first_name} {student.last_name}</p><p className="text-xs font-bold text-slate-500">{student.gender === 'male' ? 'ชาย' : student.gender === 'female' ? 'หญิง' : '-'} · {formatThaiOfficialShortDate(student.birth_date)}</p></td>
                          <td className="px-3 py-3">
                            {activeRegisterFields.length > 0 ? activeRegisterFields.map((field) => <p className="text-xs font-bold text-slate-700" key={field}><span className="text-slate-400">{registerFieldLabels[field]}:</span> {getRegisterFieldValue(student, field, classroomGuardians, registerHealthRows, false)}</p>) : <span className="text-xs font-bold text-slate-400">บัญชีรายชื่อพื้นฐาน</span>}
                          </td>
                          <td className="px-3 py-3 text-slate-400">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {reportView === 'executive' ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'นักเรียน', value: `${executiveMetrics.studentCount} คน`, detail: selectedClassroom?.name || '-' },
                  { label: 'อัตรามาเรียน', value: `${executiveMetrics.attendanceRate}%`, detail: 'เกณฑ์กำกับ 90%' },
                  { label: 'คะแนนเฉลี่ย', value: `${executiveMetrics.scoreAverage}%`, detail: 'เกณฑ์กำกับ 70%' },
                  { label: 'ต้องติดตาม', value: `${executiveMetrics.behaviorFollowUps + executiveMetrics.healthFollowUps}`, detail: 'เคสดูแลและสุขอนามัย' },
                ].map((item) => <article className="rounded-3xl border border-slate-200 bg-white p-4" key={item.label}><p className="text-xs font-black uppercase text-slate-400">{item.label}</p><p className="mt-2 text-3xl font-black text-slate-950">{item.value}</p><p className="mt-1 text-xs font-bold text-slate-500">{item.detail}</p></article>)}
              </div>
              <article className="rounded-3xl border border-slate-200 bg-white p-4">
                <h3 className="text-lg font-black text-slate-950">สาระสำคัญสำหรับผู้บริหาร</h3>
                <div className="mt-3 grid gap-2">
                  {[
                    ['เวลาเรียน', `${executiveMetrics.attendanceRate}%`, executiveMetrics.attendanceRate >= 90 ? 'เป็นไปตามเป้าหมาย' : 'ต้องเร่งติดตาม'],
                    ['ผลการเรียน', `${executiveMetrics.scoreAverage}%`, executiveMetrics.scoreAverage >= 70 ? 'เป็นไปตามเป้าหมาย' : 'ควรจัดสอนเสริม'],
                    ['สุขภาพและกิจวัตร', `${executiveMetrics.healthCompletionRate}%`, `ติดตามสุขอนามัย ${executiveMetrics.healthFollowUps} คน`],
                    ['พฤติกรรม/การดูแล', `${executiveMetrics.behaviorFollowUps} เคส`, 'ติดตามและบันทึกผลดำเนินงาน'],
                    ['การออม', `${executiveMetrics.savingsTotal.toLocaleString('th-TH')} บาท`, 'ข้อมูลประกอบการบริหารชั้นเรียน'],
                  ].map(([label, value, detail]) => <div className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:grid-cols-[180px_110px_1fr]" key={label}><strong className="text-slate-950">{label}</strong><span className="font-black text-cyan-700">{value}</span><span className="font-bold text-slate-600">{detail}</span></div>)}
                </div>
              </article>
            </div>
          ) : null}

          {reportView === 'health' ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'นักเรียนในรายงาน', value: healthSummaryRows.length, detail: `${classroomHealthRecords.length} บันทึกในช่วงนี้` },
                  { label: 'แปรงฟันสำเร็จ', value: healthSummaryRows.reduce((sum, row) => sum + row.brushing.completed, 0), detail: 'จำนวนครั้งที่ทำสำเร็จ' },
                  { label: 'ดื่มนมสำเร็จ', value: healthSummaryRows.reduce((sum, row) => sum + row.milk.completed, 0), detail: 'จำนวนครั้งที่ทำสำเร็จ' },
                  { label: 'ต้องติดตามสุขอนามัย', value: healthSummaryRows.filter((row) => row.attentionItems.length > 0).length, detail: 'นักเรียนที่มีจุดต้องติดตามล่าสุด' },
                ].map((item) => (
                  <article className="rounded-3xl border border-slate-200 bg-white p-4" key={item.label}>
                    <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
                    <p className="mt-2 text-4xl font-black text-slate-950">{item.value.toLocaleString('th-TH')}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.detail}</p>
                  </article>
                ))}
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                <table className="min-w-[1060px] divide-y divide-slate-100 text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-xs font-black uppercase text-slate-500">
                      <th className="px-3 py-3">นักเรียน</th>
                      <th className="px-3 py-3 text-center">แปรงฟัน</th>
                      <th className="px-3 py-3 text-center">ดื่มนม</th>
                      <th className="px-3 py-3 text-center">อาหารกลางวัน</th>
                      <th className="px-3 py-3 text-right">น้ำหนัก</th>
                      <th className="px-3 py-3 text-right">ส่วนสูง</th>
                      <th className="px-3 py-3 text-right">BMI</th>
                      <th className="px-3 py-3">ตรวจล่าสุด</th>
                      <th className="px-3 py-3">จุดติดตาม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {healthSummaryRows.map((row) => (
                      <tr className="hover:bg-emerald-50/40" key={row.student.id}>
                        <td className="px-3 py-3"><p className="font-black text-slate-950">{row.student.first_name} {row.student.last_name}</p><p className="text-xs font-bold text-slate-500">{row.student.student_code || '-'}</p></td>
                        <td className="px-3 py-3 text-center font-black text-cyan-700">{row.brushing.completed}/{row.brushing.total}</td>
                        <td className="px-3 py-3 text-center font-black text-cyan-700">{row.milk.completed}/{row.milk.total}</td>
                        <td className="px-3 py-3 text-center font-black text-cyan-700">{row.lunch.completed}/{row.lunch.total}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-700">{row.latestGrowth?.weight_kg ?? '-'}{row.latestGrowth?.weight_kg ? ' กก.' : ''}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-700">{row.latestGrowth?.height_cm ?? '-'}{row.latestGrowth?.height_cm ? ' ซม.' : ''}</td>
                        <td className="px-3 py-3 text-right font-black text-emerald-700">{row.latestGrowth?.bmi ?? '-'}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{row.latestHygiene?.record_date || '-'}</td>
                        <td className="px-3 py-3 font-bold text-slate-600">{row.attentionItems.join(', ') || row.latestHygiene?.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isLoading && classroomHealthRecords.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">ยังไม่มีบันทึกสุขภาพหรือกิจวัตรในช่วงเวลาที่เลือก</div>
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

          {reportView === 'subject-scores' ? (
            <div className="mt-5 grid gap-4">
              {!selectedSubjectName ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">กรุณาเลือกวิชาที่ต้องการดูคะแนนจากตัวกรองด้านบน</div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        <th className="px-4 py-3 font-black text-slate-700 w-12 text-center">ที่</th>
                        <th className="px-4 py-3 font-black text-slate-700 w-24 text-center">รหัส</th>
                        <th className="px-4 py-3 font-black text-slate-700">ชื่อ-สกุล</th>
                        {classroomScoreAssessments.filter((a) => a.subject_name === selectedSubjectName).map((a) => (
                          <th key={a.id} className="px-4 py-3 font-black text-slate-700 text-center whitespace-nowrap">
                            {a.title} ({a.max_score})
                          </th>
                        ))}
                        <th className="px-4 py-3 font-black text-slate-900 text-center border-l border-slate-200">รวมคะแนน</th>
                        <th className="px-4 py-3 font-black text-rose-700 text-center">งานค้าง</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classroomStudents.map((student, idx) => {
                        const assessments = classroomScoreAssessments.filter((a) => a.subject_name === selectedSubjectName);
                        let totalScore = 0;
                        let missingCount = 0;
                        
                        return (
                          <tr key={student.id} className="transition hover:bg-slate-50">
                            <td className="px-4 py-3 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="px-4 py-3 text-center font-bold text-slate-500">{student.student_code || '-'}</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{student.first_name} {student.last_name}</td>
                            {assessments.map((a) => {
                              const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
                              const score = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : null;
                              if (score !== null) {
                                totalScore += score;
                              } else {
                                missingCount += 1;
                              }
                              return (
                                <td key={a.id} className="px-4 py-3 text-center font-bold text-slate-600">
                                  {score !== null ? score : <span className="text-rose-400">-</span>}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center font-black text-cyan-700 border-l border-slate-200">{totalScore}</td>
                            <td className="px-4 py-3 text-center font-bold text-rose-600">{missingCount > 0 ? missingCount : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {classroomStudents.length === 0 ? (
                    <div className="p-4 text-center text-sm font-bold text-slate-500">ไม่มีรายชื่อนักเรียนในห้องนี้</div>
                  ) : null}
                </div>
              )}
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
                      <ThaiDatePicker className="h-11 px-3" onValueChange={(value) => setTermRanges((current) => ({ ...current, [term]: { ...current[term], start: value } }))} value={termRanges[term].start} />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      สิ้นสุด
                      <ThaiDatePicker className="h-11 px-3" onValueChange={(value) => setTermRanges((current) => ({ ...current, [term]: { ...current[term], end: value } }))} value={termRanges[term].end} />
                    </label>
                  </div>
                </article>
              ))}
              <article className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-2">
                <h3 className="text-lg font-black text-slate-950">ตั้งค่าผู้ลงนามในรายงาน</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ชื่อครูประจำชั้น
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setReportIdentity((current) => ({ ...current, teacherName: event.target.value }))}
                      placeholder="ชื่อครูประจำชั้น"
                      value={reportIdentity.teacherName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ชื่อผู้อำนวยการโรงเรียน
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setReportIdentity((current) => ({ ...current, directorName: event.target.value }))}
                      placeholder="ชื่อผู้อำนวยการ"
                      value={reportIdentity.directorName}
                    />
                  </label>
                  {/* Co-advisor field - shows full row spanning both columns */}
                  <div className="sm:col-span-2">
                    {reportIdentity.coAdvisorName !== undefined && (reportIdentity.coAdvisorName.length > 0) ? (
                      <label className="grid gap-2 text-sm font-black text-slate-700">
                        <span className="flex items-center gap-2">
                          ที่ปรึกษาร่วม
                          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-700">ไม่บังคับ</span>
                          <button
                            type="button"
                            onClick={() => setReportIdentity((current) => ({ ...current, coAdvisorName: '' }))}
                            className="ml-auto text-[11px] font-bold text-slate-400 hover:text-rose-500 transition"
                          >
                            ✕ ลบออก
                          </button>
                        </span>
                        <input
                          className="nexus-field h-11 px-3"
                          onChange={(event) => setReportIdentity((current) => ({ ...current, coAdvisorName: event.target.value }))}
                          placeholder="ชื่อ-สกุล ที่ปรึกษาร่วม (จะแสดงในรายงานเมื่อกรอก)"
                          value={reportIdentity.coAdvisorName}
                          autoFocus
                        />
                        <p className="text-[11px] font-bold text-slate-400">💡 หากไม่กรอก จะไม่แสดงในรายงาน</p>
                      </label>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReportIdentity((current) => ({ ...current, coAdvisorName: ' ' }))}
                        className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        <span className="text-base leading-none">➕</span>
                        เพิ่มที่ปรึกษาร่วม <span className="text-[11px] font-bold opacity-60">(ไม่บังคับ)</span>
                      </button>
                    )}
                  </div>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ชื่อหัวหน้าวิชาการ
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setReportIdentity((current) => ({ ...current, academicHeadName: event.target.value }))}
                      placeholder="ชื่อผู้ตรวจตาราง/รายงาน"
                      value={reportIdentity.academicHeadName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ชื่อนายทะเบียนโรงเรียน
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setReportIdentity((current) => ({ ...current, registrarName: event.target.value }))}
                      placeholder="ชื่อผู้รับรองทะเบียนนักเรียน"
                      value={reportIdentity.registrarName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    โลโก้โรงเรียน
                    <div className="flex gap-2">
                      <input
                        accept="image/*"
                        className="hidden"
                        id="logo-upload"
                        onChange={handleLogoUpload}
                        type="file"
                      />
                      <label
                        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                        htmlFor="logo-upload"
                      >
                        <ImagePlus size={16} aria-hidden="true" />
                        อัปโหลด
                      </label>
                      {reportIdentity.schoolLogoDataUrl && (
                        <button
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-600 transition hover:bg-rose-100"
                          onClick={() => setReportIdentity((current) => ({ ...current, schoolLogoDataUrl: '' }))}
                          type="button"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          ลบ
                        </button>
                      )}
                    </div>
                    {reportIdentity.schoolLogoDataUrl && (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          alt="School Logo"
                          className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                          src={reportIdentity.schoolLogoDataUrl}
                        />
                        <span className="text-xs font-bold text-slate-600">โลโก้ถูกตั้งค่าแล้ว</span>
                      </div>
                    )}
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black"
                    onClick={saveReportIdentitySettings}
                    type="button"
                  >
                    <Save size={16} aria-hidden="true" />
                    บันทึกตั้งค่า
                  </button>
                </div>
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
        ระบบสารสนเทศ ClassCare 360
      </footer>
    </main>
  );
}

export function ReportsPage(props: ReportsPageProps) {
  return props.session.profile.role === 'viewer' ? <ViewerReportSummary {...props} /> : <TeacherReportsPage {...props} />;
}
