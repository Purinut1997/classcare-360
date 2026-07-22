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
  { key: 'students', label: 'ข้อมูลนักเรียน', itemKeys: ['students'] },
  {
    key: 'teacher-work',
    label: 'งานครู',
    itemKeys: ['teacher-work', 'schedule', 'scores', 'savings', 'behavior', 'randomizer'],
  },
  { key: 'data', label: 'รายงานและข้อมูล', itemKeys: ['reports', 'school-calendar', 'import-export', 'data-safety', 'notifications'] },
  { key: 'workspace', label: 'จัดการโรงเรียน', itemKeys: ['workspace-settings', 'workspace-switch'] },
  { key: 'system', label: 'ระบบผู้ดูแล', itemKeys: ['help-center', 'setup', 'audit', 'superadmin-dashboard'] },
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

const scoreSubNavItems = [
  { label: 'ภาพรวมคะแนน', value: 'overview' },
  { label: 'สร้างชุดคะแนน', value: 'setup' },
  { label: 'กรอกคะแนน', value: 'entry' },
  { label: 'สมุดรวมคะแนน', value: 'gradebook' },
];

const scheduleSubNavItems = [
  { label: 'ตาราง', value: 'table' },
  { label: 'ตั้งค่า', value: 'settings' },
];

const reportSubNavItems = [
  { label: 'เวลาเรียน', value: 'attendance' },
  { label: 'เงินออม', value: 'savings' },
  { label: 'คะแนนรวมห้อง', value: 'scores' },
  { label: 'รายบุคคล', value: 'individual' },
  { label: 'พฤติกรรม/เคสดูแล', value: 'behavior' },
  { label: 'ตั้งค่ารายงาน', value: 'settings' },
];

export function Sidebar({ activeView, navItems, session }: SidebarProps) {
  const location = useLocation();
  const isSuperadmin = session?.profile.role === 'superadmin';
  const requestedStudentSubView = new URLSearchParams(location.search).get('studentView') || 'roster';
  const activeStudentSubView = studentSubNavItems.some((item) => item.value === requestedStudentSubView)
    ? requestedStudentSubView
    : 'roster';
  const requestedScoreSubView = new URLSearchParams(location.search).get('scoreView') || 'entry';
  const activeScoreSubView = scoreSubNavItems.some((item) => item.value === requestedScoreSubView)
    ? requestedScoreSubView
    : 'entry';
  const requestedScheduleSubView = new URLSearchParams(location.search).get('scheduleView') || 'table';
  const activeScheduleSubView = scheduleSubNavItems.some((item) => item.value === requestedScheduleSubView)
    ? requestedScheduleSubView
    : 'table';
  const requestedReportSubView = new URLSearchParams(location.search).get('reportView') || 'attendance';
  const activeReportSubView = reportSubNavItems.some((item) => item.value === requestedReportSubView)
    ? requestedReportSubView
    : 'attendance';
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
    <aside className="hidden overflow-y-auto border-r border-[#ead8bd]/75 bg-white/88 p-4 shadow-[12px_0_32px_rgba(122,79,38,0.07)] backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center gap-3 rounded-2xl bg-slate-950 p-2.5 text-white shadow-[0_16px_36px_rgba(2,6,23,0.18)]">
        <AppLogo className="h-11 w-11 rounded-xl bg-white shadow-[0_0_22px_rgba(255,255,255,0.20)]" />
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight">ClassCare 360</p>
          <p className="truncate text-xs font-bold text-cyan-100">ดูแลทั้งห้อง ครบจบในระบบเดียว</p>
        </div>
      </div>

      <nav className="mt-5 grid gap-1" aria-label="เมนูหลัก">
        {[...sections, ...(uncategorizedItems.length ? [{ key: 'other', label: 'อื่น ๆ', items: uncategorizedItems }] : [])].map(
          (section) => {
            const hasActiveItem = section.items.some((item) => item.key === activeView);

            return (
              <details
                className="group border-b border-[#ead8bd]/70 py-2 last:border-b-0"
                key={section.key}
                open={hasActiveItem || section.key === 'primary'}
              >
                <summary className="flex h-8 cursor-pointer list-none items-center justify-between gap-3 px-1 text-[11px] font-black uppercase tracking-[0.06em] text-slate-400 transition hover:text-slate-950 [&::-webkit-details-marker]:hidden">
                  <span className="truncate">{section.label}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-[#f8ead4] px-2 py-0.5 text-[10px] text-[#7a4f26]">{section.items.length}</span>
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
                      className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-black transition ${
                        isActive
                          ? 'bg-[#fff1c9] text-[#5a3515] shadow-sm ring-1 ring-[#e8c47b]'
                          : 'text-slate-600 hover:bg-white/90 hover:text-slate-950 hover:shadow-sm'
                      }`}
                      to={item.path}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>

                    {item.key === 'students' && isActive ? (
                      <div className="ml-4 grid gap-0.5 border-l border-[#ead8bd] pl-3">
                        {studentSubNavItems.map((subItem) => {
                          const isSubActive = activeStudentSubView === subItem.value;

                          return (
                            <Link
                              className={`flex min-h-8 items-center rounded-lg px-2.5 text-xs font-black transition ${
                                isSubActive
                                  ? 'bg-[#fff6dc] text-[#8a5200] ring-1 ring-[#f1d18c]'
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

                    {item.key === 'scores' && isActive ? (
                      <div className="ml-4 grid gap-0.5 border-l border-[#ead8bd] pl-3">
                        {scoreSubNavItems.map((subItem) => {
                          const isSubActive = activeScoreSubView === subItem.value;

                          return (
                            <Link
                              className={`flex min-h-8 items-center rounded-lg px-2.5 text-xs font-black transition ${
                                isSubActive
                                  ? 'bg-[#fff6dc] text-[#8a5200] ring-1 ring-[#f1d18c]'
                                  : 'text-slate-500 hover:bg-white hover:text-slate-950'
                              }`}
                              key={subItem.value}
                              to={`/app/dashboard?view=scores&scoreView=${subItem.value}`}
                            >
                              <span className="truncate">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    {item.key === 'schedule' && isActive ? (
                      <div className="ml-4 grid gap-0.5 border-l border-[#ead8bd] pl-3">
                        {scheduleSubNavItems.map((subItem) => {
                          const isSubActive = activeScheduleSubView === subItem.value;

                          return (
                            <Link
                              className={`flex min-h-8 items-center rounded-lg px-2.5 text-xs font-black transition ${
                                isSubActive
                                  ? 'bg-[#fff6dc] text-[#8a5200] ring-1 ring-[#f1d18c]'
                                  : 'text-slate-500 hover:bg-white hover:text-slate-950'
                              }`}
                              key={subItem.value}
                              to={`/app/dashboard?view=schedule&scheduleView=${subItem.value}`}
                            >
                              <span className="truncate">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}

                    {item.key === 'reports' && isActive ? (
                      <div className="ml-4 grid gap-0.5 border-l border-[#ead8bd] pl-3">
                        {reportSubNavItems.map((subItem) => {
                          const isSubActive = activeReportSubView === subItem.value;

                          return (
                            <Link
                              className={`flex min-h-8 items-center rounded-lg px-2.5 text-xs font-black transition ${
                                isSubActive
                                  ? 'bg-[#fff6dc] text-[#8a5200] ring-1 ring-[#f1d18c]'
                                  : 'text-slate-500 hover:bg-white hover:text-slate-950'
                              }`}
                              key={subItem.value}
                              to={`/app/dashboard?view=reports&reportView=${subItem.value}`}
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
        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-200 bg-white/90 p-3 shadow-[0_14px_30px_rgba(14,165,233,0.09)]">
          <div className="flex items-center gap-2 text-cyan-700">
            <ServerCog size={18} aria-hidden="true" />
            <p className="font-black">Superadmin Tools</p>
          </div>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-600">
            จัดการสิทธิ์ admin, workspace, ระบบตรวจสอบ และศูนย์ควบคุมหลักของแอป
          </p>
          <Link
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#fff1c9] px-3 text-sm font-black text-[#5a3515] shadow-sm ring-1 ring-[#e8c47b] transition hover:-translate-y-0.5"
            to="/app/dashboard?view=superadmin-dashboard"
          >
            เปิดศูนย์ผู้ดูแล
            <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <div className="mt-auto rounded-xl border border-[#ead8bd] bg-white/80 p-3 text-xs font-bold text-slate-500 shadow-sm">
        Created by MIKPURINUT
      </div>
    </aside>
  );
}
