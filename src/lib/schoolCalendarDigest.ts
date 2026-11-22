import { getBangkokDate } from './date';
import { supabase } from './supabaseClient';
import { getThaiPublicHolidays } from './thaiHolidays';

export type SchoolCalendarEventType = 'holiday' | 'exam' | 'activity' | 'makeup' | 'custom';

export interface SchoolCalendarDigestEvent {
  id: string;
  date: string;
  endDate?: string;
  durationDays?: number;
  title: string;
  type: SchoolCalendarEventType;
}

export interface UpcomingDigestEvent extends SchoolCalendarDigestEvent {
  daysFromNow: number;
}

function toEventType(value: string): SchoolCalendarEventType {
  if (value === 'holiday' || value === 'exam' || value === 'activity' || value === 'makeup') {
    return value;
  }
  return 'custom';
}

function toBangkokNoonMs(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00+07:00`).getTime();
}

/**
 * Merges consecutive calendar dates that share the same normalized title and event type
 * into a single multi-day event span.
 */
export function groupSchoolCalendarEvents(
  events: SchoolCalendarDigestEvent[],
): SchoolCalendarDigestEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const grouped: SchoolCalendarDigestEvent[] = [];

  for (const ev of sorted) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.title.trim().toLowerCase() === ev.title.trim().toLowerCase() &&
      last.type === ev.type
    ) {
      const lastEndDate = last.endDate || last.date;
      const lastDateTime = toBangkokNoonMs(lastEndDate);
      const currDateTime = toBangkokNoonMs(ev.date);
      const diffDays = Math.round((currDateTime - lastDateTime) / 86_400_000);

      if (diffDays === 1) {
        last.endDate = ev.date;
        const startDateTime = toBangkokNoonMs(last.date);
        last.durationDays = Math.round((currDateTime - startDateTime) / 86_400_000) + 1;
        continue;
      }
      if (diffDays === 0) {
        continue;
      }
    }

    grouped.push({
      ...ev,
      endDate: ev.endDate || ev.date,
      durationDays: ev.durationDays || 1,
    });
  }

  return grouped;
}

/**
 * Splits calendar events into events occurring today, upcoming events with day countdowns,
 * and the next upcoming school/public holiday.
 */
export function partitionCalendarEvents(
  events: SchoolCalendarDigestEvent[],
  todayStr: string,
): {
  todayEvents: SchoolCalendarDigestEvent[];
  upcomingEvents: UpcomingDigestEvent[];
  nextHoliday: UpcomingDigestEvent | null;
} {
  const todayEvents = events.filter((ev) => {
    const endDate = ev.endDate || ev.date;
    return todayStr >= ev.date && todayStr <= endDate;
  });

  const todayMs = toBangkokNoonMs(todayStr);
  const upcomingEvents: UpcomingDigestEvent[] = events
    .filter((ev) => ev.date > todayStr)
    .map((ev) => {
      const targetMs = toBangkokNoonMs(ev.date);
      const daysFromNow = Number.isFinite(targetMs) && Number.isFinite(todayMs)
        ? Math.max(1, Math.round((targetMs - todayMs) / 86_400_000))
        : 1;
      return {
        ...ev,
        daysFromNow,
      };
    });

  const nextHoliday = upcomingEvents.find((ev) => ev.type === 'holiday') ?? null;

  return {
    todayEvents,
    upcomingEvents,
    nextHoliday,
  };
}

export interface LoadSchoolCalendarDigestOptions {
  workspaceId?: string | null;
  profileId?: string | null;
  demoMode: boolean;
  limit?: number;
}

/**
 * Loads school calendar events and official Thai public holidays for today through the next 120 days,
 * merging database rows, local fallback storage, and Thai holiday presets.
 */
export async function loadSchoolCalendarDigest({
  workspaceId,
  profileId,
  demoMode,
  limit = 12,
}: LoadSchoolCalendarDigestOptions): Promise<SchoolCalendarDigestEvent[]> {
  const todayStr = getBangkokDate();
  const targetYear = Number(todayStr.slice(0, 4)) || new Date().getFullYear();
  const pastStr = getBangkokDate(new Date(Date.now() - 35 * 86_400_000));
  const futureStr = getBangkokDate(new Date(Date.now() + 120 * 86_400_000));

  const collected: SchoolCalendarDigestEvent[] = [];
  const seen = new Set<string>();

  const pushUnique = (event: SchoolCalendarDigestEvent) => {
    const key = `${event.date}|${event.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      collected.push(event);
    }
  };

  if (supabase && workspaceId && !demoMode) {
    try {
      const { data, error } = await supabase
        .from('school_calendar_days')
        .select('id, calendar_date, title, day_type')
        .eq('workspace_id', workspaceId)
        .gte('calendar_date', pastStr)
        .lte('calendar_date', futureStr)
        .neq('day_type', 'school_day')
        .order('calendar_date', { ascending: true })
        .limit(100);

      if (!error && data) {
        data.forEach((row) => {
          const date = String(row.calendar_date).slice(0, 10);
          pushUnique({
            id: String(row.id),
            date,
            title: String(row.title),
            type: toEventType(String(row.day_type || 'custom')),
          });
        });
      }
    } catch {
      // Ignore transient query failure and fall back to local rules & holiday presets.
    }
  }

  try {
    if (typeof window !== 'undefined') {
      const storageKey = `classcare:data-safety:${workspaceId || profileId || ''}`;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          calendarRules?: Array<{ id: string; date: string; title: string; type: string }>;
        };
        (parsed.calendarRules || []).forEach((item) => {
          if (item.date >= pastStr && item.date <= futureStr) {
            pushUnique({
              id: item.id || `local-${item.date}`,
              date: item.date,
              title: item.title,
              type: toEventType(item.type),
            });
          }
        });
      }
    }
  } catch {
    // Ignore localStorage parse/access errors.
  }

  const presets = [...getThaiPublicHolidays(targetYear), ...getThaiPublicHolidays(targetYear + 1)];
  presets.forEach((preset, idx) => {
    if (preset.date >= pastStr && preset.date <= futureStr) {
      pushUnique({
        id: `preset-${preset.date}-${idx}`,
        date: preset.date,
        title: preset.title,
        type: toEventType(preset.type),
      });
    }
  });

  collected.sort((a, b) => a.date.localeCompare(b.date));
  const groupedEvents = groupSchoolCalendarEvents(collected);
  const activeOrUpcoming = groupedEvents.filter((ev) => (ev.endDate || ev.date) >= todayStr);

  return activeOrUpcoming.slice(0, limit);
}
