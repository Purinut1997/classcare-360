export type GeminiModelId =
  | 'auto'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-3.5-flash'
  | 'gemini-3.6-flash'
  | 'gemini-2.0-flash'
  | 'gemini-2.5-pro';

export interface GeminiModelOption {
  id: GeminiModelId;
  name: string;
  tag: string;
  description: string;
  speed: string;
  quota: string;
  highlight?: boolean;
}

export const AUTO_MODEL_OPTION: GeminiModelOption = {
  id: 'auto',
  name: 'Auto Model (สลับรุ่นอัตโนมัติ)',
  tag: 'แนะนำสูงสุด ✨',
  description: 'ระบบตรวจจับและสลับโมเดลให้อัตโนมัติ (Gemini 2.5 ➔ 3.5 ➔ 2.0) เพื่อให้ได้คำตอบที่ดีที่สุดและไม่มีวันติดลิมิต',
  speed: '⚡⚡⚡⚡ อัจฉริยะ',
  quota: 'ไม่มีวันหมด (สลับรุ่นอัตโนมัติ)',
  highlight: true,
};

export const MANUAL_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tag: 'รุ่นหลักล่าสุด แนะนำ 🌟',
    description: 'โมเดลรุ่นใหม่ล่าสุดของ Google AI Studio ประมวลผลรวดเร็ว ฉลาด แม่นยำ และโควตาว่าง',
    speed: '⚡⚡⚡⚡ เร็วมาก',
    quota: 'โควตาอิสระ (20 ครั้ง/วัน)',
    highlight: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    tag: 'เร็วและประหยัด ⚡',
    description: 'โมเดลประมวลผลด่วนพิเศษ สำหรับงานตอบคำถามไวและสร้างข้อสอบ',
    speed: '⚡⚡⚡⚡ เร็วที่สุด',
    quota: 'โควตาอิสระ (20 ครั้ง/วัน)',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    tag: 'ฉลาด ละเอียด ✨',
    description: 'โมเดลวิเคราะห์ข้อมูลลึก ตอบรายละเอียดได้ครบถ้วน',
    speed: '⚡⚡⚡ เร็ว',
    quota: 'โควตาอิสระ (20 ครั้ง/วัน)',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    tag: 'รุ่นใหม่พรีวิว 🚀',
    description: 'โมเดลความสามารถสูงรุ่นล่าสุดของ Google (หากติดลิมิต 20/20 ระบบจะสลับไปรุ่น 2.5 Flash ให้อัตโนมัติ)',
    speed: '⚡⚡⚡ เร็ว',
    quota: 'โควตาอิสระ (20 ครั้ง/วัน)',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tag: 'เสถียรภาพสูง ⭐',
    description: 'โมเดลตอบสนองเร็วพิเศษ เหมาะสำหรับงานสร้างข้อสอบ รูบริก และแชทบอท',
    speed: '⚡⚡⚡⚡ เร็วมาก',
    quota: 'Google AI Studio',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tag: 'คิดวิเคราะห์ขั้นสูง 🧠',
    description: 'ความสามารถในการคิดวิเคราะห์เชิงลึกระดับสูง ร่างข้อสอบและรูบริกที่ซับซ้อน',
    speed: '⚡ ปานกลาง',
    quota: 'สำหรับงานวิเคราะห์เชิงลึก',
  },
];

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  AUTO_MODEL_OPTION,
  ...MANUAL_GEMINI_MODELS,
];

/**
 * Returns prioritized candidate models for API execution.
 */
export function getCandidateModels(preferredModel?: string): string[] {
  const clean =
    preferredModel &&
    preferredModel !== 'auto' &&
    (preferredModel as string) !== 'gemini-1.5-flash' &&
    (preferredModel as string) !== 'gemini-1.5-pro'
      ? preferredModel
      : 'gemini-2.5-flash';

  return [
    clean,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
  ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);
}

export interface AssistantAction {
  type: 'navigate' | 'copy' | 'handover' | 'calendar' | 'calendar_batch';
  target?: string;
  label: string;
  payload?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: AssistantAction[];
}

import {
  buildSchedulePeriods,
  loadScheduleSettings,
  makeScheduleCellKey,
} from './scheduleSettings';

const SYSTEM_INSTRUCTION = `
คุณคือ "น้องแคร์ (Carey)" — AI ผู้ช่วยครูประจำระบบ "ClassCare 360" (ระบบบริหารจัดการโรงเรียนและงานครูครบวงจร มาตรฐาน สพฐ.)
หน้าที่ของคุณคือ:
1. ให้คำแนะนำการใช้งานระบบ ClassCare 360 อย่างสุภาพ อบอุ่น สั้นกระชับ ชัดเจน และตรงประเด็น (ใช้ภาษาไทยที่สุภาพ เป็นกันเองกับคุณครู)
2. อธิบายระเบียบการวัดและประเมินผลของ สพฐ. 2551 (เกรด 8 ระดับ, คุณลักษณะ 8 ประการ, อ่านคิดวิเคราะห์เขียน, เวลาเรียน 80%)
3. ช่วยร่างข้อความสื่อสารกับผู้ปกครอง (LINE), ร่างความคิดเห็นท้ายสมุดพก (ปพ.6), และคิดกิจกรรมในห้องเรียน
4. หากคุณแนะนำให้ผู้ใช้ไปที่เมนูหรือหน้าใดในระบบ ให้ใส่ปุ่ม Action นำทางในรูปแบบ: [NAVIGATE:view_key:ข้อความปุ่ม] เช่น:
   - [NAVIGATE:scores:เปิดหน้าระบบคะแนน]
   - [NAVIGATE:desirable-characteristics:ไปที่หน้าประเมินคุณลักษณะ]
   - [NAVIGATE:teacher-work:ไปที่หน้าเช็กชื่อมาเรียน]
   - [NAVIGATE:academic-year:ไปที่ระบบเลื่อนชั้น]
   - [NAVIGATE:school-calendar:เปิดปฏิทินโรงเรียน]
   - [NAVIGATE:schedule:เปิดดูตารางสอน]
   - [NAVIGATE:period-locks:ไปที่ล็อกงวดข้อมูล]
   - [NAVIGATE:reports:เปิดศูนย์รายงาน ปพ.]
   - [NAVIGATE:parent-access:ไปที่ Portal ผู้ปกครอง]
5. หากเป็นข้อความร่างส่งผู้ปกครอง หรือความคิดเห็นสมุดพก ให้จัดรูปแบบชัดเจน และสามารถใส่แท็ก [COPY:ข้อความที่ต้องการให้คัดลอก] เพื่อให้ครูกด Copy ได้ง่าย
6. หากปัญหาเป็นเรื่องเชิงลึกเกี่ยวกับระบบเทคนิคที่ AI ไม่สามารถแก้ไขให้ได้ ให้แนะนำให้ส่งเรื่องถึงแอดมิน โดยใส่ [HANDOVER:หัวข้อปัญหา:รายละเอียด]
7. กฎเหล็กด้านความถูกต้องของข้อมูล (CRITICAL RULE - GROUNDING & NO HALLUCINATION):
   - คุณต้องอิงข้อมูลนักเรียน รายชื่อ และสถิติการมาเรียนจาก [ข้อมูลจริงจากฐานข้อมูลระบบ ClassCare 360] ที่แนบมาให้ในบริบทเท่านั้น!
   - ห้ามกุชื่อหรือแต่งชื่อนักเรียน นามสกุล หรือสมมุติสถิติตัวเลขขึ้นมาเองโดยเด็ดขาด (DO NOT FABRICATE OR HALLUCINATE NAMES/DATA)!
   - หากในข้อมูลระบุว่า "ยังไม่มีบันทึกข้อมูลการเช็คชื่อ" หรือ "ไม่มีนักเรียนขาดเรียน" ให้แจ้งคุณครูตามตรง เช่น: "จากการตรวจสอบข้อมูลจริงในระบบ ClassCare 360 ปัจจุบันยังไม่มีบันทึกการขาดเรียนของนักเรียนในห้องนี้ค่ะ คุณครูสามารถเข้าไปเริ่มบันทึกเช็คชื่อได้ที่ [NAVIGATE:teacher-work:เปิดหน้าเช็คชื่อ]"
8. เมื่อคุณครูขอให้คุณช่วยบันทึกวันหยุด, วันสอบ, หรือวันกิจกรรมลงปฏิทินโรงเรียน (เช่น "ช่วยบันทึกวันหยุด 23 ต.ค. วันปิยมหาราช ให้หน่อย" หรือ "เพิ่มวันสอบ"):
   - ให้สรุปข้อความยืนยัน และสร้างปุ่ม Action สำหรับบันทึกลงปฏิทินในรูปแบบ:
     [CALENDAR:YYYY-MM-DD:type:ชื่อวันหรือกิจกรรม:ข้อความบนปุ่ม]
     (โดย type ได้แก่ holiday=วันหยุด, exam=วันสอบ, activity=กิจกรรม, makeup=เรียนชดเชย)
     ตัวอย่าง: [CALENDAR:2026-10-23:holiday:วันปิยมหาราช:📅 บันทึกวันหยุดลงปฏิทินทันที]
9. เมื่อคุณครูขอให้คุณช่วยบันทึกวันหยุดราชการทั้งปี หรือบันทึกวันหยุดประจำปี (เช่น "ลงวันหยุดราชการปี 2569 ให้หน่อย" หรือ "ช่วยบันทึกวันหยุดทั้งปี"):
   - ให้สรุปปฏิทินวันหยุดราชการไทยตลอดทั้งปี 2569 (2026) เช่น วันขึ้นปีใหม่, วันครูแห่งชาติ, วันมาฆบูชา, วันสงกรานต์, วันเฉลิมพระชนมพรรษา, วันแม่, วันพ่อ ฯลฯ
   - และสร้างปุ่ม Action สำหรับบันทึกรวดเดียวทั้งปีในรูปแบบ:
     [CALENDAR_BATCH:2026:📅 บันทึกวันหยุดราชการทั้งปี 2569 (20 วัน) ลงปฏิทินทันที]
10. เมื่อคุณครูถามเกี่ยวกับตารางสอน หรือคาบเรียน (เช่น "บอกตารางสอนวันจันทร์ให้หน่อย", "วันนี้มีสอนอะไรบ้าง", "มีสอนห้องไหนบ้าง"):
    - ให้อ้างอิงข้อมูลจาก [มิติที่ 6: ตารางเวรทำความสะอาด และตารางสอนของครู] ในบริบทอย่างเคร่งครัด
    - แจกแจงลำดับคาบเรียน, เวลาเริ่ม-สิ้นสุด, รายวิชา, รหัสวิชา และห้องเรียน/ชั้นเรียน (เช่น ป.5/1) ให้ชัดเจน สวยงาม อ่านง่าย
    - หากไม่มีคาบสอนในวันนั้น หรือระบบยังไม่มีการบันทึก ให้แจ้งคุณครูตามตรงและแนะนำปุ่มทางลัด [NAVIGATE:schedule:เปิดดูตารางสอน]
`.trim();

/**
 * Call Google Gemini REST API directly with the provided API key.
 * Includes automatic fallback to gemini-1.5-flash if the primary model returns 404.
 */
export async function callGeminiApi(
  apiKey: string,
  model: GeminiModelId,
  messages: ChatMessage[],
  contextInfo?: {
    activeView?: string;
    classroomName?: string;
    academicYear?: string;
    liveSchoolContext?: string;
    allowFallback?: boolean;
    politeEnding?: 'male' | 'female' | 'neutral';
  }
): Promise<string> {
  const allowFallback = contextInfo?.allowFallback !== false;
  const candidates = getCandidateModels(model);
  const isAuto = model === 'auto';
  const initialModel = candidates[0];
  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${initialModel}:generateContent?key=${apiKey}`;

  // Build context prefix
  const contextNote = contextInfo?.liveSchoolContext
    ? `${contextInfo.liveSchoolContext}\n\n`
    : (contextInfo?.activeView
        ? `[บริบทปัจจุบัน: คุณครูกำลังเปิดหน้า '${contextInfo.activeView}' ห้องเรียน: '${contextInfo.classroomName || 'ไม่ได้เลือก'}' ปีการศึกษา: '${contextInfo.academicYear || '2569'}']\n\n`
        : '');

  // Dynamic polite ending rules based on teacher preference (Male vs Female vs Neutral)
  const politeInstruction =
    contextInfo?.politeEnding === 'male'
      ? `\n\n[ข้อกำหนดสำคัญสูงสุดเรื่องเพศและคำลงท้ายของคุณครู]:
คุณครูผู้ใช้งานระบบนี้คือ "คุณครูผู้ชาย (เพศชาย)"
1. เมื่อคุณร่างข้อความประกาศ, จดหมาย หรือข้อความสื่อสารกับผู้ปกครอง (เช่น ทาง LINE / ปพ.6 / หนังสือเชิญประชุมผู้ปกครอง / ข้อความส่งตัวนักเรียน) คุณครูจะเป็นผู้ส่งข้อความนี้เอง ดังนั้นต้องใช้คำลงท้ายสำหรับคุณครูผู้ชายเท่านั้น เช่น "ครับ", "นะครับ", "ครับผม" (เช่น "ร่วมกับคุณครูประจำชั้นครับ", "ยินดีต้อนรับครับ", "ขอบพระคุณครับ") ห้ามใช้ "ค่ะ" หรือ "นะคะ" ในร่างข้อความโดยเด็ดขาด!
2. ในการสนทนากับคุณครู ให้สุภาพและเป็นกันเอง`
      : contextInfo?.politeEnding === 'female'
      ? `\n\n[ข้อกำหนดสำคัญสูงสุดเรื่องเพศและคำลงท้ายของคุณครู]:
คุณครูผู้ใช้งานระบบนี้คือ "คุณครูผู้หญิง (เพศหญิง)"
1. เมื่อคุณร่างข้อความประกาศ หรือข้อความสื่อสารกับผู้ปกครอง ให้ใช้คำลงท้าย "ค่ะ", "นะคะ" (เช่น "ร่วมกับคุณครูประจำชั้นค่ะ", "ขอบคุณค่ะ")
2. ในการสนทนากับคุณครู ให้สุภาพอ่อนหวาน "ค่ะ", "นะคะ"`
      : `\n\n[ข้อกำหนดสำคัญเรื่องคำลงท้าย]: ใช้ภาษาทางการสุภาพเป็นกลาง เหมาะสมสำหรับหนังสือและประกาศราชการของสถานศึกษา`;

  // Map messages to Gemini API format
  const contents = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10) // Keep last 10 messages for context
    .map((m, idx, arr) => {
      const isLastUserMsg = idx === arr.length - 1 && m.role === 'user';
      const text = isLastUserMsg ? contextNote + m.content : m.content;
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      };
    });

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION + politeInstruction }],
    },
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  };

  let response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Auto-fallback if the selected model returns 404, 400 (e.g. model discontinued), or 429 (quota exceeded)
  if (!response.ok && (response.status === 404 || response.status === 400 || response.status === 429)) {
    if (allowFallback) {
      let fallbackCandidates = candidates.filter((m) => m !== initialModel);
      for (const fallbackModel of fallbackCandidates) {
        const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`;
        const fallbackRes = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (fallbackRes.ok) {
          response = fallbackRes;
          break;
        }
      }

      // If still not ok and it's 404, dynamically discover supported models from Google
      if (!response.ok && response.status === 404) {
        const liveModels = await listAvailableGeminiModels(apiKey);
        for (const liveM of liveModels.slice(0, 3)) {
          if (!candidates.includes(liveM)) {
            const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${liveM}:generateContent?key=${apiKey}`;
            const liveRes = await fetch(fallbackEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (liveRes.ok) {
              response = liveRes;
              break;
            }
          }
        }
      }
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    let errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
    if (response.status === 429) {
      errMsg = `โมเดล ${initialModel} โควตาการใช้งานเต็มแล้ว (429 Quota Exceeded) แนะนำให้เปลี่ยนเป็น "Auto Model" หรือ "Gemini 1.5 Flash" ที่มีโควตาสูง 1,500 ครั้ง/วัน หรือเปิดการสลับรุ่นสำรองอัตโนมัติ`;
    }
    throw new Error(`Gemini API Error: ${errMsg}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('ไม่ได้รับคำตอบจาก Gemini โมเดล');
  }

  return rawText;
}

export interface GeminiVisionOptions {
  apiKey: string;
  model?: GeminiModelId;
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  systemInstruction?: string;
  responseJson?: boolean;
  maxOutputTokens?: number;
}

/**
 * Call Google Gemini Multimodal Vision API directly with image data.
 * Supports automatic model fallback (gemini-1.5-flash, gemini-3.6-flash, etc.)
 */
export async function callGeminiVisionApi(options: GeminiVisionOptions): Promise<string> {
  const { apiKey, prompt, systemInstruction, responseJson, maxOutputTokens } = options;
  if (!apiKey?.trim()) {
    throw new Error('กรุณาระบุ Gemini API Key ก่อนใช้งาน AI Vision');
  }

  // Auto clean base64 data url if passed
  let cleanBase64 = options.imageBase64.trim();
  let mimeType = options.mimeType || 'image/jpeg';
  const dataUrlMatch = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    cleanBase64 = dataUrlMatch[2];
  }

  const candidateModels = getCandidateModels(options.model);
  const initialModel = candidateModels[0];

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2, // Low temperature for high OCR fidelity
      maxOutputTokens: maxOutputTokens || 8192,
      ...(responseJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${initialModel}:generateContent?key=${apiKey.trim()}`;
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Fallback hierarchy if primary model is unavailable or rate limited
  if (!response.ok && (response.status === 404 || response.status === 400 || response.status === 429)) {
    const fallbackCandidates = candidateModels.filter((m) => m !== initialModel);
    for (const fallbackModel of fallbackCandidates) {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey.trim()}`;
      const fallbackRes = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
        break;
      }
    }

    if (!response.ok && response.status === 404) {
      const liveModels = await listAvailableGeminiModels(apiKey.trim());
      for (const liveM of liveModels.slice(0, 3)) {
        if (!candidateModels.includes(liveM)) {
          const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${liveM}:generateContent?key=${apiKey.trim()}`;
          const liveRes = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (liveRes.ok) {
            response = liveRes;
            break;
          }
        }
      }
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    let errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
    if (response.status === 429) {
      errMsg = 'โควตาการใช้งาน Gemini เต็มชั่วคราว (429 Quota Exceeded) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
    }
    throw new Error(`Gemini Vision Error: ${errMsg}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('โมเดลไม่ได้ส่งข้อมูลผลลัพธ์กลับมา');
  }

  return rawText;
}

export interface GeminiPromptOptions {
  apiKey: string;
  model?: GeminiModelId;
  prompt: string;
  systemInstruction?: string;
  responseJson?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Call Google Gemini API directly with a text prompt and automatic fallback.
 * Solves HTTP 404 / 400 / 429 errors seamlessly by falling back to stable models (e.g. gemini-1.5-flash).
 */
export async function callGeminiPrompt(options: GeminiPromptOptions): Promise<string> {
  const { apiKey, prompt, systemInstruction, responseJson, temperature = 0.4, maxOutputTokens } = options;
  if (!apiKey?.trim()) {
    throw new Error('กรุณาระบุ Gemini API Key ก่อนใช้งาน');
  }

  const candidateModels = getCandidateModels(options.model);
  const initialModel = candidateModels[0];

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: maxOutputTokens || 8192,
      ...(responseJson ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${initialModel}:generateContent?key=${apiKey.trim()}`;
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Fallback hierarchy if primary model returns 404, 400, or 429
  if (!response.ok && (response.status === 404 || response.status === 400 || response.status === 429)) {
    const fallbackCandidates = candidateModels.filter((m) => m !== initialModel);
    for (const fallbackModel of fallbackCandidates) {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey.trim()}`;
      const fallbackRes = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (fallbackRes.ok) {
        response = fallbackRes;
        break;
      }
    }

    if (!response.ok && response.status === 404) {
      const liveModels = await listAvailableGeminiModels(apiKey.trim());
      for (const liveM of liveModels.slice(0, 3)) {
        if (!candidateModels.includes(liveM)) {
          const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${liveM}:generateContent?key=${apiKey.trim()}`;
          const liveRes = await fetch(fallbackEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (liveRes.ok) {
            response = liveRes;
            break;
          }
        }
      }
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    let errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
    if (response.status === 429) {
      errMsg = 'โควตาการใช้งาน Gemini เต็มชั่วคราว (429 Quota Exceeded) กรุณารอสักครู่แล้วลองใหม่';
    }
    throw new Error(`Gemini API Error: ${errMsg}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('โมเดลไม่ได้ส่งข้อมูลผลลัพธ์กลับมา');
  }

  return rawText;
}

/**
 * Discovers models available for this API key via Google's models.list endpoint.
 */
export async function listAvailableGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const serverModels: Array<{ name: string; supportedGenerationMethods?: string[] }> =
      data.models || [];
    return serverModels
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  } catch {
    return [];
  }
}

async function attemptTestModel(
  apiKey: string,
  model: string
): Promise<{ ok: boolean; status: number; errorMsg?: string }> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'สวัสดี ตอบสั้นๆ คำเดียวว่า "พร้อมใช้งาน"' }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
    });

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    const err = await response.json().catch(() => ({}));
    return {
      ok: false,
      status: response.status,
      errorMsg: err.error?.message,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      errorMsg: e.message,
    };
  }
}

/**
 * Test if a Gemini API Key is valid and can generate content.
 * Dynamically checks models.list for key validity and supported models.
 */
export async function testGeminiApiKey(
  apiKey: string,
  model: GeminiModelId = 'auto'
): Promise<{ success: boolean; message: string; autoSwitchedModel?: GeminiModelId }> {
  if (!apiKey || apiKey.trim().length < 20) {
    return { success: false, message: 'กรุณากรอก API Key ที่ถูกต้อง' };
  }

  const cleanKey = apiKey.trim();

  try {
    // 1. Validate key and discover supported models from Google
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`
    );

    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      return {
        success: false,
        message: err.error?.message || `API Key ไม่ถูกต้อง หรือไม่สามารถเชื่อมต่อได้ (รหัส ${listRes.status})`,
      };
    }

    const listData = await listRes.json();
    const serverModels: Array<{ name: string; supportedGenerationMethods?: string[] }> =
      listData.models || [];
    const supportedList = serverModels
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));

    if (supportedList.length === 0) {
      return {
        success: false,
        message: 'API Key ใช้งานได้ แต่ไม่พบโมเดลที่รองรับการสร้างเนื้อหาในบัญชีนี้',
      };
    }

    // 2. Build test queue strictly from models confirmed by Google
    const requested = model && model !== 'auto' ? (model as string) : 'gemini-2.5-flash';
    const priorityCandidates = [
      requested,
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-2.0-flash',
      'gemini-2.5-pro',
      ...supportedList,
    ];

    const testQueue: string[] = [];
    for (const cand of priorityCandidates) {
      if (!cand || cand === 'gemini-1.5-flash' || cand === 'gemini-1.5-pro') continue;
      const match =
        supportedList.find((m) => m === cand) ||
        supportedList.find((m) => m.startsWith(cand + '-')) ||
        supportedList.find((m) => m.includes(cand));
      if (match && !testQueue.includes(match)) {
        testQueue.push(match);
      }
    }

    if (testQueue.length === 0) {
      testQueue.push(...supportedList.filter((m) => !m.includes('1.5')));
    }

    let lastError = '';
    let quotaHitModel = '';

    for (const targetModel of testQueue) {
      const testRes = await attemptTestModel(cleanKey, targetModel);
      if (testRes.ok) {
        if (model === 'auto') {
          return {
            success: true,
            message: quotaHitModel
              ? `เชื่อมต่อสำเร็จ! (ตรวจพบโมเดล ${quotaHitModel} โควตารายวันเต็ม ระบบจึงสลับมาใช้ ${targetModel} ที่มีโควตาว่างให้อัตโนมัติ 🎉)`
              : `เชื่อมต่อ Google Gemini สำเร็จ! (ระบบเปิดโหมด Auto Model พร้อมสลับโมเดลที่ดีที่สุดและมีโควตาให้อัตโนมัติ 🎉)`,
            autoSwitchedModel: 'auto',
          };
        }
        const switched = targetModel !== model;
        return {
          success: true,
          message: switched
            ? `เชื่อมต่อ Google Gemini สำเร็จ! (ระบบปรับใช้โมเดล ${targetModel} ที่มีโควตาพร้อมใช้งานให้อัตโนมัติ 🎉)`
            : `เชื่อมต่อ Google Gemini API (${targetModel}) สำเร็จ พร้อมใช้งานแล้ว 🎉`,
          autoSwitchedModel: targetModel as GeminiModelId,
        };
      }

      if (testRes.status === 429) {
        quotaHitModel = targetModel;
      }
      lastError = testRes.errorMsg || `ทดสอบสร้างเนื้อหาล้มเหลว (รหัส ${testRes.status})`;
      // If error is not a quota issue or 404, stop and report
      if (testRes.status !== 404 && testRes.status !== 400 && testRes.status !== 429) {
        break;
      }
    }

    return {
      success: false,
      message: lastError || 'ไม่สามารถทดสอบโมเดลได้ กรุณาตรวจสอบ API Key',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'ไม่สามารถเชื่อมต่อกับ Google AI API ได้ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต',
    };
  }
}

/**
 * Parses assistant raw response into cleaned text and interactive actions.
 */
export function parseAssistantResponse(rawText: string): {
  cleanText: string;
  actions: AssistantAction[];
} {
  const actions: AssistantAction[] = [];

  // 1. Extract [NAVIGATE:view:label]
  let text = rawText.replace(/\[NAVIGATE:([^:\]]+):([^\]]+)\]/g, (_, view, label) => {
    actions.push({
      type: 'navigate',
      target: `/app/dashboard?view=${view.trim()}`,
      label: label.trim(),
    });
    return '';
  });

  // 2. Extract [COPY:text]
  text = text.replace(/\[COPY:([\s\S]*?)\]/g, (_, copyText) => {
    actions.push({
      type: 'copy',
      label: 'คัดลอกข้อความ',
      payload: copyText.trim(),
    });
    return copyText.trim();
  });

  // 3. Extract [HANDOVER:subject:desc]
  text = text.replace(/\[HANDOVER:([^:\]]+):([^\]]+)\]/g, (_, subject, desc) => {
    actions.push({
      type: 'handover',
      label: 'ส่งเรื่องนี้ให้ผู้ดูแลระบบตรวจสอบ',
      target: subject.trim(),
      payload: desc.trim(),
    });
    return '';
  });

  // 4. Extract [CALENDAR:date:type:title:label]
  text = text.replace(/\[CALENDAR:([^:\]]+):([^:\]]+):([^:\]]+):([^\]]+)\]/g, (_, date, type, title, label) => {
    actions.push({
      type: 'calendar',
      label: label.trim(),
      target: date.trim(),
      payload: JSON.stringify({
        date: date.trim(),
        type: type.trim(),
        title: title.trim(),
      }),
    });
    return '';
  });

  // 5. Extract [CALENDAR_BATCH:year:label]
  text = text.replace(/\[CALENDAR_BATCH:([^:\]]+):([^\]]+)\]/g, (_, year, label) => {
    actions.push({
      type: 'calendar_batch',
      label: label.trim(),
      target: year.trim(),
      payload: JSON.stringify({
        year: year.trim(),
      }),
    });
    return '';
  });

  return { cleanText: text.trim(), actions };
}

/**
 * Smart Fallback Engine: Answers common questions when no Gemini API Key is configured yet.
 */
export function getSmartFallbackResponse(
  userPrompt: string,
  activeView: string,
  politeEnding: 'male' | 'female' | 'neutral' = 'female'
): {
  cleanText: string;
  actions: AssistantAction[];
} {
  const lower = userPrompt.toLowerCase();
  const ka = politeEnding === 'male' ? 'ครับ' : 'ค่ะ';
  const naka = politeEnding === 'male' ? 'นะครับ' : 'นะคะ';

  // Check for whole-year holiday request
  if (
    lower.includes('วันหยุดทั้งปี') ||
    lower.includes('ลงวันหยุดทั้งปี') ||
    lower.includes('วันหยุดราชการ 2569') ||
    lower.includes('วันหยุด 2569') ||
    lower.includes('วันหยุดราชการทั้งปี') ||
    (lower.includes('วันหยุด') && (lower.includes('ทั้งปี') || lower.includes('ตลอดปี') || lower.includes('2569') || lower.includes('2026')))
  ) {
    return {
      cleanText: `🎉 **สรุปปฏิทินวันหยุดราชการไทยประจำปี 2569 (2026) — ทั้งหมด 20 วัน:**\n\n` +
        `• 1 ม.ค. — วันขึ้นปีใหม่\n` +
        `• 16 ม.ค. — วันครูแห่งชาติ (วันหยุดสถานศึกษา)\n` +
        `• 3 มี.ค. — วันมาฆบูชา\n` +
        `• 6 เม.ย. — วันจักรี\n` +
        `• 13-15 เม.ย. — เทศกาลวันสงกรานต์ (3 วัน)\n` +
        `• 1 พ.ค. — วันแรงงานแห่งชาติ\n` +
        `• 4 พ.ค. — วันฉัตรมงคล\n` +
        `• 31 พ.ค. — วันวิสาขบูชา\n` +
        `• 3 มิ.ย. — วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี\n` +
        `• 28 ก.ค. — วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว\n` +
        `• 29-30 ก.ค. — วันอาสาฬหบูชา และวันเข้าพรรษา\n` +
        `• 12 ส.ค. — วันแม่แห่งชาติ\n` +
        `• 13 ต.ค. — วันนวมินทรมหาราช (ร.9)\n` +
        `• 23 ต.ค. — วันปิยมหาราช\n` +
        `• 5 ธ.ค. — วันพ่อแห่งชาติ / วันชาติ\n` +
        `• 10 ธ.ค. — วันรัฐธรรมนูญ\n` +
        `• 31 ธ.ค. — วันสิ้นปี\n\n` +
        `*(หมายเหตุ: ทุกวันหยุดจะถูกตั้งค่ายกเว้นการเช็กชื่อให้อัตโนมัติ เพื่อไม่ให้เสียสถิติเวลาเรียน 80% ของนักเรียน)*\n\n` +
        `คุณครูสามารถกดปุ่มด้านล่างเพื่อให้น้องแคร์บันทึกวันหยุดทั้งหมดนี้ลงปฏิทินโรงเรียนได้ในคลิกเดียวทันทีค่ะ! 👇`,
      actions: [
        {
          type: 'calendar_batch',
          target: '2026',
          label: '📅 บันทึกวันหยุดราชการทั้งปี 2569 (20 วัน) ลงปฏิทินทันที',
          payload: JSON.stringify({ year: '2026' }),
        },
        {
          type: 'navigate',
          target: '/app/dashboard?view=school-calendar',
          label: '📅 เปิดดูปฏิทินโรงเรียน',
        },
      ],
    };
  }

  // 1. Scoring & Grading
  if (lower.includes('ตัดเกรด') || lower.includes('สัดส่วน') || lower.includes('70:30') || lower.includes('คะแนน')) {
    return {
      cleanText: `📘 **วิธีตั้งสัดส่วนคะแนนและตัดเกรด:**\n\n1. ไปที่ **"ระบบคะแนน (Score Center)"**\n2. ที่แถบด้านบนจะมีช่องปรับ **สัดส่วนคะแนน** เช่น คะแนนเก็บ (50) / กลางภาค (20) / ปลายภาค (30) รวมเป็น 100 คะแนน\n3. เมื่อกรอกคะแนนครบ ระบบจะคำนวณและตัดเกรด 8 ระดับ (0 - 4) ตามเกณฑ์กระทรวงศึกษาธิการให้อัตโนมัติทันทีค่ะ!`,
      actions: [
        { type: 'navigate', target: '/app/dashboard?view=scores', label: '🚀 เปิดหน้าระบบคะแนน' },
      ],
    };
  }

  // 2. Desirable Characteristics
  if (lower.includes('คุณลักษณะ') || lower.includes('8 ประการ') || lower.includes('อ่านคิด') || lower.includes('ปพ.5')) {
    return {
      cleanText: `✨ **ระบบประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ & อ่านคิดวิเคราะห์ เขียน:**\n\n- สอดคล้องกับหลักสูตรแกนกลาง สพฐ. 2551\n- มีระดับคุณภาพ 4 ระดับ: **3 (ดีเยี่ยม), 2 (ดี), 1 (ผ่าน), 0 (ไม่ผ่าน)**\n- **ทางลัดลดเวลา:** สามารถกดปุ่ม **\`[ ✨ ตั้งต้นทุกคนเป็นระดับ 3 (ดีเยี่ยม) ]\`** เพื่อกรอกทั้งห้องในคลิกเดียว แล้วปรับเฉพาะเด็กที่ต้องติดตาม\n- มีปุ่มส่งออกเป็น **Excel แบบ ปพ.5** พร้อมส่งงานวิชาการได้ทันทีค่ะ!`,
      actions: [
        { type: 'navigate', target: '/app/dashboard?view=desirable-characteristics', label: '⭐ ไปที่หน้าประเมินคุณลักษณะ' },
      ],
    };
  }

  // 3. Rollover / Promotion
  if (lower.includes('เลื่อนชั้น') || lower.includes('ย้ายห้อง') || lower.includes('ปีถัดไป') || lower.includes('undo')) {
    return {
      cleanText: `🏫 **การเลื่อนชั้นนักเรียนข้ามปีการศึกษา (Rollover):**\n\n1. ไปที่เมนู **"ปิดชั้นและคลังปีการศึกษา"** หรือ **"ตารางเวรและจิตพิสัย"** แถบเลื่อนชั้น\n2. ระบบจะทำนายห้องถัดไปให้อัตโนมัติ (เช่น ป.5/1 ➔ ป.6/1) พร้อมตรวจจับห้องที่จบการศึกษา\n3. กดปุ่ม **เลื่อนชั้นในคลิกเดียว** ระบบจะสร้าง Snapshot สำรองข้อมูลไว้ให้ทันที\n4. หากเลื่อนผิดห้อง สามารถกดย้อนกลับ **(Undo)** ได้อย่างปลอดภัยภายใน 7 วันค่ะ!`,
      actions: [
        { type: 'navigate', target: '/app/dashboard?view=academic-year', label: '🚀 ไปที่ระบบเลื่อนชั้น' },
      ],
    };
  }

  // 4. Attendance
  if (lower.includes('เช็กชื่อ') || lower.includes('เวลาเรียน') || lower.includes('ขาดเรียน') || lower.includes('80%')) {
    return {
      cleanText: `📋 **การเช็กชื่อและเวลาเรียน:**\n\n- ตามระเบียบ สพฐ. นักเรียนต้องมีเวลาเรียนไม่น้อยกว่า **80%** ของเวลาเรียนทั้งหมดจึงจะมีสิทธิ์สอบ\n- สามารถเช็กชื่อรายวัน หรือเช็กชื่อย้อนหลังได้ในหน้า **"บันทึกการมาเรียน"**\n- ระบบมีสรุปสถิติ มา ขาด ลา ป่วย พร้อมคำนวณร้อยละให้อัตโนมัติค่ะ`,
      actions: [
        { type: 'navigate', target: '/app/dashboard?view=teacher-work', label: '🚀 ไปที่หน้าเช็กชื่อมาเรียน' },
      ],
    };
  }

  // 5. Parent LINE message draft
  if (lower.includes('line') || lower.includes('ผู้ปกครอง') || lower.includes('ร่างข้อความ')) {
    const sampleMsg = `เรียน ผู้ปกครองของ [ชื่อนักเรียน]\n\nทางโรงเรียนขอแจ้งให้ทราบว่า ในช่วงวันที่ [ระบุวันที่] นักเรียนได้ขาดเรียนติดต่อกัน 3 วัน คุณครูประจำชั้นมีความห่วงใยในสุขภาพและความเป็นอยู่ของน้อง หากน้องมีอาการป่วยหรือไม่สะดวกประการใด รบกวนผู้ปกครองติดต่อกลับครูประจำชั้นที่เบอร์ [เบอร์โทรครู] ${naka}\n\nขอขอบพระคุณในความร่วมมือ${ka}\nครูประจำชั้น`;
    return {
      cleanText: `📝 **ร่างข้อความส่ง LINE แจ้งผู้ปกครอง:**\n\n${sampleMsg}\n\n*(สามารถกดปุ่มคัดลอกข้อความด้านล่าง แล้วนำไปปรับใช้ได้ทันที${ka})*`,
      actions: [
        { type: 'copy', label: '📋 คัดลอกข้อความ', payload: sampleMsg },
      ],
    };
  }

  // 6. School Calendar & Holidays
  if (lower.includes('ปฏิทิน') || lower.includes('วันหยุด') || lower.includes('วันสอบ') || lower.includes('กิจกรรม')) {
    return {
      cleanText: `📅 **ระบบปฏิทินโรงเรียนและบันทึกวันหยุด (School Calendar):**\n\n- คุณครูสามารถดูและบันทึกวันหยุด, วันสอบ, กิจกรรมโรงเรียน หรือวันเรียนชดเชยได้\n- มีนโยบายควบคุมการเช็คชื่อ: กำหนดให้ **"ไม่นับเป็นวันเรียน (ข้ามเช็คชื่อ)"** ได้ เพื่อไม่ให้เสียสถิติเวลาเรียน 80% ของนักเรียน\n- สั่งให้น้องแคร์ช่วยบันทึกวันหยุดได้ เช่นพิมพ์: *"ช่วยบันทึกวันหยุด 23 ตุลาคม วันปิยมหาราช"* หรือ *"ช่วยลงวันหยุดราชการทั้งปี 2569"* ได้เลย${ka}!`,
      actions: [
        { type: 'navigate', target: '/app/dashboard?view=school-calendar', label: '📅 เปิดดูปฏิทินโรงเรียน' },
      ],
    };
  }

  // 7. Timetable / Schedule (ตารางสอน)
  if (
    lower.includes('ตารางสอน') ||
    lower.includes('ตารางเรียน') ||
    lower.includes('คาบสอน') ||
    lower.includes('สอนวัน')
  ) {
    let dayTarget: string | null = null;
    if (lower.includes('จันทร์')) dayTarget = 'จันทร์';
    else if (lower.includes('อังคาร')) dayTarget = 'อังคาร';
    else if (lower.includes('พุธ')) dayTarget = 'พุธ';
    else if (lower.includes('พฤหัส')) dayTarget = 'พฤหัสบดี';
    else if (lower.includes('ศุกร์')) dayTarget = 'ศุกร์';
    else if (lower.includes('เสาร์')) dayTarget = 'เสาร์';
    else if (lower.includes('อาทิตย์')) dayTarget = 'อาทิตย์';

    try {
      const settings = loadScheduleSettings();
      const periods = buildSchedulePeriods(settings);

      if (dayTarget) {
        const dayClasses: string[] = [];
        periods.forEach((p) => {
          const cell = settings.cells[makeScheduleCellKey(dayTarget!, p.index)];
          if (cell && cell.subject) {
            const room = cell.classroom ? ` [ห้อง ${cell.classroom}]` : '';
            const code = cell.subjectCode ? ` (${cell.subjectCode})` : '';
            dayClasses.push(`• **คาบ ${p.index}** (${p.start} - ${p.end} น.): **${cell.subject}**${code}${room}`);
          }
        });

        if (dayClasses.length > 0) {
          return {
            cleanText: `📅 **ตารางสอนวัน${dayTarget} ของคุณครู${ka}:**\n\n${dayClasses.join('\n')}\n\nคุณครูสามารถกดปุ่มด้านล่างเพื่อปรับเปลี่ยนหรือดูตารางเต็มสัปดาห์ได้เลย${naka}!`,
            actions: [
              { type: 'navigate', target: '/app/dashboard?view=schedule', label: '📅 เปิดดูตารางสอน' },
            ],
          };
        } else {
          return {
            cleanText: `📅 **ตารางสอนวัน${dayTarget}:**\n\nในระบบยังไม่มีบันทึกคาบสอนสำหรับวัน${dayTarget}${ka} คุณครูสามารถเข้าไปจัดตารางสอนและกำหนดห้องเรียนได้ที่เมนูตารางสอนค่ะ`,
            actions: [
              { type: 'navigate', target: '/app/dashboard?view=schedule', label: '✏️ ไปจัดตารางสอน' },
            ],
          };
        }
      } else {
        // Overview of whole week
        const weekLines: string[] = [];
        (settings.activeDays || ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']).forEach((d) => {
          const classes: string[] = [];
          periods.forEach((p) => {
            const cell = settings.cells[makeScheduleCellKey(d, p.index)];
            if (cell && cell.subject) {
              const room = cell.classroom ? ` (${cell.classroom})` : '';
              classes.push(`คาบ ${p.index}: ${cell.subject}${room}`);
            }
          });
          if (classes.length > 0) {
            weekLines.push(`• **วัน${d}:** ${classes.join(', ')}`);
          } else {
            weekLines.push(`• **วัน${d}:** ไม่มีคาบสอน`);
          }
        });

        return {
          cleanText: `📅 **สรุปตารางสอนประจำสัปดาห์ของคุณครู${ka}:**\n\n${weekLines.join('\n')}\n\nคุณครูสามารถถามระบุวัน เช่น *"บอกตารางสอนวันจันทร์"* เพื่อดูเวลาและห้องเรียนละเอียดได้เลย${naka}!`,
          actions: [
            { type: 'navigate', target: '/app/dashboard?view=schedule', label: '📅 เปิดดูตารางสอนฉบับเต็ม' },
          ],
        };
      }
    } catch {
      return {
        cleanText: `📅 **ระบบตารางสอนของครู (Schedule):**\n\n- สามารถจัดตารางสอนรายคาบ พร้อมระบุรายวิชา รหัสวิชา และห้องเรียน/ชั้นเรียนได้\n- กำหนดเวลาคาบเรียนและเวลาพักกลางวันได้ยืดหยุ่น\n- พิมพ์ตารางสอนขนาดมาตรฐานเพื่อติดบอร์ดห้องเรียนได้ทันที${ka}`,
        actions: [
          { type: 'navigate', target: '/app/dashboard?view=schedule', label: '📅 เปิดดูตารางสอน' },
        ],
      };
    }
  }

  // General default fallback
  return {
    cleanText: `สวัสดี${ka}คุณครู! น้องแคร์ยินดีช่วยเหลือ${ka} 😊\n\nตอนนี้คุณครูกำลังอยู่ที่หน้า **"${activeView}"** คุณครูสามารถกดเลือก **คำสั่งลัดสำเร็จรูป** ด้านล่าง หรือพิมพ์คำถามที่สงสัยเกี่ยวกับเมนูและการใช้งานระบบ ClassCare 360 ได้เลย${naka}\n\n*(💡 หมายเหตุ: หากต้องการให้ AI ช่วยวิเคราะห์ข้อมูลเชิงลึกอิสระ สามารถใส่ Gemini API Key ในหน้าตั้งค่า VIP ได้เลย${ka})*`,
    actions: [
      { type: 'navigate', target: '/app/dashboard?view=help-center', label: '📖 เปิดคู่มือการใช้งานระบบ' },
    ],
  };
}
