export type GeminiModelId =
  | 'gemini-2.0-flash'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-2.0-flash-lite';

export interface GeminiModelOption {
  id: GeminiModelId;
  name: string;
  tag: string;
  description: string;
  speed: string;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    tag: 'แนะนำที่สุด ⭐',
    description: 'เร็วมาก ฉลาดรอบด้าน เหมาะที่สุดสำหรับแชทบอทตอบคำถามและสรุปข้อมูล',
    speed: '⚡⚡⚡ เร็วมาก',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    tag: 'เสถียร มาตรฐาน',
    description: 'โมเดลยอดนิยม ตอบไว แม่นยำ ประหยัดโควต้า',
    speed: '⚡⚡⚡ เร็ว',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    tag: 'คิดลึกที่สุด 🧠',
    description: 'วิเคราะห์ข้อมูลซับซ้อน ร่างรายงานวิชาการ และอ่านข้อมูลขนาดยาว',
    speed: '⚡ ปานกลาง',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    tag: 'ประหยัดสุดขีด ⚡',
    description: 'กินทรัพยากรน้อย เหมาะกับการประมวลผลสั้นๆ รวดเร็ว',
    speed: '⚡⚡⚡⚡ เร็วสุด',
  },
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: Array<{
    type: 'navigate' | 'copy' | 'handover';
    target?: string;
    label: string;
    payload?: string;
  }>;
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
`.trim();

/**
 * Call Google Gemini REST API directly with the provided API key.
 */
export async function callGeminiApi(
  apiKey: string,
  model: GeminiModelId,
  messages: ChatMessage[],
  contextInfo?: { activeView?: string; classroomName?: string; academicYear?: string }
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build context prefix
  const contextNote = contextInfo?.activeView
    ? `[บริบทปัจจุบัน: คุณครูกำลังเปิดหน้า '${contextInfo.activeView}' ห้องเรียน: '${contextInfo.classroomName || 'ไม่ได้เลือก'}' ปีการศึกษา: '${contextInfo.academicYear || '2569'}']\n\n`
    : '';

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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

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
 * Test if a Gemini API Key is valid and can generate content.
 */
export async function testGeminiApiKey(apiKey: string, model: GeminiModelId = 'gemini-2.0-flash'): Promise<{ success: boolean; message: string }> {
  if (!apiKey || apiKey.trim().length < 20) {
    return { success: false, message: 'กรุณากรอก API Key ที่ถูกต้อง' };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'สวัสดี ตอบสั้นๆ คำเดียวว่า "พร้อมใช้งาน"' }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return {
        success: false,
        message: err.error?.message || `การทดสอบล้มเหลว (รหัส ${response.status}) ตรวจสอบ API Key อีกครั้ง`,
      };
    }

    return {
      success: true,
      message: 'เชื่อมต่อ Google Gemini API สำเร็จ! พร้อมใช้งานแล้ว 🎉',
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
  actions: Array<{ type: 'navigate' | 'copy' | 'handover'; target?: string; label: string; payload?: string }>;
} {
  const actions: Array<{ type: 'navigate' | 'copy' | 'handover'; target?: string; label: string; payload?: string }> = [];

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

  return { cleanText: text.trim(), actions };
}

/**
 * Smart Fallback Engine: Answers common questions when no Gemini API Key is configured yet.
 */
export function getSmartFallbackResponse(userPrompt: string, activeView: string): {
  cleanText: string;
  actions: Array<{ type: 'navigate' | 'copy' | 'handover'; target?: string; label: string; payload?: string }>;
} {
  const lower = userPrompt.toLowerCase();

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

  // General default fallback
  return {
    cleanText: `สวัสดีค่ะคุณครู! น้องแคร์ยินดีช่วยเหลือค่ะ 😊\n\nตอนนี้คุณครูกำลังอยู่ที่หน้า **"${activeView}"** คุณครูสามารถกดเลือก **คำสั่งลัดสำเร็จรูป** ด้านล่าง หรือพิมพ์คำถามที่สงสัยเกี่ยวกับเมนูและการใช้งานระบบ ClassCare 360 ได้เลยนะคะ\n\n*(💡 หมายเหตุ: หากต้องการให้ AI ช่วยวิเคราะห์ข้อมูลเชิงลึกอิสระ สามารถใส่ Gemini API Key ในหน้าตั้งค่า VIP ได้เลยค่ะ)*`,
    actions: [
      { type: 'navigate', target: '/app/dashboard?view=help-center', label: '📖 เปิดคู่มือการใช้งานระบบ' },
    ],
  };
}
