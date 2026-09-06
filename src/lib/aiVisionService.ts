import { callGeminiVisionApi, type GeminiModelId } from './geminiClient';
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

จงอ่านและแปลงข้อมูลในภาพตารางสอนที่แนบมานี้ ให้เป็นรูปแบบ JSON ตามโครงสร้างด้านล่างอย่างเคร่งครัด:

{
  "courseTitle": "ชื่อหัวตาราง เช่น ตารางสอนครู หรือ ตารางปฏิบัติการสอน (ถ้ามี)",
  "teacherName": "ชื่อครูผู้สอนเจ้าของตารางนี้ (ถ้ามีระบุในหัวเอกสาร เช่น ครูสมชาย หรือใช้ '${defaultTeacherName}')",
  "periodCount": 7,
  "startTime": "08:30",
  "periodMinutes": 50,
  "lunchStart": "11:30",
  "lunchEnd": "12:30",
  "subjects": [
    { "code": "รหัสวิชา เช่น ค15101", "name": "ชื่อวิชา เช่น คณิตศาสตร์", "teacherName": "ชื่อครู" }
  ],
  "cells": [
    {
      "day": "จันทร์",
      "periodIndex": 1,
      "subjectCode": "รหัสวิชา เช่น HR หรือ ค15101",
      "subjectName": "ชื่อวิชา เช่น โฮมรูม หรือ คณิตศาสตร์",
      "classroom": "ห้องเรียนที่ครูไปสอนในคาบนี้ (เช่น ป.5/1, ป.5/2, 5/1 หรือหากในช่องไม่ได้ระบุห้อง ให้ใช้ '${defaultClassroom}')",
      "teacherName": "ชื่อครูผู้สอนในคาบนี้"
    }
  ],
  "notes": "ข้อสังเกตเพิ่มเติม (ถ้ามี)"
}

กฎเหล็ก:
1. วันในสัปดาห์ (day) ต้องเป็นภาษาไทยเท่านั้น: "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"
2. คาบเรียน (periodIndex) ต้องเป็นตัวเลข 1, 2, 3, 4, 5, 6, 7, 8...
3. ในแต่ละคาบ ให้พยายามตรวจจับว่าครูไปสอนที่ "ห้องเรียนไหน" (classroom) เช่น ป.5/1, 5/2, ม.1/3 หากช่องใดไม่มีระบุ ให้ใส่ '${defaultClassroom}'
4. ช่องที่เป็น "พักเที่ยง" หรือ "พักกลางวัน" หรือช่องว่างที่ครูไม่มีสอน ไม่ต้องใส่ลงใน cells
5. ตอบกลับเป็น JSON เท่านั้น
`.trim();

  const responseText = await callGeminiVisionApi({
    apiKey,
    model,
    prompt,
    imageBase64,
    mimeType,
    systemInstruction: 'คุณคือระบบ OCR ตารางสอนโรงเรียนไทย แม่นยำ ละเอียด ตอบเฉพาะ JSON',
    responseJson: true,
  });

  try {
    const jsonStr = extractJsonFromMarkdown(responseText);
    const parsed = JSON.parse(jsonStr) as ParsedScheduleResult;
    return {
      courseTitle: parsed.courseTitle || 'ตารางสอนประจำสัปดาห์',
      teacherName: parsed.teacherName || '',
      periodCount: Number(parsed.periodCount) || 7,
      startTime: parsed.startTime || '08:30',
      periodMinutes: Number(parsed.periodMinutes) || 50,
      lunchStart: parsed.lunchStart || '11:40',
      lunchEnd: parsed.lunchEnd || '12:30',
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      cells: Array.isArray(parsed.cells) ? parsed.cells : [],
      notes: parsed.notes || '',
    };
  } catch (err) {
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
    const jsonStr = extractJsonFromMarkdown(responseText);
    const parsed = JSON.parse(jsonStr) as {
      attendanceDate?: string;
      periodLabel?: string;
      students?: ParsedAttendanceStudent[];
      notes?: string;
    };
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
    const jsonStr = extractJsonFromMarkdown(responseText);
    const parsed = JSON.parse(jsonStr) as {
      assessmentTitle?: string;
      maxScoreDetected?: number;
      students?: ParsedScoreStudent[];
      notes?: string;
    };
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

  // Call Gemini API via prompt
  const effectiveModel = model === 'auto' ? 'gemini-1.5-flash' : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey.trim()}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const jsonStr = extractJsonFromMarkdown(rawText || '{}');
  return JSON.parse(jsonStr) as RubricResult;
}

export interface QuizQuestion {
  questionNumber: number;
  questionText: string;
  choices: Array<{ key: 'ก' | 'ข' | 'ค' | 'ง'; text: string }>;
  correctAnswer: 'ก' | 'ข' | 'ค' | 'ง';
  explanation: string;
}

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
  questionCount = 5
): Promise<RemedialQuizResult> {
  const prompt = `
สร้างแบบทดสอบซ่อมเสริม (Remedial Quiz) สำหรับนักเรียนที่สอบไม่ผ่านตามตัวชี้วัด สพฐ.
วิชา: ${subject}
ระดับชั้น: ${gradeLevel}
ตัวชี้วัด สพฐ.: ${indicator}
หัวข้อที่ต้องซ่อมเสริมเป็นพิเศษ: ${focusTopics || 'เนื้อหาหลักตามตัวชี้วัด'}
จำนวนข้อ: ${questionCount} ข้อ (แบบเลือกตอบ 4 ตัวเลือก ก, ข, ค, ง)

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
      "choices": [
        { "key": "ก", "text": "ตัวเลือก ก" },
        { "key": "ข", "text": "ตัวเลือก ข" },
        { "key": "ค", "text": "ตัวเลือก ค" },
        { "key": "ง", "text": "ตัวเลือก ง" }
      ],
      "correctAnswer": "ก",
      "explanation": "คำอธิบายเฉลยอย่างละเอียด เพื่อให้ครูใช้อธิบายนักเรียนซ่อมเสริม"
    }
  ]
}
`.trim();

  const effectiveModel = model === 'auto' ? 'gemini-1.5-flash' : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey.trim()}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API Error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const jsonStr = extractJsonFromMarkdown(rawText || '{}');
  return JSON.parse(jsonStr) as RemedialQuizResult;
}
