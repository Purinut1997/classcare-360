import { useMemo } from 'react';
import { ArrowRight, CalendarDays, Clock3, School } from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { buildSchedulePeriods, makeScheduleCellKey, type ScheduleSettings } from '../../lib/scheduleSettings';

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
  const periods = useMemo(() => buildSchedulePeriods(settings), [settings]);
  const lessons = periods.flatMap((period) => {
    const cell = settings.cells?.[makeScheduleCellKey(selectedDay, period.index)];
    if (!cell?.subject?.trim()) return [];
    if (scheduleClassFilter !== 'all' && cell.classroom !== scheduleClassFilter) return [];
    return [{ ...period, classroom: cell.classroom, subject: cell.subject, subjectCode: cell.subjectCode }];
  });
  const visibleDays = settings.activeDays?.length ? settings.activeDays : ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

  return (
    <section aria-label="ตารางสอนวันนี้" className="mt-5 overflow-hidden rounded-[26px] border border-sky-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 via-white to-teal-50/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-600 text-white shadow-sm"><CalendarDays size={20} aria-hidden="true" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">MY TEACHING SCHEDULE</p>
            <h2 className="text-lg font-black text-slate-950">ตารางสอนของฉัน</h2>
            <p className="text-xs font-semibold text-slate-500">เลือกวันเพื่อดูคาบเรียนได้ทันที</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scheduleClassrooms.length > 1 ? (
            <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">
              <School size={14} aria-hidden="true" />
              <span className="sr-only">กรองตามห้องเรียน</span>
              <select aria-label="กรองตารางสอนตามห้อง" value={scheduleClassFilter} onChange={(event) => onClassroomChange(event.target.value)} className="max-w-36 bg-transparent font-bold text-slate-800 outline-none">
                <option value="all">ทุกห้อง</option>
                {scheduleClassrooms.map((room) => <option key={room.name} value={room.name}>{room.name}</option>)}
              </select>
            </label>
          ) : null}
          <Link to="/app/dashboard?view=schedule" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800">
            ดูตารางเต็ม <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 sm:px-5">
        {visibleDays.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={selectedDay === day}
            onClick={() => onDayChange(day)}
            className={`relative min-w-14 rounded-xl px-3 py-2 text-center text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selectedDay === day ? 'bg-sky-700 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-800'}`}
          >
            {shortDayNames[day] || day}
            {day === currentDay ? <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${selectedDay === day ? 'bg-amber-300' : 'bg-amber-500'}`} title="วันนี้" /> : null}
          </button>
        ))}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 self-center text-[11px] font-semibold text-slate-400"><Clock3 size={13} /> {lessons.length} จาก {totalPeriodCount} คาบ</span>
      </div>

      {lessons.length > 0 ? (
        <ol className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {lessons.map((lesson) => (
            <li key={`${selectedDay}-${lesson.index}`} className="group overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white px-4 py-3">
                <span className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-3 py-1.5 text-xs font-black text-white shadow-sm">
                  <CalendarDays size={14} aria-hidden="true" /> คาบที่ {lesson.index}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-black tabular-nums text-slate-700 ring-1 ring-slate-200">
                  <Clock3 size={13} className="text-sky-700" aria-hidden="true" /> {lesson.start}–{lesson.end}
                </span>
              </div>
              <div className="px-4 pb-3 pt-3.5">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">วิชา</p>
                <p className="mt-0.5 truncate text-base font-black leading-snug text-slate-950" title={lesson.subject}>{lesson.subject}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-2.5">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-900 ring-1 ring-amber-100">
                    <School size={14} className="shrink-0 text-amber-700" aria-hidden="true" />
                    <span className="truncate">ชั้น {lesson.classroom || 'ไม่ระบุชั้น'}</span>
                  </span>
                  {lesson.subjectCode ? <span className="shrink-0 text-[10px] font-bold text-slate-400">รหัส {lesson.subjectCode}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-5 py-6 text-center">
          <CalendarDays size={23} className="mx-auto text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-slate-600">ยังไม่มีคาบเรียน{selectedDay === currentDay ? 'วันนี้' : `วัน${selectedDay}`}ในตาราง</p>
          <Link to="/app/dashboard?view=schedule" className="mt-2 inline-flex text-xs font-black text-sky-800 hover:underline">เพิ่มหรือแก้ไขตารางสอน →</Link>
        </div>
      )}
    </section>
  );
}
