import { useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  GraduationCap,
  HeartHandshake,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { ClassroomAnalyticsData, AttendanceTrendPoint } from './ClassroomAnalyticsCharts';

export interface SubjectAttendanceSummary {
  absent: number;
  id: string;
  late: number;
  periodLabel: string;
  present: number;
  subjectName: string;
  total: number;
}

export interface DailyStatsSummaryProps {
  analyticsData: ClassroomAnalyticsData;
  classroomName: string;
  selectedDate: string;
  subjectAttendanceSummaries: SubjectAttendanceSummary[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const shortDateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Asia/Bangkok',
  weekday: 'short',
});

function formatTrendDate(date: string) {
  return shortDateFormatter.format(new Date(`${date}T12:00:00+07:00`)).replace('.', '');
}

function formatDayOfWeek(date: string) {
  const full = shortDateFormatter.format(new Date(`${date}T12:00:00+07:00`)).replace('.', '');
  return full.split(' ')[0] ?? full;
}

function formatDayNumber(date: string) {
  const parts = date.split('-');
  return parts[2] ? parseInt(parts[2], 10) : '';
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

// ─── Component 1: Arc Speedometer / Radial Gauge ─────────────────────────────

interface ArcGaugeProps {
  percentage: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
  checkedToday: boolean;
}

function AttendanceArcSpeedometer({
  percentage,
  present,
  late,
  absent,
  leave,
  total,
  checkedToday,
}: ArcGaugeProps) {
  // Semi-circle arc: 180 degrees. Radius = 68. Arc length = PI * 68 ≈ 213.6
  const radius = 68;
  const arcLength = Math.PI * radius;
  const clampedPct = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = arcLength * (1 - clampedPct / 100);
  // Needle angle from -90deg (0%) to +90deg (100%)
  const needleAngle = -90 + (clampedPct / 100) * 180;

  const tone =
    clampedPct >= 90
      ? { label: 'ยอดเยี่ยม (Optimal)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500' }
      : clampedPct >= 75
      ? { label: 'ปกติ (Good)', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200 text-sky-800', dot: 'bg-sky-500' }
      : clampedPct >= 60
      ? { label: 'เฝ้าระวัง (Watch)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' }
      : { label: 'ต้องติดตาม (Action)', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200 text-rose-800', dot: 'bg-rose-500' };

  return (
    <article className="daily-speedo-card">
      <header className="daily-widget-header">
        <div className="daily-widget-title">
          <span className="daily-widget-icon is-emerald">
            <Zap size={15} aria-hidden="true" />
          </span>
          <div>
            <h3 className="daily-widget-h3">เกจวัดอัตราเข้าเรียนวันนี้</h3>
            <p className="daily-widget-sub">Speedometer Real-time Pulse</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border ${tone.bg}`}>
          <span className={`h-2 w-2 rounded-full ${tone.dot} animate-pulse`} />
          {checkedToday ? tone.label : 'ยังไม่เช็กชื่อ'}
        </span>
      </header>

      {/* SVG Arc Gauge */}
      <div className="daily-speedo-visual">
        <svg
          viewBox="0 0 180 110"
          className="daily-speedo-svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="speedoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <filter id="speedoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 18 92 A 68 68 0 0 1 162 92"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="13"
            strokeLinecap="round"
          />

          {/* Active Value Colored Arc */}
          {clampedPct > 0 && (
            <path
              d="M 18 92 A 68 68 0 0 1 162 92"
              fill="none"
              stroke="url(#speedoGrad)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={arcLength}
              strokeDashoffset={strokeDashoffset}
              filter="url(#speedoGlow)"
              className="transition-all duration-700 ease-out"
            />
          )}

          {/* Needle Pointer */}
          <g
            transform={`translate(90, 92) rotate(${needleAngle})`}
            className="transition-transform duration-700 ease-out"
          >
            <line x1="0" y1="0" x2="0" y2="-55" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="-4,-20 4,-20 0,-56" fill="#0f172a" />
            <circle cx="0" cy="0" r="7" fill="#0f172a" />
            <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
          </g>

          {/* Scale Labels */}
          <text x="16" y="105" fontSize="10" fontWeight="800" fill="#94a3b8" textAnchor="middle">0%</text>
          <text x="90" y="24" fontSize="9" fontWeight="800" fill="#94a3b8" textAnchor="middle">50%</text>
          <text x="164" y="105" fontSize="10" fontWeight="800" fill="#94a3b8" textAnchor="middle">100%</text>
        </svg>

        {/* Center Readout */}
        <div className="daily-speedo-readout">
          <div className="daily-speedo-main-value">
            <span className="text-3xl font-black tracking-tight text-slate-900">{clampedPct}%</span>
          </div>
          <span className="text-xs font-bold text-slate-500">
            มาเรียน {present + late} จากทั้งหมด {total} คน
          </span>
        </div>
      </div>

      {/* Pill Counters */}
      <div className="daily-speedo-pills">
        <span className="speedo-pill is-present">
          <CheckCircle2 size={12} /> มา <strong>{present}</strong>
        </span>
        <span className="speedo-pill is-late">
          <Clock size={12} /> สาย <strong>{late}</strong>
        </span>
        <span className="speedo-pill is-leave">
          <Calendar size={12} /> ลา <strong>{leave}</strong>
        </span>
        <span className="speedo-pill is-absent">
          <Users size={12} /> ขาด <strong>{absent}</strong>
        </span>
      </div>
    </article>
  );
}

// ─── Component 2: 7-Day Attendance Quality Heatmap Matrix ─────────────────────

interface HeatmapProps {
  trend: AttendanceTrendPoint[];
  onSelectDay: (item: AttendanceTrendPoint | null) => void;
  selectedDay: AttendanceTrendPoint | null;
}

function AttendanceQualityHeatmap({ trend, onSelectDay, selectedDay }: HeatmapProps) {
  // Sort or take last 7 points
  const points = trend.slice(-7);
  const weekAvg = calcAttendanceRate(points);

  // Compute Streak: consecutive days with >= 90% attendance
  let streak = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    const pt = points[i];
    if (!pt) break;
    const rate = pt.total > 0 ? (pt.present / pt.total) * 100 : 0;
    if (rate >= 85) streak++;
    else break;
  }

  const getHeatLevel = (pt: AttendanceTrendPoint) => {
    if (pt.total === 0) return { bg: 'bg-slate-100 text-slate-400 border-slate-200', tag: 'ไม่มีข้อมูล', icon: '⚪' };
    const pct = Math.round((pt.present / pt.total) * 100);
    if (pct >= 95) return { bg: 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-500/20', tag: 'ดีเยี่ยม', icon: '🔥' };
    if (pct >= 85) return { bg: 'bg-emerald-500 text-white border-emerald-600', tag: 'ดีมาก', icon: '✓' };
    if (pct >= 70) return { bg: 'bg-amber-400 text-slate-900 border-amber-500', tag: 'ปานกลาง', icon: '⏱' };
    return { bg: 'bg-rose-500 text-white border-rose-600', tag: 'ต่ำกว่าเกณฑ์', icon: '!' };
  };

  return (
    <article className="daily-heat-card">
      <header className="daily-widget-header">
        <div className="daily-widget-title">
          <span className="daily-widget-icon is-sky">
            <CalendarCheck2 size={15} aria-hidden="true" />
          </span>
          <div>
            <h3 className="daily-widget-h3">ฮีทแมพคุณภาพการมาเรียน 7 วัน</h3>
            <p className="daily-widget-sub">Weekly Quality Matrix & Streak</p>
          </div>
        </div>

        {streak > 1 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-50 border border-orange-200 text-orange-700 shadow-sm">
            <Flame size={13} className="text-orange-600 animate-bounce" />
            Streak {streak} วันติด!
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-50 border border-sky-200 text-sky-800">
            เฉลี่ยสัปดาห์นี้ {weekAvg}%
          </span>
        )}
      </header>

      {/* Heat Grid */}
      <div className="daily-heat-grid">
        {points.map((pt, idx) => {
          const rate = pt.total > 0 ? Math.round((pt.present / pt.total) * 100) : 0;
          const heat = getHeatLevel(pt);
          const isSelected = selectedDay?.date === pt.date;

          return (
            <button
              type="button"
              key={pt.date || idx}
              onClick={() => onSelectDay(isSelected ? null : pt)}
              className={`daily-heat-cell group relative flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all duration-200 ${
                isSelected ? 'ring-2 ring-sky-500 scale-105 shadow-md z-10' : 'hover:-translate-y-0.5 hover:shadow'
              } ${heat.bg}`}
              title={`${formatTrendDate(pt.date)}: มา ${pt.present}/${pt.total} คน (${rate}%)`}
            >
              <span className="text-[10px] font-black uppercase opacity-85">
                {formatDayOfWeek(pt.date)}
              </span>
              <span className="text-base font-black tracking-tight my-0.5">
                {formatDayNumber(pt.date)}
              </span>
              <span className="text-[11px] font-black opacity-95">
                {pt.total > 0 ? `${rate}%` : '—'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Interactive Day Inspector */}
      {selectedDay ? (
        <div className="daily-heat-inspector mt-3 p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-sky-700 shadow-xs text-xs font-black shrink-0">
              {formatDayOfWeek(selectedDay.date)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                สถิติวันที่ {formatTrendDate(selectedDay.date)}
              </p>
              <p className="text-[11px] font-bold text-slate-600">
                มา {selectedDay.present} · สาย {selectedDay.late} · ลา {selectedDay.leave} · ขาด {selectedDay.absent} (รวม {selectedDay.total} คน)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectDay(null)}
            className="text-xs font-black text-sky-700 hover:text-sky-900 shrink-0 px-2 py-1 rounded-lg bg-sky-100/70"
          >
            ปิด
          </button>
        </div>
      ) : (
        <div className="daily-heat-legend mt-3 flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1">
          <span>คลิกแต่ละวันเพื่อดูรายละเอียด</span>
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-600" /> &gt;95%</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" /> 70-85%</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" /> &lt;70%</span>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── Component 3: Behavior Diverging Balance Scale (+/-) ─────────────────────

interface BehaviorBalanceProps {
  positivePoints: number;
  negativePoints: number;
  totalRecords: number;
}

function BehaviorDivergingBalance({
  positivePoints,
  negativePoints,
  totalRecords,
}: BehaviorBalanceProps) {
  const absPos = Math.abs(positivePoints);
  const absNeg = Math.abs(negativePoints);
  const totalSum = Math.max(absPos + absNeg, 1);
  const posPct = Math.round((absPos / totalSum) * 100);
  const negPct = 100 - posPct;
  const netScore = positivePoints - negativePoints;

  return (
    <article className="daily-balance-card">
      <header className="daily-widget-header">
        <div className="daily-widget-title">
          <span className="daily-widget-icon is-purple">
            <HeartHandshake size={15} aria-hidden="true" />
          </span>
          <div>
            <h3 className="daily-widget-h3">สมดุลพฤติกรรม & ดาวความดี</h3>
            <p className="daily-widget-sub">Bi-Directional Merit Balance</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
          netScore >= 0
            ? 'bg-purple-50 border border-purple-200 text-purple-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {netScore >= 0 ? `Net +${netScore} ⭐` : `Net ${netScore}`}
        </span>
      </header>

      {/* Diverging Bar */}
      <div className="daily-balance-scale-wrap mt-3">
        <div className="flex items-center justify-between text-xs font-black mb-1.5">
          <span className="text-rose-600 flex items-center gap-1">
            <TrendingDown size={13} /> พฤติกรรมปรับปรุง (-{absNeg})
          </span>
          <span className="text-purple-700 flex items-center gap-1">
            ความดีสะสม (+{absPos}) <Sparkles size={13} />
          </span>
        </div>

        {/* The Track: 50% left is negative, 50% right is positive */}
        <div className="daily-balance-track" aria-hidden="true">
          {/* Negative Bar (flows right to center line) */}
          <div className="daily-balance-half is-left">
            <div
              className="daily-balance-fill-neg"
              style={{ width: `${Math.min(100, (absNeg / Math.max(totalSum, 1)) * 100)}%` }}
            />
          </div>
          {/* Neutral Center Pin */}
          <div className="daily-balance-center-pin" />
          {/* Positive Bar (flows center line to right) */}
          <div className="daily-balance-half is-right">
            <div
              className="daily-balance-fill-pos"
              style={{ width: `${Math.min(100, (absPos / Math.max(totalSum, 1)) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-slate-500">
          <span>{negPct}% เชิงลบ</span>
          <span className="font-extrabold text-slate-700">บันทึกทั้งหมด {totalRecords} ครั้ง</span>
          <span className="text-purple-700 font-extrabold">{posPct}% เชิงบวก</span>
        </div>
      </div>

      <div className="daily-balance-footer mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-600">
          {posPct >= 80 ? '🌟 ห้องเรียนมีสัดส่วนพฤติกรรมเชิงบวกสูงมาก' : 'ติดตามพฤติกรรมและส่งเสริมจุดเด่น'}
        </p>
        <Link
          to="/app/dashboard?view=behavior"
          className="text-xs font-black text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
        >
          + บันทึกความดี <ArrowRight size={12} />
        </Link>
      </div>
    </article>
  );
}

// ─── Component 4: Academic Score Spectrum & Pass/Fail Meter ───────────────────

interface AcademicSpectrumProps {
  assessmentCount: number;
  averagePercent: number;
  passedStudentsCount: number;
  totalStudents: number;
}

function AcademicScoreSpectrum({
  assessmentCount,
  averagePercent,
  passedStudentsCount,
  totalStudents,
}: AcademicSpectrumProps) {
  const passRate = totalStudents > 0 ? Math.round((passedStudentsCount / totalStudents) * 100) : 0;
  const failingCount = Math.max(0, totalStudents - passedStudentsCount);

  return (
    <article className="daily-academic-card">
      <header className="daily-widget-header">
        <div className="daily-widget-title">
          <span className="daily-widget-icon is-indigo">
            <GraduationCap size={15} aria-hidden="true" />
          </span>
          <div>
            <h3 className="daily-widget-h3">ผลสัมฤทธิ์ & การผ่านเกณฑ์</h3>
            <p className="daily-widget-sub">Academic Pass/Fail Spectrum</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 border border-indigo-200 text-indigo-800">
          เฉลี่ย {averagePercent}%
        </span>
      </header>

      {/* Progress & Pass Spectrum */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-black mb-1.5">
          <span className="text-emerald-700 flex items-center gap-1">
            ✓ ผ่านเกณฑ์ {passedStudentsCount} คน ({passRate}%)
          </span>
          <span className="text-amber-600 flex items-center gap-1">
            ซ่อมเสริม {failingCount} คน
          </span>
        </div>

        {/* Segmented Bar */}
        <div className="daily-segment-bar" aria-hidden="true">
          <div
            className="daily-segment-fill is-pass"
            style={{ width: `${Math.max(4, passRate)}%` }}
            title={`ผ่านเกณฑ์: ${passRate}%`}
          />
          <div
            className="daily-segment-fill is-fail"
            style={{ width: `${Math.max(0, 100 - passRate)}%` }}
            title={`ต้องดูแลเพิ่มเติม: ${100 - passRate}%`}
          />
        </div>

        {/* Marker Indicator */}
        <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-slate-500">
          <span>ประเมิน {assessmentCount} ครั้ง</span>
          <span className="text-slate-700 font-extrabold">เกณฑ์ผ่าน &ge; 60%</span>
          <Link
            to="/app/dashboard?view=scores"
            className="text-indigo-600 hover:text-indigo-800 font-black inline-flex items-center gap-1"
          >
            ลงคะแนน <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Component 5: Savings 10-Dot Meter ────────────────────────────────────────

interface SavingsMeterProps {
  activeAccounts: number;
  totalBalance: number;
  monthlyDeposits: number;
  totalStudents: number;
}

function SavingsDotMeter({
  activeAccounts,
  totalBalance,
  monthlyDeposits,
  totalStudents,
}: SavingsMeterProps) {
  const participationRate = totalStudents > 0 ? Math.round((activeAccounts / totalStudents) * 100) : 0;
  // 10 dots: each dot represents 10%
  const activeDots = Math.min(10, Math.round(participationRate / 10));

  return (
    <article className="daily-savings-card">
      <header className="daily-widget-header">
        <div className="daily-widget-title">
          <span className="daily-widget-icon is-amber">
            <Coins size={15} aria-hidden="true" />
          </span>
          <div>
            <h3 className="daily-widget-h3">เงินออม & การมีส่วนร่วม</h3>
            <p className="daily-widget-sub">Savings Participation Dots</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 border border-amber-200 text-amber-800">
          ฿{totalBalance.toLocaleString('th-TH')}
        </span>
      </header>

      {/* 10-Dot Meter */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-black mb-1.5">
          <span className="text-slate-700">การมีส่วนร่วมออมทรัพย์</span>
          <span className="text-amber-700 font-extrabold">{participationRate}% ({activeAccounts}/{totalStudents} คน)</span>
        </div>

        <div className="daily-dot-track" aria-label={`มีส่วนร่วม ${participationRate}%`}>
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`daily-dot ${i < activeDots ? 'is-active' : 'is-inactive'}`}
              title={`เกณฑ์ ${ (i + 1) * 10 }%`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-2 text-[11px] font-bold text-slate-500">
          <span>ฝากเดือนนี้ +฿{monthlyDeposits.toLocaleString('th-TH')}</span>
          <Link
            to="/app/dashboard?view=savings"
            className="text-amber-700 hover:text-amber-900 font-black inline-flex items-center gap-1"
          >
            ฝาก-ถอน <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Component 6: Subject Attendance Row ─────────────────────────────────────

function SubjectRow({ item }: { item: SubjectAttendanceSummary }) {
  const pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
  const barClass = pct >= 80 ? 'is-good' : pct >= 60 ? 'is-warn' : 'is-bad';

  return (
    <li className="daily-subject-row">
      <div className="daily-subject-info">
        <span className="daily-subject-name">
          <BookOpen size={13} className="text-sky-600 shrink-0" aria-hidden="true" />
          {item.periodLabel && <em className="daily-period-tag">{item.periodLabel}</em>}
          <span className="font-extrabold text-slate-800">{item.subjectName}</span>
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

// ─── Main Component: DailyStatsSummary ────────────────────────────────────────

export function DailyStatsSummary({
  analyticsData,
  classroomName,
  selectedDate,
  subjectAttendanceSummaries,
}: DailyStatsSummaryProps) {
  const { attendance, attendanceTrend, behavior, dataCompleteness, savings, scores } = analyticsData;

  const [activeTab, setActiveTab] = useState<'vitals' | 'subjects'>('vitals');
  const [selectedDay, setSelectedDay] = useState<AttendanceTrendPoint | null>(null);

  const totalStudents = dataCompleteness.studentsCount;
  const attendedToday = attendance.present + attendance.late;
  const absentToday = attendance.absent + attendance.leave;
  const attendancePct = totalStudents > 0 ? Math.round((attendedToday / totalStudents) * 100) : 0;

  const delta = calcDelta(attendanceTrend);

  const displayDate = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${selectedDate}T12:00:00+07:00`));

  return (
    <section className="daily-stats-panel" aria-label="สรุปสถิติประจำวัน">
      {/* ── Top Header & Tab Controls ── */}
      <div className="daily-stats-header">
        <div>
          <div className="daily-stats-eyebrow">
            <span className="daily-stats-badge">
              <Zap size={11} className="text-amber-500 animate-pulse" /> DAILY INTELLIGENCE
            </span>
            <span className="daily-stats-date">{displayDate}</span>
          </div>
          <h2 className="daily-stats-title">สรุปข้อมูลสถิติรายวัน</h2>
          <p className="daily-stats-subtitle">
            ห้อง <strong>{classroomName || 'ที่เลือก'}</strong> — สรุปกระชับ พร้อมเกจวัดและลูกเล่นวิเคราะห์แบบเรียลไทม์
          </p>
        </div>

        <div className="daily-stats-header-right">
          {/* View Tab Switcher */}
          <div className="daily-tab-group" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'vitals'}
              onClick={() => setActiveTab('vitals')}
              className={`daily-tab-btn ${activeTab === 'vitals' ? 'is-active' : ''}`}
            >
              <Zap size={13} /> ดัชนีชี้วัดรายวัน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'subjects'}
              onClick={() => setActiveTab('subjects')}
              className={`daily-tab-btn ${activeTab === 'subjects' ? 'is-active' : ''}`}
            >
              <BookOpen size={13} /> เจาะลึกรายวิชา
              {subjectAttendanceSummaries.length > 0 && (
                <span className="daily-tab-count">{subjectAttendanceSummaries.length}</span>
              )}
            </button>
          </div>

          {delta !== null && (
            <div className={`daily-trend-badge ${delta >= 0 ? 'is-up' : 'is-down'}`}>
              {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{delta >= 0 ? '+' : ''}{delta}% เทียบสัปดาห์ก่อน</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'vitals' ? (
        <div className="daily-vitals-body">
          {/* Row 1: Speedometer Gauge + 7-Day Heatmap Matrix */}
          <div className="daily-widgets-row">
            <AttendanceArcSpeedometer
              percentage={attendancePct}
              present={attendance.present}
              late={attendance.late}
              absent={attendance.absent}
              leave={attendance.leave}
              total={totalStudents}
              checkedToday={dataCompleteness.attendanceCheckedToday}
            />
            <AttendanceQualityHeatmap
              trend={attendanceTrend}
              onSelectDay={setSelectedDay}
              selectedDay={selectedDay}
            />
          </div>

          {/* Row 2: Diverging Behavior Balance + Academic Spectrum + Savings Dot Meter */}
          <div className="daily-subwidgets-row">
            <BehaviorDivergingBalance
              positivePoints={behavior.positivePoints}
              negativePoints={behavior.negativePoints}
              totalRecords={behavior.totalRecords}
            />
            <AcademicScoreSpectrum
              assessmentCount={scores.assessmentCount}
              averagePercent={scores.averagePercent}
              passedStudentsCount={scores.passedStudentsCount}
              totalStudents={totalStudents}
            />
            <SavingsDotMeter
              activeAccounts={savings.activeAccounts}
              totalBalance={savings.totalBalance}
              monthlyDeposits={savings.monthlyDeposits}
              totalStudents={totalStudents}
            />
          </div>
        </div>
      ) : (
        /* Tab 2: Subject Attendance Breakdown */
        <div className="daily-subjects-tab-body">
          {subjectAttendanceSummaries.length > 0 ? (
            <article className="daily-subject-section">
              <header className="daily-subject-header">
                <BookOpen size={15} className="text-sky-700" aria-hidden="true" />
                <h3>สถิติการเข้าเรียนแยกตามคาบวิชา — ประจำวัน</h3>
                <span className="daily-subject-count-badge">{subjectAttendanceSummaries.length} คาบวิชา</span>
              </header>
              <ul className="daily-subject-list">
                {subjectAttendanceSummaries.map((item) => (
                  <SubjectRow key={item.id} item={item} />
                ))}
              </ul>
            </article>
          ) : (
            <div className="daily-tab-empty">
              <BookOpen size={32} className="text-slate-300" />
              <p className="font-black text-slate-700 text-sm">ยังไม่มีข้อมูลเช็กชื่อรายวิชาในวันนี้</p>
              <p className="text-xs text-slate-500 font-semibold">เมื่อครูผู้สอนบันทึกเวลาเรียนรายคาบ ข้อมูลจะปรากฏที่นี่ทันที</p>
              <Link to="/app/dashboard?view=attendance" className="daily-empty-action-btn">
                ไปที่หน้าเช็กชื่อ <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
