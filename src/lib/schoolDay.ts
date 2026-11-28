import { supabase } from './supabaseClient';
import { getThaiPublicHolidays } from './thaiHolidays';
export const SCHOOL_CALENDAR_CHANGED = 'classcare:school-calendar-changed';
export interface SchoolDay { events: Array<{ title: string; day_type: string; affects_attendance: boolean }>; blocked: boolean; source: 'school' | 'preset'; }
export async function loadSchoolDay(workspaceId: string | undefined, date: string, demo = false): Promise<SchoolDay> {
  if (supabase && workspaceId && !demo) {
    const { data, error } = await supabase.from('school_calendar_days').select('title,day_type,affects_attendance').eq('workspace_id', workspaceId).eq('calendar_date', date);
    if (error) throw new Error('ยังตรวจปฏิทินโรงเรียนไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่');
    if (data?.length) return { events: data, blocked: data.some((row) => ['holiday', 'closed'].includes(row.day_type) && row.affects_attendance === false), source: 'school' };
    return { events: [], blocked: false, source: 'school' };
  }
  const holiday = getThaiPublicHolidays(Number(date.slice(0, 4))).find((item) => item.date === date);
  return { events: holiday ? [{ title: holiday.title, day_type: 'holiday', affects_attendance: true }] : [], blocked: false, source: 'preset' };
}
