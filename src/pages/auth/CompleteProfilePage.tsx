import { type FormEvent, useState } from 'react';
import { ArrowRight, BadgeCheck, Building2, CheckCircle2, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { WorkspaceRole } from '../../types/core';

const roleOptions: Array<{ description: string; label: string; value: Exclude<WorkspaceRole, 'superadmin'> }> = [
  {
    description: 'เหมาะกับโรงเรียนหรือห้องเรียนที่ครูใช้งานคนเดียว ได้ทั้งเมนูครูและเมนูจัดการ workspace',
    label: 'ครูใช้งานคนเดียว + เจ้าของ workspace',
    value: 'teacher_owner',
  },
  {
    description: 'เหมาะกับครูที่ถูกเพิ่มเข้ามาใน workspace เดิม ใช้งานข้อมูลห้องเรียนได้แต่ไม่จัดการแพ็กเกจ',
    label: 'ครูร่วมใน workspace',
    value: 'teacher_member',
  },
  { description: 'เข้าใช้งานผ่าน Parent Portal เมื่อลูกถูกเชื่อมกับบัญชี', label: 'ผู้ปกครอง', value: 'parent' },
  { description: 'เข้าใช้งานผ่าน Student Portal เมื่อครูเชื่อมบัญชีนักเรียนแล้ว', label: 'นักเรียน', value: 'student' },
  { description: 'ดูรายงานได้ตามสิทธิ์ แต่ไม่แก้ไขข้อมูลห้องเรียน', label: 'ผู้ดูรายงาน', value: 'viewer' },
];

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('ครูประจำชั้น');
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'superadmin'>>('teacher_owner');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('โรงเรียนตัวอย่าง ClassCare');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: พร้อมต่อ profiles table หลังตั้งค่า Supabase',
  );
  const selectedRoleOption = roleOptions.find((option) => option.value === role);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!supabase) {
      setNotice('โหมดตัวอย่าง: บันทึกข้อมูลตัวอย่างแล้ว ขั้นต่อไปคือเลือกหรือสร้าง workspace');
      setIsSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setNotice(userError?.message || 'กรุณาเข้าสู่ระบบก่อนบันทึก profile');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email || '',
      display_name: displayName,
      phone: phone || null,
      account_status: 'registered',
      metadata: {
        preferred_role: role,
        school_name: schoolName,
      },
      last_login_at: new Date().toISOString(),
    });

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    setNotice('บันทึก profile สำเร็จ กำลังไปเลือกหรือสร้าง workspace');
    setIsSubmitting(false);
    navigate('/app/select-workspace');
  }

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-7 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="relative overflow-hidden rounded-[2rem] border border-slate-900/80 bg-slate-950 p-6 text-white shadow-[0_30px_80px_rgba(2,6,23,0.25)] sm:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:34px_34px]" />
          <div className="pulse-glow absolute right-12 top-16 h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_28px_10px_rgba(103,232,249,0.35)]" />
          <div className="relative inline-flex h-11 items-center gap-2 rounded-full bg-cyan-300/15 px-4 text-sm font-black text-cyan-100 ring-1 ring-cyan-200/20">
            <BadgeCheck size={18} aria-hidden="true" />
            Complete Profile
          </div>
          <h1 className="relative mt-6 text-4xl font-black leading-[1.08] tracking-tight">ตั้งค่าบัญชีผู้ใช้</h1>
          <div className="relative mt-8 grid gap-3">
            {[
              'เชื่อม profile กับ Supabase Auth user',
              'กำหนด role เริ่มต้นตาม workflow',
              'บันทึก audit log หลังสร้างบัญชี',
            ].map((item) => (
              <div className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-3 shadow-[0_16px_34px_rgba(8,47,73,0.16)] backdrop-blur-xl" key={item}>
                <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-200" size={18} aria-hidden="true" />
                <p className="text-sm font-bold leading-6 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </aside>

        <form className="glass-panel rounded-[2rem] p-5 sm:p-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ชื่อที่แสดงในระบบ
              <span className="relative block">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </span>
            </label>

            <label className="grid gap-2 text-sm font-black text-slate-700">
              บทบาทเริ่มต้น
              <select
                className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, 'superadmin'>)}
                value={role}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {selectedRoleOption ? (
                <span className="text-xs font-bold leading-5 text-slate-500">
                  {selectedRoleOption.description}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-black text-slate-700">
              เบอร์ติดต่อ
              <input
                className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="08x-xxx-xxxx"
                value={phone}
              />
            </label>

            <label className="grid gap-2 text-sm font-black text-slate-700">
              โรงเรียน
              <span className="relative block">
                <Building2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setSchoolName(event.target.value)}
                  placeholder="เช่น โรงเรียนตัวอย่าง ClassCare"
                  value={schoolName}
                />
              </span>
              <span className="text-xs font-bold leading-5 text-slate-500">
                ตัวอย่าง: โรงเรียนตัวอย่าง ClassCare ควรใช้ชื่อเดียวกันทุกครั้งเพื่อให้ระบบจับคู่ workspace ได้ถูกต้อง
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-3xl bg-gradient-to-r from-sky-50 to-cyan-50 p-4 ring-1 ring-sky-100">
            <div className="flex gap-3">
              {role === 'teacher_owner' ? (
                <ShieldCheck className="mt-0.5 shrink-0 text-sky-700" size={20} aria-hidden="true" />
              ) : (
                <GraduationCap className="mt-0.5 shrink-0 text-sky-700" size={20} aria-hidden="true" />
              )}
              <p className="text-sm font-bold leading-6 text-sky-900">
                {role === 'teacher_owner'
                  ? 'ถ้าครูใช้งานคนเดียว ให้เลือกบทบาทนี้ได้เลย หลังสร้าง workspace ระบบจะให้สิทธิ์เป็นทั้งครูผู้ใช้งานและเจ้าของ workspace ในบัญชีเดียว'
                  : 'ระบบจะใช้ข้อมูลนี้สร้าง profile และ membership เริ่มต้น โดยยังต้องบังคับ RLS ซ้ำในฐานข้อมูลจริง'}
              </p>
            </div>
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
              {notice}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="blue-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'กำลังบันทึก' : 'บันทึก profile'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <Link className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md" to="/app/select-workspace">
              ไปเลือก workspace
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
