import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  Filter,
  MessageCircle,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface NotificationsPageProps {
  session: AppSessionContext;
}

type NotificationChannel = 'in_app' | 'telegram' | 'line';
type NotificationFilter = 'all' | 'unread' | NotificationChannel;

interface NotificationRow {
  body: string;
  created_at: string;
  data: Record<string, unknown>;
  id: string;
  privacy_level: 'normal' | 'restricted' | 'sensitive';
  profile_id: string | null;
  read_at: string | null;
  title: string;
  type: string;
  workspace_id: string | null;
}

const channelLabels: Record<NotificationChannel, string> = {
  in_app: 'In-App',
  telegram: 'Telegram',
  line: 'LINE',
};

const channelIcons: Record<NotificationChannel, typeof Bell> = {
  in_app: Bell,
  telegram: Send,
  line: MessageCircle,
};

const demoNotifications: NotificationRow[] = [
  {
    body: 'มีนักเรียน 2 คนขาดเรียนช่วงเช้า ระบบเตรียมรายการแจ้งผู้ปกครองไว้แล้ว',
    created_at: new Date().toISOString(),
    data: { channels: ['in_app', 'line'], source: 'attendance' },
    id: 'demo-notification-1',
    privacy_level: 'normal',
    profile_id: 'demo-teacher',
    read_at: null,
    title: 'สรุปเช็คชื่อวันนี้',
    type: 'attendance_alert',
    workspace_id: 'demo-workspace',
  },
  {
    body: 'คำเชิญ Parent Portal ถูกสร้างจาก Guardian CSV จำนวน 3 รายการ รอส่งอีเมลจริงหลังต่อ Edge Function',
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    data: { channels: ['in_app'], source: 'portal_invitation' },
    id: 'demo-notification-2',
    privacy_level: 'restricted',
    profile_id: 'demo-teacher',
    read_at: null,
    title: 'Portal invite batch พร้อมตรวจสอบ',
    type: 'portal_invite_batch',
    workspace_id: 'demo-workspace',
  },
  {
    body: 'ระบบบันทึก backup manifest ล่าสุดแล้ว เหมาะสำหรับต่อยอดเข้า Google Drive Cold Storage',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    data: { channels: ['in_app', 'telegram'], source: 'backup' },
    id: 'demo-notification-3',
    privacy_level: 'normal',
    profile_id: 'demo-teacher',
    read_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    title: 'สำรองข้อมูล workspace สำเร็จ',
    type: 'backup_created',
    workspace_id: 'demo-workspace',
  },
];

function normalizeChannels(data: Record<string, unknown>): NotificationChannel[] {
  const rawChannels = data.channels;
  const rawChannel = data.channel;
  const channels = Array.isArray(rawChannels) ? rawChannels : rawChannel ? [rawChannel] : ['in_app'];

  return channels
    .filter((channel): channel is NotificationChannel =>
      channel === 'in_app' || channel === 'telegram' || channel === 'line',
    )
    .filter((channel, index, list) => list.indexOf(channel) === index);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function getPrivacyClass(level: NotificationRow['privacy_level']) {
  if (level === 'sensitive') return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (level === 'restricted') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-cyan-50 text-cyan-700 ring-cyan-100';
}

export function NotificationsPage({ session }: NotificationsPageProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isDispatching, setIsDispatching] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่ออ่าน notification จาก Supabase จริง',
  );
  const [notifications, setNotifications] = useState<NotificationRow[]>(demoNotifications);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      if (!supabase || !session.workspace) {
        setNotifications(demoNotifications);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const { data, error } = await supabase
        .from('notifications')
        .select('id,workspace_id,profile_id,type,title,body,data,privacy_level,read_at,created_at')
        .eq('workspace_id', session.workspace.id)
        .eq('profile_id', session.profile.id)
        .order('created_at', { ascending: false })
        .limit(80);

      if (!isMounted) return;

      if (error) {
        setNotice(error.message);
        setIsLoading(false);
        return;
      }

      setNotifications((data || []) as NotificationRow[]);
      setIsLoading(false);
    }

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [session.profile.id, session.workspace]);

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filter === 'unread') return !notification.read_at;
        if (filter === 'all') return true;
        return normalizeChannels(notification.data).includes(filter);
      }),
    [filter, notifications],
  );

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const channelCounts = (['in_app', 'telegram', 'line'] as NotificationChannel[]).map((channel) => ({
    channel,
    count: notifications.filter((notification) => normalizeChannels(notification.data).includes(channel)).length,
  }));

  async function markAsRead(notificationId: string) {
    const readAt = new Date().toISOString();

    if (!supabase) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, read_at: readAt } : notification,
        ),
      );
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('profile_id', session.profile.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read_at: readAt } : notification,
      ),
    );
  }

  async function markAllAsRead() {
    const readAt = new Date().toISOString();
    const unreadIds = notifications
      .filter((notification) => !notification.read_at && notification.profile_id === session.profile.id)
      .map((notification) => notification.id);

    if (!supabase) {
      setNotifications((current) =>
        current.map((notification) => (notification.read_at ? notification : { ...notification, read_at: readAt })),
      );
      return;
    }

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .in('id', unreadIds)
      .eq('profile_id', session.profile.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification,
      ),
    );
  }

  async function createTestNotification() {
    const now = new Date().toISOString();
    setIsDispatching(true);
    setNotice(null);

    if (!supabase || !session.workspace) {
      setNotifications((current) => [
        {
          body: 'สร้างจากปุ่มทดสอบใน Notification Center โหมดตัวอย่าง',
          created_at: now,
          data: { channels: ['in_app'], dispatch_source: 'local-demo' },
          id: `demo-notification-${Date.now()}`,
          privacy_level: 'normal',
          profile_id: session.profile.id,
          read_at: null,
          title: 'แจ้งเตือนทดสอบ',
          type: 'manual_test',
          workspace_id: session.workspace?.id || null,
        },
        ...current,
      ]);
      setNotice('สร้างแจ้งเตือนทดสอบในโหมดตัวอย่างแล้ว');
      setIsDispatching(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('dispatch-notification', {
      body: {
        body: 'สร้างจากปุ่มทดสอบใน Notification Center เพื่อยืนยัน Edge Function dispatch foundation',
        channels: ['in_app'],
        data: { source_ui: 'notifications_page' },
        privacyLevel: 'normal',
        profileId: session.profile.id,
        title: 'แจ้งเตือนทดสอบ',
        type: 'manual_test',
        workspaceId: session.workspace.id,
      },
    });

    if (error) {
      setNotice(error.message);
      setIsDispatching(false);
      return;
    }

    const notification = (data as { notification?: Pick<NotificationRow, 'created_at' | 'id'> }).notification;
    if (notification) {
      setNotifications((current) => [
        {
          body: 'สร้างจากปุ่มทดสอบใน Notification Center เพื่อยืนยัน Edge Function dispatch foundation',
          created_at: notification.created_at,
          data: { channels: ['in_app'], dispatch_source: 'dispatch-notification' },
          id: notification.id,
          privacy_level: 'normal',
          profile_id: session.profile.id,
          read_at: null,
          title: 'แจ้งเตือนทดสอบ',
          type: 'manual_test',
          workspace_id: session.workspace?.id || null,
        },
        ...current,
      ]);
    }

    setNotice('เรียก dispatch-notification สำเร็จและบันทึก notification/log แล้ว');
    setIsDispatching(false);
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <Bell size={16} aria-hidden="true" />
            Notification Center
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            ศูนย์แจ้งเตือนสำหรับครู เจ้าของห้อง และงานที่ต้องตามต่อ
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            อ่านแจ้งเตือนจากตาราง notifications พร้อมเตรียม metadata ช่องทาง In-App, Telegram และ LINE
            โดยยังไม่เก็บ token หรือ secret ใน frontend
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[520px]">
          {[
            { label: 'ทั้งหมด', value: notifications.length },
            { label: 'ยังไม่อ่าน', value: unreadCount },
            { label: 'ช่องทาง', value: channelCounts.filter((item) => item.count > 0).length },
          ].map((item) => (
            <div className="nexus-card p-3 text-center" key={item.label}>
              <p className="text-2xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="app-workbench">
        <aside className="grid gap-4">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Filter size={16} aria-hidden="true" />
              ตัวกรอง
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { key: 'all', label: 'ทั้งหมด' },
                { key: 'unread', label: 'ยังไม่อ่าน' },
                { key: 'in_app', label: 'In-App' },
                { key: 'telegram', label: 'Telegram' },
                { key: 'line', label: 'LINE' },
              ].map((item) => (
                <button
                  className={`h-11 rounded-2xl px-3 text-xs font-black transition ${
                    filter === item.key
                      ? 'bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]'
                      : 'bg-white/80 text-slate-600 ring-1 ring-slate-200 hover:bg-white'
                  }`}
                  key={item.key}
                  onClick={() => setFilter(item.key as NotificationFilter)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={unreadCount === 0 || isLoading || isDispatching}
              onClick={() => void markAllAsRead()}
              type="button"
            >
              <CheckCircle2 size={17} aria-hidden="true" />
              ทำเครื่องหมายว่าอ่านแล้ว
            </button>
            <button
              className="dark-action mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isLoading || isDispatching}
              onClick={() => void createTestNotification()}
              type="button"
            >
              <Send size={17} aria-hidden="true" />
              สร้างแจ้งเตือนทดสอบ
            </button>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-teal-700">
              <Smartphone size={16} aria-hidden="true" />
              Channel Readiness
            </div>
            <div className="mt-4 grid gap-3">
              {channelCounts.map(({ channel, count }) => {
                const Icon = channelIcons[channel];

                return (
                  <div className="nexus-muted-box flex items-center justify-between gap-3 p-3" key={channel}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{channelLabels[channel]}</p>
                        <p className="text-xs font-bold text-slate-500">{count} รายการใน inbox</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
                      metadata
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <ShieldCheck size={16} aria-hidden="true" />
              Security Note
            </div>
            <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
              การส่งออก Telegram/LINE ต้องต่อผ่าน Edge Function หรือ backend ที่ถือ secret เท่านั้น
              หน้าเว็บนี้อ่านสถานะและ mark read ผ่าน RLS
            </p>
          </div>
        </aside>

        <section className="nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-cyan-700">Inbox</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {isLoading ? 'กำลังโหลดแจ้งเตือน' : `${filteredNotifications.length} รายการ`}
              </h2>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3 text-xs font-black text-slate-500 ring-1 ring-slate-200">
              Workspace: {session.workspace?.classroomName || '-'}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {filteredNotifications.map((notification) => {
              const channels = normalizeChannels(notification.data);

              return (
                <article
                  className={`rounded-3xl border p-4 transition ${
                    notification.read_at
                      ? 'border-slate-100 bg-white/70'
                      : 'border-cyan-100 bg-cyan-50/70 shadow-[0_16px_40px_rgba(14,165,233,0.12)]'
                  }`}
                  key={notification.id}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black ring-1 ${getPrivacyClass(notification.privacy_level)}`}>
                          {notification.privacy_level}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
                          {notification.type}
                        </span>
                        {!notification.read_at ? (
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700 ring-1 ring-rose-100">
                            unread
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-lg font-black leading-7 text-slate-950">{notification.title}</h3>
                      <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{notification.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {channels.map((channel) => {
                          const Icon = channelIcons[channel];

                          return (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200"
                              key={channel}
                            >
                              <Icon size={13} aria-hidden="true" />
                              {channelLabels[channel]}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                      <span className="inline-flex items-center gap-1 text-xs font-black text-slate-500">
                        <Clock3 size={14} aria-hidden="true" />
                        {formatDateTime(notification.created_at)}
                      </span>
                      {!notification.read_at ? (
                        <button
                          className="dark-action inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-black"
                          onClick={() => void markAsRead(notification.id)}
                          type="button"
                        >
                          <CheckCircle2 size={15} aria-hidden="true" />
                          อ่านแล้ว
                        </button>
                      ) : (
                        <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          อ่านแล้ว
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="mt-5 nexus-muted-box p-5 text-center text-sm font-bold text-slate-600">
              ยังไม่มีแจ้งเตือนในตัวกรองนี้
            </div>
          ) : null}
        </section>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">Created by MIKPURINUT</footer>
    </main>
  );
}
