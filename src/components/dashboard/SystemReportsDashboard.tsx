import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  Home,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { DashboardStatItem } from '../../data/dashboard';
import type { StudentRiskSignalItem } from '../../lib/studentIntelligence';
import { DailyStatsSummary } from './DailyStatsSummary';
import { TermAttendanceHeatmap, type TermHeatmapDayItem } from './TermAttendanceHeatmap';
import type { ClassroomAnalyticsData } from './ClassroomAnalyticsCharts';

interface SubjectAttendanceSummary {
  absent: number;
  id: string;
  late: number;
  periodLabel: string;
  present: number;
  subjectName: string;
  total: number;
}

interface ClassroomOptionItem {
  id: string;
  name: string;
  academic_year?: string | null;
}

interface SystemReportsDashboardProps {
  analyticsData: ClassroomAnalyticsData;
  classroomName: string;
  classrooms?: ClassroomOptionItem[];
  earlyWarningStudents?: StudentRiskSignalItem[];
  onSelectClassroom?: (classroomId: string) => void;
  onSwitchToToday?: () => void;
  scheduleItems: Array<{ date: string; endDate?: string; id: string; title: string; type: string }>;
  scoresSummary?: {
    gradedAssessments: number;
    totalAssessments: number;
    averagePercent: number;
  };
  selectedClassroomId?: string;
  selectedDate: string;
  stats: DashboardStatItem[];
  subjectAttendanceSummaries: SubjectAttendanceSummary[];
  termHeatmapDays?: TermHeatmapDayItem[];
  termSummary?: {
    termName: string | null;
    startDate: string | null;
    endDate: string | null;
    readinessPercent: number;
  };
  todayTasks: Array<{ detail: string; icon: LucideIcon; label: string; path: string; status: string; tone: string }>;
}

const reportSections = [
  { id: 'overview', label: 'ภาพรวม', icon: ChartNoAxesCombined },
  { id: 'attendance', label: 'การมาเรียน', icon: CalendarDays },
  { id: 'learning', label: 'ผลการเรียน', icon: BookOpen },
  { id: 'care', label: 'ดูแลช่วยเหลือนักเรียน', icon: HeartHandshake },
  { id: 'savings', label: 'การเงิน / เงินออม', icon: PiggyBank },
  { id: 'readiness', label: 'ความครบถ้วนข้อมูล', icon: Activity },
] as const;

type ReportSectionId = (typeof reportSections)[number]['id'];

function ReportMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${tone}`}>
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </article>
  );
}

export function SystemReportsDashboard({
  analyticsData,
  classroomName,
  classrooms = [],
  earlyWarningStudents = [],
  onSelectClassroom,
  onSwitchToToday,
  scheduleItems,
  scoresSummary,
  selectedClassroomId,
  selectedDate,
  subjectAttendanceSummaries,
  termHeatmapDays = [],
  termSummary,
  todayTasks,
}: SystemReportsDashboardProps) {
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');
  const { attendance, behavior, dataCompleteness, savings, scores } = analyticsData;
  const latestTrendDate = analyticsData.attendanceTrend[analyticsData.attendanceTrend.length - 1]?.date || selectedDate;
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(`${date}T12:00:00+07:00`));

  const sectionTitle = reportSections.find((section) => section.id === activeSection)?.label || 'ภาพรวม';
  const handleExport = () => window.print();

  // Aggregate term-wide attendance KPI if heatmap days are available; fallback to today's totals
  const termAttMetrics = useMemo(() => {
    const totals = termHeatmapDays.reduce(
      (acc, d) => {
        acc.present += d.present;
        acc.late += d.late;
        acc.leave += d.leave;
        acc.absent += d.absent;
        acc.total += d.total;
        return acc;
      },
      { present: 0, late: 0, leave: 0, absent: 0, total: 0 },
    );
    if (totals.total === 0) {
      return {
        present: attendance.present,
        late: attendance.late,
        leave: attendance.leave,
        absent: attendance.absent,
        total: attendance.totalSessions,
      };
    }
    return totals;
  }, [attendance, termHeatmapDays]);

  const attRate =
    termAttMetrics.total > 0
      ? Math.round(((termAttMetrics.present + termAttMetrics.late) / termAttMetrics.total) * 100)
      : 0;
  const presentShare = termAttMetrics.total > 0 ? (termAttMetrics.present / termAttMetrics.total) * 100 : 0;
  const lateShare = termAttMetrics.total > 0 ? (termAttMetrics.late / termAttMetrics.total) * 100 : 0;
  const leaveShare = termAttMetrics.total > 0 ? (termAttMetrics.leave / termAttMetrics.total) * 100 : 0;
  const absentShare = termAttMetrics.total > 0 ? (termAttMetrics.absent / termAttMetrics.total) * 100 : 0;

  const totalAssessments = scoresSummary?.totalAssessments ?? scores.assessmentCount;
  const gradedAssessments = scoresSummary?.gradedAssessments ?? 0;
  const gradedRatio = totalAssessments > 0 ? Math.min(100, Math.round((gradedAssessments / totalAssessments) * 100)) : 0;
  const avgScorePct = scoresSummary?.averagePercent ?? scores.averagePercent;
  const watchRatio =
    dataCompleteness.studentsCount > 0
      ? Math.min(100, Math.round((earlyWarningStudents.length / dataCompleteness.studentsCount) * 100))
      : 0;

  return (
    <section className="mt-4 space-y-4" aria-label="รายงานระบบ">
      {/* Clean Calm Header */}
      <header className="rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ec] px-2.5 py-0.5 text-[11px] font-bold text-[#1c573d]">
                <ChartNoAxesCombined size={13} aria-hidden="true" />
                {termSummary?.termName ? `ภาคเรียนที่ ${termSummary.termName}` : 'ภาพรวมภาคเรียน'}
              </span>
              <span className="text-xs font-semibold text-[#75827a]">
                อัปเดตล่าสุด {formatDate(latestTrendDate)} · {classroomName}
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#1f2924]">
              ภาพรวมสถิติห้องเรียน
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#75827a]">
              การมาเรียนทั้งเทอม คะแนน และนักเรียนที่ควรดูแลในหน้าเดียว
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToToday ? (
              <button
                type="button"
                onClick={onSwitchToToday}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-[#fafbf8] px-3 text-xs font-bold text-[#1f2924] transition hover:bg-[#f0f3ee]"
              >
                <Home size={14} aria-hidden="true" />
                <span>ไปหน้าวันนี้</span>
              </button>
            ) : null}

            <Link
              to="/app/dashboard?view=academic-hub"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-white px-3 text-xs font-bold text-[#1f2924] transition hover:bg-[#fafbf8]"
            >
              <CheckCircle2 size={14} className="text-[#2f7d5b]" aria-hidden="true" />
              <span>
                ความพร้อมปิดเทอม
                {typeof termSummary?.readinessPercent === 'number' ? ` (${termSummary.readinessPercent}%)` : ''}
              </span>
            </Link>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1c342b] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#2f7d5b]"
            >
              <ArrowDownToLine size={14} aria-hidden="true" />
              <span>ส่งออก / พิมพ์</span>
            </button>
          </div>
        </div>

        {/* Classroom Switcher Pills */}
        {classrooms.length > 1 && onSelectClassroom ? (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#f0f2ee] pt-3">
            <span className="mr-1 text-[11px] font-bold text-[#75827a]">ห้องเรียน:</span>
            {classrooms.map((room) => {
              const isSelected = room.id === selectedClassroomId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectClassroom(room.id)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    isSelected
                      ? 'bg-[#1c342b] text-white shadow-2xs'
                      : 'border border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f0f3ee]'
                  }`}
                >
                  {room.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {/* Sub-Report Tabs */}
      <nav aria-label="หมวดรายงาน" className="rounded-2xl border border-[#e5e8e1] bg-white p-1.5 shadow-2xs">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reportSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeSection === id}
              onClick={() => setActiveSection(id)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition ${
                activeSection === id
                  ? 'bg-[#1c342b] text-white shadow-2xs'
                  : 'text-[#5b6a5f] hover:bg-[#f4f6f2] hover:text-[#1f2924]'
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      {activeSection === 'overview' ? (
        <div className="space-y-4">
          {/* Calm 4 KPI Row with micro-progress bars */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสำคัญ">
            {/* 1. Attendance Rate */}
            <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
              <p className="text-xs font-bold text-[#75827a]">มาเรียน</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                {attRate}%
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                ขาด {termAttMetrics.absent} · ลา {termAttMetrics.leave} · สาย {termAttMetrics.late}
              </p>
              <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                <div className="bg-emerald-500" style={{ width: `${presentShare}%` }} />
                <div className="bg-amber-400" style={{ width: `${lateShare}%` }} />
                <div className="bg-sky-400" style={{ width: `${leaveShare}%` }} />
                <div className="bg-rose-400" style={{ width: `${absentShare}%` }} />
              </div>
            </article>

            {/* 2. Graded Assessments Progress */}
            <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
              <p className="text-xs font-bold text-[#75827a]">กรอกคะแนนแล้ว</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                {gradedRatio}%
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                {gradedAssessments} / {totalAssessments} ช่องคะแนน
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${gradedRatio}%` }}
                />
              </div>
            </article>

            {/* 3. Class Average Score */}
            <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
              <p className="text-xs font-bold text-[#75827a]">คะแนนเฉลี่ยรวม</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                {avgScorePct}%
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                ผ่านเกณฑ์ {scores.passedStudentsCount} / {dataCompleteness.studentsCount} คน
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                <div
                  className="h-full rounded-full bg-[#2f7d5b] transition-all"
                  style={{ width: `${Math.min(100, avgScorePct)}%` }}
                />
              </div>
            </article>

            {/* 4. Students Needing Attention */}
            <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
              <p className="text-xs font-bold text-[#75827a]">ควรดูแลต่อเนื่อง</p>
              <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                {earlyWarningStudents.length} คน
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                {earlyWarningStudents.length > 0 ? 'ขาด/คะแนนต่ำ/เคสติดตาม' : 'ไม่พบสัญญาณเสี่ยงในห้อง'}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                <div
                  className={`h-full rounded-full transition-all ${
                    earlyWarningStudents.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${earlyWarningStudents.length > 0 ? Math.max(12, watchRatio) : 100}%` }}
                />
              </div>
            </article>
          </div>

          {/* 12-Col Centerpiece: Term Heatmap (7 cols) + Watchlist (5 cols) */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <TermAttendanceHeatmap
                days={termHeatmapDays}
                selectedDate={selectedDate}
                classroomName={classroomName}
              />
            </div>

            <article className="flex flex-col justify-between rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs xl:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-[#1f2924]">
                      <ShieldAlert
                        size={16}
                        className={earlyWarningStudents.length > 0 ? 'text-rose-600' : 'text-emerald-600'}
                        aria-hidden="true"
                      />
                      ควรดูแล ({earlyWarningStudents.length} คน)
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                      แตะชื่อเพื่อดูข้อมูลนักเรียนแบบ 360°
                    </p>
                  </div>

                  <Link
                    to="/app/dashboard?view=students&studentView=care"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] hover:underline"
                  >
                    <span>ดูทั้งหมด</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </div>

                {earlyWarningStudents.length > 0 ? (
                  <div className="mt-3.5 divide-y divide-[#f0f2ee]">
                    {earlyWarningStudents.slice(0, 6).map((item) => (
                      <Link
                        key={item.studentId}
                        to={`/app/dashboard?view=students&studentView=profile&studentId=${encodeURIComponent(item.studentId)}`}
                        className="group flex items-center justify-between gap-3 py-2.5 transition hover:bg-[#fafbf9] rounded-xl px-1.5 -mx-1.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              item.riskLevel === 'high' ? 'bg-rose-500' : 'bg-amber-400'
                            }`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#1f2924] group-hover:text-[#1c573d]">
                              {item.studentName}
                              {item.studentCode ? (
                                <span className="ml-1.5 text-[11px] font-semibold text-[#8a968e]">
                                  #{item.studentCode}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 truncate text-xs font-medium text-[#75827a]">
                              {item.reasons.slice(0, 2).join(' · ') || 'ต้องติดตามใกล้ชิด'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          size={15}
                          className="shrink-0 text-[#9aa59e] transition group-hover:translate-x-0.5 group-hover:text-[#1c573d]"
                          aria-hidden="true"
                        />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dce3d7] bg-[#fafbf9] px-4 py-8 text-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e6f4ec] text-[#1c573d]">
                      <ShieldCheck size={20} aria-hidden="true" />
                    </span>
                    <p className="mt-2.5 text-sm font-bold text-[#1f2924]">ห้องนี้ยังไม่มีนักเรียนกลุ่มเสี่ยง</p>
                    <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                      การมาเรียนและคะแนนอยู่ในเกณฑ์ปกติ
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-3 border-t border-[#f0f2ee] pt-2.5 text-[11px] font-medium text-[#75827a]">
                คำนวณอัตโนมัติจากเวลาเรียน 30 วัน คะแนน พฤติกรรม และเคสดูแล
              </div>
            </article>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-[#e5e8e1] bg-white p-4 shadow-2xs sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                รายงาน · {sectionTitle}
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950">{`สรุป${sectionTitle}`}</h3>
            </div>
            <p className="text-xs font-semibold text-slate-500">อัปเดตตามข้อมูลที่บันทึกในระบบ</p>
          </div>

          {activeSection === 'attendance' && (
            <div className="space-y-4">
              <TermAttendanceHeatmap
                days={termHeatmapDays}
                selectedDate={selectedDate}
                classroomName={classroomName}
              />
              <DailyStatsSummary
                analyticsData={analyticsData}
                classroomName={classroomName}
                selectedDate={selectedDate}
                subjectAttendanceSummaries={subjectAttendanceSummaries}
              />
            </div>
          )}

          {activeSection === 'learning' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <ReportMetric
                label="คะแนนเฉลี่ย"
                value={`${scores.averagePercent}%`}
                detail="ค่าเฉลี่ยจากชุดคะแนนที่บันทึก"
                tone="border-sky-200 bg-sky-50/80"
              />
              <ReportMetric
                label="ผ่านเกณฑ์"
                value={`${scores.passedStudentsCount} คน`}
                detail={`จากนักเรียน ${dataCompleteness.studentsCount} คน`}
                tone="border-emerald-200 bg-emerald-50/80"
              />
              <ReportMetric
                label="ชุดคะแนน"
                value={`${scores.assessmentCount} ชุด`}
                detail="จำนวนการประเมินที่มีในระบบ"
                tone="border-violet-200 bg-violet-50/80"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-3">
                <p className="text-sm font-semibold text-slate-600">ดูคะแนนรายวิชาและจัดการผลการเรียนเพิ่มเติม</p>
                <Link to="/app/dashboard?view=scores" className="text-sm font-black text-sky-800 hover:underline">
                  เปิดสมุดคะแนน →
                </Link>
              </div>
            </div>
          )}

          {activeSection === 'care' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <ReportMetric
                label="บันทึกพฤติกรรม"
                value={`${behavior.totalRecords} รายการ`}
                detail="รายการที่บันทึกในระบบ"
                tone="border-violet-200 bg-violet-50/80"
              />
              <ReportMetric
                label="คะแนนความดี"
                value={`${behavior.positivePoints} คะแนน`}
                detail="คะแนนพฤติกรรมเชิงบวก"
                tone="border-emerald-200 bg-emerald-50/80"
              />
              <ReportMetric
                label="บันทึกที่ต้องติดตาม"
                value={`${behavior.negativeRecords ?? 0} รายการ`}
                detail="ตรวจสอบรายละเอียดในหน้าดูแลนักเรียน"
                tone="border-amber-200 bg-amber-50/80"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-3">
                <p className="text-sm font-semibold text-slate-600">เปิดข้อมูลสุขภาพและการช่วยเหลือรายบุคคล</p>
                <Link to="/app/dashboard?view=student-health" className="text-sm font-black text-sky-800 hover:underline">
                  ดูแลช่วยเหลือนักเรียน →
                </Link>
              </div>
            </div>
          )}

          {activeSection === 'savings' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <ReportMetric
                label="ยอดเงินออมรวม"
                value={`฿${savings.totalBalance.toLocaleString('th-TH')}`}
                detail="ยอดคงเหลือของบัญชีในระบบ"
                tone="border-rose-200 bg-rose-50/80"
              />
              <ReportMetric
                label="ฝากเดือนนี้"
                value={`฿${savings.monthlyDeposits.toLocaleString('th-TH')}`}
                detail="ยอดฝากสะสมเดือนปัจจุบัน"
                tone="border-emerald-200 bg-emerald-50/80"
              />
              <ReportMetric
                label="บัญชีที่ใช้งาน"
                value={`${savings.activeAccounts} บัญชี`}
                detail="บัญชีเงินออมที่เปิดใช้งาน"
                tone="border-amber-200 bg-amber-50/80"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-3">
                <p className="text-sm font-semibold text-slate-600">เปิดรายการฝากถอนและข้อมูลบัญชีรายคน</p>
                <Link to="/app/dashboard?view=savings" className="text-sm font-black text-sky-800 hover:underline">
                  ดูข้อมูลเงินออม →
                </Link>
              </div>
            </div>
          )}

          {activeSection === 'readiness' && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: 'นักเรียน', ready: dataCompleteness.studentsCount > 0, detail: `${dataCompleteness.studentsCount} คน` },
                {
                  label: 'การมาเรียนวันนี้',
                  ready: dataCompleteness.attendanceCheckedToday,
                  detail: dataCompleteness.attendanceCheckedToday
                    ? `${attendance.present + attendance.late} คนมาเรียน`
                    : 'ยังไม่มีการบันทึกวันนี้',
                },
                { label: 'ผลการเรียน', ready: scores.assessmentCount > 0, detail: `${scores.assessmentCount} ชุดคะแนน` },
                { label: 'พฤติกรรม', ready: dataCompleteness.behaviorRecorded, detail: `${behavior.totalRecords} รายการ` },
                {
                  label: 'สุขภาพนักเรียน',
                  ready: (dataCompleteness.healthCount ?? 0) > 0,
                  detail: `${dataCompleteness.healthCount ?? 0} รายการ`,
                },
                { label: 'เงินออม', ready: savings.activeAccounts > 0, detail: `${savings.activeAccounts} บัญชี` },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      item.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <CheckCircle2 size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">{item.label}</span>
                    <span className="block text-xs font-semibold text-slate-500">{item.detail}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                      item.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {item.ready ? 'มีข้อมูล' : 'รอบันทึก'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tasks & Schedule Row */}
      <section className="grid gap-4 xl:grid-cols-2" aria-label="งานและกำหนดการของฉัน">
        <article className="overflow-hidden rounded-[24px] border border-[#e5e8e1] bg-white shadow-2xs">
          <header className="flex items-center justify-between gap-3 border-b border-[#f0f2ee] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#2f7d5b]">MY WORK</p>
              <h3 className="mt-0.5 text-base font-black text-[#1f2924]">งานที่ควรตรวจวันนี้</h3>
            </div>
            <span className="rounded-full bg-[#e6f4ec] px-2.5 py-1 text-[11px] font-black text-[#1c573d]">
              {todayTasks.length} งาน
            </span>
          </header>
          <div className="divide-y divide-[#f0f2ee] px-4 sm:px-5">
            {todayTasks.map((task) => {
              const Icon = task.icon;
              return (
                <Link
                  key={task.label}
                  to={task.path}
                  className="group flex items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2f7d5b]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fafbf9] text-[#55615a] transition group-hover:bg-[#e6f4ec] group-hover:text-[#1c573d]">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[#1f2924]">{task.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#75827a]">{task.detail}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${task.tone}`}>
                    {task.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="overflow-hidden rounded-[24px] border border-[#e5e8e1] bg-white shadow-2xs">
          <header className="flex items-center justify-between gap-3 border-b border-[#f0f2ee] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">MY SCHEDULE</p>
              <h3 className="mt-0.5 text-base font-black text-[#1f2924]">กำหนดการใกล้ถึง</h3>
            </div>
            <Link to="/app/dashboard?view=school-calendar" className="text-xs font-black text-[#2f7d5b] hover:underline">
              เปิดปฏิทิน →
            </Link>
          </header>
          {scheduleItems.length > 0 ? (
            <ul className="divide-y divide-[#f0f2ee] px-4 sm:px-5">
              {scheduleItems.slice(0, 5).map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-3">
                  <time
                    dateTime={event.date}
                    className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-center text-[10px] font-black leading-tight text-amber-900"
                  >
                    <span>
                      {new Intl.DateTimeFormat('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'Asia/Bangkok',
                      }).format(new Date(`${event.date}T12:00:00+07:00`))}
                    </span>
                  </time>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[#1f2924]">{event.title}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[#75827a]">
                      {event.type === 'exam'
                        ? 'กำหนดการสอบ'
                        : event.type === 'holiday'
                          ? 'วันหยุด'
                          : event.type === 'makeup'
                            ? 'เรียนชดเชย'
                            : event.type === 'activity'
                              ? 'กิจกรรมโรงเรียน'
                              : 'กำหนดการ'}
                    </span>
                  </span>
                  {event.endDate && event.endDate !== event.date ? (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
                      หลายวัน
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <CalendarDays size={24} className="mx-auto text-slate-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-slate-600">ยังไม่มีกำหนดการใกล้ถึง</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">เมื่อเพิ่มกิจกรรมในปฏิทิน รายการจะแสดงที่นี่</p>
            </div>
          )}
        </article>
      </section>
      <p className="text-right text-[11px] font-semibold text-slate-400">
        รายงานนี้แสดงข้อมูลตามสิทธิ์และห้องเรียนที่เลือก
      </p>
    </section>
  );
}
