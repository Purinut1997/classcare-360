export type GeminiModelId =
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-2.5-flash';

export interface GeminiModelOption {
  id: GeminiModelId;
  name: string;
  tag: string;
  description: string;
  speed: string;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    tag: 'แนะนำที่สุด ⭐ (เสถียร)',
    description: 'โมเดลยอดนิยม ตอบไว แม่นยำ รองรับทุก API Key ฟรีจาก Google AI Studio',
    speed: '⚡⚡⚡ เร็วมาก',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    tag: 'คิดลึกที่สุด 🧠',
    description: 'วิเคราะห์ข้อมูลซับซ้อน ร่างรายงานวิชาการ และอ่านข้อมูลขนาดยาว',
    speed: '⚡ ปานกลาง',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tag: 'รุ่นความเร็วสูง',
    description: 'ความเร็วสูงพิเศษ (ใช้กับโปรเจกต์ที่เปิดรับ)',
    speed: '⚡⚡⚡⚡ เร็วมาก',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tag: 'รุ่นใหม่ล่าสุด ✨',
    description: 'โมเดลเจเนอเรชันใหม่ล่าสุด ปรับแต่งภาษาไทยได้ยอดเยี่ยม',
    speed: '⚡⚡⚡ เร็ว',
  },
];

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
  }
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build context prefix
  const contextNote = contextInfo?.liveSchoolContext
    ? `${contextInfo.liveSchoolContext}\n\n`
    : (contextInfo?.activeView
        ? `[บริบทปัจจุบัน: คุณครูกำลังเปิดหน้า '${contextInfo.activeView}' ห้องเรียน: '${contextInfo.classroomName || 'ไม่ได้เลือก'}' ปีการศึกษา: '${contextInfo.academicYear || '2569'}']\n\n`
        : '');

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
      parts: [{ text: SYSTEM_INSTRUCTION }],
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

  // Auto-fallback if the selected model returns 404
  if (response.status === 404) {
    const supportedList = await listAvailableGeminiModels(apiKey);
    const fallbackModel = supportedList.find((m) => m.includes('flash')) || supportedList[0];
    if (fallbackModel && fallbackModel !== model) {
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`;
      response = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Gemini API Error: ${errMsg}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('ไม่ได้รับคำตอบจาก Gemini โมเดล');
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
  model: GeminiModelId = 'gemini-1.5-flash'
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

    // 2. Determine target model
    let targetModel =
      supportedList.find((m) => m === model) ||
      supportedList.find((m) => m.includes('flash')) ||
      supportedList[0];

    // 3. Test generateContent with targetModel
    const testRes = await attemptTestModel(cleanKey, targetModel);
    if (testRes.ok) {
      const switched = targetModel !== model;
      return {
        success: true,
        message: switched
          ? `เชื่อมต่อ Google Gemini สำเร็จ! (ระบบจับคู่โมเดล ${targetModel} ที่พร้อมใช้งานในบัญชีของคุณให้อัตโนมัติ 🎉)`
          : `เชื่อมต่อ Google Gemini API (${targetModel}) สำเร็จ พร้อมใช้งานแล้ว 🎉`,
        autoSwitchedModel: targetModel as GeminiModelId,
      };
    }

    return {
      success: false,
      message: testRes.errorMsg || `ทดสอบสร้างเนื้อหาล้มเหลว (รหัส ${testRes.status})`,
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
export function getSmartFallbackResponse(userPrompt: string, activeView: string): {
  cleanText: string;
  actions: AssistantAction[];
} {
  const lower = userPrompt.toLowerCase();

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
    const sampleMsg = `เรียน ผู้ปกครองของ [ชื่อนักเรียน]\n\nทางโรงเรียนขอแจ้งให้ทราบว่า ในช่วงวันที่ [ระบุวันที่] นักเรียนได้ขาดเรียนติดต่อกัน 3 วัน คุณครูประจำชั้นมีความห่วงใยในสุขภาพและความเป็นอยู่ของน้อง หากน้องมีอาการป่วยหรือไม่สะดวกประการใด รบกวนผู้ปกครองติดต่อกลับครูประจำชั้นที่เบอร์ [เบอร์โทรครู] นะคะ\n\nขอขอบพระคุณในความร่วมมือค่ะ\nครูประจำชั้น`;
    return {
      cleanText: `📝 **ร่างข้อความส่ง LINE แจ้งผู้ปกครอง:**\n\n${sampleMsg}\n\n*(สามารถกดปุ่มคัดลอกข้อความด้านล่าง แล้วนำไปปรับใช้ได้ทันทีค่ะ)*`,
      actions: [
        { type: 'copy', label: '📋 คัดลอกข้อความ', payload: sampleMsg },
      ],
    };
  }

  // 6. School Calendar & Holidays
  if (lower.includes('ปฏิทิน') || lower.includes('วันหยุด') || lower.includes('วันสอบ') || lower.includes('กิจกรรม')) {
    return {
      cleanText: `📅 **ระบบปฏิทินโรงเรียนและบันทึกวันหยุด (School Calendar):**\n\n- คุณครูสามารถดูและบันทึกวันหยุด, วันสอบ, กิจกรรมโรงเรียน หรือวันเรียนชดเชยได้\n- มีนโยบายควบคุมการเช็คชื่อ: กำหนดให้ **"ไม่นับเป็นวันเรียน (ข้ามเช็คชื่อ)"** ได้ เพื่อไม่ให้เสียสถิติเวลาเรียน 80% ของนักเรียน\n- สั่งให้น้องแคร์ช่วยบันทึกวันหยุดได้ เช่นพิมพ์: *"ช่วยบันทึกวันหยุด 23 ตุลาคม วันปิยมหาราช"* หรือ *"ช่วยลงวันหยุดราชการทั้งปี 2569"* ได้เลยค่ะ!`,
      actions: [
        { type: 'navigate', target: '/app/dashboard?view=school-calendar', label: '📅 เปิดดูปฏิทินโรงเรียน' },
      ],
    };
  }

  // General default fallback
  return {
    cleanText: `สวัสดีค่ะคุณครู! น้องแคร์ยินดีช่วยเหลือค่ะ 😊\n\nตอนนี้คุณครูกำลังอยู่ที่หน้า **"${activeView}"** คุณครูสามารถกดเลือก **คำสั่งลัดสำเร็จรูป** ด้านล่าง หรือพิมพ์คำถามที่สงสัยเกี่ยวกับเมนูและการใช้งานระบบ ClassCare 360 ได้เลยนะคะ\n\n*(💡 หมายเหตุ: หากต้องการให้ AI ช่วยวิเคราะห์ข้อมูลเชิงลึกอิสระ สามารถใส่ Gemini API Key ในหน้าตั้งค่า VIP ได้เลยค่ะ)*`,
    actions: [
      { type: 'navigate', target: '/app/dashboard?view=help-center', label: '📖 เปิดคู่มือการใช้งานระบบ' },
    ],
  };
}
