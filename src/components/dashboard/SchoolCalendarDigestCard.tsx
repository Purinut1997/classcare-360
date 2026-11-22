import { CalendarDays, ChevronRight, Plus, Umbrella } from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import {
  partitionCalendarEvents,
  type SchoolCalendarDigestEvent,
  type SchoolCalendarEventType,
} from '../../lib/schoolCalendarDigest';

export interface SchoolCalendarDigestCardProps {
  events: SchoolCalendarDigestEvent[];
  todayDateStr: string;
  variant?: 'today-bento' | 'overview';
}

const EVENT_TYPE_META: Record<
  SchoolCalendarEventType,
  {
    label: string;
    badgeClass: string;
    dateBoxClass: string;
    dotClass: string;
  }
> = {
  holiday: {
    label: 'วันหยุด',
    badgeClass: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80',
    dateBoxClass: 'bg-rose-50 text-rose-800 border-rose-200/70',
    dotClass: 'bg-rose-500',
  },
  exam: {
    label: 'วันสอบ',
    badgeClass: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80',
    dateBoxClass: 'bg-indigo-50 text-indigo-800 border-indigo-200/70',
    dotClass: 'bg-indigo-500',
  },
  activity: {
    label: 'กิจกรรมโรงเรียน',
    badgeClass: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200/80',
    dateBoxClass: 'bg-purple-50 text-purple-800 border-purple-200/70',
    dotClass: 'bg-purple-500',
  },
  makeup: {
    label: 'เรียนชดเชย',
    badgeClass: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80',
    dateBoxClass: 'bg-amber-50 text-amber-900 border-amber-200/70',
    dotClass: 'bg-amber-500',
  },
  custom: {
    label: 'กำหนดการ',
    badgeClass: 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80',
    dateBoxClass: 'bg-teal-50 text-teal-900 border-teal-200/70',
    dotClass: 'bg-teal-600',
  },
};

function formatBangkokShortDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(`${dateStr}T12:00:00+07:00`));
  } catch {
    return dateStr;
  }
}

function formatDateSpanLabel(startDate: string, endDate?: string): string {
  if (!endDate || endDate === startDate) {
    return formatBangkokShortDate(startDate);
  }
  const startLabel = formatBangkokShortDate(startDate);
  const endLabel = formatBangkokShortDate(endDate);
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    const startDay = startLabel.split(' ')[0] || startDate.slice(8, 10);
    return `${startDay}–${endLabel}`;
  }
  return `${startLabel}–${endLabel}`;
}

function formatCountdownLabel(daysFromNow: number): string {
  return daysFromNow === 1 ? 'พรุ่งนี้' : `อีก ${daysFromNow} วัน`;
}

/**
 * Compact school calendar summary card showing today's events, upcoming schedules,
 * and the next holiday across Today Dashboard and System Overview pages.
 */
export function SchoolCalendarDigestCard({
  events,
  todayDateStr,
  variant = 'today-bento',
}: SchoolCalendarDigestCardProps) {
  const { todayEvents, upcomingEvents, nextHoliday } = partitionCalendarEvents(events, todayDateStr);
  const hasTodayHoliday = todayEvents.some((ev) => ev.type === 'holiday');

  const containerClass =
    variant === 'overview'
      ? 'rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs'
      : 'bento-card p-4';

  return (
    <section aria-label="ปฏิทินโรงเรียนและกำหนดการ" className={containerClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#fff4e5] text-[#c7741a]">
            <CalendarDays size={15} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[14px] font-bold text-[#1f2924]">
              ปฏิทินโรงเรียน &amp; กำหนดการ
            </h2>
            <p className="text-xs font-medium text-[#75827a]">
              กิจกรรมวันนี้ กำหนดการ และวันหยุดใกล้ถึง
            </p>
          </div>
        </div>

        <Link
          to="/app/dashboard?view=school-calendar"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] hover:underline"
        >
          <span>เปิดปฏิทินเต็ม</span>
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Left: Today's Events + Next Holiday Highlight */}
        <div className="flex flex-col justify-between gap-2.5 lg:col-span-5">
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold tracking-wide text-[#5c6861]">
              กิจกรรมวันนี้
            </p>

            {todayEvents.length > 0 ? (
              <div className="space-y-2">
                {todayEvents.map((ev) => {
                  const meta = EVENT_TYPE_META[ev.type] ?? EVENT_TYPE_META.custom;
                  return (
                    <Link
                      key={ev.id}
                      to="/app/dashboard?view=school-calendar"
                      className="flex items-start justify-between gap-2.5 rounded-2xl border border-[#eceee9] bg-[#fafbf9] px-3 py-2.5 transition hover:border-[#bfe0cd] hover:bg-white"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                          {(ev.durationDays ?? 1) > 1 ? (
                            <span className="rounded-full bg-[#edf1ea] px-2 py-0.5 text-[10.5px] font-semibold text-[#55615a]">
                              {formatDateSpanLabel(ev.date, ev.endDate)} ({ev.durationDays} วัน)
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-[13px] font-bold text-[#1f2924]">
                          {ev.title}
                        </p>
                      </div>
                      <ChevronRight size={14} className="mt-1 shrink-0 text-[#9aa59e]" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#dce3d7] bg-[#fafbf9] px-3.5 py-3">
                <p className="text-xs font-semibold text-[#5c6861]">
                  วันนี้ไม่มีกิจกรรมพิเศษหรือวันหยุดในปฏิทิน
                </p>
                <Link
                  to="/app/dashboard?view=school-calendar"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] hover:underline"
                >
                  <Plus size={12} aria-hidden="true" />
                  <span>เพิ่มกิจกรรมในปฏิทิน</span>
                </Link>
              </div>
            )}
          </div>

          {nextHoliday && !hasTodayHoliday ? (
            <Link
              to="/app/dashboard?view=school-calendar"
              className="flex items-center justify-between gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-3 py-2 text-xs transition hover:bg-rose-50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Umbrella size={14} className="shrink-0 text-rose-600" aria-hidden="true" />
                <span className="truncate font-semibold text-rose-900">
                  วันหยุดถัดไป: {formatDateSpanLabel(nextHoliday.date, nextHoliday.endDate)} · {nextHoliday.title}
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-rose-700 ring-1 ring-rose-200/80">
                {formatCountdownLabel(nextHoliday.daysFromNow)}
              </span>
            </Link>
          ) : null}
        </div>

        {/* Right: Upcoming Events & Holidays */}
        <div className="lg:col-span-7">
          <p className="mb-1.5 text-[11px] font-extrabold tracking-wide text-[#5c6861]">
            กิจกรรม &amp; วันหยุดใกล้ถึง
          </p>

          {upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {upcomingEvents.slice(0, 4).map((ev) => {
                const meta = EVENT_TYPE_META[ev.type] ?? EVENT_TYPE_META.custom;
                const isSoon = ev.daysFromNow <= 7;
                return (
                  <Link
                    key={ev.id}
                    to="/app/dashboard?view=school-calendar"
                    className="group flex items-center gap-2.5 rounded-2xl border border-[#eceee9] bg-[#fafbf9] px-3 py-2.5 transition hover:border-[#bfe0cd] hover:bg-white"
                  >
                    <div
                      className={`flex min-w-[54px] shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center leading-tight ${meta.dateBoxClass}`}
                    >
                      <span className="text-[11px] font-extrabold tabular-nums">
                        {formatDateSpanLabel(ev.date, ev.endDate)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[#1f2924] group-hover:text-[#1c573d]">
                        {ev.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6b7770]">
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
                          {meta.label}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                            isSoon
                              ? 'bg-[#fff3d6] text-[#946208]'
                              : 'bg-white text-[#6b7770] ring-1 ring-[#e5e8e1]'
                          }`}
                        >
                          {formatCountdownLabel(ev.daysFromNow)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[94px] items-center justify-center rounded-2xl border border-dashed border-[#dce3d7] bg-[#fafbf9] px-4 text-center">
              <p className="text-xs font-medium text-[#75827a]">
                ยังไม่มีกำหนดการในช่วง 120 วันข้างหน้า
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
