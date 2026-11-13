import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Coffee, PlayCircle, School, Sun, Sunset } from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { BotanicalCardSprig, SubjectLucideIcon } from '../shared/BotanicalDecor';
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

  // If no periods exist anywhere in the schedule, keep a slim compact Morning Sage bar.
  if (totalPeriodCount === 0) {
    return (
      <section aria-label="ตารางสอนวันนี้" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE3D7] bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs font-bold text-[#465549]">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#BFE0CD] bg-[#E6F4EC] text-[#2F7D5B]">
            <CalendarDays size={17} aria-hidden="true" />
          </span>
          <span>ยังไม่ได้ตั้งค่าตารางสอนประจำสัปดาห์</span>
        </div>
        <Link to="/app/dashboard?view=schedule" className="inline-flex items-center gap-1.5 rounded-xl bg-[#2F7D5B] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#235F45]">
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
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 pt-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
          isNow
            ? 'border-[#2F7D5B] bg-[#F5FBF7] ring-2 ring-[#2F7D5B]/15'
            : isNext
            ? 'border-[#73B0D9] bg-white ring-1 ring-[#2D72A3]/15'
            : 'border-[#DCE3D7] bg-white hover:border-[#B6C7B3]'
        } ${isPast ? 'opacity-75 saturate-75 hover:opacity-100' : ''}`}
      >
        {/* Crisp 3px top botanical accent bar */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${isNow ? 'bg-[#2F7D5B]' : theme.accentBar}`}
        />
        <BotanicalCardSprig className="absolute -right-2 -top-1.5" color={isNow ? '#2F7D5B' : '#7B8A7E'} opacity={0.14} />

        <div className="relative z-10">
          {/* Period & Time Header */}
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold shadow-2xs ${isNow ? 'bg-[#2F7D5B] text-white' : theme.periodBadge}`}>
              คาบที่ {lesson.index}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#DCE3D7] bg-[#F6F7F3] px-2.5 py-1 text-xs font-bold tabular-nums text-[#465549]">
              <Clock3 size={12} className="text-[#6F8073]" aria-hidden="true" />
              {lesson.start}–{lesson.end}
            </span>
          </div>

          {/* Live / Next / Completed Chip */}
          {(isNow || isNext || isPast) && (
            <div className="mt-2">
              {isNow && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2F7D5B] px-2.5 py-0.5 text-xs font-bold text-white shadow-2xs">
                  <PlayCircle size={12} aria-hidden="true" /> กำลังสอนตอนนี้
                </span>
              )}
              {isNext && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#CBE1F2] bg-[#E9F3FA] px-2.5 py-0.5 text-xs font-bold text-[#1D547C]">
                  <Clock3 size={12} aria-hidden="true" /> คาบถัดไป
                </span>
              )}
              {isPast && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#DCE3D7] bg-[#F6F7F3] px-2.5 py-0.5 text-xs font-semibold text-[#5B6A5F]">
                  <CheckCircle2 size={12} aria-hidden="true" /> จบคาบแล้ว
                </span>
              )}
            </div>
          )}

          {/* Subject Icon & Title */}
          <div className="mt-3 flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-2xs transition-transform duration-200 group-hover:scale-105 ${theme.iconBg}`}
            >
              <SubjectLucideIcon size={20} subject={`${lesson.subject} ${lesson.subjectCode || ''}`} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#6F8073]">
                {theme.subjectLabel}
              </p>
              <h3 className="mt-0.5 truncate font-display text-base font-bold leading-snug text-[#1F2A22]" title={lesson.subject}>
                {lesson.subject}
              </h3>
            </div>
          </div>
        </div>

        {/* Distinct Classroom Footer */}
        <div className="relative z-10 mt-3.5 flex items-center justify-between gap-2 border-t border-dashed border-[#E4EAE0] pt-2.5">
          <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${roomTone}`}>
            <School size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">ชั้น {lesson.classroom || 'ไม่ระบุชั้น'}</span>
          </span>
          {cleanCode ? (
            <span className="shrink-0 rounded-md border border-[#DCE3D7] bg-[#FAFBF8] px-2 py-0.5 text-xs font-semibold text-[#5B6A5F]">
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
      className="relative mt-4 overflow-hidden rounded-3xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:mt-5 sm:p-6"
    >
      {/* Subtle Top Botanical Day Accent */}
      <div className={`absolute inset-x-0 top-0 h-1 ${dayStyle.bar}`} aria-hidden="true" />

      <header className="flex flex-col gap-3 border-b border-[#EDF1EA] pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/80 shadow-xs ${dayHeaderStyle.headerBg}`}>
            <CalendarDays size={20} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-[#1F2A22] sm:text-xl">
                ตารางสอนวัน{selectedDay}
              </h2>
              {selectedDay === currentDay && (
                <span className="rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-2.5 py-0.5 text-xs font-bold text-[#1C573D]">
                  วันนี้
                </span>
              )}
              {activeLesson ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2F7D5B] px-2.5 py-0.5 text-xs font-bold text-white shadow-2xs">
                  <PlayCircle size={12} aria-hidden="true" /> กำลังสอนคาบ {activeLesson.index}: {activeLesson.subject}
                </span>
              ) : nextLesson ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#CBE1F2] bg-[#E9F3FA] px-2.5 py-0.5 text-xs font-bold text-[#1D547C]">
                  <Clock3 size={12} aria-hidden="true" /> ถัดไปคาบ {nextLesson.index} ({nextLesson.start})
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs font-medium text-[#5B6A5F]">
              {lessons.length > 0
                ? `มีสอน ${lessons.length} คาบ · ${colorByMode === 'classroom' ? 'แยกสีตามระดับชั้นและคาบพิเศษ' : 'แยกสีตามรายวิชาและคาบพิเศษ'}`
                : 'เลือกวันเพื่อดูคาบสอนหรือสลับห้องเรียน'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scheduleClassrooms.length > 1 ? (
            <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] px-3 text-xs font-bold text-[#465549]">
              <School size={14} className="text-[#2D72A3]" aria-hidden="true" />
              <span className="sr-only">กรองตามห้องเรียน</span>
              <select aria-label="กรองตารางสอนตามห้อง" value={scheduleClassFilter} onChange={(event) => onClassroomChange(event.target.value)} className="max-w-36 cursor-pointer bg-transparent font-bold text-[#1F2A22] outline-none">
                <option value="all">ทุกห้อง</option>
                {scheduleClassrooms.map((room) => <option key={room.name} value={room.name}>{room.name}</option>)}
              </select>
            </label>
          ) : null}
          <Link to="/app/dashboard?view=schedule" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#1C342B] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#2F7D5B]">
            ดูตารางเต็ม <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* Day Tabs & Botanical Legend Strip */}
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
                className={`relative min-w-14 shrink-0 rounded-xl px-3.5 py-2 text-center text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F7D5B] ${
                  isSelected
                    ? `${tabStyle.badge} border shadow-2xs`
                    : 'border border-[#DCE3D7] bg-[#FAFBF8] text-[#5B6A5F] hover:bg-white hover:text-[#1F2A22]'
                }`}
              >
                <span className="sm:hidden">{shortDayNames[day] || day}</span>
                <span className="hidden sm:inline">{day}</span>
                {day === currentDay ? (
                  <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#2F7D5B] align-middle ring-2 ring-white" title="วันนี้" />
                ) : null}
              </button>
            );
          })}
        </div>

        {legendItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {legendItems.map((item) => (
              <span key={item.label} className={`rounded-full border px-2.5 py-0.5 ${item.badgeClass}`}>
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
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#F0D9AE] bg-[#FDF4E1] px-3 py-1 text-xs font-bold text-[#8B5312]">
                  <Sun size={13} aria-hidden="true" />
                  <span>ช่วงเช้า</span>
                  <span>({morningLessons.length} คาบ)</span>
                </div>
              )}
              <ol className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {morningLessons.map(renderLessonCard)}
              </ol>
            </div>
          )}

          {morningLessons.length > 0 && afternoonLessons.length > 0 && (
            <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
              <div className="h-px flex-1 border-t border-dashed border-[#DCE3D7]" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE3D7] bg-[#FAFBF8] px-3.5 py-1 text-xs font-bold text-[#5B6A5F]">
                <Coffee size={13} className="text-[#8B5312]" aria-hidden="true" />
                พักกลางวัน ({settings.lunchStart || '11:40'}–{settings.lunchEnd || '12:30'})
              </span>
              <div className="h-px flex-1 border-t border-dashed border-[#DCE3D7]" />
            </div>
          )}

          {afternoonLessons.length > 0 && (
            <div>
              {morningLessons.length > 0 && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#CBE1F2] bg-[#E9F3FA] px-3 py-1 text-xs font-bold text-[#1D547C]">
                  <Sunset size={13} aria-hidden="true" />
                  <span>ช่วงบ่าย</span>
                  <span>({afternoonLessons.length} คาบ)</span>
                </div>
              )}
              <ol className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {afternoonLessons.map(renderLessonCard)}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[#DCE3D7] bg-[#FAFBF8] px-5 py-6 text-center">
          <CalendarDays size={24} className="mx-auto text-[#7B8A7E]" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-[#1F2A22]">
            ไม่มีคาบสอน{selectedDay === currentDay ? 'วันนี้' : `วัน${selectedDay}`}{scheduleClassFilter !== 'all' ? ` สำหรับห้อง ${scheduleClassFilter}` : ''}
          </p>
          <Link to="/app/dashboard?view=schedule" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#2F7D5B] hover:underline">
            จัดการตารางสอน <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </section>
  );
}
