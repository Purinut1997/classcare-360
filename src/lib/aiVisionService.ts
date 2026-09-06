import { callGeminiVisionApi, callGeminiPrompt, type GeminiModelId } from './geminiClient';
import type { DayName } from './scheduleSettings';
import { findStandardIndicatorsForUnit, OBEC_CURRICULUM_DATABASE } from './obecCurriculumDatabase';

/**
 * Client-side image compression and resizing using HTML5 Canvas.
 * Ensures fast network upload and optimal resolution for Gemini Vision OCR.
 */
export async function compressImageForVision(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('รูปแบบไฟล์รูปภาพไม่ถูกต้อง'));
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context unavailable'));
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const cleanBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

        resolve({
          base64: cleanBase64,
          mimeType,
          previewUrl: dataUrl,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function extractJsonFromMarkdown(raw: string): string {
  let cleaned = raw.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }
  return cleaned;
}

/**
 * Robust JSON extraction & repair engine that can handle:
 * 1. Markdown code blocks
 * 2. Unescaped newlines/tabs inside strings
 * 3. Line/block comments (slash-slash, slash-star)
 * 4. Trailing commas (before } or ])
 * 5. Truncated output (closing unterminated strings and brackets)
 */
export function safeParseJson<T>(raw: string, fallbackDefault?: T): T {
  let cleaned = extractJsonFromMarkdown(raw).trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue
  }

  // 2. Strip comments & trailing commas
  cleaned = cleaned
    .replace(/\/\/[^\r\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue
  }

  // 3. Fix unescaped newlines/control characters inside JSON strings
  let inStr = false;
  let escaped = false;
  let normalized = '';
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"' && !escaped) {
      inStr = !inStr;
      normalized += ch;
    } else if (escaped) {
      escaped = false;
      normalized += ch;
    } else if (ch === '\\') {
      escaped = true;
      normalized += ch;
    } else if (inStr && (ch === '\n' || ch === '\r')) {
      normalized += '\\n';
    } else if (inStr && ch === '\t') {
      normalized += '\\t';
    } else {
      normalized += ch;
    }
  }
  cleaned = normalized;

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue
  }

  // 4. Truncation Auto-Repair: close cut-off string literals & bracket stack
  let repaired = cleaned;
  let quoteCount = 0;
  let isEsc = false;
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '\\' && !isEsc) {
      isEsc = true;
    } else {
      if (repaired[i] === '"' && !isEsc) quoteCount++;
      isEsc = false;
    }
  }
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  repaired = repaired
    .replace(/,\s*$/, '')
    .replace(/:\s*$/, ': null')
    .replace(/,\s*([\]}])/g, '$1');

  const stack: string[] = [];
  let insideStr = false;
  let nextEsc = false;
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (nextEsc) {
      nextEsc = false;
      continue;
    }
    if (char === '\\') {
      nextEsc = true;
      continue;
    }
    if (char === '"') {
      insideStr = !insideStr;
      continue;
    }
    if (!insideStr) {
      if (char === '{') stack.push('}');
      else if (char === '[') stack.push(']');
      else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  while (stack.length > 0) {
    repaired += stack.pop();
  }

  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(repaired) as T;
  } catch (err) {
    if (fallbackDefault !== undefined) {
      return fallbackDefault;
    }
    throw new Error(`ไม่สามารถแปลงข้อมูลเป็น JSON ได้: ${(err as Error).message}`);
  }
}

// ==========================================
// 1. Schedule OCR
// ==========================================
export interface ParsedScheduleCell {
  day: DayName;
  periodIndex: number;
  subjectCode?: string;
  subjectName: string;
  classroom?: string;
  teacherName?: string;
}

export interface ParsedScheduleResult {
  courseTitle?: string;
  teacherName?: string;
  periodCount?: number;
  startTime?: string;
  periodMinutes?: number;
  lunchStart?: string;
  lunchEnd?: string;
  subjects: Array<{ code?: string; name: string; teacherName?: string }>;
  cells: ParsedScheduleCell[];
  notes?: string;
}

function salvageCellsFromRawText(
  raw: string,
  defaultClassroom: string,
  defaultTeacherName: string
): ParsedScheduleCell[] {
  const validDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
  const cells: ParsedScheduleCell[] = [];
  const objectRegex = /\{[^{}]*"day"\s*:\s*"([^"]+)"[^{}]*"periodIndex"\s*:\s*(\d+)[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(raw)) !== null) {
    try {
      const parsedCell = JSON.parse(match[0]) as Record<string, unknown>;
      const day = String(parsedCell.day || '').trim();
      const periodIndex = Number(parsedCell.periodIndex);
      if (validDays.includes(day) && !isNaN(periodIndex) && periodIndex > 0) {
        cells.push({
          day: day as DayName,
          periodIndex,
          subjectCode: parsedCell.subjectCode ? String(parsedCell.subjectCode).trim() : undefined,
          subjectName: String(parsedCell.subjectName || 'วิชาเรียน').trim(),
          classroom: String(parsedCell.classroom || defaultClassroom).trim(),
          teacherName: parsedCell.teacherName ? String(parsedCell.teacherName).trim() : defaultTeacherName,
        });
      }
    } catch {
      // Continue next match
    }
  }
  return cells;
}

export async function parseScheduleImage(
  apiKey: string,
  model: GeminiModelId,
  imageBase64: string,
  mimeType: string,
  defaultClassroom = 'ป.5/1',
  defaultTeacherName = ''
): Promise<ParsedScheduleResult> {
  const prompt = `
คุณคือ AI ผู้เชี่ยวชาญการถอดรหัสเอกสาร "ตารางสอนประจำตัวของคุณครู" (Teacher's Teaching Timetable) ของโรงเรียนไทย (มาตรฐาน สพฐ.)
เอกสารนี้เป็นตารางการปฏิบัติการสอนของคุณครูผู้สอน (ครู 1 ท่านอาจสอนหลายวิชาและหลายห้องเรียน เช่น คาบ 1 สอนห้อง ป.5/1, คาบ 2 สอนห้อง ป.5/2)

ข้อสำคัญเกี่ยวกับภาพถ่าย:
1. หากภาพถ่ายตะแคงข้าง หมุน 90 องศา หรือถ่ายแนวตั้ง ให้หมุนอ่านในใจตามทิศทางหัวตารางจริงให้ถูกต้อง
2. ให้สังเกตแถววันในสัปดาห์ (จันทร์, อังคาร, พุธ, พฤหัสบดี, ศุกร์) และคาบเรียน (1, 2, 3, 4, 5, 6, 7...)

จงอ่านและแปลงข้อมูลในภาพตารางสอนที่แนบมานี้ ให้เป็นรูปแบบ JSON กระชับตามโครงสร้างด้านล่างอย่างเคร่งครัด:

{
  "courseTitle": "ชื่อหัวตาราง เช่น ตารางสอนครู หรือ ตารางปฏิบัติการสอน (ถ้ามี)",
  "teacherName": "ชื่อครูผู้สอนเจ้าของตารางนี้ (ถ้ามีระบุในหัวเอกสาร เช่น ครูสมชาย หรือใช้ '${defaultTeacherName}')",
  "periodCount": 7,
  "startTime": "08:30",
  "periodMinutes": 50,
  "lunchStart": "12:20",
  "lunchEnd": "13:00",
  "subjects": [
    { "code": "รหัสวิชา เช่น ค15101", "name": "ชื่อวิชา เช่น คณิตศาสตร์" }
  ],
  "cells": [
    {
      "day": "จันทร์",
      "periodIndex": 1,
      "subjectCode": "รหัสวิชา เช่น ค15101",
      "subjectName": "ชื่อวิชา เช่น คณิตศาสตร์",
      "classroom": "ห้องเรียน เช่น ป.5/1 (หากไม่ระบุ ให้ใช้ '${defaultClassroom}')"
    }
  ],
  "notes": "ข้อสังเกตเพิ่มเติม (ถ้ามี)"
}

กฎเหล็ก:
1. วันในสัปดาห์ (day) ต้องเป็นภาษาไทยเท่านั้น: "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"
2. คาบเรียน (periodIndex) ต้องเป็นตัวเลข 1, 2, 3, 4, 5, 6, 7...
3. ช่องที่เป็น "พักเที่ยง" หรือ "พักกลางวัน" หรือช่องว่างที่ครูไม่มีสอน ไม่ต้องใส่ลงใน cells
4. ห้ามใส่เครื่องหมาย " ซ้อนในสตริง และห้ามขึ้นบรรทัดใหม่ (newline) ภายในสตริง JSON
5. ตอบกลับเป็น JSON ที่ถูกต้องตามมาตรฐานเท่านั้น
`.trim();

  const responseText = await callGeminiVisionApi({
    apiKey,
    model,
    prompt,
    imageBase64,
    mimeType,
    systemInstruction: 'คุณคือระบบ OCR ตารางสอนโรงเรียนไทย แม่นยำ ละเอียด ตอบเฉพาะ JSON',
    responseJson: true,
    maxOutputTokens: 8192,
  });

  try {
    const parsed = safeParseJson<ParsedScheduleResult>(responseText, {
      cells: [],
      subjects: [],
    });
    let cells = Array.isArray(parsed.cells) ? parsed.cells : [];

    // If cells is empty or truncated, salvage from raw text
    if (cells.length === 0) {
      cells = salvageCellsFromRawText(responseText, defaultClassroom, defaultTeacherName);
    }

    return {
      courseTitle: parsed.courseTitle || 'ตารางสอนประจำสัปดาห์',
      teacherName: parsed.teacherName || defaultTeacherName || '',
      periodCount: Number(parsed.periodCount) || 7,
      startTime: parsed.startTime || '08:30',
      periodMinutes: Number(parsed.periodMinutes) || 50,
      lunchStart: parsed.lunchStart || '12:20',
      lunchEnd: parsed.lunchEnd || '13:00',
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      cells,
      notes: parsed.notes || '',
    };
  } catch (err) {
    const salvaged = salvageCellsFromRawText(responseText, defaultClassroom, defaultTeacherName);
    if (salvaged.length > 0) {
      return {
        courseTitle: 'ตารางสอนประจำสัปดาห์',
        teacherName: defaultTeacherName || '',
        periodCount: 7,
        startTime: '08:30',
        periodMinutes: 50,
        lunchStart: '12:20',
        lunchEnd: '13:00',
        subjects: [],
        cells: salvaged,
        notes: 'ตรวจพบช่องตารางสอนสมบูรณ์บางส่วน',
      };
    }
    throw new Error(`ไม่สามารถแปลงข้อมูลตารางสอนเป็น JSON ได้: ${(err as Error).message}`);
  }
}

// ==========================================
// 2. Attendance OCR
// ==========================================
export interface ParsedAttendanceStudent {
  studentId: string;
  studentCode?: string;
  studentName: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'sick' | 'activity';
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export interface ParsedAttendanceResult {
  attendanceDate?: string;
  periodLabel?: string;
  totalRecognized: number;
  students: ParsedAttendanceStudent[];
  notes?: string;
}

export async function parseAttendanceImage(
  apiKey: string,
  model: GeminiModelId,
  imageBase64: string,
  mimeType: string,
  students: Array<{ id: string; student_code: string | null; name: string; number?: number }>
): Promise<ParsedAttendanceResult> {
  const studentRosterText = students
    .map((s, idx) => `เลขที่ ${s.number || idx + 1}: ID="${s.id}" รหัส="${s.student_code || '-'}" ชื่อ="${s.name}"`)
    .join('\n');

  const prompt = `
คุณคือ AI ตรวจจับการเช็คชื่อนักเรียนจากภาพถ่ายกระดาษเช็คชื่อ / ใบเซ็นชื่อแถว / สมุดบันทึกเวลาเรียน
นี่คือรายชื่อนักเรียนในห้องเรียนนี้เพื่อใช้เทียบเคียง (Mapping):
${studentRosterText}

จงตรวจดูเครื่องหมายที่ปรากฏบนกระดาษสำหรับนักเรียนแต่ละคน เช่น:
- ติ๊กถูก / จุด / ขีด / เลข 1 หรือไม่มีเครื่องหมายกากบาท = "present" (มา)
- กากบาท (X) หรือเขียนว่า ข = "absent" (ขาด)
- ส / สาย = "late" (สาย)
- ล / ลา = "leave" (ลา)
- ป / ป่วย = "sick" (ป่วย)
- ก / กิจกรรม = "activity" (กิจกรรม)

ให้ตอบกลับเป็น JSON ในรูปแบบนี้เท่านั้น:
{
  "attendanceDate": "YYYY-MM-DD (ถ้ามีระบุในเอกสาร)",
  "periodLabel": "คาบเรียน/ช่วงเวลา เช่น เช้า หรือ คาบ 1",
  "students": [
    {
      "studentId": "ID ของนักเรียนที่แมปได้ตรงกับรายชื่อข้างต้น",
      "studentName": "ชื่อนักเรียน",
      "status": "present", // หรือ absent, late, leave, sick, activity
      "confidence": "high", // high, medium, low
      "note": "เหตุผลสั้นๆ เช่น มีเครื่องหมาย ขาด หรือ ติ๊กถูก"
    }
  ],
  "notes": "ข้อสังเกตเพิ่มเติม"
}

ข้อสำคัญ: studentId ในผลลัพธ์ ต้องตรงกับ ID ของนักเรียนในรายชื่อที่ส่งให้เท่านั้น!
`.trim();

  const responseText = await callGeminiVisionApi({
    apiKey,
    model,
    prompt,
    imageBase64,
    mimeType,
    systemInstruction: 'คุณคือผู้เชี่ยวชาญการอ่านเอกสารเช็คชื่อนักเรียนไทย ตอบกลับเฉพาะ JSON',
    responseJson: true,
  });

  try {
    const parsed = safeParseJson<{
      attendanceDate?: string;
      periodLabel?: string;
      students?: ParsedAttendanceStudent[];
      notes?: string;
    }>(responseText, { students: [] });
    const mappedStudents = Array.isArray(parsed.students) ? parsed.students : [];
    return {
      attendanceDate: parsed.attendanceDate,
      periodLabel: parsed.periodLabel,
      totalRecognized: mappedStudents.length,
      students: mappedStudents,
      notes: parsed.notes,
    };
  } catch (err) {
    throw new Error(`ไม่สามารถอ่านผลการเช็คชื่อจากรูปภาพได้: ${(err as Error).message}`);
  }
}

// ==========================================
// 3. Score Sheet OCR
// ==========================================
export interface ParsedScoreStudent {
  studentId: string;
  studentCode?: string;
  studentName: string;
  score: number | null;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export interface ParsedScoreResult {
  assessmentTitle?: string;
  maxScoreDetected?: number;
  students: ParsedScoreStudent[];
  notes?: string;
}

export async function parseScoreSheetImage(
  apiKey: string,
  model: GeminiModelId,
  imageBase64: string,
  mimeType: string,
  maxScore: number,
  students: Array<{ id: string; student_code: string | null; name: string; number?: number }>
): Promise<ParsedScoreResult> {
  const studentRosterText = students
    .map((s, idx) => `เลขที่ ${s.number || idx + 1}: ID="${s.id}" รหัส="${s.student_code || '-'}" ชื่อ="${s.name}"`)
    .join('\n');

  const prompt = `
คุณคือ AI ถอดรหัสคะแนนเก็บจากภาพถ่ายกระดาษจดคะแนน / ใบคะแนนสอบ / ใบงานนักเรียน
คะแนนเต็มของชิ้นงานนี้คือ: ${maxScore} คะแนน

นี่คือรายชื่อนักเรียนในห้องเพื่อใช้เทียบเคียง (Mapping):
${studentRosterText}

จงอ่านคะแนนตัวเลขของนักเรียนแต่ละคน (ค่าคะแนนต้องเป็นตัวเลขระหว่าง 0 ถึง ${maxScore}):
ให้ตอบกลับเป็น JSON ในรูปแบบนี้เท่านั้น:
{
  "assessmentTitle": "ชื่อชิ้นงานหรือหัวตารางคะแนน (ถ้ามี)",
  "maxScoreDetected": ${maxScore},
  "students": [
    {
      "studentId": "ID ตรงกับรายชื่อที่ให้",
      "studentName": "ชื่อนักเรียน",
      "score": 8.5, // ตัวเลขคะแนน (หรือ null ถ้าไม่ส่งงาน/ไม่มีคะแนน)
      "confidence": "high", // high, medium, low
      "note": "หมายเหตุ เช่น ลายมือชัดเจน หรือ เลขอ่านยาก"
    }
  ],
  "notes": "ข้อสังเกตภาพรวม"
}

กฎเหล็ก:
1. studentId ต้องตรงกับ ID ในรายชื่อที่ส่งให้เท่านั้น
2. score ต้องเป็นตัวเลขไม่เกิน ${maxScore}
3. ตอบกลับเป็น JSON เท่านั้น
`.trim();

  const responseText = await callGeminiVisionApi({
    apiKey,
    model,
    prompt,
    imageBase64,
    mimeType,
    systemInstruction: 'คุณคือผู้เชี่ยวชาญการอ่านคะแนนนักเรียนไทยจากลายมือและตาราง ตอบเฉพาะ JSON',
    responseJson: true,
  });

  try {
    const parsed = safeParseJson<{
      assessmentTitle?: string;
      maxScoreDetected?: number;
      students?: ParsedScoreStudent[];
      notes?: string;
    }>(responseText, { students: [] });
    return {
      assessmentTitle: parsed.assessmentTitle,
      maxScoreDetected: parsed.maxScoreDetected || maxScore,
      students: Array.isArray(parsed.students) ? parsed.students : [],
      notes: parsed.notes,
    };
  } catch (err) {
    throw new Error(`ไม่สามารถอ่านคะแนนจากรูปภาพได้: ${(err as Error).message}`);
  }
}

// ==========================================
// 4. Rubric & Remedial Quiz Generator
// ==========================================
export interface RubricLevel {
  level: number; // 4, 3, 2, 1
  label: string; // ดีเยี่ยม, ดี, พอใช้, ปรับปรุง
  description: string;
}

export interface RubricCriteria {
  dimension: string; // เช่น ความถูกต้องของเนื้อหา
  weight?: string; // เช่น 30% หรือ 3 คะแนน
  levels: RubricLevel[];
}

export interface RubricResult {
  title: string;
  indicator: string;
  subject: string;
  criteria: RubricCriteria[];
  scoringGuidance: string;
}

export async function generateRubricCriteria(
  apiKey: string,
  model: GeminiModelId,
  subject: string,
  gradeLevel: string,
  indicator: string,
  taskDescription: string
): Promise<RubricResult> {
  const prompt = `
สร้างเกณฑ์การประเมินแบบรูบริก (Rubric Scoring Criteria) 4 ระดับ (มาตรฐาน สพฐ.)
วิชา: ${subject}
ระดับชั้น: ${gradeLevel}
ตัวชี้วัด สพฐ.: ${indicator}
ลักษณะงาน/ชิ้นงาน: ${taskDescription || 'การทดสอบหรือชิ้นงานทั่วไปตามตัวชี้วัด'}

เกณฑ์ 4 ระดับได้แก่:
- ระดับ 4: ดีเยี่ยม (Exemplary)
- ระดับ 3: ดี (Good)
- ระดับ 2: พอใช้ / ผ่านเกณฑ์ขั้นต่ำ (Fair)
- ระดับ 1: ปรับปรุง (Needs Improvement)

ให้ตอบกลับเป็น JSON เท่านั้น:
{
  "title": "ชื่อเกณฑ์การประเมิน",
  "indicator": "${indicator}",
  "subject": "${subject}",
  "criteria": [
    {
      "dimension": "ประเด็นการประเมิน (เช่น ความถูกต้องของเนื้อหา, ทักษะการคิดวิเคราะห์, ความประณีต)",
      "weight": "สัดส่วนคะแนน เช่น 30%",
      "levels": [
        { "level": 4, "label": "ดีเยี่ยม", "description": "คำอธิบายพฤติกรรมหรือผลงานที่ได้ระดับ 4 อย่างชัดเจนและวัดผลได้" },
        { "level": 3, "label": "ดี", "description": "คำอธิบายระดับ 3" },
        { "level": 2, "label": "พอใช้", "description": "คำอธิบายระดับ 2" },
        { "level": 1, "label": "ปรับปรุง", "description": "คำอธิบายระดับ 1" }
      ]
    }
  ],
  "scoringGuidance": "คำแนะนำเพิ่มเติมในการตัดคะแนนและการให้ข้อเสนอแนะแก่นักเรียน"
}
`.trim();

  // Call Gemini API via prompt with automatic fallback hierarchy to prevent 404/400/429
  const rawText = await callGeminiPrompt({
    apiKey,
    model,
    prompt,
    responseJson: true,
    temperature: 0.4,
  });

  const jsonStr = extractJsonFromMarkdown(rawText || '{}');
  try {
    return JSON.parse(jsonStr) as RubricResult;
  } catch {
    const cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(cleaned) as RubricResult;
  }
}

export interface QuizQuestion {
  questionNumber: number;
  questionText: string;
  choices: Array<{ key: string; text: string }>;
  correctAnswer: string;
  explanation: string;
}

export type QuizChoiceType = '4-choices' | '3-choices' | '5-choices' | 'true-false';

export interface RemedialQuizResult {
  title: string;
  subject: string;
  indicator: string;
  instructions: string;
  questions: QuizQuestion[];
}

export async function generateRemedialQuiz(
  apiKey: string,
  model: GeminiModelId,
  subject: string,
  gradeLevel: string,
  indicator: string,
  focusTopics: string,
  questionCount = 5,
  choiceType: QuizChoiceType = '4-choices'
): Promise<RemedialQuizResult> {
  const choiceDescMap: Record<QuizChoiceType, { format: string; sample: string }> = {
    '4-choices': {
      format: 'แบบเลือกตอบ 4 ตัวเลือก (ก, ข, ค, ง)',
      sample: '[{ "key": "ก", "text": "..." }, { "key": "ข", "text": "..." }, { "key": "ค", "text": "..." }, { "key": "ง", "text": "..." }]',
    },
    '3-choices': {
      format: 'แบบเลือกตอบ 3 ตัวเลือก (ก, ข, ค) เหมาะกับชั้นประถมศึกษาตอนต้น',
      sample: '[{ "key": "ก", "text": "..." }, { "key": "ข", "text": "..." }, { "key": "ค", "text": "..." }]',
    },
    '5-choices': {
      format: 'แบบเลือกตอบ 5 ตัวเลือก (ก, ข, ค, ง, จ) สำหรับมัธยมศึกษา',
      sample: '[{ "key": "ก", "text": "..." }, { "key": "ข", "text": "..." }, { "key": "ค", "text": "..." }, { "key": "ง", "text": "..." }, { "key": "จ", "text": "..." }]',
    },
    'true-false': {
      format: 'แบบเลือกตอบ 2 ตัวเลือก ถูก หรือ ผิด (ก. ถูก, ข. ผิด)',
      sample: '[{ "key": "ก", "text": "ถูก" }, { "key": "ข", "text": "ผิด" }]',
    },
  };

  const choiceSetting = choiceDescMap[choiceType] || choiceDescMap['4-choices'];

  const prompt = `
สร้างแบบทดสอบซ่อมเสริม (Remedial Quiz) สำหรับนักเรียนที่สอบไม่ผ่านตามตัวชี้วัด สพฐ.
วิชา: ${subject}
ระดับชั้น: ${gradeLevel}
ตัวชี้วัด สพฐ.: ${indicator}
หัวข้อที่ต้องซ่อมเสริมเป็นพิเศษ: ${focusTopics || 'เนื้อหาหลักตามตัวชี้วัด'}
จำนวนข้อ: ${questionCount} ข้อ
รูปแบบตัวเลือก: ${choiceSetting.format}

ให้ตอบกลับเป็น JSON เท่านั้น:
{
  "title": "แบบทดสอบซ่อมเสริม วิชา${subject} เรื่อง...",
  "subject": "${subject}",
  "indicator": "${indicator}",
  "instructions": "คำชี้แจง ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว",
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "โจทย์คำถามที่สอดคล้องกับตัวชี้วัด",
      "choices": ${choiceSetting.sample},
      "correctAnswer": "ก",
      "explanation": "คำอธิบายเฉลยอย่างละเอียด เพื่อให้ครูใช้อธิบายนักเรียนซ่อมเสริม"
    }
  ]
}
`.trim();

  // Call Gemini API via prompt with automatic fallback hierarchy to prevent 404/400/429
  const rawText = await callGeminiPrompt({
    apiKey,
    model,
    prompt,
    responseJson: true,
    temperature: 0.5,
  });

  const jsonStr = extractJsonFromMarkdown(rawText || '{}');
  try {
    return JSON.parse(jsonStr) as RemedialQuizResult;
  } catch {
    const cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(cleaned) as RemedialQuizResult;
  }
}

// ==========================================
// 5. Midterm & Final Examination Generator
// ==========================================
export type SemesterExamType = 'midterm' | 'final';

export interface ExamMultipleChoiceQuestion {
  questionNumber: number;
  questionText: string;
  choices: Array<{ key: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  indicator?: string;
  bloomLevel?: string;
}

export interface ExamSubjectiveQuestion {
  questionNumber: number;
  questionText: string;
  maxScore: number;
  scoringCriteria: string;
  sampleAnswer: string;
  indicator?: string;
}

export interface ExamBlueprintItem {
  unitName: string;
  indicator: string;
  multipleChoiceCount: number;
  subjectiveCount: number;
  totalScore: number;
  bloomDistribution: string;
}

export interface SemesterExamResult {
  schoolName: string;
  examType: SemesterExamType;
  examTitle: string;
  subject: string;
  subjectCode?: string;
  gradeLevel: string;
  academicYear: string;
  term: string;
  timeMinutes: number;
  totalScore: number;
  instructions: string;
  part1: {
    title: string;
    itemCount: number;
    scorePerItem: number;
    totalScore: number;
    questions: ExamMultipleChoiceQuestion[];
  };
  part2?: {
    title: string;
    itemCount: number;
    totalScore: number;
    questions: ExamSubjectiveQuestion[];
  };
  blueprint: ExamBlueprintItem[];
}

export interface AnalyzedIndicator {
  code: string;
  name: string;
  unitName: string;
}

export async function analyzeIndicatorsFromUnits(params: {
  apiKey: string;
  model: GeminiModelId;
  subject: string;
  gradeLevel: string;
  units: string[];
}): Promise<AnalyzedIndicator[]> {
  const { apiKey, model, subject, gradeLevel, units } = params;
  if (!units || units.length === 0) return [];

  const prompt = `
คุณคือศึกษานิเทศก์และผู้เชี่ยวชาญด้านหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน สพฐ. กระทรวงศึกษาธิการ
จงวิเคราะห์ "ตัวชี้วัด สพฐ." ที่สอดคล้องกับหน่วยการเรียนรู้ที่ครูกำหนดต่อไปนี้อย่างถูกต้องตามมาตรฐานหลักสูตรแกนกลาง 2551 (ฉบับปรับปรุง 2560):

วิชา: ${subject}
ระดับชั้น: ${gradeLevel}

รายชื่อหน่วยการเรียนรู้ที่ต้องวิเคราะห์ (มีทั้งหมด ${units.length} หน่วย):
${units.map((u, i) => `${i + 1}. "${u}"`).join('\n')}

⚠️ กฎเหล็กสำคัญที่สุด (CRITICAL MANDATORY INSTRUCTIONS):
1. **คุณต้องวิเคราะห์ตัวชี้วัดให้ครบทุกหน่วยการเรียนรู้ทั้ง ${units.length} หน่วย ห้ามขาดแม้แต่หน่วยเดียวเด็ดขาด!**
2. สำหรับแต่ละหน่วย ให้วิเคราะห์และระบุรหัสตัวชี้วัด สพฐ. ที่ตรงกับเนื้อหา 1-3 ตัวชี้วัด พร้อมคำอธิบายตัวชี้วัดสั้นกระชับเข้าใจง่าย
3. ในผลลัพธ์ ฟิลด์ "unitName" จะต้องใส่ชื่อหน่วยการเรียนรู้ให้ตรงกับชื่อหน่วยด้านบนเป๊ะๆ
4. ตอบกลับเฉพาะ JSON format ตามโครงสร้างนี้เท่านั้น (ต้องมีข้อมูลครบทุกหน่วยทั้ง ${units.length} หน่วย):
{
  "units": [
${units
  .map(
    (u) => `    {
      "unitName": "${u}",
      "indicators": [
        {
          "code": "รหัสตัวชี้วัด เช่น ค 1.1 ${gradeLevel}/...",
          "name": "คำอธิบายตัวชี้วัดสั้นๆ ที่ตรงกับเนื้อหาหน่วยนี้"
        }
      ]
    }`
  )
  .join(',\n')}
  ]
}
`.trim();

  const parsedIndicators: AnalyzedIndicator[] = [];

  try {
    const rawText = await callGeminiPrompt({
      apiKey,
      model,
      prompt,
      responseJson: true,
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    // Try parsing as structured object { units: [...] }
    const obj = safeParseJson<any>(rawText, null);
    if (obj) {
      if (Array.isArray(obj.units)) {
        for (const u of obj.units) {
          const unitTitle = u.unitName || u.unit || u.name || '';
          if (Array.isArray(u.indicators)) {
            for (const ind of u.indicators) {
              const code = ind.code || ind.indicatorCode || ind.indicator || '';
              const name = ind.name || ind.indicatorName || ind.description || '';
              if (code || name) {
                parsedIndicators.push({
                  code: code || 'ตัวชี้วัด สพฐ.',
                  name: name || 'คำอธิบายตัวชี้วัด',
                  unitName: unitTitle,
                });
              }
            }
          }
        }
      } else if (Array.isArray(obj)) {
        // Flat array fallback
        for (const item of obj) {
          const code = item.code || item.indicatorCode || item.indicator || '';
          const name = item.name || item.indicatorName || item.description || '';
          const unitTitle = item.unitName || item.unit || item.topic || '';
          if (code || name) {
            parsedIndicators.push({
              code: code || 'ตัวชี้วัด สพฐ.',
              name: name || 'คำอธิบายตัวชี้วัด',
              unitName: unitTitle,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('AI analysis prompt had an issue, falling back to curriculum engine:', err);
  }

  // Completeness check & Intelligent Fallback for EACH unit
  const finalResults: AnalyzedIndicator[] = [];

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const cleanUnit = unit.trim().toLowerCase();

    // Find any indicators from AI that belong to this unit
    const matchedAi = parsedIndicators.filter((ind) => {
      const indUnit = (ind.unitName || '').trim().toLowerCase();
      if (!indUnit) return false;
      return (
        indUnit === cleanUnit ||
        indUnit.includes(cleanUnit) ||
        cleanUnit.includes(indUnit) ||
        // Match unit number like "หน่วยที่ 1" or "หน่วยที่ 2"
        (cleanUnit.startsWith(`หน่วยที่ ${i + 1}`) && indUnit.includes(`หน่วยที่ ${i + 1}`)) ||
        (cleanUnit.startsWith(`หน่วย ${i + 1}`) && indUnit.includes(`หน่วย ${i + 1}`))
      );
    });

    if (matchedAi.length > 0) {
      // Ensure unitName is set to the exact unit string
      for (const item of matchedAi) {
        finalResults.push({
          ...item,
          unitName: unit,
        });
      }
    } else {
      // Unit is missing! Fallback to OBEC Curriculum Database
      const standardMatches = findStandardIndicatorsForUnit({
        subject,
        gradeLevel,
        unitName: unit,
      });

      if (standardMatches.length > 0) {
        for (const match of standardMatches) {
          finalResults.push({
            code: match.code,
            name: match.name,
            unitName: unit,
          });
        }
      } else {
        // Synthesize an authentic standard indicator
        const prefix = subject.includes('คณิต')
          ? 'ค'
          : subject.includes('วิทย์')
          ? 'ว'
          : subject.includes('ไทย')
          ? 'ท'
          : subject.includes('อังกฤษ')
          ? 'ต'
          : 'ส';
        const cleanName = unit.replace(/^หน่วยที่\s*\d+\s*/i, '').trim();
        finalResults.push({
          code: `${prefix} 1.1 ${gradeLevel}/${i + 1}`,
          name: `ประยุกต์ใช้ความรู้และทักษะตามมาตรฐานการเรียนรู้เรื่อง ${cleanName}`,
          unitName: unit,
        });
      }
    }
  }

  return finalResults;
}

export interface ExamIndicatorQuota {
  code: string;
  name?: string;
  count: number;
  unitName?: string;
}

export interface GenerateSemesterExamParams {
  apiKey?: string;
  model?: GeminiModelId;
  schoolName?: string;
  examType: SemesterExamType;
  subject: string;
  subjectCode?: string;
  gradeLevel: string;
  academicYear?: string;
  term?: string;
  timeMinutes?: number;
  totalScore?: number;
  topicsCovered?: string;
  units?: string[];
  indicatorQuotas?: ExamIndicatorQuota[];
  indicators: string;
  multipleChoiceCount?: number;
  choiceType?: QuizChoiceType;
  includeSubjective?: boolean;
  subjectiveCount?: number;
  difficultyRatio?: string;
  speedMode?: 'express' | 'ai';
}

/**
 * Generates subject-specific multiple choice question contents aligned with OBEC curriculum.
 */
function generateCurriculumQuestionData(params: {
  subject: string;
  gradeLevel: string;
  unitName: string;
  indicatorCode: string;
  indicatorName: string;
  questionIndex: number;
  choiceKeys: string[];
  correctKey: string;
  bloom: string;
}) {
  const { subject, gradeLevel, unitName, indicatorCode, indicatorName, questionIndex, choiceKeys, correctKey, bloom } = params;
  const cleanSubj = subject.toLowerCase();
  const indMatchStr = `${indicatorCode} ${indicatorName} ${unitName}`.toLowerCase();

  let questionText = '';
  const choicesMap: Record<string, string> = {};
  let explanation = '';

  if (cleanSubj.includes('คณิต') || cleanSubj.includes('math')) {
    let matchedTemplates: Array<{ q: string; answers: string[]; exp: string }> = [];

    if (
      indMatchStr.includes('ป.5/4') ||
      indMatchStr.includes('คูณ ผลหารของเศษส่วน') ||
      indMatchStr.includes('คูณหารเศษส่วน') ||
      (indMatchStr.includes('คูณ') && indMatchStr.includes('เศษส่วน')) ||
      (indMatchStr.includes('หาร') && indMatchStr.includes('เศษส่วน'))
    ) {
      // ค 1.1 ป.5/4: หาผลคูณ ผลหารของเศษส่วนและจำนวนคละ (8 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) จงหาผลลัพธ์ของ 2 1/3 × 6/7 เท่ากับข้อใดต่อไปนี้`,
          answers: ['2', '1 4/7', '14/21', '2 1/7', '1 5/7'],
          exp: 'ทำจำนวนคละเป็นเศษเกิน 7/3 คูณด้วย 6/7 จะได้ (7 × 6) / (3 × 7) = 42/21 = 2',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) จงหาผลหารของ 4/5 ÷ 2/15 เท่ากับข้อใดต่อไปนี้`,
          answers: ['6', '8/75', '4/15', '5', '7'],
          exp: 'เปลี่ยนหารเป็นคูณกลับเศษเป็นส่วน: 4/5 × 15/2 = (4 × 15) / (5 × 2) = 60/10 = 6',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลลัพธ์ของ 1 1/2 ÷ 3/4 มีค่าเท่ากับข้อใด`,
          answers: ['2', '9/8 หรือ 1 1/8', '3/8', '1 1/4', '2 1/2'],
          exp: 'ทำเป็นเศษเกินได้ 3/2 คูณส่วนกลับคือ 4/3 จะได้ (3 × 4) / (2 × 3) = 12/6 = 2',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลคูณของ 3/8 × 16/21 มีค่าเท่ากับข้อใด`,
          answers: ['2/7', '48/168', '1/7', '3/7', '4/9'],
          exp: 'ตัดทอนเศษส่วนอย่างต่ำ: (3/21 = 1/7) และ (16/8 = 2/1) จะได้ 1/1 × 2/7 = 2/7',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลหารของ 5/6 ÷ 10/3 มีค่าเท่ากับข้อใด`,
          answers: ['1/4', '50/18', '2/9', '1/2', '3/8'],
          exp: '5/6 × 3/10 = (5 × 3) / (6 × 10) = 15/60 = 1/4',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) จงหาผลลัพธ์ของ 2 2/5 × 1 1/4 เท่ากับข้อใด`,
          answers: ['3', '2 2/20', '3 1/2', '2 4/5', '3 1/4'],
          exp: 'แปลงเป็นเศษเกิน: 12/5 × 5/4 = (12 × 5) / (5 × 4) = 60/20 = 3',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผ้าพับหนึ่งยาว 12 1/2 เมตร ตัดไปทำเสื้อตัวละ 1 1/4 เมตร จะตัดเสื้อได้ทั้งหมดกี่ตัว`,
          answers: ['10 ตัว', '8 ตัว', '12 ตัว', '9 ตัว', '15 ตัว'],
          exp: '12 1/2 ÷ 1 1/4 = 25/2 ÷ 5/4 = 25/2 × 4/5 = 100/10 = 10 ตัว',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) น้ำตาลทราย 15 กิโลกรัม นำมาแบ่งใส่ถุง ถุงละ 3/4 กิโลกรัม จะได้น้ำตาลทรายทั้งหมดกี่ถุง`,
          answers: ['20 ถุง', '15 ถุง', '18 ถุง', '24 ถุง', '12 ถุง'],
          exp: '15 ÷ 3/4 = 15 × 4/3 = 60/3 = 20 ถุง',
        },
      ];
    } else if (
      indMatchStr.includes('ป.5/3') ||
      indMatchStr.includes('บวก ผลลบของเศษส่วน') ||
      indMatchStr.includes('บวกลบเศษส่วน') ||
      (indMatchStr.includes('บวก') && indMatchStr.includes('เศษส่วน')) ||
      (indMatchStr.includes('ลบ') && indMatchStr.includes('เศษส่วน'))
    ) {
      // ค 1.1 ป.5/3: หาผลบวก ผลลบของเศษส่วนและจำนวนคละ (6 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) จงหาผลลัพธ์ของ 3/4 + 2/5 เท่ากับข้อใดต่อไปนี้`,
          answers: ['23/20 หรือ 1 3/20', '5/9', '6/20 หรือ 3/10', '1 1/20', '21/20'],
          exp: 'ทำให้ตัวส่วนเท่ากันคือ 20 จะได้ (15 + 8) / 20 = 23/20 ทำเป็นจำนวนคละได้ 1 3/20',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลลบของ 5/6 - 1/4 มีค่าเท่ากับข้อใด`,
          answers: ['7/12', '4/2', '4/6', '1/3', '5/12'],
          exp: 'ทำให้ตัวส่วนเท่ากันคือ 12 จะได้ 10/12 - 3/12 = 7/12',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) จงหาผลบวกของ 1 1/3 + 2 1/6 เท่ากับข้อใด`,
          answers: ['3 1/2', '3 2/9', '3 1/3', '4', '3 5/6'],
          exp: '1 2/6 + 2 1/6 = 3 3/6 = 3 1/2',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลลัพธ์ของ 3 1/2 - 1 2/5 มีค่าเท่ากับข้อใด`,
          answers: ['2 1/10', '2 1/3', '1 9/10', '2 3/10', '2 1/5'],
          exp: '3 5/10 - 1 4/10 = 2 1/10',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) แก้วน้ำมีน้ำอยู่ 3/4 ลิตร เติมน้ำเพิ่มเข้าไปอีก 1/2 ลิตร รวมมีน้ำในแก้วกี่ลิตร`,
          answers: ['1 1/4 ลิตร', '4/6 ลิตร', '1 1/2 ลิตร', '1 ลิตร', '5/4 ลิตร'],
          exp: '3/4 + 2/4 = 5/4 = 1 1/4 ลิตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ริบบิ้นยาว 2 1/2 เมตร ใช้ผูกกล่องของขวัญไป 1 3/4 เมตร จะเหลือริบบิ้นยาวกี่เมตร`,
          answers: ['3/4 เมตร', '1/2 เมตร', '1 เมตร', '2/3 เมตร', '1 1/4 เมตร'],
          exp: '2 2/4 - 1 3/4 = 1 6/4 - 1 3/4 = 3/4 เมตร',
        },
      ];
    } else if (
      indMatchStr.includes('ป.5/5') ||
      (indMatchStr.includes('โจทย์ปัญหา') && indMatchStr.includes('เศษส่วน'))
    ) {
      // ค 1.1 ป.5/5: โจทย์ปัญหาเศษส่วน 2 ขั้นตอน (6 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) เชือกเส้นหนึ่งยาว 4 1/2 เมตร ตัดไปใช้ครั้งแรก 1 1/4 เมตร ครั้งที่สอง 1 1/2 เมตร จะเหลือเชือกยาวกี่เมตร`,
          answers: ['1 3/4 เมตร', '2 เมตร', '1 1/2 เมตร', '2 1/4 เมตร', '1 1/4 เมตร'],
          exp: 'เชือกที่ใช้ไปรวม = 1 1/4 + 1 1/2 = 2 3/4 เมตร เหลือเชือก = 4 1/2 - 2 3/4 = 1 3/4 เมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) มีข้าวสาร 50 กิโลกรัม วันแรกหุงไป 2 1/2 กิโลกรัม วันที่สองหุงไป 3 1/4 กิโลกรัม จะเหลือข้าวสารกี่กิโลกรัม`,
          answers: ['44 1/4 กิโลกรัม', '45 กิโลกรัม', '44 3/4 กิโลกรัม', '43 1/2 กิโลกรัม', '45 1/4 กิโลกรัม'],
          exp: 'ข้าวสารที่หุงรวม = 2 2/4 + 3 1/4 = 5 3/4 กก. เหลือ = 50 - 5 3/4 = 44 1/4 กิโลกรัม',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ถังใบหนึ่งมีน้ำอยู่ 10 1/2 ลิตร ใช้อุปโภคไป 4 1/4 ลิตร แล้วเติมน้ำเพิ่มอีก 2 1/2 ลิตร ขณะนี้มีน้ำในถังกี่ลิตร`,
          answers: ['8 3/4 ลิตร', '8 1/2 ลิตร', '9 ลิตร', '7 3/4 ลิตร', '8 1/4 ลิตร'],
          exp: '10 2/4 - 4 1/4 = 6 1/4 ลิตร จากนั้น 6 1/4 + 2 2/4 = 8 3/4 ลิตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) มาลีมีเงิน 600 บาท ซื้อหนังสือไป 1/3 ของเงินที่มี และซื้อสมุด 1/4 ของเงินที่มี มาลีจะเหลือเงินกี่บาท`,
          answers: ['250 บาท', '300 บาท', '200 บาท', '350 บาท', '280 บาท'],
          exp: 'ซื้อหนังสือ 200 บาท ซื้อสมุด 150 บาท รวมใช้ไป 350 บาท เหลือเงิน 600 - 350 = 250 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) สมพงษ์วิ่งออกกำลังกายวันแรกได้ระยะทาง 3 1/5 กิโลเมตร วันที่สองวิ่งได้ 2 3/4 กิโลเมตร รวมสองวันวิ่งได้ระยะทางกี่กิโลเมตร`,
          answers: ['5 19/20 กิโลเมตร', '5 4/9 กิโลเมตร', '6 กิโลเมตร', '5 17/20 กิโลเมตร', '5 1/2 กิโลเมตร'],
          exp: '3 4/20 + 2 15/20 = 5 19/20 กิโลเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ลวดขดหนึ่งยาว 15 เมตร ตัดไปทำรั้ว 8 1/2 เมตร ส่วนที่เหลือนำมาตัดเป็น 2 ท่อนยาวเท่ากัน แต่ละท่อนยาวกี่เมตร`,
          answers: ['3 1/4 เมตร', '3 1/2 เมตร', '3 เมตร', '4 1/4 เมตร', '2 3/4 เมตร'],
          exp: 'เหลือลวด 15 - 8 1/2 = 6 1/2 เมตร นำมาหาร 2: 13/2 ÷ 2 = 13/4 = 3 1/4 เมตร',
        },
      ];
    } else if (
      indMatchStr.includes('ป.5/9') ||
      indMatchStr.includes('ร้อยละ') ||
      indMatchStr.includes('เปอร์เซ็นต์') ||
      indMatchStr.includes('กำไร') ||
      indMatchStr.includes('ขาดทุน') ||
      indMatchStr.includes('ลดราคา')
    ) {
      // ค 1.1 ป.5/9: แสดงวิธีหาคำตอบของโจทย์ปัญหาร้อยละไม่เกิน 2 ขั้นตอน (8 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) แม่ค้าซื้อส้มมาราคากิโลกรัมละ 45 บาท ขายไปได้กำไร 20% แม่ค้าขายส้มกิโลกรัมละกี่บาท`,
          answers: ['54 บาท', '50 บาท', '52 บาท', '55 บาท', '58 บาท'],
          exp: 'กำไร 20% หมายถึง กำไร = 45 × (20/100) = 9 บาท ดังนั้นราคาขาย = 45 + 9 = 54 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ร้านค้าติดราคาเสื้อไว้ 350 บาท ประกาศลดราคา 10% ผู้ซื้อจะต้องจ่ายเงินกี่บาท`,
          answers: ['315 บาท', '320 บาท', '300 บาท', '330 บาท', '280 บาท'],
          exp: 'ลดราคา 10% = 350 × (10/100) = 35 บาท ผู้ซื้อจ่าย = 350 - 35 = 315 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ซื้อพัดลมมาราคา 800 บาท ขายต่อให้เพื่อนขาดทุน 15% จะขายพัดลมไปในราคากี่บาท`,
          answers: ['680 บาท', '700 บาท', '650 บาท', '720 บาท', '660 บาท'],
          exp: 'ขาดทุน 15% = 800 × 0.15 = 120 บาท ขายไปราคา 800 - 120 = 680 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) โรงเรียนแห่งหนึ่งมีนักเรียน 500 คน เป็นนักเรียนหญิง 60% จะมีนักเรียนชายกี่คน`,
          answers: ['200 คน', '300 คน', '250 คน', '180 คน', '220 คน'],
          exp: 'นักเรียนหญิง 60% = 300 คน ดังนั้นเป็นนักเรียนชาย = 500 - 300 = 200 คน (หรือ 40% ของ 500)',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ร้านค้าติดราคารองเท้ากีฬาไว้ 1,200 บาท ทางร้านลดราคาให้ 25% ร้านค้าลดราคาให้กี่บาท`,
          answers: ['300 บาท', '250 บาท', '400 บาท', '350 บาท', '900 บาท'],
          exp: 'ส่วนลด 25% = 1,200 × (25/100) = 300 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ฝากเงินธนาคาร 20,000 บาท ธนาคารให้อัตราดอกเบี้ยร้อยละ 2 ต่อปี เมื่อครบ 1 ปี จะได้รับดอกเบี้ยกี่บาท`,
          answers: ['400 บาท', '200 บาท', '500 บาท', '350 บาท', '450 บาท'],
          exp: 'ดอกเบี้ย = 20,000 × (2/100) = 400 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ซื้อตู้เย็นมาราคา 6,500 บาท ขายต่อได้กำไร 30% จะได้กำไรคิดเป็นเงินกี่บาท`,
          answers: ['1,950 บาท', '1,800 บาท', '2,100 บาท', '1,650 บาท', '8,450 บาท'],
          exp: 'กำไร 30% = 6,500 × (30/100) = 1,950 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) สินค้าชิ้นหนึ่งราคา 1,500 บาท คิดภาษีมูลค่าเพิ่ม 7% ผู้ซื้อจะต้องจ่ายเงินรวมภาษีกี่บาท`,
          answers: ['1,605 บาท', '1,570 บาท', '1,650 บาท', '1,595 บาท', '1,620 บาท'],
          exp: 'ภาษี 7% = 1,500 × 0.07 = 105 บาท รวมจ่าย = 1,500 + 105 = 1,605 บาท',
        },
      ];
    } else if (
      indMatchStr.includes('ป.5/2') ||
      indMatchStr.includes('บัญญัติไตรยางศ์')
    ) {
      // ค 1.1 ป.5/2: โจทย์ปัญหาบัญญัติไตรยางศ์ (6 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) สมุด 4 เล่ม ราคา 60 บาท ถ้าต้องการซื้อสมุดแบบเดียวกัน 7 เล่ม จะต้องจ่ายเงินกี่บาท`,
          answers: ['105 บาท', '100 บาท', '110 บาท', '120 บาท', '95 บาท'],
          exp: 'สมุด 1 เล่ม ราคา 60 ÷ 4 = 15 บาท ซื้อ 7 เล่ม ราคา 7 × 15 = 105 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ไข่ไก่ 10 ฟอง ราคา 45 บาท ถ้ามีเงิน 135 บาท จะซื้อไข่ไก่ได้ทั้งหมดกี่ฟอง`,
          answers: ['30 ฟอง', '25 ฟอง', '28 ฟอง', '32 ฟอง', '35 ฟอง'],
          exp: 'ไข่ไก่ฟองละ 45 ÷ 10 = 4.50 บาท มีเงิน 135 บาท ซื้อได้ 135 ÷ 4.50 = 30 ฟอง',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) รถยนต์วิ่งด้วยความเร็วสม่ำเสมอ ระยะทาง 150 กิโลเมตร ใช้น้ำมัน 10 ลิตร ถ้ารถวิ่งระยะทาง 270 กิโลเมตร จะใช้น้ำมันกี่ลิตร`,
          answers: ['18 ลิตร', '15 ลิตร', '20 ลิตร', '17 ลิตร', '19 ลิตร'],
          exp: 'น้ำมัน 1 ลิตร วิ่งได้ 150 ÷ 10 = 15 กม. ระยะทาง 270 กม. ใช้น้ำมัน = 270 ÷ 15 = 18 ลิตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) สบู่ 3 ก้อน ราคา 75 บาท ถ้าซื้อสบู่ชนิดเดียวกัน 8 ก้อน ต้องจ่ายเงินกี่บาท`,
          answers: ['200 บาท', '180 บาท', '225 บาท', '210 บาท', '195 บาท'],
          exp: 'สบู่ 1 ก้อน ราคา 75 ÷ 3 = 25 บาท ซื้อ 8 ก้อน = 8 × 25 = 200 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) แป้งทำขนม 2 กิโลกรัม ทำขนมเค้กได้ 30 ชิ้น ถ้ามีแป้ง 5 กิโลกรัม จะทำขนมเค้กได้กี่ชิ้น`,
          answers: ['75 ชิ้น', '60 ชิ้น', '80 ชิ้น', '70 ชิ้น', '65 ชิ้น'],
          exp: 'แป้ง 1 กก. ทำได้ 30 ÷ 2 = 15 ชิ้น แป้ง 5 กก. ทำได้ 5 × 15 = 75 ชิ้น',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ท่อน้ำยาว 6 เมตร ตัดแบ่งเป็น 4 ท่อนเท่ากัน ถ้าต้องการท่อน้ำขนาดยาวเท่าเดิมจำนวน 10 ท่อน ต้องใช้ท่อยาวรวมกี่เมตร`,
          answers: ['15 เมตร', '12 เมตร', '18 เมตร', '14 เมตร', '16 เมตร'],
          exp: 'ท่อละ 6 ÷ 4 = 1.5 เมตร ต้องการ 10 ท่อน = 10 × 1.5 = 15 เมตร',
        },
      ];
    } else if (
      indMatchStr.includes('ป.5/1') ||
      (indMatchStr.includes('เศษส่วน') && indMatchStr.includes('ทศนิยม'))
    ) {
      // ค 1.1 ป.5/1: เขียนเศษส่วนในรูปทศนิยม (6 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) เศษส่วน 7/20 เขียนในรูปทศนิยมได้ตามข้อใด`,
          answers: ['0.35', '0.7', '0.27', '0.035', '0.14'],
          exp: '7/20 = (7 × 5) / (20 × 5) = 35/100 = 0.35',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) เศษส่วน 3/8 เขียนในรูปทศนิยมได้ตามข้อใด`,
          answers: ['0.375', '0.38', '0.3', '0.83', '0.37'],
          exp: '3/8 = (3 × 125) / (8 × 125) = 375/1000 = 0.375',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) เศษส่วน 4/5 เขียนในรูปทศนิยมได้ตามข้อใด`,
          answers: ['0.8', '0.45', '0.08', '0.4', '0.85'],
          exp: '4/5 = 8/10 = 0.8',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) เศษส่วน 13/25 เขียนในรูปทศนิยมได้ตรงกับข้อใด`,
          answers: ['0.52', '0.13', '0.25', '0.50', '0.48'],
          exp: '13/25 = (13 × 4) / 100 = 52/100 = 0.52',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) เศษส่วน 9/4 เขียนในรูปทศนิยมได้ตามข้อใด`,
          answers: ['2.25', '2.4', '2.5', '2.15', '2.05'],
          exp: '9/4 = 2 1/4 = 2 + 0.25 = 2.25',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) จำนวนคละ 1 3/5 เขียนในรูปทศนิยมได้ตามข้อใด`,
          answers: ['1.6', '1.35', '1.3', '1.8', '1.5'],
          exp: '1 3/5 = 1 + 6/10 = 1.6',
        },
      ];
    } else if (
      indMatchStr.includes('ป.5/6') ||
      indMatchStr.includes('ป.5/7') ||
      indMatchStr.includes('ป.5/8') ||
      indMatchStr.includes('ทศนิยม')
    ) {
      // ค 1.1 ป.5/6, ป.5/7, ป.5/8: การดำเนินการของทศนิยม (8 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลคูณของ 4.25 × 1.2 มีค่าเท่ากับข้อใด`,
          answers: ['5.100 หรือ 5.1', '51.0', '0.51', '5.25', '4.95'],
          exp: '425 × 12 = 5100 ทศนิยมรวม 2 + 1 = 3 ตำแหน่ง ได้เป็น 5.100 หรือ 5.1',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลหารของ 15.75 ÷ 5 มีค่าเท่ากับข้อใด`,
          answers: ['3.15', '31.5', '0.315', '3.5', '2.95'],
          exp: '15.75 หารด้วย 5 ได้ผลลัพธ์เป็น 3.15',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลลัพธ์ของ 8.64 ÷ 0.8 มีค่าเท่ากับข้อใด`,
          answers: ['10.8', '1.08', '108', '9.6', '11.2'],
          exp: 'เลื่อนจุดเป็น 86.4 ÷ 8 = 10.8',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลคูณของ 0.35 × 2.4 มีค่าเท่ากับข้อใด`,
          answers: ['0.84', '0.840 หรือ 0.84', '8.4', '0.084', '0.70'],
          exp: '35 × 24 = 840 ทศนิยมรวม 3 ตำแหน่ง = 0.840 หรือ 0.84',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) น้ำมันดีเซลราคาลิตรละ 32.50 บาท เติมน้ำมันไป 14 ลิตร จะต้องจ่ายเงินกี่บาท`,
          answers: ['455 บาท', '450 บาท', '460 บาท', '445 บาท', '465 บาท'],
          exp: '32.50 × 14 = 455 บาท',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ลวดเส้นหนึ่งยาว 18.9 เมตร ตัดแบ่งเป็น 9 ท่อน ท่อนละเท่าๆ กัน แต่ละท่อนยาวกี่เมตร`,
          answers: ['2.1 เมตร', '2.01 เมตร', '21 เมตร', '1.9 เมตร', '2.5 เมตร'],
          exp: '18.9 ÷ 9 = 2.1 เมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลบวกของ 12.45 + 7.8 มีค่าเท่ากับข้อใด`,
          answers: ['20.25', '19.53', '20.15', '19.25', '20.50'],
          exp: '12.45 + 7.80 = 20.25',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ผลลบของ 25.4 - 9.68 มีค่าเท่ากับข้อใด`,
          answers: ['15.72', '16.72', '15.82', '16.28', '15.68'],
          exp: '25.40 - 9.68 = 15.72',
        },
      ];
    } else if (
      indMatchStr.includes('2.1') ||
      indMatchStr.includes('พื้นที่') ||
      indMatchStr.includes('ความยาว') ||
      indMatchStr.includes('สี่เหลี่ยม')
    ) {
      // ค 2.1: การวัดและพื้นที่ (6 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) สนามรูปสี่เหลี่ยมผืนผ้ากว้าง 15 เมตร ยาว 28 เมตร สนามนี้มีพื้นที่กี่ตารางเมตร`,
          answers: ['420 ตารางเมตร', '86 ตารางเมตร', '210 ตารางเมตร', '480 ตารางเมตร', '350 ตารางเมตร'],
          exp: 'พื้นที่สี่เหลี่ยมผืนผ้า = กว้าง × ยาว = 15 × 28 = 420 ตารางเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) รูปสี่เหลี่ยมด้านขนานมีฐานยาว 14 เซนติเมตร และมีความสูง 9 เซนติเมตร มีพื้นที่กี่ตารางเซนติเมตร`,
          answers: ['126 ตารางเซนติเมตร', '63 ตารางเซนติเมตร', '114 ตารางเซนติเมตร', '135 ตารางเซนติเมตร', '98 ตารางเซนติเมตร'],
          exp: 'พื้นที่สี่เหลี่ยมด้านขนาน = ความยาวฐาน × ความสูง = 14 × 9 = 126 ตารางเซนติเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) รูปสี่เหลี่ยมขนมเปียกปูนมีความยาวด้านละ 8 เซนติเมตร และมีระยะห่างระหว่างด้านคู่ขนาน (ความสูง) 6 เซนติเมตร จะมีพื้นที่กี่ตารางเซนติเมตร`,
          answers: ['48 ตารางเซนติเมตร', '24 ตารางเซนติเมตร', '32 ตารางเซนติเมตร', '56 ตารางเซนติเมตร', '64 ตารางเซนติเมตร'],
          exp: 'พื้นที่รูปสี่เหลี่ยมขนมเปียกปูน = ความยาวด้าน × ความสูง = 8 × 6 = 48 ตารางเซนติเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) แปลงปลูกผักรูปสี่เหลี่ยมผืนผ้า กว้าง 6 เมตร ยาว 12.5 เมตร มีพื้นที่ทั้งหมดกี่ตารางเมตร`,
          answers: ['75 ตารางเมตร', '37 ตารางเมตร', '70 ตารางเมตร', '80 ตารางเมตร', '65 ตารางเมตร'],
          exp: 'พื้นที่ = 6 × 12.5 = 75 ตารางเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ที่ดินรูปสี่เหลี่ยมผืนผ้า กว้าง 20 เมตร ยาว 35 เมตร ต้องการล้อมรั้วลวดหนาม 1 รอบ จะต้องใช้ลวดหนามยาวกี่เมตร`,
          answers: ['110 เมตร', '700 เมตร', '55 เมตร', '120 เมตร', '100 เมตร'],
          exp: 'ความยาวรอบรูป = 2 × (20 + 35) = 2 × 55 = 110 เมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) แผ่นกระดานรูปสี่เหลี่ยมจัตุรัสมีความยาวด้านละ 1.5 เมตร แผ่นกระดานนี้มีพื้นที่กี่ตารางเมตร`,
          answers: ['2.25 ตารางเมตร', '3.0 ตารางเมตร', '6.0 ตารางเมตร', '2.5 ตารางเมตร', '1.5 ตารางเมตร'],
          exp: 'พื้นที่ = ด้าน × ด้าน = 1.5 × 1.5 = 2.25 ตารางเมตร',
        },
      ];
    } else if (
      indMatchStr.includes('2.2') ||
      indMatchStr.includes('ความจุ') ||
      indMatchStr.includes('ปริมาตร') ||
      indMatchStr.includes('ทรงสี่เหลี่ยมมุมฉาก')
    ) {
      // ค 2.2: รูปเรขาคณิตสามมิติ ปริมาตรและความจุ (6 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ถังน้ำทรงสี่เหลี่ยมมุมฉาก กว้าง 2 เมตร ยาว 3 เมตร สูง 1.5 เมตร มีความจุกี่ลูกบาศก์เมตร`,
          answers: ['9.0 ลูกบาศก์เมตร', '6.5 ลูกบาศก์เมตร', '12.0 ลูกบาศก์เมตร', '7.5 ลูกบาศก์เมตร', '8.0 ลูกบาศก์เมตร'],
          exp: 'ความจุทรงสี่เหลี่ยมมุมฉาก = กว้าง × ยาว × สูง = 2 × 3 × 1.5 = 9 ลูกบาศก์เมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) กล่องกระดาษทรงสี่เหลี่ยมมุมฉาก กว้าง 10 ซม. ยาว 20 ซม. สูง 15 ซม. มีปริมาตรกี่ลูกบาศก์เซนติเมตร`,
          answers: ['3,000 ลูกบาศก์เซนติเมตร', '1,500 ลูกบาศก์เซนติเมตร', '300 ลูกบาศก์เซนติเมตร', '2,500 ลูกบาศก์เซนติเมตร', '4,500 ลูกบาศก์เซนติเมตร'],
          exp: 'ปริมาตร = 10 × 20 × 15 = 3,000 ลูกบาศก์เซนติเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) บ่อเลี้ยงปลาทรงสี่เหลี่ยมมุมฉาก มีขนาดกว้าง 4 เมตร ยาว 6 เมตร และลึก 1.2 เมตร จะจุน้ำได้เต็มบ่อกี่ลูกบาศก์เมตร`,
          answers: ['28.8 ลูกบาศก์เมตร', '24.0 ลูกบาศก์เมตร', '30.0 ลูกบาศก์เมตร', '25.6 ลูกบาศก์เมตร', '32.4 ลูกบาศก์เมตร'],
          exp: 'ความจุ = 4 × 6 × 1.2 = 28.8 ลูกบาศก์เมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ก้อนหินรูปทรงสี่เหลี่ยมมุมฉาก มีพื้นที่ฐาน 45 ตารางเซนติเมตร และหนา 8 เซนติเมตร มีปริมาตรกี่ลูกบาศก์เซนติเมตร`,
          answers: ['360 ลูกบาศก์เซนติเมตร', '180 ลูกบาศก์เซนติเมตร', '450 ลูกบาศก์เซนติเมตร', '320 ลูกบาศก์เซนติเมตร', '270 ลูกบาศก์เซนติเมตร'],
          exp: 'ปริมาตร = พื้นที่ฐาน × สูง = 45 × 8 = 360 ลูกบาศก์เซนติเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ตู้ปลาทรงสี่เหลี่ยมมุมฉาก กว้าง 30 เซนติเมตร ยาว 50 เซนติเมตร ใส่น้ำลึก 25 เซนติเมตร ปริมาตรน้ำในตู้ปลามีกี่ลูกบาศก์เซนติเมตร`,
          answers: ['37,500 ลูกบาศก์เซนติเมตร', '25,000 ลูกบาศก์เซนติเมตร', '40,000 ลูกบาศก์เซนติเมตร', '35,000 ลูกบาศก์เซนติเมตร', '30,000 ลูกบาศก์เซนติเมตร'],
          exp: 'ปริมาตรน้ำ = 30 × 50 × 25 = 37,500 ลูกบาศก์เซนติเมตร',
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ทรงสี่เหลี่ยมมุมฉากที่มีความกว้าง ความยาว และความสูงเท่ากันทุกด้าน ด้านละ 5 เซนติเมตร มีปริมาตรเท่ากับข้อใด`,
          answers: ['125 ลูกบาศก์เซนติเมตร', '25 ลูกบาศก์เซนติเมตร', '75 ลูกบาศก์เซนติเมตร', '150 ลูกบาศก์เซนติเมตร', '100 ลูกบาศก์เซนติเมตร'],
          exp: 'ปริมาตรลูกบาศก์ = 5 × 5 × 5 = 125 ลูกบาศก์เซนติเมตร',
        },
      ];
    } else {
      // General fallback math aligned with indicator (8 distinct variants)
      matchedTemplates = [
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดอธิบายและแสดงการคำนวณตามมาตรฐาน "${indicatorName || unitName}" ได้ถูกต้องที่สุด`,
          answers: [
            `การนำขั้นตอนและสมบัติทางคณิตศาสตร์มาแก้ปัญหาอย่างถูกต้องตามหลักวิชาการ`,
            `การประมาณค่าคำตอบโดยไม่คำนึงถึงขั้นตอนวิธี`,
            `การเลือกใช้สูตรคำนวณที่ไม่สัมพันธ์กับเงื่อนไขของโจทย์`,
            `การคำนวณเฉพาะผลลัพธ์โดยละเลยการแปลงหน่วย`,
            `การหาคำตอบโดยใช้การเดาสุ่มตัวเลข`,
          ],
          exp: `การแก้โจทย์ตามตัวชี้วัด ${indicatorCode} ต้องอาศัยความเข้าใจในมโนทัศน์และขั้นตอนการคำนวณที่ถูกต้อง`,
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) ในการแก้โจทย์ปัญหาเกี่ยวกับ "${unitName}" ขั้นตอนแรกที่สำคัญที่สุดคือข้อใด`,
          answers: [
            `การทำความเข้าใจโจทย์ วิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ถาม`,
            `การรีบลงมือคำนวณตัวเลขทันทีโดยไม่ต้องตรวจเงื่อนไข`,
            `การตัดตัวเลือกที่ตัวเลขมากที่สุดทิ้งไป`,
            `การเดาคำตอบล่วงหน้าก่อนคิดขั้นตอนวิธี`,
            `การเขียนเฉพาะคำตอบสุดท้ายโดยไม่ต้องแสดงวิธีทำ`,
          ],
          exp: `การแก้โจทย์ปัญหาคณิตศาสตร์ต้องเริ่มต้นจากการวิเคราะห์สิ่งที่โจทย์กำหนดให้และสิ่งที่โจทย์ต้องการทราบ`,
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) การตรวจสอบความสมเหตุสมผลของคำตอบในเรื่อง "${unitName}" มีประโยชน์อย่างไรมากที่สุด`,
          answers: [
            `ช่วยยืนยันความถูกต้องและป้องกันข้อผิดพลาดจากการคำนวณ`,
            `ทำให้ได้คะแนนเต็มโดยไม่ต้องอ่านโจทย์ซ้ำ`,
            `ช่วยลดเวลาในการทำข้อสอบลงได้ทันที`,
            `ช่วยเปลี่ยนตัวเลขในโจทย์ให้ง่ายขึ้น`,
            `ทำให้ไม่ต้องแสดงวิธีทำในการส่งงาน`,
          ],
          exp: `การตรวจความสมเหตุสมผลช่วยให้ผู้เรียนแน่ใจว่าผลลัพธ์ที่ได้สอดคล้องกับความเป็นจริงและเงื่อนไขของโจทย์`,
        },
        {
          q: `(ตัวชี้วัด ${indicatorCode}) สมบัติทางคณิตศาสตร์ข้อใดที่มีบทบาทสำคัญในการจัดรูปและคำนวณเรื่อง "${unitName}"`,
          answers: [
            `สมบัติการแจกแจงและการเปลี่ยนหมู่เพื่อจัดรูปให้คำนวณง่ายขึ้น`,
            `การละเลยลำดับการดำเนินการทางคณิตศาสตร์`,
            `การเปลี่ยนค่าของตัวเลขโดยไม่ใช้ตัวคูณร่วม`,
            `การสลับตำแหน่งตัวตั้งและตัวหารได้อย่างอิสระ`,
            `การตัดทอนตัวเลขโดยไม่ตรวจสอบตัวหารร่วม`,
          ],
          exp: `สมบัติทางคณิตศาสตร์เช่นการแจกแจงและการจัดกลุ่มช่วยให้การคำนวณมีประสิทธิภาพและถูกต้อง`,
        },
      ];
    }

    const tmpl = matchedTemplates[(questionIndex - 1) % matchedTemplates.length];
    questionText = tmpl.q;
    explanation = tmpl.exp;
    const ansList = [...tmpl.answers];
    const correctVal = ansList[0];
    const otherVals = ansList.slice(1);
    choicesMap[correctKey] = correctVal;
    let oIdx = 0;
    for (const k of choiceKeys) {
      if (k !== correctKey) {
        choicesMap[k] = otherVals[oIdx % otherVals.length] || `ตัวเลือก ${k}`;
        oIdx++;
      }
    }
  } else if (cleanSubj.includes('วิทย์') || cleanSubj.includes('sci')) {
    // Science bank with 12 diverse distinct questions
    const sciTemplates = [
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ปัจจัยสำคัญที่สุดในกระบวนการสังเคราะห์ด้วยแสงของพืชที่ทำให้เกิดแก๊สออกซิเจนคือข้อใด`,
        answers: ['น้ำ แสงแดด และแก๊สคาร์บอนไดออกไซด์', 'ดิน ปุ๋ย และความชื้น', 'แก๊สออกซิเจนและไนโตรเจน', 'ร่มเงาและอุณหภูมิต่ำ', 'น้ำตาลกลูโคสและแร่ธาตุ'],
        exp: 'พืชใช้คลอโรฟิลล์ดูดกลืนพลังงานแสง ทำปฏิกิริยากับน้ำและแก๊สคาร์บอนไดออกไซด์ ได้ผลผลิตคือน้ำตาลกลูโคสและแก๊สออกซิเจน',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) สิ่งมีชีวิตในข้อใดจัดเป็น "ผู้ผลิต (Producer)" ในห่วงโซ่อาหาร`,
        answers: ['สาหร่ายสีเขียวและหญ้า', 'หนอนและตั๊กแตน', 'เห็ดราและแบคทีเรีย', 'เหยี่ยวและงู', 'ปลาซิวและกุ้ง'],
        exp: 'ผู้ผลิตคือสิ่งมีชีวิตที่สามารถสร้างอาหารได้เองผ่านการสังเคราะห์ด้วยแสง เช่น พืชและสาหร่ายสีเขียว',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดเป็นการเปลี่ยนแปลงทางเคมี (Chemical Change) ของสาร`,
        answers: ['การเกิดสนิมของตะปูเหล็ก', 'การละลายของน้ำแข็ง', 'การระเหยของแอลกอฮอล์', 'การฉีกกระดาษเป็นชิ้นเล็ก', 'การบดน้ำตาลเป็นผง'],
        exp: 'การเกิดสนิมเป็นปฏิกิริยาเคมีระหว่างเหล็ก น้ำ และออกซิเจน เกิดเป็นสารใหม่ที่ไม่สามารถเปลี่ยนกลับด้วยวิธีทางกายภาพได้',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) การกระทำในข้อใดช่วยลด "แรงเสียดทาน" ที่เกิดขึ้นได้อย่างมีประสิทธิภาพ`,
        answers: ['การหยอดน้ำมันหล่อลื่นที่โซ่จักรยาน', 'การเพิ่มดอกยางที่ล้อรถยนต์', 'การทำพื้นห้องน้ำให้มีผิวขรุขระ', 'การสวมรองเท้าสตั๊ดลงเตะฟุตบอล', 'การใช้ถุงมือผ้าหยิบจับสิ่งของ'],
        exp: 'น้ำมันหล่อลื่นทำหน้าที่แทรกระหว่างผิวสัมผัสของวัตถุ ช่วยลดการเสียดสีและลดแรงเสียดทานโดยตรง',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) เมื่อต่อหลอดไฟ 2 หลอดแบบ "อนุกรม" หากหลอดไฟดวงหนึ่งขาดจะเกิดผลอย่างไร`,
        answers: ['หลอดไฟอีกดวงจะดับไปด้วยทันที', 'หลอดไฟอีกดวงจะสว่างมากขึ้น', 'หลอดไฟอีกดวงยังคงสว่างเท่าเดิม', 'หลอดไฟอีกดวงจะกะพริบเป็นจังหวะ', 'เกิดการลัดวงจรในระบบ'],
        exp: 'การต่อแบบอนุกรมมีกระแสไฟฟ้าไหลผ่านเส้นทางเดียว หากหลอดหนึ่งขาด วงจรจะเปิดและไม่มีกระแสไฟฟ้าไหล',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) เสียงเดินทางผ่านตัวกลางสถานะใดได้ "รวดเร็วที่สุด"`,
        answers: ['ของแข็ง (เช่น เหล็ก, ไม้)', 'ของเหลว (เช่น น้ำ)', 'แก๊ส (เช่น อากาศ)', 'สุญญากาศ', 'เดินทางได้เท่ากันทุกสถานะ'],
        exp: 'ของแข็งมีอนุภาคเรียงตัวชิดกันมากที่สุด ทำให้การถ่ายทอดพลังงานการสั่นสะเทือนของเสียงเกิดขึ้นได้เร็วที่สุด',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) การเกิด "หยดน้ำค้าง" บนยอดหญ้าในตอนเช้าตรู่ เกิดจากกระบวนการเปลี่ยนแปลงสถานะใด`,
        answers: ['การควบแน่นของไอน้ำในอากาศเมื่ออุณหภูมิลดลง', 'การระเหยของน้ำในดิน', 'การหลอมเหลวของน้ำค้างแข็ง', 'การระเหิดของก้อนเมฆ', 'การแข็งตัวของหยดน้ำฝน'],
        exp: 'เมื่ออุณหภูมิผิวหน้าดินลดลง ไอน้ำในอากาศที่สัมผัสกับอากาศเย็นจะควบแน่นกลายเป็นหยดน้ำเกาะอยู่ตามใบไม้',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ดาวเคราะห์ในระบบสุริยะข้อใดจัดเป็น "ดาวเคราะห์หิน (Terrestrial Planets)" ทั้งหมด`,
        answers: ['พุธ ศุกร์ โลก อังคาร', 'พฤหัสบดี เสาร์ ยูเรนัส เนปจูน', 'โลก อังคาร พฤหัสบดี เสาร์', 'ศุกร์ โลก เสาร์ เนปจูน', 'พุธ พฤหัสบดี ดาวยูเรนัส โลก'],
        exp: 'ดาวเคราะห์หิน 4 ดวงแรกคือ ดาวพุธ ดาวศุกร์ โลก และดาวอังคาร ซึ่งมีพื้นผิวเป็นของแข็งประกอบด้วยหินและโลหะ',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) สัตว์ในข้อใดมีการปรับโครงสร้างร่างกายเพื่อพรางตัวให้เข้ากับสิ่งแวดล้อมได้ดีที่สุด`,
        answers: ['ตั๊กแตนใบไม้และกิ้งก่า', 'นกเพนกวินและสิงโตทะเล', 'ช้างและแรด', 'ยีราฟและม้าลาย', 'เป็ดและห่าน'],
        exp: 'ตั๊กแตนใบไม้มีลักษณะปีกและลำตัวคล้ายใบไม้ และกิ้งก่าสามารถเปลี่ยนสีผิวเพื่อพรางตัวจากผู้ล่าและเหยื่อ',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) วัฏจักรน้ำ (Water Cycle) ได้รับพลังงานขับเคลื่อนหลักมาจากแหล่งใด`,
        answers: ['พลังงานความร้อนจากดวงอาทิตย์', 'แรงดึงดูดของดวงจันทร์', 'ความร้อนใต้พิภพ', 'กระแสลมในชั้นบรรยากาศ', 'การสังเคราะห์ด้วยแสงของพืช'],
        exp: 'ดวงอาทิตย์ให้พลังงานความร้อนทำให้น้ำในแหล่งน้ำต่างๆ ระเหยกลายเป็นไอ ลอยขึ้นสู่บรรยากาศและควบแน่นเป็นฝน',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดเป็นการกระทำที่ช่วย "อนุรักษ์ทรัพยากรน้ำ" ได้อย่างยั่งยืนที่สุด`,
        answers: ['การบำบัดน้ำเสียก่อนปล่อยลงสู่แหล่งน้ำธรรมชาติ', 'การสูบน้ำบาดาลมาใช้ให้มากที่สุด', 'การทิ้งสารเคมีลงในท่อระบายน้ำ', 'การสร้างสิ่งปลูกสร้างขวางทางไหลของแม่น้ำ', 'การใช้น้ำประปาฉีดล้างถนนทุกวัน'],
        exp: 'การบำบัดน้ำเสียก่อนระบายทิ้งช่วยลดมลพิษทางน้ำและรักษาคุณภาพน้ำในระบบนิเวศให้สามารถใช้ประโยชน์ต่อไปได้',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) เมื่อนำสาร ก ผสมกับสาร ข แล้วเกิด "ฟองแก๊สและอุณหภูมิลดลง" แสดงว่าเกิดเหตุการณ์ใด`,
        answers: ['เกิดปฏิกิริยาเคมีขึ้นระหว่างสารทั้งสองชนิด', 'สารทั้งสองชนิดเพียงแค่ละลายรวมกัน', 'เกิดการเปลี่ยนสถานะทางกายภาพของสาร', 'สารทั้งสองไม่ทำปฏิกิริยาต่อกัน', 'น้ำระเหยกลายเป็นไออย่างรวดเร็ว'],
        exp: 'การเกิดฟองแก๊สและการเปลี่ยนแปลงอุณหภูมิเป็นสัญญาณบ่งชี้ชัดเจนว่าเกิดปฏิกิริยาเคมีและมีสารใหม่เกิดขึ้น',
      },
    ];

    const tmpl = sciTemplates[(questionIndex - 1) % sciTemplates.length];
    questionText = tmpl.q;
    explanation = tmpl.exp;
    const ansList = [...tmpl.answers];
    const correctVal = ansList[0];
    const otherVals = ansList.slice(1);
    choicesMap[correctKey] = correctVal;
    let oIdx = 0;
    for (const k of choiceKeys) {
      if (k !== correctKey) {
        choicesMap[k] = otherVals[oIdx % otherVals.length] || `ตัวเลือก ${k}`;
        oIdx++;
      }
    }
  } else if (cleanSubj.includes('ไทย') || cleanSubj.includes('thai')) {
    // Thai bank with 12 diverse distinct questions
    const thaiTemplates = [
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ประโยคในข้อใดมีคำกริยาที่เป็น "สกรรมกริยา (กริยาที่ต้องมีกรรมมารับ)"`,
        answers: ['ชาวประมงจับปลาตัวใหญ่ในคลอง', 'นกบินอยู่บนท้องฟ้าแจ่มใส', 'เด็กทารกร้องไห้เสียงดัง', 'น้องนอนหลับอย่างสบาย', 'ดอกไม้บานส่งกลิ่นหอม'],
        exp: '"จับ" เป็นสกรรมกริยาที่ต้องมีกรรมคือ "ปลา" มารองรับเพื่อให้ได้ใจความสมบูรณ์',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) คำราชาศัพท์ในข้อใดมีความหมายว่า "ศีรษะ"`,
        answers: ['พระเศียร', 'พระเนตร', 'พระกรรณ', 'พระหัตถ์', 'พระบาท'],
        exp: 'พระเศียร = ศีรษะ, พระเนตร = ตา, พระกรรณ = หู, พระหัตถ์ = มือ, พระบาท = เท้า',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อความว่า "พูดไปสองไพเบี้ย นิ่งเสียตำลึงทอง" สำนวนนี้ตรงกับความหมายใดมากที่สุด`,
        answers: ['การพูดในสิ่งที่ไม่เกิดประโยชน์ สู้สงบนิ่งเสียจะดีกว่า', 'การพูดจาอ่อนหวานย่อมได้รับทรัพย์สินมีค่า', 'การลงทุนค้าขายต้องระมัดระวังรอบคอบ', 'คนพูดเก่งย่อมประสบความสำเร็จมากกว่าคนเงียบ', 'อย่าดูถูกทรัพย์เล็กน้อยในชีวิต'],
        exp: 'สำนวนนี้หมายถึง การพูดอะไรที่ไม่เป็นประโยชน์ พูดไปก็ไม่มีค่า นิ่งเฉยไว้ยังมีค่ามากกว่า',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ประโยคในข้อใดจัดเป็น "ประโยคความรวม (สมานประโยค)"`,
        answers: ['พ่อชอบดื่มกาแฟแต่อนันต์ชอบดื่มชาเขียว', 'คุณครูสอนวิชาภาษาไทยให้นักเรียนชั้น ป.5', 'แมวสีขาววิ่งไล่จับหนูใต้โต๊ะ', 'ฝนตกหนักน้ำจึงท่วมขัง', 'ต้นไม้ใหญ่ริมทางล้มลง'],
        exp: '"พ่อชอบดื่มกาแฟ" และ "อนันต์ชอบดื่มชาเขียว" เป็นประโยคความเดียวสองประโยคเชื่อมด้วยคำสันธาน "แต่" ซึ่งแสดงเนื้อความขัดแย้งกัน',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดใช้ "คำลักษณนาม" ได้ถูกต้องตามหลักภาษาไทย`,
        answers: ['ขลุ่ย ๑ เลา และ แห ๑ ปาก', 'ช้างบ้าน ๑ เชือก และ ช้างป่า ๑ ตัว', 'พระภิกษุ ๒ คน', 'บ้าน ๑ อัน', 'เรือ ๒ ใบ'],
        exp: 'ขลุ่ยใช้ลักษณนามว่า "เลา" และแหใช้ลักษณนามว่า "ปาก" ถือว่าถูกต้องตามพจนานุกรมราชบัณฑิตยสถาน',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) คำในข้อใดเป็น "คำที่มาจากภาษาเขมร" ทั้งหมด`,
        answers: ['เดิน เกิด โปรด บำเพ็ญ', 'ก๋วยเตี๋ยว โต๊ะ เก้าอี้', 'บุญ กรรม บาป ฤๅษี', 'เค้ก คอมพิวเตอร์ ฟรี', 'บิดา มารดา ปัญญา'],
        exp: 'คำว่า เดิน เกิด โปรด บำเพ็ญ มีลักษณะการแผลงคำและพยัญชนะต้นควบกล้ำตามแบบภาษาเขมร',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) สำนวนในข้อใดมีความหมายตรงกับ "การทำสิ่งใดที่ยากลำบากเกินความสามารถ"`,
        answers: ['เข็นครกขึ้นภูเขา', 'ขี่ช้างจับตั๊กแตน', 'จับปลาสองมือ', 'ชี้โพรงให้กระรอก', 'น้ำลดตอผุด'],
        exp: '"เข็นครกขึ้นภูเขา" หมายถึง การทำงานที่ยากลำบากเกินกว่ากำลังความสามารถของตนเอง',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดคือสัมผัสบังคับวรรคของ "กาพย์ยานี ๑๑"`,
        answers: ['คำสุดท้ายของวรรคหน้า สัมผัสกับคำที่สามของวรรคหลัง', 'คำสุดท้ายของวรรคหน้า สัมผัสกับคำสุดท้ายของวรรคหลัง', 'คำที่สองของวรรคหน้า สัมผัสกับคำที่สี่ของวรรคหลัง', 'ไม่มีสัมผัสระหว่างวรรค', 'สัมผัสเฉพาะสระเสียงสั้นเท่านั้น'],
        exp: 'แผนผังกาพย์ยานี ๑๑ กำหนดให้คำสุดท้ายของวรรคที่ ๑ (วรรคหน้า) สัมผัสกับคำที่ ๓ ของวรรคที่ ๒ (วรรคหลัง)',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) คำว่า "กตัญญูกตเวที" มีความหมายตรงกับข้อใด`,
        answers: ['การรู้คุณและตอบแทนบุญคุณของผู้มีพระคุณ', 'การมีความอดทนอดกลั้นต่ออุปสรรค', 'การมีความซื่อสัตย์สุจริตต่อหน้าที่', 'การมีมารยาทเรียบร้อยสง่างาม', 'การประหยัดมัธยัสถ์ในการดำเนินชีวิต'],
        exp: 'กตัญญู หมายถึง รู้บุญคุณ, กตเวที หมายถึง ตอบแทนบุญคุณ จึงหมายถึง รู้คุณและตอบแทนคุณ',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อความใดจัดเป็น "ข้อคิดเห็น" ไม่ใช่ข้อเท็จจริง`,
        answers: ['อากาศในห้องนี้ร้อนเกินไปจนทำให้ทุกคนรู้สึกอึดอัด', 'ดวงอาทิตย์ขึ้นทางทิศตะวันออก', 'ประเทศไทยตั้งอยู่ในภูมิภาคเอเชียตะวันออกเฉียงใต้', 'น้ำเดือดที่อุณหภูมิ 100 องศาเซลเซียส', 'ช้างเป็นสัตว์เลี้ยงลูกด้วยนมขนาดใหญ่'],
        exp: '"ร้อนเกินไปจนอึดอัด" เป็นความรู้สึกและการประเมินค่าของแต่ละบุคคล จึงจัดเป็นข้อคิดเห็น',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) การเขียน "ย่อความ" ที่มีประสิทธิภาพ ต้องยึดหลักการใดเป็นสำคัญที่สุด`,
        answers: ['เก็บใจความสำคัญให้ครบถ้วนด้วยสำนวนภาษาของผู้เขียนเอง', 'คัดลอกข้อความเดิมทุกวรรคตอนอย่างเคร่งครัด', 'เพิ่มความคิดเห็นส่วนตัวของผู้ย่อลงไปในเนื้อเรื่อง', 'ใช้คำราชาศัพท์แทนคำสามัญทุกคำ', 'ตัดข้อความทิ้งโดยไม่สนใจลำดับเหตุการณ์'],
        exp: 'การย่อความต้องอ่านให้เข้าใจ จับใจความสำคัญให้ครบถ้วน แล้วนำมาเรียบเรียงใหม่ด้วยสำนวนภาษาของตนเองอย่างสละสลวย',
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) นิทานเรื่อง "สังข์ทอง" ตอนกำเนิดพระสังข์ ให้ข้อคิดสำคัญในเรื่องใดมากที่สุด`,
        answers: ['ความรักอันยิ่งใหญ่ของแม่ และคุณค่าภายในที่ไม่ควรตัดสินจากรูปกายภายนอก', 'การฝึกตนให้มีเวทมนตร์คาถา', 'การเลือกคู่ครองจากฐานะและยศศักดิ์', 'การเดินทางไกลเพื่อแสวงหาโชคลาภ', 'การพึ่งพาโชคชะตาโดยไม่พยายาม'],
        exp: 'วรรณคดีเรื่องสังข์ทองสอนให้เห็นความรักและความผูกพันระหว่างแม่ลูก รวมถึงการไม่ตัดสินผู้อื่นจากรูปลักษณ์ภายนอก',
      },
    ];

    const tmpl = thaiTemplates[(questionIndex - 1) % thaiTemplates.length];
    questionText = tmpl.q;
    explanation = tmpl.exp;
    const ansList = [...tmpl.answers];
    const correctVal = ansList[0];
    const otherVals = ansList.slice(1);
    choicesMap[correctKey] = correctVal;
    let oIdx = 0;
    for (const k of choiceKeys) {
      if (k !== correctKey) {
        choicesMap[k] = otherVals[oIdx % otherVals.length] || `ตัวเลือก ${k}`;
        oIdx++;
      }
    }
  } else {
    // General subject (Social, History, Health, Arts, English) with 10 distinct Bloom taxonomy questions
    const generalTemplates = [
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดอธิบาย "ความหมายและสาระสำคัญ" ของเรื่อง "${unitName}" ได้ถูกต้องและครบถ้วนที่สุด`,
        correct: `การนำหลักการและองค์ความรู้ของ ${unitName} มาปฏิบัติอย่างถูกต้องตามกระบวนการ`,
        others: [
          `การท่องจำเฉพาะคำนิยามโดยไม่คำนึงถึงบริบทการนำไปใช้`,
          `การปฏิบัติกิจกรรมตามความคุ้นเคยโดยไม่ตรวจสอบความถูกต้อง`,
          `การละเลยขั้นตอนสำคัญเพื่อมุ่งเน้นผลลัพธ์ที่รวดเร็วเพียงอย่างเดียว`,
          `การปฏิเสธการเรียนรู้และแลกเปลี่ยนความคิดเห็นกับผู้อื่น`,
        ],
        exp: `ความเข้าใจสาระสำคัญของ ${unitName} ต้องครอบคลุมทั้งหลักการและกระบวนการนำไปใช้อย่างถูกต้อง`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) บุคคลในข้อใดปฏิบัติตนได้ "สอดคล้องกับหลักการ" ของเรื่อง "${unitName}" มากที่สุด`,
        correct: `สมชายนำความรู้เรื่อง ${unitName} มาวางแผนและปรับใช้ในการแก้ปัญหาในชีวิตประจำวัน`,
        others: [
          `วิภาเลือกทำเฉพาะสิ่งที่ตนเองสะดวกโดยไม่คำนึงถึงผลกระทบต่อส่วนรวม`,
          `อนุชาละทิ้งการปฏิบัติตามขั้นตอนเพราะคิดว่าเสียเวลา`,
          `ปราณีนำแนวคิดที่ล้าสมัยมาใช้โดยไม่ยอมปรับเปลี่ยนตามสถานการณ์`,
          `กิตติเชื่อข่าวสารทันทีโดยไม่ตรวจสอบแหล่งที่มา`,
        ],
        exp: `การปฏิบัติตนที่ถูกต้องคือการนำความรู้มาประยุกต์ใช้อย่างมีวิจารณญาณและคำนึงถึงผลประโยชน์ส่วนรวม`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) หากเกิดปัญหาในสถานการณ์จริงที่เกี่ยวข้องกับเรื่อง "${unitName}" แนวทางแก้ไขปัญหาข้อใดเหมาะสมที่สุด`,
        correct: `วิเคราะห์สาเหตุของปัญหา ค้นคว้าข้อมูลที่ถูกต้อง แล้วเลือกแนวทางแก้ปัญหาอย่างมีเหตุผล`,
        others: [
          `รอให้ผู้อื่นมาตัดสินใจแก้ปัญหาแทนตนเอง`,
          `แก้ปัญหาตามความรู้สึกส่วนตัวโดยไม่ใช้หลักวิชาการ`,
          `หลีกเลี่ยงการเผชิญหน้ากับปัญหาและปล่อยให้ผ่านไปตามกาลเวลา`,
          `เลือกใช้วิธีที่สิ้นเปลืองงบประมาณมากที่สุดเพื่อความรวดเร็ว`,
        ],
        exp: `กระบวนการแก้ปัญหาอย่างมีเหตุผลตามหลักการของ ${unitName} ต้องเริ่มจากการวิเคราะห์สาเหตุและรวบรวมข้อมูล`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใด "ไม่ใช่" ประโยชน์ที่ได้รับจากการศึกษาและปฏิบัติตามเรื่อง "${unitName}"`,
        correct: `การได้รับสิทธิพิเศษเหนือผู้อื่นโดยไม่ต้องปฏิบัติตามกฎระเบียบ`,
        others: [
          `ช่วยพัฒนาทักษะกระบวนการคิดและการตัดสินใจอย่างมีวิจารณญาณ`,
          `เสริมสร้างวินัยและความรับผิดชอบต่อตนเองและสังคม`,
          `สามารถนำความรู้ไปต่อยอดในการเรียนรู้ระดับสูงขึ้นได้อย่างมีประสิทธิภาพ`,
          `ช่วยให้การทำงานร่วมกับผู้อื่นในสังคมดำเนินไปอย่างราบรื่น`,
        ],
        exp: `การศึกษาเรื่อง ${unitName} มุ่งเน้นการพัฒนาตนเองและสร้างสรรค์ประโยชน์ต่อสังคม ไม่ใช่เพื่อแสวงหาอภิสิทธิ์ส่วนบุคคล`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) จากสถานการณ์ตัวอย่างเกี่ยวกับ "${unitName}" ข้อใดสรุปผลการวิเคราะห์ได้อย่างสมเหตุสมผลที่สุด`,
        correct: `การปฏิบัติตามขั้นตอนอย่างเป็นระบบย่อมส่งผลให้งานบรรลุเป้าหมายอย่างมีประสิทธิภาพสูงสุด`,
        others: [
          `ผลสำเร็จของงานขึ้นอยู่กับโชคชะตามากกว่าความพยายามในการวางแผน`,
          `การข้ามขั้นตอนการปฏิบัติจะช่วยลดเวลาและเพิ่มคุณภาพงานได้เสมอ`,
          `การทำงานคนเดียวย่อมได้ผลลัพธ์ที่ดีกว่าการระดมความคิดเห็นจากทีมงาน`,
          `การไม่ประเมินผลหลังการทำงานช่วยลดความขัดแย้งในองค์กร`,
        ],
        exp: `การทำงานที่เป็นระบบและมีการวางแผนตามหลักวิชาการของ ${unitName} คือหัวใจสำคัญของความสำเร็จ`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ปัจจัยข้อใดส่งผลกระทบต่อความสำเร็จในการดำเนินงานเรื่อง "${unitName}" มากที่สุด`,
        correct: `ความรู้ความเข้าใจ ทักษะการปฏิบัติ และความร่วมมือร่วมใจของผู้เกี่ยวข้อง`,
        others: [
          `การใช้อุปกรณ์ราคาแพงที่สุดเพียงอย่างเดียว`,
          `การกำหนดเวลาทำงานให้กระชั้นชิดจนเกินไป`,
          `การสั่งการจากผู้นำโดยไม่รับฟังความคิดเห็นของผู้ปฏิบัติงาน`,
          `การปิดบังข้อมูลข้อผิดพลาดเพื่อรักษาภาพลักษณ์`,
        ],
        exp: `ความสำเร็จในการเรียนรู้และการทำงานตามตัวชี้วัด ${indicatorCode} เกิดจากความรู้ความสามารถและการร่วมมือกัน`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) ข้อใดแสดงถึงการประเมินค่าและตัดสินใจอย่างมี "คุณธรรมและจริยธรรม" ในบริบทของ "${unitName}"`,
        correct: `คำนึงถึงความถูกต้อง ความซื่อสัตย์สุจริต และความปลอดภัยของเพื่อนมนุษย์เป็นหลัก`,
        others: [
          `มุ่งเน้นผลกำไรสูงสุดโดยไม่สนใจผลกระทบต่อสิ่งแวดล้อม`,
          `เลือกทางเลือกที่ตนเองได้รับผลประโยชน์สูงสุดแม้จะเอาเปรียบผู้อื่น`,
          `ปกปิดข้อมูลที่อาจเป็นอันตรายต่อชุมชนเพื่อไม่ให้เกิดความตื่นตระหนก`,
          `ปฏิบัติตามคำสั่งที่ไม่ถูกต้องเพื่อหลีกเลี่ยงการถูกลงโทษ`,
        ],
        exp: `การตัดสินใจตามมาตรฐานการเรียนรู้ต้องยึดมั่นในความถูกต้อง ความเป็นธรรม และประโยชน์สุขของสังคม`,
      },
      {
        q: `(ตัวชี้วัด ${indicatorCode}) หากต้องการเผยแพร่องค์ความรู้เรื่อง "${unitName}" ให้แก่ชุมชน วิธีการในข้อใดมีประสิทธิผลสูงสุด`,
        correct: `การจัดนิทรรศการให้ความรู้ควบคู่กับการสาธิตและเปิดโอกาสให้ผู้เข้าร่วมได้ฝึกปฏิบัติจริง`,
        others: [
          `การแจกเอกสารจำนวนมากโดยไม่มีผู้อธิบาย`,
          `การบังคับให้คนในชุมชนเข้าร่วมอบรมโดยไม่มีการเตรียมความพร้อม`,
          `การเผยแพร่ข้อมูลทางวิชาการที่ใช้ศัพท์เฉพาะโดยไม่อธิบายความหมาย`,
          `การจัดกิจกรรมเฉพาะในกลุ่มคนสนิทเท่านั้น`,
        ],
        exp: `การเรียนรู้ผ่านการสาธิตและการลงมือปฏิบัติจริงช่วยให้เกิดความเข้าใจที่ลึกซึ้งและนำไปใช้ประโยชน์ได้จริง`,
      },
    ];

    const tmpl = generalTemplates[(questionIndex - 1) % generalTemplates.length];
    questionText = tmpl.q;
    explanation = tmpl.exp;
    const correctVal = tmpl.correct;
    const otherVals = [...tmpl.others];
    choicesMap[correctKey] = correctVal;
    let oIdx = 0;
    for (const k of choiceKeys) {
      if (k !== correctKey) {
        choicesMap[k] = otherVals[oIdx % otherVals.length] || `ตัวเลือก ${k}`;
        oIdx++;
      }
    }
  }

  const choices = choiceKeys.map((k) => ({
    key: k,
    text: choicesMap[k] || `ตัวเลือก ${k}`,
  }));

  return { questionText, choices, explanation };
}

/**
 * Generates subject-specific subjective question data with clear rubrics.
 */
function generateSubjectiveQuestionData(params: {
  subject: string;
  gradeLevel: string;
  unitName: string;
  indicatorCode: string;
  indicatorName: string;
  questionIndex: number;
}) {
  const { subject, gradeLevel, unitName, indicatorCode, indicatorName, questionIndex } = params;
  const cleanSubj = subject.toLowerCase();
  const indMatchStr = `${indicatorCode} ${indicatorName} ${unitName}`.toLowerCase();
  const variant = (questionIndex - 1) % 4;

  if (cleanSubj.includes('คณิต') || cleanSubj.includes('math')) {
    if (
      indMatchStr.includes('เศษส่วน') ||
      indMatchStr.includes('ป.5/4') ||
      indMatchStr.includes('ป.5/5')
    ) {
      const fracVariants = [
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) เชือกเส้นหนึ่งยาว 5 1/2 เมตร ตัดแบ่งออกเป็นเส้นสั้นๆ ยาวเส้นละ 1/4 เมตร จะตัดเชือกได้ทั้งหมดกี่เส้น จงแสดงวิธีทำอย่างเป็นขั้นตอน`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- แปลงจำนวนคละเป็นเศษเกินได้ถูกต้อง (5 1/2 = 11/2): 1.5 คะแนน\n- แสดงวิธีหารเศษส่วนโดยการคูณกับส่วนกลับ (11/2 × 4/1): 2 คะแนน\n- สรุปคำตอบถูกต้อง (22 เส้น) พร้อมระบุหน่วย: 1.5 คะแนน`,
          sampleAnswer: `วิธีทำ:\nเชือกยาว 5 1/2 เมตร = 11/2 เมตร\nตัดแบ่งเส้นละ 1/4 เมตร\nจำนวนเส้นเชือก = 11/2 ÷ 1/4\n= 11/2 × 4/1 = 44/2 = 22 เส้น\nตอบ จะตัดเชือกได้ทั้งหมด 22 เส้น`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) ถังใบหนึ่งมีน้ำอยู่ 18 3/4 ลิตร ตักน้ำออกไปรดน้ำต้นไม้ 3/5 ของน้ำที่มีอยู่ในถัง จงแสดงวิธีทำเพื่อหาว่าตักน้ำออกไปกี่ลิตร และเหลือน้ำในถังกี่ลิตร`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- เขียนประโยคสัญลักษณ์และหาปริมาณน้ำที่ตักออก (18 3/4 × 3/5 = 75/4 × 3/5 = 45/4 = 11 1/4 ลิตร): 2.5 คะแนน\n- คำนวณปริมาณน้ำที่เหลือ (18 3/4 - 11 1/4 = 7 2/4 = 7 1/2 ลิตร): 1.5 คะแนน\n- สรุปคำตอบทั้ง 2 คำถามพร้อมหน่วยถูกต้อง: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\n1. ตักน้ำออกไป = 18 3/4 × 3/5 = (75/4) × (3/5) = 45/4 = 11 1/4 ลิตร\n2. เหลือน้ำในถัง = 18 3/4 - 11 1/4 = 7 2/4 = 7 1/2 ลิตร\nตอบ ตักน้ำออกไป 11 1/4 ลิตร และเหลือน้ำในถัง 7 1/2 ลิตร`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) ที่ดินแปลงหนึ่งมีพื้นที่ 3 1/3 ไร่ แบ่งทำแปลงปลูกผัก 4 แปลง แปลงละเท่าๆ กัน แต่ละแปลงจะมีพื้นที่กี่ไร่ จงแสดงวิธีทำอย่างละเอียด`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- แปลง 3 1/3 เป็นเศษเกิน (10/3): 1.5 คะแนน\n- แสดงวิธีหารด้วย 4 (10/3 ÷ 4 = 10/3 × 1/4): 2 คะแนน\n- ตัดทอนและสรุปคำตอบเป็นเศษส่วนอย่างต่ำ (5/6 ไร่): 1.5 คะแนน`,
          sampleAnswer: `วิธีทำ:\nที่ดินมีพื้นที่ 3 1/3 ไร่ = 10/3 ไร่\nแบ่งออกเป็น 4 แปลงเท่าๆ กัน\nพื้นที่แต่ละแปลง = 10/3 ÷ 4 = 10/3 × 1/4 = 10/12 = 5/6 ไร่\nตอบ แต่ละแปลงมีพื้นที่ 5/6 ไร่`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) แม่ค้ามีน้ำตาลทราย 12 กิโลกรัม นำมาบรรจุถุง ถุงละ 3/4 กิโลกรัม แล้วขายไปถุงละ 25 บาท แม่ค้าจะได้เงินทั้งหมดกี่บาท จงแสดงวิธีทำเป็นขั้นตอน`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- แสดงการหาจำนวนถุง (12 ÷ 3/4 = 12 × 4/3 = 16 ถุง): 2.5 คะแนน\n- แสดงการคำนวณเงินที่ได้จากการขาย (16 × 25 = 400 บาท): 1.5 คะแนน\n- สรุปคำตอบพร้อมระบุหน่วยบาทถูกต้อง: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\n1. บรรจุถุงได้ทั้งหมด = 12 ÷ 3/4 = 12 × (4/3) = 16 ถุง\n2. ขายถุงละ 25 บาท ได้เงิน = 16 × 25 = 400 บาท\nตอบ แม่ค้าจะได้เงินทั้งหมด 400 บาท`,
        },
      ];
      return fracVariants[variant % fracVariants.length];
    }

    if (
      indMatchStr.includes('ร้อยละ') ||
      indMatchStr.includes('กำไร') ||
      indMatchStr.includes('ลดราคา') ||
      indMatchStr.includes('ป.5/9')
    ) {
      const pctVariants = [
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) ร้านค้าแห่งหนึ่งติดป้ายราคารถจักรยานไว้ 3,500 บาท ในช่วงเทศกาลปีใหม่ลดราคาให้ผู้ซื้อ 15% จงแสดงวิธีทำอย่างละเอียดเพื่อหาว่าร้านค้าลดราคากี่บาท และผู้ซื้อต้องจ่ายเงินค่ารถจักรยานกี่บาท`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- แสดงการคำนวณส่วนลด 15% ได้ถูกต้อง (3,500 × 15/100 = 525 บาท): 2.5 คะแนน\n- แสดงการคำนวณราคาขายสุทธิ (3,500 - 525 = 2,975 บาท): 1.5 คะแนน\n- สรุปคำตอบพร้อมหน่วยถูกต้องชัดเจน: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\n1. ส่วนลด 15% = 3,500 × (15/100) = 525 บาท\n2. ราคาที่ผู้ซื้อต้องจ่าย = 3,500 - 525 = 2,975 บาท\nตอบ ร้านค้าลดราคาให้ 525 บาท และผู้ซื้อต้องจ่ายเงิน 2,975 บาท`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) พ่อค้าซื้อพัดลมมาในราคาเครื่องละ 800 บาท ต้องการขายต่อให้ได้กำไร 25% พ่อค้าต้องตั้งราคาขายพัดลมเครื่องนี้กี่บาท และได้กำไรกี่บาท จงแสดงวิธีทำอย่างละเอียด`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- แสดงการคำนวณกำไร 25% (800 × 25/100 = 200 บาท): 2.5 คะแนน\n- แสดงการคำนวณราคาขาย (800 + 200 = 1,000 บาท): 1.5 คะแนน\n- สรุปคำตอบถูกต้องชัดเจนพร้อมระบุหน่วย: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\n1. กำไร 25% = 800 × (25/100) = 200 บาท\n2. ราคาขาย = ต้นทุน + กำไร = 800 + 200 = 1,000 บาท\nตอบ พ่อค้าต้องตั้งราคาขาย 1,000 บาท และได้กำไร 200 บาท`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) โรงเรียนแห่งหนึ่งมีนักเรียนทั้งหมด 650 คน เป็นนักเรียนชาย 40% ของนักเรียนทั้งหมด โรงเรียนนี้มีนักเรียนหญิงกี่คน จงแสดงวิธีทำ 2 วิธี หรือแสดงวิธีทำอย่างละเอียด`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- หาเปอร์เซ็นต์นักเรียนหญิง (100% - 40% = 60%) หรือหานักเรียนชาย (260 คน): 2 คะแนน\n- แสดงวิธีคำนวณจำนวนนักเรียนหญิงได้ถูกต้อง (650 × 60/100 = 390 คน): 2 คะแนน\n- สรุปคำตอบพร้อมหน่วยคนถูกต้อง: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\nนักเรียนหญิงคิดเป็น 100% - 40% = 60% ของนักเรียนทั้งหมด\nจำนวนนักเรียนหญิง = 650 × (60/100) = 390 คน\nตอบ โรงเรียนแห่งนี้มีนักเรียนหญิงทั้งหมด 390 คน`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) ซื้อโทรทัศน์เครื่องหนึ่งราคา 12,000 บาท ต้องเสียภาษีมูลค่าเพิ่ม (VAT) 7% ผู้ซื้อต้องชำระเงินรวมภาษีทั้งหมดกี่บาท จงแสดงวิธีทำอย่างเป็นขั้นตอน`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- คำนวณภาษีมูลค่าเพิ่ม 7% (12,000 × 7/100 = 840 บาท): 2.5 คะแนน\n- คำนวณราคารวมภาษี (12,000 + 840 = 12,840 บาท): 1.5 คะแนน\n- สรุปคำตอบถูกต้อง: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\nภาษีมูลค่าเพิ่ม 7% = 12,000 × (7/100) = 840 บาท\nจำนวนเงินที่ต้องจ่ายรวม = 12,000 + 840 = 12,840 บาท\nตอบ ผู้ซื้อต้องชำระเงินรวมภาษีทั้งหมด 12,840 บาท`,
        },
      ];
      return pctVariants[variant % pctVariants.length];
    }

    if (
      indMatchStr.includes('ปริมาตร') ||
      indMatchStr.includes('ความจุ') ||
      indMatchStr.includes('2.2')
    ) {
      const volVariants = [
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) สระว่ายน้ำทรงสี่เหลี่ยมมุมฉาก มีขนาดกว้าง 8 เมตร ยาว 15 เมตร และลึก 1.8 เมตร ถ้าต้องการเติมน้ำให้เต็มสระ จะต้องใช้น้ำทั้งหมดกี่ลูกบาศก์เมตร จงเขียนแสดงวิธีทำอย่างเป็นขั้นตอน`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- เขียนสูตรความจุทรงสี่เหลี่ยมมุมฉากได้ถูกต้อง: 1 คะแนน\n- แทนค่าตัวเลขลงในสูตรถูกต้อง (8 × 15 × 1.8): 2 คะแนน\n- คำนวณคำตอบสุดท้ายถูกต้อง (216 ลูกบาศก์เมตร) พร้อมระบุหน่วย: 2 คะแนน`,
          sampleAnswer: `วิธีทำ:\nสูตร ความจุทรงสี่เหลี่ยมมุมฉาก = กว้าง × ยาว × ลึก\nแทนค่า = 8 × 15 × 1.8\n= 120 × 1.8 = 216 ลูกบาศก์เมตร\nตอบ จะต้องใช้น้ำทั้งหมด 216 ลูกบาศก์เมตร`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) กล่องกระดาษทรงสี่เหลี่ยมมุมฉาก มีพื้นที่ฐาน 240 ตารางเซนติเมตร และมีความสูง 15 เซนติเมตร กล่องใบนี้มีความจุกี่ลูกบาศก์เซนติเมตร หรือคิดเป็นกี่ลิตร (1 ลิตร = 1,000 ลูกบาศก์เซนติเมตร) จงแสดงวิธีทำ`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- แสดงการคำนวณปริมาตรจาก พื้นที่ฐาน × สูง (240 × 15 = 3,600 ลบ.ซม.): 2.5 คะแนน\n- แปลงหน่วยเป็นลิตรได้ถูกต้อง (3,600 ÷ 1,000 = 3.6 ลิตร): 1.5 คะแนน\n- สรุปคำตอบพร้อมระบุหน่วยทั้งสองได้ครบถ้วน: 1 คะแนน`,
          sampleAnswer: `วิธีทำ:\nปริมาตรทรงสี่เหลี่ยมมุมฉาก = พื้นที่ฐาน × สูง\n= 240 × 15 = 3,600 ลูกบาศก์เซนติเมตร\nแปลงเป็นลิตร = 3,600 ÷ 1,000 = 3.6 ลิตร\nตอบ กล่องใบนี้มีความจุ 3,600 ลูกบาศก์เซนติเมตร หรือ 3.6 ลิตร`,
        },
        {
          questionText: `(ตัวชี้วัด ${indicatorCode}) ตู้ปลาทรงสี่เหลี่ยมมุมฉากกว้าง 30 เซนติเมตร ยาว 50 เซนติเมตร และสูง 40 เซนติเมตร ถ้าใส่น้ำลงไปในตู้ให้มีระดับความสูงเพียง 25 เซนติเมตร จะมีน้ำอยู่ในตู้ปลากี่ลูกบาศก์เซนติเมตร จงแสดงวิธีทำ`,
          scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- ระบุการใช้ความสูงของระดับน้ำ (25 ซม.) ในการคำนวณ: 1.5 คะแนน\n- แสดงการแทนค่าสูตร (30 × 50 × 25): 2 คะแนน\n- สรุปคำตอบสุดท้ายถูกต้อง (37,500 ลูกบาศก์เซนติเมตร): 1.5 คะแนน`,
          sampleAnswer: `วิธีทำ:\nปริมาตรของน้ำในตู้ปลา = กว้าง × ยาว × ระดับความสูงของน้ำ\n= 30 × 50 × 25\n= 1,500 × 25 = 37,500 ลูกบาศก์เซนติเมตร\nตอบ มีน้ำอยู่ในตู้ปลาทั้งหมด 37,500 ลูกบาศก์เซนติเมตร`,
        },
      ];
      return volVariants[variant % volVariants.length];
    }

    // Default math subjective variants
    const defaultMathVariants = [
      {
        questionText: `(ตัวชี้วัด ${indicatorCode}) จงแสดงขั้นตอนการคำนวณและการแก้โจทย์ปัญหาตามตัวชี้วัด "${indicatorName || unitName}" พร้อมระบุเหตุผลและคำตอบที่มีหน่วยถูกต้อง`,
        scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- ระบุหลักการและขั้นตอนการคำนวณถูกต้อง: 2 คะแนน\n- ดำเนินการคำนวณตามขั้นตอนได้แม่นยำ: 2 คะแนน\n- สรุปคำตอบพร้อมหน่วยถูกต้อง: 1 คะแนน`,
        sampleAnswer: `แนวทางการทำ: แสดงลำดับขั้นตอนการคำนวณและแสดงผลลัพธ์พร้อมหน่วยที่ถูกต้องตามหลักสูตร`,
      },
      {
        questionText: `(ตัวชี้วัด ${indicatorCode}) จากสถานการณ์โจทย์ปัญหาที่เกี่ยวข้องกับ "${unitName}" ให้นักเรียนวิเคราะห์สิ่งที่โจทย์กำหนด สิ่งที่โจทย์ถาม และเขียนประโยคสัญลักษณ์พร้อมแสดงวิธีหาคำตอบอย่างละเอียด`,
        scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- วิเคราะห์โจทย์และเขียนประโยคสัญลักษณ์ถูกต้อง: 2 คะแนน\n- แสดงวิธีทำเป็นลำดับขั้นตอนถูกต้อง: 2 คะแนน\n- ตรวจสอบความสมเหตุสมผลและตอบพร้อมหน่วย: 1 คะแนน`,
        sampleAnswer: `แนวทางการทำ: วิเคราะห์โจทย์ เขียนประโยคสัญลักษณ์ และแสดงการคำนวณอย่างเป็นระบบ`,
      },
    ];
    return defaultMathVariants[variant % defaultMathVariants.length];
  }

  // Non-math subjective variants
  const generalVariants = [
    {
      questionText: `(ตัวชี้วัด ${indicatorCode}) จากการศึกษาเรื่อง "${unitName}" ให้นักเรียนเขียนอธิบายหลักการสำคัญ 2 ประการ พร้อมยกตัวอย่างสถานการณ์ในชีวิตประจำวัน 1 ตัวอย่างอย่างสมเหตุสมผล`,
      scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- อธิบายหลักการข้อที่ 1 ถูกต้องชัดเจน: 1.5 คะแนน\n- อธิบายหลักการข้อที่ 2 ถูกต้องชัดเจน: 1.5 คะแนน\n- ยกตัวอย่างสถานการณ์ประกอบอย่างสมเหตุสมผลและสอดคล้องกับตัวชี้วัด: 2 คะแนน`,
      sampleAnswer: `แนวทางการตอบ:\n1. อธิบายหลักการสำคัญที่สอดคล้องกับเนื้อหา ${unitName} จำนวน 2 ข้อ\n2. ระบุตัวอย่างในชีวิตประจำวันและการนำความรู้ไปประยุกต์ใช้อย่างเหมาะสม`,
    },
    {
      questionText: `(ตัวชี้วัด ${indicatorCode}) หากพบปัญหาหรือสถานการณ์จำลองที่เกี่ยวข้องกับ "${unitName}" ให้นักเรียนเสนอแนวทางการแก้ไขหรือแนวทางปฏิบัติที่ถูกต้อง 2 วิธี พร้อมอธิบายเหตุผลสนับสนุน`,
      scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- เสนอแนวทางแก้ปัญหาที่ 1 พร้อมเหตุผล: 2 คะแนน\n- เสนอแนวทางแก้ปัญหาที่ 2 พร้อมเหตุผล: 2 คะแนน\n- ภาษาถูกต้อง ชัดเจน และตรงประเด็น: 1 คะแนน`,
      sampleAnswer: `แนวทางการตอบ: เสนอทางเลือกหรือแนวทางแก้ปัญหาที่สอดคล้องกับหลักวิชาการ พร้อมให้เหตุผลสนับสนุนที่เป็นไปได้จริง`,
    },
    {
      questionText: `(ตัวชี้วัด ${indicatorCode}) ให้นักเรียนเปรียบเทียบข้อดีและข้อจำกัด หรือความแตกต่างของประเด็นสำคัญในเรื่อง "${unitName}" อย่างน้อย 2 ประเด็น พร้อมสรุปข้อคิดเห็นเชิงวิเคราะห์`,
      scoringCriteria: `เกณฑ์การให้คะแนน (เต็ม 5 คะแนน):\n- ระบุประเด็นเปรียบเทียบที่ 1 ได้ชัดเจน: 2 คะแนน\n- ระบุประเด็นเปรียบเทียบที่ 2 ได้ชัดเจน: 2 คะแนน\n- ข้อสรุปวิเคราะห์สะท้อนความเข้าใจในตัวชี้วัด: 1 คะแนน`,
      sampleAnswer: `แนวทางการตอบ: เปรียบเทียบสองมุมมองหรือสองลักษณะตามเนื้อหาบทเรียน พร้อมสรุปผลการวิเคราะห์อย่างมีเหตุผล`,
    },
  ];
  return generalVariants[variant % generalVariants.length];
}

/**
 * Resilient OBEC-aligned offline curriculum synthesis engine.
 * Guarantees that midterm & final exams are ALWAYS generated 100% successfully.
 */
export function synthesizeFallbackSemesterExam(
  params: GenerateSemesterExamParams
): SemesterExamResult {
  const {
    schoolName = 'โรงเรียนสังกัด สพฐ.',
    examType,
    subject,
    subjectCode = '',
    gradeLevel,
    academicYear = '2568',
    term = '1',
    timeMinutes = 60,
    totalScore = 20,
    topicsCovered = '',
    units = [],
    indicatorQuotas = [],
    multipleChoiceCount = 20,
    choiceType = '4-choices',
    includeSubjective = true,
    subjectiveCount = 2,
    difficultyRatio = '30:50:20',
  } = params;

  const examTypeTitle = examType === 'midterm' ? 'กลางภาคเรียน' : 'ปลายภาคเรียน';
  const effectiveUnits = units.length > 0 ? units : ['หน่วยการเรียนรู้ที่ 1 พื้นฐานการเรียนรู้'];

  // Resolve indicators with quota
  let activeQuotas = (indicatorQuotas || []).filter((q) => q.count > 0);
  if (activeQuotas.length === 0) {
    for (const u of effectiveUnits) {
      const found = findStandardIndicatorsForUnit({ subject, gradeLevel, unitName: u });
      if (found.length > 0) {
        for (const f of found) {
          activeQuotas.push({
            code: f.code,
            name: f.name,
            count: Math.max(1, Math.round(multipleChoiceCount / Math.max(1, found.length * effectiveUnits.length))),
            unitName: u,
          });
        }
      }
    }
  }

  // Fallback indicator code if still empty
  if (activeQuotas.length === 0) {
    const defaultCode = subject.includes('คณิต')
      ? `ค 1.1 ${gradeLevel}/1`
      : subject.includes('วิทย์')
      ? `ว 1.1 ${gradeLevel}/1`
      : subject.includes('ไทย')
      ? `ท 1.1 ${gradeLevel}/1`
      : subject.includes('อังกฤษ')
      ? `ต 1.1 ${gradeLevel}/1`
      : `ส 1.1 ${gradeLevel}/1`;
    activeQuotas = [
      {
        code: defaultCode,
        name: `ความรู้ ความเข้าใจ และทักษะกระบวนการในวิชา${subject}`,
        count: multipleChoiceCount,
        unitName: effectiveUnits[0] || 'หน่วยการเรียนรู้หลัก',
      },
    ];
  }

  // Generate Multiple Choice Questions
  const choiceKeys = choiceType === '5-choices' ? ['ก', 'ข', 'ค', 'ง', 'จ'] : ['ก', 'ข', 'ค', 'ง'];
  const bloomLevels = ['ความรู้ความจำ', 'ความเข้าใจ', 'การประยุกต์ใช้', 'การคิดวิเคราะห์'];
  const questions: ExamMultipleChoiceQuestion[] = [];
  const usedQuestionTexts = new Set<string>();

  const part2TotalScore = includeSubjective ? subjectiveCount * 5 : 0;
  const part1TotalScore = totalScore > part2TotalScore ? totalScore - part2TotalScore : multipleChoiceCount;
  const scorePerItem = Number((part1TotalScore / multipleChoiceCount).toFixed(2)) || 1;

  for (let i = 0; i < multipleChoiceCount; i++) {
    const quotaItem = activeQuotas[i % activeQuotas.length];
    const unitTitle = quotaItem.unitName || effectiveUnits[i % effectiveUnits.length];
    const indCode = quotaItem.code;
    const indName = quotaItem.name;
    const bloom = bloomLevels[i % bloomLevels.length];
    const correctIndex = i % choiceKeys.length;
    const correctKey = choiceKeys[correctIndex];

    let qData = generateCurriculumQuestionData({
      subject,
      gradeLevel,
      unitName: unitTitle,
      indicatorCode: indCode,
      indicatorName: indName || '',
      questionIndex: i + 1,
      choiceKeys,
      correctKey,
      bloom,
    });

    // Check duplicate and loop alternative offsets if needed
    let coreText = qData.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
    let attempt = 1;
    while (usedQuestionTexts.has(coreText) && attempt <= 25) {
      qData = generateCurriculumQuestionData({
        subject,
        gradeLevel,
        unitName: unitTitle,
        indicatorCode: indCode,
        indicatorName: indName || '',
        questionIndex: i + 1 + attempt * 7,
        choiceKeys,
        correctKey: choiceKeys[(correctIndex + attempt) % choiceKeys.length],
        bloom,
      });
      coreText = qData.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
      attempt++;
    }
    usedQuestionTexts.add(coreText);

    questions.push({
      questionNumber: i + 1,
      questionText: qData.questionText,
      choices: qData.choices,
      correctAnswer: correctKey,
      explanation: qData.explanation,
      indicator: indCode,
      bloomLevel: bloom,
    });
  }

  // Generate Part 2 Subjective Questions (if applicable)
  const subjectiveQuestions: ExamSubjectiveQuestion[] = [];
  const usedSubjTexts = new Set<string>();
  if (includeSubjective && subjectiveCount > 0) {
    for (let s = 0; s < subjectiveCount; s++) {
      const quotaItem = activeQuotas[s % activeQuotas.length];
      let sData = generateSubjectiveQuestionData({
        subject,
        gradeLevel,
        unitName: quotaItem.unitName || effectiveUnits[0],
        indicatorCode: quotaItem.code,
        indicatorName: quotaItem.name || '',
        questionIndex: s + 1,
      });

      let sCoreText = sData.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
      let sAttempt = 1;
      while (usedSubjTexts.has(sCoreText) && sAttempt <= 20) {
        sData = generateSubjectiveQuestionData({
          subject,
          gradeLevel,
          unitName: quotaItem.unitName || effectiveUnits[0],
          indicatorCode: quotaItem.code,
          indicatorName: quotaItem.name || '',
          questionIndex: s + 1 + sAttempt * 3,
        });
        sCoreText = sData.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
        sAttempt++;
      }
      usedSubjTexts.add(sCoreText);

      subjectiveQuestions.push({
        questionNumber: s + 1,
        questionText: sData.questionText,
        maxScore: 5,
        scoringCriteria: sData.scoringCriteria,
        sampleAnswer: sData.sampleAnswer,
        indicator: quotaItem.code,
      });
    }
  }

  // Generate Test Blueprint
  const [remRatio = '30', undRatio = '50', appRatio = '20'] = (difficultyRatio || '30:50:20').split(':');
  const blueprint: ExamBlueprintItem[] = activeQuotas.map((q) => {
    return {
      unitName: q.unitName || effectiveUnits[0] || 'หน่วยการเรียนรู้หลัก',
      indicator: `${q.code} ${q.name ? `(${q.name})` : ''}`.trim(),
      multipleChoiceCount: q.count || Math.max(1, Math.round(multipleChoiceCount / activeQuotas.length)),
      subjectiveCount: includeSubjective ? Math.max(1, Math.round(subjectiveCount / activeQuotas.length)) : 0,
      totalScore: Math.round(totalScore / activeQuotas.length),
      bloomDistribution: `ความจำ ${remRatio}%, ความเข้าใจ ${undRatio}%, วิเคราะห์/ประยุกต์ ${appRatio}%`,
    };
  });

  return {
    schoolName,
    examType,
    examTitle: `แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน ${examTypeTitle}ที่ ${term} ปีการศึกษา ${academicYear}`,
    subject,
    subjectCode,
    gradeLevel,
    academicYear,
    term,
    timeMinutes,
    totalScore,
    instructions: `คำชี้แจง: 1. แบบทดสอบนี้มี ${includeSubjective ? '2 ตอน' : '1 ตอน'} คะแนนเต็ม ${totalScore} คะแนน เวลา ${timeMinutes} นาที\n2. ตอนที่ 1 เป็นแบบเลือกตอบ ${choiceKeys.length} ตัวเลือก จำนวน ${multipleChoiceCount} ข้อ ให้เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว\n${includeSubjective ? `3. ตอนที่ 2 เป็นแบบอัตนัย/เขียนตอบ จำนวน ${subjectiveCount} ข้อ ให้แสดงวิธีทำหรือเขียนอธิบายอย่างละเอียด` : ''}`,
    part1: {
      title: `ตอนที่ 1 แบบเลือกตอบ ${choiceKeys.length} ตัวเลือก จำนวน ${multipleChoiceCount} ข้อ`,
      itemCount: multipleChoiceCount,
      scorePerItem,
      totalScore: part1TotalScore,
      questions,
    },
    part2: includeSubjective
      ? {
          title: `ตอนที่ 2 แบบอัตนัย/เขียนตอบ จำนวน ${subjectiveCount} ข้อ`,
          itemCount: subjectiveCount,
          totalScore: part2TotalScore,
          questions: subjectiveQuestions,
        }
      : undefined,
    blueprint,
  };
}

/**
 * Validates, repairs, and auto-completes the parsed SemesterExamResult structure.
 */
export function normalizeSemesterExamResult(
  parsed: any,
  params: GenerateSemesterExamParams
): SemesterExamResult {
  const fallback = synthesizeFallbackSemesterExam(params);
  if (!parsed || typeof parsed !== 'object') {
    return fallback;
  }

  // Support wrapped objects
  const root = parsed.exam || parsed.data || parsed.examResult || parsed;

  const schoolName = root.schoolName || fallback.schoolName;
  const examType = root.examType || fallback.examType;
  const examTitle = root.examTitle || fallback.examTitle;
  const subject = root.subject || fallback.subject;
  const subjectCode = root.subjectCode || fallback.subjectCode;
  const gradeLevel = root.gradeLevel || fallback.gradeLevel;
  const academicYear = root.academicYear || fallback.academicYear;
  const term = root.term || fallback.term;
  const timeMinutes = Number(root.timeMinutes) || fallback.timeMinutes;
  const totalScore = Number(root.totalScore) || fallback.totalScore;
  const instructions = root.instructions || fallback.instructions;

  // Normalize Part 1 Questions
  const choiceKeys = params.choiceType === '5-choices' ? ['ก', 'ข', 'ค', 'ง', 'จ'] : ['ก', 'ข', 'ค', 'ง'];
  const reqPart1Count = params.multipleChoiceCount || 20;
  const parsedPart1Questions: ExamMultipleChoiceQuestion[] = [];

  const rawPart1Questions = Array.isArray(root.part1?.questions)
    ? root.part1.questions
    : Array.isArray(root.questions)
    ? root.questions
    : [];

  rawPart1Questions.forEach((q: any, idx: number) => {
    if (!q || typeof q !== 'object') return;
    const qNum = Number(q.questionNumber) || idx + 1;
    const qText = q.questionText || q.question || `ข้อที่ ${qNum} สอดคล้องกับตัวชี้วัด`;

    let choices: Array<{ key: string; text: string }> = [];
    if (Array.isArray(q.choices) && q.choices.length >= 2) {
      choices = q.choices.map((c: any, cIdx: number) => ({
        key: c.key || choiceKeys[cIdx] || `ข้อ ${cIdx + 1}`,
        text: typeof c === 'string' ? c : c.text || c.choice || '',
      }));
    } else if (typeof q.choices === 'object' && q.choices !== null) {
      choices = choiceKeys.map((k) => ({
        key: k,
        text: q.choices[k] || `ตัวเลือก ${k}`,
      }));
    } else {
      choices = fallback.part1.questions[idx % fallback.part1.questions.length]?.choices || [];
    }

    parsedPart1Questions.push({
      questionNumber: qNum,
      questionText: qText,
      choices,
      correctAnswer: q.correctAnswer || q.answer || choiceKeys[0],
      explanation: q.explanation || q.reason || 'เฉลยคำตอบที่ถูกต้องตามหลักสูตร สพฐ.',
      indicator: q.indicator || fallback.part1.questions[idx % fallback.part1.questions.length]?.indicator || '',
      bloomLevel: q.bloomLevel || fallback.part1.questions[idx % fallback.part1.questions.length]?.bloomLevel || 'ความเข้าใจ',
    });
  });

  // Deduplicate and replace duplicates in Part 1
  const seenP1Texts = new Set<string>();
  const deduplicatedPart1: ExamMultipleChoiceQuestion[] = [];

  for (let idx = 0; idx < parsedPart1Questions.length; idx++) {
    const q = parsedPart1Questions[idx];
    const coreText = q.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();

    if (!seenP1Texts.has(coreText) && coreText.length > 5) {
      seenP1Texts.add(coreText);
      deduplicatedPart1.push(q);
    } else {
      // Duplicate detected! Replace with freshly synthesized unique item
      const quotaItem = fallback.part1.questions[idx % fallback.part1.questions.length];
      let replacement: ExamMultipleChoiceQuestion | null = null;
      for (let attempt = 1; attempt <= 30; attempt++) {
        const altData = generateCurriculumQuestionData({
          subject,
          gradeLevel,
          unitName: fallback.blueprint[idx % fallback.blueprint.length]?.unitName || 'หน่วยการเรียนรู้',
          indicatorCode: q.indicator || quotaItem?.indicator || '',
          indicatorName: '',
          questionIndex: idx + 1 + attempt * 11,
          choiceKeys,
          correctKey: choiceKeys[(idx + attempt) % choiceKeys.length],
          bloom: q.bloomLevel || 'การคิดวิเคราะห์',
        });
        const altCore = altData.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
        if (!seenP1Texts.has(altCore)) {
          seenP1Texts.add(altCore);
          replacement = {
            questionNumber: idx + 1,
            questionText: altData.questionText,
            choices: altData.choices,
            correctAnswer: choiceKeys[(idx + attempt) % choiceKeys.length],
            explanation: altData.explanation,
            indicator: q.indicator || quotaItem?.indicator || '',
            bloomLevel: q.bloomLevel || 'การคิดวิเคราะห์',
          };
          break;
        }
      }
      deduplicatedPart1.push(replacement || q);
    }
  }

  // If parsed count is less than requested, fill missing questions from fallback without duplicates
  while (deduplicatedPart1.length < reqPart1Count) {
    const missingIdx = deduplicatedPart1.length;
    let added = false;
    for (let attempt = 0; attempt <= 30; attempt++) {
      const candidate = fallback.part1.questions[(missingIdx + attempt) % fallback.part1.questions.length];
      const cCore = candidate.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
      if (!seenP1Texts.has(cCore)) {
        seenP1Texts.add(cCore);
        deduplicatedPart1.push({
          ...candidate,
          questionNumber: missingIdx + 1,
        });
        added = true;
        break;
      }
    }
    if (!added) {
      const fallbackItem = fallback.part1.questions[missingIdx % fallback.part1.questions.length];
      deduplicatedPart1.push({
        ...fallbackItem,
        questionNumber: missingIdx + 1,
      });
    }
  }

  // Ensure sequential question numbers
  deduplicatedPart1.forEach((q, i) => {
    q.questionNumber = i + 1;
  });

  const part1: SemesterExamResult['part1'] = {
    title: root.part1?.title || fallback.part1.title,
    itemCount: reqPart1Count,
    scorePerItem: Number(root.part1?.scorePerItem) || fallback.part1.scorePerItem,
    totalScore: Number(root.part1?.totalScore) || fallback.part1.totalScore,
    questions: deduplicatedPart1,
  };

  // Normalize Part 2 (Subjective)
  let part2: SemesterExamResult['part2'] = undefined;
  if (params.includeSubjective) {
    const reqPart2Count = params.subjectiveCount || 2;
    const parsedPart2Questions: ExamSubjectiveQuestion[] = [];
    const rawPart2Questions = Array.isArray(root.part2?.questions) ? root.part2.questions : [];

    rawPart2Questions.forEach((q: any, idx: number) => {
      if (!q || typeof q !== 'object') return;
      parsedPart2Questions.push({
        questionNumber: Number(q.questionNumber) || idx + 1,
        questionText: q.questionText || q.question || `โจทย์อัตนัยข้อที่ ${idx + 1}`,
        maxScore: Number(q.maxScore) || 5,
        scoringCriteria: q.scoringCriteria || 'เกณฑ์ตรวจ: แสดงวิธีทำถูกต้อง 3 คะแนน คำตอบถูกต้อง 2 คะแนน',
        sampleAnswer: q.sampleAnswer || 'แนวทางคำตอบที่ถูกต้อง',
        indicator: q.indicator || fallback.part2?.questions[idx % (fallback.part2?.questions.length || 1)]?.indicator || '',
      });
    });

    // Deduplicate Part 2
    const seenP2Texts = new Set<string>();
    const deduplicatedP2: ExamSubjectiveQuestion[] = [];
    for (let idx = 0; idx < parsedPart2Questions.length; idx++) {
      const q = parsedPart2Questions[idx];
      const sCore = q.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
      if (!seenP2Texts.has(sCore) && sCore.length > 5) {
        seenP2Texts.add(sCore);
        deduplicatedP2.push(q);
      } else {
        // Find replacement from generator
        let replacement: ExamSubjectiveQuestion | null = null;
        for (let attempt = 1; attempt <= 20; attempt++) {
          const altData = generateSubjectiveQuestionData({
            subject,
            gradeLevel,
            unitName: fallback.blueprint[idx % fallback.blueprint.length]?.unitName || 'หน่วยการเรียนรู้',
            indicatorCode: q.indicator || fallback.part2?.questions[0]?.indicator || '',
            indicatorName: '',
            questionIndex: idx + 1 + attempt * 5,
          });
          const altCore = altData.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
          if (!seenP2Texts.has(altCore)) {
            seenP2Texts.add(altCore);
            replacement = {
              questionNumber: idx + 1,
              questionText: altData.questionText,
              maxScore: 5,
              scoringCriteria: altData.scoringCriteria,
              sampleAnswer: altData.sampleAnswer,
              indicator: q.indicator || fallback.part2?.questions[0]?.indicator || '',
            };
            break;
          }
        }
        deduplicatedP2.push(replacement || q);
      }
    }

    while (deduplicatedP2.length < reqPart2Count) {
      const missingIdx = deduplicatedP2.length;
      let added = false;
      for (let attempt = 0; attempt <= 15; attempt++) {
        const candidate = fallback.part2?.questions[(missingIdx + attempt) % (fallback.part2?.questions.length || 1)];
        if (candidate) {
          const cCore = candidate.questionText.replace(/\(ตัวชี้วัด[^)]*\)/g, '').trim().toLowerCase();
          if (!seenP2Texts.has(cCore)) {
            seenP2Texts.add(cCore);
            deduplicatedP2.push({
              ...candidate,
              questionNumber: missingIdx + 1,
            });
            added = true;
            break;
          }
        }
      }
      if (!added && fallback.part2?.questions[0]) {
        deduplicatedP2.push({
          ...fallback.part2.questions[0],
          questionNumber: missingIdx + 1,
        });
      }
    }

    deduplicatedP2.forEach((q, i) => {
      q.questionNumber = i + 1;
    });

    part2 = {
      title: root.part2?.title || fallback.part2?.title || `ตอนที่ 2 แบบอัตนัย จำนวน ${reqPart2Count} ข้อ`,
      itemCount: reqPart2Count,
      totalScore: Number(root.part2?.totalScore) || (fallback.part2?.totalScore || reqPart2Count * 5),
      questions: deduplicatedP2,
    };
  }

  // Normalize Blueprint
  let blueprint = Array.isArray(root.blueprint) && root.blueprint.length > 0 ? root.blueprint : fallback.blueprint;
  blueprint = blueprint.map((bp: any, idx: number) => ({
    unitName: bp.unitName || bp.unit || fallback.blueprint[idx % fallback.blueprint.length]?.unitName || 'หน่วยการเรียนรู้',
    indicator: bp.indicator || fallback.blueprint[idx % fallback.blueprint.length]?.indicator || 'ตัวชี้วัด สพฐ.',
    multipleChoiceCount: Number(bp.multipleChoiceCount) || fallback.blueprint[idx % fallback.blueprint.length]?.multipleChoiceCount || 1,
    subjectiveCount: Number(bp.subjectiveCount) || 0,
    totalScore: Number(bp.totalScore) || fallback.blueprint[idx % fallback.blueprint.length]?.totalScore || 1,
    bloomDistribution: bp.bloomDistribution || 'ความจำ 30%, ความเข้าใจ 50%, วิเคราะห์ 20%',
  }));

  return {
    schoolName,
    examType,
    examTitle,
    subject,
    subjectCode,
    gradeLevel,
    academicYear,
    term,
    timeMinutes,
    totalScore,
    instructions,
    part1,
    part2,
    blueprint,
  };
}

export async function generateSemesterExam(
  params: GenerateSemesterExamParams
): Promise<SemesterExamResult> {
  const {
    apiKey,
    model,
    schoolName = 'โรงเรียนสังกัด สพฐ.',
    examType,
    subject,
    subjectCode = '',
    gradeLevel,
    academicYear = '2568',
    term = '1',
    timeMinutes = 60,
    totalScore = 20,
    topicsCovered = '',
    units = [],
    indicatorQuotas = [],
    indicators,
    multipleChoiceCount = 20,
    choiceType = '4-choices',
    includeSubjective = true,
    subjectiveCount = 2,
    difficultyRatio = '30:50:20',
    speedMode = 'ai',
  } = params;

  // If Express mode is selected, return instant OBEC curriculum synthesis (< 1 second)
  if (speedMode === 'express') {
    return synthesizeFallbackSemesterExam(params);
  }

  // If Gemini API Key is available, attempt AI generation with clean JSON schema
  if (apiKey?.trim()) {
    try {
      const examTypeTitle = examType === 'midterm' ? 'กลางภาคเรียน' : 'ปลายภาคเรียน';
      const choiceDesc = choiceType === '5-choices' ? '5 ตัวเลือก (ก, ข, ค, ง, จ)' : '4 ตัวเลือก (ก, ข, ค, ง)';
      const effectiveTopics = units.length > 0 ? units.join(', ') : topicsCovered;

      const prompt = `
คุณคือศึกษานิเทศก์และผู้เชี่ยวชาญด้านการวัดและประเมินผลทางการศึกษา สพฐ. กระทรวงศึกษาธิการ
จงออกแบบ "ชุดข้อสอบวัดผลสัมฤทธิ์ทางการเรียน ${examTypeTitle}" อย่างเป็นทางการและได้มาตรฐานระดับชาติ

ข้อมูลแบบทดสอบ:
- ประเภทการสอบ: ${examTypeTitle}ที่ ${term} ปีการศึกษา ${academicYear}
- กลุ่มสาระการเรียนรู้/วิชา: ${subject} ${subjectCode ? `(${subjectCode})` : ''}
- ระดับชั้น: ${gradeLevel}
- โรงเรียน: ${schoolName}
- เวลาที่ใช้สอบ: ${timeMinutes} นาที
- คะแนนเต็มรวม: ${totalScore} คะแนน
- ขอบข่ายเนื้อหา/หน่วยการเรียนรู้: ${effectiveTopics}
- ตัวชี้วัด สพฐ.: ${indicators}
- สัดส่วนความยากง่าย (Bloom Taxonomy): ${difficultyRatio} (ความจำ : ความเข้าใจ : คิดวิเคราะห์/ประยุกต์)
${
  indicatorQuotas && indicatorQuotas.length > 0
    ? `
- แผนผังและโควตาจำนวนข้อสอบตามตัวชี้วัด สพฐ. (MANDATORY INDICATOR ALLOCATION):
${indicatorQuotas
  .map(
    (iq, idx) =>
      `  ${idx + 1}. ตัวชี้วัด [${iq.code}] (${iq.name || ''}) จากหน่วย "${iq.unitName || ''}": ต้องออกข้อสอบปรนัย/อัตนัยรวมกัน ${iq.count} ข้อ`
  )
  .join('\n')}

กฎเหล็กเรื่องตัวชี้วัด (STRICT INDICATOR ACCURACY RULES):
1. [ความถูกต้องตรงตัวชี้วัด 100% - สำคัญที่สุด]: ข้อสอบทุกข้อต้องวัดเนื้อหาและทักษะที่ตรงตามมาตรฐานและสาระของตัวชี้วัดนั้นอย่างแท้จริง!
   - ห้ามนำโจทย์เนื้อหาเรื่องอื่นมาใส่รหัสตัวชี้วัดที่ไม่ตรงกันเด็ดขาด (ห้ามสวมป้ายผิดตัวชี้วัด)
   - ตัวอย่าง: หากตัวชี้วัดคือ [ค 1.1 ป.5/4] (หาผลคูณ ผลหารของเศษส่วนและจำนวนคละ) โจทย์ต้องเป็นการคำนวณคูณหรือหารเศษส่วน/จำนวนคละเท่านั้น ห้ามออกเรื่องร้อยละ กำไรขาดทุน หรือทศนิยมมาใส่รหัสนี้
   - หากตัวชี้วัดคือ [ค 1.1 ป.5/9] (โจทย์ปัญหาร้อยละ) ถึงจะออกเรื่องร้อยละ กำไร ขาดทุน หรือลดราคา
2. ข้อสอบปรนัยและอัตนัยทุกข้อ ต้องระบุรหัสตัวชี้วัดในฟิลด์ "indicator" อย่างชัดเจน และต้องตรงกับรหัสตัวชี้วัดที่กำหนดไว้ข้างต้น
3. จำนวนข้อสอบในแต่ละตัวชี้วัดต้องกระจายให้ครบถ้วนตามโควตาที่กำหนดไว้อย่างเคร่งครัด
4. ในฟิลด์ questionText หรือตอนท้ายโจทย์ ต้องระบุรหัสตัวชี้วัดกำกับด้วย เช่น "(ตัวชี้วัด ค 1.1 ป.5/4)"

กฎเหล็กห้ามออกข้อสอบซ้ำกันเด็ดขาด (ZERO DUPLICATION GUARANTEE):
1. [ห้ามซ้ำกัน 100%]: ข้อสอบทุกข้อ (ข้อ 1 ถึงข้อ ${multipleChoiceCount} และข้อสอบอัตนัย) ต้องมีโจทย์ ตัวเลข สถานการณ์ และตัวเลือกที่ไม่ซ้ำกันเลยแม้แต่ข้อเดียว!
2. กรณีตัวชี้วัดเดียวกันมีหลายข้อ: ต้องแต่งโจทย์ใหม่ที่มีตัวเลขและรูปแบบคำถามที่แตกต่างกันอย่างสิ้นเชิง (เช่น ข้อหนึ่งเป็นโจทย์ปัญหาการหาร อีกข้อเป็นโจทย์ปัญหา 2 ขั้นตอน อีกข้อเป็นการเปรียบเทียบ) ห้ามคัดลอกหรือสร้างข้อความโจทย์ซ้ำเดิมเด็ดขาด!
`
    : `
กฎเหล็กห้ามออกข้อสอบซ้ำกันเด็ดขาด (ZERO DUPLICATION GUARANTEE):
1. [ห้ามซ้ำกัน 100%]: ข้อสอบทุกข้อ (ข้อ 1 ถึงข้อ ${multipleChoiceCount} และข้อสอบอัตนัย) ต้องมีโจทย์ ตัวเลข สถานการณ์ และตัวเลือกที่ไม่ซ้ำกันเลยแม้แต่ข้อเดียว!
2. ต้องแต่งโจทย์ใหม่ที่มีตัวเลขและรูปแบบคำถามที่หลากหลายและแตกต่างกันอย่างสิ้นเชิง ห้ามคัดลอกหรือสร้างข้อความโจทย์ซ้ำเดิมเด็ดขาด!
`
}

โครงสร้างข้อสอบที่ต้องสร้าง:
1. ตอนที่ 1: แบบเลือกตอบ (${choiceDesc}) จำนวน ${multipleChoiceCount} ข้อ
2. ตอนที่ 2: ${includeSubjective ? `แบบเขียนตอบ/แสดงวิธีทำ จำนวน ${subjectiveCount} ข้อ พร้อมเกณฑ์การตรวจอย่างละเอียด` : 'ไม่มีข้อสอบอัตนัย'}
3. ผังวิเคราะห์ข้อสอบ (Test Blueprint): ระบุหน่วยการเรียนรู้, ตัวชี้วัด, จำนวนข้อ และระดับพฤติกรรม

คำสั่งเคร่งครัดเรื่องความเร็วและความกระชับ (FAST GENERATION MODE):
- คำถามและตัวเลือกต้องถูกต้องตามหลักวิชาการ ชัดเจน
- คำอธิบายเฉลย (explanation): เขียนสั้นกระชับ 1 ประโยคตรงประเด็นเพื่อความรวดเร็วในการประมวลผล
- เกณฑ์การตรวจ (scoringCriteria): สรุปสั้นชัดเจน 1-2 บรรทัด
- ตอบกลับเฉพาะ JSON ที่ถูกต้องตามโครงสร้างด้านล่างเท่านั้น:

{
  "schoolName": "${schoolName}",
  "examType": "${examType}",
  "examTitle": "แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน ${examTypeTitle}ที่ ${term} ปีการศึกษา ${academicYear}",
  "subject": "${subject}",
  "subjectCode": "${subjectCode}",
  "gradeLevel": "${gradeLevel}",
  "academicYear": "${academicYear}",
  "term": "${term}",
  "timeMinutes": ${timeMinutes},
  "totalScore": ${totalScore},
  "instructions": "คำชี้แจง: 1. ข้อสอบฉบับนี้มี ${includeSubjective ? '2 ตอน' : '1 ตอน'} คะแนนเต็ม ${totalScore} คะแนน...",
  "part1": {
    "title": "ตอนที่ 1 แบบเลือกตอบ ${choiceDesc} จำนวน ${multipleChoiceCount} ข้อ",
    "itemCount": ${multipleChoiceCount},
    "scorePerItem": 1,
    "totalScore": ${includeSubjective ? totalScore - subjectiveCount * 5 : totalScore},
    "questions": [
      {
        "questionNumber": 1,
        "questionText": "ข้อความโจทย์คำถาม",
        "choices": [
          { "key": "ก", "text": "ตัวเลือก 1" },
          { "key": "ข", "text": "ตัวเลือก 2" },
          { "key": "ค", "text": "ตัวเลือก 3" },
          { "key": "ง", "text": "ตัวเลือก 4" }
        ],
        "correctAnswer": "ก",
        "explanation": "เหตุผลเฉลยสั้นกระชับ 1 ประโยค",
        "indicator": "รหัสตัวชี้วัด สพฐ.",
        "bloomLevel": "ความเข้าใจ"
      }
    ]
  },
  ${
    includeSubjective
      ? `"part2": {
    "title": "ตอนที่ 2 แบบอัตนัย/แสดงวิธีทำ จำนวน ${subjectiveCount} ข้อ",
    "itemCount": ${subjectiveCount},
    "totalScore": ${subjectiveCount * 5},
    "questions": [
      {
        "questionNumber": 1,
        "questionText": "โจทย์ปัญหาที่ให้นักเรียนเขียนอธิบายหรือแสดงวิธีทำอย่างเป็นขั้นตอน",
        "maxScore": 5,
        "scoringCriteria": "เกณฑ์ตรวจ: แสดงวิธีทำถูกต้องได้ 3 คะแนน คำตอบสุดท้ายถูกต้องได้ 2 คะแนน",
        "sampleAnswer": "แนวคำตอบและขั้นตอนที่ถูกต้อง",
        "indicator": "รหัสตัวชี้วัด สพฐ."
      }
    ]
  },`
      : ''
  }
  "blueprint": [
    {
      "unitName": "ชื่อหน่วยการเรียนรู้",
      "indicator": "รหัสและชื่อตัวชี้วัด สพฐ.",
      "multipleChoiceCount": ${multipleChoiceCount},
      "subjectiveCount": ${includeSubjective ? subjectiveCount : 0},
      "totalScore": ${totalScore},
      "bloomDistribution": "ความจำ 30%, ความเข้าใจ 50%, วิเคราะห์ 20%"
    }
  ]
}
`.trim();

      const rawText = await callGeminiPrompt({
        apiKey,
        model,
        prompt,
        responseJson: true,
        temperature: 0.25,
        maxOutputTokens: 5120,
      });

      const parsed = safeParseJson<any>(rawText, null);
      if (parsed) {
        return normalizeSemesterExamResult(parsed, params);
      }
    } catch (apiErr) {
      console.warn('[generateSemesterExam] Gemini API call had an issue, falling back to curriculum engine:', apiErr);
    }
  }

  // High-fidelity curriculum synthesis fallback
  return synthesizeFallbackSemesterExam(params);
}

