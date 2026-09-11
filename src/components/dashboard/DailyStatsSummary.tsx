import type { CSSProperties } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck2,
  Coins,
  HeartHandshake,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { ClassroomAnalyticsData, AttendanceTrendPoint } from './ClassroomAnalyticsCharts';

interface SubjectAttendanceSummary {
  absent: number;
  id: string;
  late: number;
  periodLabel: string;
  present: number;
  subjectName: string;
  total: number;
}

interface DailyStatsSummaryProps {
  analyticsData: ClassroomAnalyticsData;
  classroomName: string;
  selectedDate: string;
  subjectAttendanceSummaries: SubjectAttendanceSummary[];
}

// ─── helpers ───────────────────────────────────────────────────────────────

const shortDate = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
});

function formatTrendDate(date: string) {
  return shortDate.format(new Date(`${date}T12:00:00+07:00`)).replace('.', '');
}

function formatDayLabel(date: string) {
  const full = shortDate.format(new Date(`${date}T12:00:00+07:00`)).replace('.', '');
  return full.split(' ')[0] ?? full;
}

function calcAttendanceRate(trend: AttendanceTrendPoint[]) {
  const total = trend.reduce((s, p) => s + p.total, 0);
  const present = trend.reduce((s, p) => s + p.present, 0);
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

function calcDelta(trend: AttendanceTrendPoint[]): number | null {
  if (trend.length < 6) return null;
  const recent = trend.slice(-3);
  const prev = trend.slice(-6, -3);
  const rate = (days: AttendanceTrendPoint[]) => {
    const t = days.reduce((a, d) => ({ p: a.p + d.present, t: a.t + d.total }), { p: 0, t: 0 });
    return t.t > 0 ? Math.round((t.p / t.t) * 100) : null;
  };
  const r = rate(recent);
  const p = rate(prev);
  return r !== null && p !== null ? r - p : null;
}

// ─── KPI Card ──────────────────────────────────────────────────────────────

interface KpiTone {
  icon: string;
  bar: string;
  badge: string;
  text: string;
}

interface KpiCardProps {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
  percent: number;
  tone: KpiTone;
  delta?: number | null;
}

function KpiCard({ icon: Icon, label, value, sub, percent, tone, delta }: KpiCardProps) {
  return (
    <article className="daily-kpi-card">
      <div className="daily-kpi-header">
        <span className={`daily-kpi-icon ${tone.icon}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className={`daily-kpi-label ${tone.text}`}>{label}</span>
        {delta !== null && delta !== undefined && (
          <span
            className={`daily-kpi-delta ${delta >= 0 ? 'is-up' : 'is-down'}`}
            title={`เปลี่ยนแปลง ${delta >= 0 ? '+' : ''}${delta}%`}
          >
            {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="daily-kpi-value">{value}</p>
      <p className="daily-kpi-sub">{sub}</p>
      <div className="daily-kpi-bar-track" aria-hidden="true">
        <div
          className={`daily-kpi-bar-fill ${tone.bar}`}
          style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        />
      </div>
      <span className={`daily-kpi-pct-badge ${tone.badge}`}>{percent}%</span>
    </article>
  );
}

// ─── Donut Chart ───────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

function DonutChart({
  segments,
  total,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
  centerSub: string;
}) {
  let acc = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = (s.value / Math.max(total, 1)) * 100;
      const start = acc;
      acc += pct;
      return `${s.color} ${start.toFixed(1)}% ${acc.toFixed(1)}%`;
    });

  const gradient =
    stops.length > 0
      ? `conic-gradient(${stops.join(', ')})`
      : 'conic-gradient(#e2e8f0 0% 100%)';

  return (
    <div className="daily-donut-wrap">
      <div className="daily-donut" style={{ background: gradient } as CSSProperties}>
        <div className="daily-donut-hole">
          <strong>{centerLabel}</strong>
          <span>{centerSub}</span>
        </div>
      </div>
      <ul className="daily-donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color } as CSSProperties} />
            <span>{s.label}</span>
            <strong>{s.value} คน</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Bar Chart (7-day stacked) ─────────────────────────────────────────────

function TrendBarChart({ trend }: { trend: AttendanceTrendPoint[] }) {
  const scale = Math.max(...trend.map((p) => p.total), 1);

  if (trend.every((p) => p.total === 0)) {
    return (
      <div className="daily-chart-empty">
        <CalendarCheck2 size={26} />
        <span>ยังไม่มีข้อมูลเช็กชื่อใน 7 วันที่ผ่านมา</span>
      </div>
    );
  }

  return (
    <div className="daily-bar-chart">
      <div className="daily-bar-yaxis" aria-hidden="true">
        <span>{scale}</span>
        <span>{Math.round(scale / 2)}</span>
        <span>0</span>
      </div>
      <div className="daily-bar-grid" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="daily-bar-columns">
        {trend.map((item) => {
          const heightPct = Math.max(4, (item.total / scale) * 100);
          return (
            <div
              className="daily-bar-col"
              key={item.date}
              title={`${formatTrendDate(item.date)}: ${item.total} รายการ`}
            >
              <span className="daily-bar-top-label">{item.total || ''}</span>
              <div className="daily-stacked-bar" style={{ height: `${heightPct}%` }}>
                {item.absent > 0 && <i className="is-absent" style={{ flex: item.absent }} />}
                {item.leave > 0 && <i className="is-leave" style={{ flex: item.leave }} />}
                {item.late > 0 && <i className="is-late" style={{ flex: item.late }} />}
                {item.present > 0 && <i className="is-present" style={{ flex: item.present }} />}
              </div>
              <span className="daily-bar-date">{formatDayLabel(item.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Subject Row ───────────────────────────────────────────────────────────

function SubjectRow({ item }: { item: SubjectAttendanceSummary }) {
  const pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
  const barClass = pct >= 80 ? 'is-good' : pct >= 60 ? 'is-warn' : 'is-bad';

  return (
    <li className="daily-subject-row">
      <div className="daily-subject-info">
        <span className="daily-subject-name">
          <BookOpen size={12} aria-hidden="true" />
          {item.periodLabel && <em>{item.periodLabel}</em>}
          {item.subjectName}
        </span>
        <span className="daily-subject-headcount">{item.present}/{item.total} คน</span>
      </div>
      <div className="daily-subject-bar-track" aria-hidden="true">
        <div
          className={`daily-subject-bar-fill ${barClass}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="daily-subject-chips">
        <span className="chip-present">✓ {item.present} มา</span>
        {item.late > 0 && <span className="chip-late">⏱ {item.late} สาย</span>}
        {item.absent > 0 && <span className="chip-absent">✗ {item.absent} ขาด</span>}
        <span className="daily-subject-pct">{pct}%</span>
      </div>
    </li>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function DailyStatsSummary({
  analyticsData,
  classroomName,
  selectedDate,
  subjectAttendanceSummaries,
}: DailyStatsSummaryProps) {
  const { attendance, attendanceTrend, behavior, dataCompleteness, savings, scores } = analyticsData;

  const totalStudents = dataCompleteness.studentsCount;
  const attendedToday = attendance.present + attendance.late;
  const absentToday = attendance.absent + attendance.leave;
  const attendancePct = totalStudents > 0 ? Math.round((attendedToday / totalStudents) * 100) : 0;
  const latePct = totalStudents > 0 ? Math.round((attendance.late / totalStudents) * 100) : 0;
  const absentPct = totalStudents > 0 ? Math.round((absentToday / totalStudents) * 100) : 0;

  const delta = calcDelta(attendanceTrend);
  const weekRate = calcAttendanceRate(attendanceTrend);

  const positiveBehaviorRate =
    behavior.totalRecords > 0
      ? Math.round(
          (Math.abs(behavior.positivePoints) /
            Math.max(Math.abs(behavior.positivePoints) + Math.abs(behavior.negativePoints), 1)) *
            100,
        )
      : 0;

  const savingsCoverage =
    totalStudents > 0 ? Math.round((savings.activeAccounts / totalStudents) * 100) : 0;

  const scorePct = scores.averagePercent;

  const goodTone: KpiTone = { icon: 'is-emerald', bar: 'is-emerald', badge: 'badge-emerald', text: 'text-emerald-700' };
  const warnTone: KpiTone = { icon: 'is-amber', bar: 'is-amber', badge: 'badge-amber', text: 'text-amber-700' };
  const badTone: KpiTone = { icon: 'is-rose', bar: 'is-rose', badge: 'badge-rose', text: 'text-rose-700' };
  const skyTone: KpiTone = { icon: 'is-sky', bar: 'is-sky', badge: 'badge-sky', text: 'text-sky-700' };
  const violetTone: KpiTone = { icon: 'is-violet', bar: 'is-violet', badge: 'badge-violet', text: 'text-violet-700' };

  const attendanceTone = (pct: number) => pct >= 80 ? goodTone : pct >= 60 ? warnTone : badTone;

  const kpiCards: KpiCardProps[] = [
    {
      icon: Users,
      label: 'มาเรียนวันนี้',
      value: totalStudents > 0 ? `${attendedToday}/${totalStudents}` : '—',
      sub: dataCompleteness.attendanceCheckedToday ? 'เช็กชื่อแล้ว ✓' : 'ยังไม่เช็กชื่อ',
      percent: attendancePct,
      tone: attendanceTone(attendancePct),
      delta,
    },
    {
      icon: Activity,
      label: 'มาสาย',
      value: String(attendance.late),
      sub: `จาก ${totalStudents} คน`,
      percent: latePct,
      tone: attendance.late === 0 ? goodTone : warnTone,
    },
    {
      icon: CalendarCheck2,
      label: 'ขาด / ลา',
      value: String(absentToday),
      sub: `${attendance.absent} ขาด · ${attendance.leave} ลา`,
      percent: absentPct,
      tone: absentToday === 0 ? goodTone : badTone,
    },
    {
      icon: Award,
      label: 'คะแนนเฉลี่ย',
      value: `${scorePct}%`,
      sub: `${scores.passedStudentsCount} คนผ่าน · ${scores.assessmentCount} ชุด`,
      percent: scorePct,
      tone: scorePct >= 70 ? skyTone : badTone,
    },
    {
      icon: Sparkles,
      label: 'พฤติกรรมบวก',
      value: `+${behavior.positivePoints} ⭐`,
      sub: `${behavior.totalRecords} บันทึก`,
      percent: positiveBehaviorRate,
      tone: violetTone,
    },
    {
      icon: Coins,
      label: 'เงินออมสะสม',
      value: `฿${savings.totalBalance.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`,
      sub: `${savings.activeAccounts} บัญชี active`,
      percent: savingsCoverage,
      tone: warnTone,
    },
  ];

  const donutSegments: DonutSegment[] = [
    { value: attendance.present, color: '#10b981', label: 'มาเรียน' },
    { value: attendance.late, color: '#f59e0b', label: 'มาสาย' },
    { value: attendance.leave, color: '#6366f1', label: 'ลา' },
    { value: attendance.absent, color: '#f43f5e', label: 'ขาด' },
  ];
  const donutTotal = attendance.present + attendance.late + attendance.leave + attendance.absent;

  const displayDate = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${selectedDate}T12:00:00+07:00`));

  return (
    <section className="daily-stats-panel" aria-label="สรุปสถิติประจำวัน">
      {/* ── Header ── */}
      <div className="daily-stats-header">
        <div>
          <div className="daily-stats-eyebrow">
            <span className="daily-stats-badge">📊 TODAY</span>
            <span className="daily-stats-date">{displayDate}</span>
          </div>
          <h2 className="daily-stats-title">สรุปสถิติรายวัน</h2>
          <p className="daily-stats-subtitle">
            ห้อง <strong>{classroomName || 'ที่เลือก'}</strong> — อ่านแล้วเข้าใจทันที
          </p>
        </div>
        <div className="daily-stats-header-right">
          {delta !== null && (
            <div className={`daily-trend-badge ${delta >= 0 ? 'is-up' : 'is-down'}`}>
              {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{delta >= 0 ? '+' : ''}{delta}% เทียบสัปดาห์ก่อน</span>
            </div>
          )}
          <Link className="daily-report-link" to="/app/dashboard?view=reports">
            ดูรายงานเชิงลึก <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="daily-kpi-grid">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="daily-charts-row">
        {/* 7-day Bar Chart */}
        <article className="daily-chart-card daily-chart-trend">
          <header className="daily-chart-card-header">
            <div className="daily-chart-card-title">
              <HeartHandshake size={16} aria-hidden="true" />
              <div>
                <h3>แนวโน้ม 7 วัน</h3>
                <p>อัตรามาเรียนสัปดาห์นี้ <strong>{weekRate}%</strong></p>
              </div>
            </div>
            <div className="daily-chart-legend">
              <span><i className="is-present" />มา</span>
              <span><i className="is-late" />สาย</span>
              <span><i className="is-leave" />ลา</span>
              <span><i className="is-absent" />ขาด</span>
            </div>
          </header>
          <TrendBarChart trend={attendanceTrend} />
        </article>

        {/* Today Donut */}
        <article className="daily-chart-card daily-chart-donut">
          <header className="daily-chart-card-header">
            <div className="daily-chart-card-title">
              <CalendarCheck2 size={16} aria-hidden="true" />
              <div>
                <h3>สัดส่วนวันนี้</h3>
                <p>{dataCompleteness.attendanceCheckedToday ? 'เช็กชื่อแล้ว ✓' : 'ยังไม่เช็กชื่อ'}</p>
              </div>
            </div>
          </header>
          {donutTotal > 0 ? (
            <DonutChart
              segments={donutSegments}
              total={donutTotal}
              centerLabel={`${attendancePct}%`}
              centerSub="มาเรียน"
            />
          ) : (
            <div className="daily-chart-empty">
              <CalendarCheck2 size={26} />
              <span>ยังไม่มีข้อมูลวันนี้</span>
              <small>เช็กชื่อเพื่อให้กราฟแสดงผล</small>
            </div>
          )}
        </article>
      </div>

      {/* ── Subject Attendance ── */}
      {subjectAttendanceSummaries.length > 0 && (
        <article className="daily-subject-section">
          <header className="daily-subject-header">
            <BookOpen size={15} aria-hidden="true" />
            <h3>เช็กชื่อแยกตามวิชา — วันนี้</h3>
            <span className="daily-subject-count-badge">{subjectAttendanceSummaries.length} วิชา</span>
          </header>
          <ul className="daily-subject-list">
            {subjectAttendanceSummaries.map((item) => (
              <SubjectRow key={item.id} item={item} />
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
