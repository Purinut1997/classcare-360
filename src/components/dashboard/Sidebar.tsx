import { ChevronDown, PanelLeftClose, ServerCog, X } from 'lucide-react';
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
    label: 'เครื่องมือเสริมในห้อง',
    itemKeys: ['student-health', 'classroom-operations', 'randomizer', 'parent-access', 'automation', 'daily-brief'],
  },
  {
    key: 'school-management',
    label: 'บริหารโรงเรียน & ตั้งค่า',
    itemKeys: ['school-calendar', 'workspace-settings', 'period-locks', 'academic-year', 'import-export', 'data-safety', 'workspace-switch', 'help-center', 'setup', 'audit', 'notifications'],
  },
];

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
      const items = section.itemKeys
        .map((key) => navItems.find((item) => item.key === key))
        .filter((item): item is AppNavItem => Boolean(item));
      items.forEach((item) => renderedKeys.add(item.key));
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  const otherItems = navItems.filter(
    (item) => !renderedKeys.has(item.key) && item.key !== 'superadmin-dashboard',
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/60 lg:hidden ${
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ transition: 'opacity 0.28s cubic-bezier(0.4,0,0.2,1)' }}
        aria-hidden="true"
        onClick={onClose}
        role="presentation"
      />
      <aside className={`app-sidebar ${isMobileOpen ? 'is-open' : ''}`}>
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
      </aside>
    </>
  );
}
