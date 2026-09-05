/**
 * Official Thai Public Holidays and School Calendar Presets
 * Covers major government public holidays and school-specific holidays (such as Teachers' Day).
 */

export interface PresetHoliday {
  date: string; // YYYY-MM-DD
  title: string;
  type: 'holiday' | 'exam' | 'activity' | 'makeup' | 'custom';
  attendancePolicy: 'skip' | 'warn' | 'normal';
}

/**
 * Returns official Thai public holidays for a given Western calendar year (e.g. 2026).
 */
export function getThaiPublicHolidays(year: number = 2026): PresetHoliday[] {
  // Pad helper
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = String(year);

  // Approximate Buddhist lunar holidays by year for accuracy
  // 2025 (2568), 2026 (2569), 2027 (2570)
  let makha = `${y}-03-03`;
  let visakha = `${y}-05-31`;
  let asahna = `${y}-07-29`;
  let khaoPhansa = `${y}-07-30`;

  if (year === 2025) {
    makha = '2025-02-12';
    visakha = '2025-05-11';
    asahna = '2025-07-10';
    khaoPhansa = '2025-07-11';
  } else if (year === 2027) {
    makha = '2027-02-21';
    visakha = '2027-05-20';
    asahna = '2027-07-18';
    khaoPhansa = '2027-07-19';
  }

  const holidays: PresetHoliday[] = [
    {
      date: `${y}-01-01`,
      title: 'วันขึ้นปีใหม่',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-01-16`,
      title: 'วันครูแห่งชาติ (วันหยุดสถานศึกษา)',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: makha,
      title: 'วันมาฆบูชา',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-04-06`,
      title: 'วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราชและวันที่ระลึกมหาจักรีบรมราชวงศ์ (วันจักรี)',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-04-13`,
      title: 'วันสงกรานต์',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-04-14`,
      title: 'วันสงกรานต์ (วันครอบครัว)',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-04-15`,
      title: 'วันสงกรานต์',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-05-01`,
      title: 'วันแรงงานแห่งชาติ',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-05-04`,
      title: 'วันฉัตรมงคล',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: visakha,
      title: 'วันวิสาขบูชา',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-06-03`,
      title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-07-28`,
      title: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: asahna,
      title: 'วันอาสาฬหบูชา',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: khaoPhansa,
      title: 'วันเข้าพรรษา',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-08-12`,
      title: 'วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง และวันแม่แห่งชาติ',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-10-13`,
      title: 'วันนวมินทรมหาราช (วันคล้ายวันสวรรคต ร.9)',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-10-23`,
      title: 'วันปิยมหาราช',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-12-05`,
      title: 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันพ่อแห่งชาติ / วันชาติ',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-12-10`,
      title: 'วันรัฐธรรมนูญ',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
    {
      date: `${y}-12-31`,
      title: 'วันสิ้นปี',
      type: 'holiday',
      attendancePolicy: 'skip',
    },
  ];

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Normalizes input year (handles Buddhist year like 2569 -> 2026, or Western year 2026).
 */
export function resolveCalendarYear(input?: string | number): number {
  if (!input) return new Date().getFullYear();
  const num = typeof input === 'number' ? input : parseInt(String(input).replace(/[^\d]/g, ''), 10);
  if (isNaN(num)) return new Date().getFullYear();
  if (num > 2400) return num - 543; // Buddhist to Western
  return num;
}
