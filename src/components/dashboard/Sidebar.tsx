import { ChevronDown, PanelLeftClose, ServerCog, X } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const sidebarSections = [
  { key: 'overview', label: 'ภาพรวม', itemKeys: ['overview'] },
  { key: 'students', label: 'นักเรียน', itemKeys: ['students'] },
  {
    key: 'teaching',
    label: 'การสอน',
    itemKeys: ['teacher-work', 'schedule', 'scores', 'savings', 'randomizer'],
  },
  { key: 'care', label: 'ดูแลนักเรียน', itemKeys: ['behavior', 'notifications'] },
  { key: 'reports', label: 'รายงาน', itemKeys: ['reports', 'school-calendar'] },
  {
    key: 'school',
    label: 'จัดการโรงเรียน',
    itemKeys: ['import-export', 'data-safety', 'workspace-settings', 'workspace-switch'],
  },
  {
    key: 'system',
    label: 'ระบบ',
    itemKeys: ['help-center', 'setup', 'audit', 'superadmin-dashboard'],
  },
];

export function Sidebar({
  activeView,
  isMobileOpen = false,
  navItems,
  onClose,
  session,
}: SidebarProps) {
  const renderedKeys = new Set<string>();
  const sections = sidebarSections
    .map((section) => {
      const items = section.itemKeys
        .map((key) => navItems.find((item) => item.key === key))
        .filter((item): item is AppNavItem => Boolean(item));
      items.forEach((item) => renderedKeys.add(item.key));
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
  const uncategorizedItems = navItems.filter((item) => !renderedKeys.has(item.key));

  return (
    <>
      <button
        className={`fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition lg:hidden ${
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-label="ปิดเมนู"
        onClick={onClose}
        type="button"
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
          {[...sections, ...(uncategorizedItems.length ? [{ key: 'other', label: 'อื่น ๆ', items: uncategorizedItems }] : [])].map(
            (section) => {
              const hasActiveItem = section.items.some((item) => item.key === activeView);
              const isSingle = section.items.length === 1;

              if (isSingle) {
                const item = section.items[0];
                const Icon = item.icon;
                return (
                  <Link
                    className={`app-sidebar-link ${item.key === activeView ? 'is-active' : ''}`}
                    key={section.key}
                    onClick={onClose}
                    to={item.path}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{section.label}</span>
                  </Link>
                );
              }

              return (
                <details className="app-sidebar-section" key={section.key} open={hasActiveItem}>
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
            },
          )}
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
