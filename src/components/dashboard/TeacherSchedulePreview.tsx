import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, PlayCircle, School } from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import {
  buildSchedulePeriods,
  getClassroomPillTone,
  getSubjectVisualTheme,
  makeScheduleCellKey,
  thaiDayHeaderStyles,
  thaiDayStyles,
  type ScheduleSettings,
} from '../../lib/scheduleSettings';

interface TeacherSchedulePreviewProps {
  currentDay: string;
  onClassroomChange: (value: string) => void;
  onDayChange: (value: string) => void;
  scheduleClassrooms: Array<{ count: number; name: string }>;
  scheduleClassFilter: string;
  selectedDay: string;
  settings: ScheduleSettings;
  totalPeriodCount: number;
}

const shortDayNames: Record<string, string> = {
  'จันทร์': 'จ.', 'อังคาร': 'อ.', 'พุธ': 'พ.', 'พฤหัสบดี': 'พฤ.', 'ศุกร์': 'ศ.', 'เสาร์': 'ส.', 'อาทิตย์': 'อา.',
};

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function getBangkokNowMinutes(): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());
  return parseMinutes(formatted);
}

export function TeacherSchedulePreview({
  currentDay,
  onClassroomChange,
  onDayChange,
  scheduleClassrooms,
  scheduleClassFilter,
  selectedDay,
  settings,
  totalPeriodCount,
}: TeacherSchedulePreviewProps) {
  const [nowMinutes, setNowMinutes] = useState<number>(() => getBangkokNowMinutes());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMinutes(getBangkokNowMinutes());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const periods = useMemo(() => buildSchedulePeriods(settings), [settings]);
  const lunchStartMinutes = useMemo(() => parseMinutes(settings.lunchStart || '11:40'), [settings.lunchStart]);

  const lessons = useMemo(() => {
    const items = periods.flatMap((period) => {
      const cell = settings.cells?.[makeScheduleCellKey(selectedDay, period.index)];
      if (!cell?.subject?.trim()) return [];
      if (scheduleClassFilter !== 'all' && cell.classroom !== scheduleClassFilter) return [];
      const startMinutes = parseMinutes(period.start);
      const endMinutes = parseMinutes(period.end);
      return [{
        ...period,
        classroom: cell.classroom,
        endMinutes,
        isAfternoon: startMinutes >= lunchStartMinutes,
        startMinutes,
        subject: cell.subject,
        subjectCode: cell.subjectCode,
      }];
    });

    const isViewingToday = selectedDay === currentDay;
    const nextPeriodIndex = isViewingToday
      ? items.find((item) => nowMinutes < item.startMinutes)?.index
      : undefined;

    return items.map((item) => {
      let timeStatus: 'now' | 'next' | 'past' | 'upcoming' = 'upcoming';
      if (isViewingToday) {
        if (nowMinutes >= item.startMinutes && nowMinutes < item.endMinutes) {
          timeStatus = 'now';
        } else if (nowMinutes >= item.endMinutes) {
          timeStatus = 'past';
        } else if (item.index === nextPeriodIndex) {
          timeStatus = 'next';
        }
      }
      return { ...item, timeStatus };
    });
  }, [currentDay, lunchStartMinutes, nowMinutes, periods, scheduleClassFilter, selectedDay, settings.cells]);

  const visibleDays = settings.activeDays?.length ? settings.activeDays : ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
  const dayStyle = thaiDayStyles[selectedDay] || thaiDayStyles['จันทร์'];
  const dayHeaderStyle = thaiDayHeaderStyles[selectedDay] || thaiDayHeaderStyles['จันทร์'];
  const activeLesson = lessons.find((item) => item.timeStatus === 'now');
  const nextLesson = lessons.find((item) => item.timeStatus === 'next');

  // If no periods exist anywhere in the schedule, keep a slim compact bar so it doesn't clutter the homepage.
  if (totalPeriodCount === 0) {
    return (
      <section aria-label="ตารางสอนวันนี้" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200/80 bg-white/90 px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-100 text-sky-700">
            <CalendarDays size={16} aria-hidden="true" />
          </span>
          <span>ยังไม่ได้ตั้งค่าตารางสอนประจำสัปดาห์</span>
        </div>
        <Link to="/app/dashboard?view=schedule" className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-1.5 text-xs font-black text-white transition hover:bg-sky-800">
          เพิ่มตารางสอน <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section aria-label="ตารางสอนวันนี้" className="relative mt-5 overflow-hidden rounded-[28px] border-2 border-sky-200/90 bg-white shadow-md shadow-sky-900/5">
      {/* Top Colored Day Accent Strip */}
      <div className={`h-1.5 w-full ${dayStyle.bar}`} aria-hidden="true" />

      <header className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-[#f7fbff] via-white to-[#f5fbf9] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-sm ${dayHeaderStyle.headerBg}`}>
            <CalendarDays size={21} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                ตารางสอนวัน{selectedDay}
              </h2>
              {selectedDay === currentDay && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-900 ring-1 ring-amber-300">
                  วันนี้
                </span>
              )}
              {activeLesson ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-xs">
                  <PlayCircle size={12} aria-hidden="true" /> กำลังสอนคาบ {activeLesson.index}: {activeLesson.subject}
                </span>
              ) : nextLesson ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-black text-sky-900 ring-1 ring-sky-200">
                  <Clock3 size={12} aria-hidden="true" /> ถัดไปคาบ {nextLesson.index} ({nextLesson.start})
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {lessons.length > 0
                ? `วันนี้มีสอน ${lessons.length} คาบ · แยกสีตามรายวิชาและระดับชั้น`
                : 'เลือกวันเพื่อดูคาบสอนหรือสลับห้องเรียน'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scheduleClassrooms.length > 1 ? (
            <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-2xs">
              <School size={14} className="text-sky-700" aria-hidden="true" />
              <span className="sr-only">กรองตามห้องเรียน</span>
              <select aria-label="กรองตารางสอนตามห้อง" value={scheduleClassFilter} onChange={(event) => onClassroomChange(event.target.value)} className="max-w-36 cursor-pointer bg-transparent font-bold text-slate-800 outline-none">
                <option value="all">ทุกห้อง</option>
                {scheduleClassrooms.map((room) => <option key={room.name} value={room.name}>{room.name}</option>)}
              </select>
            </label>
          ) : null}
          <Link to="/app/dashboard?view=schedule" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 text-xs font-black text-white transition hover:bg-slate-800 shadow-xs">
            ดูตารางเต็ม <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Day Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 sm:px-5">
        {visibleDays.map((day) => {
          const isSelected = selectedDay === day;
          const tabStyle = thaiDayStyles[day] || thaiDayStyles['จันทร์'];
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onDayChange(day)}
              className={`relative min-w-14 shrink-0 rounded-xl px-3.5 py-2 text-center text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isSelected
                  ? `${tabStyle.badge} border shadow-xs`
                  : 'bg-white text-slate-600 ring-1 ring-slate-200/70 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="sm:hidden">{shortDayNames[day] || day}</span>
              <span className="hidden sm:inline">{day}</span>
              {day === currentDay ? (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle ring-2 ring-white" title="วันนี้" />
              ) : null}
            </button>
          );
        })}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 text-[11px] font-bold text-slate-500">
          <Clock3 size={13} className="text-slate-400" /> {lessons.length} คาบ
        </span>
      </div>

      {lessons.length > 0 ? (
        <ol className="grid gap-3.5 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {lessons.map((lesson) => {
            const theme = getSubjectVisualTheme(lesson.subject);
            const roomTone = getClassroomPillTone(lesson.classroom);
            const isNow = lesson.timeStatus === 'now';
            const isNext = lesson.timeStatus === 'next';
            const isPast = lesson.timeStatus === 'past';

            return (
              <li
                key={`${selectedDay}-${lesson.index}`}
                className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.cardBg} ${
                  isNow
                    ? 'border-emerald-500 ring-4 ring-emerald-500/15 shadow-lg shadow-emerald-600/10'
                    : isNext
                    ? 'border-sky-400 ring-2 ring-sky-400/20 shadow-sm'
                    : `${theme.border} shadow-xs`
                } ${isPast ? 'opacity-75 saturate-75 hover:opacity-100' : ''}`}
              >
                {/* Distinct Subject Top Bar */}
                <div className={`h-1.5 w-full ${isNow ? 'bg-emerald-500' : theme.accentBar}`} aria-hidden="true" />

                {/* Period Number & Time Header */}
                <div className={`flex items-center justify-between gap-2 border-b px-3.5 py-2.5 ${theme.headerBg}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black shadow-2xs ${isNow ? 'bg-emerald-600 text-white' : theme.periodBadge}`}>
                      คาบที่ {lesson.index}
                    </span>
                    <span className="rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {lesson.isAfternoon ? 'บ่าย' : 'เช้า'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isNow && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
                        สอนอยู่
                      </span>
                    )}
                    {isNext && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-black text-white shadow-2xs">
                        ถัดไป
                      </span>
                    )}
                    {isPast && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-200/90 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        <CheckCircle2 size={10} /> จบแล้ว
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/95 px-2 py-1 text-xs font-black tabular-nums text-slate-800 ring-1 ring-slate-200/80">
                      <Clock3 size={12} className="text-slate-500" aria-hidden="true" /> {lesson.start}–{lesson.end}
                    </span>
                  </div>
                </div>

                {/* Subject Icon + Prominent Title */}
                <div className="p-3.5 sm:p-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl shadow-xs transition-transform duration-200 group-hover:scale-105 ${theme.iconBg}`}
                    >
                      {theme.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-bold text-slate-500">
                        {theme.subjectLabel}
                      </p>
                      <h3 className="mt-0.5 truncate text-base font-black leading-snug text-slate-950 sm:text-[17px]" title={lesson.subject}>
                        {lesson.subject}
                      </h3>
                    </div>
                  </div>

                  {/* Distinct Classroom Pill Footer */}
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-slate-200/90 pt-2.5">
                    <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-black ${roomTone}`}>
                      <School size={13} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">ชั้น {lesson.classroom || 'ไม่ระบุชั้น'}</span>
                    </span>
                    {lesson.subjectCode ? (
                      <span className="shrink-0 rounded-lg bg-white/80 px-2 py-0.5 text-[10.5px] font-bold text-slate-500 ring-1 ring-slate-200/70">
                        {lesson.subjectCode}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="px-5 py-6 text-center">
          <CalendarDays size={23} className="mx-auto text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-slate-600">
            ไม่มีคาบสอน{selectedDay === currentDay ? 'วันนี้' : `วัน${selectedDay}`}{scheduleClassFilter !== 'all' ? ` สำหรับห้อง ${scheduleClassFilter}` : ''}
          </p>
          <Link to="/app/dashboard?view=schedule" className="mt-2 inline-flex text-xs font-black text-sky-800 hover:underline">
            จัดการตารางสอน →
          </Link>
        </div>
      )}
    </section>
  );
}
