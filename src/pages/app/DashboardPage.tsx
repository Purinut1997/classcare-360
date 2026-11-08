import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Cake, Calendar, CalendarClock, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, FileSpreadsheet, HeartHandshake, List, MessageSquarePlus, Scale, School, ShieldCheck, Sparkles, UserPlus, Utensils } from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { dashboardStats } from '../../data/dashboard';
import { getBangkokDate } from '../../lib/date';
import { isDemoSession } from '../../lib/auth';
import { canManageWorkspace } from '../../lib/roles';
import { buildSchedulePeriods, getScheduleTheme, loadScheduleSettings, makeScheduleCellKey, thaiDayStyles, type ScheduleSettings } from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';
import type { WatchlistStudentItem } from '../../components/dashboard/StudentWatchlist';
import type { ClassroomAnalyticsData } from '../../components/dashboard/ClassroomAnalyticsCharts';
import { OnboardingRoadmapCard } from '../../components/dashboard/OnboardingRoadmapCard';
import { SystemReportsDashboard } from '../../components/dashboard/SystemReportsDashboard';
import { TeacherSchedulePreview } from '../../components/dashboard/TeacherSchedulePreview';
import { EasyShortcutHub } from '../../components/dashboard/EasyShortcutHub';
import { MenuUsageInsights } from '../../components/dashboard/MenuUsageInsights';
import { DashboardPostItBoard } from '../../components/dashboard/DashboardPostItBoard';
import { autoRealignAllStudentsToCorrectRooms } from '../../data/p5MasterTemplate';
import { getHiddenClassroomIds, hideClassroomIdLocally, isObsoleteGhostClassroom } from '../../lib/teacherClassrooms';
import { getThaiPublicHolidays } from '../../lib/thaiHolidays';
import { appNavItems } from '../../routes/appRoutes';

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
    icon: string;
    label: string;
    border: string;
  }
> = {
  holiday: {
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    dot: 'bg-rose-500 ring-2 ring-rose-200',
    icon: '🏖️',
    label: 'หยุดเรียน',
    border: 'border-l-rose-500',
  },
  exam: {
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    dot: 'bg-indigo-600 ring-2 ring-indigo-200',
    icon: '📝',
    label: 'วันสอบ',
    border: 'border-l-indigo-600',
  },
  activity: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dot: 'bg-emerald-500 ring-2 ring-emerald-200',
    icon: '🎪',
    label: 'กิจกรรม',
    border: 'border-l-emerald-500',
  },
  makeup: {
    badge: 'bg-amber-100 text-amber-950 border-amber-300',
    dot: 'bg-amber-500 ring-2 ring-amber-200',
    icon: '⏰',
    label: 'เรียนชดเชย',
    border: 'border-l-amber-500',
  },
  custom: {
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    dot: 'bg-sky-500 ring-2 ring-sky-200',
    icon: '📌',
    label: 'กำหนดเอง',
    border: 'border-l-sky-500',
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
      <DashboardPostItBoard
        attendanceTrendDelta={attendanceTrendDelta}
        classroomControl={
          <div className="flex flex-wrap items-center gap-2.5">
            {myAdvisoryClassroom && selectedClassroomId !== myAdvisoryClassroom.id ? (
              <button
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100/90 px-3 text-xs font-black text-amber-900 shadow-sm transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                onClick={() => setSelectedClassroomId(myAdvisoryClassroom.id)}
                title="สลับกลับไปดูข้อมูลห้องที่ปรึกษาของคุณทันที"
                type="button"
              >
                ⭐ กลับห้องที่ปรึกษา ({myAdvisoryClassroom.name})
              </button>
            ) : null}

            {classrooms.length > 0 ? (
              <label
                className={`inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border bg-white px-3 text-left shadow-sm ${
                  isSelectedClassroomHomeroom ? 'border-amber-300 text-amber-950' : 'border-slate-200 text-slate-800'
                }`}
              >
                {isSelectedClassroomHomeroom ? <span aria-hidden="true">⭐</span> : <School className="text-teal-700" size={16} aria-hidden="true" />}
                <span className="sr-only">เลือกห้องเรียน</span>
                <select
                  aria-label="เลือกห้องเรียนสำหรับหน้าแรก"
                  className="min-w-0 max-w-[13rem] cursor-pointer bg-transparent text-sm font-black text-slate-900 outline-none"
                  onChange={(event) => setSelectedClassroomId(event.target.value)}
                  value={selectedClassroomId}
                >
                  {classrooms.map((classroom) => {
                    const isHomeroom = isClassroomHomeroom(classroom);
                    return (
                      <option key={classroom.id} value={classroom.id}>
                        {isHomeroom ? '⭐ ' : '📚 '}{classroom.name} ({classroom.academic_year || '2569'})
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none text-slate-400" size={16} aria-hidden="true" />
              </label>
            ) : null}
          </div>
        }
        classroomName={selectedClassroom ? selectedClassroom.name : session.workspace?.classroomName || 'ห้องเรียน'}
        dateLabel={formatThaiRecordDate(getBangkokDate())}
        displayName={session.profile.displayName || 'คุณครู'}
        isHomeroom={isSelectedClassroomHomeroom}
        schoolName={session.workspace?.schoolName || 'โรงเรียน'}
        stats={stats}
        tasks={dynamicTodayTasks}
      />

      {/* 🔔 HOMEPAGE CALENDAR NOTIFICATION & REMINDER BANNER (Always visible in both modes!) */}
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
          return (
            <section aria-label="แจ้งเตือนกิจกรรมวันนี้" className="relative mt-5 overflow-hidden rounded-[26px] border-2 border-amber-300 bg-gradient-to-r from-amber-100/90 via-amber-50 to-orange-100/80 p-4 sm:p-5 shadow-sm">
              {/* Cute Tape */}
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-12 h-3.5 bg-white/90 border border-amber-300 rounded-xs shadow-2xs rotate-[1deg] pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30 text-xl animate-pulse">
                    🔔
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-600 text-white px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider shadow-2xs">
                        แจ้งเตือนวันนี้ 📌
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-black ${conf.badge}`}>
                        {conf.icon} {conf.label}
                      </span>
                    </div>
                    <h3 className="mt-1 text-base sm:text-lg font-black text-slate-950 truncate">
                      {todayEvents.map((e) => e.title).join(' · ')}
                    </h3>
                    <p className="mt-0.5 text-xs font-bold text-slate-600">
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

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Link
                    to="/app/dashboard?view=school-calendar"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 transition shadow-xs active:scale-95"
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
          const featuredDate = new Date(`${featuredEvent.date}T00:00:00`);
          const daysFromNow = Math.round((featuredDate.getTime() - Date.now()) / 86_400_000);
          const featuredDateLabel = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long' }).format(featuredDate);
          return (
            <section aria-label="แจ้งเตือนกำหนดการเร็วๆ นี้" className="relative mt-5 overflow-hidden rounded-[28px] border-2 border-amber-300 bg-gradient-to-r from-[#fff3c4] via-[#fff9e7] to-[#fff2dc] p-4 shadow-sm sm:p-5">
              <span aria-hidden="true" className="absolute -top-1 left-[22%] h-4 w-14 -rotate-2 border border-amber-200 bg-white/80 shadow-xs" />
              <span aria-hidden="true" className="pointer-events-none absolute -bottom-8 right-10 text-7xl opacity-[0.08]">🏫</span>
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-[22px] bg-amber-500 text-2xl text-white shadow-md shadow-amber-700/15">🔔</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-black text-white">แจ้งเตือนกำหนดการ 📌</span>
                      <span className={`rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[10px] font-black ${featuredConfig.badge}`}>{featuredConfig.icon} {featuredConfig.label}</span>
                      <span className="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-800">{daysFromNow === 1 ? 'พรุ่งนี้' : `อีก ${daysFromNow} วัน`}</span>
                    </div>
                    <h3 className="mt-1 text-base font-black text-slate-950 sm:text-xl">{featuredEvent.title}</h3>
                    <p className="mt-0.5 text-xs font-bold text-slate-600">{featuredDateLabel}{upcomingSlice.length > 1 ? ` · มีกำหนดการถัดไปอีก ${upcomingSlice.length - 1} รายการ` : ' · กิจกรรมของโรงเรียนที่กำลังจะถึง'}</p>
                  </div>
                </div>
                <Link to="/app/dashboard?view=school-calendar" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-slate-950 px-4 text-xs font-black text-white shadow-sm transition hover:bg-slate-800 sm:self-center sm:px-5 sm:text-sm">
                  เปิดปฏิทินโรงเรียน <ArrowRight size={15} />
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

      {/* 🚀 MODE SELECTOR TABS: ทางลัดทุกเมนู (โหมดง่าย) vs แดชบอร์ดสถิติ */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border-2 border-[#e6dcce] bg-[#fbf7ee] p-2 sm:p-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-[#ede4d5] rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('shortcuts')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-3.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-black transition-all whitespace-nowrap ${
              dashboardViewMode === 'shortcuts'
                ? 'bg-white text-emerald-950 shadow-sm ring-1 ring-stone-300 scale-[1.01]'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <Sparkles size={15} className={dashboardViewMode === 'shortcuts' ? 'text-emerald-600' : 'text-stone-400'} />
            <span className="sm:hidden">ทางลัดทุกเมนู</span>
            <span className="hidden sm:inline">ศูนย์รวมทางลัดทุกเมนู (โหมดง่าย)</span>
            <span className="hidden md:inline-block rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black">
              เริ่มต้น
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('analytics')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-3.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-black transition-all whitespace-nowrap ${
              dashboardViewMode === 'analytics'
                ? 'bg-white text-sky-950 shadow-sm ring-1 ring-stone-300 scale-[1.01]'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <FileSpreadsheet size={15} className={dashboardViewMode === 'analytics' ? 'text-sky-600' : 'text-stone-400'} />
            <span className="sm:hidden">สถิติภาพรวม</span>
            <span className="hidden sm:inline">สถิติ & กราฟวิเคราะห์ห้องเรียน</span>
          </button>
        </div>

        <div className="px-3 text-[11px] font-bold text-stone-500 hidden md:block">
          {dashboardViewMode === 'shortcuts' ? (
            <span>💡 เข้าถึง 20+ เมนูในคลิกเดียว จัดหมวดตามสิ่งที่ครูทำจริง</span>
          ) : (
            <span>📊 สถิติเวลาเรียน คะแนน และรายงานเชิงลึก</span>
          )}
        </div>
      </div>

      {dashboardViewMode === 'shortcuts' ? (
        <>
          <div className="mt-5">
            <OnboardingRoadmapCard
              session={session}
              classroomsCount={classrooms.length}
              studentsCount={Number(stats[0]?.value || 0)}
              hasAttendanceRecorded={analyticsData.dataCompleteness.attendanceCheckedToday || (analyticsData.attendance?.totalSessions || 0) > 0}
              hasScoresRecorded={(analyticsData.scores?.assessmentCount || 0) > 0 || (analyticsData.dataCompleteness?.scoresEnteredCount || 0) > 0}
              startCollapsed
            />
          </div>
          <MenuUsageInsights navItems={appNavItems} session={session} />
          <div className="mt-5">
            <EasyShortcutHub
              analyticsData={analyticsData}
              classroomName={selectedClassroom ? selectedClassroom.name : session.workspace?.classroomName || 'ห้องเรียน'}
              isHomeroom={isSelectedClassroomHomeroom}
              onSwitchToAnalytics={() => handleSetDashboardViewMode('analytics')}
              session={session}
            />
          </div>
        </>
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
