/**
 * Universal OBEC Academic Engine
 * ระบบประมวลผลข้อมูลวิชาการและทะเบียน มาตรฐาน สพฐ. รองรับทุกระดับชั้น (อ.1 - ม.6)
 * ถอดแบบโครงสร้างจากระเบียบกระทรวงศึกษาธิการและไฟล์แม่แบบ สพฐ. (ปพ.๕ และ ปพ.๖)
 */

export interface OBECSubject {
  id: string;
  code: string;
  name: string;
  category: 'core' | 'elective' | 'additional';
  learningArea: string; // 8 กลุ่มสาระ
  hoursPerYear: number;
  credit?: number;
  score100?: number;
  grade?: number | string;
  term1Score?: number;
  term2Score?: number;
  isPassed?: boolean;
}

export interface OBECMonthlyAttendance {
  monthName: string;
  monthIndex: number; // 1-12
  schoolDays: number;
  presentDays: number;
  sickDays: number;
  businessDays: number;
  absentDays: number;
}

export interface OBECStudentHealthSummary {
  weight: number; // kg
  height: number; // cm
  measuredDate?: string;
  weightForAgeStatus: 'ต่ำกว่าเกณฑ์' | 'ตามเกณฑ์' | 'สูงกว่าเกณฑ์';
  heightForAgeStatus: 'เตี้ย' | 'ค่อนข้างเตี้ย' | 'ตามเกณฑ์' | 'ค่อนข้างสูง' | 'สูง';
  weightForHeightStatus: 'ผอม' | 'ค่อนข้างผอม' | 'สมส่วน' | 'ท้วม' | 'เริ่มอ้วน' | 'อ้วน';
}

export interface OBECDevelopmentalEvaluation {
  // คุณลักษณะอันพึงประสงค์ 8 ข้อ
  characteristics: {
    id: number;
    title: string;
    score: number; // 0=ไม่ผ่าน, 1=ผ่าน, 2=ดี, 3=ดีเยี่ยม
  }[];
  characteristicsOverall: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';

  // การอ่าน คิดวิเคราะห์ และเขียน
  readingAnalysis: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';

  // สมรรถนะสำคัญของผู้เรียน 5 ประการ
  competencies: {
    id: number;
    title: string;
    level: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';
  }[];
  competenciesOverall: 'ดีเยี่ยม' | 'ดี' | 'ผ่าน' | 'ไม่ผ่าน';

  // กิจกรรมพัฒนาผู้เรียน 4 กิจกรรม
  activities: {
    name: string;
    hours: number;
    isPassed: boolean;
  }[];
  activitiesOverall: 'ผ่าน' | 'ไม่ผ่าน';
}

export interface OBECTeacherComments {
  responsibility: string; // ด้านหน้าที่รับผิดชอบ ความเอาใจใส่การเรียน
  leisureTime: string; // ด้านการใช้เวลาว่าง
  socialRelations: string; // ด้านความสัมพันธ์กับบุคคลรอบข้าง
  personality: string; // ด้านอุปนิสัย บุคลิกภาพ
  health: string; // ด้านสุขภาพ
  generalRemark: string; // ข้อเสนอแนะเพิ่มเติม
}

export interface OBECStudentFullReport {
  studentId: string;
  studentCode: string;
  nationalId?: string;
  rollNumber: number;
  prefix: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: 'ชาย' | 'หญิง';
  birthDate?: string;
  address?: string;
  fatherName?: string;
  motherName?: string;
  parentName?: string;
  parentRelation?: string;

  // ข้อมูลวิชาการ
  gradeLevel: string; // e.g. "ประถมศึกษาปีที่ 5" หรือ "มัธยมศึกษาปีที่ 1"
  roomName: string;
  academicYear: string; // e.g. "2568"
  semester: string; // "1", "2", or "รวม"

  // ผลการเรียน
  subjects: OBECSubject[];
  totalHours: number;
  totalCredits: number;
  gpa: number;

  // เวลาเรียน
  monthlyAttendance: OBECMonthlyAttendance[];
  totalSchoolDays: number;
  totalPresentDays: number;
  attendancePercentage: number;

  // สุขภาพ
  health: OBECStudentHealthSummary;

  // การประเมิน
  evaluations: OBECDevelopmentalEvaluation;

  // ข้อเสนอแนะ
  teacherComments: OBECTeacherComments;

  // ผลการตัดสินเลื่อนชั้น
  promotionDecision: {
    passedAllCriteria: boolean;
    promotionText: string; // "อนุมัติให้เลื่อนชั้นไปเรียนชั้น ประถมศึกษาปีที่ 6"
    decisionDate?: string;
  };
}

export interface OBECSchoolHeader {
  schoolName: string;
  district: string;
  province: string;
  jurisdiction: string; // e.g. "สำนักงานเขตพื้นที่การศึกษาประถมศึกษา ศรีสะเกษ เขต 3"
  directorName: string;
  directorPosition: string;
  academicHeadName: string;
  registrarName: string;
  homeroomTeacherName: string;
}

/**
 * คำนวณเกณฑ์ประเมินภาวะโภชนาการตามเกณฑ์กระทรวงสาธารณสุข
 */
export function evaluateNutrition(weightKg: number, heightCm: number, ageYears: number = 11): OBECStudentHealthSummary {
  const w = weightKg || 35;
  const h = heightCm || 140;

  // คำนวณค่า BMI คร่าวๆ เพื่อเทียบเกณฑ์
  const heightM = h / 100;
  const bmi = heightM > 0 ? w / (heightM * heightM) : 18;

  let weightForHeight: OBECStudentHealthSummary['weightForHeightStatus'] = 'สมส่วน';
  if (bmi < 14) weightForHeight = 'ผอม';
  else if (bmi < 15.5) weightForHeight = 'ค่อนข้างผอม';
  else if (bmi <= 19.5) weightForHeight = 'สมส่วน';
  else if (bmi <= 22) weightForHeight = 'ท้วม';
  else if (bmi <= 25) weightForHeight = 'เริ่มอ้วน';
  else weightForHeight = 'อ้วน';

  let heightForAge: OBECStudentHealthSummary['heightForAgeStatus'] = 'ตามเกณฑ์';
  if (h < 125) heightForAge = 'เตี้ย';
  else if (h < 132) heightForAge = 'ค่อนข้างเตี้ย';
  else if (h <= 150) heightForAge = 'ตามเกณฑ์';
  else if (h <= 158) heightForAge = 'ค่อนข้างสูง';
  else heightForAge = 'สูง';

  let weightForAge: OBECStudentHealthSummary['weightForAgeStatus'] = 'ตามเกณฑ์';
  if (w < 26) weightForAge = 'ต่ำกว่าเกณฑ์';
  else if (w <= 48) weightForAge = 'ตามเกณฑ์';
  else weightForAge = 'สูงกว่าเกณฑ์';

  return {
    weight: w,
    height: h,
    measuredDate: '10 มีนาคม 2568',
    weightForAgeStatus: weightForAge,
    heightForAgeStatus: heightForAge,
    weightForHeightStatus: weightForHeight,
  };
}

/**
 * สร้างข้อมูลสรุปเวลาเรียน 12 เดือนมาตรฐาน (พ.ค. - เม.ย.)
 */
export function generateOBECMonthlyAttendance(basePercent: number = 95): OBECMonthlyAttendance[] {
  const months = [
    { name: 'พฤษภาคม', days: 12 },
    { name: 'มิถุนายน', days: 20 },
    { name: 'กรกฎาคม', days: 21 },
    { name: 'สิงหาคม', days: 20 },
    { name: 'กันยายน', days: 21 },
    { name: 'ตุลาคม', days: 10 },
    { name: 'พฤศจิกายน', days: 21 },
    { name: 'ธันวาคม', days: 19 },
    { name: 'มกราคม', days: 20 },
    { name: 'กุมภาพันธ์', days: 19 },
    { name: 'มีนาคม', days: 17 },
    { name: 'เมษายน', days: 0 },
  ];

  return months.map((m, idx) => {
    if (m.days === 0) {
      return {
        monthName: m.name,
        monthIndex: idx + 1,
        schoolDays: 0,
        presentDays: 0,
        sickDays: 0,
        businessDays: 0,
        absentDays: 0,
      };
    }
    const missed = Math.max(0, Math.round(m.days * ((100 - basePercent) / 100)));
    const sick = Math.min(missed, 1);
    const bus = missed > 1 ? 1 : 0;
    const abs = Math.max(0, missed - sick - bus);
    const present = m.days - missed;

    return {
      monthName: m.name,
      monthIndex: idx + 1,
      schoolDays: m.days,
      presentDays: present,
      sickDays: sick,
      businessDays: bus,
      absentDays: abs,
    };
  });
}

/**
 * ตัดเกรด 8 ระดับตามมาตรฐานกระทรวงศึกษาธิการ
 */
export function calculateOBECGrade(score: number): { grade: number; label: string } {
  if (score >= 80) return { grade: 4.0, label: '4 (ดีเยี่ยม)' };
  if (score >= 75) return { grade: 3.5, label: '3.5 (ดีมาก)' };
  if (score >= 70) return { grade: 3.0, label: '3 (ดี)' };
  if (score >= 65) return { grade: 2.5, label: '2.5 (ค่อนข้างดี)' };
  if (score >= 60) return { grade: 2.0, label: '2 (ปานกลาง)' };
  if (score >= 55) return { grade: 1.5, label: '1.5 (พอใช้)' };
  if (score >= 50) return { grade: 1.0, label: '1 (ผ่านเกณฑ์ขั้นต่ำ)' };
  return { grade: 0, label: '0 (ต่ำกว่าเกณฑ์)' };
}

/**
 * รายวิชามาตรฐาน 8 กลุ่มสาระฯ รองรับการปรับตามระดับชั้น (Universal Subject Templates)
 */
export function getStandardSubjectsForGrade(gradeLevel: string): OBECSubject[] {
  const isSecondary = gradeLevel.includes('มัธยม') || gradeLevel.includes('ม.');
  const gradeDigit = gradeLevel.replace(/\D/g, '') || '5';

  if (isSecondary) {
    // ระดับมัธยมศึกษา (คิดเป็นหน่วยกิต)
    return [
      { id: 'th', code: `ท2${gradeDigit}101`, name: 'ภาษาไทย', category: 'core', learningArea: 'ภาษาไทย', hoursPerYear: 60, credit: 1.5, score100: 78, grade: 3.5, isPassed: true },
      { id: 'math', code: `ค2${gradeDigit}101`, name: 'คณิตศาสตร์พื้นฐาน', category: 'core', learningArea: 'คณิตศาสตร์', hoursPerYear: 60, credit: 1.5, score100: 74, grade: 3.0, isPassed: true },
      { id: 'sci', code: `ว2${gradeDigit}101`, name: 'วิทยาศาสตร์และเทคโนโลยี', category: 'core', learningArea: 'วิทยาศาสตร์และเทคโนโลยี', hoursPerYear: 60, credit: 1.5, score100: 82, grade: 4.0, isPassed: true },
      { id: 'soc', code: `ส2${gradeDigit}101`, name: 'สังคมศึกษา', category: 'core', learningArea: 'สังคมศึกษาฯ', hoursPerYear: 60, credit: 1.5, score100: 80, grade: 4.0, isPassed: true },
      { id: 'his', code: `ส2${gradeDigit}102`, name: 'ประวัติศาสตร์', category: 'core', learningArea: 'สังคมศึกษาฯ', hoursPerYear: 20, credit: 0.5, score100: 76, grade: 3.5, isPassed: true },
      { id: 'health', code: `พ2${gradeDigit}101`, name: 'สุขศึกษาและพลศึกษา', category: 'core', learningArea: 'สุขศึกษาและพลศึกษา', hoursPerYear: 40, credit: 1.0, score100: 88, grade: 4.0, isPassed: true },
      { id: 'art', code: `ศ2${gradeDigit}101`, name: 'ศิลปะ', category: 'core', learningArea: 'ศิลปะ', hoursPerYear: 40, credit: 1.0, score100: 85, grade: 4.0, isPassed: true },
      { id: 'work', code: `ง2${gradeDigit}101`, name: 'การงานอาชีพ', category: 'core', learningArea: 'การงานอาชีพ', hoursPerYear: 40, credit: 1.0, score100: 82, grade: 4.0, isPassed: true },
      { id: 'eng', code: `อ2${gradeDigit}101`, name: 'ภาษาอังกฤษพื้นฐาน', category: 'core', learningArea: 'ภาษาต่างประเทศ', hoursPerYear: 60, credit: 1.5, score100: 72, grade: 3.0, isPassed: true },
      { id: 'eng-extra', code: `อ2${gradeDigit}201`, name: 'ภาษาอังกฤษเพื่อการสื่อสาร', category: 'additional', learningArea: 'ภาษาต่างประเทศ', hoursPerYear: 40, credit: 1.0, score100: 75, grade: 3.5, isPassed: true },
    ];
  }

  // ระดับประถมศึกษา (คิดเป็นชั่วโมง/ปี รวม 1,000 ชม.)
  return [
    { id: 'th', code: `ท1${gradeDigit}101`, name: 'ภาษาไทย', category: 'core', learningArea: 'ภาษาไทย', hoursPerYear: 160, score100: 78, grade: 3.5, isPassed: true },
    { id: 'math', code: `ค1${gradeDigit}101`, name: 'คณิตศาสตร์', category: 'core', learningArea: 'คณิตศาสตร์', hoursPerYear: 160, score100: 75, grade: 3.5, isPassed: true },
    { id: 'sci', code: `ว1${gradeDigit}101`, name: 'วิทยาศาสตร์และเทคโนโลยี', category: 'core', learningArea: 'วิทยาศาสตร์และเทคโนโลยี', hoursPerYear: 80, score100: 82, grade: 4.0, isPassed: true },
    { id: 'soc', code: `ส1${gradeDigit}101`, name: 'สังคมศึกษา ศาสนาและวัฒนธรรม', category: 'core', learningArea: 'สังคมศึกษาฯ', hoursPerYear: 80, score100: 80, grade: 4.0, isPassed: true },
    { id: 'his', code: `ส1${gradeDigit}102`, name: 'ประวัติศาสตร์', category: 'core', learningArea: 'สังคมศึกษาฯ', hoursPerYear: 40, score100: 76, grade: 3.5, isPassed: true },
    { id: 'health', code: `พ1${gradeDigit}101`, name: 'สุขศึกษาและพลศึกษา', category: 'core', learningArea: 'สุขศึกษาและพลศึกษา', hoursPerYear: 80, score100: 85, grade: 4.0, isPassed: true },
    { id: 'art', code: `ศ1${gradeDigit}101`, name: 'ศิลปะ', category: 'core', learningArea: 'ศิลปะ', hoursPerYear: 80, score100: 84, grade: 4.0, isPassed: true },
    { id: 'work', code: `ง1${gradeDigit}101`, name: 'การงานอาชีพ', category: 'core', learningArea: 'การงานอาชีพ', hoursPerYear: 80, score100: 83, grade: 4.0, isPassed: true },
    { id: 'eng', code: `อ1${gradeDigit}101`, name: 'ภาษาอังกฤษ', category: 'core', learningArea: 'ภาษาต่างประเทศ', hoursPerYear: 80, score100: 74, grade: 3.0, isPassed: true },
    { id: 'eng-extra', code: `อ1${gradeDigit}201`, name: 'ภาษาอังกฤษเพื่อการสื่อสาร', category: 'additional', learningArea: 'ภาษาต่างประเทศ', hoursPerYear: 40, score100: 77, grade: 3.5, isPassed: true },
  ];
}
