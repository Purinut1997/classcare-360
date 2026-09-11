import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  HeartHandshake,
  Home,
  RefreshCw,
  Scale,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  Utensils,
  Zap,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { CSSProperties } from 'react';

export interface AttendanceTrendPoint {
  absent: number;
  date: string;
  late: number;
  leave: number;
  present: number;
  total: number;
}

export interface ClassroomAnalyticsData {
  attendance: {
    absent: number;
    activity?: number;
    late: number;
    leave: number;
    present: number;
    sick?: number;
    total?: number;
    totalSessions: number;
  };
  attendanceTrend: AttendanceTrendPoint[];
  behavior: {
    negativePoints: number;
    negativeRecords?: number;
    positivePoints: number;
    positiveRecords?: number;
    totalRecords: number;
  };
  classroomName: string;
  dataCompleteness: {
    attendanceCheckedToday: boolean;
    behaviorRecorded: boolean;
    homeVisitsCount: number;
    scoresEnteredCount: number;
    studentsCount: number;
    attendanceCount?: number;
    behaviorCount?: number;
    healthCount?: number;
    savingsCount?: number;
    scoresCount?: number;
  };
  savings: {
    accountCount: number;
    activeAccounts: number;
    averageBalance?: number;
    depositsThisMonth?: number;
    monthlyDeposits: number;
    totalBalance: number;
    withdrawalsThisMonth?: number;
  };
  scores: {
    assessmentCount: number;
    assessmentsCount?: number;
    averagePercent: number;
    averageScore?: number;
    failingCount?: number;
    highestScore?: number;
    passedStudentsCount: number;
    passingCount?: number;
  };
}

export interface ClassroomDistributionItem {
  classroomId: string;
  classroomName: string;
  count: number;
}

export interface HealthMetricSummary {
  attention?: number;
  cadence?: string;
  completed?: number;
  detail?: string;
  key?: string;
  label: string;
  percent: number;
  recorded: number;
  total: number;
}

export interface ClassroomAnalyticsChartsProps {
  classroomDistribution: ClassroomDistributionItem[];
  data: ClassroomAnalyticsData;
  onSelectClassroom: (classroomId: string) => void;
  selectedClassroomId: string;
  onRealignClassrooms?: () => void;
  isRealigning?: boolean;
  onDeleteEmptyClassroom?: (classroomId: string, classroomName: string) => void;
  healthMetrics?: HealthMetricSummary[];
}

export function ClassroomAnalyticsCharts({
  classroomDistribution,
  data,
  onSelectClassroom,
  selectedClassroomId,
  onRealignClassrooms,
  isRealigning,
  onDeleteEmptyClassroom,
  healthMetrics,
}: ClassroomAnalyticsChartsProps) {
  const { dataCompleteness, savings, scores } = data;
  const totalStudents = dataCompleteness.studentsCount;

  // Max classroom size for progress bar scale
  const maxClassroomSize = Math.max(...classroomDistribution.map((item) => item.count), 1);
  const totalWorkspaceStudents = classroomDistribution.reduce((acc, item) => acc + item.count, 0);

  // Home visit coverage calculation
  const homeVisitCoverage = totalStudents > 0
    ? Math.min(100, Math.round((dataCompleteness.homeVisitsCount / totalStudents) * 100))
    : 0;

  // Health summary metrics
  const avgHealthPercent = healthMetrics && healthMetrics.length > 0
    ? Math.round(healthMetrics.reduce((acc, m) => acc + m.percent, 0) / healthMetrics.length)
    : totalStudents > 0 && dataCompleteness.healthCount
    ? Math.min(100, Math.round((dataCompleteness.healthCount / totalStudents) * 100))
    : 85;

  // Data completeness items (6 pillars)
  const completenessItems = [
    { label: 'ข้อมูลนักเรียนในห้อง', done: totalStudents > 0 },
    { label: 'เช็กเวลาเรียนประจำวัน', done: dataCompleteness.attendanceCheckedToday },
    { label: 'บันทึกคะแนนเก็บ/ประเมิน', done: scores.assessmentCount > 0 },
    { label: 'เปิดบัญชีออมทรัพย์', done: savings.accountCount > 0 },
    { label: 'บันทึกพฤติกรรม/ความดี', done: dataCompleteness.behaviorRecorded },
    { label: 'เยี่ยมบ้านครบทุกคน', done: dataCompleteness.homeVisitsCount >= totalStudents && totalStudents > 0 },
  ];
  const completedPillarsCount = completenessItems.filter((i) => i.done).length;
  const completenessScore = Math.round((completedPillarsCount / completenessItems.length) * 100);

  return (
    <section className="dashboard-care-panel mt-5" aria-label="โครงสร้างห้องเรียนและงานดูแลนักเรียน">
      {/* ── Header ── */}
      <div className="dashboard-care-heading">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-200">
              <ShieldCheck size={12} className="text-teal-600" />
              CLASSROOM CARE & DEMOGRAPHICS
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-950 tracking-tight">
            โครงสร้างห้องเรียน & งานดูแลนักเรียน
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            สัญญาณสำคัญของ <strong>{data.classroomName || 'ห้องเรียนที่เลือก'}</strong> — การกระจายตัวนักเรียน ความพร้อมของข้อมูล และการดูแลรายบุคคล
          </p>
        </div>

        <Link
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100/80 border border-sky-200/80 transition shadow-xs group"
          to="/app/dashboard?view=reports"
        >
          เปิดศูนย์รายงาน <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ── 2-Column Responsive Layout ── */}
      <div className="dashboard-care-grid">
        {/* ── Column 1: Classroom Distribution ── */}
        <article className="dashboard-card-modern dashboard-classroom-comparison">
          <header className="dashboard-card-header flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Users size={17} />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900">นักเรียนแยกตามห้อง</h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  รวม {totalWorkspaceStudents} คน ใน {classroomDistribution.length} ห้องเรียน
                </p>
              </div>
            </div>

            {onRealignClassrooms ? (
              <button
                onClick={onRealignClassrooms}
                disabled={isRealigning}
                title="จัดระเบียบย้ายนักเรียนเข้าห้องที่ถูกต้อง"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                type="button"
              >
                <RefreshCw size={13} className={isRealigning ? 'animate-spin text-blue-600' : ''} />
                <span>{isRealigning ? 'กำลังจัดห้อง...' : 'จัดห้องอัตโนมัติ'}</span>
              </button>
            ) : null}
          </header>

          <div className="dashboard-horizontal-bars mt-3 space-y-2">
            {classroomDistribution.map((item) => {
              const isSelected = item.classroomId === selectedClassroomId;
              const barPct = (item.count / maxClassroomSize) * 100;

              return (
                <div className="flex items-center gap-1.5 group/room" key={item.classroomId}>
                  <button
                    className={`flex-1 flex items-center gap-3 p-2.5 rounded-xl text-left border transition-all duration-200 ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-300 shadow-xs ring-1 ring-teal-400/40'
                        : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300'
                    }`}
                    disabled={item.classroomId === 'unassigned'}
                    onClick={() => onSelectClassroom(item.classroomId)}
                    type="button"
                  >
                    <span className="w-16 truncate font-extrabold text-xs text-slate-800 shrink-0">
                      {item.classroomName}
                    </span>

                    {/* Progress Bar with Shimmer */}
                    <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSelected
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                            : 'bg-gradient-to-r from-slate-400 to-slate-500 group-hover/room:from-teal-400 group-hover/room:to-teal-500'
                        }`}
                        style={{ width: `${Math.max(4, barPct)}%` }}
                      />
                    </div>

                    <span className="font-black text-xs text-slate-900 w-10 text-right shrink-0">
                      {item.count} คน
                    </span>
                  </button>

                  {item.count === 0 && item.classroomId !== 'unassigned' && onDeleteEmptyClassroom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEmptyClassroom(item.classroomId, item.classroomName);
                      }}
                      title={`ลบห้อง "${item.classroomName}" ที่ไม่มีนักเรียน`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition"
                      type="button"
                      aria-label={`ลบห้อง ${item.classroomName}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}

            {!classroomDistribution.length && (
              <p className="dashboard-mini-empty py-6 text-center text-xs text-slate-400 font-semibold">
                ยังไม่มีข้อมูลห้องเรียน
              </p>
            )}
          </div>
        </article>

        {/* ── Column 2: Student Care & Data Readiness ── */}
        <div className="flex flex-col gap-4">
          {/* Card: Home Visits & Health Screening */}
          <article className="dashboard-card-modern p-4">
            <header className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <HeartHandshake size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">งานดูแล & สุขภาวะนักเรียน</h3>
                  <p className="text-[11px] font-semibold text-slate-500">การเยี่ยมบ้านและการตรวจสุขภาพ</p>
                </div>
              </div>
            </header>

            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {/* Home Visit Metric */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-50/60 to-orange-50/40 border border-rose-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Home size={13} className="text-rose-600" /> การเยี่ยมบ้าน
                  </span>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                    homeVisitCoverage >= 100
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {homeVisitCoverage}%
                  </span>
                </div>
                <div className="mt-2.5 h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${Math.max(3, homeVisitCoverage)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-slate-500">
                  <span>{dataCompleteness.homeVisitsCount}/{totalStudents} คน</span>
                  <Link to="/app/dashboard?view=students" className="text-rose-600 hover:text-rose-800 font-extrabold inline-flex items-center gap-0.5">
                    บันทึก <ArrowRight size={11} />
                  </Link>
                </div>
              </div>

              {/* Health Screening Metric */}
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-emerald-600" /> ข้อมูลสุขภาพ
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {avgHealthPercent}%
                  </span>
                </div>
                <div className="mt-2.5 h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                    style={{ width: `${Math.max(3, avgHealthPercent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-slate-500">
                  <span>น้ำหนัก ส่วนสูง สุขภาพ</span>
                  <Link to="/app/dashboard?view=student-health" className="text-emerald-600 hover:text-emerald-800 font-extrabold inline-flex items-center gap-0.5">
                    ตรวจเช็ก <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          </article>

          {/* Card: 6-Pillar Data Readiness */}
          <article className="dashboard-card-modern p-4">
            <header className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-lime-50 text-lime-700">
                  <DatabaseZap size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">ความพร้อมของฐานข้อมูลห้องเรียน</h3>
                  <p className="text-[11px] font-semibold text-slate-500">6 หมวดที่จำเป็นต่อการออกรายงาน ปพ.</p>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {completedPillarsCount}/6 หมวด
              </span>
            </header>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-3">
              {/* Radial Ring */}
              <div
                className="dashboard-readiness-ring shrink-0"
                style={{ '--readiness': `${completenessScore * 3.6}deg` } as CSSProperties}
              >
                <span>
                  <strong>{completenessScore}%</strong>
                  พร้อมใช้
                </span>
              </div>

              {/* Pillar Checklist */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 w-full">
                {completenessItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[11px]">
                    <span className={`grid h-4 w-4 place-items-center rounded-full shrink-0 ${
                      item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {item.done ? <CheckCircle2 size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                    </span>
                    <span className={`truncate font-bold ${item.done ? 'text-slate-800' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
