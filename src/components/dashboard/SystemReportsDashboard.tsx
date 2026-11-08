import { useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  HeartHandshake,
  PiggyBank,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { DashboardStatItem } from '../../data/dashboard';
import { DailyStatsSummary } from './DailyStatsSummary';
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

interface SystemReportsDashboardProps {
  analyticsData: ClassroomAnalyticsData;
  classroomName: string;
  scheduleItems: Array<{ date: string; endDate?: string; id: string; title: string; type: string }>;
  selectedDate: string;
  stats: DashboardStatItem[];
  subjectAttendanceSummaries: SubjectAttendanceSummary[];
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
  scheduleItems,
  selectedDate,
  stats,
  subjectAttendanceSummaries,
  todayTasks,
}: SystemReportsDashboardProps) {
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');
  const { attendance, behavior, dataCompleteness, savings, scores } = analyticsData;
  const latestTrendDate = analyticsData.attendanceTrend[analyticsData.attendanceTrend.length - 1]?.date || selectedDate;
  const formatDate = (date: string) => new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`));

  const sectionTitle = reportSections.find((section) => section.id === activeSection)?.label || 'ภาพรวม';
  const handleExport = () => window.print();

  return (
    <section className="mt-5 space-y-4" aria-label="รายงานระบบ">
      <header className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
              <ChartNoAxesCombined size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">CLASSCARE 360 · REPORTS</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">รายงานระบบ</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">ภาพรวมข้อมูลโรงเรียนและการดำเนินงาน อ่านง่ายในหน้าเดียว</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
              <CalendarDays size={15} className="text-sky-700" aria-hidden="true" />
              <span>ข้อมูลล่าสุด {formatDate(latestTrendDate)}</span>
            </div>
            <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
              <Users size={15} className="text-sky-700" aria-hidden="true" />
              <span>{classroomName}</span>
            </div>
            <button type="button" onClick={handleExport} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
              <ArrowDownToLine size={15} aria-hidden="true" /> พิมพ์ / บันทึก PDF
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="หมวดรายงาน" className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {reportSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeSection === id}
              onClick={() => setActiveSection(id)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${activeSection === id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">รายงาน · {sectionTitle}</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{sectionTitle === 'ภาพรวม' ? 'สรุปข้อมูลโรงเรียน' : `สรุป${sectionTitle}`}</h3>
          </div>
          <p className="text-xs font-semibold text-slate-500">ช่วงข้อมูลการมาเรียน 7 วันล่าสุด · อัปเดตตามข้อมูลที่บันทึกในระบบ</p>
        </div>

        {activeSection === 'overview' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="ตัวเลขสำคัญ">
              {stats.map((stat, index) => (
                <ReportMetric
                  key={stat.label}
                  label={stat.label}
                  value={String(stat.value)}
                  detail={stat.subDetail || stat.detail}
                  tone={[
                    'border-sky-200 bg-sky-50/80',
                    'border-emerald-200 bg-emerald-50/80',
                    'border-amber-200 bg-amber-50/80',
                    'border-rose-200 bg-rose-50/80',
                  ][index % 4]}
                />
              ))}
            </div>
            <div className="mt-4">
              <DailyStatsSummary analyticsData={analyticsData} classroomName={classroomName} selectedDate={selectedDate} subjectAttendanceSummaries={subjectAttendanceSummaries} />
            </div>
          </>
        )}

        {activeSection === 'attendance' && (
          <DailyStatsSummary analyticsData={analyticsData} classroomName={classroomName} selectedDate={selectedDate} subjectAttendanceSummaries={subjectAttendanceSummaries} />
        )}

        {activeSection === 'learning' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <ReportMetric label="คะแนนเฉลี่ย" value={`${scores.averagePercent}%`} detail="ค่าเฉลี่ยจากชุดคะแนนที่บันทึก" tone="border-sky-200 bg-sky-50/80" />
            <ReportMetric label="ผ่านเกณฑ์" value={`${scores.passedStudentsCount} คน`} detail={`จากนักเรียน ${dataCompleteness.studentsCount} คน`} tone="border-emerald-200 bg-emerald-50/80" />
            <ReportMetric label="ชุดคะแนน" value={`${scores.assessmentCount} ชุด`} detail="จำนวนการประเมินที่มีในระบบ" tone="border-violet-200 bg-violet-50/80" />
            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">ดูคะแนนรายวิชาและจัดการผลการเรียนเพิ่มเติม</p>
              <Link to="/app/dashboard?view=scores" className="text-sm font-black text-sky-800 hover:underline">เปิดสมุดคะแนน →</Link>
            </div>
          </div>
        )}

        {activeSection === 'care' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <ReportMetric label="บันทึกพฤติกรรม" value={`${behavior.totalRecords} รายการ`} detail="รายการที่บันทึกในระบบ" tone="border-violet-200 bg-violet-50/80" />
            <ReportMetric label="คะแนนความดี" value={`${behavior.positivePoints} คะแนน`} detail="คะแนนพฤติกรรมเชิงบวก" tone="border-emerald-200 bg-emerald-50/80" />
            <ReportMetric label="บันทึกที่ต้องติดตาม" value={`${behavior.negativeRecords ?? 0} รายการ`} detail="ตรวจสอบรายละเอียดในหน้าดูแลนักเรียน" tone="border-amber-200 bg-amber-50/80" />
            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">เปิดข้อมูลสุขภาพและการช่วยเหลือรายบุคคล</p>
              <Link to="/app/dashboard?view=student-health" className="text-sm font-black text-sky-800 hover:underline">ดูแลช่วยเหลือนักเรียน →</Link>
            </div>
          </div>
        )}

        {activeSection === 'savings' && (
          <div className="grid gap-3 sm:grid-cols-3">
            <ReportMetric label="ยอดเงินออมรวม" value={`฿${savings.totalBalance.toLocaleString('th-TH')}`} detail="ยอดคงเหลือของบัญชีในระบบ" tone="border-rose-200 bg-rose-50/80" />
            <ReportMetric label="ฝากเดือนนี้" value={`฿${savings.monthlyDeposits.toLocaleString('th-TH')}`} detail="ยอดฝากสะสมเดือนปัจจุบัน" tone="border-emerald-200 bg-emerald-50/80" />
            <ReportMetric label="บัญชีที่ใช้งาน" value={`${savings.activeAccounts} บัญชี`} detail="บัญชีเงินออมที่เปิดใช้งาน" tone="border-amber-200 bg-amber-50/80" />
            <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-600">เปิดรายการฝากถอนและข้อมูลบัญชีรายคน</p>
              <Link to="/app/dashboard?view=savings" className="text-sm font-black text-sky-800 hover:underline">ดูข้อมูลเงินออม →</Link>
            </div>
          </div>
        )}

        {activeSection === 'readiness' && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: 'นักเรียน', ready: dataCompleteness.studentsCount > 0, detail: `${dataCompleteness.studentsCount} คน` },
              { label: 'การมาเรียนวันนี้', ready: dataCompleteness.attendanceCheckedToday, detail: dataCompleteness.attendanceCheckedToday ? `${attendance.present + attendance.late} คนมาเรียน` : 'ยังไม่มีการบันทึกวันนี้' },
              { label: 'ผลการเรียน', ready: scores.assessmentCount > 0, detail: `${scores.assessmentCount} ชุดคะแนน` },
              { label: 'พฤติกรรม', ready: dataCompleteness.behaviorRecorded, detail: `${behavior.totalRecords} รายการ` },
              { label: 'สุขภาพนักเรียน', ready: (dataCompleteness.healthCount ?? 0) > 0, detail: `${dataCompleteness.healthCount ?? 0} รายการ` },
              { label: 'เงินออม', ready: savings.activeAccounts > 0, detail: `${savings.activeAccounts} บัญชี` },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-900">{item.label}</span>
                  <span className="block text-xs font-semibold text-slate-500">{item.detail}</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{item.ready ? 'มีข้อมูล' : 'รอบันทึก'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <section className="grid gap-4 xl:grid-cols-2" aria-label="งานและกำหนดการของฉัน">
        <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">MY WORK</p>
              <h3 className="mt-0.5 text-base font-black text-slate-950">งานที่ควรตรวจวันนี้</h3>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-800">{todayTasks.length} งาน</span>
          </header>
          <div className="divide-y divide-slate-100 px-4 sm:px-5">
            {todayTasks.map((task) => {
              const Icon = task.icon;
              return (
                <Link key={task.label} to={task.path} className="group flex items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 transition group-hover:bg-sky-50 group-hover:text-sky-700">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">{task.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{task.detail}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${task.tone}`}>{task.status}</span>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">MY SCHEDULE</p>
              <h3 className="mt-0.5 text-base font-black text-slate-950">กำหนดการใกล้ถึง</h3>
            </div>
            <Link to="/app/dashboard?view=school-calendar" className="text-xs font-black text-sky-800 hover:underline">เปิดปฏิทิน →</Link>
          </header>
          {scheduleItems.length > 0 ? (
            <ul className="divide-y divide-slate-100 px-4 sm:px-5">
              {scheduleItems.slice(0, 5).map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-3">
                  <time dateTime={event.date} className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-center text-[10px] font-black leading-tight text-amber-900">
                    <span>{new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(`${event.date}T12:00:00+07:00`))}</span>
                  </time>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">{event.title}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">{event.type === 'exam' ? 'กำหนดการสอบ' : event.type === 'holiday' ? 'วันหยุด' : event.type === 'makeup' ? 'เรียนชดเชย' : event.type === 'activity' ? 'กิจกรรมโรงเรียน' : 'กำหนดการ'}</span>
                  </span>
                  {event.endDate && event.endDate !== event.date ? <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">หลายวัน</span> : null}
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
      <p className="text-right text-[11px] font-semibold text-slate-400">รายงานนี้แสดงข้อมูลตามสิทธิ์และห้องเรียนที่เลือก</p>
    </section>
  );
}
