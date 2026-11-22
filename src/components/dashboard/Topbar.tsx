import { Activity, Bell, Check, ChevronDown, CloudOff, Crown, RefreshCw, Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { isDemoSession, withDemoContext } from '../../lib/auth';
import { getVipBadgeInfo } from '../../lib/entitlements';
import { flushOfflineQueue, getOfflineQueue, subscribeOfflineQueue } from '../../lib/offlineSyncQueue';
import { supabase } from '../../lib/supabaseClient';
import { roleLabels } from '../../lib/roles';
import type { AppSessionContext } from '../../types/core';
import { SignOutButton } from '../auth/SignOutButton';
import { GlobalSearch } from './GlobalSearch';
import type { AppNavItem } from '../../routes/appRoutes';

interface TopbarProps {
  activeLabel: string;
  navItems: AppNavItem[];
  onMenuToggle?: () => void;
  onOpenGuide?: () => void;
  session?: AppSessionContext;
}

function getInitials(displayName?: string) {
  const words = (displayName || 'ผู้ใช้').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export function Topbar({ activeLabel, navItems, session }: TopbarProps) {
  const location = useLocation();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isNotificationCollapsed, setIsNotificationCollapsed] = useState(false);
  const [notificationItems, setNotificationItems] = useState<Array<{ id: string; title: string; body: string; created_at: string; read_at: string | null; type: string }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const workspaceId = session?.workspace?.id || '';
  const notificationsPath = withDemoContext('/app/dashboard?view=notifications', location.search);
  const settingsPath = `${notificationsPath}${notificationsPath.includes('?') ? '&' : '?'}tab=settings`;
  const activityPath = `${notificationsPath}${notificationsPath.includes('?') ? '&' : '?'}tab=activity`;

  const syncOfflineNow = async () => {
    if (!supabase || !workspaceId || !session || isDemoSession(session) || isSyncingOffline) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setIsSyncingOffline(true);
    try {
      const res = await flushOfflineQueue(supabase, workspaceId);
      setPendingOfflineCount(res.remaining);
    } finally {
      setIsSyncingOffline(false);
    }
  };

  useEffect(() => {
    const refreshQueue = () => {
      setPendingOfflineCount(workspaceId ? getOfflineQueue(workspaceId).length : 0);
    };
    refreshQueue();
    const unsubQueue = subscribeOfflineQueue(refreshQueue);

    const handleOnline = () => {
      setIsOnline(true);
      if (supabase && workspaceId && session && !isDemoSession(session)) {
        setIsSyncingOffline(true);
        void flushOfflineQueue(supabase, workspaceId)
          .then((res) => setPendingOfflineCount(res.remaining))
          .finally(() => setIsSyncingOffline(false));
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && navigator.onLine && workspaceId && getOfflineQueue(workspaceId).length > 0 && supabase && session && !isDemoSession(session)) {
      setIsSyncingOffline(true);
      void flushOfflineQueue(supabase, workspaceId)
        .then((res) => setPendingOfflineCount(res.remaining))
        .finally(() => setIsSyncingOffline(false));
    }

    return () => {
      unsubQueue();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session, workspaceId]);

  // Proactively check unread notification count so red bell indicator lights up before clicking
  useEffect(() => {
    if (!session || !workspaceId || isDemoSession(session) || !supabase) {
      setUnreadCount(0);
      return;
    }
    const client = supabase;
    let isCurrent = true;
    const refreshUnreadCount = async () => {
      try {
        const { count, error } = await client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('profile_id', session.profile.id)
          .is('read_at', null);
        if (isCurrent && !error && typeof count === 'number') {
          setUnreadCount(count);
        }
      } catch {
        // non-blocking
      }
    };
    void refreshUnreadCount();
    const timer = window.setInterval(refreshUnreadCount, 60_000);
    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, [session, workspaceId]);

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
        if (isCurrent) {
          const rows = (data || []) as typeof notificationItems;
          setNotificationItems(rows);
          const loadedUnread = rows.filter((item) => !item.read_at).length;
          if (loadedUnread > unreadCount) setUnreadCount(loadedUnread);
        }
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
  const displayLabel = activeLabel === 'ภาพรวม' ? 'วันนี้' : activeLabel;
  const vipInfo = session ? getVipBadgeInfo(session.subscription, session.profile.role) : null;

  return (
    <header className="app-topbar">
      <div className="min-w-0 flex items-center gap-2.5">
        <h1 className="truncate font-display text-base font-extrabold tracking-tight text-[#1f2924] sm:text-[17px]">
          {displayLabel}
        </h1>
      </div>

      <GlobalSearch navItems={navItems} session={session} />

      {(!isOnline || pendingOfflineCount > 0) && (
        <div
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${
            !isOnline
              ? 'border-rose-300 bg-rose-50 text-rose-800'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
          title={
            !isOnline
              ? 'ไม่มีอินเทอร์เน็ต — ระบบจะพักรายการเช็กชื่อและคะแนนไว้ในเครื่องอัตโนมัติ'
              : `มี ${pendingOfflineCount} รายการที่รอซิงก์ขึ้นระบบ`
          }
        >
          <CloudOff size={14} aria-hidden="true" />
          <span className="hidden sm:inline">
            {!isOnline ? 'ออฟไลน์' : `รอซิงก์ ${pendingOfflineCount}`}
          </span>
          {isOnline && pendingOfflineCount > 0 && (
            <button
              type="button"
              disabled={isSyncingOffline}
              onClick={() => void syncOfflineNow()}
              className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-black text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <RefreshCw size={10} className={isSyncingOffline ? 'animate-spin' : ''} />
              <span>{isSyncingOffline ? 'ซิงก์...' : 'ซิงก์ทันที'}</span>
            </button>
          )}
        </div>
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
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#c25970] ring-2 ring-white" />}
        </button>
        {isNotificationOpen && (
          <section className={`topbar-notification-panel ${isNotificationCollapsed ? 'is-collapsed' : ''}`} role="dialog" aria-label="รายการแจ้งเตือน">
            <div className="topbar-notification-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e6f4ec] text-[#1c573d]"><Bell size={19} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1f2a22]">แจ้งเตือนของฉัน</p>
                  <p className="text-xs font-semibold text-[#5b6a5f]">{unreadCount} รายการที่ยังไม่ได้อ่าน</p>
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

      <Link
        className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-[#e6f4ec]/70"
        title="ตั้งค่าบัญชีส่วนตัว & เปลี่ยนรหัสผ่าน"
        to={withDemoContext('/app/dashboard?view=workspace-settings&tab=account', location.search)}
      >
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6f4ec] text-xs font-bold text-[#1c573d] ring-1 ring-[#2f7d5b]/20">
          {getInitials(session?.profile.displayName)}
          {vipInfo?.isVip ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-2 ring-white shadow-2xs"
              title={vipInfo.tooltip}
            >
              <Crown size={9} className="fill-white/30" aria-hidden="true" />
            </span>
          ) : null}
        </span>
        <span className="hidden min-w-0 xl:block">
          <span className="block max-w-40 truncate text-xs font-bold text-[#1f2a22]">
            {session?.profile.displayName || 'ผู้ใช้งาน'}
          </span>
          <span className="block max-w-40 truncate text-[10px] font-semibold text-[#5b6a5f]">
            {session ? roleLabels[session.profile.role] : 'ผู้ใช้งาน'} · ตั้งค่าบัญชี
          </span>
        </span>
      </Link>

      <SignOutButton className="app-signout-button" />
    </header>
  );
}
