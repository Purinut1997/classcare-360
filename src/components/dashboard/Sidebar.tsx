import {
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Crown,
  Heart,
  Lock,
  PanelLeftClose,
  School,
  ServerCog,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppNavigationLink as Link } from '../navigation/ContextLink';

import { canUseModule, getVipUpgradeMeta, isLifetimeVip } from '../../lib/entitlements';
import type { AppNavItem } from '../../routes/appRoutes';
import type { AppSessionContext } from '../../types/core';
import { AppLogo } from '../brand/AppLogo';

interface SidebarProps {
  activeView: string;
  isMobileOpen?: boolean;
  maintenanceKeys?: string[];
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
    label: 'งานประจำวันในห้องเรียน',
    icon: ClipboardList,
    // Keep the first screen calm for new teachers; the active group opens automatically.
    defaultOpen: false,
    itemKeys: [
      'students',              // รายชื่อและทะเบียนนักเรียน
      'teacher-work',          // เช็กชื่อและสถิติเวลาเรียน
      'classroom-operations',  // ตารางเวรทำความสะอาด
      'student-health',        // สุขภาพและกิจวัตรประจำวัน
      'savings',               // สมุดเงินออม
      'daily-brief',           // สรุปบันทึกประจำวัน
    ],
  },
  {
    key: 'academic-assessment',
    label: 'งานวิชาการ & วัดผล',
    icon: BookOpen,
    defaultOpen: false,
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
      'behavior',              // พฤติกรรม & บันทึกความดี
      'desirable-characteristics', // ประเมินคุณลักษณะ 8 ประการ
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
    label: 'ตั้งค่าโรงเรียน & จัดการระบบ',
    icon: School,
    defaultOpen: false,
    itemKeys: [
      'workspace-settings',    // ตั้งค่าโรงเรียน & ครู
      'academic-year',         // ปีการศึกษา & ล็อกงวด (รวมล็อกงวดข้อมูลไว้ในแท็บ 1 แล้ว)
      'import-export',         // นำเข้า / ส่งออกข้อมูล
      'data-safety',           // สำรองข้อมูล & ถังขยะ
    ],
  },
];

const utilityItemKeys = ['notifications', 'help-center'];

export function Sidebar({
  activeView,
  isMobileOpen = false,
  maintenanceKeys = [],
  navItems,
  onClose,
  session,
}: SidebarProps) {
  const maintenanceSet = new Set(maintenanceKeys);
  const isSuperadmin = session?.profile.role === 'superadmin';
  const isItemVipLocked = (item: AppNavItem) =>
    Boolean(session && !isSuperadmin && !canUseModule(session.subscription, item.moduleKey));
  const showVipUpgradeMenu = Boolean(
    session && !isLifetimeVip(session.subscription, session.profile.role),
  );
  const vipUpgradeMeta = getVipUpgradeMeta(session?.subscription);
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

  const utilityItems = utilityItemKeys
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item): item is AppNavItem => Boolean(item));
  utilityItems.forEach((item) => renderedKeys.add(item.key));

  // Mark alias/integrated keys as rendered so they don't leak to 'อื่น ๆ'
  renderedKeys.add('automation');
  renderedKeys.add('workspace-switch');
  renderedKeys.add('period-locks');
  renderedKeys.add('parent-access');
  renderedKeys.add('setup');
  renderedKeys.add('audit');
  renderedKeys.add('package');

  const otherItems = navItems.filter(
    (item) => !renderedKeys.has(item.key) && item.key !== 'superadmin-dashboard',
  );

  const content = (
    <>
      <div className="app-sidebar-brand">
        <AppLogo className="h-10 w-10 rounded-xl bg-white p-0.5 ring-1 ring-[#86efac]/30 shadow-xs" />
        <div className="min-w-0">
          <p className="truncate font-display text-base font-extrabold tracking-tight text-white">ClassCare 360</p>
          <p className="truncate text-[11px] font-semibold text-[#b7d9c6]">ดูแลทั้งห้อง ครบจบในระบบเดียว</p>
        </div>
        <button
          className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#c5ddd0] hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="ปิดเมนู"
          onClick={onClose}
          type="button"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      {/* Top Workspace Selector Card */}
      {session?.workspace ? (
        <div className="pb-1 pt-2.5">
          <Link
            className="flex items-center gap-2.5 rounded-2xl bg-white/[0.08] p-2.5 text-left ring-1 ring-white/15 transition hover:bg-white/[0.14] group"
            onClick={onClose}
            to="/app/select-workspace"
            title="คลิกเพื่อสลับโรงเรียน / พื้นที่ทำงาน"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#2f7d5b]/45 text-[#a7f3d0] group-hover:bg-[#2f7d5b]/65">
              <Building2 size={16} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white group-hover:text-[#a7f3d0]">
                {session.workspace.schoolName || session.workspace.name}
              </p>
              <p className="truncate text-[10px] font-medium text-[#c5ddd0]">
                ปี {session.workspace.academicYear || 'ปัจจุบัน'} · สลับห้องเรียน
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
                externalUrl={item.externalUrl}
                to={item.path}
              >
                <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                  <Icon size={16} aria-hidden="true" />
                </div>
                <span className="min-w-0 flex-1 truncate">{item.key === 'overview' ? 'ศูนย์รวมทางลัด & หน้าแรก' : item.label}</span>
                {item.key === 'overview' && (
                  <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold text-[#d1fae5]">
                    หลัก
                  </span>
                )}
                {!isActive && item.key !== 'overview' && (
                  <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-[#b7d9c6] group-hover:translate-x-0.5 transition-all" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Secondary Collapsible Groups */}
        {secondarySections.map((section) => {
          const isItemActive = (key: string) =>
            key === activeView || (key === 'academic-year' && activeView === 'period-locks');
          const hasActiveItem = section.items.some((item) => isItemActive(item.key));
          const isSectionOpen = hasActiveItem || Boolean(section.defaultOpen);
          const SectionIcon = section.icon;
          const badgeTone =
            section.key === 'academic-assessment'
              ? 'bg-sky-400/20 text-sky-200 border-sky-300/25'
              : section.key === 'student-care'
                ? 'bg-rose-400/20 text-rose-200 border-rose-300/25'
                : section.key === 'tools-calendar'
                  ? 'bg-amber-400/20 text-amber-200 border-amber-300/25'
                  : section.key === 'school-management'
                    ? 'bg-violet-400/20 text-violet-200 border-violet-300/25'
                    : 'bg-[#2f7d5b]/40 text-[#a7f3d0] border-[#6ee7b7]/25';
          const allItemsVipLocked =
            section.items.length > 0 && section.items.every((item) => isItemVipLocked(item));
          return (
            <details className="app-sidebar-section mt-2.5" key={section.key} open={isSectionOpen}>
              <summary className="app-sidebar-section-summary">
                <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  {SectionIcon && (
                    <span className={`grid h-5 w-5 place-items-center rounded-md border ${badgeTone}`}>
                      <SectionIcon size={12} aria-hidden="true" />
                    </span>
                  )}
                  <span className={`min-w-0 truncate font-bold ${section.key === 'classroom-admin' ? 'text-[#a7f3d0]' : ''}`}>
                    {section.label}
                  </span>
                </span>
                {allItemsVipLocked ? (
                  <span className="mr-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-200 ring-1 ring-amber-300/35">
                    <Lock size={8} aria-hidden="true" />
                    VIP
                  </span>
                ) : null}
                <ChevronDown size={14} className="app-sidebar-chevron shrink-0 text-[#9fc0ae]" aria-hidden="true" />
              </summary>
              <div className="grid gap-1 py-1 pl-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isItemActive(item.key);
                  const isPaused = maintenanceSet.has(item.key);
                  const isVipLocked = isItemVipLocked(item);
                  return (
                    <Link
                      className={`app-sidebar-link group ${isActive ? 'is-active' : ''} ${isVipLocked ? 'opacity-80' : ''}`}
                      key={item.key}
                      onClick={onClose}
                      externalUrl={isVipLocked ? undefined : item.externalUrl}
                      title={isVipLocked ? `${item.label} — จำกัดสิทธิ์เฉพาะสมาชิก VIP` : undefined}
                      to={item.path}
                    >
                      <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                        <Icon size={15} aria-hidden="true" />
                      </div>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {isPaused ? (
                        <span className="shrink-0 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-black text-amber-200 ring-1 ring-amber-300/35">
                          ปรับปรุง
                        </span>
                      ) : isVipLocked ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-200 ring-1 ring-amber-300/40">
                          <Lock size={9} aria-hidden="true" />
                          VIP
                        </span>
                      ) : !isActive ? (
                        <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-slate-400 group-hover:translate-x-0.5 transition-all" />
                      ) : null}
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
                    externalUrl={item.externalUrl}
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

        {/* 🔻 Footer Utilities (แจ้งเตือน / คู่มือใช้งาน) */}
        {utilityItems.length > 0 ? (
          <div className="mt-3 grid gap-1.5 border-t border-white/10 pt-2.5">
            {utilityItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.key === activeView || (item.key === 'notifications' && activeView === 'automation');
              const isPaused = maintenanceSet.has(item.key);
              const isVipLocked = isItemVipLocked(item);
              return (
                <Link
                  className={`app-sidebar-link group ${isActive ? 'is-active' : ''} ${isVipLocked ? 'opacity-80' : ''}`}
                  key={item.key}
                  onClick={onClose}
                  externalUrl={isVipLocked ? undefined : item.externalUrl}
                  title={isVipLocked ? `${item.label} — จำกัดสิทธิ์เฉพาะสมาชิก VIP` : undefined}
                  to={item.path}
                >
                  <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
                    <Icon size={15} aria-hidden="true" />
                  </div>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {isPaused ? (
                    <span className="shrink-0 rounded-full bg-amber-400/25 px-1.5 py-0.5 text-[9px] font-black text-amber-200 ring-1 ring-amber-300/35">
                      ปรับปรุง
                    </span>
                  ) : isVipLocked ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-200 ring-1 ring-amber-300/40">
                      <Lock size={9} aria-hidden="true" />
                      VIP
                    </span>
                  ) : !isActive ? (
                    <ChevronRight size={13} className="ml-auto opacity-0 group-hover:opacity-60 text-slate-400 group-hover:translate-x-0.5 transition-all" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>

      {/* 👑 Dedicated VIP Upgrade / Renewal Menu for Non-Lifetime VIP Users */}
      {showVipUpgradeMenu ? (
        <Link
          className={`mt-2.5 flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
            activeView === 'package'
              ? 'border-amber-300/70 bg-gradient-to-r from-amber-400/30 via-amber-500/25 to-yellow-400/20 text-white shadow-sm'
              : 'border-amber-300/35 bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-transparent text-amber-100 hover:border-amber-300/60 hover:from-amber-500/30 hover:text-white'
          }`}
          onClick={onClose}
          to="/app/package"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-400/25 text-amber-200 ring-1 ring-amber-300/40">
            <Crown size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs font-black text-amber-100">{vipUpgradeMeta.label}</strong>
            <small className="block truncate text-[10px] font-semibold text-amber-200/80">{vipUpgradeMeta.subtitle}</small>
          </span>
          <ChevronRight size={14} className="shrink-0 text-amber-200/80" aria-hidden="true" />
        </Link>
      ) : null}

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

      {/* Desktop Static Sidebar */}
      <aside className="app-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[232px]">
        {content}
      </aside>
    </>
  );
}
