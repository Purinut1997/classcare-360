import { type FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Mail,
  School,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import { getPostAuthRouteForSession } from '../../lib/auth';
import { appEnv } from '../../lib/env';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

type AuthMode = 'login' | 'register' | 'forgot';

const modeCopy: Record<AuthMode, { button: string; eyebrow: string; title: string; subtitle: string }> = {
  login: {
    button: 'เข้าสู่ระบบ',
    eyebrow: 'Secure Portal',
    title: 'เข้าสู่ระบบ ClassCare 360',
    subtitle: 'ระบบบริหารจัดการชั้นเรียนและงานทะเบียนวิชาการ สพฐ. ครบจบในระบบเดียว',
  },
  register: {
    button: 'สร้างบัญชีครูผู้สอน',
    eyebrow: 'Get Started',
    title: 'สมัครสมาชิก ClassCare 360',
    subtitle: 'เริ่มต้นใช้งานระบบดูแลนักเรียน 360 องศา และงานเอกสาร ปพ. ฟรีวันนี้',
  },
  forgot: {
    button: 'ส่งลิงก์รีเซ็ตรหัสผ่าน',
    eyebrow: 'Account Recovery',
    title: 'กู้คืนรหัสผ่านของคุณ',
    subtitle: 'กรอกอีเมลที่ลงทะเบียนไว้ ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังกล่องข้อความ',
  },
};

const authModes: Array<{ icon: typeof LockKeyhole; label: string; mode: AuthMode }> = [
  { icon: LockKeyhole, label: 'เข้าสู่ระบบ', mode: 'login' },
  { icon: UserPlus, label: 'สมัครสมาชิก', mode: 'register' },
  { icon: KeyRound, label: 'ลืมรหัสผ่าน', mode: 'forgot' },
];

function getModeFromQuery(mode: string | null): AuthMode {
  if (mode === 'register' || mode === 'forgot') return mode;
  return 'login';
}

interface LoginPageProps {
  session?: AppSessionContext | null;
}

export function LoginPage({ session }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = getModeFromQuery(searchParams.get('mode'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => {
    if (searchParams.get('reset') === 'success') return 'ตั้งรหัสผ่านใหม่สำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่';
    return isSupabaseReady ? null : 'ยังไม่ได้ตั้งค่า .env.local จึงแสดงเป็นโหมดตัวอย่างก่อน';
  });

  const currentCopy = modeCopy[mode];
  const canSubmitPassword = mode === 'forgot' || (mode === 'login' ? password.length > 0 : password.length >= 8);
  const primaryDisabled = isSubmitting || !email || !canSubmitPassword;

  useEffect(() => {
    if (!session) return;
    navigate(getPostAuthRouteForSession(session, searchParams.get('redirect')), { replace: true });
  }, [navigate, searchParams, session]);

  function switchMode(nextMode: AuthMode) {
    const next = new URLSearchParams(searchParams);
    if (nextMode === 'login') {
      next.delete('mode');
    } else {
      next.set('mode', nextMode);
    }
    setSearchParams(next);
    setNotice(isSupabaseReady ? null : 'ยังไม่ได้ตั้งค่า .env.local จึงแสดงเป็นโหมดตัวอย่างก่อน');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!supabase) {
      const fallback =
        mode === 'register'
          ? 'โหมดตัวอย่าง: สมัครแล้วไปหน้า Complete Profile ต่อได้'
          : mode === 'forgot'
            ? 'โหมดตัวอย่าง: ระบบจะแสดงข้อความส่งลิงก์รีเซ็ตเมื่อเชื่อม Supabase'
            : 'โหมดตัวอย่าง: ใส่ Supabase env แล้วจะเข้าสู่ระบบจริงได้';
      setNotice(fallback);
      setIsSubmitting(false);
      return;
    }

    const profileRedirectTo = `${window.location.origin}/auth/complete-profile`;
    const passwordResetRedirectTo = `${window.location.origin}/auth/reset-password`;
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'register'
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: displayName || email.split('@')[0] },
                emailRedirectTo: profileRedirectTo,
              },
            })
          : await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: passwordResetRedirectTo,
            });

    if (result.error) {
      setNotice(result.error.message);
    } else {
      setNotice(
        mode === 'login'
          ? 'เข้าสู่ระบบสำเร็จ กำลังตรวจสิทธิ์และส่งต่อไปหน้าที่เหมาะสม...'
          : mode === 'register'
            ? 'สมัครสำเร็จ โปรดตรวจอีเมลเพื่อยืนยันบัญชี'
            : 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว',
      );
    }

    setIsSubmitting(false);
  }

  async function handleGoogleLogin() {
    setNotice(null);

    if (!supabase) {
      setNotice('โหมดตัวอย่าง: Google Login จะทำงานหลังตั้งค่า Supabase Auth และ OAuth');
      return;
    }

    setIsGoogleSubmitting(true);

    const callbackUrl = new URL('/login', window.location.origin);
    const requestedRedirect = searchParams.get('redirect');
    if (requestedRedirect) callbackUrl.searchParams.set('redirect', requestedRedirect);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
        scopes: 'openid email profile',
      },
    });

    if (error) {
      const isProviderSetupError = /provider|google|oauth/i.test(error.message);
      setNotice(
        isProviderSetupError
          ? 'ยังเปิดใช้ Google Login ไม่สมบูรณ์: ให้เปิด Google provider ใน Supabase Auth และเพิ่ม callback URL ของ ClassCare 360 ก่อน'
          : error.message,
      );
      setIsGoogleSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-hidden font-sans">
      {/* Dynamic Ambient Mesh Glow Background */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[160px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:32px_32px]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl grid lg:grid-cols-[1.1fr_450px] gap-6 lg:gap-8 items-stretch">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: Hero Brand Showcase */}
        {/* ======================================================== */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-blue-950/70 p-8 sm:p-10 lg:p-12 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          {/* Top Brand Bar */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AppLogo className="h-12 w-12 rounded-2xl bg-white shadow-lg shadow-blue-500/15 ring-2 ring-white/20 p-1" />
                <div>
                  <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>ClassCare 360</span>
                    <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-400/30">
                      v2.0
                    </span>
                  </span>
                  <p className="text-xs font-semibold text-slate-400">ระบบบริหารสถานศึกษาอัจฉริยะ</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-bold text-cyan-200 border border-white/10 backdrop-blur-md">
                <ShieldCheck size={14} className="text-cyan-400 shrink-0" />
                <span>มาตรฐานความปลอดภัย สพฐ.</span>
              </div>
            </div>

            {/* Hero Heading */}
            <div className="mt-10 sm:mt-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 px-3.5 py-1 text-xs font-bold text-blue-300 border border-blue-400/20 mb-4">
                <Sparkles size={13} className="text-amber-300 animate-pulse" />
                <span>{currentCopy.eyebrow}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                {currentCopy.title}
              </h1>
              <p className="mt-4 text-sm sm:text-base font-normal text-slate-300 leading-relaxed max-w-xl">
                {currentCopy.subtitle}
              </p>
            </div>

            {/* Feature Highlights Grid (4 Key Highlights) */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md hover:bg-white/[0.08] transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">เอกสาร ปพ.๕ / ปพ.๖</h4>
                    <p className="text-[11px] text-slate-300/80 mt-0.5">มาตรฐาน สพฐ. พิมพ์ & Excel 1-Click</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md hover:bg-white/[0.08] transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">คะแนน & ตัดเกรด 8 ระดับ</h4>
                    <p className="text-[11px] text-slate-300/80 mt-0.5">ตัดเกรดอัตโนมัติ 8 กลุ่มสาระ คำนวณ GPA</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md hover:bg-white/[0.08] transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">ดูแลช่วยเหลือนักเรียน 360°</h4>
                    <p className="text-[11px] text-slate-300/80 mt-0.5">เช็คชื่อ, คุณลักษณะ 8 ประการ & สุขภาพ BMI</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md hover:bg-white/[0.08] transition duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">จัดการชั้นเรียนอัจฉริยะ</h4>
                    <p className="text-[11px] text-slate-300/80 mt-0.5">สุ่มชื่อตอบ, ผังที่นั่ง, ตารางสอน & ออมทรัพย์</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Indicators */}
          <div className="mt-8 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">คุ้มครองข้อมูล PDPA</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">คลาวด์เรียลไทม์ 24 ชม.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">พอร์ทัลดูผลการเรียน</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">รองรับทุกอุปกรณ์</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Auth Card */}
        {/* ======================================================== */}
        <div className="relative flex flex-col justify-between rounded-[2.5rem] border border-slate-200/80 bg-white p-6 sm:p-8 shadow-2xl text-slate-900">
          
          <div>
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between gap-3 mb-6 pb-2">
              <span className="text-xs font-bold text-slate-400">ClassCare 360 Account</span>
              <Link
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition group"
                to="/"
              >
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                <span>กลับหน้าหลัก</span>
              </Link>
            </div>

            {/* Segmented Auth Mode Switcher */}
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 border border-slate-200/80">
              {authModes.map((item) => {
                const Icon = item.icon;
                const isActive = mode === item.mode;

                return (
                  <button
                    key={item.mode}
                    onClick={() => switchMode(item.mode)}
                    type="button"
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-md shadow-slate-200/60 font-black'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Auth Form */}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ชื่อ - นามสกุล หรือ ชื่อที่แสดงในระบบ
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="เช่น ครูสมชาย ใจดี"
                      value={displayName}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    autoComplete="email"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teacher@school.ac.th"
                    type="email"
                    value={email}
                    required
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      รหัสผ่าน (Password)
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-11 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                      minLength={mode === 'register' ? 8 : 1}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'register' ? 'ความยาวอย่างน้อย 8 ตัวอักษร' : 'กรอกรหัสผ่านของคุณ'}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={primaryDisabled}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white text-sm font-black shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-2"
              >
                <span>{isSubmitting ? 'กำลังดำเนินการ...' : currentCopy.button}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 font-semibold">หรือดำเนินการด้วย</span>
              </div>
            </div>

            {/* Official Google OAuth Button */}
            <button
              type="button"
              disabled={isGoogleSubmitting || isSubmitting}
              onClick={() => void handleGoogleLogin()}
              className="w-full inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs hover:shadow-md transition active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{isGoogleSubmitting ? 'กำลังเชื่อมต่อ Google...' : 'เข้าสู่ระบบด้วย Google Account'}</span>
            </button>

            {/* Notification / Feedback */}
            {notice && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs font-semibold leading-relaxed text-amber-800 animate-in fade-in slide-in-from-top-2 duration-200">
                {notice}
              </div>
            )}
          </div>

          {/* Bottom Card Footer with VIP link */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-3">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/70 text-xs font-bold text-purple-700 hover:text-purple-900 hover:border-purple-300 transition shadow-xs"
            >
              <Crown size={13} className="text-amber-500" />
              <span>ดูแพ็กเกจและสิทธิพิเศษ ClassCare 360 VIP</span>
              <ArrowRight size={11} />
            </Link>

            <p className="text-[11px] font-semibold text-slate-400">
              {appEnv.appName} • ดูแลทั้งห้อง ครบจบในระบบเดียว
            </p>
          </div>
        </div>

      </section>
    </main>
  );
}
