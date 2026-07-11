import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CalendarDays, Check, ClipboardCheck, Clock3, Save, Send, ShieldCheck } from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface AttendancePageProps {
  session: AppSessionContext;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';

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

const demoClassrooms: ClassroomRow[] = [
  { academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' },
];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
];

const statusOptions: Array<{ label: string; tone: string; value: AttendanceStatus }> = [
  { label: 'มา', tone: 'bg-teal-50 text-teal-700 ring-teal-100', value: 'present' },
  { label: 'ขาด', tone: 'bg-rose-50 text-rose-700 ring-rose-100', value: 'absent' },
  { label: 'สาย', tone: 'bg-amber-50 text-amber-700 ring-amber-100', value: 'late' },
  { label: 'ลา', tone: 'bg-sky-50 text-sky-700 ring-sky-100', value: 'leave' },
  { label: 'ป่วย', tone: 'bg-violet-50 text-violet-700 ring-violet-100', value: 'sick' },
  { label: 'กิจกรรม', tone: 'bg-lime-50 text-lime-700 ring-lime-100', value: 'activity' },
];

const statusLabels = Object.fromEntries(statusOptions.map((option) => [option.value, option.label])) as Record<
  AttendanceStatus,
  string
>;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultMarks(students: StudentRow[]) {
  return Object.fromEntries(students.map((student) => [student.id, 'present' as AttendanceStatus]));
}

export function AttendancePage({ session }: AttendancePageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [attendanceSession, setAttendanceSession] = useState<AttendanceSessionRow | null>(null);
  const [records, setRecords] = useState<AttendanceRecordRow[]>([]);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [periodLabel, setPeriodLabel] = useState('เช้า');
  const [subjectName, setSubjectName] = useState('โฮมรูม');
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => createDefaultMarks(demoStudents));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกเวลาเรียนลง Supabase จริง',
  );

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

  useEffect(() => {
    let isMounted = true;

    async function loadBaseData() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setClassroomId(demoClassrooms[0].id);
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
            .select('id,name,academic_year')
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
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setClassroomId(nextClassrooms[0]?.id || '');
      setMarks(createDefaultMarks(nextStudents));
      setIsLoading(false);
    }

    void loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  useEffect(() => {
    const nextStudents = students.filter((student) => student.classroom_id === classroomId);
    const nextMarks = createDefaultMarks(nextStudents);

    for (const record of records) {
      nextMarks[record.student_id] = record.status;
    }

    setMarks(nextMarks);
    setNotes(Object.fromEntries(records.map((record) => [record.student_id, record.note || ''])));
  }, [classroomId, records, students]);

  async function loadSessionRecords(nextSession: AttendanceSessionRow) {
    if (!supabase || !session.workspace) return;

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

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!classroomId) {
      setNotice('กรุณาเลือกห้องเรียนก่อนสร้างรอบเช็คชื่อ');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const localSession: AttendanceSessionRow = {
        attendance_date: attendanceDate,
        classroom_id: classroomId,
        id: `demo-attendance-${Date.now()}`,
        period_label: periodLabel,
        status: 'draft',
        subject_name: subjectName,
      };
      setAttendanceSession(localSession);
      setRecords([]);
      setNotice('สร้างรอบเช็คชื่อในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('attendance_sessions')
      .upsert(
        {
          workspace_id: session.workspace.id,
          classroom_id: classroomId,
          attendance_date: attendanceDate,
          period_label: periodLabel,
          subject_name: subjectName.trim() || null,
          status: 'draft',
          created_by: session.profile.id,
        },
        { onConflict: 'workspace_id,classroom_id,attendance_date,period_label' },
      )
      .select('id,classroom_id,attendance_date,period_label,subject_name,status')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const nextSession = data as AttendanceSessionRow;
    setAttendanceSession(nextSession);
    await loadSessionRecords(nextSession);
    setNotice('เปิดรอบเช็คชื่อสำเร็จ');
    setIsSubmitting(false);
  }

  async function handleSaveRecords() {
    if (!attendanceSession) {
      setNotice('กรุณาสร้างหรือเปิดรอบเช็คชื่อก่อนบันทึก');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const payload = classroomStudents.map((student) => ({
      workspace_id: session.workspace?.id || 'demo-workspace',
      session_id: attendanceSession.id,
      student_id: student.id,
      status: marks[student.id] || 'present',
      note: notes[student.id]?.trim() || null,
      checked_by: session.profile.id,
      checked_at: new Date().toISOString(),
    }));

    if (!supabase || !session.workspace) {
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
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(payload, { onConflict: 'session_id,student_id' })
      .select('id,session_id,student_id,status,note');

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    setRecords((data || []) as AttendanceRecordRow[]);
    setNotice('บันทึกเวลาเรียนสำเร็จ');
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

    if (!supabase || !session.workspace) {
      setNotice(`ส่งแจ้งเตือนผู้ปกครองในโหมดตัวอย่างแล้ว ${alertStudents.length} รายการ`);
      setIsNotifying(false);
      return;
    }

    const activeSupabase = supabase;
    const activeWorkspaceId = session.workspace.id;
    const { data: guardians, error: guardianError } = await supabase
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

    const results = await Promise.allSettled(
      targets.map((guardian) => {
        const student = alertStudents.find((item) => item.id === guardian.student_id);
        const status = student ? marks[student.id] : 'present';
        const studentName = student ? `${student.first_name} ${student.last_name}` : 'นักเรียน';
        const note = student ? notes[student.id]?.trim() : '';

        return activeSupabase.functions.invoke('dispatch-notification', {
          body: {
            body: `${studentName} มีสถานะ ${statusLabels[status]} วันที่ ${attendanceDate} ช่วง ${periodLabel}${note ? ` หมายเหตุ: ${note}` : ''}`,
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
    <main className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="nexus-kicker">
            <ClipboardCheck size={18} aria-hidden="true" />
            Attendance
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
            เช็คเวลาเรียนรายวัน
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            {session.workspace?.schoolName || 'Demo Workspace'} | ข้อมูลเวลาเรียนผูกกับ workspace, classroom, session และ student
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[520px]">
          {summary.slice(0, 3).map((item) => (
            <div className={`rounded-3xl p-3 text-center font-black shadow-[0_18px_42px_rgba(15,23,42,0.08)] ring-1 transition hover:-translate-y-1 ${item.tone}`} key={item.value}>
              <p className="text-2xl">{item.count}</p>
              <p className="mt-1 text-xs">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="grid gap-5">
          <form className="nexus-card p-4 sm:p-5" onSubmit={handleCreateSession}>
            <div className="nexus-kicker">
              <CalendarDays size={16} aria-hidden="true" />
              รอบเช็คชื่อ
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ห้องเรียน
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setClassroomId(event.target.value)}
                  value={classroomId}
                >
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  วันที่
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    type="date"
                    value={attendanceDate}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ช่วงเวลา
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setPeriodLabel(event.target.value)}
                    value={periodLabel}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                วิชา/กิจกรรม
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setSubjectName(event.target.value)}
                  value={subjectName}
                />
              </label>
            </div>
            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || !classroomId}
              type="submit"
            >
              เปิดรอบเช็คชื่อ
              <Clock3 size={17} aria-hidden="true" />
            </button>
          </form>

          <div className="nexus-card p-4 sm:p-5">
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
              ส่งเฉพาะสถานะ ขาด/สาย/ลา/ป่วย ไปยังผู้ปกครองที่มี profile และ consent granted
            </div>
          </div>
        </div>

        <div className="nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-teal-700">
                {attendanceSession ? `${attendanceSession.period_label} | ${attendanceSession.subject_name || 'ไม่ระบุวิชา'}` : 'ยังไม่ได้เปิดรอบเช็คชื่อ'}
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                รายชื่อนักเรียน {classroomStudents.length} คน
              </h2>
            </div>
            <button
              className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || !attendanceSession || classroomStudents.length === 0}
              onClick={handleSaveRecords}
              type="button"
            >
              บันทึกเวลาเรียน
              <Save size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {classroomStudents.map((student) => (
              <div className="nexus-muted-box p-3" key={student.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">
                      {student.student_code || '-'} | {student.first_name} {student.last_name}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{student.nickname || 'ยังไม่มีชื่อเล่น'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => {
                      const isActive = marks[student.id] === option.value;

                      return (
                        <button
                          className={`inline-flex h-9 items-center gap-1 rounded-2xl px-3 text-xs font-black ring-1 transition hover:-translate-y-0.5 ${
                            isActive ? option.tone : 'bg-white/85 text-slate-500 ring-slate-200 hover:bg-white'
                          }`}
                          key={option.value}
                          onClick={() => setMarks((current) => ({ ...current, [student.id]: option.value }))}
                          type="button"
                        >
                          {isActive ? <Check size={14} aria-hidden="true" /> : null}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  className="nexus-field mt-3 h-10 w-full px-3"
                  onChange={(event) => setNotes((current) => ({ ...current, [student.id]: event.target.value }))}
                  placeholder={`หมายเหตุสำหรับสถานะ ${statusLabels[marks[student.id] || 'present']}`}
                  value={notes[student.id] || ''}
                />
              </div>
            ))}

            {!isLoading && classroomStudents.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ยังไม่มีนักเรียนในห้องนี้ ให้เพิ่มนักเรียนในเมนู Student 360 ก่อน
              </div>
            ) : null}
          </div>
        </div>
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
