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

function getCleanSubjectCode(subject: string, subjectCode?: string): string {
  const cleanCode = (subjectCode || '').trim();
  const cleanSubject = subject.trim();
  if (!cleanCode) return '';
  if (cleanCode.toLowerCase() === cleanSubject.toLowerCase()) return '';
  if (/^(ซ่อมเสริม|ทบทวน|ติว)$/.test(cleanCode)) return '';
  return cleanCode;
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
  const visibleDays = useMemo(
    () => (settings.activeDays?.length ? settings.activeDays : ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']),
    [settings.activeDays],
  );

  // Auto-detect whether this teacher teaches the same subject across multiple grades/rooms
  // (e.g. Math for ป.4 and ป.5) vs multiple subjects in one homeroom.
  const colorByMode = useMemo<'classroom' | 'subject'>(() => {
    if (scheduleClassFilter !== 'all' || scheduleClassrooms.length <= 1) return 'subject';
    const subjectRooms = new Map<string, Set<string>>();
    for (const day of visibleDays) {
      for (const period of periods) {
        const cell = settings.cells?.[makeScheduleCellKey(day, period.index)];
        const subj = cell?.subject?.trim();
        const room = cell?.classroom?.trim();
        if (!subj || !room) continue;
        if (/ชุมนุม|ชมรม|กิจกรรม|ลูกเสือ|แนะแนว|โฮมรูม/.test(subj)) continue;
        if (!subjectRooms.has(subj)) subjectRooms.set(subj, new Set());
        subjectRooms.get(subj)?.add(room);
      }
    }
    for (const rooms of subjectRooms.values()) {
      if (rooms.size > 1) return 'classroom';
    }
    return 'subject';
  }, [periods, scheduleClassFilter, scheduleClassrooms.length, settings.cells, visibleDays]);

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

  const morningLessons = useMemo(() => lessons.filter((item) => !item.isAfternoon), [lessons]);
  const afternoonLessons = useMemo(() => lessons.filter((item) => item.isAfternoon), [lessons]);

  // Unique color legend items derived from today's periods
  const legendItems = useMemo(() => {
    const map = new Map<string, { badgeClass: string; label: string }>();
    for (const lesson of lessons) {
      const theme = getSubjectVisualTheme(lesson.subject, lesson.classroom, lesson.subjectCode, colorByMode);
      const isSpecial = /ซ่อมเสริม|กิจกรรม|ลูกเสือ|แนะแนว|โฮมรูม/.test(theme.subjectLabel);
      const shortLabel = isSpecial
        ? theme.subjectLabel
        : colorByMode === 'classroom' && lesson.classroom
        ? lesson.classroom
        : theme.subjectLabel;
      if (!map.has(shortLabel)) {
        map.set(shortLabel, {
          badgeClass: `${theme.cardBg} ${theme.border.split(' ')[0]} text-stone-800`,
          label: shortLabel,
        });
      }
    }
    return Array.from(map.values()).slice(0, 5);
  }, [colorByMode, lessons]);

  const dayStyle = thaiDayStyles[selectedDay] || thaiDayStyles['จันทร์'];
  const dayHeaderStyle = thaiDayHeaderStyles[selectedDay] || thaiDayHeaderStyles['จันทร์'];
  const activeLesson = lessons.find((item) => item.timeStatus === 'now');
  const nextLesson = lessons.find((item) => item.timeStatus === 'next');

  // If no periods exist anywhere in the schedule, keep a slim compact stationery bar.
  if (totalPeriodCount === 0) {
    return (
      <section aria-label="ตารางสอนวันนี้" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border-2 border-[#e2d4be] bg-[#fbf6ec] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5 text-xs font-extrabold text-stone-700">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-300 bg-amber-100 text-amber-800">
            <CalendarDays size={17} aria-hidden="true" />
          </span>
          <span>ยังไม่ได้ตั้งค่าตารางสอนประจำสัปดาห์</span>
        </div>
        <Link to="/app/dashboard?view=schedule" className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-black text-white transition hover:bg-stone-800">
          เพิ่มตารางสอน <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const renderLessonCard = (lesson: (typeof lessons)[number]) => {
    const theme = getSubjectVisualTheme(lesson.subject, lesson.classroom, lesson.subjectCode, colorByMode);
    const roomTone = getClassroomPillTone(lesson.classroom);
    const cleanCode = getCleanSubjectCode(lesson.subject, lesson.subjectCode);
    const isNow = lesson.timeStatus === 'now';
    const isNext = lesson.timeStatus === 'next';
    const isPast = lesson.timeStatus === 'past';

    return (
      <li
        key={`${selectedDay}-${lesson.index}`}
        className={`group relative mt-1.5 flex flex-col justify-between rounded-[24px] border-2 p-4 pt-5 shadow-[0_4px_0_rgba(120,90,45,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
          isNow
            ? 'border-emerald-500 bg-emerald-50/85 ring-4 ring-emerald-500/15'
            : isNext
            ? `${theme.cardBg} border-sky-400 ring-2 ring-sky-400/20`
            : `${theme.cardBg} ${theme.border}`
        } ${isPast ? 'opacity-75 saturate-75 hover:opacity-100' : ''}`}
      >
        {/* Cute Washi Tape Sticker */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-2 left-1/2 h-3.5 w-14 -translate-x-1/2 -rotate-2 rounded-sm border border-white/80 shadow-sm ${
            isNow ? 'washi-mint' : theme.washiClass
          }`}
        />

        <div>
          {/* Period & Time Header */}
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black shadow-sm ${isNow ? 'bg-emerald-600 text-white' : theme.periodBadge}`}>
              คาบที่ {lesson.index}
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl border border-stone-200/90 bg-white/95 px-2.5 py-1 text-xs font-black tabular-nums text-stone-800">
              <Clock3 size={12} className="text-stone-500" aria-hidden="true" />
              {lesson.start}–{lesson.end}
            </span>
          </div>

          {/* Live / Next / Completed Chip */}
          {(isNow || isNext || isPast) && (
            <div className="mt-2">
              {isNow && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
                  <PlayCircle size={12} aria-hidden="true" /> กำลังสอนตอนนี้
                </span>
              )}
              {isNext && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
                  <Clock3 size={12} aria-hidden="true" /> คาบถัดไป
                </span>
              )}
              {isPast && (
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-200/90 px-2.5 py-0.5 text-xs font-bold text-stone-700">
                  <CheckCircle2 size={12} aria-hidden="true" /> จบคาบแล้ว
                </span>
              )}
            </div>
          )}

          {/* Subject Icon & Title */}
          <div className="mt-3 flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${theme.iconBg}`}
            >
              {theme.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-stone-600">
                {theme.subjectLabel}
              </p>
              <h3 className="mt-0.5 truncate text-base font-black leading-snug text-slate-950 sm:text-[17px]" title={lesson.subject}>
                {lesson.subject}
              </h3>
            </div>
          </div>
        </div>

        {/* Distinct Classroom Footer */}
        <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-dashed border-stone-300/80 pt-2.5">
          <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-black shadow-sm ${roomTone}`}>
            <School size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">ชั้น {lesson.classroom || 'ไม่ระบุชั้น'}</span>
          </span>
          {cleanCode ? (
            <span className="shrink-0 rounded-lg border border-stone-200 bg-white/95 px-2.5 py-0.5 text-xs font-bold text-stone-600">
              {cleanCode}
            </span>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section
      aria-label="ตารางสอนวันนี้"
      className="notebook-paper-lines relative mt-4 overflow-hidden rounded-[30px] border-2 border-[#e2d4be] bg-[#fbf6ec] p-4 shadow-md sm:mt-5 sm:p-6"
    >
      {/* Subtle Top Color Strip */}
      <div className={`absolute inset-x-0 top-0 h-1.5 ${dayStyle.bar}`} aria-hidden="true" />

      <header className="flex flex-col gap-3 border-b-2 border-dashed border-[#dfd0b8] pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-white/80 shadow-sm ${dayHeaderStyle.headerBg}`}>
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-stone-950 sm:text-xl">
                ตารางสอนวัน{selectedDay}
              </h2>
              {selectedDay === currentDay && (
                <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-900">
                  วันนี้ 📌
                </span>
              )}
              {activeLesson ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-black text-white shadow-sm">
                  <PlayCircle size={12} aria-hidden="true" /> กำลังสอนคาบ {activeLesson.index}: {activeLesson.subject}
                </span>
              ) : nextLesson ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 px-2.5 py-0.5 text-xs font-black text-sky-900">
                  <Clock3 size={12} aria-hidden="true" /> ถัดไปคาบ {nextLesson.index} ({nextLesson.start})
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs font-bold text-stone-600">
              {lessons.length > 0
                ? `มีสอน ${lessons.length} คาบ · ${colorByMode === 'classroom' ? 'แยกสีการ์ดตามระดับชั้นและคาบพิเศษ' : 'แยกสีการ์ดตามรายวิชาและคาบพิเศษ'}`
                : 'เลือกวันเพื่อดูคาบสอนหรือสลับห้องเรียน'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scheduleClassrooms.length > 1 ? (
            <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#d9cab3] bg-white px-3 text-xs font-bold text-stone-700 shadow-sm">
              <School size={14} className="text-sky-700" aria-hidden="true" />
              <span className="sr-only">กรองตามห้องเรียน</span>
              <select aria-label="กรองตารางสอนตามห้อง" value={scheduleClassFilter} onChange={(event) => onClassroomChange(event.target.value)} className="max-w-36 cursor-pointer bg-transparent font-extrabold text-stone-800 outline-none">
                <option value="all">ทุกห้อง</option>
                {scheduleClassrooms.map((room) => <option key={room.name} value={room.name}>{room.name}</option>)}
              </select>
            </label>
          ) : null}
          <Link to="/app/dashboard?view=schedule" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 text-xs font-black text-white shadow-sm transition hover:bg-stone-800">
            ดูตารางเต็ม <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Day Tabs & Pastel Legend Strip */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {visibleDays.map((day) => {
            const isSelected = selectedDay === day;
            const tabStyle = thaiDayStyles[day] || thaiDayStyles['จันทร์'];
            return (
              <button
                key={day}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onDayChange(day)}
                className={`relative min-w-14 shrink-0 rounded-2xl px-3.5 py-2 text-center text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? `${tabStyle.badge} border shadow-sm`
                    : 'border border-[#e3d7c4] bg-white/85 text-stone-600 hover:bg-white hover:text-stone-900'
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
        </div>

        {legendItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            {legendItems.map((item) => (
              <span key={item.label} className={`rounded-full border px-2.5 py-0.5 shadow-sm ${item.badgeClass}`}>
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {lessons.length > 0 ? (
        <div className="mt-4 space-y-4">
          {morningLessons.length > 0 && (
            <div>
              {afternoonLessons.length > 0 && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100/90 px-3 py-1 text-xs font-black text-amber-950">
                  <span>☀️ ช่วงเช้า</span>
                  <span>({morningLessons.length} คาบ)</span>
                </div>
              )}
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {morningLessons.map(renderLessonCard)}
              </ol>
            </div>
          )}

          {morningLessons.length > 0 && afternoonLessons.length > 0 && (
            <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
              <div className="h-px flex-1 border-t-2 border-dashed border-[#dccbb0]" />
              <span className="rounded-full border border-[#e3d2b6] bg-white px-3.5 py-1 text-xs font-black text-stone-700 shadow-sm">
                🍱 พักกลางวัน ({settings.lunchStart || '11:40'}–{settings.lunchEnd || '12:30'})
              </span>
              <div className="h-px flex-1 border-t-2 border-dashed border-[#dccbb0]" />
            </div>
          )}

          {afternoonLessons.length > 0 && (
            <div>
              {morningLessons.length > 0 && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100/90 px-3 py-1 text-xs font-black text-sky-950">
                  <span>🌤️ ช่วงบ่าย</span>
                  <span>({afternoonLessons.length} คาบ)</span>
                </div>
              )}
              <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {afternoonLessons.map(renderLessonCard)}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[#d9cab3] bg-white/75 px-5 py-6 text-center">
          <CalendarDays size={24} className="mx-auto text-stone-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-stone-700">
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
