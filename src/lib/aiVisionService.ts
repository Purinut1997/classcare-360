import { callGeminiVisionApi, callGeminiPrompt, type GeminiModelId } from './geminiClient';
import type { DayName } from './scheduleSettings';

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
จงวิเคราะห์ "ตัวชี้วัด สพฐ." ที่สอดคล้องกับหน่วยการเรียนรู้ต่อไปนี้อย่างถูกต้องตามมาตรฐานหลักสูตรแกนกลาง 2551 (ฉบับปรับปรุง 2560):

วิชา: ${subject}
ระดับชั้น: ${gradeLevel}
หน่วยการเรียนรู้ที่สอน:
${units.map((u, i) => `${i + 1}. ${u}`).join('\n')}

คำสั่ง:
1. สำหรับแต่ละหน่วยการเรียนรู้ จงจับคู่และระบุรหัสตัวชี้วัด สพฐ. ที่ตรงเป๊ะและเกี่ยวข้อง (เช่น ค 1.1 ป.5/1, ว 1.2 ม.2/3) พร้อมคำอธิบายตัวชี้วัดสั้นกระชับเข้าใจง่าย
2. แต่ละหน่วยสามารถมีได้ 1-3 ตัวชี้วัดที่เกี่ยวข้องโดยตรง
3. ตอบกลับเฉพาะ JSON array ตามโครงสร้างนี้เท่านั้น:
[
  {
    "unitName": "ชื่อหน่วยการเรียนรู้",
    "code": "รหัสตัวชี้วัด เช่น ค 1.1 ป.5/1",
    "name": "คำอธิบายตัวชี้วัดสั้นๆ"
  }
]
`;

  const rawText = await callGeminiPrompt({
    apiKey,
    model,
    prompt,
    responseJson: true,
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  try {
    const parsed = safeParseJson<AnalyzedIndicator[]>(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse analyzed indicators:', err, rawText);
    return [];
  }
}

export interface ExamIndicatorQuota {
  code: string;
  name?: string;
  count: number;
  unitName?: string;
}

export interface GenerateSemesterExamParams {
  apiKey: string;
  model: GeminiModelId;
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
  } = params;

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

กฎเหล็กเรื่องตัวชี้วัด (STRICT INDICATOR RULES):
1. ข้อสอบปรนัยและอัตนัยทุกข้อ ต้องระบุรหัสตัวชี้วัดในฟิลด์ "indicator" อย่างชัดเจน และต้องตรงกับรหัสตัวชี้วัดที่กำหนดไว้ข้างต้น
2. จำนวนข้อสอบในแต่ละตัวชี้วัดต้องกระจายให้ครบถ้วนตามโควตาที่กำหนดไว้อย่างเคร่งครัด
3. ในฟิลด์ questionText หรือตอนท้ายโจทย์ ต้องระบุรหัสตัวชี้วัดกำกับด้วย เช่น "(ตัวชี้วัด ค 1.1 ป.5/1)" หรือระบบจะนำฟิลด์ indicator ไปแสดงผลกำกับท้ายข้อ
`
    : ''
}

โครงสร้างข้อสอบที่ต้องสร้าง:
1. ตอนที่ 1: แบบเลือกตอบ (${choiceDesc}) จำนวน ${multipleChoiceCount} ข้อ
2. ตอนที่ 2: ${includeSubjective ? `แบบเขียนตอบ/แสดงวิธีทำ จำนวน ${subjectiveCount} ข้อ พร้อมเกณฑ์การตรวจอย่างละเอียด` : 'ไม่มีข้อสอบอัตนัย'}
3. ผังวิเคราะห์ข้อสอบ (Test Blueprint): ระบุหน่วยการเรียนรู้, ตัวชี้วัด, จำนวนข้อ และระดับพฤติกรรม

คำสั่งเคร่งครัด:
- คำถามและตัวเลือกต้องถูกต้องตามหลักวิชาการ ไม่มีข้อกำกวม ตัวลวงมีหลักการ
- ห้ามใส่ newline หรือ quote ซ้อนกันในสตริง JSON
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
  "instructions": "คำชี้แจง: 1. ข้อสอบฉบับนี้มี 2 ตอน...",
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
        "explanation": "เหตุผลเฉลยละเอียดและวิเคราะห์ตัวเลือก",
        "indicator": "${indicators.split(',')[0]?.trim() || 'ตัวชี้วัด'}",
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
        "indicator": "${indicators.split(',')[0]?.trim() || 'ตัวชี้วัด'}"
      }
    ]
  },`
      : ''
  }
  "blueprint": [
    {
      "unitName": "ชื่อหน่วยการเรียนรู้",
      "indicator": "ตัวชี้วัด",
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
    temperature: 0.4,
    maxOutputTokens: 8192,
  });

  try {
    return safeParseJson<SemesterExamResult>(rawText);
  } catch (err) {
    throw new Error(`ไม่สามารถสร้างชุดข้อสอบกลางภาค/ปลายภาคได้: ${(err as Error).message}`);
  }
}
