import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  BookOpen,
  Check,
  ClipboardCheck,
  Clock3,
  Filter,
  Home,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { getBangkokDate } from '../../lib/date';
import { isDemoSession } from '../../lib/auth';
import { getAttendanceOptionsFromSchedule } from '../../lib/scheduleSettings';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { getTeacherClassroomScope, getClassroomScopeBadge } from '../../lib/teacherClassrooms';
import type { AppSessionContext } from '../../types/core';

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

const demoClassrooms: ClassroomRow[] = [
  { academic_year: '2569', id: 'demo-classroom', name: 'ป.5/1' },
];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ก้องภพ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'ก้อง', student_code: 'TEST-01' },
  { classroom_id: 'demo-classroom', first_name: 'ณัฐธิดา', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'นัท', student_code: 'TEST-02' },
  { classroom_id: 'demo-classroom', first_name: 'ปกรณ์', id: 'demo-student-3', last_name: 'เรียนดี', nickname: 'ปอ', student_code: 'TEST-03' },
];

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
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [attendanceSession, setAttendanceSession] = useState<AttendanceSessionRow | null>(null);
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [editSessionDate, setEditSessionDate] = useState('');
  const [periodLabel, setPeriodLabel] = useState('เช้า');
  const [subjectName, setSubjectName] = useState(modeCopy.homeroom.subject);
  const [scheduleOptions, setScheduleOptions] = useState(() => getAttendanceOptionsFromSchedule(session.workspace?.id));
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => createDefaultMarks(demoStudents));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกเวลาเรียนลง Supabase จริง',
  );
  const [calendarPolicy, setCalendarPolicy] = useState<CalendarAttendancePolicy | null>(null);

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

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

  const [showStartPrompt, setShowStartPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert' | 'present'>('all');
  const rosterRef = useRef<HTMLDivElement>(null);

  const selectedClassroom = classrooms.find((classroom) => classroom.id === classroomId);
  const activeModeCopy = modeCopy[mode];
  const ModeIcon = activeModeCopy.icon;
  const sessionLabel = `${mode === 'homeroom' ? 'ประจำวัน' : 'รายวิชา'} | ${periodLabel}`;

  const filteredStudents = useMemo(() => {
    return classroomStudents.filter((student) => {
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const code = (student.student_code || '').toLowerCase();
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const nickname = (student.nickname || '').toLowerCase();
        if (!code.includes(query) && !fullName.includes(query) && !nickname.includes(query)) {
          return false;
        }
      }
      const mark = marks[student.id] || 'present';
      if (statusFilter === 'alert') {
        return (['absent', 'late', 'leave', 'sick', 'activity'] as AttendanceStatus[]).includes(mark);
      }
      if (statusFilter === 'present') {
        return mark === 'present';
      }
      return true;
    });
  }, [classroomStudents, marks, searchTerm, statusFilter]);

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
        if (!attendanceSession && attendanceDate === getTodayDate() && classroomStudents.length > 0) {
          setShowStartPrompt(true);
        }
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
        setShowStartPrompt(false);
      } else {
        setAttendanceSession(null);
        setRecords([]);
        if (attendanceDate === getTodayDate() && classroomStudents.length > 0) {
          setShowStartPrompt(true);
        } else {
          setShowStartPrompt(false);
        }
      }
    }
    void checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, [attendanceDate, classroomId, classroomStudents.length, demoMode, mode, periodLabel, session.workspace]);

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

  async function handleCreateSession(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    setShowStartPrompt(false);

    if (calendarPolicy && !calendarPolicy.affects_attendance) {
      setNotice(`วันที่เลือกเป็น ${calendarPolicy.title} ระบบจึงไม่สร้างรอบเช็กชื่อตามปฏิทินโรงเรียน`);
      setIsSubmitting(false);
      return;
    }

    if (!classroomId) {
      setNotice('กรุณาเลือกห้องเรียนก่อนเริ่มเช็คเวลา');
      setIsSubmitting(false);
      return;
    }

    const operationId = feedback.beginOperation({
      title: 'กำลังเตรียมรายการเช็คชื่อ',
      message: `กำลังเปิดรอบวันที่ ${attendanceDate} สำหรับห้อง ${selectedClassroom?.name || '-'}`,
    });

    // The report boundary is explicit: daily sessions have no subject; subject
    // sessions always do. This prevents the two report types from mixing.
    const normalizedSubjectName = mode === 'subject' ? subjectName.trim() || 'ไม่ระบุวิชา' : null;
    const normalizedPeriod = periodLabel;

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
      setRecords([]);
      setNotice('เริ่มเช็คเวลาในโหมดตัวอย่างแล้ว');
      feedback.endOperation(operationId);
      feedback.success({
        title: 'พร้อมเช็คชื่อแล้ว',
        message: 'สร้างรอบเช็คชื่อในโหมดตัวอย่างสำเร็จ',
        details: [
          { label: 'วันที่', value: attendanceDate },
          { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
          { label: 'ช่วงเวลา', value: normalizedPeriod },
          { label: 'นักเรียน', value: `${classroomStudents.length} คน` },
        ],
      });
      setIsSubmitting(false);
      setTimeout(() => {
        rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return;
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
      feedback.endOperation(operationId);
      feedback.error({
        title: 'เริ่มเช็คชื่อไม่สำเร็จ',
        message: error.message,
        details: [
          { label: 'วันที่', value: attendanceDate },
          { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
        ],
      });
      setIsSubmitting(false);
      return;
    }

    const nextSession = data as AttendanceSessionRow;
    setAttendanceSession(nextSession);
    setEditSessionDate(nextSession.attendance_date);
    await loadSessionRecords(nextSession);
    setNotice('เริ่มเช็คเวลาเรียนสำเร็จ');
    feedback.endOperation(operationId);
    feedback.success({
      title: 'พร้อมเช็คชื่อแล้ว',
      message: 'ระบบสร้างหรือเปิดรอบเช็คชื่อเดิมเรียบร้อย',
      details: [
        { label: 'วันที่', value: nextSession.attendance_date },
        { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
        { label: 'ช่วงเวลา', value: nextSession.period_label },
        { label: 'นักเรียน', value: `${classroomStudents.length} คน` },
      ],
    });
    setIsSubmitting(false);
    setTimeout(() => {
      rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
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
    if (!attendanceSession) {
      setNotice('กรุณาเริ่มเช็คเวลาก่อนบันทึก');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    const operationId = feedback.beginOperation({
      title: 'กำลังบันทึกผลเช็คชื่อ',
      message: `ตรวจสอบสถานะนักเรียน ${classroomStudents.length} คน และบันทึกลงระบบ`,
    });

    const payload = classroomStudents.map((student) => ({
      workspace_id: session.workspace?.id || 'demo-workspace',
      session_id: attendanceSession.id,
      student_id: student.id,
      status: marks[student.id] || 'present',
      note: notes[student.id]?.trim() || null,
      checked_by: session.profile.id,
      checked_at: new Date().toISOString(),
    }));

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
      setNotice('บันทึกเวลาเรียนในโหมดตัวอย่างแล้ว');
      feedback.endOperation(operationId);
      feedback.success({
        title: 'บันทึกเช็คชื่อสำเร็จ',
        message: 'บันทึกข้อมูลในโหมดตัวอย่างครบทุกคนแล้ว',
        details: [
          { label: 'วันที่', value: attendanceSession.attendance_date },
          { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
          ...summary.map((item) => ({ label: item.label, value: `${item.count} คน` })),
        ],
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
          { label: 'วันที่', value: attendanceSession.attendance_date },
          { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
          { label: 'ข้อมูลที่พยายามบันทึก', value: `${payload.length} คน` },
        ],
      });
      setIsSubmitting(false);
      return;
    }

    setRecords((data || []) as AttendanceRecordRow[]);
    setNotice('บันทึกเวลาเรียนสำเร็จ');
    feedback.endOperation(operationId);
    feedback.success({
      title: 'บันทึกเช็คชื่อสำเร็จ',
      message: `บันทึกสถานะนักเรียนครบ ${data?.length || 0} คน`,
      details: [
        { label: 'วันที่', value: attendanceSession.attendance_date },
        { label: 'ห้องเรียน', value: selectedClassroom?.name || '-' },
        { label: 'ช่วงเวลา', value: attendanceSession.period_label },
        ...summary.map((item) => ({ label: item.label, value: `${item.count} คน` })),
      ],
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
    return;

    const results = await Promise.allSettled(
      targets.map((guardian) => {
        const student = alertStudents.find((item) => item.id === guardian.student_id);
        const status = student ? marks[student.id] : 'present';
        const studentName = student ? `${student.first_name} ${student.last_name}` : 'นักเรียน';
        const note = student ? notes[student.id]?.trim() : '';

        return activeSupabase.functions.invoke('dispatch-notification', {
          body: {
            body: `${studentName} มีสถานะ ${statusLabels[status]} วันที่ ${attendanceDate} ${sessionLabel}${note ? ` หมายเหตุ: ${note}` : ''}`,
            channels: ['in_app'],
            data: {
              attendance_date: attendanceDate,
              attendance_status: status,
              classroom_id: classroomId,
              guardian_relation: guardian.relation,
              source_ui: 'attendance_page',
              student_id: guardian.student_id,
            },
            privacyLevel: 'restricted',
            profileId: guardian.profile_id,
            title: `แจ้งเวลาเรียน: ${studentName}`,
            type: 'attendance_guardian_alert',
            workspaceId: activeWorkspaceId,
          },
        });
      }),
    );

    const successCount = results.filter((result) => result.status === 'fulfilled' && !result.value.error).length;
    const failedCount = results.length - successCount;
    setNotice(
      failedCount > 0
        ? `ส่งแจ้งเตือนได้ ${successCount} รายการ และล้มเหลว ${failedCount} รายการ`
        : `ส่งแจ้งเตือนผู้ปกครองสำเร็จ ${successCount} รายการ`,
    );
    setIsNotifying(false);
  }

  function markAll(status: AttendanceStatus) {
    setMarks(Object.fromEntries(classroomStudents.map((student) => [student.id, status])));
  }

  return (
    <main className="app-page">
      {/* Guided Pop-up: เริ่มเช็คชื่อวันนี้ทันที */}
      {showStartPrompt && !attendanceSession && classroomStudents.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-amber-200/80 bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 sm:p-7">
            <button
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              onClick={() => setShowStartPrompt(false)}
              type="button"
              aria-label="ปิด"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30">
                <Clock3 size={24} className="animate-pulse" />
              </span>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
                  <Sparkles size={12} /> เช็คชื่อประจำวัน
                </span>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  เริ่มเช็คชื่อวันนี้
                </h3>
              </div>
            </div>

            <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
              พร้อมเช็คชื่อประจำวันสำหรับนักเรียนในห้องแล้ว กดเริ่มเช็คชื่อเพื่อติ๊กเลือกสถานะรายคนได้ทันที โดยไม่ต้องเลื่อนหาปุ่ม
            </p>

            <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">📅 วันที่</span>
                <span className="font-black text-slate-900">
                  {new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(new Date(`${attendanceDate}T12:00:00`))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">🏫 ห้องเรียน</span>
                <span className="font-black text-teal-800 flex items-center gap-1">
                  ⭐ {selectedClassroom?.name || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">⏰ คาบ/ช่วงเวลา</span>
                <span className="font-black text-slate-900">
                  {periodLabel} ({mode === 'homeroom' ? 'โฮมรูม/ประจำวัน' : subjectName})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">👥 จำนวนนักเรียน</span>
                <span className="font-black text-slate-900">{classroomStudents.length} คน</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                className="amber-action flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-black shadow-lg shadow-amber-500/20 active:scale-98 transition"
                disabled={isSubmitting}
                onClick={() => void handleCreateSession()}
                type="button"
              >
                <Clock3 size={20} />
                <span>เริ่มเช็คชื่อวันนี้ทันที</span>
              </button>

              <button
                className="h-11 w-full rounded-2xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
                onClick={() => setShowStartPrompt(false)}
                type="button"
              >
                เลือกห้องอื่น หรือเปลี่ยนวันที่ก่อน
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-page-header">
        <div>
          <div className="nexus-kicker">
            <ClipboardCheck size={18} aria-hidden="true" />
            Attendance
          </div>
          <h1 className="app-page-title">{mode === 'subject' ? 'เช็คเวลาเรียนรายวิชา' : 'เช็คชื่อประจำวัน'}</h1>
          <p className="app-page-description">
            {session.workspace?.schoolName || 'Demo Workspace'} | แยกเช็คชื่อประจำวันและเช็คเวลาเรียนรายวิชา แต่ยังบันทึกลง session เดียวกันเพื่อรายงานได้ถูกต้อง
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
          {summary.slice(0, 3).map((item) => (
            <div className={`rounded-2xl p-3 text-center font-black shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 transition hover:-translate-y-0.5 ${item.tone}`} key={item.value}>
              <p className="text-2xl">{item.count}</p>
              <p className="mt-1 text-xs">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {(['homeroom', 'subject'] as AttendanceMode[]).map((item) => {
          const copy = modeCopy[item];
          const Icon = copy.icon;
          const isActive = mode === item;

          return (
            <button
              className={`flex-1 rounded-xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-teal-200 bg-teal-50 shadow-sm'
                  : 'border-transparent bg-white hover:border-slate-200'
              }`}
              key={item}
              onClick={() => setMode(item)}
              type="button"
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${isActive ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-950">{copy.label}</p>
                  <p className="mt-0.5 text-xs font-bold leading-5 text-slate-500">{copy.body}</p>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="app-workbench mt-5">
        <div className="grid gap-5">
          <form className="app-panel-pad" onSubmit={handleCreateSession}>
            <div className="nexus-kicker">
              <ModeIcon size={16} aria-hidden="true" />
              {mode === 'homeroom' ? 'เช็คชื่อประจำวัน' : 'เช็คเวลาเรียนรายวิชา'}
            </div>
            <div className="mt-4 grid gap-3">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-black text-slate-700">ห้องเรียน</span>
                  {teacherScope.hasMultipleScopes ? (
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-black">
                      <button
                        className={`rounded-lg px-2.5 py-0.5 transition ${
                          scopeFilter === 'homeroom'
                            ? 'bg-white text-cyan-900 shadow-xs ring-1 ring-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        onClick={() => {
                          setScopeFilter('homeroom');
                          if (
                            teacherScope.homeroomClassrooms.length > 0 &&
                            !teacherScope.homeroomClassrooms.some((c) => c.id === classroomId)
                          ) {
                            setClassroomId(teacherScope.homeroomClassrooms[0].id);
                          }
                        }}
                        type="button"
                      >
                        ⭐ ห้องที่ปรึกษา ({teacherScope.homeroomClassrooms.length})
                      </button>
                      <button
                        className={`rounded-lg px-2.5 py-0.5 transition ${
                          scopeFilter === 'all'
                            ? 'bg-white text-cyan-900 shadow-xs ring-1 ring-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        onClick={() => setScopeFilter('all')}
                        type="button"
                      >
                        🌐 ทุกห้อง ({teacherScope.allClassrooms.length})
                      </button>
                    </div>
                  ) : teacherScope.hasHomeroom ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
                      ⭐ ห้องที่ปรึกษาของคุณ
                    </span>
                  ) : null}
                </div>
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setClassroomId(event.target.value)}
                  value={classroomId}
                >
                  {displayClassrooms.map((classroom) => {
                    const badge = getClassroomScopeBadge(classroom, session.profile.id);
                    return (
                      <option key={classroom.id} value={classroom.id}>
                        {badge.prefix}{classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''} — {badge.label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  วันที่
                  <ThaiDatePicker className="h-11 px-3" onValueChange={setAttendanceDate} value={attendanceDate} />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  {mode === 'homeroom' ? 'ช่วงเวลา' : 'คาบเรียน'}
                  <input
                    className="nexus-field h-11 px-3"
                    list={mode === 'homeroom' ? 'attendance-homeroom-period-options' : 'attendance-period-options'}
                    onChange={(event) => setPeriodLabel(event.target.value)}
                    placeholder={mode === 'homeroom' ? 'เช้า / บ่าย' : 'คาบ 1'}
                    value={periodLabel}
                  />
                  <datalist id="attendance-homeroom-period-options">
                    {Array.from(new Set(['เช้า', 'บ่าย', 'โฮมรูม', 'หน้าเสาธง', ...scheduleOptions.periodOptions])).map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  <datalist id="attendance-period-options">
                    {scheduleOptions.periodOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                {mode === 'homeroom' ? 'กิจกรรม' : 'รายวิชา'}
                <input
                  className="nexus-field h-11 px-3"
                  list="attendance-subject-options"
                  onChange={(event) => setSubjectName(event.target.value)}
                  placeholder={mode === 'homeroom' ? 'โฮมรูม' : 'เช่น คณิตศาสตร์'}
                  value={subjectName}
                />
                <datalist id="attendance-subject-options">
                  {scheduleOptions.subjectOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 p-3 text-xs font-bold leading-5 text-cyan-900">
                Dropdown ช่วงเวลา/คาบและรายวิชาอ้างอิงจากเมนูตารางสอน แต่ยังพิมพ์เองได้ ถ้าต้องการเพิ่มตัวเลือกถาวรให้ไปแก้ที่ตารางสอนก่อน
              </div>
            </div>
            <button
              className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || !classroomId}
              type="submit"
            >
              {mode === 'homeroom' ? 'เริ่มเช็คชื่อวันนี้' : 'เริ่มเช็คเวลาเรียนรายวิชา'}
              <Clock3 size={17} aria-hidden="true" />
            </button>
          </form>

          <div className="app-panel-pad">
            <div className="nexus-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-black text-slate-600">
              <ShieldCheck size={16} className="text-teal-600" aria-hidden="true" />
              RLS + workspace_id + session_id
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {statusOptions.map((option) => (
                <button
                  className={`h-10 rounded-2xl text-xs font-black ring-1 transition hover:-translate-y-0.5 hover:brightness-95 ${option.tone}`}
                  key={option.value}
                  onClick={() => markAll(option.value)}
                  type="button"
                >
                  ทั้งห้อง: {option.label}
                </button>
              ))}
            </div>
            <button
              className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isNotifying || alertStudents.length === 0}
              onClick={() => void notifyGuardians()}
              type="button"
            >
              <Send size={17} aria-hidden="true" />
              แจ้งผู้ปกครอง {alertStudents.length} รายการ
            </button>
            <div className="nexus-muted-box mt-3 flex gap-2 p-3 text-xs font-bold leading-5 text-slate-600">
              <BellRing className="mt-0.5 shrink-0 text-amber-600" size={16} aria-hidden="true" />
              หลังบ้านยังใช้ attendance session เพราะต้องรู้ว่าเป็นห้อง วันที่ คาบ วิชา และครูคนไหน เพื่อทำรายงานรายเดือน รายวิชา และเชื่อมตารางสอนได้
            </div>
          </div>
        </div>

        <div className="app-panel-pad" ref={rosterRef}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black ${
                  attendanceSession ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                }`}>
                  <Clock3 size={13} />
                  {attendanceSession ? `${attendanceSession.period_label} | ${attendanceSession.subject_name || 'ไม่ระบุวิชา'}` : 'ยังไม่ได้เริ่มเช็คเวลา'}
                </span>
                {attendanceSession?.status === 'submitted' && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">
                    บันทึกแล้ว
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                รายชื่อนักเรียน {filteredStudents.length} {filteredStudents.length !== classroomStudents.length ? `จาก ${classroomStudents.length}` : ''} คน
              </h2>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                {selectedClassroom?.name || '-'} | {mode === 'homeroom' ? 'บันทึกของครูที่ปรึกษา' : 'บันทึกของครูประจำวิชา'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-teal-200 bg-teal-50 px-4 text-xs font-black text-teal-800 hover:bg-teal-100 transition active:scale-95 disabled:opacity-50"
                disabled={classroomStudents.length === 0}
                onClick={() => markAll('present')}
                type="button"
              >
                <Sparkles size={15} className="text-teal-600" />
                ⚡ มาทุกคน
              </button>
              <button
                className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting || !attendanceSession || classroomStudents.length === 0}
                onClick={handleSaveRecords}
                type="button"
              >
                <Save size={16} aria-hidden="true" />
                <span>บันทึกเวลาเรียน</span>
              </button>
            </div>
          </div>

          {attendanceSession ? (
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
              <label className="grid gap-1 text-xs font-black text-slate-600">
                แก้ไขวันที่บันทึกย้อนหลัง
                <ThaiDatePicker className="h-9 w-52 bg-white px-3" onValueChange={setEditSessionDate} value={editSessionDate || attendanceSession.attendance_date} />
              </label>
              <button className="inline-flex h-9 items-center justify-center rounded-xl bg-sky-700 px-3 text-xs font-black text-white disabled:bg-slate-300" disabled={isSubmitting || editSessionDate === attendanceSession.attendance_date} onClick={() => void handleCorrectSessionDate()} type="button">
                บันทึกวันที่ใหม่
              </button>
              <p className="pb-1 text-xs font-bold text-slate-500">ใช้เมื่อเช็กชื่อผิดวัน ระบบจะคงรายชื่อนักเรียนและสถานะเดิมไว้</p>
            </div>
          ) : null}

          {notice ? (
            <div className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
              {notice}
            </div>
          ) : null}

          {classroomStudents.length > 0 && (
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-y border-slate-100 py-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหานักเรียน (ชื่อ, เลขที่, ชื่อเล่น)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="nexus-field h-9 w-full pl-9 pr-7 text-xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-black pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`rounded-xl px-3 py-1.5 transition whitespace-nowrap ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทั้งหมด ({classroomStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('alert')}
                  className={`rounded-xl px-3 py-1.5 transition whitespace-nowrap ${
                    statusFilter === 'alert'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 ring-1 ring-rose-200'
                  }`}
                >
                  ขาด/สาย/ลา ({alertStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('present')}
                  className={`rounded-xl px-3 py-1.5 transition whitespace-nowrap ${
                    statusFilter === 'present'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'bg-teal-50 text-teal-800 hover:bg-teal-100 ring-1 ring-teal-200'
                  }`}
                >
                  มา ({summary.find((s) => s.value === 'present')?.count || 0})
                </button>
              </div>
            </div>
          )}

          {/* Mobile Touch Cards (< md) */}
          <div className="mt-4 grid gap-3 md:hidden">
            {filteredStudents.map((student, index) => {
              const currentStatus = marks[student.id] || 'present';
              const isAlert = (['absent', 'late', 'leave', 'sick'] as AttendanceStatus[]).includes(currentStatus);
              const currentTone = statusOptions.find((o) => o.value === currentStatus)?.tone || '';
              return (
                <div
                  key={student.id}
                  className={`rounded-2xl border p-3.5 transition shadow-xs ${
                    isAlert
                      ? 'border-rose-300 bg-rose-50/50 ring-1 ring-rose-200'
                      : 'border-slate-200/90 bg-white hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                        {student.student_code ? student.student_code.replace(/^[A-Za-z]+-?/, '') : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-black text-slate-900 leading-tight">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-slate-500">
                          {student.nickname ? `น้อง${student.nickname}` : student.student_code ? `รหัส ${student.student_code}` : 'นักเรียน'}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${currentTone}`}>
                      {statusLabels[currentStatus]}
                    </span>
                  </div>

                  {/* Touch Status Buttons (min 44px height for mobile touch target ergonomics) */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {statusOptions.map((option) => {
                      const isActive = currentStatus === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMarks((prev) => ({ ...prev, [student.id]: option.value }))}
                          className={`flex h-11 items-center justify-center gap-1 rounded-xl text-xs font-black transition active:scale-95 ${
                            isActive
                              ? `${option.tone} ring-2 ring-current shadow-xs font-black`
                              : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                          }`}
                        >
                          {isActive && <Check size={14} className="stroke-[3]" />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Note input */}
                  <div className="mt-2.5">
                    <input
                      className="nexus-field h-9 w-full px-3 text-xs"
                      placeholder={`หมายเหตุ: ${statusLabels[currentStatus] || 'ปกติ'} (ถ้ามี)...`}
                      value={notes[student.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="mt-4 hidden md:block">
            {filteredStudents.length > 0 ? (
              <div className="app-data-table overflow-x-auto rounded-2xl border border-slate-200">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[110px_minmax(200px,1fr)_390px_230px] gap-3 border-b border-[#ead8bd] bg-[#fff8ef]/80 px-4 py-3 text-xs font-black text-slate-500">
                    <span>รหัส/เลขที่</span>
                    <span>ชื่อ-สกุล นักเรียน</span>
                    <span>สถานะเช็คชื่อ</span>
                    <span>หมายเหตุ</span>
                  </div>
                  {filteredStudents.map((student, idx) => (
                    <div
                      className="grid grid-cols-[110px_minmax(200px,1fr)_390px_230px] items-center gap-3 border-b border-[#ead8bd]/70 px-4 py-2.5 last:border-b-0 hover:bg-slate-50/70 transition"
                      key={student.id}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">
                          {student.student_code ? student.student_code.replace(/^[A-Za-z]+-?/, '') : idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-600">{student.student_code || '-'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{student.nickname ? `น้อง${student.nickname}` : 'ยังไม่มีชื่อเล่น'}</p>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {statusOptions.map((option) => {
                          const isActive = marks[student.id] === option.value;
                          return (
                            <button
                              className={`inline-flex h-9 items-center justify-center gap-1 rounded-xl px-2 text-xs font-black ring-1 transition hover:-translate-y-0.5 active:scale-95 ${
                                isActive ? option.tone : 'bg-white/85 text-slate-500 ring-slate-200 hover:bg-white'
                              }`}
                              key={option.value}
                              onClick={() => setMarks((current) => ({ ...current, [student.id]: option.value }))}
                              type="button"
                            >
                              {isActive ? <Check size={13} className="stroke-[3]" aria-hidden="true" /> : null}
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        className="nexus-field h-9 px-3 text-xs"
                        onChange={(event) => setNotes((current) => ({ ...current, [student.id]: event.target.value }))}
                        placeholder={`หมายเหตุ (${statusLabels[marks[student.id] || 'present']})`}
                        value={notes[student.id] || ''}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {classroomStudents.length > 0 && filteredStudents.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-bold text-slate-500">ไม่พบนักเรียนที่ตรงกับคำค้นหา "{searchTerm}"</p>
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="mt-2 text-xs font-black text-teal-700 hover:underline"
              >
                ล้างคำค้นหาและตัวกรอง
              </button>
            </div>
          )}

          {!isLoading && classroomStudents.length === 0 ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-bold leading-6 text-amber-900">
              ยังไม่มีนักเรียนในห้องนี้ ให้เพิ่มหรือนำเข้ารายชื่อนักเรียนก่อน จึงจะเช็คเวลาเรียนได้
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:-translate-y-0.5"
                  to="/app/dashboard?view=students"
                >
                  เพิ่มนักเรียน
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-amber-900 ring-1 ring-amber-200 transition hover:-translate-y-0.5"
                  to="/app/dashboard?view=import-export"
                >
                  นำเข้ารายชื่อ
                </Link>
              </div>
            </div>
          ) : null}

          {/* Sticky Bottom Save & Summary Dock */}
          {classroomStudents.length > 0 && (
            <div className="sticky bottom-3 z-30 mx-auto mt-6 w-full rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-black">
                  <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-teal-800 ring-1 ring-teal-200">
                    มา {summary.find((s) => s.value === 'present')?.count || 0}
                  </span>
                  <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-800 ring-1 ring-rose-200">
                    ขาด {summary.find((s) => s.value === 'absent')?.count || 0}
                  </span>
                  <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-200">
                    สาย {summary.find((s) => s.value === 'late')?.count || 0}
                  </span>
                  {(summary.find((s) => s.value === 'leave')?.count || 0) + (summary.find((s) => s.value === 'sick')?.count || 0) > 0 && (
                    <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-800 ring-1 ring-sky-200">
                      ลา/ป่วย {(summary.find((s) => s.value === 'leave')?.count || 0) + (summary.find((s) => s.value === 'sick')?.count || 0)}
                    </span>
                  )}
                </div>
                <button
                  className="dark-action inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-xs font-black shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isSubmitting || !attendanceSession}
                  onClick={handleSaveRecords}
                  type="button"
                >
                  <Save size={15} aria-hidden="true" />
                  บันทึกผล ({classroomStudents.length} คน)
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
