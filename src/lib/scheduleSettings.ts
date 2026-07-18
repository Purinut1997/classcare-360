export type DayName = 'จันทร์' | 'อังคาร' | 'พุธ' | 'พฤหัสบดี' | 'ศุกร์' | 'เสาร์' | 'อาทิตย์';

export interface ScheduleCell {
  classroom: string;
  subject: string;
  subjectCode?: string;
}

export interface SchedulePeriod {
  end: string;
  index: number;
  label: string;
  start: string;
}

export interface ScheduleSettings {
  activeDays: DayName[];
  cells: Record<string, ScheduleCell>;
  classroomOptions: string[];
  courseTitle: string;
  lunchEnd: string;
  lunchStart: string;
  periodCount: number;
  periodMinutes: number;
  startTime: string;
  subjectOptions: string[];
}

export interface SchoolReportIdentity {
  academicHeadName: string;
  academicYear: string;
  classroomName: string;
  directorName: string;
  schoolLogoDataUrl: string;
  schoolName: string;
  teacherName: string;
}

const scheduleStorageKey = 'classcare.schedule.settings.v1';
const reportIdentityStorageKey = 'classcare.school.report.identity.v1';

export const defaultDays: DayName[] = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

export const defaultSubjectOptions = [
  'โฮมรูม',
  'คณิตศาสตร์',
  'ภาษาไทย',
  'วิทยาศาสตร์',
  'สังคมศึกษา',
  'ภาษาอังกฤษ',
  'ศิลปะ',
  'สุขศึกษา',
  'กิจกรรมแนะแนว',
];

export function makeScheduleCellKey(day: string, periodIndex: number) {
  return `${day}-${periodIndex}`;
}

export function getDefaultScheduleSettings(classroomName = 'ป.5/1'): ScheduleSettings {
  return {
    activeDays: defaultDays.slice(0, 5),
    cells: {
      [makeScheduleCellKey('จันทร์', 1)]: { classroom: classroomName, subject: 'โฮมรูม', subjectCode: 'HR' },
      [makeScheduleCellKey('จันทร์', 2)]: { classroom: classroomName, subject: 'คณิตศาสตร์', subjectCode: 'ค15101' },
    },
    classroomOptions: [classroomName].filter(Boolean),
    courseTitle: 'ตารางสอนประจำสัปดาห์',
    lunchEnd: '12:30',
    lunchStart: '11:40',
    periodCount: 7,
    periodMinutes: 60,
    startTime: '08:30',
    subjectOptions: defaultSubjectOptions,
  };
}

export function getDefaultSchoolReportIdentity(): SchoolReportIdentity {
  return {
    academicHeadName: '',
    academicYear: '2569',
    classroomName: 'ป.5/1',
    directorName: '',
    schoolLogoDataUrl: '',
    schoolName: 'โรงเรียนตัวอย่าง ClassCare',
    teacherName: '',
  };
}

function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadScheduleSettings(classroomName?: string): ScheduleSettings {
  const fallback = getDefaultScheduleSettings(classroomName);
  const stored = readStorageJson<ScheduleSettings>(scheduleStorageKey, fallback);
  return {
    ...fallback,
    ...stored,
    activeDays: stored.activeDays?.length ? stored.activeDays : fallback.activeDays,
    classroomOptions: stored.classroomOptions?.length ? stored.classroomOptions : fallback.classroomOptions,
    subjectOptions: stored.subjectOptions?.length ? stored.subjectOptions : fallback.subjectOptions,
  };
}

export function saveScheduleSettings(settings: ScheduleSettings) {
  writeStorageJson(scheduleStorageKey, settings);
}

export function loadSchoolReportIdentity(): SchoolReportIdentity {
  return readStorageJson<SchoolReportIdentity>(reportIdentityStorageKey, getDefaultSchoolReportIdentity());
}

export function saveSchoolReportIdentity(identity: SchoolReportIdentity) {
  writeStorageJson(reportIdentityStorageKey, identity);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function toTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function buildSchedulePeriods(settings: Pick<ScheduleSettings, 'lunchEnd' | 'lunchStart' | 'periodCount' | 'periodMinutes' | 'startTime'>) {
  const periods: SchedulePeriod[] = [];
  let cursor = toMinutes(settings.startTime);
  const lunchStartMinutes = toMinutes(settings.lunchStart);
  const lunchEndMinutes = toMinutes(settings.lunchEnd);

  for (let index = 1; index <= settings.periodCount; index += 1) {
    if (cursor >= lunchStartMinutes && cursor < lunchEndMinutes) {
      cursor = lunchEndMinutes;
    }

    const end = cursor + settings.periodMinutes;
    periods.push({
      end: toTime(end),
      index,
      label: `คาบ ${index}`,
      start: toTime(cursor),
    });
    cursor = end;
  }

  return periods;
}

export function getAttendanceOptionsFromSchedule() {
  const settings = loadScheduleSettings();
  const periods = buildSchedulePeriods(settings);
  const periodOptions = Array.from(
    new Set([
      'เช้า',
      'บ่าย',
      ...periods.map((period) => `${period.label} (${period.start}-${period.end})`),
      ...periods.map((period) => period.label),
    ]),
  );
  const subjectOptions = Array.from(
    new Set([
      ...defaultSubjectOptions,
      ...(settings.subjectOptions || []),
      ...Object.values(settings.cells || {}).map((cell) => cell.subject).filter(Boolean),
    ]),
  );

  return { periodOptions, subjectOptions };
}

export async function compressImageFile(file: File, maxSize = 520, quality = 0.78) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
    element.onload = () => resolve(element);
    element.src = dataUrl;
  });

  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export function exportScheduleCsv(settings: ScheduleSettings) {
  const periods = buildSchedulePeriods(settings);
  const rows = [['day', 'period', 'start', 'end', 'subject_code', 'subject', 'classroom']];

  for (const day of settings.activeDays) {
    for (const period of periods) {
      const cell = settings.cells[makeScheduleCellKey(day, period.index)];
      rows.push([day, period.label, period.start, period.end, cell?.subjectCode || '', cell?.subject || '', cell?.classroom || '']);
    }
  }

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'classcare-schedule.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
