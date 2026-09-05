import { Bell, BookOpen, Building2, Menu, Moon, Sun } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { withDemoContext } from '../../lib/auth';
import { roleLabels } from '../../lib/roles';
import type { AppSessionContext } from '../../types/core';
import { SignOutButton } from '../auth/SignOutButton';
import { GlobalSearch } from './GlobalSearch';
import type { AppNavItem } from '../../routes/appRoutes';

interface TopbarProps {
  activeLabel: string;
  navItems: AppNavItem[];
  onMenuToggle: () => void;
  onOpenGuide?: () => void;
  onThemeToggle: () => void;
  session?: AppSessionContext;
  theme: 'light' | 'nexus';
}

function getInitials(displayName?: string) {
  const words = (displayName || 'ผู้ใช้').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function Topbar({ activeLabel, navItems, onMenuToggle, onOpenGuide, onThemeToggle, session, theme }: TopbarProps) {
  const location = useLocation();
  const workspace = session?.workspace;
  const canSwitchWorkspace = session?.profile.role === 'superadmin' || (session?.workspaceCount ?? 0) > 1;
  const workspaceSummary = (
    <>
      <span className="app-workspace-icon">
        <Building2 size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black text-slate-900">
          {workspace?.schoolName || session?.profile.schoolName || 'ClassCare 360'}
        </span>
        <span className="block truncate text-[11px] font-bold text-slate-500">
          {workspace ? `${workspace.classroomName} · ${workspace.academicYear}` : 'พื้นที่ทำงานหลัก'}
        </span>
      </span>
    </>
  );

  return (
    <header className="app-topbar">
      <button
        className="app-icon-button lg:hidden"
        aria-label="เปิดเมนูหลัก"
        onClick={onMenuToggle}
        type="button"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {canSwitchWorkspace ? (
        <Link
          className="app-workspace-switcher"
          to={withDemoContext('/app/select-workspace', location.search)}
          title={workspace ? `${workspace.schoolName} · ${workspace.classroomName}` : 'เลือก Workspace'}
        >
          {workspaceSummary}
        </Link>
      ) : (
        <div
          className="app-workspace-switcher cursor-default"
          title={workspace ? `${workspace.schoolName} · ${workspace.classroomName}` : 'Workspace หลัก'}
        >
          {workspaceSummary}
        </div>
      )}

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm font-black text-slate-800">{activeLabel}</p>
        <p className="truncate text-[11px] font-bold text-slate-500">พื้นที่ทำงานปัจจุบัน</p>
      </div>

      <GlobalSearch navItems={navItems} session={session} />

      {onOpenGuide && (
        <button
          type="button"
          onClick={onOpenGuide}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-700 transition-all hover:bg-amber-500/20 hover:border-amber-500/50 hover:scale-[1.02] dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300"
          title="เปิดคู่มือแนะนำขั้นตอนการตั้งค่าระบบ (5 ขั้นตอน)"
        >
          <BookOpen size={15} className="text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">คู่มือเริ่มต้นระบบ</span>
        </button>
      )}

      <button
        aria-label={theme === 'nexus' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
        className="app-icon-button"
        onClick={onThemeToggle}
        title={theme === 'nexus' ? 'โหมดสว่าง' : 'โหมดมืด Obsidian Lime'}
        type="button"
      >
        {theme === 'nexus' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>

      <Link className="app-icon-button relative" aria-label="เปิดการแจ้งเตือน" to={withDemoContext('/app/dashboard?view=notifications', location.search)}>
        <Bell size={19} aria-hidden="true" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
      </Link>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-100 text-xs font-black text-cyan-800">
          {getInitials(session?.profile.displayName)}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block max-w-40 truncate text-xs font-black text-slate-900">
            {session?.profile.displayName || 'ผู้ใช้งาน'}
          </span>
          <span className="block max-w-40 truncate text-[10px] font-bold text-slate-500">
            {session ? roleLabels[session.profile.role] : 'ผู้ใช้งาน'}
          </span>
        </span>
      </div>

      <SignOutButton className="app-signout-button" />
    </header>
  );
}
