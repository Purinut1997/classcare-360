import { useEffect, useState, type ReactNode } from 'react';
import { Home, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';

import { ContextLink as Link } from '../components/navigation/ContextLink';
import { ContextNav } from '../components/dashboard/ContextNav';
import { MobileNav } from '../components/dashboard/MobileNav';
import { Sidebar } from '../components/dashboard/Sidebar';
import { Topbar } from '../components/dashboard/Topbar';
import { GlobalBroadcastBanner } from '../components/system/GlobalBroadcastBanner';
import { NetworkStatusBanner } from '../components/system/NetworkStatusBanner';
import { SetupGuideModal } from '../components/guide/SetupGuideModal';
import { SupportChat } from '../components/support/SupportChat';
import { recordMenuUsageFromNavigation } from '../lib/menuUsage';
import {
  fetchActiveModuleMaintenance,
  getCachedModuleMaintenanceMap,
  MODULE_MAINTENANCE_EVENT,
  setModuleMaintenanceStatus,
  type ModuleMaintenanceMap,
} from '../lib/moduleMaintenance';
import type { AppNavItem } from '../routes/appRoutes';
import type { AppSessionContext } from '../types/core';

// Keep onboarding available on demand so it never blocks a teacher's first task.
let hasAutoPoppedInCurrentSession = false;

interface AppShellProps {
  activeView: string;
  children: ReactNode;
  navItems: AppNavItem[];
  session?: AppSessionContext;
}

export function AppShell({ activeView, children, navItems, session }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(() => {
    if (!hasAutoPoppedInCurrentSession) {
      hasAutoPoppedInCurrentSession = true;
      const pref = window.localStorage.getItem('classcare_guide_auto_popup');
      return pref === 'true';
    }
    return false;
  });
  const activeLabel = navItems.find((item) => item.key === activeView)?.label || 'ClassCare 360';
  const isSuperadmin = session?.profile.role === 'superadmin';
  const [moduleMaintenanceMap, setModuleMaintenanceMap] = useState<ModuleMaintenanceMap>(() => getCachedModuleMaintenanceMap());
  const [isReopeningModule, setIsReopeningModule] = useState(false);

  // Sync per-module maintenance status from Supabase
  useEffect(() => {
    let active = true;
    const syncLocal = () => {
      if (!active) return;
      setModuleMaintenanceMap(getCachedModuleMaintenanceMap());
    };
    const syncServer = async () => {
      const live = await fetchActiveModuleMaintenance();
      if (!active) return;
      setModuleMaintenanceMap(live);
    };
    void syncServer();
    const timer = window.setInterval(() => {
      void syncServer();
    }, 60_000);
    window.addEventListener(MODULE_MAINTENANCE_EVENT, syncLocal);
    window.addEventListener('storage', syncLocal);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(MODULE_MAINTENANCE_EVENT, syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }, []);

  const activeModuleMaintenance =
    activeView !== 'overview' && activeView !== 'superadmin-dashboard'
      ? moduleMaintenanceMap[activeView] || null
      : null;
  const maintenanceKeys = Object.keys(moduleMaintenanceMap);

  // Listen for global open guide trigger events
  useEffect(() => {
    const handleOpenGuide = () => setIsGuideOpen(true);
    window.addEventListener('open-setup-guide', handleOpenGuide);
    return () => window.removeEventListener('open-setup-guide', handleOpenGuide);
  }, []);

  // Close sidebar when navigating to a different view
  useEffect(() => {
    setIsMenuOpen(false);
  }, [activeView]);

  // Enforce Light Mode across the entire application
  useEffect(() => {
    window.localStorage.setItem('classcare-theme', 'light');
    document.documentElement.dataset.theme = 'light';
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <div
      className="app-shell theme-light"
      onClickCapture={(event) => recordMenuUsageFromNavigation(event.nativeEvent, session, navItems)}
    >
      <div className="app-ambient-background no-print print:hidden" aria-hidden="true">
        <span className="app-ambient-orb app-ambient-orb-one" />
        <span className="app-ambient-orb app-ambient-orb-two" />
        <span className="app-ambient-orb app-ambient-orb-three" />
        <span className="app-ambient-mesh" />
      </div>
      <Sidebar
        activeView={activeView}
        isMobileOpen={isMenuOpen}
        maintenanceKeys={maintenanceKeys}
        navItems={navItems}
        onClose={() => setIsMenuOpen(false)}
        session={session}
      />
      <div className="app-shell-main">
        <div className="no-print print:hidden">
          <GlobalBroadcastBanner isSuperadmin={isSuperadmin} />
          <NetworkStatusBanner />
          <Topbar
            activeLabel={activeLabel}
            navItems={navItems}
            onMenuToggle={() => setIsMenuOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            session={session}
          />
          <ContextNav activeView={activeView} />
        </div>
        {activeModuleMaintenance && isSuperadmin ? (
          <div className="no-print mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-950 shadow-xs print:hidden">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="shrink-0 text-amber-700" />
              <span>
                โมดูล “{activeLabel}” กำลังปิดปรับปรุงสำหรับผู้ใช้ทั่วไป — คุณเข้าใช้งานและทดสอบได้ในสิทธิ์ SuperAdmin
              </span>
            </span>
            <button
              type="button"
              disabled={isReopeningModule}
              onClick={async () => {
                setIsReopeningModule(true);
                await setModuleMaintenanceStatus({ moduleKey: activeView, isUnderMaintenance: false });
                setIsReopeningModule(false);
              }}
              className="rounded-xl bg-amber-700 px-3 py-1.5 text-[11px] font-black text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {isReopeningModule ? 'กำลังเปิด...' : 'เปิดใช้งานโมดูลนี้ทันที'}
            </button>
          </div>
        ) : null}
        {activeModuleMaintenance && !isSuperadmin ? (
          <main className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-5 py-10">
            <div className="w-full rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                <Wrench size={28} aria-hidden="true" />
              </div>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                กำลังปิดปรับปรุงเฉพาะโมดูลนี้ชั่วคราว
              </span>
              <h1 className="mt-3 text-xl font-black text-slate-950">{activeLabel}</h1>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                {activeModuleMaintenance.message ||
                  'ทีมงานกำลังปรับปรุงโมดูลนี้เพื่อเพิ่มความแม่นยำและประสิทธิภาพ โมดูลอื่นในระบบยังสามารถใช้งานได้ตามปกติ'}
              </p>
              {activeModuleMaintenance.endsAt ? (
                <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700">
                  คาดว่าจะกลับมาใช้งานได้:{' '}
                  {new Intl.DateTimeFormat('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Bangkok',
                  }).format(new Date(activeModuleMaintenance.endsAt))}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <Link
                  to="/app/dashboard"
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-xs font-black text-white hover:bg-slate-800"
                >
                  <Home size={15} /> กลับหน้าหลัก
                </Link>
                <button
                  type="button"
                  onClick={() => void fetchActiveModuleMaintenance()}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw size={14} /> ตรวจสอบสถานะอีกครั้ง
                </button>
              </div>
            </div>
          </main>
        ) : (
          children
        )}
      </div>
      <div className="no-print print:hidden">
        <MobileNav activeView={activeView} navItems={navItems} />
        {session ? <SupportChat activeLabel={activeLabel} activeView={activeView} session={session} /> : null}
        <SetupGuideModal
          isOpen={isGuideOpen}
          onClose={() => setIsGuideOpen(false)}
          session={session}
        />
      </div>
    </div>
  );
}
