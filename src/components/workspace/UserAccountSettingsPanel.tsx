import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Phone,
  Save,
  School,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { isDemoSession } from '../../lib/auth';
import { getEffectivePlanCode, planLabels, planLimits } from '../../lib/entitlements';
import { canManageWorkspace, roleLabels } from '../../lib/roles';
import { requestAppSessionRefresh } from '../../lib/session';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface UserAccountSettingsPanelProps {
  activeClassroomsCount: number;
  activeStudentCount: number;
  collaboratorCount: number;
  session: AppSessionContext;
}

export function UserAccountSettingsPanel({
  activeClassroomsCount,
  activeStudentCount,
  collaboratorCount,
  session,
}: UserAccountSettingsPanelProps) {
  const demoMode = isDemoSession(session);
  const canManage = canManageWorkspace(session.profile.role);
  const canSwitchWorkspace = session.profile.role === 'superadmin' || (session.workspaceCount ?? 0) > 1;

  // Profile form state
  const [displayName, setDisplayName] = useState(session.profile.displayName || '');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState(session.profile.schoolName || session.workspace?.schoolName || '');
  const [profileMetadata, setProfileMetadata] = useState<Record<string, unknown>>({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(Boolean(supabase && !demoMode));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!supabase || demoMode) {
        setIsLoadingProfile(false);
        return;
      }

      setIsLoadingProfile(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,display_name,phone,metadata')
        .eq('id', session.profile.id)
        .maybeSingle();

      if (!isMounted) return;

      if (!error && data) {
        const meta = (data.metadata as Record<string, unknown> | null) || {};
        setDisplayName(String(data.display_name || session.profile.displayName || ''));
        setPhone(String(data.phone || ''));
        setSchoolName(String(meta.school_name || session.profile.schoolName || session.workspace?.schoolName || ''));
        setProfileMetadata(meta);
      }
      setIsLoadingProfile(false);
    }

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [demoMode, session.profile.displayName, session.profile.id, session.profile.schoolName, session.workspace?.schoolName]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileNotice(null);

    const trimmedName = displayName.trim();
    const trimmedPhone = phone.trim();
    const trimmedSchool = schoolName.trim();

    if (!trimmedName) {
      setProfileNotice({ tone: 'error', text: 'กรุณากรอกชื่อที่แสดงในระบบ' });
      return;
    }

    if (!supabase || demoMode) {
      setProfileNotice({ tone: 'success', text: 'บันทึกข้อมูลส่วนตัวในโหมดตัวอย่างเรียบร้อยแล้ว' });
      return;
    }

    setIsSavingProfile(true);
    const nextMeta = {
      ...profileMetadata,
      school_name: trimmedSchool || null,
    };

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: trimmedName,
        phone: trimmedPhone || null,
        metadata: nextMeta,
      })
      .eq('id', session.profile.id);

    setIsSavingProfile(false);

    if (error) {
      setProfileNotice({ tone: 'error', text: `บันทึกข้อมูลส่วนตัวไม่สำเร็จ: ${error.message}` });
      return;
    }

    setProfileMetadata(nextMeta);
    setProfileNotice({ tone: 'success', text: '✓ บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว' });
    requestAppSessionRefresh();
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice(null);

    if (newPassword.length < 8) {
      setPasswordNotice({ tone: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ tone: 'error', text: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน' });
      return;
    }

    if (!supabase || demoMode) {
      setPasswordNotice({ tone: 'success', text: 'เปลี่ยนรหัสผ่านในโหมดตัวอย่างเรียบร้อยแล้ว' });
      setNewPassword('');
      setConfirmPassword('');
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdatingPassword(false);

    if (error) {
      setPasswordNotice({ tone: 'error', text: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}` });
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordNotice({ tone: 'success', text: '✓ เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว สามารถใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไปได้ทันที' });
  }

  const effectivePlanCode = getEffectivePlanCode(session.subscription);
  const workspaceLimits = planLimits[effectivePlanCode];

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-12 xl:items-start">
      {/* Left: Personal Profile Form */}
      <form
        className="nexus-card p-5 sm:p-6 xl:col-span-7"
        onSubmit={(event) => void handleSaveProfile(event)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
              <UserRound size={13} aria-hidden="true" />
              ข้อมูลบัญชีส่วนตัว
            </span>
            <h2 className="mt-2.5 text-xl font-black text-slate-950">ตั้งค่าโปรไฟล์ผู้ใช้งาน</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              ชื่อที่แสดงจะปรากฏที่แถบด้านบน บันทึกการทำงาน และรายชื่อสมาชิกในโรงเรียน
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
            {roleLabels[session.profile.role]}
          </span>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-xs font-black text-slate-700">
            อีเมลเข้าสู่ระบบ
            <span className="relative">
              <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="nexus-field h-11 w-full bg-slate-50 pl-9 pr-3 text-sm font-bold text-slate-500"
                disabled
                readOnly
                value={session.profile.email || '-'}
              />
            </span>
          </label>

          <label className="grid gap-1.5 text-xs font-black text-slate-700">
            ชื่อ-นามสกุล หรือชื่อที่แสดงในระบบ
            <span className="relative">
              <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="nexus-field h-11 w-full pl-9 pr-3 text-sm font-bold"
                disabled={isLoadingProfile}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="เช่น คุณครูสมชาย ใจดี"
                required
                value={displayName}
              />
            </span>
          </label>

          <div className={canManage ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'}>
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              เบอร์โทรศัพท์ติดต่อ
              <span className="relative">
                <Phone size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="nexus-field h-11 w-full pl-9 pr-3 text-sm font-bold"
                  disabled={isLoadingProfile}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08x-xxx-xxxx"
                  type="tel"
                  value={phone}
                />
              </span>
            </label>

            {!canManage ? (
              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                โรงเรียนต้นสังกัด (โปรไฟล์)
                <span className="relative">
                  <School size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="nexus-field h-11 w-full pl-9 pr-3 text-sm font-bold"
                    disabled={isLoadingProfile}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="ชื่อโรงเรียน"
                    value={schoolName}
                  />
                </span>
              </label>
            ) : null}
          </div>
        </div>

        {profileNotice ? (
          <div
            className={`mt-4 flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-black ${
              profileNotice.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {profileNotice.tone === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>{profileNotice.text}</span>
          </div>
        ) : null}

        <button
          className="blue-action mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:opacity-50 sm:w-auto sm:px-6"
          disabled={isLoadingProfile || isSavingProfile}
          type="submit"
        >
          <Save size={16} aria-hidden="true" />
          {isSavingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
        </button>
      </form>

      {/* Right: Password + Workspace/Package Summary */}
      <div className="grid gap-5 xl:col-span-5">
        {/* Password Change Card */}
        <form className="nexus-card p-5 sm:p-6" onSubmit={(event) => void handleChangePassword(event)}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
              <KeyRound size={13} aria-hidden="true" />
              ความปลอดภัยบัญชี
            </span>
            <button
              type="button"
              onClick={() => setShowPasswords((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-slate-800"
            >
              {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPasswords ? 'ซ่อนรหัส' : 'แสดงรหัส'}
            </button>
          </div>

          <h2 className="mt-2.5 text-lg font-black text-slate-950">เปลี่ยนรหัสผ่าน</h2>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            ตั้งรหัสผ่านใหม่ความยาวอย่างน้อย 6 ตัวอักษรเพื่อความปลอดภัยของข้อมูลนักเรียน
          </p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              รหัสผ่านใหม่
              <input
                autoComplete="new-password"
                className="nexus-field h-10 px-3 text-sm font-bold"
                minLength={6}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                required
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black text-slate-700">
              ยืนยันรหัสผ่านใหม่
              <input
                autoComplete="new-password"
                className="nexus-field h-10 px-3 text-sm font-bold"
                minLength={6}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                required
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
              />
            </label>
          </div>

          {passwordNotice ? (
            <div
              className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                passwordNotice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {passwordNotice.tone === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
              <span>{passwordNotice.text}</span>
            </div>
          ) : null}

          <button
            className="dark-action mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-black disabled:opacity-50"
            disabled={isUpdatingPassword || !newPassword || !confirmPassword}
            type="submit"
          >
            <ShieldCheck size={15} aria-hidden="true" />
            {isUpdatingPassword ? 'กำลังอัปเดตรหัสผ่าน...' : 'อัปเดตรหัสผ่านใหม่'}
          </button>
        </form>

        {/* Workspace & Package Quota Compact Card */}
        <section className="nexus-card p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-cyan-700">พื้นที่ทำงาน & แพ็กเกจ</p>
              <h3 className="mt-0.5 text-base font-black text-slate-950">{planLabels[effectivePlanCode]}</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
              {session.workspace?.schoolName || 'ยังไม่เลือกโรงเรียน'}
            </span>
          </div>

          <div className="mt-3.5 grid gap-2.5">
            {[
              { label: 'ห้องเรียน', used: activeClassroomsCount, limit: workspaceLimits.activeClassrooms },
              { label: 'นักเรียนกำลังเรียน', used: activeStudentCount, limit: workspaceLimits.activeStudents },
              { label: 'ผู้ร่วมงาน + คำเชิญ', used: collaboratorCount, limit: workspaceLimits.collaborators },
            ].map((quota) => {
              const ratio = Math.min((quota.used / Math.max(quota.limit, 1)) * 100, 100);
              return (
                <div key={quota.label} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-500">{quota.label}</span>
                    <span className="font-black text-slate-900">
                      {quota.used} / {quota.limit}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${ratio >= 100 ? 'bg-rose-500' : 'bg-emerald-600'}`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {(canSwitchWorkspace || canManage) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {canSwitchWorkspace ? (
                <Link
                  to="/app/select-workspace"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <Building2 size={14} aria-hidden="true" />
                  สลับโรงเรียน / ห้อง
                </Link>
              ) : null}
              {canManage ? (
                <Link
                  to="/app/package"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-100 px-3 text-xs font-black text-amber-950 hover:bg-amber-200"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  จัดการแพ็กเกจ
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
