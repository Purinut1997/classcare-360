import { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Crown,
  Heart,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  School,
  ServerCog,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppNavigationLink as Link } from '../navigation/ContextLink';

import { getVipBadgeInfo, getVipUpgradeMeta, isLifetimeVip } from '../../lib/entitlements';
import {
  canAccessViewByPlan,
  getRequiredTierBadgeLabel,
  usePlanAccessPolicies,
} from '../../lib/planAccessPolicy';
import type { AppNavItem } from '../../routes/appRoutes';
import type { AppSessionContext } from '../../types/core';
import { AppLogo } from '../brand/AppLogo';

interface SidebarProps {
  activeView: string;
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  maintenanceKeys?: string[];
  navItems: AppNavItem[];
  onClose?: () => void;
  onOpenGuide?: () => void;
  onToggleCollapse?: () => void;
  session?: AppSessionContext;
}

interface SidebarSectionConfig {
  key: string;
  label: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  itemKeys: string[];
}

const TOTAL_ONBOARDING_STEPS = 5;

const primaryDirectItemKeys = [
  'overview',
  'teacher-work',
  'students',
  'scores',
  'omr-scanner',
  'schedule',
  'academic-hub',
  'student-health',
  'savings',
];

const sidebarSections: SidebarSectionConfig[] = [
  {
    key: 'care-reports',
    label: 'ดูแลนักเรียน & รายงาน',
    icon: Heart,
    defaultOpen: false,
    itemKeys: [
      'behavior',
      'classroom-operations',
      'desirable-characteristics',
      'daily-brief',
      'reports',
      'randomizer',
      'school-calendar',
    ],
  },
  {
    key: 'school-data',
    label: 'จัดการโรงเรียน & ข้อมูล',
    icon: School,
    defaultOpen: false,
    itemKeys: [
      'workspace-settings',
      'academic-year',
      'import-export',
      'data-safety',
      'notifications',
      'help-center',
    ],
  },
];

function readCompletedOnboardingCount(): number {
  try {
    const roadmapRaw = window.localStorage.getItem('classcare_roadmap_completed_steps');
    const setupRaw = window.localStorage.getItem('classcare_setup_completed_steps');
    const roadmapList = roadmapRaw ? JSON.parse(roadmapRaw) : [];
    const setupList = setupRaw ? JSON.parse(setupRaw) : [];
    const roadmapCount = Array.isArray(roadmapList) ? roadmapList.length : 0;
    const setupCount = Array.isArray(setupList) ? setupList.length : 0;
    return Math.min(TOTAL_ONBOARDING_STEPS, Math.max(roadmapCount, setupCount));
  } catch {
    return 0;
  }
}

function getProfileInitials(displayName?: string): string {
  const words = (displayName || 'ครู').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function Sidebar({
  activeView,
  isCollapsed = false,
  isMobileOpen = false,
  maintenanceKeys = [],
  navItems,
  onClose,
  onOpenGuide,
  onToggleCollapse,
  session,
}: SidebarProps) {
  const maintenanceSet = new Set(maintenanceKeys);
  const planPolicies = usePlanAccessPolicies();
  const isSuperadmin = session?.profile.role === 'superadmin';
  const vipBadgeLabel = getRequiredTierBadgeLabel(session);
  const [completedStepsCount, setCompletedStepsCount] = useState<number>(() => readCompletedOnboardingCount());

  useEffect(() => {
    const syncSteps = () => setCompletedStepsCount(readCompletedOnboardingCount());
    window.addEventListener('storage', syncSteps);
    window.addEventListener('focus', syncSteps);
    return () => {
      window.removeEventListener('storage', syncSteps);
      window.removeEventListener('focus', syncSteps);
    };
  }, []);

  const isItemVipLocked = (item: AppNavItem) =>
    Boolean(session && !isSuperadmin && !canAccessViewByPlan(session, item.key, item.moduleKey, planPolicies));
  const showVipUpgradeMenu = Boolean(
    session && !isLifetimeVip(session.subscription, session.profile.role),
  );
  const vipUpgradeMeta = getVipUpgradeMeta(session?.subscription);
  const vipBadgeInfo = session ? getVipBadgeInfo(session.subscription, session.profile.role) : null;

  const directItems = primaryDirectItemKeys
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

  const isItemActive = (key: string) =>
    key === activeView || (key === 'academic-year' && activeView === 'period-locks');

  const renderSidebarNavItem = (item: AppNavItem) => {
    const Icon = item.icon;
    const isActive = isItemActive(item.key);
    const isPaused = maintenanceSet.has(item.key);
    const isVipLocked = isItemVipLocked(item);
    const label = item.key === 'overview' ? 'วันนี้' : item.label;

    return (
      <Link
        className={`app-sidebar-link group ${isActive ? 'is-active' : ''} ${isVipLocked ? 'opacity-80' : ''}`}
        key={item.key}
        onClick={onClose}
        externalUrl={isVipLocked ? undefined : item.externalUrl}
        title={isVipLocked ? `${label} — จำกัดสิทธิ์เฉพาะสมาชิก ${vipBadgeLabel}` : label}
        to={item.path}
      >
        <div className={`app-sidebar-icon-box ${isActive ? 'is-active' : ''}`}>
          <Icon size={16} aria-hidden="true" />
        </div>
        <span className="sidebar-label min-w-0 flex-1 truncate">{label}</span>
        {isPaused ? (
          <span className="sidebar-label shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            ปรับปรุง
          </span>
        ) : isVipLocked ? (
          <span className="sidebar-label inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            <Lock size={9} aria-hidden="true" />
            {vipBadgeLabel}
          </span>
        ) : !isActive ? (
          <ChevronRight
            size={13}
            className="sidebar-label ml-auto shrink-0 text-[#9aa59e] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-70"
            aria-hidden="true"
          />
        ) : null}
      </Link>
    );
  };

  const progressPercent = Math.round((completedStepsCount / TOTAL_ONBOARDING_STEPS) * 100);

  const renderContent = (forMobileDrawer: boolean) => {
    const collapsed = !forMobileDrawer && isCollapsed;
    return (
      <>
        <div className="app-sidebar-brand">
          {!collapsed ? (
            <>
              <AppLogo className="h-9 w-9 shrink-0 rounded-xl bg-white p-0.5 ring-1 ring-[#eceee9] shadow-2xs" />
              <div className="sidebar-label min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-extrabold tracking-tight text-[#1c573d]">ClassCare 360</p>
                <p className="truncate text-[11px] font-semibold text-[#75827a]">ผู้ช่วยครูประจำชั้น</p>
              </div>
            </>
          ) : null}
          {!forMobileDrawer && onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'ขยายแถบเมนู' : 'พับแถบเมนู'}
              aria-label={collapsed ? 'ขยายแถบเมนู' : 'พับแถบเมนู'}
              className="hidden lg:grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#7c8780] transition hover:bg-[#f3f4f1] hover:text-[#1f2924]"
            >
              {collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
          ) : null}
          {forMobileDrawer ? (
            <button
              className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#75827a] hover:bg-[#f3f4f1] hover:text-[#1f2924] lg:hidden"
              aria-label="ปิดเมนู"
              onClick={onClose}
              type="button"
            >
              <X size={19} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Compact Workspace Switcher Pill */}
        {session?.workspace ? (
          <div className="shrink-0 pb-1 pt-2.5">
            <Link
              className={`group flex w-full min-w-0 items-center gap-2 rounded-xl border border-[#eceee9] bg-[#fafbf9] p-2 text-left transition hover:border-[#bfe0cd] hover:bg-[#eaf5ef]/50 ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              onClick={onClose}
              to="/app/select-workspace"
              title={`${session.workspace.schoolName || session.workspace.name} — คลิกเพื่อสลับโรงเรียน`}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#eaf5ef] text-[#2f7d5b] group-hover:bg-[#dcf0e5]">
                <Building2 size={15} aria-hidden="true" />
              </div>
              <div className="sidebar-full min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs font-bold text-[#1f2924] group-hover:text-[#1c573d]">
                    {session.workspace.schoolName || session.workspace.name}
                  </p>
                  {vipBadgeInfo?.isVip ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-800"
                      title={vipBadgeInfo.tooltip}
                    >
                      <Crown size={9} className="fill-amber-400/40" aria-hidden="true" />
                      VIP
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[11px] font-medium text-[#75827a]">
                  ปี {session.workspace.academicYear || 'ปัจจุบัน'}
                  {vipBadgeInfo?.isVip
                    ? ` · ${vipBadgeInfo.daysText}`
                    : vipBadgeInfo?.tier === 'trial'
                      ? ` · ${vipBadgeInfo.shortLabel}`
                      : ' · สลับโรงเรียน'}
                </p>
              </div>
            </Link>
          </div>
        ) : null}

        <nav className="app-sidebar-nav" aria-label="เมนูหลัก">
          {/* Tier 1: Core Direct 1-Click Items */}
          <div className="flex w-full min-w-0 shrink-0 flex-col gap-0.5">
            {directItems.map((item) => renderSidebarNavItem(item))}
          </div>

          <div className="my-2 border-t border-[#eff1ec]" />

          {/* Tier 2: Collapsible Secondary Groups */}
          {secondarySections.map((section) => {
            const hasActiveItem = section.items.some((item) => isItemActive(item.key));
            const isSectionOpen = hasActiveItem || Boolean(section.defaultOpen);
            const SectionIcon = section.icon;
            return (
              <details className="app-sidebar-section mt-0.5" key={section.key} open={isSectionOpen}>
                <summary className="app-sidebar-section-summary" title={`${section.label} (${section.items.length} เมนู)`}>
                  <span className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden ${collapsed ? 'justify-center' : ''}`}>
                    {SectionIcon && (
                      <SectionIcon size={15} className="shrink-0 text-[#7c8780]" aria-hidden="true" />
                    )}
                    <span className="sidebar-label min-w-0 truncate font-bold">
                      {section.label}
                    </span>
                  </span>
                  <span className="sidebar-label shrink-0 rounded-full bg-[#f1f3ef] px-1.5 py-0.5 text-[11px] font-semibold text-[#75827a] tabular-nums">
                    {section.items.length}
                  </span>
                  <ChevronDown size={13} className="sidebar-label app-sidebar-chevron shrink-0 text-[#8b968f] transition-transform duration-150" aria-hidden="true" />
                </summary>
                <div className={`flex w-full min-w-0 flex-col gap-0.5 py-1 ${collapsed ? '' : 'pl-2'}`}>
                  {section.items.map((item) => renderSidebarNavItem(item))}
                </div>
              </details>
            );
          })}

          {otherItems.length > 0 ? (
            <details className="app-sidebar-section mt-1" open={otherItems.some((item) => item.key === activeView)}>
              <summary className="app-sidebar-section-summary">
                <span className="sidebar-label font-bold">อื่น ๆ</span>
                <ChevronDown size={13} className="sidebar-label app-sidebar-chevron shrink-0 text-[#8b968f]" aria-hidden="true" />
              </summary>
              <div className={`flex w-full min-w-0 flex-col gap-0.5 py-1 ${collapsed ? '' : 'pl-2'}`}>
                {otherItems.map((item) => renderSidebarNavItem(item))}
              </div>
            </details>
          ) : null}
        </nav>

        {/* Bottom Pinned Widgets */}
        <div className="mt-2 space-y-2 border-t border-[#f0f2ee] pt-2.5 shrink-0">
          {onOpenGuide ? (
            <button
              type="button"
              onClick={() => {
                onClose?.();
                onOpenGuide();
              }}
              title="เปิดคู่มือเริ่มต้นใช้งาน"
              className={`w-full rounded-xl border border-[#bfe0cd] bg-[#eaf5ef] px-3 py-2 text-left transition hover:brightness-[0.98] ${
                collapsed ? 'flex justify-center px-0' : ''
              }`}
            >
              {collapsed ? (
                <Rocket size={16} className="text-[#2f7d5b]" aria-hidden="true" />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-[#1c573d]">
                      <Rocket size={13} className="text-[#2f7d5b]" aria-hidden="true" />
                      เริ่มต้นใช้งาน
                    </span>
                    <span className="font-extrabold text-[#2f7d5b] tabular-nums">
                      {completedStepsCount}/{TOTAL_ONBOARDING_STEPS}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/85">
                    <div
                      className="h-full rounded-full bg-[#2f7d5b] transition-all duration-300"
                      style={{ width: `${Math.max(progressPercent, 8)}%` }}
                    />
                  </div>
                </>
              )}
            </button>
          ) : null}

          {showVipUpgradeMenu ? (
            <Link
              className={`flex w-full min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                activeView === 'package'
                  ? 'border-amber-300 bg-amber-100 text-amber-950'
                  : 'border-[#f2dc9b] bg-[#fff9e8] text-[#946208] hover:bg-[#fff3d1]'
              } ${collapsed ? 'px-0' : ''}`}
              onClick={onClose}
              title={vipUpgradeMeta.label}
              to="/app/package"
            >
              <Crown size={14} className="shrink-0 text-amber-600" aria-hidden="true" />
              <span className="sidebar-full truncate">{vipUpgradeMeta.label}</span>
            </Link>
          ) : null}

          {isSuperadmin ? (
            <Link
              className="app-admin-shortcut w-full min-w-0 shrink-0"
              onClick={onClose}
              title="Superadmin — ศูนย์ควบคุมระบบ"
              to="/app/dashboard?view=superadmin-dashboard"
            >
              <ServerCog size={16} className="shrink-0" aria-hidden="true" />
              <span className="sidebar-full min-w-0 flex-1">
                <strong className="truncate">Superadmin</strong>
                <small className="truncate">ศูนย์ควบคุมระบบ</small>
              </span>
            </Link>
          ) : null}

          {session ? (
            <Link
              className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-[#f3f4f1] ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              onClick={onClose}
              title="ตั้งค่าบัญชีผู้ใช้"
              to="/app/dashboard?view=workspace-settings&tab=account"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1f2924] text-xs font-bold text-white">
                {getProfileInitials(session.profile.displayName)}
              </span>
              <span className="sidebar-full min-w-0 flex-1 text-left leading-tight">
                <span className="block truncate text-xs font-bold text-[#1f2924]">
                  {session.profile.displayName || 'คุณครู'}
                </span>
                <span className="block truncate text-[11px] font-medium text-[#7c8780]">
                  {session.workspace?.schoolName || session.profile.schoolName || 'ClassCare 360'}
                </span>
              </span>
            </Link>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <>
      {/* Mobile Drawer Overlay Container */}
      <div
        className={`fixed inset-0 z-[100] lg:hidden ${
          isMobileOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
      >
        <div
          className={`absolute inset-0 bg-slate-950/60 transition-opacity duration-300 ${
            isMobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        <aside
          className={`app-sidebar absolute inset-y-0 left-0 w-[280px] shadow-2xl transition-transform duration-300 ease-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderContent(true)}
        </aside>
      </div>

      {/* Desktop Static Sidebar */}
      <aside
        className={`app-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-screen ${
          isCollapsed ? 'is-collapsed lg:w-[72px]' : 'lg:w-[240px]'
        }`}
      >
        {renderContent(false)}
      </aside>
    </>
  );
}
