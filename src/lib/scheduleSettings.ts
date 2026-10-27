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

export interface ScheduleSubjectOption {
  code: string;
  name: string;
  teacherName?: string;
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
  subjects: ScheduleSubjectOption[];
  subjectOptions: string[];
}

export interface SchoolReportIdentity {
  academicHeadName: string;
  academicYear: string;
  classroomName: string;
  coAdvisorName: string;
  directorName: string;
  directorPosition?: string;
  registrarName: string;
  schoolLogoDataUrl: string;
  schoolName: string;
  teacherName: string;
  district?: string;
  province?: string;
  jurisdiction?: string;
  useGarudaInsteadOfLogo?: boolean;
}

const scheduleStorageKey = 'classcare.schedule.settings.v1';
const reportIdentityStorageKey = 'classcare.school.report.identity.v1';

function getWorkspaceStorageKey(baseKey: string, workspaceId?: string | null) {
  const normalizedWorkspaceId = workspaceId?.trim();
  return normalizedWorkspaceId ? `${baseKey}.workspace.${normalizedWorkspaceId}` : baseKey;
}

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

export const defaultScheduleSubjects: ScheduleSubjectOption[] = [
  { code: 'HR', name: 'โฮมรูม' },
  { code: 'ค15101', name: 'คณิตศาสตร์' },
  { code: 'ท15101', name: 'ภาษาไทย' },
  { code: 'ว15101', name: 'วิทยาศาสตร์' },
  { code: 'ส15101', name: 'สังคมศึกษา' },
  { code: 'อ15101', name: 'ภาษาอังกฤษ' },
  { code: 'ศ15101', name: 'ศิลปะ' },
  { code: 'พ15101', name: 'สุขศึกษา' },
  { code: 'ก15901', name: 'กิจกรรมแนะแนว' },
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
    subjects: defaultScheduleSubjects,
    subjectOptions: defaultSubjectOptions,
  };
}

export function getDefaultSchoolReportIdentity(): SchoolReportIdentity {
  return {
    academicHeadName: '',
    academicYear: '2569',
    classroomName: 'ป.5/1',
    coAdvisorName: '',
    directorName: '',
    directorPosition: 'ผู้อำนวยการสถานศึกษา',
    registrarName: '',
    schoolLogoDataUrl: '',
    schoolName: 'โรงเรียนตัวอย่าง ClassCare',
    teacherName: '',
    district: 'อ.ขุขันธ์',
    province: 'จ.ศรีสะเกษ',
    jurisdiction: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3',
    useGarudaInsteadOfLogo: false,
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

export function loadScheduleSettings(classroomName?: string, workspaceId?: string | null): ScheduleSettings {
  const fallback = getDefaultScheduleSettings(classroomName);
  const stored = readStorageJson<ScheduleSettings>(getWorkspaceStorageKey(scheduleStorageKey, workspaceId), fallback);
  const storedSubjects = (stored.subjects || [])
    .map((subject) => ({
      code: subject.code?.trim() || '',
      name: subject.name?.trim() || '',
      teacherName: subject.teacherName?.trim() || '',
    }))
    .filter((subject) => subject.name);
  const legacySubjects: ScheduleSubjectOption[] = (stored.subjectOptions || [])
    .filter(Boolean)
    .map((name) => ({ code: '', name, teacherName: '' }));
  const subjectMap = new Map<string, ScheduleSubjectOption>();
  [...fallback.subjects, ...legacySubjects, ...storedSubjects].forEach((subject) => {
    if (!subject.name) return;
    subjectMap.set(subject.name, {
      code: subject.code || subjectMap.get(subject.name)?.code || '',
      name: subject.name,
      teacherName: subject.teacherName || subjectMap.get(subject.name)?.teacherName || '',
    });
  });
  const subjects = Array.from(subjectMap.values());
  const subjectOptions = Array.from(
    new Set([
      ...fallback.subjectOptions,
      ...(stored.subjectOptions || []),
      ...subjects.map((subject) => subject.name),
      ...Object.values(stored.cells || {}).map((cell) => cell.subject).filter(Boolean),
    ]),
  );

  return {
    ...fallback,
    ...stored,
    activeDays: stored.activeDays?.length ? stored.activeDays : fallback.activeDays,
    classroomOptions: stored.classroomOptions?.length ? stored.classroomOptions : fallback.classroomOptions,
    subjects,
    subjectOptions,
  };
}

export function saveScheduleSettings(settings: ScheduleSettings, workspaceId?: string | null) {
  writeStorageJson(getWorkspaceStorageKey(scheduleStorageKey, workspaceId), settings);
}

export function loadSchoolReportIdentity(workspaceId?: string | null): SchoolReportIdentity {
  return readStorageJson<SchoolReportIdentity>(
    getWorkspaceStorageKey(reportIdentityStorageKey, workspaceId),
    getDefaultSchoolReportIdentity(),
  );
}

export function saveSchoolReportIdentity(identity: SchoolReportIdentity, workspaceId?: string | null) {
  writeStorageJson(getWorkspaceStorageKey(reportIdentityStorageKey, workspaceId), identity);
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
  const hasLunchBreak = lunchEndMinutes > lunchStartMinutes;

  for (let index = 1; index <= settings.periodCount; index += 1) {
    const periodEnd = cursor + settings.periodMinutes;
    const overlapsLunchBreak = hasLunchBreak && cursor < lunchEndMinutes && periodEnd > lunchStartMinutes;

    if (overlapsLunchBreak) {
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

export function getAttendanceOptionsFromSchedule(workspaceId?: string | null) {
  const settings = loadScheduleSettings(undefined, workspaceId);
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
      ...(settings.subjects || []).map((subject) => subject.name),
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

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
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

export interface ScheduleCardTheme {
  accentDot: string;
  badge: string;
  card: string;
  subtext: string;
}

export const thaiDayStyles: Record<string, { badge: string; bar: string; bg: string; text: string }> = {
  'จันทร์': { badge: 'bg-amber-100 text-amber-900 border-amber-300', bar: 'bg-amber-400', bg: 'bg-amber-50/70', text: 'text-amber-950' },
  'อังคาร': { badge: 'bg-pink-100 text-pink-900 border-pink-300', bar: 'bg-pink-400', bg: 'bg-pink-50/70', text: 'text-pink-950' },
  'พุธ': { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', bar: 'bg-emerald-400', bg: 'bg-emerald-50/70', text: 'text-emerald-950' },
  'พฤหัสบดี': { badge: 'bg-orange-100 text-orange-900 border-orange-300', bar: 'bg-orange-400', bg: 'bg-orange-50/70', text: 'text-orange-950' },
  'ศุกร์': { badge: 'bg-sky-100 text-sky-900 border-sky-300', bar: 'bg-sky-400', bg: 'bg-sky-50/70', text: 'text-sky-950' },
  'เสาร์': { badge: 'bg-purple-100 text-purple-900 border-purple-300', bar: 'bg-purple-400', bg: 'bg-purple-50/70', text: 'text-purple-950' },
  'อาทิตย์': { badge: 'bg-red-100 text-red-900 border-red-300', bar: 'bg-red-400', bg: 'bg-red-50/70', text: 'text-red-950' },
};

export function getScheduleTheme(subject = '', classroom = ''): ScheduleCardTheme {
  const normSub = subject.trim();
  const normClass = classroom.trim();

  // 1. กิจกรรมพัฒนาผู้เรียน / ลูกเสือ / ชุมนุม / แนะแนว / ซ่อมเสริม / โฮมรูม
  if (/ลูกเสือ|เนตรนารี|ยุวกาชาด|บำเพ็ญ/.test(normSub)) {
    return {
      accentDot: 'bg-emerald-500',
      badge: 'bg-emerald-700 text-white',
      card: 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100/80',
      subtext: 'text-emerald-700/90',
    };
  }
  if (/ชุมนุม|ชมรม|กิจกรรม/.test(normSub)) {
    return {
      accentDot: 'bg-purple-500',
      badge: 'bg-purple-700 text-white',
      card: 'border-purple-200/90 bg-purple-50/90 text-purple-950 hover:border-purple-300 hover:bg-purple-100/80',
      subtext: 'text-purple-700/90',
    };
  }
  if (/แนะแนว/.test(normSub)) {
    return {
      accentDot: 'bg-teal-500',
      badge: 'bg-teal-700 text-white',
      card: 'border-teal-200/90 bg-teal-50/90 text-teal-950 hover:border-teal-300 hover:bg-teal-100/80',
      subtext: 'text-teal-700/90',
    };
  }
  if (/ซ่อมเสริม|ทบทวน|ติว/.test(normSub)) {
    return {
      accentDot: 'bg-amber-500',
      badge: 'bg-amber-600 text-white',
      card: 'border-amber-200/90 bg-amber-50/90 text-amber-950 hover:border-amber-300 hover:bg-amber-100/80',
      subtext: 'text-amber-800/90',
    };
  }
  if (/โฮมรูม/.test(normSub)) {
    return {
      accentDot: 'bg-blue-500',
      badge: 'bg-blue-600 text-white',
      card: 'border-blue-200/90 bg-blue-50/90 text-blue-950 hover:border-blue-300 hover:bg-blue-100/80',
      subtext: 'text-blue-700/90',
    };
  }

  // 2. แยกตามระดับชั้นอย่างชัดเจน (ป.1 - ม.6)
  if (/ป\.?1(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-pink-500',
      badge: 'bg-pink-600 text-white',
      card: 'border-pink-200/90 bg-pink-50/90 text-pink-950 hover:border-pink-300 hover:bg-pink-100/80',
      subtext: 'text-pink-700/90',
    };
  }
  if (/ป\.?2(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-cyan-500',
      badge: 'bg-cyan-600 text-white',
      card: 'border-cyan-200/90 bg-cyan-50/90 text-cyan-950 hover:border-cyan-300 hover:bg-cyan-100/80',
      subtext: 'text-cyan-700/90',
    };
  }
  if (/ป\.?3(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-teal-500',
      badge: 'bg-teal-600 text-white',
      card: 'border-teal-200/90 bg-teal-50/90 text-teal-950 hover:border-teal-300 hover:bg-teal-100/80',
      subtext: 'text-teal-700/90',
    };
  }
  if (/ป\.?4(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-amber-500',
      badge: 'bg-amber-600 text-white',
      card: 'border-amber-200/90 bg-amber-50/90 text-amber-950 hover:border-amber-300 hover:bg-amber-100/80',
      subtext: 'text-amber-800/90',
    };
  }
  if (/ป\.?5(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-indigo-500',
      badge: 'bg-indigo-600 text-white',
      card: 'border-indigo-200/90 bg-indigo-50/90 text-indigo-950 hover:border-indigo-300 hover:bg-indigo-100/80',
      subtext: 'text-indigo-700/90',
    };
  }
  if (/ป\.?6(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-rose-500',
      badge: 'bg-rose-600 text-white',
      card: 'border-rose-200/90 bg-rose-50/90 text-rose-950 hover:border-rose-300 hover:bg-rose-100/80',
      subtext: 'text-rose-700/90',
    };
  }
  if (/ม\.?1(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-violet-500',
      badge: 'bg-violet-600 text-white',
      card: 'border-violet-200/90 bg-violet-50/90 text-violet-950 hover:border-violet-300 hover:bg-violet-100/80',
      subtext: 'text-violet-700/90',
    };
  }
  if (/ม\.?2(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-emerald-500',
      badge: 'bg-emerald-600 text-white',
      card: 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100/80',
      subtext: 'text-emerald-700/90',
    };
  }
  if (/ม\.?3(\b|\/)/i.test(normClass)) {
    return {
      accentDot: 'bg-blue-500',
      badge: 'bg-blue-600 text-white',
      card: 'border-blue-200/90 bg-blue-50/90 text-blue-950 hover:border-blue-300 hover:bg-blue-100/80',
      subtext: 'text-blue-700/90',
    };
  }

  // Fallback: Default Clean Sky theme
  return {
    accentDot: 'bg-sky-500',
    badge: 'bg-sky-600 text-white',
    card: 'border-sky-200/90 bg-sky-50/90 text-sky-950 hover:border-sky-300 hover:bg-sky-100/80',
    subtext: 'text-sky-700/90',
  };
}
