import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  ImagePlus,
  LayoutList,
  Printer,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

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
  type OfficialReportOrientation,
} from '../../lib/officialReport';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import {
  compressImageFile,
  loadReportTermRanges,
  loadSchoolReportIdentity,
  saveReportTermRanges,
  saveSchoolReportIdentity,
  type ReportTermRanges,
  type SchoolReportIdentity,
} from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';
import { generateExcelReportBuffer, downloadExcelBuffer, type ExcelSheetConfig } from '../../lib/excelReport';
import { OfficialAcademicDocumentsModal } from '../../components/academic/OfficialAcademicDocumentsModal';
import { printHtmlStringAsDocument } from '../../lib/academicPrintService';
import { calculateOBECGrade } from '../../lib/obecAcademicEngine';

interface ReportsPageProps {
  session: AppSessionContext;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';
type ReportView =
  | 'attendance'
  | 'subject-attendance'
  | 'savings'
  | 'scores'
  | 'subject-scores'
  | 'health'
  | 'student-register'
  | 'executive'
  | 'individual'
  | 'behavior'
  | 'settings';
type ReportCategoryKey = 'attendance_savings' | 'academic_scores' | 'student_care' | 'executive_settings';
type ReportPeriod = 'month' | 'term' | 'year';
type TermKey = 'term1' | 'term2';
type RegisterOptionalField = 'address' | 'citizenId' | 'family' | 'health';
type RegisterFieldSelection = Record<RegisterOptionalField, boolean>;
type IndividualReportSectionKey =
  | 'guardian'
  | 'attendance'
  | 'scores'
  | 'savings'
  | 'health'
  | 'behavior'
  | 'homeVisit'
  | 'teacherComment';
type IndividualReportSectionSelection = Record<IndividualReportSectionKey, boolean>;
type DisplayMode = 'a4' | 'mobile';
type ExecutiveScope = 'classroom' | 'school';

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

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  {
    birth_date: '2015-01-12',
    classroom_id: 'demo-classroom',
    first_name: 'ณัฐวุฒิ',
    gender: 'male',
    health_flags: { height_cm: 142, weight_kg: 35.5 },
    id: 'demo-student-1',
    last_name: 'ใจดี',
    metadata: {
      dmc_address: { district: 'เมือง', house_no: '12', province: 'นครราชสีมา', subdistrict: 'ในเมือง', village_no: '3' },
      dmc_father: { first_name: 'สมชาย', last_name: 'ใจดี', prefix: 'นาย' },
      dmc_id_card: '1100100000001',
      dmc_mother: { first_name: 'สมใจ', last_name: 'ใจดี', prefix: 'นาง' },
    },
    nickname: 'นัท',
    status: 'active',
    student_code: '001',
  },
  {
    birth_date: '2015-03-03',
    classroom_id: 'demo-classroom',
    first_name: 'พิมพ์ชนก',
    gender: 'female',
    health_flags: { height_cm: 138, weight_kg: 34.4 },
    id: 'demo-student-2',
    last_name: 'แสงทอง',
    metadata: {
      dmc_address: { district: 'เมือง', house_no: '25/1', province: 'นครราชสีมา', subdistrict: 'โคกสูง', village_no: '2' },
      dmc_father: { first_name: 'ประสงค์', last_name: 'แสงทอง', prefix: 'นาย' },
      dmc_id_card: '1100100000002',
      dmc_mother: { first_name: 'มาลี', last_name: 'แสงทอง', prefix: 'นาง' },
    },
    nickname: 'พิม',
    status: 'active',
    student_code: '002',
  },
  {
    birth_date: '2015-07-27',
    classroom_id: 'demo-classroom',
    first_name: 'กิตติพงศ์',
    gender: 'male',
    health_flags: { height_cm: 141, weight_kg: 36.1 },
    id: 'demo-student-3',
    last_name: 'สุขใจ',
    metadata: {
      dmc_address: { district: 'เมือง', house_no: '41', province: 'นครราชสีมา', subdistrict: 'โคกสูง', village_no: '5' },
      dmc_father: { first_name: 'มนตรี', last_name: 'สุขใจ', prefix: 'นาย' },
      dmc_id_card: '1100100000003',
      dmc_mother: { first_name: 'รัตนา', last_name: 'สุขใจ', prefix: 'นาง' },
    },
    nickname: 'ก้อง',
    status: 'active',
    student_code: '003',
  },
];

const demoGuardians: StudentGuardianReportRow[] = [
  { display_name: 'นางสมใจ ใจดี', is_primary: true, phone: '081-234-1101', relation: 'มารดา', student_id: 'demo-student-1' },
  { display_name: 'นายประสงค์ แสงทอง', is_primary: true, phone: '081-234-1102', relation: 'บิดา', student_id: 'demo-student-2' },
  { display_name: 'นางรัตนา สุขใจ', is_primary: true, phone: '081-234-1103', relation: 'มารดา', student_id: 'demo-student-3' },
];

function getTodayDate() {
  return getBangkokDate();
}

const demoSessions: AttendanceSessionRow[] = [
  { attendance_date: getTodayDate(), classroom_id: 'demo-classroom', id: 'demo-session-1', period_label: 'เช้า', subject_name: 'โฮมรูม' },
  { attendance_date: getTodayDate(), classroom_id: 'demo-classroom', id: 'demo-session-2', period_label: 'คาบ 1', subject_name: 'คณิตศาสตร์' },
];

const demoRecords: AttendanceRecordRow[] = [
  { note: null, session_id: 'demo-session-1', status: 'present', student_id: 'demo-student-1' },
  { note: 'มาสาย 10 นาที', session_id: 'demo-session-1', status: 'late', student_id: 'demo-student-2' },
  { note: 'ผู้ปกครองแจ้งลา', session_id: 'demo-session-1', status: 'leave', student_id: 'demo-student-3' },
  { note: null, session_id: 'demo-session-2', status: 'present', student_id: 'demo-student-1' },
  { note: null, session_id: 'demo-session-2', status: 'present', student_id: 'demo-student-2' },
  { note: 'ลาป่วย', session_id: 'demo-session-2', status: 'leave', student_id: 'demo-student-3' },
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
  { assessment_date: getTodayDate(), category: 'midterm', classroom_id: 'demo-classroom', id: 'demo-score-1', max_score: 50, status: 'published', subject_name: 'คณิตศาสตร์', title: 'คะแนนเก็บและสอบกลางภาค', weight: 50 },
  { assessment_date: getTodayDate(), category: 'final', classroom_id: 'demo-classroom', id: 'demo-score-2', max_score: 50, status: 'published', subject_name: 'คณิตศาสตร์', title: 'สอบปลายภาค', weight: 50 },
  { assessment_date: getTodayDate(), category: 'midterm', classroom_id: 'demo-classroom', id: 'demo-score-3', max_score: 100, status: 'published', subject_name: 'ภาษาไทย', title: 'รวมคะแนนภาษาไทย', weight: 100 },
];

const demoScoreEntries: ScoreEntryRow[] = [
  { assessment_id: 'demo-score-1', id: 'demo-entry-1', note: null, score: 42, student_id: 'demo-student-1' },
  { assessment_id: 'demo-score-1', id: 'demo-entry-2', note: null, score: 38, student_id: 'demo-student-2' },
  { assessment_id: 'demo-score-1', id: 'demo-entry-3', note: null, score: 35, student_id: 'demo-student-3' },
  { assessment_id: 'demo-score-2', id: 'demo-entry-4', note: null, score: 44, student_id: 'demo-student-1' },
  { assessment_id: 'demo-score-2', id: 'demo-entry-5', note: null, score: 39, student_id: 'demo-student-2' },
  { assessment_id: 'demo-score-3', id: 'demo-entry-6', note: null, score: 85, student_id: 'demo-student-1' },
  { assessment_id: 'demo-score-3', id: 'demo-entry-7', note: null, score: 82, student_id: 'demo-student-2' },
  { assessment_id: 'demo-score-3', id: 'demo-entry-8', note: null, score: 76, student_id: 'demo-student-3' },
];

const demoBehaviorRecords: BehaviorRecordRow[] = [
  { behavior_date: getTodayDate(), category: 'จิตอาสาช่วยเหลือเพื่อน', created_at: new Date().toISOString(), description: 'ช่วยเพื่อนเก็บอุปกรณ์หลังเลิกเรียนอย่างสม่ำเสมอ', follow_up_status: 'none', id: 'demo-behavior-1', points: 5, student_id: 'demo-student-1', tone: 'positive' },
  { behavior_date: getTodayDate(), category: 'ส่งงานล่าช้า', created_at: new Date().toISOString(), description: 'ค้างใบงานคณิตศาสตร์ นัดติดตามซ่อมเสริมในคาบโฮมรูม', follow_up_status: 'watch', id: 'demo-behavior-2', points: -2, student_id: 'demo-student-2', tone: 'concern' },
];

const demoHomeVisits: HomeVisitReportRow[] = [
  { academic_year: '2569', completion_percent: 100, id: 'demo-home-visit-1', status: 'submitted', student_id: 'demo-student-1', term: '1', visited_at: getTodayDate() },
  { academic_year: '2569', completion_percent: 80, id: 'demo-home-visit-2', status: 'ready', student_id: 'demo-student-2', term: '1', visited_at: getTodayDate() },
];

const demoHealthRecords: StudentHealthRecordRow[] = [
  { bmi: 17.61, height_cm: 142, id: 'demo-health-1', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'growth', status: 'recorded', student_id: 'demo-student-1', weight_kg: 35.5 },
  { bmi: null, height_cm: null, id: 'demo-health-2', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'toothbrushing', status: 'completed', student_id: 'demo-student-1', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-3', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'milk', status: 'completed', student_id: 'demo-student-1', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-4', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'lunch', status: 'completed', student_id: 'demo-student-1', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-5', inspection_results: { hair: 'pass', nails: 'attention', skin: 'pass', teeth: 'pass' }, note: 'ติดตามความสะอาดเล็บ', record_date: getTodayDate(), record_type: 'hygiene', status: 'attention', student_id: 'demo-student-1', weight_kg: null },
  { bmi: 18.07, height_cm: 138, id: 'demo-health-6', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'growth', status: 'recorded', student_id: 'demo-student-2', weight_kg: 34.4 },
  { bmi: null, height_cm: null, id: 'demo-health-7', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'toothbrushing', status: 'completed', student_id: 'demo-student-2', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-8', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'milk', status: 'completed', student_id: 'demo-student-2', weight_kg: null },
  { bmi: null, height_cm: null, id: 'demo-health-9', inspection_results: {}, note: null, record_date: getTodayDate(), record_type: 'lunch', status: 'completed', student_id: 'demo-student-2', weight_kg: null },
];

const statusLabels: Record<AttendanceStatus, string> = {
  present: 'มา',
  absent: 'ขาด',
  late: 'สาย',
  leave: 'ลา',
  sick: 'ป่วย',
  activity: 'กิจกรรม',
};

const monthlyStatusAbbreviations: Record<AttendanceStatus, string> = {
  present: '✓',
  late: 'ส',
  leave: 'ล',
  sick: 'ป',
  absent: 'ข',
  activity: 'ก',
};

interface ReportViewConfig {
  category: ReportCategoryKey;
  defaultOrientation: OfficialReportOrientation;
  description: string;
  icon: string;
  label: string;
  shortLabel: string;
  value: ReportView;
}

const reportViews: ReportViewConfig[] = [
  {
    category: 'attendance_savings',
    defaultOrientation: 'landscape',
    description: 'ตารางเช็คชื่อรายเดือน หรือสรุปเวลาเรียนรายเทอม/ปีการศึกษา พร้อมร้อยละเวลาเรียน',
    icon: '📅',
    label: 'บัญชีเวลาเรียนประจำชั้น',
    shortLabel: 'เวลาเรียน',
    value: 'attendance',
  },
  {
    category: 'attendance_savings',
    defaultOrientation: 'landscape',
    description: 'สรุปเวลาเรียนแยกรายวิชาและคาบเรียน พร้อมพิมพ์ตารางเช็คชื่อรายวิชา',
    icon: '📖',
    label: 'เวลาเรียนแยกรายวิชา',
    shortLabel: 'เวลาเรียนรายวิชา',
    value: 'subject-attendance',
  },
  {
    category: 'attendance_savings',
    defaultOrientation: 'landscape',
    description: 'ตารางบันทึกเงินออมรายวัน สรุปยอดฝาก-ถอนรายเดือน และยอดเงินสะสมคงเหลือจริง',
    icon: '🐷',
    label: 'รายงานการออมเงินนักเรียน',
    shortLabel: 'เงินออม',
    value: 'savings',
  },
  {
    category: 'academic_scores',
    defaultOrientation: 'landscape',
    description: 'ตารางสรุปคะแนนรวมทุกวิชา เกรดเฉลี่ย (GPA) และสรุปชุดการประเมินทั้งห้อง',
    icon: '🎯',
    label: 'สรุปคะแนนรวมทุกวิชา (ทั้งห้อง)',
    shortLabel: 'คะแนนรวมห้อง',
    value: 'scores',
  },
  {
    category: 'academic_scores',
    defaultOrientation: 'landscape',
    description: 'ตารางคะแนนเก็บรายช่อง คะแนนรวม เกรด และจำนวนงานค้างแยกรายวิชา',
    icon: '📊',
    label: 'ตารางคะแนนและงานค้างรายวิชา',
    shortLabel: 'คะแนนรายวิชา',
    value: 'subject-scores',
  },
  {
    category: 'student_care',
    defaultOrientation: 'portrait',
    description: 'ใบสรุปผลการเรียน เวลาเรียน สุขภาพ เงินออม และพฤติกรรมรายคน สำหรับแจกผู้ปกครอง (A4)',
    icon: '👤',
    label: 'ใบรายงานผลรายบุคคล (แจกผู้ปกครอง)',
    shortLabel: 'รายบุคคล (สมุดพกย่อ)',
    value: 'individual',
  },
  {
    category: 'student_care',
    defaultOrientation: 'portrait',
    description: 'บัญชีรายชื่อนักเรียน ใบเซ็นชื่อรับเงิน และข้อมูลทะเบียนครอบครัว/ผู้ปกครอง A4',
    icon: '📋',
    label: 'ทะเบียนรายชื่อ / ใบเซ็นชื่อ A4',
    shortLabel: 'ทะเบียนรายชื่อ',
    value: 'student-register',
  },
  {
    category: 'student_care',
    defaultOrientation: 'landscape',
    description: 'รายงานน้ำหนัก ส่วนสูง ดัชนีมวลกาย (BMI) แปรงฟัน ดื่มนม อาหารกลางวัน และสุขอนามัย',
    icon: '🏥',
    label: 'รายงานสุขภาพและกิจวัตรนักเรียน',
    shortLabel: 'สุขภาพ/กิจวัตร',
    value: 'health',
  },
  {
    category: 'student_care',
    defaultOrientation: 'portrait',
    description: 'สรุปความดี คะแนนพฤติกรรม และเคสดูแลช่วยเหลือนักเรียนที่ต้องติดตาม',
    icon: '💬',
    label: 'รายงานพฤติกรรมและเคสดูแล',
    shortLabel: 'พฤติกรรม',
    value: 'behavior',
  },
  {
    category: 'executive_settings',
    defaultOrientation: 'portrait',
    description: 'ใบสรุปผลการดำเนินงานประจำเดือน/เทอม/ปี สำหรับเสนอผู้อำนวยการโรงเรียนพิจารณาลงนาม',
    icon: '👔',
    label: 'รายงานสรุปสำหรับผู้บริหาร',
    shortLabel: 'สรุปผู้บริหาร',
    value: 'executive',
  },
  {
    category: 'executive_settings',
    defaultOrientation: 'portrait',
    description: 'ตั้งค่าชื่อโรงเรียน ตราโรงเรียน ชื่อผู้ลงนามในรายงาน และวันที่เปิด-ปิดภาคเรียน',
    icon: '⚙️',
    label: 'ตั้งค่าหัวกระดาษและผู้ลงนาม',
    shortLabel: 'ตั้งค่ารายงาน',
    value: 'settings',
  },
];

const reportCategories: Array<{
  description: string;
  icon: string;
  key: ReportCategoryKey;
  title: string;
}> = [
  {
    description: 'เช็คชื่อรายเดือน/เทอม/ปี และสมุดเงินออม',
    icon: '📅',
    key: 'attendance_savings',
    title: 'เวลาเรียน & เงินออม',
  },
  {
    description: 'คะแนนรวมห้อง คะแนนรายวิชา และ ปพ.5/ปพ.6',
    icon: '📊',
    key: 'academic_scores',
    title: 'ผลการเรียน & ปพ.',
  },
  {
    description: 'ใบสรุปรายคน บัญชีรายชื่อ สุขภาพ พฤติกรรม',
    icon: '👤',
    key: 'student_care',
    title: 'นักเรียน & รายบุคคล',
  },
  {
    description: 'ใบสรุปเสนอผู้บริหาร และตั้งค่าหัวกระดาษ',
    icon: '🏛️',
    key: 'executive_settings',
    title: 'ผู้บริหาร & ตั้งค่า',
  },
];

const registerFieldOptions: Array<{ description: string; label: string; value: RegisterOptionalField }> = [
  { description: 'ปกปิดบางส่วนหรือแสดงครบ 13 หลัก', label: 'เลขบัตรประชาชน', value: 'citizenId' },
  { description: 'น้ำหนัก ส่วนสูง และ BMI ล่าสุด', label: 'น้ำหนักและส่วนสูง', value: 'health' },
  { description: 'บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด', label: 'ที่อยู่นักเรียน', value: 'address' },
  { description: 'บิดา มารดา ผู้ปกครอง และเบอร์โทร', label: 'ข้อมูลผู้ปกครอง/เบอร์โทร', value: 'family' },
];

const registerFieldLabels: Record<RegisterOptionalField, string> = {
  address: 'ที่อยู่ตามทะเบียน',
  citizenId: 'เลขประจำตัวประชาชน',
  family: 'บิดา มารดา / ผู้ปกครอง (เบอร์โทร)',
  health: 'น้ำหนัก / ส่วนสูง',
};

const defaultIndividualReportSections: IndividualReportSectionSelection = {
  attendance: true,
  behavior: true,
  guardian: true,
  health: true,
  homeVisit: true,
  savings: true,
  scores: true,
  teacherComment: true,
};

const defaultIndividualTeacherComment =
  'นักเรียนมีความตั้งใจในการเรียนและร่วมกิจกรรมของชั้นเรียนด้วยดี ผู้ปกครองสามารถตรวจสอบและลงนามรับทราบผลการพัฒนาได้ด้านล่าง';

const individualSectionOptions: Array<{
  description: string;
  label: string;
  value: IndividualReportSectionKey;
}> = [
  {
    description: 'ชื่อผู้ปกครอง ความสัมพันธ์ และเบอร์โทรศัพท์ติดต่อ',
    label: '1. ข้อมูลผู้ปกครอง',
    value: 'guardian',
  },
  {
    description: 'ร้อยละเวลาเรียน วันมาเรียน สาย ลา และขาดเรียน',
    label: '2. สรุปเวลาเรียน',
    value: 'attendance',
  },
  {
    description: 'เกรดเฉลี่ย (GPA) และตารางคะแนน/เกรด/งานค้างรายวิชา',
    label: '3. ผลการเรียนรายวิชา',
    value: 'scores',
  },
  {
    description: 'ยอดเงินออมสะสมคงเหลือ และยอดฝาก-ถอนในช่วงเวลา',
    label: '4. เงินออมนักเรียน',
    value: 'savings',
  },
  {
    description: 'น้ำหนัก ส่วนสูง BMI แปรงฟัน ดื่มนม อาหารกลางวัน และสุขอนามัย',
    label: '5. สุขภาพและกิจวัตร',
    value: 'health',
  },
  {
    description: 'บันทึกความดี พฤติกรรม และเคสติดตามดูแล',
    label: '6. พฤติกรรมและการดูแล',
    value: 'behavior',
  },
  {
    description: 'สถานะการเยี่ยมบ้านและวันที่ดำเนินการ',
    label: '7. การเยี่ยมบ้าน / กสศ.',
    value: 'homeVisit',
  },
  {
    description: 'ข้อความความเห็นครูประจำชั้น และช่องลงนามรับทราบ',
    label: '8. ความเห็นครู & ลายเซ็น',
    value: 'teacherComment',
  },
];

const individualSectionPresets: Array<{
  id: string;
  label: string;
  sections: IndividualReportSectionSelection;
}> = [
  {
    id: 'all',
    label: 'ครบทุกด้าน (ค่าเริ่มต้น)',
    sections: { ...defaultIndividualReportSections },
  },
  {
    id: 'academic',
    label: 'เฉพาะผลการเรียน + เวลาเรียน',
    sections: {
      attendance: true,
      behavior: false,
      guardian: true,
      health: false,
      homeVisit: false,
      savings: false,
      scores: true,
      teacherComment: true,
    },
  },
  {
    id: 'care',
    label: 'เฉพาะสุขภาพ + พฤติกรรม + เยี่ยมบ้าน',
    sections: {
      attendance: true,
      behavior: true,
      guardian: true,
      health: true,
      homeVisit: true,
      savings: false,
      scores: false,
      teacherComment: true,
    },
  },
  {
    id: 'monthly_saving',
    label: 'เฉพาะเวลาเรียน + เงินออม',
    sections: {
      attendance: true,
      behavior: false,
      guardian: true,
      health: false,
      homeVisit: false,
      savings: true,
      scores: false,
      teacherComment: true,
    },
  },
];

function loadIndividualReportSections(workspaceId?: string | null): IndividualReportSectionSelection {
  if (typeof window === 'undefined') return { ...defaultIndividualReportSections };
  try {
    const raw = window.localStorage.getItem(`classcare:individual-report-sections:${workspaceId || 'default'}`);
    if (!raw) return { ...defaultIndividualReportSections };
    const parsed = JSON.parse(raw) as Partial<IndividualReportSectionSelection>;
    const merged: IndividualReportSectionSelection = {
      attendance: parsed.attendance ?? true,
      behavior: parsed.behavior ?? true,
      guardian: parsed.guardian ?? true,
      health: parsed.health ?? true,
      homeVisit: parsed.homeVisit ?? true,
      savings: parsed.savings ?? true,
      scores: parsed.scores ?? true,
      teacherComment: parsed.teacherComment ?? true,
    };
    if (!Object.values(merged).some(Boolean)) {
      return { ...defaultIndividualReportSections };
    }
    return merged;
  } catch {
    return { ...defaultIndividualReportSections };
  }
}

function saveIndividualReportSections(sections: IndividualReportSectionSelection, workspaceId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `classcare:individual-report-sections:${workspaceId || 'default'}`,
      JSON.stringify(sections),
    );
  } catch {
    // ignore storage errors
  }
}

const reportPeriods: Array<{ label: string; sub: string; value: ReportPeriod }> = [
  { label: 'รายเดือน', sub: 'ตารางรายวัน 1-31', value: 'month' },
  { label: 'รายเทอม', sub: 'สรุปรวมทุกเดือนในเทอม', value: 'term' },
  { label: 'ปีการศึกษา', sub: 'สรุปรวมตลอดปี (พ.ค.-เม.ย.)', value: 'year' },
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

const toneLabels: Record<BehaviorRecordRow['tone'], string> = {
  concern: 'ต้องดูแล',
  discipline: 'วินัย',
  positive: 'ชื่นชม/เชิงบวก',
  support: 'ช่วยเหลือ/สนับสนุน',
};

const followUpLabels: Record<BehaviorRecordRow['follow_up_status'], string> = {
  contact_guardian: 'ประสานผู้ปกครอง',
  none: 'ปกติ/ไม่ต้องติดตาม',
  referred: 'ส่งต่อฝ่ายแนะแนว',
  resolved: 'ดูแลเรียบร้อยแล้ว',
  watch: 'เฝ้าติดตาม',
};

function escapeCsv(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
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
  const monthDate = parseLocalDate(dateValue.length === 7 ? `${dateValue}-01` : dateValue);
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

interface MonthBucket {
  from: string;
  fullLabel: string;
  key: string;
  shortLabel: string;
  to: string;
}

function getMonthsBetween(dateFrom: string, dateTo: string): MonthBucket[] {
  const start = parseLocalDate(dateFrom);
  const end = parseLocalDate(dateTo);
  const buckets: MonthBucket[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  let guard = 0;
  while (cursor <= last && guard < 24) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const shortLabel = new Intl.DateTimeFormat('th-TH', {
      month: 'short',
      year: '2-digit',
    }).format(cursor);
    const fullLabel = new Intl.DateTimeFormat('th-TH', {
      month: 'long',
      year: 'numeric',
    }).format(cursor);
    buckets.push({
      from: formatDateKey(y, m, 1),
      fullLabel,
      key,
      shortLabel,
      to: formatDateKey(y, m, new Date(y, m + 1, 0).getDate()),
    });
    cursor.setMonth(cursor.getMonth() + 1);
    guard += 1;
  }
  return buckets;
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

function asReportRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function reportText(value: unknown) {
  return String(value ?? '').trim();
}

function getStudentPrefix(student: StudentRow): string {
  const meta = asReportRecord(student.metadata);
  const explicitPrefix = reportText(meta.prefix || meta.title);
  if (explicitPrefix) return explicitPrefix;
  if (student.gender === 'male') return 'เด็กชาย';
  if (student.gender === 'female') return 'เด็กหญิง';
  return '';
}

function getStudentFullName(student: StudentRow, includePrefix = true): string {
  const prefix = includePrefix ? getStudentPrefix(student) : '';
  return `${prefix}${student.first_name} ${student.last_name}`.trim();
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
  const guardian =
    guardians.find((item) => item.student_id === student.id && item.is_primary) ||
    guardians.find((item) => item.student_id === student.id);
  const lines = [
    father !== '-' ? `บิดา: ${father}` : '',
    mother !== '-' ? `มารดา: ${mother}` : '',
    guardian
      ? `ผู้ปกครอง: ${guardian.display_name}${guardian.relation ? ` (${guardian.relation})` : ''}${guardian.phone ? ` โทร. ${guardian.phone}` : ''}`
      : '',
  ].filter(Boolean);
  return lines.length > 0 ? lines : ['-'];
}

function getStudentLatestWeightHeight(student: StudentRow, healthRows: StudentRegisterHealthRow[]) {
  const latest = healthRows.find((row) => row.studentId === student.id && (row.weightKg !== null || row.heightCm !== null));
  const flags = asReportRecord(student.health_flags);
  const meta = asReportRecord(student.metadata);
  const weightRaw = latest?.weightKg ?? flags.weight_kg ?? meta.weight_kg ?? null;
  const heightRaw = latest?.heightCm ?? flags.height_cm ?? meta.height_cm ?? null;
  const weight = weightRaw !== null && weightRaw !== '' && !Number.isNaN(Number(weightRaw)) ? Number(weightRaw) : null;
  const height = heightRaw !== null && heightRaw !== '' && !Number.isNaN(Number(heightRaw)) ? Number(heightRaw) : null;
  const bmi =
    weight && height && height > 0
      ? round(weight / ((height / 100) * (height / 100)))
      : null;
  return { bmi, height, recordDate: latest?.recordDate || null, weight };
}

function getRegisterHealthText(student: StudentRow, healthRows: StudentRegisterHealthRow[]) {
  const { weight, height, bmi } = getStudentLatestWeightHeight(student, healthRows);
  const values = [
    weight ? `นน. ${weight} กก.` : '',
    height ? `สส. ${height} ซม.` : '',
    bmi ? `BMI ${bmi}` : '',
  ].filter(Boolean);
  return values.join(' / ') || '-';
}

function getRegisterFieldValue(
  student: StudentRow,
  field: RegisterOptionalField,
  guardians: StudentGuardianReportRow[],
  healthRows: StudentRegisterHealthRow[],
  revealCitizenIds: boolean,
) {
  if (field === 'citizenId') {
    const rawId = student.metadata?.dmc_id_card || student.metadata?.citizen_id || student.metadata?.national_id;
    return maskThaiCitizenId(rawId, revealCitizenIds);
  }
  if (field === 'health') return getRegisterHealthText(student, healthRows);
  if (field === 'address') return formatRegisterAddress(student);
  return getRegisterFamilyLines(student, guardians).join(' | ');
}

function toMonthlySummaryStatus(status: AttendanceStatus | null): 'absent' | 'late' | 'leave' | 'present' | null {
  if (!status) return null;
  if (status === 'present' || status === 'activity') return 'present';
  if (status === 'late') return 'late';
  if (status === 'leave' || status === 'sick') return 'leave';
  return 'absent';
}

// Priority when multiple sessions happen on the same date:
const statusPriority: Record<AttendanceStatus, number> = {
  absent: 6,
  sick: 5,
  leave: 4,
  late: 3,
  present: 2,
  activity: 1,
};

interface MonthlyAttendanceRow {
  attendancePercent: number;
  dailyStatuses: Record<string, AttendanceStatus | null>;
  monthlyCounts: Record<string, { absent: number; late: number; leave: number; present: number; total: number }>;
  student: StudentRow;
  studentCode: string;
  studentName: string;
  totals: Record<'absent' | 'late' | 'leave' | 'present', number>;
}

interface MonthlyAttendanceGrid {
  classroom: ClassroomRow | null;
  dayTotals: Record<number, number>;
  monthBuckets: MonthBucket[];
  monthTotals: Record<string, number>;
  rows: MonthlyAttendanceRow[];
  summary: Record<'absent' | 'late' | 'leave' | 'present', number>;
  totalRecordedDays: number;
}

function buildAttendanceGrid({
  attendanceRecords,
  attendanceSessions,
  classroom,
  dateFrom,
  dateTo,
  periodLabel,
  sessionKind,
  subjectName,
  students,
}: {
  attendanceRecords: AttendanceRecordRow[];
  attendanceSessions: AttendanceSessionRow[];
  classroom: ClassroomRow | null;
  dateFrom: string;
  dateTo: string;
  periodLabel?: string;
  sessionKind: 'daily' | 'subject';
  subjectName?: string;
  students: StudentRow[];
}): MonthlyAttendanceGrid {
  const { days } = getReportMonthContext(dateFrom);
  const monthBuckets = getMonthsBetween(dateFrom, dateTo);
  const selectedClassroomId = classroom?.id || '';

  // Filter matching sessions across the full dateFrom..dateTo range
  const matchingSessions = attendanceSessions
    .filter((session) => !selectedClassroomId || session.classroom_id === selectedClassroomId)
    .filter((session) => session.attendance_date >= dateFrom && session.attendance_date <= dateTo)
    .filter((session) => {
      const isLegacyHomeroom = session.subject_name === 'โฮมรูม';
      return sessionKind === 'subject'
        ? Boolean(session.subject_name) && !isLegacyHomeroom
        : !session.subject_name || isLegacyHomeroom || sessionKind === 'daily';
    })
    .filter((session) => !subjectName || session.subject_name === subjectName)
    .filter((session) => !periodLabel || session.period_label === periodLabel);

  // Group sessions by date (solving the multiple-sessions-per-day overwrite bug!)
  const sessionsByDate = new Map<string, AttendanceSessionRow[]>();
  matchingSessions.forEach((session) => {
    const list = sessionsByDate.get(session.attendance_date) || [];
    list.push(session);
    sessionsByDate.set(session.attendance_date, list);
  });

  const recordsBySessionStudent = new Map(
    attendanceRecords.map((record) => [`${record.session_id}:${record.student_id}`, record]),
  );

  const summary: MonthlyAttendanceGrid['summary'] = {
    present: 0,
    late: 0,
    leave: 0,
    absent: 0,
  };
  const dayTotals: Record<number, number> = {};
  const monthTotals: Record<string, number> = {};
  const recordedDateSet = new Set<string>();

  const allDatesInRange = Array.from(sessionsByDate.keys()).sort();

  const rows: MonthlyAttendanceRow[] = students.map((student) => {
    const dailyStatuses: Record<string, AttendanceStatus | null> = {};
    const monthlyCounts: MonthlyAttendanceRow['monthlyCounts'] = {};
    monthBuckets.forEach((mb) => {
      monthlyCounts[mb.key] = { absent: 0, late: 0, leave: 0, present: 0, total: 0 };
    });

    const totals: MonthlyAttendanceRow['totals'] = {
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
    };

    // Evaluate every date that has a session in dateFrom..dateTo
    allDatesInRange.forEach((dateKey) => {
      const dateSessions = sessionsByDate.get(dateKey) || [];
      let chosenStatus: AttendanceStatus | null = null;

      // Prefer homeroom/daily session if in daily mode, otherwise highest priority status
      for (const sess of dateSessions) {
        const rec = recordsBySessionStudent.get(`${sess.id}:${student.id}`);
        if (!rec?.status) continue;
        if (sessionKind === 'daily' && (!sess.subject_name || sess.subject_name === 'โฮมรูม')) {
          chosenStatus = rec.status;
          break;
        }
        if (!chosenStatus || statusPriority[rec.status] > statusPriority[chosenStatus]) {
          chosenStatus = rec.status;
        }
      }

      if (chosenStatus) {
        recordedDateSet.add(dateKey);
        dailyStatuses[dateKey] = chosenStatus;
        const summaryStatus = toMonthlySummaryStatus(chosenStatus);
        if (summaryStatus) {
          totals[summaryStatus] += 1;
          summary[summaryStatus] += 1;

          const monthKey = dateKey.slice(0, 7);
          if (monthlyCounts[monthKey]) {
            monthlyCounts[monthKey][summaryStatus] += 1;
            monthlyCounts[monthKey].total += 1;
            monthTotals[monthKey] = (monthTotals[monthKey] || 0) + 1;
          }
        }
      }
    });

    // Populate dayTotals for the 1..31 monthly view
    days.forEach((day) => {
      const st = dailyStatuses[day.dateKey] || null;
      if (st) {
        dayTotals[day.day] = (dayTotals[day.day] || 0) + 1;
      }
    });

    const totalStudentDays = totals.present + totals.late + totals.leave + totals.absent;
    const attendedDays = totals.present + totals.late;
    const attendancePercent = totalStudentDays > 0 ? round((attendedDays / totalStudentDays) * 100) : 100;

    return {
      attendancePercent,
      dailyStatuses,
      monthlyCounts,
      student,
      studentCode: student.student_code || '-',
      studentName: getStudentFullName(student),
      totals,
    };
  });

  return {
    classroom,
    dayTotals,
    monthBuckets,
    monthTotals,
    rows,
    summary,
    totalRecordedDays: recordedDateSet.size,
  };
}

interface MonthlySavingsRow {
  dailyAmounts: Record<string, number>;
  depositsInPeriod: number;
  monthlyNet: Record<string, number>;
  student: StudentRow;
  studentCode: string;
  studentId: string;
  studentName: string;
  totalBalance: number;
  totalPeriodNet: number;
  transactionCount: number;
  withdrawalsInPeriod: number;
}

interface MonthlySavingsGrid {
  classroom: ClassroomRow | null;
  dayTotals: Record<number, number>;
  monthBuckets: MonthBucket[];
  monthTotals: Record<string, number>;
  rows: MonthlySavingsRow[];
  totalActiveSavingsStudents: number;
  totalCumulativeBalance: number;
  totalPeriodDeposits: number;
  totalPeriodNet: number;
  totalPeriodWithdrawals: number;
  totalStudents: number;
}

function buildSavingsGrid({
  savingsAccounts,
  savingsTransactions,
  classroom,
  dateFrom,
  dateTo,
  students,
}: {
  savingsAccounts: SavingsAccountRow[];
  savingsTransactions: SavingsTransactionRow[];
  classroom: ClassroomRow | null;
  dateFrom: string;
  dateTo: string;
  students: StudentRow[];
}): MonthlySavingsGrid {
  const { days } = getReportMonthContext(dateFrom);
  const monthBuckets = getMonthsBetween(dateFrom, dateTo);
  const savingsAccountByStudent = new Map(savingsAccounts.map((account) => [account.student_id, account]));

  const dayTotals: Record<number, number> = {};
  const monthTotals: Record<string, number> = {};
  let totalPeriodNet = 0;
  let totalPeriodDeposits = 0;
  let totalPeriodWithdrawals = 0;
  let totalCumulativeBalance = 0;
  let totalActiveSavingsStudents = 0;

  const rows: MonthlySavingsRow[] = students.map((student) => {
    const account = savingsAccountByStudent.get(student.id);
    const studentTxs = savingsTransactions.filter(
      (tx) => tx.student_id === student.id && tx.transaction_date >= dateFrom && tx.transaction_date <= dateTo,
    );

    const dailyAmounts: Record<string, number> = {};
    const monthlyNet: Record<string, number> = {};
    monthBuckets.forEach((mb) => {
      monthlyNet[mb.key] = 0;
    });

    let depositsInPeriod = 0;
    let withdrawalsInPeriod = 0;
    let rowNet = 0;

    studentTxs.forEach((tx) => {
      const amt = Number(tx.amount || 0);
      const delta = tx.transaction_type === 'withdrawal' ? -amt : amt;
      if (tx.transaction_type === 'deposit') depositsInPeriod += amt;
      else if (tx.transaction_type === 'withdrawal') withdrawalsInPeriod += amt;
      else if (delta > 0) depositsInPeriod += delta;

      rowNet += delta;
      dailyAmounts[tx.transaction_date] = (dailyAmounts[tx.transaction_date] || 0) + delta;

      const monthKey = tx.transaction_date.slice(0, 7);
      if (monthlyNet[monthKey] !== undefined) {
        monthlyNet[monthKey] += delta;
        monthTotals[monthKey] = (monthTotals[monthKey] || 0) + delta;
      }
    });

    days.forEach((day) => {
      const val = dailyAmounts[day.dateKey];
      if (val) {
        dayTotals[day.day] = (dayTotals[day.day] || 0) + val;
      }
    });

    const totalBalance = account !== undefined ? Number(account.balance || 0) : Math.max(0, rowNet);
    totalCumulativeBalance += totalBalance;
    totalPeriodNet += rowNet;
    totalPeriodDeposits += depositsInPeriod;
    totalPeriodWithdrawals += withdrawalsInPeriod;

    if (rowNet > 0 || totalBalance > 0) {
      totalActiveSavingsStudents += 1;
    }

    return {
      dailyAmounts,
      depositsInPeriod,
      monthlyNet,
      student,
      studentCode: student.student_code || '-',
      studentId: student.id,
      studentName: getStudentFullName(student),
      totalBalance,
      totalPeriodNet: rowNet,
      transactionCount: studentTxs.length,
      withdrawalsInPeriod,
    };
  });

  return {
    classroom,
    dayTotals,
    monthBuckets,
    monthTotals,
    rows,
    totalActiveSavingsStudents,
    totalCumulativeBalance,
    totalPeriodDeposits,
    totalPeriodNet,
    totalPeriodWithdrawals,
    totalStudents: students.length,
  };
}

function buildSignaturesList(reportIdentity: SchoolReportIdentity, teacherName: string, thirdRole = 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ') {
  return [
    { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำ / ครูประจำชั้น' },
    ...(reportIdentity.coAdvisorName?.trim() ? [{ name: reportIdentity.coAdvisorName, role: 'ครูที่ปรึกษาร่วม' }] : []),
    { name: reportIdentity.academicHeadName, role: thirdRole },
    { name: reportIdentity.directorName, role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน' },
  ];
}

function buildPrintableAttendanceHtml({
  attendanceGrid,
  dateFrom,
  dateTo,
  orientation,
  periodMode,
  reportIdentity,
  schoolName,
  subtitleOverride,
  teacherName,
  titleOverride,
  workspaceName,
}: {
  attendanceGrid: MonthlyAttendanceGrid;
  dateFrom: string;
  dateTo: string;
  orientation: OfficialReportOrientation;
  periodMode: ReportPeriod;
  reportIdentity: SchoolReportIdentity;
  schoolName: string;
  subtitleOverride?: string;
  teacherName: string;
  titleOverride?: string;
  workspaceName: string;
}) {
  const { days, monthLabel } = getReportMonthContext(dateFrom);
  const classroomName = attendanceGrid.classroom?.name || workspaceName || '-';
  const academicYear = attendanceGrid.classroom?.academic_year || reportIdentity.academicYear || '2569';
  const documentCode = buildOfficialDocumentCode('CC-ATT', dateFrom, classroomName);
  const isMultiMonth = periodMode !== 'month' && attendanceGrid.monthBuckets.length > 1;

  const theadHtml = isMultiMonth
    ? `<tr>
        <th class="number">ที่</th>
        <th class="code">รหัส</th>
        <th class="name">ชื่อ - นามสกุล</th>
        ${attendanceGrid.monthBuckets.map((mb) => `<th>${escapeHtml(mb.shortLabel)}<br/><small>(มา/รวม)</small></th>`).join('')}
        <th class="sum">มา</th>
        <th class="sum">สาย</th>
        <th class="sum">ลา/ป่วย</th>
        <th class="sum">ขาด</th>
        <th class="sum">ร้อยละ</th>
      </tr>`
    : `<tr>
        <th class="number">ที่</th>
        <th class="name">ชื่อ - นามสกุล</th>
        ${days.map((day) => `<th class="${day.isWeekend ? 'weekend' : ''}">${day.day}</th>`).join('')}
        <th class="sum">มา</th>
        <th class="sum">สาย</th>
        <th class="sum">ลา</th>
        <th class="sum">ขาด</th>
        <th class="sum">%</th>
      </tr>`;

  const tbodyHtml =
    attendanceGrid.rows.length > 0
      ? attendanceGrid.rows
          .map((row, index) => {
            if (isMultiMonth) {
              const monthCells = attendanceGrid.monthBuckets
                .map((mb) => {
                  const mc = row.monthlyCounts[mb.key] || { absent: 0, late: 0, leave: 0, present: 0, total: 0 };
                  const attended = mc.present + mc.late;
                  return `<td class="day">${mc.total > 0 ? `${attended}/${mc.total}` : '-'}</td>`;
                })
                .join('');
              return `<tr>
                <td class="number">${index + 1}</td>
                <td class="code">${escapeHtml(row.studentCode)}</td>
                <td class="name">${escapeHtml(row.studentName)}</td>
                ${monthCells}
                <td class="sum present">${row.totals.present}</td>
                <td class="sum late">${row.totals.late}</td>
                <td class="sum leave">${row.totals.leave}</td>
                <td class="sum absent">${row.totals.absent}</td>
                <td class="sum">${row.attendancePercent}%</td>
              </tr>`;
            }

            const dayCells = days
              .map((day) => {
                const status = row.dailyStatuses[day.dateKey];
                return `<td class="day ${day.isWeekend ? 'weekend' : ''}">${status ? escapeHtml(monthlyStatusAbbreviations[status]) : ''}</td>`;
              })
              .join('');

            return `<tr>
              <td class="number">${index + 1}</td>
              <td class="name">${escapeHtml(row.studentName)}</td>
              ${dayCells}
              <td class="sum present">${row.totals.present}</td>
              <td class="sum late">${row.totals.late}</td>
              <td class="sum leave">${row.totals.leave}</td>
              <td class="sum absent">${row.totals.absent}</td>
              <td class="sum">${row.attendancePercent}%</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="${isMultiMonth ? attendanceGrid.monthBuckets.length + 8 : days.length + 7}" style="padding:6mm;text-align:center;">ไม่มีรายชื่อนักเรียนในห้องเรียนนี้</td></tr>`;

  const tfootHtml = isMultiMonth
    ? `<tr>
        <td colspan="3" class="name" style="text-align:right;padding-right:3mm;">รวมบันทึกทั้งหมด (ครั้ง)</td>
        ${attendanceGrid.monthBuckets.map((mb) => `<td class="total">${attendanceGrid.monthTotals[mb.key] || '-'}</td>`).join('')}
        <td class="total">${attendanceGrid.summary.present}</td>
        <td class="total">${attendanceGrid.summary.late}</td>
        <td class="total">${attendanceGrid.summary.leave}</td>
        <td class="total">${attendanceGrid.summary.absent}</td>
        <td class="total">-</td>
      </tr>`
    : `<tr>
        <td></td>
        <td class="name">รวมผู้เรียนที่มีบันทึก</td>
        ${days.map((day) => `<td class="day total ${day.isWeekend ? 'weekend' : ''}">${attendanceGrid.dayTotals[day.day] || ''}</td>`).join('')}
        <td class="total">${attendanceGrid.summary.present}</td>
        <td class="total">${attendanceGrid.summary.late}</td>
        <td class="total">${attendanceGrid.summary.leave}</td>
        <td class="total">${attendanceGrid.summary.absent}</td>
        <td class="total">-</td>
      </tr>`;

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ClassCare 360 - รายงานเวลาเรียน</title>
        <style>
          ${buildOfficialReportCss({ dense: true, marginMm: orientation === 'portrait' ? 10 : 8, orientation })}
          .summary-grid { display: grid; gap: 2mm; grid-template-columns: repeat(4, 1fr); margin: 1.5mm 0 2mm; }
          .summary-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 2mm; padding: 1.2mm 2mm; text-align: center; }
          .summary-card span { display: block; font-size: 8.5pt; font-weight: 700; color: #0f2742; }
          .summary-card strong { color: #0891b2; display: block; font-size: 13pt; margin-top: .4mm; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          th, td { border: 1px solid #cbd5e1; font-size: ${isMultiMonth ? '9pt' : '8.25pt'}; height: 15px; padding: 1px 1.5px; text-align: center; vertical-align: middle; line-height: 1.1; }
          th { background: #e6f7fb !important; border-top: .8mm solid #0f2742 !important; color: #0f2742 !important; font-weight: 700; }
          th.name, td.name { text-align: left; width: ${isMultiMonth ? '46mm' : '42mm'}; padding-left: 2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          th.number, td.number { width: 8mm; }
          th.code, td.code { width: 16mm; }
          .day { width: auto; }
          .weekend { background: #f1f5f9 !important; color: #94a3b8; }
          .present { color: #047857; font-weight: 700; }
          .late { color: #b45309; font-weight: 700; }
          .leave { color: #0369a1; font-weight: 700; }
          .absent { color: #be123c; font-weight: 700; }
          .sum { background: #e6f7fb !important; width: ${isMultiMonth ? '13mm' : '8.5mm'}; font-weight: 700; color: #0f2742 !important; }
          .total { background: #e6f7fb !important; font-weight: 700; color: #0f2742 !important; }
        </style>
      </head>
      <body>
        <main class="official-sheet">
          ${buildOfficialHeaderHtml({
            classroomName,
            dateFrom,
            dateTo,
            documentCode,
            identity: { ...reportIdentity, academicYear },
            schoolName,
            subtitle:
              subtitleOverride ||
              (isMultiMonth
                ? `สรุปเวลาเรียนรวม (${formatThaiOfficialShortDate(dateFrom)} ถึง ${formatThaiOfficialShortDate(dateTo)})`
                : `ประจำเดือน${monthLabel}`),
            title: titleOverride || `บัญชีเวลาเรียนระดับชั้น ${classroomName}`,
          })}
          <section class="summary-grid">
            <div class="summary-card"><span>มาเรียน (ครั้ง)</span><strong>${attendanceGrid.summary.present.toLocaleString('th-TH')}</strong></div>
            <div class="summary-card"><span>มาสาย (ครั้ง)</span><strong>${attendanceGrid.summary.late.toLocaleString('th-TH')}</strong></div>
            <div class="summary-card"><span>ลา / ป่วย (ครั้ง)</span><strong>${attendanceGrid.summary.leave.toLocaleString('th-TH')}</strong></div>
            <div class="summary-card"><span>ขาดเรียน (ครั้ง)</span><strong>${attendanceGrid.summary.absent.toLocaleString('th-TH')}</strong></div>
          </section>
          <table>
            <thead>${theadHtml}</thead>
            <tbody>${tbodyHtml}</tbody>
            <tfoot>${tfootHtml}</tfoot>
          </table>
          <div class="official-closing-block">
            <div class="official-certification">หมายเหตุ: ✓ = มาเรียน, ส = สาย, ล = ลากิจ, ป = ลาป่วย, ข = ขาดเรียน, ก = กิจกรรม · ขอรับรองว่าข้อมูลเวลาเรียนถูกต้องตรงตามทะเบียนเช็คชื่อของสถานศึกษา</div>
            ${buildOfficialSignaturesHtml(buildSignaturesList(reportIdentity, teacherName))}
            ${buildOfficialFooterHtml({ confidential: true, documentCode })}
          </div>
        </main>
      </body>
    </html>`;
}

function buildPrintableSavingsReportHtml({
  dateFrom,
  dateTo,
  orientation,
  periodMode,
  reportIdentity,
  savingsGrid,
  schoolName,
  teacherName,
  workspaceName,
}: {
  dateFrom: string;
  dateTo: string;
  orientation: OfficialReportOrientation;
  periodMode: ReportPeriod;
  reportIdentity: SchoolReportIdentity;
  savingsGrid: MonthlySavingsGrid;
  schoolName: string;
  teacherName: string;
  workspaceName: string;
}) {
  const { days, monthLabel } = getReportMonthContext(dateFrom);
  const classroomName = savingsGrid.classroom?.name || workspaceName || '-';
  const academicYear = savingsGrid.classroom?.academic_year || reportIdentity.academicYear || '2569';
  const documentCode = buildOfficialDocumentCode('CC-SAV', dateFrom, classroomName);
  const isMultiMonth = periodMode !== 'month' && savingsGrid.monthBuckets.length > 1;

  const theadHtml = isMultiMonth
    ? `<tr>
        <th class="number">ที่</th>
        <th class="code">รหัส</th>
        <th class="name">ชื่อ - นามสกุล</th>
        ${savingsGrid.monthBuckets.map((mb) => `<th>${escapeHtml(mb.shortLabel)}</th>`).join('')}
        <th class="sum month-total">ฝากรวม</th>
        <th class="sum month-total">ถอนรวม</th>
        <th class="sum balance-total">ยอดสะสมคงเหลือ</th>
      </tr>`
    : `<tr>
        <th class="number">ที่</th>
        <th class="name">ชื่อ - นามสกุล</th>
        ${days.map((day) => `<th class="${day.isWeekend ? 'weekend' : ''}">${day.day}</th>`).join('')}
        <th class="sum month-total">ออมเดือนนี้</th>
        <th class="sum balance-total">ยอดสะสมคงเหลือ</th>
      </tr>`;

  const tbodyHtml =
    savingsGrid.rows.length > 0
      ? savingsGrid.rows
          .map((row, index) => {
            if (isMultiMonth) {
              const monthCells = savingsGrid.monthBuckets
                .map((mb) => {
                  const net = row.monthlyNet[mb.key] || 0;
                  return `<td class="day">${net !== 0 ? net.toLocaleString('th-TH') : '-'}</td>`;
                })
                .join('');
              return `<tr>
                <td class="number">${index + 1}</td>
                <td class="code">${escapeHtml(row.studentCode)}</td>
                <td class="name">${escapeHtml(row.studentName)}</td>
                ${monthCells}
                <td class="sum month-total">${row.depositsInPeriod.toLocaleString('th-TH')}</td>
                <td class="sum month-total">${row.withdrawalsInPeriod.toLocaleString('th-TH')}</td>
                <td class="sum balance-total">${row.totalBalance.toLocaleString('th-TH')}</td>
              </tr>`;
            }

            const dayCells = days
              .map((day) => {
                const amt = row.dailyAmounts[day.dateKey];
                return `<td class="day ${day.isWeekend ? 'weekend' : ''}">${amt ? amt : ''}</td>`;
              })
              .join('');

            return `<tr>
              <td class="number">${index + 1}</td>
              <td class="name">${escapeHtml(row.studentName)}</td>
              ${dayCells}
              <td class="sum month-total">${row.totalPeriodNet ? row.totalPeriodNet.toLocaleString('th-TH') : '0'}</td>
              <td class="sum balance-total">${row.totalBalance.toLocaleString('th-TH')}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="${isMultiMonth ? savingsGrid.monthBuckets.length + 6 : days.length + 4}" style="padding:6mm;text-align:center;">ไม่มีรายชื่อนักเรียนในห้องเรียนนี้</td></tr>`;

  const tfootHtml = isMultiMonth
    ? `<tr>
        <td colspan="3" class="name" style="text-align:right;padding-right:3mm;">รวมทั้งสิ้น (บาท)</td>
        ${savingsGrid.monthBuckets.map((mb) => `<td class="total">${savingsGrid.monthTotals[mb.key] ? savingsGrid.monthTotals[mb.key].toLocaleString('th-TH') : '-'}</td>`).join('')}
        <td class="total">${savingsGrid.totalPeriodDeposits.toLocaleString('th-TH')}</td>
        <td class="total">${savingsGrid.totalPeriodWithdrawals.toLocaleString('th-TH')}</td>
        <td class="total">${savingsGrid.totalCumulativeBalance.toLocaleString('th-TH')}</td>
      </tr>`
    : `<tr>
        <td></td>
        <td class="name">รวมทั้งสิ้น (บาท)</td>
        ${days.map((day) => `<td class="day total ${day.isWeekend ? 'weekend' : ''}">${savingsGrid.dayTotals[day.day] ? savingsGrid.dayTotals[day.day].toLocaleString('th-TH') : ''}</td>`).join('')}
        <td class="total">${savingsGrid.totalPeriodNet.toLocaleString('th-TH')}</td>
        <td class="total">${savingsGrid.totalCumulativeBalance.toLocaleString('th-TH')}</td>
      </tr>`;

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>ClassCare 360 - รายงานการออมเงิน</title>
        <style>
          ${buildOfficialReportCss({ dense: true, marginMm: orientation === 'portrait' ? 10 : 8, orientation })}
          .summary-grid { display: grid; gap: 2mm; grid-template-columns: repeat(4, 1fr); margin: 1.5mm 0 2mm; }
          .summary-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 2mm; padding: 1.2mm 2mm; text-align: center; }
          .summary-card span { display: block; font-size: 8.5pt; font-weight: 700; color: #0f2742; }
          .summary-card strong { color: #0891b2; display: block; font-size: 13pt; margin-top: .4mm; }
          table { border-collapse: collapse; table-layout: fixed; width: 100%; }
          th, td { border: 1px solid #cbd5e1; font-size: ${isMultiMonth ? '9pt' : '8.25pt'}; height: 15px; padding: 1px 1.5px; text-align: center; vertical-align: middle; line-height: 1.1; }
          th { background: #e6f7fb !important; border-top: .8mm solid #0f2742 !important; color: #0f2742 !important; font-weight: 700; }
          th.name, td.name { text-align: left; width: ${isMultiMonth ? '46mm' : '42mm'}; padding-left: 2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          th.number, td.number { width: 8mm; }
          th.code, td.code { width: 16mm; }
          .day { width: auto; }
          .weekend { background: #f1f5f9 !important; color: #94a3b8; }
          .sum { background: #e6f7fb !important; font-weight: 700; color: #0f2742 !important; }
          .month-total { width: 16mm; }
          .balance-total { width: 20mm; }
          .total { background: #e6f7fb !important; font-weight: 700; color: #0f2742 !important; }
        </style>
      </head>
      <body>
        <main class="official-sheet">
          ${buildOfficialHeaderHtml({
            classroomName,
            dateFrom,
            dateTo,
            documentCode,
            identity: { ...reportIdentity, academicYear },
            schoolName,
            subtitle: isMultiMonth
              ? `สรุปรายการออมเงิน (${formatThaiOfficialShortDate(dateFrom)} ถึง ${formatThaiOfficialShortDate(dateTo)})`
              : `ประจำเดือน${monthLabel}`,
            title: `รายงานการออมเงินระดับชั้น ${classroomName}`,
          })}
          <section class="summary-grid">
            <div class="summary-card"><span>นักเรียนทั้งหมด</span><strong>${savingsGrid.totalStudents} คน</strong></div>
            <div class="summary-card"><span>มีบัญชี/เคลื่อนไหว</span><strong>${savingsGrid.totalActiveSavingsStudents} คน</strong></div>
            <div class="summary-card"><span>ออมสุทธิช่วงนี้</span><strong>${savingsGrid.totalPeriodNet.toLocaleString('th-TH')} บาท</strong></div>
            <div class="summary-card"><span>ยอดสะสมคงเหลือรวม</span><strong>${savingsGrid.totalCumulativeBalance.toLocaleString('th-TH')} บาท</strong></div>
          </section>
          <table>
            <thead>${theadHtml}</thead>
            <tbody>${tbodyHtml}</tbody>
            <tfoot>${tfootHtml}</tfoot>
          </table>
          <div class="official-closing-block">
            <div class="official-certification">ขอรับรองว่ารายการฝาก ถอน และยอดเงินออมสะสมคงเหลือในรายงานฉบับนี้ตรงกับสมุดคู่ฝากและฐานข้อมูลของสถานศึกษา ณ วันตัดยอด</div>
            ${buildOfficialSignaturesHtml(buildSignaturesList(reportIdentity, teacherName, 'ผู้ตรวจสอบ / หัวหน้างานการเงินหรือวิชาการ'))}
            ${buildOfficialFooterHtml({ confidential: true, documentCode })}
          </div>
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
  kpiCards?: Array<{ label: string; value: string }>;
  orientation?: OfficialReportOrientation;
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
  kpiCards = [],
  orientation = 'landscape',
  reportIdentity,
  rows,
  schoolName,
  subtitle,
  teacherName,
  title,
  workspaceName,
}: PrintableTableReportOptions) {
  const documentCode = buildOfficialDocumentCode(documentPrefix, dateFrom, workspaceName);
  const tableRows =
    rows.length > 0
      ? rows
          .map(
            (row, index) =>
              `<tr><td class="official-center">${index + 1}</td>${row
                .map((cell) => `<td>${escapeHtml(String(cell ?? '-'))}</td>`)
                .join('')}</tr>`,
          )
          .join('')
      : `<tr><td class="official-center" colspan="${columns.length + 1}" style="padding:6mm;">ยังไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>`;

  const kpiHtml =
    kpiCards.length > 0
      ? `<section class="official-kpi-grid">${kpiCards
          .map((item) => `<div class="official-kpi"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`)
          .join('')}</section>`
      : '';

  return `<!doctype html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          ${buildOfficialReportCss({ dense: true, marginMm: orientation === 'portrait' ? 11 : 8, orientation })}
          .official-table th:first-child, .official-table td:first-child { width: 9mm; }
        </style>
      </head>
      <body>
        <main class="official-sheet">
          ${buildOfficialHeaderHtml({ classroomName: workspaceName, dateFrom, dateTo, documentCode, identity: reportIdentity, schoolName, subtitle, title })}
          ${kpiHtml}
          <table class="official-table">
            <thead><tr><th>ที่</th>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <div class="official-closing-block">
            <div class="official-certification">ขอรับรองว่าข้อมูลในรายงานฉบับนี้ตรวจสอบจากข้อมูลที่บันทึกในระบบตามช่วงเวลาที่ระบุ และถูกต้องตามข้อมูลที่มีอยู่ ณ วันตัดยอด</div>
            ${buildOfficialSignaturesHtml(buildSignaturesList(reportIdentity, teacherName))}
            ${buildOfficialFooterHtml({ confidential, documentCode })}
          </div>
        </main>
      </body>
    </html>`;
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
  orientation: OfficialReportOrientation;
  reportIdentity: SchoolReportIdentity;
  revealCitizenIds: boolean;
  schoolName: string;
  students: StudentRow[];
  teacherName: string;
}) {
  const documentCode = buildOfficialDocumentCode('CC-REG', dateFrom, classroomName);
  const genderLabel = (gender: StudentRow['gender']) =>
    gender === 'male' ? 'ชาย' : gender === 'female' ? 'หญิง' : gender === 'other' ? 'อื่น ๆ' : '-';
  const enabledFields = registerFieldOptions.filter((field) => fields[field.value]).map((field) => field.value);

  const rows = students
    .map((student, index) => {
      const studentName = getStudentFullName(student);
      if (orientation === 'portrait') {
        const details =
          enabledFields.length > 0
            ? enabledFields
                .map(
                  (field) =>
                    `<div class="register-detail"><strong>${registerFieldLabels[field]}:</strong> ${escapeHtml(
                      getRegisterFieldValue(student, field, guardians, healthRows, revealCitizenIds),
                    )}</div>`,
                )
                .join('')
            : '<span class="register-muted">สำหรับใช้เช็คชื่อ / ลงลายมือชื่อ</span>';
        return `<tr>
          <td class="official-center">${index + 1}</td>
          <td class="official-center">${escapeHtml(student.student_code || '-')}</td>
          <td>
            <strong>${escapeHtml(studentName)}</strong>
            <small class="register-student-meta">${genderLabel(student.gender)} · เกิด ${escapeHtml(formatThaiOfficialShortDate(student.birth_date))}</small>
          </td>
          <td>${details}</td>
          <td></td>
        </tr>`;
      }
      return `<tr>
        <td class="official-center">${index + 1}</td>
        <td class="official-center">${escapeHtml(student.student_code || '-')}</td>
        <td>
          <strong>${escapeHtml(studentName)}</strong>
          <small class="register-student-meta">${genderLabel(student.gender)} · เกิด ${escapeHtml(formatThaiOfficialShortDate(student.birth_date))}</small>
        </td>
        ${enabledFields.map((field) => `<td>${escapeHtml(getRegisterFieldValue(student, field, guardians, healthRows, revealCitizenIds))}</td>`).join('')}
        <td></td>
      </tr>`;
    })
    .join('');

  const maleCount = students.filter((student) => student.gender === 'male').length;
  const femaleCount = students.filter((student) => student.gender === 'female').length;

  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>ทะเบียนนักเรียน ${escapeHtml(classroomName)}</title><style>
    ${buildOfficialReportCss({ dense: true, marginMm: orientation === 'portrait' ? 11 : 8, orientation })}
    .register-summary { align-items: stretch; border: 1px solid #cbd5e1; border-radius: 2mm; background: #f8fafc; display: grid; font-size: 10pt; grid-template-columns: repeat(4, 1fr); margin: 2mm 0; }
    .register-summary span { padding: 1.2mm 2mm; text-align: center; }
    .register-summary span + span { border-left: 1px solid #cbd5e1; }
    .register-summary strong { font-size: 12pt; color: #0f2742; }
    .register-table th, .register-table td { font-size: ${orientation === 'portrait' ? '10pt' : '9.25pt'}; line-height: 1.12; padding: ${orientation === 'portrait' ? '1.3mm 1.2mm' : '.85mm .9mm'}; vertical-align: middle; }
    .register-student-meta { color: #475569; display: block; font-size: 8.5pt; font-weight: 400; margin-top: .3mm; }
    .register-detail + .register-detail { border-top: .5px dotted #cbd5e1; margin-top: .5mm; padding-top: .5mm; }
    .register-muted { color: #94a3b8; font-size: 8.5pt; }
  </style></head><body><main class="official-sheet">
    ${buildOfficialHeaderHtml({
      classroomName,
      dateFrom,
      dateTo,
      documentCode,
      identity: reportIdentity,
      schoolName,
      subtitle: `บัญชีรายชื่อและทะเบียนนักเรียนประจำปีการศึกษา ${reportIdentity.academicYear || '-'}`,
      title: 'ทะเบียนรายชื่อนักเรียน',
    })}
    <div class="register-summary">
      <span>นักเรียนทั้งหมด<br><strong>${students.length}</strong> คน</span>
      <span>ชาย<br><strong>${maleCount}</strong> คน</span>
      <span>หญิง<br><strong>${femaleCount}</strong> คน</span>
      <span>ข้อมูล ณ<br><strong>${formatThaiOfficialShortDate(dateTo)}</strong></span>
    </div>
    <table class="official-table register-table">
      <colgroup>${
        orientation === 'portrait'
          ? '<col style="width:10mm"><col style="width:20mm"><col style="width:52mm"><col><col style="width:28mm">'
          : `<col style="width:8mm"><col style="width:18mm"><col style="width:50mm">${enabledFields.map(() => '<col>').join('')}<col style="width:26mm">`
      }</colgroup>
      <thead>
        <tr>
          <th>ที่</th>
          <th>รหัสประจำตัว</th>
          <th>ชื่อ – นามสกุล</th>
          ${
            orientation === 'portrait'
              ? `<th>${enabledFields.length > 0 ? 'ข้อมูลทะเบียนที่เลือก' : 'รายการ / บันทึก'}</th>`
              : enabledFields.map((field) => `<th>${registerFieldLabels[field]}</th>`).join('')
          }
          <th>ลายมือชื่อ / หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>${
        rows ||
        `<tr><td colspan="${orientation === 'portrait' ? 5 : enabledFields.length + 4}" class="official-center" style="padding:6mm;">ยังไม่มีข้อมูลนักเรียน</td></tr>`
      }</tbody>
    </table>
    <div class="official-closing-block">
      <div class="official-certification">ขอรับรองว่ารายชื่อนักเรียนข้างต้นตรงกับทะเบียนนักเรียนของสถานศึกษา ณ วันที่ระบุ · รูปแบบ A4 ${orientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'}</div>
      ${buildOfficialSignaturesHtml(buildSignaturesList(reportIdentity, teacherName, 'ผู้ตรวจสอบ / นายทะเบียนโรงเรียน'))}
      ${buildOfficialFooterHtml({ confidential: true, documentCode })}
    </div>
  </main></body></html>`;
}

interface ExecutiveReportMetrics {
  attendanceRate: number;
  behaviorFollowUps: number;
  classroomCount: number;
  healthCompletionRate: number;
  healthFollowUps: number;
  savingsTotal: number;
  scoreAverage: number;
  scopeLabel: string;
  studentCount: number;
}

function buildPrintableExecutiveReportHtml({
  classroomName,
  dateFrom,
  dateTo,
  metrics,
  orientation,
  reportIdentity,
  schoolName,
  teacherName,
}: {
  classroomName: string;
  dateFrom: string;
  dateTo: string;
  metrics: ExecutiveReportMetrics;
  orientation: OfficialReportOrientation;
  reportIdentity: SchoolReportIdentity;
  schoolName: string;
  teacherName: string;
}) {
  const documentCode = buildOfficialDocumentCode('CC-EXE', dateFrom, classroomName);
  const status = (value: number, target: number) =>
    value >= target ? 'เป็นไปตามเป้าหมาย' : value >= target - 10 ? 'ควรเฝ้าระวัง' : 'ต้องเร่งติดตาม';
  const executiveRows = [
    [
      '1. เวลาเรียนและการมาเรียน',
      `${metrics.attendanceRate}%`,
      'ไม่น้อยกว่า 90%',
      status(metrics.attendanceRate, 90),
      metrics.attendanceRate < 90 ? 'ติดตามนักเรียนขาดเรียนและประสานผู้ปกครองรายบุคคล' : 'รักษาระดับการมาเรียนและติดตามต่อเนื่อง',
    ],
    [
      '2. ผลสัมฤทธิ์ทางการเรียน',
      `${metrics.scoreAverage}%`,
      'ไม่น้อยกว่า 70%',
      status(metrics.scoreAverage, 70),
      metrics.scoreAverage < 70 ? 'จัดกิจกรรมสอนเสริมและซ่อมเสริมงานค้างรายวิชา' : 'ติดตามชุดคะแนนต่อเนื่องตามแผนการวัดผล',
    ],
    [
      '3. สุขภาพและกิจวัตรประจำวัน',
      `${metrics.healthCompletionRate}%`,
      'ไม่น้อยกว่า 90%',
      status(metrics.healthCompletionRate, 90),
      `มีนักเรียนต้องติดตามสุขอนามัย/โภชนาการ ${metrics.healthFollowUps} คน`,
    ],
    [
      '4. พฤติกรรมและระบบดูแลช่วยเหลือ',
      `${metrics.behaviorFollowUps} เคส`,
      'ดูแลครบ 100%',
      metrics.behaviorFollowUps === 0 ? 'เป็นไปตามเป้าหมาย' : 'กำลังติดตามดูแล',
      'ครูประจำชั้นติดตามดูแลและบันทึกผลในระบบ',
    ],
    [
      '5. การส่งเสริมการออมทรัพย์',
      `${metrics.savingsTotal.toLocaleString('th-TH')} บาท`,
      'บัญชีโปร่งใสครบถ้วน',
      'ดำเนินการต่อเนื่อง',
      'ตรวจสอบยอดเงินออมคงเหลือตรงกับสมุดคู่ฝากนักเรียน',
    ],
  ];

  const proposedAction =
    [
      metrics.attendanceRate < 90 ? 'เร่งติดตามนักเรียนที่มีเวลาเรียนต่ำกว่าเกณฑ์' : '',
      metrics.scoreAverage < 70 ? 'จัดกิจกรรมสอนเสริมและติดตามผลสัมฤทธิ์' : '',
      metrics.healthFollowUps > 0 ? `ติดตามสุขอนามัยนักเรียน ${metrics.healthFollowUps} คน` : '',
      metrics.behaviorFollowUps > 0 ? `ทบทวนแผนช่วยเหลือนักเรียน ${metrics.behaviorFollowUps} เคส` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'ผลการดำเนินงานโดยรวมเป็นไปตามเป้าหมาย เห็นควรดำเนินการตามแผนและติดตามอย่างต่อเนื่อง';

  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>รายงานสรุปผู้บริหาร</title><style>
    ${buildOfficialReportCss({ dense: false, marginMm: orientation === 'portrait' ? 12 : 9, orientation })}
    .official-table th:nth-child(1) { width: 38mm; }
    .official-table th:nth-child(2) { width: 24mm; }
    .official-table th:nth-child(3) { width: 26mm; }
    .official-table th:nth-child(4) { width: 28mm; }
  </style></head><body><main class="official-sheet">
    ${buildOfficialHeaderHtml({
      classroomName: metrics.scopeLabel,
      dateFrom,
      dateTo,
      documentCode,
      identity: reportIdentity,
      schoolName,
      subtitle: `ขอบเขตข้อมูล: ${metrics.scopeLabel} (${metrics.classroomCount} ห้องเรียน · นักเรียน ${metrics.studentCount} คน)`,
      title: 'รายงานสรุปผลการดำเนินงานสำหรับผู้บริหาร',
    })}
    <section class="official-kpi-grid">
      <div class="official-kpi"><span>นักเรียนในขอบเขต</span><strong>${metrics.studentCount} คน</strong></div>
      <div class="official-kpi"><span>อัตรามาเรียน</span><strong>${metrics.attendanceRate}%</strong></div>
      <div class="official-kpi"><span>คะแนนเฉลี่ยรวม</span><strong>${metrics.scoreAverage}%</strong></div>
      <div class="official-kpi"><span>รายการต้องติดตาม</span><strong>${metrics.behaviorFollowUps + metrics.healthFollowUps} รายการ</strong></div>
    </section>
    <h2 class="official-section-title">1. สรุปผลการดำเนินงานตามภารกิจหลัก</h2>
    <table class="official-table">
      <thead><tr><th>ด้านการดำเนินงาน</th><th>ผลดำเนินงาน</th><th>เกณฑ์มาตรฐาน</th><th>สถานะ</th><th>แนวทางดำเนินงาน / ข้อเสนอแนะ</th></tr></thead>
      <tbody>${executiveRows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, index) => `<td class="${index > 0 && index < 4 ? 'official-center' : ''}">${escapeHtml(cell)}</td>`)
              .join('')}</tr>`,
        )
        .join('')}</tbody>
    </table>
    <h2 class="official-section-title">2. ข้อเสนอเพื่อโปรดพิจารณาและข้อสั่งการของผู้บริหาร</h2>
    <div class="official-decision">
      <strong>สรุปข้อเสนอ:</strong> ${escapeHtml(proposedAction)}<br /><br />
      <strong>ความเห็น / ข้อสั่งการผู้อำนวยการโรงเรียน:</strong><br />
      ................................................................................................................................................................................................................<br />
      ................................................................................................................................................................................................................
    </div>
    <div class="official-closing-block">
      <div class="official-certification">รายงานฉบับนี้ประมวลผลจากข้อมูลจริงในระบบสารสนเทศ ClassCare 360 ณ วันตัดยอด</div>
      ${buildOfficialSignaturesHtml([
        { name: reportIdentity.teacherName || teacherName, role: 'ผู้จัดทำรายงาน' },
        { name: reportIdentity.academicHeadName, role: 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ' },
        { name: reportIdentity.directorName, role: 'ผู้อำนวยการโรงเรียน (ผู้รับรอง/สั่งการ)' },
      ])}
      ${buildOfficialFooterHtml({ confidential: true, documentCode })}
    </div>
  </main></body></html>`;
}

interface IndividualStudentReportBundle {
  attendance: { absent: number; late: number; leave: number; percent: number; present: number; total: number };
  behaviors: BehaviorRecordRow[];
  guardianText: string;
  health: { attentionText: string; bmi: number | null; brushingText: string; height: number | null; lunchText: string; milkText: string; weight: number | null };
  homeVisit: HomeVisitReportRow | null;
  savings: { balance: number; deposits: number; txCount: number; withdrawals: number };
  student: StudentRow;
  subjectRows: Array<{ earned: number; grade: number | string; max: number; missing: number; percent: number; subject: string }>;
  totalGpa: string;
}

function buildPrintableIndividualStudentHtml({
  bundles,
  classroomName,
  dateFrom,
  dateTo,
  orientation,
  reportIdentity,
  schoolName,
  sections = defaultIndividualReportSections,
  teacherCommentText = defaultIndividualTeacherComment,
  teacherName,
}: {
  bundles: IndividualStudentReportBundle[];
  classroomName: string;
  dateFrom: string;
  dateTo: string;
  orientation: OfficialReportOrientation;
  reportIdentity: SchoolReportIdentity;
  schoolName: string;
  sections?: IndividualReportSectionSelection;
  teacherCommentText?: string;
  teacherName: string;
}) {
  const commentText = teacherCommentText.trim() || defaultIndividualTeacherComment;

  const pagesHtml = bundles
    .map((b, pageIdx) => {
      const studentName = getStudentFullName(b.student);
      const documentCode = buildOfficialDocumentCode('CC-IND', dateFrom, b.student.student_code || String(pageIdx + 1));
      const subjectRowsHtml =
        b.subjectRows.length > 0
          ? b.subjectRows
              .map(
                (sub, sIdx) => `<tr>
                  <td class="official-center">${sIdx + 1}</td>
                  <td><strong>${escapeHtml(sub.subject)}</strong></td>
                  <td class="official-center">${sub.earned} / ${sub.max}</td>
                  <td class="official-center">${sub.percent}%</td>
                  <td class="official-center"><strong>${escapeHtml(String(sub.grade))}</strong></td>
                  <td class="official-center">${sub.missing > 0 ? `ค้าง ${sub.missing} งาน` : 'ครบ'}</td>
                </tr>`,
              )
              .join('')
          : `<tr><td colspan="6" class="official-center">ยังไม่มีรายการประเมินคะแนนในช่วงเวลานี้</td></tr>`;

      const behaviorSummary =
        b.behaviors.length > 0
          ? b.behaviors
              .slice(0, 4)
              .map((rec) => `${formatThaiOfficialShortDate(rec.behavior_date)}: ${rec.category} (${rec.description})`)
              .join(' · ')
          : 'ประพฤติตนเรียบร้อยตามระเบียบของโรงเรียน ไม่พบเคสต้องติดตามพิเศษ';

      const kpiItemsHtml: string[] = [];
      if (sections.attendance) {
        kpiItemsHtml.push(
          `<div class="official-kpi"><span>อัตราเวลาเรียน</span><strong>${b.attendance.percent}%</strong><span style="font-size:8pt;color:#475569;">มา ${b.attendance.present} · สาย ${b.attendance.late} · ลา ${b.attendance.leave} · ขาด ${b.attendance.absent}</span></div>`,
        );
      }
      if (sections.scores) {
        kpiItemsHtml.push(
          `<div class="official-kpi"><span>เกรดเฉลี่ยสะสม</span><strong>${escapeHtml(b.totalGpa)}</strong><span style="font-size:8pt;color:#475569;">${b.subjectRows.length} รายวิชาที่ประเมิน</span></div>`,
        );
      }
      if (sections.savings) {
        kpiItemsHtml.push(
          `<div class="official-kpi"><span>เงินออมสะสมคงเหลือ</span><strong>${b.savings.balance.toLocaleString('th-TH')} ฿</strong><span style="font-size:8pt;color:#475569;">ฝาก ${b.savings.deposits.toLocaleString('th-TH')} · ถอน ${b.savings.withdrawals.toLocaleString('th-TH')}</span></div>`,
        );
      }
      if (sections.health) {
        kpiItemsHtml.push(
          `<div class="official-kpi"><span>สุขภาพและกิจวัตร</span><strong>${escapeHtml(b.health.attentionText === 'ปกติ' ? 'ปกติครบถ้วน' : 'มีจุดติดตาม')}</strong><span style="font-size:8pt;color:#475569;">แปรงฟัน ${b.health.brushingText} · ดื่มนม ${b.health.milkText}</span></div>`,
        );
      }

      let secNo = 1;
      const scoresSectionHtml = sections.scores
        ? `<h2 class="official-section-title" style="font-size:11.5pt;margin:1.5mm 0 1mm;">${secNo++}. สรุปผลสัมฤทธิ์ทางการเรียนรายวิชา</h2>
        <table class="official-table">
          <colgroup><col style="width:10mm"><col><col style="width:28mm"><col style="width:22mm"><col style="width:22mm"><col style="width:26mm"></colgroup>
          <thead>
            <tr><th>ที่</th><th>รายวิชา</th><th>คะแนนที่ได้/เต็ม</th><th>ร้อยละ</th><th>ระดับผลการเรียน</th><th>การส่งงาน</th></tr>
          </thead>
          <tbody>${subjectRowsHtml}</tbody>
        </table>`
        : '';

      const detailRowsHtml: string[] = [];
      if (sections.attendance) {
        detailRowsHtml.push(
          `<tr><td><strong>สรุปเวลาเรียน</strong></td><td>มาเรียน <strong>${b.attendance.present}</strong> วัน · มาสาย <strong>${b.attendance.late}</strong> วัน · ลา/ป่วย <strong>${b.attendance.leave}</strong> วัน · ขาดเรียน <strong>${b.attendance.absent}</strong> วัน (คิดเป็นร้อยละ <strong>${b.attendance.percent}%</strong>)</td></tr>`,
        );
      }
      if (sections.savings) {
        detailRowsHtml.push(
          `<tr><td><strong>เงินออมนักเรียน</strong></td><td>ยอดเงินออมสะสมคงเหลือ <strong>${b.savings.balance.toLocaleString('th-TH')} บาท</strong> · ฝากในช่วงนี้ ${b.savings.deposits.toLocaleString('th-TH')} บาท · ถอน ${b.savings.withdrawals.toLocaleString('th-TH')} บาท (${b.savings.txCount} รายการ)</td></tr>`,
        );
      }
      if (sections.health) {
        detailRowsHtml.push(
          `<tr><td><strong>สุขภาพและกิจวัตร</strong></td><td>น้ำหนัก ${b.health.weight ?? '-'} กก. · ส่วนสูง ${b.health.height ?? '-'} ซม. · BMI ${b.health.bmi ?? '-'} · แปรงฟัน ${escapeHtml(b.health.brushingText)} ครั้ง · ดื่มนม ${escapeHtml(b.health.milkText)} ครั้ง · อาหารกลางวัน ${escapeHtml(b.health.lunchText)} ครั้ง · ผลตรวจสุขอนามัย: ${escapeHtml(b.health.attentionText)}</td></tr>`,
        );
      }
      if (sections.behavior) {
        detailRowsHtml.push(`<tr><td><strong>พฤติกรรมและการดูแล</strong></td><td>${escapeHtml(behaviorSummary)}</td></tr>`);
      }
      if (sections.homeVisit) {
        detailRowsHtml.push(
          `<tr><td><strong>การเยี่ยมบ้าน / กสศ.</strong></td><td>${b.homeVisit ? `ดำเนินการแล้ว (${b.homeVisit.completion_percent || 100}%) เมื่อ ${formatThaiOfficialShortDate(b.homeVisit.visited_at)}` : 'อยู่ระหว่างดำเนินการตามแผนเยี่ยมบ้านประจำภาคเรียน'}</td></tr>`,
        );
      }
      if (sections.teacherComment) {
        detailRowsHtml.push(`<tr><td><strong>ความเห็นครูประจำชั้น</strong></td><td>${escapeHtml(commentText)}</td></tr>`);
      }

      const detailsSectionHtml =
        detailRowsHtml.length > 0
          ? `<h2 class="official-section-title" style="font-size:11.5pt;margin:2mm 0 1mm;">${secNo++}. สรุปข้อมูลพัฒนาการและการดูแลช่วยเหลือนักเรียน</h2>
        <table class="official-table">
          <colgroup><col style="width:42mm"><col></colgroup>
          <tbody>
            ${detailRowsHtml.join('')}
          </tbody>
        </table>`
          : '';

      return `<main class="official-sheet" style="${pageIdx > 0 ? 'page-break-before: always;' : ''}">
        ${buildOfficialHeaderHtml({
          classroomName,
          dateFrom,
          dateTo,
          documentCode,
          identity: reportIdentity,
          schoolName,
          subtitle: `ใบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (สำหรับผู้ปกครอง) · ชั้น ${classroomName}`,
          title: 'รายงานผลการเรียนและพัฒนาการรายบุคคล',
        })}
        <section style="border:1px solid #cbd5e1;border-radius:2mm;background:#f8fafc;padding:2mm 3mm;margin-bottom:2mm;font-size:10pt;display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;">
          <div><strong>ชื่อ - นามสกุล:</strong> ${escapeHtml(studentName)} (${escapeHtml(b.student.nickname || '-')})</div>
          <div><strong>เลขประจำตัวนักเรียน:</strong> ${escapeHtml(b.student.student_code || '-')} · <strong>ชั้น:</strong> ${escapeHtml(classroomName)}</div>
          ${sections.health ? `<div><strong>ข้อมูลสุขภาพล่าสุด:</strong> น้ำหนัก ${b.health.weight ?? '-'} กก. · ส่วนสูง ${b.health.height ?? '-'} ซม. · BMI ${b.health.bmi ?? '-'}</div>` : ''}
          ${sections.guardian ? `<div><strong>ผู้ปกครอง:</strong> ${escapeHtml(b.guardianText)}</div>` : ''}
        </section>

        ${
          kpiItemsHtml.length > 0
            ? `<section class="official-kpi-grid" style="grid-template-columns: repeat(${kpiItemsHtml.length}, minmax(0, 1fr));">
          ${kpiItemsHtml.join('')}
        </section>`
            : ''
        }

        ${scoresSectionHtml}
        ${detailsSectionHtml}

        <div class="official-closing-block">
          <div class="official-certification">เอกสารฉบับนี้ออกโดยระบบสารสนเทศ ClassCare 360 เพื่อแจ้งผลการพัฒนาคุณภาพผู้เรียนรายบุคคลให้ผู้ปกครองรับทราบ</div>
          ${
            sections.teacherComment
              ? buildOfficialSignaturesHtml([
                  { name: reportIdentity.teacherName || teacherName, role: 'ครูประจำชั้น / ผู้รายงาน' },
                  { name: reportIdentity.directorName, role: 'ผู้อำนวยการโรงเรียน' },
                  { name: '', role: 'ผู้ปกครองนักเรียน (ผู้รับทราบ)' },
                ])
              : ''
          }
          ${buildOfficialFooterHtml({ confidential: true, documentCode })}
        </div>
      </main>`;
    })
    .join('');

  return `<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>ใบรายงานผลรายบุคคล</title><style>
    ${buildOfficialReportCss({ dense: true, marginMm: 10, orientation })}
  </style></head><body>${pagesHtml}</body></html>`;
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
    return () => {
      mounted = false;
    };
  }, [dateFrom, dateTo, demoMode, session.workspace]);

  const cards = summary
    ? [
        { label: 'นักเรียนในขอบเขต', value: summary.student_count.toLocaleString('th-TH'), detail: `${summary.classroom_count} ห้องเรียน` },
        { label: 'มาเรียน', value: `${Number(summary.attendance.present_rate).toLocaleString('th-TH')}%`, detail: `${summary.attendance.present + summary.attendance.late}/${summary.attendance.total} รายการ` },
        { label: 'คะแนนเฉลี่ย', value: `${Number(summary.scores.average_percent).toLocaleString('th-TH')}%`, detail: `${summary.scores.assessment_count} แบบประเมิน` },
        { label: 'เงินออมรวม', value: `${Number(summary.savings.total_balance).toLocaleString('th-TH')} บาท`, detail: `${summary.savings.account_count} บัญชี` },
      ]
    : [];

  return (
    <main className="app-page space-y-5">
      <section className="nexus-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="bg-slate-950 p-5 text-white sm:p-7">
            <span className="inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-lime-900">
              <ShieldCheck size={16} aria-hidden="true" /> Viewer Report
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight !text-white sm:text-5xl">รายงานสรุปสำหรับผู้บริหาร</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 !text-slate-300">
              แสดงเฉพาะข้อมูลรวมของห้องเรียนที่ได้รับสิทธิ์ ไม่เปิดรายชื่อนักเรียน เลขประจำตัว หรือรายละเอียดสุขภาพรายบุคคล
            </p>
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
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ตั้งแต่วันที่
            <ThaiDatePicker onValueChange={setDateFrom} value={dateFrom} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ถึงวันที่
            <ThaiDatePicker onValueChange={setDateTo} value={dateTo} />
          </label>
        </div>
      </section>

      {loading ? <section className="app-panel-pad text-sm font-bold text-slate-600">กำลังรวบรวมรายงานที่ได้รับสิทธิ์…</section> : null}
      {notice ? (
        <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
          <AlertTriangle className="shrink-0" size={18} aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <article className="app-panel-pad" key={card.label}>
                <p className="text-xs font-black text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">{card.detail}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="app-panel-pad">
              <h2 className="text-xl font-black">เวลาเรียน</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ['ขาด', summary.attendance.absent],
                  ['สาย', summary.attendance.late],
                  ['ลา/ป่วย', summary.attendance.leave + summary.attendance.sick],
                ].map(([label, value]) => (
                  <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black">{value}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="app-panel-pad">
              <h2 className="text-xl font-black">การดูแลนักเรียน</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ['พฤติกรรม', summary.behavior.record_count],
                  ['สุขภาพ', summary.health.record_count],
                  ['เยี่ยมบ้านแล้ว', summary.home_visits.completed],
                ].map(([label, value]) => (
                  <div className="rounded-2xl bg-slate-50 p-3" key={label}>
                    <p className="text-xs font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-black">{value}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}

function findBestDefaultClassroomId(
  classrooms: ClassroomRow[],
  workspaceClassroomName?: string | null,
  workspaceName?: string | null,
): string {
  if (classrooms.length === 0) return '';
  const hint = String(workspaceClassroomName || workspaceName || '').trim();
  if (hint) {
    const exact = classrooms.find((c) => c.name.trim() === hint);
    if (exact) return exact.id;
    // Match grade pattern e.g. ป.5 or ม.1
    const gradeMatch = hint.match(/(ป\.\s*\d+|ม\.\s*\d+|ประถมศึกษาปีที่\s*\d+|มัธยมศึกษาปีที่\s*\d+)/);
    if (gradeMatch) {
      const token = gradeMatch[1].replace(/\s+/g, '');
      const matched = classrooms.find((c) => c.name.replace(/\s+/g, '').includes(token));
      if (matched) return matched.id;
    }
    const partial = classrooms.find((c) => hint.includes(c.name) || c.name.includes(hint));
    if (partial) return partial.id;
  }
  return classrooms[0].id;
}

function TeacherReportsPage({ session }: ReportsPageProps) {
  const demoMode = isDemoSession(session);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const reportViewParam = searchParams.get('reportView');
  const reportPeriodParam = searchParams.get('reportPeriod');
  const reportMonthParam = searchParams.get('reportMonth');
  const initialReportView: ReportView = isReportView(reportViewParam) ? reportViewParam : 'attendance';
  const initialReportPeriod: ReportPeriod = isReportPeriod(reportPeriodParam) ? reportPeriodParam : 'month';
  const initialReportMonth = reportMonthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonthParam)
    ? reportMonthParam
    : getTodayDate().slice(0, 7);

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionRow[]>(demoMode ? demoSessions : []);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordRow[]>(demoMode ? demoRecords : []);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccountRow[]>(demoMode ? demoSavingsAccounts : []);
  const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransactionRow[]>(demoMode ? demoSavingsTransactions : []);
  const [scoreAssessments, setScoreAssessments] = useState<ScoreAssessmentRow[]>(demoMode ? demoScoreAssessments : []);
  const [scoreEntries, setScoreEntries] = useState<ScoreEntryRow[]>(demoMode ? demoScoreEntries : []);
  const [behaviorRecords, setBehaviorRecords] = useState<BehaviorRecordRow[]>(demoMode ? demoBehaviorRecords : []);
  const [homeVisits, setHomeVisits] = useState<HomeVisitReportRow[]>(demoMode ? demoHomeVisits : []);
  const [healthRecords, setHealthRecords] = useState<StudentHealthRecordRow[]>(demoMode ? demoHealthRecords : []);
  const [allGrowthRecords, setAllGrowthRecords] = useState<StudentHealthRecordRow[]>(demoMode ? demoHealthRecords.filter((r) => r.record_type === 'growth') : []);
  const [guardians, setGuardians] = useState<StudentGuardianReportRow[]>(demoMode ? demoGuardians : []);

  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [reportView, setReportView] = useState<ReportView>(initialReportView);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>(initialReportPeriod);
  const [reportMonth, setReportMonth] = useState(initialReportMonth);
  const [selectedTerm, setSelectedTerm] = useState<TermKey>('term1');
  const [termRanges, setTermRanges] = useState<ReportTermRanges>(() =>
    loadReportTermRanges(session.workspace?.id, session.workspace?.academicYear),
  );
  const [reportIdentity, setReportIdentity] = useState<SchoolReportIdentity>(() =>
    loadSchoolReportIdentity(session.workspace?.id),
  );

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [behaviorStudentFilter, setBehaviorStudentFilter] = useState<string>('all');
  const [executiveScope, setExecutiveScope] = useState<ExecutiveScope>('classroom');
  const [isOfficialDocsOpen, setIsOfficialDocsOpen] = useState(false);

  const initialMonthRange = getMonthDateRange(getTodayDate().slice(0, 7));
  const [dateFrom, setDateFrom] = useState(initialMonthRange.from);
  const [dateTo, setDateTo] = useState(initialMonthRange.to);
  const [query, setQuery] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState('');
  const [pageOrientation, setPageOrientation] = useState<OfficialReportOrientation>(
    () => reportViews.find((v) => v.value === initialReportView)?.defaultOrientation || 'landscape',
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'a4',
  );
  const [registerFields, setRegisterFields] = useState<RegisterFieldSelection>({
    address: false,
    citizenId: false,
    family: true,
    health: true,
  });
  const [revealCitizenIds, setRevealCitizenIds] = useState(false);
  const [individualSections, setIndividualSections] = useState<IndividualReportSectionSelection>(() =>
    loadIndividualReportSections(session.workspace?.id),
  );
  const [individualTeacherComment, setIndividualTeacherComment] = useState<string>(defaultIndividualTeacherComment);

  const updateIndividualSections = (next: IndividualReportSectionSelection) => {
    setIndividualSections(next);
    saveIndividualReportSections(next, session.workspace?.id);
  };

  const toggleIndividualSection = (key: IndividualReportSectionKey) => {
    const next = { ...individualSections, [key]: !individualSections[key] };
    if (!Object.values(next).some(Boolean)) {
      setNotice('กรุณาเลือกข้อมูลอย่างน้อย 1 หัวข้อเพื่อแสดงในใบรายงานรายบุคคล');
      return;
    }
    updateIndividualSections(next);
  };

  const activeIndividualSectionCount = useMemo(
    () => Object.values(individualSections).filter(Boolean).length,
    [individualSections],
  );
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อออกรายงานจาก Supabase จริง',
  );

  // Sync orientation default when switching reportView
  useEffect(() => {
    const cfg = reportViews.find((item) => item.value === reportView);
    if (cfg) {
      setPageOrientation(cfg.defaultOrientation);
    }
  }, [reportView]);

  // Load workspace identity and saved term ranges from Supabase
  useEffect(() => {
    let mounted = true;
    async function loadWorkspaceIdentityAndRanges() {
      if (!supabase || !session.workspace || demoMode) return;
      const { data, error } = await supabase
        .from('workspaces')
        .select('school_name,academic_year,settings')
        .eq('id', session.workspace.id)
        .maybeSingle();
      if (!mounted || error || !data) return;
      const settings = (data.settings || {}) as {
        classroom_name?: string;
        report_identity?: Partial<SchoolReportIdentity>;
        report_term_ranges?: Partial<ReportTermRanges>;
      };
      const identity: SchoolReportIdentity = {
        ...loadSchoolReportIdentity(session.workspace.id),
        ...(settings.report_identity || {}),
        academicYear: data.academic_year || session.workspace.academicYear,
        classroomName: settings.classroom_name || session.workspace.classroomName,
        schoolName: data.school_name || session.workspace.schoolName,
      };
      setReportIdentity(identity);
      saveSchoolReportIdentity(identity, session.workspace.id);

      if (settings.report_term_ranges?.term1 && settings.report_term_ranges?.term2) {
        const loadedRanges: ReportTermRanges = {
          term1: {
            start: settings.report_term_ranges.term1.start || termRanges.term1.start,
            end: settings.report_term_ranges.term1.end || termRanges.term1.end,
          },
          term2: {
            start: settings.report_term_ranges.term2.start || termRanges.term2.start,
            end: settings.report_term_ranges.term2.end || termRanges.term2.end,
          },
        };
        setTermRanges(loadedRanges);
        saveReportTermRanges(loadedRanges, session.workspace.id);
      }
    }
    void loadWorkspaceIdentityAndRanges();
    return () => {
      mounted = false;
    };
  }, [demoMode, session.workspace]);

  useEffect(() => {
    const nextView = searchParams.get('reportView');
    const nextPeriod = searchParams.get('reportPeriod');
    const nextMonth = searchParams.get('reportMonth');
    if (isReportView(nextView)) setReportView(nextView);
    if (isReportPeriod(nextPeriod)) setReportPeriod(nextPeriod);
    if (nextMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth)) setReportMonth(nextMonth);
  }, [searchParams]);

  useEffect(() => {
    const requestedClassroomId = searchParams.get('classroomId');
    if (requestedClassroomId && classrooms.some((classroom) => classroom.id === requestedClassroomId)) {
      setClassroomId(requestedClassroomId);
    }
  }, [classrooms, searchParams]);

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

  // Update dateFrom & dateTo whenever reportPeriod, reportMonth, selectedTerm, or termRanges change
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

    const academicYear =
      classrooms.find((classroom) => classroom.id === classroomId)?.academic_year || session.workspace?.academicYear;
    const startYear = academicYearToGregorianStart(academicYear);
    setDateFrom(`${startYear}-05-01`);
    setDateTo(`${startYear + 1}-04-30`);
  }, [classroomId, classrooms, reportMonth, reportPeriod, selectedTerm, session.workspace?.academicYear, termRanges]);

  // Fetch data from Supabase
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
        setAllGrowthRecords(demoHealthRecords.filter((r) => r.record_type === 'growth'));
        setGuardians(demoGuardians);
        setClassroomId((curr) => curr || demoClassrooms[0].id);
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
          .order('attendance_date', { ascending: false })
          .limit(3000),
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
          .in('session_id', sessionIds)
          .limit(10000);

        if (!isMounted) return;

        if (recordError) {
          setNotice(recordError.message);
        } else {
          nextRecords = (recordRows || []) as AttendanceRecordRow[];
        }
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      setClassrooms(nextClassrooms);
      setStudents((studentRows || []) as StudentRow[]);
      setAttendanceSessions(nextSessions);
      setAttendanceRecords(nextRecords);
      setClassroomId((current) =>
        current && nextClassrooms.some((classroom) => classroom.id === current)
          ? current
          : findBestDefaultClassroomId(nextClassrooms, session.workspace?.classroomName, session.workspace?.name),
      );

      // Note: score_assessments and growth records are loaded for the workspace so that
      // assessments created earlier in the semester or growth measured at term start never disappear!
      const [
        { data: assessmentRows, error: assessmentError },
        { data: accountRows, error: accountError },
        { data: transactionRows, error: transactionError },
        { data: behaviorRows, error: behaviorError },
        { data: homeVisitRows, error: homeVisitError },
        { data: healthRows, error: healthError },
        { data: latestGrowthRows },
        { data: guardianRows, error: guardianError },
      ] = await Promise.all([
        supabase
          .from('score_assessments')
          .select('id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status')
          .eq('workspace_id', session.workspace.id)
          .order('assessment_date', { ascending: false })
          .limit(1000),
        supabase
          .from('savings_accounts')
          .select('id,student_id,balance,status')
          .eq('workspace_id', session.workspace.id)
          .limit(2000),
        supabase
          .from('savings_transactions')
          .select('id,student_id,transaction_type,amount,transaction_date,note,created_at')
          .eq('workspace_id', session.workspace.id)
          .gte('transaction_date', dateFrom)
          .lte('transaction_date', dateTo)
          .order('transaction_date', { ascending: false })
          .limit(3000),
        supabase
          .from('behavior_records')
          .select('id,student_id,tone,category,description,points,follow_up_status,behavior_date,created_at')
          .eq('workspace_id', session.workspace.id)
          .gte('behavior_date', dateFrom)
          .lte('behavior_date', dateTo)
          .order('behavior_date', { ascending: false })
          .limit(2000),
        supabase
          .from('student_home_visits')
          .select('id,student_id,academic_year,term,status,completion_percent,visited_at')
          .eq('workspace_id', session.workspace.id)
          .limit(2000),
        supabase
          .from('student_health_records')
          .select('id,student_id,record_date,record_type,status,weight_kg,height_cm,bmi,inspection_results,note')
          .eq('workspace_id', session.workspace.id)
          .gte('record_date', dateFrom)
          .lte('record_date', dateTo)
          .order('record_date', { ascending: false })
          .limit(5000),
        supabase
          .from('student_health_records')
          .select('id,student_id,record_date,record_type,status,weight_kg,height_cm,bmi,inspection_results,note')
          .eq('workspace_id', session.workspace.id)
          .eq('record_type', 'growth')
          .order('record_date', { ascending: false })
          .limit(2000),
        supabase
          .from('student_guardians')
          .select('student_id,display_name,relation,phone,is_primary')
          .eq('workspace_id', session.workspace.id)
          .order('is_primary', { ascending: false })
          .limit(3000),
      ]);

      if (!isMounted) return;

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
          .in('assessment_id', nextAssessmentIds)
          .limit(10000);

        if (!isMounted) return;

        if (entryError) {
          setNotice(entryError.message);
        } else {
          nextScoreEntries = (entryRows || []) as ScoreEntryRow[];
        }
      }

      setScoreAssessments(nextAssessments);
      setScoreEntries(nextScoreEntries);
      setSavingsAccounts((accountRows || []) as SavingsAccountRow[]);
      setSavingsTransactions((transactionRows || []) as SavingsTransactionRow[]);
      setBehaviorRecords((behaviorRows || []) as BehaviorRecordRow[]);
      setHomeVisits((homeVisitRows || []) as HomeVisitReportRow[]);
      setHealthRecords((healthRows || []) as StudentHealthRecordRow[]);
      setAllGrowthRecords((latestGrowthRows || []) as StudentHealthRecordRow[]);
      setGuardians((guardianRows || []) as StudentGuardianReportRow[]);
      setIsLoading(false);
    }

    void loadReportData();

    return () => {
      isMounted = false;
    };
  }, [dateFrom, dateTo, demoMode, session.workspace]);

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === classroomId) || classrooms[0] || null,
    [classroomId, classrooms],
  );

  const allClassroomStudents = useMemo(
    () => students.filter((student) => !selectedClassroom || student.classroom_id === selectedClassroom.id),
    [selectedClassroom, students],
  );

  // Filtered students by search query (`query` works across EVERY report view!)
  const classroomStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allClassroomStudents;
    return allClassroomStudents.filter((s) =>
      [s.student_code, s.first_name, s.last_name, s.nickname, getStudentFullName(s)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [allClassroomStudents, query]);

  const classroomStudentIds = useMemo(
    () => new Set(classroomStudents.map((student) => student.id)),
    [classroomStudents],
  );
  const allClassroomStudentIds = useMemo(
    () => new Set(allClassroomStudents.map((student) => student.id)),
    [allClassroomStudents],
  );
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const savingsAccountByStudent = useMemo(
    () => new Map(savingsAccounts.map((account) => [account.student_id, account])),
    [savingsAccounts],
  );

  const selectedStudent = useMemo(
    () =>
      allClassroomStudents.find((student) => student.id === selectedStudentId) ||
      allClassroomStudents[0] ||
      students[0] ||
      null,
    [allClassroomStudents, selectedStudentId, students],
  );

  useEffect(() => {
    if (!selectedStudentId && allClassroomStudents[0]) {
      setSelectedStudentId(allClassroomStudents[0].id);
      return;
    }
    if (selectedStudentId && !allClassroomStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(allClassroomStudents[0]?.id || '');
    }
  }, [allClassroomStudents, selectedStudentId]);

  const subjectOptions = useMemo(
    () =>
      Array.from(
        new Set(
          attendanceSessions
            .filter((s) => !selectedClassroom || s.classroom_id === selectedClassroom.id)
            .map((item) => item.subject_name)
            .filter((item): item is string => Boolean(item) && item !== 'โฮมรูม'),
        ),
      ).sort(),
    [attendanceSessions, selectedClassroom],
  );

  const periodOptions = useMemo(
    () =>
      Array.from(
        new Set(
          attendanceSessions
            .filter((s) => !selectedClassroom || s.classroom_id === selectedClassroom.id)
            .map((item) => item.period_label)
            .filter(Boolean),
        ),
      ).sort(),
    [attendanceSessions, selectedClassroom],
  );

  // Classroom score assessments: include all active assessments for this classroom
  const classroomScoreAssessments = useMemo(() => {
    const roomAssessments = scoreAssessments.filter(
      (assessment) =>
        (!selectedClassroom || assessment.classroom_id === selectedClassroom.id) &&
        assessment.status !== 'archived',
    );
    const inDateRange = roomAssessments.filter(
      (a) => a.assessment_date >= dateFrom && a.assessment_date <= dateTo,
    );
    // If the teacher is in 'month' mode and didn't create assessments in this exact calendar month,
    // fall back to all classroom assessments so the score report is never blank!
    return inDateRange.length > 0 ? inDateRange : roomAssessments;
  }, [dateFrom, dateTo, scoreAssessments, selectedClassroom]);

  const scoreSubjectOptions = useMemo(
    () => Array.from(new Set(classroomScoreAssessments.map((item) => item.subject_name).filter(Boolean))).sort(),
    [classroomScoreAssessments],
  );

  // Automatically select first subject when switching to subject-attendance or subject-scores
  useEffect(() => {
    if (reportView === 'subject-attendance') {
      if (!selectedSubjectName || !subjectOptions.includes(selectedSubjectName)) {
        setSelectedSubjectName(subjectOptions[0] || '');
      }
      if (selectedPeriodLabel && !periodOptions.includes(selectedPeriodLabel)) {
        setSelectedPeriodLabel('');
      }
    } else if (reportView === 'subject-scores') {
      if (!selectedSubjectName || !scoreSubjectOptions.includes(selectedSubjectName)) {
        setSelectedSubjectName(scoreSubjectOptions[0] || '');
      }
    }
  }, [periodOptions, reportView, scoreSubjectOptions, selectedPeriodLabel, selectedSubjectName, subjectOptions]);

  const dailyAttendanceGrid = useMemo(
    () =>
      buildAttendanceGrid({
        attendanceRecords,
        attendanceSessions,
        classroom: selectedClassroom,
        dateFrom,
        dateTo,
        sessionKind: 'daily',
        students: classroomStudents,
      }),
    [attendanceRecords, attendanceSessions, classroomStudents, dateFrom, dateTo, selectedClassroom],
  );

  const subjectAttendanceGrid = useMemo(
    () =>
      buildAttendanceGrid({
        attendanceRecords,
        attendanceSessions,
        classroom: selectedClassroom,
        dateFrom,
        dateTo,
        periodLabel: selectedPeriodLabel || undefined,
        sessionKind: 'subject',
        students: classroomStudents,
        subjectName: selectedSubjectName || undefined,
      }),
    [attendanceRecords, attendanceSessions, classroomStudents, dateFrom, dateTo, selectedClassroom, selectedPeriodLabel, selectedSubjectName],
  );

  const activeAttendanceGrid = reportView === 'subject-attendance' ? subjectAttendanceGrid : dailyAttendanceGrid;

  const savingsGrid = useMemo(
    () =>
      buildSavingsGrid({
        classroom: selectedClassroom,
        dateFrom,
        dateTo,
        savingsAccounts,
        savingsTransactions,
        students: classroomStudents,
      }),
    [classroomStudents, dateFrom, dateTo, savingsAccounts, savingsTransactions, selectedClassroom],
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
        const entries = (scoreEntriesByAssessment.get(assessment.id) || []).filter((entry) =>
          allClassroomStudentIds.has(entry.student_id),
        );
        const enteredEntries = entries.filter(
          (entry) => entry.score !== null && entry.score !== undefined && !Number.isNaN(Number(entry.score)),
        );
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
          missingCount: Math.max(allClassroomStudents.length - enteredEntries.length, 0),
        };
      }),
    [allClassroomStudentIds, allClassroomStudents.length, classroomScoreAssessments, scoreEntriesByAssessment],
  );

  // Student cross-subject gradebook matrix for `scores` view
  const studentCrossSubjectRows = useMemo(() => {
    return classroomStudents.map((student) => {
      const bySubject: Record<string, { earned: number; grade: number | string; max: number; missing: number; percent: number }> = {};
      let totalMissing = 0;

      scoreSubjectOptions.forEach((subject) => {
        const subAssessments = classroomScoreAssessments.filter((a) => a.subject_name === subject);
        let earned = 0;
        let max = 0;
        let hasScore = false;
        let missing = 0;

        subAssessments.forEach((asm) => {
          const entry = (scoreEntriesByAssessment.get(asm.id) || []).find((e) => e.student_id === student.id);
          const val = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : NaN;
          if (!Number.isNaN(val)) {
            earned += val;
            max += Number(asm.max_score || 0);
            hasScore = true;
          } else {
            missing += 1;
            totalMissing += 1;
          }
        });

        const pct = hasScore && max > 0 ? Math.min(100, round((earned / max) * 100)) : 0;
        const grade = hasScore && max > 0 ? calculateOBECGrade(pct).grade : '-';
        bySubject[subject] = { earned: round(earned), grade, max: round(max), missing, percent: pct };
      });

      const numericGrades = Object.values(bySubject)
        .map((s) => s.grade)
        .filter((g): g is number => typeof g === 'number');
      const gpa =
        numericGrades.length > 0
          ? (numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length).toFixed(2)
          : '-';

      return {
        bySubject,
        gpa,
        student,
        studentCode: student.student_code || '-',
        studentName: getStudentFullName(student),
        totalMissing,
      };
    });
  }, [classroomScoreAssessments, classroomStudents, scoreEntriesByAssessment, scoreSubjectOptions]);

  const classroomHealthRecords = useMemo(
    () => healthRecords.filter((record) => classroomStudentIds.has(record.student_id)),
    [classroomStudentIds, healthRecords],
  );

  const healthSummaryRows = useMemo(
    () =>
      classroomStudents.map((student) => {
        const records = classroomHealthRecords.filter((record) => record.student_id === student.id);
        const summarizeRoutine = (recordType: HealthRecordType) => {
          const routineRecords = records.filter((record) => record.record_type === recordType);
          return {
            completed: routineRecords.filter((record) => record.status === 'completed').length,
            total: routineRecords.filter((record) => record.status !== 'exempt' && record.status !== 'not_checked').length,
          };
        };

        // Fallback to allGrowthRecords (from any month) or student.health_flags so weight/height never disappears!
        const latestGrowthInPeriod = records.find(
          (record) => record.record_type === 'growth' && (record.weight_kg !== null || record.height_cm !== null),
        );
        const latestGrowthOverall =
          latestGrowthInPeriod ||
          allGrowthRecords.find(
            (record) => record.student_id === student.id && (record.weight_kg !== null || record.height_cm !== null),
          ) ||
          null;

        const flags = asReportRecord(student.health_flags);
        const weightVal = latestGrowthOverall?.weight_kg ?? (flags.weight_kg as number | string | undefined) ?? null;
        const heightVal = latestGrowthOverall?.height_cm ?? (flags.height_cm as number | string | undefined) ?? null;
        const weightNum = weightVal !== null && weightVal !== '' && !Number.isNaN(Number(weightVal)) ? Number(weightVal) : null;
        const heightNum = heightVal !== null && heightVal !== '' && !Number.isNaN(Number(heightVal)) ? Number(heightVal) : null;
        const computedBmi =
          latestGrowthOverall?.bmi !== null && latestGrowthOverall?.bmi !== undefined && !Number.isNaN(Number(latestGrowthOverall.bmi))
            ? round(Number(latestGrowthOverall.bmi))
            : weightNum && heightNum && heightNum > 0
              ? round(weightNum / ((heightNum / 100) * (heightNum / 100)))
              : null;

        const latestHygiene = records.find((record) => record.record_type === 'hygiene') || null;
        const attentionItems = Object.entries(latestHygiene?.inspection_results || {})
          .filter(([, status]) => status === 'attention')
          .map(
            ([key]) =>
              ({ hair: 'ผม', nails: 'เล็บ', skin: 'ผิวหนัง', teeth: 'ฟัน', uniform: 'เครื่องแต่งกาย', ears: 'หู', eyes: 'ตา' })[
                key
              ] || key,
          );

        return {
          attentionItems,
          bmi: computedBmi,
          brushing: summarizeRoutine('toothbrushing'),
          heightCm: heightNum,
          latestGrowthDate: latestGrowthOverall?.record_date || null,
          latestHygiene,
          lunch: summarizeRoutine('lunch'),
          milk: summarizeRoutine('milk'),
          student,
          weightKg: weightNum,
        };
      }),
    [allGrowthRecords, classroomHealthRecords, classroomStudents],
  );

  const registerHealthRows = useMemo<StudentRegisterHealthRow[]>(
    () =>
      healthSummaryRows.map((row) => ({
        heightCm: row.heightCm,
        recordDate: row.latestGrowthDate,
        studentId: row.student.id,
        weightKg: row.weightKg,
      })),
    [healthSummaryRows],
  );

  const classroomGuardians = useMemo(
    () => guardians.filter((guardian) => allClassroomStudentIds.has(guardian.student_id)),
    [allClassroomStudentIds, guardians],
  );

  const activeRegisterFields = useMemo(
    () => registerFieldOptions.filter((field) => registerFields[field.value]).map((field) => field.value),
    [registerFields],
  );

  const behaviorReportRows = useMemo(
    () =>
      behaviorRecords
        .filter((record) => classroomStudentIds.has(record.student_id))
        .filter((record) => behaviorStudentFilter === 'all' || record.student_id === behaviorStudentFilter),
    [behaviorRecords, behaviorStudentFilter, classroomStudentIds],
  );

  // Consistent Classroom KPI Metrics (for top cards and executive summary)
  const classroomKpiMetrics = useMemo(() => {
    const totalAtt =
      dailyAttendanceGrid.summary.present +
      dailyAttendanceGrid.summary.late +
      dailyAttendanceGrid.summary.leave +
      dailyAttendanceGrid.summary.absent;
    const attended = dailyAttendanceGrid.summary.present + dailyAttendanceGrid.summary.late;
    const presentRate = totalAtt > 0 ? round((attended / totalAtt) * 100) : 100;
    const riskCount = dailyAttendanceGrid.rows.filter((r) => r.attendancePercent < 80).length;

    const scoredAssessmentRows = scoreAssessmentRows.filter((r) => r.enteredCount > 0);
    const avgScore =
      scoredAssessmentRows.length > 0
        ? round(scoredAssessmentRows.reduce((sum, r) => sum + r.averagePercent, 0) / scoredAssessmentRows.length)
        : 0;

    const routineRecords = classroomHealthRecords.filter((record) =>
      ['toothbrushing', 'milk', 'lunch'].includes(record.record_type),
    );
    const routineCount = routineRecords.filter((record) => record.status !== 'exempt' && record.status !== 'not_checked').length;
    const completedCount = routineRecords.filter((record) => record.status === 'completed').length;
    const healthCompletionRate = routineCount > 0 ? round((completedCount / routineCount) * 100) : 100;
    const healthFollowUps = healthSummaryRows.filter(
      (row) => row.attentionItems.length > 0 || row.latestHygiene?.status === 'attention',
    ).length;

    const roomBehaviors = behaviorRecords.filter((r) => allClassroomStudentIds.has(r.student_id));
    const behaviorFollowUps = roomBehaviors.filter(
      (r) => r.follow_up_status && !['none', 'resolved'].includes(r.follow_up_status),
    ).length;
    const positiveBehaviors = roomBehaviors.filter((r) => r.tone === 'positive').length;
    const behaviorPoints = roomBehaviors.reduce((sum, r) => sum + Number(r.points || 0), 0);

    return {
      attendance: { presentRate, riskCount, total: totalAtt },
      behavior: { followUps: behaviorFollowUps, positiveCount: positiveBehaviors, totalPoints: behaviorPoints },
      health: { completionRate: healthCompletionRate, followUps: healthFollowUps },
      savings: {
        activeCount: savingsGrid.totalActiveSavingsStudents,
        periodNet: savingsGrid.totalPeriodNet,
        totalBalance: savingsGrid.totalCumulativeBalance,
      },
      scores: {
        assessmentCount: scoreAssessmentRows.length,
        averagePercent: avgScore,
      },
    };
  }, [
    allClassroomStudentIds,
    behaviorRecords,
    classroomHealthRecords,
    dailyAttendanceGrid,
    healthSummaryRows,
    savingsGrid,
    scoreAssessmentRows,
  ]);

  const executiveMetrics = useMemo<ExecutiveReportMetrics>(() => {
    if (executiveScope === 'classroom') {
      return {
        attendanceRate: classroomKpiMetrics.attendance.presentRate,
        behaviorFollowUps: classroomKpiMetrics.behavior.followUps,
        classroomCount: 1,
        healthCompletionRate: classroomKpiMetrics.health.completionRate,
        healthFollowUps: classroomKpiMetrics.health.followUps,
        savingsTotal: classroomKpiMetrics.savings.totalBalance,
        scoreAverage: classroomKpiMetrics.scores.averagePercent,
        scopeLabel: `ชั้น ${selectedClassroom?.name || '-'}`,
        studentCount: allClassroomStudents.length,
      };
    }

    // Whole-school scope
    const totalAtt = attendanceRecords.length;
    const presentAtt = attendanceRecords.filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'activity').length;
    const schoolAttRate = totalAtt > 0 ? round((presentAtt / totalAtt) * 100) : 100;

    const assessmentMap = new Map(scoreAssessments.map((a) => [a.id, Number(a.max_score || 0)]));
    const validScorePcts = scoreEntries
      .map((e) => {
        const max = assessmentMap.get(e.assessment_id) || 0;
        const val = e.score !== null && e.score !== undefined ? Number(e.score) : NaN;
        return max > 0 && !Number.isNaN(val) ? (val / max) * 100 : null;
      })
      .filter((v): v is number => v !== null);
    const schoolScoreAvg =
      validScorePcts.length > 0 ? round(validScorePcts.reduce((s, v) => s + v, 0) / validScorePcts.length) : 0;

    const routineRecords = healthRecords.filter((record) => ['toothbrushing', 'milk', 'lunch'].includes(record.record_type));
    const routineCount = routineRecords.filter((record) => record.status !== 'exempt' && record.status !== 'not_checked').length;
    const completedCount = routineRecords.filter((record) => record.status === 'completed').length;
    const schoolHealthRate = routineCount > 0 ? round((completedCount / routineCount) * 100) : 100;
    const schoolHealthFollowUps = new Set(
      healthRecords.filter((r) => r.status === 'attention').map((r) => r.student_id),
    ).size;

    const schoolBehaviorFollowUps = behaviorRecords.filter(
      (r) => r.follow_up_status && !['none', 'resolved'].includes(r.follow_up_status),
    ).length;
    const schoolSavingsTotal = round(savingsAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0));

    return {
      attendanceRate: schoolAttRate,
      behaviorFollowUps: schoolBehaviorFollowUps,
      classroomCount: Math.max(1, classrooms.length),
      healthCompletionRate: schoolHealthRate,
      healthFollowUps: schoolHealthFollowUps,
      savingsTotal: schoolSavingsTotal,
      scoreAverage: schoolScoreAvg,
      scopeLabel: `รวมทุกห้องเรียน (${session.workspace?.schoolName || 'ทั้งโรงเรียน'})`,
      studentCount: students.length,
    };
  }, [
    allClassroomStudents.length,
    attendanceRecords,
    behaviorRecords,
    classroomKpiMetrics,
    classrooms.length,
    executiveScope,
    healthRecords,
    savingsAccounts,
    scoreAssessments,
    scoreEntries,
    selectedClassroom?.name,
    session.workspace?.schoolName,
    students.length,
  ]);

  // Build Individual Student Report bundle for any student in the classroom
  const buildStudentBundle = useMemo(() => {
    return (student: StudentRow): IndividualStudentReportBundle => {
      const attRow = dailyAttendanceGrid.rows.find((r) => r.student.id === student.id);
      const attendance = attRow
        ? {
            absent: attRow.totals.absent,
            late: attRow.totals.late,
            leave: attRow.totals.leave,
            percent: attRow.attendancePercent,
            present: attRow.totals.present,
            total: attRow.totals.present + attRow.totals.late + attRow.totals.leave + attRow.totals.absent,
          }
        : { absent: 0, late: 0, leave: 0, percent: 100, present: 0, total: 0 };

      const crossRow = studentCrossSubjectRows.find((r) => r.student.id === student.id);
      const subjectRows = scoreSubjectOptions.map((subject) => {
        const subData = crossRow?.bySubject[subject] || { earned: 0, grade: '-', max: 0, missing: 0, percent: 0 };
        return {
          earned: subData.earned,
          grade: subData.grade,
          max: subData.max,
          missing: subData.missing,
          percent: subData.percent,
          subject,
        };
      });

      const savRow = savingsGrid.rows.find((r) => r.student.id === student.id);
      const savings = {
        balance: savRow?.totalBalance ?? Number(savingsAccountByStudent.get(student.id)?.balance || 0),
        deposits: savRow?.depositsInPeriod ?? 0,
        txCount: savRow?.transactionCount ?? 0,
        withdrawals: savRow?.withdrawalsInPeriod ?? 0,
      };

      const hRow = healthSummaryRows.find((r) => r.student.id === student.id);
      const health = {
        attentionText: hRow && hRow.attentionItems.length > 0 ? `ต้องดูแล: ${hRow.attentionItems.join(', ')}` : 'ปกติ',
        bmi: hRow?.bmi ?? null,
        brushingText: hRow ? `${hRow.brushing.completed}/${hRow.brushing.total}` : '0/0',
        height: hRow?.heightCm ?? null,
        lunchText: hRow ? `${hRow.lunch.completed}/${hRow.lunch.total}` : '0/0',
        milkText: hRow ? `${hRow.milk.completed}/${hRow.milk.total}` : '0/0',
        weight: hRow?.weightKg ?? null,
      };

      const studentBehaviors = behaviorRecords.filter((r) => r.student_id === student.id);
      const homeVisit = homeVisits.find((v) => v.student_id === student.id && v.status !== 'archived') || null;
      const guardianText = getRegisterFamilyLines(student, classroomGuardians).join(' · ');

      return {
        attendance,
        behaviors: studentBehaviors,
        guardianText,
        health,
        homeVisit,
        savings,
        student,
        subjectRows,
        totalGpa: crossRow?.gpa || '-',
      };
    };
  }, [
    behaviorRecords,
    classroomGuardians,
    dailyAttendanceGrid.rows,
    healthSummaryRows,
    homeVisits,
    savingsAccountByStudent,
    savingsGrid.rows,
    scoreSubjectOptions,
    studentCrossSubjectRows,
  ]);

  const selectedStudentBundle = useMemo(
    () => (selectedStudent ? buildStudentBundle(selectedStudent) : null),
    [buildStudentBundle, selectedStudent],
  );

  const activeReportConfig = reportViews.find((item) => item.value === reportView) || reportViews[0];
  const periodLabel = reportPeriods.find((item) => item.value === reportPeriod)?.label || 'รายเดือน';
  const monthContext = useMemo(() => getReportMonthContext(dateFrom), [dateFrom]);
  const isMultiMonthMode = reportPeriod !== 'month' && activeAttendanceGrid.monthBuckets.length > 1;
  const printableReport = reportView !== 'settings';

  function buildActiveReportHtml(batchAllStudents = false) {
    const academicYear = selectedClassroom?.academic_year || reportIdentity.academicYear || '2569';
    const syncedIdentity: SchoolReportIdentity = {
      ...reportIdentity,
      academicYear,
    };
    const common = {
      dateFrom,
      dateTo,
      orientation: pageOrientation,
      reportIdentity: syncedIdentity,
      schoolName: syncedIdentity.schoolName || session.workspace?.schoolName || 'โรงเรียน',
      teacherName: syncedIdentity.teacherName || session.profile.displayName,
      workspaceName: selectedClassroom?.name || session.workspace?.classroomName || session.workspace?.name || 'ห้องเรียน',
    };

    if (reportView === 'savings') {
      return buildPrintableSavingsReportHtml({
        dateFrom,
        dateTo,
        orientation: pageOrientation,
        periodMode: reportPeriod,
        reportIdentity: syncedIdentity,
        savingsGrid,
        schoolName: common.schoolName,
        teacherName: common.teacherName,
        workspaceName: common.workspaceName,
      });
    }

    if (reportView === 'attendance') {
      return buildPrintableAttendanceHtml({
        attendanceGrid: dailyAttendanceGrid,
        dateFrom,
        dateTo,
        orientation: pageOrientation,
        periodMode: reportPeriod,
        reportIdentity: syncedIdentity,
        schoolName: common.schoolName,
        teacherName: common.teacherName,
        workspaceName: common.workspaceName,
      });
    }

    if (reportView === 'subject-attendance') {
      return buildPrintableAttendanceHtml({
        attendanceGrid: subjectAttendanceGrid,
        dateFrom,
        dateTo,
        orientation: pageOrientation,
        periodMode: reportPeriod,
        reportIdentity: syncedIdentity,
        schoolName: common.schoolName,
        subtitleOverride: `วิชา: ${selectedSubjectName || 'ทุกรายวิชา'} · คาบ: ${selectedPeriodLabel || 'ทุกคาบ'}`,
        teacherName: common.teacherName,
        titleOverride: `รายงานเวลาเรียนรายวิชา (${selectedSubjectName || 'รวมวิชา'}) ชั้น ${common.workspaceName}`,
        workspaceName: common.workspaceName,
      });
    }

    if (reportView === 'scores') {
      const cols = ['รหัส', 'ชื่อ - นามสกุล', ...scoreSubjectOptions.map((s) => `${s} (% / เกรด)`), 'เกรดเฉลี่ย (GPA)', 'งานค้าง'];
      const rows = studentCrossSubjectRows.map((row) => [
        row.studentCode,
        row.studentName,
        ...scoreSubjectOptions.map((sub) => {
          const sd = row.bySubject[sub];
          return sd && sd.max > 0 ? `${sd.percent}% (${sd.grade})` : '-';
        }),
        row.gpa,
        row.totalMissing > 0 ? `${row.totalMissing} งาน` : 'ครบ',
      ]);

      return buildPrintableTableReportHtml({
        ...common,
        columns: cols,
        documentPrefix: 'CC-SCO',
        kpiCards: [
          { label: 'นักเรียนในห้อง', value: `${classroomStudents.length} คน` },
          { label: 'จำนวนรายวิชา', value: `${scoreSubjectOptions.length} วิชา` },
          { label: 'จำนวนชุดคะแนน', value: `${scoreAssessmentRows.length} ชุด` },
          { label: 'คะแนนเฉลี่ยรวม', value: `${classroomKpiMetrics.scores.averagePercent}%` },
        ],
        rows,
        subtitle: `ตารางสรุปผลสัมฤทธิ์ทางการเรียนรวมทุกวิชา (${scoreSubjectOptions.length} รายวิชา · ${scoreAssessmentRows.length} ชุดคะแนน)`,
        title: `รายงานสรุปคะแนนรวมทุกวิชา ชั้น ${common.workspaceName}`,
      });
    }

    if (reportView === 'subject-scores') {
      const assessments = classroomScoreAssessments.filter((a) => !selectedSubjectName || a.subject_name === selectedSubjectName);
      const totalMaxScore = assessments.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
      const cols = [
        'รหัส',
        'ชื่อ - นามสกุล',
        ...assessments.map((a) => `${a.title} (${a.max_score})`),
        `รวม (${totalMaxScore})`,
        'ร้อยละ',
        'เกรด',
        'งานค้าง',
      ];
      const rows = classroomStudents.map((student) => {
        let totalScore = 0;
        let missingCount = 0;
        const scoreCells = assessments.map((a) => {
          const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
          const val = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : NaN;
          if (!Number.isNaN(val)) {
            totalScore += val;
            return val;
          }
          missingCount += 1;
          return '-';
        });
        const pct = totalMaxScore > 0 ? Math.min(100, round((totalScore / totalMaxScore) * 100)) : 0;
        const grade = assessments.length > 0 && missingCount < assessments.length && totalMaxScore > 0 ? calculateOBECGrade(pct).grade : '-';
        return [
          student.student_code || '-',
          getStudentFullName(student),
          ...scoreCells,
          round(totalScore),
          `${pct}%`,
          grade,
          missingCount > 0 ? `${missingCount} ช่อง` : 'ครบ',
        ];
      });

      return buildPrintableTableReportHtml({
        ...common,
        columns: cols,
        documentPrefix: 'CC-SSC',
        kpiCards: [
          { label: 'รายวิชา', value: selectedSubjectName || 'ทั้งหมด' },
          { label: 'จำนวนชุดคะแนน', value: `${assessments.length} ชุด` },
          { label: 'คะแนนเต็มรวม', value: `${totalMaxScore} คะแนน` },
          { label: 'นักเรียนทั้งหมด', value: `${classroomStudents.length} คน` },
        ],
        rows,
        subtitle: `รายวิชา: ${selectedSubjectName || '-'} · คะแนนเต็มรวม ${totalMaxScore} คะแนน`,
        title: `ตารางคะแนนเก็บและงานค้างรายวิชา ${selectedSubjectName || ''}`,
      });
    }

    if (reportView === 'health') {
      return buildPrintableTableReportHtml({
        ...common,
        columns: ['รหัส', 'ชื่อ - นามสกุล', 'น้ำหนัก', 'ส่วนสูง', 'BMI', 'แปรงฟัน', 'ดื่มนม', 'อาหารกลางวัน', 'ตรวจสุขอนามัย', 'จุดต้องติดตาม'],
        documentPrefix: 'CC-HLT',
        kpiCards: [
          { label: 'นักเรียนทั้งหมด', value: `${healthSummaryRows.length} คน` },
          { label: 'วัดน้ำหนัก/ส่วนสูงแล้ว', value: `${healthSummaryRows.filter((r) => r.weightKg && r.heightCm).length} คน` },
          { label: 'ทำกิจวัตรสำเร็จ', value: `${classroomKpiMetrics.health.completionRate}%` },
          { label: 'ต้องติดตามสุขอนามัย', value: `${classroomKpiMetrics.health.followUps} คน` },
        ],
        rows: healthSummaryRows.map((row) => [
          row.student.student_code || '-',
          getStudentFullName(row.student),
          row.weightKg ? `${row.weightKg} กก.` : '-',
          row.heightCm ? `${row.heightCm} ซม.` : '-',
          row.bmi ?? '-',
          `${row.brushing.completed}/${row.brushing.total}`,
          `${row.milk.completed}/${row.milk.total}`,
          `${row.lunch.completed}/${row.lunch.total}`,
          formatThaiOfficialShortDate(row.latestHygiene?.record_date),
          row.attentionItems.join(', ') || row.latestHygiene?.note || 'ปกติ',
        ]),
        subtitle: `${periodLabel} · ข้อมูลการเจริญเติบโตและกิจวัตรประจำวันของนักเรียน`,
        title: `รายงานสุขภาพและกิจวัตรนักเรียน ชั้น ${common.workspaceName}`,
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
        orientation: pageOrientation,
        reportIdentity: syncedIdentity,
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
        orientation: pageOrientation,
        reportIdentity: syncedIdentity,
        schoolName: common.schoolName,
        teacherName: common.teacherName,
      });
    }

    if (reportView === 'behavior') {
      return buildPrintableTableReportHtml({
        ...common,
        columns: ['วันที่', 'รหัส', 'ชื่อ - นามสกุล', 'ประเภท', 'หมวดหมู่', 'คะแนน', 'สถานะติดตาม', 'รายละเอียดการดูแล'],
        documentPrefix: 'CC-BHV',
        kpiCards: [
          { label: 'บันทึกในช่วงนี้', value: `${behaviorReportRows.length} รายการ` },
          { label: 'ชื่นชม/เชิงบวก', value: `${classroomKpiMetrics.behavior.positiveCount} รายการ` },
          { label: 'เคสต้องติดตาม', value: `${classroomKpiMetrics.behavior.followUps} เคส` },
          { label: 'คะแนนพฤติกรรมสุทธิ', value: `${classroomKpiMetrics.behavior.totalPoints} คะแนน` },
        ],
        rows: behaviorReportRows.map((row) => {
          const student = studentById.get(row.student_id);
          return [
            formatThaiOfficialShortDate(row.behavior_date),
            student?.student_code || '-',
            student ? getStudentFullName(student) : '-',
            toneLabels[row.tone],
            row.category,
            Number(row.points) > 0 ? `+${row.points}` : row.points,
            followUpLabels[row.follow_up_status],
            row.description,
          ];
        }),
        subtitle: `${periodLabel} · ${behaviorStudentFilter === 'all' ? 'นักเรียนทุกคนในห้อง' : 'เฉพาะรายบุคคลที่เลือก'}`,
        title: `รายงานพฤติกรรมและเคสดูแลนักเรียน ชั้น ${common.workspaceName}`,
      });
    }

    // Individual Student Report (Single student or Batch all students in classroom!)
    const targetBundles = batchAllStudents
      ? classroomStudents.map((st) => buildStudentBundle(st))
      : selectedStudentBundle
        ? [selectedStudentBundle]
        : [];

    return buildPrintableIndividualStudentHtml({
      bundles: targetBundles,
      classroomName: common.workspaceName,
      dateFrom,
      dateTo,
      orientation: pageOrientation,
      reportIdentity: syncedIdentity,
      schoolName: common.schoolName,
      sections: individualSections,
      teacherCommentText: individualTeacherComment,
      teacherName: common.teacherName,
    });
  }

  async function printReport(batchAllStudents = false) {
    const html = buildActiveReportHtml(batchAllStudents);
    await printHtmlStringAsDocument(html);
  }

  function exportCsv() {
    let headers: string[] = [];
    let lines: string[][] = [];

    if (reportView === 'subject-scores') {
      const assessments = classroomScoreAssessments.filter((a) => !selectedSubjectName || a.subject_name === selectedSubjectName);
      headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', ...assessments.map((a) => `${a.title} (${a.max_score})`), 'รวมคะแนน', 'เกรด', 'งานค้าง'];
      const totalMax = assessments.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
      lines = classroomStudents.map((student, idx) => {
        let totalScore = 0;
        let missingCount = 0;
        const scoreCols = assessments.map((a) => {
          const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
          const score = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : NaN;
          if (!Number.isNaN(score)) {
            totalScore += score;
            return String(score);
          }
          missingCount += 1;
          return '-';
        });
        const pct = totalMax > 0 ? Math.min(100, round((totalScore / totalMax) * 100)) : 0;
        const grade = totalMax > 0 && missingCount < assessments.length ? String(calculateOBECGrade(pct).grade) : '-';
        return [String(idx + 1), student.student_code || '-', getStudentFullName(student), ...scoreCols, String(round(totalScore)), grade, String(missingCount)];
      });
    } else if (reportView === 'attendance' || reportView === 'subject-attendance') {
      headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', 'มาเรียน', 'สาย', 'ลา/ป่วย', 'ขาดเรียน', 'ร้อยละเวลาเรียน'];
      lines = activeAttendanceGrid.rows.map((row, idx) => [
        String(idx + 1),
        row.studentCode,
        row.studentName,
        String(row.totals.present),
        String(row.totals.late),
        String(row.totals.leave),
        String(row.totals.absent),
        `${row.attendancePercent}%`,
      ]);
    } else if (reportView === 'savings') {
      headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', 'ฝากรวมช่วงนี้', 'ถอนรวมช่วงนี้', 'ออมสุทธิช่วงนี้', 'ยอดสะสมคงเหลือ'];
      lines = savingsGrid.rows.map((row, idx) => [
        String(idx + 1),
        row.studentCode,
        row.studentName,
        String(row.depositsInPeriod),
        String(row.withdrawalsInPeriod),
        String(row.totalPeriodNet),
        String(row.totalBalance),
      ]);
    } else if (reportView === 'scores') {
      headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', ...scoreSubjectOptions, 'เกรดเฉลี่ย (GPA)', 'งานค้างรวม'];
      lines = studentCrossSubjectRows.map((row, idx) => [
        String(idx + 1),
        row.studentCode,
        row.studentName,
        ...scoreSubjectOptions.map((sub) => {
          const sd = row.bySubject[sub];
          return sd && sd.max > 0 ? `${sd.percent}% (เกรด ${sd.grade})` : '-';
        }),
        row.gpa,
        String(row.totalMissing),
      ]);
    } else if (reportView === 'health') {
      headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'แปรงฟัน', 'ดื่มนม', 'อาหารกลางวัน', 'จุดต้องติดตาม'];
      lines = healthSummaryRows.map((row, idx) => [
        String(idx + 1),
        row.student.student_code || '-',
        getStudentFullName(row.student),
        row.weightKg ? String(row.weightKg) : '-',
        row.heightCm ? String(row.heightCm) : '-',
        String(row.bmi ?? '-'),
        `${row.brushing.completed}/${row.brushing.total}`,
        `${row.milk.completed}/${row.milk.total}`,
        `${row.lunch.completed}/${row.lunch.total}`,
        row.attentionItems.join(', ') || row.latestHygiene?.note || 'ปกติ',
      ]);
    } else if (reportView === 'student-register') {
      headers = ['ที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', ...activeRegisterFields.map((f) => registerFieldLabels[f])];
      lines = classroomStudents.map((student, idx) => [
        String(idx + 1),
        student.student_code || '-',
        getStudentFullName(student),
        ...activeRegisterFields.map((field) =>
          getRegisterFieldValue(student, field, classroomGuardians, registerHealthRows, revealCitizenIds),
        ),
      ]);
    } else if (reportView === 'executive') {
      headers = ['ขอบเขต', 'นักเรียนทั้งหมด', 'อัตรามาเรียน', 'คะแนนเฉลี่ย', 'สุขภาพสำเร็จ', 'สุขภาพต้องติดตาม', 'พฤติกรรมต้องติดตาม', 'เงินออมสะสมรวม'];
      lines = [
        [
          executiveMetrics.scopeLabel,
          String(executiveMetrics.studentCount),
          `${executiveMetrics.attendanceRate}%`,
          `${executiveMetrics.scoreAverage}%`,
          `${executiveMetrics.healthCompletionRate}%`,
          String(executiveMetrics.healthFollowUps),
          String(executiveMetrics.behaviorFollowUps),
          String(executiveMetrics.savingsTotal),
        ],
      ];
    } else if (reportView === 'behavior') {
      headers = ['วันที่', 'รหัส', 'ชื่อ-นามสกุล', 'ประเภท', 'หมวดหมู่', 'คะแนน', 'การติดตาม', 'รายละเอียด'];
      lines = behaviorReportRows.map((row) => {
        const student = studentById.get(row.student_id);
        return [
          row.behavior_date,
          student?.student_code || '-',
          student ? getStudentFullName(student) : '-',
          toneLabels[row.tone],
          row.category,
          String(row.points),
          followUpLabels[row.follow_up_status],
          row.description,
        ];
      });
    } else if (reportView === 'individual' && selectedStudentBundle) {
      headers = ['หมวดหมู่', 'รายการ', 'รายละเอียด / ผลการประเมิน'];
      lines = [
        ['ข้อมูลพื้นฐาน', 'ชื่อ - นามสกุล', getStudentFullName(selectedStudentBundle.student)],
        ['ข้อมูลพื้นฐาน', 'เลขประจำตัวนักเรียน', selectedStudentBundle.student.student_code || '-'],
      ];
      if (individualSections.guardian) {
        lines.push(['ข้อมูลผู้ปกครอง', 'ผู้ปกครอง', selectedStudentBundle.guardianText]);
      }
      if (individualSections.attendance) {
        lines.push([
          'สรุปเวลาเรียน',
          `อัตราเวลาเรียน ${selectedStudentBundle.attendance.percent}%`,
          `มา ${selectedStudentBundle.attendance.present} · สาย ${selectedStudentBundle.attendance.late} · ลา ${selectedStudentBundle.attendance.leave} · ขาด ${selectedStudentBundle.attendance.absent}`,
        ]);
      }
      if (individualSections.scores) {
        lines.push(['ผลการเรียน', 'เกรดเฉลี่ยสะสม (GPA)', selectedStudentBundle.totalGpa]);
        selectedStudentBundle.subjectRows.forEach((sub) => {
          lines.push([
            'รายวิชา',
            sub.subject,
            `คะแนน ${sub.earned}/${sub.max} (${sub.percent}%) · เกรด ${sub.grade} · ${sub.missing > 0 ? `ค้าง ${sub.missing} งาน` : 'ส่งงานครบ'}`,
          ]);
        });
      }
      if (individualSections.savings) {
        lines.push([
          'เงินออมนักเรียน',
          `ยอดคงเหลือ ${selectedStudentBundle.savings.balance.toLocaleString('th-TH')} บาท`,
          `ฝาก ${selectedStudentBundle.savings.deposits.toLocaleString('th-TH')} บาท · ถอน ${selectedStudentBundle.savings.withdrawals.toLocaleString('th-TH')} บาท`,
        ]);
      }
      if (individualSections.health) {
        lines.push([
          'สุขภาพและกิจวัตร',
          `น้ำหนัก ${selectedStudentBundle.health.weight ?? '-'} กก. / ส่วนสูง ${selectedStudentBundle.health.height ?? '-'} ซม. (BMI ${selectedStudentBundle.health.bmi ?? '-'})`,
          `แปรงฟัน ${selectedStudentBundle.health.brushingText} · ดื่มนม ${selectedStudentBundle.health.milkText} · อาหารกลางวัน ${selectedStudentBundle.health.lunchText} · ${selectedStudentBundle.health.attentionText}`,
        ]);
      }
      if (individualSections.behavior) {
        lines.push([
          'พฤติกรรมและการดูแล',
          `${selectedStudentBundle.behaviors.length} รายการ`,
          selectedStudentBundle.behaviors.length > 0
            ? selectedStudentBundle.behaviors.map((b) => `${b.category} (${b.description})`).join(' · ')
            : 'ประพฤติตนเรียบร้อยตามระเบียบของสถานศึกษา',
        ]);
      }
      if (individualSections.homeVisit) {
        lines.push([
          'การเยี่ยมบ้าน',
          'สถานะการเยี่ยมบ้าน',
          selectedStudentBundle.homeVisit
            ? `ดำเนินการแล้ว (${selectedStudentBundle.homeVisit.completion_percent || 100}%)`
            : 'อยู่ระหว่างดำเนินการตามแผนเยี่ยมบ้าน',
        ]);
      }
      if (individualSections.teacherComment) {
        lines.push(['ความเห็นครูประจำชั้น', 'ข้อเสนอแนะ', individualTeacherComment.trim() || defaultIndividualTeacherComment]);
      }
    }

    const csvContent = [headers.map(escapeCsv).join(','), ...lines.map((row) => row.map(escapeCsv).join(','))].join('\n');
    downloadBlob(
      `classcare-${reportView}-${dateFrom}-${dateTo}.csv`,
      new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' }),
    );
  }

  async function exportExcel() {
    const sheets: ExcelSheetConfig[] = [];

    if (reportView === 'subject-scores') {
      const assessments = classroomScoreAssessments.filter((a) => !selectedSubjectName || a.subject_name === selectedSubjectName);
      const totalMax = assessments.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
      const headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', ...assessments.map((a) => `${a.title} (${a.max_score})`), `รวม (${totalMax})`, 'ร้อยละ', 'เกรด', 'งานค้าง'];
      const lines = classroomStudents.map((student, idx) => {
        let totalScore = 0;
        let missingCount = 0;
        const scoreCols = assessments.map((a) => {
          const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
          const score = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : NaN;
          if (!Number.isNaN(score)) {
            totalScore += score;
            return String(score);
          }
          missingCount += 1;
          return '-';
        });
        const pct = totalMax > 0 ? Math.min(100, round((totalScore / totalMax) * 100)) : 0;
        const grade = totalMax > 0 && missingCount < assessments.length ? String(calculateOBECGrade(pct).grade) : '-';
        return [String(idx + 1), student.student_code || '-', getStudentFullName(student), ...scoreCols, String(round(totalScore)), `${pct}%`, grade, String(missingCount)];
      });
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-SSC', dateFrom, selectedSubjectName),
        rows: lines,
        sheetName: selectedSubjectName || 'คะแนนรายวิชา',
        subtitle: `${periodLabel} | วิชา ${selectedSubjectName || 'ทั้งหมด'}`,
        title: `ตารางคะแนนและงานค้างรายวิชา ${selectedSubjectName || ''}`,
      });
    } else if (reportView === 'attendance' || reportView === 'subject-attendance') {
      const headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', 'มาเรียน', 'สาย', 'ลา/ป่วย', 'ขาดเรียน', 'ร้อยละเวลาเรียน'];
      const lines = activeAttendanceGrid.rows.map((row, idx) => [
        String(idx + 1),
        row.studentCode,
        row.studentName,
        String(row.totals.present),
        String(row.totals.late),
        String(row.totals.leave),
        String(row.totals.absent),
        `${row.attendancePercent}%`,
      ]);
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-ATT', dateFrom, selectedClassroom?.name),
        rows: lines,
        sheetName: 'สรุปเวลาเรียน',
        subtitle: `${periodLabel} (${dateFrom} ถึง ${dateTo})`,
        title: `รายงานเวลาเรียน ชั้น ${selectedClassroom?.name || '-'}`,
      });
    } else if (reportView === 'savings') {
      const headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', 'ฝากรวมช่วงนี้', 'ถอนรวมช่วงนี้', 'ออมสุทธิช่วงนี้', 'ยอดสะสมคงเหลือ'];
      const lines = savingsGrid.rows.map((row, idx) => [
        String(idx + 1),
        row.studentCode,
        row.studentName,
        String(row.depositsInPeriod),
        String(row.withdrawalsInPeriod),
        String(row.totalPeriodNet),
        String(row.totalBalance),
      ]);
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-SAV', dateFrom, selectedClassroom?.name),
        rows: lines,
        sheetName: 'เงินออมนักเรียน',
        subtitle: `${periodLabel} (${dateFrom} ถึง ${dateTo})`,
        title: `รายงานการออมเงินนักเรียน ชั้น ${selectedClassroom?.name || '-'}`,
      });
    } else if (reportView === 'scores') {
      const headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', ...scoreSubjectOptions, 'เกรดเฉลี่ย (GPA)', 'งานค้างรวม'];
      const lines = studentCrossSubjectRows.map((row, idx) => [
        String(idx + 1),
        row.studentCode,
        row.studentName,
        ...scoreSubjectOptions.map((sub) => {
          const sd = row.bySubject[sub];
          return sd && sd.max > 0 ? `${sd.percent}% (เกรด ${sd.grade})` : '-';
        }),
        row.gpa,
        String(row.totalMissing),
      ]);
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-SCO', dateFrom, selectedClassroom?.name),
        rows: lines,
        sheetName: 'สรุปคะแนนรวมทุกวิชา',
        subtitle: `${scoreSubjectOptions.length} รายวิชา | ${scoreAssessmentRows.length} ชุดคะแนน`,
        title: `ตารางสรุปคะแนนรวมทุกวิชา ชั้น ${selectedClassroom?.name || '-'}`,
      });
    } else if (reportView === 'health') {
      const headers = ['ที่', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'แปรงฟัน', 'ดื่มนม', 'อาหารกลางวัน', 'จุดต้องติดตาม'];
      const lines = healthSummaryRows.map((row, idx) => [
        String(idx + 1),
        row.student.student_code || '-',
        getStudentFullName(row.student),
        row.weightKg ? String(row.weightKg) : '-',
        row.heightCm ? String(row.heightCm) : '-',
        String(row.bmi ?? '-'),
        `${row.brushing.completed}/${row.brushing.total}`,
        `${row.milk.completed}/${row.milk.total}`,
        `${row.lunch.completed}/${row.lunch.total}`,
        row.attentionItems.join(', ') || row.latestHygiene?.note || 'ปกติ',
      ]);
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-HLT', dateFrom, selectedClassroom?.name),
        rows: lines,
        sheetName: 'สุขภาพและกิจวัตร',
        subtitle: `${periodLabel}`,
        title: `รายงานสุขภาพและกิจวัตรนักเรียน ชั้น ${selectedClassroom?.name || '-'}`,
      });
    } else if (reportView === 'student-register') {
      const headers = ['ที่', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', ...activeRegisterFields.map((f) => registerFieldLabels[f])];
      const lines = classroomStudents.map((student, idx) => [
        String(idx + 1),
        student.student_code || '-',
        getStudentFullName(student),
        ...activeRegisterFields.map((field) =>
          getRegisterFieldValue(student, field, classroomGuardians, registerHealthRows, revealCitizenIds),
        ),
      ]);
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-REG', dateFrom, selectedClassroom?.name),
        rows: lines,
        sheetName: 'ทะเบียนรายชื่อ',
        subtitle: `นักเรียนทั้งหมด ${classroomStudents.length} คน`,
        title: `ทะเบียนรายชื่อนักเรียน ชั้น ${selectedClassroom?.name || '-'}`,
      });
    } else if (reportView === 'executive') {
      const headers = ['ขอบเขต', 'นักเรียนทั้งหมด', 'อัตรามาเรียน', 'คะแนนเฉลี่ย', 'สุขภาพสำเร็จ', 'สุขภาพต้องติดตาม', 'พฤติกรรมต้องติดตาม', 'เงินออมสะสมรวม'];
      const lines = [
        [
          executiveMetrics.scopeLabel,
          String(executiveMetrics.studentCount),
          `${executiveMetrics.attendanceRate}%`,
          `${executiveMetrics.scoreAverage}%`,
          `${executiveMetrics.healthCompletionRate}%`,
          String(executiveMetrics.healthFollowUps),
          String(executiveMetrics.behaviorFollowUps),
          String(executiveMetrics.savingsTotal),
        ],
      ];
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-EXE', dateFrom),
        rows: lines,
        sheetName: 'สรุปผู้บริหาร',
        subtitle: executiveMetrics.scopeLabel,
        title: 'รายงานสรุปสำหรับผู้บริหาร',
      });
    } else if (reportView === 'behavior') {
      const headers = ['วันที่', 'รหัส', 'ชื่อ-นามสกุล', 'ประเภท', 'หมวดหมู่', 'คะแนน', 'การติดตาม', 'รายละเอียด'];
      const lines = behaviorReportRows.map((row) => {
        const student = studentById.get(row.student_id);
        return [
          row.behavior_date,
          student?.student_code || '-',
          student ? getStudentFullName(student) : '-',
          toneLabels[row.tone],
          row.category,
          String(row.points),
          followUpLabels[row.follow_up_status],
          row.description,
        ];
      });
      sheets.push({
        columns: headers,
        documentCode: buildOfficialDocumentCode('CC-BHV', dateFrom, selectedClassroom?.name),
        rows: lines,
        sheetName: 'พฤติกรรม',
        subtitle: `${periodLabel}`,
        title: `รายงานพฤติกรรมและเคสดูแล ชั้น ${selectedClassroom?.name || '-'}`,
      });
    } else if (reportView === 'individual' && selectedStudentBundle) {
      const summaryRows: string[][] = [
        ['ข้อมูลพื้นฐาน', 'ชื่อ - นามสกุล', getStudentFullName(selectedStudentBundle.student)],
        ['ข้อมูลพื้นฐาน', 'เลขประจำตัวนักเรียน', selectedStudentBundle.student.student_code || '-'],
      ];
      if (individualSections.guardian) {
        summaryRows.push(['ผู้ปกครอง', 'ข้อมูลผู้ปกครอง', selectedStudentBundle.guardianText]);
      }
      if (individualSections.attendance) {
        summaryRows.push([
          'สรุปเวลาเรียน',
          `อัตราเวลาเรียน ${selectedStudentBundle.attendance.percent}%`,
          `มา ${selectedStudentBundle.attendance.present} วัน · สาย ${selectedStudentBundle.attendance.late} วัน · ลา ${selectedStudentBundle.attendance.leave} วัน · ขาด ${selectedStudentBundle.attendance.absent} วัน`,
        ]);
      }
      if (individualSections.savings) {
        summaryRows.push([
          'เงินออมนักเรียน',
          `ยอดคงเหลือ ${selectedStudentBundle.savings.balance.toLocaleString('th-TH')} บาท`,
          `ฝากช่วงนี้ ${selectedStudentBundle.savings.deposits.toLocaleString('th-TH')} บาท · ถอน ${selectedStudentBundle.savings.withdrawals.toLocaleString('th-TH')} บาท`,
        ]);
      }
      if (individualSections.health) {
        summaryRows.push([
          'สุขภาพและกิจวัตร',
          `น้ำหนัก ${selectedStudentBundle.health.weight ?? '-'} กก. / ส่วนสูง ${selectedStudentBundle.health.height ?? '-'} ซม. (BMI ${selectedStudentBundle.health.bmi ?? '-'})`,
          `แปรงฟัน ${selectedStudentBundle.health.brushingText} · ดื่มนม ${selectedStudentBundle.health.milkText} · อาหารกลางวัน ${selectedStudentBundle.health.lunchText} · ${selectedStudentBundle.health.attentionText}`,
        ]);
      }
      if (individualSections.behavior) {
        summaryRows.push([
          'พฤติกรรมและการดูแล',
          `${selectedStudentBundle.behaviors.length} รายการ`,
          selectedStudentBundle.behaviors.length > 0
            ? selectedStudentBundle.behaviors.map((b) => `${b.category} (${b.description})`).join(' · ')
            : 'ประพฤติตนเรียบร้อยตามระเบียบของสถานศึกษา',
        ]);
      }
      if (individualSections.homeVisit) {
        summaryRows.push([
          'การเยี่ยมบ้าน',
          'สถานะการเยี่ยมบ้าน',
          selectedStudentBundle.homeVisit
            ? `ดำเนินการแล้ว (${selectedStudentBundle.homeVisit.completion_percent || 100}%)`
            : 'อยู่ระหว่างดำเนินการตามแผนเยี่ยมบ้าน',
        ]);
      }
      if (individualSections.teacherComment) {
        summaryRows.push(['ความเห็นครูประจำชั้น', 'ข้อเสนอแนะ', individualTeacherComment.trim() || defaultIndividualTeacherComment]);
      }

      sheets.push({
        columns: ['หมวดหมู่', 'หัวข้อ', 'รายละเอียด / ผลการประเมิน'],
        documentCode: buildOfficialDocumentCode('CC-IND', dateFrom, selectedStudentBundle.student.student_code),
        rows: summaryRows,
        sheetName: 'สรุปรายบุคคล',
        subtitle: `${getStudentFullName(selectedStudentBundle.student)} (${activeIndividualSectionCount} หัวข้อที่เลือก)`,
        title: 'รายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล',
      });

      if (individualSections.scores) {
        const headers = ['ที่', 'รายวิชา', 'คะแนนที่ได้', 'คะแนนเต็ม', 'ร้อยละ', 'เกรด', 'งานค้าง'];
        const lines = selectedStudentBundle.subjectRows.map((sub, idx) => [
          String(idx + 1),
          sub.subject,
          String(sub.earned),
          String(sub.max),
          `${sub.percent}%`,
          String(sub.grade),
          String(sub.missing),
        ]);
        sheets.push({
          columns: headers,
          documentCode: buildOfficialDocumentCode('CC-IND-SCO', dateFrom, selectedStudentBundle.student.student_code),
          rows: lines,
          sheetName: 'ผลการเรียนรายวิชา',
          subtitle: `${getStudentFullName(selectedStudentBundle.student)} · GPA ${selectedStudentBundle.totalGpa}`,
          title: 'ตารางผลการเรียนรายวิชา (รายบุคคล)',
        });
      }
    }

    if (sheets.length === 0) return;

    try {
      const buffer = await generateExcelReportBuffer({
        academicYear: selectedClassroom?.academic_year || reportIdentity.academicYear,
        classroomName: selectedClassroom?.name || session.workspace?.name || 'ห้องเรียน',
        dateFrom,
        dateTo,
        identity: reportIdentity,
        schoolName: reportIdentity.schoolName || session.workspace?.schoolName || 'โรงเรียน',
        sheets,
        signatures: [
          { name: reportIdentity.teacherName || session.profile.displayName, role: 'ครูประจำชั้น' },
          { name: reportIdentity.academicHeadName || null, role: 'หัวหน้างานวิชาการ' },
          { name: reportIdentity.directorName || null, role: 'ผู้อำนวยการโรงเรียน' },
        ],
      });
      downloadExcelBuffer(buffer, `classcare-${reportView}-${dateFrom}-${dateTo}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      setNotice('เกิดข้อผิดพลาดในการสร้างไฟล์ Excel กรุณาลองใหม่อีกครั้ง');
    }
  }

  const saveReportIdentitySettings = async () => {
    setIsSavingSettings(true);
    setNotice(null);
    try {
      saveSchoolReportIdentity(reportIdentity, session.workspace?.id);
      saveReportTermRanges(termRanges, session.workspace?.id);

      if (!demoMode && isSupabaseReady && supabase && session.workspace?.id) {
        const { data: currentWs } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', session.workspace.id)
          .maybeSingle();
        const currentSettings = (currentWs?.settings as Record<string, unknown>) || {};
        const { error } = await supabase
          .from('workspaces')
          .update({
            school_name: reportIdentity.schoolName || session.workspace.schoolName,
            settings: {
              ...currentSettings,
              report_identity: reportIdentity,
              report_term_ranges: termRanges,
            },
          })
          .eq('id', session.workspace.id);
        if (error) throw error;
      }
      setNotice('บันทึกตั้งค่าผู้ลงนาม ตราโรงเรียน และวันเปิด-ปิดภาคเรียนเรียบร้อยแล้ว');
    } catch (err) {
      setNotice(`บันทึกตั้งค่าลงฐานข้อมูลไม่สำเร็จ (บันทึกในเครื่องแล้ว): ${String(err)}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageFile(file);
      setReportIdentity((current) => ({ ...current, schoolLogoDataUrl: compressedDataUrl }));
      setNotice('อัปโหลดตราโรงเรียนเรียบร้อยแล้ว กรุณากด "บันทึกการตั้งค่าทั้งหมด" ด้านล่าง');
    } catch (error) {
      setNotice(`อัปโหลดโลโก้ไม่สำเร็จ: ${String(error)}`);
    }
  };

  const activeCategoryKey = activeReportConfig.category;
  const currentStudentIdx = allClassroomStudents.findIndex((s) => s.id === selectedStudent?.id);

  return (
    <main className="report-v2 app-page pb-24 md:pb-10">
      {/* 1. Header & Main Quick Print Actions */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800 ring-1 ring-teal-500/20">
            <FileSpreadsheet size={15} aria-hidden="true" />
            ศูนย์ออกรายงานมาตรฐาน A4 & สมุด ปพ.
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            รายงานโรงเรียนและเอกสารวิชาการ
          </h1>
          <p className="mt-1 text-xs font-bold text-slate-600 sm:text-sm">
            {reportIdentity.schoolName || session.workspace?.schoolName || 'โรงเรียน'} · ชั้น{' '}
            <span className="font-black text-teal-700">{selectedClassroom?.name || '-'}</span> · เลือกแบบรายงานแล้วสั่งพิมพ์ลงกระดาษ A4 หรือดูบนมือถือได้ทันที
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reportView === 'savings' ? (
            <Link
              to={`/app/dashboard?view=savings${classroomId ? `&classroomId=${encodeURIComponent(classroomId)}` : ''}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900 transition hover:bg-amber-100"
            >
              <Wallet size={17} aria-hidden="true" /> กลับไปสมุดเงินออม
            </Link>
          ) : null}

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 text-sm font-black text-white shadow-md shadow-indigo-500/20 transition hover:-translate-y-0.5 active:scale-95"
            onClick={() => setIsOfficialDocsOpen(true)}
            type="button"
          >
            <Award size={18} aria-hidden="true" />
            <span>สมุด ปพ.5 / ปพ.6 / ใบรับรอง</span>
          </button>

          {printableReport ? (
            <>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
                onClick={() => void printReport(false)}
                type="button"
              >
                <Printer size={18} aria-hidden="true" />
                <span>พิมพ์กระดาษ A4 / PDF</span>
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-95"
                onClick={() => void exportExcel()}
                type="button"
              >
                <Download size={16} aria-hidden="true" />
                <span>Excel</span>
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                onClick={exportCsv}
                type="button"
              >
                <Download size={15} aria-hidden="true" />
                <span>CSV</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* 2. Guided report menu */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-[#e7dece] bg-gradient-to-br from-[#fffdf8] via-white to-[#f1fbf8] p-3.5 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-2xl shadow-inner" aria-hidden="true">🧸</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-900">เริ่มตรงนี้</span>
                <span className="text-xs font-bold text-slate-500">เลือกหมวด แล้วเลือกรายงานที่ต้องการ</span>
              </div>
              <h2 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">วันนี้อยากดูรายงานเรื่องไหน?</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateReportSearch({ reportView: 'settings' })}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${
              reportView === 'settings'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
            }`}
          >
            <Settings size={15} aria-hidden="true" /> ตั้งค่าหน้ารายงาน
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="เลือกหมวดรายงาน">
          {reportCategories.map((cat) => {
            const isActiveCat = activeCategoryKey === cat.key;
            const firstViewInCat = reportViews.find((view) => view.category === cat.key)?.value || 'attendance';
            return (
              <button
                key={cat.key}
                type="button"
                aria-pressed={isActiveCat}
                onClick={() => updateReportSearch({ reportView: firstViewInCat })}
                className={`group flex min-h-[86px] items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  isActiveCat
                    ? 'border-teal-400 bg-teal-50 shadow-sm ring-2 ring-teal-200/70'
                    : 'border-slate-200 bg-white/90 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl transition ${isActiveCat ? 'bg-white shadow-sm' : 'bg-[#f6f2eb] group-hover:bg-white'}`} aria-hidden="true">{cat.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black leading-5 text-slate-950">{cat.title}</span>
                  <span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-500">{cat.description}</span>
                </span>
                {isActiveCat ? <CheckCircle2 size={18} className="shrink-0 text-teal-700" aria-label="หมวดที่เลือก" /> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">ขั้นต่อไป · เลือกรายงาน</p>
              <h3 className="mt-0.5 text-sm font-black text-slate-900 sm:text-base">
                {reportCategories.find((category) => category.key === activeCategoryKey)?.icon}{' '}
                {reportCategories.find((category) => category.key === activeCategoryKey)?.title}
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800">
              <CheckCircle2 size={14} aria-hidden="true" /> เลือกอยู่: {activeReportConfig.shortLabel}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {reportViews
              .filter((item) => item.category === activeCategoryKey)
              .map((item) => {
                const isActive = reportView === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => updateReportSearch({ reportView: item.value })}
                    className={`flex min-h-[76px] items-start gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      isActive
                        ? 'border-teal-400 bg-teal-50 shadow-sm ring-2 ring-teal-200/60'
                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'
                    }`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-xs" aria-hidden="true">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-5 text-slate-900">{item.label}</span>
                      <span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-500">{item.description}</span>
                    </span>
                    {isActive ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-teal-700" aria-label="รายงานที่เลือก" /> : <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />}
                  </button>
                );
              })}

            {activeCategoryKey === 'academic_scores' ? (
              <button
                type="button"
                onClick={() => setIsOfficialDocsOpen(true)}
                className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-xs" aria-hidden="true">📘</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-indigo-950">สมุด ปพ.5 / ปพ.6 / ใบรับรอง</span>
                  <span className="mt-1 block text-[11px] font-semibold text-indigo-800">เปิดแบบฟอร์มทางการเพื่อกรอกและพิมพ์</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-indigo-400" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* 3. Step 2: Simple 1-Bar Filter & Paper Orientation Controls */}
      {reportView !== 'settings' ? (
        <section className="mt-4 rounded-3xl border border-slate-200/90 bg-white p-3.5 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              ขั้นที่ 2 · เลือกห้องเรียน ช่วงเวลา และรูปแบบการแสดงผล
            </p>
            {/* View Mode Toggle: A4 Paper vs Mobile Easy Read */}
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDisplayMode('a4')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                  displayMode === 'a4' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={14} />
                <span>กระดาษ A4 (พร้อมพิมพ์)</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('mobile')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                  displayMode === 'mobile' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone size={14} />
                <span>มุมมองมือถือ (อ่านง่าย)</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Classroom Selector */}
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              <span>1. ห้องเรียน</span>
              <select
                className="nexus-field h-11 rounded-2xl px-3 text-sm font-black text-slate-900"
                onChange={(event) => setClassroomId(event.target.value)}
                value={classroomId}
              >
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    ชั้น {classroom.name} {classroom.academic_year ? `(ปีการศึกษา ${classroom.academic_year})` : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* Period Mode Selector */}
            <div className="grid gap-1.5 text-xs font-black text-slate-700">
              <span>2. ช่วงเวลารายงาน</span>
              <div className="grid grid-cols-3 gap-1.5">
                {reportPeriods.map((period) => (
                  <button
                    className={`h-11 rounded-2xl px-2 text-xs font-black transition ${
                      reportPeriod === period.value
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                    key={period.value}
                    onClick={() => updateReportSearch({ reportPeriod: period.value })}
                    type="button"
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Month or Term Selector */}
            {reportPeriod === 'month' ? (
              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                <span>3. เลือกเดือน</span>
                <ThaiDatePicker className="h-11 px-3" mode="month" onValueChange={setReportMonth} value={reportMonth} />
              </label>
            ) : reportPeriod === 'term' ? (
              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                <span>3. เลือกภาคเรียน</span>
                <select
                  className="nexus-field h-11 rounded-2xl px-3 text-sm font-black text-slate-900"
                  onChange={(event) => setSelectedTerm(event.target.value as TermKey)}
                  value={selectedTerm}
                >
                  <option value="term1">ภาคเรียนที่ 1 ({termRanges.term1.start} ถึง {termRanges.term1.end})</option>
                  <option value="term2">ภาคเรียนที่ 2 ({termRanges.term2.start} ถึง {termRanges.term2.end})</option>
                </select>
              </label>
            ) : (
              <div className="grid gap-1.5 text-xs font-black text-slate-700">
                <span>3. ปีการศึกษา</span>
                <div className="flex h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700">
                  พ.ค. – เม.ย. ({formatThaiOfficialShortDate(dateFrom)} ถึง {formatThaiOfficialShortDate(dateTo)})
                </div>
              </div>
            )}

            {/* Paper Orientation + Search */}
            <div className="grid gap-1.5 text-xs font-black text-slate-700">
              <span>4. แนวกระดาษ A4 & ค้นหาชื่อ</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPageOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-teal-200 bg-teal-50 px-3 text-xs font-black text-teal-900 hover:bg-teal-100"
                  title="สลับแนวกระดาษ A4 แนวตั้ง / แนวนอน"
                >
                  <span>📄 A4 {pageOrientation === 'portrait' ? 'แนวตั้ง' : 'แนวนอน'}</span>
                </button>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    className="nexus-field h-11 w-full rounded-2xl pl-8 pr-2.5 text-xs font-bold"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นหาชื่อ/รหัส..."
                    value={query}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contextual Sub-filters for Specific Report Views */}
          {reportView === 'subject-attendance' ? (
            <div className="mt-3 grid gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-black text-slate-700">
                <span>เลือกรายวิชา</span>
                <select
                  className="nexus-field h-10 rounded-xl bg-white px-3 text-sm font-black"
                  onChange={(event) => setSelectedSubjectName(event.target.value)}
                  value={selectedSubjectName}
                >
                  <option value="">ทุกรายวิชา</option>
                  {subjectOptions.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-700">
                <span>เลือกคาบเรียน</span>
                <select
                  className="nexus-field h-10 rounded-xl bg-white px-3 text-sm font-black"
                  onChange={(event) => setSelectedPeriodLabel(event.target.value)}
                  value={selectedPeriodLabel}
                >
                  <option value="">ทุกคาบเรียน</option>
                  {periodOptions.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {reportView === 'subject-scores' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-3">
              <span className="text-xs font-black text-slate-700">เลือกรายวิชาที่ต้องการดูตารางคะแนน:</span>
              {scoreSubjectOptions.length > 0 ? (
                scoreSubjectOptions.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubjectName(sub)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                      selectedSubjectName === sub
                        ? 'bg-cyan-700 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {sub}
                  </button>
                ))
              ) : (
                <span className="text-xs font-bold text-slate-500">ยังไม่มีชุดคะแนนในห้องนี้</span>
              )}
            </div>
          ) : null}

          {reportView === 'individual' ? (
            <div className="mt-3 space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-indigo-950">เลือกนักเรียนรายบุคคล:</span>
                  <button
                    type="button"
                    disabled={currentStudentIdx <= 0}
                    onClick={() => {
                      if (currentStudentIdx > 0) setSelectedStudentId(allClassroomStudents[currentStudentIdx - 1].id);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <select
                    className="nexus-field h-9 rounded-xl bg-white px-3 text-sm font-black text-slate-900"
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    value={selectedStudent?.id || ''}
                  >
                    {allClassroomStudents.map((student, idx) => (
                      <option key={student.id} value={student.id}>
                        เลขที่ {idx + 1} · {student.student_code || '-'} {getStudentFullName(student)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={currentStudentIdx < 0 || currentStudentIdx >= allClassroomStudents.length - 1}
                    onClick={() => {
                      if (currentStudentIdx >= 0 && currentStudentIdx < allClassroomStudents.length - 1) {
                        setSelectedStudentId(allClassroomStudents[currentStudentIdx + 1].id);
                      }
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void printReport(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-black text-white shadow-xs hover:bg-indigo-700"
                >
                  <Printer size={14} />
                  <span>พิมพ์ครบทุกคนในห้อง ({allClassroomStudents.length} แผ่น A4)</span>
                </button>
              </div>

              {/* Section Selector for Individual Student Report */}
              <div className="rounded-2xl border border-indigo-200/80 bg-white p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-slate-900">
                      เลือกข้อมูลที่ต้องการแสดงในใบรายงานรายบุคคล ({activeIndividualSectionCount}/{individualSectionOptions.length} หัวข้อ)
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      ติ๊กเลือกเฉพาะหัวข้อที่ต้องการพิมพ์แจกผู้ปกครองได้อิสระ (ทั้งการพิมพ์รายคนและพิมพ์ทั้งห้องจะแสดงตามที่เลือก)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {individualSectionPresets.map((preset) => {
                      const isPresetActive = individualSectionOptions.every(
                        (opt) => individualSections[opt.value] === preset.sections[opt.value],
                      );
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => updateIndividualSections({ ...preset.sections })}
                          className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black transition ${
                            isPresetActive
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {individualSectionOptions.map((option) => {
                    const checked = individualSections[option.value];
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                          checked
                            ? 'border-indigo-500 bg-indigo-50/60 text-slate-950 shadow-2xs'
                            : 'border-slate-200 bg-slate-50/40 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          checked={checked}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                          onChange={() => toggleIndividualSection(option.value)}
                          type="checkbox"
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-black leading-tight">{option.label}</span>
                          <span className="mt-0.5 block text-[10px] font-bold leading-snug text-slate-500">
                            {option.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {individualSections.teacherComment ? (
                  <div className="mt-3 border-t border-slate-100 pt-2.5">
                    <label className="block">
                      <span className="text-[11px] font-black text-slate-700">
                        ข้อความความเห็นครูประจำชั้น (แก้ไขข้อความก่อนพิมพ์ได้):
                      </span>
                      <input
                        className="nexus-field mt-1 h-9 w-full rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-800"
                        onChange={(event) => setIndividualTeacherComment(event.target.value)}
                        placeholder={defaultIndividualTeacherComment}
                        type="text"
                        value={individualTeacherComment}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {reportView === 'behavior' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-3">
              <span className="text-xs font-black text-slate-700">กรองรายชื่อนักเรียน:</span>
              <select
                className="nexus-field h-9 rounded-xl bg-white px-3 text-xs font-black"
                onChange={(event) => setBehaviorStudentFilter(event.target.value)}
                value={behaviorStudentFilter}
              >
                <option value="all">แสดงนักเรียนทุกคนในห้อง ({allClassroomStudents.length} คน)</option>
                {allClassroomStudents.map((st, idx) => (
                  <option key={st.id} value={st.id}>
                    เลขที่ {idx + 1} · {st.student_code || '-'} {getStudentFullName(st)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {reportView === 'student-register' ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-black text-slate-700">ข้อมูลที่ต้องการแสดงในตาราง A4:</span>
                {registerFieldOptions.map((field) => (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700" key={field.value}>
                    <input
                      checked={registerFields[field.value]}
                      className="h-4 w-4 accent-teal-600"
                      onChange={(event) =>
                        setRegisterFields((current) => ({ ...current, [field.value]: event.target.checked }))
                      }
                      type="checkbox"
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
              {registerFields.citizenId ? (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900">
                  <input
                    checked={revealCitizenIds}
                    className="h-4 w-4 accent-amber-600"
                    onChange={(event) => setRevealCitizenIds(event.target.checked)}
                    type="checkbox"
                  />
                  <span>แสดงเลขบัตร 13 หลักเต็ม</span>
                </label>
              ) : null}
            </div>
          ) : null}

          {reportView === 'executive' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-black text-slate-700">ขอบเขตการสรุปผลผู้บริหาร:</span>
              <button
                type="button"
                onClick={() => setExecutiveScope('classroom')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                  executiveScope === 'classroom' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                เฉพาะห้องเรียนที่เลือก ({selectedClassroom?.name || '-'})
              </button>
              <button
                type="button"
                onClick={() => setExecutiveScope('school')}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition ${
                  executiveScope === 'school' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                รวมทุกห้องเรียนทั้งโรงเรียน ({classrooms.length} ห้อง)
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 4. Quick Classroom Summary Strip */}
      {reportView !== 'settings' ? (
        <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            {
              detail: `นักเรียน ${allClassroomStudents.length} คน · ต่ำกว่าเกณฑ์ ${classroomKpiMetrics.attendance.riskCount} คน`,
              label: `เวลาเรียน (${selectedClassroom?.name || '-'})`,
              value: `${classroomKpiMetrics.attendance.presentRate}%`,
            },
            {
              detail:
                classroomKpiMetrics.scores.assessmentCount > 0 && scoreAssessmentRows.every((r) => r.enteredCount === 0)
                  ? `${classroomKpiMetrics.scores.assessmentCount} ชุดคะแนน (รอกรอกคะแนน) · ${scoreSubjectOptions.length} วิชา`
                  : `${classroomKpiMetrics.scores.assessmentCount} ชุดคะแนน · ${scoreSubjectOptions.length} รายวิชา`,
              label: 'คะแนนเฉลี่ยห้อง',
              value: `${classroomKpiMetrics.scores.averagePercent}%`,
            },
            {
              detail: `เคลื่อนไหว/มีบัญชี ${classroomKpiMetrics.savings.activeCount} คน`,
              label: 'เงินออมสะสมรวม',
              value: `${classroomKpiMetrics.savings.totalBalance.toLocaleString('th-TH')} ฿`,
            },
            {
              detail: `ดูแลพฤติกรรม ${classroomKpiMetrics.behavior.followUps} · สุขอนามัย ${classroomKpiMetrics.health.followUps}`,
              label: 'รายการต้องติดตาม',
              value: `${classroomKpiMetrics.behavior.followUps + classroomKpiMetrics.health.followUps} รายการ`,
            },
          ].map((item) => (
            <article className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs" key={item.label}>
              <p className="text-[11px] font-black text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{item.value}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{item.detail}</p>
            </article>
          ))}
        </section>
      ) : null}

      {/* 5. Main Report Content: Either Settings OR A4 Paper Sheet Preview / Mobile Friendly View */}
      {reportView === 'settings' ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          {(['term1', 'term2'] as TermKey[]).map((term) => (
            <article className="rounded-3xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5" key={term}>
              <h3 className="text-lg font-black text-slate-950">
                {term === 'term1' ? '📅 กำหนดการภาคเรียนที่ 1' : '📅 กำหนดการภาคเรียนที่ 2'}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-600">
                ใช้สำหรับคำนวณช่วงวันที่อัตโนมัติเมื่อเลือกดูรายงานแบบ &ldquo;รายเทอม&rdquo;
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  วันเปิดภาคเรียน
                  <ThaiDatePicker
                    className="h-11 px-3"
                    onValueChange={(value) =>
                      setTermRanges((current) => ({ ...current, [term]: { ...current[term], start: value } }))
                    }
                    value={termRanges[term].start}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  วันปิดภาคเรียน
                  <ThaiDatePicker
                    className="h-11 px-3"
                    onValueChange={(value) =>
                      setTermRanges((current) => ({ ...current, [term]: { ...current[term], end: value } }))
                    }
                    value={termRanges[term].end}
                  />
                </label>
              </div>
            </article>
          ))}

          <article className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-2">
            <h3 className="text-xl font-black text-slate-950">🏛️ ตั้งค่าหัวกระดาษราชการ ตราโรงเรียน และผู้ลงนาม</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">
              ข้อมูลชุดนี้จะแสดงบนหัวกระดาษ A4 และช่องลายเซ็นด้านล่างของรายงานทุกฉบับโดยอัตโนมัติ
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อสถานศึกษา / โรงเรียน
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, schoolName: event.target.value }))}
                  placeholder="เช่น โรงเรียนบ้านโคกสูง"
                  value={reportIdentity.schoolName}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ปีการศึกษา (พ.ศ.)
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, academicYear: event.target.value }))}
                  placeholder="เช่น 2569"
                  value={reportIdentity.academicYear}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อครูประจำชั้น (ผู้จัดทำรายงาน)
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, teacherName: event.target.value }))}
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={reportIdentity.teacherName}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อครูที่ปรึกษาร่วม (ถ้ามี)
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, coAdvisorName: event.target.value }))}
                  placeholder="เว้นว่างไว้หากมีครูประจำชั้นคนเดียว"
                  value={reportIdentity.coAdvisorName || ''}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อหัวหน้างานวิชาการ (ผู้ตรวจสอบ)
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, academicHeadName: event.target.value }))}
                  placeholder="ชื่อหัวหน้างานวิชาการ"
                  value={reportIdentity.academicHeadName}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อนายทะเบียนโรงเรียน
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, registrarName: event.target.value }))}
                  placeholder="ชื่อนายทะเบียนโรงเรียน"
                  value={reportIdentity.registrarName}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อผู้อำนวยการโรงเรียน (ผู้รับรอง)
                <input
                  className="nexus-field h-11 px-3 text-sm font-bold"
                  onChange={(event) => setReportIdentity((current) => ({ ...current, directorName: event.target.value }))}
                  placeholder="ชื่อผู้อำนวยการโรงเรียน"
                  value={reportIdentity.directorName}
                />
              </label>

              <div className="grid gap-1.5 text-xs font-black text-slate-700">
                <span>ตราประจำโรงเรียน (แสดงมุมซ้ายบนของกระดาษ A4)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input accept="image/*" className="hidden" id="logo-upload" onChange={handleLogoUpload} type="file" />
                  <label
                    className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                    htmlFor="logo-upload"
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                    อัปโหลดรูปตราโรงเรียน
                  </label>
                  {reportIdentity.schoolLogoDataUrl ? (
                    <>
                      <img
                        alt="School Logo"
                        className="h-11 w-11 rounded-full border border-slate-200 object-contain bg-white p-0.5"
                        src={reportIdentity.schoolLogoDataUrl}
                      />
                      <button
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-600 transition hover:bg-rose-100"
                        onClick={() => setReportIdentity((current) => ({ ...current, schoolLogoDataUrl: '' }))}
                        type="button"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        ลบ
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 text-sm font-black text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
                disabled={isSavingSettings}
                onClick={() => void saveReportIdentitySettings()}
                type="button"
              >
                <Save size={16} aria-hidden="true" />
                {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
              </button>
            </div>
          </article>
        </section>
      ) : (
        <section className="mt-4">
          {/* Paper Top Action Bar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{activeReportConfig.icon}</span>
              <div>
                <h2 className="text-sm font-black text-slate-950">{activeReportConfig.label}</h2>
                <p className="text-[11px] font-bold text-slate-500">
                  {displayMode === 'a4'
                    ? `มุมมองกระดาษ A4 ${pageOrientation === 'portrait' ? 'แนวตั้ง (210 × 297 มม.)' : 'แนวนอน (297 × 210 มม.)'} · พร้อมพิมพ์ทันที`
                    : 'มุมมองการ์ดสำหรับสมาร์ตโฟน อ่านง่ายไม่ต้องเลื่อนซ้าย-ขวา'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void printReport(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
              >
                <Printer size={14} />
                <span>สั่งพิมพ์ A4 / PDF</span>
              </button>
            </div>
          </div>

          {/* MODE A: Smartphone Easy-Read Card View */}
          {displayMode === 'mobile' ? (
            <div className="grid gap-3">
              {(reportView === 'attendance' || reportView === 'subject-attendance') &&
                activeAttendanceGrid.rows.map((row, idx) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={row.student.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          {idx + 1}. {row.studentName}
                        </p>
                        <p className="text-xs font-bold text-slate-500">รหัสประจำตัว: {row.studentCode}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          row.attendancePercent >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        มาเรียน {row.attendancePercent}%
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-black">
                      <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800">
                        <span className="block text-[10px] text-emerald-600">มา</span>
                        {row.totals.present}
                      </div>
                      <div className="rounded-xl bg-amber-50 p-2 text-amber-800">
                        <span className="block text-[10px] text-amber-600">สาย</span>
                        {row.totals.late}
                      </div>
                      <div className="rounded-xl bg-sky-50 p-2 text-sky-800">
                        <span className="block text-[10px] text-sky-600">ลา/ป่วย</span>
                        {row.totals.leave}
                      </div>
                      <div className="rounded-xl bg-rose-50 p-2 text-rose-800">
                        <span className="block text-[10px] text-rose-600">ขาด</span>
                        {row.totals.absent}
                      </div>
                    </div>
                  </article>
                ))}

              {reportView === 'savings' &&
                savingsGrid.rows.map((row, idx) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={row.studentId}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          {idx + 1}. {row.studentName}
                        </p>
                        <p className="text-xs font-bold text-slate-500">รหัส: {row.studentCode}</p>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-slate-400">ยอดสะสมคงเหลือ</span>
                        <strong className="text-base font-black text-emerald-700">{row.totalBalance.toLocaleString('th-TH')} ฿</strong>
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="block text-[10px] text-slate-500">ฝากช่วงนี้</span>
                        <strong className="text-teal-700">+{row.depositsInPeriod.toLocaleString('th-TH')}</strong>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="block text-[10px] text-slate-500">ถอนช่วงนี้</span>
                        <strong className="text-rose-600">-{row.withdrawalsInPeriod.toLocaleString('th-TH')}</strong>
                      </div>
                      <div className="rounded-xl bg-cyan-50 p-2">
                        <span className="block text-[10px] text-cyan-700">สุทธิช่วงนี้</span>
                        <strong className="text-cyan-900">{row.totalPeriodNet.toLocaleString('th-TH')} ฿</strong>
                      </div>
                    </div>
                  </article>
                ))}

              {reportView === 'scores' &&
                studentCrossSubjectRows.map((row, idx) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={row.student.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          {idx + 1}. {row.studentName}
                        </p>
                        <p className="text-xs font-bold text-slate-500">รหัส: {row.studentCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-800">
                          GPA {row.gpa}
                        </span>
                        {row.totalMissing > 0 ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">
                            ค้าง {row.totalMissing}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-xs">
                      {scoreSubjectOptions.map((sub) => {
                        const sd = row.bySubject[sub];
                        return (
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 font-bold" key={sub}>
                            <span className="truncate text-slate-700">{sub}</span>
                            <span className="font-black text-teal-800">
                              {sd && sd.max > 0 ? `${sd.percent}% (เกรด ${sd.grade})` : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}

              {reportView === 'subject-scores' &&
                classroomStudents.map((student, idx) => {
                  const assessments = classroomScoreAssessments.filter(
                    (a) => !selectedSubjectName || a.subject_name === selectedSubjectName,
                  );
                  const totalMax = assessments.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
                  let totalEarned = 0;
                  let missing = 0;
                  assessments.forEach((a) => {
                    const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
                    const val = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : NaN;
                    if (!Number.isNaN(val)) totalEarned += val;
                    else missing += 1;
                  });
                  const pct = totalMax > 0 ? Math.min(100, round((totalEarned / totalMax) * 100)) : 0;
                  const grade = totalMax > 0 && missing < assessments.length ? calculateOBECGrade(pct).grade : '-';

                  return (
                    <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={student.id}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-slate-950">
                          {idx + 1}. {getStudentFullName(student)}
                        </p>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">
                          รวม {round(totalEarned)}/{totalMax} ({pct}% · เกรด {grade})
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                        {assessments.map((a) => {
                          const entry = (scoreEntriesByAssessment.get(a.id) || []).find((e) => e.student_id === student.id);
                          const val = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : null;
                          return (
                            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 font-bold" key={a.id}>
                              <span className="truncate text-slate-600">{a.title}</span>
                              <span className={val !== null ? 'font-black text-slate-900' : 'font-black text-rose-600'}>
                                {val !== null ? `${val}/${a.max_score}` : 'ค้างส่ง'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}

              {reportView === 'health' &&
                healthSummaryRows.map((row, idx) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={row.student.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-slate-950">
                        {idx + 1}. {getStudentFullName(row.student)}
                      </p>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                        BMI {row.bmi ?? '-'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-600">
                      น้ำหนัก {row.weightKg ?? '-'} กก. · ส่วนสูง {row.heightCm ?? '-'} ซม.
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs font-bold">
                      <div className="rounded-xl bg-slate-50 p-1.5">แปรงฟัน {row.brushing.completed}/{row.brushing.total}</div>
                      <div className="rounded-xl bg-slate-50 p-1.5">ดื่มนม {row.milk.completed}/{row.milk.total}</div>
                      <div className="rounded-xl bg-slate-50 p-1.5">อาหาร {row.lunch.completed}/{row.lunch.total}</div>
                    </div>
                  </article>
                ))}

              {reportView === 'student-register' &&
                classroomStudents.map((student, idx) => (
                  <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={student.id}>
                    <p className="text-sm font-black text-slate-950">
                      {idx + 1}. {getStudentFullName(student)} ({student.student_code || '-'})
                    </p>
                    <div className="mt-2 grid gap-1 text-xs font-bold text-slate-600">
                      {activeRegisterFields.map((field) => (
                        <p key={field}>
                          <span className="text-slate-400">{registerFieldLabels[field]}: </span>
                          {getRegisterFieldValue(student, field, classroomGuardians, registerHealthRows, revealCitizenIds)}
                        </p>
                      ))}
                    </div>
                  </article>
                ))}

              {reportView === 'behavior' &&
                (behaviorReportRows.length > 0 ? (
                  behaviorReportRows.map((row) => {
                    const st = studentById.get(row.student_id);
                    return (
                      <article className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs" key={row.id}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black text-slate-950">{st ? getStudentFullName(st) : '-'}</p>
                          <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-black text-cyan-800">
                            {toneLabels[row.tone]} ({Number(row.points) > 0 ? `+${row.points}` : row.points})
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {row.category}: {row.description}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          {formatThaiOfficialShortDate(row.behavior_date)} · {followUpLabels[row.follow_up_status]}
                        </p>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
                    ไม่พบบันทึกพฤติกรรมที่ต้องติดตามในช่วงเวลานี้
                  </div>
                ))}

              {reportView === 'individual' && selectedStudentBundle && (
                <article className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {getStudentFullName(selectedStudentBundle.student)} ({selectedStudentBundle.student.nickname || '-'})
                      </p>
                      <p className="text-xs font-bold text-slate-500">
                        รหัสประจำตัว: {selectedStudentBundle.student.student_code || '-'} · ชั้น {selectedClassroom?.name || '-'}
                      </p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-800">
                      เลือกแสดง {activeIndividualSectionCount} หัวข้อ
                    </span>
                  </div>

                  {individualSections.guardian && (
                    <div className="rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-700">
                      <span className="text-slate-500">ผู้ปกครอง: </span>
                      {selectedStudentBundle.guardianText}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    {individualSections.attendance && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                        <span className="block text-[10px] font-bold text-emerald-700">อัตราเวลาเรียน</span>
                        <strong className="text-lg font-black text-emerald-900">{selectedStudentBundle.attendance.percent}%</strong>
                        <span className="block text-[10px] font-bold text-emerald-700">
                          มา {selectedStudentBundle.attendance.present} · สาย {selectedStudentBundle.attendance.late} · ลา{' '}
                          {selectedStudentBundle.attendance.leave} · ขาด {selectedStudentBundle.attendance.absent}
                        </span>
                      </div>
                    )}
                    {individualSections.scores && (
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-2.5">
                        <span className="block text-[10px] font-bold text-indigo-700">เกรดเฉลี่ย (GPA)</span>
                        <strong className="text-lg font-black text-indigo-900">{selectedStudentBundle.totalGpa}</strong>
                        <span className="block text-[10px] font-bold text-indigo-700">
                          {selectedStudentBundle.subjectRows.length} รายวิชา
                        </span>
                      </div>
                    )}
                    {individualSections.savings && (
                      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-2.5">
                        <span className="block text-[10px] font-bold text-teal-700">เงินออมสะสม</span>
                        <strong className="text-lg font-black text-teal-900">
                          {selectedStudentBundle.savings.balance.toLocaleString('th-TH')} ฿
                        </strong>
                        <span className="block text-[10px] font-bold text-teal-700">
                          ฝาก {selectedStudentBundle.savings.deposits.toLocaleString('th-TH')} · ถอน{' '}
                          {selectedStudentBundle.savings.withdrawals.toLocaleString('th-TH')}
                        </span>
                      </div>
                    )}
                    {individualSections.health && (
                      <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-2.5">
                        <span className="block text-[10px] font-bold text-cyan-700">สุขภาพและกิจวัตร</span>
                        <strong className="text-sm font-black text-cyan-950">{selectedStudentBundle.health.attentionText}</strong>
                        <span className="block text-[10px] font-bold text-cyan-700">
                          นน. {selectedStudentBundle.health.weight ?? '-'} กก. · สส. {selectedStudentBundle.health.height ?? '-'} ซม.
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              )}

              {(reportView === 'individual' || reportView === 'executive') && (
                <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 text-center text-xs font-black text-teal-900">
                  กำลังแสดงผลใบรายงานมาตรฐาน A4 ย่อส่วนพอดีหน้าจอมือถือด้านล่าง
                </div>
              )}
            </div>
          ) : null}

          {/* MODE B: Live A4 Official Paper Preview (Always rendered for A4 mode, and also for Individual/Executive on mobile) */}
          {(displayMode === 'a4' || reportView === 'individual' || reportView === 'executive') ? (
            <div className="overflow-x-auto rounded-3xl border border-slate-300 bg-slate-200/80 p-2.5 shadow-inner sm:p-6">
              <div
                className={`mx-auto bg-white text-slate-900 shadow-xl ring-1 ring-slate-300 transition-all ${
                  pageOrientation === 'landscape'
                    ? 'min-w-[820px] max-w-[1120px] p-5 sm:p-8'
                    : 'min-w-[640px] max-w-[820px] p-5 sm:p-8'
                }`}
                style={{ fontFamily: "'TH Sarabun New', 'Sarabun', sans-serif" }}
              >
                {/* Official A4 Sheet Header */}
                <header className="grid grid-cols-[64px_1fr_64px] items-center border-b-2 border-cyan-700 pb-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white">
                    {reportIdentity.schoolLogoDataUrl ? (
                      <img alt="ตราโรงเรียน" className="h-full w-full object-contain" src={reportIdentity.schoolLogoDataUrl} />
                    ) : (
                      <span className="text-[10px] font-black leading-tight text-slate-500">
                        ตรา
                        <br />
                        โรงเรียน
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-950 sm:text-2xl">{activeReportConfig.label}</h3>
                    <p className="text-sm font-black text-cyan-900">
                      {reportIdentity.schoolName || session.workspace?.schoolName || 'โรงเรียน'}
                    </p>
                    <p className="text-xs font-bold text-slate-600">
                      ชั้น {selectedClassroom?.name || '-'} · ปีการศึกษา {selectedClassroom?.academic_year || reportIdentity.academicYear || '2569'} · ช่วงข้อมูล{' '}
                      {formatThaiOfficialShortDate(dateFrom)} ถึง {formatThaiOfficialShortDate(dateTo)}
                    </p>
                  </div>
                  <div className="text-right text-[10px] font-black text-slate-400">A4</div>
                </header>

                {/* Sheet Body by Report View */}
                <div className="mt-4">
                  {/* 1 & 2: Attendance & Subject Attendance on A4 */}
                  {(reportView === 'attendance' || reportView === 'subject-attendance') && (
                    <div>
                      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">มาเรียน (ครั้ง)</span>
                          <strong className="text-base font-black text-emerald-700">{activeAttendanceGrid.summary.present}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">มาสาย (ครั้ง)</span>
                          <strong className="text-base font-black text-amber-700">{activeAttendanceGrid.summary.late}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">ลา / ป่วย (ครั้ง)</span>
                          <strong className="text-base font-black text-sky-700">{activeAttendanceGrid.summary.leave}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">ขาดเรียน (ครั้ง)</span>
                          <strong className="text-base font-black text-rose-700">{activeAttendanceGrid.summary.absent}</strong>
                        </div>
                      </div>

                      {isMultiMonthMode ? (
                        <table className="w-full border-collapse border border-slate-300 text-xs">
                          <thead>
                            <tr className="bg-cyan-50 text-slate-900">
                              <th className="border border-slate-300 px-1.5 py-2 text-center w-8">ที่</th>
                              <th className="border border-slate-300 px-2 py-2 text-center w-16">รหัส</th>
                              <th className="border border-slate-300 px-2.5 py-2 text-left">ชื่อ - นามสกุล</th>
                              {activeAttendanceGrid.monthBuckets.map((mb) => (
                                <th className="border border-slate-300 px-1 py-2 text-center" key={mb.key}>
                                  {mb.shortLabel}
                                  <span className="block text-[9px] font-normal text-slate-500">(มา/รวม)</span>
                                </th>
                              ))}
                              <th className="border border-slate-300 bg-emerald-50 px-1.5 py-2 text-center text-emerald-800">มา</th>
                              <th className="border border-slate-300 bg-amber-50 px-1.5 py-2 text-center text-amber-800">สาย</th>
                              <th className="border border-slate-300 bg-sky-50 px-1.5 py-2 text-center text-sky-800">ลา</th>
                              <th className="border border-slate-300 bg-rose-50 px-1.5 py-2 text-center text-rose-800">ขาด</th>
                              <th className="border border-slate-300 bg-cyan-100 px-1.5 py-2 text-center font-black">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeAttendanceGrid.rows.map((row, idx) => (
                              <tr className="even:bg-slate-50/70" key={row.student.id}>
                                <td className="border border-slate-300 px-1 py-1.5 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 px-1.5 py-1.5 text-center font-bold">{row.studentCode}</td>
                                <td className="border border-slate-300 px-2 py-1.5 font-bold">{row.studentName}</td>
                                {activeAttendanceGrid.monthBuckets.map((mb) => {
                                  const mc = row.monthlyCounts[mb.key] || { absent: 0, late: 0, leave: 0, present: 0, total: 0 };
                                  const att = mc.present + mc.late;
                                  return (
                                    <td className="border border-slate-300 px-1 py-1.5 text-center font-bold" key={mb.key}>
                                      {mc.total > 0 ? `${att}/${mc.total}` : '-'}
                                    </td>
                                  );
                                })}
                                <td className="border border-slate-300 px-1 py-1.5 text-center font-black text-emerald-700">{row.totals.present}</td>
                                <td className="border border-slate-300 px-1 py-1.5 text-center font-black text-amber-700">{row.totals.late}</td>
                                <td className="border border-slate-300 px-1 py-1.5 text-center font-black text-sky-700">{row.totals.leave}</td>
                                <td className="border border-slate-300 px-1 py-1.5 text-center font-black text-rose-700">{row.totals.absent}</td>
                                <td className="border border-slate-300 bg-cyan-50/50 px-1.5 py-1.5 text-center font-black">{row.attendancePercent}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full border-collapse border border-slate-300 text-[11px]">
                          <thead>
                            <tr className="bg-cyan-50 text-slate-900">
                              <th className="border border-slate-300 px-1 py-1.5 text-center w-7">ที่</th>
                              <th className="border border-slate-300 px-2 py-1.5 text-left w-44">ชื่อ - นามสกุล</th>
                              {monthContext.days.map((day) => (
                                <th
                                  className={`border border-slate-300 px-0.5 py-1.5 text-center ${
                                    day.isWeekend ? 'bg-slate-200/70 text-slate-500' : ''
                                  }`}
                                  key={day.day}
                                >
                                  {day.day}
                                </th>
                              ))}
                              <th className="border border-slate-300 bg-emerald-50 px-1 py-1.5 text-center">มา</th>
                              <th className="border border-slate-300 bg-amber-50 px-1 py-1.5 text-center">สาย</th>
                              <th className="border border-slate-300 bg-sky-50 px-1 py-1.5 text-center">ลา</th>
                              <th className="border border-slate-300 bg-rose-50 px-1 py-1.5 text-center">ขาด</th>
                              <th className="border border-slate-300 bg-cyan-100 px-1 py-1.5 text-center">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeAttendanceGrid.rows.map((row, idx) => (
                              <tr className="even:bg-slate-50/70" key={row.student.id}>
                                <td className="border border-slate-300 px-1 py-1 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 px-2 py-1 font-bold whitespace-nowrap">{row.studentName}</td>
                                {monthContext.days.map((day) => {
                                  const st = row.dailyStatuses[day.dateKey];
                                  return (
                                    <td
                                      className={`border border-slate-300 px-0.5 py-1 text-center font-black ${
                                        day.isWeekend ? 'bg-slate-100 text-slate-400' : ''
                                      } ${
                                        st === 'present' || st === 'activity'
                                          ? 'text-emerald-700'
                                          : st === 'late'
                                            ? 'text-amber-700'
                                            : st === 'leave' || st === 'sick'
                                              ? 'text-sky-700'
                                              : st === 'absent'
                                                ? 'text-rose-700'
                                                : ''
                                      }`}
                                      key={day.dateKey}
                                    >
                                      {st ? monthlyStatusAbbreviations[st] : ''}
                                    </td>
                                  );
                                })}
                                <td className="border border-slate-300 px-1 py-1 text-center font-black text-emerald-700">{row.totals.present}</td>
                                <td className="border border-slate-300 px-1 py-1 text-center font-black text-amber-700">{row.totals.late}</td>
                                <td className="border border-slate-300 px-1 py-1 text-center font-black text-sky-700">{row.totals.leave}</td>
                                <td className="border border-slate-300 px-1 py-1 text-center font-black text-rose-700">{row.totals.absent}</td>
                                <td className="border border-slate-300 bg-cyan-50/40 px-1 py-1 text-center font-black">{row.attendancePercent}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* 3: Savings on A4 */}
                  {reportView === 'savings' && (
                    <div>
                      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">นักเรียนทั้งหมด</span>
                          <strong className="text-base font-black text-slate-900">{savingsGrid.totalStudents} คน</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">มีบัญชี/ออมเงิน</span>
                          <strong className="text-base font-black text-cyan-700">{savingsGrid.totalActiveSavingsStudents} คน</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">ออมสุทธิช่วงนี้</span>
                          <strong className="text-base font-black text-teal-700">{savingsGrid.totalPeriodNet.toLocaleString('th-TH')} บาท</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 py-1.5">
                          <span className="block font-bold text-slate-500">ยอดสะสมคงเหลือรวม</span>
                          <strong className="text-base font-black text-emerald-700">{savingsGrid.totalCumulativeBalance.toLocaleString('th-TH')} บาท</strong>
                        </div>
                      </div>

                      {isMultiMonthMode ? (
                        <table className="w-full border-collapse border border-slate-300 text-xs">
                          <thead>
                            <tr className="bg-cyan-50 text-slate-900">
                              <th className="border border-slate-300 px-1.5 py-2 text-center w-8">ที่</th>
                              <th className="border border-slate-300 px-2 py-2 text-center w-16">รหัส</th>
                              <th className="border border-slate-300 px-2.5 py-2 text-left">ชื่อ - นามสกุล</th>
                              {savingsGrid.monthBuckets.map((mb) => (
                                <th className="border border-slate-300 px-1 py-2 text-center" key={mb.key}>
                                  {mb.shortLabel}
                                </th>
                              ))}
                              <th className="border border-slate-300 bg-teal-50 px-2 py-2 text-right">ฝากรวม</th>
                              <th className="border border-slate-300 bg-rose-50 px-2 py-2 text-right">ถอนรวม</th>
                              <th className="border border-slate-300 bg-emerald-100 px-2 py-2 text-right font-black">ยอดสะสมคงเหลือ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {savingsGrid.rows.map((row, idx) => (
                              <tr className="even:bg-slate-50/70" key={row.studentId}>
                                <td className="border border-slate-300 px-1 py-1.5 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 px-1.5 py-1.5 text-center font-bold">{row.studentCode}</td>
                                <td className="border border-slate-300 px-2 py-1.5 font-bold">{row.studentName}</td>
                                {savingsGrid.monthBuckets.map((mb) => {
                                  const net = row.monthlyNet[mb.key] || 0;
                                  return (
                                    <td className="border border-slate-300 px-1 py-1.5 text-center font-bold" key={mb.key}>
                                      {net !== 0 ? net.toLocaleString('th-TH') : '-'}
                                    </td>
                                  );
                                })}
                                <td className="border border-slate-300 px-2 py-1.5 text-right font-bold text-teal-700">
                                  {row.depositsInPeriod.toLocaleString('th-TH')}
                                </td>
                                <td className="border border-slate-300 px-2 py-1.5 text-right font-bold text-rose-700">
                                  {row.withdrawalsInPeriod.toLocaleString('th-TH')}
                                </td>
                                <td className="border border-slate-300 bg-emerald-50/50 px-2 py-1.5 text-right font-black text-emerald-800">
                                  {row.totalBalance.toLocaleString('th-TH')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full border-collapse border border-slate-300 text-[11px]">
                          <thead>
                            <tr className="bg-cyan-50 text-slate-900">
                              <th className="border border-slate-300 px-1 py-1.5 text-center w-7">ที่</th>
                              <th className="border border-slate-300 px-2 py-1.5 text-left w-44">ชื่อ - นามสกุล</th>
                              {monthContext.days.map((day) => (
                                <th
                                  className={`border border-slate-300 px-0.5 py-1.5 text-center ${
                                    day.isWeekend ? 'bg-slate-200/70 text-slate-500' : ''
                                  }`}
                                  key={day.day}
                                >
                                  {day.day}
                                </th>
                              ))}
                              <th className="border border-slate-300 bg-cyan-100 px-2 py-1.5 text-right">รวมเดือนนี้</th>
                              <th className="border border-slate-300 bg-emerald-100 px-2 py-1.5 text-right">ยอดสะสมคงเหลือ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {savingsGrid.rows.map((row, idx) => (
                              <tr className="even:bg-slate-50/70" key={row.studentId}>
                                <td className="border border-slate-300 px-1 py-1 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 px-2 py-1 font-bold whitespace-nowrap">{row.studentName}</td>
                                {monthContext.days.map((day) => {
                                  const amt = row.dailyAmounts[day.dateKey];
                                  return (
                                    <td
                                      className={`border border-slate-300 px-0.5 py-1 text-center font-bold ${
                                        day.isWeekend ? 'bg-slate-100 text-slate-400' : 'text-teal-800'
                                      }`}
                                      key={day.dateKey}
                                    >
                                      {amt ? amt : ''}
                                    </td>
                                  );
                                })}
                                <td className="border border-slate-300 bg-cyan-50/40 px-2 py-1 text-right font-black text-cyan-900">
                                  {row.totalPeriodNet.toLocaleString('th-TH')}
                                </td>
                                <td className="border border-slate-300 bg-emerald-50/50 px-2 py-1 text-right font-black text-emerald-800">
                                  {row.totalBalance.toLocaleString('th-TH')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* 4: Classroom All-Subjects Scores on A4 */}
                  {reportView === 'scores' && (
                    <div>
                      <table className="w-full border-collapse border border-slate-300 text-xs">
                        <thead>
                          <tr className="bg-cyan-50 text-slate-900">
                            <th className="border border-slate-300 px-2 py-2 text-center w-10">ที่</th>
                            <th className="border border-slate-300 px-2 py-2 text-center w-20">รหัส</th>
                            <th className="border border-slate-300 px-3 py-2 text-left">ชื่อ - นามสกุล</th>
                            {scoreSubjectOptions.map((sub) => (
                              <th className="border border-slate-300 px-2 py-2 text-center" key={sub}>
                                {sub}
                                <span className="block text-[10px] font-normal text-slate-500">(% / เกรด)</span>
                              </th>
                            ))}
                            <th className="border border-slate-300 bg-cyan-100 px-2 py-2 text-center font-black w-20">GPA</th>
                            <th className="border border-slate-300 bg-rose-50 px-2 py-2 text-center font-black w-20">งานค้าง</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentCrossSubjectRows.map((row, idx) => (
                            <tr className="even:bg-slate-50/70" key={row.student.id}>
                              <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                              <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{row.studentCode}</td>
                              <td className="border border-slate-300 px-3 py-1.5 font-bold">{row.studentName}</td>
                              {scoreSubjectOptions.map((sub) => {
                                const sd = row.bySubject[sub];
                                return (
                                  <td className="border border-slate-300 px-2 py-1.5 text-center font-bold" key={sub}>
                                    {sd && sd.max > 0 ? `${sd.percent}% (${sd.grade})` : '-'}
                                  </td>
                                );
                              })}
                              <td className="border border-slate-300 bg-cyan-50/40 px-2 py-1.5 text-center font-black text-cyan-900">
                                {row.gpa}
                              </td>
                              <td className="border border-slate-300 px-2 py-1.5 text-center font-bold text-rose-700">
                                {row.totalMissing > 0 ? `${row.totalMissing} งาน` : 'ครบ'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {scoreAssessmentRows.length > 0 ? (
                        <div className="mt-4">
                          <h4 className="mb-1.5 text-xs font-black text-slate-700">
                            สรุปชุดการประเมินทั้งหมด ({scoreAssessmentRows.length} รายการ)
                          </h4>
                          <table className="w-full border-collapse border border-slate-300 text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-slate-800">
                                <th className="border border-slate-300 px-2 py-1.5 text-center w-10">ที่</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-left">รายวิชา</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-left">ชื่อรายการประเมิน</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center">ประเภท</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center">คะแนนเต็ม</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center">เฉลี่ย</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center">กรอกแล้ว</th>
                                <th className="border border-slate-300 px-2 py-1.5 text-center">ค้างส่ง</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scoreAssessmentRows.map((row, idx) => (
                                <tr className="even:bg-slate-50" key={row.assessment.id}>
                                  <td className="border border-slate-300 px-2 py-1 text-center">{idx + 1}</td>
                                  <td className="border border-slate-300 px-2 py-1 font-bold">{row.assessment.subject_name}</td>
                                  <td className="border border-slate-300 px-2 py-1">{row.assessment.title}</td>
                                  <td className="border border-slate-300 px-2 py-1 text-center">{scoreCategoryLabels[row.assessment.category]}</td>
                                  <td className="border border-slate-300 px-2 py-1 text-center font-bold">{row.assessment.max_score}</td>
                                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-teal-800">
                                    {row.averageScore} ({row.averagePercent}%)
                                  </td>
                                  <td className="border border-slate-300 px-2 py-1 text-center">{row.enteredCount} คน</td>
                                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-rose-600">{row.missingCount} คน</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* 5: Subject Scores on A4 */}
                  {reportView === 'subject-scores' && (
                    <div>
                      {(() => {
                        const assessments = classroomScoreAssessments.filter(
                          (a) => !selectedSubjectName || a.subject_name === selectedSubjectName,
                        );
                        const totalMax = assessments.reduce((sum, a) => sum + Number(a.max_score || 0), 0);
                        return (
                          <table className="w-full border-collapse border border-slate-300 text-xs">
                            <thead>
                              <tr className="bg-cyan-50 text-slate-900">
                                <th className="border border-slate-300 px-2 py-2 text-center w-10">ที่</th>
                                <th className="border border-slate-300 px-2 py-2 text-center w-20">รหัส</th>
                                <th className="border border-slate-300 px-3 py-2 text-left">ชื่อ - นามสกุล</th>
                                {assessments.map((a) => (
                                  <th className="border border-slate-300 px-2 py-2 text-center" key={a.id}>
                                    {a.title}
                                    <span className="block text-[10px] font-normal text-slate-500">({a.max_score})</span>
                                  </th>
                                ))}
                                <th className="border border-slate-300 bg-cyan-100 px-2 py-2 text-center font-black">
                                  รวม ({totalMax})
                                </th>
                                <th className="border border-slate-300 bg-cyan-100 px-2 py-2 text-center font-black">ร้อยละ</th>
                                <th className="border border-slate-300 bg-emerald-100 px-2 py-2 text-center font-black">เกรด</th>
                                <th className="border border-slate-300 bg-rose-50 px-2 py-2 text-center font-black">งานค้าง</th>
                              </tr>
                            </thead>
                            <tbody>
                              {classroomStudents.map((student, idx) => {
                                let totalScore = 0;
                                let missingCount = 0;
                                return (
                                  <tr className="even:bg-slate-50/70" key={student.id}>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{student.student_code || '-'}</td>
                                    <td className="border border-slate-300 px-3 py-1.5 font-bold">{getStudentFullName(student)}</td>
                                    {assessments.map((a) => {
                                      const entry = (scoreEntriesByAssessment.get(a.id) || []).find(
                                        (e) => e.student_id === student.id,
                                      );
                                      const val = entry?.score !== null && entry?.score !== undefined ? Number(entry.score) : NaN;
                                      if (!Number.isNaN(val)) {
                                        totalScore += val;
                                      } else {
                                        missingCount += 1;
                                      }
                                      return (
                                        <td className="border border-slate-300 px-2 py-1.5 text-center font-bold" key={a.id}>
                                          {!Number.isNaN(val) ? val : <span className="text-rose-500">-</span>}
                                        </td>
                                      );
                                    })}
                                    {(() => {
                                      const pct = totalMax > 0 ? Math.min(100, round((totalScore / totalMax) * 100)) : 0;
                                      const grade =
                                        assessments.length > 0 && missingCount < assessments.length && totalMax > 0
                                          ? calculateOBECGrade(pct).grade
                                          : '-';
                                      return (
                                        <>
                                          <td className="border border-slate-300 bg-cyan-50/40 px-2 py-1.5 text-center font-black">
                                            {round(totalScore)}
                                          </td>
                                          <td className="border border-slate-300 bg-cyan-50/40 px-2 py-1.5 text-center font-bold">
                                            {pct}%
                                          </td>
                                          <td className="border border-slate-300 bg-emerald-50/50 px-2 py-1.5 text-center font-black text-emerald-800">
                                            {grade}
                                          </td>
                                          <td className="border border-slate-300 px-2 py-1.5 text-center font-bold text-rose-700">
                                            {missingCount > 0 ? `${missingCount} ช่อง` : 'ครบ'}
                                          </td>
                                        </>
                                      );
                                    })()}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  )}

                  {/* 6: Individual Student Report on A4 */}
                  {reportView === 'individual' && selectedStudentBundle && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
                        <div>
                          <strong>ชื่อ - นามสกุล:</strong> {getStudentFullName(selectedStudentBundle.student)} (
                          {selectedStudentBundle.student.nickname || '-'})
                        </div>
                        <div>
                          <strong>เลขประจำตัว:</strong> {selectedStudentBundle.student.student_code || '-'} · <strong>ชั้น:</strong>{' '}
                          {selectedClassroom?.name || '-'}
                        </div>
                        {individualSections.health ? (
                          <div>
                            <strong>สุขภาพล่าสุด:</strong> น้ำหนัก {selectedStudentBundle.health.weight ?? '-'} กก. · ส่วนสูง{' '}
                            {selectedStudentBundle.health.height ?? '-'} ซม. · BMI {selectedStudentBundle.health.bmi ?? '-'}
                          </div>
                        ) : null}
                        {individualSections.guardian ? (
                          <div>
                            <strong>ผู้ปกครอง:</strong> {selectedStudentBundle.guardianText}
                          </div>
                        ) : null}
                      </div>

                      {(() => {
                        const kpiCards = [
                          individualSections.attendance ? (
                            <div className="rounded-xl border border-slate-300 bg-white p-2" key="attendance">
                              <span className="block text-[11px] font-bold text-slate-500">เวลาเรียน</span>
                              <strong className="text-lg font-black text-emerald-700">
                                {selectedStudentBundle.attendance.percent}%
                              </strong>
                              <span className="block text-[10px] text-slate-500">
                                มา {selectedStudentBundle.attendance.present} · สาย {selectedStudentBundle.attendance.late} · ลา{' '}
                                {selectedStudentBundle.attendance.leave} · ขาด {selectedStudentBundle.attendance.absent}
                              </span>
                            </div>
                          ) : null,
                          individualSections.scores ? (
                            <div className="rounded-xl border border-slate-300 bg-white p-2" key="scores">
                              <span className="block text-[11px] font-bold text-slate-500">เกรดเฉลี่ย (GPA)</span>
                              <strong className="text-lg font-black text-indigo-700">{selectedStudentBundle.totalGpa}</strong>
                              <span className="block text-[10px] text-slate-500">
                                {selectedStudentBundle.subjectRows.length} รายวิชา
                              </span>
                            </div>
                          ) : null,
                          individualSections.savings ? (
                            <div className="rounded-xl border border-slate-300 bg-white p-2" key="savings">
                              <span className="block text-[11px] font-bold text-slate-500">เงินออมสะสม</span>
                              <strong className="text-lg font-black text-teal-700">
                                {selectedStudentBundle.savings.balance.toLocaleString('th-TH')} ฿
                              </strong>
                              <span className="block text-[10px] text-slate-500">
                                ฝาก {selectedStudentBundle.savings.deposits.toLocaleString('th-TH')} · ถอน{' '}
                                {selectedStudentBundle.savings.withdrawals.toLocaleString('th-TH')}
                              </span>
                            </div>
                          ) : null,
                          individualSections.health ? (
                            <div className="rounded-xl border border-slate-300 bg-white p-2" key="health">
                              <span className="block text-[11px] font-bold text-slate-500">สุขอนามัย/กิจวัตร</span>
                              <strong className="text-sm font-black text-slate-900">
                                {selectedStudentBundle.health.attentionText}
                              </strong>
                              <span className="block text-[10px] text-slate-500">
                                แปรงฟัน {selectedStudentBundle.health.brushingText} · ดื่มนม {selectedStudentBundle.health.milkText}
                              </span>
                            </div>
                          ) : null,
                        ].filter(Boolean);

                        if (kpiCards.length === 0) return null;
                        const gridColClass =
                          kpiCards.length === 1
                            ? 'grid-cols-1'
                            : kpiCards.length === 2
                              ? 'grid-cols-2'
                              : kpiCards.length === 3
                                ? 'grid-cols-3'
                                : 'grid-cols-4';
                        return <div className={`grid ${gridColClass} gap-2 text-center`}>{kpiCards}</div>;
                      })()}

                      {(() => {
                        let secNo = 1;
                        const hasDetailsSection =
                          individualSections.attendance ||
                          individualSections.savings ||
                          individualSections.health ||
                          individualSections.behavior ||
                          individualSections.homeVisit ||
                          individualSections.teacherComment;

                        return (
                          <>
                            {individualSections.scores ? (
                              <div>
                                <h4 className="mb-1.5 font-black text-slate-900">
                                  {secNo++}. สรุปผลสัมฤทธิ์ทางการเรียนรายวิชา
                                </h4>
                                <table className="w-full border-collapse border border-slate-300 text-xs">
                                  <thead>
                                    <tr className="bg-cyan-50 text-slate-900">
                                      <th className="border border-slate-300 px-2 py-1.5 text-center w-10">ที่</th>
                                      <th className="border border-slate-300 px-3 py-1.5 text-left">รายวิชา</th>
                                      <th className="border border-slate-300 px-2 py-1.5 text-center">คะแนนที่ได้ / เต็ม</th>
                                      <th className="border border-slate-300 px-2 py-1.5 text-center">ร้อยละ</th>
                                      <th className="border border-slate-300 px-2 py-1.5 text-center">เกรด</th>
                                      <th className="border border-slate-300 px-2 py-1.5 text-center">การส่งงาน</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedStudentBundle.subjectRows.length > 0 ? (
                                      selectedStudentBundle.subjectRows.map((sub, idx) => (
                                        <tr className="even:bg-slate-50" key={sub.subject}>
                                          <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                                          <td className="border border-slate-300 px-3 py-1.5 font-bold">{sub.subject}</td>
                                          <td className="border border-slate-300 px-2 py-1.5 text-center">
                                            {sub.earned} / {sub.max}
                                          </td>
                                          <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                                            {sub.percent}%
                                          </td>
                                          <td className="border border-slate-300 px-2 py-1.5 text-center font-black text-emerald-800">
                                            {sub.grade}
                                          </td>
                                          <td className="border border-slate-300 px-2 py-1.5 text-center">
                                            {sub.missing > 0 ? `ค้าง ${sub.missing} งาน` : 'ครบ'}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td className="border border-slate-300 py-4 text-center text-slate-500" colSpan={6}>
                                          ยังไม่มีรายการประเมินคะแนน
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}

                            {hasDetailsSection ? (
                              <div>
                                <h4 className="mb-1.5 font-black text-slate-900">
                                  {secNo++}. สรุปข้อมูลพัฒนาการและการดูแลช่วยเหลือนักเรียน
                                </h4>
                                <table className="w-full border-collapse border border-slate-300 text-xs">
                                  <tbody>
                                    {individualSections.attendance ? (
                                      <tr className="even:bg-slate-50">
                                        <td className="w-40 border border-slate-300 px-3 py-1.5 font-black text-slate-800">
                                          สรุปเวลาเรียน
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5">
                                          มาเรียน <strong>{selectedStudentBundle.attendance.present}</strong> วัน · สาย{' '}
                                          <strong>{selectedStudentBundle.attendance.late}</strong> วัน · ลา/ป่วย{' '}
                                          <strong>{selectedStudentBundle.attendance.leave}</strong> วัน · ขาดเรียน{' '}
                                          <strong>{selectedStudentBundle.attendance.absent}</strong> วัน (คิดเป็นร้อยละ{' '}
                                          <strong>{selectedStudentBundle.attendance.percent}%</strong>)
                                        </td>
                                      </tr>
                                    ) : null}
                                    {individualSections.savings ? (
                                      <tr className="even:bg-slate-50">
                                        <td className="w-40 border border-slate-300 px-3 py-1.5 font-black text-slate-800">
                                          เงินออมนักเรียน
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5">
                                          ยอดเงินออมสะสมคงเหลือ{' '}
                                          <strong>{selectedStudentBundle.savings.balance.toLocaleString('th-TH')} บาท</strong> ·
                                          ฝากในช่วงนี้ {selectedStudentBundle.savings.deposits.toLocaleString('th-TH')} บาท · ถอน{' '}
                                          {selectedStudentBundle.savings.withdrawals.toLocaleString('th-TH')} บาท (
                                          {selectedStudentBundle.savings.txCount} รายการ)
                                        </td>
                                      </tr>
                                    ) : null}
                                    {individualSections.health ? (
                                      <tr className="even:bg-slate-50">
                                        <td className="w-40 border border-slate-300 px-3 py-1.5 font-black text-slate-800">
                                          สุขภาพและกิจวัตร
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5">
                                          น้ำหนัก {selectedStudentBundle.health.weight ?? '-'} กก. · ส่วนสูง{' '}
                                          {selectedStudentBundle.health.height ?? '-'} ซม. · BMI{' '}
                                          {selectedStudentBundle.health.bmi ?? '-'} · แปรงฟัน{' '}
                                          {selectedStudentBundle.health.brushingText} ครั้ง · ดื่มนม{' '}
                                          {selectedStudentBundle.health.milkText} ครั้ง · อาหารกลางวัน{' '}
                                          {selectedStudentBundle.health.lunchText} ครั้ง · ผลตรวจสุขอนามัย:{' '}
                                          {selectedStudentBundle.health.attentionText}
                                        </td>
                                      </tr>
                                    ) : null}
                                    {individualSections.behavior ? (
                                      <tr className="even:bg-slate-50">
                                        <td className="w-40 border border-slate-300 px-3 py-1.5 font-black text-slate-800">
                                          พฤติกรรมและการดูแล
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5">
                                          {selectedStudentBundle.behaviors.length > 0
                                            ? selectedStudentBundle.behaviors
                                                .map((b) => `${b.category} (${b.description})`)
                                                .join(' · ')
                                            : 'ประพฤติตนเรียบร้อยตามระเบียบของสถานศึกษา'}
                                        </td>
                                      </tr>
                                    ) : null}
                                    {individualSections.homeVisit ? (
                                      <tr className="even:bg-slate-50">
                                        <td className="w-40 border border-slate-300 px-3 py-1.5 font-black text-slate-800">
                                          การเยี่ยมบ้าน / กสศ.
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5">
                                          {selectedStudentBundle.homeVisit
                                            ? `ดำเนินการแล้ว (${selectedStudentBundle.homeVisit.completion_percent || 100}%)`
                                            : 'อยู่ระหว่างดำเนินการตามแผนเยี่ยมบ้าน'}
                                        </td>
                                      </tr>
                                    ) : null}
                                    {individualSections.teacherComment ? (
                                      <tr className="even:bg-slate-50">
                                        <td className="w-40 border border-slate-300 px-3 py-1.5 font-black text-slate-800">
                                          ความเห็นครูประจำชั้น
                                        </td>
                                        <td className="border border-slate-300 px-3 py-1.5">
                                          {individualTeacherComment.trim() || defaultIndividualTeacherComment}
                                        </td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* 7: Student Register on A4 */}
                  {reportView === 'student-register' && (
                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-cyan-50 text-slate-900">
                          <th className="border border-slate-300 px-2 py-2 text-center w-10">ที่</th>
                          <th className="border border-slate-300 px-2 py-2 text-center w-24">รหัสประจำตัว</th>
                          <th className="border border-slate-300 px-3 py-2 text-left">ชื่อ – นามสกุลนักเรียน</th>
                          {pageOrientation === 'portrait' ? (
                            <th className="border border-slate-300 px-3 py-2 text-left">รายละเอียดข้อมูลทะเบียนที่เลือก</th>
                          ) : (
                            activeRegisterFields.map((field) => (
                              <th className="border border-slate-300 px-2 py-2 text-left" key={field}>
                                {registerFieldLabels[field]}
                              </th>
                            ))
                          )}
                          <th className="border border-slate-300 px-3 py-2 text-center w-32">ลายมือชื่อ / หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classroomStudents.map((student, index) => (
                          <tr className="even:bg-slate-50/70" key={student.id}>
                            <td className="border border-slate-300 px-2 py-2 text-center">{index + 1}</td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-bold">{student.student_code || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2">
                              <p className="font-black text-slate-950">{getStudentFullName(student)}</p>
                              <p className="text-[10px] font-bold text-slate-500">
                                {student.gender === 'male' ? 'ชาย' : student.gender === 'female' ? 'หญิง' : '-'} · เกิด{' '}
                                {formatThaiOfficialShortDate(student.birth_date)}
                              </p>
                            </td>
                            {pageOrientation === 'portrait' ? (
                              <td className="border border-slate-300 px-3 py-2">
                                {activeRegisterFields.length > 0 ? (
                                  activeRegisterFields.map((field) => (
                                    <p className="text-xs font-bold text-slate-700" key={field}>
                                      <span className="text-slate-500">{registerFieldLabels[field]}: </span>
                                      {getRegisterFieldValue(
                                        student,
                                        field,
                                        classroomGuardians,
                                        registerHealthRows,
                                        revealCitizenIds,
                                      )}
                                    </p>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400">สำหรับใช้เช็คชื่อ / เซ็นชื่อ</span>
                                )}
                              </td>
                            ) : (
                              activeRegisterFields.map((field) => (
                                <td className="border border-slate-300 px-2 py-2 text-xs font-bold" key={field}>
                                  {getRegisterFieldValue(student, field, classroomGuardians, registerHealthRows, revealCitizenIds)}
                                </td>
                              ))
                            )}
                            <td className="border border-slate-300 px-2 py-2"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* 8: Health on A4 */}
                  {reportView === 'health' && (
                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-cyan-50 text-slate-900">
                          <th className="border border-slate-300 px-2 py-2 text-center w-10">ที่</th>
                          <th className="border border-slate-300 px-2 py-2 text-center w-20">รหัส</th>
                          <th className="border border-slate-300 px-3 py-2 text-left">ชื่อ - นามสกุล</th>
                          <th className="border border-slate-300 px-2 py-2 text-right">น้ำหนัก</th>
                          <th className="border border-slate-300 px-2 py-2 text-right">ส่วนสูง</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">BMI</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">แปรงฟัน</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">ดื่มนม</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">อาหารกลางวัน</th>
                          <th className="border border-slate-300 px-2 py-2 text-left">ผลตรวจสุขอนามัย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthSummaryRows.map((row, idx) => (
                          <tr className="even:bg-slate-50/70" key={row.student.id}>
                            <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{row.student.student_code || '-'}</td>
                            <td className="border border-slate-300 px-3 py-1.5 font-bold">{getStudentFullName(row.student)}</td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                              {row.weightKg ? `${row.weightKg} กก.` : '-'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5 text-right font-bold">
                              {row.heightCm ? `${row.heightCm} ซม.` : '-'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-black text-emerald-700">
                              {row.bmi ?? '-'}
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                              {row.brushing.completed}/{row.brushing.total}
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                              {row.milk.completed}/{row.milk.total}
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                              {row.lunch.completed}/{row.lunch.total}
                            </td>
                            <td className="border border-slate-300 px-2 py-1.5 font-bold text-slate-700">
                              {row.attentionItems.length > 0
                                ? `ติดตาม: ${row.attentionItems.join(', ')}`
                                : row.latestHygiene?.note || 'ปกติ'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* 9: Behavior on A4 */}
                  {reportView === 'behavior' && (
                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-cyan-50 text-slate-900">
                          <th className="border border-slate-300 px-2 py-2 text-center w-10">ที่</th>
                          <th className="border border-slate-300 px-2 py-2 text-center w-24">วันที่</th>
                          <th className="border border-slate-300 px-3 py-2 text-left">ชื่อ - นามสกุลนักเรียน</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">ประเภท</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">คะแนน</th>
                          <th className="border border-slate-300 px-2 py-2 text-center">การติดตาม</th>
                          <th className="border border-slate-300 px-3 py-2 text-left">หมวดหมู่และรายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {behaviorReportRows.length > 0 ? (
                          behaviorReportRows.map((record, idx) => {
                            const student = studentById.get(record.student_id);
                            return (
                              <tr className="even:bg-slate-50/70" key={record.id}>
                                <td className="border border-slate-300 px-2 py-1.5 text-center">{idx + 1}</td>
                                <td className="border border-slate-300 px-2 py-1.5 text-center">{formatThaiOfficialShortDate(record.behavior_date)}</td>
                                <td className="border border-slate-300 px-3 py-1.5 font-bold">{student ? getStudentFullName(student) : '-'}</td>
                                <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{toneLabels[record.tone]}</td>
                                <td className="border border-slate-300 px-2 py-1.5 text-center font-black">
                                  {Number(record.points) > 0 ? `+${record.points}` : record.points}
                                </td>
                                <td className="border border-slate-300 px-2 py-1.5 text-center">{followUpLabels[record.follow_up_status]}</td>
                                <td className="border border-slate-300 px-3 py-1.5">
                                  <strong>{record.category}:</strong> {record.description}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="border border-slate-300 py-6 text-center font-bold text-slate-500" colSpan={7}>
                              ไม่พบบันทึกพฤติกรรมหรือเคสดูแลในช่วงเวลาที่เลือก
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {/* 10: Executive Summary on A4 */}
                  {reportView === 'executive' && (
                    <div className="space-y-4 text-xs">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-bold text-slate-500">ขอบเขตนักเรียน</span>
                          <strong className="text-lg font-black text-slate-950">{executiveMetrics.studentCount} คน</strong>
                          <span className="block text-[10px] text-slate-500">{executiveMetrics.scopeLabel}</span>
                        </div>
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-bold text-slate-500">อัตราการมาเรียน</span>
                          <strong className="text-lg font-black text-emerald-700">{executiveMetrics.attendanceRate}%</strong>
                          <span className="block text-[10px] text-slate-500">เกณฑ์มาตรฐาน ≥ 90%</span>
                        </div>
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-bold text-slate-500">คะแนนเฉลี่ยรวม</span>
                          <strong className="text-lg font-black text-cyan-800">{executiveMetrics.scoreAverage}%</strong>
                          <span className="block text-[10px] text-slate-500">เกณฑ์มาตรฐาน ≥ 70%</span>
                        </div>
                        <div className="rounded-xl border border-slate-300 bg-slate-50 p-2.5">
                          <span className="block text-[11px] font-bold text-slate-500">รายการต้องติดตาม</span>
                          <strong className="text-lg font-black text-amber-700">
                            {executiveMetrics.behaviorFollowUps + executiveMetrics.healthFollowUps} รายการ
                          </strong>
                          <span className="block text-[10px] text-slate-500">พฤติกรรมและสุขอนามัย</span>
                        </div>
                      </div>

                      <table className="w-full border-collapse border border-slate-300 text-xs">
                        <thead>
                          <tr className="bg-cyan-50 text-slate-900">
                            <th className="border border-slate-300 px-3 py-2 text-left">ด้านการดำเนินงาน</th>
                            <th className="border border-slate-300 px-2 py-2 text-center w-28">ผลดำเนินงาน</th>
                            <th className="border border-slate-300 px-2 py-2 text-center w-28">เกณฑ์กำกับ</th>
                            <th className="border border-slate-300 px-3 py-2 text-left">สาระสำคัญ / แนวทางดำเนินงาน</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-slate-300 px-3 py-2 font-bold">1. เวลาเรียนและการมาเรียน</td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-black">{executiveMetrics.attendanceRate}%</td>
                            <td className="border border-slate-300 px-2 py-2 text-center">ไม่น้อยกว่า 90%</td>
                            <td className="border border-slate-300 px-3 py-2">
                              {executiveMetrics.attendanceRate >= 90
                                ? 'เป็นไปตามเป้าหมาย ติดตามต่อเนื่อง'
                                : 'ติดตามนักเรียนที่ขาดเรียนและประสานผู้ปกครอง'}
                            </td>
                          </tr>
                          <tr className="bg-slate-50/70">
                            <td className="border border-slate-300 px-3 py-2 font-bold">2. ผลสัมฤทธิ์ทางการเรียน</td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-black">{executiveMetrics.scoreAverage}%</td>
                            <td className="border border-slate-300 px-2 py-2 text-center">ไม่น้อยกว่า 70%</td>
                            <td className="border border-slate-300 px-3 py-2">
                              {executiveMetrics.scoreAverage >= 70
                                ? 'เป็นไปตามเป้าหมาย'
                                : 'จัดกิจกรรมสอนเสริมและติดตามงานค้างรายวิชา'}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 px-3 py-2 font-bold">3. สุขภาพและกิจวัตรประจำวัน</td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-black">{executiveMetrics.healthCompletionRate}%</td>
                            <td className="border border-slate-300 px-2 py-2 text-center">ไม่น้อยกว่า 90%</td>
                            <td className="border border-slate-300 px-3 py-2">
                              มีนักเรียนต้องติดตามสุขอนามัย/โภชนาการ {executiveMetrics.healthFollowUps} คน
                            </td>
                          </tr>
                          <tr className="bg-slate-50/70">
                            <td className="border border-slate-300 px-3 py-2 font-bold">4. พฤติกรรมและระบบดูแลช่วยเหลือ</td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-black">{executiveMetrics.behaviorFollowUps} เคส</td>
                            <td className="border border-slate-300 px-2 py-2 text-center">ดูแลครบ 100%</td>
                            <td className="border border-slate-300 px-3 py-2">ครูประจำชั้นติดตามดูแลและบันทึกผลดำเนินงาน</td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 px-3 py-2 font-bold">5. การออมทรัพย์นักเรียน</td>
                            <td className="border border-slate-300 px-2 py-2 text-center font-black">
                              {executiveMetrics.savingsTotal.toLocaleString('th-TH')} บาท
                            </td>
                            <td className="border border-slate-300 px-2 py-2 text-center">บัญชีถูกต้องครบถ้วน</td>
                            <td className="border border-slate-300 px-3 py-2">ตรวจสอบยอดเงินออมคงเหลือตรงกับสมุดคู่ฝาก</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="rounded-xl border border-slate-300 p-3">
                        <p className="font-black text-slate-900">ความเห็น / ข้อสั่งการของผู้บริหารสถานศึกษา:</p>
                        <p className="mt-3 text-slate-400">
                          ..........................................................................................................................................................................................
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Official A4 Sheet Signatures Footer */}
                {reportView !== 'individual' || individualSections.teacherComment ? (
                  <footer className="mt-6 border-t border-slate-300 pt-4">
                    <div className="grid grid-cols-3 gap-4 text-center text-xs">
                      <div>
                        <p>ลงชื่อ ................................................</p>
                        <p className="mt-1 font-bold">
                          ({reportIdentity.teacherName || session.profile.displayName || '............................................'})
                        </p>
                        <p className="text-[11px] text-slate-600">ครูประจำชั้น / ผู้รายงาน</p>
                      </div>
                      <div>
                        <p>ลงชื่อ ................................................</p>
                        <p className="mt-1 font-bold">
                          (
                          {reportView === 'individual'
                            ? reportIdentity.directorName || '............................................'
                            : reportIdentity.academicHeadName || '............................................'}
                          )
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {reportView === 'individual'
                            ? 'ผู้อำนวยการโรงเรียน'
                            : reportView === 'student-register'
                              ? 'นายทะเบียน / ผู้ตรวจสอบ'
                              : 'หัวหน้างานวิชาการ / ผู้ตรวจสอบ'}
                        </p>
                      </div>
                      <div>
                        <p>ลงชื่อ ................................................</p>
                        <p className="mt-1 font-bold">
                          ({reportView === 'individual' ? '............................................' : reportIdentity.directorName || '............................................'})
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {reportView === 'individual' ? 'ผู้ปกครองนักเรียน (ผู้รับทราบ)' : 'ผู้อำนวยการโรงเรียน / ผู้รับรอง'}
                        </p>
                      </div>
                    </div>
                  </footer>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {isLoading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-bold text-slate-600">
          กำลังโหลดและประมวลผลข้อมูลรายงานล่าสุด...
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-xs">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      {/* Sticky Smartphone Bottom Print/Export Bar */}
      {printableReport ? (
        <div className="fixed inset-x-0 bottom-16 z-30 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setDisplayMode((m) => (m === 'a4' ? 'mobile' : 'a4'))}
            className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 px-3 text-xs font-black text-slate-800"
          >
            {displayMode === 'a4' ? <Smartphone size={15} /> : <FileText size={15} />}
            <span>{displayMode === 'a4' ? 'ดูแบบมือถือ' : 'ดูแบบกระดาษ A4'}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void exportExcel()}
              className="inline-flex h-11 items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"
            >
              <Download size={14} />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => void printReport(false)}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm"
            >
              <Printer size={15} />
              <span>พิมพ์ A4 / PDF</span>
            </button>
          </div>
        </div>
      ) : null}

      <OfficialAcademicDocumentsModal
        academicYear={selectedClassroom?.academic_year || reportIdentity.academicYear || '2569'}
        currentClassroomId={classroomId}
        currentClassroomName={selectedClassroom?.name}
        isOpen={isOfficialDocsOpen}
        onClose={() => setIsOfficialDocsOpen(false)}
        session={session}
        term={selectedTerm === 'term1' ? '1' : '2'}
      />

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">ระบบสารสนเทศ ClassCare 360</footer>
    </main>
  );
}

export function ReportsPage(props: ReportsPageProps) {
  return props.session.profile.role === 'viewer' ? <ViewerReportSummary {...props} /> : <TeacherReportsPage {...props} />;
}
