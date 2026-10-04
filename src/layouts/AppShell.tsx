import { useEffect, useState, type ReactNode } from 'react';

import { ContextNav } from '../components/dashboard/ContextNav';
import { MobileNav } from '../components/dashboard/MobileNav';
import { Sidebar } from '../components/dashboard/Sidebar';
import { Topbar } from '../components/dashboard/Topbar';
import { GlobalBroadcastBanner } from '../components/system/GlobalBroadcastBanner';
import { SetupGuideModal } from '../components/guide/SetupGuideModal';
import { SupportChat } from '../components/support/SupportChat';
import type { AppNavItem } from '../routes/appRoutes';
import type { AppSessionContext } from '../types/core';

// Ensure the guide automatically pops up on initial system load/login
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
      return pref !== 'false';
    }
    return false;
  });
  const activeLabel = navItems.find((item) => item.key === activeView)?.label || 'ClassCare 360';

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
    <div className="app-shell theme-light">
      <div className="app-ambient-background no-print print:hidden" aria-hidden="true">
        <span className="app-ambient-orb app-ambient-orb-one" />
        <span className="app-ambient-orb app-ambient-orb-two" />
        <span className="app-ambient-orb app-ambient-orb-three" />
        <span className="app-ambient-mesh" />
      </div>
      <Sidebar
        activeView={activeView}
        isMobileOpen={isMenuOpen}
        navItems={navItems}
        onClose={() => setIsMenuOpen(false)}
        session={session}
      />
      <div className="app-shell-main">
        <div className="no-print print:hidden">
          <GlobalBroadcastBanner />
          <Topbar
            activeLabel={activeLabel}
            navItems={navItems}
            onMenuToggle={() => setIsMenuOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            session={session}
          />
          <ContextNav activeView={activeView} />
        </div>
        {children}
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
