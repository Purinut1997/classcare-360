import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Heart,
  PiggyBank,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';

import { AppLogo } from '../../components/brand/AppLogo';
import { BotanicalCardSprig, BotanicalCornerWatermark, BotanicalEmptyState } from '../../components/shared/BotanicalDecor';
import { isDemoSession } from '../../lib/auth';
import { getBangkokDate } from '../../lib/date';
import { computeAttendanceStreaksAndRates } from '../../lib/studentIntelligence';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

type PortalRole = 'parent' | 'student';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';
type PortalTab = 'attendance' | 'scores' | 'savings' | 'behavior' | 'notifications';
type LeaveType = 'sick' | 'personal' | 'other';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface PortalStudent {
  classroomId: string | null;
  classroomName: string;
  code: string;
  id: string;
  name: string;
  nickname: string;
  relation: string;
  workspaceId: string;
}

interface PortalAttendance {
  date: string;
  id: string;
  note: string;
  period: string;
  sessionId: string;
  status: AttendanceStatus;
  studentId: string;
  subject: string;
}

interface PortalScoreItem {
  assessmentDate: string;
  assessmentId: string;
  category: string;
  id: string;
  maxScore: number;
  note: string | null;
  score: number | null;
  subjectName: string;
  title: string;
  weight: number;
}

interface PortalSavingsTx {
  amount: number;
  id: string;
  note: string | null;
  transactionDate: string;
  transactionType: 'deposit' | 'withdrawal' | 'adjustment';
}

interface PortalBehaviorItem {
  behaviorDate: string;
  category: string;
  description: string;
  followUpStatus: string;
  id: string;
  points: number;
  tone: string;
}

interface PortalDesirableSummary {
  academicYear: string;
  note: string | null;
  readingSummary: number;
  term: string;
  traitSummary: number;
}

interface PortalNotificationItem {
  body: string;
  createdAt: string;
  id: string;
  privacyLevel: string;
  readAt: string | null;
  title: string;
  type: string;
}

interface PortalLeaveRequest {
  classroomId: string;
  createdAt: string;
  endDate: string;
  id: string;
  leaveType: LeaveType;
  reason: string;
  reviewNote: string | null;
  startDate: string;
  status: LeaveStatus;
  studentId: string;
}

interface PortalHomeProps {
  portalRole: PortalRole;
  session: AppSessionContext;
}

const attendanceLabels: Record<AttendanceStatus, string> = {
  absent: 'ขาด',
  activity: 'กิจกรรม',
  late: 'สาย',
  leave: 'ลา',
  present: 'มา',
  sick: 'ป่วย',
};

const leaveTypeLabels: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  other: 'อื่นๆ',
};

const leaveStatusMeta: Record<LeaveStatus, { label: string; badgeClass: string }> = {
  pending: { label: 'รอครูตรวจสอบ', badgeClass: 'border-amber-200 bg-amber-50 text-amber-800' },
  approved: { label: 'ครูรับทราบแล้ว', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'ไม่อนุมัติ', badgeClass: 'border-rose-200 bg-rose-50 text-rose-800' },
  cancelled: { label: 'ยกเลิกแล้ว', badgeClass: 'border-slate-200 bg-slate-100 text-slate-600' },
};

const qualityLevelLabels: Record<number, string> = {
  3: 'ดีเยี่ยม (3)',
  2: 'ดี (2)',
  1: 'ผ่าน (1)',
  0: 'ไม่ผ่าน (0)',
};

const summaryThemes: Record<string, { topBar: string; sprig: string; pill: string }> = {
  present: { topBar: 'bg-[#2F7D5B]', sprig: '#2F7D5B', pill: 'bg-[#E6F4EC] text-[#1C573D] border-[#BFE0CD]' },
  late: { topBar: 'bg-[#D98B26]', sprig: '#D98B26', pill: 'bg-[#FDF4E1] text-[#8B5312] border-[#F0D9AE]' },
  absent: { topBar: 'bg-[#C25970]', sprig: '#C25970', pill: 'bg-[#FBEFF2] text-[#8E354A] border-[#F0CFD7]' },
  leave: { topBar: 'bg-[#2D72A3]', sprig: '#2D72A3', pill: 'bg-[#E9F3FA] text-[#1D547C] border-[#CBE1F2]' },
};

const demoStudents: PortalStudent[] = [
  {
    classroomId: 'demo-room-p5',
    classroomName: 'ป.5/2',
    code: '001',
    id: 'demo-student-1',
    name: 'เด็กหญิงพิมพ์ใจ ใจดี',
    nickname: 'พิม',
    relation: 'บุตรหลาน',
    workspaceId: 'demo-workspace',
  },
  {
    classroomId: 'demo-room-p5',
    classroomName: 'ป.5/2',
    code: '014',
    id: 'demo-student-2',
    name: 'เด็กชายณัฐวุฒิ ตั้งใจ',
    nickname: 'นัท',
    relation: 'บุตรหลาน',
    workspaceId: 'demo-workspace',
  },
];

const demoAttendance: PortalAttendance[] = [
  {
    date: '2026-11-20',
    id: 'demo-att-1',
    note: 'เข้าแถวทันเวลา',
    period: 'เช้า',
    sessionId: 'demo-s-1',
    status: 'present',
    studentId: 'demo-student-1',
    subject: 'โฮมรูม',
  },
  {
    date: '2026-11-19',
    id: 'demo-att-2',
    note: 'มาสาย 10 นาที ผู้ปกครองแจ้งแล้ว',
    period: 'เช้า',
    sessionId: 'demo-s-2',
    status: 'late',
    studentId: 'demo-student-1',
    subject: 'โฮมรูม',
  },
  {
    date: '2026-11-18',
    id: 'demo-att-3',
    note: 'เข้าร่วมกิจกรรมหน้าเสาธง',
    period: 'บ่าย',
    sessionId: 'demo-s-3',
    status: 'activity',
    studentId: 'demo-student-1',
    subject: 'กิจกรรม',
  },
];

const demoScores: PortalScoreItem[] = [
  {
    assessmentDate: '2026-11-15',
    assessmentId: 'demo-as-1',
    category: 'quiz',
    id: 'demo-sc-1',
    maxScore: 20,
    note: 'ทำครบทุกข้อ',
    score: 18,
    subjectName: 'คณิตศาสตร์',
    title: 'ทดสอบย่อยเศษส่วน',
    weight: 20,
  },
  {
    assessmentDate: '2026-11-10',
    assessmentId: 'demo-as-2',
    category: 'assignment',
    id: 'demo-sc-2',
    maxScore: 10,
    note: null,
    score: 9,
    subjectName: 'ภาษาไทย',
    title: 'เขียนย่อความวรรณคดี',
    weight: 10,
  },
  {
    assessmentDate: '2026-11-05',
    assessmentId: 'demo-as-3',
    category: 'project',
    id: 'demo-sc-3',
    maxScore: 30,
    note: 'งานกลุ่มเรียบร้อยดี',
    score: 26,
    subjectName: 'วิทยาศาสตร์',
    title: 'โครงงานระบบนิเวศ',
    weight: 30,
  },
];

const demoSavingsTxs: PortalSavingsTx[] = [
  {
    amount: 50,
    id: 'demo-tx-1',
    note: 'ออมทรัพย์ประจำวัน',
    transactionDate: '2026-11-20',
    transactionType: 'deposit',
  },
  {
    amount: 100,
    id: 'demo-tx-2',
    note: 'ฝากเงินสะสมสัปดาห์นี้',
    transactionDate: '2026-11-13',
    transactionType: 'deposit',
  },
];

const demoBehaviors: PortalBehaviorItem[] = [
  {
    behaviorDate: '2026-11-19',
    category: 'จิตสาธารณะ',
    description: 'ช่วยครูจัดเรียงสมุดงานหลังเลิกเรียน',
    followUpStatus: 'none',
    id: 'demo-bh-1',
    points: 3,
    tone: 'positive',
  },
  {
    behaviorDate: '2026-11-14',
    category: 'ความรับผิดชอบ',
    description: 'ส่งการบ้านตรงเวลาสม่ำเสมอ',
    followUpStatus: 'none',
    id: 'demo-bh-2',
    points: 2,
    tone: 'positive',
  },
];

const demoNotifications: PortalNotificationItem[] = [
  {
    body: 'วันนี้กิจกรรมเข้าแถวและออมทรัพย์ประจำวันเรียบร้อยดีครับ',
    createdAt: '2026-11-20T09:00:00Z',
    id: 'demo-notif-1',
    privacyLevel: 'normal',
    readAt: null,
    title: 'สรุปประจำวันจากครูประจำชั้น',
    type: 'announcement',
  },
];

function computeGradeLabel(percent: number): string {
  if (percent >= 80) return '4';
  if (percent >= 75) return '3.5';
  if (percent >= 70) return '3';
  if (percent >= 65) return '2.5';
  if (percent >= 60) return '2';
  if (percent >= 55) return '1.5';
  if (percent >= 50) return '1';
  return '0';
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
    }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
  } catch {
    return value;
  }
}

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /does not exist|schema cache|not found/i.test(error?.message || '')
  );
}

function mapStudentLink(row: Record<string, unknown>, isParent: boolean): PortalStudent | null {
  const student = row.students as {
    classroom_id?: string | null;
    classrooms?: { name?: string | null } | null;
    first_name?: string | null;
    id?: string;
    last_name?: string | null;
    nickname?: string | null;
    student_code?: string | null;
  } | null;

  if (!student?.id || !row.workspace_id) return null;

  return {
    classroomId: student.classroom_id || null,
    classroomName: student.classrooms?.name || '-',
    code: student.student_code || '-',
    id: student.id,
    name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'ไม่ระบุชื่อ',
    nickname: student.nickname || 'ยังไม่มีชื่อเล่น',
    relation: isParent ? String(row.relation || 'ผู้เกี่ยวข้อง') : 'บัญชีนักเรียน',
    workspaceId: String(row.workspace_id),
  };
}

export function PortalHome({ portalRole, session }: PortalHomeProps) {
  const demoMode = !supabase || !isSupabaseReady || isDemoSession(session);
  const initialStudents = portalRole === 'parent' ? demoStudents : demoStudents.slice(0, 1);

  const [students, setStudents] = useState<PortalStudent[]>(demoMode ? initialStudents : []);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(demoMode ? initialStudents[0]?.id || '' : '');
  const [activeTab, setActiveTab] = useState<PortalTab>('attendance');

  const [attendance, setAttendance] = useState<PortalAttendance[]>(demoMode ? demoAttendance : []);
  const [scores, setScores] = useState<PortalScoreItem[]>(demoMode ? demoScores : []);
  const [savingsBalance, setSavingsBalance] = useState<number>(demoMode ? 1450 : 0);
  const [savingsTxs, setSavingsTxs] = useState<PortalSavingsTx[]>(demoMode ? demoSavingsTxs : []);
  const [behaviors, setBehaviors] = useState<PortalBehaviorItem[]>(demoMode ? demoBehaviors : []);
  const [desirableSummary, setDesirableSummary] = useState<PortalDesirableSummary | null>(
    demoMode ? { academicYear: '2569', note: 'ตั้งใจเรียนและช่วยเหลือเพื่อนดี', readingSummary: 3, term: '1', traitSummary: 3 } : null,
  );
  const [notifications, setNotifications] = useState<PortalNotificationItem[]>(demoMode ? demoNotifications : []);
  const [leaveRequests, setLeaveRequests] = useState<PortalLeaveRequest[]>([]);

  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'sick' as LeaveType,
    startDate: getBangkokDate(),
    endDate: getBangkokDate(),
    reason: '',
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [isLoading, setIsLoading] = useState(!demoMode);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อโหลดข้อมูล Portal ผ่าน RLS จริง',
  );

  // 1. Load linked students (parent guardians OR active student link)
  useEffect(() => {
    let isMounted = true;

    async function loadLinkedStudents() {
      if (demoMode || !supabase) {
        const list = portalRole === 'parent' ? demoStudents : demoStudents.slice(0, 1);
        setStudents(list);
        setSelectedStudentId(list[0]?.id || '');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const query =
        portalRole === 'parent'
          ? supabase
              .from('student_guardians')
              .select('id,workspace_id,relation,consent_status,students(id,student_code,first_name,last_name,nickname,classroom_id,classrooms(name))')
              .eq('profile_id', session.profile.id)
              .eq('consent_status', 'granted')
          : supabase
              .from('student_profile_links')
              .select('id,workspace_id,status,students(id,student_code,first_name,last_name,nickname,classroom_id,classrooms(name))')
              .eq('profile_id', session.profile.id)
              .eq('status', 'active');

      const { data, error } = await query;
      if (!isMounted) return;

      if (error) {
        setNotice(error.message || 'โหลดรายชื่อนักเรียนในสิทธิ์ไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const mapped = ((data || []) as Record<string, unknown>[])
        .map((row) => mapStudentLink(row, portalRole === 'parent'))
        .filter((s): s is PortalStudent => Boolean(s));

      setStudents(mapped);
      setSelectedStudentId((prev) => (prev && mapped.some((s) => s.id === prev) ? prev : mapped[0]?.id || ''));

      if (mapped.length === 0) {
        setNotice(
          portalRole === 'student'
            ? 'ยังไม่พบนักเรียนที่ผูกกับบัญชี student นี้ หรือ link ยังไม่ active'
            : 'ยังไม่พบนักเรียนที่ผูกกับบัญชีนี้ หรือ consent ยังไม่เป็น granted',
        );
      } else {
        setNotice(null);
      }
      setIsLoading(false);
    }

    void loadLinkedStudents();
    return () => {
      isMounted = false;
    };
  }, [demoMode, portalRole, session.profile.id]);

  const activeStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0] || null,
    [selectedStudentId, students],
  );

  // 2. Load cross-module student details scoped strictly to (workspace_id, student_id)
  const loadStudentDetails = useCallback(async () => {
    if (!activeStudent) return;
    if (demoMode || !supabase) return;

    setIsLoadingDetails(true);
    const activeWorkspaceId = activeStudent.workspaceId;
    const activeStudentId = activeStudent.id;

    const [attRes, scoreRes, savAccRes, savTxRes, behRes, traitRes, notifRes, leaveRes] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('id,session_id,student_id,status,note,checked_at,created_at,attendance_sessions(id,attendance_date,period_label,subject_name)')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .order('created_at', { ascending: false })
        .limit(60),
      supabase
        .from('score_entries')
        .select('id,assessment_id,student_id,score,note,created_at,score_assessments(id,title,subject_name,category,max_score,weight,assessment_date,status)')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .order('created_at', { ascending: false })
        .limit(120),
      supabase
        .from('savings_accounts')
        .select('balance,status')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .maybeSingle(),
      supabase
        .from('savings_transactions')
        .select('id,transaction_type,amount,transaction_date,note,created_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .order('transaction_date', { ascending: false })
        .limit(25),
      supabase
        .from('behavior_records')
        .select('id,tone,category,description,points,follow_up_status,behavior_date,created_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .order('behavior_date', { ascending: false })
        .limit(40),
      supabase
        .from('student_desirable_records')
        .select('academic_year,term,trait_summary,reading_summary,note,updated_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('notifications')
        .select('id,title,body,type,privacy_level,read_at,created_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('profile_id', session.profile.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('student_leave_requests')
        .select('id,classroom_id,student_id,leave_type,start_date,end_date,reason,status,review_note,created_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('student_id', activeStudentId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const mappedAtt: PortalAttendance[] = ((attRes.data || []) as Record<string, unknown>[]).map((row) => {
      const sess = row.attendance_sessions as {
        attendance_date?: string | null;
        id?: string | null;
        period_label?: string | null;
        subject_name?: string | null;
      } | null;
      return {
        date: sess?.attendance_date || String(row.checked_at || row.created_at || new Date().toISOString()),
        id: String(row.id),
        note: (row.note as string | null) || '-',
        period: sess?.period_label || '-',
        sessionId: String(sess?.id || row.session_id || row.id),
        status: String(row.status || 'present') as AttendanceStatus,
        studentId: String(row.student_id || activeStudentId),
        subject: sess?.subject_name || 'โฮมรูม',
      };
    });
    setAttendance(mappedAtt);

    if (!scoreRes.error) {
      const mappedScores: PortalScoreItem[] = ((scoreRes.data || []) as Record<string, unknown>[])
        .map((row) => {
          const assessment = row.score_assessments as {
            assessment_date?: string | null;
            category?: string | null;
            id?: string;
            max_score?: number | null;
            status?: string | null;
            subject_name?: string | null;
            title?: string | null;
            weight?: number | null;
          } | null;
          if (!assessment || assessment.status === 'archived') return null;
          return {
            assessmentDate: assessment.assessment_date || String(row.created_at || '').slice(0, 10),
            assessmentId: String(assessment.id || row.assessment_id),
            category: assessment.category || 'quiz',
            id: String(row.id),
            maxScore: Number(assessment.max_score || 100),
            note: (row.note as string | null) || null,
            score: row.score === null || row.score === undefined ? null : Number(row.score),
            subjectName: assessment.subject_name || 'รายวิชาทั่วไป',
            title: assessment.title || 'รายการประเมิน',
            weight: Number(assessment.weight || 10),
          };
        })
        .filter((item): item is PortalScoreItem => Boolean(item));
      setScores(mappedScores);
    }

    if (!savAccRes.error) {
      setSavingsBalance(Number((savAccRes.data as { balance?: number } | null)?.balance || 0));
    }
    if (!savTxRes.error) {
      setSavingsTxs(
        ((savTxRes.data || []) as Array<Record<string, unknown>>).map((tx) => ({
          amount: Number(tx.amount || 0),
          id: String(tx.id),
          note: (tx.note as string | null) || null,
          transactionDate: String(tx.transaction_date || '').slice(0, 10),
          transactionType: String(tx.transaction_type || 'deposit') as 'deposit' | 'withdrawal' | 'adjustment',
        })),
      );
    }

    if (!behRes.error) {
      setBehaviors(
        ((behRes.data || []) as Array<Record<string, unknown>>).map((b) => ({
          behaviorDate: String(b.behavior_date || '').slice(0, 10),
          category: String(b.category || 'พฤติกรรม'),
          description: String(b.description || ''),
          followUpStatus: String(b.follow_up_status || 'none'),
          id: String(b.id),
          points: Number(b.points || 0),
          tone: String(b.tone || 'positive'),
        })),
      );
    }

    if (!traitRes.error && traitRes.data) {
      const tr = traitRes.data as Record<string, unknown>;
      setDesirableSummary({
        academicYear: String(tr.academic_year || '2569'),
        note: (tr.note as string | null) || null,
        readingSummary: Number(tr.reading_summary ?? 3),
        term: String(tr.term || '1'),
        traitSummary: Number(tr.trait_summary ?? 3),
      });
    } else {
      setDesirableSummary(null);
    }

    if (!notifRes.error) {
      setNotifications(
        ((notifRes.data || []) as Array<Record<string, unknown>>).map((n) => ({
          body: String(n.body || ''),
          createdAt: String(n.created_at || ''),
          id: String(n.id),
          privacyLevel: String(n.privacy_level || 'normal'),
          readAt: (n.read_at as string | null) || null,
          title: String(n.title || 'แจ้งเตือน'),
          type: String(n.type || 'announcement'),
        })),
      );
    }

    if (!leaveRes.error) {
      setLeaveRequests(
        ((leaveRes.data || []) as Array<Record<string, unknown>>).map((lr) => ({
          classroomId: String(lr.classroom_id || ''),
          createdAt: String(lr.created_at || ''),
          endDate: String(lr.end_date || ''),
          id: String(lr.id),
          leaveType: String(lr.leave_type || 'sick') as LeaveType,
          reason: String(lr.reason || ''),
          reviewNote: (lr.review_note as string | null) || null,
          startDate: String(lr.start_date || ''),
          status: String(lr.status || 'pending') as LeaveStatus,
          studentId: String(lr.student_id || activeStudentId),
        })),
      );
    } else if (!isMissingRelationError(leaveRes.error)) {
      setNotice(leaveRes.error.message);
    }

    setIsLoadingDetails(false);
  }, [activeStudent, demoMode, session.profile.id]);

  useEffect(() => {
    void loadStudentDetails();
  }, [loadStudentDetails]);

  const attendanceSummaryStats = useMemo(() => {
    if (!activeStudent) return { attendanceRate: 100, recordedDays: 0 };
    const sessList = attendance.map((a) => ({
      id: a.sessionId,
      attendance_date: a.date.slice(0, 10),
      subject_name: a.subject,
    }));
    const recList = attendance.map((a) => ({
      session_id: a.sessionId,
      student_id: a.studentId,
      status: a.status,
    }));
    const map = computeAttendanceStreaksAndRates(sessList, recList, [activeStudent.id]);
    const stats = map.get(activeStudent.id);
    return {
      attendanceRate: stats?.attendanceRate ?? 100,
      recordedDays: stats?.recordedDays ?? 0,
    };
  }, [activeStudent, attendance]);

  const summary = useMemo(
    () =>
      (['present', 'late', 'absent', 'leave'] as AttendanceStatus[]).map((status) => ({
        count: attendance.filter((item) => item.status === status).length,
        label: attendanceLabels[status],
        status,
      })),
    [attendance],
  );

  const subjectGradeSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      { earnedWeight: number; plannedWeight: number; gradedCount: number; totalCount: number }
    >();
    scores.forEach((item) => {
      const current = grouped.get(item.subjectName) || {
        earnedWeight: 0,
        plannedWeight: 0,
        gradedCount: 0,
        totalCount: 0,
      };
      current.totalCount += 1;
      current.plannedWeight += item.weight;
      if (item.score !== null && item.maxScore > 0) {
        current.earnedWeight += (item.score / item.maxScore) * item.weight;
        current.gradedCount += 1;
      }
      grouped.set(item.subjectName, current);
    });
    return Array.from(grouped.entries()).map(([subjectName, stats]) => {
      const pct = stats.plannedWeight > 0 ? (stats.earnedWeight / stats.plannedWeight) * 100 : 0;
      return {
        subjectName,
        percent: pct,
        grade: stats.gradedCount > 0 ? computeGradeLabel(pct) : '-',
        gradedCount: stats.gradedCount,
        totalCount: stats.totalCount,
      };
    });
  }, [scores]);

  const behaviorNetPoints = useMemo(
    () => behaviors.reduce((sum, b) => sum + b.points, 0),
    [behaviors],
  );

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  async function handleSubmitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeStudent || portalRole !== 'parent') return;
    const trimmedReason = leaveForm.reason.trim();
    if (!trimmedReason) {
      setNotice('กรุณาระบุสาเหตุการลา');
      return;
    }
    if (leaveForm.endDate < leaveForm.startDate) {
      setNotice('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
      return;
    }

    setIsSubmittingLeave(true);
    setNotice(null);

    if (demoMode || !supabase) {
      const demoReq: PortalLeaveRequest = {
        classroomId: activeStudent.classroomId || 'demo-room',
        createdAt: new Date().toISOString(),
        endDate: leaveForm.endDate,
        id: `demo-leave-${Date.now()}`,
        leaveType: leaveForm.leaveType,
        reason: trimmedReason,
        reviewNote: null,
        startDate: leaveForm.startDate,
        status: 'pending',
        studentId: activeStudent.id,
      };
      setLeaveRequests((prev) => [demoReq, ...prev]);
      setLeaveForm((prev) => ({ ...prev, reason: '' }));
      setNotice('ส่งคำขอลาออนไลน์เรียบร้อยแล้ว [โหมดตัวอย่าง]');
      setIsSubmittingLeave(false);
      return;
    }

    if (!activeStudent.classroomId) {
      setNotice('ยังไม่พบห้องเรียนของนักเรียน กรุณาติดต่อครูประจำชั้น');
      setIsSubmittingLeave(false);
      return;
    }

    const { data, error } = await supabase
      .from('student_leave_requests')
      .insert({
        classroom_id: activeStudent.classroomId,
        end_date: leaveForm.endDate,
        leave_type: leaveForm.leaveType,
        reason: trimmedReason,
        start_date: leaveForm.startDate,
        status: 'pending',
        student_id: activeStudent.id,
        submitted_by: session.profile.id,
        workspace_id: activeStudent.workspaceId,
      })
      .select('id,classroom_id,student_id,leave_type,start_date,end_date,reason,status,review_note,created_at')
      .single();

    if (error) {
      setNotice(
        isMissingRelationError(error)
          ? 'ฐานข้อมูลยังไม่มีตารางคำขอลาออนไลน์ (กรุณารัน migration 0096 ก่อนใช้งานจริง)'
          : `ส่งคำขอลาไม่สำเร็จ: ${error.message}`,
      );
      setIsSubmittingLeave(false);
      return;
    }

    const inserted = data as Record<string, unknown>;
    setLeaveRequests((prev) => [
      {
        classroomId: String(inserted.classroom_id),
        createdAt: String(inserted.created_at),
        endDate: String(inserted.end_date),
        id: String(inserted.id),
        leaveType: String(inserted.leave_type) as LeaveType,
        reason: String(inserted.reason),
        reviewNote: null,
        startDate: String(inserted.start_date),
        status: 'pending',
        studentId: String(inserted.student_id),
      },
      ...prev,
    ]);
    setLeaveForm((prev) => ({ ...prev, reason: '' }));
    setNotice('ส่งคำขอลาออนไลน์ถึงครูประจำชั้นเรียบร้อยแล้ว');
    setIsSubmittingLeave(false);
  }

  async function handleCancelLeave(reqId: string) {
    if (demoMode || !supabase || !activeStudent) {
      setLeaveRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: 'cancelled' } : r)));
      return;
    }
    const { error } = await supabase
      .from('student_leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', reqId)
      .eq('workspace_id', activeStudent.workspaceId)
      .eq('submitted_by', session.profile.id)
      .eq('status', 'pending');
    if (error) {
      setNotice(`ยกเลิกคำขอไม่สำเร็จ: ${error.message}`);
    } else {
      setLeaveRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: 'cancelled' } : r)));
    }
  }

  async function handleMarkNotificationRead(notifId: string) {
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, readAt: nowIso } : n)));
    if (demoMode || !supabase) return;
    await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .eq('id', notifId)
      .eq('profile_id', session.profile.id);
  }

  const title = portalRole === 'parent' ? 'สมุดพกผู้ปกครอง 360°' : 'สมุดพกนักเรียน 360°';
  const subtitle =
    portalRole === 'parent'
      ? 'ติดตามเวลาเรียน ผลการเรียน เงินออม พฤติกรรม แจ้งเตือน และยื่นใบลาออนไลน์ให้คุณครูได้อย่างสะดวกและปลอดภัย'
      : 'ดูสถิติการมาเรียน ผลการเรียน เงินออม พฤติกรรม และข่าวสารจากคุณครูได้ครบในหน้าเดียว';

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-[#1F2A22] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        {/* Hero Banner */}
        <div className="botanical-banner relative overflow-hidden">
          <BotanicalCornerWatermark className="pointer-events-none absolute -bottom-4 right-2 opacity-60" color="#2F7D5B" opacity={0.14} />
          <div className="relative z-10 grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#DCE3D7] bg-white shadow-xs">
                  <AppLogo className="h-8 w-8" />
                </div>
                <div className="nexus-kicker">
                  <Users size={16} aria-hidden="true" />
                  {portalRole === 'parent' ? 'สมุดพกผู้ปกครอง · ClassCare 360' : 'สมุดพกนักเรียน · ClassCare 360'}
                </div>
              </div>
              <h1 className="mt-5 font-display text-3xl font-bold leading-tight text-[#1F2A22] sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-[#5B6A5F]">
                {subtitle}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCE3D7] bg-white px-4 text-sm font-bold text-[#1F2A22] shadow-2xs">
                  <UserRound size={16} className="text-[#2F7D5B]" aria-hidden="true" />
                  {session.profile.displayName}
                </span>
                <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#BFE0CD] bg-[#E6F4EC] px-4 text-sm font-bold text-[#1C573D]">
                  <ShieldCheck size={16} aria-hidden="true" />
                  คุ้มครองข้อมูลส่วนบุคคล (RLS Scoped)
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden border-t border-[#DCE3D7] bg-[#F5FBF7] p-6 xl:border-l xl:border-t-0 sm:p-8">
              <BotanicalCardSprig className="absolute right-2 top-2" color="#2F7D5B" opacity={0.18} />
              <p className="relative font-display text-sm font-bold text-[#1C573D]">สรุปภาพรวมบุตรหลาน</p>
              <div className="relative mt-4 grid gap-2.5">
                <div className="flex items-center justify-between rounded-xl border border-[#BFE0CD]/80 bg-white/90 p-3 shadow-2xs">
                  <span className="text-xs font-bold text-[#5B6A5F]">ร้อยละเวลาเรียนสะสม</span>
                  <span className={`text-sm font-black ${attendanceSummaryStats.attendanceRate < 80 ? 'text-rose-700' : 'text-[#1C573D]'}`}>
                    {attendanceSummaryStats.attendanceRate.toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#BFE0CD]/80 bg-white/90 p-3 shadow-2xs">
                  <span className="text-xs font-bold text-[#5B6A5F]">ยอดเงินออมสะสม</span>
                  <span className="text-sm font-black text-[#1C573D]">฿{savingsBalance.toLocaleString('th-TH')}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#BFE0CD]/80 bg-white/90 p-3 shadow-2xs">
                  <span className="text-xs font-bold text-[#5B6A5F]">คะแนนพฤติกรรมสุทธิ</span>
                  <span className={`text-sm font-black ${behaviorNetPoints >= 0 ? 'text-[#2F7D5B]' : 'text-rose-700'}`}>
                    {behaviorNetPoints >= 0 ? `+${behaviorNetPoints}` : behaviorNetPoints} แต้ม
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Selector Cards when multiple children linked */}
        {students.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((student) => {
              const isSelected = activeStudent?.id === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-[#2F7D5B] bg-[#F5FBF7] ring-2 ring-[#2F7D5B]/25 shadow-sm'
                      : 'border-[#DCE3D7] bg-white hover:border-[#8CC6A7]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-[#1F2A22]">{student.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#5B6A5F]">
                        รหัส {student.code} · {student.nickname} · ห้อง {student.classroomName}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-2.5 py-0.5 text-[11px] font-bold text-[#1C573D]">
                      {student.relation}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && students.length === 0 && (
          <div className="mt-5">
            <BotanicalEmptyState
              title="ยังไม่มีข้อมูลนักเรียนที่เชื่อมโยง"
              description="กรุณาติดต่อครูประจำชั้นเพื่อตรวจสอบการอนุมัติสิทธิ์การเข้าถึงข้อมูลนักเรียน"
              icon={<UserRound className="text-[#2F7D5B]" size={22} />}
            />
          </div>
        )}

        {notice && (
          <div className="mt-5 flex items-center justify-between gap-2.5 rounded-2xl border border-[#F0D9AE] bg-[#FDF4E1] p-3.5 text-sm font-bold text-[#8B5312] shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="shrink-0" size={17} aria-hidden="true" />
              <p>{notice}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-lg px-2 py-1 text-xs font-black hover:bg-amber-200/50"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Portal Interactive Tabs */}
        {activeStudent && (
          <div className="mt-5">
            <div className="flex flex-wrap gap-2 rounded-2xl border border-[#DCE3D7] bg-white p-2 shadow-2xs">
              {[
                { key: 'attendance' as PortalTab, label: 'เวลาเรียน & ใบลา', icon: CalendarCheck2 },
                { key: 'scores' as PortalTab, label: 'ผลการเรียน', icon: GraduationCap },
                { key: 'savings' as PortalTab, label: 'เงินออมนักเรียน', icon: PiggyBank },
                { key: 'behavior' as PortalTab, label: 'พฤติกรรม & คุณลักษณะ', icon: Heart },
                {
                  key: 'notifications' as PortalTab,
                  label: unreadNotifCount > 0 ? `แจ้งเตือน (${unreadNotifCount})` : 'กล่องแจ้งเตือน',
                  icon: Bell,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
                      active
                        ? 'bg-[#1C342B] text-white shadow-xs'
                        : 'text-[#5B6A5F] hover:bg-[#FAFBF8] hover:text-[#1F2A22]'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              {isLoadingDetails && (
                <span className="ml-auto self-center px-2 text-xs font-bold text-[#5B6A5F]">กำลังอัปเดตข้อมูล...</span>
              )}
            </div>

            {/* TAB 1: ATTENDANCE & ONLINE LEAVE REQUEST */}
            {activeTab === 'attendance' && (
              <section className="mt-5 grid gap-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {summary.map((item) => {
                    const theme = summaryThemes[item.status] || summaryThemes.present;
                    return (
                      <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-white p-4 pt-5 text-center shadow-xs" key={item.status}>
                        <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${theme.topBar}`} />
                        <p className="font-display text-3xl font-bold text-[#1F2A22]">{item.count}</p>
                        <span className={`mt-1.5 inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${theme.pill}`}>
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Guardian Online Leave Form */}
                {portalRole === 'parent' && (
                  <div className="rounded-3xl border border-[#DCE3D7] bg-white p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EDF1EA] pb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={18} className="text-[#2F7D5B]" />
                        <div>
                          <h2 className="font-display text-lg font-bold text-[#1F2A22]">ยื่นใบลาออนไลน์ถึงครูประจำชั้น</h2>
                          <p className="text-xs font-semibold text-[#5B6A5F]">
                            แจ้งลาป่วยหรือลากิจล่วงหน้า คำขอจะแสดงในหน้าเช็กชื่อของคุณครูทันที
                          </p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={(e) => void handleSubmitLeave(e)} className="mt-4 grid gap-3 sm:grid-cols-4">
                      <label className="block">
                        <span className="text-xs font-bold text-[#5B6A5F]">ประเภทการลา</span>
                        <select
                          value={leaveForm.leaveType}
                          onChange={(e) => setLeaveForm((p) => ({ ...p, leaveType: e.target.value as LeaveType }))}
                          className="nexus-field mt-1"
                        >
                          <option value="sick">ลาป่วย</option>
                          <option value="personal">ลากิจ</option>
                          <option value="other">อื่นๆ</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-[#5B6A5F]">ตั้งแต่วันที่</span>
                        <input
                          type="date"
                          value={leaveForm.startDate}
                          onChange={(e) =>
                            setLeaveForm((p) => ({
                              ...p,
                              startDate: e.target.value,
                              endDate: e.target.value > p.endDate ? e.target.value : p.endDate,
                            }))
                          }
                          className="nexus-field mt-1"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-[#5B6A5F]">ถึงวันที่</span>
                        <input
                          type="date"
                          value={leaveForm.endDate}
                          min={leaveForm.startDate}
                          onChange={(e) => setLeaveForm((p) => ({ ...p, endDate: e.target.value }))}
                          className="nexus-field mt-1"
                          required
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={isSubmittingLeave}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F7D5B] px-4 text-sm font-bold text-white shadow-xs hover:bg-[#235F45] disabled:opacity-50"
                        >
                          <Send size={15} />
                          <span>{isSubmittingLeave ? 'กำลังส่ง...' : 'ส่งใบลาให้ครู'}</span>
                        </button>
                      </div>
                      <label className="block sm:col-span-4">
                        <span className="text-xs font-bold text-[#5B6A5F]">รายละเอียด / อาการป่วย / เหตุผล</span>
                        <input
                          type="text"
                          value={leaveForm.reason}
                          onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                          placeholder="เช่น มีไข้ ไอ และไปพบแพทย์ รพ. ..."
                          className="nexus-field mt-1"
                          required
                        />
                      </label>
                    </form>

                    {leaveRequests.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-[#EDF1EA] pt-3">
                        <p className="text-xs font-bold text-[#5B6A5F]">ประวัติคำขอลา ({leaveRequests.length})</p>
                        {leaveRequests.map((req) => {
                          const meta = leaveStatusMeta[req.status] || leaveStatusMeta.pending;
                          return (
                            <div
                              key={req.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] p-3 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full border px-2.5 py-0.5 font-bold ${meta.badgeClass}`}>
                                    {meta.label}
                                  </span>
                                  <span className="font-bold text-[#1F2A22]">
                                    {leaveTypeLabels[req.leaveType]} · {formatDate(req.startDate)}
                                    {req.endDate !== req.startDate ? ` - ${formatDate(req.endDate)}` : ''}
                                  </span>
                                </div>
                                <p className="mt-1 font-medium text-[#5B6A5F]">{req.reason}</p>
                              </div>
                              {req.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelLeave(req.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 font-bold text-rose-800 hover:bg-rose-100"
                                >
                                  <XCircle size={13} />
                                  ยกเลิก
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Attendance Timeline */}
                <div className="rounded-3xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-6">
                  <div className="flex flex-col gap-2 border-b border-[#EDF1EA] pb-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#2F7D5B]">Attendance Timeline</p>
                      <h2 className="mt-0.5 font-display text-xl font-bold text-[#1F2A22]">
                        ประวัติเวลาเรียนล่าสุดของ {activeStudent.name}
                      </h2>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {attendance.map((record) => {
                      const statusTheme = summaryThemes[record.status] || {
                        pill: 'bg-[#E9F3FA] text-[#1D547C] border-[#CBE1F2]',
                      };
                      return (
                        <article className="rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-4" key={record.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${statusTheme.pill}`}>
                                {attendanceLabels[record.status] || record.status}
                              </span>
                              <span className="rounded-full border border-[#DCE3D7] bg-white px-3 py-0.5 text-xs font-bold text-[#5B6A5F]">
                                {formatDate(record.date)} | {record.period}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2F7D5B]">
                              <Clock3 size={14} /> บันทึกแล้ว
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-[#1F2A22]">
                            {record.subject} {record.note && record.note !== '-' ? `· ${record.note}` : ''}
                          </p>
                        </article>
                      );
                    })}
                    {attendance.length === 0 && (
                      <BotanicalEmptyState
                        title="ยังไม่มีข้อมูลเวลาเรียน"
                        description="เมื่อคุณครูเช็กเวลาเรียนในห้องเรียน รายการล่าสุดจะแสดงที่นี่"
                        icon={<CalendarCheck2 className="text-[#2F7D5B]" size={22} />}
                      />
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* TAB 2: SCORES & GRADES */}
            {activeTab === 'scores' && (
              <section className="mt-5 grid gap-5">
                <div className="rounded-3xl border border-[#DCE3D7] bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-[#EDF1EA] pb-3">
                    <BookOpen size={18} className="text-[#2F7D5B]" />
                    <h2 className="font-display text-lg font-bold text-[#1F2A22]">สรุปผลการเรียนรายวิชา (เกรดประมาณการ)</h2>
                  </div>

                  {subjectGradeSummaries.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {subjectGradeSummaries.map((subj) => (
                        <div key={subj.subjectName} className="rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-[#1F2A22]">{subj.subjectName}</p>
                            <span className="rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-2.5 py-0.5 text-xs font-black text-[#1C573D]">
                              เกรด {subj.grade}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-black text-[#2F7D5B]">{subj.percent.toFixed(1)}%</p>
                          <p className="mt-0.5 text-xs font-semibold text-[#5B6A5F]">
                            บันทึกคะแนนแล้ว {subj.gradedCount} / {subj.totalCount} ชิ้นงาน
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <BotanicalEmptyState
                        title="ยังไม่มีข้อมูลคะแนนสอบหรืองาน"
                        description="เมื่อคุณครูบันทึกคะแนนลงสมุดคะแนน รายละเอียดและเกรดจะแสดงที่นี่"
                        icon={<GraduationCap className="text-[#2F7D5B]" size={22} />}
                      />
                    </div>
                  )}

                  {scores.length > 0 && (
                    <div className="mt-5 space-y-2 border-t border-[#EDF1EA] pt-4">
                      <p className="text-xs font-bold text-[#5B6A5F]">รายการคะแนนล่าสุด</p>
                      {scores.slice(0, 15).map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] px-3.5 py-2.5 text-xs">
                          <div>
                            <p className="font-bold text-[#1F2A22]">
                              [{item.subjectName}] {item.title}
                            </p>
                            <p className="text-[11px] font-semibold text-[#5B6A5F]">
                              {formatDate(item.assessmentDate)} {item.note ? `· ${item.note}` : ''}
                            </p>
                          </div>
                          <span className="font-mono text-sm font-black text-[#1C573D]">
                            {item.score !== null ? item.score : 'รอส่ง'} / {item.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* TAB 3: SAVINGS LEDGER */}
            {activeTab === 'savings' && (
              <section className="mt-5 rounded-3xl border border-[#DCE3D7] bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDF1EA] pb-4">
                  <div className="flex items-center gap-2">
                    <PiggyBank size={20} className="text-[#2F7D5B]" />
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#1F2A22]">สมุดบัญชีออมทรัพย์นักเรียน</h2>
                      <p className="text-xs font-semibold text-[#5B6A5F]">ยอดเงินออมคงเหลือและรายการฝาก-ถอนล่าสุด</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#BFE0CD] bg-[#E6F4EC] px-4 py-2 text-right">
                    <p className="text-[11px] font-bold text-[#1C573D]">ยอดออมสะสมสุทธิ</p>
                    <p className="font-display text-2xl font-black text-[#1C573D]">
                      ฿{savingsBalance.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {savingsTxs.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-3.5 text-xs sm:text-sm">
                      <div>
                        <p className="font-bold text-[#1F2A22]">
                          {tx.transactionType === 'deposit' ? 'ฝากออมทรัพย์' : tx.transactionType === 'withdrawal' ? 'ถอนเงิน' : 'ปรับปรุงยอด'}
                          {tx.note ? ` · ${tx.note}` : ''}
                        </p>
                        <p className="text-xs font-semibold text-[#5B6A5F]">{formatDate(tx.transactionDate)}</p>
                      </div>
                      <span className={`font-mono text-base font-black ${tx.transactionType === 'withdrawal' ? 'text-rose-700' : 'text-[#2F7D5B]'}`}>
                        {tx.transactionType === 'withdrawal' ? '-' : '+'}฿{tx.amount.toLocaleString('th-TH')}
                      </span>
                    </div>
                  ))}
                  {savingsTxs.length === 0 && (
                    <BotanicalEmptyState
                      title="ยังไม่มีรายการฝาก-ถอนเงินออม"
                      description="เมื่อมีรายการออมทรัพย์ประจำวัน ระบบจะแสดงประวัติอัตโนมัติ"
                      icon={<PiggyBank className="text-[#2F7D5B]" size={22} />}
                    />
                  )}
                </div>
              </section>
            )}

            {/* TAB 4: BEHAVIOR & OBEC DESIRABLE CHARACTERISTICS */}
            {activeTab === 'behavior' && (
              <section className="mt-5 grid gap-5">
                {desirableSummary && (
                  <div className="rounded-3xl border border-[#BFE0CD] bg-[#F5FBF7] p-5 shadow-xs">
                    <div className="flex items-center gap-2 text-sm font-black text-[#1C573D]">
                      <Award size={18} />
                      <span>ผลประเมินคุณลักษณะฯ &amp; การอ่านคิดวิเคราะห์ (ปี {desirableSummary.academicYear} เทอม {desirableSummary.term})</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[#DCE3D7] bg-white p-3.5">
                        <p className="text-xs font-bold text-[#5B6A5F]">คุณลักษณะอันพึงประสงค์ 8 ประการ</p>
                        <p className="mt-1 text-base font-black text-[#1C573D]">
                          {qualityLevelLabels[desirableSummary.traitSummary] || `ระดับ ${desirableSummary.traitSummary}`}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#DCE3D7] bg-white p-3.5">
                        <p className="text-xs font-bold text-[#5B6A5F]">การอ่าน คิดวิเคราะห์ และเขียน</p>
                        <p className="mt-1 text-base font-black text-[#1C573D]">
                          {qualityLevelLabels[desirableSummary.readingSummary] || `ระดับ ${desirableSummary.readingSummary}`}
                        </p>
                      </div>
                    </div>
                    {desirableSummary.note && (
                      <p className="mt-2.5 text-xs font-semibold text-[#465549]">ความเห็นครู: {desirableSummary.note}</p>
                    )}
                  </div>
                )}

                <div className="rounded-3xl border border-[#DCE3D7] bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[#EDF1EA] pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-[#2F7D5B]" />
                      <h2 className="font-display text-lg font-bold text-[#1F2A22]">บันทึกพฤติกรรมและดาวความดี</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${behaviorNetPoints >= 0 ? 'bg-[#E6F4EC] text-[#1C573D]' : 'bg-rose-50 text-rose-700'}`}>
                      รวมสุทธิ {behaviorNetPoints >= 0 ? `+${behaviorNetPoints}` : behaviorNetPoints} แต้ม
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {behaviors.map((b) => (
                      <div key={b.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-3.5 text-xs sm:text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-[#DCE3D7] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#1C573D]">
                              {b.category}
                            </span>
                            <span className="text-[11px] font-semibold text-[#5B6A5F]">{formatDate(b.behaviorDate)}</span>
                          </div>
                          <p className="mt-1.5 font-bold text-[#1F2A22]">{b.description}</p>
                        </div>
                        <span className={`shrink-0 font-mono text-sm font-black ${b.points >= 0 ? 'text-[#2F7D5B]' : 'text-rose-700'}`}>
                          {b.points >= 0 ? `+${b.points}` : b.points}
                        </span>
                      </div>
                    ))}
                    {behaviors.length === 0 && (
                      <BotanicalEmptyState
                        title="ยังไม่มีบันทึกพฤติกรรม"
                        description="เมื่อคุณครูบันทึกดาวความดีหรือข้อเสนอแนะ รายการจะแสดงที่นี่"
                        icon={<Heart className="text-[#2F7D5B]" size={22} />}
                      />
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* TAB 5: INBOX / NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <section className="mt-5 rounded-3xl border border-[#DCE3D7] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#EDF1EA] pb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-[#2F7D5B]" />
                    <h2 className="font-display text-lg font-bold text-[#1F2A22]">กล่องแจ้งเตือนจากโรงเรียน</h2>
                  </div>
                  <span className="text-xs font-bold text-[#5B6A5F]">ยังไม่อ่าน {unreadNotifCount} รายการ</span>
                </div>

                <div className="mt-4 space-y-3">
                  {notifications.map((n) => (
                    <article
                      key={n.id}
                      className={`rounded-2xl border p-4 transition ${
                        n.readAt ? 'border-[#DCE3D7] bg-[#FAFBF8]' : 'border-[#8CC6A7] bg-[#F5FBF7] shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {!n.readAt && (
                              <span className="rounded-full bg-[#2F7D5B] px-2 py-0.5 text-[10px] font-black text-white">ใหม่</span>
                            )}
                            <h3 className="font-display font-bold text-[#1F2A22]">{n.title}</h3>
                          </div>
                          <p className="mt-1.5 text-sm font-medium text-[#465549] whitespace-pre-line">{n.body}</p>
                          <p className="mt-2 text-[11px] font-semibold text-[#6F8073]">{formatDate(n.createdAt)}</p>
                        </div>
                        {!n.readAt && (
                          <button
                            type="button"
                            onClick={() => void handleMarkNotificationRead(n.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-[#BFE0CD] bg-white px-3 py-1.5 text-xs font-bold text-[#1C573D] hover:bg-[#E6F4EC]"
                          >
                            <CheckCircle2 size={13} />
                            รับทราบแล้ว
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {notifications.length === 0 && (
                    <BotanicalEmptyState
                      title="ยังไม่มีข้อความแจ้งเตือน"
                      description="ข่าวสารหรือรายงานประจำวันที่คุณครูส่งให้ผู้ปกครองจะแสดงที่นี่"
                      icon={<Bell className="text-[#2F7D5B]" size={22} />}
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        <footer className="mt-6 text-center text-xs font-bold text-[#6F8073]">
          ClassCare 360 · สมุดพกห้องเรียนดิจิทัล
        </footer>
      </section>
    </main>
  );
}
