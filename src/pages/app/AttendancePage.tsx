import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Home,
  MoreHorizontal,
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

const animalTone: Record<AttendanceStatus, { badge: string; button: string; face: string; label: string }> = {
  present: {
    badge: 'border-lime-400 text-lime-700',
    button: 'bg-lime-100 text-lime-800 ring-lime-400',
    face: 'bg-lime-50 border-lime-400',
    label: 'text-lime-700',
  },
  absent: {
    badge: 'border-rose-400 text-rose-700',
    button: 'bg-rose-100 text-rose-800 ring-rose-400',
    face: 'bg-rose-50 border-rose-400',
    label: 'text-rose-600',
  },
  late: {
    badge: 'border-orange-400 text-orange-700',
    button: 'bg-orange-100 text-orange-800 ring-orange-400',
    face: 'bg-orange-50 border-orange-400',
    label: 'text-orange-600',
  },
  leave: {
    badge: 'border-sky-400 text-sky-700',
    button: 'bg-sky-100 text-sky-800 ring-sky-400',
    face: 'bg-sky-50 border-sky-400',
    label: 'text-sky-600',
  },
  sick: {
    badge: 'border-violet-400 text-violet-700',
    button: 'bg-violet-100 text-violet-800 ring-violet-400',
    face: 'bg-violet-50 border-violet-400',
    label: 'text-violet-600',
  },
  activity: {
    badge: 'border-teal-400 text-teal-700',
    button: 'bg-teal-100 text-teal-800 ring-teal-400',
    face: 'bg-teal-50 border-teal-400',
    label: 'text-teal-600',
  },
};

const ANIMALS = [
  '🐼', '🐰', '🦊', '🐻', '🐱', '🐶', '🐨', '🐯', '🐸', '🐵',
  '🐥', '🦁', '🐹', '🐷', '🐮', '🦄', '🐧', '🐙', '🐳', '🦋',
  '🐞', '🐢', '🦔', '🦉', '🐬', '🐝', '🐲', '🦩', '🐠', '🐴',
  '🐺', '🦒', '🦓', '🐘', '🦛', '🦦', '🦥', '🦜', '🦢', '🐊',
  '🦕', '🦖', '🐌', '🦀', '🐡', '🐿️', '🦘', '🐑', '🐐', '🦚',
];

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Gives every student a stable animal (same one every day), avoiding duplicates inside a class when possible. */
function assignAnimals(students: Array<{ id: string; student_code: string | null }>) {
  const used = new Set<number>();
  const result: Record<string, string> = {};
  for (const student of students) {
    let index = hashString(student.student_code || student.id) % ANIMALS.length;
    if (used.size < ANIMALS.length) {
      while (used.has(index)) index = (index + 1) % ANIMALS.length;
    }
    used.add(index);
    result[student.id] = ANIMALS[index];
  }
  return result;
}

function getTodayDate() {
  return getBangkokDate();
}

function createDefaultMarks(students: StudentRow[]) {
  return Object.fromEntries(students.map((student) => [student.id, 'present' as AttendanceStatus]));
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
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [editSessionDate, setEditSessionDate] = useState('');
  const [periodLabel, setPeriodLabel] = useState('เช้า');
  const [subjectName, setSubjectName] = useState(modeCopy.homeroom.subject);
  const [scheduleOptions, setScheduleOptions] = useState(() => getAttendanceOptionsFromSchedule(session.workspace?.id));
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => createDefaultMarks(demoMode ? demoStudents : []));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกเวลาเรียนลง Supabase จริง',
  );
  const [calendarPolicy, setCalendarPolicy] = useState<CalendarAttendancePolicy | null>(null);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

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

  const studentAnimals = useMemo(() => assignAnimals(classroomStudents), [classroomStudents]);

  const savedStatusByStudent = useMemo(
    () => Object.fromEntries(records.map((record) => [record.student_id, record])),
    [records],
  );

  const isSaved = records.length > 0;
  const hasUnsavedChanges = useMemo(
    () =>
      !isSaved ||
      classroomStudents.some((student) => {
        const saved = savedStatusByStudent[student.id];
        return (
          (marks[student.id] || 'present') !== (saved?.status || 'present') ||
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

    setMarks(nextMarks);
    setNotes(Object.fromEntries(records.map((record) => [record.student_id, record.note || ''])));
  }, [classroomId, records, students]);

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
      setNotice(error.message);
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
      setNotice(error.message);
      feedback.endOperation(operationId);
      feedback.error({ title: 'แก้ไขวันที่ไม่สำเร็จ', message: error.message });
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
      setNotice(error.message);
      feedback.endOperation(operationId);
      feedback.error({
        title: 'บันทึกเช็คชื่อไม่สำเร็จ',
        message: error.message,
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
    feedback.endOperation(operationId);
    feedback.success({
      title: 'บันทึกเช็คชื่อแล้ว 🐾',
      message: `บันทึกสถานะนักเรียนครบ ${data?.length || 0} คน`,
      details: successDetails,
    });
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
      const status = student ? marks[student.id] : 'present';
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
    setMarks(Object.fromEntries(classroomStudents.map((student) => [student.id, status])));
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

    setMarks(updatedMarks);
    setQuickRollInput('');
    setIsQuickRollOpen(false);
    const statusLabel = statusLabels[quickRollStatus] || quickRollStatus;
    setNotice(`⚡ บันทึกสถานะ [${statusLabel}] ให้นักเรียนเลขที่ ${targetNumbers.join(', ')} เรียบร้อยแล้ว (ที่เหลือเป็น [มา]) — กด "บันทึกเช็คชื่อ" ได้เลย`);
  }

  function handleApplyAttendanceOcr(recordsToApply: Record<string, { status: AttendanceStatus; note?: string | null }>) {
    setMarks((prev) => {
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
    const current = marks[studentId] || 'present';
    const currentIndex = TAP_CYCLE.indexOf(current);
    const nextStatus = currentIndex === -1 ? 'absent' : TAP_CYCLE[(currentIndex + 1) % TAP_CYCLE.length];
    setMarks((prev) => ({ ...prev, [studentId]: nextStatus }));
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
    <main className="app-page pb-36 lg:pb-24 font-sans">
      {/* ======================================================== */}
      {/* TOP HEADER: Warm & Friendly "แก๊งสัตว์น้อย" Style         */}
      {/* ======================================================== */}
      <header className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl select-none animate-bounce">🐾</span>
              <h1 className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight">
                เพื่อน ๆ มากันครบไหม?
              </h1>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-bold text-amber-900/70">
              📅 {thaiDateLabel} · {mode === 'homeroom' ? (periodLabel === 'เช้า' ? 'ช่วงเช้า' : periodLabel) : `${subjectName} (${periodLabel})`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Native Classroom Select Dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="appearance-none rounded-2xl border-2 border-amber-300 bg-white py-2 pl-3.5 pr-8 text-xs sm:text-sm font-black text-amber-950 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {displayClassrooms.map((c) => {
                  const badge = getClassroomScopeBadge(c, session.profile.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {badge.prefix}{c.name} {c.academic_year ? `(${c.academic_year})` : ''} — {badge.label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-700" />
            </div>

            {/* More Menu Button */}
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-900 hover:bg-amber-100/70 active:scale-95 transition shadow-xs"
              title="เมนูเพิ่มเติม (เปลี่ยนวันที่ / รายวิชา / แก้ไขย้อนหลัง)"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Holiday Banner if today affects calendar */}
        {isHolidayBlocked && calendarPolicy && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>วันนี้เป็นวันหยุดตามปฏิทิน: {calendarPolicy.title} (ระบบงดบันทึกเวลาเรียน)</span>
          </div>
        )}

        {/* Notice alert if any */}
        {notice && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-amber-700 hover:text-amber-950">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Quick action tools pill row */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-amber-200/60">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-amber-900/80 bg-amber-100/50 rounded-xl px-3 py-1.5 border border-amber-200/50">
            <span>🐾 ทุกคนเริ่มต้นเป็น "มา" แตะสัตว์ของเพื่อนที่ไม่มาได้เลย</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => markAll('present')}
              className="inline-flex items-center gap-1 rounded-xl border border-lime-300 bg-lime-50 px-2.5 py-1 text-xs font-black text-lime-800 hover:bg-lime-100 active:scale-95 transition"
            >
              <Check size={13} className="text-lime-600 stroke-[3]" />
              <span>มาทุกคน</span>
            </button>
            <button
              type="button"
              onClick={() => setIsQuickRollOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-black transition active:scale-95 ${
                isQuickRollOpen
                  ? 'border-amber-400 bg-amber-200 text-amber-950'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <UserCheck size={13} className="text-amber-600" />
              <span>คีย์เลขที่</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOcrModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-800 hover:bg-teal-100 active:scale-95 transition"
            >
              <Camera size={13} className="text-teal-600" />
              <span>สแกน AI</span>
            </button>
            {alertStudents.length > 0 && (
              <button
                type="button"
                onClick={() => void notifyGuardians()}
                disabled={isNotifying}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-800 hover:bg-rose-100 active:scale-95 transition disabled:opacity-50"
              >
                <Send size={13} className="text-rose-600" />
                <span>แจ้งผู้ปกครอง ({alertStudents.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick roll numbers drawer */}
        {isQuickRollOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-white p-3 shadow-sm animate-in slide-in-from-top-2 duration-150">
            <span className="text-xs font-black text-amber-950">เลขที่คนไม่มา:</span>
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
                  className={`h-8.5 px-2.5 rounded-xl text-xs font-black transition ${
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
              className="h-8.5 rounded-xl bg-amber-600 px-3.5 text-xs font-black text-white hover:bg-amber-700 active:scale-95 transition"
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
      </header>

      {/* ======================================================== */}
      {/* ANIMAL GRID: แบบ 3 แก๊งสัตว์น้อย (Tap to Cycle, Hold to Detail) */}
      {/* ======================================================== */}
      <section className="mt-5">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5 sm:gap-3.5">
          {classroomStudents.map((student, idx) => {
            const rollNumber = student.student_code ? student.student_code.replace(/^[A-Za-z]+-?/, '') : idx + 1;
            const animal = studentAnimals[student.id] || '🐾';
            const mark = marks[student.id] || 'present';
            const tone = animalTone[mark] || animalTone.present;
            const isAbsent = mark === 'absent';
            const hasNote = Boolean(notes[student.id]?.trim());

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => handleStudentTap(student.id)}
                onPointerDown={() => handlePointerDown(student.id)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSheetStudentId(student.id);
                }}
                className={`relative flex flex-col items-center justify-between rounded-2xl border-2 p-2 sm:p-2.5 transition-all select-none active:scale-90 ${tone.face} ${
                  isAbsent ? 'opacity-85 shadow-none' : 'shadow-xs hover:shadow-md'
                }`}
                title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (${statusLabels[mark]}) — แตะเพื่อวนสถานะ, แตะค้างเพื่อใส่หมายเหตุ`}
              >
                {/* Roll number pill at top-left */}
                <span className={`absolute -top-1.5 -left-1.5 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white border-2 text-[10px] sm:text-[11px] font-black shadow-xs ${tone.badge}`}>
                  {rollNumber}
                </span>

                {/* Note Indicator at top-right */}
                {hasNote && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-400 text-white text-[10px] font-black shadow-xs" title={notes[student.id]}>
                    💬
                  </span>
                )}

                {/* Cute Animal Mascot Emoji */}
                <div className={`mt-1 flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center text-3xl sm:text-4xl transition-transform ${
                  isAbsent ? 'grayscale-[0.6] scale-95' : 'hover:scale-110'
                }`}>
                  <span>{animal}</span>
                </div>

                {/* Name / Status Label */}
                <div className="mt-1 w-full text-center">
                  <p className={`truncate text-[11px] sm:text-xs font-black ${tone.label}`}>
                    {mark === 'present'
                      ? student.nickname ? `น้อง${student.nickname}` : student.first_name
                      : `${STATUS_EMOJI[mark]} ${statusLabels[mark]}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Empty State */}
        {classroomStudents.length === 0 && !isLoading && (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-950">
            <p className="text-base font-black">ยังไม่มีนักเรียนในห้องนี้</p>
            <p className="mt-1 text-xs text-amber-800/80">กรุณาเพิ่มหรือนำเข้ารายชื่อนักเรียนก่อนเช็คเวลาเรียน</p>
            <div className="mt-4 flex justify-center gap-2.5">
              <Link to="/app/dashboard?view=students" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800">
                เพิ่มนักเรียน
              </Link>
              <Link to="/app/dashboard?view=import-export" className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-black text-amber-900 hover:bg-amber-50">
                นำเข้ารายชื่อ
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* FLOATING BOTTOM DOCK: Summary & Big Thumb-Friendly Save  */}
      {/* ======================================================== */}
      {classroomStudents.length > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-4xl rounded-2xl sm:rounded-3xl border-2 border-lime-300 bg-white/95 p-2.5 sm:p-3.5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
            {/* Status Pills Summary */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto text-[11px] sm:text-xs font-black w-full sm:w-auto justify-around sm:justify-start">
              <span className="rounded-xl bg-lime-100/90 px-2.5 py-1 text-lime-900 ring-1 ring-lime-300 flex items-center gap-1">
                <span>🐾 มา</span>
                <b>{summary.find((s) => s.value === 'present')?.count || 0}</b>
              </span>
              <span className="rounded-xl bg-rose-100/90 px-2.5 py-1 text-rose-900 ring-1 ring-rose-300 flex items-center gap-1">
                <span>ขาด</span>
                <b>{summary.find((s) => s.value === 'absent')?.count || 0}</b>
              </span>
              <span className="rounded-xl bg-sky-100/90 px-2.5 py-1 text-sky-900 ring-1 ring-sky-300 flex items-center gap-1">
                <span>ลา</span>
                <b>{summary.find((s) => s.value === 'leave')?.count || 0}</b>
              </span>
              <span className="rounded-xl bg-orange-100/90 px-2.5 py-1 text-orange-900 ring-1 ring-orange-300 flex items-center gap-1">
                <span>สาย</span>
                <b>{summary.find((s) => s.value === 'late')?.count || 0}</b>
              </span>
              {((summary.find((s) => s.value === 'sick')?.count || 0) + (summary.find((s) => s.value === 'activity')?.count || 0)) > 0 && (
                <span className="rounded-xl bg-purple-100/90 px-2.5 py-1 text-purple-900 ring-1 ring-purple-300 flex items-center gap-1">
                  <span>ป่วย/อื่น</span>
                  <b>{(summary.find((s) => s.value === 'sick')?.count || 0) + (summary.find((s) => s.value === 'activity')?.count || 0)}</b>
                </span>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => void handleSaveRecords()}
              disabled={isSubmitting || isHolidayBlocked}
              className={`flex h-11.5 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black text-white shadow-lg transition active:scale-95 disabled:opacity-50 ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-lime-600 via-emerald-600 to-teal-600 hover:from-lime-500 hover:to-emerald-500 shadow-emerald-500/25 ring-2 ring-lime-400'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {isSubmitting ? (
                <span>กำลังบันทึก...</span>
              ) : (
                <>
                  <Check size={18} className="stroke-[3]" />
                  <span>{hasUnsavedChanges ? `บันทึกเช็คชื่อเลย 🐾 (${classroomStudents.length} คน)` : 'บันทึกแล้ว ✓ (กดบันทึกซ้ำได้)'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DETAILED STUDENT BOTTOM SHEET (Long Press or Edit)       */}
      {/* ======================================================== */}
      {sheetStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] border border-amber-200 bg-white p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <button
              type="button"
              onClick={() => setSheetStudentId(null)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            {/* Header with Animal & Name */}
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border-2 border-amber-300 text-3xl shadow-xs">
                {studentAnimals[sheetStudent.id] || '🐾'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-700">
                    เลขที่ {sheetStudent.student_code ? sheetStudent.student_code.replace(/^[A-Za-z]+-?/, '') : sheetStudentIndex + 1}
                  </span>
                  {sheetStudent.nickname && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">
                      น้อง{sheetStudent.nickname}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-base font-black text-slate-900">
                  {sheetStudent.first_name} {sheetStudent.last_name}
                </h3>
              </div>
            </div>

            {/* 6 Status Options */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {statusOptions.map((opt) => {
                const isSelected = (marks[sheetStudent.id] || 'present') === opt.value;
                const tone = animalTone[opt.value];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setMarks((prev) => ({ ...prev, [sheetStudent.id]: opt.value }));
                    }}
                    className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-black transition active:scale-95 ${
                      isSelected
                        ? `${tone.button} ring-2 shadow-xs font-black`
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
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
            <div className="mt-3.5">
              <label className="block text-xs font-black text-slate-700 mb-1">
                หมายเหตุ (เช่น อาการป่วย, เหตุผลการลา):
              </label>
              <input
                type="text"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400"
                placeholder={`ระบุหมายเหตุสำหรับ ${sheetStudent.first_name}...`}
                value={notes[sheetStudent.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [sheetStudent.id]: e.target.value }))}
              />
            </div>

            {/* Navigation and Done */}
            <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={sheetStudentIndex <= 0}
                  onClick={() => {
                    if (sheetStudentIndex > 0) {
                      setSheetStudentId(classroomStudents[sheetStudentIndex - 1].id);
                    }
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-30 hover:bg-slate-100"
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
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-30 hover:bg-slate-100"
                >
                  ถัดไป →
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSheetStudentId(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 active:scale-95 shadow-xs"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MORE OPTIONS MODAL: Date change, Subject mode, History   */}
      {/* ======================================================== */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsMoreOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>⚙️ การตั้งค่า & เครื่องมือเพิ่มเติม</span>
            </h3>

            {/* Date Selector */}
            <div className="mt-4 grid gap-1.5">
              <label className="text-xs font-black text-slate-700">📅 เปลี่ยนวันที่เช็คชื่อ:</label>
              <ThaiDatePicker
                className="h-10 px-3 text-xs"
                value={attendanceDate}
                onValueChange={(val) => {
                  setAttendanceDate(val);
                  setIsMoreOpen(false);
                }}
              />
            </div>

            {/* Mode Selector */}
            <div className="mt-4 grid gap-1.5">
              <label className="text-xs font-black text-slate-700">🎯 รูปแบบการเช็คชื่อ:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('homeroom');
                    setPeriodLabel('เช้า');
                    setSubjectName(modeCopy.homeroom.subject);
                  }}
                  className={`rounded-xl border p-2.5 text-left text-xs font-black transition ${
                    mode === 'homeroom' ? 'border-teal-400 bg-teal-50 text-teal-900 ring-1 ring-teal-300' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Home size={15} />
                    <span>ครูที่ปรึกษา (โฮมรูม)</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('subject');
                    setPeriodLabel('คาบ 1');
                    setSubjectName(modeCopy.subject.subject);
                  }}
                  className={`rounded-xl border p-2.5 text-left text-xs font-black transition ${
                    mode === 'subject' ? 'border-teal-400 bg-teal-50 text-teal-900 ring-1 ring-teal-300' : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen size={15} />
                    <span>ครูประจำวิชา</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Period & Subject Inputs if in Subject mode */}
            {mode === 'subject' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">คาบเรียน:</label>
                  <input
                    type="text"
                    className="h-9 w-full rounded-xl border border-slate-300 px-2.5 text-xs font-bold"
                    placeholder="เช่น คาบ 1"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">รายวิชา:</label>
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
                <label className="text-xs font-black text-slate-700 block mb-1">แก้ไขวันที่บันทึกย้อนหลัง:</label>
                <div className="flex items-center gap-2">
                  <ThaiDatePicker
                    className="h-9 flex-1 bg-white px-2.5 text-xs"
                    value={editSessionDate || attendanceSession.attendance_date}
                    onValueChange={setEditSessionDate}
                  />
                  <button
                    type="button"
                    disabled={isSubmitting || editSessionDate === attendanceSession.attendance_date}
                    onClick={() => void handleCorrectSessionDate()}
                    className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300"
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
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white hover:bg-slate-800"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
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
