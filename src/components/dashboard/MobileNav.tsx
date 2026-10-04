import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  LayoutGrid,
  Search,
  Sparkles,
  X,
  Home,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { CuteCareyAvatar, type MascotAvatarType } from '../support/CuteCareyAvatar';
import type { AppNavItem } from '../../routes/appRoutes';

interface MobileCategoryConfig {
  key: string;
  label: string;
  icon: string;
  badge: string;
  itemKeys: string[];
  theme: {
    containerBg: string;
    containerBorder: string;
    iconBg: string;
    badgeBg: string;
    badgeText: string;
    titleColor: string;
    pillActive: string;
  };
}

const MOBILE_CATEGORIES: MobileCategoryConfig[] = [
  {
    key: 'classroom-admin',
    label: 'ธุรการชั้นเรียน',
    icon: '📁',
    badge: '⭐ 6 ภารกิจหลัก',
    itemKeys: [
      'students',
      'teacher-work',
      'student-health',
      'classroom-operations',
      'savings',
      'daily-brief',
    ],
    theme: {
      containerBg: 'bg-gradient-to-br from-emerald-50/70 via-teal-50/20 to-white',
      containerBorder: 'border-emerald-300/80 shadow-2xs shadow-emerald-500/5',
      iconBg: 'bg-emerald-600 text-white shadow-2xs shadow-emerald-600/30',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800 border-emerald-300',
      titleColor: 'text-emerald-950',
      pillActive: 'bg-emerald-600 text-white ring-2 ring-emerald-600/25',
    },
  },
  {
    key: 'academic',
    label: 'งานวิชาการ & วัดผล',
    icon: '📚',
    badge: '5 เมนู',
    itemKeys: [
      'schedule',
      'scores',
      'omr-scanner',
      'academic-hub',
      'reports',
    ],
    theme: {
      containerBg: 'bg-gradient-to-br from-sky-50/70 via-blue-50/20 to-white',
      containerBorder: 'border-sky-300/80 shadow-2xs shadow-sky-500/5',
      iconBg: 'bg-sky-600 text-white shadow-2xs shadow-sky-600/30',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-800 border-sky-300',
      titleColor: 'text-sky-950',
      pillActive: 'bg-sky-600 text-white ring-2 ring-sky-600/25',
    },
  },
  {
    key: 'care',
    label: 'ดูแลช่วยเหลือนักเรียน',
    icon: '💖',
    badge: '3 เมนู',
    itemKeys: [
      'behavior',
      'desirable-characteristics',
      'automation',
    ],
    theme: {
      containerBg: 'bg-gradient-to-br from-rose-50/70 via-pink-50/20 to-white',
      containerBorder: 'border-rose-300/80 shadow-2xs shadow-rose-500/5',
      iconBg: 'bg-rose-500 text-white shadow-2xs shadow-rose-500/30',
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-800 border-rose-300',
      titleColor: 'text-rose-950',
      pillActive: 'bg-rose-600 text-white ring-2 ring-rose-600/25',
    },
  },
  {
    key: 'tools',
    label: 'เครื่องมือช่วยสอน',
    icon: '🛠️',
    badge: '2 เมนู',
    itemKeys: [
      'randomizer',
      'school-calendar',
    ],
    theme: {
      containerBg: 'bg-gradient-to-br from-amber-50/70 via-yellow-50/20 to-white',
      containerBorder: 'border-amber-300/80 shadow-2xs shadow-amber-500/5',
      iconBg: 'bg-amber-500 text-white shadow-2xs shadow-amber-500/30',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800 border-amber-300',
      titleColor: 'text-amber-950',
      pillActive: 'bg-amber-600 text-white ring-2 ring-amber-600/25',
    },
  },
  {
    key: 'admin',
    label: 'ตั้งค่าโรงเรียน & ระบบ',
    icon: '⚙️',
    badge: '4 เมนู',
    itemKeys: [
      'workspace-settings',
      'academic-year',
      'import-export',
      'data-safety',
    ],
    theme: {
      containerBg: 'bg-gradient-to-br from-slate-100/90 via-slate-50/40 to-white',
      containerBorder: 'border-slate-300/90 shadow-2xs shadow-slate-500/5',
      iconBg: 'bg-slate-700 text-white shadow-2xs shadow-slate-700/30',
      badgeBg: 'bg-slate-200',
      badgeText: 'text-slate-800 border-slate-300',
      titleColor: 'text-slate-900',
      pillActive: 'bg-slate-800 text-white ring-2 ring-slate-800/25',
    },
  },
];

interface MobileNavProps {
  activeView: string;
  navItems: AppNavItem[];
}

export function MobileNav({ activeView, navItems }: MobileNavProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAllMenusOpen, setIsAllMenusOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');

  // Mascot avatar selection
  const [mascotType, setMascotType] = useState<MascotAvatarType>(() => {
    try {
      const saved = window.localStorage.getItem('classcare_ai_mascot_avatar') as MascotAvatarType;
      if (saved && ['bear', 'cat', 'bunny', 'girl', 'shiba'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'bear';
  });

  // Listen for AI chat state and unread count from SupportChat
  useEffect(() => {
    const handleChatState = (e: any) => {
      if (typeof e.detail?.isOpen === 'boolean') {
        setIsChatOpen(e.detail.isOpen);
      }
    };
    const handleUnread = (e: any) => {
      if (typeof e.detail?.unreadCount === 'number') {
        setUnreadCount(e.detail.unreadCount);
      }
    };
    const handleStorage = () => {
      const saved = window.localStorage.getItem('classcare_ai_mascot_avatar') as MascotAvatarType;
      if (saved && ['bear', 'cat', 'bunny', 'girl', 'shiba'].includes(saved)) {
        setMascotType(saved);
      }
    };

    window.addEventListener('classcare:ai-chat-state-changed', handleChatState);
    window.addEventListener('classcare:ai-unread-changed', handleUnread);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('classcare:ai-chat-state-changed', handleChatState);
      window.removeEventListener('classcare:ai-unread-changed', handleUnread);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Close All Menus sheet on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAllMenusOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle AI Chatbot
  const handleToggleAiChat = () => {
    setIsAllMenusOpen(false);
    window.dispatchEvent(new CustomEvent('classcare:toggle-ai-chat'));
  };

  // 1. Overview item
  const overviewItem = useMemo(() => {
    return (
      navItems.find((item) => item.key === 'overview') || {
        key: 'overview',
        label: 'ภาพรวม',
        icon: LayoutDashboard,
        path: '/app/dashboard',
        moduleKey: 'dashboard' as const,
      }
    );
  }, [navItems]);

  // 2. Students item
  const studentsItem = useMemo(() => {
    return (
      navItems.find((item) => item.key === 'students') || {
        key: 'students',
        label: 'นักเรียน',
        icon: Users,
        path: '/app/dashboard?view=students',
        moduleKey: 'students' as const,
      }
    );
  }, [navItems]);

  // 4. Contextual Item: if current active view is not overview/students, show it in slot 4!
  // Otherwise default to schedule
  const contextualItem = useMemo(() => {
    if (activeView !== 'overview' && activeView !== 'students') {
      const current = navItems.find((item) => item.key === activeView);
      if (current) return current;
    }
    return (
      navItems.find((item) => item.key === 'schedule') ||
      navItems.find((item) => item.key === 'teacher-work') || {
        key: 'schedule',
        label: 'ตารางสอน',
        icon: LayoutGrid,
        path: '/app/dashboard?view=schedule',
        moduleKey: 'attendance' as const,
      }
    );
  }, [navItems, activeView]);

  // Filtered categorized sections for Quick Launcher Sheet
  const categorizedSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return MOBILE_CATEGORIES.map((cat) => {
      if (selectedCategory !== 'all' && selectedCategory !== cat.key) {
        return null;
      }
      const items = cat.itemKeys
        .map((key) => navItems.find((item) => item.key === key))
        .filter((item): item is AppNavItem => Boolean(item))
        .filter((item) => {
          if (!q) return true;
          return (
            item.label.toLowerCase().includes(q) ||
            item.key.toLowerCase().includes(q)
          );
        });
      if (items.length === 0) return null;
      return { category: cat, items };
    }).filter((s): s is { category: MobileCategoryConfig; items: AppNavItem[] } => Boolean(s));
  }, [navItems, searchQuery, selectedCategory]);

  // Check if overview item matches search or all
  const showOverviewItem = useMemo(() => {
    if (selectedCategory !== 'all') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      overviewItem.label.toLowerCase().includes(q) ||
      overviewItem.key.toLowerCase().includes(q) ||
      'หน้าแรก'.includes(q) ||
      'ภาพรวม'.includes(q) ||
      'dashboard'.includes(q)
    );
  }, [selectedCategory, searchQuery, overviewItem]);

  // Utility items (notifications, help)
  const utilityItems = useMemo(() => {
    if (selectedCategory !== 'all') return [];
    const q = searchQuery.toLowerCase().trim();
    return ['notifications', 'help-center']
      .map((key) => navItems.find((item) => item.key === key))
      .filter((item): item is AppNavItem => Boolean(item))
      .filter((item) => {
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q)
        );
      });
  }, [navItems, searchQuery, selectedCategory]);

  return (
    <>
      {/* ========================================================================= */}
      {/* Quick Launcher Sheet (ศูนย์รวมเมนูและงานครูทั้งหมดบนมือถือ) */}
      {/* ========================================================================= */}
      {isAllMenusOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 lg:hidden"
          onClick={() => setIsAllMenusOpen(false)}
        >
          <div
            className="relative max-h-[85dvh] w-full overflow-hidden rounded-t-[32px] border-t border-slate-200/90 bg-white/98 p-5 shadow-[0_-20px_50px_rgba(15,23,42,0.25)] backdrop-blur-2xl animate-in slide-in-from-bottom-6 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600">
                  ClassCare 360 Mobile
                </p>
                <h3 className="text-lg font-black text-slate-950">
                  ศูนย์รวมเมนูและงานครู
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAllMenusOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-slate-100/80 text-slate-600 transition hover:bg-slate-200"
                aria-label="ปิดเมนู"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative mt-3">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู (เช่น คะแนน, ปฏิทิน, ตารางสอน, ข้อสอบ)..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-slate-600 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 px-1 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-black transition active:scale-95 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                🌟 ทุกหมวด
              </button>
              {MOBILE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-black transition active:scale-95 ${
                      isActive
                        ? cat.theme.pillActive
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Categorized List */}
            <div className="mt-3.5 flex-1 overflow-y-auto pr-1 pb-6 space-y-3.5 max-h-[52dvh]">
              {/* 🏠 1. Overview Hero Banner */}
              {showOverviewItem && (
                <Link
                  to={overviewItem.path}
                  onClick={() => setIsAllMenusOpen(false)}
                  className={`flex items-center justify-between rounded-2xl border p-3 transition active:scale-98 ${
                    activeView === 'overview'
                      ? 'border-cyan-500 bg-cyan-50/90 text-cyan-950 font-black ring-2 ring-cyan-500/20'
                      : 'border-slate-200/90 bg-gradient-to-r from-slate-50 to-white hover:bg-slate-100 text-slate-800 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        activeView === 'overview'
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'bg-slate-900 text-white shadow-2xs'
                      }`}
                    >
                      <Home size={17} />
                    </span>
                    <div>
                      <p className="text-xs font-black">ภาพรวม & ศูนย์รวมทางลัด</p>
                      <p className="text-[10px] font-bold text-slate-400">Overview Dashboard & Shortcut Hub</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-cyan-700">
                    {activeView === 'overview' ? '● กำลังเปิดอยู่' : 'เปิด →'}
                  </span>
                </Link>
              )}

              {/* 📁 2-6. Categorized Sections in Colored Container Frames */}
              {categorizedSections.map(({ category: cat, items }) => (
                <div
                  key={cat.key}
                  className={`rounded-2xl border-2 ${cat.theme.containerBorder} ${cat.theme.containerBg} p-3 sm:p-3.5 transition-all`}
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-black/5">
                    <div className="flex items-center gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${cat.theme.iconBg} text-sm`}>
                        {cat.icon}
                      </span>
                      <span className={`text-xs font-black ${cat.theme.titleColor}`}>
                        {cat.label}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${cat.theme.badgeBg} ${cat.theme.badgeText}`}>
                        {cat.badge}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">
                      {items.length} เมนู
                    </span>
                  </div>

                  {/* 2-column menu grid inside frame */}
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.key === activeView;
                      return (
                        <Link
                          key={item.key}
                          to={item.path}
                          onClick={() => setIsAllMenusOpen(false)}
                          className={`flex items-center gap-2 rounded-xl border p-2 text-left transition active:scale-98 ${
                            isActive
                              ? 'border-cyan-500 bg-white text-cyan-950 shadow-xs font-black ring-2 ring-cyan-500/20'
                              : 'border-white/80 bg-white/95 hover:bg-white text-slate-800 shadow-2xs'
                          }`}
                        >
                          <span
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                              isActive
                                ? 'bg-cyan-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 border border-slate-200/60'
                            }`}
                          >
                            <Icon size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black truncate leading-tight">{item.label}</p>
                            <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">
                              {isActive ? '● กำลังเปิดอยู่' : 'แตะเพื่อเปิด'}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Utility row at bottom */}
              {utilityItems.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  {utilityItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.key === activeView;
                    return (
                      <Link
                        key={item.key}
                        to={item.path}
                        onClick={() => setIsAllMenusOpen(false)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-2 text-left transition ${
                          isActive
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-950 font-black'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={14} />
                        <span className="text-[11px] font-bold truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {!showOverviewItem && categorizedSections.length === 0 && utilityItems.length === 0 && (
                <div className="py-8 text-center text-xs font-bold text-slate-400">
                  ไม่พบเมนูที่ค้นหา "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* 5-Slot Bottom Dock with Center AI Mascot FAB */}
      {/* ========================================================================= */}
      <nav className="app-mobile-nav" aria-label="ทางลัดมือถือ">
        {/* Slot 1: ภาพรวม */}
        {(() => {
          const Icon = overviewItem.icon || Home;
          const isActive = activeView === 'overview';
          return (
            <Link
              to={overviewItem.path}
              className={isActive ? 'is-active' : ''}
              onClick={() => setIsAllMenusOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span className="truncate max-w-[56px]">{overviewItem.label}</span>
            </Link>
          );
        })()}

        {/* Slot 2: นักเรียน */}
        {(() => {
          const Icon = studentsItem.icon || Users;
          const isActive = activeView === 'students';
          return (
            <Link
              to={studentsItem.path}
              className={isActive ? 'is-active' : ''}
              onClick={() => setIsAllMenusOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span className="truncate max-w-[56px]">{studentsItem.label}</span>
            </Link>
          );
        })()}

        {/* Slot 3: CENTER HERO ACTION (น้องแคร์ AI Chatbot Button) */}
        <div className="relative flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={handleToggleAiChat}
            aria-label="ผู้ช่วยครูอัจฉริยะ น้องแคร์ AI"
            className="group relative -mt-6.5 flex h-14.5 w-14.5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-amber-300 via-sky-400 to-indigo-600 p-0.5 text-white shadow-xl shadow-sky-950/30 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* Breathing Neon Aura Ring */}
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-pink-400 via-sky-400 to-amber-300 opacity-60 blur-xs animate-pulse group-hover:opacity-100 transition-opacity" />

            {/* Center Inner Circle */}
            <div className="relative z-10 grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-sky-400 via-sky-500 to-indigo-600 shadow-inner overflow-hidden">
              {isChatOpen ? (
                <X size={24} className="text-white drop-shadow" />
              ) : (
                <div className="relative grid place-items-center">
                  <CuteCareyAvatar
                    type={mascotType}
                    size={35}
                    className="drop-shadow-sm"
                  />
                  <Sparkles
                    size={12}
                    className="absolute -top-1 -right-1 text-amber-300 animate-bounce drop-shadow"
                  />
                </div>
              )}
            </div>

            {/* Unread Message Badge */}
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-20 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-black text-white shadow">
                {unreadCount}
              </span>
            ) : null}

            {/* Illuminated AI Mini Badge */}
            <span className="absolute -bottom-1.5 z-20 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider text-white shadow-xs border border-white/60">
              AI
            </span>
          </button>

          <span
            className={`mt-0.5 text-[8.5px] font-black leading-none tracking-tight transition-colors ${
              isChatOpen ? 'text-cyan-600 font-extrabold' : 'text-slate-600'
            }`}
          >
            {isChatOpen ? 'ปิดแชท' : 'น้องแคร์ AI'}
          </span>
        </div>

        {/* Slot 4: Contextual Active Item / Schedule */}
        {(() => {
          const Icon = contextualItem.icon || LayoutGrid;
          const isActive =
            activeView === contextualItem.key &&
            activeView !== 'overview' &&
            activeView !== 'students';
          return (
            <Link
              to={contextualItem.path}
              className={isActive ? 'is-active' : ''}
              onClick={() => setIsAllMenusOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span className="truncate max-w-[56px]">{contextualItem.label}</span>
            </Link>
          );
        })()}

        {/* Slot 5: เมนูทั้งหมด */}
        <button
          type="button"
          onClick={() => setIsAllMenusOpen((prev) => !prev)}
          className={`nav-item-btn ${isAllMenusOpen ? 'is-active' : ''}`}
          aria-label="เปิดศูนย์รวมเมนูทั้งหมด"
        >
          <LayoutGrid size={19} aria-hidden="true" />
          <span className="truncate max-w-[56px]">เมนูทั้งหมด</span>
        </button>
      </nav>
    </>
  );
}
