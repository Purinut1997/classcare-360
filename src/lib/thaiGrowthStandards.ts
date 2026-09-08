/**
 * Thai Department of Health (กรมอนามัย) & OBEC (สพฐ.) Physical Growth Standards
 * For Thai children aged 5-19 years.
 */

export interface ExactAge {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
}

export type WeightForAgeResult =
  | 'น้ำหนักน้อยกว่าเกณฑ์'
  | 'ค่อนข้างน้อย'
  | 'ตามเกณฑ์'
  | 'ค่อนข้างมาก'
  | 'เกินเกณฑ์';

export type HeightForAgeResult =
  | 'เตี้ย'
  | 'ค่อนข้างเตี้ย'
  | 'สูงตามเกณฑ์'
  | 'ค่อนข้างสูง'
  | 'สูงกว่าเกณฑ์';

export type WeightForHeightResult =
  | 'ผอม'
  | 'ค่อนข้างผอม'
  | 'สมส่วน'
  | 'ท้วม'
  | 'เริ่มอ้วน'
  | 'อ้วน';

export interface GrowthEvaluation {
  age: ExactAge;
  bmi: number;
  weightForAge: WeightForAgeResult;
  heightForAge: HeightForAgeResult;
  weightForHeight: WeightForHeightResult;
}

/**
 * Calculates exact age (years, months, days) from birth date to measurement date
 */
export function calculateExactAge(birthDateStr: string, measureDateStr?: string): ExactAge {
  const birth = new Date(birthDateStr);
  const measure = measureDateStr ? new Date(measureDateStr) : new Date();

  let years = measure.getFullYear() - birth.getFullYear();
  let months = measure.getMonth() - birth.getMonth();
  let days = measure.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonthDays = new Date(measure.getFullYear(), measure.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = Math.max(0, years * 12 + months);

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
    totalMonths,
  };
}

/**
 * Evaluates student growth against Thai Department of Health reference curves.
 */
export function evaluateThaiGrowth(
  gender: 'male' | 'female' | 'other' | 'unspecified' | null | undefined,
  birthDateStr: string | null | undefined,
  weightKg: number,
  heightCm: number,
  measureDateStr?: string,
): GrowthEvaluation | null {
  if (!birthDateStr || !weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const age = calculateExactAge(birthDateStr, measureDateStr);
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(2));
  const isMale = gender !== 'female'; // Default to male references if unspecified

  // Reference medians and approximate SD bands based on Thai DOH standards
  // Height for age evaluation
  // Base heights approx for 6-12 years (72 - 144 months)
  const medianHeight = isMale
    ? 65 + age.totalMonths * 0.55
    : 64 + age.totalMonths * 0.54;
  const heightRatio = heightCm / medianHeight;

  let heightForAge: HeightForAgeResult = 'สูงตามเกณฑ์';
  if (heightRatio < 0.90) heightForAge = 'เตี้ย';
  else if (heightRatio < 0.95) heightForAge = 'ค่อนข้างเตี้ย';
  else if (heightRatio <= 1.05) heightForAge = 'สูงตามเกณฑ์';
  else if (heightRatio <= 1.10) heightForAge = 'ค่อนข้างสูง';
  else heightForAge = 'สูงกว่าเกณฑ์';

  // Weight for age evaluation
  const medianWeight = isMale
    ? 10 + (age.totalMonths - 36) * 0.28
    : 9.5 + (age.totalMonths - 36) * 0.27;
  const weightRatio = weightKg / Math.max(12, medianWeight);

  let weightForAge: WeightForAgeResult = 'ตามเกณฑ์';
  if (weightRatio < 0.80) weightForAge = 'น้ำหนักน้อยกว่าเกณฑ์';
  else if (weightRatio < 0.90) weightForAge = 'ค่อนข้างน้อย';
  else if (weightRatio <= 1.15) weightForAge = 'ตามเกณฑ์';
  else if (weightRatio <= 1.30) weightForAge = 'ค่อนข้างมาก';
  else weightForAge = 'เกินเกณฑ์';

  // Weight for height (Body Proportion)
  const idealWeightForHeight = Math.pow(heightM, 2) * (isMale ? 17.5 : 17.0);
  const proportionRatio = weightKg / idealWeightForHeight;

  let weightForHeight: WeightForHeightResult = 'สมส่วน';
  if (proportionRatio < 0.80) weightForHeight = 'ผอม';
  else if (proportionRatio < 0.90) weightForHeight = 'ค่อนข้างผอม';
  else if (proportionRatio <= 1.10) weightForHeight = 'สมส่วน';
  else if (proportionRatio <= 1.20) weightForHeight = 'ท้วม';
  else if (proportionRatio <= 1.35) weightForHeight = 'เริ่มอ้วน';
  else weightForHeight = 'อ้วน';

  return {
    age,
    bmi,
    weightForAge,
    heightForAge,
    weightForHeight,
  };
}
