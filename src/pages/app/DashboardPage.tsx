import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, ChevronDown, ClipboardCheck, ClipboardList, FileSpreadsheet, HeartHandshake, MessageSquarePlus, Scale, School, ShieldCheck, Sparkles, UserPlus, Utensils } from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';
import { dashboardStats } from '../../data/dashboard';
import { getBangkokDate } from '../../lib/date';
import { isDemoSession } from '../../lib/auth';
import { canManageWorkspace } from '../../lib/roles';
import { buildSchedulePeriods, loadScheduleSettings, makeScheduleCellKey, type ScheduleSettings } from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';
import { StatsGrid } from '../../components/dashboard/StatsGrid';
import { StudentWatchlist, type WatchlistStudentItem } from '../../components/dashboard/StudentWatchlist';
import { ClassroomAnalyticsCharts, type ClassroomAnalyticsData } from '../../components/dashboard/ClassroomAnalyticsCharts';

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
  id: string;
  name: string;
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

function getWorkspaceDashboardStats(classroomName?: string) {
  return dashboardStats.map((stat, index) =>
    index === 0 && classroomName
      ? { ...stat, detail: classroomName }
      : stat,
  );
}

export function DashboardPage({ session }: DashboardPageProps) {
  const canManageCurrentWorkspace = canManageWorkspace(session.profile.role);
  const demoMode = isDemoSession(session);
  const [stats, setStats] = useState(() => getWorkspaceDashboardStats(session.workspace?.classroomName));
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
  const [healthReportsLoading, setHealthReportsLoading] = useState(false);
  const [quickLog, setQuickLog] = useState('');
  const [quickLogNotice, setQuickLogNotice] = useState<string | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<ScheduleSettings>(() => loadScheduleSettings(session.workspace?.classroomName, session.workspace?.id));

  const weeklyPeriods = useMemo(() => buildSchedulePeriods(weeklySchedule), [weeklySchedule]);

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

  // Load Classrooms
  useEffect(() => {
    let isMounted = true;
    async function loadClassrooms() {
      if (!session.workspace) return;
      if (!supabase || demoMode) {
        const demoClassroom = { academic_year: session.workspace.academicYear, id: 'demo-classroom', name: session.workspace.classroomName };
        setClassrooms([demoClassroom]);
        setSelectedClassroomId(demoClassroom.id);
        return;
      }
      const { data } = await supabase.from('classrooms').select('id, name, academic_year').eq('workspace_id', session.workspace.id).order('name', { ascending: true });

      if (!isMounted) return;
      if (data && data.length > 0) {
        setClassrooms(data);
        setSelectedClassroomId((prev) => prev || data[0].id);
      }
    }
    void loadClassrooms();
    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace]);

  // Load General Workspace Dashboard Stats
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      if (!supabase || !session.workspace || demoMode) {
        setStats(getWorkspaceDashboardStats(session.workspace?.classroomName));
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
      const nextClassroomCounts = classrooms.map((classroom) => ({
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

      setStats([
        {
          ...dashboardStats[0],
          detail: session.workspace.classroomName,
          value: String(studentCount ?? 0),
        },
        {
          ...dashboardStats[1],
          detail: 'ห้องที่กำลังใช้งาน',
          label: 'ห้องเรียน',
          value: String(classroomCount ?? 0),
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
  }, [classrooms, demoMode, session.workspace]);

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
      path: '/app/dashboard?view=scores&scoreView=entry',
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
      <div className="app-page-header dashboard-hero flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800 ring-1 ring-cyan-200">
              <School size={14} /> ภาพรวมการทำงานจริง
            </span>
          </div>
          <h1 className="app-page-title mt-1">ภาพรวมวันนี้</h1>
          <p className="app-page-description">
            {session.workspace?.schoolName || 'โรงเรียน'} · {selectedClassroom ? selectedClassroom.name : session.workspace?.classroomName || 'ยังไม่ได้เลือกห้อง'} · สรุปสถานะข้อมูลและงานสำคัญจริงในระบบ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Classroom Selector Dropdown */}
          {classrooms.length > 0 ? (
            <div className="relative inline-block text-left">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 px-3.5 shadow-sm">
                <School className="text-teal-700" size={17} aria-hidden="true" />
                <span className="text-xs font-black text-slate-500">เลือกห้อง:</span>
                <select className="bg-transparent text-sm font-black text-slate-900 focus:outline-none cursor-pointer pr-4" value={selectedClassroomId} onChange={(e) => setSelectedClassroomId(e.target.value)}>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.academic_year || '2569'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-slate-400 pointer-events-none -ml-4" size={16} />
              </div>
            </div>
          ) : null}

          <Link className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition hover:-translate-y-0.5 shadow-sm" to="/app/dashboard?view=teacher-work">
            <CalendarClock size={18} aria-hidden="true" />
            เช็กเวลาเรียน
          </Link>
        </div>
      </div>

      <form className="mt-4 flex flex-col gap-2 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-3 sm:flex-row sm:items-center" onSubmit={submitQuickLog}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-cyan-700 shadow-sm">
          <MessageSquarePlus size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="dashboard-quick-log">
            Quick Log
          </label>
          <input className="h-10 w-full bg-transparent px-2 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-500" id="dashboard-quick-log" onChange={(event) => setQuickLog(event.target.value)} placeholder="บันทึกสั้น ๆ เช่น นักเรียน 2 คนลาป่วย" value={quickLog} />
          {quickLogNotice ? <p className="px-2 text-[10px] font-black text-cyan-800">{quickLogNotice}</p> : null}
        </div>
        <button className="daily-primary-action justify-center" disabled={!quickLog.trim()}>
          เพิ่ม Quick Log
        </button>
        <Link className="daily-secondary-action justify-center" to={`/app/dashboard?view=daily-brief&date=${getBangkokDate()}`}>
          เปิดสรุปวันนี้
        </Link>
      </form>

      {/* Friendly Hero Greeting & Quick Actions Hub */}
      <section className="mt-5 rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">☀️</span>
              <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                สวัสดีตอนเช้า, {session.profile.displayName || 'คุณครู'}
              </h2>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {formatThaiRecordDate(getBangkokDate())} · {selectedClassroom?.name || session.workspace?.classroomName || 'ห้องเรียน'} · กดทำงานด่วนได้ทันทีในคลิกเดียว
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> พร้อมใช้งาน
            </span>
          </div>
        </div>

        {/* 4 Large Friendly Quick Action Cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Attendance */}
          <Link
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10"
            to="/app/dashboard?view=teacher-work"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm transition group-hover:scale-105">
                  <CalendarClock size={22} aria-hidden="true" />
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                    analyticsData.dataCompleteness.attendanceCheckedToday
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800 animate-bounce'
                  }`}
                >
                  {analyticsData.dataCompleteness.attendanceCheckedToday ? '✓ เช็กแล้ว' : 'รอเช็กเช้า'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-900">เช็กเวลาเรียน</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                {analyticsData.dataCompleteness.attendanceCheckedToday
                  ? `มาเรียน ${analyticsData.attendance.present} จาก ${analyticsData.dataCompleteness.studentsCount} คน`
                  : 'บันทึก มา สาย ลา ขาด ประจำวัน'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-emerald-100/80 pt-3 text-xs font-black text-emerald-700 group-hover:text-emerald-800">
              <span>{analyticsData.dataCompleteness.attendanceCheckedToday ? 'ดูรายงานวันนี้' : 'กดเช็กชื่อทันที'}</span>
              <ArrowRight size={15} className="transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 2: Scores */}
          <Link
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-cyan-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-500/10"
            to="/app/dashboard?view=scores&scoreView=entry"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-600 text-white shadow-sm transition group-hover:scale-105">
                  <ClipboardList size={22} aria-hidden="true" />
                </span>
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-black text-sky-800">
                  {analyticsData.scores.assessmentCount} ชุดคะแนน
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-900">บันทึกคะแนน</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                คะแนนเฉลี่ยห้อง {analyticsData.scores.averagePercent}% ({analyticsData.scores.passedStudentsCount} คนผ่านเกณฑ์)
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-sky-100/80 pt-3 text-xs font-black text-sky-700 group-hover:text-sky-800">
              <span>เปิดสมุดคะแนน</span>
              <ArrowRight size={15} className="transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 3: Savings */}
          <Link
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-orange-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10"
            to="/app/dashboard?view=savings"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500 text-white shadow-sm transition group-hover:scale-105">
                  <span className="text-lg font-black">฿</span>
                </span>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
                  {analyticsData.savings.activeAccounts} บัญชี
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-900">ระบบเงินออม</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                ยอดสะสม ฿{analyticsData.savings.totalBalance.toLocaleString()} (ฝากเดือนนี้ ฿{analyticsData.savings.monthlyDeposits.toLocaleString()})
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-amber-100/80 pt-3 text-xs font-black text-amber-700 group-hover:text-amber-800">
              <span>บันทึกฝาก-ถอน</span>
              <ArrowRight size={15} className="transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 4: Behavior / Merits */}
          <Link
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/90 to-fuchsia-50/50 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/10"
            to="/app/dashboard?view=behavior"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-600 text-white shadow-sm transition group-hover:scale-105">
                  <HeartHandshake size={22} aria-hidden="true" />
                </span>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-black text-purple-800">
                  +{analyticsData.behavior.positivePoints} ดาวความดี
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-900">บันทึกความดี</h3>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                บันทึกพฤติกรรมเชิงบวกและเคสช่วยเหลือ
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-purple-100/80 pt-3 text-xs font-black text-purple-700 group-hover:text-purple-800">
              <span>+ ให้ดาวนักเรียน</span>
              <ArrowRight size={15} className="transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </section>

      {/* Main Workspace Metrics */}
      <StatsGrid stats={stats} />

      {/* Classroom Dataset Status & Analytics Charts Section */}
      <ClassroomAnalyticsCharts classroomDistribution={classroomStudentCounts} data={analyticsData} onSelectClassroom={setSelectedClassroomId} selectedClassroomId={selectedClassroomId} />

      {pendingJoinRequestCount > 0 ? (
        <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-sky-700">
            <UserPlus size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-950">มีคำขอเข้าร่วม Workspace {pendingJoinRequestCount} รายการ</p>
            <p className="mt-0.5 text-xs font-bold text-slate-600">ตรวจชื่อ อีเมล และสิทธิ์ก่อนอนุมัติ</p>
          </div>
          <Link className="text-sm font-black text-sky-800" to="/app/dashboard?view=workspace-settings">
            ตรวจคำขอ <ArrowRight className="inline" size={15} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-cyan-50/80 via-white to-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
              <ClipboardCheck size={16} aria-hidden="true" /> Health reporting
            </div>
            <h2 className="mt-1 text-xl font-black text-slate-950">รายงานสุขภาพและกิจวัตรนักเรียน</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">เห็นรายการที่บันทึกครบและรายการที่ต้องติดตามของ {selectedClassroom?.name || 'ห้องที่เลือก'} ในจุดเดียว</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-400">ความพร้อมรายงาน</p>
              <p className="text-lg font-black text-slate-950">
                {completedHealthReportCount}
                <span className="text-sm text-slate-400">/5 หมวด</span>
              </p>
            </div>
            <Link className="inline-flex items-center gap-1 text-sm font-black text-cyan-800 hover:underline" to={healthReportPath('toothbrushing')}>
              เปิดแบบบันทึก <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-5">
          {healthReportMetrics.map((metric) => {
            const Icon = metric.icon;
            const isComplete = metric.total > 0 && metric.recorded >= metric.total;
            return (
              <Link aria-label={`เปิดแบบบันทึก${metric.label}`} className="group bg-white p-5 transition hover:bg-slate-50" key={metric.key} to={healthReportPath(metric.key)}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-2xl ring-1 ${metric.tone}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${isComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{healthReportsLoading ? <NexusAuroraInline label="กำลังโหลด" /> : isComplete ? 'ครบแล้ว' : metric.cadence}</span>
                </div>
                <h3 className="mt-4 min-h-10 text-sm font-black leading-5 text-slate-950">{metric.label}</h3>
                <p className="mt-1 text-[11px] font-bold text-slate-500">{metric.detail}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <span className="text-2xl font-black text-slate-950">{metric.recorded}</span>
                    <span className="text-xs font-black text-slate-400">/{metric.total} คน</span>
                  </div>
                  <span className="text-sm font-black text-cyan-700">{metric.percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-cyan-500'}`} style={{ width: `${metric.percent}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-black">
                  <span className="text-emerald-700">เรียบร้อย {metric.completed}</span>
                  <span className={metric.attention > 0 ? 'text-rose-700' : 'text-slate-400'}>ติดตาม {metric.attention}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <article className="app-panel-pad rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-cyan-700">TODAY</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">งานที่ต้องทำวันนี้</h2>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{dynamicTodayTasks.length} รายการ</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {dynamicTodayTasks.map((task, index) => {
              const Icon = task.icon;
              return (
                <Link className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={task.label} to={task.path}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-amber-50 group-hover:text-amber-700">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-slate-900">{task.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{task.detail}</span>
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${task.tone}`}>{task.status}</span>
                  <ArrowRight className="text-slate-300 group-hover:text-slate-700" size={17} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </article>

        {/* Real Student Watchlist from DB */}
        <StudentWatchlist students={watchlistStudents} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="app-panel-pad rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-cyan-700" size={19} aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">การเข้าเรียนรายวิชาวันนี้</h2>
            </div>
            <Link className="text-xs font-black text-sky-800 hover:underline" to="/app/dashboard?view=reports&reportView=subject-attendance">
              ดูทั้งหมด <ArrowRight className="inline" size={14} />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            {subjectAttendanceSummaries.length > 0 ? (
              <table className="min-w-[520px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr className="font-black">
                    <th className="px-3 py-2.5">รายวิชา</th>
                    <th className="px-3 py-2.5">คาบ</th>
                    <th className="px-3 py-2.5 text-center">มา</th>
                    <th className="px-3 py-2.5 text-center">ขาด</th>
                    <th className="px-3 py-2.5 text-center">สาย</th>
                    <th className="px-3 py-2.5 text-center">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectAttendanceSummaries.map((item) => (
                    <tr className="border-t border-slate-100 font-bold text-slate-700" key={item.id}>
                      <td className="px-3 py-3 font-black text-slate-900">{item.subjectName}</td>
                      <td className="px-3 py-3 text-slate-500">{item.periodLabel}</td>
                      <td className="px-3 py-3 text-center text-emerald-700">{item.present}</td>
                      <td className="px-3 py-3 text-center text-rose-600">{item.absent}</td>
                      <td className="px-3 py-3 text-center text-amber-700">{item.late}</td>
                      <td className="px-3 py-3 text-center">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-sm font-bold text-slate-400">ยังไม่มีการเช็กเวลาเรียนรายวิชาในวันนี้</div>
            )}
          </div>
        </article>

        <article className="app-panel-pad rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="text-cyan-700" size={19} aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">ตารางสอนประจำสัปดาห์</h2>
            </div>
            <Link className="text-xs font-black text-sky-800 hover:underline" to="/app/dashboard?view=schedule">
              จัดการตาราง <ArrowRight className="inline" size={14} />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[82px_repeat(5,minmax(0,1fr))] border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500">
                <span className="p-2.5">เวลา</span>
                {weeklySchedule.activeDays.slice(0, 5).map((day) => (
                  <span className="p-2.5 text-center" key={day}>
                    {day}
                  </span>
                ))}
              </div>
              {weeklyPeriods.map((period) => (
                <div className="grid grid-cols-[82px_repeat(5,minmax(0,1fr))] border-b border-slate-100 last:border-b-0" key={period.index}>
                  <span className="p-2 text-[10px] font-black text-slate-500">
                    {period.start}-{period.end}
                  </span>
                  {weeklySchedule.activeDays.slice(0, 5).map((day) => {
                    const cell = weeklySchedule.cells[makeScheduleCellKey(day, period.index)];
                    return (
                      <div className="border-l border-slate-100 p-1.5" key={`${day}-${period.index}`}>
                        {cell?.subject ? <div className="min-h-9 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-center text-[10px] font-black leading-4 text-sky-900">{cell.subject}</div> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
