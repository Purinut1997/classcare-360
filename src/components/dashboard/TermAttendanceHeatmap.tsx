import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';

export interface TermHeatmapDayItem {
  date: string;
  present: number;
  absent: number;
  leave: number;
  late: number;
  total: number;
}

interface TermAttendanceHeatmapProps {
  days: TermHeatmapDayItem[];
  selectedDate: string;
  classroomName: string;
}

type HeatmapMetric = 'present' | 'absent' | 'leave' | 'late';

const METRIC_META: Record<
  HeatmapMetric,
  {
    label: string;
    dotColor: string;
    activeClass: string;
    levels: [string, string, string, string];
  }
> = {
  present: {
    label: 'มาเรียน',
    dotColor: 'bg-emerald-600',
    activeClass: 'bg-[#1c342b] text-white border-[#1c342b]',
    levels: ['bg-emerald-100', 'bg-emerald-300', 'bg-emerald-500', 'bg-emerald-700'],
  },
  absent: {
    label: 'ขาด',
    dotColor: 'bg-rose-500',
    activeClass: 'bg-rose-700 text-white border-rose-700',
    levels: ['bg-rose-100', 'bg-rose-300', 'bg-rose-500', 'bg-rose-700'],
  },
  leave: {
    label: 'ลา',
    dotColor: 'bg-sky-500',
    activeClass: 'bg-sky-700 text-white border-sky-700',
    levels: ['bg-sky-100', 'bg-sky-300', 'bg-sky-500', 'bg-sky-700'],
  },
  late: {
    label: 'สาย',
    dotColor: 'bg-amber-500',
    activeClass: 'bg-amber-600 text-white border-amber-600',
    levels: ['bg-amber-100', 'bg-amber-300', 'bg-amber-500', 'bg-amber-600'],
  },
};

const WEEKDAY_LABELS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'] as const;
const THAI_SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;
const TOTAL_WEEKS = 16;

function formatBangkokIso(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).format(new Date(ms));
}

function formatThaiDateLabel(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(`${dateStr}T12:00:00+07:00`));
  } catch {
    return dateStr;
  }
}

export function TermAttendanceHeatmap({ days, selectedDate, classroomName }: TermAttendanceHeatmapProps) {
  const [metric, setMetric] = useState<HeatmapMetric>('present');
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);

  const dayMap = useMemo(() => {
    const map = new Map<string, TermHeatmapDayItem>();
    days.forEach((d) => {
      if (d.date) map.set(d.date, d);
    });
    return map;
  }, [days]);

  // Build 16 Mon–Fri columns ending at the week containing selectedDate
  const { weeks, monthHeaders } = useMemo(() => {
    const anchorMs = new Date(`${selectedDate}T12:00:00+07:00`).getTime();
    const anchorDate = Number.isFinite(anchorMs) ? new Date(anchorMs) : new Date();
    const jsDay = anchorDate.getUTCDay(); // 0=Sun..6=Sat
    const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;
    const currentWeekMondayMs = anchorDate.getTime() - daysFromMonday * 86_400_000;
    const firstWeekMondayMs = currentWeekMondayMs - (TOTAL_WEEKS - 1) * 7 * 86_400_000;

    const weekCols: Array<{
      weekStart: string;
      cells: Array<{ date: string; weekdayIdx: number; isFuture: boolean; data: TermHeatmapDayItem | null }>;
    }> = [];

    const headers: Array<{ colIndex: number; label: string }> = [];
    let lastMonthKey = '';

    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const mondayMs = firstWeekMondayMs + w * 7 * 86_400_000;
      const mondayIso = formatBangkokIso(mondayMs);
      const monthKey = mondayIso.slice(0, 7);
      if (monthKey !== lastMonthKey) {
        const monthNum = Number(mondayIso.slice(5, 7));
        const label = THAI_SHORT_MONTHS[Math.max(0, Math.min(11, monthNum - 1))] || '';
        headers.push({ colIndex: w, label });
        lastMonthKey = monthKey;
      }

      const cells = Array.from({ length: 5 }, (_, dIdx) => {
        const cellDate = formatBangkokIso(mondayMs + dIdx * 86_400_000);
        return {
          date: cellDate,
          weekdayIdx: dIdx,
          isFuture: cellDate > selectedDate,
          data: dayMap.get(cellDate) || null,
        };
      });

      weekCols.push({ weekStart: mondayIso, cells });
    }

    return { weeks: weekCols, monthHeaders: headers };
  }, [dayMap, selectedDate]);

  const checkedDays = useMemo(() => days.filter((d) => d.total > 0), [days]);

  const summary = useMemo(() => {
    if (checkedDays.length === 0) {
      return { avgRate: 0, checkedCount: 0, lowestDate: null as string | null, lowestRate: 0 };
    }
    let sumRate = 0;
    let lowestRate = 101;
    let lowestDate: string | null = null;
    checkedDays.forEach((d) => {
      const rate = Math.round(((d.present + d.late) / Math.max(1, d.total)) * 1000) / 10;
      sumRate += rate;
      if (rate < lowestRate) {
        lowestRate = rate;
        lowestDate = d.date;
      }
    });
    return {
      avgRate: Math.round((sumRate / checkedDays.length) * 10) / 10,
      checkedCount: checkedDays.length,
      lowestDate,
      lowestRate: Math.round(lowestRate),
    };
  }, [checkedDays]);

  const inspectedItem = inspectedDate ? dayMap.get(inspectedDate) || null : null;

  const getCellBgClass = (item: TermHeatmapDayItem | null, isFuture: boolean): string => {
    if (isFuture) return 'bg-slate-50 border-transparent opacity-40';
    if (!item || item.total === 0) return 'bg-[#f1f3ef] border-[#e5e8e1]';

    const ratio =
      metric === 'present'
        ? (item.present + item.late) / Math.max(1, item.total)
        : metric === 'absent'
          ? item.absent / Math.max(1, item.total)
          : metric === 'leave'
            ? item.leave / Math.max(1, item.total)
            : item.late / Math.max(1, item.total);

    if (metric !== 'present' && ratio === 0) {
      return 'bg-[#f1f3ef] border-[#e5e8e1]';
    }

    const levels = METRIC_META[metric].levels;
    if (metric === 'present') {
      if (ratio >= 0.96) return `${levels[3]} border-emerald-800/15`;
      if (ratio >= 0.88) return `${levels[2]} border-emerald-600/15`;
      if (ratio >= 0.75) return `${levels[1]} border-emerald-400/20`;
      return `${levels[0]} border-emerald-200`;
    }
    if (ratio >= 0.25) return `${levels[3]} border-transparent`;
    if (ratio >= 0.14) return `${levels[2]} border-transparent`;
    if (ratio >= 0.06) return `${levels[1]} border-transparent`;
    return `${levels[0]} border-transparent`;
  };

  return (
    <article className="rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-[#1f2924]">
            <CalendarDays size={16} className="text-[#2f7d5b]" aria-hidden="true" />
            การมาเรียนทั้งเทอม ({classroomName})
          </h3>
          <p className="mt-0.5 text-xs font-medium text-[#75827a]">
            จันทร์–ศุกร์ (16 สัปดาห์ล่าสุด) · แต่ละช่องคือ 1 วัน สีเข้มขึ้น = สัดส่วนมากขึ้น
          </p>
        </div>

        <Link
          to="/app/dashboard?view=reports&reportView=attendance"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] hover:underline"
        >
          <span>สถิติการเข้าเรียน</span>
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>

      {/* Metric Filter Pills */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        {(Object.keys(METRIC_META) as HeatmapMetric[]).map((key) => {
          const cfg = METRIC_META[key];
          const isActive = metric === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
                isActive
                  ? cfg.activeClass
                  : 'border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f1f3ef]'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : cfg.dotColor}`}
                aria-hidden="true"
              />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Heatmap Matrix */}
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="min-w-[460px]">
          {/* Month Headers */}
          <div className="mb-1.5 flex items-center pl-7">
            <div
              className="grid flex-1 gap-1.5 text-[10px] font-bold text-[#8a968e]"
              style={{ gridTemplateColumns: `repeat(${TOTAL_WEEKS}, minmax(0, 1fr))` }}
            >
              {weeks.map((week, idx) => {
                const header = monthHeaders.find((m) => m.colIndex === idx);
                return (
                  <span key={week.weekStart} className="truncate">
                    {header ? header.label : ''}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 5 Rows (Mon-Fri) x 16 Weeks */}
          <div className="space-y-1.5">
            {WEEKDAY_LABELS.map((dayLabel, rowIdx) => (
              <div key={dayLabel} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-[11px] font-bold text-[#8a968e]">{dayLabel}</span>
                <div
                  className="grid flex-1 gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${TOTAL_WEEKS}, minmax(0, 1fr))` }}
                >
                  {weeks.map((week) => {
                    const cell = week.cells[rowIdx];
                    const item = cell.data;
                    const rate = item && item.total > 0
                      ? Math.round(((item.present + item.late) / item.total) * 100)
                      : null;
                    const tooltip = cell.isFuture
                      ? cell.date
                      : item && item.total > 0
                        ? `${formatThaiDateLabel(cell.date)}: มา ${item.present} · ขาด ${item.absent} · ลา ${item.leave} · สาย ${item.late} (${rate}%)`
                        : `${formatThaiDateLabel(cell.date)}: ยังไม่มีการเช็กชื่อ`;

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        disabled={cell.isFuture}
                        onClick={() => setInspectedDate(inspectedDate === cell.date ? null : cell.date)}
                        onMouseEnter={() => {
                          if (!cell.isFuture) setInspectedDate(cell.date);
                        }}
                        title={tooltip}
                        aria-label={tooltip}
                        className={`aspect-square w-full rounded-[5px] border transition ${getCellBgClass(
                          item,
                          cell.isFuture,
                        )} ${
                          inspectedDate === cell.date
                            ? 'ring-2 ring-[#1c342b] ring-offset-1'
                            : 'hover:brightness-95'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Day Inspector / Footer Legend */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0f2ee] pt-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#75827a]">
          <span>น้อย</span>
          {METRIC_META[metric].levels.map((cls) => (
            <span key={cls} className={`inline-block h-2.5 w-2.5 rounded-[3px] ${cls}`} aria-hidden="true" />
          ))}
          <span>มาก</span>
          <span className="mx-1 text-[#cbd2cc]">·</span>
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-[#e5e8e1] bg-[#f1f3ef]" aria-hidden="true" />
          <span>ยังไม่เช็กชื่อ</span>
        </div>

        <p className="font-semibold text-[#55615a]">
          {inspectedDate ? (
            inspectedItem && inspectedItem.total > 0 ? (
              <span>
                <strong>{formatThaiDateLabel(inspectedDate)}</strong> · มา {inspectedItem.present} · ขาด {inspectedItem.absent} · ลา {inspectedItem.leave} · สาย {inspectedItem.late}
              </span>
            ) : (
              <span>
                <strong>{formatThaiDateLabel(inspectedDate)}</strong> · ยังไม่ได้เช็กชื่อ
              </span>
            )
          ) : summary.checkedCount > 0 ? (
            <span>
              เฉลี่ย <strong>{summary.avgRate}%</strong> จาก {summary.checkedCount} วัน
              {summary.lowestDate ? ` · ต่ำสุด ${summary.lowestRate}% (${formatThaiDateLabel(summary.lowestDate)})` : ''}
            </span>
          ) : (
            <span>ยังไม่มีประวัติเช็กชื่อในช่วง 16 สัปดาห์ล่าสุด</span>
          )}
        </p>
      </div>
    </article>
  );
}
