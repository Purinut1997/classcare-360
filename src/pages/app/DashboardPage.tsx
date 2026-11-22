import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Crown,
  FileSpreadsheet,
  HeartHandshake,
  Scale,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  Utensils,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { dashboardStats } from '../../data/dashboard';
import { getBangkokDate } from '../../lib/date';
import { getVipBadgeInfo } from '../../lib/entitlements';
import { isDemoSession } from '../../lib/auth';
import { canManageWorkspace } from '../../lib/roles';
import { loadScheduleSettings, type ScheduleSettings } from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';
import type { WatchlistStudentItem } from '../../components/dashboard/StudentWatchlist';
import type { ClassroomAnalyticsData } from '../../components/dashboard/ClassroomAnalyticsCharts';
import { AiFeatureShowcase } from '../../components/dashboard/AiFeatureShowcase';
import { SystemReportsDashboard } from '../../components/dashboard/SystemReportsDashboard';
import { EasyShortcutHub } from '../../components/dashboard/EasyShortcutHub';
import { TodayBentoDashboard } from '../../components/dashboard/TodayBentoDashboard';
import { getHiddenClassroomIds, isObsoleteGhostClassroom } from '../../lib/teacherClassrooms';
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

interface SavingsTransactionSummaryRow {
  amount: number | string | null;
  student_id: string;
  transaction_date: string | null;
  transaction_type: string;
}

interface AcademicTermRow {
  end_date: string | null;
  is_current: boolean;
  start_date: string | null;
  status: string;
  term_name: string | null;
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

const SHORT_THAI_DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'] as const;
const FULL_THAI_WEEKDAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'] as const;
const THAI_DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const;

/** Returns YYYY-MM-DD strings for Monday through Sunday of the current Bangkok week. */
function getBangkokWeekDates(todayStr: string): string[] {
  const anchor = new Date(`${todayStr}T12:00:00+07:00`);
  const jsDay = anchor.getUTCDay();
  const offsetFromMonday = jsDay === 0 ? 6 : jsDay - 1;
  const mondayMs = anchor.getTime() - offsetFromMonday * 86_400_000;
  return Array.from({ length: 7 }, (_, i) => getBangkokDate(new Date(mondayMs + i * 86_400_000)));
}

function buildEmptyWeeklyAttendance(weekDates: string[], todayStr: string) {
  return weekDates.map((date, idx) => ({
    dayLabel: SHORT_THAI_DAYS[idx] || '',
    date,
    checked: false,
    isToday: date === todayStr,
  }));
}

function buildEmptyDailyBars(weekDates: string[], todayStr: string) {
  return weekDates.slice(0, 5).map((date, idx) => ({
    day: SHORT_THAI_DAYS[idx] || '',
    fullDay: FULL_THAI_WEEKDAYS[idx] || '',
    date,
    amount: 0,
    isToday: date === todayStr,
  }));
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
    icon: ClipboardList,
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
  const todayDateStr = getBangkokDate();
  const weekDates = useMemo(() => getBangkokWeekDates(todayDateStr), [todayDateStr]);
  const currentThaiDay = useMemo(() => {
    const dayIdx = new Date(`${todayDateStr}T12:00:00+07:00`).getUTCDay();
    return THAI_DAY_NAMES[dayIdx] || 'จันทร์';
  }, [todayDateStr]);

  const [stats, setStats] = useState(() => getWorkspaceDashboardStats());
  const [pendingJoinRequestCount, setPendingJoinRequestCount] = useState(0);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [classroomStudentCounts, setClassroomStudentCounts] = useState<ClassroomStudentCount[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<ClassroomAnalyticsData>(emptyAnalyticsData);
  const [watchlistStudents, setWatchlistStudents] = useState<WatchlistStudentItem[]>([]);
  const [subjectAttendanceSummaries, setSubjectAttendanceSummaries] = useState<SubjectAttendanceSummary[]>([]);
  const [dailyHealthRecords, setDailyHealthRecords] = useState<HealthRecordSummaryRow[]>([]);
  const [latestHealthRecords, setLatestHealthRecords] = useState<HealthRecordSummaryRow[]>([]);
  const [activeClassroomStudentIds, setActiveClassroomStudentIds] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleSettings>(() =>
    loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id),
  );
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  // Today Bento state
  const [todayCheckedSessionCount, setTodayCheckedSessionCount] = useState(0);
  const [subjectAttendanceNamesToday, setSubjectAttendanceNamesToday] = useState<string[]>([]);
  const [weeklyAttendanceDays, setWeeklyAttendanceDays] = useState(() =>
    buildEmptyWeeklyAttendance(weekDates, todayDateStr),
  );
  const [dailySavings, setDailySavings] = useState(() => ({
    todayDeposit: 0,
    todayWithdraw: 0,
    todaySavers: 0,
    studentsTotal: 0,
    totalBalance: 0,
    monthlyDeposits: 0,
    dailyBars: buildEmptyDailyBars(weekDates, todayDateStr),
  }));
  const [scoresSummary, setScoresSummary] = useState({
    gradedAssessments: 0,
    totalAssessments: 0,
    averagePercent: 0,
  });
  const [teachingLogSummary, setTeachingLogSummary] = useState({
    todayCount: 0,
    weeklyDaysLogged: 0,
    weekdayFlags: [false, false, false, false, false],
  });
  const [currentTerm, setCurrentTerm] = useState<{
    termName: string | null;
    startDate: string | null;
    endDate: string | null;
  }>({ termName: null, startDate: null, endDate: null });
  const [weekCheckedDatesByClassroom, setWeekCheckedDatesByClassroom] = useState<Record<string, number>>({});

  // View Mode: 'today' (Bento default) | 'analytics' | 'shortcuts'
  const [dashboardViewMode, setDashboardViewMode] = useState<'today' | 'analytics' | 'shortcuts'>(() => {
    if (typeof window === 'undefined') return 'today';
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') || params.get('tab');
    if (modeParam === 'analytics') return 'analytics';
    if (modeParam === 'shortcuts') return 'shortcuts';
    if (modeParam === 'today') return 'today';
    try {
      const saved = localStorage.getItem('classcare_dashboard_view_mode_v2');
      if (saved === 'today' || saved === 'analytics' || saved === 'shortcuts') return saved;
    } catch {
      // Ignore storage error
    }
    return 'today';
  });

  const handleSetDashboardViewMode = (mode: 'today' | 'analytics' | 'shortcuts') => {
    setDashboardViewMode(mode);
    try {
      localStorage.setItem('classcare_dashboard_view_mode_v2', mode);
    } catch {
      // Ignore storage error
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadWeeklySchedule() {
      const fallback = loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id);
      if (!supabase || !session.workspace || demoMode) {
        if (isMounted) setWeeklySchedule(fallback);
        return;
      }

      const { data } = await supabase
        .from('workspace_schedule_settings')
        .select('settings')
        .eq('workspace_id', session.workspace.id)
        .maybeSingle();

      if (!isMounted) return;
      setWeeklySchedule(
        data?.settings && typeof data.settings === 'object'
          ? { ...fallback, ...(data.settings as ScheduleSettings) }
          : fallback,
      );
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
            if (
              cName.startsWith(workspaceClassroomName + '/') ||
              cName.replace(/\s+/g, '') === workspaceClassroomName.replace(/\s+/g, '')
            ) {
              return true;
            }
          }
          return false;
        };

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
  }, [demoMode, session.workspace, session.profile?.id]);

  // Load General Workspace Dashboard Stats
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      if (!supabase || !session.workspace || demoMode) {
        setStats(getWorkspaceDashboardStats());
        if (demoMode) {
          setClassroomStudentCounts([
            {
              classroomId: 'demo-classroom',
              classroomName: session.workspace?.classroomName || 'ห้องเรียนตัวอย่าง',
              count: 29,
            },
          ]);
        }
        return;
      }

      const [
        { data: activeStudentRows, count: studentCount },
        { count: classroomCount },
        { count: careCaseCount },
        { data: savingsRows },
      ] = await Promise.all([
        supabase
          .from('students')
          .select('id,classroom_id', { count: 'exact' })
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active'),
        supabase
          .from('classrooms')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active'),
        supabase
          .from('student_care_cases')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', session.workspace.id)
          .in('status', ['open', 'monitoring']),
        supabase
          .from('savings_accounts')
          .select('balance')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active'),
      ]);

      if (!isMounted) return;

      const savingsBalance = (savingsRows || []).reduce(
        (sum, row) => sum + Number((row as { balance?: number | string | null }).balance || 0),
        0,
      );
      const countsByClassroom = new Map<string, number>();
      ((activeStudentRows || []) as Array<{ classroom_id: string | null }>).forEach((student) => {
        const key = student.classroom_id || 'unassigned';
        countsByClassroom.set(key, (countsByClassroom.get(key) || 0) + 1);
      });

      const validClassrooms = classrooms.filter(
        (c) => !isObsoleteGhostClassroom(c, classrooms, countsByClassroom, session.workspace?.id),
      );

      const nextClassroomCounts = validClassrooms.map((classroom) => ({
        classroomId: classroom.id,
        classroomName: classroom.name,
        count: countsByClassroom.get(classroom.id) || 0,
      }));
      const unassignedCount = countsByClassroom.get('unassigned') || 0;
      if (unassignedCount > 0) {
        nextClassroomCounts.push({
          classroomId: 'unassigned',
          classroomName: 'ยังไม่ระบุห้อง',
          count: unassignedCount,
        });
      }
      setClassroomStudentCounts(nextClassroomCounts);

      const totalRoomsCount = validClassrooms.length;
      const targetClassroom = classrooms.find((c) => c.id === selectedClassroomId);
      const selectedRoomStudents = selectedClassroomId ? countsByClassroom.get(selectedClassroomId) || 0 : null;

      let studentDetail = 'รวมทุกห้องเรียน';
      let studentSubDetail: string | undefined;

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
  }, [classrooms, demoMode, session.workspace, selectedClassroomId]);

  // Load Classroom Specific Real Analytics & Today Bento Metrics
  useEffect(() => {
    let isMounted = true;

    async function loadClassroomAnalytics() {
      const today = getBangkokDate();
      const currentWeekDates = getBangkokWeekDates(today);

      if (demoMode) {
        const demoAmounts = [1450, 1120, 980, 1340, 1620];
        setAnalyticsData({
          ...emptyAnalyticsData,
          classroomName: session.workspace?.classroomName || 'ป.5/1',
          dataCompleteness: {
            attendanceCheckedToday: true,
            behaviorRecorded: true,
            homeVisitsCount: 8,
            scoresEnteredCount: 8,
            studentsCount: 29,
          },
          savings: {
            accountCount: 29,
            activeAccounts: 24,
            monthlyDeposits: 18640,
            totalBalance: 42850,
          },
          scores: {
            assessmentCount: 12,
            averagePercent: 78,
            passedStudentsCount: 27,
          },
        });
        setWatchlistStudents([]);
        setSubjectAttendanceSummaries([]);
        setActiveClassroomStudentIds([]);
        setTodayCheckedSessionCount(1);
        setSubjectAttendanceNamesToday(['โฮมรูม']);
        setWeeklyAttendanceDays(
          currentWeekDates.map((date, idx) => ({
            dayLabel: SHORT_THAI_DAYS[idx] || '',
            date,
            checked: idx < 5 && date <= today,
            isToday: date === today,
          })),
        );
        setDailySavings({
          todayDeposit: 1450,
          todayWithdraw: 0,
          todaySavers: 24,
          studentsTotal: 29,
          totalBalance: 42850,
          monthlyDeposits: 18640,
          dailyBars: currentWeekDates.slice(0, 5).map((date, idx) => ({
            day: SHORT_THAI_DAYS[idx] || '',
            fullDay: FULL_THAI_WEEKDAYS[idx] || '',
            date,
            amount: demoAmounts[idx] || 0,
            isToday: date === today,
          })),
        });
        setScoresSummary({
          gradedAssessments: 8,
          totalAssessments: 12,
          averagePercent: 78,
        });
        return;
      }

      if (!supabase || !session.workspace || !selectedClassroomId) {
        setAnalyticsData(emptyAnalyticsData);
        setWatchlistStudents([]);
        setActiveClassroomStudentIds([]);
        setTodayCheckedSessionCount(0);
        setSubjectAttendanceNamesToday([]);
        setWeeklyAttendanceDays(buildEmptyWeeklyAttendance(currentWeekDates, today));
        setDailySavings({
          todayDeposit: 0,
          todayWithdraw: 0,
          todaySavers: 0,
          studentsTotal: 0,
          totalBalance: 0,
          monthlyDeposits: 0,
          dailyBars: buildEmptyDailyBars(currentWeekDates, today),
        });
        setScoresSummary({ gradedAssessments: 0, totalAssessments: 0, averagePercent: 0 });
        return;
      }

      const targetClassroom = classrooms.find((c) => c.id === selectedClassroomId);
      const classroomName = targetClassroom ? targetClassroom.name : session.workspace.classroomName || 'ห้องเรียน';

      const trendDates = Array.from({ length: 7 }, (_, index) =>
        getBangkokDate(new Date(Date.now() - (6 - index) * 86_400_000)),
      );
      const minStartDate = currentWeekDates[0] < trendDates[0] ? currentWeekDates[0] : trendDates[0];

      const { data: attendanceSessionRows } = await supabase
        .from('attendance_sessions')
        .select('id, attendance_date, period_label, subject_name')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', selectedClassroomId)
        .gte('attendance_date', minStartDate)
        .lte('attendance_date', today)
        .order('attendance_date', { ascending: true })
        .order('period_label', { ascending: true });

      const allAttendanceSessionIds = ((attendanceSessionRows || []) as AttendanceSessionRow[]).map((item) => item.id);
      const attendanceRecordsPromise =
        allAttendanceSessionIds.length > 0
          ? supabase
              .from('attendance_records')
              .select('session_id, student_id, status')
              .eq('workspace_id', session.workspace.id)
              .in('session_id', allAttendanceSessionIds)
          : Promise.resolve({ data: [] as AttendanceRecordSummaryRow[] });

      const [
        { data: studentRows },
        { data: attendanceRows },
        { data: savingsAccountRows },
        { data: savingsTxRows },
        { data: scoreAssessments },
        { data: scoreEntries },
        { data: behaviorRows },
        { data: homeVisitRows },
        { data: careCaseRows },
      ] = await Promise.all([
        supabase
          .from('students')
          .select('id, student_code, first_name, last_name')
          .eq('workspace_id', session.workspace.id)
          .eq('classroom_id', selectedClassroomId)
          .eq('status', 'active'),
        attendanceRecordsPromise,
        supabase
          .from('savings_accounts')
          .select('id, student_id, balance')
          .eq('workspace_id', session.workspace.id),
        supabase
          .from('savings_transactions')
          .select('student_id, amount, transaction_type, transaction_date')
          .eq('workspace_id', session.workspace.id),
        supabase
          .from('score_assessments')
          .select('id, max_score')
          .eq('workspace_id', session.workspace.id),
        supabase
          .from('score_entries')
          .select('student_id, score, assessment_id')
          .eq('workspace_id', session.workspace.id),
        supabase
          .from('behavior_records')
          .select('student_id, points, tone')
          .eq('workspace_id', session.workspace.id),
        supabase
          .from('student_home_visits')
          .select('student_id, status')
          .eq('workspace_id', session.workspace.id)
          .in('status', ['submitted', 'certified']),
        supabase
          .from('student_care_cases')
          .select('id, student_id, summary, status, risk_level')
          .eq('workspace_id', session.workspace.id)
          .in('status', ['open', 'monitoring']),
      ]);

      if (!isMounted) return;

      const studentMap = new Map((studentRows || []).map((s) => [s.id, s]));
      const studentIds = new Set(studentMap.keys());
      setActiveClassroomStudentIds(Array.from(studentIds));
      const studentsCount = studentIds.size;
      const attendanceSessions = (attendanceSessionRows || []) as AttendanceSessionRow[];
      const todaySessions = attendanceSessions.filter((item) => item.attendance_date === today);
      const todayAttendanceSessionIds = new Set(todaySessions.map((item) => item.id));
      const todayAttendanceRows = (attendanceRows || []).filter((row) => todayAttendanceSessionIds.has(row.session_id));

      const recordsBySession = new Map<string, AttendanceRecordSummaryRow[]>();
      (attendanceRows || []).forEach((row) => {
        if (!row.session_id) return;
        const existing = recordsBySession.get(row.session_id) || [];
        existing.push(row as AttendanceRecordSummaryRow);
        recordsBySession.set(row.session_id, existing);
      });

      // Weekly Mon-Sun Attendance Dots
      const checkedDatesSet = new Set(attendanceSessions.map((item) => item.attendance_date));
      setWeeklyAttendanceDays(
        currentWeekDates.map((date, idx) => ({
          dayLabel: SHORT_THAI_DAYS[idx] || '',
          date,
          checked: checkedDatesSet.has(date),
          isToday: date === today,
        })),
      );
      setTodayCheckedSessionCount(todaySessions.length);
      setSubjectAttendanceNamesToday(
        todaySessions
          .flatMap((s) => [s.subject_name, s.period_label])
          .filter((v): v is string => Boolean(v && v.trim())),
      );

      // Attendance totals
      let present = 0;
      let late = 0;
      let leave = 0;
      let absent = 0;
      const attendanceCheckedToday = todayAttendanceRows.length > 0 || todaySessions.length > 0;

      todayAttendanceRows.forEach((row) => {
        if (studentIds.has(row.student_id)) {
          if (row.status === 'present' || row.status === 'activity') present++;
          else if (row.status === 'late') late++;
          else if (row.status === 'leave' || row.status === 'sick') leave++;
          else if (row.status === 'absent') absent++;
        }
      });

      // Real Savings calculations (overall + daily + Mon-Fri chart)
      const classroomSavingsAccounts = (savingsAccountRows || []).filter((acc) => studentIds.has(acc.student_id));
      const activeSavingsAccounts = classroomSavingsAccounts.filter((acc) => Number(acc.balance || 0) > 0).length;
      const totalBalance = classroomSavingsAccounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

      const typedSavingsTxs = (savingsTxRows || []) as SavingsTransactionSummaryRow[];
      const classroomDepositTxs = typedSavingsTxs.filter(
        (tx) => studentIds.has(tx.student_id) && tx.transaction_type === 'deposit',
      );
      const classroomWithdrawTxs = typedSavingsTxs.filter(
        (tx) => studentIds.has(tx.student_id) && tx.transaction_type === 'withdrawal',
      );

      const currentMonthPrefix = today.slice(0, 7);
      const monthlyDeposits = classroomDepositTxs
        .filter((tx) => !tx.transaction_date || String(tx.transaction_date).startsWith(currentMonthPrefix))
        .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

      const todayDepositTxs = classroomDepositTxs.filter(
        (tx) => String(tx.transaction_date || '').slice(0, 10) === today,
      );
      const todayDeposit = todayDepositTxs.reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
      const todayWithdraw = classroomWithdrawTxs
        .filter((tx) => String(tx.transaction_date || '').slice(0, 10) === today)
        .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);
      const todaySavers = new Set(todayDepositTxs.map((tx) => tx.student_id)).size;

      const dailyBars = currentWeekDates.slice(0, 5).map((dateStr, idx) => ({
        day: SHORT_THAI_DAYS[idx] || '',
        fullDay: FULL_THAI_WEEKDAYS[idx] || '',
        date: dateStr,
        amount: classroomDepositTxs
          .filter((tx) => String(tx.transaction_date || '').slice(0, 10) === dateStr)
          .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0),
        isToday: dateStr === today,
      }));

      setDailySavings({
        todayDeposit,
        todayWithdraw,
        todaySavers,
        studentsTotal: studentsCount,
        totalBalance,
        monthlyDeposits,
        dailyBars,
      });

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
      const gradedAssessmentIds = new Set<string>();

      classroomScoreRecords.forEach((sr) => {
        if (sr.assessment_id) gradedAssessmentIds.add(sr.assessment_id);
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

      const averagePercent =
        classroomScoreRecords.length > 0 ? Math.round(totalScorePct / classroomScoreRecords.length) : 0;

      setScoresSummary({
        gradedAssessments: gradedAssessmentIds.size,
        totalAssessments: (scoreAssessments || []).length,
        averagePercent,
      });

      const attendanceTrend = trendDates.map((date) => {
        const sessionIds = new Set(
          attendanceSessions.filter((item) => item.attendance_date === date).map((item) => item.id),
        );
        const records = (attendanceRows || []).filter(
          (row) => sessionIds.has(row.session_id) && studentIds.has(row.student_id),
        );
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

      const subjectSummaries = todaySessions
        .filter((item) => Boolean(item.subject_name))
        .map((item) => {
          const records = recordsBySession.get(item.id) || [];
          const pCount = records.filter((record) => record.status === 'present' || record.status === 'activity').length;
          const aCount = records.filter((record) => record.status === 'absent').length;
          const lCount = records.filter((record) => record.status === 'late').length;
          return {
            absent: aCount,
            id: item.id,
            late: lCount,
            periodLabel: item.period_label,
            present: pCount,
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

  // Safe optional queries: daily_brief_logs, academic_terms, and workspace weekly classroom attendance
  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaceBentoContext() {
      const today = getBangkokDate();
      const currentWeekDates = getBangkokWeekDates(today);

      if (demoMode) {
        const startDemo = getBangkokDate(new Date(Date.now() - 24 * 86_400_000));
        const endDemo = getBangkokDate(new Date(Date.now() + 116 * 86_400_000));
        setTeachingLogSummary({
          todayCount: 1,
          weeklyDaysLogged: 3,
          weekdayFlags: [true, true, true, false, false],
        });
        setCurrentTerm({
          termName: '2',
          startDate: startDemo,
          endDate: endDemo,
        });
        setWeekCheckedDatesByClassroom({ 'demo-classroom': 4 });
        return;
      }

      if (!supabase || !session.workspace) {
        return;
      }

      const workspaceId = session.workspace.id;

      try {
        const [briefRes, termRes, weekSessionsRes] = await Promise.all([
          supabase
            .from('daily_brief_logs')
            .select('log_date')
            .eq('workspace_id', workspaceId)
            .gte('log_date', currentWeekDates[0])
            .lte('log_date', currentWeekDates[4]),
          supabase
            .from('academic_terms')
            .select('term_name, start_date, end_date, is_current, status')
            .eq('workspace_id', workspaceId)
            .order('is_current', { ascending: false })
            .limit(5),
          supabase
            .from('attendance_sessions')
            .select('classroom_id, attendance_date')
            .eq('workspace_id', workspaceId)
            .gte('attendance_date', currentWeekDates[0])
            .lte('attendance_date', today),
        ]);

        if (!isMounted) return;

        if (!briefRes.error && Array.isArray(briefRes.data)) {
          const logDates = briefRes.data.map((r) => String(r.log_date || '').slice(0, 10));
          const todayCount = logDates.filter((d) => d === today).length;
          const loggedSet = new Set(logDates);
          const weekdayFlags = currentWeekDates.slice(0, 5).map((d) => loggedSet.has(d));
          setTeachingLogSummary({
            todayCount,
            weeklyDaysLogged: weekdayFlags.filter(Boolean).length,
            weekdayFlags,
          });
        }

        if (!termRes.error && Array.isArray(termRes.data) && termRes.data.length > 0) {
          const terms = termRes.data as AcademicTermRow[];
          const picked =
            terms.find((t) => t.is_current) ||
            terms.find((t) => t.status === 'open') ||
            terms[0];
          setCurrentTerm({
            termName: picked?.term_name ?? null,
            startDate: picked?.start_date ?? null,
            endDate: picked?.end_date ?? null,
          });
        } else {
          setCurrentTerm({ termName: null, startDate: null, endDate: null });
        }

        if (!weekSessionsRes.error && Array.isArray(weekSessionsRes.data)) {
          const dateSetsByRoom = new Map<string, Set<string>>();
          weekSessionsRes.data.forEach((row) => {
            const cId = String(row.classroom_id || '');
            const dStr = String(row.attendance_date || '').slice(0, 10);
            if (!cId || !dStr) return;
            const existing = dateSetsByRoom.get(cId) || new Set<string>();
            existing.add(dStr);
            dateSetsByRoom.set(cId, existing);
          });
          const countMap: Record<string, number> = {};
          dateSetsByRoom.forEach((set, id) => {
            countMap[id] = set.size;
          });
          setWeekCheckedDatesByClassroom(countMap);
        }
      } catch {
        // Optional Bento metadata should never interrupt primary dashboard usage
      }
    }

    void loadWorkspaceBentoContext();
    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace]);

  // Load daily routines and the latest periodic health snapshots for the selected classroom.
  useEffect(() => {
    let isMounted = true;

    async function loadHealthReportSummary() {
      if (!supabase || !session.workspace || !selectedClassroomId || demoMode) {
        setDailyHealthRecords([]);
        setLatestHealthRecords([]);
        return;
      }

      const today = getBangkokDate();
      const fields = 'student_id,record_type,status,record_date,weight_kg,height_cm,bmi,inspection_results';
      const [{ data: dailyRows }, { data: snapshotRows }] = await Promise.all([
        supabase
          .from('student_health_records')
          .select(fields)
          .eq('workspace_id', session.workspace.id)
          .eq('classroom_id', selectedClassroomId)
          .eq('record_date', today)
          .in('record_type', ['toothbrushing', 'milk', 'lunch']),
        supabase
          .from('student_health_records')
          .select(fields)
          .eq('workspace_id', session.workspace.id)
          .eq('classroom_id', selectedClassroomId)
          .in('record_type', ['growth', 'hygiene'])
          .order('record_date', { ascending: false })
          .limit(1000),
      ]);

      if (!isMounted) return;
      setDailyHealthRecords((dailyRows || []) as HealthRecordSummaryRow[]);
      setLatestHealthRecords((snapshotRows || []) as HealthRecordSummaryRow[]);
    }

    void loadHealthReportSummary();
    return () => {
      isMounted = false;
    };
  }, [demoMode, selectedClassroomId, session.workspace]);

  // Load Upcoming School Calendar Events (DB + Local Storage + Thai Holidays Preset)
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

      try {
        const storageKey = `classcare:data-safety:${session.workspace?.id || session.profile?.id}`;
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            calendarRules?: Array<{ id: string; date: string; title: string; type: string }>;
          };
          (parsed.calendarRules || []).forEach((item) => {
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

      collected.sort((a, b) => a.date.localeCompare(b.date));
      const groupedEvents = groupUpcomingEvents(collected);

      if (isMounted) {
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
      const records =
        config.cadence === 'วันนี้'
          ? dailyHealthRecords.filter(
              (record) => activeStudentIds.has(record.student_id) && record.record_type === config.key,
            )
          : Array.from(latestByStudentAndType.values()).filter((record) => record.record_type === config.key);
      const uniqueRecords = Array.from(new Map(records.map((record) => [record.student_id, record])).values());
      const recorded = uniqueRecords.length;
      const completed =
        config.key === 'growth'
          ? uniqueRecords.filter(
              (record) => record.weight_kg !== null && record.height_cm !== null && record.bmi !== null,
            ).length
          : uniqueRecords.filter((record) => ['completed', 'normal'].includes(record.status)).length;
      const attention = uniqueRecords.filter((record) => ['missed', 'attention'].includes(record.status)).length;
      const latestDate = uniqueRecords.reduce<string | undefined>(
        (latest, record) => (!latest || record.record_date > latest ? record.record_date : latest),
        undefined,
      );
      return {
        ...config,
        attention,
        completed,
        detail:
          config.cadence === 'วันนี้'
            ? `ประจำวันที่ ${formatThaiRecordDate(getBangkokDate())}`
            : `ล่าสุด ${formatThaiRecordDate(latestDate)}`,
        percent: total > 0 ? Math.min(100, Math.round((recorded / total) * 100)) : 0,
        recorded,
        total,
      };
    });
  }, [
    activeClassroomStudentIds,
    analyticsData.dataCompleteness.studentsCount,
    dailyHealthRecords,
    latestHealthRecords,
  ]);

  const completedDailyRoutineCount = healthReportMetrics.filter(
    (metric) => metric.cadence === 'วันนี้' && metric.total > 0 && metric.recorded >= metric.total,
  ).length;
  const healthReportPath = (mode: HealthReportType) =>
    `/app/dashboard?view=student-health&healthMode=${mode}${selectedClassroomId ? `&classroomId=${selectedClassroomId}` : ''}`;

  const dynamicTodayTasks = [
    {
      detail: 'บันทึกสถานะนักเรียนก่อนเริ่มงานช่วงเช้า',
      icon: CalendarClock,
      label: 'เช็กเวลาเรียนประจำวัน',
      path: '/app/dashboard?view=teacher-work',
      status: analyticsData.dataCompleteness.attendanceCheckedToday ? 'เช็กแล้ว' : 'ทำตอนนี้',
      tone: analyticsData.dataCompleteness.attendanceCheckedToday
        ? 'text-emerald-700 bg-emerald-50'
        : 'text-rose-700 bg-rose-50',
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

  // Derived Today Bento props
  const todayHolidayTitle = useMemo(() => {
    const todayEv = upcomingEvents.find((ev) => {
      if (ev.endDate && ev.endDate !== ev.date) {
        return todayDateStr >= ev.date && todayDateStr <= ev.endDate;
      }
      return ev.date === todayDateStr;
    });
    return todayEv?.type === 'holiday' ? todayEv.title : null;
  }, [todayDateStr, upcomingEvents]);

  const nextUpcomingEvent = useMemo(() => {
    const nextEv = upcomingEvents.find((ev) => (ev.endDate || ev.date) > todayDateStr);
    if (!nextEv) return null;
    const targetMs = new Date(`${nextEv.date}T12:00:00+07:00`).getTime();
    const todayMs = new Date(`${todayDateStr}T12:00:00+07:00`).getTime();
    const daysFromNow = Math.max(1, Math.round((targetMs - todayMs) / 86_400_000));
    return {
      date: nextEv.date,
      daysFromNow,
      title: nextEv.title,
      type: nextEv.type,
    };
  }, [todayDateStr, upcomingEvents]);

  const readinessPercent = useMemo(() => {
    let score = 0;
    if (analyticsData.dataCompleteness.studentsCount > 0) score += 25;
    if (
      analyticsData.dataCompleteness.attendanceCheckedToday ||
      weeklyAttendanceDays.some((dayItem) => dayItem.checked)
    ) {
      score += 25;
    }
    if (scoresSummary.gradedAssessments > 0) score += 25;
    if (analyticsData.behavior.totalRecords > 0 || analyticsData.dataCompleteness.homeVisitsCount > 0) {
      score += 25;
    }
    return score;
  }, [
    analyticsData.behavior.totalRecords,
    analyticsData.dataCompleteness.attendanceCheckedToday,
    analyticsData.dataCompleteness.homeVisitsCount,
    analyticsData.dataCompleteness.studentsCount,
    scoresSummary.gradedAssessments,
    weeklyAttendanceDays,
  ]);

  const classroomProgressItems = useMemo(() => {
    const todayIdx = weekDates.indexOf(todayDateStr);
    const elapsedSchoolDays = Math.max(1, Math.min(5, todayIdx >= 0 ? todayIdx + 1 : 5));
    const countLookup = new Map(classroomStudentCounts.map((c) => [c.classroomId, c.count]));

    return classrooms.slice(0, 3).map((room) => {
      const checkedDays = weekCheckedDatesByClassroom[room.id] ?? 0;
      const effectiveChecked =
        room.id === selectedClassroomId && analyticsData.dataCompleteness.attendanceCheckedToday
          ? Math.max(1, checkedDays)
          : checkedDays;
      const percent = demoMode
        ? 86
        : Math.min(100, Math.round((effectiveChecked / elapsedSchoolDays) * 100));
      return {
        id: room.id,
        name: room.name,
        studentCount: countLookup.get(room.id) ?? 0,
        percent,
      };
    });
  }, [
    analyticsData.dataCompleteness.attendanceCheckedToday,
    classroomStudentCounts,
    classrooms,
    demoMode,
    selectedClassroomId,
    todayDateStr,
    weekCheckedDatesByClassroom,
    weekDates,
  ]);

  const catchUpItems = useMemo(() => {
    const isWeekend = currentThaiDay === 'เสาร์' || currentThaiDay === 'อาทิตย์';
    const isRest = isWeekend || Boolean(todayHolidayTitle);
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      badge: string;
      tone: string;
      path: string;
    }> = [];

    if (!isRest && !analyticsData.dataCompleteness.attendanceCheckedToday) {
      items.push({
        id: 'attendance-today',
        title: 'เช็กเวลาเรียนวันนี้',
        subtitle: 'บันทึกสถานะนักเรียนช่วงเช้า / คาบสอน',
        badge: 'ตอนนี้',
        tone: 'bg-[#fff2e6] text-[#b45309]',
        path: '/app/dashboard?view=teacher-work',
      });
    }

    if (!isRest && completedDailyRoutineCount < 3 && analyticsData.dataCompleteness.studentsCount > 0) {
      items.push({
        id: 'health-routine',
        title: 'กิจวัตรสุขภาพวันนี้',
        subtitle: 'แปรงฟัน / ดื่มนม / อาหารกลางวัน',
        badge: `${completedDailyRoutineCount}/3`,
        tone: 'bg-[#eef6ff] text-[#1d547c]',
        path: healthReportPath('toothbrushing'),
      });
    }

    if (watchlistStudents.length > 0) {
      items.push({
        id: 'care-watchlist',
        title: 'ติดตามเคสดูแลนักเรียน',
        subtitle: 'ทบทวนนักเรียนที่มีสถานะเฝ้าระวัง',
        badge: `${watchlistStudents.length} คน`,
        tone: 'bg-[#fdf0f3] text-[#a3334c]',
        path: '/app/dashboard?view=students&studentView=care',
      });
    }

    if (canManageCurrentWorkspace && pendingJoinRequestCount > 0) {
      items.push({
        id: 'join-requests',
        title: 'คำขอเข้าร่วมโรงเรียน',
        subtitle: 'ตรวจสอบและอนุมัติสมาชิกใหม่',
        badge: `${pendingJoinRequestCount} คน`,
        tone: 'bg-[#f3efff] text-[#6d54c8]',
        path: '/app/dashboard?view=workspace-settings',
      });
    }

    return items;
  }, [
    analyticsData.dataCompleteness.attendanceCheckedToday,
    analyticsData.dataCompleteness.studentsCount,
    canManageCurrentWorkspace,
    completedDailyRoutineCount,
    currentThaiDay,
    pendingJoinRequestCount,
    selectedClassroomId,
    todayHolidayTitle,
    watchlistStudents.length,
  ]);

  const activeClassroomName = selectedClassroom
    ? selectedClassroom.name
    : session.workspace?.classroomName || 'ห้องเรียน';

  return (
    <main className="app-page dashboard-premium">
      {/* Compact Dashboard Header Strip */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="inline-flex w-full items-center rounded-full bg-[#edf0ea] p-1 sm:w-auto">
          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('today')}
            className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:flex-initial ${
              dashboardViewMode === 'today'
                ? 'bg-white text-[#1c573d] shadow-2xs'
                : 'text-[#5b6a5f] hover:text-[#1f2924]'
            }`}
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('analytics')}
            className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:flex-initial ${
              dashboardViewMode === 'analytics'
                ? 'bg-white text-[#1d547c] shadow-2xs'
                : 'text-[#5b6a5f] hover:text-[#1f2924]'
            }`}
          >
            สถิติห้อง
          </button>
          <button
            type="button"
            onClick={() => handleSetDashboardViewMode('shortcuts')}
            className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition sm:flex-initial ${
              dashboardViewMode === 'shortcuts'
                ? 'bg-white text-[#1c573d] shadow-2xs'
                : 'text-[#5b6a5f] hover:text-[#1f2924]'
            }`}
          >
            เมนูทั้งหมด
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {myAdvisoryClassroom && selectedClassroomId !== myAdvisoryClassroom.id ? (
            <button
              type="button"
              onClick={() => setSelectedClassroomId(myAdvisoryClassroom.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#f0d9ae] bg-[#fdf4e1] px-3 py-1.5 text-xs font-bold text-[#8b5312] transition hover:bg-[#f9e7c4]"
              title="สลับกลับไปดูข้อมูลห้องที่ปรึกษาของคุณทันที"
            >
              <Star size={12} className="fill-[#d98b26] text-[#d98b26]" aria-hidden="true" />
              <span>กลับไป {myAdvisoryClassroom.name}</span>
            </button>
          ) : null}

          {classrooms.length > 0 ? (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 shadow-2xs ${
                isSelectedClassroomHomeroom
                  ? 'border-[#bfe0cd] text-[#1c573d]'
                  : 'border-[#e3e7e0] text-[#1f2924]'
              }`}
            >
              {isSelectedClassroomHomeroom ? (
                <Star size={13} className="shrink-0 fill-[#d98b26] text-[#d98b26]" aria-hidden="true" />
              ) : (
                <School size={13} className="shrink-0 text-[#2f7d5b]" aria-hidden="true" />
              )}
              <select
                aria-label="เลือกห้องเรียน"
                className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-bold text-[#1f2924] focus:outline-none"
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
              >
                {classrooms.map((c) => {
                  const isHome = isClassroomHomeroom(c);
                  return (
                    <option key={c.id} value={c.id}>
                      {isHome ? '★ ' : ''}
                      {c.name} ({c.academic_year || '2569'})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="pointer-events-none -ml-4 text-[#7b8a7e]" size={14} aria-hidden="true" />
            </div>
          ) : null}

          {(() => {
            const vipBadge = getVipBadgeInfo(session.subscription, session.profile.role);
            if (!vipBadge.isVip && vipBadge.tier !== 'trial') return null;
            return (
              <Link
                to="/app/package"
                title={vipBadge.tooltip}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition hover:brightness-[0.98] ${
                  vipBadge.isVip
                    ? vipBadge.isExpiringSoon
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-amber-300/90 bg-gradient-to-r from-[#fff8e1] to-[#fef3c7] text-[#78490a]'
                    : 'border-sky-200 bg-sky-50 text-sky-800'
                }`}
              >
                <Crown
                  size={12}
                  className={vipBadge.isVip ? 'fill-amber-400/40 text-amber-600' : 'text-sky-600'}
                  aria-hidden="true"
                />
                <span>{vipBadge.badgeText}</span>
              </Link>
            );
          })()}
        </div>
      </div>

      {dashboardViewMode === 'today' ? (
        <TodayBentoDashboard
          catchUpItems={catchUpItems}
          classroomName={activeClassroomName}
          classroomProgressItems={classroomProgressItems}
          currentThaiDay={currentThaiDay}
          dailySavings={dailySavings}
          isHomeroom={isSelectedClassroomHomeroom}
          nextUpcomingEvent={nextUpcomingEvent}
          onSelectClassroom={setSelectedClassroomId}
          scoresSummary={scoresSummary}
          selectedClassroomId={selectedClassroomId}
          session={session}
          subjectAttendanceNamesToday={subjectAttendanceNamesToday}
          teachingLogSummary={teachingLogSummary}
          termSummary={{
            termName: currentTerm.termName,
            startDate: currentTerm.startDate,
            endDate: currentTerm.endDate,
            readinessPercent,
          }}
          todayCheckedSessionCount={todayCheckedSessionCount}
          todayDateStr={todayDateStr}
          todayHolidayTitle={todayHolidayTitle}
          weeklyAttendanceDays={weeklyAttendanceDays}
          weeklySchedule={weeklySchedule}
        />
      ) : dashboardViewMode === 'analytics' ? (
        <SystemReportsDashboard
          analyticsData={analyticsData}
          classroomName={activeClassroomName}
          scheduleItems={upcomingEvents}
          selectedDate={todayDateStr}
          stats={stats}
          subjectAttendanceSummaries={subjectAttendanceSummaries}
          todayTasks={dynamicTodayTasks}
        />
      ) : (
        <div className="space-y-6">
          <EasyShortcutHub
            analyticsData={analyticsData}
            classroomName={activeClassroomName}
            isHomeroom={isSelectedClassroomHomeroom}
            session={session}
          />
          <AiFeatureShowcase session={session} />
        </div>
      )}
    </main>
  );
}
