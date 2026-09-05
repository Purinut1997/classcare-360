import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  RotateCcw,
  School,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { withDemoContext } from '../../lib/auth';
import type { AppSessionContext } from '../../types/core';

export interface SetupStep {
  id: string;
  stepNumber: number;
  title: string;
  shortTitle: string;
  badge: string;
  badgeColor: string;
  icon: LucideIcon;
  estimatedTime: string;
  whyFirst: string;
  destinationView: string;
  destinationLabel: string;
  todoList: { title: string; desc: string }[];
  proTips: string[];
}

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'school_profile',
    stepNumber: 1,
    title: 'ตั้งค่าข้อมูลสถานศึกษา & ผู้ลงนาม 4 ฝ่าย',
    shortTitle: 'ข้อมูลโรงเรียน & ผู้ลงนาม',
    badge: 'ขั้นตอนแรกสุดที่ต้องทำ',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: School,
    estimatedTime: '3-5 นาที',
    whyFirst: 'เป็นฐานข้อมูลกลางที่ระบบนำไปประทับบนหัวเอกสารทางการทั้งหมด เช่น ปพ.5, ปพ.6, ใบรายงานเกรด และสถิติราชการ',
    destinationView: '/app/dashboard?view=workspace-settings',
    destinationLabel: 'ไปหน้าตั้งค่าโรงเรียน',
    todoList: [
      {
        title: 'กรอกชื่อโรงเรียนและสังกัด',
        desc: 'ระบุชื่อภาษาไทย/อังกฤษ สังกัด (สพฐ., สช., อปท.) และสำนักงานเขตพื้นที่การศึกษา',
      },
      {
        title: 'อัปโหลดตราสัญลักษณ์โรงเรียน (โลโก้)',
        desc: 'รองรับไฟล์ PNG/JPG เพื่อนำไปใช้เป็นตราหัวเอกสารรายงานประจำโรงเรียน',
      },
      {
        title: 'ตั้งค่าผู้มีอำนาจลงนาม 4 ฝ่ายให้ครบถ้วน',
        desc: 'ได้แก่ 1. ผู้อำนวยการ 2. นายทะเบียนวัดผล 3. หัวหน้าฝ่ายวิชาการ 4. ครูประจำชั้น เพื่อการออกรายงานอัตโนมัติ',
      },
      {
        title: 'กำหนดปีการศึกษาและภาคเรียนปัจจุบัน',
        desc: 'เช่น ปีการศึกษา 2567 ภาคเรียนที่ 1 หรือ 2 เพื่อให้รอบข้อมูลและการบันทึกเวลาเรียนถูกต้อง',
      },
    ],
    proTips: [
      'หากบันทึกผู้ลงนาม 4 ฝ่ายครบถ้วน ระบบจะใส่ชื่อและตำแหน่งลงในสมุดรายงาน ปพ.5/ปพ.6 อัตโนมัติ โดยไม่ต้องพิมพ์ทีละเล่ม',
      'สามารถใส่ลายเซ็นต์ดิจิทัลหรือเว้นว่างไว้เพื่อลงนามจริงในเอกสารได้',
    ],
  },
  {
    id: 'classrooms_advisors',
    stepNumber: 2,
    title: 'จัดการห้องเรียน & แต่งตั้งครูที่ปรึกษา',
    shortTitle: 'ห้องเรียน & ครูที่ปรึกษา',
    badge: 'โครงสร้างการดูแลนักเรียน',
    badgeColor: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    icon: Building2,
    estimatedTime: '2-4 นาที',
    whyFirst: 'ห้องเรียนคือหน่วยหลักในการจัดกลุ่มนักเรียน กำหนดตารางสอน และมอบหมายให้ครูประจำชั้นเข้ามาดูแล',
    destinationView: '/app/dashboard?view=workspace-settings',
    destinationLabel: 'ไปหน้าจัดการห้องเรียน',
    todoList: [
      {
        title: 'สร้างรายชื่อห้องเรียนตามระดับชั้น',
        desc: 'เช่น ชั้นมัธยมศึกษาปีที่ 1/1, 1/2 หรือ ประถมศึกษาปีที่ 4/1 ครอบคลุมทั้งสายการเรียนและแผนก',
      },
      {
        title: 'แต่งตั้งครูประจำชั้น / ครูที่ปรึกษา',
        desc: 'มอบหมายคุณครูที่ดูแลห้องเรียนนั้นๆ เพื่อให้ครูเห็นเมนูเช็กชื่อแถว โฮมรูม และดูแลนักเรียนได้ทันที',
      },
      {
        title: 'ตรวจสอบรหัสห้องเรียนและปีการศึกษา',
        desc: 'จัดระเบียบห้องเรียนให้ตรงกับตารางสอนและระบบทะเบียนนักเรียน',
      },
    ],
    proTips: [
      'คุณครูที่ได้รับแต่งตั้งเป็นครูประจำชั้น จะสามารถเช็กชื่อโฮมรูมตอนเช้าและออกรายงาน ปพ.6 ประจำห้องตนเองได้ทันที',
      'สามารถแต่งตั้งครูที่ปรึกษาร่วม (ที่ปรึกษาคู่) ได้ เพื่อให้ช่วยกันดูแลนักเรียนได้อย่างราบรื่น',
    ],
  },
  {
    id: 'import_students',
    stepNumber: 3,
    title: 'นำเข้ารายชื่อนักเรียน (DMC / Excel / CSV)',
    shortTitle: 'นำเข้ารายชื่อนักเรียน',
    badge: 'ข้อมูลผู้เรียนในระบบ',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: FileSpreadsheet,
    estimatedTime: '3-7 นาที',
    whyFirst: 'รวดเร็วและแม่นยำกว่าการพิมพ์ทีละคน โดยสามารถดึงข้อมูลตรงจากระบบ DMC ของกระทรวงฯ หรือไฟล์ Excel ของโรงเรียน',
    destinationView: '/app/dashboard?view=import-export',
    destinationLabel: 'ไปหน้านำเข้ารายชื่อนักเรียน',
    todoList: [
      {
        title: 'เตรียมไฟล์ข้อมูลนักเรียน',
        desc: 'ดาวน์โหลดไฟล์รายชื่อจากระบบ DMC หรือใช้เทมเพลต Excel/CSV (เลขประจำตัว, ชื่อ-นามสกุล, เลข ปชช., ห้อง)',
      },
      {
        title: 'อัปโหลดและตรวจสอบหน้าพรีวิว (Preview)',
        desc: 'ระบบจะสแกนความถูกต้อง ตรวจสอบความสมบูรณ์ของคอลัมน์ และแจ้งเตือนแถวที่มีข้อมูลตกหล่น',
      },
      {
        title: 'คัดกรองข้อมูลซ้ำซ้อนและยืนยันนำเข้า',
        desc: 'ระบบช่วยเช็กเลขประจำตัวนักเรียนซ้ำ และสามารถเลือกลบหรือบันทึกเก็บถาวรรายชื่อเก่าได้',
      },
    ],
    proTips: [
      'ระบบรองรับการจับคู่คอลัมน์อัตโนมัติ (Auto-mapping) แม้หัวตารางจะไม่ตรงกับเทมเพลตเป๊ะๆ',
      'หากมีนักเรียนย้ายเข้า-ออกระหว่างภาคเรียน สามารถเพิ่มรายบุคคลหรือลบหลายรายการพร้อมกันได้ในหน้า "นักเรียน"',
    ],
  },
  {
    id: 'invite_staff',
    stepNumber: 4,
    title: 'เชิญครูผู้สอน & มอบหมายสิทธิ์การเข้าถึง',
    shortTitle: 'เชิญครู & สิทธิ์ห้องเรียน',
    badge: 'ความปลอดภัยและการร่วมมือ',
    badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: UserPlus,
    estimatedTime: '2-5 นาที',
    whyFirst: 'เพื่อให้ครูประจำวิชาและบุคลากรในโรงเรียนมีบัญชีของตนเอง และเข้าถึงเฉพาะข้อมูลที่ตนมีสิทธิ์ดูแลอย่างปลอดภัย',
    destinationView: '/app/dashboard?view=workspace-settings',
    destinationLabel: 'ไปหน้าจัดการสมาชิกและสิทธิ์',
    todoList: [
      {
        title: 'ส่งคำเชิญครูผู้สอนผ่านอีเมล',
        desc: 'กรอกอีเมลของคุณครูแต่ละท่าน ระบบจะส่งลิงก์เข้าร่วมโรงเรียนให้อัตโนมัติ',
      },
      {
        title: 'กำหนดบทบาทและระดับสิทธิ์',
        desc: 'เลือกเป็น ผู้ดูแลระบบ (Admin), ครูผู้สอน (Teacher) หรือ ผู้บริหารดูรายงาน (Viewer)',
      },
      {
        title: 'กำหนดห้องเรียนและวิชาที่รับผิดชอบ',
        desc: 'จำกัดขอบเขตการดูและแก้ไขข้อมูล เพื่อรักษาความลับของคะแนนสอบและข้อมูลส่วนบุคคลของนักเรียน',
      },
    ],
    proTips: [
      'สามารถมอบหมายสิทธิ์ VIP หรือ Teacher Owner ร่วม ให้กับหัวหน้าฝ่ายวิชาการหรือนายทะเบียนได้',
      'ครูประจำวิชาจะบันทึกคะแนนและเช็กชื่อได้เฉพาะวิชาที่สอน ส่วนครูประจำชั้นจะเห็นภาพรวมทั้งห้อง',
    ],
  },
  {
    id: 'daily_and_reports',
    stepNumber: 5,
    title: 'เริ่มต้นใช้งานกิจวัตร & สมุดคะแนน & รายงาน 360',
    shortTitle: 'ใช้งานกิจวัตร & รายงาน 360',
    badge: 'พร้อมใช้งานเต็มรูปแบบ',
    badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    icon: GraduationCap,
    estimatedTime: 'ใช้งานได้ทันที!',
    whyFirst: 'เมื่อเตรียมข้อมูลครบทั้ง 4 ขั้นตอนข้างต้นแล้ว โรงเรียนของคุณพร้อมใช้งานทุกฟังก์ชันได้อย่างสมบูรณ์แบบ 100%',
    destinationView: '/app/dashboard',
    destinationLabel: 'ไปหน้าภาพรวมระบบ (Dashboard)',
    todoList: [
      {
        title: 'บันทึกการมาเรียนประจำวัน (Morning Routine)',
        desc: 'เช็กชื่อแถวตอนเช้า มา/สาย/ขาด/ลา ด้วยระบบคลิกเดียวบนแท็บเล็ตหรือมือถือ',
      },
      {
        title: 'บันทึกเงินออม & ตารางเวรประจำวัน',
        desc: 'ส่งเสริมวินัยการออมและสร้างความรับผิดชอบในห้องเรียนผ่านระบบกิจกรรม',
      },
      {
        title: 'บันทึกคะแนนเก็บและตัดเกรดอัตโนมัติ',
        desc: 'กรอกคะแนนสอบกลางภาค/ปลายภาค พร้อมตัดเกรด 0-4 ตามเกณฑ์กระทรวงศึกษาธิการในคลิกเดียว',
      },
      {
        title: 'ส่งออกรายงาน ปพ.5 / ปพ.6 และสถิติ 360 องศา',
        desc: 'พิมพ์เอกสารทางการ ปพ.5, ปพ.6 พร้อมใช้งานส่งฝ่ายวิชาการได้ทันที สวยงาม ถูกต้องตามระเบียบ',
      },
    ],
    proTips: [
      'ข้อมูลการเช็กชื่อและคะแนนจะถูกประมวลผลขึ้นกราฟสถิติ 360 องศาบนหน้าภาพรวมแบบ Realtime',
      'หากมีข้อสงสัยหรือต้องการความช่วยเหลือ สามารถกดเปิด "คู่มือเริ่มต้นระบบ" ได้ตลอดเวลาจากแถบเมนูด้านบน',
    ],
  },
];

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: AppSessionContext;
}

export function SetupGuideModal({ isOpen, onClose, session }: SetupGuideModalProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'stepper' | 'roadmap'>('stepper');
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('classcare_setup_completed_steps');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [autoPopupEnabled, setAutoPopupEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('classcare_guide_auto_popup') !== 'false';
    } catch {
      return true;
    }
  });

  // Keep state synced to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('classcare_setup_completed_steps', JSON.stringify(completedStepIds));
    } catch {
      // Ignore storage errors
    }
  }, [completedStepIds]);

  const toggleStepCompleted = (stepId: string) => {
    setCompletedStepIds((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    );
  };

  const toggleAutoPopup = () => {
    setAutoPopupEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('classcare_guide_auto_popup', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleGoToStep = (destinationView: string) => {
    onClose();
    navigate(withDemoContext(destinationView, location.search));
  };

  if (!isOpen) return null;

  const currentStep = SETUP_STEPS[activeStepIndex];
  const totalSteps = SETUP_STEPS.length;
  const completedCount = completedStepIds.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div
      aria-labelledby="setup-guide-title"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-md sm:p-5 md:p-6"
      role="dialog"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 text-slate-100 shadow-2xl shadow-cyan-950/40 ring-1 ring-white/10">
        {/* Glow Header Accent */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />

        {/* Modal Header */}
        <div className="relative border-b border-slate-800 bg-slate-900/90 px-6 py-5 backdrop-blur-sm sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
                <BookOpen size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-bold text-cyan-400 border border-cyan-500/30">
                    คู่มือแนะนำทีละขั้นตอน
                  </span>
                  <span className="text-xs text-slate-400 font-medium">ClassCare 360 Onboarding</span>
                </div>
                <h2 id="setup-guide-title" className="text-lg font-black text-white sm:text-xl tracking-tight">
                  ไกด์ขั้นตอนการเตรียมและตั้งค่าระบบโรงเรียน
                </h2>
              </div>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="hidden items-center rounded-xl bg-slate-800/80 p-1 text-xs font-bold border border-slate-700/50 sm:flex">
                <button
                  type="button"
                  onClick={() => setViewMode('stepper')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                    viewMode === 'stepper'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Workflow size={13} />
                  <span>ทีละขั้นตอน</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('roadmap')}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                    viewMode === 'roadmap'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers size={13} />
                  <span>ภาพรวม 5 ขั้นตอน</span>
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิดคู่มือ"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-700/60 bg-slate-800/80 text-slate-400 transition-all hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Progress Overview Bar */}
          <div className="mt-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <span className="text-cyan-400">ความคืบหน้าการตั้งค่า:</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-white border border-slate-700">
                เสร็จสิ้น {completedCount} จาก {totalSteps} ขั้นตอน ({progressPercent}%)
              </span>
              {progressPercent === 100 && (
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold animate-pulse">
                  <Sparkles size={13} /> โรงเรียนของคุณพร้อมใช้งาน 100%!
                </span>
              )}
            </div>
            <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-800 border border-slate-700/60">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Step Tabs Nav (Stepper Mode) */}
        {viewMode === 'stepper' && (
          <div className="scrollbar-thin flex overflow-x-auto border-b border-slate-800 bg-slate-950/40 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-full items-center gap-2">
              {SETUP_STEPS.map((step, idx) => {
                const isActive = idx === activeStepIndex;
                const isDone = completedStepIds.includes(step.id);
                const StepIcon = step.icon;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    className={`group flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left text-xs font-bold transition-all ${
                      isActive
                        ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30 shadow-md shadow-cyan-950/40'
                        : isDone
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-lg text-[11px] font-black transition-all ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 font-black'
                          : isDone
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                      }`}
                    >
                      {isDone ? <Check size={14} strokeWidth={3} /> : step.stepNumber}
                    </span>
                    <span className="whitespace-nowrap">{step.shortTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {viewMode === 'stepper' ? (
            /* STEP-BY-STEP DETAIL VIEW */
            <div className="space-y-6">
              {/* Step Title Header Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                      <currentStep.icon size={26} />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${currentStep.badgeColor}`}
                        >
                          ขั้นตอนที่ {currentStep.stepNumber} จาก {totalSteps} · {currentStep.badge}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={12} /> ใช้เวลาประมาณ: {currentStep.estimatedTime}
                        </span>
                      </div>
                      <h3 className="mt-1 text-lg font-black text-white sm:text-xl tracking-tight">
                        {currentStep.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300 font-medium sm:text-sm">
                        <span className="font-bold text-amber-400">เหตุผลที่ต้องทำขั้นตอนนี้ก่อน:</span>{' '}
                        {currentStep.whyFirst}
                      </p>
                    </div>
                  </div>

                  {/* Mark as Done Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleStepCompleted(currentStep.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                      completedStepIds.includes(currentStep.id)
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-sm'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`grid h-4 w-4 place-items-center rounded-md border ${
                        completedStepIds.includes(currentStep.id)
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                          : 'border-slate-500 bg-slate-900'
                      }`}
                    >
                      {completedStepIds.includes(currentStep.id) && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span>
                      {completedStepIds.includes(currentStep.id)
                        ? 'ทำขั้นตอนนี้เรียบร้อยแล้ว'
                        : 'ทำเครื่องหมายว่าเสร็จแล้ว'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Checklist */}
              <div>
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-400">
                  <UserCheck size={15} /> สิ่งที่ต้องทำในขั้นตอนนี้
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {currentStep.todoList.map((todo, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800/90 bg-slate-950/50 p-4 transition-all hover:border-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-xs font-black text-cyan-400">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-white sm:text-sm">{todo.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                            {todo.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tips Box */}
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
                    <Lightbulb size={18} />
                  </span>
                  <div className="space-y-1.5">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-400">
                      💡 เคล็ดลับมืออาชีพ (Pro Tips)
                    </p>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {currentStep.proTips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-400/80">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step Direct Action CTA Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 p-4 sm:p-5">
                <div>
                  <p className="text-xs font-black text-white sm:text-sm">
                    ต้องการไปทำขั้นตอนนี้เลยใช่ไหม?
                  </p>
                  <p className="text-[11px] text-slate-400 sm:text-xs">
                    กดปุ่มนี้เพื่อพาท่านไปยังเมนูตั้งค่าเป้าหมายทันทีโดยอัตโนมัติ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleGoToStep(currentStep.destinationView)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95"
                >
                  <span>🚀 {currentStep.destinationLabel}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* ALL-IN-ONE ROADMAP VIEW */
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                <p className="font-bold text-white">
                  📌 ลำดับขั้นตอนแนะนำสำหรับการเริ่มต้นใช้งาน ClassCare 360:
                </p>
                <p className="mt-1 text-slate-400">
                  ระบบได้รับการออกแบบให้ทำตามลำดับ 1 ➔ 2 ➔ 3 ➔ 4 ➔ 5 เพื่อให้ข้อมูลเชื่อมโยงกันอย่างสมบูรณ์แบบ
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-1">
                {SETUP_STEPS.map((step, idx) => {
                  const isDone = completedStepIds.includes(step.id);
                  const StepIcon = step.icon;

                  return (
                    <div
                      key={step.id}
                      className={`relative flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${
                        isDone
                          ? 'border-emerald-500/30 bg-emerald-950/10'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-black ${
                            isDone
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {isDone ? <Check size={20} strokeWidth={3} /> : step.stepNumber}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-white sm:text-sm">
                              {step.title}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${step.badgeColor}`}
                            >
                              {step.badge}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{step.whyFirst}</p>
                          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
                            <span>⏱️ เวลาประมาณ: {step.estimatedTime}</span>
                            <span>📋 {step.todoList.length} หัวข้อที่ต้องเตรียม</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveStepIndex(idx);
                            setViewMode('stepper');
                          }}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
                        >
                          ดูวิธีทำ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoToStep(step.destinationView)}
                          className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-cyan-500"
                        >
                          <span>{step.destinationLabel}</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-900/90 px-6 py-4 backdrop-blur-sm sm:px-8">
          {/* Auto Popup Checkbox */}
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-400 select-none">
            <input
              type="checkbox"
              checked={autoPopupEnabled}
              onChange={toggleAutoPopup}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-slate-900"
            />
            <span>แสดงคู่มือนี้อัตโนมัติทุกครั้งที่เข้าใช้งาน</span>
          </label>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center gap-2">
            {viewMode === 'stepper' && (
              <>
                <button
                  type="button"
                  disabled={activeStepIndex === 0}
                  onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ArrowLeft size={14} />
                  <span>ย้อนกลับ</span>
                </button>

                {activeStepIndex < totalSteps - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStepIndex((prev) => Math.min(totalSteps - 1, prev + 1))}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 text-xs font-bold text-white transition-all"
                  >
                    <span>ขั้นตอนถัดไป</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-600/30 transition-all"
                  >
                    <CheckCircle2 size={14} />
                    <span>เสร็จสิ้นและเริ่มใช้งาน</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200"
            >
              ปิดคู่มือ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
