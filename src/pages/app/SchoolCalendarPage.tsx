import { CalendarDays, FileCheck2, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Printer, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { NexusAuroraInline } from '../../components/system/NexusAuroraLoader';

import { buildOfficialDocumentCode, buildOfficialFooterHtml, buildOfficialHeaderHtml, buildOfficialReportCss, buildOfficialSignaturesHtml, escapeOfficialHtml, formatThaiOfficialDate } from '../../lib/officialReport';
import { isDemoSession } from '../../lib/auth';
import { canManageWorkspace } from '../../lib/roles';
import { loadSchoolReportIdentity } from '../../lib/scheduleSettings';
import { supabase } from '../../lib/supabaseClient';
import { getThaiPublicHolidays, resolveCalendarYear } from '../../lib/thaiHolidays';
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

const thaiMonthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const thaiWeekDayThemes = [
  { name: 'จันทร์', short: 'จ.', bg: 'bg-amber-400 text-amber-950 border border-amber-300/80 shadow-2xs' },
  { name: 'อังคาร', short: 'อ.', bg: 'bg-pink-400 text-pink-950 border border-pink-300/80 shadow-2xs' },
  { name: 'พุธ', short: 'พ.', bg: 'bg-emerald-500 text-white border border-emerald-400/80 shadow-2xs' },
  { name: 'พฤหัสบดี', short: 'พฤ.', bg: 'bg-orange-500 text-white border border-orange-400/80 shadow-2xs' },
  { name: 'ศุกร์', short: 'ศ.', bg: 'bg-sky-400 text-sky-950 border border-sky-300/80 shadow-2xs' },
  { name: 'เสาร์', short: 'ส.', bg: 'bg-purple-500 text-white border border-purple-400/80 shadow-2xs' },
  { name: 'อาทิตย์', short: 'อา.', bg: 'bg-rose-500 text-white border border-rose-400/80 shadow-2xs' },
];

const typeLabels: Record<CalendarType, string> = {
  holiday: 'หยุดเรียน',
  exam: 'วันสอบ',
  activity: 'กิจกรรม',
  makeup: 'เรียนชดเชย',
  custom: 'กำหนดเอง',
};

const policyLabels: Record<AttendancePolicy, string> = {
  normal: 'เช็กชื่อตามปกติ',
  warn: 'เตือนก่อนเช็กชื่อ',
  skip: 'ไม่นับเป็นวันเรียน',
};

const typeConfig: Record<
  CalendarType,
  {
    badge: string;
    chip: string;
    dot: string;
    borderLeft: string;
    icon: string;
    filterActive: string;
  }
> = {
  holiday: {
    badge: 'border-rose-300 bg-rose-100 text-rose-800',
    chip: 'border-rose-300 bg-rose-50/95 text-rose-800 hover:bg-rose-100 shadow-2xs',
    dot: 'bg-rose-500 ring-2 ring-rose-200',
    borderLeft: 'border-l-4 border-l-rose-500',
    icon: '🏖️',
    filterActive: 'border-rose-500 bg-rose-500 text-white shadow-xs',
  },
  exam: {
    badge: 'border-indigo-300 bg-indigo-100 text-indigo-900',
    chip: 'border-indigo-300 bg-indigo-50/95 text-indigo-900 hover:bg-indigo-100 shadow-2xs',
    dot: 'bg-indigo-600 ring-2 ring-indigo-200',
    borderLeft: 'border-l-4 border-l-indigo-600',
    icon: '📝',
    filterActive: 'border-indigo-600 bg-indigo-600 text-white shadow-xs',
  },
  activity: {
    badge: 'border-emerald-300 bg-emerald-100 text-emerald-900',
    chip: 'border-emerald-300 bg-emerald-50/95 text-emerald-900 hover:bg-emerald-100 shadow-2xs',
    dot: 'bg-emerald-500 ring-2 ring-emerald-200',
    borderLeft: 'border-l-4 border-l-emerald-500',
    icon: '🎪',
    filterActive: 'border-emerald-600 bg-emerald-600 text-white shadow-xs',
  },
  makeup: {
    badge: 'border-amber-300 bg-amber-100 text-amber-950',
    chip: 'border-amber-300 bg-amber-50/95 text-amber-950 hover:bg-amber-100 shadow-2xs',
    dot: 'bg-amber-500 ring-2 ring-amber-200',
    borderLeft: 'border-l-4 border-l-amber-500',
    icon: '⏰',
    filterActive: 'border-amber-500 bg-amber-500 text-white shadow-xs',
  },
  custom: {
    badge: 'border-sky-300 bg-sky-100 text-sky-900',
    chip: 'border-sky-300 bg-sky-50/95 text-sky-900 hover:bg-sky-100 shadow-2xs',
    dot: 'bg-sky-500 ring-2 ring-sky-200',
    borderLeft: 'border-l-4 border-l-sky-500',
    icon: '📌',
    filterActive: 'border-sky-600 bg-sky-600 text-white shadow-xs',
  },
};

const typeStyles: Record<CalendarType, string> = {
  holiday: typeConfig.holiday.badge,
  exam: typeConfig.exam.badge,
  activity: typeConfig.activity.badge,
  makeup: typeConfig.makeup.badge,
  custom: typeConfig.custom.badge,
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
    attendancePolicy: (metadata.attendancePolicy as AttendancePolicy | undefined) || (row.affects_attendance === false ? 'skip' : type === 'exam' || type === 'holiday' ? 'warn' : 'normal'),
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
    return (state.calendarRules || []).map((event) => ({
      ...event,
      source: 'local',
    }));
  } catch {
    return [];
  }
}

function getLocalSafetyState(storageKey: string): { calendarRules?: CalendarEvent[] } {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as { calendarRules?: CalendarEvent[] }) : {};
  } catch {
    return {};
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

function notifyCalendarUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('classcare-calendar-updated'));
  }
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
  const canEditCalendar = canManageWorkspace(session.profile.role);
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => currentMonth.getFullYear());
  const [showAiHolidayModal, setShowAiHolidayModal] = useState(false);
  const [aiImportYearMode, setAiImportYearMode] = useState<'next_year' | 'current_year' | 'both_years' | 'custom'>('next_year');
  const [aiCustomYear, setAiCustomYear] = useState(() => currentMonth.getFullYear() + 1);

  const loadEvents = async () => {
    if (!supabase || !session.workspace?.id || isDemoSession(session)) {
      const localEvents = loadLocalCalendar(session);
      setEvents(localEvents.length ? localEvents : createDemoEvents(session));
      setSync({
        status: 'local',
        message: 'ยังไม่มี Supabase หรือ workspace จึงแสดงข้อมูลในเครื่อง/ตัวอย่าง',
      });
      return;
    }

    setSync({ status: 'loading', message: 'กำลังโหลดปฏิทินจาก Supabase' });

    try {
      const { data, error } = await supabase.from('school_calendar_days').select('*').eq('workspace_id', session.workspace.id).order('calendar_date', { ascending: true });

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
        message: isMissingCalendarSql(error) ? 'ยังไม่พบตาราง school_calendar_days ใน Supabase จึงใช้ข้อมูลในเครื่องชั่วคราว' : `โหลดปฏิทินไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  useEffect(() => {
    void loadEvents();

    const handleCalendarUpdate = () => {
      void loadEvents();
    };
    window.addEventListener('classcare-calendar-updated', handleCalendarUpdate);
    return () => window.removeEventListener('classcare-calendar-updated', handleCalendarUpdate);
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
      setSync({
        status: 'error',
        message: 'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup แล้วลองอีกครั้ง',
      });
      return;
    }
    const identity = loadSchoolReportIdentity(session.workspace?.id);
    const schoolName = session.workspace?.schoolName || session.profile.schoolName || identity.schoolName || 'โรงเรียน';
    const classroomName = session.workspace?.classroomName || identity.classroomName || 'งานบริหารวิชาการ';
    const dateFrom = toDateInput(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    const dateTo = toDateInput(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));
    const documentCode = buildOfficialDocumentCode('CC-CAL', dateFrom, classroomName);
    const rows = monthEvents.map((event, index) => `<tr><td class="official-center">${index + 1}</td><td class="official-nowrap">${escapeOfficialHtml(formatThaiOfficialDate(event.date))}</td><td>${escapeOfficialHtml(event.title)}</td><td class="official-center">${escapeOfficialHtml(typeLabels[event.type])}</td><td>${escapeOfficialHtml(policyLabels[event.attendancePolicy])}</td></tr>`).join('');

    reportWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8" /><title>ปฏิทินโรงเรียน ${escapeOfficialHtml(currentMonthText)}</title><style>
      ${buildOfficialReportCss({ dense: false, marginMm: 14, orientation: 'portrait' })}
      .calendar-summary { display: grid; gap: 2mm; grid-template-columns: repeat(4, 1fr); margin: 3mm 0; }
      .calendar-summary div { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 2.5mm; padding: 2mm; text-align: center; }
      .calendar-summary div:first-child { background: #ecfeff; border-color: #a5f3fc; }
      .calendar-summary span { color: #475569; display: block; font-size: 10pt; }
      .calendar-summary strong { color: #0f2742; display: block; font-size: 15pt; }
    </style></head><body><main class="official-sheet">
      ${buildOfficialHeaderHtml({ classroomName, dateFrom, dateTo, documentCode, identity, schoolName, subtitle: `ประจำเดือน${currentMonthText}`, title: 'ปฏิทินกิจกรรมและวันสำคัญของโรงเรียน' })}
      <section class="calendar-summary"><div><span>รายการทั้งหมด</span><strong>${stats.total}</strong></div><div><span>วันหยุด</span><strong>${stats.holiday}</strong></div><div><span>วันสอบ</span><strong>${stats.exam}</strong></div><div><span>กระทบเช็กชื่อ</span><strong>${stats.attendanceImpact}</strong></div></section>
      <table class="official-table"><thead><tr><th>ที่</th><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>นโยบายเวลาเรียน</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="official-center">ไม่มีวันสำคัญหรือกิจกรรมในเดือนนี้</td></tr>'}</tbody></table>
      <div class="official-closing-block">
        <div class="official-certification">ขอรับรองว่าปฏิทินฉบับนี้ผ่านการตรวจสอบวันหยุด วันสอบ กิจกรรม และนโยบายการบันทึกเวลาเรียนตามข้อมูล ณ วันตัดยอด</div>
        ${buildOfficialSignaturesHtml([
          {
            name: identity.teacherName || session.profile.displayName,
            role: 'ผู้จัดทำ / ครูผู้รับผิดชอบ',
          },
          {
            name: identity.academicHeadName,
            role: 'ผู้ตรวจสอบ / หัวหน้างานวิชาการ',
          },
          {
            name: identity.directorName,
            role: 'ผู้รับรอง / ผู้อำนวยการโรงเรียน',
          },
        ])}
        ${buildOfficialFooterHtml({ confidential: false, documentCode })}
      </div>
    </main><script>window.addEventListener('load',()=>{window.focus();window.print();});</script></body></html>`);
    reportWindow.document.close();
  };

  const addEvent = async () => {
    if (!canEditCalendar || !draft.title.trim()) return;

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

    if (!supabase || !session.workspace?.id || isDemoSession(session)) {
      const storageKey = getDataSafetyStorageKey(session);
      const state = getLocalSafetyState(storageKey);
      state.calendarRules = [...loadLocalCalendar(session), nextEvent];
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setSync({
        status: 'local',
        message: 'บันทึกไว้ในหน้าเว็บก่อน เพราะยังไม่พร้อมเชื่อม Supabase',
      });
      notifyCalendarUpdated();
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
      notifyCalendarUpdated();
    } catch (error) {
      setSync({
        status: isMissingCalendarSql(error) ? 'missing_sql' : 'error',
        message: isMissingCalendarSql(error) ? 'ยังไม่พบตาราง school_calendar_days จึงเก็บรายการใหม่ไว้ในหน้าเว็บชั่วคราว' : `บันทึกวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  const removeEvent = async (eventId: string) => {
    if (!canEditCalendar) return;
    const target = events.find((event) => event.id === eventId);
    if (!target) return;

    // If it's a local event or no Supabase, just remove from localStorage
    if (!supabase || !isUuid(eventId) || target.source === 'local') {
      const localEvents = loadLocalCalendar(session);
      const updatedLocal = localEvents.filter((event) => event.id !== eventId);
      const storageKey = getDataSafetyStorageKey(session);
      const state = getLocalSafetyState(storageKey);
      state.calendarRules = updatedLocal;
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setEvents((current) => current.filter((event) => event.id !== eventId));
      setSync({ status: 'local', message: 'ลบรายการในเครื่องแล้ว' });
      notifyCalendarUpdated();
      return;
    }

    // Try to delete from Supabase
    try {
      const { error } = await supabase
        .from('school_calendar_days')
        .delete()
        .eq('id', eventId)
        .eq('workspace_id', session.workspace?.id || '');
      if (error) throw error;
      // Remove from UI after successful deletion
      setEvents((current) => current.filter((event) => event.id !== eventId));
      setSync({ status: 'synced', message: 'ลบวันพิเศษออกจาก Supabase แล้ว' });
      notifyCalendarUpdated();
    } catch (error) {
      setSync({
        status: 'error',
        message: `ลบวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  const updateEvent = async () => {
    if (!canEditCalendar || !editingEvent || !draft.title.trim()) return;

    if (!supabase || !isUuid(editingEvent.id) || editingEvent.source === 'local') {
      // Update local storage
      const localEvents = loadLocalCalendar(session);
      const updatedLocal = localEvents.map((event) =>
        event.id === editingEvent.id
          ? {
              ...event,
              date: draft.date,
              title: draft.title.trim(),
              type: draft.type,
              attendancePolicy: draft.attendancePolicy,
            }
          : event,
      );
      const storageKey = getDataSafetyStorageKey(session);
      const state = getLocalSafetyState(storageKey);
      state.calendarRules = updatedLocal;
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setEvents(updatedLocal);
      setSync({ status: 'local', message: 'แก้ไขรายการในเครื่องแล้ว' });
      setSelectedDate(draft.date);
      setEditingEvent(null);
      notifyCalendarUpdated();
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
        .eq('workspace_id', session.workspace?.id || '')
        .select('*')
        .single();

      if (error) throw error;

      setEvents((current) => current.map((event) => (event.id === editingEvent.id ? mapCalendarRow(data) : event)));
      setSync({ status: 'synced', message: 'แก้ไขวันพิเศษใน Supabase แล้ว' });
      setSelectedDate(draft.date);
      setEditingEvent(null);
      notifyCalendarUpdated();
    } catch (error) {
      setSync({
        status: 'error',
        message: `แก้ไขวันพิเศษไม่สำเร็จ: ${String((error as { message?: string })?.message || error)}`,
      });
    }
  };

  const openEditModal = (event: CalendarEvent) => {
    if (!canEditCalendar) return;
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
    setDraft({
      date: dateText,
      title: '',
      type: 'activity',
      attendancePolicy: 'normal',
    });
  };

  const closeDayDialog = () => {
    setSelectedDate(null);
    setEditingEvent(null);
  };

  const baseYear = currentMonth.getFullYear();

  const aiPreviewHolidays = useMemo(() => {
    const years =
      aiImportYearMode === 'next_year'
        ? [baseYear + 1]
        : aiImportYearMode === 'current_year'
        ? [baseYear]
        : aiImportYearMode === 'both_years'
        ? [baseYear, baseYear + 1]
        : [aiCustomYear];

    const existingMap = new Set(events.map((e) => `${e.date}|${e.title}`));

    const allPresets: Array<{
      date: string;
      title: string;
      type: CalendarType;
      attendancePolicy: AttendancePolicy;
      isExisting: boolean;
    }> = [];

    years.forEach((y) => {
      const list = getThaiPublicHolidays(y);
      list.forEach((item) => {
        const isExisting = existingMap.has(`${item.date}|${item.title}`);
        allPresets.push({
          ...item,
          isExisting,
        });
      });
    });

    allPresets.sort((a, b) => a.date.localeCompare(b.date));
    const newCount = allPresets.filter((p) => !p.isExisting).length;
    const existingCount = allPresets.length - newCount;

    return {
      items: allPresets,
      newCount,
      existingCount,
      years,
    };
  }, [aiImportYearMode, aiCustomYear, baseYear, events]);

  const executeAiImport = async () => {
    if (!canEditCalendar || aiPreviewHolidays.newCount === 0) return;
    const newItems = aiPreviewHolidays.items.filter((item) => !item.isExisting);

    setSync({ status: 'loading', message: `✨ AI กำลังนำเข้าวันหยุดราชการ ${newItems.length} วัน...` });

    let supabaseSuccess = false;
    let createdEvents: CalendarEvent[] = [];

    const workspaceId = session.workspace?.id;
    if (supabase && workspaceId && !isDemoSession(session)) {
      try {
        const rowsToInsert = newItems.map((h) => ({
          workspace_id: workspaceId,
          calendar_date: h.date,
          day_type: toDayType(h.type),
          title: h.title,
          affects_attendance: false,
          affects_reports: true,
          created_by: session.profile.id,
          metadata: { attendancePolicy: h.attendancePolicy },
        }));

        const { data, error } = await supabase
          .from('school_calendar_days')
          .insert(rowsToInsert)
          .select('*');

        if (!error && data) {
          supabaseSuccess = true;
          createdEvents = (data as DbRow[]).map(mapCalendarRow);
        }
      } catch (err) {
        console.warn('Batch holiday Supabase insert error, falling back to local storage:', err);
      }
    }

    if (!supabaseSuccess) {
      createdEvents = newItems.map((h, i) => ({
        id: `cal-preset-${Date.now()}-${i}`,
        date: h.date,
        title: h.title,
        type: h.type,
        attendancePolicy: h.attendancePolicy,
        source: 'local' as const,
      }));
    }

    // Merge into local storage safety backup
    const storageKey = getDataSafetyStorageKey(session);
    const state = getLocalSafetyState(storageKey);
    const existingRules = state.calendarRules || [];
    state.calendarRules = [...existingRules, ...createdEvents];
    window.localStorage.setItem(storageKey, JSON.stringify(state));

    setEvents((current) => [...current, ...createdEvents]);

    // Automatically navigate to the target year so teacher immediately sees the imported calendar!
    const targetFirstYear = aiPreviewHolidays.years[0];
    if (targetFirstYear && targetFirstYear !== currentMonth.getFullYear()) {
      setCurrentMonth(new Date(targetFirstYear, 0, 1));
    }

    setSync({
      status: supabaseSuccess ? 'synced' : 'local',
      message: `✨ AI นำเข้าวันหยุดราชการสำเร็จแล้ว ${createdEvents.length} รายการ`,
    });
    notifyCalendarUpdated();
    setShowAiHolidayModal(false);
  };

  const handleImportOfficialHolidays = async () => {
    if (!canEditCalendar) return;
    const targetYear = resolveCalendarYear(session.workspace?.academicYear || currentMonth.getFullYear());
    const thaiYear = targetYear + 543;
    const confirmMsg = `ต้องการนำเข้าวันหยุดราชการไทยประจำปี ${thaiYear} (ประมาณ 20 วัน) ลงในปฏิทินโรงเรียนอัตโนมัติหรือไม่?\n\n- ระบบจะตั้งค่า "ไม่นับเป็นวันเรียน (ข้ามเช็กชื่อ)" ให้อัตโนมัติ\n- วันที่ตรงกันแล้วจะไม่ถูกบันทึกซ้ำ`;
    if (!window.confirm(confirmMsg)) return;

    const presetHolidays = getThaiPublicHolidays(targetYear);
    const existingSet = new Set(events.map((e) => `${e.date}|${e.title}`));
    const newItems = presetHolidays.filter((h) => !existingSet.has(`${h.date}|${h.title}`));

    if (newItems.length === 0) {
      alert(`มีรายการวันหยุดราชการประจำปี ${thaiYear} ครบถ้วนแล้วในปฏิทิน ไม่พบรายการใหม่ที่ต้องนำเข้า`);
      return;
    }

    setSync({ status: 'loading', message: `กำลังนำเข้าวันหยุดราชการ ${newItems.length} วัน...` });

    let supabaseSuccess = false;
    let createdEvents: CalendarEvent[] = [];

    const workspaceId = session.workspace?.id;
    if (supabase && workspaceId && !isDemoSession(session)) {
      try {
        const rowsToInsert = newItems.map((h) => ({
          workspace_id: workspaceId,
          calendar_date: h.date,
          day_type: toDayType(h.type),
          title: h.title,
          affects_attendance: false,
          affects_reports: true,
          created_by: session.profile.id,
          metadata: { attendancePolicy: h.attendancePolicy },
        }));

        const { data, error } = await supabase
          .from('school_calendar_days')
          .insert(rowsToInsert)
          .select('*');

        if (!error && data) {
          supabaseSuccess = true;
          createdEvents = (data as DbRow[]).map(mapCalendarRow);
        }
      } catch (err) {
        console.warn('Batch holiday Supabase insert error, falling back to local storage:', err);
      }
    }

    if (!supabaseSuccess) {
      createdEvents = newItems.map((h, i) => ({
        id: `cal-preset-${Date.now()}-${i}`,
        date: h.date,
        title: h.title,
        type: h.type,
        attendancePolicy: h.attendancePolicy,
        source: 'local' as const,
      }));
    }

    // Merge into local storage safety backup
    const storageKey = getDataSafetyStorageKey(session);
    const state = getLocalSafetyState(storageKey);
    const existingRules = state.calendarRules || [];
    state.calendarRules = [...existingRules, ...createdEvents];
    window.localStorage.setItem(storageKey, JSON.stringify(state));

    setEvents((current) => [...current, ...createdEvents]);
    setSync({
      status: supabaseSuccess ? 'synced' : 'local',
      message: `นำเข้าวันหยุดราชการประจำปี ${thaiYear} สำเร็จแล้ว ${createdEvents.length} รายการ`,
    });
    notifyCalendarUpdated();
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
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">ปฏิทินภาพรวมโรงเรียน</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">รวมวันหยุด วันสอบ กิจกรรม และวันเรียนชดเชย เพื่อให้เช็กชื่อ ตารางสอน และรายงานใช้ข้อมูลวันเดียวกัน ไม่ต้องเดาจากหลายเมนู</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#ead8bd] bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs" onClick={printCalendarReport} type="button">
                <Printer size={17} aria-hidden="true" />
                พิมพ์ปฏิทิน
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 text-sm font-black text-white shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('classcare:open-ai-chat'));
                }}
                type="button"
                title="ปรึกษาหรือถามกิจกรรมปฏิทินโรงเรียนกับน้องแคร์ AI"
              >
                <Sparkles size={16} aria-hidden="true" className="text-amber-300 animate-pulse" />
                <span>✨ ปรึกษาปฏิทินด้วย AI</span>
                <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-xs border border-white/25">AI</span>
              </button>
              {canEditCalendar && (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 px-4 text-sm font-black text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={() => setShowAiHolidayModal(true)}
                  type="button"
                  title="AI ช่วยนำเข้าวันหยุดราชการไทย ทั้งปีนี้และล่วงหน้า 1 ปี"
                >
                  <Sparkles size={16} aria-hidden="true" className="text-amber-200 animate-pulse" />
                  <span>✨ AI นำเข้าวันหยุดล่วงหน้า 1 ปี</span>
                </button>
              )}
            </div>
          </div>
          <div className="bg-slate-950 p-5 text-white sm:p-7">
            <p className="text-sm font-black text-cyan-200">{session.workspace?.schoolName || session.profile.schoolName || 'โรงเรียน'}</p>
            <p className="mt-2 text-5xl font-black">{currentMonthText}</p>
            <div className="mt-5 grid gap-2">
              {['ใช้วันหยุดกับรายงานเวลาเรียน', 'เตือนครูก่อนเช็กชื่อในวันสอบ/กิจกรรม', 'เป็นฐานข้อมูลให้ตารางสอนและรายงานรายเดือน'].map((item) => (
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

      <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${sync.status === 'synced' ? 'border-teal-200 bg-teal-50 text-teal-800' : sync.status === 'missing_sql' || sync.status === 'error' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-[#ead8bd] bg-white/80 text-slate-600'}`}>{sync.status === 'loading' ? <NexusAuroraInline label={sync.message} /> : sync.message}</div>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.45fr)]">
        <div className="app-panel-pad">
          {/* Calendar Header: Month Title + Month Navigation Controls + Filter Pills */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cyan-700">ภาพรวมเดือน</p>
                <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                  {/* Clickable Month-Year Trigger with Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setPickerYear(currentMonth.getFullYear());
                        setShowMonthPicker((prev) => !prev);
                      }}
                      className="group flex items-center gap-2 rounded-2xl border border-transparent px-2.5 py-1 -ml-2.5 transition hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98]"
                      title="คลิกเพื่อเลือกเดือนและปีที่ต้องการดู"
                      aria-expanded={showMonthPicker}
                    >
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight group-hover:text-cyan-700 transition">
                        {currentMonthText}
                      </h2>
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-cyan-100 group-hover:text-cyan-800 transition">
                        <ChevronDown size={17} className={`transition-transform duration-200 ${showMonthPicker ? 'rotate-180 text-cyan-700' : ''}`} />
                      </span>
                    </button>

                    {/* Month & Year Picker Dropdown Popover */}
                    {showMonthPicker && (
                      <>
                        <div
                          className="fixed inset-0 z-[60]"
                          onClick={() => setShowMonthPicker(false)}
                        />
                        <div
                          role="dialog"
                          aria-label="เลือกเดือนและปี"
                          className="absolute left-0 top-full z-[70] mt-2 w-[320px] sm:w-[360px] overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
                        >
                          {/* Year Controls Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <button
                              type="button"
                              onClick={() => setPickerYear((y) => y - 1)}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                              title="ปีก่อนหน้า"
                            >
                              <ChevronLeft size={16} />
                            </button>

                            <div className="text-center">
                              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700">เลือกปี พ.ศ.</span>
                              <div className="text-base font-black text-slate-950">
                                พ.ศ. {pickerYear + 543} <span className="text-xs text-slate-400">({pickerYear})</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setPickerYear((y) => y + 1)}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                              title="ปีถัดไป"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>

                          {/* Quick Year Jump Pills */}
                          <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
                            {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2].map((y) => (
                              <button
                                key={y}
                                type="button"
                                onClick={() => setPickerYear(y)}
                                className={`rounded-xl px-2.5 py-1 text-[11px] font-black transition-all ${
                                  pickerYear === y
                                    ? 'bg-slate-950 text-white shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {y + 543}
                              </button>
                            ))}
                          </div>

                          {/* 12 Months Grid */}
                          <div className="mt-3 grid grid-cols-3 gap-1.5">
                            {thaiMonthNames.map((name, index) => {
                              const isSelected = currentMonth.getFullYear() === pickerYear && currentMonth.getMonth() === index;
                              const isCurrentMonthNow = today.getFullYear() === pickerYear && today.getMonth() === index;
                              return (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => {
                                    setCurrentMonth(new Date(pickerYear, index, 1));
                                    setShowMonthPicker(false);
                                  }}
                                  className={`flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-xs font-black transition-all active:scale-95 ${
                                    isSelected
                                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-2 ring-cyan-500'
                                      : isCurrentMonthNow
                                      ? 'border-2 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100'
                                      : 'border border-slate-200/80 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                                  }`}
                                >
                                  <span>{name}</span>
                                  {isCurrentMonthNow && !isSelected && (
                                    <span className="text-[9px] font-bold text-amber-600 leading-none mt-0.5">เดือนนี้</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Popover Footer */}
                          <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                                setShowMonthPicker(false);
                              }}
                              className="text-xs font-black text-cyan-700 hover:underline"
                            >
                              ↺ กลับเดือนปัจจุบัน
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMonthPicker(false)}
                              className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-black text-slate-600 hover:bg-slate-50"
                            >
                              ปิด
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Integrated Month Navigation Controls right beside month title */}
                  <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
                    <button
                      className="grid h-8 w-8 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                      onClick={() => shiftMonth(-1)}
                      type="button"
                      title="เดือนก่อนหน้า"
                      aria-label="เดือนก่อนหน้า"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <button
                      className="rounded-xl px-2.5 py-1 text-xs font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                      onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                      type="button"
                      title="กลับมาเดือนปัจจุบัน"
                    >
                      เดือนนี้
                    </button>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                      onClick={() => shiftMonth(1)}
                      type="button"
                      title="เดือนถัดไป"
                      aria-label="เดือนถัดไป"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>

                  {/* AI Quick Button right beside navigation */}
                  {canEditCalendar && (
                    <button
                      type="button"
                      onClick={() => setShowAiHolidayModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50/90 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition shadow-2xs active:scale-95"
                      title="AI นำเข้าวันหยุดราชการล่วงหน้า 1 ปี"
                    >
                      <Sparkles size={14} className="text-rose-600 animate-pulse" />
                      <span>AI วันหยุดล่วงหน้า 1 ปี</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'holiday', 'exam', 'activity', 'makeup'] as Array<'all' | CalendarType>).map((item) => {
                const isActive = filter === item;
                const activeCls = item === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                  : typeConfig[item].filterActive;

                return (
                  <button
                    className={`rounded-2xl border px-3 sm:px-3.5 py-1.5 text-xs font-black transition-all ${
                      isActive
                        ? activeCls
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    key={item}
                    onClick={() => setFilter(item)}
                    type="button"
                  >
                    {item !== 'all' ? <span className="mr-1">{typeConfig[item].icon}</span> : null}
                    {item === 'all' ? 'ทั้งหมด' : typeLabels[item]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day of Week Headers with Iconic Thai Day Colors */}
          <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2">
            {thaiWeekDayThemes.map((day) => (
              <div
                className={`rounded-xl sm:rounded-2xl px-1 py-2 sm:px-2 sm:py-2.5 text-center text-xs font-black transition ${day.bg}`}
                key={day.name}
              >
                <span className="sm:hidden text-[11px]">{day.short}</span>
                <span className="hidden sm:inline">{day.name}</span>
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
                  className={`group min-h-[58px] sm:min-h-[118px] rounded-xl sm:rounded-2xl border p-1 sm:p-2 text-left transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-[0_14px_30px_rgba(8,145,178,0.12)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                    isToday
                      ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-50/90 to-amber-100/40 ring-2 ring-amber-300/30 shadow-[0_12px_24px_rgba(245,158,11,0.18)]'
                      : isCurrentMonth
                      ? 'border-slate-200/90 bg-white/95'
                      : 'border-slate-100 bg-slate-50/50 text-slate-300 opacity-60'
                  }`}
                  key={dateText}
                  onClick={() => openDayDialog(date)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs sm:text-sm font-black ${isCurrentMonth ? (isToday ? 'text-amber-950 font-black' : 'text-slate-950') : 'text-slate-300'}`}>
                      {date.getDate()}
                    </span>
                    {isToday ? (
                      <span className="rounded-full bg-amber-500 px-1.5 sm:px-2 py-0.2 sm:py-0.5 text-[8.5px] sm:text-[10px] font-black text-white shadow-2xs">
                        วันนี้
                      </span>
                    ) : null}
                  </div>

                  {/* Mobile Indicator Dots */}
                  <div className="mt-1 flex items-center justify-center gap-1 sm:hidden flex-wrap">
                    {dayEvents.slice(0, 3).map((event) => {
                      const conf = typeConfig[event.type] || typeConfig.custom;
                      return <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />;
                    })}
                    {dayEvents.length > 3 ? (
                      <span className="text-[8.5px] font-black text-slate-500 leading-none">
                        +{dayEvents.length - 3}
                      </span>
                    ) : null}
                  </div>

                  {/* Desktop Full Event Chips with Distinct Vibrant Styling & Emojis */}
                  <div className="mt-2 hidden space-y-1 sm:block">
                    {dayEvents.slice(0, 3).map((event) => {
                      const conf = typeConfig[event.type] || typeConfig.custom;
                      return (
                        <div
                          className={`truncate rounded-lg border px-1.5 py-0.5 text-[10.5px] font-black transition-transform hover:scale-[1.02] ${conf.chip}`}
                          key={event.id}
                          title={event.title}
                        >
                          <span className="mr-1">{conf.icon}</span>
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 ? (
                      <div className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-black text-slate-500">
                        +{dayEvents.length - 3} รายการ
                      </div>
                    ) : null}
                    {!dayEvents.length && isCurrentMonth ? (
                      <span className="mt-3 hidden text-[10.5px] font-black text-cyan-700 opacity-0 transition group-hover:block group-hover:opacity-100 sm:block">
                        + เพิ่มรายการ
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Color Legend */}
          <div className="mt-3 flex items-center justify-center gap-3 text-[10.5px] font-bold text-slate-600 sm:hidden flex-wrap">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500 ring-1 ring-rose-200" /> หยุดเรียน</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-600 ring-1 ring-indigo-200" /> วันสอบ</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-emerald-200" /> กิจกรรม</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 ring-1 ring-amber-200" /> เรียนชดเชย</span>
          </div>
        </div>

        {/* Right Column: Month Events List (Non-stretching, Contained with Scrollbar) */}
        <div className="flex flex-col h-full max-h-[660px] rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-700">รายการเดือนนี้</p>
              <div className="flex items-center gap-2 mt-0.5">
                <h3 className="text-xl sm:text-2xl font-black text-slate-950">{monthEvents.length} รายการ</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  {filter === 'all' ? 'ทั้งหมด' : typeLabels[filter]}
                </span>
              </div>
            </div>
            <button
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              onClick={() => void loadEvents()}
              type="button"
              title="รีเฟรชข้อมูลปฏิทิน"
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>รีเฟรช</span>
            </button>
          </div>

          {/* Scrollable Event List */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 [scrollbar-width:thin]">
            {monthEvents.length ? (
              monthEvents.map((event) => {
                const conf = typeConfig[event.type] || typeConfig.custom;
                const evDate = new Date(`${event.date}T00:00:00`);
                const dayNumber = evDate.getDate();
                const monthShort = thaiMonthNames[evDate.getMonth()]?.slice(0, 3) || '';
                const dayOfWeekShort = thaiWeekDayThemes[(evDate.getDay() + 6) % 7]?.short || '';

                return (
                  <div
                    key={event.id}
                    className={`group relative flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3 transition-all hover:shadow-md hover:border-slate-300 ${conf.borderLeft}`}
                  >
                    {/* Compact Date Box */}
                    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100 px-2.5 py-1 text-center shrink-0 min-w-[46px]">
                      <span className="text-[10px] font-black text-slate-500 leading-tight">{dayOfWeekShort}</span>
                      <span className="text-base font-black text-slate-900 leading-none">{dayNumber}</span>
                      <span className="text-[9.5px] font-bold text-slate-400 leading-tight">{monthShort}</span>
                    </div>

                    {/* Event Info */}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-900 truncate" title={event.title}>
                        <span className="mr-1">{conf.icon}</span>
                        {event.title}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${conf.badge}`}>
                          {typeLabels[event.type]}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {policyLabels[event.attendancePolicy]}
                        </span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    {canEditCalendar && (
                      <div className="flex shrink-0 items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => openEditModal(event)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                          title={`แก้ไข ${event.title}`}
                          aria-label={`แก้ไข ${event.title}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeEvent(event.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          title={`ลบ ${event.title}`}
                          aria-label={`ลบ ${event.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-xs font-bold text-slate-500">
                <CalendarDays size={28} className="text-slate-300 mb-2" />
                ไม่มีรายการตามตัวกรองนี้ในเดือนที่เลือก
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedDate
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) closeDayDialog();
              }}
            >
              <section aria-labelledby="calendar-day-dialog-title" aria-modal="true" className="my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_32px_100px_rgba(2,8,23,0.45)]" role="dialog">
                <header className="flex items-start justify-between gap-4 bg-gradient-to-br from-slate-950 to-slate-900 px-5 py-5 text-white sm:px-7">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">รายละเอียดวันในปฏิทิน</p>
                    <h2 className="mt-1 text-2xl font-black" id="calendar-day-dialog-title">
                      {toThaiDate(selectedDate)}
                    </h2>
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
                      {(eventsByDate[selectedDate] || []).length ? (
                        (eventsByDate[selectedDate] || []).map((event) => (
                          <div className={`rounded-2xl border p-3 ${typeStyles[event.type]}`} key={event.id}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.1em]">{typeLabels[event.type]}</p>
                                <h3 className="mt-1 text-sm font-black text-slate-950">{event.title}</h3>
                                <p className="mt-1 text-[11px] font-bold opacity-75">{policyLabels[event.attendancePolicy]}</p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button aria-label={`แก้ไข ${event.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/80 text-slate-600" onClick={() => openEditModal(event)} type="button">
                                  <Pencil size={15} />
                                </button>
                                <button aria-label={`ลบ ${event.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-rose-200 bg-white/80 text-rose-600" onClick={() => void removeEvent(event.id)} type="button">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500">
                          วันนี้ยังไม่มีรายการ
                          <br />
                          เพิ่มรายการแรกได้จากแบบฟอร์มด้านข้าง
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-cyan-700">{editingEvent ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</p>
                        <h3 className="text-lg font-black text-slate-950">{editingEvent ? editingEvent.title : 'กำหนดรายละเอียดของวันนี้'}</h3>
                      </div>
                      {editingEvent ? (
                        <button
                          className="text-xs font-black text-slate-500 underline"
                          onClick={() => {
                            setEditingEvent(null);
                            setDraft({
                              date: selectedDate,
                              title: '',
                              type: 'activity',
                              attendancePolicy: 'normal',
                            });
                          }}
                          type="button"
                        >
                          ยกเลิกแก้ไข
                        </button>
                      ) : null}
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
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              type: event.target.value as CalendarType,
                            }))
                          }
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
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              attendancePolicy: event.target.value as AttendancePolicy,
                            }))
                          }
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
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                        />
                      </FieldLabel>
                      <button className="amber-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50" disabled={!canEditCalendar || !draft.title.trim()} onClick={() => void (editingEvent ? updateEvent() : addEvent())} type="button">
                        {editingEvent ? <Pencil size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                        {editingEvent ? 'บันทึกการแก้ไข' : 'เพิ่มรายการในวันนี้'}
                      </button>
                    </div>
                  </div>
                </div>
                <footer className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <p className="text-xs font-bold text-slate-500">กิจกรรมและนโยบายเช็กชื่อของวันนี้จะถูกรวมในรายงานอัตโนมัติ</p>
                  <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white" onClick={closeDayDialog} to={`/app/dashboard?view=daily-brief&date=${selectedDate}`}>
                    <FileCheck2 size={15} /> เปิด Daily Brief
                  </Link>
                </footer>
              </section>
            </div>,
            document.querySelector('.app-shell') || document.body,
          )
        : null}

      {/* ✨ AI Holiday Importer Modal */}
      {showAiHolidayModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowAiHolidayModal(false);
            }}
          >
            <section
              role="dialog"
              aria-labelledby="ai-holiday-modal-title"
              aria-modal="true"
              className="my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-[0_32px_100px_rgba(2,8,23,0.5)]"
            >
              {/* Modal Header */}
              <header className="flex items-start justify-between gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-5 text-white">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-0.5 text-[11px] font-black text-amber-300">
                    <Sparkles size={13} className="animate-pulse" />
                    <span>AI Assistant · School Calendar</span>
                  </div>
                  <h2 id="ai-holiday-modal-title" className="mt-2 text-2xl font-black tracking-tight">
                    ✨ AI นำเข้าวันหยุดราชการไทยอัตโนมัติ
                  </h2>
                  <p className="mt-1 text-xs font-bold text-slate-300">
                    วางแผนวันหยุดล่วงหน้า 1 ปี ข้ามปีการศึกษา ไม่ต้องนั่งกรอกทีละวัน ระบบตั้งค่านโยบายข้ามเช็กชื่อให้อัตโนมัติ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAiHolidayModal(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={18} />
                </button>
              </header>

              {/* Modal Body */}
              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-5 sm:p-6 space-y-4">
                {/* Year Selection Options */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                    เลือกช่วงปีที่ต้องการนำเข้า
                  </label>
                  <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                    {/* Option 1: Next Year (1 year in advance - what user specifically requested!) */}
                    <button
                      type="button"
                      onClick={() => setAiImportYearMode('next_year')}
                      className={`relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                        aiImportYearMode === 'next_year'
                          ? 'border-2 border-rose-500 bg-rose-50/80 ring-2 ring-rose-400/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="inline-block rounded-full bg-rose-500 text-white px-2 py-0.5 text-[9.5px] font-black w-fit mb-1 shadow-2xs">
                        ⭐ แนะนำ (ล่วงหน้า 1 ปี)
                      </span>
                      <div className="text-base font-black text-slate-950">
                        พ.ศ. {currentMonth.getFullYear() + 1 + 543}
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-slate-500 leading-snug">
                        ปีถัดไป ({currentMonth.getFullYear() + 1}) วางแผนการสอนล่วงหน้า
                      </p>
                    </button>

                    {/* Option 2: Current Year */}
                    <button
                      type="button"
                      onClick={() => setAiImportYearMode('current_year')}
                      className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                        aiImportYearMode === 'current_year'
                          ? 'border-2 border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-400/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[10px] font-black text-slate-400 mb-1">ปีการศึกษาปัจจุบัน</span>
                      <div className="text-base font-black text-slate-950">
                        พ.ศ. {currentMonth.getFullYear() + 543}
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-slate-500 leading-snug">
                        ปีปัจจุบัน ({currentMonth.getFullYear()}) ~20 วันหยุดราชการ
                      </p>
                    </button>

                    {/* Option 3: Both Years */}
                    <button
                      type="button"
                      onClick={() => setAiImportYearMode('both_years')}
                      className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                        aiImportYearMode === 'both_years'
                          ? 'border-2 border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[10px] font-black text-emerald-700 mb-1">⚡ รวดเดียว 2 ปี</span>
                      <div className="text-base font-black text-slate-950">
                        {currentMonth.getFullYear() + 543} + {currentMonth.getFullYear() + 1 + 543}
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-slate-500 leading-snug">
                        ปีนี้ + ล่วงหน้า 1 ปี รวม ~40 วัน ครอบคลุมทั้งสองปี
                      </p>
                    </button>
                  </div>
                </div>

                {/* AI Summary Banner */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-100 text-cyan-800 font-black">
                      {aiPreviewHolidays.items.length}
                    </span>
                    <div>
                      <p className="font-black text-slate-900">
                        ตรวจพบวันหยุดทั้งหมด {aiPreviewHolidays.items.length} รายการ
                      </p>
                      <p className="text-[11px] font-bold text-slate-500">
                        คำนวณวันหยุดราชการไทยและวันหยุดตามจันทรคติอัตโนมัติ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-black">
                    <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5">
                      + เพิ่มใหม่ {aiPreviewHolidays.newCount} วัน
                    </span>
                    {aiPreviewHolidays.existingCount > 0 && (
                      <span className="rounded-full bg-slate-200 text-slate-600 px-2.5 py-0.5">
                        มีแล้ว {aiPreviewHolidays.existingCount} วัน (ข้าม)
                      </span>
                    )}
                  </div>
                </div>

                {/* Preview Holiday Items List */}
                <div>
                  <p className="text-xs font-black text-slate-600 mb-2">
                    ตัวอย่างรายการที่จะนำเข้า ({aiPreviewHolidays.items.length} รายการ):
                  </p>
                  <div className="max-h-[260px] overflow-y-auto space-y-1.5 rounded-2xl border border-slate-200 p-2 bg-white [scrollbar-width:thin]">
                    {aiPreviewHolidays.items.map((item, idx) => (
                      <div
                        key={`${item.date}-${idx}`}
                        className={`flex items-center justify-between gap-2 rounded-xl p-2 text-xs transition ${
                          item.isExisting
                            ? 'bg-slate-50 opacity-60'
                            : 'bg-rose-50/70 border border-rose-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">🏖️</span>
                          <span className="font-black text-slate-800 shrink-0">
                            {formatThaiOfficialDate(item.date)}
                          </span>
                          <span className="font-bold text-slate-700 truncate" title={item.title}>
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.isExisting ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              มีในปฏิทินแล้ว
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-black shadow-2xs">
                              พร้อมนำเข้า
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <p className="text-xs font-bold text-slate-500">
                  ระบบจะตั้งค่านโยบาย &quot;ไม่นับเป็นวันเรียน (ข้ามเช็กชื่อ)&quot; ให้อัตโนมัติทุกรายการ
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAiHolidayModal(false)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={aiPreviewHolidays.newCount === 0}
                    onClick={() => void executeAiImport()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={14} className="text-amber-200 animate-pulse" />
                    <span>
                      {aiPreviewHolidays.newCount === 0
                        ? 'มีรายการวันหยุดครบถ้วนแล้ว'
                        : `ยืนยันนำเข้า ${aiPreviewHolidays.newCount} วันด้วย AI`}
                    </span>
                  </button>
                </div>
              </footer>
            </section>
          </div>,
          document.querySelector('.app-shell') || document.body,
        )}
    </main>
  );
}
