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
  categoryLabel: string;
  codeTag: string;
  gradeColor?: string;
  icon?: string;
  softCard?: string;
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

export const thaiDayHeaderStyles: Record<string, {
  accentBar: string;
  headerBg: string;
  pillBg: string;
  textColor: string;
}> = {
  'จันทร์': {
    accentBar: 'bg-amber-500',
    headerBg: 'bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-amber-950 ring-1 ring-amber-400/80 shadow-md shadow-amber-500/20',
    pillBg: 'bg-amber-400 text-amber-950',
    textColor: 'text-amber-950',
  },
  'อังคาร': {
    accentBar: 'bg-pink-500',
    headerBg: 'bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 text-white ring-1 ring-pink-400/80 shadow-md shadow-pink-500/20',
    pillBg: 'bg-pink-500 text-white',
    textColor: 'text-white',
  },
  'พุธ': {
    accentBar: 'bg-emerald-500',
    headerBg: 'bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 text-white ring-1 ring-emerald-400/80 shadow-md shadow-emerald-500/20',
    pillBg: 'bg-emerald-500 text-white',
    textColor: 'text-white',
  },
  'พฤหัสบดี': {
    accentBar: 'bg-orange-500',
    headerBg: 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white ring-1 ring-orange-400/80 shadow-md shadow-orange-500/20',
    pillBg: 'bg-orange-500 text-white',
    textColor: 'text-white',
  },
  'ศุกร์': {
    accentBar: 'bg-sky-500',
    headerBg: 'bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 text-white ring-1 ring-sky-400/80 shadow-md shadow-sky-500/20',
    pillBg: 'bg-sky-500 text-white',
    textColor: 'text-white',
  },
  'เสาร์': {
    accentBar: 'bg-purple-500',
    headerBg: 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white ring-1 ring-purple-400/80 shadow-md shadow-purple-500/20',
    pillBg: 'bg-purple-500 text-white',
    textColor: 'text-white',
  },
  'อาทิตย์': {
    accentBar: 'bg-red-500',
    headerBg: 'bg-gradient-to-br from-red-500 to-rose-600 text-white ring-1 ring-red-400/80 shadow-md shadow-red-500/20',
    pillBg: 'bg-red-500 text-white',
    textColor: 'text-white',
  },
};

/**
 * ดึงสัญลักษณ์ประจำกลุ่มสาระวิชา / กิจกรรม เพื่อให้สังเกตและจำแนกได้ทันที
 */
export function getSubjectIcon(subject = ''): string {
  const norm = subject.trim();
  if (/ลูกเสือ|เนตรนารี|ยุวกาชาด|บำเพ็ญ/.test(norm)) return '🌲';
  if (/ชุมนุม|ชมรม|กิจกรรม/.test(norm)) return '🎯';
  if (/แนะแนว/.test(norm)) return '🧭';
  if (/ซ่อมเสริม|ทบทวน|ติว/.test(norm)) return '⚡';
  if (/โฮมรูม/.test(norm)) return '🏠';
  if (/สวดมนต์|จริยธรรม|ศีลธรรม|คุณธรรม/.test(norm)) return '✨';
  if (/คณิต|คำนวณ|คิดเลข|สถิติ/.test(norm)) return '📐';
  if (/ไทย|วรรณคดี|การอ่าน/.test(norm)) return '📖';
  if (/วิทย์|ฟิสิกส์|เคมี|ชีว|ดาราศาสตร์/.test(norm)) return '🔬';
  if (/อังกฤษ|eng|จีน|ญี่ปุ่น|ต่างประเทศ/.test(norm)) return '🔤';
  if (/สังคม|ประวัติศาสตร์|ภูมิศาสตร์|หน้าที่พลเมือง|ศาสนา/.test(norm)) return '🌍';
  if (/สุขศึกษา|พละ|พลศึกษา|กีฬา|ว่ายน้ำ/.test(norm)) return '⚽';
  if (/ศิลปะ|ทัศนศิลป์|ดนตรี|นาฏศิลป์/.test(norm)) return '🎨';
  if (/การงาน|เกษตร|ช่าง|คหกรรม/.test(norm)) return '🛠️';
  if (/คอม|เทคโนโลยี|วิทยาการคำนวณ|ai|coding/i.test(norm)) return '💻';
  return '📚';
}

/**
 * ธีมสีการ์ดตารางสอน: แยกสีสดใสตามชั้นเรียนและกลุ่มสาระวิชา/กิจกรรม
 */
export function getScheduleTheme(subject = '', classroom = ''): ScheduleCardTheme {
  const normSub = subject.trim();
  const normClass = classroom.trim();
  const combined = `${normClass} ${normSub}`;
  const icon = getSubjectIcon(normSub);

  // 1. กิจกรรมพัฒนาผู้เรียน & กิจกรรมพิเศษ (แยกสีกิจกรรมชัดเจน โดดเด่นเป็นพิเศษ)
  if (/ลูกเสือ|เนตรนารี|ยุวกาชาด|บำเพ็ญ/.test(normSub)) {
    return {
      accentDot: 'bg-emerald-300',
      badge: 'bg-white text-emerald-950 font-black shadow-xs ring-1 ring-emerald-900/10',
      card: 'border-emerald-300 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md shadow-emerald-700/25 hover:border-emerald-200 hover:brightness-105',
      categoryLabel: 'ลูกเสือ-เนตรนารี',
      codeTag: 'text-emerald-200 font-black',
      gradeColor: '#059669',
      icon,
      softCard: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      subtext: 'text-emerald-100 font-bold',
    };
  }
  if (/ชุมนุม|ชมรม|กิจกรรม/.test(normSub)) {
    return {
      accentDot: 'bg-purple-300',
      badge: 'bg-white text-purple-950 font-black shadow-xs ring-1 ring-purple-900/10',
      card: 'border-purple-300 bg-gradient-to-br from-purple-600 via-fuchsia-600 to-indigo-700 text-white shadow-md shadow-purple-700/25 hover:border-purple-200 hover:brightness-105',
      categoryLabel: 'กิจกรรมชุมนุม',
      codeTag: 'text-purple-200 font-black',
      gradeColor: '#9333ea',
      icon,
      softCard: 'border-purple-200 bg-purple-50 text-purple-950',
      subtext: 'text-purple-100 font-bold',
    };
  }
  if (/แนะแนว/.test(normSub)) {
    return {
      accentDot: 'bg-teal-300',
      badge: 'bg-white text-teal-950 font-black shadow-xs ring-1 ring-teal-900/10',
      card: 'border-teal-300 bg-gradient-to-br from-teal-600 via-cyan-600 to-teal-700 text-white shadow-md shadow-teal-700/25 hover:border-teal-200 hover:brightness-105',
      categoryLabel: 'กิจกรรมแนะแนว',
      codeTag: 'text-teal-200 font-black',
      gradeColor: '#0d9488',
      icon,
      softCard: 'border-teal-200 bg-teal-50 text-teal-950',
      subtext: 'text-teal-100 font-bold',
    };
  }
  if (/ซ่อมเสริม|ทบทวน|ติว/.test(normSub)) {
    return {
      accentDot: 'bg-amber-900',
      badge: 'bg-slate-950 text-amber-300 font-black shadow-xs ring-1 ring-amber-400/30',
      card: 'border-amber-300 bg-gradient-to-br from-amber-400 via-orange-500 to-amber-500 text-slate-950 shadow-md shadow-amber-600/25 hover:border-amber-200 hover:brightness-105',
      categoryLabel: 'คาบซ่อมเสริม',
      codeTag: 'text-amber-950 font-black',
      gradeColor: '#f59e0b',
      icon,
      softCard: 'border-amber-200 bg-amber-50 text-amber-950',
      subtext: 'text-amber-950 font-black',
    };
  }
  if (/โฮมรูม/.test(normSub)) {
    return {
      accentDot: 'bg-sky-200',
      badge: 'bg-white text-sky-950 font-black shadow-xs ring-1 ring-sky-900/10',
      card: 'border-sky-300 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white shadow-md shadow-sky-600/25 hover:border-sky-200 hover:brightness-105',
      categoryLabel: 'กิจกรรมโฮมรูม',
      codeTag: 'text-sky-200 font-black',
      gradeColor: '#0284c7',
      icon,
      softCard: 'border-sky-200 bg-sky-50 text-sky-950',
      subtext: 'text-sky-100 font-bold',
    };
  }
  if (/สวดมนต์|จริยธรรม|ศีลธรรม|คุณธรรม/.test(normSub)) {
    return {
      accentDot: 'bg-violet-300',
      badge: 'bg-white text-violet-950 font-black shadow-xs ring-1 ring-violet-900/10',
      card: 'border-violet-300 bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-violet-700/25 hover:border-violet-200 hover:brightness-105',
      categoryLabel: 'จริยธรรม/คุณธรรม',
      codeTag: 'text-violet-200 font-black',
      gradeColor: '#7c3aed',
      icon,
      softCard: 'border-violet-200 bg-violet-50 text-violet-950',
      subtext: 'text-violet-100 font-bold',
    };
  }

  // 2. แยกสีตามระดับชั้น (ป.1 - ม.6) อย่างเด่นชัด
  // ป.1: ชมพูหวานสดใส (Vibrant Rose/Pink)
  if (/ป\.?\s*1(\b|\/|\s|$)|ประถม(ศึกษา)?(ปีที่)?\s*1/i.test(combined)) {
    return {
      accentDot: 'bg-pink-300',
      badge: 'bg-white text-pink-950 font-black shadow-xs ring-1 ring-pink-900/10',
      card: 'border-pink-300 bg-gradient-to-br from-pink-500 via-rose-500 to-pink-600 text-white shadow-md shadow-pink-600/25 hover:border-pink-200 hover:brightness-105',
      categoryLabel: 'ชั้น ป.1',
      codeTag: 'text-pink-200 font-black',
      gradeColor: '#ec4899',
      icon,
      softCard: 'border-pink-200 bg-pink-50 text-pink-950',
      subtext: 'text-pink-100 font-bold',
    };
  }

  // ป.2: ฟ้าครามสดชื่น (Fresh Cyan/Sky)
  if (/ป\.?\s*2(\b|\/|\s|$)|ประถม(ศึกษา)?(ปีที่)?\s*2/i.test(combined)) {
    return {
      accentDot: 'bg-cyan-300',
      badge: 'bg-white text-cyan-950 font-black shadow-xs ring-1 ring-cyan-900/10',
      card: 'border-cyan-300 bg-gradient-to-br from-cyan-600 via-sky-600 to-blue-600 text-white shadow-md shadow-cyan-600/25 hover:border-cyan-200 hover:brightness-105',
      categoryLabel: 'ชั้น ป.2',
      codeTag: 'text-cyan-200 font-black',
      gradeColor: '#06b6d4',
      icon,
      softCard: 'border-cyan-200 bg-cyan-50 text-cyan-950',
      subtext: 'text-cyan-100 font-bold',
    };
  }

  // ป.3: เขียวมรกตประกายสด (Emerald Mint)
  if (/ป\.?\s*3(\b|\/|\s|$)|ประถม(ศึกษา)?(ปีที่)?\s*3/i.test(combined)) {
    return {
      accentDot: 'bg-emerald-300',
      badge: 'bg-white text-emerald-950 font-black shadow-xs ring-1 ring-emerald-900/10',
      card: 'border-emerald-300 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-600 text-white shadow-md shadow-emerald-600/25 hover:border-emerald-200 hover:brightness-105',
      categoryLabel: 'ชั้น ป.3',
      codeTag: 'text-emerald-200 font-black',
      gradeColor: '#10b981',
      icon,
      softCard: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      subtext: 'text-emerald-100 font-bold',
    };
  }

  // ป.4: สีทองอำพันสดใส (Golden Amber)
  if (/ป\.?\s*4(\b|\/|\s|$)|ประถม(ศึกษา)?(ปีที่)?\s*4/i.test(combined)) {
    return {
      accentDot: 'bg-amber-950',
      badge: 'bg-slate-950 text-amber-300 font-black shadow-xs ring-1 ring-amber-400/30',
      card: 'border-amber-300 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/30 hover:border-amber-200 hover:brightness-105',
      categoryLabel: 'ชั้น ป.4',
      codeTag: 'text-amber-950 font-black',
      gradeColor: '#f59e0b',
      icon,
      softCard: 'border-amber-200 bg-amber-50 text-amber-950',
      subtext: 'text-amber-950 font-black',
    };
  }

  // ป.5: สีน้ำเงินม่วง รอยัลบลู (Royal Indigo / Electric Blue)
  if (/ป\.?\s*5(\b|\/|\s|$)|ประถม(ศึกษา)?(ปีที่)?\s*5/i.test(combined)) {
    return {
      accentDot: 'bg-indigo-300',
      badge: 'bg-white text-indigo-950 font-black shadow-xs ring-1 ring-indigo-900/10',
      card: 'border-indigo-300 bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30 hover:border-indigo-200 hover:brightness-105',
      categoryLabel: 'ชั้น ป.5',
      codeTag: 'text-indigo-200 font-black',
      gradeColor: '#4f46e5',
      icon,
      softCard: 'border-indigo-200 bg-indigo-50 text-indigo-950',
      subtext: 'text-indigo-100 font-bold',
    };
  }

  // ป.6: สีแดงกุหลาบทับทิม (Ruby Crimson / Rose)
  if (/ป\.?\s*6(\b|\/|\s|$)|ประถม(ศึกษา)?(ปีที่)?\s*6/i.test(combined)) {
    return {
      accentDot: 'bg-rose-300',
      badge: 'bg-white text-rose-950 font-black shadow-xs ring-1 ring-rose-900/10',
      card: 'border-rose-300 bg-gradient-to-br from-rose-600 via-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/30 hover:border-rose-200 hover:brightness-105',
      categoryLabel: 'ชั้น ป.6',
      codeTag: 'text-rose-200 font-black',
      gradeColor: '#e11d48',
      icon,
      softCard: 'border-rose-200 bg-rose-50 text-rose-950',
      subtext: 'text-rose-100 font-bold',
    };
  }

  // ม.1: สีม่วงไวโอเล็ต (Royal Purple)
  if (/ม\.?\s*1(\b|\/|\s|$)|มัธยม(ศึกษา)?(ปีที่)?\s*1/i.test(combined)) {
    return {
      accentDot: 'bg-violet-300',
      badge: 'bg-white text-violet-950 font-black shadow-xs ring-1 ring-violet-900/10',
      card: 'border-violet-300 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-md shadow-violet-600/25 hover:border-violet-200 hover:brightness-105',
      categoryLabel: 'ชั้น ม.1',
      codeTag: 'text-violet-200 font-black',
      gradeColor: '#8b5cf6',
      icon,
      softCard: 'border-violet-200 bg-violet-50 text-violet-950',
      subtext: 'text-violet-100 font-bold',
    };
  }

  // ม.2: สีเขียวน้ำทะเลลึก (Deep Ocean Teal)
  if (/ม\.?\s*2(\b|\/|\s|$)|มัธยม(ศึกษา)?(ปีที่)?\s*2/i.test(combined)) {
    return {
      accentDot: 'bg-teal-300',
      badge: 'bg-white text-teal-950 font-black shadow-xs ring-1 ring-teal-900/10',
      card: 'border-teal-300 bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-700 text-white shadow-md shadow-teal-600/25 hover:border-teal-200 hover:brightness-105',
      categoryLabel: 'ชั้น ม.2',
      codeTag: 'text-teal-200 font-black',
      gradeColor: '#0f766e',
      icon,
      softCard: 'border-teal-200 bg-teal-50 text-teal-950',
      subtext: 'text-teal-100 font-bold',
    };
  }

  // ม.3: สีน้ำเงินไพลิน (Sapphire Blue)
  if (/ม\.?\s*3(\b|\/|\s|$)|มัธยม(ศึกษา)?(ปีที่)?\s*3/i.test(combined)) {
    return {
      accentDot: 'bg-blue-300',
      badge: 'bg-white text-blue-950 font-black shadow-xs ring-1 ring-blue-900/10',
      card: 'border-blue-300 bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-800 text-white shadow-md shadow-blue-600/25 hover:border-blue-200 hover:brightness-105',
      categoryLabel: 'ชั้น ม.3',
      codeTag: 'text-blue-200 font-black',
      gradeColor: '#1d4ed8',
      icon,
      softCard: 'border-blue-200 bg-blue-50 text-blue-950',
      subtext: 'text-blue-100 font-bold',
    };
  }

  // ม.4: สีบานเย็นฟิวเชีย (Fuchsia / Magenta)
  if (/ม\.?\s*4(\b|\/|\s|$)|มัธยม(ศึกษา)?(ปีที่)?\s*4/i.test(combined)) {
    return {
      accentDot: 'bg-fuchsia-300',
      badge: 'bg-white text-fuchsia-950 font-black shadow-xs',
      card: 'border-fuchsia-300 bg-gradient-to-br from-fuchsia-600 to-pink-700 text-white shadow-md shadow-fuchsia-600/25 hover:brightness-105',
      categoryLabel: 'ชั้น ม.4',
      codeTag: 'text-fuchsia-200 font-black',
      gradeColor: '#c026d3',
      icon,
      softCard: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950',
      subtext: 'text-fuchsia-100 font-bold',
    };
  }

  // ม.5: สีส้มแสดประกาย (Vivid Orange)
  if (/ม\.?\s*5(\b|\/|\s|$)|มัธยม(ศึกษา)?(ปีที่)?\s*5/i.test(combined)) {
    return {
      accentDot: 'bg-orange-300',
      badge: 'bg-white text-orange-950 font-black shadow-xs',
      card: 'border-orange-300 bg-gradient-to-br from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/25 hover:brightness-105',
      categoryLabel: 'ชั้น ม.5',
      codeTag: 'text-orange-200 font-black',
      gradeColor: '#ea580c',
      icon,
      softCard: 'border-orange-200 bg-orange-50 text-orange-950',
      subtext: 'text-orange-100 font-bold',
    };
  }

  // ม.6: สีแดงเข้มรูบี้ (Deep Ruby)
  if (/ม\.?\s*6(\b|\/|\s|$)|มัธยม(ศึกษา)?(ปีที่)?\s*6/i.test(combined)) {
    return {
      accentDot: 'bg-red-300',
      badge: 'bg-white text-red-950 font-black shadow-xs',
      card: 'border-red-300 bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-md shadow-red-600/25 hover:brightness-105',
      categoryLabel: 'ชั้น ม.6',
      codeTag: 'text-red-200 font-black',
      gradeColor: '#dc2626',
      icon,
      softCard: 'border-red-200 bg-red-50 text-red-950',
      subtext: 'text-red-100 font-bold',
    };
  }

  // 3. แยกสีตามกลุ่มสาระการเรียนรู้ (เมื่อไม่ได้ระบุชั้น หรือใช้เป็นสีตามสาระวิชา)
  if (/ไทย|วรรณคดี|การอ่าน/.test(normSub)) {
    return {
      accentDot: 'bg-orange-300',
      badge: 'bg-white text-orange-950 font-black shadow-xs',
      card: 'border-orange-300 bg-gradient-to-br from-orange-500 via-rose-500 to-orange-600 text-white shadow-md shadow-orange-600/25 hover:brightness-105',
      categoryLabel: 'ภาษาไทย',
      codeTag: 'text-orange-200 font-black',
      gradeColor: '#f97316',
      icon,
      softCard: 'border-orange-200 bg-orange-50 text-orange-950',
      subtext: 'text-orange-100 font-bold',
    };
  }
  if (/คณิต|คำนวณ|คิดเลข|สถิติ/.test(normSub)) {
    return {
      accentDot: 'bg-blue-300',
      badge: 'bg-white text-blue-950 font-black shadow-xs',
      card: 'border-blue-300 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-600/25 hover:brightness-105',
      categoryLabel: 'คณิตศาสตร์',
      codeTag: 'text-blue-200 font-black',
      gradeColor: '#2563eb',
      icon,
      softCard: 'border-blue-200 bg-blue-50 text-blue-950',
      subtext: 'text-blue-100 font-bold',
    };
  }
  if (/วิทย์|ฟิสิกส์|เคมี|ชีว|ดาราศาสตร์/.test(normSub)) {
    return {
      accentDot: 'bg-emerald-300',
      badge: 'bg-white text-emerald-950 font-black shadow-xs',
      card: 'border-emerald-300 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white shadow-md shadow-emerald-600/25 hover:brightness-105',
      categoryLabel: 'วิทยาศาสตร์',
      codeTag: 'text-emerald-200 font-black',
      gradeColor: '#059669',
      icon,
      softCard: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      subtext: 'text-emerald-100 font-bold',
    };
  }
  if (/อังกฤษ|eng|จีน|ญี่ปุ่น|ต่างประเทศ/i.test(normSub)) {
    return {
      accentDot: 'bg-sky-300',
      badge: 'bg-white text-sky-950 font-black shadow-xs',
      card: 'border-sky-300 bg-gradient-to-br from-sky-500 via-cyan-600 to-blue-600 text-white shadow-md shadow-sky-600/25 hover:brightness-105',
      categoryLabel: 'ภาษาต่างประเทศ',
      codeTag: 'text-sky-200 font-black',
      gradeColor: '#0284c7',
      icon,
      softCard: 'border-sky-200 bg-sky-50 text-sky-950',
      subtext: 'text-sky-100 font-bold',
    };
  }
  if (/สังคม|ประวัติศาสตร์|ภูมิศาสตร์|หน้าที่พลเมือง|ศาสนา/.test(normSub)) {
    return {
      accentDot: 'bg-amber-950',
      badge: 'bg-slate-950 text-amber-300 font-black shadow-xs',
      card: 'border-yellow-300 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-500 text-slate-950 shadow-md shadow-amber-500/25 hover:brightness-105',
      categoryLabel: 'สังคมศึกษา',
      codeTag: 'text-amber-950 font-black',
      gradeColor: '#eab308',
      icon,
      softCard: 'border-amber-200 bg-amber-50 text-amber-950',
      subtext: 'text-amber-950 font-bold',
    };
  }
  if (/สุขศึกษา|พละ|พลศึกษา|กีฬา|ว่ายน้ำ/.test(normSub)) {
    return {
      accentDot: 'bg-lime-300',
      badge: 'bg-white text-lime-950 font-black shadow-xs',
      card: 'border-lime-300 bg-gradient-to-br from-lime-600 via-emerald-600 to-teal-700 text-white shadow-md shadow-lime-600/25 hover:brightness-105',
      categoryLabel: 'สุขศึกษาและพลศึกษา',
      codeTag: 'text-lime-200 font-black',
      gradeColor: '#65a30d',
      icon,
      softCard: 'border-lime-200 bg-lime-50 text-lime-950',
      subtext: 'text-lime-100 font-bold',
    };
  }
  if (/ศิลปะ|ทัศนศิลป์|ดนตรี|นาฏศิลป์/.test(normSub)) {
    return {
      accentDot: 'bg-fuchsia-300',
      badge: 'bg-white text-fuchsia-950 font-black shadow-xs',
      card: 'border-fuchsia-300 bg-gradient-to-br from-fuchsia-500 via-pink-600 to-purple-600 text-white shadow-md shadow-fuchsia-600/25 hover:brightness-105',
      categoryLabel: 'ศิลปะและดนตรี',
      codeTag: 'text-fuchsia-200 font-black',
      gradeColor: '#d946ef',
      icon,
      softCard: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950',
      subtext: 'text-fuchsia-100 font-bold',
    };
  }
  if (/การงาน|เกษตร|ช่าง|คหกรรม/.test(normSub)) {
    return {
      accentDot: 'bg-orange-300',
      badge: 'bg-white text-stone-950 font-black shadow-xs',
      card: 'border-orange-400 bg-gradient-to-br from-amber-700 via-orange-800 to-stone-800 text-white shadow-md shadow-orange-700/25 hover:brightness-105',
      categoryLabel: 'การงานอาชีพ',
      codeTag: 'text-orange-200 font-black',
      gradeColor: '#b45309',
      icon,
      softCard: 'border-orange-200 bg-orange-50 text-stone-950',
      subtext: 'text-orange-100 font-bold',
    };
  }
  if (/คอม|เทคโนโลยี|วิทยาการคำนวณ|ai|coding/i.test(normSub)) {
    return {
      accentDot: 'bg-indigo-300',
      badge: 'bg-white text-slate-950 font-black shadow-xs',
      card: 'border-indigo-400 bg-gradient-to-br from-slate-800 via-indigo-900 to-blue-900 text-white shadow-md shadow-indigo-900/30 hover:brightness-105',
      categoryLabel: 'วิทยาการคำนวณ/เทคโนโลยี',
      codeTag: 'text-indigo-200 font-black',
      gradeColor: '#4338ca',
      icon,
      softCard: 'border-slate-200 bg-slate-50 text-slate-950',
      subtext: 'text-indigo-100 font-bold',
    };
  }

  // Fallback: สะอาดตา สบายใจ โทนฟ้าสว่าง (Clean Cheerful Sky)
  return {
    accentDot: 'bg-sky-400',
    badge: 'bg-white text-sky-950 font-black shadow-xs ring-1 ring-sky-900/10',
    card: 'border-sky-300 bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-600/25 hover:brightness-105',
    categoryLabel: normClass ? `ห้อง ${normClass}` : 'รายวิชา',
    codeTag: 'text-sky-200 font-black',
    gradeColor: '#0284c7',
    icon,
    softCard: 'border-sky-200 bg-sky-50 text-sky-950',
    subtext: 'text-sky-100 font-bold',
  };
}
