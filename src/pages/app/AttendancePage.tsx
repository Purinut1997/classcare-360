import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Home,
  MoreHorizontal,
  Pencil,
  Send,
  Smile,
  UserCheck,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { AttendanceOcrModal } from '../../components/attendance/AttendanceOcrModal';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { getBangkokDate } from '../../lib/date';
import { isDemoSession } from '../../lib/auth';
import { writeAuditLog } from '../../lib/auditLog';
import { getAttendanceOptionsFromSchedule } from '../../lib/scheduleSettings';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
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

const STATUS_EMOJI: Record<AttendanceStatus, string> = {
  present: '😊',
  absent: '😢',
  late: '🐢',
  leave: '📝',
  sick: '🤒',
  activity: '🏅',
};

const postItTone: Record<
  AttendanceStatus,
  { bg: string; text: string; shadow: string; border: string; label: string }
> = {
  present: {
    bg: 'bg-[#d9f99d]',
    text: 'text-[#1b3e04]',
    shadow: 'shadow-[2px_5px_8px_rgba(27,62,4,0.22)]',
    border: 'border-lime-400/60',
    label: 'text-[#1b3e04]',
  },
  absent: {
    bg: 'bg-[#fecdd3]',
    text: 'text-[#881337]',
    shadow: 'shadow-[2px_5px_8px_rgba(136,19,55,0.22)]',
    border: 'border-rose-400/60',
    label: 'text-[#881337]',
  },
  leave: {
    bg: 'bg-[#bae6fd]',
    text: 'text-[#034f77]',
    shadow: 'shadow-[2px_5px_8px_rgba(3,79,119,0.22)]',
    border: 'border-sky-400/60',
    label: 'text-[#034f77]',
  },
  late: {
    bg: 'bg-[#fde68a]',
    text: 'text-[#78350f]',
    shadow: 'shadow-[2px_5px_8px_rgba(120,53,15,0.22)]',
    border: 'border-amber-400/60',
    label: 'text-[#78350f]',
  },
  sick: {
    bg: 'bg-[#e9d5ff]',
    text: 'text-[#581c87]',
    shadow: 'shadow-[2px_5px_8px_rgba(88,28,135,0.22)]',
    border: 'border-purple-400/60',
    label: 'text-[#581c87]',
  },
  activity: {
    bg: 'bg-[#a7f3d0]',
    text: 'text-[#064e3b]',
    shadow: 'shadow-[2px_5px_8px_rgba(6,78,59,0.22)]',
    border: 'border-teal-400/60',
    label: 'text-[#064e3b]',
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
  const [scheduleOptions, setScheduleOptions] = useState(() => getAttendanceOptionsFromSchedule(session.workspace?.id));
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
  }, [attendanceDraftKey]);

  useEffect(() => {
    setScheduleOptions(getAttendanceOptionsFromSchedule(session.workspace?.id));
    setSubjectName(modeCopy[mode].subject);
    setPeriodLabel(mode === 'homeroom' ? 'เช้า' : 'คาบ 1');
  }, [mode, session.workspace?.id]);

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

  async function ensureSession(): Promise<AttendanceSessionRow | null> {
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

    const activeSession = await ensureSession();
    if (!activeSession) {
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
      feedback.endOperation(operationId);
      feedback.success({
        title: 'บันทึกเช็คชื่อแล้ว 🐾',
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
        attendance_date: activeSession.attendance_date,
        classroom_name: selectedClassroom?.name || '',
        late_count: summary.find((item) => item.value === 'late')?.count || 0,
        leave_count: summary.find((item) => item.value === 'leave')?.count || 0,
        period_label: activeSession.period_label,
        present_count: summary.find((item) => item.value === 'present')?.count || 0,
        student_count: payload.length,
        subject_name: activeSession.subject_name || '',
      },
      source: 'attendance_page',
    });
    feedback.endOperation(operationId);
    feedback.success({
      title: 'บันทึกเช็คชื่อแล้ว 🐾',
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
    setNotice(`⚡ บันทึกสถานะ [${statusLabel}] ให้นักเรียนเลขที่ ${targetNumbers.join(', ')} เรียบร้อยแล้ว (ที่เหลือเป็น [มา]) — กด "บันทึกเช็คชื่อ" ได้เลย`);
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
    <main className="app-page min-h-screen pb-64 lg:pb-32 font-['Itim',sans-serif]">
      {/* ======================================================== */}
      {/* CORKBOARD / LINED PAPER CONTAINER (Style 5: Post-it)     */}
      {/* ======================================================== */}
      <div className="rounded-[32px] border-2 border-[#e6dcce] bg-[#f5efe6] [background-image:repeating-linear-gradient(0deg,transparent_0_27px,#e8dfd2_27px_28px)] p-4 sm:p-7 shadow-md">
        
        {/* Header */}
        <header className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-1.5">
                <span>เช็คชื่อ{isToday ? 'วันนี้' : 'ย้อนหลัง'}</span>
                <span className="text-xl sm:text-2xl">📌</span>
              </h1>
            </div>
            <p className="mt-0.5 text-sm sm:text-base font-semibold text-[#44403c]">
              {thaiDateLabel} · {mode === 'homeroom' ? (periodLabel === 'เช้า' ? 'ช่วงเช้า' : periodLabel) : `${subjectName} (${periodLabel})`}
            </p>
            <p className="mt-1 text-sm sm:text-base font-medium text-[#292524]">
              แตะรายชื่อเพื่อเริ่มเช็กชื่อ · แตะซ้ำเพื่อเปลี่ยนสถานะ · กด ✏️ เพื่อเลือกสถานะเพิ่มเติม
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Keep the date control visible so missed days are easy to record later. */}
            <div className={`rounded-xl border px-2.5 py-1.5 shadow-xs ${isToday ? 'border-sky-200 bg-sky-50/80' : 'border-amber-300 bg-amber-50'}`}>
              <span className="mb-0.5 block text-[10px] font-black text-slate-500">วันที่เช็กชื่อ</span>
              <div className="flex items-center gap-1.5">
                <ThaiDatePicker
                  className="h-8 min-w-36 bg-white px-2.5 text-xs"
                  value={attendanceDate}
                  max={getTodayDate()}
                  onValueChange={setAttendanceDate}
                />
                <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-black ${isToday ? 'bg-sky-100 text-sky-800' : 'bg-amber-200 text-amber-950'}`}>
                  {isToday ? 'วันนี้' : 'ย้อนหลัง'}
                </span>
              </div>
            </div>
            {/* Classroom Selector */}
            <div className="relative inline-flex items-center rotate-[1.5deg] shadow-xs">
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="appearance-none rounded-xl border border-[#c7bca9] bg-white py-1.5 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-[#1c1917] shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
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
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57534e]" />
            </div>

            {/* More Settings Button */}
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-[#c7bca9] bg-white text-[#44403c] hover:bg-white/80 active:scale-95 transition shadow-xs rotate-[-1deg]"
              title="เมนูเพิ่มเติม (เปลี่ยนวันที่ / รายวิชา / แก้ไขย้อนหลัง)"
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e2d5c3] bg-white/70 p-2">
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
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${selected ? 'border-teal-500 bg-teal-50 text-teal-900 ring-1 ring-teal-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon size={16} />
                {attendanceMode === 'homeroom' ? 'เช็กชื่อประจำวัน' : 'เช็กชื่อรายวิชา'}
              </button>
            );
          })}
          {mode === 'subject' && (
            <span className="text-xs font-semibold text-slate-600">เลือกชื่อวิชาและคาบใน “ตั้งค่าเพิ่มเติม”</span>
          )}
        </div>

        {/* Holiday Banner if today affects calendar */}
        {isHolidayBlocked && calendarPolicy && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-xs sm:text-sm text-rose-900 font-bold">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>วันที่เลือกเป็นวันหยุดตามปฏิทิน: {calendarPolicy.title} (ระบบงดบันทึกเวลาเรียน)</span>
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

        {/* Quick action buttons row */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-[#e2d5c3]">
          <button
            type="button"
            onClick={() => markAll('present')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-lime-400 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-[#1b3e04] hover:bg-lime-50 active:scale-95 transition shadow-2xs"
          >
            <Check size={14} className="text-[#1b3e04] stroke-[3]" />
            <span>ตั้งทุกคนเป็น “มา”</span>
          </button>
          <button
            type="button"
            onClick={() => setIsQuickRollOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 shadow-2xs ${
              isQuickRollOpen
                ? 'border-amber-400 bg-amber-200 text-amber-950'
                : 'border-amber-400 bg-white text-amber-900 hover:bg-amber-50'
            }`}
          >
            <UserCheck size={14} className="text-amber-700" />
            <span>คีย์เลขที่</span>
          </button>
          <button
            type="button"
            onClick={() => setIsOcrModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-400 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-teal-900 hover:bg-teal-50 active:scale-95 transition shadow-2xs"
          >
            <Camera size={14} className="text-teal-700" />
            <span>สแกน AI</span>
          </button>
          {alertStudents.length > 0 && (
            <button
              type="button"
              onClick={() => void notifyGuardians()}
              disabled={isNotifying}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-rose-900 hover:bg-rose-50 active:scale-95 transition shadow-2xs disabled:opacity-50"
            >
              <Send size={14} className="text-rose-700" />
              <span>แจ้งผู้ปกครอง ({alertStudents.length})</span>
            </button>
          )}
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
        {/* POST-IT NOTES GRID (4 columns on mobile, matching image)  */}
        {/* ======================================================== */}
        <section className="mt-5">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4.5 pt-2">
            {classroomStudents.map((student, idx) => {
              const rollNumber = idx + 1;
              const mark = marks[student.id];
              const tone = mark ? postItTone[mark] : { bg: 'bg-white border border-dashed border-slate-300', shadow: 'shadow-sm', text: 'text-slate-500' };
              const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];
              const isPresent = mark === 'present';
              const displayName = isPresent
                ? student.nickname || student.first_name
                : mark ? statusLabels[mark] : 'ยังไม่เช็ก';
              const hasNote = Boolean(notes[student.id]?.trim());

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
                  className={`group relative flex flex-col items-center justify-center rounded-xs sm:rounded-sm p-2 sm:p-2.5 min-h-[68px] sm:min-h-[76px] transition-all select-none active:scale-95 cursor-pointer ${tone.bg} ${tone.shadow} ${rotation} hover:scale-105 hover:z-10`}
                  title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (${mark ? statusLabels[mark] : 'ยังไม่เช็ก'}) — แตะเพื่อเลือกสถานะ`}
                >
                  {/* Frosted Tape on top of note */}
                  <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-7 rounded-[1px] bg-white/70 shadow-2xs backdrop-blur-2xs" />

                  {/* Small Cute Edit / Detail Icon Button to Open Popup */}
                  <button
                    type="button"
                    aria-label={`แก้ไขรายละเอียดและหมายเหตุของเลขที่ ${rollNumber} ${student.first_name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetStudentId(student.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    className={`absolute top-1 right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full transition-all cursor-pointer z-20 shadow-2xs ${
                      hasNote
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 ring-1 ring-amber-400/60'
                        : 'bg-white/85 hover:bg-white text-stone-500 hover:text-stone-900 border border-stone-200/70'
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

                  {/* Large Roll Number */}
                  <span className={`text-2xl sm:text-3xl font-bold leading-none tracking-tight ${tone.text}`}>
                    {rollNumber}
                  </span>

                  {/* Student Name / Status */}
                  <span className={`text-sm sm:text-base font-bold truncate mt-1 max-w-full text-center px-0.5 ${tone.text}`}>
                    {displayName}
                  </span>
                </div>
              );
            })}
          </div>

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

          {/* Generous bottom spacer so page can scroll comfortably past bottom dock */}
          <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
        </section>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM FOOTER DOCK: Matches Image 2 (Style 5)             */}
      {/* ======================================================== */}
      {classroomStudents.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-[#c7bca9] bg-[#fbf8f3]/95 p-3.5 shadow-xl backdrop-blur-md">
          {/* Summary Text: มา 27 ขาด 1 ลา 1 สาย 1 */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-base sm:text-lg font-bold text-[#1c1917]">
            <span>
              ยังไม่เช็ก <b className="text-slate-600">{unmarkedCount}</b>
            </span>
            <span>
              มา <b className="text-[#1b3e04]">{summary.find((s) => s.value === 'present')?.count || 0}</b>
            </span>
            <span>
              ขาด <b className="text-[#881337]">{summary.find((s) => s.value === 'absent')?.count || 0}</b>
            </span>
            <span>
              ลา <b className="text-[#034f77]">{summary.find((s) => s.value === 'leave')?.count || 0}</b>
            </span>
            <span>
              สาย <b className="text-[#78350f]">{summary.find((s) => s.value === 'late')?.count || 0}</b>
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
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="ย้อนการเปลี่ยนสถานะล่าสุดที่ยังไม่ได้บันทึก"
            >
              ↶ ย้อนกลับ
            </button>
          ) : null}
          {/* Big Charcoal Button with Golden Shadow */}
          <button
            type="button"
            onClick={() => void handleSaveRecords()}
            disabled={isSubmitting || isHolidayBlocked || unmarkedCount > 0}
            className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#3f3a36] hover:bg-[#2c2825] text-white text-base sm:text-lg font-bold shadow-[3px_4px_0_#f59e0b] active:translate-y-0.5 active:shadow-[1px_2px_0_#f59e0b] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <span>{unmarkedCount > 0 ? `ตรวจอีก ${unmarkedCount} คน` : hasUnsavedChanges ? `บันทึก ✓ (${classroomStudents.length} คน)` : 'บันทึกเรียบร้อย ✓'}</span>
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
              ↶ ย้อนผลเช็กชื่อที่บันทึกล่าสุด
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
            <div className="relative z-10 w-full max-w-lg rounded-[28px] sm:rounded-[32px] border border-[#c7bca9] bg-[#fbf8f3] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setSheetStudentId(null)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-200/60 hover:text-stone-800 transition cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>

              {/* Header with Post-it Number & Name */}
              <div className="flex items-center gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-bold shadow-xs ${marks[sheetStudent.id] ? postItTone[marks[sheetStudent.id]!].bg : 'border border-dashed border-slate-300 bg-white'} ${marks[sheetStudent.id] ? postItTone[marks[sheetStudent.id]!].text : 'text-slate-500'}`}>
                  {sheetStudentIndex + 1}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                      เลขที่ {sheetStudentIndex + 1}
                    </span>
                    {sheetStudent.nickname && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
                        น้อง{sheetStudent.nickname}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-lg sm:text-xl font-bold text-slate-950">
                    {sheetStudent.first_name} {sheetStudent.last_name}
                  </h3>
                </div>
              </div>

              {/* 6 Status Options */}
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
                {statusOptions.map((opt) => {
                  const isSelected = marks[sheetStudent.id] === opt.value;
                  const tone = postItTone[opt.value];
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        updateMarks((prev) => ({ ...prev, [sheetStudent.id]: opt.value }));
                      }}
                      className={`flex h-12 items-center justify-center gap-1.5 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? `${tone.bg} ${tone.text} ring-2 ring-current shadow-xs`
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{STATUS_EMOJI[opt.value]}</span>
                      <span>{opt.label}</span>
                      {isSelected && <Check size={14} className="stroke-[3]" />}
                    </button>
                  );
                })}
              </div>

              {/* Note Input */}
              <div className="mt-4">
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1">
                  หมายเหตุ (เช่น อาการป่วย, เหตุผลการลา):
                </label>
                <input
                  type="text"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-400 shadow-2xs"
                  placeholder={`ระบุหมายเหตุสำหรับ ${sheetStudent.first_name}...`}
                  value={notes[sheetStudent.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [sheetStudent.id]: e.target.value }))}
                />
              </div>

              {/* Navigation and Done */}
              <div className="mt-5 flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={sheetStudentIndex <= 0}
                    onClick={() => {
                      if (sheetStudentIndex > 0) {
                        setSheetStudentId(classroomStudents[sheetStudentIndex - 1].id);
                      }
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 disabled:opacity-30 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
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
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 disabled:opacity-30 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                  >
                    ถัดไป →
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetStudentId(null)}
                  className="rounded-xl bg-[#3f3a36] hover:bg-[#2c2825] px-6 py-2 text-xs sm:text-sm font-bold text-white shadow-[2px_3px_0_#f59e0b] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
            <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>

            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>⚙️ การตั้งค่า & เครื่องมือเพิ่มเติม</span>
            </h3>

            {/* Period & Subject Inputs if in Subject mode */}
            {mode === 'subject' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">คาบเรียน:</label>
                  <input
                    type="text"
                    className="h-9 w-full rounded-xl border border-slate-300 px-2.5 text-xs font-bold"
                    placeholder="เช่น คาบ 1"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">รายวิชา:</label>
                  <input
                    type="text"
                    className="h-9 w-full rounded-xl border border-slate-300 px-2.5 text-xs font-bold"
                    placeholder="เช่น คณิตศาสตร์"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                  />
                </div>
              </div>
            )}

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
