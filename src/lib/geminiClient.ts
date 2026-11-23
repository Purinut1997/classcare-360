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
  tag: 'แนะนำสูงสุด',
  description: 'ระบบตรวจจับและสลับโมเดลให้อัตโนมัติ (Gemini 2.5 -> 2.0 -> 2.5 Pro) เพื่อให้ได้คำตอบที่ดีที่สุดและไม่สะดุด',
  speed: 'เร็วมาก · อัจฉริยะ',
  quota: 'สลับรุ่นสำรองอัตโนมัติ',
  highlight: true,
};

export const MANUAL_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tag: 'รุ่นหลักล่าสุด แนะนำ',
    description: 'โมเดลรุ่นหลักล่าสุดของ Google AI Studio ประมวลผลรวดเร็ว ฉลาด แม่นยำ',
    speed: 'เร็วมาก',
    quota: 'Google AI Studio',
    highlight: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    tag: 'เร็วและประหยัด',
    description: 'โมเดลประมวลผลด่วนพิเศษ สำหรับงานตอบคำถามไวและสร้างข้อสอบ',
    speed: 'เร็วที่สุด',
    quota: 'Google AI Studio',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tag: 'เสถียรภาพสูง',
    description: 'โมเดลตอบสนองเร็วพิเศษ เหมาะสำหรับงานสร้างข้อสอบ รูบริก และแชทบอท',
    speed: 'เร็วมาก',
    quota: 'Google AI Studio',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    tag: 'คิดวิเคราะห์ขั้นสูง',
    description: 'ความสามารถในการคิดวิเคราะห์เชิงลึกระดับสูง ร่างข้อสอบและรูบริกที่ซับซ้อน',
    speed: 'ปานกลาง',
    quota: 'สำหรับงานวิเคราะห์เชิงลึก',
  },
];

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  AUTO_MODEL_OPTION,
  ...MANUAL_GEMINI_MODELS,
];

/**
 * Returns prioritized candidate models for API execution (only valid production Gemini endpoints).
 */
export function getCandidateModels(preferredModel?: string): string[] {
  const legacyInvalidModels = new Set([
    'auto',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
  ]);
  const clean = preferredModel && !legacyInvalidModels.has(preferredModel) ? preferredModel : 'gemini-2.5-flash';

  return [
    clean,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
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
import { isSupabaseReady, supabase } from './supabaseClient';

async function tryInvokeGeminiProxy(payload: {
  mode: 'chat' | 'vision' | 'prompt';
  model?: GeminiModelId;
  apiKey?: string;
  systemInstruction?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  prompt?: string;
  imageBase64?: string;
  mimeType?: string;
  responseJson?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  allowFallback?: boolean;
}): Promise<string | null> {
  if (!isSupabaseReady || !supabase) return null;

  try {
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session?.access_token) return null;

    const { data, error } = await supabase.functions.invoke('ai-gemini-proxy', {
      body: payload,
    });

    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status;
      if (
        error.name === 'FunctionsFetchError' ||
        error.name === 'FunctionsRelayError' ||
        status === 404 ||
        status === 502 ||
        status === 503
      ) {
        return null;
      }
      throw new Error(`Gemini Proxy Error: ${error.message}`);
    }

    if (
      data &&
      typeof data === 'object' &&
      'text' in data &&
      typeof (data as { text?: unknown }).text === 'string'
    ) {
      return (data as { text: string }).text;
    }

    return null;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Gemini Proxy Error:')) {
      throw err;
    }
    return null;
  }
}

const SYSTEM_INSTRUCTION = `
คุณคือ "ClassCare AI" — ผู้ช่วยอัจฉริยะด้านบริหารจัดการห้องเรียนและงานวิชาการประจำระบบ "ClassCare 360" (มาตรฐาน สพฐ.)
หน้าที่และมาตรฐานการสื่อสารของคุณคือ:
1. ใช้ภาษาไทยระดับทางการหรือกึ่งทางการที่สุภาพ กระชับ ชัดเจน และเป็นมืออาชีพ (หลีกเลี่ยงการใช้ภาษาพูดเล่น หรือคำแทนตัวแบบเด็กเล่น)
2. กฎเหล็กด้านรูปแบบข้อความ (STRICT FORMATTING RULE — ห้ามละเมิด):
   - ห้ามใช้สัญลักษณ์ Markdown เช่น *, **, ***, _, __, #, ##, ###, ---, หรือ \` ในข้อความตอบกลับโดยเด็ดขาด
   - หากต้องการจัดหัวข้อหรือแบ่งประเด็น ให้ใช้การขึ้นบรรทัดใหม่ เลขลำดับ (1. 2. 3.) หรือเครื่องหมายขีดหัวข้อแบบเรียบร้อย (•) แทน
   - ห้ามใส่ข้อความหมายเหตุในวงเล็บเกี่ยวกับการทำงานภายในของระบบ เช่น (หมายเหตุ: ข้อความร่างลงท้ายด้วยภาษาสำหรับ...)
3. กฎเหล็กด้านสิทธิ์และขอบเขตการเข้าถึงข้อมูล (STRICT ACCESS CONTROL):
   - คุณต้องตอบคำถามโดยอ้างอิงเฉพาะข้อมูลที่ปรากฏในส่วน [สิทธิ์และขอบเขตการเข้าถึงข้อมูลของผู้ใช้งานปัจจุบัน] และ [ข้อมูลจริงจากฐานข้อมูลระบบ ClassCare 360 ตามสิทธิ์ของผู้ใช้งาน] เท่านั้น
   - หากผู้ใช้งานสอบถามข้อมูลของห้องเรียนที่ไม่ได้รับมอบหมาย หรือโมดูลที่อยู่นอกสิทธิ์ของบัญชีปัจจุบัน ให้แจ้งอย่างสุภาพว่าบัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนดังกล่าว และห้ามคาดเดาหรือสมมุติตัวเลขขึ้นเองโดยเด็ดขาด
   - ห้ามแต่งชื่อนักเรียน นามสกุล หรือสถิติขึ้นมาเองโดยเด็ดขาด
4. ให้คำแนะนำการใช้งานระบบ ClassCare 360 และระเบียบการวัดและประเมินผลของ สพฐ. 2551 (เกรด 8 ระดับ, คุณลักษณะอันพึงประสงค์ 8 ประการ, การอ่าน คิดวิเคราะห์ และเขียน, เกณฑ์เวลาเรียนร้อยละ 80)
5. ช่วยร่างหนังสือหรือข้อความแจ้งผู้ปกครอง (LINE / ประกาศโรงเรียน), ความคิดเห็นท้ายสมุดพก (ปพ.6), และแผนกิจกรรมห้องเรียนด้วยถ้อยคำสุภาพเป็นทางการพร้อมนำไปใช้งานได้ทันที
6. หากแนะนำให้ผู้ใช้ไปที่เมนูใดในระบบ ให้ใส่ปุ่มนำทางในรูปแบบ: [NAVIGATE:view_key:ข้อความปุ่ม] เช่น:
   - [NAVIGATE:scores:เปิดหน้าระบบคะแนน]
   - [NAVIGATE:desirable-characteristics:เปิดหน้าประเมินคุณลักษณะ]
   - [NAVIGATE:teacher-work:เปิดหน้าบันทึกเวลาเรียน]
   - [NAVIGATE:academic-year:เปิดหน้าปีการศึกษาและเลื่อนชั้น]
   - [NAVIGATE:school-calendar:เปิดปฏิทินโรงเรียน]
   - [NAVIGATE:schedule:เปิดตารางสอน]
   - [NAVIGATE:reports:เปิดศูนย์รายงาน ปพ.]
   - [NAVIGATE:parent-access:เปิดพอร์ทัลผู้ปกครอง]
7. หากเป็นข้อความร่างส่งผู้ปกครองหรือความคิดเห็นสมุดพก ให้ใส่แท็ก [COPY:ข้อความที่ต้องการให้คัดลอก] เพื่อให้ผู้ใช้คัดลอกได้ทันที (ข้อความใน COPY ต้องปลอดจากสัญลักษณ์ * และ Markdown ทั้งหมด)
8. หากเป็นปัญหาเชิงเทคนิคที่ต้องให้ผู้ดูแลระบบตรวจสอบ ให้ใส่ [HANDOVER:หัวข้อปัญหา:รายละเอียด]
9. เมื่อผู้ใช้ขอให้บันทึกวันหยุด วันสอบ หรือกิจกรรมลงปฏิทินโรงเรียน ให้สรุปรายละเอียดและสร้างปุ่ม [CALENDAR:YYYY-MM-DD:type:ชื่อวันหรือกิจกรรม:ข้อความบนปุ่ม] (type: holiday, exam, activity, makeup) หรือบันทึกวันหยุดราชการทั้งปีด้วย [CALENDAR_BATCH:2026:บันทึกวันหยุดราชการปี 2569 (20 วัน) ลงปฏิทิน]
10. เมื่อผู้ใช้สอบถามตารางสอน ให้อ้างอิงจาก [มิติที่ 6] ในบริบทอย่างเคร่งครัด หากยังไม่มีการบันทึก ให้แจ้งตามตรงพร้อมปุ่ม [NAVIGATE:schedule:เปิดตารางสอน]
`.trim();

/**
 * Removes all raw Markdown syntax (*, **, #, ---, backticks, etc.) so messages
 * always render as clean, formal, executive-grade Thai text with zero stray symbols.
 */
export function sanitizeAssistantText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    // Remove markdown horizontal rules (---, ***, ___)
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    // Remove markdown heading prefixes (#, ##, ###)
    .replace(/^\s*#{1,6}\s+/gm, '')
    // Convert leading markdown bullet "* " or "- " into clean "• "
    .replace(/^\s*[*]\s+/gm, '• ')
    .replace(/^\s*-\s+(?=\S)/gm, '• ')
    // Unwrap bold/italic/code wrappers cleanly
    .replace(/\*\*\*([\s\S]*?)\*\*\*/g, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    // Remove any stray remaining asterisks
    .replace(/\*/g, '')
    // Collapse 3+ blank lines to max 2 newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Call Google Gemini chat endpoint (via Supabase Edge Function proxy when signed in,
 * with seamless fallback to direct Gemini REST API + valid 2.5/2.0 model cascade).
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
      ? `\n\n[ข้อกำหนดคำลงท้าย]: ใช้ภาษาสุภาพระดับทางการ/กึ่งทางการสำหรับครูผู้ชาย ลงท้ายด้วย "ครับ" อย่างสม่ำเสมอทั้งในการตอบและในข้อความร่าง ห้ามใช้ "ค่ะ" หรือ "นะคะ"`
      : contextInfo?.politeEnding === 'female'
      ? `\n\n[ข้อกำหนดคำลงท้าย]: ใช้ภาษาสุภาพระดับทางการ/กึ่งทางการสำหรับครูผู้หญิง ลงท้ายด้วย "ค่ะ" อย่างสม่ำเสมอทั้งในการตอบและในข้อความร่าง ห้ามใช้ "ครับ"`
      : `\n\n[ข้อกำหนดคำลงท้าย]: ใช้ภาษาไทยระดับทางการที่เป็นกลาง เหมาะสำหรับเอกสารและประกาศสถานศึกษา โดยไม่จำเป็นต้องลงท้ายด้วย ครับ หรือ ค่ะ`;

  const windowedMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10) // Keep last 10 messages for context
    .map((m, idx, arr) => {
      const isLastUserMsg = idx === arr.length - 1 && m.role === 'user';
      return {
        role: m.role,
        content: isLastUserMsg ? contextNote + m.content : m.content,
      };
    });

  const proxiedText = await tryInvokeGeminiProxy({
    mode: 'chat',
    model,
    apiKey,
    systemInstruction: SYSTEM_INSTRUCTION + politeInstruction,
    messages: windowedMessages,
    allowFallback,
  });
  if (proxiedText !== null) {
    return proxiedText;
  }

  if (apiKey === 'SERVER_MANAGED_WORKSPACE_KEY' || apiKey.startsWith('••••')) {
    throw new Error('ไม่สามารถเชื่อมต่อบริการ AI Proxy ของโรงเรียนได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง');
  }

  // Map messages to Gemini API format
  const contents = windowedMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

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
      errMsg = `โมเดล ${initialModel} โควตาการใช้งานเต็มแล้ว (429 Quota Exceeded) แนะนำให้เปลี่ยนเป็น "Auto Model" หรือ "Gemini 2.5 Flash" หรือเปิดการสลับรุ่นสำรองอัตโนมัติ`;
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
 * Call Google Gemini Multimodal Vision API (via Edge Function proxy when authenticated,
 * with direct Gemini REST API fallback across Gemini 2.5 / 2.0 models).
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

  const proxiedVisionText = await tryInvokeGeminiProxy({
    mode: 'vision',
    model: options.model,
    apiKey: apiKey.trim(),
    prompt,
    imageBase64: cleanBase64,
    mimeType,
    systemInstruction,
    responseJson,
    maxOutputTokens,
  });
  if (proxiedVisionText !== null) {
    return proxiedVisionText;
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
 * Call Google Gemini API with a text prompt (via Edge Function proxy when authenticated,
 * with direct Gemini REST API fallback across Gemini 2.5 / 2.0 models).
 */
export async function callGeminiPrompt(options: GeminiPromptOptions): Promise<string> {
  const { apiKey, prompt, systemInstruction, responseJson, temperature = 0.4, maxOutputTokens } = options;
  if (!apiKey?.trim()) {
    throw new Error('กรุณาระบุ Gemini API Key ก่อนใช้งาน');
  }

  const proxiedPromptText = await tryInvokeGeminiProxy({
    mode: 'prompt',
    model: options.model,
    apiKey: apiKey.trim(),
    prompt,
    systemInstruction,
    responseJson,
    temperature,
    maxOutputTokens,
  });
  if (proxiedPromptText !== null) {
    return proxiedPromptText;
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
              ? `เชื่อมต่อสำเร็จ! (ตรวจพบโมเดล ${quotaHitModel} โควตารายวันเต็ม ระบบจึงสลับมาใช้ ${targetModel} ที่มีโควตาว่างให้อัตโนมัติ)`
              : `เชื่อมต่อ Google Gemini สำเร็จ! (ระบบเปิดโหมด Auto Model พร้อมสลับโมเดลที่ดีที่สุดและมีโควตาให้อัตโนมัติ)`,
            autoSwitchedModel: 'auto',
          };
        }
        const switched = targetModel !== model;
        return {
          success: true,
          message: switched
            ? `เชื่อมต่อ Google Gemini สำเร็จ! (ระบบปรับใช้โมเดล ${targetModel} ที่มีโควตาพร้อมใช้งานให้อัตโนมัติ)`
            : `เชื่อมต่อ Google Gemini API (${targetModel}) สำเร็จ พร้อมใช้งานแล้ว`,
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
    const cleanedCopy = sanitizeAssistantText(copyText);
    actions.push({
      type: 'copy',
      label: 'คัดลอกข้อความ',
      payload: cleanedCopy,
    });
    return cleanedCopy;
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

  return { cleanText: sanitizeAssistantText(text), actions };
}

/**
 * Smart Fallback Engine: Formal / semi-formal guided responses when Gemini API is not active.
 * Zero raw markdown asterisks; respects teacher polite ending & user access scope.
 */
export function getSmartFallbackResponse(
  userPrompt: string,
  activeView: string,
  politeEnding: 'male' | 'female' | 'neutral' = 'neutral',
  scopeContext?: {
    classroomName?: string;
    role?: string;
    schoolName?: string;
  }
): {
  cleanText: string;
  actions: AssistantAction[];
} {
  const lower = userPrompt.toLowerCase();
  const ending = politeEnding === 'male' ? 'ครับ' : politeEnding === 'female' ? 'ค่ะ' : '';
  const politeSuffix = ending ? ` ${ending}` : '';
  const schoolLabel = scopeContext?.schoolName || 'โรงเรียน';
  const roomLabel = scopeContext?.classroomName || 'ห้องเรียนที่รับผิดชอบ';
  const isViewerOnly = scopeContext?.role === 'viewer';

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
      cleanText:
        `สรุปปฏิทินวันหยุดราชการประจำปี 2569 (2026) จำนวน 20 วัน\n\n` +
        `• 1 ม.ค. — วันขึ้นปีใหม่\n` +
        `• 16 ม.ค. — วันครูแห่งชาติ\n` +
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
        `• 13 ต.ค. — วันนวมินทรมหาราช\n` +
        `• 23 ต.ค. — วันปิยมหาราช\n` +
        `• 5 ธ.ค. — วันพ่อแห่งชาติ และวันชาติ\n` +
        `• 10 ธ.ค. — วันรัฐธรรมนูญ\n` +
        `• 31 ธ.ค. — วันสิ้นปี\n\n` +
        `วันหยุดทุกรายการจะได้รับการตั้งค่ายกเว้นการเช็กชื่อโดยอัตโนมัติ เพื่อคงความถูกต้องของเกณฑ์เวลาเรียนร้อยละ 80${isViewerOnly ? '' : ` สามารถดำเนินการบันทึกได้จากปุ่มด้านล่าง${politeSuffix}`}`,
      actions: isViewerOnly
        ? [{ type: 'navigate', target: '/app/dashboard?view=reports', label: 'เปิดศูนย์รายงาน' }]
        : [
            {
              type: 'calendar_batch',
              target: '2026',
              label: 'บันทึกวันหยุดราชการปี 2569 (20 วัน) ลงปฏิทิน',
              payload: JSON.stringify({ year: '2026' }),
            },
            {
              type: 'navigate',
              target: '/app/dashboard?view=school-calendar',
              label: 'เปิดปฏิทินโรงเรียน',
            },
          ],
    };
  }

  // 1. Scoring & Grading
  if (lower.includes('ตัดเกรด') || lower.includes('สัดส่วน') || lower.includes('70:30') || lower.includes('คะแนน')) {
    return {
      cleanText:
        `แนวทางการกำหนดสัดส่วนคะแนนและการตัดเกรด\n\n` +
        `1. เข้าสู่เมนู ระบบคะแนน (Score Center)\n` +
        `2. กำหนดสัดส่วนคะแนนที่แถบด้านบน เช่น คะแนนเก็บ 50 กลางภาค 20 และปลายภาค 30 รวมเป็น 100 คะแนน\n` +
        `3. เมื่อบันทึกคะแนนครบถ้วน ระบบจะคำนวณผลการเรียน 8 ระดับ (0 ถึง 4) ตามเกณฑ์กระทรวงศึกษาธิการให้อัตโนมัติ${politeSuffix}`,
      actions: isViewerOnly
        ? [{ type: 'navigate', target: '/app/dashboard?view=reports', label: 'เปิดศูนย์รายงาน' }]
        : [{ type: 'navigate', target: '/app/dashboard?view=scores', label: 'เปิดหน้าระบบคะแนน' }],
    };
  }

  // 2. Desirable Characteristics
  if (lower.includes('คุณลักษณะ') || lower.includes('8 ประการ') || lower.includes('อ่านคิด') || lower.includes('ปพ.5')) {
    return {
      cleanText:
        `การประเมินคุณลักษณะอันพึงประสงค์ 8 ประการ และการอ่าน คิดวิเคราะห์ และเขียน\n\n` +
        `• สอดคล้องตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551\n` +
        `• แบ่งระดับคุณภาพเป็น 4 ระดับ ได้แก่ 3 (ดีเยี่ยม), 2 (ดี), 1 (ผ่าน), และ 0 (ไม่ผ่าน)\n` +
        `• สามารถกำหนดค่าตั้งต้นทั้งห้องเป็นระดับ 3 (ดีเยี่ยม) แล้วปรับแก้เฉพาะรายบุคคลเพื่อความรวดเร็ว\n` +
        `• รองรับการส่งออกเอกสาร Excel รูปแบบ ปพ.5 สำหรับนำส่งฝ่ายวิชาการได้ทันที${politeSuffix}`,
      actions: isViewerOnly
        ? [{ type: 'navigate', target: '/app/dashboard?view=reports', label: 'เปิดศูนย์รายงาน' }]
        : [{ type: 'navigate', target: '/app/dashboard?view=desirable-characteristics', label: 'เปิดหน้าประเมินคุณลักษณะ' }],
    };
  }

  // 3. Rollover / Promotion
  if (lower.includes('เลื่อนชั้น') || lower.includes('ย้ายห้อง') || lower.includes('ปีถัดไป') || lower.includes('undo')) {
    return {
      cleanText:
        `ขั้นตอนการเลื่อนชั้นนักเรียนข้ามปีการศึกษา\n\n` +
        `1. เข้าสู่เมนู ปีการศึกษา & ล็อกงวด ในหมวดตั้งค่าโรงเรียน\n` +
        `2. ตรวจสอบการจับคู่ห้องเรียนปลายทางและรายชื่อนักเรียน (เลื่อนชั้น, ซ้ำชั้น, จบการศึกษา, หรือย้ายสถานศึกษา)\n` +
        `3. กดยืนยันการเลื่อนชั้น ระบบจะสร้างชุดสำรองข้อมูล (Snapshot) ให้อัตโนมัติ\n` +
        `4. หากพบความคลาดเคลื่อน สามารถเรียกคืนสถานะเดิม (Undo) ได้ภายใน 7 วัน${politeSuffix}`,
      actions: isViewerOnly
        ? []
        : [{ type: 'navigate', target: '/app/dashboard?view=academic-year', label: 'เปิดหน้าปีการศึกษา & ล็อกงวด' }],
    };
  }

  // 4. Attendance
  if (lower.includes('เช็กชื่อ') || lower.includes('เวลาเรียน') || lower.includes('ขาดเรียน') || lower.includes('80%')) {
    return {
      cleanText:
        `การบันทึกเวลาเรียนและตรวจสอบเกณฑ์สิทธิ์สอบ\n\n` +
        `• ตามระเบียบ สพฐ. นักเรียนต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 ของเวลาเรียนทั้งหมดจึงจะมีสิทธิ์สอบ\n` +
        `• สามารถบันทึกเวลาเรียนรายวันหรือบันทึกย้อนหลังได้ที่เมนู เช็กชื่อเข้าแถว / คาบเรียน\n` +
        `• ระบบสรุปสถิติ มา ขาด สาย ลา และคำนวณร้อยละเวลาเรียนให้อัตโนมัติ${politeSuffix}`,
      actions: isViewerOnly
        ? [{ type: 'navigate', target: '/app/dashboard?view=reports', label: 'เปิดศูนย์รายงาน' }]
        : [{ type: 'navigate', target: '/app/dashboard?view=teacher-work', label: 'เปิดหน้าบันทึกเวลาเรียน' }],
    };
  }

  // 5. Parent LINE message draft
  if (lower.includes('line') || lower.includes('ผู้ปกครอง') || lower.includes('ร่างข้อความ')) {
    const closingLine =
      politeEnding === 'male'
        ? 'ขอขอบพระคุณในความร่วมมือเป็นอย่างสูงครับ'
        : politeEnding === 'female'
          ? 'ขอขอบพระคุณในความร่วมมือเป็นอย่างสูงค่ะ'
          : 'จึงเรียนมาเพื่อโปรดทราบ และขอขอบคุณในความร่วมมือมา ณ โอกาสนี้';
    const sampleMsg =
      `เรียน ท่านผู้ปกครองนักเรียนชั้น ${roomLabel}\n\n` +
      `ทาง${schoolLabel}และครูประจำชั้นขอแจ้งข้อมูลข่าวสารเกี่ยวกับการเรียนและกิจกรรมของนักเรียน ดังนี้\n\n` +
      `1. ด้านการเรียนและพัฒนาการ: [ระบุรายละเอียดการเรียนหรือภาระงาน]\n` +
      `2. ด้านกิจกรรมและกำหนดการสำคัญ: [ระบุวัน เวลา และรายละเอียดกิจกรรม]\n` +
      `3. ข้อเสนอแนะเพิ่มเติม: [ระบุข้อความที่ต้องการประสานความร่วมมือ]\n\n` +
      `หากท่านผู้ปกครองมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม สามารถติดต่อครูประจำชั้นได้โดยตรง\n\n` +
      `${closingLine}\nครูประจำชั้น ${roomLabel}\n${schoolLabel}`;
    return {
      cleanText: `ร่างข้อความแจ้งผู้ปกครองแบบเป็นทางการ พร้อมนำไปปรับแก้ไขและส่งต่อได้ทันที\n\n${sampleMsg}`,
      actions: [
        { type: 'copy', label: 'คัดลอกข้อความร่าง', payload: sampleMsg },
      ],
    };
  }

  // 6. School Calendar & Holidays
  if (lower.includes('ปฏิทิน') || lower.includes('วันหยุด') || lower.includes('วันสอบ') || lower.includes('กิจกรรม')) {
    return {
      cleanText:
        `การใช้งานปฏิทินโรงเรียนและวันหยุดราชการ\n\n` +
        `• บันทึกวันหยุดราชการ วันสอบ กิจกรรมสถานศึกษา และวันเรียนชดเชยได้ในจุดเดียว\n` +
        `• สามารถกำหนดวันหยุดให้ยกเว้นการเช็กชื่ออัตโนมัติ เพื่อไม่ให้กระทบสถิติเวลาเรียนร้อยละ 80\n` +
        `• สามารถพิมพ์คำสั่ง เช่น "ลงวันหยุดราชการทั้งปี 2569" เพื่อบันทึกวันหยุดประจำปีได้ทันที${politeSuffix}`,
      actions: isViewerOnly
        ? []
        : [{ type: 'navigate', target: '/app/dashboard?view=school-calendar', label: 'เปิดปฏิทินโรงเรียน' }],
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
            const room = cell.classroom ? ` (ห้อง ${cell.classroom})` : '';
            const code = cell.subjectCode ? ` รหัสวิชา ${cell.subjectCode}` : '';
            dayClasses.push(`• คาบที่ ${p.index} (${p.start} - ${p.end} น.): ${cell.subject}${code}${room}`);
          }
        });

        if (dayClasses.length > 0) {
          return {
            cleanText: `ตารางสอนวัน${dayTarget}\n\n${dayClasses.join('\n')}`,
            actions: isViewerOnly ? [] : [{ type: 'navigate', target: '/app/dashboard?view=schedule', label: 'เปิดตารางสอนฉบับเต็ม' }],
          };
        }
        return {
          cleanText: `ตารางสอนวัน${dayTarget}\n\nยังไม่มีบันทึกคาบสอนสำหรับวัน${dayTarget}ในระบบ สามารถเข้าไปกำหนดคาบเรียนได้ที่เมนูตารางสอน${politeSuffix}`,
          actions: isViewerOnly ? [] : [{ type: 'navigate', target: '/app/dashboard?view=schedule', label: 'ไปจัดตารางสอน' }],
        };
      }

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
        weekLines.push(classes.length > 0 ? `• วัน${d}: ${classes.join(', ')}` : `• วัน${d}: ไม่มีคาบสอน`);
      });

      return {
        cleanText: `สรุปตารางสอนประจำสัปดาห์\n\n${weekLines.join('\n')}`,
        actions: isViewerOnly ? [] : [{ type: 'navigate', target: '/app/dashboard?view=schedule', label: 'เปิดตารางสอนฉบับเต็ม' }],
      };
    } catch {
      return {
        cleanText:
          `ระบบตารางสอน (Schedule)\n\n` +
          `• จัดตารางสอนรายคาบพร้อมระบุรายวิชา รหัสวิชา และห้องเรียนได้ครบถ้วน\n` +
          `• กำหนดเวลาเรียน เวลาพัก และสั่งพิมพ์ตารางสอนมาตรฐานได้ทันที${politeSuffix}`,
        actions: isViewerOnly ? [] : [{ type: 'navigate', target: '/app/dashboard?view=schedule', label: 'เปิดตารางสอน' }],
      };
    }
  }

  // General default fallback
  return {
    cleanText:
      `ยินดีให้บริการ${politeSuffix}\n\n` +
      `ขณะนี้ท่านกำลังใช้งานหน้า "${activeView}" (${schoolLabel}) สามารถเลือกคำสั่งลัดด้านล่าง หรือพิมพ์สอบถามวิธีใช้งานระบบ การร่างข้อความแจ้งผู้ปกครอง และระเบียบการประเมินผล สพฐ. ได้ทันที\n\n` +
      `สำหรับการวิเคราะห์ข้อมูลเชิงลึกจากฐานข้อมูลตามสิทธิ์ของบัญชี สามารถเปิดใช้งานได้ในแพ็กเกจ VIP`,
    actions: [
      { type: 'navigate', target: '/app/dashboard?view=help-center', label: 'เปิดคู่มือการใช้งานระบบ' },
    ],
  };
}
