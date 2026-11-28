import { getBangkokDate } from './date';
const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export function nextLessonDate(day: string, today = getBangkokDate()) {
  const date = new Date(`${today}T12:00:00+07:00`);
  const target = days.indexOf(day);
  if (target < 0) return today;
  date.setUTCDate(date.getUTCDate() + (target - date.getUTCDay() + 7) % 7);
  return date.toISOString().slice(0, 10);
}
export function lessonAttendancePath(day: string, classroom: string, subject: string, period: string) {
  const query = new URLSearchParams({ view: 'teacher-work', checkMode: 'subject', attendanceDate: nextLessonDate(day), classroomName: classroom, subjectName: subject, periodLabel: period });
  return `/app/dashboard?${query}`;
}
