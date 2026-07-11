import { ChevronRight, GraduationCap, ServerCog } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AppNavItem } from '../../routes/appRoutes';
import type { AppSessionContext } from '../../types/core';

interface SidebarProps {
  activeView: string;
  navItems: AppNavItem[];
  session?: AppSessionContext;
}

const sidebarSections = [
  { key: 'primary', label: 'ใช้งานประจำ', itemKeys: ['overview'] },
  {
    key: 'classroom',
    label: 'งานห้องเรียน',
    itemKeys: ['students', 'teacher-work', 'scores', 'savings', 'behavior', 'randomizer'],
  },
  { key: 'data', label: 'ข้อมูลและรายงาน', itemKeys: ['reports', 'import-export', 'notifications'] },
  { key: 'workspace', label: 'จัดการโรงเรียน', itemKeys: ['workspace-settings', 'workspace-switch'] },
  { key: 'system', label: 'ระบบผู้ดูแล', itemKeys: ['setup', 'audit', 'superadmin-dashboard'] },
];

export function Sidebar({ activeView, navItems, session }: SidebarProps) {
  const isSuperadmin = session?.profile.role === 'superadmin';
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
    <aside className="hidden overflow-y-auto border-r border-sky-200/60 bg-white/75 p-5 shadow-[18px_0_40px_rgba(14,165,233,0.08)] backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-950 p-3 text-white shadow-[0_20px_44px_rgba(2,6,23,0.22)]">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(56,189,248,0.45)]">
          <GraduationCap size={25} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight">ClassCare 360</p>
          <p className="truncate text-xs font-bold text-cyan-100">ดูแลทั้งห้อง ครบจบในระบบเดียว</p>
        </div>
      </div>

      <nav className="mt-7 grid gap-5" aria-label="เมนูหลัก">
        {[...sections, ...(uncategorizedItems.length ? [{ key: 'other', label: 'อื่น ๆ', items: uncategorizedItems }] : [])].map(
          (section) => (
            <div className="grid gap-1.5" key={section.key}>
              <p className="px-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeView;

                return (
                  <Link
                    className={`flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-black transition ${
                      isActive
                        ? 'blue-action'
                        : 'text-slate-600 hover:bg-white/90 hover:text-slate-950 hover:shadow-sm'
                    }`}
                    to={item.path}
                    key={item.label}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ),
        )}
      </nav>

      {isSuperadmin ? (
        <div className="mt-7 overflow-hidden rounded-3xl border border-cyan-200 bg-white/90 p-4 shadow-[0_20px_44px_rgba(14,165,233,0.12)]">
          <div className="flex items-center gap-2 text-cyan-700">
            <ServerCog size={18} aria-hidden="true" />
            <p className="font-black">Superadmin Tools</p>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            จัดการสิทธิ์ admin, workspace, ระบบตรวจสอบ และศูนย์ควบคุมหลักของแอป
          </p>
          <Link
            className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black"
            to="/app/dashboard?view=superadmin-dashboard"
          >
            เปิดศูนย์ผู้ดูแล
            <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="mt-auto rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs font-bold text-slate-500 shadow-sm">
        Created by MIKPURINUT
      </div>
    </aside>
  );
}
