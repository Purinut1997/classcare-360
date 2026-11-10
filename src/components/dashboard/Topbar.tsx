import { Activity, Bell, Building2, Check, ChevronDown, Compass, Menu, Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { isDemoSession, withDemoContext } from '../../lib/auth';
import { supabase } from '../../lib/supabaseClient';
import { roleLabels } from '../../lib/roles';
import type { AppSessionContext } from '../../types/core';
import { SignOutButton } from '../auth/SignOutButton';
import { GlobalSearch } from './GlobalSearch';
import type { AppNavItem } from '../../routes/appRoutes';

interface TopbarProps {
  activeLabel: string;
  navItems: AppNavItem[];
  onMenuToggle: () => void;
  onOpenGuide?: () => void;
  session?: AppSessionContext;
}

function getInitials(displayName?: string) {
  const words = (displayName || 'ผู้ใช้').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function Topbar({ activeLabel, navItems, onMenuToggle, onOpenGuide, session }: TopbarProps) {
  const location = useLocation();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationCollapsed, setIsNotificationCollapsed] = useState(false);
  const [notificationItems, setNotificationItems] = useState<Array<{ id: string; title: string; body: string; created_at: string; read_at: string | null; type: string }>>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const workspaceId = session?.workspace?.id || '';
  const notificationsPath = withDemoContext('/app/dashboard?view=notifications', location.search);
  const settingsPath = `${notificationsPath}${notificationsPath.includes('?') ? '&' : '?'}tab=settings`;
  const activityPath = `${notificationsPath}${notificationsPath.includes('?') ? '&' : '?'}tab=activity`;

  useEffect(() => {
    if (!isNotificationOpen || !session || !workspaceId) return;
    let isCurrent = true;
    setIsNotificationsLoading(true);
    if (isDemoSession(session) || !supabase) {
      setNotificationItems([]);
      setIsNotificationsLoading(false);
      return;
    }
    void supabase.from('notifications')
      .select('id,title,body,created_at,read_at,type')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', session.profile.id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (isCurrent) setNotificationItems((data || []) as typeof notificationItems);
      })
      .then(
        () => { if (isCurrent) setIsNotificationsLoading(false); },
        () => { if (isCurrent) setIsNotificationsLoading(false); },
      );
    return () => { isCurrent = false; };
  }, [isNotificationOpen, session, workspaceId]);

  useEffect(() => {
    if (!isNotificationOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !notificationPanelRef.current?.contains(event.target)) setIsNotificationOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsNotificationOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isNotificationOpen]);
  const workspace = session?.workspace;
  const canSwitchWorkspace = session?.profile.role === 'superadmin' || (session?.workspaceCount ?? 0) > 1;
  const workspaceSummary = (
    <>
      <span className="app-workspace-icon">
        <Building2 size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-black text-slate-900">
          {workspace?.schoolName || session?.profile.schoolName || 'ClassCare 360'}
        </span>
        <span className="block truncate text-[11px] font-bold text-slate-500">
          {workspace ? `${workspace.classroomName} · ${workspace.academicYear}` : 'พื้นที่ทำงานหลัก'}
        </span>
      </span>
    </>
  );

  return (
    <header className="app-topbar">
      <button
        className="app-icon-button lg:hidden"
        aria-label="เปิดเมนูหลัก"
        onClick={onMenuToggle}
        type="button"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {canSwitchWorkspace ? (
        <Link
          className="app-workspace-switcher"
          to={withDemoContext('/app/select-workspace', location.search)}
          title={workspace ? `${workspace.schoolName} · ${workspace.classroomName}` : 'เลือกโรงเรียนหรือห้องเรียน'}
        >
          {workspaceSummary}
        </Link>
      ) : (
        <div
          className="app-workspace-switcher cursor-default"
          title={workspace ? `${workspace.schoolName} · ${workspace.classroomName}` : 'พื้นที่ทำงานหลัก'}
        >
          {workspaceSummary}
        </div>
      )}

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm font-black text-slate-800">{activeLabel}</p>
        <p className="truncate text-[11px] font-bold text-slate-500">พื้นที่ทำงานปัจจุบัน</p>
      </div>

      <GlobalSearch navItems={navItems} session={session} />

      {onOpenGuide && (
        <button
          type="button"
          onClick={onOpenGuide}
          className="group relative flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-teal-600 px-3 py-1.5 text-xs font-black text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/20 transition-all hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105 active:scale-95"
          title="เปิดตัวนำทางการใช้งานระบบ ClassCare 360 (5 ขั้นตอน)"
        >
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-200" />
          <Compass size={15} className="text-cyan-200 transition-transform duration-300 group-hover:rotate-45" />
          <span className="hidden sm:inline">ตัวนำทางการใช้งาน</span>
        </button>
      )}

      <div className="relative shrink-0" ref={notificationPanelRef}>
        <button
          className="app-icon-button relative"
          aria-label="เปิดรายการแจ้งเตือน"
          aria-expanded={isNotificationOpen}
          aria-haspopup="dialog"
          onClick={() => { setIsNotificationOpen((open) => !open); setIsNotificationCollapsed(false); }}
          type="button"
        >
          <Bell size={19} aria-hidden="true" />
          {notificationItems.some((item) => !item.read_at) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
        </button>
        {isNotificationOpen && (
          <section className={`topbar-notification-panel ${isNotificationCollapsed ? 'is-collapsed' : ''}`} role="dialog" aria-label="รายการแจ้งเตือน">
            <div className="topbar-notification-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800"><Bell size={19} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">แจ้งเตือนของฉัน</p>
                  <p className="text-xs font-semibold text-slate-500">{notificationItems.filter((item) => !item.read_at).length} รายการที่ยังไม่ได้อ่าน</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button className="topbar-notification-icon" type="button" aria-label={isNotificationCollapsed ? 'ขยายรายการแจ้งเตือน' : 'ย่อรายการแจ้งเตือน'} onClick={() => setIsNotificationCollapsed((collapsed) => !collapsed)}>
                  <ChevronDown size={17} className={isNotificationCollapsed ? '-rotate-90' : ''} aria-hidden="true" />
                </button>
                <button className="topbar-notification-icon" type="button" aria-label="ปิดรายการแจ้งเตือน" onClick={() => setIsNotificationOpen(false)}><X size={17} aria-hidden="true" /></button>
              </div>
            </div>
            {!isNotificationCollapsed && <>
              <div className="topbar-notification-list">
                {isNotificationsLoading ? <p className="topbar-notification-empty">กำลังโหลดแจ้งเตือน…</p> : notificationItems.length ? notificationItems.map((item) => (
                  <Link className={`topbar-notification-item ${item.read_at ? '' : 'is-unread'}`} key={item.id} to={notificationsPath} onClick={() => setIsNotificationOpen(false)}>
                    <span className={`topbar-notification-mark ${item.read_at ? 'is-read' : ''}`}>{item.read_at ? <Check size={14} /> : <Bell size={14} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-800">{item.title}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{item.body}</span>
                      <span className="mt-1 block text-[10px] font-bold text-slate-400">{new Date(item.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </span>
                  </Link>
                )) : <div className="topbar-notification-empty"><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400"><Bell size={18} /></span><span className="block font-bold text-slate-700">ยังไม่มีรายการแจ้งเตือน</span><span className="mt-1 block text-xs">เมื่อมีข้อมูลใหม่ จะแสดงไว้ที่นี่</span></div>}
              </div>
              <div className="topbar-notification-footer">
                <Link to={notificationsPath} onClick={() => setIsNotificationOpen(false)}><Bell size={14} aria-hidden="true" /> กล่องแจ้งเตือน</Link>
                <Link to={activityPath} onClick={() => setIsNotificationOpen(false)}><Activity size={14} aria-hidden="true" /> ความเคลื่อนไหว</Link>
                <Link className="topbar-notification-settings" to={settingsPath} onClick={() => setIsNotificationOpen(false)}><Settings2 size={14} aria-hidden="true" /> ตั้งค่า</Link>
              </div>
            </>}
          </section>
        )}
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-100 text-xs font-black text-cyan-800">
          {getInitials(session?.profile.displayName)}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block max-w-40 truncate text-xs font-black text-slate-900">
            {session?.profile.displayName || 'ผู้ใช้งาน'}
          </span>
          <span className="block max-w-40 truncate text-[10px] font-bold text-slate-500">
            {session ? roleLabels[session.profile.role] : 'ผู้ใช้งาน'}
          </span>
        </span>
      </div>

      <SignOutButton className="app-signout-button" />
    </header>
  );
}
