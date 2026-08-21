import { type FormEvent, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import { supabase } from '../../lib/supabaseClient';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canSubmit = password.length >= 8 && password === confirmation && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !canSubmit) return;
    setSubmitting(true);
    setNotice(null);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setNotice(error.message);
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut({ scope: 'local' });
    navigate('/login?reset=success', { replace: true });
  }

  return (
    <main className="classcare-grid-bg grid min-h-screen place-items-center px-4 py-8 text-slate-950">
      <section className="glass-panel w-full max-w-xl rounded-[2rem] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.18)] sm:p-8">
        <div className="flex items-center gap-3">
          <AppLogo className="h-12 w-12 rounded-2xl bg-white" />
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 ring-1 ring-cyan-200">
            <ShieldCheck size={16} aria-hidden="true" />
            Secure Password Recovery
          </span>
        </div>
        <div className="mt-6">
          <KeyRound className="text-violet-700" size={32} aria-hidden="true" />
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-600">ลิงก์ในอีเมลได้ยืนยันตัวตนชั่วคราวแล้ว กรุณากำหนดรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร</p>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            รหัสผ่านใหม่
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
              <input autoComplete="new-password" className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-12 font-bold outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" minLength={8} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} value={password} />
              <button aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" onClick={() => setShowPassword((value) => !value)} type="button">
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </span>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-700">
            ยืนยันรหัสผ่านใหม่
            <input autoComplete="new-password" className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 font-bold outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100" minLength={8} onChange={(event) => setConfirmation(event.target.value)} type="password" value={confirmation} />
          </label>
          {confirmation && password !== confirmation ? <p className="text-sm font-bold text-rose-700">รหัสผ่านทั้งสองช่องไม่ตรงกัน</p> : null}
          {notice ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{notice}</div> : null}
          <button className="blue-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" disabled={!canSubmit} type="submit">
            <CheckCircle2 size={18} aria-hidden="true" />
            {submitting ? 'กำลังบันทึก' : 'บันทึกรหัสผ่านใหม่'}
          </button>
        </form>
      </section>
    </main>
  );
}
