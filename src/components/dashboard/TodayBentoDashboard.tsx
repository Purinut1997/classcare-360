import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  HeartPulse,
  PiggyBank,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { StudentRiskSignalItem } from '../../lib/studentIntelligence';
import {
  buildSchedulePeriods,
  makeScheduleCellKey,
  type ScheduleSettings,
} from '../../lib/scheduleSettings';
import type { AppSessionContext } from '../../types/core';
import {
  partitionCalendarEvents,
  type SchoolCalendarDigestEvent,
} from '../../lib/schoolCalendarDigest';
import { AiFeatureShowcase } from './AiFeatureShowcase';
import { SchoolCalendarDigestCard } from './SchoolCalendarDigestCard';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface TodayBentoDashboardProps {
  session: AppSessionContext;
  classroomName: string;
  selectedClassroomId: string;
  isHomeroom: boolean;
  currentThaiDay: string;
  todayDateStr: string;
  todayHolidayTitle: string | null;
  nextUpcomingEvent: {
    date: string;
    daysFromNow: number;
    title: string;
    type: string;
  } | null;
  weeklySchedule: ScheduleSettings;
  todayCheckedSessionCount: number;
  subjectAttendanceNamesToday: string[];
  weeklyAttendanceDays: Array<{
    dayLabel: string;
    date: string;
    checked: boolean;
    isToday: boolean;
  }>;
  dailySavings: {
    todayDeposit: number;
    todayWithdraw: number;
    todaySavers: number;
    studentsTotal: number;
    totalBalance: number;
    monthlyDeposits: number;
    dailyBars: Array<{
      day: string;
      fullDay: string;
      date: string;
      amount: number;
      isToday: boolean;
    }>;
  };
  scoresSummary: {
    gradedAssessments: number;
    totalAssessments: number;
    averagePercent: number;
  };
  healthRoutineSummary: {
    items: Array<{
      key: string;
      label: string;
      recorded: number;
      total: number;
      done: boolean;
    }>;
    completedCount: number;
    totalRoutines: number;
  };
  termSummary: {
    termName: string | null;
    startDate: string | null;
    endDate: string | null;
    readinessPercent: number;
  };
  classroomProgressItems: Array<{
    id: string;
    name: string;
    studentCount: number;
    percent: number;
  }>;
  onSelectClassroom: (classroomId: string) => void;
  catchUpItems: Array<{
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    tone: string;
    path: string;
  }>;
  calendarEvents?: SchoolCalendarDigestEvent[];
  earlyWarningStudents?: StudentRiskSignalItem[];
}

const WEEKDAY_KEYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'] as const;
const WEEKDAY_SHORT = ['จ', 'อ', 'พ', 'พฤ', 'ศ'] as const;
const PWA_DISMISS_STORAGE_KEY = 'classcare_pwa_prompt_dismissed';

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

function formatThaiShortDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(`${dateStr}T12:00:00+07:00`));
  } catch {
    return dateStr;
  }
}

function isPeriodChecked(
  subject: string,
  periodLabel: string,
  checkedNames: string[],
): boolean {
  const normSubj = subject.trim().toLowerCase();
  const normPeriod = periodLabel.trim().toLowerCase();
  return checkedNames.some((entry) => {
    const val = entry.trim().toLowerCase();
    return Boolean(val) && (val === normSubj || val.includes(normSubj) || val.includes(normPeriod));
  });
}

function computeTermProgress(
  startDate: string | null,
  endDate: string | null,
  todayDateStr: string,
): { currentWeek: number; totalWeeks: number; percent: number } | null {
  if (!startDate || !endDate) return null;
  const startMs = new Date(`${startDate}T00:00:00+07:00`).getTime();
  const endMs = new Date(`${endDate}T00:00:00+07:00`).getTime();
  const todayMs = new Date(`${todayDateStr}T00:00:00+07:00`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((todayMs - startMs) / 86_400_000)));
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((elapsedDays + 1) / 7)));
  const percent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  return { currentWeek, totalWeeks, percent };
}

export function TodayBentoDashboard({
  session,
  classroomName,
  selectedClassroomId,
  isHomeroom,
  currentThaiDay,
  todayDateStr,
  todayHolidayTitle,
  nextUpcomingEvent,
  weeklySchedule,
  todayCheckedSessionCount,
  subjectAttendanceNamesToday,
  weeklyAttendanceDays,
  dailySavings,
  scoresSummary,
  healthRoutineSummary,
  termSummary,
  classroomProgressItems,
  onSelectClassroom,
  catchUpItems,
  calendarEvents = [],
  earlyWarningStudents = [],
}: TodayBentoDashboardProps) {
  const { todayEvents } = useMemo(
    () => partitionCalendarEvents(calendarEvents, todayDateStr),
    [calendarEvents, todayDateStr],
  );
  const todaySpecialEvents = useMemo(
    () => todayEvents.filter((ev) => ev.type !== 'holiday'),
    [todayEvents],
  );
  const [nowMinutes, setNowMinutes] = useState<number>(() => getBangkokNowMinutes());
  const [isAiExpanded, setIsAiExpanded] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaDismissed, setIsPwaDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(PWA_DISMISS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMinutes(getBangkokNowMinutes()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const periods = useMemo(() => buildSchedulePeriods(weeklySchedule), [weeklySchedule]);

  const todayLessons = useMemo(() => {
    return periods.flatMap((period) => {
      const cell = weeklySchedule.cells?.[makeScheduleCellKey(currentThaiDay, period.index)];
      if (!cell?.subject?.trim()) return [];
      const startMinutes = parseMinutes(period.start);
      const endMinutes = parseMinutes(period.end);
      const checked =
        isPeriodChecked(cell.subject, period.label, subjectAttendanceNamesToday) ||
        (todayCheckedSessionCount > 0 && /โฮมรูม|เข้าแถว|เช็กชื่อ/.test(cell.subject));
      return [{
        ...period,
        classroom: cell.classroom || classroomName,
        subject: cell.subject.trim(),
        startMinutes,
        endMinutes,
        checked,
        isCurrent: nowMinutes >= startMinutes && nowMinutes < endMinutes,
        isPast: nowMinutes >= endMinutes,
      }];
    });
  }, [classroomName, currentThaiDay, nowMinutes, periods, subjectAttendanceNamesToday, todayCheckedSessionCount, weeklySchedule.cells]);

  const featuredLessons = useMemo(() => {
    if (todayLessons.length <= 3) return todayLessons;
    const activeIdx = todayLessons.findIndex((item) => item.isCurrent || (!item.checked && !item.isPast));
    if (activeIdx <= 0) return todayLessons.slice(0, 3);
    const startIdx = Math.max(0, Math.min(activeIdx - 1, todayLessons.length - 3));
    return todayLessons.slice(startIdx, startIdx + 3);
  }, [todayLessons]);

  const highlightLessonIndex = useMemo(() => {
    const liveIdx = featuredLessons.findIndex((item) => item.isCurrent);
    if (liveIdx >= 0) return liveIdx;
    return featuredLessons.findIndex((item) => !item.checked && !item.isPast);
  }, [featuredLessons]);

  const isWeekend = currentThaiDay === 'เสาร์' || currentThaiDay === 'อาทิตย์';
  const isRestDay = isWeekend || Boolean(todayHolidayTitle);

  // Savings metrics
  const netToday = dailySavings.todayDeposit - dailySavings.todayWithdraw;
  const saverPct = dailySavings.studentsTotal > 0
    ? Math.min(100, Math.round((dailySavings.todaySavers / dailySavings.studentsTotal) * 100))
    : 0;
  const weeklySavingsTotal = dailySavings.dailyBars.reduce((sum, b) => sum + b.amount, 0);
  const maxSavingsBar = Math.max(1, ...dailySavings.dailyBars.map((b) => b.amount));

  // Scores donut metrics
  const scorePct = scoresSummary.totalAssessments > 0
    ? Math.min(100, Math.round((scoresSummary.gradedAssessments / scoresSummary.totalAssessments) * 100))
    : 0;
  const ringRadius = 17;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (scorePct / 100) * ringCircumference;

  // Term progress calculation
  const termProgress = useMemo(
    () => computeTermProgress(termSummary.startDate, termSummary.endDate, todayDateStr),
    [termSummary.endDate, termSummary.startDate, todayDateStr],
  );

  // Mini timetable preview (Mon-Fri x first 4 periods)
  const miniPeriods = useMemo(() => periods.slice(0, 4), [periods]);

  const handleDismissPwa = () => {
    setIsPwaDismissed(true);
    try {
      window.localStorage.setItem(PWA_DISMISS_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] space-y-3.5">
      {/* ROW 1: BALANCED DUAL HERO BENTO (Today Schedule 7 cols + Daily Savings Spotlight 5 cols) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        {/* Left Hero Card: Today's Schedule / Weekend or Holiday State */}
        <section
          aria-label="ตารางสอนและสถานะวันนี้"
          className="bento-card relative flex min-h-[246px] flex-col justify-between overflow-hidden p-5 lg:col-span-7"
        >
          {isRestDay ? (
            <div className="flex flex-1 flex-col items-center justify-center py-1 text-center">
              <svg width="128" height="100" viewBox="0 0 160 124" fill="none" className="mb-2" aria-hidden="true">
                <ellipse cx="78" cy="108" rx="54" ry="10" fill="#f6e7dc" />
                <circle cx="122" cy="24" r="14" fill="#f6c48a" />
                <g stroke="#f6c48a" strokeWidth="3" strokeLinecap="round">
                  <line x1="122" y1="3" x2="122" y2="7" />
                  <line x1="143" y1="24" x2="147" y2="24" />
                  <line x1="137" y1="9" x2="140" y2="6" />
                  <line x1="137" y1="39" x2="140" y2="42" />
                </g>
                <circle cx="54" cy="40" r="10" fill="#eba06b" />
                <circle cx="102" cy="40" r="10" fill="#eba06b" />
                <line x1="60" y1="94" x2="54" y2="104" stroke="#d9874f" strokeWidth="6" strokeLinecap="round" />
                <line x1="96" y1="94" x2="102" y2="104" stroke="#d9874f" strokeWidth="6" strokeLinecap="round" />
                <circle cx="78" cy="68" r="34" fill="#f1a672" />
                <circle cx="78" cy="68" r="25" fill="#fffaf5" />
                <line x1="78" y1="68" x2="78" y2="53" stroke="#2d3a33" strokeWidth="3.2" strokeLinecap="round" />
                <line x1="78" y1="68" x2="67" y2="74" stroke="#2d3a33" strokeWidth="3.2" strokeLinecap="round" />
                <circle cx="78" cy="68" r="3" fill="#2d3a33" />
              </svg>
              <h2 className="font-display text-[19px] font-extrabold tracking-tight text-[#1f2924]">
                วัน{currentThaiDay} — {todayHolidayTitle || 'หยุดสุดสัปดาห์'}
              </h2>
              <p className="mt-1 text-xs font-medium text-[#75827a]">
                ไม่มีคาบเรียนวันนี้ ระบบจึงไม่สร้างงานเช็กชื่อให้
              </p>
              {todaySpecialEvents.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                  {todaySpecialEvents.slice(0, 2).map((ev) => (
                    <Link
                      key={ev.id}
                      to="/app/dashboard?view=school-calendar"
                      className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800 transition hover:bg-purple-100"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                      <span className="max-w-[220px] truncate">วันนี้ · {ev.title}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {nextUpcomingEvent ? (
                <Link
                  to="/app/dashboard?view=school-calendar"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#f2dc9b] bg-[#fffaf0] px-3 py-1 text-xs font-semibold text-[#946208] transition hover:bg-[#fff3d6]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d98b26]" />
                  <span className="max-w-[260px] truncate">
                    {nextUpcomingEvent.daysFromNow === 1
                      ? 'พรุ่งนี้'
                      : `อีก ${nextUpcomingEvent.daysFromNow} วัน`}{' '}
                    · {nextUpcomingEvent.title}
                  </span>
                </Link>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/app/dashboard?view=schedule"
                  className="inline-flex items-center gap-1 rounded-full bg-[#eaf5ef] px-4 py-1.5 text-xs font-bold text-[#1c573d] transition hover:brightness-95"
                >
                  <span>ดูตารางเต็ม</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
                <Link
                  to="/app/dashboard?view=school-calendar"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#dce3d7] bg-white px-3.5 py-1.5 text-xs font-bold text-[#4c5751] transition hover:bg-[#fafbf9]"
                >
                  <span>ปฏิทินโรงเรียน</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf5ef] px-2.5 py-0.5 text-xs font-bold text-[#1c573d]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2f7d5b]" />
                      {formatThaiShortDate(todayDateStr)} · {todayLessons.length} คาบวันนี้
                    </span>
                    {todayEvents.length > 0 ? (
                      <Link
                        to="/app/dashboard?view=school-calendar"
                        className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-800 transition hover:bg-purple-100"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                        <span className="max-w-[200px] truncate">
                          วันนี้: {todayEvents[0].title}
                          {todayEvents.length > 1 ? ` (+${todayEvents.length - 1})` : ''}
                        </span>
                      </Link>
                    ) : null}
                    {nextUpcomingEvent ? (
                      <Link
                        to="/app/dashboard?view=school-calendar"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#f2dc9b] bg-[#fffaf0] px-2.5 py-0.5 text-xs font-semibold text-[#946208] transition hover:bg-[#fff3d6]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d98b26]" />
                        <span className="max-w-[200px] truncate">
                          {nextUpcomingEvent.daysFromNow === 1
                            ? 'พรุ่งนี้'
                            : `อีก ${nextUpcomingEvent.daysFromNow} วัน`}{' '}
                          · {nextUpcomingEvent.title}
                        </span>
                      </Link>
                    ) : null}
                  </div>
                  <h2 className="mt-2 font-display text-[18px] font-extrabold tracking-tight text-[#1f2924]">
                    คาบสอนวันนี้ของคุณครู
                  </h2>
                </div>
                <Link
                  to="/app/dashboard?view=schedule"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-[#5c6861] transition hover:bg-[#f2f4f0]"
                >
                  <span>ดูตารางเต็ม</span>
                  <ChevronRight size={13} aria-hidden="true" />
                </Link>
              </div>

              {featuredLessons.length === 0 ? (
                <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-[#e3e7e0] bg-[#fafbf9] px-4 py-5 text-center">
                  <p className="text-xs font-bold text-[#4c5751]">
                    ยังไม่มีคาบสอนที่ตั้งค่าไว้สำหรับวัน{currentThaiDay}
                  </p>
                  <p className="mt-1 text-xs text-[#75827a]">
                    เพิ่มคาบเรียนในตารางสอน หรือกดเช็กชื่อประจำวันได้เลย
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Link
                      to="/app/dashboard?view=schedule"
                      className="rounded-full border border-[#dce3d7] bg-white px-3.5 py-1.5 text-xs font-bold text-[#1f2924] transition hover:bg-[#f3f4f1]"
                    >
                      ตั้งค่าตารางสอน
                    </Link>
                    <Link
                      to="/app/dashboard?view=teacher-work"
                      className="rounded-full bg-[#2f7d5b] px-3.5 py-1.5 text-xs font-bold text-white transition hover:brightness-105"
                    >
                      เช็กชื่อประจำวัน
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-[#f2f4f0]">
                  {featuredLessons.map((lesson, idx) => {
                    const isHighlighted = idx === highlightLessonIndex;
                    if (isHighlighted) {
                      return (
                        <div
                          key={`${lesson.index}-${lesson.subject}`}
                          className="my-1 flex items-center justify-between gap-3 rounded-2xl border border-[#bfe0cd] bg-[#eaf5ef] px-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-11 shrink-0 text-xs font-extrabold tabular-nums text-[#1c573d]">
                              {lesson.start}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-extrabold text-[#1f2924]">
                                {lesson.subject} · {lesson.classroom}
                              </div>
                              <div className="text-xs font-semibold text-[#1c573d]">
                                {lesson.label} · {lesson.isCurrent ? 'กำลังสอนอยู่ตอนนี้' : 'คาบถัดไป'}
                              </div>
                            </div>
                          </div>
                          <Link
                            to="/app/dashboard?view=teacher-work"
                            className="shrink-0 rounded-full bg-[#2f7d5b] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:brightness-105"
                          >
                            เช็กชื่อเลย
                          </Link>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${lesson.index}-${lesson.subject}`}
                        className="flex items-center justify-between gap-3 py-2 first:pt-1 last:pb-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-11 shrink-0 text-xs font-bold tabular-nums text-[#7c8780]">
                            {lesson.start}
                          </span>
                          <div className="min-w-0 truncate text-[13px] font-bold text-[#4c5751]">
                            {lesson.subject} · {lesson.classroom}{' '}
                            <span className="font-normal text-[#8a958e]">· {lesson.label}</span>
                          </div>
                        </div>
                        {lesson.checked ? (
                          <span className="shrink-0 rounded-full bg-[#eaf6ef] px-2.5 py-0.5 text-xs font-bold text-[#246b4b]">
                            เช็กแล้ว ✓
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-semibold text-[#8a958e]">
                            {lesson.isPast ? 'ยังไม่เช็ก' : 'รอถึงเวลา'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Right Hero Card: Daily Savings Statistics Report */}
        <section
          aria-label="รายงานสถิติเงินออมรายวัน"
          className="bento-card relative flex min-h-[246px] flex-col justify-between overflow-hidden p-5 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#f5dfc0] bg-[#fff5e6] text-[#c7741a]">
                <PiggyBank size={14} aria-hidden="true" />
              </span>
              <span className="truncate text-[14px] font-extrabold text-[#1f2924]">เงินออมรายวัน</span>
              <span
                className="shrink-0 rounded-full bg-[#eef4f0] px-2 py-0.5 text-xs font-bold text-[#1c573d]"
                title={isHomeroom ? 'ห้องที่ปรึกษา' : 'ห้องเรียนที่เลือก'}
              >
                {classroomName}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                to="/app/dashboard?view=savings"
                className="rounded-full bg-[#eaf5ef] px-2.5 py-1 text-xs font-bold text-[#1c573d] transition hover:brightness-95"
              >
                บันทึกออม
              </Link>
              <Link
                to="/app/dashboard?view=reports&reportView=savings"
                className="rounded-full px-2 py-1 text-xs font-bold text-[#5c6861] transition hover:bg-[#f2f4f0]"
              >
                รายงาน ›
              </Link>
            </div>
          </div>

          {/* Middle KPI Strip: 3-column typographic layout with hairlines */}
          <div className="my-2.5 grid grid-cols-3 divide-x divide-[#eff1ec]">
            <div className="pr-2.5">
              <div className="text-xs text-[#75827a]">ฝากวันนี้</div>
              <div
                className={`mt-0.5 text-[18px] font-extrabold tabular-nums tracking-tight ${
                  isRestDay && dailySavings.todayDeposit === 0 ? 'text-[#75827a]' : 'text-[#1f2924]'
                }`}
              >
                {dailySavings.todayDeposit > 0
                  ? `+฿${dailySavings.todayDeposit.toLocaleString('th-TH')}`
                  : '฿0'}
              </div>
              <div className="truncate text-xs tabular-nums text-[#8a958e]">
                {isRestDay && dailySavings.todayDeposit === 0
                  ? 'วันหยุด'
                  : `สุทธิ ${netToday >= 0 ? '+' : ''}฿${netToday.toLocaleString('th-TH')}`}
              </div>
            </div>

            <div className="px-2.5">
              <div className="text-xs text-[#75827a]">ผู้ร่วมออม</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-[18px] font-extrabold tabular-nums tracking-tight ${
                    dailySavings.todaySavers === 0 ? 'text-[#75827a]' : 'text-[#1f2924]'
                  }`}
                >
                  {dailySavings.todaySavers}/{dailySavings.studentsTotal}
                </span>
                {dailySavings.studentsTotal > 0 && dailySavings.todaySavers > 0 ? (
                  <span className="rounded-full bg-[#eaf5ef] px-1.5 py-0.5 text-xs font-bold leading-none tabular-nums text-[#1c573d]">
                    {saverPct}%
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs text-[#8a958e]">
                {isRestDay && dailySavings.todaySavers === 0 ? 'เปิดรอบวันจันทร์' : 'คนในห้อง'}
              </div>
            </div>

            <div className="pl-2.5">
              <div className="text-xs text-[#75827a]">สะสมทั้งห้อง</div>
              <div className="mt-0.5 text-[18px] font-extrabold tabular-nums tracking-tight text-[#1f2924]">
                ฿{dailySavings.totalBalance.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
              </div>
              <div className="truncate text-xs font-semibold tabular-nums text-[#1c573d]">
                เดือนนี้ +฿{dailySavings.monthlyDeposits.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Bottom Section: Sleek 5-bar deposit chart */}
          <div className="border-t border-[#f1f3ef] pt-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#5c6861]">ยอดฝากรายวัน (จ.–ศ.)</span>
              <span className="text-xs font-bold tabular-nums text-[#1c573d]">
                รวมสัปดาห์ ฿{weeklySavingsTotal.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="grid grid-cols-5 items-end gap-1.5">
              {dailySavings.dailyBars.map((bar) => {
                const barHeight = bar.amount > 0
                  ? Math.max(14, Math.round((bar.amount / maxSavingsBar) * 46))
                  : 10;
                const barClass = bar.amount === 0
                  ? 'bg-[#eef0ec]'
                  : bar.isToday
                    ? 'bg-[#2f7d5b]'
                    : isRestDay
                      ? 'bg-[#2f7d5b]/75'
                      : 'bg-[#bfe0cd]';
                return (
                  <Link
                    key={bar.date}
                    to="/app/dashboard?view=savings"
                    title={`วัน${bar.fullDay} · ยอดฝาก ฿${bar.amount.toLocaleString('th-TH')}`}
                    className="group flex flex-col items-center justify-end gap-1"
                  >
                    <span
                      className={`text-xs tabular-nums transition ${
                        bar.isToday
                          ? 'font-bold text-[#1f2924]'
                          : bar.amount > 0
                            ? 'font-semibold text-[#75827a] group-hover:text-[#1f2924]'
                            : 'font-medium text-[#a3aea7]'
                      }`}
                    >
                      ฿{bar.amount.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </span>
                    <div
                      className={`w-full max-w-[30px] rounded-b-sm rounded-t-md transition-all duration-300 group-hover:brightness-95 ${barClass}`}
                      style={{ height: `${barHeight}px` }}
                    />
                    <span
                      className={`text-xs leading-none ${
                        bar.isToday ? 'font-extrabold text-[#1f2924]' : 'font-semibold text-[#8a958e]'
                      }`}
                    >
                      {bar.day}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ROW 2 & 3: EXACT 4-COLUMN ASYMMETRIC BENTO GRID */}
      <div className="grid grid-cols-1 items-stretch gap-3.5 md:grid-cols-2 lg:grid-cols-4">
        {/* Left 3-col 2-row grid */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 md:col-span-2 lg:col-span-3">
          {/* Card 1: เช็กชื่อ (7-Day Dots) */}
          <Link
            to="/app/dashboard?view=teacher-work"
            className="bento-card bento-card-clickable flex min-h-[144px] flex-col justify-between p-4 text-left"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eaf6ef] text-[#2f7d5b]">
                  <CalendarCheck2 size={14} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-bold text-[#1f2924]">เช็กชื่อ</span>
              </div>
              <ChevronRight size={14} className="text-[#9aa59e]" aria-hidden="true" />
            </div>

            <div className="my-2 flex w-full items-center justify-between gap-1">
              {weeklyAttendanceDays.map((dayItem) => (
                <div key={dayItem.date} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                      dayItem.checked
                        ? 'border border-[#bfe0cd] bg-[#eaf5ef] text-[#1c573d]'
                        : dayItem.isToday
                          ? 'border border-dashed border-[#b9c4bc] bg-white text-[#1f2924]'
                          : 'bg-[#f1f3ef] text-[#9aa59e]'
                    }`}
                  >
                    {dayItem.checked ? '✓' : ''}
                  </span>
                  <span
                    className={`text-xs leading-none ${
                      dayItem.isToday ? 'font-bold text-[#1f2924]' : 'text-[#8a958e]'
                    }`}
                  >
                    {dayItem.dayLabel}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-xs text-[#75827a]">
              {todayLessons.length > 0
                ? `วันนี้เช็กแล้ว ${todayCheckedSessionCount} จาก ${todayLessons.length} คาบ`
                : `วันนี้เช็กแล้ว ${todayCheckedSessionCount} รอบ`}
            </div>
          </Link>

          {/* Card 2: คะแนน (Donut Progress) */}
          <Link
            to="/app/dashboard?view=scores&scoreView=excel"
            className="bento-card bento-card-clickable flex min-h-[144px] flex-col justify-between p-4 text-left"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef1ff] text-[#4f5bd5]">
                  <BarChart3 size={14} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-bold text-[#1f2924]">คะแนน</span>
              </div>
              <ChevronRight size={14} className="text-[#9aa59e]" aria-hidden="true" />
            </div>

            <div className="my-1.5 flex w-full items-center gap-3">
              <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0 -rotate-90" aria-hidden="true">
                <circle cx="22" cy="22" r={ringRadius} fill="none" stroke="#eef0ec" strokeWidth="5" />
                <circle
                  cx="22"
                  cy="22"
                  r={ringRadius}
                  fill="none"
                  stroke="#2f7d5b"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  style={{ transition: 'stroke-dashoffset 300ms ease' }}
                />
              </svg>
              <div className="min-w-0">
                <div className="text-[17px] font-extrabold leading-tight tabular-nums text-[#1f2924]">
                  {scoresSummary.gradedAssessments}/{scoresSummary.totalAssessments}
                </div>
                <div className="truncate text-xs text-[#75827a]">ชิ้นงานที่ลงคะแนนแล้ว</div>
              </div>
            </div>

            <div className="truncate text-xs text-[#75827a]">
              {scoresSummary.totalAssessments > 0
                ? `${classroomName} เฉลี่ย ${scoresSummary.averagePercent}% · พร้อม ปพ.5`
                : 'ยังไม่มีชุดคะแนนในภาคเรียนนี้'}
            </div>
          </Link>

          {/* Card 3: สุขภาพ & กิจวัตรประจำวัน */}
          <Link
            to="/app/dashboard?view=student-health"
            className="bento-card bento-card-clickable flex min-h-[144px] flex-col justify-between p-4 text-left"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fdf0f5] text-[#c24d78]">
                  <HeartPulse size={14} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-bold text-[#1f2924]">สุขภาพ & กิจวัตร</span>
              </div>
              <ChevronRight size={14} className="text-[#9aa59e]" aria-hidden="true" />
            </div>

            <div className="my-1.5 w-full space-y-1.5">
              {healthRoutineSummary.items.slice(0, 3).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        item.done ? 'bg-[#2f7d5b]' : item.recorded > 0 ? 'bg-[#d97706]' : 'bg-[#d4dad5]'
                      }`}
                    />
                    <span className="truncate font-medium text-[#3b4740]">{item.label}</span>
                  </div>
                  <span className="shrink-0 tabular-nums font-semibold text-[#5c6861]">
                    {item.total > 0 ? `${item.recorded}/${item.total}` : 'รอเช็ค'}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-xs text-[#75827a]">
              {healthRoutineSummary.totalRoutines > 0
                ? `บันทึกครบ ${healthRoutineSummary.completedCount}/${healthRoutineSummary.totalRoutines} กิจวัตรวันนี้`
                : 'ยังไม่มีการเช็คสุขภาพวันนี้'}
            </div>
          </Link>

          {/* Card 4: ภาคเรียน & ปพ.5 */}
          <div className="bento-card bento-card-clickable flex min-h-[144px] flex-col justify-between p-4 text-left">
            <Link to="/app/dashboard?view=academic-hub" className="block flex-1">
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef7fb] text-[#28769c]">
                    <BookOpen size={14} aria-hidden="true" />
                  </span>
                  <span className="text-[14px] font-bold text-[#1f2924]">ภาคเรียน &amp; ปพ.5</span>
                </div>
                <ChevronRight size={14} className="text-[#9aa59e]" aria-hidden="true" />
              </div>

              {termProgress ? (
                <div className="my-2 w-full space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#4c5751]">
                        เทอม {termSummary.termName || 'ปัจจุบัน'} · สัปดาห์ {termProgress.currentWeek}/{termProgress.totalWeeks}
                      </span>
                      <span className="font-bold tabular-nums text-[#2f7d5b]">{termProgress.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#eff2ed]">
                      <div
                        className="h-full rounded-full bg-[#2f7d5b] transition-all duration-300"
                        style={{ width: `${termProgress.percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6b7770]">
                    <span>ความพร้อม ปพ.5 ก่อนปิดเทอม</span>
                    <span className="font-extrabold tabular-nums text-[#1f2924]">{termSummary.readinessPercent}%</span>
                  </div>
                </div>
              ) : (
                <div className="my-2 space-y-1">
                  <div className="text-xs font-semibold text-[#5c6861]">ยังไม่ได้ตั้งวันเปิด–ปิดภาคเรียน</div>
                  <div className="flex items-center gap-2 text-xs text-[#75827a]">
                    <span>ความพร้อม ปพ.5</span>
                    <span className="font-extrabold tabular-nums text-[#2f7d5b]">{termSummary.readinessPercent}%</span>
                  </div>
                </div>
              )}
            </Link>

            <div className="w-full border-t border-[#f2f4f0] pt-1.5">
              <Link
                to="/app/dashboard?view=academic-year"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] transition hover:opacity-80"
              >
                <span>ตั้งวันเปิด–ปิดภาคเรียน ›</span>
              </Link>
            </div>
          </div>

          {/* Card 5: ตารางสอน (Mini Weekly Grid) */}
          <Link
            to="/app/dashboard?view=schedule"
            className="bento-card bento-card-clickable flex min-h-[144px] flex-col justify-between p-4 text-left"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3efff] text-[#6d54c8]">
                  <CalendarRange size={14} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-bold text-[#1f2924]">ตารางสอน</span>
              </div>
              <ChevronRight size={14} className="text-[#9aa59e]" aria-hidden="true" />
            </div>

            <div className="mt-2 grid w-full grid-cols-5 gap-1.5 text-center">
              {WEEKDAY_KEYS.map((dayName, dayIdx) => (
                <div key={dayName}>
                  <div
                    className={`mb-1 text-xs ${
                      dayName === currentThaiDay ? 'font-extrabold text-[#1c573d]' : 'font-bold text-[#8a958e]'
                    }`}
                  >
                    {WEEKDAY_SHORT[dayIdx]}
                  </div>
                  <div className="space-y-1">
                    {miniPeriods.map((period) => {
                      const hasCell = Boolean(
                        weeklySchedule.cells?.[makeScheduleCellKey(dayName, period.index)]?.subject?.trim(),
                      );
                      return (
                        <div
                          key={`${dayName}-${period.index}`}
                          className={`h-1.5 rounded-sm ${
                            hasCell
                              ? dayName === currentThaiDay
                                ? 'bg-[#2f7d5b]'
                                : 'bg-[#bfe0cd]'
                              : 'bg-[#eef0ec]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Link>

          {/* Card 6: เทียบความคืบหน้าห้อง */}
          <div className="bento-card flex min-h-[144px] flex-col justify-between p-4 text-left">
            <Link to="/app/dashboard?view=students" className="flex w-full items-center justify-between group">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fff4e8] text-[#c7741a]">
                  <Users size={14} aria-hidden="true" />
                </span>
                <span className="text-[14px] font-bold text-[#1f2924] group-hover:text-[#1c573d]">
                  เทียบความคืบหน้าห้อง
                </span>
              </div>
              <ChevronRight size={14} className="text-[#9aa59e]" aria-hidden="true" />
            </Link>

            {classroomProgressItems.length === 0 ? (
              <div className="my-auto text-xs text-[#75827a]">ยังไม่มีข้อมูลห้องเรียน</div>
            ) : (
              <div className="mt-2 w-full space-y-1.5 text-xs">
                {classroomProgressItems.slice(0, 3).map((room) => {
                  const isSelected = room.id === selectedClassroomId;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => onSelectClassroom(room.id)}
                      title={`สลับไปดูข้อมูลห้อง ${room.name} (${room.studentCount} คน)`}
                      className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:bg-[#f3f4f1] ${
                        isSelected ? 'bg-[#eaf5ef]/70' : ''
                      }`}
                    >
                      <span
                        className={`w-12 truncate font-bold ${
                          isSelected ? 'text-[#1c573d]' : 'text-[#4c5751]'
                        }`}
                      >
                        {room.name}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef0ec]">
                        <div
                          className={`h-full rounded-full ${
                            room.percent >= 75 ? 'bg-[#2f7d5b]' : 'bg-[#d98b26]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(6, room.percent))}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums text-[#75827a]">
                        {room.percent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Tall Card: งานที่ต้องกลับมาทำ */}
        <section
          aria-label="งานที่ต้องกลับมาทำ"
          className="bento-card flex h-full min-h-[302px] flex-col justify-between p-4 lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fff6e5] text-[#c77d19]">
                <Clock size={14} aria-hidden="true" />
              </span>
              <span className="text-[14px] font-bold text-[#1f2924]">งานที่ต้องกลับมาทำ</span>
            </div>
            {catchUpItems.length > 0 ? (
              <span className="rounded-full bg-[#fff2e6] px-2 py-0.5 text-xs font-bold leading-none text-[#b45309] tabular-nums">
                {catchUpItems.length}
              </span>
            ) : null}
          </div>

          {catchUpItems.length === 0 ? (
            <>
              <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
                <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f7f1] text-[#24997a]">
                  <CheckCircle2 size={24} aria-hidden="true" />
                </div>
                <div className="text-[14px] font-extrabold text-[#1f8a6e]">เคลียร์หมดแล้ว</div>
              </div>
              <div className="text-xs text-[#75827a]">ไม่มีงานค้างจากวันก่อน</div>
            </>
          ) : (
            <>
              <div className="my-2 flex-1 divide-y divide-[#f1f3ef]">
                {catchUpItems.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="group -mx-1.5 block rounded-xl px-1.5 py-2.5 transition first:pt-1 last:pb-1 hover:bg-[#fafbf9]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-bold leading-snug text-[#1f2924] group-hover:text-[#1c573d]">
                        {item.title}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold leading-none ${item.tone}`}>
                        {item.badge}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#75827a]">{item.subtitle}</div>
                  </Link>
                ))}
              </div>
              <div className="border-t border-[#f2f4f0] pt-1.5 text-xs text-[#8a958e]">
                คลิกที่รายการเพื่อจัดการทันที
              </div>
            </>
          )}
        </section>
      </div>

      {/* ROW 3.2: SCHOOL CALENDAR & UPCOMING DIGEST */}
      <SchoolCalendarDigestCard
        events={calendarEvents}
        todayDateStr={todayDateStr}
        variant="today-bento"
      />

      {/* ROW 3.5: STUDENT 360° EARLY-WARNING RISK CARD */}
      {earlyWarningStudents.length > 0 && (
        <section
          aria-label="เฝ้าระวังนักเรียนเสี่ยง 360°"
          className="bento-card p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fdf0f3] text-[#be3a56]">
                <ShieldAlert size={15} aria-hidden="true" />
              </span>
              <div>
                <span className="text-[14px] font-bold text-[#1f2924]">
                  เฝ้าระวังนักเรียนเสี่ยง 360°
                </span>
                <span className="ml-2 text-xs text-[#75827a]">
                  ตรวจจับอัตโนมัติจากเวลาเรียน คะแนน พฤติกรรม และสุขภาพ ({classroomName})
                </span>
              </div>
            </div>
            <Link
              to="/app/dashboard?view=automation"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] hover:underline"
            >
              ศูนย์แจ้งเตือนเด็กเสี่ยง
              <ChevronRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {earlyWarningStudents.map((item) => (
              <Link
                key={item.studentId}
                to={`/app/dashboard?view=students&studentView=roster&studentId=${encodeURIComponent(item.studentId)}`}
                className="group flex items-start justify-between gap-2.5 rounded-2xl border border-[#eceee9] bg-[#fafbf9] p-3 transition hover:border-[#f0c7d0] hover:bg-white"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle
                      size={13}
                      className={item.riskLevel === 'high' ? 'text-[#be3a56]' : 'text-[#c77d19]'}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[13px] font-bold text-[#1f2924] group-hover:text-[#1c573d]">
                      {item.studentName}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.reasons.slice(0, 2).map((reason) => (
                      <span
                        key={reason}
                        className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-[#5c6861] ring-1 ring-[#e6e9e3]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    item.riskLevel === 'high'
                      ? 'bg-[#fdf0f3] text-[#a3334c]'
                      : item.riskLevel === 'medium'
                        ? 'bg-[#fff4e5] text-[#b45309]'
                        : 'bg-[#eef6ff] text-[#1d547c]'
                  }`}
                >
                  {item.riskLevel === 'high' ? 'เสี่ยงสูง' : item.riskLevel === 'medium' ? 'ติดตาม' : 'เฝ้าระวัง'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ROW 4: SLIM SINGLE-ROW AI FEATURE SHOWCASE STRIP + EXPANDABLE FULL SHOWCASE */}
      <section aria-label="ผู้ช่วย AI ประจำห้องเรียน" className="space-y-3">
        <div className="bento-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ef] text-[#2f7d5b]">
                <Sparkles size={16} aria-hidden="true" />
              </div>
              <span className="text-[13.5px] font-bold text-[#1f2924]">ผู้ช่วย AI ประจำห้องเรียน</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5c6861]">
              <Link
                to="/app/dashboard?view=omr-scanner"
                className="rounded-full border border-[#e5e8e2] bg-[#fafbf9] px-3 py-1 transition hover:border-[#b9c4bc] hover:text-[#1f2924]"
              >
                สแกน OMR 360°
              </Link>
              <Link
                to="/app/dashboard?view=scores"
                className="rounded-full border border-[#e5e8e2] bg-[#fafbf9] px-3 py-1 transition hover:border-[#b9c4bc] hover:text-[#1f2924]"
              >
                OCR ใบคะแนน ปพ.5
              </Link>
              <Link
                to="/app/dashboard?view=scores"
                className="rounded-full border border-[#e5e8e2] bg-[#fafbf9] px-3 py-1 transition hover:border-[#b9c4bc] hover:text-[#1f2924]"
              >
                ออกข้อสอบ &amp; Rubric
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAiExpanded((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eaf5ef] px-3.5 py-1.5 text-xs font-bold text-[#1c573d] transition hover:brightness-95"
          >
            <span>{isAiExpanded ? 'ย่อลง' : 'ดูทั้งหมด'}</span>
            <ChevronRight
              size={13}
              className={`transition-transform ${isAiExpanded ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {isAiExpanded ? <AiFeatureShowcase session={session} /> : null}
      </section>

      {/* REAL OPTIONAL PWA INSTALL PILL */}
      {deferredPrompt && !isPwaDismissed ? (
        <div className="no-print fixed bottom-4 right-5 z-40 flex items-center gap-3 rounded-2xl border border-[#e4e7e0] bg-white px-3.5 py-2 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.16)] print:hidden">
          <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-[#1f2924]">
            <Download size={14} aria-hidden="true" />
            <span>ติดตั้งแอป</span>
          </div>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <button
              type="button"
              onClick={() => void handleInstallPwa()}
              className="rounded-full bg-[#2f7d5b] px-3 py-1 text-xs font-bold text-white transition hover:brightness-105"
            >
              ติดตั้ง
            </button>
            <button
              type="button"
              onClick={handleDismissPwa}
              aria-label="ปิดป้ายติดตั้งแอป"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[#75827a] transition hover:bg-[#f2f4f0]"
            >
              <X size={12} aria-hidden="true" />
              <span>ปิด</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
