import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { getBangkokDate } from '../../lib/date';

export type MiniCalendarEventType = 'holiday' | 'exam' | 'activity' | 'makeup' | 'custom';

export interface MiniCalendarEvent {
  date: string;
  durationDays?: number;
  endDate?: string;
  id: string;
  title: string;
  type: MiniCalendarEventType;
}

interface DashboardMiniCalendarProps {
  events: MiniCalendarEvent[];
  initialSelectedDate?: string;
  onSelectDate?: (date: string) => void;
}

const thaiMonthNames = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const shortThaiMonthNames = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const weekDayHeaders = [
  { label: 'อา.', color: 'text-rose-600' },
  { label: 'จ.', color: 'text-slate-700' },
  { label: 'อ.', color: 'text-slate-700' },
  { label: 'พ.', color: 'text-slate-700' },
  { label: 'พฤ.', color: 'text-slate-700' },
  { label: 'ศ.', color: 'text-slate-700' },
  { label: 'ส.', color: 'text-purple-600' },
];

const eventTypeMeta: Record<
  MiniCalendarEventType,
  {
    badge: string;
    bgRibbon: string;
    dot: string;
    icon: string;
    label: string;
  }
> = {
  activity: {
    label: 'กิจกรรม',
    icon: '🎪',
    dot: 'bg-purple-600',
    bgRibbon: 'bg-purple-600 text-white',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  holiday: {
    label: 'หยุดเรียน',
    icon: '🏖️',
    dot: 'bg-rose-500',
    bgRibbon: 'bg-rose-500 text-white',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  exam: {
    label: 'วันสอบ',
    icon: '📝',
    dot: 'bg-indigo-600',
    bgRibbon: 'bg-indigo-600 text-white',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-200',
  },
  makeup: {
    label: 'เรียนชดเชย',
    icon: '⏰',
    dot: 'bg-amber-500',
    bgRibbon: 'bg-amber-500 text-white',
    badge: 'bg-amber-100 text-amber-950 border-amber-200',
  },
  custom: {
    label: 'กำหนดเอง',
    icon: '📌',
    dot: 'bg-teal-600',
    bgRibbon: 'bg-teal-600 text-white',
    badge: 'bg-teal-100 text-teal-900 border-teal-200',
  },
};

function formatThaiDateLong(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = thaiMonthNames[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

function formatThaiDateShort(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = shortThaiMonthNames[d.getMonth()];
  return `${day} ${month}`;
}

export function DashboardMiniCalendar({
  events,
  initialSelectedDate,
  onSelectDate,
}: DashboardMiniCalendarProps) {
  const todayStr = useMemo(() => getBangkokDate(), []);

  // Determine starting view month: prefer the month of the first upcoming event or today
  const defaultMonthDate = useMemo(() => {
    if (initialSelectedDate) {
      const d = new Date(`${initialSelectedDate}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const t = new Date(`${todayStr}T00:00:00`);
    return new Date(t.getFullYear(), t.getMonth(), 1);
  }, [initialSelectedDate, todayStr]);

  const [viewDate, setViewDate] = useState<Date>(defaultMonthDate);
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate || todayStr);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Normalize multi-day event spans across the calendar
  const normalizedSpans = useMemo(() => {
    return events.map((ev) => {
      const start = ev.date;
      const end = ev.endDate || ev.date;
      const duration = ev.durationDays || 1;
      return {
        ...ev,
        startDate: start,
        endDate: end,
        durationDays: duration,
        isMultiDay: start !== end && duration > 1,
      };
    });
  }, [events]);

  // Navigate months
  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    const t = new Date(`${todayStr}T00:00:00`);
    setViewDate(new Date(t.getFullYear(), t.getMonth(), 1));
    setSelectedDate(todayStr);
    onSelectDate?.(todayStr);
  };

  // Build calendar matrix (6 weeks of 7 days)
  const calendarWeeks = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon, ...
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const weeks: Array<
      Array<{
        dateStr: string;
        dayNum: number;
        isCurrentMonth: boolean;
        isToday: boolean;
      }>
    > = [];

    let currentDayOfWeek = 0;
    let currentWeek: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const mStr = String(prevMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateStr = `${prevYear}-${mStr}-${dStr}`;

      currentWeek.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
      currentDayOfWeek++;
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${viewYear}-${mStr}-${dStr}`;

      currentWeek.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
      currentDayOfWeek++;

      if (currentDayOfWeek === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
        currentDayOfWeek = 0;
      }
    }

    // Days in next month to fill trailing cells
    if (currentDayOfWeek > 0) {
      let nextDay = 1;
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;

      while (currentDayOfWeek < 7) {
        const mStr = String(nextMonth + 1).padStart(2, '0');
        const dStr = String(nextDay).padStart(2, '0');
        const dateStr = `${nextYear}-${mStr}-${dStr}`;

        currentWeek.push({
          dateStr,
          dayNum: nextDay,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        });
        nextDay++;
        currentDayOfWeek++;
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [viewYear, viewMonth, todayStr]);

  // Events occurring on the selected date
  const selectedDateEvents = useMemo(() => {
    return normalizedSpans.filter((span) => {
      return selectedDate >= span.startDate && selectedDate <= span.endDate;
    });
  }, [normalizedSpans, selectedDate]);

  return (
    <div className="flex flex-col select-none">
      {/* Month Navigation & Controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-black text-slate-900">
            {thaiMonthNames[viewMonth]} {viewYear + 543}
          </span>
          {viewYear === new Date(`${todayStr}T00:00:00`).getFullYear() &&
            viewMonth === new Date(`${todayStr}T00:00:00`).getMonth() && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">
                เดือนนี้
              </span>
            )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGoToday}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            title="ไปที่วันนี้"
          >
            วันนี้
          </button>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded-md p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
              aria-label="เดือนก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded-md p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
              aria-label="เดือนถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 pt-2 text-center text-xs font-black">
        {weekDayHeaders.map((hdr) => (
          <div key={hdr.label} className={`py-1.5 ${hdr.color}`}>
            {hdr.label}
          </div>
        ))}
      </div>

      {/* Calendar Grid with Continuous Ribbon Spanning */}
      <div className="flex flex-col gap-1 py-1">
        {calendarWeeks.map((week, weekIdx) => {
          return (
            <div key={`week-${weekIdx}`} className="grid grid-cols-7 gap-y-0.5">
              {week.map((cell, colIdx) => {
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.isToday;

                // Find active multi-day span or single-day events covering this date
                const activeSpans = normalizedSpans.filter(
                  (s) => cell.dateStr >= s.startDate && cell.dateStr <= s.endDate
                );
                const multiSpan = activeSpans.find((s) => s.isMultiDay);
                const singleEvents = activeSpans.filter((s) => !s.isMultiDay);

                // Multi-day ribbon geometry for this week row
                let isSpanStart = false;
                let isSpanEnd = false;
                let isSpanMiddle = false;

                if (multiSpan) {
                  const isFirstDateOfSpan = cell.dateStr === multiSpan.startDate;
                  const isLastDateOfSpan = cell.dateStr === multiSpan.endDate;
                  const isWeekStart = colIdx === 0;
                  const isWeekEnd = colIdx === 6;

                  isSpanStart = isFirstDateOfSpan || (isWeekStart && cell.dateStr > multiSpan.startDate);
                  isSpanEnd = isLastDateOfSpan || (isWeekEnd && cell.dateStr < multiSpan.endDate);
                  isSpanMiddle = !isSpanStart && !isSpanEnd;
                }

                const multiMeta = multiSpan ? eventTypeMeta[multiSpan.type] || eventTypeMeta.custom : null;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      onSelectDate?.(cell.dateStr);
                    }}
                    className={`group relative flex h-11 sm:h-12 flex-col items-center justify-start rounded-xl p-0.5 sm:p-1 transition-all ${
                      isSelected
                        ? 'bg-sky-50 ring-2 ring-sky-500 shadow-xs z-10'
                        : isToday
                        ? 'bg-amber-50/70 ring-1 ring-amber-300'
                        : cell.isCurrentMonth
                        ? 'hover:bg-slate-100/80'
                        : 'opacity-40 hover:opacity-75'
                    }`}
                  >
                    {/* Day Number */}
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full text-xs transition-colors ${
                        isSelected
                          ? 'bg-sky-600 font-black text-white shadow-xs'
                          : isToday
                          ? 'bg-amber-500 font-black text-white shadow-xs'
                          : cell.isCurrentMonth
                          ? 'font-bold text-slate-800'
                          : 'font-medium text-slate-400'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {/* Multi-day continuous ribbon (Image 2 style) */}
                    {multiSpan && multiMeta ? (
                      <div
                        className={`mt-0.5 flex h-2 w-full items-center justify-center text-[8px] font-black tracking-tight ${
                          multiMeta.dot
                        } ${
                          isSpanStart && !isSpanEnd
                            ? 'rounded-l-full -mr-1'
                            : isSpanEnd && !isSpanStart
                            ? 'rounded-r-full -ml-1'
                            : isSpanStart && isSpanEnd
                            ? 'rounded-full'
                            : 'rounded-none -mx-1'
                        } shadow-2xs`}
                        title={`${multiSpan.title} (${multiSpan.durationDays} วัน)`}
                      />
                    ) : null}

                    {/* Single-day dots */}
                    {singleEvents.length > 0 ? (
                      <div className="mt-0.5 flex items-center justify-center gap-0.5">
                        {singleEvents.slice(0, 3).map((sev) => {
                          const meta = eventTypeMeta[sev.type] || eventTypeMeta.custom;
                          return (
                            <span
                              key={sev.id}
                              className={`h-1.5 w-1.5 rounded-full ${meta.dot} shadow-2xs`}
                              title={sev.title}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Selected Date Event Preview Box */}
      <div className="mt-3 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-sky-600" />
            <span className="text-xs font-black text-slate-900">
              {formatThaiDateLong(selectedDate)}
            </span>
            {selectedDate === todayStr && (
              <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[9.5px] font-black text-amber-800">
                วันนี้
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {selectedDateEvents.length > 0 ? `${selectedDateEvents.length} รายการ` : 'ไม่มีกิจกรรม'}
          </span>
        </div>

        {selectedDateEvents.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {selectedDateEvents.map((ev) => {
              const meta = eventTypeMeta[ev.type] || eventTypeMeta.custom;
              const isMulti = ev.isMultiDay;
              const evDate = new Date(`${ev.date}T00:00:00`);
              const daysFromNow = Math.round((evDate.getTime() - Date.now()) / 86_400_000);
              const daysLabel =
                daysFromNow <= 0
                  ? 'วันนี้'
                  : daysFromNow === 1
                  ? 'พรุ่งนี้'
                  : `อีก ${daysFromNow} วัน`;

              return (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white px-2.5 py-1.5 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate text-xs font-black text-slate-900">
                          {ev.title}
                        </span>
                        {isMulti && (
                          <span className="shrink-0 rounded-md bg-purple-100 px-1.5 py-0.2 text-[10px] font-black text-purple-800">
                            {ev.durationDays} วัน ({formatThaiDateShort(ev.startDate)} -{' '}
                            {formatThaiDateShort(ev.endDate)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    <span
                      className={`text-[10.5px] font-black ${
                        daysFromNow <= 0
                          ? 'text-rose-600'
                          : daysFromNow <= 3
                          ? 'text-amber-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {daysLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between py-1 text-slate-400 text-xs">
            <span className="font-bold">ไม่มีกิจกรรมหรือวันหยุดในวันนี้</span>
            <Link
              to="/app/dashboard?view=school-calendar"
              className="inline-flex items-center gap-1 text-[11px] font-black text-sky-700 hover:text-sky-900"
            >
              + เพิ่มในปฏิทิน
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
