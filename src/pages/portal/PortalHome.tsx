import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, ShieldCheck, UserRound, Users } from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

type PortalRole = 'parent' | 'student';
type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';

interface PortalStudent {
  classroomName: string;
  code: string;
  id: string;
  name: string;
  nickname: string;
  relation: string;
}

interface PortalAttendance {
  date: string;
  id: string;
  note: string;
  period: string;
  status: AttendanceStatus;
  studentName: string;
  subject: string;
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

const demoStudents: PortalStudent[] = [
  {
    classroomName: 'ป.5/2',
    code: '001',
    id: 'demo-student-1',
    name: 'เด็กหญิงพิมพ์ใจ ใจดี',
    nickname: 'พิม',
    relation: 'บุตรหลาน',
  },
  {
    classroomName: 'ป.5/2',
    code: '014',
    id: 'demo-student-2',
    name: 'เด็กชายณัฐวุฒิ ตั้งใจ',
    nickname: 'นัท',
    relation: 'บุตรหลาน',
  },
];

const demoAttendance: PortalAttendance[] = [
  {
    date: '2026-06-25',
    id: 'demo-att-1',
    note: 'เข้าแถวทันเวลา',
    period: 'เช้า',
    status: 'present',
    studentName: 'เด็กหญิงพิมพ์ใจ ใจดี',
    subject: 'โฮมรูม',
  },
  {
    date: '2026-06-24',
    id: 'demo-att-2',
    note: 'มาสาย 10 นาที ผู้ปกครองแจ้งแล้ว',
    period: 'เช้า',
    status: 'late',
    studentName: 'เด็กชายณัฐวุฒิ ตั้งใจ',
    subject: 'โฮมรูม',
  },
  {
    date: '2026-06-23',
    id: 'demo-att-3',
    note: 'เข้าร่วมกิจกรรมหน้าเสาธง',
    period: 'บ่าย',
    status: 'activity',
    studentName: 'เด็กหญิงพิมพ์ใจ ใจดี',
    subject: 'กิจกรรม',
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function mapStudentGuardian(row: Record<string, unknown>): PortalStudent | null {
  const student = row.students as {
    classrooms?: { name?: string | null } | null;
    first_name?: string | null;
    id?: string;
    last_name?: string | null;
    nickname?: string | null;
    student_code?: string | null;
  } | null;

  if (!student?.id) return null;

  return {
    classroomName: student.classrooms?.name || '-',
    code: student.student_code || '-',
    id: student.id,
    name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'ไม่ระบุชื่อ',
    nickname: student.nickname || 'ยังไม่มีชื่อเล่น',
    relation: String(row.relation || 'ผู้เกี่ยวข้อง'),
  };
}

function mapStudentProfileLink(row: Record<string, unknown>): PortalStudent | null {
  const student = row.students as {
    classrooms?: { name?: string | null } | null;
    first_name?: string | null;
    id?: string;
    last_name?: string | null;
    nickname?: string | null;
    student_code?: string | null;
  } | null;

  if (!student?.id) return null;

  return {
    classroomName: student.classrooms?.name || '-',
    code: student.student_code || '-',
    id: student.id,
    name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'ไม่ระบุชื่อ',
    nickname: student.nickname || 'ยังไม่มีชื่อเล่น',
    relation: 'บัญชีนักเรียน',
  };
}

function mapAttendance(row: Record<string, unknown>): PortalAttendance {
  const student = row.students as { first_name?: string | null; last_name?: string | null } | null;
  const session = row.attendance_sessions as {
    attendance_date?: string | null;
    period_label?: string | null;
    subject_name?: string | null;
  } | null;

  return {
    date: session?.attendance_date || String(row.checked_at || row.created_at || new Date().toISOString()),
    id: String(row.id),
    note: (row.note as string | null) || '-',
    period: session?.period_label || '-',
    status: String(row.status || 'present') as AttendanceStatus,
    studentName: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'นักเรียน',
    subject: session?.subject_name || 'ไม่ระบุวิชา',
  };
}

export function PortalHome({ portalRole, session }: PortalHomeProps) {
  const [students, setStudents] = useState<PortalStudent[]>(portalRole === 'parent' ? demoStudents : demoStudents.slice(0, 1));
  const [attendance, setAttendance] = useState<PortalAttendance[]>(demoAttendance);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady
      ? null
      : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อโหลดข้อมูล Portal ผ่าน RLS จริง',
  );

  const summary = useMemo(
    () =>
      (['present', 'late', 'absent', 'leave'] as AttendanceStatus[]).map((status) => ({
        count: attendance.filter((item) => item.status === status).length,
        label: attendanceLabels[status],
        status,
      })),
    [attendance],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPortalData() {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const studentLinkQuery =
        portalRole === 'parent'
          ? supabase
              .from('student_guardians')
              .select('id,relation,consent_status,students(id,student_code,first_name,last_name,nickname,classrooms(name))')
              .eq('profile_id', session.profile.id)
              .eq('consent_status', 'granted')
          : supabase
              .from('student_profile_links')
              .select('id,status,students(id,student_code,first_name,last_name,nickname,classrooms(name))')
              .eq('profile_id', session.profile.id)
              .eq('status', 'active');

      const [
        { data: studentLinkRows, error: studentLinkError },
        { data: attendanceRows, error: attendanceError },
      ] = await Promise.all([
        studentLinkQuery,
        supabase
          .from('attendance_records')
          .select('id,status,note,checked_at,created_at,students(first_name,last_name),attendance_sessions(attendance_date,period_label,subject_name)')
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (!isMounted) return;

      if (studentLinkError || attendanceError) {
        setNotice(studentLinkError?.message || attendanceError?.message || 'โหลดข้อมูล Portal ไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextStudents = ((studentLinkRows || []) as Record<string, unknown>[])
        .map(portalRole === 'parent' ? mapStudentGuardian : mapStudentProfileLink)
        .filter((student): student is PortalStudent => Boolean(student));
      const nextAttendance = ((attendanceRows || []) as Record<string, unknown>[]).map(mapAttendance);

      setStudents(nextStudents);
      setAttendance(nextAttendance);
      if (nextStudents.length === 0 && portalRole === 'student') {
        setNotice('ยังไม่พบนักเรียนที่ผูกกับบัญชี student นี้ หรือ link ยังไม่ active');
      } else if (nextStudents.length === 0) {
        setNotice('ยังไม่พบนักเรียนที่ผูกกับบัญชีนี้ หรือ consent ยังไม่เป็น granted');
      } else {
        setNotice(null);
      }
      setIsLoading(false);
    }

    void loadPortalData();

    return () => {
      isMounted = false;
    };
  }, [portalRole, session.profile.id]);

  const title = portalRole === 'parent' ? 'Portal ผู้ปกครอง' : 'Portal นักเรียน';
  const subtitle =
    portalRole === 'parent'
      ? 'ดูข้อมูลบุตรหลานตาม consent และ RLS ที่ระบบอนุญาตเท่านั้น'
      : 'ดูข้อมูลของตนเองผ่าน student profile link ที่ active และ RLS ที่จำกัดเฉพาะ record ของตนเอง';

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="nexus-card overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="p-6 sm:p-8">
              <div className="nexus-kicker">
                <Users size={18} aria-hidden="true" />
                {portalRole === 'parent' ? 'Parent Portal' : 'Student Portal'}
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-600">
                {subtitle}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <span className="nexus-pill inline-flex h-11 items-center gap-2 px-4 text-sm font-black text-slate-700">
                  <UserRound size={17} aria-hidden="true" />
                  {session.profile.displayName}
                </span>
                <span className="blue-action inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black">
                  <ShieldCheck size={17} aria-hidden="true" />
                  RLS protected
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden border-t border-slate-100 bg-slate-950 p-6 text-white xl:border-l xl:border-t-0 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-300/20 blur-2xl" />
              <p className="relative text-sm font-black text-cyan-200">Privacy Guard</p>
              <div className="relative mt-5 grid gap-3">
                {[
                  'เห็นเฉพาะนักเรียนที่ผูกสิทธิ์',
                  'consent ต้องเป็น granted',
                  'ไม่แสดงข้อมูล workspace อื่น',
                ].map((item) => (
                  <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur" key={item}>
                    <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden="true" />
                    <p className="text-sm font-bold leading-6 text-slate-100">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <div className="nexus-card p-4 text-center transition hover:-translate-y-1" key={item.status}>
              <p className="text-3xl font-black text-slate-950">{item.count}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>

        {notice ? (
          <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{notice}</p>
          </div>
        ) : null}

        <section className="mt-5 grid gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <UserRound size={16} aria-hidden="true" />
              นักเรียนในสิทธิ์
            </div>
            <div className="mt-4 grid gap-3">
              {students.map((student) => (
                <div className="nexus-muted-box p-4" key={student.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{student.name}</p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {student.code} | {student.nickname} | {student.classroomName}
                      </p>
                    </div>
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                      {student.relation}
                    </span>
                  </div>
                </div>
              ))}

              {!isLoading && students.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีนักเรียนในสิทธิ์ของบัญชีนี้
                </div>
              ) : null}
            </div>
          </aside>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">Attendance Timeline</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">เวลาเรียนล่าสุด</h2>
              </div>
              <span className="nexus-pill inline-flex h-10 items-center gap-2 px-3 text-xs font-black text-slate-600">
                <CalendarCheck2 size={16} aria-hidden="true" />
                {session.workspace?.schoolName || 'Portal'}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {attendance.map((record) => (
                <article className="nexus-muted-box p-4" key={record.id}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                          {attendanceLabels[record.status]}
                        </span>
                        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
                          {formatDate(record.date)} | {record.period}
                        </span>
                      </div>
                      <h3 className="mt-3 font-black text-slate-950">{record.studentName}</h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                        {record.subject} | {record.note}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/80 p-3 text-sm font-black text-slate-600 shadow-sm">
                      <Clock3 className="shrink-0 text-cyan-600" size={18} aria-hidden="true" />
                      ตรวจแล้ว
                    </div>
                  </div>
                </article>
              ))}

              {!isLoading && attendance.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีข้อมูลเวลาเรียนที่บัญชีนี้ดูได้
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs font-bold text-slate-500">
          Created by MIKPURINUT
        </footer>
      </section>
    </main>
  );
}
