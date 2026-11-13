import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, ShieldCheck, UserRound, Users } from 'lucide-react';

import { AppLogo } from '../../components/brand/AppLogo';
import { BotanicalCardSprig, BotanicalCornerWatermark, BotanicalEmptyState } from '../../components/shared/BotanicalDecor';
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

  const title = portalRole === 'parent' ? 'สมุดพกผู้ปกครอง' : 'สมุดพกนักเรียน';
  const subtitle =
    portalRole === 'parent'
      ? 'ติดตามเวลาเรียนและข้อมูลดูแลช่วยเหลือนักเรียนของบุตรหลานได้อย่างปลอดภัยและสะดวก'
      : 'ดูประวัติการมาเรียน รายวิชา และข้อมูลประจำวันของตนเองได้ครบในหน้าเดียว';

  const summaryThemes: Record<string, { topBar: string; sprig: string; pill: string }> = {
    present: { topBar: 'bg-[#2F7D5B]', sprig: '#2F7D5B', pill: 'bg-[#E6F4EC] text-[#1C573D] border-[#BFE0CD]' },
    late: { topBar: 'bg-[#D98B26]', sprig: '#D98B26', pill: 'bg-[#FDF4E1] text-[#8B5312] border-[#F0D9AE]' },
    absent: { topBar: 'bg-[#C25970]', sprig: '#C25970', pill: 'bg-[#FBEFF2] text-[#8E354A] border-[#F0CFD7]' },
    leave: { topBar: 'bg-[#2D72A3]', sprig: '#2D72A3', pill: 'bg-[#E9F3FA] text-[#1D547C] border-[#CBE1F2]' },
  };

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-[#1F2A22] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
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
                  คุ้มครองข้อมูลส่วนบุคคล
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden border-t border-[#DCE3D7] bg-[#F5FBF7] p-6 xl:border-l xl:border-t-0 sm:p-8">
              <BotanicalCardSprig className="absolute right-2 top-2" color="#2F7D5B" opacity={0.18} />
              <p className="relative font-display text-sm font-bold text-[#1C573D]">ความปลอดภัยของข้อมูล</p>
              <div className="relative mt-4 grid gap-2.5">
                {[
                  'แสดงเฉพาะข้อมูลนักเรียนที่ได้รับสิทธิ์เท่านั้น',
                  'เชื่อมโยงการเข้าถึงตามการยินยอมของผู้ปกครอง',
                  'แยกข้อมูลแต่ละโรงเรียนอย่างเป็นสัดส่วนปลอดภัย',
                ].map((item) => (
                  <div className="flex gap-3 rounded-xl border border-[#BFE0CD]/80 bg-white/90 p-3 shadow-2xs" key={item}>
                    <CheckCircle2 className="mt-0.5 shrink-0 text-[#2F7D5B]" size={17} aria-hidden="true" />
                    <p className="text-xs font-semibold leading-5 text-[#1F2A22] sm:text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => {
            const theme = summaryThemes[item.status] || summaryThemes.present;
            return (
              <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-white p-4 pt-5 text-center shadow-xs transition hover:-translate-y-0.5 hover:shadow-md" key={item.status}>
                <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${theme.topBar}`} />
                <BotanicalCardSprig className="absolute -right-2 -top-1.5" color={theme.sprig} opacity={0.14} />
                <p className="relative z-10 font-display text-3xl font-bold text-[#1F2A22]">{item.count}</p>
                <span className={`relative z-10 mt-1.5 inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${theme.pill}`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {notice ? (
          <div className="mt-5 flex gap-2.5 rounded-2xl border border-[#F0D9AE] bg-[#FDF4E1] p-3.5 text-sm font-bold leading-6 text-[#8B5312] shadow-2xs">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{notice}</p>
          </div>
        ) : null}

        <section className="mt-5 grid gap-5">
          <aside className="rounded-3xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-6">
            <div className="nexus-kicker">
              <UserRound size={15} aria-hidden="true" />
              รายชื่อนักเรียนในสิทธิ์
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {students.map((student) => (
                <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-4" key={student.id}>
                  <BotanicalCardSprig className="absolute -right-2 -top-2" color="#2F7D5B" opacity={0.14} />
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold text-[#1F2A22]">{student.name}</p>
                      <p className="mt-1 text-sm font-semibold text-[#5B6A5F]">
                        {student.code} | {student.nickname} | {student.classroomName}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-3 py-1 text-xs font-bold text-[#1C573D]">
                      {student.relation}
                    </span>
                  </div>
                </div>
              ))}

              {!isLoading && students.length === 0 ? (
                <div className="sm:col-span-2">
                  <BotanicalEmptyState
                    title="ยังไม่มีข้อมูลนักเรียนที่เชื่อมโยง"
                    description="กรุณาติดต่อครูประจำชั้นเพื่อตรวจสอบการอนุมัติสิทธิ์การเข้าถึงข้อมูลนักเรียน"
                    icon={<UserRound className="text-[#2F7D5B]" size={22} />}
                  />
                </div>
              ) : null}
            </div>
          </aside>

          <div className="rounded-3xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-6">
            <div className="flex flex-col gap-3 border-b border-[#EDF1EA] pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#2F7D5B]">Attendance Timeline</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#1F2A22]">เวลาเรียนล่าสุด</h2>
              </div>
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] px-3.5 text-xs font-bold text-[#465549]">
                <CalendarCheck2 size={16} className="text-[#2F7D5B]" aria-hidden="true" />
                {session.workspace?.schoolName || 'สมุดพกห้องเรียน'}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {attendance.map((record) => {
                const statusTheme = summaryThemes[record.status] || {
                  pill: 'bg-[#E9F3FA] text-[#1D547C] border-[#CBE1F2]',
                };
                return (
                  <article className="rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-4 transition hover:bg-white" key={record.id}>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTheme.pill}`}>
                            {attendanceLabels[record.status]}
                          </span>
                          <span className="rounded-full border border-[#DCE3D7] bg-white px-3 py-1 text-xs font-bold text-[#5B6A5F]">
                            {formatDate(record.date)} | {record.period}
                          </span>
                        </div>
                        <h3 className="mt-3 font-display font-bold text-[#1F2A22]">{record.studentName}</h3>
                        <p className="mt-1 text-sm font-medium leading-6 text-[#5B6A5F]">
                          {record.subject} | {record.note}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-[#DCE3D7] bg-white p-3 text-sm font-bold text-[#465549]">
                        <Clock3 className="shrink-0 text-[#2F7D5B]" size={17} aria-hidden="true" />
                        บันทึกแล้ว
                      </div>
                    </div>
                  </article>
                );
              })}

              {!isLoading && attendance.length === 0 ? (
                <BotanicalEmptyState
                  title="ยังไม่มีข้อมูลเวลาเรียนล่าสุด"
                  description="เมื่อคุณครูเช็กเวลาเรียนในห้องเรียน รายการล่าสุดจะปรากฏที่นี่"
                  icon={<CalendarCheck2 className="text-[#2F7D5B]" size={22} />}
                />
              ) : null}
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs font-bold text-[#6F8073]">
          ClassCare 360 · สมุดพกห้องเรียนดิจิทัล
        </footer>
      </section>
    </main>
  );
}
