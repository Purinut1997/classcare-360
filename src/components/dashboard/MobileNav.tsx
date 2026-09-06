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

interface MobileNavProps {
  activeView: string;
  navItems: AppNavItem[];
}

export function MobileNav({ activeView, navItems }: MobileNavProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAllMenusOpen, setIsAllMenusOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filtered items for Quick Launcher Sheet
  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const q = searchQuery.toLowerCase().trim();
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q)
    );
  }, [navItems, searchQuery]);

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
            className="relative max-h-[82dvh] w-full overflow-hidden rounded-t-[32px] border-t border-slate-200/90 bg-white/98 p-5 shadow-[0_-20px_50px_rgba(15,23,42,0.25)] backdrop-blur-2xl animate-in slide-in-from-bottom-6 duration-200"
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
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition"
              />
            </div>

            {/* All Modules Grid */}
            <div className="mt-4 max-h-[50dvh] overflow-y-auto pr-1 pb-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.key === activeView;
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      onClick={() => setIsAllMenusOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-98 ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-50/90 text-cyan-950 shadow-xs'
                          : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/80 text-slate-800'
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          isActive
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 shadow-2xs border border-slate-200/60'
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black truncate">{item.label}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">
                          {isActive ? '● กำลังเปิดอยู่' : 'แตะเพื่อเปิด'}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {filteredNavItems.length === 0 && (
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
