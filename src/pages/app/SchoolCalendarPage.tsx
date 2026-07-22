import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface SchoolCalendarPageProps {
  session: AppSessionContext;
}

type CalendarType = 'holiday' | 'exam' | 'activity' | 'makeup' | 'custom';
type AttendancePolicy = 'skip' | 'warn' | 'normal';
type SyncStatus = 'local' | 'loading' | 'synced' | 'missing_sql' | 'error';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: CalendarType;
  attendancePolicy: AttendancePolicy;
  source?: 'supabase' | 'local' | 'demo';
}

type DbRow = Record<string, unknown>;

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

const weekDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const typeLabels: Record<CalendarType, string> = {
  holiday: 'หยุดเรียน',
  exam: 'สอบ',
  activity: 'กิจกรรม',
  makeup: 'เรียนชดเชย',
  custom: 'กำหนดเอง',
};

const policyLabels: Record<AttendancePolicy, string> = {
  normal: 'เช็กชื่อตามปกติ',
  warn: 'เตือนก่อนเช็กชื่อ',
  skip: 'ไม่นับเป็นวันเรียน',
};

const typeStyles: Record<CalendarType, string> = {
  holiday: 'border-rose-200 bg-rose-50 text-rose-700',
  exam: 'border-sky-200 bg-sky-50 text-sky-700',
  activity: 'border-amber-200 bg-amber-50 text-amber-800',
  makeup: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  custom: 'border-slate-200 bg-slate-50 text-slate-600',
};

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toThaiDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return `${date.getDate()} ${thaiMonthNames[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isMissingCalendarSql(error: unknown) {
  const message = String((error as { message?: string })?.message || '');
  const code = String((error as { code?: string })?.code || '');
  return code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function getJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toCalendarType(value: string): CalendarType {
  if (value === 'holiday' || value === 'exam' || value === 'activity' || value === 'makeup') return value;
  return 'custom';
}

function toDayType(value: CalendarType) {
  if (value === 'custom') return 'school_day';
  return value;
}

function mapCalendarRow(row: DbRow): CalendarEvent {
  const type = toCalendarType(String(row.day_type || 'custom'));
  const metadata = getJsonObject(row.metadata);
  return {
    id: String(row.id),
    date: String(row.calendar_date || '').slice(0, 10),
    title: String(row.title || ''),
    type,
    attendancePolicy:
      (metadata.attendancePolicy as AttendancePolicy | undefined) ||
      (row.affects_attendance === false ? 'skip' : type === 'exam' || type === 'holiday' ? 'warn' : 'normal'),
    source: 'supabase',
  };
}

function getDataSafetyStorageKey(session: AppSessionContext) {
  return `classcare:data-safety:${session.workspace?.id || session.profile.id}`;
}

function loadLocalCalendar(session: AppSessionContext): CalendarEvent[] {
  try {
    const raw = window.localStorage.getItem(getDataSafetyStorageKey(session));
    if (!raw) return [];
    const state = JSON.parse(raw) as { calendarRules?: CalendarEvent[] };
    return (state.calendarRules || []).map((event) => ({ ...event, source: 'local' }));
  } catch {
    return [];
  }
}

function createDemoEvents(session: AppSessionContext): CalendarEvent[] {
  const today = new Date();
  const examDate = new Date(today.getFullYear(), today.getMonth(), Math.min(20, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
  const activityDate = new Date(today.getFullYear(), today.getMonth(), Math.min(12, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
  const makeupDate = new Date(today.getFullYear(), today.getMonth(), Math.min(25, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()));
  const schoolName = session.workspace?.schoolName || session.profile.schoolName || 'โรงเรียน';

  return [
    {
      id: 'demo-activity',
      date: toDateInput(activityDate),
      title: `${schoolName} จัดกิจกรรมหน้าเสาธง`,
      type: 'activity',
      attendancePolicy: 'normal',
      source: 'demo',
    },
    {
      id: 'demo-exam',
      date: toDateInput(examDate),
      title: 'สอบกลางภาค',
      type: 'exam',
      attendancePolicy: 'warn',
      source: 'demo',
    },
    {
      id: 'demo-makeup',
      date: toDateInput(makeupDate),
      title: 'เรียนชดเชย',
      type: 'makeup',
      attendancePolicy: 'normal',
      source: 'demo',
    },
  ];
}

function buildMonthCells(month: Date) {
  const firstDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstDayMondayBased = (firstDate.getDay() + 6) % 7;
  const gridStart = new Date(firstDate);
  gridStart.setDate(firstDate.getDate() - firstDayMondayBased);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="compact-stat text-left">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-black text-slate-600">{children}</label>;
}

export function SchoolCalendarPage({ session }: SchoolCalendarPageProps) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>(() => createDemoEvents(session));
  const [sync, setSync] = useState<{ status: SyncStatus; message: string }>({
    status: 'local',
    message: 'กำลังใช้ข้อมูลในเครื่องจนกว่าจะเชื่อม Supabase สำเร็จ',
  });
  const [filter, setFilter] = useState<'all' | CalendarType>('all');
  const [draft, setDraft] = useState({
    date: toDateInput(today),
    title: '',
    type: 'activity' as CalendarType,
    attendancePolicy: 'normal' as AttendancePolicy,
  });

  const loadEvents = async () => {
    if (!supabase || !session.workspace?.id) {
      const localEvents = loadLocalCalendar(session);
      setEvents(localEvents.length ? localEvents : createDemoEvents(session));
      setSync({ status: 'local', message: 'ยังไม่มี Supabase หรือ workspace จึงแสดงข้อมูลในเครื่อง/ตัวอย่าง' });
      return;
    }

    setSync({ status: 'loading', message: 'กำลังโหลดปฏิทินจาก Supabase' });

    try {
      const { data, error } = await supabase
        .from('school_calendar_days')
        .select('*')
        .eq('workspace_id', session.workspace.id)
        .order('calendar_date', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map(mapCalendarRow);
      const localEvents = loadLocalCalendar(session);
      setEvents(mapped.length ? mapped : localEvents.length ? localEvents : createDemoEvents(session));
      setSync({
        status: 'synced',
        message: mapped.length ? 'เชื่อมข้อมูลปฏิทิน Supabase แล้ว' : 'เชื่อม Supabase แล้ว แต่ยังไม่มีวันพิเศษในตาราง',
      });
    } catch (error) {
      const localEvents = loadLocalCalendar(session);
      setEvents(localEvents.length ? localEvents : createDemoEvents(session));
      setSync({
        status: isMissingCalendarSql(error) ? 'missing_sql' : 'error',
        message: isMissingCalendarSql(error)
          ? 'ยังไม่พบตาราง school_calendar_days ใน Supabase จึงใช้ข้อมูลในเครื่องชั่วคราว'
          : `โหลดปฏิทินไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  useEffect(() => {
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.workspace?.id]);

  const monthCells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);
  const currentMonthText = `${thaiMonthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear() + 543}`;
  const eventsByDate = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      acc[event.date] = [...(acc[event.date] || []), event];
      return acc;
    }, {});
  }, [events]);

  const monthEvents = useMemo(() => {
    return events
      .filter((event) => {
        const date = new Date(`${event.date}T00:00:00`);
        return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth();
      })
      .filter((event) => filter === 'all' || event.type === filter)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [currentMonth, events, filter]);

  const stats = useMemo(() => {
    const allMonthEvents = events.filter((event) => {
      const date = new Date(`${event.date}T00:00:00`);
      return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth();
    });
    return {
      total: allMonthEvents.length,
      holiday: allMonthEvents.filter((event) => event.type === 'holiday').length,
      exam: allMonthEvents.filter((event) => event.type === 'exam').length,
      activity: allMonthEvents.filter((event) => event.type === 'activity' || event.type === 'makeup').length,
      attendanceImpact: allMonthEvents.filter((event) => event.attendancePolicy !== 'normal').length,
    };
  }, [currentMonth, events]);

  const shiftMonth = (amount: number) => {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const addEvent = async () => {
    if (!draft.title.trim()) return;

    const nextEvent: CalendarEvent = {
      id: `local-${Date.now()}`,
      date: draft.date,
      title: draft.title.trim(),
      type: draft.type,
      attendancePolicy: draft.attendancePolicy,
      source: 'local',
    };

    setEvents((current) => [...current, nextEvent]);
    setDraft((current) => ({ ...current, title: '' }));

    if (!supabase || !session.workspace?.id) {
      setSync({ status: 'local', message: 'บันทึกไว้ในหน้าเว็บก่อน เพราะยังไม่พร้อมเชื่อม Supabase' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('school_calendar_days')
        .insert({
          workspace_id: session.workspace.id,
          calendar_date: nextEvent.date,
          day_type: toDayType(nextEvent.type),
          title: nextEvent.title,
          affects_attendance: nextEvent.attendancePolicy !== 'skip',
          affects_reports: true,
          created_by: session.profile.id,
          metadata: { attendancePolicy: nextEvent.attendancePolicy },
        })
        .select('*')
        .single();

      if (error) throw error;

      setEvents((current) => current.map((event) => (event.id === nextEvent.id ? mapCalendarRow(data) : event)));
      setSync({ status: 'synced', message: 'บันทึกวันพิเศษลง Supabase แล้ว' });
    } catch (error) {
      setSync({
        status: isMissingCalendarSql(error) ? 'missing_sql' : 'error',
        message: isMissingCalendarSql(error)
          ? 'ยังไม่พบตาราง school_calendar_days จึงเก็บรายการใหม่ไว้ในหน้าเว็บชั่วคราว'
          : `บันทึกวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  const removeEvent = async (eventId: string) => {
    const target = events.find((event) => event.id === eventId);
    if (!target) return;

    setEvents((current) => current.filter((event) => event.id !== eventId));

    if (!supabase || !isUuid(eventId)) return;

    try {
      const { error } = await supabase.from('school_calendar_days').delete().eq('id', eventId);
      if (error) throw error;
      setSync({ status: 'synced', message: 'ลบวันพิเศษออกจาก Supabase แล้ว' });
    } catch (error) {
      setEvents((current) => [...current, target].sort((a, b) => a.date.localeCompare(b.date)));
      setSync({
        status: 'error',
        message: `ลบวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  return (
    <main className="space-y-5">
      <section className="nexus-card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5 sm:p-7">
            <span className="nexus-kicker">
              <CalendarDays size={16} aria-hidden="true" />
              School Calendar
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              ปฏิทินภาพรวมโรงเรียน
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
              รวมวันหยุด วันสอบ กิจกรรม และวันเรียนชดเชย เพื่อให้เช็กชื่อ ตารางสอน และรายงานใช้ข้อมูลวันเดียวกัน ไม่ต้องเดาจากหลายเมนู
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#ead8bd] bg-white px-4 text-sm font-black text-slate-700"
                onClick={() => shiftMonth(-1)}
                type="button"
              >
                <ChevronLeft size={17} aria-hidden="true" />
                เดือนก่อน
              </button>
              <button
                className="dark-action inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                type="button"
              >
                เดือนนี้
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#ead8bd] bg-white px-4 text-sm font-black text-slate-700"
                onClick={() => shiftMonth(1)}
                type="button"
              >
                เดือนถัดไป
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#ead8bd] bg-white px-4 text-sm font-black text-slate-700"
                onClick={() => window.print()}
                type="button"
              >
                <Printer size={17} aria-hidden="true" />
                พิมพ์
              </button>
            </div>
          </div>
          <div className="bg-slate-950 p-5 text-white sm:p-7">
            <p className="text-sm font-black text-cyan-200">{session.workspace?.schoolName || session.profile.schoolName || 'โรงเรียน'}</p>
            <p className="mt-2 text-5xl font-black">{currentMonthText}</p>
            <div className="mt-5 grid gap-2">
              {[
                'ใช้วันหยุดกับรายงานเวลาเรียน',
                'เตือนครูก่อนเช็กชื่อในวันสอบ/กิจกรรม',
                'เป็นฐานข้อมูลให้ตารางสอนและรายงานรายเดือน',
              ].map((item) => (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-sm font-bold" key={item}>
                  <CheckCircle2 className="mr-2 inline text-cyan-200" size={16} aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="วันพิเศษ" value={stats.total} detail="ทั้งหมดในเดือนนี้" />
        <StatCard label="วันหยุด" value={stats.holiday} detail="ไม่นับหรือเตือนเช็กชื่อ" />
        <StatCard label="วันสอบ" value={stats.exam} detail="เตือนก่อนบันทึกเวลาเรียน" />
        <StatCard label="กิจกรรม/ชดเชย" value={stats.activity} detail="ใช้กับตารางและรายงาน" />
        <StatCard label="กระทบเช็กชื่อ" value={stats.attendanceImpact} detail="ต้องตรวจนโยบาย" />
      </section>

      <div
        className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          sync.status === 'synced'
            ? 'border-teal-200 bg-teal-50 text-teal-800'
            : sync.status === 'missing_sql' || sync.status === 'error'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-[#ead8bd] bg-white/80 text-slate-600'
        }`}
      >
        {sync.message}
      </div>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="app-panel-pad">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-cyan-700">ภาพรวมเดือน</p>
              <h2 className="text-3xl font-black text-slate-950">{currentMonthText}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'holiday', 'exam', 'activity', 'makeup'] as Array<'all' | CalendarType>).map((item) => (
                <button
                  className={`rounded-2xl border px-4 py-2 text-xs font-black transition ${
                    filter === item
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-[#ead8bd] bg-white text-slate-600 hover:bg-[#fff8eb]'
                  }`}
                  key={item}
                  onClick={() => setFilter(item)}
                  type="button"
                >
                  {item === 'all' ? 'ทั้งหมด' : typeLabels[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div className="rounded-2xl bg-[#3a2817] px-2 py-3 text-center text-xs font-black text-white" key={day}>
                {day}
              </div>
            ))}
            {monthCells.map((date) => {
              const dateText = toDateInput(date);
              const dayEvents = (eventsByDate[dateText] || []).filter((event) => filter === 'all' || event.type === filter);
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
              const isToday = isSameDate(date, today);

              return (
                <div
                  className={`min-h-[118px] rounded-2xl border p-2 transition ${
                    isToday
                      ? 'border-[#d89333] bg-[#fff1c9] shadow-[0_16px_34px_rgba(188,117,32,0.16)]'
                      : isCurrentMonth
                        ? 'border-[#ead8bd] bg-white/85'
                        : 'border-slate-100 bg-white/45 text-slate-300'
                  }`}
                  key={dateText}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-black ${isCurrentMonth ? 'text-slate-950' : 'text-slate-300'}`}>
                      {date.getDate()}
                    </span>
                    {isToday ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#8a5200]">วันนี้</span> : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        className={`truncate rounded-xl border px-2 py-1 text-[11px] font-black ${typeStyles[event.type]}`}
                        key={event.id}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 ? (
                      <div className="rounded-xl bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                        +{dayEvents.length - 3} รายการ
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <div className="app-panel-pad">
            <span className="nexus-kicker">
              <Plus size={16} aria-hidden="true" />
              เพิ่มวันในปฏิทิน
            </span>
            <div className="mt-5 grid gap-4">
              <FieldLabel>
                วันที่
                <input
                  className="nexus-field mt-2 h-12 px-4"
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                />
              </FieldLabel>
              <FieldLabel>
                ประเภทวัน
                <select
                  className="nexus-field mt-2 h-12 px-4"
                  value={draft.type}
                  onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as CalendarType }))}
                >
                  <option value="activity">กิจกรรม</option>
                  <option value="holiday">หยุดเรียน</option>
                  <option value="exam">สอบ</option>
                  <option value="makeup">เรียนชดเชย</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
              </FieldLabel>
              <FieldLabel>
                นโยบายเช็กชื่อ
                <select
                  className="nexus-field mt-2 h-12 px-4"
                  value={draft.attendancePolicy}
                  onChange={(event) => setDraft((current) => ({ ...current, attendancePolicy: event.target.value as AttendancePolicy }))}
                >
                  <option value="normal">เช็กชื่อตามปกติ</option>
                  <option value="warn">เตือนก่อนเช็กชื่อ</option>
                  <option value="skip">ไม่นับเป็นวันเรียน</option>
                </select>
              </FieldLabel>
              <FieldLabel>
                ชื่อรายการ
                <input
                  className="nexus-field mt-2 h-12 px-4"
                  placeholder="เช่น สอบกลางภาค / กิจกรรมวันแม่"
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                />
              </FieldLabel>
              <button className="amber-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black" onClick={addEvent} type="button">
                <Plus size={17} aria-hidden="true" />
                บันทึกลงปฏิทิน
              </button>
            </div>
          </div>

          <div className="app-panel-pad">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-cyan-700">รายการเดือนนี้</p>
                <h2 className="text-2xl font-black text-slate-950">{monthEvents.length} รายการ</h2>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#ead8bd] bg-white px-3 text-xs font-black text-slate-700"
                onClick={() => void loadEvents()}
                type="button"
              >
                <RefreshCw size={15} aria-hidden="true" />
                รีเฟรช
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {monthEvents.length ? (
                monthEvents.map((event) => (
                  <div className="rounded-2xl border border-[#ead8bd] bg-white/85 p-4" key={event.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">{toThaiDate(event.date)}</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">{event.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${typeStyles[event.type]}`}>{typeLabels[event.type]}</span>
                          <span className="rounded-full border border-[#ead8bd] bg-[#fff8eb] px-3 py-1 text-xs font-black text-[#7a4f26]">
                            {policyLabels[event.attendancePolicy]}
                          </span>
                        </div>
                      </div>
                      <button
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600"
                        onClick={() => void removeEvent(event.id)}
                        type="button"
                        aria-label={`ลบ ${event.title}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[#ead8bd] bg-[#fff8eb] p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีรายการตามตัวกรองนี้ในเดือนที่เลือก
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
