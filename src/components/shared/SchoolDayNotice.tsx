import { ContextLink as Link } from '../navigation/ContextLink';
import type { useSchoolDay } from '../../hooks/useSchoolDay';
export function SchoolDayNotice({ calendar }: { calendar: ReturnType<typeof useSchoolDay> }) {
  return <aside className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-800" aria-live="polite">
    <span>{calendar.loading ? 'กำลังตรวจปฏิทินโรงเรียน…' : calendar.error || (calendar.day?.events.length ? calendar.day.events.map((event) => event.title).join(' · ') : 'ไม่มีวันพิเศษในปฏิทินโรงเรียนสำหรับวันที่เลือก')}{calendar.day?.blocked ? ' · วันงดเช็คชื่อ' : ''}</span>
    <div className="flex items-center gap-3">{calendar.error && <button type="button" onClick={calendar.refresh} className="min-h-11 rounded-lg border border-amber-300 px-3 font-bold">ลองใหม่</button>}<Link className="inline-flex min-h-11 items-center font-bold underline underline-offset-4" to="/app/dashboard?view=school-calendar">เปิดปฏิทินโรงเรียน</Link></div>
  </aside>;
}
