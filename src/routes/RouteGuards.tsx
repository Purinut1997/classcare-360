import type { ReactNode } from 'react';
import { Building2, LogIn, ShieldAlert, Sparkles, UserCog } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { SignOutButton } from '../components/auth/SignOutButton';
import {
  demoModeOptions,
  getDemoModeSearch,
  type DemoSessionMode,
} from '../lib/auth';
import { canUseModule } from '../lib/entitlements';
import { roleLabels } from '../lib/roles';
import type { AppSessionContext, ModuleKey, WorkspaceRole } from '../types/core';

type RouteGuardReason =
  | 'signed-out'
  | 'account-blocked'
  | 'workspace-required'
  | 'role-denied'
  | 'module-denied';

interface RouteGuardConfig {
  allowedRoles?: WorkspaceRole[];
  moduleKey?: ModuleKey;
  requireWorkspace?: boolean;
  session: AppSessionContext | null;
}

interface RouteGuardResult {
  detail: string;
  passed: boolean;
  reason?: RouteGuardReason;
  title: string;
}

interface RequireRouteAccessProps extends RouteGuardConfig {
  children: ReactNode;
  featureName: string;
}

const blockedAccountStatuses = ['suspended', 'cancelled'] as const;

function evaluateRouteAccess({
  allowedRoles,
  moduleKey,
  requireWorkspace = true,
  session,
}: RouteGuardConfig): RouteGuardResult {
  if (!session) {
    return {
      passed: false,
      reason: 'signed-out',
      title: 'ต้องเข้าสู่ระบบก่อน',
      detail: 'หน้านี้ต้องมี Supabase session ที่ยืนยันตัวตนแล้ว ก่อนอ่านข้อมูล workspace',
    };
  }

  if (blockedAccountStatuses.includes(session.profile.accountStatus as (typeof blockedAccountStatuses)[number])) {
    return {
      passed: false,
      reason: 'account-blocked',
      title: 'บัญชีนี้ถูกจำกัดการใช้งาน',
      detail: 'ผู้ใช้สถานะ suspended หรือ cancelled ต้องหยุดที่ guard และติดต่อผู้ดูแลระบบ',
    };
  }

  if (allowedRoles && !allowedRoles.includes(session.profile.role)) {
    return {
      passed: false,
      reason: 'role-denied',
      title: 'สิทธิ์ผู้ใช้ไม่ตรงกับหน้านี้',
      detail: `บทบาทปัจจุบันคือ ${roleLabels[session.profile.role]} แต่หน้านี้เปิดให้เฉพาะบทบาทที่กำหนด`,
    };
  }

  if (requireWorkspace && !session.workspace?.id) {
    return {
      passed: false,
      reason: 'workspace-required',
      title: 'ต้องเลือกหรือสร้าง workspace ก่อน',
      detail: 'ทุกโมดูลหลักต้องผูก workspace_id เพื่อกันข้อมูลข้ามห้องเรียนและข้ามโรงเรียน',
    };
  }

  if (moduleKey && !canUseModule(session.subscription, moduleKey)) {
    return {
      passed: false,
      reason: 'module-denied',
      title: 'สิทธิ์ระบบยังไม่พร้อมสำหรับโมดูลนี้',
      detail: 'ตรวจ workspace, บทบาทผู้ใช้ และสถานะระบบให้พร้อมก่อนเปิดโมดูลหลักในห้องเรียนจริง',
    };
  }

  return {
    passed: true,
    title: 'ผ่านการตรวจสิทธิ์',
    detail: 'route นี้มี session, workspace, role และ entitlement ครบตามเงื่อนไข',
  };
}

function getReasonIcon(reason?: RouteGuardReason) {
  if (reason === 'signed-out') return LogIn;
  if (reason === 'workspace-required') return Building2;
  if (reason === 'module-denied') return Sparkles;
  if (reason === 'role-denied') return UserCog;
  return ShieldAlert;
}

function getPrimaryAction(reason?: RouteGuardReason, currentSearch = '') {
  if (reason === 'signed-out') return { label: 'ไปหน้าเข้าสู่ระบบ', to: `/login${currentSearch}` };
  if (reason === 'workspace-required') return { label: 'เลือก workspace', to: `/app/select-workspace${currentSearch}` };
  if (reason === 'module-denied') return { label: 'ตรวจระบบ', to: '/app/dashboard?view=setup' };
  return { label: 'กลับแดชบอร์ด', to: `/app/dashboard${currentSearch}` };
}

function getModeLink(pathname: string, search: string, mode: DemoSessionMode) {
  return `${pathname}${getDemoModeSearch(search, mode)}`;
}

export function RouteGuardNotice({
  featureName,
  result,
}: {
  featureName: string;
  result: RouteGuardResult;
}) {
  const location = useLocation();
  const Icon = getReasonIcon(result.reason);
  const primaryAction = getPrimaryAction(result.reason, location.search);

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="glass-panel mx-auto max-w-5xl overflow-hidden rounded-[2rem]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="p-6 sm:p-8">
            <div className="inline-flex h-11 items-center gap-2 rounded-full bg-amber-50 px-4 text-sm font-black text-amber-700 ring-1 ring-amber-100">
              <Icon size={18} aria-hidden="true" />
              Route Guard
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl">
              {result.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-600">
              {featureName}: {result.detail}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                className="blue-action inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-black"
                to={primaryAction.to}
              >
                {primaryAction.label}
              </Link>
              {result.reason !== 'signed-out' ? <SignOutButton className="h-12" /> : null}
              <Link
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                to="/app/dashboard?view=setup"
              >
                ตั้งค่าระบบ
              </Link>
            </div>
          </div>

          <aside className="relative overflow-hidden border-t border-slate-100 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:34px_34px]" />
            <p className="relative text-sm font-black text-cyan-200">ทดสอบสถานะ demo</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {demoModeOptions.map((option) => (
                <Link
                  className="relative rounded-2xl bg-white/10 px-3 py-2 text-center text-xs font-black text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/20"
                  key={option.mode}
                  to={getModeLink(location.pathname, location.search, option.mode)}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <p className="relative mt-5 rounded-3xl bg-cyan-300/10 p-3 text-xs font-bold leading-6 text-cyan-50">
              Guard ฝั่ง frontend ใช้เพื่อ UX เท่านั้น ส่วนข้อมูลจริงยังต้องถูกบังคับซ้ำด้วย Supabase RLS และ Edge Functions
            </p>
          </aside>
        </div>
      </section>

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}

export function RequireRouteAccess({
  allowedRoles,
  children,
  featureName,
  moduleKey,
  requireWorkspace,
  session,
}: RequireRouteAccessProps) {
  const result = evaluateRouteAccess({
    allowedRoles,
    moduleKey,
    requireWorkspace,
    session,
  });

  if (!result.passed) {
    return <RouteGuardNotice featureName={featureName} result={result} />;
  }

  return children;
}
