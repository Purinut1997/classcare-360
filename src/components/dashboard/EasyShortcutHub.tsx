import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  DatabaseZap,
  Dice5,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Heart,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  PiggyBank,
  School,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { AppSessionContext } from '../../types/core';
import type { ClassroomAnalyticsData } from './ClassroomAnalyticsCharts';

interface ShortcutItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  path: string;
  badge?: string;
  badgeTone?: string;
  category: 'daily' | 'academic' | 'care' | 'admin';
  accentColor: {
    bg: string;
    text: string;
    border: string;
    hoverBorder: string;
    ring: string;
    iconBg: string;
  };
}

interface EasyShortcutHubProps {
  analyticsData?: ClassroomAnalyticsData;
  classroomName?: string;
  isHomeroom?: boolean;
  onSwitchToAnalytics?: () => void;
  session: AppSessionContext;
}

export function EasyShortcutHub({
  analyticsData,
  classroomName = 'ห้องเรียน',
  isHomeroom = false,
  onSwitchToAnalytics,
  session,
}: EasyShortcutHubProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'daily' | 'academic' | 'care' | 'admin'>('all');

  const attendanceChecked = analyticsData?.dataCompleteness.attendanceCheckedToday ?? false;
  const studentCount = analyticsData?.dataCompleteness.studentsCount ?? 0;
  const assessmentCount = analyticsData?.scores.assessmentCount ?? 0;
  const savingsAccounts = analyticsData?.savings.accountCount ?? 0;

  // คลังเมนูทั้งหมดที่แปลงเป็น "ภาษาพูด / กริยาที่ครูทำจริง"
  const allShortcuts: ShortcutItem[] = useMemo(() => {
    return [
      // ☀️ หมวด 1: กิจวัตรประจำวัน & ในห้องเรียน (Daily & Classroom Routine)
      {
        id: 'attendance',
        title: 'เช็กชื่อเข้าแถว / คาบเรียน',
        subtitle: 'บันทึก มา สาย ลา ขาด ประจำวัน',
        description: 'เช็กเวลาเรียนเช้าหรือรายวิชา บันทึกเหตุผลการลา ส่งต่อยอดเข้าสถิติอัตโนมัติ',
        keywords: ['เช็กชื่อ', 'เวลาเรียน', 'เข้าแถว', 'มาเรียน', 'สาย', 'ลา', 'ขาด', 'ขาดเรียน', 'attendance'],
        icon: CalendarClock,
        path: '/app/dashboard?view=teacher-work',
        badge: attendanceChecked ? '✓ เช็กแล้ว' : '🔔 รอเช็กเช้า',
        badgeTone: attendanceChecked ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse',
        category: 'daily',
        accentColor: {
          bg: 'from-emerald-500/10 via-white to-teal-500/5',
          text: 'text-emerald-700',
          border: 'border-emerald-200/80',
          hoverBorder: 'hover:border-emerald-400',
          ring: 'focus:ring-emerald-400',
          iconBg: 'bg-emerald-600 text-white shadow-emerald-500/30',
        },
      },
      {
        id: 'student-health',
        title: 'สุขภาพ & กิจวัตรนักเรียน',
        subtitle: 'แปรงฟัน, ดื่มนม, อาหารกลางวัน',
        description: 'บันทึกการแปรงฟันหลังอาหาร ตรวจความสะอาดเล็บผม และบันทึกมื้ออาหาร',
        keywords: ['แปรงฟัน', 'นม', 'ดื่มนม', 'อาหาร', 'อาหารกลางวัน', 'ข้าว', 'สุขภาพ', 'ตรวจสุขภาพ', 'hygiene', 'health'],
        icon: HeartPulse,
        path: '/app/dashboard?view=student-health',
        badge: 'กิจวัตรเช้า-เที่ยง',
        badgeTone: 'bg-teal-100 text-teal-800 border-teal-200',
        category: 'daily',
        accentColor: {
          bg: 'from-teal-500/10 via-white to-cyan-500/5',
          text: 'text-teal-700',
          border: 'border-teal-200/80',
          hoverBorder: 'hover:border-teal-400',
          ring: 'focus:ring-teal-400',
          iconBg: 'bg-teal-600 text-white shadow-teal-500/30',
        },
      },
      {
        id: 'growth-bmi',
        title: 'ชั่งน้ำหนัก & วัดส่วนสูง',
        subtitle: 'บันทึกสมรรถภาพ และคำนวณ BMI',
        description: 'กรอกน้ำหนักส่วนสูงรายเทอม ระบบคำนวณเกณฑ์การเจริญเติบโตตามมาตรฐานกรมอนามัย',
        keywords: ['น้ำหนัก', 'ส่วนสูง', 'bmi', 'บีเอ็มไอ', 'อ้วน', 'ผอม', 'สมรรถภาพ', 'กรมอนามัย', 'เติบโต'],
        icon: Heart,
        path: '/app/dashboard?view=student-health',
        badge: 'รายเทอม',
        badgeTone: 'bg-violet-100 text-violet-800 border-violet-200',
        category: 'daily',
        accentColor: {
          bg: 'from-violet-500/10 via-white to-purple-500/5',
          text: 'text-violet-700',
          border: 'border-violet-200/80',
          hoverBorder: 'hover:border-violet-400',
          ring: 'focus:ring-violet-400',
          iconBg: 'bg-violet-600 text-white shadow-violet-500/30',
        },
      },
      {
        id: 'savings',
        title: 'บันทึกเงินออมนักเรียน',
        subtitle: 'ฝาก-ถอนเงินออม ประจำวัน/สัปดาห์',
        description: 'บันทึกยอดเงินฝากรายวัน ออกใบเสร็จยอดเงิน และดูยอดเงินรวมทั้งห้อง',
        keywords: ['เงินออม', 'ออมเงิน', 'ฝากเงิน', 'ถอนเงิน', 'ธนาคาร', 'เงิน', 'บาท', 'savings'],
        icon: PiggyBank,
        path: '/app/dashboard?view=savings',
        badge: `${savingsAccounts} บัญชี`,
        badgeTone: 'bg-amber-100 text-amber-800 border-amber-200',
        category: 'daily',
        accentColor: {
          bg: 'from-amber-500/10 via-white to-yellow-500/5',
          text: 'text-amber-700',
          border: 'border-amber-200/80',
          hoverBorder: 'hover:border-amber-400',
          ring: 'focus:ring-amber-400',
          iconBg: 'bg-amber-600 text-white shadow-amber-500/30',
        },
      },
      {
        id: 'classroom-operations',
        title: 'ตรวจเวรประจำวัน & จิตพิสัย',
        subtitle: 'เวรทำความสะอาดห้องเรียน และเช็กความพร้อม',
        description: 'จัดตารางเวร เช็กการปฏิบัติหน้าที่ และให้คะแนนจิตพิสัยความรับผิดชอบ',
        keywords: ['เวร', 'เวรประจำวัน', 'ทำความสะอาด', 'จิตพิสัย', 'เวรห้อง', 'กวาดห้อง', 'เวรทำความสะอาด'],
        icon: ClipboardCheck,
        path: '/app/dashboard?view=classroom-operations',
        category: 'daily',
        accentColor: {
          bg: 'from-indigo-500/10 via-white to-blue-500/5',
          text: 'text-indigo-700',
          border: 'border-indigo-200/80',
          hoverBorder: 'hover:border-indigo-400',
          ring: 'focus:ring-indigo-400',
          iconBg: 'bg-indigo-600 text-white shadow-indigo-500/30',
        },
      },
      {
        id: 'schedule',
        title: 'ตารางสอน & ตารางเรียน',
        subtitle: 'ดูตารางสอนประจำสัปดาห์ คาบเรียนวันนี้',
        description: 'ดูว่าวันนี้มีสอนวิชาอะไร คาบไหน ห้องไหน และจัดตารางเรียนของห้อง',
        keywords: ['ตารางสอน', 'ตารางเรียน', 'คาบเรียน', 'สอน', 'วิชา', 'เวลาสอน', 'schedule'],
        icon: CalendarRange,
        path: '/app/dashboard?view=schedule',
        category: 'daily',
        accentColor: {
          bg: 'from-sky-500/10 via-white to-blue-500/5',
          text: 'text-sky-700',
          border: 'border-sky-200/80',
          hoverBorder: 'hover:border-sky-400',
          ring: 'focus:ring-sky-400',
          iconBg: 'bg-sky-600 text-white shadow-sky-500/30',
        },
      },

      // 📚 หมวด 2: งานคะแนน & การสอน (Academic & Grading Tools)
      {
        id: 'scores',
        title: 'สมุดคะแนน & กรอกเกรด (Excel)',
        subtitle: 'กรอกคะแนนเก็บ กลางภาค ปลายภาค',
        description: 'หน้าตารางคะแนนแบบ Excel ใช้งานคุ้นเคย รองรับการคำนวณเกรดและตัดเกรดอัตโนมัติ',
        keywords: ['คะแนน', 'กรอกคะแนน', 'สมุดคะแนน', 'เกรด', 'สอบ', 'กลางภาค', 'ปลายภาค', 'excel', 'scores'],
        icon: GraduationCap,
        path: '/app/dashboard?view=scores&scoreView=excel',
        badge: `${assessmentCount} ชุดคะแนน`,
        badgeTone: 'bg-sky-100 text-sky-800 border-sky-200',
        category: 'academic',
        accentColor: {
          bg: 'from-sky-500/10 via-white to-cyan-500/5',
          text: 'text-sky-700',
          border: 'border-sky-200/80',
          hoverBorder: 'hover:border-sky-400',
          ring: 'focus:ring-sky-400',
          iconBg: 'bg-sky-600 text-white shadow-sky-500/30',
        },
      },
      {
        id: 'omr-scanner',
        title: 'สร้าง & ตรวจข้อสอบ (AI OMR)',
        subtitle: 'ตรวจกระดาษคำตอบผ่านกล้อง ออกแบบข้อสอบ & ตัดเกรด',
        description: 'สแกนตรวจกระดาษคำตอบด้วยกล้องมือถือ/เว็บแคม นับคะแนนอัตโนมัติ ออกแบบชุดข้อสอบพร้อม QR Code และบันทึกคะแนนเข้าสมุดทันที',
        keywords: [
          'omr',
          'ข้อสอบ',
          'ตรวจข้อสอบ',
          'กระดาษคำตอบ',
          'สแกน',
          'กล้อง',
          'ตรวจการบ้าน',
          'คะแนนสอบ',
          'ปรนัย',
          'กาข้อสอบ',
          'เฉลย',
          'คลังข้อสอบ',
          'exam',
          'scanner',
          'คำตอบ',
        ],
        icon: ScanLine,
        path: '/app/dashboard?view=omr-scanner',
        badge: 'AI Vision ตรวจไว',
        badgeTone: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        category: 'academic',
        accentColor: {
          bg: 'from-cyan-500/10 via-white to-blue-500/5',
          text: 'text-cyan-700',
          border: 'border-cyan-200/80',
          hoverBorder: 'hover:border-cyan-400',
          ring: 'focus:ring-cyan-400',
          iconBg: 'bg-cyan-600 text-white shadow-cyan-500/30',
        },
      },
      {
        id: 'academic-hub',
        title: 'งานวิชาการ & ทะเบียน (ปพ.)',
        subtitle: 'ออกเอกสาร ปพ.5, ปพ.6, ใบเกรด',
        description: 'พิมพ์ ปพ.5 สมุดประเมินผลการเรียน, ปพ.6 รายงานประจำตัวนักเรียน และส่งออก PDF ครบชุด',
        keywords: ['ปพ', 'ปพ.5', 'ปพ.6', 'ปพ5', 'ปพ6', 'ทะเบียน', 'วิชาการ', 'ใบเกรด', 'สมุดพก', 'ผลการเรียน'],
        icon: BookOpen,
        path: '/app/dashboard?view=academic-hub',
        badge: 'แบบฟอร์ม สพฐ.',
        badgeTone: 'bg-blue-100 text-blue-800 border-blue-200',
        category: 'academic',
        accentColor: {
          bg: 'from-blue-500/10 via-white to-indigo-500/5',
          text: 'text-blue-700',
          border: 'border-blue-200/80',
          hoverBorder: 'hover:border-blue-400',
          ring: 'focus:ring-blue-400',
          iconBg: 'bg-blue-600 text-white shadow-blue-500/30',
        },
      },
      {
        id: 'randomizer',
        title: 'วงล้อสุ่มชื่อ & สุ่มกลุ่ม',
        subtitle: 'สุ่มนักเรียนตอบคำถาม จัดกลุ่มกิจกรรม',
        description: 'สุ่มตอบคำถามในคาบเรียนแบบมีแอนิเมชันเสียงตื่นเต้น และแบ่งกลุ่มทำงานอัตโนมัติ',
        keywords: ['สุ่ม', 'วงล้อ', 'สุ่มชื่อ', 'สุ่มเลขที่', 'ตอบคำถาม', 'จัดกลุ่ม', 'กิจกรรม', 'random'],
        icon: Dice5,
        path: '/app/dashboard?view=randomizer',
        badge: 'ช่วยสอนสนุกขึ้น',
        badgeTone: 'bg-rose-100 text-rose-800 border-rose-200',
        category: 'academic',
        accentColor: {
          bg: 'from-rose-500/10 via-white to-pink-500/5',
          text: 'text-rose-700',
          border: 'border-rose-200/80',
          hoverBorder: 'hover:border-rose-400',
          ring: 'focus:ring-rose-400',
          iconBg: 'bg-rose-600 text-white shadow-rose-500/30',
        },
      },
      {
        id: 'behavior',
        title: 'บันทึกความดี & พฤติกรรม',
        subtitle: 'บวกแต้มความดี และตักเตือนพฤติกรรม',
        description: 'สะสมแต้มคะแนนพฤติกรรม บันทึกความมีวินัย จิตอาสา และเตือนพฤติกรรมที่ไม่เหมาะสม',
        keywords: ['พฤติกรรม', 'ความดี', 'ตัดแต้ม', 'บวกแต้ม', 'คะแนนพฤติกรรม', 'ตักเตือน', 'วินัย', 'จิตอาสา', 'behavior'],
        icon: Award,
        path: '/app/dashboard?view=behavior',
        category: 'academic',
        accentColor: {
          bg: 'from-emerald-500/10 via-white to-teal-500/5',
          text: 'text-emerald-700',
          border: 'border-emerald-200/80',
          hoverBorder: 'hover:border-emerald-400',
          ring: 'focus:ring-emerald-400',
          iconBg: 'bg-emerald-600 text-white shadow-emerald-500/30',
        },
      },
      {
        id: 'desirable-characteristics',
        title: 'คุณลักษณะอันพึงประสงค์ 8 ประการ',
        subtitle: 'เกณฑ์การประเมินมาตรฐาน สพฐ.',
        description: 'ประเมิน 8 ข้อ (รักชาติ, ซื่อสัตย์, ใฝ่เรียนรู้ ฯลฯ) ตัดเกรด ดีเยี่ยม, ดี, ผ่าน เพื่อส่ง ปพ.',
        keywords: ['คุณลักษณะ', '8 ประการ', 'สพฐ', 'ประเมินคุณลักษณะ', 'ดีเยี่ยม', 'รักชาติ', 'ใฝ่เรียนรู้'],
        icon: Award,
        path: '/app/dashboard?view=desirable-characteristics',
        category: 'academic',
        accentColor: {
          bg: 'from-amber-500/10 via-white to-orange-500/5',
          text: 'text-amber-700',
          border: 'border-amber-200/80',
          hoverBorder: 'hover:border-amber-400',
          ring: 'focus:ring-amber-400',
          iconBg: 'bg-amber-600 text-white shadow-amber-500/30',
        },
      },
      {
        id: 'automation',
        title: 'ระบบเตือนเด็กเสี่ยง & งานค้าง',
        subtitle: 'Automation & Early Warning',
        description: 'ตรวจจับเด็กที่ขาดเรียนเกินเกณฑ์, คะแนนต่ำกว่าเป้า หรือยังไม่ส่งงาน พร้อมแนะนำแนวทางแก้ไข',
        keywords: ['เสี่ยง', 'เตือน', 'ขาดบ่อย', 'งานค้าง', 'ติดศูนย์', 'ไม่ผ่าน', 'automation', 'warning', 'ช่วยเหลือ'],
        icon: Workflow,
        path: '/app/dashboard?view=automation',
        badge: 'ระบบช่วยเหลือ',
        badgeTone: 'bg-purple-100 text-purple-800 border-purple-200',
        category: 'academic',
        accentColor: {
          bg: 'from-purple-500/10 via-white to-fuchsia-500/5',
          text: 'text-purple-700',
          border: 'border-purple-200/80',
          hoverBorder: 'hover:border-purple-400',
          ring: 'focus:ring-purple-400',
          iconBg: 'bg-purple-600 text-white shadow-purple-500/30',
        },
      },

      // 👨‍👩‍👧 หมวด 3: ดูแลนักเรียน & ผู้ปกครอง (Student Care & Parent Portal)
      {
        id: 'students',
        title: 'ทะเบียนนักเรียน (Student 360)',
        subtitle: 'ดูข้อมูลนักเรียนรายคน รูปถ่าย เบอร์โทร',
        description: 'ค้นหาประวัตินักเรียน, ข้อมูลติดต่อผู้ปกครอง, โรคประจำตัว, ประวัติการมาเรียน และคะแนนครบจุดเดียว',
        keywords: ['นักเรียน', 'รายชื่อ', 'ประวัติ', 'รูปถ่าย', 'เบอร์โทร', 'ที่อยู่', 'ผู้ปกครอง', 'student', '360'],
        icon: Users,
        path: '/app/dashboard?view=students',
        badge: `${studentCount} คนในห้อง`,
        badgeTone: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        category: 'care',
        accentColor: {
          bg: 'from-cyan-500/10 via-white to-blue-500/5',
          text: 'text-cyan-700',
          border: 'border-cyan-200/80',
          hoverBorder: 'hover:border-cyan-400',
          ring: 'focus:ring-cyan-400',
          iconBg: 'bg-cyan-600 text-white shadow-cyan-500/30',
        },
      },
      {
        id: 'parent-access',
        title: 'QR Code & รหัสเข้าดูของผู้ปกครอง',
        subtitle: 'สร้างการ์ด QR แจกผู้ปกครองเข้าดูผล',
        description: 'สร้างบัตร QR พิมพ์แจกผู้ปกครอง ให้ผู้ปกครองดูเวลาเรียน คะแนน และยอดเงินออมผ่านมือถือได้ทันที',
        keywords: ['qr', 'คิวอาร์', 'ผู้ปกครอง', 'portal', 'พอร์ทัล', 'รหัสผู้ปกครอง', 'พิมพ์การ์ด', 'แจก'],
        icon: KeyRound,
        path: '/app/dashboard?view=parent-access',
        badge: 'เชื่อมต่อผู้ปกครอง',
        badgeTone: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        category: 'care',
        accentColor: {
          bg: 'from-emerald-500/10 via-white to-green-500/5',
          text: 'text-emerald-700',
          border: 'border-emerald-200/80',
          hoverBorder: 'hover:border-emerald-400',
          ring: 'focus:ring-emerald-400',
          iconBg: 'bg-emerald-600 text-white shadow-emerald-500/30',
        },
      },
      {
        id: 'daily-brief',
        title: 'สรุปสถานการณ์ประจำวัน (Daily Brief)',
        subtitle: 'สรุปเด็กขาด ข้อมูลสำคัญใน 1 หน้ากระดาษ',
        description: 'รวมยอดนักเรียน มา ลา ขาด บันทึกประจำวัน และกิจกรรมสำคัญสำหรับส่งรายงานครูเวรหรือฝ่ายบริหาร',
        keywords: ['สรุป', 'daily brief', 'รายงานประจำวัน', 'สรุปเช้า', 'ยอดมาเรียน', 'ส่งผอ', 'สรุปยอด'],
        icon: FileText,
        path: '/app/dashboard?view=daily-brief',
        category: 'care',
        accentColor: {
          bg: 'from-teal-500/10 via-white to-emerald-500/5',
          text: 'text-teal-700',
          border: 'border-teal-200/80',
          hoverBorder: 'hover:border-teal-400',
          ring: 'focus:ring-teal-400',
          iconBg: 'bg-teal-600 text-white shadow-teal-500/30',
        },
      },
      {
        id: 'reports',
        title: 'พิมพ์รายงาน & สถิติรวม (Reports)',
        subtitle: 'ออกรายงานสถิติเวลาเรียน และแบบสรุป',
        description: 'สร้างรายงานสรุปรายเดือน รายเทอม ทั้งรูปแบบตารางและกราฟ ส่งออกเป็น Excel / PDF ได้ทันที',
        keywords: ['รายงาน', 'สถิติ', 'สรุปเวลาเรียน', 'พิมพ์รายงาน', 'ส่งออก', 'pdf', 'excel', 'reports'],
        icon: FileSpreadsheet,
        path: '/app/dashboard?view=reports&reportView=attendance',
        category: 'care',
        accentColor: {
          bg: 'from-blue-500/10 via-white to-sky-500/5',
          text: 'text-blue-700',
          border: 'border-blue-200/80',
          hoverBorder: 'hover:border-blue-400',
          ring: 'focus:ring-blue-400',
          iconBg: 'bg-blue-600 text-white shadow-blue-500/30',
        },
      },

      // ⚙️ หมวด 4: จัดการห้องเรียน & เครื่องมือระบบ (Admin & Settings)
      {
        id: 'school-calendar',
        title: 'ปฏิทินโรงเรียน & วันหยุด',
        subtitle: 'ดูวันหยุดราชการ วันสอบ และกิจกรรม',
        description: 'ปฏิทินรวมกิจกรรมของโรงเรียน วันเปิด-ปิดภาคเรียน กำหนดการสอบ และวันหยุดพิเศษ',
        keywords: ['ปฏิทิน', 'วันหยุด', 'กิจกรรม', 'วันสอบ', 'ปิดเทอม', 'เปิดเทอม', 'calendar'],
        icon: CalendarDays,
        path: '/app/dashboard?view=school-calendar',
        category: 'admin',
        accentColor: {
          bg: 'from-amber-500/10 via-white to-orange-500/5',
          text: 'text-amber-700',
          border: 'border-amber-200/80',
          hoverBorder: 'hover:border-amber-400',
          ring: 'focus:ring-amber-400',
          iconBg: 'bg-amber-600 text-white shadow-amber-500/30',
        },
      },
      {
        id: 'import-export',
        title: 'นำเข้าข้อมูลเด็กใหม่ & สำรองข้อมูล',
        subtitle: 'อัปโหลด Excel รายชื่อเด็ก และกู้คืนข้อมูล',
        description: 'นำเข้ารายชื่อนักเรียนใหม่จากไฟล์ Excel หรือระบบจัดเก็บข้อมูลนักเรียน (DMC) พร้อมปุ่มสำรองข้อมูล',
        keywords: ['นำเข้า', 'ส่งออก', 'อัปโหลด', 'excel', 'dmc', 'สำรองข้อมูล', 'backup', 'import', 'export'],
        icon: Archive,
        path: '/app/dashboard?view=import-export',
        category: 'admin',
        accentColor: {
          bg: 'from-slate-500/10 via-white to-gray-500/5',
          text: 'text-slate-700',
          border: 'border-slate-200/80',
          hoverBorder: 'hover:border-slate-400',
          ring: 'focus:ring-slate-400',
          iconBg: 'bg-slate-700 text-white shadow-slate-600/30',
        },
      },
      {
        id: 'workspace-settings',
        title: 'ศูนย์จัดการห้องเรียน & ครู',
        subtitle: 'ตั้งชื่อห้อง, เพิ่มครูร่วม, เชิญสมาชิก',
        description: 'จัดการข้อมูลห้องเรียน กำหนดครูประจำชั้น เชิญครูผู้สอนร่วม และอนุมัติคำขอเข้าร่วม',
        keywords: ['ตั้งค่า', 'ห้องเรียน', 'ครูประจำชั้น', 'เชิญครู', 'สมาชิก', 'จัดการห้อง', 'settings'],
        icon: School,
        path: '/app/dashboard?view=workspace-settings',
        category: 'admin',
        accentColor: {
          bg: 'from-teal-500/10 via-white to-cyan-500/5',
          text: 'text-teal-700',
          border: 'border-teal-200/80',
          hoverBorder: 'hover:border-teal-400',
          ring: 'focus:ring-teal-400',
          iconBg: 'bg-teal-700 text-white shadow-teal-600/30',
        },
      },
      {
        id: 'academic-year',
        title: 'เลื่อนชั้น & ปิดปีการศึกษา',
        subtitle: 'คลังเก็บข้อมูลปีเก่า และขึ้นปีการศึกษาใหม่',
        description: 'เลื่อนชั้นนักเรียนขึ้นระดับถัดไป จัดเก็บข้อมูลประวัติของปีที่ผ่านมา และเปิดเทอมใหม่',
        keywords: ['เลื่อนชั้น', 'ปิดเทอม', 'ปีการศึกษา', 'จบการศึกษา', 'ย้ายห้อง', 'ขึ้นชั้น', 'ปีเก่า'],
        icon: CalendarCheck,
        path: '/app/dashboard?view=academic-year',
        category: 'admin',
        accentColor: {
          bg: 'from-indigo-500/10 via-white to-blue-500/5',
          text: 'text-indigo-700',
          border: 'border-indigo-200/80',
          hoverBorder: 'hover:border-indigo-400',
          ring: 'focus:ring-indigo-400',
          iconBg: 'bg-indigo-700 text-white shadow-indigo-600/30',
        },
      },
      {
        id: 'period-locks',
        title: 'ล็อกงวดเวลาเรียน & คะแนน',
        subtitle: 'ป้องกันการแก้ไขข้อมูลย้อนหลังโดยไม่ตั้งใจ',
        description: 'ล็อกงวดบันทึกเมื่อสิ้นสุดเดือนหรือภาคเรียน เพื่อความถูกต้องของข้อมูลตามระเบียบ',
        keywords: ['ล็อก', 'ล็อกงวด', 'ปิดงวด', 'ป้องกัน', 'ห้ามแก้', 'lock'],
        icon: LockKeyhole,
        path: '/app/dashboard?view=period-locks',
        category: 'admin',
        accentColor: {
          bg: 'from-amber-500/10 via-white to-rose-500/5',
          text: 'text-amber-800',
          border: 'border-amber-200/80',
          hoverBorder: 'hover:border-amber-400',
          ring: 'focus:ring-amber-400',
          iconBg: 'bg-amber-700 text-white shadow-amber-600/30',
        },
      },
      {
        id: 'help-center',
        title: 'คู่มือใช้งาน & ศูนย์ช่วยเหลือ',
        subtitle: 'วิธีใช้ระบบ วิดีโอสอน และคำถามที่พบบ่อย',
        description: 'มีคำแนะนำการใช้งานอย่างละเอียดทุกขั้นตอน พร้อมวิดีโอแนะนำและช่องทางติดต่อทีมงาน',
        keywords: ['คู่มือ', 'ช่วยเหลือ', 'วิธีใช้', 'วิดีโอ', 'สอน', 'คำถาม', 'help', 'center'],
        icon: CircleHelp,
        path: '/app/dashboard?view=help-center',
        badge: 'มีวิดีโอสอน',
        badgeTone: 'bg-teal-100 text-teal-800 border-teal-200',
        category: 'admin',
        accentColor: {
          bg: 'from-emerald-500/10 via-white to-teal-500/5',
          text: 'text-emerald-700',
          border: 'border-emerald-200/80',
          hoverBorder: 'hover:border-emerald-400',
          ring: 'focus:ring-emerald-400',
          iconBg: 'bg-emerald-700 text-white shadow-emerald-600/30',
        },
      },
    ];
  }, [analyticsData, attendanceChecked, studentCount, assessmentCount, savingsAccounts]);

  // ระบบค้นหาอัจฉริยะ (กรองตามคำค้นหาภาษาพูด)
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allShortcuts.filter((item) => {
      // ตรวจสอบหมวดหมู่
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      // ค้นหาในชื่อ คำอธิบาย และคีย์เวิร์ด
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSubtitle = item.subtitle.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchKeywords = item.keywords.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchSubtitle || matchDesc || matchKeywords;
    });
  }, [allShortcuts, searchQuery, activeCategory]);

  // หมวดหมู่และจำนวน
  const categoryCounts = useMemo(() => {
    return {
      all: allShortcuts.length,
      daily: allShortcuts.filter((i) => i.category === 'daily').length,
      academic: allShortcuts.filter((i) => i.category === 'academic').length,
      care: allShortcuts.filter((i) => i.category === 'care').length,
      admin: allShortcuts.filter((i) => i.category === 'admin').length,
    };
  }, [allShortcuts]);

  const quickFilterTags = [
    { label: '🟢 เช็กชื่อเช้า', query: 'เช็กชื่อ' },
    { label: '📷 ตรวจข้อสอบ OMR', query: 'ข้อสอบ' },
    { label: '🔵 กรอกคะแนน', query: 'คะแนน' },
    { label: '🪥 แปรงฟัน/อาหาร', query: 'แปรงฟัน' },
    { label: '🪙 บันทึกเงินออม', query: 'เงินออม' },
    { label: '🎓 ออก ปพ.5 / ปพ.6', query: 'ปพ' },
    { label: '🎲 วงล้อสุ่มชื่อ', query: 'สุ่ม' },
    { label: '📱 แจก QR ผู้ปกครอง', query: 'qr' },
    { label: '🧹 ตรวจเวรห้อง', query: 'เวร' },
  ];

  return (
    <div className="space-y-6">
      {/* 🚀 Welcome & Intent Search Box */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-teal-200/90 bg-gradient-to-br from-teal-500/10 via-sky-500/5 to-amber-500/10 p-4 sm:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/80 bg-teal-100/80 px-3 py-1 text-[11px] sm:text-xs font-black text-teal-800 shadow-2xs">
              <Sparkles size={13} className="text-teal-600" />
              <span>ศูนย์รวมทางลัดทุกเมนู (Easy Shortcut Hub)</span>
            </div>
            <h2 className="mt-2.5 text-xl font-black text-slate-900 tracking-tight sm:text-3xl">
              ต้องการทำอะไรในวันนี้ครับ?
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-600 max-w-xl leading-relaxed">
              เข้าถึงทุกเมนูง่ายๆ ในคลิกเดียว ไม่ต้องจำเมนูซับซ้อน ออกแบบเพื่อความสะดวก รวดเร็ว และเป็นมิตรกับคุณครูทุกคน
            </p>
          </div>

          {onSwitchToAnalytics && (
            <button
              type="button"
              onClick={onSwitchToAnalytics}
              className="inline-flex items-center gap-2 self-start md:self-auto rounded-xl sm:rounded-2xl border border-slate-300/90 bg-white/95 px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-teal-700 hover:border-teal-300"
              title="สลับไปดูแดชบอร์ดสถิติและการวิเคราะห์ห้องเรียน"
            >
              <span>📊 สลับไปดูสถิติภาพรวม</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* 🔎 Smart Search Bar */}
        <div className="relative mt-6 max-w-2xl">
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-slate-400" size={20} aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="พิมพ์สิ่งที่ต้องการทำ เช่น เช็กชื่อ, แปรงฟัน, กรอกคะแนน, ปพ.5, เงินออม, สุ่มชื่อ ..."
              className="w-full rounded-2xl border-2 border-teal-300/80 bg-white py-3.5 pl-12 pr-10 text-sm font-bold text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="ล้างคำค้นหา"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Tag Recommendations */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full -mx-2 px-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-[11px] font-black text-slate-500 mr-1 shrink-0 whitespace-nowrap">แนะนำ:</span>
            {quickFilterTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => setSearchQuery(tag.query)}
                className={`shrink-0 whitespace-nowrap rounded-xl border px-2.5 py-1 text-xs font-bold transition-all ${
                  searchQuery === tag.query
                    ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                    : 'border-slate-200 bg-white/90 text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ⭐ 5 เมนูยอดนิยมที่ต้องใช้บ่อยที่สุด (Primary Action Cards) */}
      {!searchQuery && activeCategory === 'all' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <span>5 เมนูยอดนิยมที่ต้องใช้บ่อยที่สุด</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">คลิกเดียวเข้าถึงทันที</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* Card 1: เช็กเวลาเรียน */}
            <Link
              to="/app/dashboard?view=teacher-work"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/15 hover:border-emerald-400 active:scale-[0.98]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    <CalendarClock size={24} aria-hidden="true" />
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black shadow-2xs border ${
                      attendanceChecked
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300 animate-bounce'
                    }`}
                  >
                    {attendanceChecked ? '✓ เช็กแล้ว' : '🔔 รอเช็กเช้า'}
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-black text-slate-950 group-hover:text-emerald-950 transition-colors">
                  เช็กเวลาเรียนวันนี้
                </h4>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {attendanceChecked
                    ? `ห้อง ${classroomName} บันทึกเรียบร้อยแล้ว`
                    : 'บันทึก มา สาย ลา ขาด ประจำวันอย่างรวดเร็ว'}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-emerald-100/90 pt-3 text-xs font-black text-emerald-700 group-hover:text-emerald-900">
                <span>{attendanceChecked ? 'ดูรายงานวันนี้' : 'กดเช็กชื่อทันที'}</span>
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1.5" />
              </div>
            </Link>

            {/* Card 2: กรอกคะแนน */}
            <Link
              to="/app/dashboard?view=scores&scoreView=excel"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/70 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-sky-500/15 hover:border-sky-400 active:scale-[0.98]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-600 text-white shadow-md shadow-sky-600/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <GraduationCap size={24} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-300 px-3 py-1 text-xs font-black shadow-2xs">
                    {assessmentCount} ชุดคะแนน
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-black text-slate-950 group-hover:text-sky-950 transition-colors">
                  สมุดกรอกคะแนน
                </h4>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  เปิดตารางคะแนนสไตล์ Excel กรอกง่าย ตัดเกรดอัตโนมัติ
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-sky-100/90 pt-3 text-xs font-black text-sky-700 group-hover:text-sky-900">
                <span>เปิดสมุดคะแนน</span>
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1.5" />
              </div>
            </Link>

            {/* Card 3: ตรวจข้อสอบ OMR (AI Scanner) */}
            <Link
              to="/app/dashboard?view=omr-scanner"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-cyan-300/90 bg-gradient-to-br from-cyan-50/95 via-white to-teal-50/70 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-cyan-500/20 hover:border-cyan-500 active:scale-[0.98]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-cyan-400 shadow-md shadow-slate-950/20 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 ring-1 ring-slate-800">
                    <ScanLine size={24} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 px-2.5 py-0.5 text-xs font-black shadow-2xs">
                    AI Vision
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-black text-slate-950 group-hover:text-cyan-950 transition-colors">
                  ตรวจข้อสอบ OMR
                </h4>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  สแกนกระดาษคำตอบผ่านกล้อง ออกแบบข้อสอบ & ตัดเกรด
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-cyan-100/90 pt-3 text-xs font-black text-cyan-700 group-hover:text-cyan-900">
                <span>เปิดระบบตรวจข้อสอบ</span>
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1.5" />
              </div>
            </Link>

            {/* Card 3: ทะเบียนนักเรียน */}
            <Link
              to="/app/dashboard?view=students"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-cyan-200/90 bg-gradient-to-br from-cyan-50/90 via-white to-blue-50/70 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-cyan-500/15 hover:border-cyan-400 active:scale-[0.98]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/30 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    <Users size={24} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 px-3 py-1 text-xs font-black shadow-2xs">
                    {studentCount} คนในห้อง
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-black text-slate-950 group-hover:text-cyan-950 transition-colors">
                  ข้อมูลนักเรียนรายคน
                </h4>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  ดูประวัติ, รูปถ่าย, เบอร์ติดต่อผู้ปกครอง และสถิติรายบุคคล
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-cyan-100/90 pt-3 text-xs font-black text-cyan-700 group-hover:text-cyan-900">
                <span>เปิดคลังนักเรียน</span>
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1.5" />
              </div>
            </Link>

            {/* Card 4: ปพ. & รายงาน */}
            <Link
              to="/app/dashboard?view=academic-hub"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/70 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/15 hover:border-indigo-400 active:scale-[0.98]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <BookOpen size={24} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-1 text-xs font-black shadow-2xs">
                    ปพ.5 / ปพ.6
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-black text-slate-950 group-hover:text-indigo-950 transition-colors">
                  ออกเอกสาร ปพ. & รายงาน
                </h4>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  พิมพ์สมุดประเมินผลการเรียน ปพ.5 และ ปพ.6 ตามมาตรฐาน สพฐ.
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-indigo-100/90 pt-3 text-xs font-black text-indigo-700 group-hover:text-indigo-900">
                <span>ไปศูนย์งาน ปพ.</span>
                <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1.5" />
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* 🏷️ Category Filter Tabs — Wrap gracefully on mobile so all categories are directly visible and clickable without scrolling issues */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          {/* Responsive Category Pills (Wraps on mobile, single line on desktop) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`flex items-center gap-1.5 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black transition-all active:scale-95 ${
                activeCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>🌟 ทุกเมนู</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{categoryCounts.all}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('daily')}
              className={`flex items-center gap-1.5 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black transition-all active:scale-95 ${
                activeCategory === 'daily'
                  ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-700/20'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span>☀️ 1. กิจวัตร & สุขภาพ</span>
              <span className="rounded-full bg-emerald-900/20 px-1.5 py-0.5 text-[10px]">{categoryCounts.daily}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('academic')}
              className={`flex items-center gap-1.5 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black transition-all active:scale-95 ${
                activeCategory === 'academic'
                  ? 'bg-sky-700 text-white shadow-sm ring-2 ring-sky-700/20'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
              }`}
            >
              <span>📚 2. คะแนน & การสอน</span>
              <span className="rounded-full bg-sky-900/20 px-1.5 py-0.5 text-[10px]">{categoryCounts.academic}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('care')}
              className={`flex items-center gap-1.5 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black transition-all active:scale-95 ${
                activeCategory === 'care'
                  ? 'bg-purple-700 text-white shadow-sm ring-2 ring-purple-700/20'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              <span>👨‍👩‍👧 3. เด็ก & ผู้ปกครอง</span>
              <span className="rounded-full bg-purple-900/20 px-1.5 py-0.5 text-[10px]">{categoryCounts.care}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('admin')}
              className={`flex items-center gap-1.5 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-black transition-all active:scale-95 ${
                activeCategory === 'admin'
                  ? 'bg-slate-700 text-white shadow-sm ring-2 ring-slate-700/20'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              <span>⚙️ 4. บริหาร & ตั้งค่า</span>
              <span className="rounded-full bg-slate-900/20 px-1.5 py-0.5 text-[10px]">{categoryCounts.admin}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-500 shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
            <span>
              แสดง <strong className="font-black text-slate-900">{filteredShortcuts.length}</strong> เมนู
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-black text-teal-700 hover:underline ml-2"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* 🗂️ Grid of All Shortcuts */}
        {filteredShortcuts.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredShortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`group relative flex flex-col justify-between rounded-3xl border bg-gradient-to-br ${item.accentColor.bg} ${item.accentColor.border} ${item.accentColor.hoverBorder} p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.99]`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.accentColor.iconBg} shadow-sm transition-transform duration-200 group-hover:scale-110`}>
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      {item.badge && (
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${item.badgeTone || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <h4 className="mt-3.5 text-base font-black text-slate-900 group-hover:text-slate-950 transition-colors">
                      {item.title}
                    </h4>
                    <p className="mt-0.5 text-xs font-bold text-slate-600 line-clamp-1">
                      {item.subtitle}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className={`mt-4 flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs font-black ${item.accentColor.text}`}>
                    <span>เข้าใช้งาน</span>
                    <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
            <span className="text-3xl">🔍</span>
            <h4 className="mt-2 text-base font-black text-slate-800">ไม่พบเมนูที่ตรงกับ "{searchQuery}"</h4>
            <p className="mt-1 text-xs font-bold text-slate-500">
              ลองค้นหาด้วยคำอื่น เช่น "เช็กชื่อ", "คะแนน", "ปพ", "อาหาร", "เงินออม" หรือกดปุ่มด้านล่างเพื่อล้างคำค้นหา
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-black text-white hover:bg-teal-700 shadow-sm transition"
            >
              <span>แสดงทุกเมนู</span>
            </button>
          </div>
        )}
      </section>

      {/* 💡 Help & Friendly Tip for Beginners */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800">
            <Sparkles size={20} />
          </span>
          <div>
            <h4 className="text-sm font-black text-slate-900">ยังไม่แน่ใจว่าจะเริ่มตรงไหนดี?</h4>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              เริ่มต้นง่ายๆ ด้วยการกด <strong className="text-emerald-700">"เช็กเวลาเรียนวันนี้"</strong> ในตอนเช้า และ <strong className="text-sky-700">"สมุดกรอกคะแนน"</strong> ในคาบสอน
            </p>
          </div>
        </div>

        <Link
          to="/app/dashboard?view=help-center"
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
        >
          <CircleHelp size={16} className="text-slate-500" />
          <span>ดูคู่มือและวิดีโอสอน</span>
        </Link>
      </section>
    </div>
  );
}
