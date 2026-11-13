import { type FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
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

const featureHighlights = [
  {
    icon: FileSpreadsheet,
    title: 'เอกสาร ปพ.๕ / ปพ.๖',
    desc: 'มาตรฐาน สพฐ. พิมพ์ & Excel 1-Click',
    color: 'bg-[#2D72A3]/25 border-[#2D72A3]/40 text-sky-200',
  },
  {
    icon: GraduationCap,
    title: 'คะแนน & ตัดเกรด 8 ระดับ',
    desc: 'ตัดเกรดอัตโนมัติ 8 กลุ่มสาระ คำนวณ GPA',
    color: 'bg-[#2F7D5B]/30 border-[#8CC6A7]/40 text-[#BCE0CE]',
  },
  {
    icon: Users,
    title: 'ดูแลช่วยเหลือนักเรียน 360°',
    desc: 'เช็คชื่อ, คุณลักษณะ 8 ประการ & สุขภาพ BMI',
    color: 'bg-[#C25970]/25 border-[#C25970]/40 text-rose-200',
  },
  {
    icon: Sparkles,
    title: 'จัดการชั้นเรียนอัจฉริยะ',
    desc: 'สุ่มชื่อตอบ, ผังที่นั่ง, ตารางสอน & ออมทรัพย์',
    color: 'bg-[#D98B26]/25 border-[#D98B26]/40 text-amber-200',
  },
];

const trustBadges = [
  'คุ้มครองข้อมูล PDPA',
  'คลาวด์เรียลไทม์ 24 ชม.',
  'พอร์ทัลดูผลการเรียน',
  'รองรับทุกอุปกรณ์',
];

function getModeFromQuery(mode: string | null): AuthMode {
  if (mode === 'register' || mode === 'forgot') return mode;
  return 'login';
}

interface LoginPageProps {
  session?: AppSessionContext | null;
  sessionWarning?: string | null;
}

export function LoginPage({ session, sessionWarning }: LoginPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = getModeFromQuery(searchParams.get('mode'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showMobileFeatures, setShowMobileFeatures] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => {
    if (sessionWarning) return sessionWarning;
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

  useEffect(() => {
    if (sessionWarning) setNotice(sessionWarning);
  }, [sessionWarning]);

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
    <main className="relative min-h-screen bg-[#152821] text-slate-100 flex items-center justify-center p-3.5 sm:p-6 lg:p-10 overflow-x-hidden font-sans">
      {/* Morning Sage & Forest Canopy Mesh Background */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#2F7D5B]/25 blur-[130px]" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-[#D98B26]/15 blur-[140px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[#2F7D5B]/10 blur-[160px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(233,240,234,0.06)_1px,transparent_1px)] bg-[length:32px_32px]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl flex flex-col lg:grid lg:grid-cols-[1.1fr_450px] gap-5 lg:gap-8 items-stretch">
        
        {/* ======================================================== */}
        {/* DESKTOP-ONLY LEFT COLUMN: Hero Brand Showcase */}
        {/* ======================================================== */}
        <div className="hidden lg:flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-[#1C342B] via-[#182D25] to-[#13231C] p-8 sm:p-10 lg:p-12 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#2F7D5B]/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-[#D98B26]/10 blur-3xl pointer-events-none" />

          {/* Top Brand Bar */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AppLogo className="h-12 w-12 rounded-2xl bg-white shadow-lg shadow-[#152821]/30 ring-2 ring-[#E9F0EA]/30 p-1" />
                <div>
                  <span className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>ClassCare 360</span>
                    <span className="rounded-full bg-[#2F7D5B]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#BCE0CE] border border-[#8CC6A7]/30">
                      v2.0
                    </span>
                  </span>
                  <p className="text-xs font-semibold text-[#A7BDB1]">ระบบบริหารสถานศึกษาอัจฉริยะ</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-[#E9F0EA] border border-white/15 backdrop-blur-md">
                <ShieldCheck size={14} className="text-[#8CC6A7] shrink-0" />
                <span>มาตรฐานความปลอดภัย สพฐ.</span>
              </div>
            </div>

            {/* Hero Heading */}
            <div className="mt-10 sm:mt-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#2F7D5B]/25 px-3.5 py-1 text-xs font-bold text-[#BCE0CE] border border-[#8CC6A7]/25 mb-4">
                <Sparkles size={13} className="text-[#F5B95D]" />
                <span>{currentCopy.eyebrow}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
                {currentCopy.title}
              </h1>
              <p className="mt-4 text-sm sm:text-base font-normal text-[#C8D8CE] leading-relaxed max-w-xl">
                {currentCopy.subtitle}
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {featureHighlights.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-md hover:bg-white/[0.09] transition duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${feat.color}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{feat.title}</h4>
                        <p className="text-[11px] text-[#C8D8CE]/85 mt-0.5">{feat.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Trust Indicators */}
          <div className="mt-8 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trustBadges.map((badge) => (
              <div key={badge} className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-[#8CC6A7] shrink-0" />
                <span className="text-xs font-semibold text-[#C8D8CE]">{badge}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ======================================================== */}
        {/* PRIMARY AUTH CARD (Immediate on Mobile, Right on Desktop) */}
        {/* ======================================================== */}
        <div className="relative flex flex-col justify-between rounded-3xl sm:rounded-[2.5rem] border border-[#DCE3D7] bg-[#FAFBF8] p-5 sm:p-8 shadow-2xl text-[#1C342B] w-full max-w-md lg:max-w-none mx-auto">
          
          <div>
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6 pb-2.5 sm:pb-2 border-b border-[#DCE3D7] sm:border-0">
              <div className="flex items-center gap-2.5">
                <AppLogo className="h-9 w-9 rounded-xl bg-white p-1 ring-1 ring-[#DCE3D7] shrink-0 lg:hidden" />
                <div>
                  <div className="flex items-center gap-1.5 lg:hidden">
                    <span className="text-sm font-black text-[#1C342B] leading-tight">ClassCare 360</span>
                    <span className="rounded-full bg-[#E9F0EA] px-1.5 py-0.2 text-[9px] font-bold text-[#2F7D5B] border border-[#DCE3D7]">v2.0</span>
                  </div>
                  <span className="text-xs font-bold text-[#5A6F64] block">
                    {mode === 'login' ? 'เข้าสู่ระบบบัญชีผู้ใช้' : mode === 'register' ? 'ลงทะเบียนใช้งาน' : 'กู้คืนรหัสผ่าน'}
                  </span>
                </div>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-xs font-bold text-[#5A6F64] hover:text-[#2F7D5B] transition group bg-[#F6F7F3] hover:bg-[#E9F0EA] px-3 py-1.5 rounded-full border border-[#DCE3D7]"
                to="/"
              >
                <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>หน้าหลัก</span>
              </Link>
            </div>

            {/* Segmented Auth Mode Switcher */}
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#EEF2EC] p-1 border border-[#DCE3D7]">
              {authModes.map((item) => {
                const Icon = item.icon;
                const isActive = mode === item.mode;

                return (
                  <button
                    key={item.mode}
                    onClick={() => switchMode(item.mode)}
                    type="button"
                    className={`flex items-center justify-center gap-1.5 py-2 sm:py-2.5 px-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-white text-[#1C342B] shadow-sm font-black ring-1 ring-[#DCE3D7]'
                        : 'text-[#5A6F64] hover:text-[#1C342B] hover:bg-white/50'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-[#2F7D5B]' : ''} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Auth Form */}
            <form className="mt-4 sm:mt-6 space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#1C342B] mb-1">
                    ชื่อ - นามสกุล หรือ ชื่อที่แสดงในระบบ
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6F64]" size={17} />
                    <input
                      className="h-11 w-full rounded-xl border border-[#DCE3D7] bg-white pl-10 pr-4 text-sm font-semibold text-[#1C342B] outline-none transition focus:border-[#2F7D5B] focus:ring-4 focus:ring-[#2F7D5B]/15 placeholder:text-slate-400"
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="เช่น ครูสมชาย ใจดี"
                      value={displayName}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1C342B] mb-1">
                  อีเมล (Email)
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6F64]" size={17} />
                  <input
                    autoComplete="email"
                    className="h-11 w-full rounded-xl border border-[#DCE3D7] bg-white pl-10 pr-4 text-sm font-semibold text-[#1C342B] outline-none transition focus:border-[#2F7D5B] focus:ring-4 focus:ring-[#2F7D5B]/15 placeholder:text-slate-400"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#1C342B]">
                      รหัสผ่าน (Password)
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-[11px] font-bold text-[#2F7D5B] hover:underline"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5A6F64]" size={17} />
                    <input
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="h-11 w-full rounded-xl border border-[#DCE3D7] bg-white pl-10 pr-11 text-sm font-semibold text-[#1C342B] outline-none transition focus:border-[#2F7D5B] focus:ring-4 focus:ring-[#2F7D5B]/15 placeholder:text-slate-400"
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#5A6F64] hover:text-[#1C342B] rounded-lg transition"
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
                className="w-full inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1C342B] to-[#2F7D5B] hover:from-[#2F7D5B] hover:to-[#1C342B] text-white text-sm font-black shadow-lg shadow-[#1C342B]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-1 sm:mt-2"
              >
                <span>{isSubmitting ? 'กำลังดำเนินการ...' : currentCopy.button}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-3.5 sm:my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#DCE3D7]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#FAFBF8] px-3 text-[#5A6F64] font-semibold">หรือดำเนินการด้วย</span>
              </div>
            </div>

            {/* Official Google OAuth Button */}
            <button
              type="button"
              disabled={isGoogleSubmitting || isSubmitting}
              onClick={() => void handleGoogleLogin()}
              className="w-full inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-[#DCE3D7] bg-white hover:bg-[#F6F7F3] text-[#1C342B] text-xs font-bold shadow-xs hover:shadow-md transition active:scale-[0.99] disabled:opacity-60"
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
          <div className="mt-5 pt-3.5 sm:mt-6 sm:pt-4 border-t border-[#DCE3D7] text-center space-y-2.5 sm:space-y-3">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50/80 border border-amber-200/80 text-xs font-bold text-[#9A5E14] hover:bg-amber-100/70 transition shadow-xs"
            >
              <Crown size={13} className="text-[#D98B26]" />
              <span>ดูแพ็กเกจและสิทธิพิเศษ ClassCare 360 VIP</span>
              <ArrowRight size={11} />
            </Link>

            <p className="text-[11px] font-semibold text-[#5A6F64]">
              {appEnv.appName} • ดูแลทั้งห้อง ครบจบในระบบเดียว
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MOBILE-ONLY COLLAPSIBLE: Feature Highlights & Trust Badges */}
        {/* ======================================================== */}
        <div className="lg:hidden w-full max-w-md mx-auto flex flex-col items-center pb-2">
          <button
            type="button"
            onClick={() => setShowMobileFeatures((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-[#E9F0EA] hover:text-white hover:bg-white/15 transition backdrop-blur-md shadow-xs active:scale-95"
          >
            <Sparkles size={13} className="text-[#F5B95D]" />
            <span>{showMobileFeatures ? 'ซ่อนจุดเด่นระบบ' : 'ดูจุดเด่นและบริการใน ClassCare 360'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showMobileFeatures ? 'rotate-180' : ''}`} />
          </button>

          {showMobileFeatures && (
            <div className="mt-3.5 w-full rounded-3xl border border-white/10 bg-gradient-to-br from-[#1C342B] via-[#182D25] to-[#13231C] p-5 shadow-xl text-left animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-[#F5B95D]" />
                <h3 className="text-sm font-black text-white">จุดเด่นระบบบริหารสถานศึกษา สพฐ.</h3>
              </div>

              <div className="grid gap-2.5">
                {featureHighlights.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${feat.color}`}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{feat.title}</h4>
                          <p className="text-[11px] text-[#C8D8CE]/85 mt-0.5">{feat.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3.5 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#C8D8CE]">
                {trustBadges.map((badge) => (
                  <div key={badge} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[#8CC6A7] shrink-0" />
                    <span>{badge}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </section>
    </main>
  );
}
