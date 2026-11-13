import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  HeartHandshake,
  NotebookPen,
  Pin,
  Scale,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  TrendingDown,
  TrendingUp,
  Umbrella,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { AppLogo } from '../../components/brand/AppLogo';
import { BotanicalCardSprig, BotanicalCornerWatermark } from '../../components/shared/BotanicalDecor';

import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { dashboardStats } from '../../data/dashboard';
import { getBangkokDate } from '../../lib/date';
import { isDemoSession } from '../../lib/auth';
import { canManageWorkspace } from '../../lib/roles';
import { buildSchedulePeriods, loadScheduleSettings, makeScheduleCellKey, type ScheduleSettings } from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';
import type { WatchlistStudentItem } from '../../components/dashboard/StudentWatchlist';
import type { ClassroomAnalyticsData } from '../../components/dashboard/ClassroomAnalyticsCharts';
import { SystemReportsDashboard } from '../../components/dashboard/SystemReportsDashboard';
import { TeacherSchedulePreview } from '../../components/dashboard/TeacherSchedulePreview';
import { EasyShortcutHub } from '../../components/dashboard/EasyShortcutHub';
import { autoRealignAllStudentsToCorrectRooms } from '../../data/p5MasterTemplate';
import { getHiddenClassroomIds, hideClassroomIdLocally, isObsoleteGhostClassroom } from '../../lib/teacherClassrooms';
import { getThaiPublicHolidays } from '../../lib/thaiHolidays';

interface DashboardPageProps {
  activeLabel: string;
  activeModules: number;
  badges: string[];
  copy: {
    eyebrow: string;
    title: string;
    body: string;
  };
  entitlementLabel: string;
  guardPreview: Array<{ label: string; passed: boolean }>;
  initialRoute: string;
  isModuleEnabled: boolean;
  session: AppSessionContext;
  supabaseStatus: string;
}

interface WorkspaceMemberSummaryRow {
  status: string;
}

interface ClassroomRow {
  academic_year: string;
  grade_level?: string | null;
  homeroom_teacher_profile_id?: string | null;
  id: string;
  name: string;
  status?: string | null;
}

interface ClassroomStudentCount {
  classroomId: string;
  classroomName: string;
  count: number;
}

interface AttendanceSessionRow {
  attendance_date: string;
  id: string;
  period_label: string;
  subject_name: string | null;
}

interface AttendanceRecordSummaryRow {
  session_id: string;
  status: string;
  student_id: string;
}

interface SubjectAttendanceSummary {
  absent: number;
  id: string;
  late: number;
  periodLabel: string;
  present: number;
  subjectName: string;
  total: number;
}

type UpcomingEventType = 'holiday' | 'exam' | 'activity' | 'makeup' | 'custom';

interface UpcomingEvent {
  date: string;
  endDate?: string;
  durationDays?: number;
  id: string;
  title: string;
  type: UpcomingEventType;
}

function groupUpcomingEvents(events: UpcomingEvent[]): UpcomingEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const grouped: UpcomingEvent[] = [];

  for (const ev of sorted) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.title.trim().toLowerCase() === ev.title.trim().toLowerCase() &&
      last.type === ev.type
    ) {
      const lastEndDate = last.endDate || last.date;
      const lastDateTime = new Date(`${lastEndDate}T00:00:00`).getTime();
      const currDateTime = new Date(`${ev.date}T00:00:00`).getTime();
      const diffDays = Math.round((currDateTime - lastDateTime) / 86_400_000);

      if (diffDays === 1) {
        last.endDate = ev.date;
        const startDateTime = new Date(`${last.date}T00:00:00`).getTime();
        last.durationDays = Math.round((currDateTime - startDateTime) / 86_400_000) + 1;
        continue;
      }
      if (diffDays === 0) {
        continue;
      }
    }

    grouped.push({
      ...ev,
      endDate: ev.endDate || ev.date,
      durationDays: ev.durationDays || 1,
    });
  }

  return grouped;
}

const eventTypeConfig: Record<
  UpcomingEventType,
  {
    badge: string;
    dot: string;
    icon: LucideIcon;
    label: string;
    border: string;
  }
> = {
  holiday: {
    badge: 'bg-[#FBEFF2] text-[#8E354A] border-[#F0CFD7]',
    dot: 'bg-[#C25970] ring-2 ring-[#F0CFD7]',
    icon: Umbrella,
    label: 'หยุดเรียน',
    border: 'border-l-[#C25970]',
  },
  exam: {
    badge: 'bg-[#F1F0FA] text-[#49428B] border-[#D8D4F2]',
    dot: 'bg-[#6B63B5] ring-2 ring-[#D8D4F2]',
    icon: ClipboardList,
    label: 'วันสอบ',
    border: 'border-l-[#6B63B5]',
  },
  activity: {
    badge: 'bg-[#E6F4EC] text-[#1C573D] border-[#BFE0CD]',
    dot: 'bg-[#2F7D5B] ring-2 ring-[#BFE0CD]',
    icon: Sparkles,
    label: 'กิจกรรม',
    border: 'border-l-[#2F7D5B]',
  },
  makeup: {
    badge: 'bg-[#FDF4E1] text-[#8B5312] border-[#F0D9AE]',
    dot: 'bg-[#D98B26] ring-2 ring-[#F0D9AE]',
    icon: Clock,
    label: 'เรียนชดเชย',
    border: 'border-l-[#D98B26]',
  },
  custom: {
    badge: 'bg-[#E9F3FA] text-[#1D547C] border-[#CBE1F2]',
    dot: 'bg-[#2D72A3] ring-2 ring-[#CBE1F2]',
    icon: Pin,
    label: 'กำหนดเอง',
    border: 'border-l-[#2D72A3]',
  },
};

interface BirthdayStudent {
  birthDate: string;
  id: string;
  name: string;
  isToday: boolean;
}

type HealthReportType = 'toothbrushing' | 'milk' | 'lunch' | 'growth' | 'hygiene';

interface HealthRecordSummaryRow {
  bmi: number | null;
  height_cm: number | null;
  inspection_results: Record<string, string> | null;
  record_date: string;
  record_type: HealthReportType;
  status: string;
  student_id: string;
  weight_kg: number | null;
}

interface HealthReportMetric {
  attention: number;
  cadence: string;
  completed: number;
  detail: string;
  icon: typeof Sparkles;
  key: HealthReportType;
  label: string;
  percent: number;
  recorded: number;
  tone: string;
  total: number;
}

const healthReportConfigs: Array<Pick<HealthReportMetric, 'cadence' | 'icon' | 'key' | 'label' | 'tone'>> = [
  {
    cadence: 'วันนี้',
    icon: Sparkles,
    key: 'toothbrushing',
    label: 'แปรงฟัน',
    tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  },
  {
    cadence: 'วันนี้',
    icon: ShieldCheck,
    key: 'milk',
    label: 'ดื่มนม',
    tone: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  {
    cadence: 'วันนี้',
    icon: Utensils,
    key: 'lunch',
    label: 'อาหารกลางวัน',
    tone: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  {
    cadence: 'ข้อมูลล่าสุด',
    icon: Scale,
    key: 'growth',
    label: 'น้ำหนัก–ส่วนสูง–BMI',
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    cadence: 'ข้อมูลล่าสุด',
    icon: ClipboardCheck,
    key: 'hygiene',
    label: 'ตรวจสุขภาพ',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
];

function formatThaiRecordDate(value: string | undefined) {
  if (!value) return 'ยังไม่มีข้อมูล';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00+07:00`));
}

const emptyAnalyticsData: ClassroomAnalyticsData = {
  attendance: {
    absent: 0,
    late: 0,
    leave: 0,
    present: 0,
    totalSessions: 0,
  },
  attendanceTrend: [],
  behavior: {
    negativePoints: 0,
    positivePoints: 0,
    totalRecords: 0,
  },
  classroomName: '',
  dataCompleteness: {
    attendanceCheckedToday: false,
    behaviorRecorded: false,
    homeVisitsCount: 0,
    scoresEnteredCount: 0,
    studentsCount: 0,
  },
  savings: {
    accountCount: 0,
    activeAccounts: 0,
    monthlyDeposits: 0,
    totalBalance: 0,
  },
  scores: {
    assessmentCount: 0,
    averagePercent: 0,
    passedStudentsCount: 0,
  },
};

function getWorkspaceDashboardStats() {
  return dashboardStats.map((stat, index) =>
    index === 0
      ? { ...stat, detail: 'รวมทุกห้องเรียน' }
      : stat,
  );
}

export function DashboardPage({ session }: DashboardPageProps) {
  const canManageCurrentWorkspace = canManageWorkspace(session.profile.role);
  const demoMode = isDemoSession(session);
  const [stats, setStats] = useState(() => getWorkspaceDashboardStats());
  const [pendingJoinRequestCount, setPendingJoinRequestCount] = useState(0);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [classroomStudentCounts, setClassroomStudentCounts] = useState<ClassroomStudentCount[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [isRealigningClassrooms, setIsRealigningClassrooms] = useState(false);
  const realigningRef = useRef(false);

  const handleManualRealign = async () => {
    if (realigningRef.current || demoMode || !session.workspace) return;
    realigningRef.current = true;
    setIsRealigningClassrooms(true);
    try {
      const res = await autoRealignAllStudentsToCorrectRooms(session);
      if (res.success) {
        setReloadTrigger((v) => v + 1);
      }
    } catch (err) {
      console.error('Manual realign failed:', err);
    } finally {
      realigningRef.current = false;
      setIsRealigningClassrooms(false);
    }
  };

  const handleDeleteEmptyClassroom = async (classroomId: string, classroomName: string) => {
    if (!session.workspace) return;
    const confirmed = window.confirm(`คุณต้องการลบห้อง "${classroomName}" ที่ไม่มีนักเรียนนี้ออกจากระบบหรือไม่?`);
    if (!confirmed) return;

    // 1. Immediately record in localStorage so it NEVER reappears even if DB fails or delays
    hideClassroomIdLocally(session.workspace.id, classroomId);

    // 2. Immediately update local UI state
    setClassrooms((current) => current.filter((c) => c.id !== classroomId));
    setClassroomStudentCounts((current) => current.filter((c) => c.classroomId !== classroomId));
    setSelectedClassroomId((prev) => {
      if (prev === classroomId) {
        const remaining = classrooms.filter((c) => c.id !== classroomId);
        return remaining[0]?.id || '';
      }
      return prev;
    });

    if (!supabase || demoMode) {
      return;
    }

    try {
      // Step 1: Soft delete in Supabase (archived) - teachers always have update permission
      await supabase
        .from('classrooms')
        .update({ status: 'archived' })
        .eq('id', classroomId)
        .eq('workspace_id', session.workspace.id)
        .setHeader('x-silent', 'true');

      // Step 2: Try direct delete
      const { error: directErr } = await supabase
        .from('classrooms')
        .delete()
        .eq('id', classroomId)
        .eq('workspace_id', session.workspace.id)
        .setHeader('x-silent', 'true');

      // Step 3: Try RPC delete_classroom_safely if direct delete errored
      if (directErr) {
        try {
          await supabase.rpc('delete_classroom_safely', {
            target_classroom_id: classroomId,
          });
        } catch {}
      }
    } catch (err) {
      console.warn('Classroom delete warning (locally hidden):', err);
    }
  };
  const [analyticsData, setAnalyticsData] = useState<ClassroomAnalyticsData>(emptyAnalyticsData);
  const [watchlistStudents, setWatchlistStudents] = useState<WatchlistStudentItem[]>([]);
  const [subjectAttendanceSummaries, setSubjectAttendanceSummaries] = useState<SubjectAttendanceSummary[]>([]);
  const [dailyHealthRecords, setDailyHealthRecords] = useState<HealthRecordSummaryRow[]>([]);
  const [latestHealthRecords, setLatestHealthRecords] = useState<HealthRecordSummaryRow[]>([]);
  const [activeClassroomStudentIds, setActiveClassroomStudentIds] = useState<string[]>([]);
  const [healthReportsLoading, setHealthReportsLoading] = useState(false);
  const [quickLog, setQuickLog] = useState('');
  const [quickLogNotice, setQuickLogNotice] = useState<string | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleSettings>(() => loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id));
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [allCalendarEvents, setAllCalendarEvents] = useState<UpcomingEvent[]>([]);
  const [calendarViewMode, setCalendarViewMode] = useState<'calendar' | 'list'>(() => {
    try {
      const saved = window.localStorage.getItem('classcare:dashboard_calendar_view');
      if (saved === 'list' || saved === 'calendar') return saved;
    } catch {
      // ignore
    }
    return 'calendar';
  });

  const handleToggleCalendarView = (mode: 'calendar' | 'list') => {
    setCalendarViewMode(mode);
    try {
      window.localStorage.setItem('classcare:dashboard_calendar_view', mode);
    } catch {
      // ignore
    }
  };
  const [birthdayStudents, setBirthdayStudents] = useState<BirthdayStudent[]>([]);
  const thaiDayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const currentThaiDay = thaiDayNames[new Date().getDay()] || 'จันทร์';
  const initialMobileDay = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'].includes(currentThaiDay) ? currentThaiDay : 'จันทร์';
  const [mobileScheduleDay, setMobileScheduleDay] = useState<string>(initialMobileDay);
  const [scheduleClassFilter, setScheduleClassFilter] = useState<string>('all');

  // โหมดแสดงผล: 'shortcuts' (ศูนย์รวมทางลัดทุกเมนู - เข้ามาก็เจอเลย) หรือ 'analytics' (แดชบอร์ดสถิติ)
  const [dashboardViewMode, setDashboardViewMode] = useState<'shortcuts' | 'analytics'>(() => {
    if (typeof window === 'undefined') return 'shortcuts';
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') || params.get('tab');
    if (modeParam === 'analytics') return 'analytics';
    if (modeParam === 'shortcuts') return 'shortcuts';
    try {
      const saved = localStorage.getItem('classcare_dashboard_view_mode');
      if (saved === 'analytics' || saved === 'shortcuts') return saved;
    } catch {}
    return 'shortcuts'; // ค่าเริ่มต้น: เข้ามาก็เจอทางลัดทุกเมนูทันที
  });

  const handleSetDashboardViewMode = (mode: 'shortcuts' | 'analytics') => {
    setDashboardViewMode(mode);
    try {
      localStorage.setItem('classcare_dashboard_view_mode', mode);
    } catch {}
  };

  const weeklyPeriods = useMemo(() => buildSchedulePeriods(weeklySchedule), [weeklySchedule]);

  const { scheduleClassrooms, totalPeriodCount } = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    const activeDays = weeklySchedule.activeDays.slice(0, 5);

    for (const day of activeDays) {
      for (const period of weeklyPeriods) {
        const cell = weeklySchedule.cells[makeScheduleCellKey(day, period.index)];
        if (cell?.subject?.trim()) {
          total += 1;
          const cls = cell.classroom?.trim();
          if (cls) {
            map.set(cls, (map.get(cls) || 0) + 1);
          }
        }
      }
    }

    const classrooms = Array.from(map.entries())
      .map(([name, count]) => ({ count, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));

    return { scheduleClassrooms: classrooms, totalPeriodCount: total };
  }, [weeklySchedule, weeklyPeriods]);

  const isLunchPeriod = (periodIndex: number, period: { end: string; start: string }) => {
    const activeDays = weeklySchedule.activeDays.slice(0, 5);
    const allEmpty = activeDays.every((day) => !weeklySchedule.cells[makeScheduleCellKey(day, periodIndex)]?.subject?.trim());
    const isAroundLunchTime = period.start.startsWith('11:') || period.start.startsWith('12:') || periodIndex === 4;
    return allEmpty && isAroundLunchTime;
  };

  useEffect(() => {
    let isMounted = true;

    async function loadWeeklySchedule() {
      const fallback = loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id);
      if (!supabase || !session.workspace || demoMode) {
        if (isMounted) setWeeklySchedule(fallback);
        return;
      }

      const { data } = await supabase.from('workspace_schedule_settings').select('settings').eq('workspace_id', session.workspace.id).maybeSingle();

      if (!isMounted) return;
      setWeeklySchedule(data?.settings && typeof data.settings === 'object' ? { ...fallback, ...(data.settings as ScheduleSettings) } : fallback);
    }

    void loadWeeklySchedule();
    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace]);

  // Load Classrooms (Prioritizes teacher's advisory / homeroom classroom first)
  useEffect(() => {
    let isMounted = true;
    async function loadClassrooms() {
      if (!session.workspace) return;
      if (!supabase || demoMode) {
        const demoClassroom = {
          academic_year: session.workspace.academicYear,
          id: 'demo-classroom',
          name: session.workspace.classroomName,
          homeroom_teacher_profile_id: session.profile?.id,
          status: 'active',
        };
        setClassrooms([demoClassroom]);
        setSelectedClassroomId(demoClassroom.id);
        return;
      }

      const { data } = await supabase
        .from('classrooms')
        .select('id, name, academic_year, grade_level, homeroom_teacher_profile_id, status')
        .eq('workspace_id', session.workspace.id)
        .order('name', { ascending: true });

      if (!isMounted) return;
      if (data && data.length > 0) {
        const hiddenIds = getHiddenClassroomIds(session.workspace.id);
        const filteredData = (data as ClassroomRow[]).filter((c) => {
          if (c.status === 'archived' || c.status === 'inactive') return false;
          if (hiddenIds.has(c.id)) return false;
          return true;
        });

        const currentProfileId = session.profile?.id || '';
        const workspaceClassroomName = session.workspace?.classroomName?.trim().toLowerCase() || '';

        const isHomeroomCheck = (c: ClassroomRow) => {
          if (c.homeroom_teacher_profile_id && c.homeroom_teacher_profile_id === currentProfileId) {
            return true;
          }
          if (workspaceClassroomName) {
            const cName = c.name.trim().toLowerCase();
            if (cName === workspaceClassroomName) return true;
            if (cName.startsWith(workspaceClassroomName + '/') || cName.replace(/\s+/g, '') === workspaceClassroomName.replace(/\s+/g, '')) {
              return true;
            }
          }
          return false;
        };

        // Sort: Advisory / Homeroom classrooms come FIRST!
        const sorted = [...filteredData].sort((a, b) => {
          const aHome = isHomeroomCheck(a) ? 0 : 1;
          const bHome = isHomeroomCheck(b) ? 0 : 1;
          if (aHome !== bHome) return aHome - bHome;
          return a.name.localeCompare(b.name, 'th');
        });

        const advisory = sorted.find((c) => isHomeroomCheck(c));
        const defaultId = advisory ? advisory.id : sorted[0]?.id || '';

        setClassrooms(sorted);
        setSelectedClassroomId((prev) => {
          // If no previous selection, always default to the teacher's advisory classroom
          if (!prev || !sorted.some((c) => c.id === prev)) {
            return defaultId;
          }
          return prev;
        });
      }
    }
    void loadClassrooms();
    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace, session.profile?.id, reloadTrigger]);

  // Load General Workspace Dashboard Stats
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      if (!supabase || !session.workspace || demoMode) {
        setStats(getWorkspaceDashboardStats());
        if (demoMode) setClassroomStudentCounts([{ classroomId: 'demo-classroom', classroomName: session.workspace?.classroomName || 'ห้องเรียนตัวอย่าง', count: 3 }]);
        return;
      }

      const [{ data: activeStudentRows, count: studentCount }, { count: classroomCount }, { count: careCaseCount }, { data: savingsRows }] = await Promise.all([supabase.from('students').select('id,classroom_id', { count: 'exact' }).eq('workspace_id', session.workspace.id).eq('status', 'active'), supabase.from('classrooms').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active'), supabase.from('student_care_cases').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).in('status', ['open', 'monitoring']), supabase.from('savings_accounts').select('balance').eq('workspace_id', session.workspace.id).eq('status', 'active')]);

      if (!isMounted) return;

      const savingsBalance = (savingsRows || []).reduce((sum, row) => sum + Number((row as { balance?: number | string | null }).balance || 0), 0);
      const countsByClassroom = new Map<string, number>();
      ((activeStudentRows || []) as Array<{ classroom_id: string | null }>).forEach((student) => {
        const key = student.classroom_id || 'unassigned';
        countsByClassroom.set(key, (countsByClassroom.get(key) || 0) + 1);
      });

      // Filter out ghost empty duplicate classrooms (like "ป.5" with 0 students when "ป.5/1" has students)
      const validClassrooms = classrooms.filter(
        (c) => !isObsoleteGhostClassroom(c, classrooms, countsByClassroom, session.workspace?.id)
      );

      const nextClassroomCounts = validClassrooms.map((classroom) => ({
        classroomId: classroom.id,
        classroomName: classroom.name,
        count: countsByClassroom.get(classroom.id) || 0,
      }));
      const unassignedCount = countsByClassroom.get('unassigned') || 0;
      if (unassignedCount > 0)
        nextClassroomCounts.push({
          classroomId: 'unassigned',
          classroomName: 'ยังไม่ระบุห้อง',
          count: unassignedCount,
        });
      setClassroomStudentCounts(nextClassroomCounts);

      const totalRoomsCount = validClassrooms.length;
      const targetClassroom = classrooms.find((c) => c.id === selectedClassroomId);
      const selectedRoomStudents = selectedClassroomId ? countsByClassroom.get(selectedClassroomId) || 0 : null;

      let studentDetail = 'รวมทุกห้องเรียน';
      let studentSubDetail: string | undefined = undefined;

      if (totalRoomsCount > 1) {
        studentDetail = `รวม ${totalRoomsCount} ห้องเรียน`;
        if (targetClassroom) {
          studentSubDetail = `${targetClassroom.name}: ${selectedRoomStudents ?? 0} คน`;
        }
      } else if (totalRoomsCount === 1) {
        studentDetail = `ห้อง ${validClassrooms[0].name}`;
      } else {
        studentDetail = session.workspace.classroomName || 'ห้องเรียน';
      }

      setStats([
        {
          ...dashboardStats[0],
          detail: studentDetail,
          subDetail: studentSubDetail,
          value: String(studentCount ?? 0),
        },
        {
          ...dashboardStats[1],
          detail: 'ห้องที่กำลังใช้งาน',
          label: 'ห้องเรียน',
          value: String(totalRoomsCount || classroomCount || 0),
        },
        {
          ...dashboardStats[2],
          detail: 'เปิดอยู่และกำลังติดตาม',
          value: String(careCaseCount ?? 0),
        },
        {
          ...dashboardStats[3],
          value: savingsBalance.toLocaleString('th-TH', {
            maximumFractionDigits: 0,
          }),
        },
      ]);
    }

    void loadDashboardStats();
    return () => {
      isMounted = false;
    };
  }, [classrooms, demoMode, session.workspace, selectedClassroomId, reloadTrigger]);

  // Load Classroom Specific Real Analytics Data & Watchlist Students
  useEffect(() => {
    let isMounted = true;

    async function loadClassroomAnalytics() {
      if (!supabase || !session.workspace || !selectedClassroomId || demoMode) {
        setAnalyticsData(emptyAnalyticsData);
        setWatchlistStudents([]);
        setActiveClassroomStudentIds([]);
        return;
      }

      const targetClassroom = classrooms.find((c) => c.id === selectedClassroomId);
      const classroomName = targetClassroom ? targetClassroom.name : session.workspace.classroomName || 'ห้องเรียน';

      const today = getBangkokDate();
      const trendDates = Array.from({ length: 7 }, (_, index) => getBangkokDate(new Date(Date.now() - (6 - index) * 86_400_000)));
      const { data: attendanceSessionRows } = await supabase.from('attendance_sessions').select('id, attendance_date, period_label, subject_name').eq('workspace_id', session.workspace.id).eq('classroom_id', selectedClassroomId).gte('attendance_date', trendDates[0]).lte('attendance_date', today).order('attendance_date', { ascending: true }).order('period_label', { ascending: true });

      const allAttendanceSessionIds = ((attendanceSessionRows || []) as AttendanceSessionRow[]).map((item) => item.id);
      const attendanceRecordsPromise = allAttendanceSessionIds.length > 0 ? supabase.from('attendance_records').select('session_id, student_id, status').eq('workspace_id', session.workspace.id).in('session_id', allAttendanceSessionIds) : Promise.resolve({ data: [] as AttendanceRecordSummaryRow[] });

      const [{ data: studentRows }, { data: attendanceRows }, { data: savingsAccountRows }, { data: savingsTxRows }, { data: scoreAssessments }, { data: scoreEntries }, { data: behaviorRows }, { data: homeVisitRows }, { data: careCaseRows }] = await Promise.all([
        supabase.from('students').select('id, student_code, first_name, last_name').eq('workspace_id', session.workspace.id).eq('classroom_id', selectedClassroomId).eq('status', 'active'),
        attendanceRecordsPromise,
        supabase.from('savings_accounts').select('id, student_id, balance').eq('workspace_id', session.workspace.id),
        supabase.from('savings_transactions').select('student_id, amount, transaction_type').eq('workspace_id', session.workspace.id),
        supabase.from('score_assessments').select('id, max_score').eq('workspace_id', session.workspace.id),
        supabase.from('score_entries').select('student_id, score, assessment_id').eq('workspace_id', session.workspace.id),
        supabase.from('behavior_records').select('student_id, points, tone').eq('workspace_id', session.workspace.id),
        supabase.from('student_home_visits').select('student_id, status').eq('workspace_id', session.workspace.id).in('status', ['submitted', 'certified']),
        supabase.from('student_care_cases').select('id, student_id, summary, status, risk_level').eq('workspace_id', session.workspace.id).in('status', ['open', 'monitoring']),
      ]);

      if (!isMounted) return;

      const studentMap = new Map((studentRows || []).map((s) => [s.id, s]));
      const studentIds = new Set(studentMap.keys());
      setActiveClassroomStudentIds(Array.from(studentIds));
      const studentsCount = studentIds.size;
      const attendanceSessions = (attendanceSessionRows || []) as AttendanceSessionRow[];
      const todayAttendanceSessionIds = new Set(attendanceSessions.filter((item) => item.attendance_date === today).map((item) => item.id));
      const todayAttendanceRows = (attendanceRows || []).filter((row) => todayAttendanceSessionIds.has(row.session_id));
      const recordsBySession = new Map<string, AttendanceRecordSummaryRow[]>();
      (attendanceRows || []).forEach((row) => {
        if (!row.session_id) return;
        const existing = recordsBySession.get(row.session_id) || [];
        existing.push(row as AttendanceRecordSummaryRow);
        recordsBySession.set(row.session_id, existing);
      });

      // Real Attendance calculations
      let present = 0;
      let late = 0;
      let leave = 0;
      let absent = 0;
      const attendanceCheckedToday = todayAttendanceRows.length > 0;

      todayAttendanceRows.forEach((row) => {
        if (studentIds.has(row.student_id)) {
          if (row.status === 'present' || row.status === 'activity') present++;
          else if (row.status === 'late') late++;
          else if (row.status === 'leave' || row.status === 'sick') leave++;
          else if (row.status === 'absent') absent++;
        }
      });

      // Real Savings calculations
      const classroomSavingsAccounts = (savingsAccountRows || []).filter((acc) => studentIds.has(acc.student_id));
      const activeSavingsAccounts = classroomSavingsAccounts.filter((acc) => Number(acc.balance || 0) > 0).length;
      const totalBalance = classroomSavingsAccounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
      const monthlyDeposits = (savingsTxRows || []).filter((tx) => studentIds.has(tx.student_id) && tx.transaction_type === 'deposit').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      // Real Behavior calculations
      let posPoints = 0;
      let negPoints = 0;
      let behaviorCount = 0;
      (behaviorRows || []).forEach((b) => {
        if (studentIds.has(b.student_id)) {
          behaviorCount++;
          if (b.tone === 'positive') posPoints += Number(b.points || 1);
          else negPoints += Number(b.points || 1);
        }
      });

      // Real Home Visits
      const homeVisitsCount = (homeVisitRows || []).filter((hv) => studentIds.has(hv.student_id)).length;

      // Real Scores
      const maxScoreMap = new Map((scoreAssessments || []).map((a) => [a.id, Number(a.max_score || 100)]));
      const classroomScoreRecords = (scoreEntries || []).filter((sr) => studentIds.has(sr.student_id));
      let totalScorePct = 0;
      const studentScoresMap = new Map<string, number[]>();

      classroomScoreRecords.forEach((sr) => {
        const max = maxScoreMap.get(sr.assessment_id) || 100;
        const pct = Math.min(100, Math.max(0, (Number(sr.score || 0) / max) * 100));
        totalScorePct += pct;

        if (!studentScoresMap.has(sr.student_id)) studentScoresMap.set(sr.student_id, []);
        studentScoresMap.get(sr.student_id)?.push(pct);
      });

      let passedStudentsCount = 0;
      studentScoresMap.forEach((pcts) => {
        const avg = pcts.reduce((sum, p) => sum + p, 0) / pcts.length;
        if (avg >= 50) passedStudentsCount++;
      });

      const averagePercent = classroomScoreRecords.length > 0 ? Math.round(totalScorePct / classroomScoreRecords.length) : 0;
      const attendanceTrend = trendDates.map((date) => {
        const sessionIds = new Set(attendanceSessions.filter((item) => item.attendance_date === date).map((item) => item.id));
        const records = (attendanceRows || []).filter((row) => sessionIds.has(row.session_id) && studentIds.has(row.student_id));
        return records.reduce(
          (summary, row) => {
            if (row.status === 'present' || row.status === 'activity') summary.present += 1;
            else if (row.status === 'late') summary.late += 1;
            else if (row.status === 'absent') summary.absent += 1;
            else if (row.status === 'leave' || row.status === 'sick') summary.leave += 1;
            summary.total += 1;
            return summary;
          },
          { absent: 0, date, late: 0, leave: 0, present: 0, total: 0 },
        );
      });

      setAnalyticsData({
        attendance: {
          absent,
          late,
          leave,
          present,
          totalSessions: present + late + leave + absent,
        },
        attendanceTrend,
        behavior: {
          negativePoints: negPoints,
          positivePoints: posPoints,
          totalRecords: behaviorCount,
        },
        classroomName,
        dataCompleteness: {
          attendanceCheckedToday,
          behaviorRecorded: behaviorCount > 0,
          homeVisitsCount,
          scoresEnteredCount: (scoreAssessments || []).length,
          studentsCount,
        },
        savings: {
          accountCount: classroomSavingsAccounts.length,
          activeAccounts: activeSavingsAccounts,
          monthlyDeposits,
          totalBalance,
        },
        scores: {
          assessmentCount: (scoreAssessments || []).length,
          averagePercent,
          passedStudentsCount,
        },
      });

      // Real Watchlist Students (from student_care_cases in DB)
      const classroomCareCases = (careCaseRows || []).filter((cc) => studentIds.has(cc.student_id));
      const watchlistItems: WatchlistStudentItem[] = classroomCareCases.map((cc) => {
        const st = studentMap.get(cc.student_id);
        const name = st ? `${st.first_name} ${st.last_name}` : 'นักเรียนในห้อง';
        return {
          accent: cc.risk_level === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800',
          id: cc.id,
          name,
          reason: cc.summary || 'ติดตามการดูแล',
          status: cc.status === 'open' ? 'เคสใหม่' : 'กำลังติดตาม',
        };
      });
      setWatchlistStudents(watchlistItems);

      const subjectSummaries = attendanceSessions
        .filter((item) => item.attendance_date === today)
        .filter((item) => Boolean(item.subject_name))
        .map((item) => {
          const records = recordsBySession.get(item.id) || [];
          const present = records.filter((record) => record.status === 'present' || record.status === 'activity').length;
          const absent = records.filter((record) => record.status === 'absent').length;
          const late = records.filter((record) => record.status === 'late').length;
          return {
            absent,
            id: item.id,
            late,
            periodLabel: item.period_label,
            present,
            subjectName: item.subject_name || 'ไม่ระบุวิชา',
            total: records.length,
          };
        });
      setSubjectAttendanceSummaries(subjectSummaries);
    }

    void loadClassroomAnalytics();
    return () => {
      isMounted = false;
    };
  }, [classrooms, demoMode, selectedClassroomId, session.workspace]);

  // Load daily routines and the latest periodic health snapshots for the selected classroom.
  useEffect(() => {
    let isMounted = true;

    async function loadHealthReportSummary() {
      if (!supabase || !session.workspace || !selectedClassroomId || demoMode) {
        setDailyHealthRecords([]);
        setLatestHealthRecords([]);
        setHealthReportsLoading(false);
        return;
      }

      setHealthReportsLoading(true);
      const today = getBangkokDate();
      const fields = 'student_id,record_type,status,record_date,weight_kg,height_cm,bmi,inspection_results';
      const [{ data: dailyRows }, { data: snapshotRows }] = await Promise.all([supabase.from('student_health_records').select(fields).eq('workspace_id', session.workspace.id).eq('classroom_id', selectedClassroomId).eq('record_date', today).in('record_type', ['toothbrushing', 'milk', 'lunch']), supabase.from('student_health_records').select(fields).eq('workspace_id', session.workspace.id).eq('classroom_id', selectedClassroomId).in('record_type', ['growth', 'hygiene']).order('record_date', { ascending: false }).limit(1000)]);

      if (!isMounted) return;
      setDailyHealthRecords((dailyRows || []) as HealthRecordSummaryRow[]);
      setLatestHealthRecords((snapshotRows || []) as HealthRecordSummaryRow[]);
      setHealthReportsLoading(false);
    }

    void loadHealthReportSummary();
    return () => {
      isMounted = false;
    };
  }, [demoMode, selectedClassroomId, session.workspace]);

  // Load Upcoming School Calendar Events (DB + Local Storage + Thai Holidays Preset + Realtime Sync)
  useEffect(() => {
    let isMounted = true;

    async function loadUpcomingEvents() {
      const todayStr = getBangkokDate();
      const todayObj = new Date();
      const targetYear = todayObj.getFullYear();
      const pastDate = new Date(Date.now() - 35 * 86_400_000);
      const pastStr = getBangkokDate(pastDate);
      const futureDate = new Date(Date.now() + 120 * 86_400_000);
      const futureStr = getBangkokDate(futureDate);

      const toEventType = (t: string): UpcomingEventType => {
        if (t === 'holiday' || t === 'exam' || t === 'activity' || t === 'makeup') return t;
        return 'custom';
      };

      const collected: UpcomingEvent[] = [];
      const seen = new Set<string>();

      // 1. Load from Supabase if connected
      if (supabase && session.workspace && !demoMode) {
        try {
          const { data, error } = await supabase
            .from('school_calendar_days')
            .select('id, calendar_date, title, day_type')
            .eq('workspace_id', session.workspace.id)
            .gte('calendar_date', pastStr)
            .lte('calendar_date', futureStr)
            .neq('day_type', 'school_day')
            .order('calendar_date', { ascending: true })
            .limit(100);

          if (!error && data) {
            data.forEach((row) => {
              const d = String(row.calendar_date).slice(0, 10);
              const key = `${d}|${row.title}`;
              if (!seen.has(key)) {
                seen.add(key);
                collected.push({
                  id: String(row.id),
                  date: d,
                  title: String(row.title),
                  type: toEventType(String(row.day_type || 'custom')),
                });
              }
            });
          }
        } catch {
          // ignore error and proceed to local storage
        }
      }

      // 2. Load from Local Storage Data Safety backup
      try {
        const storageKey = `classcare:data-safety:${session.workspace?.id || session.profile?.id}`;
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const state = JSON.parse(raw) as { calendarRules?: Array<{ id: string; date: string; title: string; type: string }> };
          (state.calendarRules || []).forEach((item) => {
            if (item.date >= pastStr && item.date <= futureStr) {
              const key = `${item.date}|${item.title}`;
              if (!seen.has(key)) {
                seen.add(key);
                collected.push({
                  id: item.id || `local-${item.date}`,
                  date: item.date,
                  title: item.title,
                  type: toEventType(item.type),
                });
              }
            }
          });
        }
      } catch {
        // ignore
      }

      // 3. Supplement with Official Thai Public Holidays so teacher always has schedule context
      const presets = [...getThaiPublicHolidays(targetYear), ...getThaiPublicHolidays(targetYear + 1)];
      presets.forEach((p, idx) => {
        if (p.date >= pastStr && p.date <= futureStr) {
          const key = `${p.date}|${p.title}`;
          if (!seen.has(key)) {
            seen.add(key);
            collected.push({
              id: `preset-${p.date}-${idx}`,
              date: p.date,
              title: p.title,
              type: toEventType(p.type),
            });
          }
        }
      });

      // Sort ascending by date & group consecutive multi-day events
      collected.sort((a, b) => a.date.localeCompare(b.date));
      const groupedEvents = groupUpcomingEvents(collected);

      if (isMounted) {
        setAllCalendarEvents(groupedEvents);
        const upcomingOnly = groupedEvents.filter((ev) => {
          const checkDate = ev.endDate || ev.date;
          return checkDate >= todayStr;
        });
        setUpcomingEvents(upcomingOnly.slice(0, 10));
      }
    }

    void loadUpcomingEvents();

    const handleCalendarUpdate = () => {
      void loadUpcomingEvents();
    };
    window.addEventListener('classcare-calendar-updated', handleCalendarUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('classcare-calendar-updated', handleCalendarUpdate);
    };
  }, [demoMode, session.profile?.id, session.workspace]);

  // Load Student Birthdays This Week (for selected classroom)
  useEffect(() => {
    let isMounted = true;

    async function loadBirthdays() {
      if (!supabase || !session.workspace || !selectedClassroomId || demoMode) {
        // Demo mode: two fake birthdays
        const today = new Date();
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        setBirthdayStudents([
          { id: 'demo-b1', name: 'สมชาย ใจดี', birthDate: fmt(today), isToday: true },
          { id: 'demo-b2', name: 'สมหญิง สุขใส', birthDate: fmt(new Date(today.getTime() + 2 * 86_400_000)), isToday: false },
        ]);
        return;
      }

      const { data: studentRows } = await supabase
        .from('students')
        .select('id, first_name, last_name, birth_date')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', selectedClassroomId)
        .eq('status', 'active')
        .not('birth_date', 'is', null);

      if (!isMounted) return;

      const todayDate = new Date();
      const todayMD = `${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

      const weekBirthdays: BirthdayStudent[] = [];
      for (let offset = 0; offset < 7; offset++) {
        const d = new Date(todayDate.getTime() + offset * 86_400_000);
        const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dateStr = d.toISOString().slice(0, 10);
        (studentRows || []).forEach((s) => {
          const bd = String(s.birth_date || '').slice(5); // MM-DD
          if (bd === md) {
            weekBirthdays.push({
              id: String(s.id),
              name: `${s.first_name} ${s.last_name}`,
              birthDate: dateStr,
              isToday: md === todayMD,
            });
          }
        });
      }
      setBirthdayStudents(weekBirthdays);
    }

    void loadBirthdays();
    return () => { isMounted = false; };
  }, [demoMode, selectedClassroomId, session.workspace]);

  // Load Pending Join Requests
  useEffect(() => {
    let isMounted = true;

    async function loadPendingJoinRequests() {
      if (!supabase || !session.workspace || !canManageCurrentWorkspace || demoMode) {
        setPendingJoinRequestCount(0);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_workspace_members', {
          target_workspace_id: session.workspace.id,
        })
        .returns<WorkspaceMemberSummaryRow[]>();

      if (!isMounted) return;
      if (error) {
        setPendingJoinRequestCount(0);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setPendingJoinRequestCount(rows.filter((member) => member.status === 'invited').length);
    }

    void loadPendingJoinRequests();
    return () => {
      isMounted = false;
    };
  }, [canManageCurrentWorkspace, demoMode, session.workspace]);

  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);

  const currentProfileId = session.profile?.id || '';
  const workspaceHomeroomName = session.workspace?.classroomName?.trim().toLowerCase() || '';

  const isClassroomHomeroom = (c?: ClassroomRow | null) => {
    if (!c) return false;
    if (c.homeroom_teacher_profile_id && c.homeroom_teacher_profile_id === currentProfileId) {
      return true;
    }
    if (workspaceHomeroomName && c.name.trim().toLowerCase() === workspaceHomeroomName) {
      return true;
    }
    return false;
  };

  const isSelectedClassroomHomeroom = isClassroomHomeroom(selectedClassroom);

  // Attendance Trend Delta: compare last 3 days vs previous 3 days
  const attendanceTrendDelta = useMemo(() => {
    if (analyticsData.attendanceTrend.length < 6) return null;
    const recent = analyticsData.attendanceTrend.slice(-3);
    const prev = analyticsData.attendanceTrend.slice(-6, -3);
    const avgRate = (days: typeof recent) => {
      const totals = days.reduce((acc, d) => ({ present: acc.present + d.present, total: acc.total + d.total }), { present: 0, total: 0 });
      return totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : null;
    };
    const recentRate = avgRate(recent);
    const prevRate = avgRate(prev);
    if (recentRate === null || prevRate === null) return null;
    return recentRate - prevRate;
  }, [analyticsData.attendanceTrend]);
  const myAdvisoryClassroom = classrooms.find((c) => isClassroomHomeroom(c));

  const healthReportMetrics = useMemo<HealthReportMetric[]>(() => {
    const total = analyticsData.dataCompleteness.studentsCount;
    const activeStudentIds = new Set(activeClassroomStudentIds);
    const latestByStudentAndType = new Map<string, HealthRecordSummaryRow>();
    latestHealthRecords
      .filter((record) => activeStudentIds.has(record.student_id))
      .forEach((record) => {
        const key = `${record.record_type}:${record.student_id}`;
        if (!latestByStudentAndType.has(key)) latestByStudentAndType.set(key, record);
      });

    return healthReportConfigs.map((config) => {
      const records = config.cadence === 'วันนี้' ? dailyHealthRecords.filter((record) => activeStudentIds.has(record.student_id) && record.record_type === config.key) : Array.from(latestByStudentAndType.values()).filter((record) => record.record_type === config.key);
      const uniqueRecords = Array.from(new Map(records.map((record) => [record.student_id, record])).values());
      const recorded = uniqueRecords.length;
      const completed = config.key === 'growth' ? uniqueRecords.filter((record) => record.weight_kg !== null && record.height_cm !== null && record.bmi !== null).length : uniqueRecords.filter((record) => ['completed', 'normal'].includes(record.status)).length;
      const attention = uniqueRecords.filter((record) => ['missed', 'attention'].includes(record.status)).length;
      const latestDate = uniqueRecords.reduce<string | undefined>((latest, record) => (!latest || record.record_date > latest ? record.record_date : latest), undefined);
      return {
        ...config,
        attention,
        completed,
        detail: config.cadence === 'วันนี้' ? `ประจำวันที่ ${formatThaiRecordDate(getBangkokDate())}` : `ล่าสุด ${formatThaiRecordDate(latestDate)}`,
        percent: total > 0 ? Math.min(100, Math.round((recorded / total) * 100)) : 0,
        recorded,
        total,
      };
    });
  }, [activeClassroomStudentIds, analyticsData.dataCompleteness.studentsCount, dailyHealthRecords, latestHealthRecords]);

  const completedHealthReportCount = healthReportMetrics.filter((metric) => metric.total > 0 && metric.recorded >= metric.total).length;
  const completedDailyRoutineCount = healthReportMetrics.filter((metric) => metric.cadence === 'วันนี้' && metric.total > 0 && metric.recorded >= metric.total).length;
  const healthReportPath = (mode: HealthReportType) => `/app/dashboard?view=student-health&healthMode=${mode}${selectedClassroomId ? `&classroomId=${selectedClassroomId}` : ''}`;

  const dynamicTodayTasks = [
    {
      detail: 'บันทึกสถานะนักเรียนก่อนเริ่มงานช่วงเช้า',
      icon: CalendarClock,
      label: 'เช็กเวลาเรียนประจำวัน',
      path: '/app/dashboard?view=teacher-work',
      status: analyticsData.dataCompleteness.attendanceCheckedToday ? 'เช็กแล้ว' : 'ทำตอนนี้',
      tone: analyticsData.dataCompleteness.attendanceCheckedToday ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50',
    },
    {
      detail: 'ตรวจรายการคะแนนที่บันทึกแล้วในระบบ',
      icon: ClipboardList,
      label: 'ตรวจและกรอกคะแนน',
      path: '/app/dashboard?view=scores&scoreView=excel',
      status: `${analyticsData.scores.assessmentCount} ชุดคะแนน`,
      tone: 'text-sky-700 bg-sky-50',
    },
    {
      detail: 'แปรงฟัน ดื่มนม และอาหารกลางวันของนักเรียนทั้งห้อง',
      icon: Sparkles,
      label: 'บันทึกสุขภาพและกิจวัตร',
      path: healthReportPath('toothbrushing'),
      status: `${completedDailyRoutineCount}/3 รายงาน`,
      tone: completedDailyRoutineCount === 3 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50',
    },
    {
      detail: 'ทบทวนนักเรียนที่มีสถานะติดตาม',
      icon: HeartHandshake,
      label: 'ติดตามเคสดูแลนักเรียน',
      path: '/app/dashboard?view=students&studentView=care',
      status: `${watchlistStudents.length} คน`,
      tone: watchlistStudents.length > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-600 bg-slate-100',
    },
    {
      detail: 'ดูสรุปประจำเดือนก่อนส่งฝ่ายบริหาร',
      icon: FileSpreadsheet,
      label: 'ตรวจรายงานประจำเดือน',
      path: '/app/dashboard?view=reports&reportView=attendance',
      status: 'พร้อมตรวจ',
      tone: 'text-teal-700 bg-teal-50',
    },
  ];

  async function submitQuickLog(event: FormEvent) {
    event.preventDefault();
    if (!session.workspace?.id || !quickLog.trim()) return;
    if (!supabase || demoMode) {
      setQuickLog('');
      setQuickLogNotice('บันทึกตัวอย่างลง Daily Brief วันนี้แล้ว (ไม่เขียนข้อมูลจริง)');
      return;
    }
    const { error } = await supabase.from('daily_brief_logs').insert({
      workspace_id: session.workspace.id,
      classroom_id: selectedClassroomId || null,
      log_date: getBangkokDate(),
      log_type: 'quick',
      body: quickLog.trim(),
      created_by: session.profile.id,
    });
    if (error) setQuickLogNotice(error.message.includes('daily_brief_logs') ? 'กรุณาติดตั้ง migration 0044 เพื่อเปิด Quick Log' : 'บันทึกไม่สำเร็จ');
    else {
      setQuickLog('');
      setQuickLogNotice('เพิ่มลง Daily Brief วันนี้แล้ว');
    }
  }

  return (
    <main className="app-page dashboard-premium">
      {/* Morning Sage & Warm Linen Botanical Hero Banner */}
      <div className="botanical-banner relative flex flex-col gap-4 overflow-hidden p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <BotanicalCornerWatermark className="pointer-events-none absolute -bottom-4 right-2 opacity-60 sm:right-6" color="#2F7D5B" opacity={0.14} />

        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#DCE3D7] bg-white shadow-xs sm:h-14 sm:w-14">
            <AppLogo className="h-9 w-9 sm:h-10 sm:w-10" />
          </div>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2F7D5B]">
              <Sun size={13} aria-hidden="true" />
              ภาพรวมประจำวัน · {formatThaiRecordDate(getBangkokDate())}
            </p>
            <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight text-[#1F2A22] sm:text-2xl">
              สวัสดีตอนเช้า, {session.profile.displayName || 'คุณครู'}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#5B6A5F]">
              <span>{session.workspace?.schoolName || 'โรงเรียน'}</span>
              <span>·</span>
              <span className={isSelectedClassroomHomeroom ? 'inline-flex items-center gap-1 font-bold text-[#1C573D]' : 'text-[#1F2A22]'}>
                {isSelectedClassroomHomeroom ? <Star size={12} className="fill-[#D98B26] text-[#D98B26]" aria-hidden="true" /> : null}
                {isSelectedClassroomHomeroom ? 'ห้องที่ปรึกษา: ' : 'ห้องเรียน: '}
                {selectedClassroom ? selectedClassroom.name : session.workspace?.classroomName || 'ห้องเรียน'}
              </span>
              {isSelectedClassroomHomeroom && (
                <span className="rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-2.5 py-0.5 text-xs font-bold text-[#1C573D]">
                  ครูที่ปรึกษา
                </span>
              )}
              {attendanceTrendDelta !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    attendanceTrendDelta >= 0
                      ? 'border-[#BFE0CD] bg-[#E6F4EC] text-[#1C573D]'
                      : 'border-[#F0CFD7] bg-[#FBEFF2] text-[#8E354A]'
                  }`}
                  title="เปรียบเทียบอัตราการมาเรียน 3 วันล่าสุด กับ 3 วันก่อนหน้า"
                >
                  {attendanceTrendDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {attendanceTrendDelta >= 0 ? '+' : ''}{attendanceTrendDelta}% สัปดาห์นี้
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          {/* Quick switch to advisory classroom if currently looking at another room */}
          {myAdvisoryClassroom && selectedClassroomId !== myAdvisoryClassroom.id && (
            <button
              type="button"
              onClick={() => setSelectedClassroomId(myAdvisoryClassroom.id)}
              className="flex items-center gap-1.5 rounded-xl border border-[#F0D9AE] bg-[#FDF4E1] px-3.5 py-2 text-xs font-bold text-[#8B5312] shadow-2xs transition hover:bg-[#F9E7C4] active:scale-95"
              title="สลับกลับไปดูข้อมูลห้องที่ปรึกษาของคุณทันที"
            >
              <Star size={13} className="fill-[#D98B26] text-[#D98B26]" aria-hidden="true" />
              <span>กลับไปห้องที่ปรึกษา ({myAdvisoryClassroom.name})</span>
            </button>
          )}

          {/* Classroom Selector Dropdown */}
          {classrooms.length > 0 ? (
            <div className="relative inline-block text-left">
              <div
                className={`flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2 shadow-2xs transition-all ${
                  isSelectedClassroomHomeroom
                    ? 'border-[#BFE0CD] text-[#1C573D]'
                    : 'border-[#DCE3D7] text-[#1F2A22]'
                }`}
              >
                {isSelectedClassroomHomeroom ? (
                  <Star className="fill-[#D98B26] text-[#D98B26]" size={15} aria-hidden="true" />
                ) : (
                  <School className="text-[#2F7D5B]" size={15} aria-hidden="true" />
                )}
                <span className="text-xs font-bold text-[#6F8073]">
                  {isSelectedClassroomHomeroom ? 'ห้อง:' : 'เลือกห้อง:'}
                </span>
                <select
                  className="cursor-pointer bg-transparent pr-4 text-xs font-bold text-[#1F2A22] focus:outline-none sm:text-sm"
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                >
                  {classrooms.map((c) => {
                    const isHome = isClassroomHomeroom(c);
                    return (
                      <option key={c.id} value={c.id}>
                        {isHome ? '[ห้องที่ปรึกษา] ' : ''}
                        {c.name} ({c.academic_year || '2569'})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none -ml-4 text-[#7B8A7E]" size={16} />
              </div>
            </div>
          ) : null}

          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2F7D5B] px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#235F45] active:scale-[0.98]"
            to="/app/dashboard?view=teacher-work"
          >
            <CalendarClock size={17} aria-hidden="true" />
            เช็กเวลาเรียน
          </Link>
        </div>
      </div>

      {/* Homepage Calendar Notification & Reminder Botanical Card */}
      {(() => {
        const todayStr = getBangkokDate();
        const todayEvents = upcomingEvents.filter((ev) => {
          if (ev.endDate && ev.endDate !== ev.date) {
            return todayStr >= ev.date && todayStr <= ev.endDate;
          }
          return ev.date === todayStr;
        });
        const upcomingSlice = upcomingEvents.filter((ev) => {
          const checkDate = ev.endDate || ev.date;
          return checkDate > todayStr;
        }).slice(0, 3);

        if (todayEvents.length > 0) {
          const primaryEvent = todayEvents[0];
          const conf = eventTypeConfig[primaryEvent.type] || eventTypeConfig.custom;
          const EventIcon = conf.icon;
          return (
            <section aria-label="แจ้งเตือนกิจกรรมวันนี้" className="relative mt-4 overflow-hidden rounded-2xl border border-[#F0D9AE] bg-[#FFFDF8] p-4 shadow-xs sm:px-5">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[#D98B26]" />
              <BotanicalCardSprig className="absolute right-2 top-1" color="#D98B26" opacity={0.14} />

              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#F0D9AE] bg-[#FDF4E1] text-[#8B5312]">
                    <Bell size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#D98B26] px-2.5 py-0.5 text-xs font-bold text-white">
                        แจ้งเตือนวันนี้
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${conf.badge}`}>
                        <EventIcon size={12} aria-hidden="true" />
                        {conf.label}
                      </span>
                    </div>
                    <h3 className="mt-1 truncate font-display text-base font-bold text-[#1F2A22] sm:text-lg">
                      {todayEvents.map((e) => e.title).join(' · ')}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-[#5B6A5F]">
                      {todayEvents.length > 1
                        ? `มีทั้งหมด ${todayEvents.length} รายการวันนี้`
                        : primaryEvent.type === 'holiday'
                        ? 'วันหยุดสถานศึกษา ระบบตั้งค่าข้ามการนับเวลาเรียนให้อัตโนมัติ'
                        : primaryEvent.type === 'exam'
                        ? 'มีกำหนดการสอบ โปรดตรวจสอบการบันทึกเวลาเรียนและเอกสารวัดผล'
                        : 'กิจกรรมของโรงเรียนในวันนี้'}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                  <Link
                    to="/app/dashboard?view=school-calendar"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#1C342B] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#2F7D5B] active:scale-95"
                  >
                    <span>เปิดปฏิทินโรงเรียน</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </section>
          );
        }

        if (upcomingSlice.length > 0) {
          const featuredEvent = upcomingSlice[0];
          const featuredConfig = eventTypeConfig[featuredEvent.type] || eventTypeConfig.custom;
          const FeaturedIcon = featuredConfig.icon;
          const featuredDate = new Date(`${featuredEvent.date}T00:00:00`);
          const daysFromNow = Math.round((featuredDate.getTime() - Date.now()) / 86_400_000);
          const featuredDateLabel = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long' }).format(featuredDate);
          return (
            <section aria-label="แจ้งเตือนกำหนดการเร็วๆ นี้" className="relative mt-4 overflow-hidden rounded-2xl border border-[#F0D9AE] bg-[#FFFDF8] p-4 shadow-xs sm:px-5">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[#D98B26]" />
              <BotanicalCardSprig className="absolute right-2 top-1" color="#D98B26" opacity={0.14} />
              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#F0D9AE] bg-[#FDF4E1] text-[#8B5312]">
                    <Bell size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#D98B26] px-2.5 py-0.5 text-xs font-bold text-white">แจ้งเตือนกำหนดการ</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${featuredConfig.badge}`}>
                        <FeaturedIcon size={12} aria-hidden="true" />
                        {featuredConfig.label}
                      </span>
                      <span className="rounded-full border border-[#CBE1F2] bg-[#E9F3FA] px-2.5 py-0.5 text-xs font-bold text-[#1D547C]">{daysFromNow === 1 ? 'พรุ่งนี้' : `อีก ${daysFromNow} วัน`}</span>
                    </div>
                    <h3 className="mt-1 truncate font-display text-base font-bold text-[#1F2A22] sm:text-lg">{featuredEvent.title}</h3>
                    <p className="mt-0.5 text-xs font-medium text-[#5B6A5F]">{featuredDateLabel}{upcomingSlice.length > 1 ? ` · มีกำหนดการถัดไปอีก ${upcomingSlice.length - 1} รายการ` : ' · กิจกรรมของโรงเรียนที่กำลังจะถึง'}</p>
                  </div>
                </div>
                <Link to="/app/dashboard?view=school-calendar" className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 self-end rounded-xl bg-[#1C342B] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#2F7D5B] sm:self-center">
                  เปิดปฏิทินโรงเรียน <ArrowRight size={14} />
                </Link>
              </div>
            </section>
          );
        }

        return null;
      })()}

      <TeacherSchedulePreview
        currentDay={currentThaiDay}
        onClassroomChange={setScheduleClassFilter}
        onDayChange={setMobileScheduleDay}
        scheduleClassrooms={scheduleClassrooms}
        scheduleClassFilter={scheduleClassFilter}
        selectedDay={mobileScheduleDay}
        settings={weeklySchedule}
        totalPeriodCount={totalPeriodCount}
      />

      {/* Mode Selector Tabs: ทางลัดทุกเมนู vs แดชบอร์ดสถิติ */}
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#DCE3D7] bg-white p-1.5 shadow-2xs sm:w-fit">
        <div className="flex w-full items-center gap-1.5 rounded-xl bg-[#EDF1EA] p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('shortcuts')}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all sm:flex-initial sm:gap-2 sm:px-4 ${
              dashboardViewMode === 'shortcuts'
                ? 'bg-white text-[#1C342B] shadow-xs ring-1 ring-[#BFE0CD]'
                : 'text-[#5B6A5F] hover:bg-white/60 hover:text-[#1F2A22]'
            }`}
          >
            <BookOpen size={15} className={dashboardViewMode === 'shortcuts' ? 'text-[#2F7D5B]' : 'text-[#7B8A7E]'} />
            <span className="sm:hidden">ทางลัดทุกเมนู</span>
            <span className="hidden sm:inline">ศูนย์รวมทางลัดทุกเมนู (โหมดง่าย)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('analytics')}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all sm:flex-initial sm:gap-2 sm:px-4 ${
              dashboardViewMode === 'analytics'
                ? 'bg-white text-[#1D547C] shadow-xs ring-1 ring-[#CBE1F2]'
                : 'text-[#5B6A5F] hover:bg-white/60 hover:text-[#1F2A22]'
            }`}
          >
            <FileSpreadsheet size={15} className={dashboardViewMode === 'analytics' ? 'text-[#2D72A3]' : 'text-[#7B8A7E]'} />
            <span className="sm:hidden">สถิติภาพรวม</span>
            <span className="hidden sm:inline">สถิติ &amp; กราฟวิเคราะห์ห้องเรียน</span>
          </button>
        </div>
      </div>

      {dashboardViewMode === 'shortcuts' ? (
        <section aria-label="งานประจำวันของห้องนี้" className="relative mt-4 overflow-hidden rounded-3xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-5 xl:p-6">
          <BotanicalCornerWatermark className="pointer-events-none absolute -right-4 -top-4 rotate-180 opacity-40" color="#2F7D5B" opacity={0.1} />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#BFE0CD] bg-[#E6F4EC] text-[#2F7D5B]">
                <NotebookPen size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#2F7D5B]">TODAY · ห้องเรียนของเรา</p>
                <h2 className="mt-0.5 font-display text-base font-bold text-[#1F2A22] sm:text-lg">งานประจำวันของห้องนี้</h2>
                <p className="mt-0.5 text-xs font-medium text-[#5B6A5F]">เลือกการ์ดเพื่อเริ่มทำงานหรือดูสถานะล่าสุด</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-3 py-1 text-xs font-bold text-[#1C573D]">
              <CalendarCheck2 size={13} aria-hidden="true" />
              {dynamicTodayTasks.length} งานวันนี้
            </span>
          </div>
          <div className="relative z-10 mt-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {dynamicTodayTasks.slice(0, 4).map((task, index) => {
              const Icon = task.icon;
              const accentTop = ['bg-[#2F7D5B]', 'bg-[#2D72A3]', 'bg-[#6B63B5]', 'bg-[#D98B26]'][index % 4];
              const sprigHex = ['#2F7D5B', '#2D72A3', '#6B63B5', '#D98B26'][index % 4];
              const iconTone = [
                'bg-[#E6F4EC] text-[#1C573D] border border-[#BFE0CD]',
                'bg-[#E9F3FA] text-[#1D547C] border border-[#CBE1F2]',
                'bg-[#F1F0FA] text-[#49428B] border border-[#D8D4F2]',
                'bg-[#FDF4E1] text-[#8B5312] border border-[#F0D9AE]',
              ][index % 4];
              return (
                <Link
                  key={task.label}
                  to={task.path}
                  className="group relative flex min-h-[98px] items-center gap-3 overflow-hidden rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-3.5 pt-4 shadow-2xs transition duration-200 hover:-translate-y-0.5 hover:border-[#2F7D5B]/50 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7D5B]"
                >
                  <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${accentTop}`} />
                  <BotanicalCardSprig className="absolute -right-2 -top-2" color={sprigHex} opacity={0.14} />
                  <span className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl transition group-hover:scale-105 ${iconTone}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="relative z-10 min-w-0 flex-1">
                    <span className="block font-display text-sm font-bold text-[#1F2A22]">{task.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-[#5B6A5F]">{task.detail}</span>
                  </span>
                  <span className={`relative z-10 shrink-0 rounded-full border border-white/80 px-2.5 py-1 text-xs font-bold shadow-2xs ${task.tone}`}>{task.status}</span>
                  <ArrowRight aria-hidden="true" className="relative z-10 shrink-0 text-[#7B8A7E] transition group-hover:translate-x-0.5 group-hover:text-[#1F2A22]" size={15} />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {dashboardViewMode === 'shortcuts' ? (
        <div className="mt-5">
          <EasyShortcutHub
            analyticsData={analyticsData}
            classroomName={selectedClassroom ? selectedClassroom.name : session.workspace?.classroomName || 'ห้องเรียน'}
            isHomeroom={isSelectedClassroomHomeroom}
            session={session}
          />
        </div>
      ) : (
        <SystemReportsDashboard
          analyticsData={analyticsData}
          classroomName={selectedClassroom?.name || session.workspace?.classroomName || 'ห้องเรียน'}
          scheduleItems={upcomingEvents}
          selectedDate={getBangkokDate()}
          stats={stats}
          subjectAttendanceSummaries={subjectAttendanceSummaries}
          todayTasks={dynamicTodayTasks}
        />
      )}
    </main>
  );

}
