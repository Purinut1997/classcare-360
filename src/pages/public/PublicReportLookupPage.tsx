import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  HeartHandshake,
  Eye,
  LockKeyhole,
  Search,
  Shield,
  Sparkles,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
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

function formatCitizenId(raw: string): string {
  const parts = [raw.slice(0, 1), raw.slice(1, 5), raw.slice(5, 10), raw.slice(10, 12), raw.slice(12, 13)];
  return parts.filter(Boolean).join('-');
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: string }) {
  const toneMap: Record<string, { bg: string; text: string }> = {
    green: { bg: 'bg-emerald-50 shadow-emerald-100', text: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50 shadow-amber-100',     text: 'text-amber-700'  },
    red:   { bg: 'bg-rose-50 shadow-rose-100',       text: 'text-rose-700'   },
    slate: { bg: 'bg-slate-50 shadow-slate-100',     text: 'text-slate-700'  },
  };
  const t = toneMap[tone] ?? toneMap.slate;
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-4 shadow-md ${t.bg}`}>
      <p className={`text-3xl font-black tracking-tight ${t.text}`}>{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function SectionHeader({ icon, label, title }: { icon: ReactNode; label: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">{label}</p>
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
      </div>
    </div>
  );
}

function TrustBadge({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-0.5 text-xs font-medium leading-5 text-indigo-200">{body}</p>
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

  const canSubmit = !isLoading && !!schools.length && citizenId.length === 13 && !!birthDate;

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 48%, #f8fafc 48%)' }}>

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link className="flex items-center gap-3" to="/">
          <AppLogo className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1.5 ring-1 ring-white/20" />
          <div>
            <p className="text-sm font-black text-white">ClassCare 360</p>
            <p className="text-[10px] font-semibold text-indigo-300">ระบบดูรายงานนักเรียน</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
            to="/"
          >
            <ChevronLeft size={15} aria-hidden="true" />
            กลับหน้าแรก
          </Link>
          <Link
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-black text-indigo-900 shadow-lg transition hover:bg-indigo-50"
            to="/login"
          >
            เข้าสู่ระบบครู
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </nav>

      {/* ── Hero + Form ───────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">

          {/* Form card */}
          <div>
            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-indigo-200 ring-1 ring-white/15">
                <Sparkles size={12} aria-hidden="true" />
                ระบบรายงานสำหรับผู้ปกครอง
              </div>
              <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl xl:text-[2.6rem]">
                ติดตามความก้าวหน้า<br />
                <span className="text-amber-400">ของบุตรหลาน</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-indigo-200">
                กรอกเลขบัตรประชาชน 13 หลัก และวันเกิดของนักเรียน เพื่อดูรายงานที่โรงเรียนอนุญาตให้เปิดเผย
              </p>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-2xl shadow-indigo-900/25">
              {/* Step indicators */}
              <div className="mb-7 flex items-center gap-1.5">
                {[
                  { num: 1, label: 'โรงเรียน',    done: !!selectedWorkspaceId },
                  { num: 2, label: 'เลขบัตร',     done: citizenId.length === 13 },
                  { num: 3, label: 'วันเกิด',     done: !!birthDate },
                ].map((step, i) => (
                  <div key={step.num} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <div className={`h-px w-6 transition-all duration-500 ${step.done ? 'bg-indigo-400' : 'bg-slate-200'}`} />
                    )}
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-300 ${step.done ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <span>{step.done ? '✓' : step.num}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <form className="grid gap-5" onSubmit={(event) => void submitLookup(event)}>
                {/* School */}
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500" htmlFor="school-select">
                    โรงเรียน
                  </label>
                  <div className="relative">
                    <select
                      className="h-12 w-full appearance-none rounded-xl border-2 border-slate-200 bg-slate-50 pl-4 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                      id="school-select"
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
                    <ChevronRight size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" aria-hidden="true" />
                  </div>
                </div>

                {/* Citizen ID */}
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500" htmlFor="citizen-id">
                    เลขบัตรประชาชนนักเรียน
                  </label>
                  <div className="relative">
                    <input
                      autoComplete="off"
                      className="h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 text-sm font-semibold tracking-[0.12em] text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                      id="citizen-id"
                      inputMode="numeric"
                      maxLength={13}
                      onChange={(event) => setCitizenId(onlyDigits(event.target.value))}
                      placeholder="กรอก 13 หลัก"
                      value={citizenId}
                    />
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 h-[2px] overflow-hidden rounded-b-xl">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${(citizenId.length / 13) * 100}%` }}
                      />
                    </div>
                  </div>
                  {citizenId.length > 0 && citizenId.length < 13 && (
                    <p className="text-xs font-semibold text-amber-600">กรุณากรอกให้ครบ 13 หลัก (กรอกแล้ว {citizenId.length} หลัก)</p>
                  )}
                  {citizenId.length === 13 && (
                    <p className="text-xs font-bold text-emerald-600">✓ {formatCitizenId(citizenId)}</p>
                  )}
                </div>

                {/* Birthdate */}
                <div className="grid gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500" htmlFor="birth-date">
                    วันเดือนปีเกิด
                  </label>
                  <ThaiDatePicker appearance="light" className="h-12 px-4 text-sm" onValueChange={setBirthDate} value={birthDate} />
                </div>

                {/* Submit */}
                <button
                  className={`mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black shadow-lg transition-all duration-200 ${canSubmit ? 'cursor-pointer bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98]' : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'}`}
                  disabled={!canSubmit}
                  type="submit"
                >
                  {isLoading ? (
                    <NexusAuroraInline label="กำลังค้นหา..." />
                  ) : (
                    <>
                      <Search size={18} aria-hidden="true" />
                      ดูรายงานนักเรียน
                    </>
                  )}
                </button>
              </form>

              {error ? (
                <div
                  className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-semibold leading-6 text-rose-800"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 shrink-0 text-rose-500" size={18} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Trust panel (glassmorphism) */}
          <aside
            className="rounded-3xl p-6"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.13)' }}
          >
            <div className="mb-1 flex items-center gap-2">
              <Shield size={18} className="text-indigo-300" aria-hidden="true" />
              <h2 className="text-sm font-black text-white">ปลอดภัยและเป็นส่วนตัว</h2>
            </div>
            <p className="mb-6 text-xs font-medium leading-6 text-indigo-300">
              ข้อมูลแสดงตามสิทธิ์ที่โรงเรียนกำหนด เข้าถึงได้เฉพาะผู้ที่มีข้อมูลตรงกันเท่านั้น
            </p>
            <div className="grid gap-5">
              <TrustBadge icon={LockKeyhole} title="เข้ารหัสข้อมูล" body="ปกป้องด้วยมาตรฐานความปลอดภัยระดับสากล" />
              <TrustBadge icon={Eye}         title="เฉพาะที่ได้รับอนุญาต" body="แสดงเฉพาะข้อมูลที่โรงเรียนเปิดให้ดู" />
              <TrustBadge icon={CalendarDays} title="อัปเดตเป็นปัจจุบัน" body="ข้อมูลอิงจากการบันทึกล่าสุดของโรงเรียน" />
            </div>
            <div className="my-6 h-px bg-white/10" />
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-xs font-black text-indigo-200">💡 สำหรับผู้ปกครอง</p>
              <p className="mt-2 text-xs font-medium leading-5 text-indigo-300">
                หากไม่พบข้อมูล กรุณาติดต่อครูประจำชั้นเพื่อตรวจสอบว่าโรงเรียนเปิดระบบรายงานนี้แล้วหรือยัง
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 min-h-[160px]">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">

          {result?.ok && result.student ? (
            <div className="grid gap-6">
              {/* Student identity card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-7 shadow-xl shadow-indigo-500/20">
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-2xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-violet-400/10 blur-2xl" aria-hidden="true" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-200">{result.workspace?.school_name}</p>
                    <h2 className="text-2xl font-black text-white sm:text-3xl">
                      {result.student.first_name} {result.student.last_name}
                      {result.student.nickname ? <span className="ml-2 text-lg font-bold text-indigo-200">({result.student.nickname})</span> : null}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-indigo-200">
                      {result.student.student_code && <span>รหัส: {result.student.student_code}</span>}
                      {result.student.classroom_name && <><span className="text-indigo-400">·</span><span>ชั้น {result.student.classroom_name}</span></>}
                      {result.workspace?.academic_year && <><span className="text-indigo-400">·</span><span>ปีการศึกษา {result.workspace.academic_year}</span></>}
                    </div>
                  </div>
                  <span className="w-fit shrink-0 rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white ring-1 ring-white/20">
                    ✓ แสดงเฉพาะข้อมูลที่โรงเรียนเปิดไว้
                  </span>
                </div>
              </div>

              {/* Metric cards grid */}
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.attendance ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader icon={<Clock3 size={18} />} label="Attendance" title="เวลาเรียน" />
                    <div className="grid grid-cols-2 gap-3">
                      <MetricCard label="มาเรียน (วัน)"  value={result.attendance.present} tone="green" />
                      <MetricCard label="ขาดเรียน (วัน)" value={result.attendance.absent}  tone="red"   />
                      <MetricCard label="มาสาย (วัน)"   value={result.attendance.late}    tone="amber"  />
                      <MetricCard label="ลา (วัน)"      value={result.attendance.leave}               />
                    </div>
                  </section>
                ) : null}

                {result.scores ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader icon={<GraduationCap size={18} />} label="Scores" title="ผลการเรียน" />
                    <div className="grid gap-3">
                      <MetricCard label="รายการคะแนนที่บันทึก" value={result.scores.entries} />
                      <MetricCard
                        label="คะแนนเฉลี่ย"
                        value={result.scores.average_percent === null ? '-' : `${result.scores.average_percent}%`}
                        tone="amber"
                      />
                    </div>
                  </section>
                ) : null}

                {result.savings ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader icon={<WalletCards size={18} />} label="Savings" title="เงินออม" />
                    <MetricCard
                      label="ยอดเงินออมคงเหลือ"
                      value={`฿${result.savings.balance.toLocaleString('th-TH')}`}
                      tone="green"
                    />
                  </section>
                ) : null}

                {result.behavior ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader icon={<HeartHandshake size={18} />} label="Care" title="พฤติกรรมและการดูแล" />
                    <div className="grid grid-cols-3 gap-3">
                      <MetricCard label="เชิงบวก"    value={result.behavior.positive}  tone="green" />
                      <MetricCard label="ข้อห่วงใย"  value={result.behavior.concern}   tone="red"   />
                      <MetricCard label="ต้องติดตาม" value={result.behavior.follow_up} tone="amber" />
                    </div>
                  </section>
                ) : null}

                {result.home_visit ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader icon={<FileText size={18} />} label="Home Visit" title="แบบเยี่ยมบ้าน" />
                    <div className="grid gap-3">
                      <MetricCard label="สถานะ" value={result.home_visit.status || '-'} />
                      <MetricCard label="ความครบถ้วน" value={`${result.home_visit.completion_percent || 0}%`} tone="amber" />
                    </div>
                  </section>
                ) : null}

                {result.guardians ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <SectionHeader icon={<UserRound size={18} />} label="Guardian" title="ผู้ปกครอง" />
                    <div className="grid gap-3">
                      {result.guardians.length ? (
                        result.guardians.map((guardian, index) => (
                          <div
                            className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100"
                            key={`${guardian.display_name}-${index}`}
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                              <UserRound size={15} aria-hidden="true" />
                            </span>
                            <div>
                              <p className="text-sm font-black text-slate-800">{guardian.display_name || 'ไม่ระบุชื่อ'}</p>
                              <p className="text-xs font-bold text-slate-500">
                                {guardian.relation || '-'}{guardian.is_primary ? ' · ผู้ปกครองหลัก' : ''}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                          ยังไม่มีข้อมูลผู้ปกครองที่เปิดเผย
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-indigo-100 text-indigo-500">
                <Search size={28} aria-hidden="true" />
              </div>
              <div>
                <p className="text-base font-black text-slate-700">รอการค้นหา</p>
                <p className="mt-1 text-sm font-medium text-slate-500">กรอกข้อมูลด้านบนเพื่อดูรายงานที่โรงเรียนอนุญาต</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

