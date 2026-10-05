import {
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Heart,
  PanelLeftClose,
  School,
  ServerCog,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
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

interface SidebarSectionConfig {
  key: string;
  label: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  itemKeys: string[];
}

const coreDirectItemKeys = [
  'overview',
];

const sidebarSections: SidebarSectionConfig[] = [
  {
    key: 'classroom-admin',
    label: 'ธุรการชั้นเรียน',
    icon: ClipboardList,
    defaultOpen: true,
    itemKeys: [
      'students',              // 1. ทะเบียนและประวัตินักเรียน
      'teacher-work',          // 2. เช็กชื่อและสถิติเวลาเรียน
      'student-health',        // 3. สุขภาพและกิจวัตรประจำวัน
      'classroom-operations',  // 4. ตารางเวรและกิจกรรมห้องเรียน
      'savings',               // 5. สมุดเงินออมนักเรียน
      'daily-brief',           // 6. สรุปบันทึกประจำวันครู
    ],
  },
  {
    key: 'academic-assessment',
    label: 'งานวิชาการ & วัดผล',
    icon: BookOpen,
    defaultOpen: true,
    itemKeys: [
      'schedule',              // ตารางสอน/ตารางเรียน
      'scores',                // สมุดคะแนน & ตัดเกรด
      'omr-scanner',           // ตรวจข้อสอบ (กระดาษ OMR)
      'academic-hub',          // ศูนย์วิชาการ & เอกสาร ปพ.
      'reports',               // พิมพ์รายงาน & สมุด ปพ.
    ],
  },
  {
    key: 'student-care',
    label: 'ดูแลช่วยเหลือนักเรียน',
    icon: Heart,
    defaultOpen: false,
    itemKeys: [
      'behavior',              // พฤติกรรม & ดูแลช่วยเหลือนักเรียน
      'desirable-characteristics', // ประเมินคุณลักษณะ 8 ประการ
      'automation',            // แจ้งเตือนเด็กเสี่ยง (ขาด/ตก)
    ],
  },
  {
    key: 'tools-calendar',
    label: 'เครื่องมือช่วยสอน',
    icon: Sparkles,
    defaultOpen: false,
    itemKeys: [
      'randomizer',            // วงล้อสุ่มนักเรียน/จัดกลุ่ม
      'school-calendar',       // ปฏิทินโรงเรียน
    ],
  },
  {
    key: 'school-management',
    label: 'ตั้งค่าโรงเรียน & ระบบ',
    icon: School,
    defaultOpen: false,
    itemKeys: [
      'workspace-settings',    // ศูนย์จัดการโรงเรียน
      'academic-year',         // ปิดชั้นและคลังปีการศึกษา
      'import-export',         // นำเข้า & ส่งออกข้อมูล
      'data-safety',           // สำรองข้อมูล & กู้คืน
    ],
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
        <div className="grid gap-1.5">
          {directItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeView;
            return (
              <Link
                className={`app-sidebar-link group ${isActive ? 'is-active' : ''}`}
                key={item.key}
                onClick={onClose}
                to={item.path}
              >
                <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                  <Icon size={16} aria-hidden="true" />
                </div>
                <span className="truncate">{item.key === 'overview' ? 'ศูนย์รวมทางลัด & หน้าแรก' : item.label}</span>
                {item.key === 'overview' && (
                  <span className="ml-auto rounded-full bg-cyan-400/20 px-2 py-0.5 text-[9px] font-black text-cyan-200">
                    HUB
                  </span>
                )}
                {!isActive && (
                  <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-slate-400 group-hover:translate-x-0.5 transition-all" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Collapsible Groups */}
        {secondarySections.map((section) => {
          const hasActiveItem = section.items.some((item) => item.key === activeView);
          const isSectionOpen = hasActiveItem || Boolean(section.defaultOpen);
          const SectionIcon = section.icon;
          return (
            <details className="app-sidebar-section mt-2.5" key={section.key} open={isSectionOpen}>
              <summary className="app-sidebar-section-summary">
                <span className="flex items-center gap-2">
                  {SectionIcon && (
                    <span className="app-sidebar-section-icon-badge">
                      <SectionIcon size={12} aria-hidden="true" />
                    </span>
                  )}
                  <span className={`font-black ${section.key === 'classroom-admin' ? 'text-cyan-200' : ''}`}>
                    {section.label}
                  </span>
                </span>
                <ChevronDown size={14} className="app-sidebar-chevron text-slate-400" aria-hidden="true" />
              </summary>
              <div className="grid gap-1 py-1 pl-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.key === activeView;
                  return (
                    <Link
                      className={`app-sidebar-link group ${isActive ? 'is-active' : ''}`}
                      key={item.key}
                      onClick={onClose}
                      to={item.path}
                    >
                      <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                        <Icon size={15} aria-hidden="true" />
                      </div>
                      <span className="truncate">{item.label}</span>
                      {!isActive && (
                        <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-slate-400 group-hover:translate-x-0.5 transition-all" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}

        {otherItems.length > 0 ? (
          <details className="app-sidebar-section mt-2.5" open={otherItems.some((item) => item.key === activeView)}>
            <summary className="app-sidebar-section-summary">
              <span className="font-black">อื่น ๆ</span>
              <ChevronDown size={14} className="app-sidebar-chevron text-slate-400" aria-hidden="true" />
            </summary>
            <div className="grid gap-1 py-1 pl-1">
              {otherItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeView;
                return (
                  <Link
                    className={`app-sidebar-link group ${isActive ? 'is-active' : ''}`}
                    key={item.key}
                    onClick={onClose}
                    to={item.path}
                  >
                    <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                      <Icon size={15} aria-hidden="true" />
                    </div>
                    <span className="truncate">{item.label}</span>
                    {!isActive && (
                      <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-slate-400 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </Link>
                );
              })}
            </div>
          </details>
        ) : null}

        {/* 🔻 Footer Utilities (แจ้งเตือน / คู่มือใช้งาน / แพ็กเกจ) */}
        {utilityItems.length > 0 ? (
          <div className="mt-3 grid gap-1.5 border-t border-white/10 pt-2.5">
            {utilityItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activeView;
              return (
                <Link
                  className={`app-sidebar-link group ${isActive ? 'is-active' : ''}`}
                  key={item.key}
                  onClick={onClose}
                  to={item.path}
                >
                  <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                    <Icon size={15} aria-hidden="true" />
                  </div>
                  <span className="truncate">{item.label}</span>
                  {item.key === 'notifications' && (
                    <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" aria-label="แจ้งเตือนใหม่" />
                  )}
                  {!isActive && (
                    <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-slate-400 group-hover:translate-x-0.5 transition-all" />
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
