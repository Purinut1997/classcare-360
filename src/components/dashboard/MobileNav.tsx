import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Compass,
  Crown,
  FolderOpen,
  Home,
  LayoutGrid,
  Search,
  ServerCog,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { AppNavigationLink as Link } from '../navigation/ContextLink';
import { CuteCareyAvatar, type MascotAvatarType } from '../support/CuteCareyAvatar';
import { getVipBadgeInfo } from '../../lib/entitlements';
import type { AppNavItem } from '../../routes/appRoutes';
import {
  DAILY_NAV_KEYS,
  INTEGRATED_ALIAS_KEYS,
  MOBILE_BOTTOM_DOCK_KEYS,
  UNIFIED_NAV_GROUPS,
} from '../../routes/navigationGroups';
import type { AppSessionContext } from '../../types/core';

const groupToneStyles: Record<'emerald' | 'blue' | 'slate', string> = {
  emerald: 'bg-[#e6f4ec] text-[#1c573d]',
  blue: 'bg-sky-50 text-sky-700',
  slate: 'bg-slate-100 text-slate-600',
};

interface MobileNavProps {
  activeView: string;
  navItems: AppNavItem[];
  onOpenGuide?: () => void;
  session?: AppSessionContext;
}

export function MobileNav({ activeView, navItems, onOpenGuide, session }: MobileNavProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAllMenusOpen, setIsAllMenusOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');

  const isSuperadmin = session?.profile.role === 'superadmin';
  const vipBadgeInfo = session ? getVipBadgeInfo(session.subscription, session.profile.role) : null;

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

  // Fixed 5-Slot Bottom Dock Items
  const overviewItem = useMemo(
    () =>
      navItems.find((item) => item.key === MOBILE_BOTTOM_DOCK_KEYS.slot1) || {
        key: 'overview',
        label: 'วันนี้',
        icon: Home,
        path: '/app/dashboard',
        moduleKey: 'dashboard' as const,
      },
    [navItems],
  );

  const attendanceItem = useMemo(
    () =>
      navItems.find((item) => item.key === MOBILE_BOTTOM_DOCK_KEYS.slot2) || {
        key: 'teacher-work',
        label: 'เช็กชื่อ',
        icon: ClipboardList,
        path: '/app/dashboard?view=teacher-work',
        moduleKey: 'attendance' as const,
      },
    [navItems],
  );

  const studentsItem = useMemo(
    () =>
      navItems.find((item) => item.key === MOBILE_BOTTOM_DOCK_KEYS.slot4) || {
        key: 'students',
        label: 'นักเรียน',
        icon: Users,
        path: '/app/dashboard?view=students',
        moduleKey: 'students' as const,
      },
    [navItems],
  );

  const isItemActive = (key: string) =>
    key === activeView || (key === 'academic-year' && activeView === 'period-locks');

  const normalizedSearch = searchQuery.toLowerCase().trim();

  const dailyItems = useMemo(() => {
    const items = DAILY_NAV_KEYS
      .map((key) => navItems.find((item) => item.key === key))
      .filter((item): item is AppNavItem => Boolean(item));
    if (!normalizedSearch) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedSearch) ||
        item.key.toLowerCase().includes(normalizedSearch) ||
        (item.key === 'overview' && ('ภาพรวม'.includes(normalizedSearch) || 'หน้าแรก'.includes(normalizedSearch))),
    );
  }, [navItems, normalizedSearch]);

  const groupedSections = useMemo(() => {
    const knownKeys = new Set<string>([
      ...DAILY_NAV_KEYS,
      ...UNIFIED_NAV_GROUPS.flatMap((group) => group.itemKeys),
      ...INTEGRATED_ALIAS_KEYS,
      'superadmin-dashboard',
    ]);
    const ungroupedItems = navItems.filter((item) => !knownKeys.has(item.key));

    const sections = UNIFIED_NAV_GROUPS.map((group) => ({
      key: group.key as string,
      label: group.label,
      shortLabel: group.shortLabel,
      tone: group.tone,
      icon: group.icon,
      items: group.itemKeys
        .map((key) => navItems.find((item) => item.key === key))
        .filter((item): item is AppNavItem => Boolean(item)),
    }));

    if (ungroupedItems.length > 0) {
      sections.push({
        key: 'other',
        label: 'เมนูอื่น ๆ',
        shortLabel: 'อื่น ๆ',
        tone: 'slate',
        icon: FolderOpen,
        items: ungroupedItems,
      });
    }

    return sections
      .filter((section) => selectedCategory === 'all' || selectedCategory === section.key)
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!normalizedSearch) return true;
          return (
            item.label.toLowerCase().includes(normalizedSearch) ||
            item.key.toLowerCase().includes(normalizedSearch)
          );
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [navItems, normalizedSearch, selectedCategory]);

  const showDailySection = selectedCategory === 'all' && dailyItems.length > 0;

  const renderGridCard = (item: AppNavItem) => {
    const Icon = item.icon;
    const isActive = isItemActive(item.key);
    return (
      <Link
        key={item.key}
        externalUrl={item.externalUrl}
        to={item.path}
        onClick={() => setIsAllMenusOpen(false)}
        className={`flex min-h-[54px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
          isActive
            ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d] shadow-2xs'
            : 'border-[#dce3d7] bg-white text-[#1f2a22] hover:bg-[#fafbf8]'
        }`}
      >
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
            isActive ? 'bg-[#2f7d5b] text-white' : 'bg-[#edf1ea] text-[#4b594f]'
          }`}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-bold leading-snug line-clamp-2">
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* Unified Quick Launcher Bottom Sheet (ตรงกับโครงสร้าง Sidebar บน PC) */}
      {/* ========================================================================= */}
      {isAllMenusOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/45 transition-opacity duration-200 lg:hidden"
          onClick={() => setIsAllMenusOpen(false)}
        >
          <div
            className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_36px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

            {/* Sheet Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#2f7d5b]">ClassCare 360</p>
                <h3 className="font-display text-lg font-bold leading-tight text-[#1f2a22]">
                  เมนูทั้งหมด
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

            {/* Compact Workspace & Quick Info Strip */}
            {session?.workspace ? (
              <div className="mt-3 flex shrink-0 items-center gap-2">
                <Link
                  to="/app/select-workspace"
                  onClick={() => setIsAllMenusOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-[#dce3d7] bg-[#fafbf8] px-3 py-2 text-left transition hover:border-[#bfe0cd] hover:bg-[#eaf5ef]/60"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#eaf5ef] text-[#1c573d]">
                    <Building2 size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[#1f2a22]">
                      {session.workspace.schoolName || session.workspace.name}
                    </span>
                    <span className="block truncate text-[11px] font-medium text-[#6c7b70]">
                      ปี {session.workspace.academicYear || 'ปัจจุบัน'} · แตะเพื่อเปลี่ยนโรงเรียน
                    </span>
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-[#86948a]" aria-hidden="true" />
                </Link>

                {vipBadgeInfo?.isVip ? (
                  <Link
                    to="/app/package"
                    onClick={() => setIsAllMenusOpen(false)}
                    className="inline-flex h-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-3 text-amber-900"
                    title={vipBadgeInfo.tooltip}
                  >
                    <span className="inline-flex items-center gap-1 text-[11px] font-black">
                      <Crown size={12} className="text-amber-600" aria-hidden="true" />
                      VIP
                    </span>
                    <span className="text-[10px] font-bold text-amber-700">{vipBadgeInfo.daysText}</span>
                  </Link>
                ) : null}

                {onOpenGuide ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAllMenusOpen(false);
                      onOpenGuide();
                    }}
                    className="inline-flex h-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#bfe0cd] bg-[#eaf5ef] px-3 text-[#1c573d]"
                    title="เปิดคู่มือเริ่มต้นใช้งาน 5 ขั้นตอน"
                  >
                    <Compass size={15} aria-hidden="true" />
                    <span className="mt-0.5 text-[10px] font-bold">คู่มือ</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* Quick Search */}
            <div className="relative mt-2.5 shrink-0">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5b6a5f]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาเมนู เช่น เช็กชื่อ คะแนน ตารางสอน ปพ.5"
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

            {/* Unified 3-Group Category Filter Tabs */}
            <div className="-mx-4 mt-2.5 flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
                  selectedCategory === 'all'
                    ? 'border-[#1c342b] bg-[#1c342b] text-white'
                    : 'border-[#dce3d7] bg-white text-[#4b594f] hover:bg-[#fafbf8]'
                }`}
              >
                ทั้งหมด
              </button>
              {UNIFIED_NAV_GROUPS.map((group) => {
                const isActive = selectedCategory === group.key;
                const CategoryIcon = group.icon;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedCategory(group.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7d5b] ${
                      isActive
                        ? 'border-[#2f7d5b] bg-[#e6f4ec] text-[#1c573d]'
                        : 'border-[#dce3d7] bg-white text-[#4b594f] hover:bg-[#fafbf8]'
                    }`}
                  >
                    <CategoryIcon size={14} aria-hidden="true" />
                    <span>{group.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Flat 2-Column Touch Grid */}
            <div className="mt-1 min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pb-4 pr-0.5 touch-pan-y">
              {showDailySection && (
                <section aria-label="งานใช้ทุกวัน">
                  <p className="mb-2 px-0.5 text-xs font-extrabold text-[#1c573d]">
                    งานใช้ทุกวัน
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {dailyItems.map(renderGridCard)}
                  </div>
                </section>
              )}

              {groupedSections.map((section) => {
                const CategoryIcon = section.icon;
                return (
                  <section key={section.key} aria-label={section.label}>
                    <div className="mb-2 flex items-center gap-2 px-0.5">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${groupToneStyles[section.tone]}`}
                      >
                        <CategoryIcon size={13} aria-hidden="true" />
                      </span>
                      <p className="text-xs font-extrabold text-[#1f2924]">{section.label}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {section.items.map(renderGridCard)}
                    </div>
                  </section>
                );
              })}

              {isSuperadmin && !normalizedSearch ? (
                <section aria-label="ศูนย์ควบคุมระบบ">
                  <Link
                    to="/app/dashboard?view=superadmin-dashboard"
                    onClick={() => setIsAllMenusOpen(false)}
                    className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-[#bfe0cd] bg-[#eaf5ef]/70 px-3 py-2 text-[#1c573d]"
                  >
                    <ServerCog size={16} aria-hidden="true" />
                    <span className="text-xs font-bold">Superadmin — ศูนย์ควบคุมระบบ</span>
                  </Link>
                </section>
              ) : null}

              {!showDailySection && groupedSections.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
                  ไม่พบเมนู “{searchQuery}”
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* Fixed 5-Slot Bottom Dock (ตำแหน่งปุ่มคงที่ ไม่สลับเอง) */}
      {/* ========================================================================= */}
      <nav className="app-mobile-nav" aria-label="ทางลัดมือถือ">
        {/* Slot 1: วันนี้ */}
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
              <span className="truncate max-w-[56px]">วันนี้</span>
            </Link>
          );
        })()}

        {/* Slot 2: เช็กชื่อ */}
        {(() => {
          const Icon = attendanceItem.icon || ClipboardList;
          const isActive = activeView === 'teacher-work';
          return (
            <Link
              to={attendanceItem.path}
              className={isActive ? 'is-active' : ''}
              onClick={() => setIsAllMenusOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span className="truncate max-w-[56px]">เช็กชื่อ</span>
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
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#86efac]/60 via-[#2f7d5b]/50 to-[#f5a623]/40 opacity-50 blur-xs group-hover:opacity-90 transition-opacity" />

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

            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 z-20 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#c25970] px-1 text-[9px] font-bold text-white shadow">
                {unreadCount}
              </span>
            ) : null}

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

        {/* Slot 4: นักเรียน */}
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
              <span className="truncate max-w-[56px]">นักเรียน</span>
            </Link>
          );
        })()}

        {/* Slot 5: เมนู */}
        <button
          type="button"
          onClick={() => setIsAllMenusOpen((prev) => !prev)}
          className={`nav-item-btn ${isAllMenusOpen ? 'is-active' : ''}`}
          aria-label="เปิดเมนูทั้งหมด"
        >
          <LayoutGrid size={19} aria-hidden="true" />
          <span className="truncate max-w-[56px]">เมนู</span>
        </button>
      </nav>
    </>
  );
}
