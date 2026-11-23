import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  CalendarCheck2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Grid3X3,
  Home,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Printer,
  Send,
  Settings2,
  ShieldAlert,
  Smile,
  Sparkles,
  Thermometer,
  Undo2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { AttendanceOcrModal } from '../../components/attendance/AttendanceOcrModal';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { EvidenceVaultSection } from '../../components/shared/EvidenceVaultSection';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { getBangkokDate } from '../../lib/date';
import { IMAGE_WEBP_PRESETS } from '../../lib/imageOptimizer';
import { isDemoSession } from '../../lib/auth';
import { sendTeacherReport } from '../../lib/teacherNotificationReports';
import { writeAuditLog } from '../../lib/auditLog';
import {
  computeAttendanceStreaksAndRates,
  detectActiveSchedulePeriod,
  type StudentAttendanceSummary,
} from '../../lib/studentIntelligence';
import { getThaiPublicHolidays } from '../../lib/thaiHolidays';
import {
  buildSchedulePeriods,
  loadScheduleSettings,
  loadSchoolReportIdentity,
  makeScheduleCellKey,
  type DayName,
  type ScheduleSettings,
} from '../../lib/scheduleSettings';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { enqueueOfflineMutation, isLikelyNetworkError } from '../../lib/offlineSyncQueue';
import { getTeacherClassroomScope, getClassroomScopeBadge } from '../../lib/teacherClassrooms';
import type { AppSessionContext } from '../../types/core';
import { DEMO_PRIMARY_CLASSROOMS, DEMO_PRIMARY_STUDENTS, getPrimaryMasterData, autoRealignAllStudentsToCorrectRooms } from '../../data/p5MasterTemplate';

interface AttendancePageProps {
  session: AppSessionContext;
}

type AttendanceMode = 'homeroom' | 'subject';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';

interface ClassroomRow {
  academic_year: string | null;
  homeroom_teacher_profile_id?: string | null;
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
  status: 'draft' | 'submitted' | 'locked' | 'archived';
  subject_name: string | null;
}

interface AttendanceRecordRow {
  id: string;
  note: string | null;
  session_id: string;
  status: AttendanceStatus;
  student_id: string;
}

interface GuardianNotificationTarget {
  display_name: string;
  profile_id: string | null;
  relation: string;
  student_id: string;
}

interface CalendarAttendancePolicy {
  affects_attendance: boolean;
  day_type: string;
  title: string;
}

const demoClassrooms: ClassroomRow[] = DEMO_PRIMARY_CLASSROOMS;

const demoStudents: StudentRow[] = DEMO_PRIMARY_STUDENTS;

const thaiWeekdays: DayName[] = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function getScheduleDay(date: string): DayName {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return thaiWeekdays[weekday] || 'จันทร์';
}

const statusOptions: Array<{ label: string; tone: string; value: AttendanceStatus }> = [
  { label: 'มา', tone: 'bg-teal-50 text-teal-700 ring-teal-100', value: 'present' },
  { label: 'ขาด', tone: 'bg-rose-50 text-rose-700 ring-rose-100', value: 'absent' },
  { label: 'สาย', tone: 'bg-amber-50 text-amber-700 ring-amber-100', value: 'late' },
  { label: 'ลา', tone: 'bg-sky-50 text-sky-700 ring-sky-100', value: 'leave' },
  { label: 'ป่วย', tone: 'bg-violet-50 text-violet-700 ring-violet-100', value: 'sick' },
  { label: 'กิจกรรม', tone: 'bg-lime-50 text-lime-700 ring-lime-100', value: 'activity' },
];

const modeCopy: Record<AttendanceMode, { body: string; icon: typeof Home; label: string; subject: string }> = {
  homeroom: {
    body: 'ใช้กับโฮมรูม หน้าเสาธง หรือการเช็คชื่อประจำวันของครูที่ปรึกษา รายงานจะนับเป็นเวลาเรียนหลักของห้อง',
    icon: Home,
    label: 'ครูที่ปรึกษา / เช็คชื่อประจำวัน',
    subject: 'โฮมรูม',
  },
  subject: {
    body: 'ใช้กับครูประจำวิชาที่ต้องเช็คเวลาเรียนในคาบนั้น ข้อมูลชุดนี้ต่อยอดไปสรุปรายวิชาและคะแนนได้',
    icon: BookOpen,
    label: 'ครูประจำวิชา / เช็คเวลาเรียนรายวิชา',
    subject: 'คณิตศาสตร์',
  },
};

const statusLabels = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<
  AttendanceStatus,
  string
>;

// Tap cycles through the four most common statuses; sick/activity live in the long-press sheet.
const TAP_CYCLE: AttendanceStatus[] = ['present', 'absent', 'leave', 'late'];

const STATUS_ICON: Record<AttendanceStatus, typeof CheckCircle2> = {
  present: CheckCircle2,
  absent: XCircle,
  late: Clock,
  leave: FileText,
  sick: Thermometer,
  activity: Award,
};

const postItTone: Record<
  AttendanceStatus,
  { bg: string; text: string; shadow: string; border: string; label: string; clayClass: string }
> = {
  present: {
    bg: 'clay-card-present',
    text: 'text-[#144a34]',
    shadow: 'shadow-md',
    border: 'border-white/75',
    label: 'text-[#144a34]',
    clayClass: 'clay-card-present',
  },
  absent: {
    bg: 'clay-card-absent',
    text: 'text-[#881337]',
    shadow: 'shadow-md',
    border: 'border-white/75',
    label: 'text-[#881337]',
    clayClass: 'clay-card-absent',
  },
  leave: {
    bg: 'clay-card-leave',
    text: 'text-[#0f4c81]',
    shadow: 'shadow-md',
    border: 'border-white/75',
    label: 'text-[#0f4c81]',
    clayClass: 'clay-card-leave',
  },
  late: {
    bg: 'clay-card-late',
    text: 'text-[#78350f]',
    shadow: 'shadow-md',
    border: 'border-white/75',
    label: 'text-[#78350f]',
    clayClass: 'clay-card-late',
  },
  sick: {
    bg: 'clay-card-sick',
    text: 'text-[#581c87]',
    shadow: 'shadow-md',
    border: 'border-white/75',
    label: 'text-[#581c87]',
    clayClass: 'clay-card-sick',
  },
  activity: {
    bg: 'clay-card-activity',
    text: 'text-[#064e3b]',
    shadow: 'shadow-md',
    border: 'border-white/75',
    label: 'text-[#064e3b]',
    clayClass: 'clay-card-activity',
  },
};

const NOTE_ROTATIONS = [
  'rotate-[1.5deg]',
  '-rotate-[2deg]',
  'rotate-[2deg]',
  '-rotate-[1.5deg]',
  'rotate-[1deg]',
  '-rotate-[2.5deg]',
  'rotate-[2.5deg]',
  '-rotate-[1deg]',
];

function getTodayDate() {
  return getBangkokDate();
}

function getAttendanceErrorMessage(message: string) {
  if (message.includes('period_locked')) {
    return 'งวดเช็กชื่อของวันที่นี้ถูกล็อกแล้ว กรุณาให้ผู้ดูแลปลดล็อกงวดก่อนบันทึกย้อนหลัง';
  }
  return message;
}

function createDefaultMarks(students: StudentRow[]): Record<string, AttendanceStatus | undefined> {
  // A student stays unmarked until the teacher confirms their status.
  return Object.fromEntries(students.map((student) => [student.id, undefined]));
}

function hasCompleteAttendanceSnapshot(records: AttendanceRecordRow[], students: StudentRow[], sessionId: string) {
  if (students.length === 0 || records.length !== students.length) return false;
  const recordIds = new Set(records.filter((record) => record.session_id === sessionId).map((record) => record.student_id));
  return students.every((student) => recordIds.has(student.id));
}

function getClassroomWithStudents(classrooms: ClassroomRow[], students: StudentRow[], preferredClassroomId?: string) {
  const classroomIds = new Set(classrooms.map((classroom) => classroom.id));
  const preferredHasStudents = students.some((student) => student.classroom_id === preferredClassroomId);

  if (preferredClassroomId && classroomIds.has(preferredClassroomId) && preferredHasStudents) {
    return preferredClassroomId;
  }

  const classroomWithStudents = classrooms.find((classroom) =>
    students.some((student) => student.classroom_id === classroom.id),
  );

  return classroomWithStudents?.id || classrooms[0]?.id || '';
}

export function AttendancePage({ session }: AttendancePageProps) {
  const demoMode = isDemoSession(session);
  const feedback = useSystemFeedback();
  const [mode, setMode] = useState<AttendanceMode>('homeroom');
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [attendanceSession, setAttendanceSession] = useState<AttendanceSessionRow | null>(null);
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [savedAttendanceUndo, setSavedAttendanceUndo] = useState<{ records: AttendanceRecordRow[]; sessionId: string } | null>(null);
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [editSessionDate, setEditSessionDate] = useState('');
  const [periodLabel, setPeriodLabel] = useState('เช้า');
  const [subjectName, setSubjectName] = useState(modeCopy.homeroom.subject);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>(() =>
    loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id),
  );
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | undefined>>(() => createDefaultMarks(demoMode ? demoStudents : []));
  const [undoMarks, setUndoMarks] = useState<Record<string, AttendanceStatus | undefined> | null>(null);
  const attendanceDraftKey = useMemo(
    () => `classcare:attendance-draft:${session.workspace?.id || 'demo'}:${classroomId}:${attendanceDate}:${mode}:${periodLabel}:${subjectName}`,
    [attendanceDate, classroomId, mode, periodLabel, session.workspace?.id, subjectName],
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกเวลาเรียนลง Supabase จริง',
  );
  const [calendarPolicy, setCalendarPolicy] = useState<CalendarAttendancePolicy | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [studentRiskMap, setStudentRiskMap] = useState<Map<string, StudentAttendanceSummary>>(new Map());
  const [autoDetectedPeriodInfo, setAutoDetectedPeriodInfo] = useState<string | null>(null);
  const [postSaveNotifyPrompt, setPostSaveNotifyPrompt] = useState<{ count: number; date: string } | null>(null);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<
    Array<{
      id: string;
      student_id: string;
      leave_type: 'sick' | 'personal' | 'other';
      start_date: string;
      end_date: string;
      reason: string;
    }>
  >([]);
  const [cardDensity, setCardDensity] = useState<'compact' | 'spacious' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('classcare_attendance_view_density');
      if (saved === 'spacious' || saved === 'list' || saved === 'compact') return saved;
    }
    return 'compact';
  });

  useEffect(() => {
    try {
      localStorage.setItem('classcare_attendance_view_density', cardDensity);
    } catch {
      // Ignore storage errors
    }
  }, [cardDensity]);

  function updateMarks(updater: (previous: Record<string, AttendanceStatus | undefined>) => Record<string, AttendanceStatus | undefined>) {
    setUndoMarks(marks);
    setMarks((previous) => {
      const next = updater(previous);
      try {
        const safeMarks = Object.fromEntries(Object.entries(next).filter((entry): entry is [string, AttendanceStatus] =>
          ['present', 'absent', 'late', 'leave', 'sick', 'activity'].includes(entry[1] || ''),
        ));
        window.sessionStorage.setItem(attendanceDraftKey, JSON.stringify({ savedAt: Date.now(), marks: safeMarks }));
      } catch { /* Storage may be unavailable; attendance remains editable in memory. */ }
      return next;
    });
  }

  function undoLastMarkChange() {
    if (!undoMarks) return;
    setMarks(undoMarks);
    try {
      const safeMarks = Object.fromEntries(Object.entries(undoMarks).filter((entry): entry is [string, AttendanceStatus] =>
        ['present', 'absent', 'late', 'leave', 'sick', 'activity'].includes(entry[1] || ''),
      ));
      window.sessionStorage.setItem(attendanceDraftKey, JSON.stringify({ savedAt: Date.now(), marks: safeMarks }));
    } catch { /* Keep the in-memory undo even if storage is unavailable. */ }
    setUndoMarks(null);
    setNotice('ย้อนการแก้ไขล่าสุดแล้ว ยังไม่ได้บันทึกลงระบบ');
  }

  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId);

  const scheduledLessons = useMemo(() => {
    const day = getScheduleDay(attendanceDate);
    const periods = buildSchedulePeriods(scheduleSettings);
    const teacherName = loadSchoolReportIdentity(session.workspace?.id).teacherName?.trim();
    const currentTeacher = (teacherName || session.profile.displayName || '').trim().toLocaleLowerCase('th');

    return periods.flatMap((period) => {
      const cell = scheduleSettings.cells[makeScheduleCellKey(day, period.index)];
      if (!cell?.subject?.trim()) return [];
      if (selectedClassroom?.name && cell.classroom?.trim() && cell.classroom.trim() !== selectedClassroom.name) return [];
      const subjectTeacher = scheduleSettings.subjects.find((subject) => subject.name === cell.subject)?.teacherName?.trim();
      if (subjectTeacher && currentTeacher && subjectTeacher.toLocaleLowerCase('th') !== currentTeacher) return [];
      return [{ ...period, subject: cell.subject.trim() }];
    });
  }, [attendanceDate, scheduleSettings, selectedClassroom?.name, session.profile.displayName, session.workspace?.classroomName, session.workspace?.id]);

  const scheduledSubjectOptions = useMemo(
    () => Array.from(new Set(scheduledLessons.map((lesson) => lesson.subject))),
    [scheduledLessons],
  );
  const attendancePeriodOptions = useMemo(() => {
    const periods = buildSchedulePeriods(scheduleSettings);
    const selectedLessons = scheduledLessons.filter((lesson) => lesson.subject === subjectName);
    const source = scheduledLessons.length > 0 ? selectedLessons : periods.map((period) => ({ ...period, subject: '' }));
    return Array.from(new Map(source.map((period) => [period.label, period])).values());
  }, [scheduleSettings, scheduledLessons, subjectName]);

  const classroomStudents = useMemo(() => {
    const rawClassroomStudents = students.filter((student) => student.classroom_id === classroomId);
    // In real workspaces (non-demo), strictly show only the workspace's real students
    if (!demoMode && session.workspace) {
      return rawClassroomStudents;
    }

    if (!selectedClassroom) return rawClassroomStudents;

    const master = getPrimaryMasterData(selectedClassroom.name);
    const expectedCodes = new Set(master.students.map((s) => s.student_code));

    // Filter students strictly belonging to this grade
    const validStudents = rawClassroomStudents.filter((s) => s.student_code && expectedCodes.has(s.student_code));

    // If some students belonging to this grade are currently assigned to another room (e.g. P.6 misplaced in P.5)
    if (validStudents.length < master.students.length) {
      const missingCodes = master.students
        .map((s) => s.student_code)
        .filter((code) => !validStudents.some((vs) => vs.student_code === code));

      const foundElsewhere = students.filter((s) => s.student_code && missingCodes.includes(s.student_code));
      if (foundElsewhere.length > 0) {
        validStudents.push(...foundElsewhere);
      }
    }

    if (validStudents.length > 0) {
      const codeOrder = new Map(master.students.map((s, idx) => [s.student_code, idx]));
      return validStudents.sort((a, b) => {
        const orderA = a.student_code ? codeOrder.get(a.student_code) ?? 999 : 999;
        const orderB = b.student_code ? codeOrder.get(b.student_code) ?? 999 : 999;
        return orderA - orderB;
      });
    }

    // Fallback if no students loaded yet (ONLY in standalone demo mode)
    if (demoMode) {
      return master.students.map((st) => ({
        id: `fallback-${st.student_code}`,
        student_code: st.student_code,
        first_name: st.first_name,
        last_name: st.last_name,
        nickname: st.first_name.slice(0, 3),
        classroom_id: classroomId,
      }));
    }

    return [];
  }, [classroomId, demoMode, selectedClassroom, session.workspace, students]);

  const summary = useMemo(
    () =>
      statusOptions.map((option) => ({
        ...option,
        count: classroomStudents.filter((student) => marks[student.id] === option.value).length,
      })),
    [classroomStudents, marks],
  );
  const unmarkedCount = classroomStudents.filter((student) => !marks[student.id]).length;

  const alertStudents = useMemo(
    () =>
      classroomStudents.filter((student) =>
        (['absent', 'late', 'leave', 'sick'] as AttendanceStatus[]).includes(marks[student.id] || 'present'),
      ),
    [classroomStudents, marks],
  );

  const [quickRollInput, setQuickRollInput] = useState('');
  const [quickRollStatus, setQuickRollStatus] = useState<AttendanceStatus>('absent');
  const [isQuickRollOpen, setIsQuickRollOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [sheetStudentId, setSheetStudentId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const sessionLabel = `${mode === 'homeroom' ? 'ประจำวัน' : 'รายวิชา'} | ${periodLabel}`;


  const savedStatusByStudent = useMemo(
    () => Object.fromEntries(records.map((record) => [record.student_id, record])),
    [records],
  );

  const isSaved = records.length > 0;
  const hasUnsavedChanges = useMemo(
    () =>
      (classroomStudents.some((student) => Boolean(marks[student.id])) && !isSaved) ||
      classroomStudents.some((student) => {
        const saved = savedStatusByStudent[student.id];
        return (
          marks[student.id] !== saved?.status ||
          (notes[student.id] || '').trim() !== (saved?.note || '').trim()
        );
      }),
    [classroomStudents, isSaved, marks, notes, savedStatusByStudent],
  );

  const isHolidayBlocked = Boolean(calendarPolicy && !calendarPolicy.affects_attendance);
  const isToday = attendanceDate === getTodayDate();
  const attendanceReportPath = `/app/dashboard?view=reports&reportView=attendance&reportPeriod=month&reportMonth=${attendanceDate.slice(0, 7)}&classroomId=${encodeURIComponent(classroomId)}`;

  const dateCalendarHint = useMemo(() => {
    if (!attendanceDate) return null;
    const parsedDate = new Date(`${attendanceDate}T12:00:00`);
    const weekday = parsedDate.getDay();
    const year = parsedDate.getFullYear();
    const holidayMatch = getThaiPublicHolidays(year).find((h) => h.date === attendanceDate);
    if (holidayMatch && !calendarPolicy) {
      return {
        tone: 'amber' as const,
        text: `วันที่เลือกตรงกับ "${holidayMatch.title}" (หากโรงเรียนหยุดเรียน สามารถตั้งงดเช็กชื่อในปฏิทินโรงเรียนได้)`,
      };
    }
    if (weekday === 0 || weekday === 6) {
      return {
        tone: 'sky' as const,
        text: `วันที่เลือกตรงกับวัน${weekday === 0 ? 'อาทิตย์' : 'เสาร์'} (วันหยุดสุดสัปดาห์)`,
      };
    }
    return null;
  }, [attendanceDate, calendarPolicy]);

  const atRiskStudents = useMemo(
    () =>
      classroomStudents
        .map((student) => ({ risk: studentRiskMap.get(student.id), student }))
        .filter((item): item is { risk: StudentAttendanceSummary; student: StudentRow } =>
          Boolean(
            item.risk &&
              (item.risk.isBelowMs ||
                item.risk.isNearMs ||
                item.risk.consecutiveAbsentDays >= 2 ||
                item.risk.lateDays >= 3),
          ),
        )
        .sort(
          (a, b) =>
            b.risk.consecutiveAbsentDays - a.risk.consecutiveAbsentDays ||
            a.risk.attendanceRate - b.risk.attendanceRate,
        ),
    [classroomStudents, studentRiskMap],
  );
  const thaiDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(`${attendanceDate}T12:00:00`),
      ),
    [attendanceDate],
  );
  const sheetStudent = sheetStudentId ? classroomStudents.find((student) => student.id === sheetStudentId) : undefined;
  const sheetStudentIndex = sheetStudent ? classroomStudents.indexOf(sheetStudent) : -1;

  const [scopeFilter, setScopeFilter] = useState<'homeroom' | 'all'>('homeroom');

  const teacherScope = useMemo(
    () => getTeacherClassroomScope(session, classrooms),
    [classrooms, session],
  );

  const displayClassrooms = useMemo(() => {
    if (scopeFilter === 'homeroom' && teacherScope.homeroomClassrooms.length > 0) {
      return teacherScope.homeroomClassrooms;
    }
    return teacherScope.allClassrooms;
  }, [scopeFilter, teacherScope]);

  useEffect(() => {
    let isMounted = true;

    async function loadBaseData() {
      if (!supabase || !session.workspace || demoMode) {
        const demoWithTeacher: ClassroomRow[] = demoClassrooms.map((c) => ({
          ...c,
          homeroom_teacher_profile_id: session.profile.id,
        }));
        setClassrooms(demoWithTeacher);
        setStudents(demoStudents);
        setClassroomId(demoWithTeacher[0].id);
        setMarks(createDefaultMarks(demoStudents));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [{ data: classroomRows, error: classroomError }, { data: studentRows, error: studentError }] =
        await Promise.all([
          supabase
            .from('classrooms')
            .select('id,name,academic_year,homeroom_teacher_profile_id')
            .eq('workspace_id', session.workspace.id)
            .eq('status', 'active')
            .order('name', { ascending: true }),
          supabase
            .from('students')
            .select('id,student_code,first_name,last_name,nickname,classroom_id')
            .eq('workspace_id', session.workspace.id)
            .eq('status', 'active')
            .order('student_code', { ascending: true }),
        ]);

      if (!isMounted) return;

      if (classroomError || studentError) {
        setNotice(classroomError?.message || studentError?.message || 'โหลดข้อมูลเช็คเวลาเรียนไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const nextScope = getTeacherClassroomScope(session, nextClassrooms);
      const nextClassroomId = nextScope.defaultClassroomId || getClassroomWithStudents(nextClassrooms, nextStudents);
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setClassroomId(nextClassroomId);
      setMarks(createDefaultMarks(nextStudents));
      setIsLoading(false);
    }

    void loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace]);

  useEffect(() => {
    const nextStudents = students.filter((student) => student.classroom_id === classroomId);
    const nextMarks = createDefaultMarks(nextStudents);

    for (const record of records) {
      nextMarks[record.student_id] = record.status;
    }

    if (records.length === 0) {
      try {
        const rawDraft = window.sessionStorage.getItem(attendanceDraftKey);
        const draft = rawDraft ? JSON.parse(rawDraft) as { savedAt?: number; marks?: Record<string, AttendanceStatus> } : null;
        const validStatuses = new Set<AttendanceStatus>(['present', 'absent', 'late', 'leave', 'sick', 'activity']);
        const draftIsFresh = draft?.savedAt && Date.now() - draft.savedAt < 8 * 60 * 60 * 1000;
        if (draftIsFresh && draft?.marks) {
          const studentIds = new Set(nextStudents.map((student) => student.id));
          Object.entries(draft.marks).forEach(([studentId, status]) => {
            if (studentIds.has(studentId) && validStatuses.has(status)) nextMarks[studentId] = status;
          });
          setNotice('กู้คืนร่างเช็กชื่อจากแท็บนี้แล้ว ตรวจรายชื่อและกดบันทึกเมื่อพร้อม');
        } else if (rawDraft) {
          window.sessionStorage.removeItem(attendanceDraftKey);
        }
      } catch { /* Ignore invalid or unavailable local draft data. */ }
    }

    setMarks(nextMarks);
    setNotes(Object.fromEntries(records.map((record) => [record.student_id, record.note || ''])));
  }, [attendanceDraftKey, classroomId, records, students]);

  useEffect(() => {
    setUndoMarks(null);
    setSavedAttendanceUndo(null);
    setPostSaveNotifyPrompt(null);
  }, [attendanceDraftKey]);

  useEffect(() => {
    setScheduleSettings(loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id));
  }, [session.workspace?.classroomName, session.workspace?.id]);

  useEffect(() => {
    if (mode === 'homeroom') {
      setSubjectName(modeCopy.homeroom.subject);
      setPeriodLabel('เช้า');
      setAutoDetectedPeriodInfo(null);
      return;
    }

    const detected = isToday ? detectActiveSchedulePeriod(scheduleSettings) : null;
    const roomMatches =
      detected &&
      (!detected.cell?.classroom?.trim() ||
        !selectedClassroom?.name ||
        detected.cell.classroom.trim() === selectedClassroom.name);

    if (detected && roomMatches) {
      const detectedSubject = detected.cell?.subject?.trim() || modeCopy.subject.subject;
      setPeriodLabel(detected.period.label);
      setSubjectName(detectedSubject);
      setAutoDetectedPeriodInfo(
        `ตรวจพบคาบปัจจุบัน: ${detected.period.label}${detected.cell?.subject?.trim() ? ` · ${detected.cell.subject.trim()}` : ''} (${detected.period.start}-${detected.period.end})`,
      );
      return;
    }

    setSubjectName(modeCopy.subject.subject);
    setPeriodLabel('คาบ 1');
    setAutoDetectedPeriodInfo(null);
  }, [mode, isToday, scheduleSettings, selectedClassroom?.name]);

  useEffect(() => {
    let active = true;

    async function loadTrailingAttendanceRisk() {
      if (!classroomId || classroomStudents.length === 0) {
        if (active) setStudentRiskMap(new Map());
        return;
      }

      const studentIds = classroomStudents.map((s) => s.id);

      if (!supabase || !session.workspace || demoMode) {
        if (records.length === 0) {
          if (active) setStudentRiskMap(new Map());
          return;
        }
        const computed = computeAttendanceStreaksAndRates(
          [
            {
              id: attendanceSession?.id || 'demo-current-session',
              attendance_date: attendanceDate,
              subject_name: mode === 'subject' ? subjectName : null,
            },
          ],
          records,
          studentIds,
        );
        if (active) setStudentRiskMap(computed);
        return;
      }

      const anchor = new Date(`${attendanceDate}T12:00:00`);
      anchor.setDate(anchor.getDate() - 30);
      const sinceDate = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`;

      const { data: recentSessions, error: sessErr } = await supabase
        .from('attendance_sessions')
        .select('id,attendance_date,subject_name')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', classroomId)
        .gte('attendance_date', sinceDate)
        .lte('attendance_date', attendanceDate)
        .order('attendance_date', { ascending: false })
        .limit(90);

      if (!active || sessErr || !recentSessions || recentSessions.length === 0) {
        if (active) setStudentRiskMap(new Map());
        return;
      }

      const sessionIds = recentSessions.map((s) => s.id);
      const { data: recentRecords, error: recErr } = await supabase
        .from('attendance_records')
        .select('session_id,student_id,status')
        .eq('workspace_id', session.workspace.id)
        .in('session_id', sessionIds);

      if (!active || recErr) return;

      const computed = computeAttendanceStreaksAndRates(recentSessions, recentRecords || [], studentIds);
      setStudentRiskMap(computed);
    }

    void loadTrailingAttendanceRisk();
    return () => {
      active = false;
    };
  }, [attendanceDate, attendanceSession?.id, classroomId, classroomStudents, demoMode, mode, records, session.workspace, subjectName]);

  useEffect(() => {
    let isMounted = true;

    async function loadSharedSchedule() {
      if (!supabase || !session.workspace || demoMode) return;
      const { data, error } = await supabase
        .from('workspace_schedule_settings')
        .select('settings')
        .eq('workspace_id', session.workspace.id)
        .maybeSingle();
      if (!isMounted || error || !data?.settings || typeof data.settings !== 'object') return;

      const local = loadScheduleSettings(session.workspace.classroomName, session.workspace.id);
      const shared = data.settings as Partial<ScheduleSettings>;
      setScheduleSettings({ ...local, ...shared, cells: shared.cells || local.cells, subjects: shared.subjects || local.subjects });
    }

    void loadSharedSchedule();
    return () => { isMounted = false; };
  }, [demoMode, session.workspace]);

  useEffect(() => {
    if (mode !== 'subject' || scheduledSubjectOptions.length === 0) return;
    if (!scheduledSubjectOptions.includes(subjectName)) setSubjectName(scheduledSubjectOptions[0]);
  }, [mode, scheduledSubjectOptions, subjectName]);

  useEffect(() => {
    if (mode !== 'subject' || attendancePeriodOptions.length === 0) return;
    if (!attendancePeriodOptions.some((period) => period.label === periodLabel)) setPeriodLabel(attendancePeriodOptions[0].label);
  }, [attendancePeriodOptions, mode, periodLabel]);

  useEffect(() => {
    let isMounted = true;
    async function checkExistingSession() {
      if (!classroomId || !attendanceDate) return;
      if (!supabase || !session.workspace || demoMode) {
        setAttendanceSession(null);
        setRecords([]);
        return;
      }
      const normalizedPeriod = periodLabel;
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('id,classroom_id,attendance_date,period_label,subject_name,status')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', classroomId)
        .eq('attendance_date', attendanceDate)
        .eq('period_label', normalizedPeriod)
        .maybeSingle();

      if (!isMounted) return;
      if (data && !error) {
        const foundSession = data as AttendanceSessionRow;
        setAttendanceSession(foundSession);
        setEditSessionDate(foundSession.attendance_date);
        await loadSessionRecords(foundSession);
      } else {
        setAttendanceSession(null);
        setRecords([]);
      }
    }
    void checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, [attendanceDate, classroomId, demoMode, mode, periodLabel, session.workspace]);

  useEffect(() => {
    let active = true;
    async function loadCalendarPolicy() {
      if (!supabase || !session.workspace?.id || demoMode) {
        setCalendarPolicy(null);
        return;
      }
      const { data } = await supabase
        .from('school_calendar_days')
        .select('title,day_type,affects_attendance')
        .eq('workspace_id', session.workspace.id)
        .eq('calendar_date', attendanceDate)
        .in('day_type', ['holiday', 'closed'])
        .limit(1)
        .maybeSingle();
      if (active) setCalendarPolicy((data as CalendarAttendancePolicy | null) || null);
    }
    void loadCalendarPolicy();
    return () => {
      active = false;
    };
  }, [attendanceDate, demoMode, session.workspace?.id]);

  // Load pending online guardian leave requests covering attendanceDate for the active classroom
  useEffect(() => {
    let active = true;

    async function loadPendingLeaves() {
      if (!supabase || !session.workspace?.id || !classroomId || !attendanceDate || demoMode) {
        if (active) setPendingLeaveRequests([]);
        return;
      }

      const { data, error } = await supabase
        .from('student_leave_requests')
        .select('id,student_id,leave_type,start_date,end_date,reason')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', classroomId)
        .eq('status', 'pending')
        .lte('start_date', attendanceDate)
        .gte('end_date', attendanceDate)
        .limit(30);

      if (!active) return;
      if (error) {
        // Ignore gracefully when migration 0096 has not yet been applied
        setPendingLeaveRequests([]);
        return;
      }
      setPendingLeaveRequests(
        (data || []) as Array<{
          id: string;
          student_id: string;
          leave_type: 'sick' | 'personal' | 'other';
          start_date: string;
          end_date: string;
          reason: string;
        }>,
      );
    }

    void loadPendingLeaves();
    return () => {
      active = false;
    };
  }, [attendanceDate, classroomId, demoMode, session.workspace?.id]);

  async function handleReviewLeaveRequest(
    req: {
      id: string;
      student_id: string;
      leave_type: 'sick' | 'personal' | 'other';
      reason: string;
    },
    decision: 'approved' | 'rejected',
  ) {
    if (!supabase || !session.workspace?.id || demoMode) return;

    const { error } = await supabase
      .from('student_leave_requests')
      .update({
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.profile.id,
        status: decision,
      })
      .eq('id', req.id)
      .eq('workspace_id', session.workspace.id);

    if (error) {
      setNotice(`อัปเดตสถานะใบลาไม่สำเร็จ: ${error.message}`);
      return;
    }

    setPendingLeaveRequests((prev) => prev.filter((item) => item.id !== req.id));
    if (decision === 'approved') {
      const targetStatus: AttendanceStatus = req.leave_type === 'sick' ? 'sick' : 'leave';
      updateMarks((prev) => ({ ...prev, [req.student_id]: targetStatus }));
      setNotes((prev) => ({ ...prev, [req.student_id]: `[ใบลาออนไลน์] ${req.reason}` }));
      setNotice('รับทราบใบลาและตั้งสถานะในตารางเช็กชื่อแล้ว (กด "บันทึกเช็คชื่อ" เพื่อยืนยันลงฐานข้อมูล)');
    } else {
      setNotice('ปฏิเสธคำขอลาออนไลน์แล้ว');
    }
  }

  async function loadSessionRecords(nextSession: AttendanceSessionRow) {
    if (!supabase || !session.workspace || isDemoSession(session)) return;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('id,session_id,student_id,status,note')
      .eq('workspace_id', session.workspace.id)
      .eq('session_id', nextSession.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setRecords((data || []) as AttendanceRecordRow[]);
  }

  async function ensureSession(onNetworkError?: () => void): Promise<AttendanceSessionRow | null> {
    if (attendanceSession) return attendanceSession;

    if (calendarPolicy && !calendarPolicy.affects_attendance) {
      setNotice(`วันที่เลือกเป็น ${calendarPolicy.title} ระบบจึงไม่บันทึกเช็คชื่อตามปฏิทินโรงเรียน`);
      return null;
    }

    if (!classroomId) {
      setNotice('กรุณาเลือกห้องเรียนก่อน');
      return null;
    }

    const normalizedSubjectName = mode === 'subject' ? subjectName.trim() || 'ไม่ระบุวิชา' : null;
    const normalizedPeriod = periodLabel.trim() || (mode === 'homeroom' ? 'เช้า' : 'คาบ 1');

    if (!supabase || !session.workspace || isDemoSession(session)) {
      const localSession: AttendanceSessionRow = {
        attendance_date: attendanceDate,
        classroom_id: classroomId,
        id: `demo-attendance-${Date.now()}`,
        period_label: normalizedPeriod,
        status: 'draft',
        subject_name: normalizedSubjectName,
      };
      setAttendanceSession(localSession);
      return localSession;
    }

    const { data, error } = await supabase
      .from('attendance_sessions')
      .upsert(
        {
          workspace_id: session.workspace.id,
          classroom_id: classroomId,
          attendance_date: attendanceDate,
          period_label: normalizedPeriod,
          subject_name: normalizedSubjectName,
          status: 'draft',
          created_by: session.profile.id,
        },
        { onConflict: 'workspace_id,classroom_id,attendance_date,period_label' },
      )
      .select('id,classroom_id,attendance_date,period_label,subject_name,status')
      .single();

    if (error) {
      if (isLikelyNetworkError(error)) {
        onNetworkError?.();
      }
      setNotice(getAttendanceErrorMessage(error.message));
      return null;
    }

    const nextSession = data as AttendanceSessionRow;
    setAttendanceSession(nextSession);
    setEditSessionDate(nextSession.attendance_date);
    return nextSession;
  }

  async function handleCorrectSessionDate() {
    if (!attendanceSession || !editSessionDate || editSessionDate === attendanceSession.attendance_date) return;
    setIsSubmitting(true);
    setNotice(null);
    const previousDate = attendanceSession.attendance_date;
    const operationId = feedback.beginOperation({
      title: 'กำลังแก้ไขวันที่เช็คชื่อ',
      message: `ย้ายข้อมูลจาก ${previousDate} ไปยัง ${editSessionDate}`,
    });
    if (!supabase || !session.workspace || isDemoSession(session)) {
      setAttendanceSession((current) => (current ? { ...current, attendance_date: editSessionDate } : current));
      setAttendanceDate(editSessionDate);
      setNotice('แก้ไขวันที่บันทึกในโหมดตัวอย่างแล้ว');
      feedback.endOperation(operationId);
      feedback.success({
        title: 'แก้ไขวันที่สำเร็จ',
        message: 'ข้อมูลเช็คชื่อและรายงานจะอ้างอิงวันที่ใหม่',
        details: [
          { label: 'วันที่เดิม', value: previousDate },
          { label: 'วันที่ใหม่', value: editSessionDate },
        ],
      });
      setIsSubmitting(false);
      return;
    }
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({ attendance_date: editSessionDate })
      .eq('id', attendanceSession.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,classroom_id,attendance_date,period_label,subject_name,status')
      .single();
    if (error) {
      setNotice(getAttendanceErrorMessage(error.message));
      feedback.endOperation(operationId);
      feedback.error({ title: 'แก้ไขวันที่ไม่สำเร็จ', message: getAttendanceErrorMessage(error.message) });
      setIsSubmitting(false);
      return;
    }
    setAttendanceSession(data as AttendanceSessionRow);
    setAttendanceDate(editSessionDate);
    setNotice('แก้ไขวันที่ของบันทึกแล้ว และรายงานจะย้ายตามวันที่ใหม่');
    feedback.endOperation(operationId);
    feedback.success({
      title: 'แก้ไขวันที่สำเร็จ',
      message: 'ข้อมูลเช็คชื่อและรายงานถูกย้ายไปอ้างอิงวันที่ใหม่แล้ว',
      details: [
        { label: 'วันที่เดิม', value: previousDate },
        { label: 'วันที่ใหม่', value: editSessionDate },
      ],
    });
    setIsSubmitting(false);
  }

  async function handleSaveRecords() {
    if (classroomStudents.length === 0) return;
    if (unmarkedCount > 0) {
      setNotice(`ยังไม่ได้ตรวจ ${unmarkedCount} คน กรุณาแตะรายชื่อหรือเลือก “มาทุกคน” หลังตรวจแล้ว`);
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    const operationId = feedback.beginOperation({
      title: 'กำลังบันทึกผลเช็คชื่อ',
      message: `ตรวจสอบสถานะนักเรียน ${classroomStudents.length} คน และบันทึกลงระบบ`,
    });

    const normalizedSubjectName = mode === 'subject' ? subjectName.trim() || 'ไม่ระบุวิชา' : null;
    const normalizedPeriod = periodLabel.trim() || (mode === 'homeroom' ? 'เช้า' : 'คาบ 1');
    const queueAttendanceOffline = (opId: number) => {
      if (!session.workspace?.id) return;
      const nowIso = new Date().toISOString();
      const offlineRecords = classroomStudents.map((student) => ({
        checked_at: nowIso,
        checked_by: session.profile.id,
        note: notes[student.id]?.trim() || null,
        status: marks[student.id] || 'present',
        student_id: student.id,
      }));
      enqueueOfflineMutation({
        kind: 'attendance_batch',
        label: `เช็กชื่อ ${selectedClassroom?.name || '-'} (${attendanceDate} · ${normalizedPeriod})`,
        payload: {
          attendanceDate,
          classroomId,
          createdBy: session.profile.id,
          periodLabel: normalizedPeriod,
          records: offlineRecords,
          subjectName: normalizedSubjectName,
        },
        workspaceId: session.workspace.id,
      });
      const localSessId = attendanceSession?.id || `offline-attendance-${Date.now()}`;
      setRecords(
        offlineRecords.map((rec) => ({
          id: `offline-rec-${rec.student_id}`,
          note: rec.note,
          session_id: localSessId,
          status: rec.status as AttendanceStatus,
          student_id: rec.student_id,
        })),
      );
      try { window.sessionStorage.removeItem(attendanceDraftKey); } catch { /* no-op */ }
      setUndoMarks(null);
      setNotice('ไม่มีอินเทอร์เน็ต — บันทึกเช็กชื่อลงคิวออฟไลน์แล้ว ระบบจะซิงก์อัตโนมัติเมื่อเชื่อมต่อ');
      feedback.endOperation(opId);
      feedback.success({
        title: 'พักข้อมูลเช็กชื่อแบบออฟไลน์แล้ว',
        message: 'ไม่มีอินเทอร์เน็ตชั่วคราว — ข้อมูลถูกเก็บในเครื่องและจะซิงก์อัตโนมัติเมื่อเน็ตกลับมา',
        details: [
          { label: 'วันที่', value: attendanceDate },
          { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
          { label: 'ช่วงเวลา', value: normalizedPeriod },
        ],
      });
      setIsSubmitting(false);
    };

    if (supabase && session.workspace && !isDemoSession(session) && typeof navigator !== 'undefined' && !navigator.onLine) {
      queueAttendanceOffline(operationId);
      return;
    }

    let sessionNetworkFailed = false;
    const activeSession = await ensureSession(() => {
      sessionNetworkFailed = true;
    });
    if (!activeSession) {
      if (supabase && session.workspace && !isDemoSession(session) && !(isHolidayBlocked && calendarPolicy) && (sessionNetworkFailed || (typeof navigator !== 'undefined' && !navigator.onLine))) {
        queueAttendanceOffline(operationId);
        return;
      }
      feedback.endOperation(operationId);
      feedback.error({
        title: 'บันทึกเช็คชื่อไม่สำเร็จ',
        message: isHolidayBlocked && calendarPolicy
          ? `วันที่เลือกเป็น ${calendarPolicy.title} จึงไม่ต้องเช็คชื่อ`
          : 'ไม่สามารถเปิดรอบเช็คชื่อได้ ลองใหม่อีกครั้ง',
      });
      setIsSubmitting(false);
      return;
    }

    const payload = classroomStudents.map((student) => ({
      workspace_id: session.workspace?.id || 'demo-workspace',
      session_id: activeSession.id,
      student_id: student.id,
      status: marks[student.id] || 'present',
      note: notes[student.id]?.trim() || null,
      checked_by: session.profile.id,
      checked_at: new Date().toISOString(),
    }));

    const successDetails = [
      { label: 'วันที่', value: activeSession.attendance_date },
      { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
      { label: 'ช่วงเวลา', value: activeSession.period_label },
      ...summary.filter((item) => item.count > 0).map((item) => ({ label: item.label, value: `${item.count} คน` })),
    ];

    if (!supabase || !session.workspace || isDemoSession(session)) {
      setRecords(
        payload.map((record) => ({
          id: `demo-record-${record.student_id}`,
          note: record.note,
          session_id: record.session_id,
          status: record.status,
          student_id: record.student_id,
        })),
      );
      setSavedAttendanceUndo(hasCompleteAttendanceSnapshot(records, classroomStudents, activeSession.id)
        ? { records: [...records], sessionId: activeSession.id }
        : null);
      try { window.sessionStorage.removeItem(attendanceDraftKey); } catch { /* no-op */ }
      setUndoMarks(null);
      const demoAlertCount = payload.filter((r) => r.status === 'absent' || r.status === 'late' || r.status === 'leave' || r.status === 'sick').length;
      setPostSaveNotifyPrompt(demoAlertCount > 0 ? { count: demoAlertCount, date: activeSession.attendance_date } : null);
      feedback.endOperation(operationId);
      feedback.success({
        title: 'บันทึกเช็คชื่อแล้ว',
        message: 'บันทึกข้อมูลในโหมดตัวอย่างครบทุกคนแล้ว',
        details: successDetails,
      });
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'session_id,student_id' })
      .select('id,session_id,student_id,status,note');

    if (error) {
      if (isLikelyNetworkError(error)) {
        queueAttendanceOffline(operationId);
        return;
      }
      setNotice(getAttendanceErrorMessage(error.message));
      feedback.endOperation(operationId);
      feedback.error({
        title: 'บันทึกเช็คชื่อไม่สำเร็จ',
        message: getAttendanceErrorMessage(error.message),
        details: [
          { label: 'วันที่', value: activeSession.attendance_date },
          { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
          { label: 'ข้อมูลที่พยายามบันทึก', value: `${payload.length} คน` },
        ],
      });
      setIsSubmitting(false);
      return;
    }

    setRecords((data || []) as AttendanceRecordRow[]);
    setSavedAttendanceUndo(hasCompleteAttendanceSnapshot(records, classroomStudents, activeSession.id)
      ? { records: [...records], sessionId: activeSession.id }
      : null);
    try { window.sessionStorage.removeItem(attendanceDraftKey); } catch { /* no-op */ }
    setUndoMarks(null);
    await writeAuditLog(session, {
      action: 'attendance.records.saved',
      entityId: activeSession.id,
      entityTable: 'attendance_sessions',
      metadata: {
        absent_count: summary.find((item) => item.value === 'absent')?.count || 0,
        absent_student_ids: payload.filter((record) => record.status === 'absent').map((record) => record.student_id),
        attendance_date: activeSession.attendance_date,
        classroom_name: selectedClassroom?.name || '',
        late_count: summary.find((item) => item.value === 'late')?.count || 0,
        late_student_ids: payload.filter((record) => record.status === 'late').map((record) => record.student_id),
        leave_count: summary.find((item) => item.value === 'leave')?.count || 0,
        period_label: activeSession.period_label,
        present_count: summary.find((item) => item.value === 'present')?.count || 0,
        student_count: payload.length,
        subject_name: activeSession.subject_name || '',
      },
      source: 'attendance_page',
    });
    const isSubjectCheck = mode === 'subject';
    const countSummary = summary.filter((item) => item.count > 0).map((item) => `${item.label} ${item.count} คน`).join(' · ');
    void sendTeacherReport({
      body: [
        `ห้อง ${selectedClassroom?.name || '-'}`,
        ...(isSubjectCheck ? [`วิชา ${activeSession.subject_name || '-'}`, activeSession.period_label] : ['เช็คชื่อประจำชั้น']),
        activeSession.attendance_date,
        countSummary || `บันทึกนักเรียน ${data?.length || 0} คน`,
      ].join('\n'),
      eventId: `${activeSession.id}:${Date.now()}`,
      attendance: {
        school: session.workspace?.schoolName || 'รายงานชั้นเรียน',
        classroom: selectedClassroom?.name || '-',
        date: activeSession.attendance_date,
        subject: isSubjectCheck ? activeSession.subject_name : null,
        period: activeSession.period_label,
        students: payload.map((record) => {
          const student = classroomStudents.find((item) => item.id === record.student_id);
          return { name: student ? `${student.first_name} ${student.last_name}` : 'ไม่ระบุชื่อ', status: record.status };
        }),
      },
      kind: isSubjectCheck ? 'attendance_subject' : 'attendance_homeroom',
      session,
      title: isSubjectCheck ? 'รายงานการมาเรียนรายวิชา' : 'รายงานการมาเรียนประจำวัน',
    });
    feedback.endOperation(operationId);
    const savedAlertCount = payload.filter((r) => r.status === 'absent' || r.status === 'late' || r.status === 'leave' || r.status === 'sick').length;
    setPostSaveNotifyPrompt(savedAlertCount > 0 ? { count: savedAlertCount, date: activeSession.attendance_date } : null);
    feedback.success({
      title: 'บันทึกเช็คชื่อแล้ว',
      message: `บันทึกสถานะนักเรียนครบ ${data?.length || 0} คน`,
      details: successDetails,
    });
    setIsSubmitting(false);
  }

  async function undoLastSavedAttendance() {
    if (!savedAttendanceUndo || savedAttendanceUndo.sessionId !== attendanceSession?.id || isSubmitting) return;
    const confirmed = window.confirm('ย้อนผลเช็กชื่อที่เพิ่งบันทึกกลับไปเป็นชุดก่อนหน้าใช่ไหม? ระบบจะบันทึกการย้อนกลับไว้ในประวัติ audit');
    if (!confirmed) return;
    setIsSubmitting(true);
    const priorRecords = savedAttendanceUndo.records;
    if (!supabase || !session.workspace || isDemoSession(session)) {
      setRecords(priorRecords);
      setSavedAttendanceUndo(null);
      setNotice('ย้อนผลเช็กชื่อกลับไปเป็นชุดก่อนหน้าแล้ว (โหมดตัวอย่าง)');
      setIsSubmitting(false);
      return;
    }

    const restorePayload = priorRecords.map((record) => ({
      workspace_id: session.workspace!.id,
      session_id: savedAttendanceUndo.sessionId,
      student_id: record.student_id,
      status: record.status,
      note: record.note || null,
      checked_by: session.profile.id,
      checked_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(restorePayload, { onConflict: 'session_id,student_id' })
      .select('id,session_id,student_id,status,note');
    if (error) {
      setNotice(`ย้อนผลเช็กชื่อไม่สำเร็จ: ${error.message}`);
      setIsSubmitting(false);
      return;
    }
    setRecords((data || []) as AttendanceRecordRow[]);
    await writeAuditLog(session, {
      action: 'attendance.records.undo',
      entityId: savedAttendanceUndo.sessionId,
      entityTable: 'attendance_sessions',
      metadata: { restored_record_count: restorePayload.length },
      source: 'attendance_page',
    });
    setSavedAttendanceUndo(null);
    setNotice('ย้อนผลเช็กชื่อเป็นชุดก่อนหน้าแล้ว');
    setIsSubmitting(false);
  }

  async function notifyGuardians() {
    if (alertStudents.length === 0) {
      setNotice('ยังไม่มีรายการขาด/สาย/ลา/ป่วยสำหรับส่งแจ้งเตือน');
      return;
    }

    setIsNotifying(true);
    setNotice(null);

    const alertStudentIds = alertStudents.map((student) => student.id);

    if (!supabase || !session.workspace || isDemoSession(session)) {
      setNotice(`ส่งแจ้งเตือนผู้ปกครองในโหมดตัวอย่างแล้ว ${alertStudents.length} รายการ`);
      setIsNotifying(false);
      return;
    }

    const activeSupabase = supabase;
    const activeWorkspaceId = session.workspace.id;
    const { data: guardians, error: guardianError } = await activeSupabase
      .from('student_guardians')
      .select('student_id,profile_id,relation,display_name')
      .eq('workspace_id', activeWorkspaceId)
      .eq('consent_status', 'granted')
      .in('student_id', alertStudentIds);

    if (guardianError) {
      setNotice(guardianError.message);
      setIsNotifying(false);
      return;
    }

    const targets = ((guardians || []) as GuardianNotificationTarget[]).filter((guardian) => guardian.profile_id);
    if (targets.length === 0) {
      setNotice('ยังไม่มีผู้ปกครองที่ผูก profile และ consent เป็น granted สำหรับรายการที่ต้องแจ้ง');
      setIsNotifying(false);
      return;
    }

    const approvalRows = targets.map((guardian) => {
      const student = alertStudents.find((item) => item.id === guardian.student_id);
      const status = (student ? marks[student.id] : undefined) || 'present';
      const studentName = student ? `${student.first_name} ${student.last_name}` : 'นักเรียน';
      const note = student ? notes[student.id]?.trim() : '';
      return {
        body: `${studentName} มีสถานะ ${statusLabels[status]} วันที่ ${attendanceDate} ${sessionLabel}${note ? ` หมายเหตุ: ${note}` : ''}`,
        channels: ['in_app'],
        consent_snapshot: { consent_status: 'granted', relation: guardian.relation },
        created_by: session.profile.id,
        reason: `เตรียมจากผลเช็กชื่อ สถานะ ${statusLabels[status]} รอครูอนุมัติก่อนส่ง`,
        recipient_name: guardian.display_name,
        recipient_profile_id: guardian.profile_id,
        source_id: attendanceSession?.id,
        source_type: 'attendance_session',
        status: 'pending',
        student_id: guardian.student_id,
        title: `แจ้งเวลาเรียน: ${studentName}`,
        workspace_id: activeWorkspaceId,
      };
    });
    const { error: approvalError } = await activeSupabase
      .from('communication_approval_queue')
      .upsert(approvalRows, { ignoreDuplicates: true });
    if (approvalError) {
      setNotice(approvalError.message);
    } else {
      setNotice(`เตรียมข้อความ ${approvalRows.length} รายการแล้ว กรุณาตรวจและอนุมัติใน Automation Center`);
      feedback.success({
        title: 'เตรียมข้อความแล้ว',
        message: `${approvalRows.length} รายการยังไม่ถูกส่ง ระบบรอครูอนุมัติก่อน`,
      });
    }
    setIsNotifying(false);
  }

  function markAll(status: AttendanceStatus) {
    updateMarks(() => Object.fromEntries(classroomStudents.map((student) => [student.id, status])));
  }

  function handleApplyQuickRollNumbers() {
    if (!quickRollInput.trim()) return;

    const targetNumbers = quickRollInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);

    if (targetNumbers.length === 0) {
      setNotice('กรุณากรอกเลขที่ให้ถูกต้อง เช่น 3, 7, 12');
      return;
    }

    const updatedMarks = { ...marks };
    classroomStudents.forEach((student, index) => {
      const roll = student.student_code ? parseInt(student.student_code.replace(/^[A-Za-z]+-?/, ''), 10) : index + 1;
      const matched = targetNumbers.includes(roll) || targetNumbers.includes(index + 1);
      if (matched) {
        updatedMarks[student.id] = quickRollStatus;
      } else if (!updatedMarks[student.id]) {
        updatedMarks[student.id] = 'present';
      }
    });

    updateMarks(() => updatedMarks);
    setQuickRollInput('');
    setIsQuickRollOpen(false);
    const statusLabel = statusLabels[quickRollStatus] || quickRollStatus;
    setNotice(`บันทึกสถานะ [${statusLabel}] ให้นักเรียนเลขที่ ${targetNumbers.join(', ')} เรียบร้อยแล้ว (ที่เหลือเป็น [มา]) — กด "บันทึกเช็คชื่อ" ได้เลย`);
  }

  function handleApplyAttendanceOcr(recordsToApply: Record<string, { status: AttendanceStatus; note?: string | null }>) {
    updateMarks((prev) => {
      const next = { ...prev };
      Object.entries(recordsToApply).forEach(([stdId, rec]) => {
        next[stdId] = rec.status;
      });
      return next;
    });
    setNotes((prev) => {
      const next = { ...prev };
      Object.entries(recordsToApply).forEach(([stdId, rec]) => {
        if (rec.note) next[stdId] = rec.note;
      });
      return next;
    });
    setNotice(`สแกนและนำเข้าผลการเช็คชื่อสำเร็จ (${Object.keys(recordsToApply).length} คน) ตรวจทานแล้วกด "บันทึกเช็คชื่อ"`);
  }

  function handleStudentTap(studentId: string) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    const current = marks[studentId];
    if (!current) {
      updateMarks((prev) => ({ ...prev, [studentId]: 'present' }));
      return;
    }
    const currentIndex = TAP_CYCLE.indexOf(current);
    const nextStatus = currentIndex === -1 ? 'absent' : TAP_CYCLE[(currentIndex + 1) % TAP_CYCLE.length];
    updateMarks((prev) => ({ ...prev, [studentId]: nextStatus }));
  }

  function handlePointerDown(studentId: string) {
    longPressTriggered.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setSheetStudentId(studentId);
    }, 450);
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerCancel() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <main className="app-page min-h-screen pb-64 lg:pb-32">
      {/* ======================================================== */}
      {/* SOFT 3D LINEN CONTAINER                                  */}
      {/* ======================================================== */}
      <div className="rounded-[28px] border border-[#DCE3D7] bg-white p-4 sm:p-7 shadow-[0_12px_32px_-6px_rgba(28,52,43,0.08)]">
        
        {/* Header */}
        <header className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1C342B] tracking-tight flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#2F7D5B] to-[#1C342B] text-white shadow-md shadow-[#1C342B]/20">
                  <CalendarCheck2 size={20} aria-hidden="true" />
                </span>
                <span>เช็คชื่อ{isToday ? 'วันนี้' : 'ย้อนหลัง'}</span>
              </h1>
            </div>
            <p className="mt-1 text-sm sm:text-base font-semibold text-[#5A6F64]">
              {thaiDateLabel} · {mode === 'homeroom' ? (periodLabel === 'เช้า' ? 'ช่วงเช้า' : periodLabel) : `${subjectName} (${periodLabel})`}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs sm:text-sm font-medium text-[#5A6F64]">
              <span>แตะรายชื่อเพื่อเริ่มเช็กชื่อ · แตะซ้ำเพื่อเปลี่ยนสถานะ · กดไอคอน</span>
              <Pencil size={13} className="inline text-[#2F7D5B]" aria-hidden="true" />
              <span>เพื่อเลือกสถานะเพิ่มเติม</span>
            </p>
          </div>

          <div className={`${isMobileControlsOpen ? 'flex' : 'hidden'} w-full flex-wrap items-center justify-start gap-2 md:flex md:w-auto md:justify-end`}>
            {/* Keep the date control visible so missed days are easy to record later. */}
            <div className={`rounded-xl border px-2.5 py-1.5 shadow-2xs ${isToday ? 'border-[#DCE3D7] bg-[#FAFBF8]' : 'border-amber-300 bg-amber-50'}`}>
              <span className="mb-0.5 block text-[10px] font-black text-[#5A6F64]">วันที่เช็กชื่อ</span>
              <div className="flex items-center gap-1.5">
                <ThaiDatePicker
                  className="h-8 min-w-36 bg-white px-2.5 text-xs shadow-xs"
                  value={attendanceDate}
                  max={getTodayDate()}
                  onValueChange={setAttendanceDate}
                />
                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${isToday ? 'bg-[#E9F0EA] text-[#2F7D5B]' : 'bg-amber-200 text-amber-950'}`}>
                  {isToday ? 'วันนี้' : 'ย้อนหลัง'}
                </span>
              </div>
            </div>
            {/* Classroom Selector */}
            <div className="relative inline-flex items-center shadow-2xs">
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="appearance-none rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] py-2 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-[#1C342B] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#2F7D5B]/40 cursor-pointer"
              >
                {displayClassrooms.map((c) => {
                  const badge = getClassroomScopeBadge(c, session.profile.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.academic_year ? `(${c.academic_year})` : ''} — {badge.label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6F64]" />
            </div>

            {/* More Settings Button */}
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] text-[#1C342B] hover:bg-[#E9F0EA] active:scale-95 transition shadow-2xs"
              title="เมนูเพิ่มเติม (เปลี่ยนวันที่ / รายวิชา / แก้ไขย้อนหลัง)"
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        </header>

        {/* Mobile Compact Context Bar (< md): keeps student list above the fold */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] px-3 py-2 md:hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-bold text-[#1C342B]">
            <span className="truncate max-w-[110px] font-black">{selectedClassroom?.name || 'เลือกห้อง'}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isToday ? 'bg-[#E6F4EC] text-[#1C573D]' : 'bg-amber-200 text-amber-950'}`}>
              {isToday ? 'วันนี้' : 'ย้อนหลัง'}
            </span>
            <span className="truncate max-w-[140px] text-[#5A6F64]">
              · {mode === 'homeroom' ? 'ประจำวัน' : `${subjectName} (${periodLabel})`}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to={attendanceReportPath}
              title="ดูรายงานและพิมพ์"
              aria-label="ดูรายงานและพิมพ์"
              className="grid h-8 w-8 place-items-center rounded-xl border border-[#DCE3D7] bg-white text-[#1C342B]"
            >
              <Printer size={14} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileControlsOpen((prev) => !prev)}
              aria-expanded={isMobileControlsOpen}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#BFE0CD] bg-[#E6F4EC] px-2.5 text-xs font-bold text-[#1C573D]"
            >
              <span>{isMobileControlsOpen ? 'ซ่อน' : 'เปลี่ยน'}</span>
              <ChevronDown
                size={13}
                className={`transition-transform ${isMobileControlsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <div className={`${isMobileControlsOpen ? 'flex' : 'hidden'} mt-3 flex-wrap items-center gap-2 rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-2 md:flex`}>
          <span className="px-2 text-xs font-bold text-slate-600">กำลังเช็กชื่อแบบ:</span>
          {(['homeroom', 'subject'] as AttendanceMode[]).map((attendanceMode) => {
            const Icon = modeCopy[attendanceMode].icon;
            const selected = mode === attendanceMode;
            return (
              <button
                key={attendanceMode}
                type="button"
                aria-pressed={selected}
                onClick={() => setMode(attendanceMode)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition shadow-xs ${selected ? 'border-[#8CC6A7] bg-gradient-to-b from-[#F0FBF3] to-[#D8F2E1] text-[#144A34] shadow-xs' : 'border-[#DCE3D7] bg-white text-[#5A6F64] hover:bg-[#E9F0EA]/60'}`}
              >
                <Icon size={16} />
                {attendanceMode === 'homeroom' ? 'เช็กชื่อประจำวัน' : 'เช็กชื่อรายวิชา'}
              </button>
            );
          })}
          {mode === 'subject' && (
            <div className="flex flex-1 flex-wrap items-center gap-2 px-1">
              <label className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs font-bold text-slate-700">
                <BookOpen size={15} className="text-sky-700" aria-hidden="true" />
                <span>วิชา</span>
                <select
                  aria-label="เลือกรายวิชา"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  className="max-w-44 cursor-pointer bg-transparent text-sm font-black text-slate-900 outline-none"
                >
                  {!scheduledSubjectOptions.includes(subjectName) && <option value={subjectName}>{subjectName}</option>}
                  {(scheduledSubjectOptions.length ? scheduledSubjectOptions : scheduleSettings.subjectOptions).map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-bold text-slate-700">
                <span className="grid h-6 min-w-6 place-items-center rounded-lg bg-amber-200 px-1 text-amber-900">คาบ</span>
                <span>เลือกคาบเรียน</span>
                <select
                  aria-label="เลือกคาบเรียน"
                  value={periodLabel}
                  onChange={(event) => setPeriodLabel(event.target.value)}
                  className="max-w-56 cursor-pointer bg-transparent text-sm font-black text-slate-900 outline-none"
                >
                  {!attendancePeriodOptions.some((period) => period.label === periodLabel) && <option value={periodLabel}>{periodLabel}</option>}
                  {attendancePeriodOptions.map((period) => (
                    <option key={period.index} value={period.label}>{period.label} ({period.start}-{period.end})</option>
                  ))}
                </select>
              </label>
              {scheduledLessons.length > 0 && (
                <span className="text-xs font-semibold text-teal-700">คาบและวิชาจากตารางสอนวัน{getScheduleDay(attendanceDate)}ของห้องนี้</span>
              )}
              {autoDetectedPeriodInfo && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  <Sparkles size={12} className="text-emerald-600" />
                  {autoDetectedPeriodInfo}
                </span>
              )}
            </div>
          )}
          <Link
            to={attendanceReportPath}
            title="เปิดรายงานเวลาเรียนของห้องและเดือนที่เลือก"
            className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#1C342B] to-[#2F7D5B] px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7D5B] focus-visible:ring-offset-2 active:scale-95"
          >
            <Printer size={16} aria-hidden="true" />
            <span>ดูรายงานและพิมพ์</span>
          </Link>
        </div>

        {/* Holiday Banner if today affects calendar */}
        {isHolidayBlocked && calendarPolicy && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs sm:text-sm text-rose-900 font-bold">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>วันที่เลือกเป็นวันหยุดตามปฏิทิน: {calendarPolicy.title} (ระบบงดบันทึกเวลาเรียน)</span>
          </div>
        )}

        {/* Thai Holiday / Weekend Hint */}
        {!isHolidayBlocked && dateCalendarHint && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-2xl border p-3 text-xs sm:text-sm font-bold ${
              dateCalendarHint.tone === 'amber'
                ? 'border-amber-200 bg-amber-50/80 text-amber-900'
                : 'border-sky-200 bg-sky-50/80 text-sky-900'
            }`}
          >
            <Clock size={15} className="shrink-0" />
            <span>{dateCalendarHint.text}</span>
          </div>
        )}

        {/* Post-Save 1-Click Guardian Notification Prompt */}
        {postSaveNotifyPrompt && alertStudents.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/90 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-950">
            <div className="flex items-center gap-2 font-bold">
              <Bell size={16} className="text-emerald-700 shrink-0" />
              <span>
                บันทึกเช็คชื่อเรียบร้อย — พบนักเรียนขาด/สาย/ลา/ป่วย {postSaveNotifyPrompt.count} คน ส่งเข้าคิวแจ้งผู้ปกครองเลยไหม?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void notifyGuardians()}
                disabled={isNotifying}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
              >
                <Send size={13} />
                <span>ส่งเข้าคิวแจ้งผู้ปกครอง ({alertStudents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPostSaveNotifyPrompt(null)}
                className="rounded-lg p-1 text-emerald-800 hover:bg-emerald-100"
                title="ซ่อนแถบแจ้งเตือน"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Smart Attendance Risk Alert Strip (30-day trailing streaks & 80% threshold) */}
        {atRiskStudents.length > 0 && (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-black text-rose-900">
                <ShieldAlert size={15} className="text-rose-600" />
                <span>เฝ้าระวังเวลาเรียน 30 วันย้อนหลัง ({atRiskStudents.length} คน):</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {atRiskStudents.slice(0, 5).map(({ student, risk }) => (
                  <Link
                    key={student.id}
                    to={`/app/dashboard?view=students&studentId=${encodeURIComponent(student.id)}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition hover:brightness-95 ${
                      risk.isBelowMs || risk.consecutiveAbsentDays >= 3
                        ? 'border-rose-300 bg-rose-100 text-rose-900'
                        : 'border-amber-300 bg-amber-100 text-amber-900'
                    }`}
                    title={`เวลาเรียน ${risk.attendanceRate.toFixed(0)}% · สาย ${risk.lateDays} ครั้ง · เปิดโปรไฟล์ 360°`}
                  >
                    <span>{student.first_name}</span>
                    {risk.consecutiveAbsentDays >= 2 ? (
                      <span>ขาดติด {risk.consecutiveAbsentDays} วัน</span>
                    ) : risk.isBelowMs || risk.isNearMs ? (
                      <span>มา {risk.attendanceRate.toFixed(0)}%</span>
                    ) : (
                      <span>สาย {risk.lateDays} ครั้ง</span>
                    )}
                  </Link>
                ))}
                {atRiskStudents.length > 5 && (
                  <span className="text-[11px] font-bold text-rose-800">+{atRiskStudents.length - 5} คน</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pending Guardian Online Leave Requests for attendanceDate */}
        {pendingLeaveRequests.length > 0 && (
          <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50/85 p-3.5 text-xs">
            <div className="flex items-center gap-2 font-black text-sky-950">
              <FileText size={15} className="text-sky-700" />
              <span>คำขอลาออนไลน์จากผู้ปกครอง ({pendingLeaveRequests.length} รายการรอตรวจสอบ):</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {pendingLeaveRequests.map((req) => {
                const student = classroomStudents.find((s) => s.id === req.student_id);
                const leaveLabel = req.leave_type === 'sick' ? 'ลาป่วย' : req.leave_type === 'personal' ? 'ลากิจ' : 'ลาอื่นๆ';
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-white p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate">
                        {student ? `${student.first_name} ${student.last_name}` : 'นักเรียน'} · {leaveLabel}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 truncate" title={req.reason}>
                        {req.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleReviewLeaveRequest(req, 'approved')}
                        className="rounded-lg bg-sky-700 px-2.5 py-1 text-[11px] font-black text-white hover:bg-sky-800"
                      >
                        อนุมัติ &amp; ตั้งสถานะ{req.leave_type === 'sick' ? 'ป่วย' : 'ลา'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReviewLeaveRequest(req, 'rejected')}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-800"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notice alert if any */}
        {notice && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-950 font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-amber-800 hover:text-amber-950">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Quick action buttons row with view mode toggle */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#DCE3D7]">
          {/* View mode toggle: compact grid (4-col on mobile), spacious grid (3-col on mobile), or row-by-row list */}
          <div className="inline-flex items-center rounded-xl bg-stone-100/90 p-1 border border-stone-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setCardDensity('compact')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                cardDensity === 'compact'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="มุมมองการ์ดกะทัดรัด (4 คอลัมน์บนมือถือ)"
            >
              <LayoutGrid size={13} />
              <span>การ์ด</span>
            </button>
            <button
              type="button"
              onClick={() => setCardDensity('spacious')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                cardDensity === 'spacious'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="มุมมองการ์ดใหญ่ (3 คอลัมน์บนมือถือ แสดงชื่อตัวใหญ่)"
            >
              <Grid3X3 size={13} />
              <span>การ์ดใหญ่</span>
            </button>
            <button
              type="button"
              onClick={() => setCardDensity('list')}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                cardDensity === 'list'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
              title="มุมมองรายชื่อแถวเดียว"
            >
              <List size={13} />
              <span>รายชื่อ</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => markAll('present')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#8CC6A7] bg-gradient-to-b from-[#FAFBF8] to-[#E9F0EA] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[#1C573D] hover:shadow-md active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Check size={14} className="text-[#1C573D] stroke-[3]" />
              <span>ตั้งทุกคนเป็น “มา”</span>
            </button>
            <button
              type="button"
              onClick={() => setIsQuickRollOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-xs cursor-pointer ${
                isQuickRollOpen
                  ? 'border-amber-400 bg-amber-200 text-amber-950 shadow-inner'
                  : 'border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100/70 text-amber-900 hover:shadow-md'
              }`}
            >
              <UserCheck size={14} className="text-amber-700" />
              <span>คีย์เลขที่</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOcrModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-gradient-to-b from-sky-50 to-sky-100/70 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-sky-950 hover:shadow-md active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Camera size={14} className="text-sky-700" />
              <span>สแกน AI</span>
            </button>
            {alertStudents.length > 0 && (
              <button
                type="button"
                onClick={() => void notifyGuardians()}
                disabled={isNotifying}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-gradient-to-b from-rose-50 to-rose-100/70 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-rose-950 hover:shadow-md active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} className="text-rose-700" />
                <span>แจ้งผู้ปกครอง ({alertStudents.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick roll numbers drawer */}
        {isQuickRollOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-white p-3 shadow-sm animate-in slide-in-from-top-2 duration-150">
            <span className="text-xs font-bold text-amber-950">เลขที่คนไม่มา:</span>
            <input
              type="text"
              placeholder="เช่น 3, 7, 12"
              value={quickRollInput}
              onChange={(e) => setQuickRollInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyQuickRollNumbers();
                }
              }}
              className="h-8.5 w-36 rounded-xl border border-amber-300 bg-amber-50/50 px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
            />
            <div className="flex items-center gap-1">
              {(['absent', 'leave', 'late', 'sick'] as AttendanceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setQuickRollStatus(st)}
                  className={`h-8.5 px-2.5 rounded-xl text-xs font-bold transition ${
                    quickRollStatus === st ? 'bg-amber-950 text-white shadow-xs' : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-white'
                  }`}
                >
                  {statusLabels[st]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleApplyQuickRollNumbers}
              className="h-8.5 rounded-xl bg-amber-600 px-3.5 text-xs font-bold text-white hover:bg-amber-700 active:scale-95 transition"
            >
              ปรับสถานะ
            </button>
            <button
              type="button"
              onClick={() => setIsQuickRollOpen(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5"
            >
              ปิด
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT ATTENDANCE SECTION (CLAY CARDS OR DETAILED LIST) */}
        {/* ======================================================== */}
        <section className="mt-6">
          {cardDensity === 'list' ? (
            /* LIST VIEW: Detailed row-by-row with direct status action pills */
            <div className="space-y-2 pt-2">
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const mark = marks[student.id];
                const tone = mark ? postItTone[mark] : null;
                const hasNote = Boolean(notes[student.id]?.trim());
                const rawNickname = student.nickname?.trim();
                const hasNickname = Boolean(
                  rawNickname &&
                  rawNickname !== 'ยังไม่มีชื่อเล่น' &&
                  rawNickname !== '-' &&
                  rawNickname.length > 0,
                );
                const listRisk = studentRiskMap.get(student.id);

                return (
                  <div
                    key={student.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl border transition-all ${
                      tone
                        ? `${tone.clayClass} border-transparent`
                        : 'bg-white border-[#DCE3D7] hover:border-[#8CC6A7] shadow-xs'
                    }`}
                  >
                    {/* Left: Roll Number & Full Student Identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-extrabold text-sm border shadow-2xs ${
                        tone ? `bg-white/80 ${tone.text} border-white/60` : 'bg-stone-100 text-[#1C342B] border-stone-200/80'
                      }`}>
                        {rollNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`font-extrabold text-sm sm:text-base truncate ${tone?.text || 'text-[#1C342B]'}`}>
                            {student.first_name} {student.last_name}
                          </p>
                          {hasNickname && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
                              น้อง{rawNickname!.replace(/^น้อง/, '')}
                            </span>
                          )}
                          {listRisk && (listRisk.consecutiveAbsentDays >= 2 || listRisk.isBelowMs || listRisk.isNearMs) && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                                listRisk.isBelowMs || listRisk.consecutiveAbsentDays >= 3
                                  ? 'border-rose-300 bg-rose-100 text-rose-800'
                                  : 'border-amber-300 bg-amber-100 text-amber-900'
                              }`}
                            >
                              {listRisk.consecutiveAbsentDays >= 2
                                ? `ขาดติด ${listRisk.consecutiveAbsentDays} วัน`
                                : `เข้าเรียน ${listRisk.attendanceRate.toFixed(0)}%`}
                            </span>
                          )}
                        </div>
                        {student.student_code && (
                          <p className="text-[11px] text-stone-500 font-medium">
                            รหัส: {student.student_code}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Quick Status Buttons & Note/Details Sheet */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {(['present', 'absent', 'leave', 'late'] as AttendanceStatus[]).map((st) => {
                        const isSelected = mark === st;
                        const statusTone = postItTone[st];
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => updateMarks((prev) => ({ ...prev, [student.id]: st }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 cursor-pointer ${
                              isSelected
                                ? `${statusTone.clayClass} ${statusTone.text} shadow-xs border border-white/80 ring-2 ring-emerald-600/30`
                                : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200'
                            }`}
                          >
                            {statusLabels[st]}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        aria-label={`แก้ไขรายละเอียดและหมายเหตุของเลขที่ ${rollNumber} ${student.first_name}`}
                        onClick={() => setSheetStudentId(student.id)}
                        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                          hasNote
                            ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/50'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                        }`}
                        title={hasNote ? `หมายเหตุ: "${notes[student.id]}" (กดเพื่อแก้ไข)` : 'แก้ไขเพิ่มเติม / ใส่หมายเหตุ'}
                      >
                        <Pencil size={14} />
                        {hasNote && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* GRID VIEW: Soft 3D Clay Student Cards with prominent names, roll numbers & statuses */
            <div
              className={
                cardDensity === 'spacious'
                  ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4 pt-2'
                  : 'grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 sm:gap-3.5 pt-2'
              }
            >
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const mark = marks[student.id];
                const tone = mark ? postItTone[mark] : null;
                const clayClass = tone ? tone.clayClass : 'clay-card-unmarked';
                const hasNote = Boolean(notes[student.id]?.trim());

                const rawNickname = student.nickname?.trim();
                const hasNickname = Boolean(
                  rawNickname &&
                  rawNickname !== 'ยังไม่มีชื่อเล่น' &&
                  rawNickname !== '-' &&
                  rawNickname.length > 0,
                );
                const formattedNickname = hasNickname
                  ? (rawNickname!.startsWith('น้อง') ? rawNickname! : `น้อง${rawNickname}`)
                  : null;

                // Primary Name: prefer Nickname if present, otherwise First Name
                const primaryName = formattedNickname || student.first_name;
                // Secondary Name: if nickname present, show First Name; otherwise show Last Name
                const secondaryName = formattedNickname ? student.first_name : student.last_name;
                const gridRisk = studentRiskMap.get(student.id);
                const gridRiskBadge =
                  gridRisk && (gridRisk.consecutiveAbsentDays >= 2 || gridRisk.isBelowMs || gridRisk.isNearMs)
                    ? gridRisk.consecutiveAbsentDays >= 2
                      ? `ขาดติด ${gridRisk.consecutiveAbsentDays}ว.`
                      : `${gridRisk.attendanceRate.toFixed(0)}%`
                    : null;

                return (
                  <div
                    key={student.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleStudentTap(student.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStudentTap(student.id);
                      }
                    }}
                    onPointerDown={() => handlePointerDown(student.id)}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSheetStudentId(student.id);
                    }}
                    className={`group relative flex flex-col justify-between rounded-2xl p-2 sm:p-2.5 min-h-[92px] sm:min-h-[98px] transition-all select-none cursor-pointer duration-150 hover:scale-[1.03] hover:-translate-y-0.5 hover:z-10 ${clayClass}`}
                    title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (${mark ? statusLabels[mark] : 'ยังไม่เช็ก'}) — แตะเพื่อเลือกสถานะ`}
                  >
                    {/* Top Row: Roll Number Badge & Note/Edit Pencil Button */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-lg text-[11px] sm:text-xs font-black shadow-2xs ${
                          mark ? `bg-white/80 ${tone?.text || 'text-stone-800'}` : 'bg-stone-200/80 text-stone-700'
                        }`}
                      >
                        {rollNumber}
                      </span>

                      <button
                        type="button"
                        aria-label={`แก้ไขรายละเอียดและหมายเหตุของเลขที่ ${rollNumber} ${student.first_name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSheetStudentId(student.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        className={`relative flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center rounded-full transition-all cursor-pointer z-20 shadow-xs ${
                          hasNote
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-400/50'
                            : 'bg-white/80 hover:bg-white text-stone-600 hover:text-stone-900 border border-white/70'
                        } hover:scale-115 active:scale-90`}
                        title={hasNote ? `หมายเหตุ: "${notes[student.id]}" (กดเพื่อแก้ไข)` : 'กดเพื่อดูรายละเอียด / ใส่หมายเหตุ'}
                      >
                        <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {hasNote && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Center: Student Name (Always clearly visible!) */}
                    <div className="my-auto flex flex-col items-center justify-center text-center w-full min-w-0 px-0.5 py-0.5">
                      <span
                        className={`text-xs sm:text-sm font-black truncate max-w-full leading-tight tracking-tight ${
                          tone?.text || 'text-[#1C342B]'
                        }`}
                      >
                        {primaryName}
                      </span>
                      {secondaryName && (
                        <span
                          className={`text-[10px] font-medium truncate max-w-full leading-none mt-0.5 opacity-70 ${
                            tone?.text || 'text-stone-500'
                          }`}
                        >
                          {secondaryName}
                        </span>
                      )}
                      {gridRiskBadge && (
                        <span
                          className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-black leading-none ${
                            gridRisk?.isBelowMs || (gridRisk?.consecutiveAbsentDays ?? 0) >= 3
                              ? 'border-rose-300 bg-rose-100/95 text-rose-800'
                              : 'border-amber-300 bg-amber-100/95 text-amber-900'
                          }`}
                          title={`มาเรียน 30 วัน ${gridRisk?.attendanceRate.toFixed(0)}% · สาย ${gridRisk?.lateDays ?? 0} ครั้ง`}
                        >
                          {gridRiskBadge}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Attendance Status Pill */}
                    <div className="flex items-center justify-center w-full mt-auto pt-1">
                      {mark ? (
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-white/85 shadow-2xs leading-none ${
                            tone?.text || 'text-[#1C342B]'
                          }`}
                        >
                          {mark === 'present' && <Check className="h-2.5 w-2.5 stroke-[3] text-emerald-700" />}
                          {mark === 'absent' && <X className="h-2.5 w-2.5 stroke-[3] text-rose-700" />}
                          {mark === 'late' && <Clock className="h-2.5 w-2.5 text-amber-700" />}
                          {mark === 'leave' && <FileText className="h-2.5 w-2.5 text-sky-700" />}
                          {mark === 'sick' && <Thermometer className="h-2.5 w-2.5 text-purple-700" />}
                          {mark === 'activity' && <Award className="h-2.5 w-2.5 text-emerald-700" />}
                          <span>{statusLabels[mark]}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold text-stone-400 bg-stone-100/90 border border-stone-200/60 leading-none">
                          ยังไม่เช็ก
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {classroomStudents.length === 0 && !isLoading && (
            <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-950">
              <p className="text-base font-bold">ยังไม่มีนักเรียนในห้องนี้</p>
              <p className="mt-1 text-xs text-amber-800/80">กรุณาเพิ่มหรือนำเข้ารายชื่อนักเรียนก่อนเช็คเวลาเรียน</p>
              <div className="mt-4 flex justify-center gap-2.5">
                <Link to="/app/dashboard?view=students" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  เพิ่มนักเรียน
                </Link>
                <Link to="/app/dashboard?view=import-export" className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50">
                  นำเข้ารายชื่อ
                </Link>
              </div>
            </div>
          )}

          {/* Evidence Vault: Medical Certificates & Leave Slips (.webp -> Google Drive) */}
          <div className="mt-4">
            <EvidenceVaultSection
              compact
              moduleKey="attendance_leave"
              optimizePreset={IMAGE_WEBP_PRESETS.document_scan}
              session={session}
              subtitle="แนบภาพใบลาหรือใบรับรองแพทย์ (บีบอัด .webp คมชัด 1600px เก็บลง Google Drive อัตโนมัติ)"
              title="คลังใบลาและหลักฐานเวลาเรียน"
            />
          </div>

          {/* Generous bottom spacer so page can scroll comfortably past bottom dock */}
          <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
        </section>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM FOOTER DOCK (Tactile Elevation & Glass Depth)     */}
      {/* ======================================================== */}
      {classroomStudents.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-white/80 bg-white/95 p-3.5 shadow-[0_16px_36px_-6px_rgba(28,52,43,0.22),0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          {/* Summary Text: มา 27 ขาด 1 ลา 1 สาย 1 */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-base sm:text-lg font-bold text-[#1C342B]">
            <span>
              ยังไม่เช็ก <b className="text-[#5A6F64]">{unmarkedCount}</b>
            </span>
            <span>
              มา <b className="text-[#2F7D5B]">{summary.find((s) => s.value === 'present')?.count || 0}</b>
            </span>
            <span>
              ขาด <b className="text-[#881337]">{summary.find((s) => s.value === 'absent')?.count || 0}</b>
            </span>
            <span>
              ลา <b className="text-[#2D72A3]">{summary.find((s) => s.value === 'leave')?.count || 0}</b>
            </span>
            <span>
              สาย <b className="text-[#B06C14]">{summary.find((s) => s.value === 'late')?.count || 0}</b>
            </span>
            {((summary.find((s) => s.value === 'sick')?.count || 0) + (summary.find((s) => s.value === 'activity')?.count || 0)) > 0 && (
              <span>
                ป่วย/อื่น <b className="text-[#581c87]">{(summary.find((s) => s.value === 'sick')?.count || 0) + (summary.find((s) => s.value === 'activity')?.count || 0)}</b>
              </span>
            )}
          </div>

          <div className="mt-2.5 flex gap-2">
          {undoMarks ? (
            <button
              type="button"
              onClick={undoLastMarkChange}
              disabled={isSubmitting}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-1 rounded-xl border border-[#DCE3D7] bg-white px-3 text-sm font-black text-[#1C342B] hover:bg-[#E9F0EA] shadow-xs active:scale-95 transition-all disabled:opacity-50"
              title="ย้อนการเปลี่ยนสถานะล่าสุดที่ยังไม่ได้บันทึก"
            >
              <Undo2 size={15} aria-hidden="true" />
              <span>ย้อนกลับ</span>
            </button>
          ) : null}
          {/* Primary Save Button */}
          <button
            type="button"
            onClick={() => void handleSaveRecords()}
            disabled={isSubmitting || isHolidayBlocked || unmarkedCount > 0}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1C342B] via-[#244337] to-[#2F7D5B] hover:brightness-110 text-white text-base sm:text-lg font-bold shadow-lg shadow-[#1C342B]/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none cursor-pointer"
          >
            {isSubmitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <span>{unmarkedCount > 0 ? `ตรวจอีก ${unmarkedCount} คน` : hasUnsavedChanges ? `บันทึก (${classroomStudents.length} คน)` : 'บันทึกเรียบร้อย'}</span>
            )}
          </button>
          </div>
          {savedAttendanceUndo && savedAttendanceUndo.sessionId === attendanceSession?.id ? (
            <button
              type="button"
              onClick={() => void undoLastSavedAttendance()}
              disabled={isSubmitting}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 text-xs font-black text-amber-950 hover:bg-amber-100 disabled:opacity-50"
            >
              <Undo2 size={14} aria-hidden="true" />
              <span>ย้อนผลเช็กชื่อที่บันทึกล่าสุด</span>
            </button>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* DETAILED STUDENT POPUP MODAL                             */}
      {/* ======================================================== */}
      {sheetStudent &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150">
            {/* Backdrop click to dismiss */}
            <div
              className="absolute inset-0"
              onClick={() => setSheetStudentId(null)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-lg rounded-[28px] sm:rounded-[32px] border border-[#DCE3D7] bg-[#FAFBF8] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setSheetStudentId(null)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#5A6F64] hover:bg-[#E9F0EA] hover:text-[#1C342B] transition cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>

              {/* Header with Soft 3D Clay Number & Name */}
              <div className="flex items-center gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-extrabold shadow-md ${marks[sheetStudent.id] ? postItTone[marks[sheetStudent.id]!].clayClass : 'clay-card-unmarked'} ${marks[sheetStudent.id] ? postItTone[marks[sheetStudent.id]!].text : 'text-[#5A6F64]'}`}>
                  {sheetStudentIndex + 1}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-[#E9F0EA] px-2.5 py-0.5 text-xs font-bold text-[#1C342B]">
                      เลขที่ {sheetStudentIndex + 1}
                    </span>
                    {sheetStudent.nickname && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
                        น้อง{sheetStudent.nickname}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-lg sm:text-xl font-bold text-[#1C342B]">
                    {sheetStudent.first_name} {sheetStudent.last_name}
                  </h3>
                </div>
              </div>

              {/* 6 Status Options with Tactile Pebble Styling */}
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
                {statusOptions.map((opt) => {
                  const isSelected = marks[sheetStudent.id] === opt.value;
                  const tone = postItTone[opt.value];
                  const StatusIcon = STATUS_ICON[opt.value];
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        updateMarks((prev) => ({ ...prev, [sheetStudent.id]: opt.value }));
                      }}
                      className={`flex h-12 items-center justify-center gap-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? `${tone.clayClass} ${tone.text} shadow-md ring-2 ring-white/80`
                          : 'border border-[#DCE3D7] bg-[#FAFBF8] text-[#1C342B] hover:bg-white hover:border-[#8CC6A7]'
                      }`}
                    >
                      <StatusIcon size={15} aria-hidden="true" />
                      <span>{opt.label}</span>
                      {isSelected && <Check size={14} className="stroke-[3]" />}
                    </button>
                  );
                })}
              </div>

              {/* Note Input */}
              <div className="mt-4">
                <label className="block text-xs sm:text-sm font-bold text-[#1C342B] mb-1">
                  หมายเหตุ (เช่น อาการป่วย, เหตุผลการลา):
                </label>
                <input
                  type="text"
                  className="h-11 w-full rounded-xl border border-[#DCE3D7] bg-white px-3.5 text-xs sm:text-sm font-bold text-[#1C342B] outline-none focus:ring-2 focus:ring-[#2F7D5B]/40 placeholder:text-[#8EA096] shadow-2xs"
                  placeholder={`ระบุหมายเหตุสำหรับ ${sheetStudent.first_name}...`}
                  value={notes[sheetStudent.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [sheetStudent.id]: e.target.value }))}
                />
              </div>

              {/* Navigation and Done */}
              <div className="mt-5 flex items-center justify-between gap-2 pt-3 border-t border-[#DCE3D7]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={sheetStudentIndex <= 0}
                    onClick={() => {
                      if (sheetStudentIndex > 0) {
                        setSheetStudentId(classroomStudents[sheetStudentIndex - 1].id);
                      }
                    }}
                    className="rounded-xl border border-[#DCE3D7] bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1C342B] disabled:opacity-30 hover:bg-[#E9F0EA] active:scale-95 transition cursor-pointer"
                  >
                    ← ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    disabled={sheetStudentIndex >= classroomStudents.length - 1}
                    onClick={() => {
                      if (sheetStudentIndex < classroomStudents.length - 1) {
                        setSheetStudentId(classroomStudents[sheetStudentIndex + 1].id);
                      }
                    }}
                    className="rounded-xl border border-[#DCE3D7] bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1C342B] disabled:opacity-30 hover:bg-[#E9F0EA] active:scale-95 transition cursor-pointer"
                  >
                    ถัดไป →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetStudentId(null)}
                  className="rounded-xl bg-[#1C342B] hover:bg-[#152821] px-6 py-2 text-xs sm:text-sm font-bold text-white shadow-sm active:translate-y-0.5 transition-all cursor-pointer"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* MORE OPTIONS MODAL: Date change, Subject mode, History   */}
      {/* ======================================================== */}
      {isMoreOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className="absolute inset-0"
              onClick={() => setIsMoreOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-md rounded-3xl border border-[#DCE3D7] bg-[#FAFBF8] p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#5A6F64] hover:bg-[#E9F0EA] cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>

            <h3 className="text-base font-bold text-[#1C342B] flex items-center gap-2">
              <Settings2 size={17} className="text-[#2F7D5B]" aria-hidden="true" />
              <span>การตั้งค่า &amp; เครื่องมือเพิ่มเติม</span>
            </h3>

            {/* Correct existing session date */}
            {attendanceSession && (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">ย้ายวันที่ของรายการที่บันทึกแล้ว:</label>
                <div className="flex items-center gap-2">
                  <ThaiDatePicker
                    className="h-9 flex-1 bg-white px-2.5 text-xs"
                    value={editSessionDate || attendanceSession.attendance_date}
                      max={getTodayDate()}
                    onValueChange={setEditSessionDate}
                  />
                  <button
                    type="button"
                    disabled={isSubmitting || editSessionDate === attendanceSession.attendance_date}
                    onClick={() => void handleCorrectSessionDate()}
                    className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300"
                  >
                    ย้ายวันที่
                  </button>
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* OCR MODAL INTEGRATION                                    */}
      {/* ======================================================== */}
      <AttendanceOcrModal
        isOpen={isOcrModalOpen}
        onApplyAttendance={handleApplyAttendanceOcr}
        onClose={() => setIsOcrModalOpen(false)}
        session={session}
        students={classroomStudents.map((s, idx) => ({
          id: s.id,
          student_code: s.student_code,
          name: `${s.first_name} ${s.last_name}`,
          number: idx + 1,
        }))}
      />
    </main>
  );
}
