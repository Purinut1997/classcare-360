import { ChevronRight, ServerCog } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { AppLogo } from '../brand/AppLogo';
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

const studentSubNavItems = [
  { label: 'รายชื่อและห้องเรียน', value: 'roster' },
  { label: 'Data Quality', value: 'quality' },
  { label: 'แบบเยี่ยมบ้าน กสศ.', value: 'home-visit' },
  { label: 'โปรไฟล์รายคน', value: 'profile' },
  { label: 'เคสดูแล', value: 'care' },
  { label: 'Portal และผู้ปกครอง', value: 'portal' },
  { label: 'ประวัติการทำงาน', value: 'timeline' },
];

export function Sidebar({ activeView, navItems, session }: SidebarProps) {
  const location = useLocation();
  const isSuperadmin = session?.profile.role === 'superadmin';
  const requestedStudentSubView = new URLSearchParams(location.search).get('studentView') || 'roster';
  const activeStudentSubView = studentSubNavItems.some((item) => item.value === requestedStudentSubView)
    ? requestedStudentSubView
    : 'roster';
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
        <AppLogo className="h-12 w-12 rounded-2xl bg-white shadow-[0_0_28px_rgba(255,255,255,0.22)]" />
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight">ClassCare 360</p>
          <p className="truncate text-xs font-bold text-cyan-100">ดูแลทั้งห้อง ครบจบในระบบเดียว</p>
        </div>
      </div>

      <nav className="mt-7 grid gap-3" aria-label="เมนูหลัก">
        {[...sections, ...(uncategorizedItems.length ? [{ key: 'other', label: 'อื่น ๆ', items: uncategorizedItems }] : [])].map(
          (section) => {
            const hasActiveItem = section.items.some((item) => item.key === activeView);

            return (
              <details
                className="group rounded-3xl border border-slate-200/70 bg-white/70 p-1.5 shadow-sm open:bg-white/90"
                key={section.key}
                open={hasActiveItem || section.key === 'primary'}
              >
                <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-3 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 [&::-webkit-details-marker]:hidden">
                  <span className="truncate">{section.label}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{section.items.length}</span>
                    <ChevronRight
                      className="transition group-open:rotate-90"
                      size={15}
                      aria-hidden="true"
                    />
                  </span>
                </summary>
                <div className="grid gap-1 pt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeView;

                return (
                  <div className="grid gap-1" key={item.label}>
                    <Link
                      className={`flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-black transition ${
                        isActive
                          ? 'blue-action'
                          : 'text-slate-600 hover:bg-white/90 hover:text-slate-950 hover:shadow-sm'
                      }`}
                      to={item.path}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>

                    {item.key === 'students' && isActive ? (
                      <div className="ml-5 grid gap-1 border-l border-amber-200/80 pl-3">
                        {studentSubNavItems.map((subItem) => {
                          const isSubActive = activeStudentSubView === subItem.value;

                          return (
                            <Link
                              className={`flex min-h-9 items-center rounded-2xl px-3 text-xs font-black transition ${
                                isSubActive
                                  ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
                                  : 'text-slate-500 hover:bg-white hover:text-slate-950'
                              }`}
                              key={subItem.value}
                              to={`/app/dashboard?view=students&studentView=${subItem.value}`}
                            >
                              <span className="truncate">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
                </div>
              </details>
            );
          },
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
