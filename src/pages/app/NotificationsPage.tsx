import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  HeartPulse,
  Home,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  UserX,
  Users,
} from 'lucide-react';

import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { isDemoSession } from '../../lib/auth';
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

interface CareCaseItem {
  caseType: string;
  id: string;
  nextAction?: string | null;
  openedAt: string;
  riskLevel: 'normal' | 'watch' | 'urgent';
  studentName: string;
  summary: string;
}

interface EarlyWarningItem {
  id: string;
  reason: string;
  severity: string;
  signalType: string;
  studentName: string;
}

interface HomeVisitItem {
  completionPercent: number;
  id: string;
  studentName: string;
}

const channelLabels: Record<NotificationChannel, string> = {
  in_app: 'In-App',
  line: 'LINE',
  telegram: 'Telegram',
};

const channelIcons: Record<NotificationChannel, typeof Bell> = {
  in_app: Bell,
  line: MessageCircle,
  telegram: Send,
};

const demoNotifications: NotificationRow[] = [
  {
    body: 'มีนักเรียน 2 คนขาดเรียนช่วงเช้า (ด.ช. ธีรภัทร, ด.ญ. กานดา) ระบบเตรียมรายการสำหรับติดตามผู้ปกครองแล้ว',
    created_at: new Date().toISOString(),
    data: { channels: ['in_app', 'line'], source: 'attendance' },
    id: 'demo-notification-1',
    privacy_level: 'normal',
    profile_id: 'demo-teacher',
    read_at: null,
    title: 'สรุปเช็คชื่อวันนี้: พบนักเรียนขาดเรียน',
    type: 'attendance_alert',
    workspace_id: 'demo-workspace',
  },
  {
    body: 'เคสดูแลช่วยเหลือ ด.ช. ธีรภัทร ยอดเยี่ยม ถูกยกระดับเป็น "ด่วน" เนื่องจากขาดเรียนเกิน 4 วัน',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    data: { channels: ['in_app'], source: 'student_care' },
    id: 'demo-notification-2',
    privacy_level: 'restricted',
    profile_id: 'demo-teacher',
    read_at: null,
    title: 'แจ้งเตือนเคสดูแลนักเรียนเร่งด่วน',
    type: 'student_care_alert',
    workspace_id: 'demo-workspace',
  },
  {
    body: 'คำเชิญ Parent Portal ถูกส่งออกรอบล่าสุดเรียบร้อยแล้ว มีผู้ปกครองเปิดใช้งานแล้ว 18 บัญชี',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    data: { channels: ['in_app', 'telegram'], source: 'portal_invitation' },
    id: 'demo-notification-3',
    privacy_level: 'normal',
    profile_id: 'demo-teacher',
    read_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    title: 'ความคืบหน้า Parent Portal',
    type: 'portal_invite_batch',
    workspace_id: 'demo-workspace',
  },
];

const demoCareCases: CareCaseItem[] = [
  {
    caseType: 'ขาดเรียนต่อเนื่อง',
    id: 'demo-case-1',
    nextAction: 'นัดหมายเยี่ยมบ้านด่วนช่วงเย็นวันนี้ พร้อมติดต่อผู้ปกครอง',
    openedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    riskLevel: 'urgent',
    studentName: 'ด.ช. ธีรภัทร ยอดเยี่ยม (เลขที่ 4)',
    summary: 'ขาดเรียนต่อเนื่อง 4 วันโดยไม่ทราบสาเหตุ ผู้ปกครองยังไม่รับสายโทรศัพท์',
  },
  {
    caseType: 'พฤติกรรมเสี่ยง/แยกตัว',
    id: 'demo-case-2',
    nextAction: 'ประสานครูแนะแนวและจัดเวลาคุยรายบุคคล',
    openedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    riskLevel: 'watch',
    studentName: 'ด.ญ. กานดา วงศ์สุวรรณ (เลขที่ 12)',
    summary: 'ไม่เข้าร่วมกิจกรรมกลุ่ม มีอาการซึมเศร้าและไม่พูดคุยกับเพื่อนในชั้นเรียน',
  },
];

const demoEarlyWarnings: EarlyWarningItem[] = [
  {
    id: 'demo-ew-1',
    reason: 'คะแนนสอบเก็บคะแนนคณิตศาสตร์ลดลงกว่า 25% เมื่อเทียบกับรอบก่อน',
    severity: 'high',
    signalType: 'คะแนนลดลงผิดปกติ',
    studentName: 'ด.ช. ภานุวัฒน์ ใจหาญ (เลขที่ 8)',
  },
  {
    id: 'demo-ew-2',
    reason: 'มาสายเกิน 4 ครั้งในช่วง 2 สัปดาห์ที่ผ่านมา',
    severity: 'medium',
    signalType: 'สถิติมาสายสะสม',
    studentName: 'ด.ช. อัครพงษ์ สุขใจ (เลขที่ 15)',
  },
];

const demoHomeVisits: HomeVisitItem[] = [
  { completionPercent: 40, id: 'demo-hv-1', studentName: 'ด.ช. ชัยวัฒน์ มั่นคง (เลขที่ 2)' },
  { completionPercent: 20, id: 'demo-hv-2', studentName: 'ด.ญ. นลินี วงศ์สว่าง (เลขที่ 7)' },
  { completionPercent: 0, id: 'demo-hv-3', studentName: 'ด.ช. ธีรภัทร ยอดเยี่ยม (เลขที่ 4)' },
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function getPrivacyClass(level: NotificationRow['privacy_level']) {
  if (level === 'sensitive') return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (level === 'restricted') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-cyan-50 text-cyan-700 ring-cyan-100';
}

export function NotificationsPage({ session }: NotificationsPageProps) {
  const demoMode = isDemoSession(session);
  const workspaceId = session.workspace?.id || '';

  // Tabs: 'tasks' (งานที่ต้องตามต่อ) | 'inbox' (กล่องแจ้งเตือน) | 'channels' (ช่องทางภายนอก)
  const [activeTab, setActiveTab] = useState<'tasks' | 'inbox' | 'channels'>('tasks');
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isDispatching, setIsDispatching] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: เชื่อมต่อข้อมูลจำลองเพื่อการสาธิตการทำงานจริง'
  );
  const [notifications, setNotifications] = useState<NotificationRow[]>(demoNotifications);

  // Live Task States
  const [attendanceCheckedToday, setAttendanceCheckedToday] = useState<boolean>(true);
  const [absentStudentsToday, setAbsentStudentsToday] = useState<number>(demoMode ? 2 : 0);
  const [lateStudentsToday, setLateStudentsToday] = useState<number>(demoMode ? 1 : 0);
  const [careCases, setCareCases] = useState<CareCaseItem[]>(demoMode ? demoCareCases : []);
  const [earlyWarnings, setEarlyWarnings] = useState<EarlyWarningItem[]>(demoMode ? demoEarlyWarnings : []);
  const [pendingHomeVisits, setPendingHomeVisits] = useState<HomeVisitItem[]>(demoMode ? demoHomeVisits : []);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(demoMode ? 35 : 0);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!supabase || !workspaceId || demoMode) {
      setNotifications(demoNotifications);
      setCareCases(demoCareCases);
      setEarlyWarnings(demoEarlyWarnings);
      setPendingHomeVisits(demoHomeVisits);
      setIsLoading(false);
      setIsLoadingTasks(false);
      return;
    }

    setIsLoading(true);
    setIsLoadingTasks(true);
    setNotice(null);

    const todayStr = new Date().toISOString().slice(0, 10);

    try {
      const [
        notifsRes,
        attendanceRes,
        careCasesRes,
        signalsRes,
        homeVisitsRes,
        studentsCountRes,
      ] = await Promise.all([
        supabase
          .from('notifications')
          .select('id,workspace_id,profile_id,type,title,body,data,privacy_level,read_at,created_at')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', session.profile.id)
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('attendance_sessions')
          .select('id,attendance_date,status,attendance_records(status, student_id)')
          .eq('workspace_id', workspaceId)
          .eq('attendance_date', todayStr),
        supabase
          .from('student_care_cases')
          .select('id,student_id,case_type,risk_level,status,summary,next_action,opened_at,student:students(id,first_name,last_name,student_code)')
          .eq('workspace_id', workspaceId)
          .in('status', ['open', 'monitoring'])
          .order('risk_level', { ascending: false })
          .order('opened_at', { ascending: false })
          .limit(10),
        supabase
          .from('early_warning_signals')
          .select('id,student_id,signal_type,severity,risk_score,reason,status,student:students(id,first_name,last_name)')
          .eq('workspace_id', workspaceId)
          .eq('status', 'open')
          .order('risk_score', { ascending: false })
          .limit(10),
        supabase
          .from('student_home_visits')
          .select('id,student_id,status,completion_percent,student:students(id,first_name,last_name)')
          .eq('workspace_id', workspaceId)
          .in('status', ['draft', 'ready'])
          .limit(10),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
      ]);

      if (notifsRes.data) {
        setNotifications(notifsRes.data as NotificationRow[]);
      }

      // 1. Process Attendance Today
      const sessions = attendanceRes.data || [];
      if (sessions.length > 0) {
        setAttendanceCheckedToday(true);
        let absCount = 0;
        let lateCount = 0;
        for (const s of sessions) {
          const records = (s.attendance_records as Array<{ status: string }>) || [];
          for (const r of records) {
            if (r.status === 'absent') absCount++;
            if (r.status === 'late') lateCount++;
          }
        }
        setAbsentStudentsToday(absCount);
        setLateStudentsToday(lateCount);
      } else {
        setAttendanceCheckedToday(false);
        setAbsentStudentsToday(0);
        setLateStudentsToday(0);
      }

      // 2. Process Care Cases
      if (careCasesRes.data) {
        const mappedCases: CareCaseItem[] = (careCasesRes.data as Record<string, unknown>[]).map((item) => {
          const st = item.student as { first_name?: string; last_name?: string; student_code?: string } | null;
          return {
            caseType: String(item.case_type || 'เคสทั่วไป'),
            id: String(item.id),
            nextAction: item.next_action ? String(item.next_action) : null,
            openedAt: String(item.opened_at || ''),
            riskLevel: (item.risk_level as 'normal' | 'watch' | 'urgent') || 'watch',
            studentName: st?.first_name ? `${st.first_name} ${st.last_name || ''} (${st.student_code || ''})` : 'ไม่ระบุชื่อ',
            summary: String(item.summary || ''),
          };
        });
        setCareCases(mappedCases);
      }

      // 3. Process Signals
      if (signalsRes.data) {
        const mappedSignals: EarlyWarningItem[] = (signalsRes.data as Record<string, unknown>[]).map((item) => {
          const st = item.student as { first_name?: string; last_name?: string } | null;
          return {
            id: String(item.id),
            reason: String(item.reason || ''),
            severity: String(item.severity || 'medium'),
            signalType: String(item.signal_type || 'แจ้งเตือนพฤติกรรม'),
            studentName: st?.first_name ? `${st.first_name} ${st.last_name || ''}` : 'นักเรียนในห้อง',
          };
        });
        setEarlyWarnings(mappedSignals);
      }

      // 4. Process Home Visits
      if (homeVisitsRes.data) {
        const mappedVisits: HomeVisitItem[] = (homeVisitsRes.data as Record<string, unknown>[]).map((item) => {
          const st = item.student as { first_name?: string; last_name?: string } | null;
          return {
            completionPercent: Number(item.completion_percent || 0),
            id: String(item.id),
            studentName: st?.first_name ? `${st.first_name} ${st.last_name || ''}` : 'นักเรียนในชั้น',
          };
        });
        setPendingHomeVisits(mappedVisits);
      }

      if (studentsCountRes.count !== null) {
        setTotalStudentsCount(studentsCountRes.count);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setNotice(`เกิดข้อผิดพลาดในการโหลดข้อมูล: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsLoadingTasks(false);
    }
  }, [demoMode, session.profile.id, workspaceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  // Total Action Items count
  const totalTasksCount =
    (!attendanceCheckedToday ? 1 : 0) +
    careCases.length +
    earlyWarnings.length +
    (absentStudentsToday > 0 ? 1 : 0) +
    pendingHomeVisits.length;

  const urgentTasksCount =
    (!attendanceCheckedToday ? 1 : 0) +
    careCases.filter((c) => c.riskLevel === 'urgent').length +
    (absentStudentsToday > 0 ? 1 : 0);

  async function markAsRead(notificationId: string) {
    const readAt = new Date().toISOString();

    if (!supabase || demoMode) {
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
      .eq('workspace_id', workspaceId)
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

    if (!supabase || demoMode) {
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
      .eq('workspace_id', workspaceId)
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

    if (!supabase || !session.workspace || demoMode) {
      setNotifications((current) => [
        {
          body: 'แจ้งเตือนทดสอบระบบ Notification Center (โหมดตัวอย่าง)',
          created_at: now,
          data: { channels: ['in_app'], dispatch_source: 'local-demo' },
          id: `demo-notification-${Date.now()}`,
          privacy_level: 'normal',
          profile_id: session.profile.id,
          read_at: null,
          title: 'ทดสอบการแจ้งเตือน',
          type: 'manual_test',
          workspace_id: workspaceId,
        },
        ...current,
      ]);
      setNotice('สร้างแจ้งเตือนทดสอบในโหมดตัวอย่างแล้ว');
      setIsDispatching(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('dispatch-notification', {
      body: {
        body: 'สร้างจากปุ่มทดสอบใน Notification Center เพื่อยืนยันการเชื่อมต่อ Edge Function dispatch',
        channels: ['in_app'],
        data: { source_ui: 'notifications_page' },
        privacyLevel: 'normal',
        profileId: session.profile.id,
        title: 'แจ้งเตือนทดสอบจากระบบ',
        type: 'manual_test',
        workspaceId: workspaceId,
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
          body: 'สร้างจากปุ่มทดสอบใน Notification Center เพื่อยืนยันการเชื่อมต่อ Edge Function dispatch',
          created_at: notification.created_at,
          data: { channels: ['in_app'], dispatch_source: 'dispatch-notification' },
          id: notification.id,
          privacy_level: 'normal',
          profile_id: session.profile.id,
          read_at: null,
          title: 'แจ้งเตือนทดสอบจากระบบ',
          type: 'manual_test',
          workspace_id: workspaceId,
        },
        ...current,
      ]);
    }

    setNotice('เรียก dispatch-notification สำเร็จและบันทึก notification แล้ว');
    setIsDispatching(false);
  }

  return (
    <main className="app-page">
      {/* Page Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <Bell size={16} aria-hidden="true" />
            Teacher Action & Notification Center
          </div>
          <h1 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
            ศูนย์แจ้งเตือนสำหรับครู เจ้าของห้อง และงานที่ต้องตามต่อ
          </h1>
          <p className="mt-2 text-sm font-bold text-slate-600">
            รวมงานค้างจริงที่ต้องติดตาม (เช็คชื่อ, เคสดูแล, เยี่ยมบ้าน) และกล่องข้อความแจ้งเตือนทั้งหมดของห้องเรียน
          </p>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-3 gap-2.5 sm:min-w-[420px]">
          <div className="nexus-card bg-amber-50/70 p-3 text-center ring-1 ring-amber-200/60">
            <p className="text-2xl font-black text-amber-700">{totalTasksCount}</p>
            <p className="mt-0.5 text-xs font-black text-slate-600">งานที่ต้องตามต่อ</p>
          </div>
          <div className="nexus-card bg-rose-50/70 p-3 text-center ring-1 ring-rose-200/60">
            <p className="text-2xl font-black text-rose-700">{urgentTasksCount}</p>
            <p className="mt-0.5 text-xs font-black text-slate-600">รายการเร่งด่วน</p>
          </div>
          <div className="nexus-card bg-cyan-50/70 p-3 text-center ring-1 ring-cyan-200/60">
            <p className="text-2xl font-black text-cyan-700">{unreadCount}</p>
            <p className="mt-0.5 text-xs font-black text-slate-600">แจ้งเตือนใหม่</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'tasks'
                ? 'bg-slate-950 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200'
            }`}
            onClick={() => setActiveTab('tasks')}
            type="button"
          >
            <Sparkles size={15} />
            งานที่ต้องตามต่อ
            {totalTasksCount > 0 ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  urgentTasksCount > 0 ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950'
                }`}
              >
                {totalTasksCount}
              </span>
            ) : null}
          </button>

          <button
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'inbox'
                ? 'bg-slate-950 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200'
            }`}
            onClick={() => setActiveTab('inbox')}
            type="button"
          >
            <Bell size={15} />
            กล่องแจ้งเตือน Inbox
            {unreadCount > 0 ? (
              <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-black text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>

          <button
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${
              activeTab === 'channels'
                ? 'bg-slate-950 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-50 ring-1 ring-slate-200'
            }`}
            onClick={() => setActiveTab('channels')}
            type="button"
          >
            <Smartphone size={15} />
            ช่องทางแจ้งเตือน (LINE / Telegram)
          </button>
        </div>

        <button
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          disabled={isLoading || isLoadingTasks}
          onClick={() => void loadData()}
          title="รีเฟรชข้อมูลล่าสุด"
          type="button"
        >
          <RefreshCw className={isLoading || isLoadingTasks ? 'animate-spin' : ''} size={14} />
          รีเฟรช
        </button>
      </div>

      {notice ? (
        <div className="mt-4 flex gap-2 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-3 text-sm font-bold text-cyan-900 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p>{notice}</p>
        </div>
      ) : null}

      {/* TAB 1: งานที่ต้องตามต่อ (ACTION ITEMS) */}
      {activeTab === 'tasks' ? (
        <div className="mt-4 space-y-4">
          {isLoadingTasks ? (
            <div className="nexus-card p-12 text-center">
              <NexusAuroraInline label="กำลังสแกนและประมวลผลงานค้างประจำวัน..." />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Left 2 Columns: Action Item Cards */}
              <div className="space-y-4 lg:col-span-2">
                {/* 1. Daily Attendance Action Card */}
                {!attendanceCheckedToday ? (
                  <div className="rounded-3xl border-2 border-rose-300 bg-rose-50/70 p-4 sm:p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-md">
                          <UserX size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                              ด่วนมาก
                            </span>
                            <h3 className="font-black text-slate-950">ยังไม่ได้บันทึกการมาเรียนวันนี้!</h3>
                          </div>
                          <p className="mt-1 text-xs font-bold leading-5 text-rose-900">
                            ยังไม่มีการเปิดเซสชันเช็คชื่อสำหรับวันที่ {formatDate(new Date().toISOString())} กรุณาเริ่มบันทึกเพื่อให้ผู้ปกครองและโรงเรียนทราบสถานะ
                          </p>
                        </div>
                      </div>
                      <Link
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-black text-white shadow hover:bg-rose-700"
                        to="/app/dashboard?view=teacher-work"
                      >
                        เริ่มเช็คชื่อวันนี้ <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ) : absentStudentsToday > 0 ? (
                  <div className="rounded-3xl border border-amber-300 bg-amber-50/70 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white">
                          <CalendarCheck size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900">
                              ต้องติดตาม
                            </span>
                            <h3 className="font-black text-slate-950">
                              มีนักเรียนขาดเรียนวันนี้ {absentStudentsToday} คน {lateStudentsToday > 0 ? `(มาสาย ${lateStudentsToday} คน)` : ''}
                            </h3>
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-600">
                            เช็คชื่อเรียบร้อยแล้ว แนะนำให้โทรสอบถามหรือส่งข้อความถึงผู้ปกครองเพื่อยืนยันสาเหตุการขาด
                          </p>
                        </div>
                      </div>
                      <Link
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 text-xs font-black text-amber-800 hover:bg-amber-100"
                        to="/app/dashboard?view=teacher-work"
                      >
                        ดูรายชื่อ <ExternalLink size={13} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-emerald-950">บันทึกการมาเรียนวันนี้เรียบร้อยแล้ว</h3>
                        <p className="text-xs font-bold text-emerald-700">ไม่มีนักเรียนขาดเรียนในเซสชันล่าสุด</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Student Care Cases to Follow Up */}
                <div className="nexus-card p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="text-rose-600" size={19} />
                      <h3 className="font-black text-slate-950">เคสดูแลช่วยเหลือนักเรียนที่ต้องติดตาม ({careCases.length})</h3>
                    </div>
                    <Link
                      className="text-xs font-black text-blue-600 hover:underline"
                      to="/app/dashboard?view=students"
                    >
                      ดูนักเรียนทั้งหมด &rarr;
                    </Link>
                  </div>

                  {careCases.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                      ไม่มีเคสดูแลช่วยเหลือค้างในขณะนี้ ห้องเรียนอยู่ในเกณฑ์ปกติ
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {careCases.map((item) => (
                        <div
                          className={`rounded-2xl border p-3.5 transition-colors ${
                            item.riskLevel === 'urgent'
                              ? 'border-rose-200 bg-rose-50/40'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                          key={item.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                    item.riskLevel === 'urgent'
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {item.riskLevel === 'urgent' ? 'เคสด่วน' : 'เฝ้าระวัง'}
                                </span>
                                <span className="font-black text-slate-900">{item.studentName}</span>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                  {item.caseType}
                                </span>
                              </div>
                              <p className="mt-1 text-xs font-bold text-slate-600">{item.summary}</p>
                              {item.nextAction ? (
                                <p className="mt-1 text-xs font-bold text-blue-700">
                                  👉 สิ่งที่ต้องตามต่อ: {item.nextAction}
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-bold text-slate-400">เปิดเคสเมื่อ: {formatDate(item.openedAt)}</p>
                              <Link
                                className="mt-2 inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:underline"
                                to="/app/dashboard?view=students"
                              >
                                จัดการเคส <ArrowRight size={12} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Early Warning Signals */}
                <div className="nexus-card p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="text-amber-600" size={19} />
                      <h3 className="font-black text-slate-950">สัญญาณเตือนนักเรียน (Early Warning) ({earlyWarnings.length})</h3>
                    </div>
                    <Link
                      className="text-xs font-black text-blue-600 hover:underline"
                      to="/app/dashboard?view=automation"
                    >
                      เปิดศูนย์ Automation &rarr;
                    </Link>
                  </div>

                  {earlyWarnings.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                      ไม่พบสัญญาณเตือนความเสี่ยงในระบบ
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {earlyWarnings.map((sig) => (
                        <div className="nexus-muted-box flex flex-wrap items-center justify-between gap-2 p-3 text-xs" key={sig.id}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">{sig.studentName}</span>
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                {sig.signalType}
                              </span>
                            </div>
                            <p className="mt-0.5 text-slate-600">{sig.reason}</p>
                          </div>
                          <Link
                            className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                            to="/app/dashboard?view=automation"
                          >
                            ตรวจสอบ <ExternalLink size={12} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Home Visits & Fast Shortcuts */}
              <div className="space-y-4">
                {/* Home Visits Card */}
                <div className="nexus-card p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Home className="text-teal-600" size={19} />
                    <h3 className="font-black text-slate-950">การเยี่ยมบ้านที่ยังไม่เสร็จ</h3>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {totalStudentsCount > 0 ? `นักเรียนในห้อง ${totalStudentsCount} คน · ` : ''}
                    รอการเยี่ยมบ้าน {pendingHomeVisits.length} คน
                  </p>

                  <div className="mt-3 space-y-2">
                    {pendingHomeVisits.length === 0 ? (
                      <p className="text-center text-xs font-bold text-slate-400 py-4">
                        เยี่ยมบ้านครบสมบูรณ์แล้ว
                      </p>
                    ) : (
                      pendingHomeVisits.map((hv) => (
                        <div className="nexus-muted-box p-2.5 text-xs" key={hv.id}>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-slate-800">{hv.studentName}</span>
                            <span className="font-bold text-teal-700">{hv.completionPercent}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full bg-teal-600 transition-all"
                              style={{ width: `${Math.max(5, hv.completionPercent)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <Link
                    className="blue-action mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-black"
                    to="/app/dashboard?view=students"
                  >
                    ไปที่ระบบบันทึกเยี่ยมบ้าน <ArrowRight size={14} />
                  </Link>
                </div>

                {/* Useful Shortcuts */}
                <div className="nexus-card p-4 sm:p-5">
                  <h4 className="text-xs font-black uppercase text-slate-400">ทางลัดจัดการห้องเรียน</h4>
                  <div className="mt-3 grid gap-2">
                    <Link
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      to="/app/dashboard?view=teacher-work"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarCheck className="text-blue-600" size={16} /> เช็คชื่อประจำวัน
                      </span>
                      <ArrowRight size={14} />
                    </Link>
                    <Link
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      to="/app/dashboard?view=parent-access"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="text-amber-600" size={16} /> ส่งบัตร Parent Portal ให้ผู้ปกครอง
                      </span>
                      <ArrowRight size={14} />
                    </Link>
                    <Link
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      to="/app/dashboard?view=daily-brief"
                    >
                      <span className="flex items-center gap-2">
                        <Clock3 className="text-teal-600" size={16} /> สรุปข้อมูลประจำวัน (Daily Brief)
                      </span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* TAB 2: กล่องข้อความแจ้งเตือน (INBOX) */}
      {activeTab === 'inbox' ? (
        <section className="app-workbench mt-4">
          <aside className="grid gap-4">
            <div className="nexus-card p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
                <Filter size={16} aria-hidden="true" />
                ตัวกรองกล่องข้อความ
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
                    className={`h-10 rounded-2xl px-3 text-xs font-black transition ${
                      filter === item.key
                        ? 'bg-slate-950 text-white shadow-md'
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
                        พร้อมใช้งาน
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">รายการแจ้งเตือน</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {isLoading ? <NexusAuroraInline label="กำลังโหลดแจ้งเตือน" /> : `${filteredNotifications.length} รายการ`}
                </h2>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                Workspace: {session.workspace?.classroomName || session.workspace?.name || '-'}
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
      ) : null}

      {/* TAB 3: CHANNELS READINESS */}
      {activeTab === 'channels' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="nexus-card p-5">
            <div className="flex items-center gap-2">
              <MessageCircle className="text-emerald-600" size={20} />
              <h3 className="text-base font-black text-slate-950">LINE Notify & Official Account</h3>
            </div>
            <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
              รองรับการส่งข้อความแจ้งเตือนสรุปประจำวัน ขาดเรียน หรือเคสเร่งด่วนตรงเข้าสู่ LINE ของคุณครูหรือกลุ่มผู้ปกครอง
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-700">สถานะความพร้อม (Edge Function):</p>
              <p className="mt-1 text-xs text-slate-500">
                โครงสร้าง Payload และระบบคิวส่งรองรับแล้ว ต้องการเพียงตั้งค่า LINE Channel Access Token ใน Supabase Secrets
              </p>
            </div>
          </div>

          <div className="nexus-card p-5">
            <div className="flex items-center gap-2">
              <Send className="text-cyan-600" size={20} />
              <h3 className="text-base font-black text-slate-950">Telegram Bot Integration</h3>
            </div>
            <p className="mt-2 text-xs font-bold leading-6 text-slate-600">
              แจ้งเตือนด่วนผ่าน Telegram Chat ID สำหรับครูผู้สอนและฝ่ายบริหารโรงเรียน ปลอดภัยและไม่เสียค่าใช้จ่าย
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-700">สถานะความพร้อม (Edge Function):</p>
              <p className="mt-1 text-xs text-slate-500">
                รองรับ TELEGRAM_BOT_TOKEN พร้อมการระบุ chatId เฉพาะรายบุคคลหรือกลุ่ม
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">Created by MIKPURINUT</footer>
    </main>
  );
}
