import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  HeartHandshake,
  School,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { dashboardStats } from '../../data/dashboard';
import { getBangkokDate } from '../../lib/date';
import { canManageWorkspace } from '../../lib/roles';
import { loadScheduleSettings, type DayName } from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';
import { StatsGrid } from '../../components/dashboard/StatsGrid';
import {
  StudentWatchlist,
  type WatchlistStudentItem,
} from '../../components/dashboard/StudentWatchlist';
import {
  ClassroomAnalyticsCharts,
  type ClassroomAnalyticsData,
} from '../../components/dashboard/ClassroomAnalyticsCharts';

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

const emptyAnalyticsData: ClassroomAnalyticsData = {
  attendance: {
    absent: 0,
    late: 0,
    leave: 0,
    present: 0,
    totalSessions: 0,
  },
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

const dayNamesTh: DayName[] = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function DashboardPage({ session }: DashboardPageProps) {
  const canManageCurrentWorkspace = canManageWorkspace(session.profile.role);
  const [stats, setStats] = useState(dashboardStats);
  const [pendingJoinRequestCount, setPendingJoinRequestCount] = useState(0);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<ClassroomAnalyticsData>(emptyAnalyticsData);
  const [watchlistStudents, setWatchlistStudents] = useState<WatchlistStudentItem[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<Array<[string, string, string]>>([]);

  // Load Classrooms
  useEffect(() => {
    let isMounted = true;
    async function loadClassrooms() {
      if (!supabase || !session.workspace) return;
      const { data } = await supabase
        .from('classrooms')
        .select('id, name, academic_year')
        .eq('workspace_id', session.workspace.id)
        .order('name', { ascending: true });

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
  }, [session.workspace]);

  // Load General Workspace Dashboard Stats
  useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      if (!supabase || !session.workspace) {
        setStats(dashboardStats);
        return;
      }

      const [
        { count: studentCount },
        { count: classroomCount },
        { count: careCaseCount },
        { data: savingsRows },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active'),
        supabase.from('classrooms').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active'),
        supabase.from('student_care_cases').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).in('status', ['open', 'monitoring']),
        supabase.from('savings_accounts').select('balance').eq('workspace_id', session.workspace.id).eq('status', 'active'),
      ]);

      if (!isMounted) return;

      const savingsBalance = (savingsRows || []).reduce(
        (sum, row) => sum + Number((row as { balance?: number | string | null }).balance || 0),
        0,
      );

      setStats([
        { ...dashboardStats[0], detail: session.workspace.classroomName, value: String(studentCount ?? 0) },
        { ...dashboardStats[1], detail: 'ห้องที่กำลังใช้งาน', label: 'ห้องเรียน', value: String(classroomCount ?? 0) },
        { ...dashboardStats[2], detail: 'เปิดอยู่และกำลังติดตาม', value: String(careCaseCount ?? 0) },
        { ...dashboardStats[3], value: savingsBalance.toLocaleString('th-TH', { maximumFractionDigits: 0 }) },
      ]);
    }

    void loadDashboardStats();
    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  // Load Classroom Specific Real Analytics Data & Watchlist Students
  useEffect(() => {
    let isMounted = true;

    async function loadClassroomAnalytics() {
      if (!supabase || !session.workspace || !selectedClassroomId) {
        setAnalyticsData(emptyAnalyticsData);
        setWatchlistStudents([]);
        return;
      }

      const targetClassroom = classrooms.find((c) => c.id === selectedClassroomId);
      const classroomName = targetClassroom ? targetClassroom.name : session.workspace.classroomName || 'ห้องเรียน';

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
        supabase.from('students').select('id, student_code, first_name, last_name').eq('workspace_id', session.workspace.id).eq('classroom_id', selectedClassroomId),
        supabase.from('attendance_records').select('student_id, status, record_date').eq('workspace_id', session.workspace.id),
        supabase.from('savings_accounts').select('id, student_id, balance').eq('workspace_id', session.workspace.id),
        supabase.from('savings_transactions').select('student_id, amount, transaction_type').eq('workspace_id', session.workspace.id),
        supabase.from('score_assessments').select('id, max_score').eq('workspace_id', session.workspace.id),
        supabase.from('score_entries').select('student_id, score, assessment_id').eq('workspace_id', session.workspace.id),
        supabase.from('behavior_records').select('student_id, points, tone').eq('workspace_id', session.workspace.id),
        supabase.from('student_home_visits').select('student_id, status').eq('workspace_id', session.workspace.id).eq('status', 'completed'),
        supabase.from('student_care_cases').select('id, student_id, title, status, priority').eq('workspace_id', session.workspace.id).in('status', ['open', 'monitoring']),
      ]);

      if (!isMounted) return;

      const studentMap = new Map((studentRows || []).map((s) => [s.id, s]));
      const studentIds = new Set(studentMap.keys());
      const studentsCount = studentIds.size;

      // Real Attendance calculations
      let present = 0;
      let late = 0;
      let leave = 0;
      let absent = 0;
      const todayStr = getBangkokDate();
      let attendanceCheckedToday = false;

      (attendanceRows || []).forEach((row) => {
        if (studentIds.has(row.student_id)) {
          if (row.record_date === todayStr) {
            attendanceCheckedToday = true;
          }
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
      const monthlyDeposits = (savingsTxRows || [])
        .filter((tx) => studentIds.has(tx.student_id) && tx.transaction_type === 'deposit')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

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

      setAnalyticsData({
        attendance: {
          absent,
          late,
          leave,
          present,
          totalSessions: present + late + leave + absent,
        },
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
          accent: cc.priority === 'high' || cc.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800',
          id: cc.id,
          name,
          reason: cc.title || 'ติดตามการดูแล',
          status: cc.status === 'open' ? 'เคสใหม่' : 'กำลังติดตาม',
        };
      });
      setWatchlistStudents(watchlistItems);

      // Real Timetable for Today's Day
      const todayDayIndex = new Date().getDay();
      const todayDayName = dayNamesTh[todayDayIndex];
      const settings = loadScheduleSettings(classroomName);
      const scheduleItems: Array<[string, string, string]> = [];

      for (let i = 0; i < settings.periodCount; i++) {
        const cellKey = `${todayDayName}-${i}`;
        const cell = settings.cells[cellKey];
        if (cell && cell.subject) {
          const startTimeMinutes = 8 * 60 + 30 + i * settings.periodMinutes;
          const endTimeMinutes = startTimeMinutes + settings.periodMinutes;
          const startStr = `${String(Math.floor(startTimeMinutes / 60)).padStart(2, '0')}:${String(startTimeMinutes % 60).padStart(2, '0')}`;
          const endStr = `${String(Math.floor(endTimeMinutes / 60)).padStart(2, '0')}:${String(endTimeMinutes % 60).padStart(2, '0')}`;
          scheduleItems.push([`${startStr}–${endStr}`, cell.subject, classroomName]);
        }
      }
      setTodaySchedule(scheduleItems);
    }

    void loadClassroomAnalytics();
    return () => {
      isMounted = false;
    };
  }, [classrooms, selectedClassroomId, session.workspace]);

  // Load Pending Join Requests
  useEffect(() => {
    let isMounted = true;

    async function loadPendingJoinRequests() {
      if (!supabase || !session.workspace || !canManageCurrentWorkspace) {
        setPendingJoinRequestCount(0);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_workspace_members', { target_workspace_id: session.workspace.id })
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
  }, [canManageCurrentWorkspace, session.workspace]);

  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);

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

  return (
    <main className="app-page">
      <div className="app-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                <select
                  className="bg-transparent text-sm font-black text-slate-900 focus:outline-none cursor-pointer pr-4"
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                >
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

          <Link
            className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition hover:-translate-y-0.5 shadow-sm"
            to="/app/dashboard?view=teacher-work"
          >
            <CalendarClock size={18} aria-hidden="true" />
            เช็กเวลาเรียน
          </Link>
        </div>
      </div>

      {/* Main Workspace Metrics */}
      <StatsGrid stats={stats} />

      {/* Classroom Dataset Status & Analytics Charts Section */}
      <ClassroomAnalyticsCharts data={analyticsData} />

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
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                    {index + 1}
                  </span>
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
          <div className="flex items-center gap-2">
            <Clock3 className="text-cyan-700" size={19} aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">ตารางวันนี้ ({dayNamesTh[new Date().getDay()]})</h2>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {todaySchedule.length > 0 ? (
              todaySchedule.map(([time, subject, room]) => (
                <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0" key={`${time}-${subject}`}>
                  <span className="text-xs font-black text-slate-500">{time}</span>
                  <span className="font-black text-slate-900">{subject}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{room}</span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs font-bold text-slate-400">
                ยังไม่ได้กำหนดตารางเรียนประจำวันนี้ ({dayNamesTh[new Date().getDay()]})
              </div>
            )}
          </div>
        </article>

        <article className="app-panel-pad rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={19} aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">ความพร้อมของห้องเรียน ({selectedClassroom?.name || 'ห้องเรียน'})</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {[
              `รายชื่อนักเรียนในห้อง: ${analyticsData.dataCompleteness.studentsCount} คน`,
              `การเช็กเวลาเรียนประจำวันนี้: ${analyticsData.dataCompleteness.attendanceCheckedToday ? 'เรียบร้อยแล้ว' : 'ยังไม่เช็กชื่อ'}`,
              `จำนวนชุดคะแนนที่ลงบันทึก: ${analyticsData.scores.assessmentCount} ชุด`,
              `การบันทึกเยี่ยมบ้าน: ${analyticsData.dataCompleteness.homeVisitsCount} / ${analyticsData.dataCompleteness.studentsCount} คน`,
            ].map((item) => (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800" key={item}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
