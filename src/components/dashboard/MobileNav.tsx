import { Link } from 'react-router-dom';

import type { AppNavItem } from '../../routes/appRoutes';

interface MobileNavProps {
  activeView: string;
  navItems: AppNavItem[];
}

export function MobileNav({ activeView, navItems }: MobileNavProps) {
  return (
    <nav className="app-mobile-nav fixed inset-x-3 bottom-3 z-30 grid auto-cols-[76px] grid-flow-col overflow-x-auto rounded-3xl border border-white/80 bg-white/90 p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeView;

        return (
          <Link
            className={`grid h-14 place-items-center rounded-2xl text-[11px] font-black transition ${
              isActive ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.28)]' : 'text-slate-500'
            }`}
            to={item.path}
            key={item.label}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
