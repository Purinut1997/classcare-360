import { useEffect, useState, type ReactNode } from 'react';

import { ContextNav } from '../components/dashboard/ContextNav';
import { MobileNav } from '../components/dashboard/MobileNav';
import { Sidebar } from '../components/dashboard/Sidebar';
import { Topbar } from '../components/dashboard/Topbar';
import { SupportChat } from '../components/support/SupportChat';
import type { AppNavItem } from '../routes/appRoutes';
import type { AppSessionContext } from '../types/core';

interface AppShellProps {
  activeView: string;
  children: ReactNode;
  navItems: AppNavItem[];
  session?: AppSessionContext;
}

export function AppShell({ activeView, children, navItems, session }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'nexus'>(() => {
    return window.localStorage.getItem('classcare-theme') === 'light' ? 'light' : 'nexus';
  });
  const activeLabel = navItems.find((item) => item.key === activeView)?.label || 'ClassCare 360';

  // Close sidebar when navigating to a different view
  useEffect(() => {
    setIsMenuOpen(false);
  }, [activeView]);

  useEffect(() => {
    window.localStorage.setItem('classcare-theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className={`app-shell ${theme === 'nexus' ? 'theme-dark theme-nexus' : 'theme-light'}`}>
      <div className="app-ambient-background" aria-hidden="true">
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
        <Topbar
          activeLabel={activeLabel}
          navItems={navItems}
          onMenuToggle={() => setIsMenuOpen(true)}
          onThemeToggle={() => setTheme((current) => (current === 'nexus' ? 'light' : 'nexus'))}
          session={session}
          theme={theme}
        />
        <ContextNav activeView={activeView} />
        {children}
      </div>
      <MobileNav activeView={activeView} navItems={navItems} />
      {session ? <SupportChat activeLabel={activeLabel} activeView={activeView} session={session} /> : null}
    </div>
  );
}
