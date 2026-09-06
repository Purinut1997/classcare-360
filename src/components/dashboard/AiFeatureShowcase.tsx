import { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FileImage,
  GraduationCap,
  Layers,
  Lightbulb,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import { getEffectiveAiConfig } from '../../lib/aiSettings';
import type { AppSessionContext } from '../../types/core';

interface AiFeatureShowcaseProps {
  session: AppSessionContext;
}

type FeatureCategory = 'all' | 'ocr' | 'teaching' | 'assistant';

interface AiFeatureItem {
  id: string;
  category: 'ocr' | 'teaching' | 'assistant';
  badge: string;
  badgeTone: string;
  title: string;
  engTitle: string;
  painPoint: string;
  aiSolution: string;
  tags: string[];
  ctaLabel: string;
  targetPath: string;
  icon: typeof Sparkles;
  iconGradient: string;
  isNew?: boolean;
}

const AI_FEATURES: AiFeatureItem[] = [
  {
    id: 'timetable-ocr',
    category: 'ocr',
    badge: 'Smart OCR เอกสาร',
    badgeTone: 'bg-amber-100 text-amber-800 border-amber-200',
    title: 'ถ่ายรูปตารางสอน สู่ระบบอัตโนมัติ',
    engTitle: 'Smart Timetable OCR',
    painPoint: 'ครูต้องมานั่งคลิกหยอดตารางสอนทีละคาบ ทีละวัน กรอกรหัสวิชา ห้องเรียน เสียเวลาเป็นชั่วโมง และเสี่ยงพิมพ์สลับคาบ',
    aiSolution: 'ถ่ายรูปตารางสอนกระดาษประจำสัปดาห์ AI จะตรวจจับวัน, คาบเรียน, รหัสวิชา, ชื่อวิชา และห้องเรียน นำเข้าลงตารางทันทีใน 5 วินาที พร้อมปุ่มหมุนภาพ 90°',
    tags: ['สแกนภาพกระดาษ', 'นำเข้า 5 วิ', 'มีปุ่มหมุนภาพ 90°', 'แมปห้องเรียนอัตโนมัติ'],
    ctaLabel: 'ลองสแกนตารางสอน',
    targetPath: '/app/dashboard?view=schedule',
    icon: CalendarClock,
    iconGradient: 'from-amber-500 to-orange-500',
    isNew: true,
  },
  {
    id: 'attendance-ocr',
    category: 'ocr',
    badge: 'Smart OCR เอกสาร',
    badgeTone: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    title: 'สแกนใบเช็คชื่อแถว / สมุดจดเวลาเรียน',
    engTitle: 'Smart Attendance OCR',
    painPoint: 'จดเช็คชื่อในสมุดหรือกระดาษตอนเช้า แล้วต้องมานั่งคลิกติ๊กทีละคนในคอม วันละหลายคาบ เสี่ยงตาลาย',
    aiSolution: 'ถ่ายรูปกระดาษเช็คชื่อ AI จะเทียบเลขที่/ชื่อนักเรียนในห้อง ตรวจจับเครื่องหมาย ติ๊กถูก, ขาด (X), สาย, ลา, ป่วย แล้วบันทึกสถานะลงระบบทันที',
    tags: ['ลดเวลาเช็คชื่อ 90%', 'เทียบรายชื่อห้องเรียน', 'ตรวจลายมือเขียน', 'บันทึกอัตโนมัติ'],
    ctaLabel: 'ลองเช็คชื่อด้วย AI',
    targetPath: '/app/dashboard?view=teacher-work',
    icon: Camera,
    iconGradient: 'from-emerald-500 to-teal-500',
    isNew: true,
  },
  {
    id: 'score-ocr',
    category: 'ocr',
    badge: 'Smart OCR เอกสาร',
    badgeTone: 'bg-sky-100 text-sky-800 border-sky-200',
    title: 'สแกนใบคะแนนสอบ / สมุดจดคะแนนเก็บ',
    engTitle: 'Smart Score Sheet OCR',
    painPoint: 'ต้องนั่งหยอดคะแนนสอบนักเรียน 30-40 คนลงตารางทีละช่อง เสี่ยงกรอกผิดแถว หรือพิมพ์สลับคน',
    aiSolution: 'ถ่ายรูปใบคะแนนกระดาษ AI จะอ่านตัวเลขคะแนน แมปเข้ากับรหัสและชื่อนักเรียน แล้วหยอดลงตารางคะแนน ปพ.5 ให้ทันที พร้อมเตือนจุดที่ลายมือไม่ชัด',
    tags: ['หยอดคะแนนลงตาราง', 'แมปเลขที่แม่นยำ', 'ระบบเตือนความมั่นใจ', 'ประหยัดเวลา 85%'],
    ctaLabel: 'ลองสแกนคะแนนสอบ',
    targetPath: '/app/dashboard?view=scores&scoreView=excel',
    icon: ScanLine,
    iconGradient: 'from-sky-500 to-blue-600',
    isNew: true,
  },
  {
    id: 'rubric-generator',
    category: 'teaching',
    badge: 'ออกแบบการสอน สพฐ.',
    badgeTone: 'bg-violet-100 text-violet-800 border-violet-200',
    title: 'สร้างเกณฑ์รูบริก 4 ระดับตามตัวชี้วัด สพฐ.',
    engTitle: 'AI Rubric Criteria Generator',
    painPoint: 'การเขียนเกณฑ์รูบริก 4 ระดับ (ดีเยี่ยม, ดี, พอใช้, ปรับปรุง) ที่สอดคล้องกับตัวชี้วัด สพฐ. ใช้เวลาคิดและร่างเป็นวันๆ',
    aiSolution: 'เพียงระบุวิชา ระดับชั้น และตัวชี้วัด AI จะออกแบบเกณฑ์การประเมิน 4 ระดับที่วัดพฤติกรรมได้จริง สอดคล้องตามหลักสูตรแกนกลาง นำไปแนบ ปพ.5 ได้ทันที',
    tags: ['เกณฑ์ 4 ระดับ สพฐ.', 'ประเมินตามสภาพจริง', 'คัดลอกลง ปพ.5', 'สอดคล้องตัวชี้วัด'],
    ctaLabel: 'ลองสร้างเกณฑ์รูบริก',
    targetPath: '/app/dashboard?view=scores&scoreView=excel',
    icon: FileCheck2,
    iconGradient: 'from-violet-600 to-purple-600',
    isNew: true,
  },
  {
    id: 'remedial-quiz',
    category: 'teaching',
    badge: 'ออกแบบการสอน สพฐ.',
    badgeTone: 'bg-rose-100 text-rose-800 border-rose-200',
    title: 'สร้างข้อสอบซ่อมเสริมเฉพาะจุด พร้อมเฉลยละเอียด',
    engTitle: 'AI Remedial Quiz Generator',
    painPoint: 'เด็กสอบไม่ผ่านจุดไหน ครูต้องมานั่งคิดโจทย์ใหม่ ออกแบบตัวลวง 4 ข้อ และเขียนเฉลยอธิบาย ทำให้ไม่มีเวลาซ่อมเสริมเฉพาะจุด',
    aiSolution: 'ระบุหัวข้อที่เด็กทำผิดบ่อย กำหนดจำนวนข้อได้เอง (1-30 ข้อ) และเลือกรูปแบบตัวเลือกได้ (4 ช้อยส์, 3 ช้อยส์, 5 ช้อยส์, ถูก/ผิด) AI สร้างข้อสอบพร้อมเฉลยและวิเคราะห์จุดลวงทันที',
    tags: ['กำหนดจำนวนข้อได้เอง', 'เลือกช้อยส์ ก-ง/ถูกผิด', 'มีเฉลยละเอียด', 'ดักจุดที่ชอบผิด'],
    ctaLabel: 'ลองสร้างข้อสอบซ่อม',
    targetPath: '/app/dashboard?view=scores&scoreView=excel',
    icon: GraduationCap,
    iconGradient: 'from-rose-500 to-pink-600',
    isNew: true,
  },
  {
    id: 'semester-exam',
    category: 'teaching',
    badge: 'ออกข้อสอบมาตรฐาน สพฐ.',
    badgeTone: 'bg-blue-100 text-blue-800 border-blue-200',
    title: 'AI ออกแบบข้อสอบกลางภาค & ปลายภาค พร้อมผังวิเคราะห์ (Test Blueprint)',
    engTitle: 'AI Midterm & Final Exam Generator',
    painPoint: 'การออกข้อสอบกลางภาค/ปลายภาคต้องทำหัวกระดาษแบบฟอร์มโรงเรียน กระจายระดับพฤติกรรมบลูม (Bloom) คำนวณคะแนน ทำเฉลยละเอียด และทำตาราง Test Blueprint ส่งวิชาการ ใช้เวลาเป็นสัปดาห์',
    aiSolution: 'ระบุวิชา ระดับชั้น ตัวชี้วัด และเนื้อหา AI จัดชุดข้อสอบมาตรฐาน ปรนัย+อัตนัย พร้อมหัวกระดาษราชการ สพฐ. กล่องข้อมูลนักเรียน ตารางเฉลยละเอียด และตารางผังวิเคราะห์ข้อสอบ (Test Blueprint) ส่งฝ่ายวิชาการได้ทันที พร้อมพิมพ์แยกชุดนักเรียน/ชุดครู',
    tags: ['หัวกระดาษ สพฐ.', 'ปรนัย + อัตนัย', 'ผังวิเคราะห์ Blueprint', 'พิมพ์แยกชุดนักเรียน/ครู', 'ส่งฝ่ายวิชาการได้ทันที'],
    ctaLabel: 'ลองออกข้อสอบกลาง/ปลายภาค',
    targetPath: '/app/dashboard?view=scores&scoreView=excel',
    icon: BookOpen,
    iconGradient: 'from-blue-600 to-indigo-600',
    isNew: true,
  },
  {
    id: 'ai-assistant',
    category: 'assistant',
    badge: 'ผู้ช่วยคุณครู 24 ชม.',
    badgeTone: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    title: 'Gemini AI Assistant & คลังคำถามด่วน',
    engTitle: 'Smart Teaching Assistant',
    painPoint: 'ต้องการคำแนะนำการจัดการเรียนรู้, แนวทางการเขียน ปพ.6, หรือแก้ปัญหาการตั้งค่าระบบ แต่ไม่มีคนให้ปรึกษาทันที',
    aiSolution: 'ผู้ช่วย AI อัจฉริยะข้างกายครู พร้อมคลังคำถามด่วน (Prompt Library) ตอบคำถามการตัดเกรด 8 ระดับ, คำนวณสัดส่วน 70:30, และแนะนำขั้นตอนงานทะเบียนวัดผลตลอด 24 ชม.',
    tags: ['ตอบคำถามทันที', 'มีคลังคำถามด่วน', 'แนะนำงาน ปพ.', 'โควตาฟรี 1,500 ครั้ง/วัน'],
    ctaLabel: 'ตั้งค่าและปรึกษา AI',
    targetPath: '/app/dashboard?view=workspace-settings',
    icon: Bot,
    iconGradient: 'from-indigo-600 to-violet-600',
  },
];

export function AiFeatureShowcase({ session }: AiFeatureShowcaseProps) {
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('all');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('classcare_ai_showcase_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let isMounted = true;
    async function checkKey() {
      try {
        const config = await getEffectiveAiConfig(session);
        if (isMounted) setHasApiKey(Boolean(config.apiKey));
      } catch {
        if (isMounted) setHasApiKey(false);
      }
    }
    void checkKey();
    return () => {
      isMounted = false;
    };
  }, [session]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('classcare_ai_showcase_expanded', String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const filteredFeatures = AI_FEATURES.filter((f) => {
    if (activeCategory === 'all') return true;
    return f.category === activeCategory;
  });

  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/60 p-5 shadow-sm transition-all sm:p-6">
      {/* Decorative Glow Elements */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

      {/* Header Section */}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-500 text-white shadow-md ring-4 ring-violet-100">
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-100/80 px-2.5 py-0.5 text-[10px] font-black text-violet-800">
                <Zap size={11} className="text-amber-600" />
                จุดขายเด่นอันดับหนึ่ง (CLASSCARE 360 AI HUB)
              </span>
              {hasApiKey ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  Gemini API พร้อมใช้งาน (ฟรี 1,500 ครั้ง/วัน)
                </span>
              ) : (
                <Link
                  to="/app/dashboard?view=workspace-settings"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800 hover:bg-amber-100"
                >
                  <AlertCircle size={11} className="text-amber-600" />
                  กดตั้งค่า API Key เพื่อเปิดใช้งานฟรี →
                </Link>
              )}
            </div>
            <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
              ✨ รวมฟังก์ชัน AI อัจฉริยะ ช่วยงานครูไทยลดงานเอกสาร
            </h2>
            <p className="mt-0.5 text-xs font-bold text-slate-600">
              ถ่ายรูปกระดาษสู่ระบบใน 3 วินาที • ออกแบบรูบริก & ข้อสอบ สพฐ. อัตโนมัติ • ขับเคลื่อนด้วย Google Gemini Multimodal Vision
            </p>
          </div>
        </div>

        {/* Action button to collapse / expand */}
        <button
          type="button"
          onClick={toggleExpanded}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-xs font-black text-violet-800 shadow-xs hover:bg-violet-50 transition sm:self-center"
        >
          <span>{isExpanded ? 'ย่อหน้าต่าง' : `ดูฟังก์ชัน AI ทั้งหมด (${AI_FEATURES.length})`}</span>
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 pb-3">
            <span className="text-xs font-bold text-slate-500 mr-1">หมวดหมู่:</span>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeCategory === 'all'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              ทั้งหมด ({AI_FEATURES.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('ocr')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeCategory === 'ocr'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              📸 Smart OCR สแกนเอกสารกระดาษ (3)
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('teaching')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeCategory === 'teaching'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              📝 ออกแบบการสอน & ข้อสอบ สพฐ. (2)
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('assistant')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeCategory === 'assistant'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              💡 ผู้ช่วยครู & วิเคราะห์ข้อมูล (1)
            </button>
          </div>

          {/* Bento Grid Feature Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.id}
                  className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10"
                >
                  <div>
                    {/* Card Top: Icon & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${feat.iconGradient} text-white shadow-xs transition group-hover:scale-110`}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {feat.isNew && (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow-xs animate-pulse">
                            ใหม่!
                          </span>
                        )}
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${feat.badgeTone}`}
                        >
                          {feat.badge}
                        </span>
                      </div>
                    </div>

                    {/* Titles */}
                    <div className="mt-3">
                      <h3 className="text-base font-black text-slate-900 group-hover:text-violet-700 transition">
                        {feat.title}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400">{feat.engTitle}</p>
                    </div>

                    {/* Comparison Box: Problem vs AI Solution */}
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                      <div>
                        <span className="font-black text-rose-700 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          ปัญหาเดิมที่คุณครูเจอ:
                        </span>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 font-medium">
                          {feat.painPoint}
                        </p>
                      </div>
                      <div className="border-t border-slate-200/70 pt-2">
                        <span className="font-black text-emerald-700 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          สิ่งที่ AI ช่วยคุณครู:
                        </span>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-700 font-bold">
                          {feat.aiSolution}
                        </p>
                      </div>
                    </div>

                    {/* Feature Tags */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {feat.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-100"
                        >
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Bottom: Action Link */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <Link
                      to={feat.targetPath}
                      className="inline-flex w-full items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-violet-600 hover:text-white group-hover:shadow-xs"
                    >
                      <span>{feat.ctaLabel}</span>
                      <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selling Point Summary Footer Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-700 p-4 text-white shadow-md gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-black text-violet-100">ความคุ้มค่าและจุดเด่นอันดับหนึ่งของระบบ</p>
                <p className="text-sm font-black">
                  ใช้สิทธิ์ฟรีจาก Google Gemini API โดยไม่มีค่าใช้จ่ายแอบแฝง รองรับ 1,500 ครั้งต่อวัน
                </p>
              </div>
            </div>
            <Link
              to="/app/dashboard?view=workspace-settings"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-violet-900 shadow-sm hover:bg-violet-50 transition"
            >
              <span>จัดการ Gemini API Key</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
