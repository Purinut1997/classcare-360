import { Link } from 'react-router-dom';

import type { AppNavItem } from '../../routes/appRoutes';

interface MobileNavProps {
  activeView: string;
  navItems: AppNavItem[];
}

export function MobileNav({ activeView, navItems }: MobileNavProps) {
  const preferredKeys = ['overview', 'students', 'teacher-work', 'reports'];
  const primaryItems = preferredKeys
    .map((key) => navItems.find((item) => item.key === key))
    .filter((item): item is AppNavItem => Boolean(item));
  const activeItem = navItems.find((item) => item.key === activeView);
  const visibleItems =
    activeItem && !primaryItems.some((item) => item.key === activeItem.key)
      ? [...primaryItems.slice(0, 3), activeItem]
      : primaryItems;

  return (
    <nav className="app-mobile-nav" aria-label="ทางลัดมือถือ">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeView;

        return (
          <Link
            className={isActive ? 'is-active' : ''}
            to={item.path}
            key={item.key}
          >
            <Icon size={18} aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
