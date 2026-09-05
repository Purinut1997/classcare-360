import { Building2, ChevronDown, PanelLeftClose, ServerCog, X } from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';

import type { AppNavItem } from '../../routes/appRoutes';
import type { AppSessionContext } from '../../types/core';
import { AppLogo } from '../brand/AppLogo';

interface SidebarProps {
  activeView: string;
  isMobileOpen?: boolean;
  navItems: AppNavItem[];
  onClose?: () => void;
  session?: AppSessionContext;
}

const coreDirectItemKeys = [
  'overview',
  'students',
  'teacher-work',
  'scores',
  'savings',
  'behavior',
  'schedule',
  'reports',
];

const sidebarSections = [
  {
    key: 'daily-tools',
    label: 'เครื่องมือประจำห้อง',
    itemKeys: ['student-health', 'classroom-operations', 'randomizer', 'automation', 'daily-brief'],
  },
  {
    key: 'school-management',
    label: 'บริหารโรงเรียน & ระบบ',
    itemKeys: ['school-calendar', 'workspace-settings', 'academic-year', 'import-export', 'data-safety'],
  },
];

const utilityItemKeys = ['notifications', 'help-center', 'package'];

export function Sidebar({
  activeView,
  isMobileOpen = false,
  navItems,
  onClose,
  session,
}: SidebarProps) {
  const directItems = coreDirectItemKeys
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item): item is AppNavItem => Boolean(item));

  const renderedKeys = new Set<string>(directItems.map((item) => item.key));

  const secondarySections = sidebarSections
    .map((section) => {
      let keys = section.itemKeys;
      if (section.key === 'school-management' && session?.profile.role === 'superadmin') {
        keys = [...keys, 'setup', 'audit'];
      }
      const items = keys
        .map((key) => navItems.find((item) => item.key === key))
        .filter((item): item is AppNavItem => Boolean(item));
      items.forEach((item) => renderedKeys.add(item.key));
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  const utilityItems = utilityItemKeys
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item): item is AppNavItem => Boolean(item));
  utilityItems.forEach((item) => renderedKeys.add(item.key));

  // Mark alias/integrated keys as rendered so they don't leak to 'อื่น ๆ'
  renderedKeys.add('workspace-switch');
  renderedKeys.add('period-locks');
  renderedKeys.add('parent-access');
  renderedKeys.add('setup');
  renderedKeys.add('audit');

  const otherItems = navItems.filter(
    (item) => !renderedKeys.has(item.key) && item.key !== 'superadmin-dashboard',
  );

  const content = (
    <>
      <div className="app-sidebar-brand">
        <AppLogo className="h-10 w-10 rounded-xl bg-white/95 ring-1 ring-cyan-100/20" />
        <div className="min-w-0">
          <p className="truncate text-base font-black tracking-tight text-white">ClassCare 360</p>
          <p className="truncate text-[11px] font-bold text-cyan-100/75">ดูแลทั้งห้อง ครบจบในระบบเดียว</p>
        </div>
        <button
          className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="ปิดเมนู"
          onClick={onClose}
          type="button"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      {/* 🏫 Top Workspace Selector Card */}
      {session?.workspace ? (
        <div className="px-3 pb-1 pt-1">
          <Link
            className="flex items-center gap-2.5 rounded-2xl bg-white/[0.08] p-2.5 text-left ring-1 ring-white/15 transition hover:bg-white/15 group"
            onClick={onClose}
            to="/app/select-workspace"
            title="คลิกเพื่อสลับโรงเรียน / Workspace"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500/30">
              <Building2 size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white group-hover:text-cyan-200">
                {session.workspace.schoolName || session.workspace.name}
              </p>
              <p className="truncate text-[10px] font-bold text-slate-300">
                ปี {session.workspace.academicYear || 'ปัจจุบัน'} · สลับ Workspace ▾
              </p>
            </div>
          </Link>
        </div>
      ) : null}

      <nav className="app-sidebar-nav" aria-label="เมนูหลัก">
        {/* Core Direct 1-Click Teacher Items */}
        <div className="grid gap-1">
          {directItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`app-sidebar-link ${item.key === activeView ? 'is-active' : ''}`}
                key={item.key}
                onClick={onClose}
                to={item.path}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Secondary Collapsible Groups */}
        {secondarySections.map((section) => {
          const hasActiveItem = section.items.some((item) => item.key === activeView);
          return (
            <details className="app-sidebar-section mt-2" key={section.key} open={hasActiveItem}>
              <summary>
                <span>{section.label}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="grid gap-1 py-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      className={`app-sidebar-link ${item.key === activeView ? 'is-active' : ''}`}
                      key={item.key}
                      onClick={onClose}
                      to={item.path}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}

        {otherItems.length > 0 ? (
          <details className="app-sidebar-section mt-2" open={otherItems.some((item) => item.key === activeView)}>
            <summary>
              <span>อื่น ๆ</span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="grid gap-1 py-1">
              {otherItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    className={`app-sidebar-link ${item.key === activeView ? 'is-active' : ''}`}
                    key={item.key}
                    onClick={onClose}
                    to={item.path}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}

        {/* 🔻 Footer Utilities (แจ้งเตือน / คู่มือใช้งาน / แพ็กเกจ) */}
        {utilityItems.length > 0 ? (
          <div className="mt-3 grid gap-1 border-t border-white/10 pt-2">
            {utilityItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className={`app-sidebar-link ${item.key === activeView ? 'is-active' : ''}`}
                  key={item.key}
                  onClick={onClose}
                  to={item.path}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  {item.key === 'notifications' && (
                    <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-rose-500" aria-label="แจ้งเตือนใหม่" />
                  )}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>

      {session?.profile.role === 'superadmin' ? (
        <Link
          className="app-admin-shortcut"
          onClick={onClose}
          to="/app/dashboard?view=superadmin-dashboard"
        >
          <ServerCog size={18} aria-hidden="true" />
          <span>
            <strong>Superadmin</strong>
            <small>ศูนย์ควบคุมระบบ</small>
          </span>
        </Link>
      ) : null}

      <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-bold text-slate-400">
        <span>Created by MIKPURINUT</span>
        <PanelLeftClose size={16} aria-hidden="true" />
      </div>
    </>
  );

  return (
    <>
      {/* 📱 Mobile Drawer Overlay Container */}
      <div
        className={`fixed inset-0 z-[100] lg:hidden ${
          isMobileOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-slate-950/60 transition-opacity duration-300 ${
            isMobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />
        
        {/* Mobile Sidebar Panel */}
        <aside
          className={`app-sidebar absolute inset-y-0 left-0 w-[280px] shadow-2xl transition-transform duration-300 ease-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {content}
        </aside>
      </div>

      {/* 💻 Desktop Static Sidebar */}
      <aside className="app-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[236px]">
        {content}
      </aside>
    </>
  );
}
