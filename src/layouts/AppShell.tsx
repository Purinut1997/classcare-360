import type { ReactNode } from 'react';

import { SignOutButton } from '../components/auth/SignOutButton';
import { MobileNav } from '../components/dashboard/MobileNav';
import { Sidebar } from '../components/dashboard/Sidebar';
import type { AppNavItem } from '../routes/appRoutes';
import type { AppSessionContext } from '../types/core';

interface AppShellProps {
  activeView: string;
  children: ReactNode;
  navItems: AppNavItem[];
  session?: AppSessionContext;
}

export function AppShell({ activeView, children, navItems, session }: AppShellProps) {
  return (
    <div className="classcare-grid-bg min-h-screen overflow-hidden text-slate-950">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-24 border-b border-[#ead8bd]/70 bg-[#fffaf4]/85 backdrop-blur-xl" />
      <div className="pointer-events-none fixed right-[-180px] top-28 z-0 h-96 w-96 rounded-full border border-[#ead8bd]/50 bg-[#fff4d6]/25" />
      <div className="fixed right-4 top-4 z-30 hidden lg:block">
        <SignOutButton />
      </div>
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar activeView={activeView} navItems={navItems} session={session} />
        {children}
      </div>

      <MobileNav activeView={activeView} navItems={navItems} />
    </div>
  );
}
