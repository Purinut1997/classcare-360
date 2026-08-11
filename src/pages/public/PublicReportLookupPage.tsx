import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  Clock3,
  FileText,
  GraduationCap,
  HeartHandshake,
  Eye,
  LockKeyhole,
  Search,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';

interface PublicReportSchool {
  academic_year: string | null;
  enabled: boolean;
  school_name: string;
  workspace_id: string;
}

interface PublicReportPayload {
  attendance?: {
    absent: number;
    latest: Array<{ date: string; note: string | null; period: string | null; status: string; subject: string | null }>;
    late: number;
    leave: number;
    present: number;
    total: number;
  } | null;
  behavior?: {
    concern: number;
    follow_up: number;
    positive: number;
    records: number;
  } | null;
  guardians?: Array<{ display_name: string | null; is_primary: boolean; relation: string | null }> | null;
  home_visit?: {
    completion_percent: number;
    status: string | null;
    updated_at: string | null;
  } | null;
  ok: boolean;
  reason?: string;
  savings?: {
    balance: number;
    status: string | null;
  } | null;
  scores?: {
    average_percent: number | null;
    entries: number;
    latest: Array<{ max_score: number; score: number; subject: string | null; title: string }>;
  } | null;
  student?: {
    classroom_name: string | null;
    first_name: string;
    last_name: string;
    nickname: string | null;
    status: string;
    student_code: string | null;
  };
  workspace?: {
    academic_year: string | null;
    id: string;
    name: string;
    school_name: string;
  };
}

const demoSchools: PublicReportSchool[] = [
  {
    academic_year: '2569',
    enabled: true,
    school_name: 'โรงเรียนตัวอย่าง ClassCare',
    workspace_id: 'demo-public-workspace',
  },
];

const initialSchools = isSupabaseReady ? [] : demoSchools;

const reasonCopy: Record<string, string> = {
  invalid_identity: 'กรุณากรอกเลขบัตรประชาชน 13 หลัก และวันเกิดให้ถูกต้อง',
  public_report_disabled: 'โรงเรียนนี้ยังไม่ได้เปิดระบบดูรายงานหน้าแรก',
  student_not_found: 'ไม่พบข้อมูลนักเรียนที่ตรงกับเลขบัตรและวันเกิดนี้',
  workspace_not_found: 'ไม่พบโรงเรียนที่เลือก หรือโรงเรียนยังไม่เปิดเผยรายงาน',
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 13);
}

function publicReportErrorCopy(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('get_public_report_schools') || normalized.includes('schema cache')) {
    return 'ระบบรายงานกำลังปรับปรุงการเชื่อมต่อ กรุณาลองใหม่อีกครั้งในภายหลัง';
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'เชื่อมต่อระบบรายงานไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
  }

  return 'ไม่สามารถโหลดข้อมูลรายงานได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
}

function metric(label: string, value: string | number, tone = 'slate') {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-950'
        : tone === 'red'
          ? 'border-rose-200 bg-rose-50 text-rose-950'
          : 'border-slate-200 bg-white text-slate-950';

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm ${toneClass}`}>
      <p className="text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-black text-slate-500">{label}</p>
    </div>
  );
}

function sectionTitle(icon: ReactNode, label: string, title: string) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">{label}</p>
        <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      </div>
    </div>
  );
}

export function PublicReportLookupPage() {
  const [schools, setSchools] = useState<PublicReportSchool[]>(initialSchools);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialSchools[0]?.workspace_id || '');
  const [citizenId, setCitizenId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [result, setResult] = useState<PublicReportPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(isSupabaseReady ? null : 'โหมดตัวอย่าง: ยังไม่ได้เชื่อม Supabase จริงใน browser นี้');

  useEffect(() => {
    let isMounted = true;

    async function loadSchools() {
      if (!supabase) return;
      const { data, error: rpcError } = await supabase.rpc('get_public_report_schools');
      if (!isMounted) return;

      if (rpcError) {
        setError(publicReportErrorCopy(rpcError.message));
        setSchools([]);
        setSelectedWorkspaceId('');
        return;
      }

      const nextSchools = ((data || []) as PublicReportSchool[]).filter((school) => school.enabled);
      setSchools(nextSchools.length ? nextSchools : []);
      setSelectedWorkspaceId(nextSchools[0]?.workspace_id || '');
    }

    void loadSchools();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.workspace_id === selectedWorkspaceId) || null,
    [schools, selectedWorkspaceId],
  );

  async function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!selectedWorkspaceId || citizenId.length !== 13 || !birthDate) {
      setError(reasonCopy.invalid_identity);
      return;
    }

    if (!supabase) {
      setResult({
        attendance: { absent: 1, late: 0, leave: 0, latest: [], present: 18, total: 19 },
        behavior: { concern: 0, follow_up: 1, positive: 2, records: 3 },
        guardians: [{ display_name: 'ผู้ปกครองตัวอย่าง', is_primary: true, relation: 'มารดา' }],
        home_visit: { completion_percent: 80, status: 'draft', updated_at: new Date().toISOString() },
        ok: true,
        savings: { balance: 120, status: 'active' },
        scores: { average_percent: 82, entries: 4, latest: [] },
        student: {
          classroom_name: 'ป.5/1',
          first_name: 'นักเรียน',
          last_name: 'ตัวอย่าง',
          nickname: 'มิกซ์',
          status: 'active',
          student_code: 'DEMO-001',
        },
        workspace: {
          academic_year: selectedSchool?.academic_year || '2569',
          id: selectedWorkspaceId,
          name: 'ห้องเรียนตัวอย่าง',
          school_name: selectedSchool?.school_name || 'โรงเรียนตัวอย่าง ClassCare',
        },
      });
      return;
    }

    setIsLoading(true);
    const { data, error: rpcError } = await supabase.rpc('lookup_public_student_report', {
      citizen_id: citizenId,
      target_birth_date: birthDate,
      target_workspace_id: selectedWorkspaceId,
    });
    setIsLoading(false);

    if (rpcError) {
      setError(publicReportErrorCopy(rpcError.message));
      return;
    }

    const payload = data as PublicReportPayload;
    if (!payload?.ok) {
      setError(reasonCopy[payload?.reason || ''] || 'ไม่พบข้อมูลตามเงื่อนไขนี้');
    }
    setResult(payload);
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-1 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <Link className="flex items-center gap-3" to="/">
            <AppLogo className="h-12 w-12 rounded-2xl bg-white object-contain p-1 ring-1 ring-slate-200" />
            <div>
              <p className="text-lg font-black">ClassCare 360</p>
              <p className="text-xs font-black text-slate-500">ตรวจรายงานนักเรียนแบบจำกัดสิทธิ์</p>
            </div>
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm" to="/">
              <ChevronLeft size={17} aria-hidden="true" />
              กลับหน้าแรก
            </Link>
            <Link className="inline-flex h-11 items-center justify-center rounded-xl bg-[#06152d] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0c2953]" to="/login">
              เข้าสู่ระบบครู
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(290px,0.65fr)] lg:items-start">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-9">
            <h1 className="text-4xl font-black leading-[1.12] tracking-tight text-[#06152d] sm:text-5xl">ดูรายงานนักเรียนด้วยเลขบัตรและวันเกิด</h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">
              เลือกโรงเรียน กรอกเลขบัตรประชาชน 13 หลัก และวันเกิดของนักเรียน ระบบจะแสดงเฉพาะข้อมูลที่โรงเรียนเปิดไว้เท่านั้น
            </p>

            <form className="mt-6 grid gap-4" onSubmit={(event) => void submitLookup(event)}>
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                โรงเรียน
                <select
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                  value={selectedWorkspaceId}
                >
                  {schools.length ? (
                    schools.map((school) => (
                      <option key={school.workspace_id} value={school.workspace_id}>
                        {school.school_name} {school.academic_year ? `ปี ${school.academic_year}` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">ยังไม่มีโรงเรียนที่เปิดรายงานหน้าแรก</option>
                  )}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-800">
                เลขบัตรประชาชนนักเรียน
                <input
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold tracking-[0.08em] outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                  inputMode="numeric"
                  maxLength={13}
                  onChange={(event) => setCitizenId(onlyDigits(event.target.value))}
                  placeholder="กรอก 13 หลัก"
                  value={citizenId}
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-800">
                วันเดือนปีเกิด
                <input
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                  onChange={(event) => setBirthDate(event.target.value)}
                  type="date"
                  value={birthDate}
                />
              </label>

              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-[#06152d] shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                disabled={isLoading || !schools.length || citizenId.length !== 13 || !birthDate}
                type="submit"
              >
                <Search size={18} aria-hidden="true" />
                {isLoading ? 'กำลังค้นหา' : 'ดูรายงาน'}
              </button>
            </form>

            {error ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-900" role="alert">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
            <h2 className="text-xl font-black text-[#06152d]">รายงานนี้ปลอดภัยและเป็นส่วนตัว</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">ข้อมูลของนักเรียนแสดงตามสิทธิ์ที่โรงเรียนกำหนด และใช้เพื่อการติดตามผลเฉพาะผู้ที่มีข้อมูลตรงกันเท่านั้น</p>
            <div className="mt-6 grid gap-5">
              {[
                { body: 'เข้ารหัสข้อมูลและปกป้องตามมาตรฐานสากล', icon: LockKeyhole, title: 'ปลอดภัย' },
                { body: 'แสดงเฉพาะข้อมูลที่โรงเรียนเปิดให้ดู', icon: Eye, title: 'เฉพาะที่ได้รับอนุญาต' },
                { body: 'ข้อมูลอิงจากการบันทึกล่าสุดของโรงเรียน', icon: Clock3, title: 'อัปเดตเป็นปัจจุบัน' },
              ].map(({ body, icon: Icon, title }) => (
                <div className="flex gap-3" key={title}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"><Icon size={20} /></span>
                  <div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{body}</p></div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {result?.ok && result.student ? (
          <section className="grid gap-5">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-black text-cyan-700">{result.workspace?.school_name}</p>
                  <h2 className="mt-1 text-3xl font-black">
                    {result.student.first_name} {result.student.last_name}
                  </h2>
                  <p className="mt-1 text-sm font-black text-slate-500">
                    {result.student.student_code || '-'} | {result.student.classroom_name || '-'} | ปี {result.workspace?.academic_year || '-'}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-100">
                  แสดงเฉพาะข้อมูลที่โรงเรียนเปิดไว้
                </span>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {result.attendance ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  {sectionTitle(<Clock3 size={20} />, 'Attendance', 'เวลาเรียน')}
                  <div className="grid gap-3 sm:grid-cols-4">
                    {metric('มา', result.attendance.present, 'green')}
                    {metric('ขาด', result.attendance.absent, 'red')}
                    {metric('สาย', result.attendance.late, 'amber')}
                    {metric('ลา', result.attendance.leave)}
                  </div>
                </section>
              ) : null}

              {result.scores ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  {sectionTitle(<GraduationCap size={20} />, 'Scores', 'คะแนน')}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {metric('รายการคะแนน', result.scores.entries)}
                    {metric('คะแนนเฉลี่ย', result.scores.average_percent === null ? '-' : `${result.scores.average_percent}%`, 'amber')}
                  </div>
                </section>
              ) : null}

              {result.savings ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  {sectionTitle(<WalletCards size={20} />, 'Savings', 'เงินออม')}
                  {metric('ยอดเงินออมคงเหลือ', `฿${result.savings.balance.toLocaleString('th-TH')}`, 'green')}
                </section>
              ) : null}

              {result.behavior ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  {sectionTitle(<HeartHandshake size={20} />, 'Care', 'พฤติกรรมและเคสดูแล')}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {metric('เชิงบวก', result.behavior.positive, 'green')}
                    {metric('ข้อห่วงใย', result.behavior.concern, 'red')}
                    {metric('ต้องติดตาม', result.behavior.follow_up, 'amber')}
                  </div>
                </section>
              ) : null}

              {result.home_visit ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  {sectionTitle(<FileText size={20} />, 'Home Visit', 'แบบเยี่ยมบ้าน')}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {metric('สถานะ', result.home_visit.status || '-')}
                    {metric('ความครบถ้วน', `${result.home_visit.completion_percent || 0}%`, 'amber')}
                  </div>
                </section>
              ) : null}

              {result.guardians ? (
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  {sectionTitle(<UserRound size={20} />, 'Guardian', 'ผู้ปกครอง')}
                  <div className="grid gap-3">
                    {result.guardians.length ? (
                      result.guardians.map((guardian, index) => (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3" key={`${guardian.display_name}-${index}`}>
                          <p className="font-black">{guardian.display_name || 'ไม่ระบุชื่อ'}</p>
                          <p className="text-sm font-bold text-slate-500">
                            {guardian.relation || '-'} {guardian.is_primary ? '| ผู้ปกครองหลัก' : ''}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-500">ยังไม่มีข้อมูลผู้ปกครองที่เปิดเผย</div>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-cyan-700" size={22} aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-600">กรอกข้อมูลด้านบนเพื่อดูรายงานที่โรงเรียนอนุญาต</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
