import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import { getPostAuthRouteForSession } from '../../lib/auth';
import { appEnv } from '../../lib/env';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

type AuthMode = 'login' | 'register' | 'forgot';

const modeCopy: Record<AuthMode, { button: string; eyebrow: string; title: string }> = {
  login: {
    button: 'เข้าสู่ระบบ',
    eyebrow: 'Secure Login',
    title: 'เข้าสู่ระบบ ClassCare 360',
  },
  register: {
    button: 'สมัครบัญชี',
    eyebrow: 'Create Account',
    title: 'เริ่มใช้งาน ClassCare 360',
  },
  forgot: {
    button: 'ส่งลิงก์รีเซ็ตรหัสผ่าน',
    eyebrow: 'Password Reset',
    title: 'กู้คืนรหัสผ่าน',
  },
};

const authModes: Array<{ icon: typeof LockKeyhole; label: string; mode: AuthMode }> = [
  { icon: LockKeyhole, label: 'Login', mode: 'login' },
  { icon: UserPlus, label: 'Register', mode: 'register' },
  { icon: KeyRound, label: 'Forgot', mode: 'forgot' },
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
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'ยังไม่ได้ตั้งค่า .env.local จึงแสดงเป็นโหมดตัวอย่างก่อน',
  );

  const currentCopy = modeCopy[mode];
  const canSubmitPassword = mode === 'forgot' || password.length >= 8;
  const primaryDisabled = isSubmitting || !email || !canSubmitPassword;

  const nextSearch = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('mode');
    next.delete('redirect');
    const value = next.toString();
    return value ? `?${value}` : '';
  }, [searchParams]);

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

    const redirectTo = `${window.location.origin}/auth/complete-profile`;
    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : mode === 'register'
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: displayName || email.split('@')[0] },
                emailRedirectTo: redirectTo,
              },
            })
          : await supabase.auth.resetPasswordForEmail(email, {
              redirectTo,
            });

    if (result.error) {
      setNotice(result.error.message);
    } else {
      setNotice(
        mode === 'login'
          ? 'เข้าสู่ระบบสำเร็จ กำลังรอ redirect ตาม workspace และสิทธิ์'
          : mode === 'register'
            ? 'สมัครสำเร็จ โปรดตรวจอีเมลเพื่อยืนยันบัญชี'
            : 'ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว',
      );

      if (mode === 'login') {
        setNotice('เข้าสู่ระบบสำเร็จ กำลังตรวจสิทธิ์และส่งต่อไปหน้าที่เหมาะสม');
      }
    }

    setIsSubmitting(false);
  }

  async function handleGoogleLogin() {
    setNotice(null);

    if (!supabase) {
      setNotice('โหมดตัวอย่าง: Google Login จะทำงานหลังตั้งค่า Supabase Auth และ OAuth');
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/complete-profile`,
        scopes: 'openid email profile',
      },
    });

    if (error) setNotice(error.message);
  }

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-7 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="relative flex min-h-[620px] flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-900/80 bg-slate-950 p-6 text-white shadow-[0_30px_80px_rgba(2,6,23,0.25)] sm:p-8">
          <div className="pulse-glow absolute right-16 top-16 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_28px_10px_rgba(103,232,249,0.35)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:34px_34px]" />
          <div>
            <div className="relative flex flex-wrap items-center gap-3">
              <AppLogo className="h-12 w-12 rounded-2xl bg-white ring-1 ring-white/15" />
              <Link
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-black text-cyan-50 ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/15"
                to="/"
              >
                <ArrowLeft size={17} aria-hidden="true" />
                หน้าแรก
              </Link>
              <div className="inline-flex h-11 items-center gap-2 rounded-full bg-cyan-300/15 px-4 text-sm font-black text-cyan-100 ring-1 ring-cyan-200/20">
                <ShieldCheck size={18} aria-hidden="true" />
                {currentCopy.eyebrow}
              </div>
            </div>
            <h1 className="relative mt-6 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              {currentCopy.title}
            </h1>
            <p className="relative mt-4 max-w-2xl text-base font-bold leading-8 text-slate-300">
              ดูแลทั้งห้อง ครบจบในระบบเดียว
            </p>
          </div>

          <div className="relative mt-10 grid gap-3 sm:grid-cols-3">
            {[
              'Supabase Auth',
              'Workspace RLS',
              'Created by MIKPURINUT',
            ].map((item) => (
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-[0_16px_34px_rgba(8,47,73,0.16)] backdrop-blur-xl" key={item}>
                <CheckCircle2 className="text-cyan-200" size={20} aria-hidden="true" />
                <p className="mt-3 text-sm font-black text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
          <div className="mb-4 flex justify-end">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 hover:shadow-md"
              to="/"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              กลับหน้าแรก
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/60 p-1.5 shadow-inner ring-1 ring-slate-200/70">
            {authModes.map((item) => {
              const Icon = item.icon;
              const isActive = mode === item.mode;

              return (
                <button
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black transition ${
                    isActive ? 'blue-action' : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  }`}
                  key={item.mode}
                  onClick={() => switchMode(item.mode)}
                  type="button"
                >
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อที่แสดงในระบบ
                <input
                  className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="ครูประจำชั้น"
                  value={displayName}
                />
              </label>
            ) : null}

            <label className="grid gap-2 text-sm font-black text-slate-700">
              อีเมล
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  autoComplete="email"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-4 text-base font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teacher@school.ac.th"
                  type="email"
                  value={email}
                />
              </span>
            </label>

            {mode !== 'forgot' ? (
              <label className="grid gap-2 text-sm font-black text-slate-700">
                รหัสผ่าน
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-12 text-base font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </span>
              </label>
            ) : null}

            <button
              className="blue-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={primaryDisabled}
              type="submit"
            >
              {isSubmitting ? 'กำลังดำเนินการ' : currentCopy.button}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>

          <button
            className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            onClick={handleGoogleLogin}
            type="button"
          >
            เข้าสู่ระบบด้วย Google
          </button>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
              {notice}
            </div>
          ) : null}

          <div className="mt-5 grid gap-2 rounded-3xl bg-white/70 p-4 text-sm font-black text-slate-600 ring-1 ring-slate-200/70">
            <Link className="text-sky-700 hover:text-sky-900" to={`/auth/complete-profile${nextSearch}`}>
              ไปหน้า Complete Profile
            </Link>
            <Link className="text-sky-700 hover:text-sky-900" to={`/app/select-workspace${nextSearch}`}>
              เลือกหรือสร้าง workspace
            </Link>
            <Link className="text-violet-700 hover:text-violet-900" to="/pricing">
              ดูแพ็กเกจ ClassCare 360 VIP
            </Link>
          </div>

          <p className="mt-5 text-center text-xs font-bold text-slate-500">
            {appEnv.appName} | Created by MIKPURINUT
          </p>
        </div>
      </section>
    </main>
  );
}
