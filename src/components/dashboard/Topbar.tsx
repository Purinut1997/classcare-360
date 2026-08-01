import { Bell, Building2, Menu, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';

import { roleLabels } from '../../lib/roles';
import type { AppSessionContext } from '../../types/core';
import { SignOutButton } from '../auth/SignOutButton';
import { GlobalSearch } from './GlobalSearch';
import type { AppNavItem } from '../../routes/appRoutes';

interface TopbarProps {
  activeLabel: string;
  navItems: AppNavItem[];
  onMenuToggle: () => void;
  onThemeToggle: () => void;
  session?: AppSessionContext;
  theme: 'light' | 'nexus';
}

function getInitials(displayName?: string) {
  const words = (displayName || 'ผู้ใช้').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function Topbar({ activeLabel, navItems, onMenuToggle, onThemeToggle, session, theme }: TopbarProps) {
  const workspace = session?.workspace;

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

      <Link
        className="app-workspace-switcher"
        to="/app/select-workspace"
        title={workspace ? `${workspace.schoolName} · ${workspace.classroomName}` : 'เลือก workspace'}
      >
        <span className="app-workspace-icon">
          <Building2 size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-black text-slate-900">
            {workspace?.schoolName || session?.profile.schoolName || 'ClassCare 360'}
          </span>
          <span className="block truncate text-[11px] font-bold text-slate-500">
            {workspace ? `${workspace.classroomName} · ${workspace.academicYear}` : 'เลือกพื้นที่ทำงาน'}
          </span>
        </span>
      </Link>

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm font-black text-slate-800">{activeLabel}</p>
        <p className="truncate text-[11px] font-bold text-slate-500">พื้นที่ทำงานปัจจุบัน</p>
      </div>

      <GlobalSearch navItems={navItems} session={session} />

      <button
        aria-label={theme === 'nexus' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
        className="app-icon-button"
        onClick={onThemeToggle}
        title={theme === 'nexus' ? 'โหมดสว่าง' : 'โหมดมืด Obsidian Lime'}
        type="button"
      >
        {theme === 'nexus' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      </button>

      <Link className="app-icon-button relative" aria-label="เปิดการแจ้งเตือน" to="/app/dashboard?view=notifications">
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
