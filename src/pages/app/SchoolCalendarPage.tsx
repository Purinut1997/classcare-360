import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';

import {
  buildOfficialDocumentCode,
  buildOfficialFooterHtml,
  buildOfficialHeaderHtml,
  buildOfficialReportCss,
  buildOfficialSignaturesHtml,
  escapeOfficialHtml,
  formatThaiOfficialDate,
} from '../../lib/officialReport';
import { loadSchoolReportIdentity } from '../../lib/scheduleSettings';
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      // Only use Supabase data when connected - don't merge with local storage
      setEvents(mapped);
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

  useEffect(() => {
    if (!selectedDate) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDate(null);
        setEditingEvent(null);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedDate]);

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

  const printCalendarReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      setSync({ status: 'error', message: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup แล้วลองอีกครั้ง' });
      return;
    }
    const identity = loadSchoolReportIdentity();
    const schoolName = session.workspace?.schoolName || session.profile.schoolName || identity.schoolName || 'โรงเรียน';
    const classroomName = session.workspace?.classroomName || identity.classroomName || 'งานบริหารวิชาการ';
    const dateFrom = toDateInput(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    const dateTo = toDateInput(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
    const documentCode = buildOfficialDocumentCode('CC-CAL', dateFrom, classroomName);
    const rows = monthEvents.map((event, index) => `<tr><td class="official-center">${index + 1}</td><td class="official-nowrap">${escapeOfficialHtml(formatThaiOfficialDate(event.date))}</td><td>${escapeOfficialHtml(event.title)}</td><td class="official-center">${escapeOfficialHtml(typeLabels[event.type])}</td><td>${escapeOfficialHtml(policyLabels[event.attendancePolicy])}</td></tr>`).join('');

    reportWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>ปฏิทินโรงเรียน ${escapeOfficialHtml(currentMonthText)}</title><style>
      ${buildOfficialReportCss({ dense: false, marginMm: 14, orientation: 'portrait' })}
      .calendar-summary { display: grid; gap: 2mm; grid-template-columns: repeat(4, 1fr); margin: 3mm 0; }
      .calendar-summary div { border: 1px solid #555; padding: 2mm; text-align: center; }
      .calendar-summary span { display: block; font-size: 10pt; }
      .calendar-summary strong { display: block; font-size: 15pt; }
    </style></head><body><main class="official-sheet">
      ${buildOfficialHeaderHtml({ classroomName, dateFrom, dateTo, documentCode, identity, schoolName, subtitle: `ประจำเดือน${currentMonthText}`, title: 'ปฏิทินกิจกรรมและวันสำคัญของโรงเรียน' })}
      <section class="calendar-summary"><div><span>รายการทั้งหมด</span><strong>${stats.total}</strong></div><div><span>วันหยุด</span><strong>${stats.holiday}</strong></div><div><span>วันสอบ</span><strong>${stats.exam}</strong></div><div><span>กระทบเช็กชื่อ</span><strong>${stats.attendanceImpact}</strong></div></section>
      <table class="official-table"><thead><tr><th>ที่</th><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>นโยบายเวลาเรียน</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="official-center">ไม่มีวันสำคัญหรือกิจกรรมในเดือนนี้</td></tr>'}</tbody></table>
      <div class="official-certification">ขอรับรองว่าปฏิทินฉบับนี้ผ่านการตรวจสอบวันหยุด วันสอบ กิจกรรม และนโยบายการบันทึกเวลาเรียนตามข้อมูล ณ วันตัดยอด</div>
      ${buildOfficialSignaturesHtml([
        { name: identity.teacherName || session.profile.displayName, role: 'ผู้จัดทำ / ครูผู้รับผิดชอบ' },
        { name: identity.academicHeadName, role: 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ' },
        { name: identity.directorName, role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน' },
      ])}
      ${buildOfficialFooterHtml({ confidential: false, documentCode })}
    </main><script>window.addEventListener('load',()=>{window.focus();window.print();});</script></body></html>`);
    reportWindow.document.close();
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
    setSelectedDate(nextEvent.date);

    if (!supabase || !session.workspace?.id) {
      const storageKey = getDataSafetyStorageKey(session);
      const state = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      state.calendarRules = [...loadLocalCalendar(session), nextEvent];
      window.localStorage.setItem(storageKey, JSON.stringify(state));
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

    // If it's a local event or no Supabase, just remove from localStorage
    if (!supabase || !isUuid(eventId) || target.source === 'local') {
      const localEvents = loadLocalCalendar(session);
      const updatedLocal = localEvents.filter((event) => event.id !== eventId);
      const storageKey = getDataSafetyStorageKey(session);
      const state = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      state.calendarRules = updatedLocal;
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setEvents((current) => current.filter((event) => event.id !== eventId));
      setSync({ status: 'local', message: 'ลบรายการในเครื่องแล้ว' });
      return;
    }

    // Try to delete from Supabase
    try {
      const { error } = await supabase.from('school_calendar_days').delete().eq('id', eventId);
      if (error) throw error;
      // Remove from UI after successful deletion
      setEvents((current) => current.filter((event) => event.id !== eventId));
      setSync({ status: 'synced', message: 'ลบวันพิเศษออกจาก Supabase แล้ว' });
    } catch (error) {
      setSync({
        status: 'error',
        message: `ลบวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  const updateEvent = async () => {
    if (!editingEvent || !draft.title.trim()) return;

    if (!supabase || !isUuid(editingEvent.id) || editingEvent.source === 'local') {
      // Update local storage
      const localEvents = loadLocalCalendar(session);
      const updatedLocal = localEvents.map((event) =>
        event.id === editingEvent.id
          ? { ...event, date: draft.date, title: draft.title.trim(), type: draft.type, attendancePolicy: draft.attendancePolicy }
          : event
      );
      const storageKey = getDataSafetyStorageKey(session);
      const state = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      state.calendarRules = updatedLocal;
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setEvents(updatedLocal);
      setSync({ status: 'local', message: 'แก้ไขรายการในเครื่องแล้ว' });
      setSelectedDate(draft.date);
      setEditingEvent(null);
      return;
    }

    // Update in Supabase
    try {
      const { data, error } = await supabase
        .from('school_calendar_days')
        .update({
          calendar_date: draft.date,
          day_type: toDayType(draft.type),
          title: draft.title.trim(),
          affects_attendance: draft.attendancePolicy !== 'skip',
          affects_reports: true,
          metadata: { attendancePolicy: draft.attendancePolicy },
        })
        .eq('id', editingEvent.id)
        .select('*')
        .single();

      if (error) throw error;

      setEvents((current) => current.map((event) => (event.id === editingEvent.id ? mapCalendarRow(data) : event)));
      setSync({ status: 'synced', message: 'แก้ไขวันพิเศษใน Supabase แล้ว' });
      setSelectedDate(draft.date);
      setEditingEvent(null);
    } catch (error) {
      setSync({
        status: 'error',
        message: `แก้ไขวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  const openEditModal = (event: CalendarEvent) => {
    setSelectedDate(event.date);
    setEditingEvent(event);
    setDraft({
      date: event.date,
      title: event.title,
      type: event.type,
      attendancePolicy: event.attendancePolicy,
    });
  };

  const openDayDialog = (date: Date) => {
    const dateText = toDateInput(date);
    setSelectedDate(dateText);
    setEditingEvent(null);
    setDraft({ date: dateText, title: '', type: 'activity', attendancePolicy: 'normal' });
  };

  const closeDayDialog = () => {
    setSelectedDate(null);
    setEditingEvent(null);
  };

  return (
    <main className="app-page space-y-5">
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
                onClick={printCalendarReport}
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
        {sync.status === 'loading' ? <NexusAuroraInline label={sync.message} /> : sync.message}
      </div>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.45fr)]">
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
                <button
                  aria-label={`เปิดรายละเอียดวันที่ ${toThaiDate(dateText)}${dayEvents.length ? ` มี ${dayEvents.length} รายการ` : ' ยังไม่มีรายการ'}`}
                  className={`group min-h-[118px] rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-[0_14px_30px_rgba(8,145,178,0.12)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                    isToday
                      ? 'border-[#d89333] bg-[#fff1c9] shadow-[0_16px_34px_rgba(188,117,32,0.16)]'
                      : isCurrentMonth
                        ? 'border-[#ead8bd] bg-white/85'
                        : 'border-slate-100 bg-white/45 text-slate-300'
                  }`}
                  key={dateText}
                  onClick={() => openDayDialog(date)}
                  type="button"
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
                    {!dayEvents.length && isCurrentMonth ? (
                      <span className="mt-4 hidden text-[11px] font-black text-cyan-700 opacity-0 transition group-hover:block group-hover:opacity-100 sm:block">
                        + เพิ่มรายการ
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 content-start">
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
                      <div className="flex gap-2">
                        <button
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600"
                          onClick={() => openEditModal(event)}
                          type="button"
                          aria-label={`แก้ไข ${event.title}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
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

      {selectedDate ? createPortal((
        <div className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDayDialog(); }}>
          <section aria-labelledby="calendar-day-dialog-title" aria-modal="true" className="my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_32px_100px_rgba(2,8,23,0.45)]" role="dialog">
            <header className="flex items-start justify-between gap-4 bg-gradient-to-br from-slate-950 to-slate-900 px-5 py-5 text-white sm:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">รายละเอียดวันในปฏิทิน</p>
                <h2 className="mt-1 text-2xl font-black" id="calendar-day-dialog-title">{toThaiDate(selectedDate)}</h2>
                <p className="mt-1 text-xs font-bold text-slate-400">{(eventsByDate[selectedDate] || []).length} รายการ · คลิกแก้ไขหรือลบรายการเดิมได้</p>
              </div>
              <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={closeDayDialog} type="button" aria-label="ปิด">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="grid max-h-[calc(100vh-10rem)] gap-5 overflow-y-auto p-5 sm:grid-cols-[0.9fr_1.1fr] sm:p-7">
              <div>
                <p className="text-sm font-black text-slate-950">รายการของวันนี้</p>
                <div className="mt-3 grid gap-2">
                  {(eventsByDate[selectedDate] || []).length ? (eventsByDate[selectedDate] || []).map((event) => (
                    <div className={`rounded-2xl border p-3 ${typeStyles[event.type]}`} key={event.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.1em]">{typeLabels[event.type]}</p>
                          <h3 className="mt-1 text-sm font-black text-slate-950">{event.title}</h3>
                          <p className="mt-1 text-[11px] font-bold opacity-75">{policyLabels[event.attendancePolicy]}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button aria-label={`แก้ไข ${event.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/80 text-slate-600" onClick={() => openEditModal(event)} type="button"><Pencil size={15} /></button>
                          <button aria-label={`ลบ ${event.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-rose-200 bg-white/80 text-rose-600" onClick={() => void removeEvent(event.id)} type="button"><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">วันนี้ยังไม่มีรายการ<br />เพิ่มรายการแรกได้จากแบบฟอร์มด้านข้าง</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-cyan-700">{editingEvent ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</p>
                    <h3 className="text-lg font-black text-slate-950">{editingEvent ? editingEvent.title : 'กำหนดรายละเอียดของวันนี้'}</h3>
                  </div>
                  {editingEvent ? <button className="text-xs font-black text-slate-500 underline" onClick={() => { setEditingEvent(null); setDraft({ date: selectedDate, title: '', type: 'activity', attendancePolicy: 'normal' }); }} type="button">ยกเลิกแก้ไข</button> : null}
                </div>
            <div className="mt-4 grid gap-4">
              <FieldLabel>
                วันที่
                <ThaiDatePicker className="mt-2 h-12 px-4" value={draft.date} onValueChange={(value) => setDraft((current) => ({ ...current, date: value }))} />
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
              <button className="amber-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50" disabled={!draft.title.trim()} onClick={() => void (editingEvent ? updateEvent() : addEvent())} type="button">
                {editingEvent ? <Pencil size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                {editingEvent ? 'บันทึกการแก้ไข' : 'เพิ่มรายการในวันนี้'}
              </button>
            </div>
              </div>
            </div>
          </section>
        </div>
      ), document.querySelector('.app-shell') || document.body) : null}
    </main>
  );
}
