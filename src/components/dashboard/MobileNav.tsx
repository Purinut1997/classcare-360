import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  LayoutGrid,
  Search,
  Sparkles,
  X,
  Home,
  ChevronDown,
  ClipboardCheck,
  BookOpen,
  Heart,
  Wrench,
  Settings2,
  CircleHelp,
  FolderOpen,
} from 'lucide-react';
import { AppNavigationLink as Link } from '../navigation/ContextLink';
import { CuteCareyAvatar, type MascotAvatarType } from '../support/CuteCareyAvatar';
import type { AppNavItem } from '../../routes/appRoutes';

interface MobileCategoryConfig {
  key: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  itemKeys: string[];
  tone: string;
}

const MOBILE_CATEGORIES: MobileCategoryConfig[] = [
  {
    key: 'classroom-admin',
    label: 'งานประจำวันในห้องเรียน',
    shortLabel: 'งานห้องเรียน',
    icon: ClipboardCheck,
    itemKeys: [
      'students',
      'teacher-work',
      'student-health',
      'classroom-operations',
      'savings',
      'daily-brief',
      'notifications',
    ],
    tone: 'teal',
  },
  {
    key: 'academic',
    label: 'งานวิชาการ & วัดผล',
    shortLabel: 'วิชาการ',
    icon: BookOpen,
    itemKeys: [
      'schedule',
      'scores',
      'omr-scanner',
      'academic-hub',
      'reports',
    ],
    tone: 'blue',
  },
  {
    key: 'care',
    label: 'ดูแลช่วยเหลือนักเรียน',
    shortLabel: 'ดูแลนักเรียน',
    icon: Heart,
    itemKeys: [
      'behavior',
      'desirable-characteristics',
      'automation',
      'parent-access',
    ],
    tone: 'rose',
  },
  {
    key: 'tools',
    label: 'เครื่องมือช่วยสอน',
    shortLabel: 'เครื่องมือ',
    icon: Wrench,
    itemKeys: [
      'randomizer',
      'school-calendar',
    ],
    tone: 'amber',
  },
  {
    key: 'admin',
    label: 'ตั้งค่าโรงเรียน & ระบบ',
    shortLabel: 'ตั้งค่า',
    icon: Settings2,
    itemKeys: [
      'workspace-settings',
      'academic-year',
      'period-locks',
      'import-export',
      'data-safety',
      'setup',
      'audit',
      'superadmin-dashboard',
    ],
    tone: 'slate',
  },
  {
    key: 'support',
    label: 'บัญชีและความช่วยเหลือ',
    shortLabel: 'ช่วยเหลือ',
    icon: CircleHelp,
    itemKeys: ['help-center', 'package', 'workspace-switch'],
    tone: 'slate',
  },
];

const categoryToneStyles: Record<string, string> = {
  teal: 'bg-teal-50 text-teal-700',
  blue: 'bg-sky-50 text-sky-700',
  rose: 'bg-rose-50 text-rose-700',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
};

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
  const [expandedCategory, setExpandedCategory] = useState(() =>
    MOBILE_CATEGORIES.find((category) => category.itemKeys.includes(activeView))?.key ?? 'classroom-admin',
  );

  // Mascot avatar selection
  const [mascotType, setMascotType] = useState<MascotAvatarType>(() => {
    try {
      const saved = window.localStorage.getItem('classcare_ai_mascot_avatar') as MascotAvatarType;
      if (saved && ['bear', 'cat', 'bunny', 'girl', 'shiba'].includes(saved)) {
        return saved;
      }
    } catch {
      // Keep the default mascot when browser storage is unavailable.
    }
    return 'bear';
  });

  // Listen for AI chat state and unread count from SupportChat
  useEffect(() => {
    const handleChatState = (event: Event) => {
      const detail = (event as CustomEvent<{ isOpen?: boolean }>).detail;
      if (typeof detail?.isOpen === 'boolean') {
        setIsChatOpen(detail.isOpen);
      }
    };
    const handleUnread = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount?: number }>).detail;
      if (typeof detail?.unreadCount === 'number') {
        setUnreadCount(detail.unreadCount);
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
    const categories = [...MOBILE_CATEGORIES];
    const knownKeys = new Set(categories.flatMap((category) => category.itemKeys));
    const ungroupedItems = navItems.filter((item) => item.key !== 'overview' && !knownKeys.has(item.key));
    if (ungroupedItems.length > 0) {
      categories.push({
        key: 'other',
        label: 'เมนูอื่น ๆ',
        shortLabel: 'อื่น ๆ',
        icon: FolderOpen,
        itemKeys: ungroupedItems.map((item) => item.key),
        tone: 'slate',
      });
    }
    return categories.map((cat) => {
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

  return (
    <>
      {/* ========================================================================= */}
      {/* Quick Launcher Sheet (ศูนย์รวมเมนูและงานครูทั้งหมดบนมือถือ) */}
      {/* ========================================================================= */}
      {isAllMenusOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/45 transition-opacity duration-200 lg:hidden"
          onClick={() => setIsAllMenusOpen(false)}
        >
          <div
            className="relative max-h-[88dvh] w-full overflow-hidden rounded-t-[28px] border border-slate-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_36px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-4 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

            {/* Sheet Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#2f7d5b]">ClassCare 360</p>
                <h3 className="font-display text-lg font-bold leading-tight text-[#1f2a22]">
                  เมนูและงานครู
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAllMenusOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#dce3d7] bg-white text-[#5b6a5f] transition-colors hover:bg-[#fafbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b]"
                aria-label="ปิดเมนู"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative mt-3 shrink-0">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5b6a5f]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู เช่น เช็กชื่อ ตารางสอน คะแนน"
                className="h-11 w-full rounded-xl border border-[#dce3d7] bg-[#fafbf8] pl-10 pr-10 text-sm font-medium text-[#1f2a22] placeholder:text-[#7c897f] focus:border-[#2f7d5b] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2f7d5b]/15 transition-colors"
                aria-label="ค้นหาเมนู"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-[#5b6a5f] transition-colors hover:bg-[#edf1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b]"
                  aria-label="ล้างคำค้น"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="-mx-4 mt-3 flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
                  selectedCategory === 'all'
                    ? 'border-[#1c342b] bg-[#1c342b] text-white'
                    : 'border-[#dce3d7] bg-white text-[#4b594f] hover:bg-[#fafbf8]'
                }`}
              >
                ทุกหมวด
              </button>
              {MOBILE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                const CategoryIcon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.key);
                      setExpandedCategory(cat.key);
                    }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
                      isActive
                        ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d]'
                        : 'border-[#dce3d7] bg-white text-[#4b594f] hover:bg-[#fafbf8]'
                    }`}
                  >
                    <CategoryIcon size={14} aria-hidden="true" />
                    <span>{cat.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Categorized List */}
            <div className="mt-1 min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain pb-4 pr-0.5 touch-pan-y">
              {showOverviewItem && (
                <Link
                  to={overviewItem.path}
                  onClick={() => setIsAllMenusOpen(false)}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
                    activeView === 'overview'
                      ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d]'
                      : 'border-[#dce3d7] bg-white text-[#1f2a22] hover:bg-[#fafbf8]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${activeView === 'overview' ? 'bg-[#2f7d5b] text-white' : 'bg-[#edf1ea] text-[#5b6a5f]'}`}>
                      <Home size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">ภาพรวมและทางลัด</p>
                    </div>
                  </div>
                  {activeView === 'overview' ? <span className="shrink-0 text-xs font-semibold text-[#1c573d]">กำลังเปิด</span> : <ChevronDown size={16} className="-rotate-90 shrink-0 text-[#86948a]" aria-hidden="true" />}
                </Link>
              )}

              {categorizedSections.map(({ category: cat, items }) => (
                <section key={cat.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {(() => {
                    const CategoryIcon = cat.icon;
                    const isExpanded = expandedCategory === cat.key || selectedCategory === cat.key || Boolean(searchQuery.trim());
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandedCategory(isExpanded && selectedCategory === 'all' && !searchQuery.trim() ? '' : cat.key)}
                          aria-expanded={isExpanded}
                          aria-controls={`mobile-menu-${cat.key}`}
                          className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-700"
                        >
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${categoryToneStyles[cat.tone] ?? categoryToneStyles.slate}`}>
                            <CategoryIcon size={16} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-800">{cat.label}</span>
                            <span className="block text-[11px] text-slate-500">{items.length} เมนู</span>
                          </span>
                          <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                        {isExpanded && (
                          <div id={`mobile-menu-${cat.key}`} className="grid grid-cols-1 gap-1 border-t border-slate-100 bg-slate-50/60 p-2">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = item.key === activeView;
                      return (
                        <Link
                          key={item.key}
                          externalUrl={item.externalUrl}
                          to={item.path}
                          onClick={() => setIsAllMenusOpen(false)}
                          className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
                            isActive
                              ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d]'
                              : 'border-[#dce3d7] bg-white text-[#1f2a22] hover:bg-[#fafbf8]'
                          }`}
                        >
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                              isActive
                                ? 'bg-[#2f7d5b] text-white'
                                : 'bg-[#edf1ea] text-[#5b6a5f]'
                            }`}
                          >
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold leading-tight">{item.label}</p>
                          </div>
                          {isActive ? <span className="shrink-0 text-[10px] font-semibold text-[#1c573d]">กำลังเปิด</span> : <ChevronDown size={14} className="-rotate-90 shrink-0 text-[#86948a]" aria-hidden="true" />}
                        </Link>
                      );
                    })}
                  </div>
                        )}
                      </>
                    );
                  })()}
                </section>
              ))}

              {/* Empty state */}
              {!showOverviewItem && categorizedSections.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
                  ไม่พบเมนู “{searchQuery}”
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
            className="group relative -mt-6.5 flex h-14.5 w-14.5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#2f7d5b] via-[#3ea378] to-[#1c342b] p-0.5 text-white shadow-xl shadow-[#1c342b]/25 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* Subtle Botanical Ring */}
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#86efac]/60 via-[#2f7d5b]/50 to-[#f5a623]/40 opacity-50 blur-xs group-hover:opacity-90 transition-opacity" />

            {/* Center Inner Circle */}
            <div className="relative z-10 grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-[#2f7d5b] via-[#256649] to-[#1c342b] shadow-inner overflow-hidden">
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
                    className="absolute -top-1 -right-1 text-amber-200 drop-shadow"
                  />
                </div>
              )}
            </div>

            {/* Unread Message Badge */}
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-20 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#c25970] px-1 text-[9px] font-bold text-white shadow">
                {unreadCount}
              </span>
            ) : null}

            {/* AI Mini Badge */}
            <span className="absolute -bottom-1.5 z-20 rounded-full bg-[#1c342b] px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-[#d1fae5] shadow-xs border border-white/70">
              AI
            </span>
          </button>

          <span
            className={`mt-0.5 text-[8.5px] font-bold leading-none tracking-tight transition-colors ${
              isChatOpen ? 'text-[#2f7d5b] font-extrabold' : 'text-[#5b6a5f]'
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
