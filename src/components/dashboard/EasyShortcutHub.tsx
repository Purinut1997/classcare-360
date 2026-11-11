import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  DatabaseZap,
  Dice5,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Heart,
  HeartPulse,
  PiggyBank,
  School,
  ScanLine,
  Search,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppNavigationLink as Link } from '../navigation/ContextLink';
import { CLASSROOM_GAMES_URL } from '../../routes/appRoutes';
import type { AppSessionContext } from '../../types/core';
import type { ClassroomAnalyticsData } from './ClassroomAnalyticsCharts';

export type ShortcutCategory = 'classroom-admin' | 'academic' | 'care' | 'tools' | 'admin';

export const SHORTCUT_CATEGORIES = [
  {
    key: 'classroom-admin' as const,
    label: 'งานประจำวันในห้องเรียน',
    icon: '📁',
    badge: '⭐ 6 ภารกิจหลักครูประจำชั้น',
    desc: 'รวม 6 ภารกิจหลักของครูประจำชั้นไว้ในที่เดียว: ทะเบียน เช็กชื่อ สุขภาพ เวร เงินออม และสรุปรายวัน',
    theme: {
      frameBg: 'bg-[#f1fcf5]',
      frameBorder: 'border-2 border-emerald-200/95 shadow-sm',
      headerIconBg: 'bg-emerald-500 text-white shadow-sm',
      headerTitle: 'text-emerald-950',
      headerBadge: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      headerDesc: 'text-emerald-800/85',
      divider: 'border-dashed border-emerald-200',
      tabActive: 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20',
    },
  },
  {
    key: 'academic' as const,
    label: 'งานวิชาการ & วัดผล',
    icon: '📚',
    badge: '5 เมนูหลัก',
    desc: 'ตารางสอน สมุดคะแนน ตรวจข้อสอบ OMR ศูนย์วิชาการ และพิมพ์รายงาน ปพ.',
    theme: {
      frameBg: 'bg-[#f0f7ff]',
      frameBorder: 'border-2 border-sky-200/95 shadow-sm',
      headerIconBg: 'bg-sky-500 text-white shadow-sm',
      headerTitle: 'text-sky-950',
      headerBadge: 'bg-sky-100 text-sky-900 border-sky-200',
      headerDesc: 'text-sky-800/85',
      divider: 'border-dashed border-sky-200',
      tabActive: 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500/20',
    },
  },
  {
    key: 'care' as const,
    label: 'ดูแลช่วยเหลือนักเรียน',
    icon: '💖',
    badge: '3 เมนูหลัก',
    desc: 'บันทึกพฤติกรรม ประเมินคุณลักษณะ 8 ประการ และแจ้งเตือนเด็กเสี่ยงขาด/ตก',
    theme: {
      frameBg: 'bg-[#fff3f6]',
      frameBorder: 'border-2 border-rose-200/95 shadow-sm',
      headerIconBg: 'bg-rose-500 text-white shadow-sm',
      headerTitle: 'text-rose-950',
      headerBadge: 'bg-rose-100 text-rose-900 border-rose-200',
      headerDesc: 'text-rose-800/85',
      divider: 'border-dashed border-rose-200',
      tabActive: 'bg-rose-500 text-white shadow-sm ring-2 ring-rose-500/20',
    },
  },
  {
    key: 'tools' as const,
    label: 'เครื่องมือช่วยสอน',
    icon: '🛠️',
    badge: '2 เมนูหลัก',
    desc: 'วงล้อสุ่มนักเรียน & จัดกลุ่ม และปฏิทินโรงเรียน',
    theme: {
      frameBg: 'bg-[#fff9ea]',
      frameBorder: 'border-2 border-amber-200/95 shadow-sm',
      headerIconBg: 'bg-amber-500 text-white shadow-sm',
      headerTitle: 'text-amber-950',
      headerBadge: 'bg-amber-100 text-amber-900 border-amber-200',
      headerDesc: 'text-amber-800/85',
      divider: 'border-dashed border-amber-200',
      tabActive: 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-400/25',
    },
  },
  {
    key: 'admin' as const,
    label: 'ตั้งค่าโรงเรียน & ระบบ',
    icon: '⚙️',
    badge: '5 เมนูหลัก',
    desc: 'ตั้งค่าโรงเรียน จัดการปีการศึกษา ล็อกงวด นำเข้า/ส่งออก และสำรองข้อมูล',
    theme: {
      frameBg: 'bg-[#fbf7ee]',
      frameBorder: 'border-2 border-[#e3d6c1] shadow-sm',
      headerIconBg: 'bg-stone-700 text-white shadow-sm',
      headerTitle: 'text-stone-900',
      headerBadge: 'bg-amber-100/70 text-stone-800 border-[#ded1bc]',
      headerDesc: 'text-stone-600',
      divider: 'border-dashed border-[#dfd0b8]',
      tabActive: 'bg-stone-800 text-white shadow-sm ring-2 ring-stone-700/20',
    },
  },
] as const;

interface ShortcutItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  path: string;
  externalUrl?: string;
  badge?: string;
  badgeTone?: string;
  category: ShortcutCategory;
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
  session: AppSessionContext;
}

export function EasyShortcutHub({
  analyticsData,
  classroomName: _classroomName = 'ห้องเรียน',
  isHomeroom: _isHomeroom = false,
  session: _session,
}: EasyShortcutHubProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | ShortcutCategory>('all');

  const attendanceChecked = analyticsData?.dataCompleteness.attendanceCheckedToday ?? false;
  const studentCount = analyticsData?.dataCompleteness.studentsCount ?? 0;
  const assessmentCount = analyticsData?.scores.assessmentCount ?? 0;
  const savingsAccounts = analyticsData?.savings.accountCount ?? 0;

  // คลังเมนูทั้งหมดที่จัดเรียงตามโครงสร้างหมวดหมู่ใหม่
  const allShortcuts: ShortcutItem[] = useMemo(() => {
    return [
      // =========================================================================
      // 📁 หมวด 1: ธุรการชั้นเรียน (Classroom Administration - 6 ภารกิจหลัก)
      // =========================================================================
      {
        id: 'students',
        title: 'รายชื่อและทะเบียนนักเรียน',
        subtitle: 'ดูข้อมูลนักเรียนรายคน รูปถ่าย เบอร์โทร',
        description: 'ค้นหาประวัตินักเรียน, ข้อมูลติดต่อผู้ปกครอง, สถิติการมาเรียน และคะแนนรายบุคคลครบในจุดเดียว',
        keywords: ['นักเรียน', 'รายชื่อ', 'ประวัติ', 'รูปถ่าย', 'เบอร์โทร', 'ที่อยู่', 'ผู้ปกครอง', 'student', 'students'],
        icon: Users,
        path: '/app/dashboard?view=students',
        badge: `${studentCount} คนในห้อง`,
        badgeTone: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        category: 'classroom-admin',
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
        id: 'attendance',
        title: 'เช็กชื่อและสถิติเวลาเรียน',
        subtitle: 'บันทึก มา สาย ลา ขาด ประจำวัน',
        description: 'เช็กเวลาเรียนเช้าหรือรายวิชา บันทึกเหตุผลการลา ส่งต่อยอดเข้าสถิติอัตโนมัติ',
        keywords: ['เช็กชื่อ', 'เวลาเรียน', 'เข้าแถว', 'มาเรียน', 'สาย', 'ลา', 'ขาด', 'teacher-work', 'attendance'],
        icon: CalendarClock,
        path: '/app/dashboard?view=teacher-work',
        badge: attendanceChecked ? '✓ เช็กแล้ว' : '🔔 รอเช็กเช้า',
        badgeTone: attendanceChecked ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200',
        category: 'classroom-admin',
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
        title: 'สุขภาพและกิจวัตรประจำวัน',
        subtitle: 'ชั่งน้ำหนัก-ส่วนสูง, แปรงฟัน, ดื่มนม',
        description: 'บันทึกการแปรงฟัน ดื่มนม ชั่งน้ำหนัก-ส่วนสูงตามเกณฑ์กรมอนามัย และข้อมูลสุขภาพนักเรียน',
        keywords: ['สุขภาพ', 'แปรงฟัน', 'นม', 'ดื่มนม', 'น้ำหนัก', 'ส่วนสูง', 'bmi', 'student-health', 'health'],
        icon: HeartPulse,
        path: '/app/dashboard?view=student-health',
        badge: 'กิจวัตรเช้า-เที่ยง',
        badgeTone: 'bg-teal-100 text-teal-800 border-teal-200',
        category: 'classroom-admin',
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
        id: 'classroom-operations',
        title: 'ตารางเวรทำความสะอาดและกิจวัตร',
        subtitle: 'เวรทำความสะอาดห้องเรียน และเช็กความพร้อม',
        description: 'จัดตารางเวร เช็กการปฏิบัติหน้าที่เวรประจำวัน และดูแลความสะอาดเรียบร้อยของห้องเรียน',
        keywords: ['เวร', 'เวรประจำวัน', 'ทำความสะอาด', 'จิตพิสัย', 'เวรห้อง', 'classroom-operations'],
        icon: ClipboardCheck,
        path: '/app/dashboard?view=classroom-operations',
        category: 'classroom-admin',
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
        id: 'savings',
        title: 'สมุดเงินออมนักเรียน',
        subtitle: 'ฝาก-ถอนเงินออม ประจำวัน/สัปดาห์',
        description: 'บันทึกยอดเงินฝากรายวัน ออกใบเสร็จยอดเงิน และดูยอดเงินรวมทั้งห้อง',
        keywords: ['เงินออม', 'ออมเงิน', 'ฝากเงิน', 'ถอนเงิน', 'ธนาคาร', 'เงิน', 'savings'],
        icon: PiggyBank,
        path: '/app/dashboard?view=savings',
        badge: `${savingsAccounts} บัญชี`,
        badgeTone: 'bg-amber-100 text-amber-800 border-amber-200',
        category: 'classroom-admin',
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
        id: 'daily-brief',
        title: 'สรุปบันทึกประจำวันครู',
        subtitle: 'สรุปเด็กขาด ข้อมูลสำคัญใน 1 หน้ากระดาษ',
        description: 'รวมยอดนักเรียน มา ลา ขาด บันทึกประจำวัน และกิจกรรมสำคัญสำหรับส่งรายงานครูเวรหรือฝ่ายบริหาร',
        keywords: ['สรุป', 'daily brief', 'รายงานประจำวัน', 'สรุปเช้า', 'ยอดมาเรียน', 'ส่งผอ', 'daily-brief'],
        icon: FileText,
        path: '/app/dashboard?view=daily-brief',
        category: 'classroom-admin',
        accentColor: {
          bg: 'from-teal-500/10 via-white to-emerald-500/5',
          text: 'text-teal-700',
          border: 'border-teal-200/80',
          hoverBorder: 'hover:border-teal-400',
          ring: 'focus:ring-teal-400',
          iconBg: 'bg-teal-600 text-white shadow-teal-500/30',
        },
      },

      // =========================================================================
      // 📚 หมวด 2: งานวิชาการ & วัดผล (Academic & Assessment - 5 เมนู)
      // =========================================================================
      {
        id: 'schedule',
        title: 'ตารางสอน / ตารางเรียน',
        subtitle: 'ดูตารางสอนประจำสัปดาห์ คาบเรียนวันนี้',
        description: 'ดูว่าวันนี้มีสอนวิชาอะไร คาบไหน ห้องไหน และจัดตารางเรียนของห้อง',
        keywords: ['ตารางสอน', 'ตารางเรียน', 'คาบเรียน', 'สอน', 'วิชา', 'schedule'],
        icon: CalendarRange,
        path: '/app/dashboard?view=schedule',
        category: 'academic',
        accentColor: {
          bg: 'from-sky-500/10 via-white to-blue-500/5',
          text: 'text-sky-700',
          border: 'border-sky-200/80',
          hoverBorder: 'hover:border-sky-400',
          ring: 'focus:ring-sky-400',
          iconBg: 'bg-sky-600 text-white shadow-sky-500/30',
        },
      },
      {
        id: 'scores',
        title: 'สมุดคะแนนและตัดเกรด',
        subtitle: 'กรอกคะแนนเก็บ กลางภาค ปลายภาค',
        description: 'หน้าตารางคะแนนแบบ Excel ใช้งานคุ้นเคย รองรับการคำนวณเกรดและตัดเกรดอัตโนมัติ',
        keywords: ['คะแนน', 'กรอกคะแนน', 'สมุดคะแนน', 'เกรด', 'สอบ', 'scores'],
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
        title: 'ตรวจข้อสอบ OMR',
        subtitle: 'ตรวจกระดาษคำตอบผ่านกล้อง ออกแบบข้อสอบ & ตัดเกรด',
        description: 'สแกนตรวจกระดาษคำตอบด้วยกล้องมือถือ/เว็บแคม นับคะแนนอัตโนมัติ ออกแบบชุดข้อสอบพร้อม QR Code',
        keywords: ['omr', 'ข้อสอบ', 'ตรวจข้อสอบ', 'กระดาษคำตอบ', 'สแกน', 'omr-scanner'],
        icon: ScanLine,
        path: '/app/dashboard?view=omr-scanner',
        badge: 'AI Vision',
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
        title: 'ศูนย์วิชาการและเอกสาร ปพ.',
        subtitle: 'ออกเอกสาร ปพ.5, ปพ.6, ใบเกรด',
        description: 'พิมพ์ ปพ.5 สมุดประเมินผลการเรียน, ปพ.6 รายงานประจำตัวนักเรียน และส่งออก PDF ครบชุด',
        keywords: ['ปพ', 'ปพ.5', 'ปพ.6', 'ทะเบียน', 'วิชาการ', 'ใบเกรด', 'academic-hub'],
        icon: BookOpen,
        path: '/app/dashboard?view=academic-hub',
        badge: 'ปพ.5 / ปพ.6',
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
        id: 'reports',
        title: 'พิมพ์รายงาน',
        subtitle: 'ออกรายงานสถิติเวลาเรียน และแบบสรุป',
        description: 'สร้างรายงานสรุปรายเดือน รายเทอม ทั้งรูปแบบตารางและกราฟ ส่งออกเป็น Excel / PDF ได้ทันที',
        keywords: ['รายงาน', 'สถิติ', 'สรุปเวลาเรียน', 'พิมพ์รายงาน', 'reports'],
        icon: FileSpreadsheet,
        path: '/app/dashboard?view=reports&reportView=attendance',
        category: 'academic',
        accentColor: {
          bg: 'from-indigo-500/10 via-white to-purple-500/5',
          text: 'text-indigo-700',
          border: 'border-indigo-200/80',
          hoverBorder: 'hover:border-indigo-400',
          ring: 'focus:ring-indigo-400',
          iconBg: 'bg-indigo-600 text-white shadow-indigo-500/30',
        },
      },

      // =========================================================================
      // 💖 หมวด 3: ดูแลช่วยเหลือนักเรียน (Student Care - 3 เมนู)
      // =========================================================================
      {
        id: 'behavior',
        title: 'บันทึกพฤติกรรมและความดี',
        subtitle: 'บวกแต้มความดี และตักเตือนพฤติกรรม',
        description: 'สะสมแต้มคะแนนพฤติกรรม บันทึกความมีวินัย จิตอาสา และเตือนพฤติกรรมที่ไม่เหมาะสม',
        keywords: ['พฤติกรรม', 'ความดี', 'ตัดแต้ม', 'บวกแต้ม', 'คะแนนพฤติกรรม', 'behavior'],
        icon: Heart,
        path: '/app/dashboard?view=behavior',
        category: 'care',
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
        id: 'desirable-characteristics',
        title: 'ประเมินคุณลักษณะ 8 ประการ',
        subtitle: 'เกณฑ์การประเมินมาตรฐาน สพฐ.',
        description: 'ประเมิน 8 ข้อ (รักชาติ, ซื่อสัตย์, ใฝ่เรียนรู้ ฯลฯ) ตัดเกรด ดีเยี่ยม, ดี, ผ่าน เพื่อส่ง ปพ.',
        keywords: ['คุณลักษณะ', '8 ประการ', 'สพฐ', 'ประเมินคุณลักษณะ', 'desirable-characteristics'],
        icon: Award,
        path: '/app/dashboard?view=desirable-characteristics',
        category: 'care',
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
        title: 'ติดตามนักเรียนที่ควรดูแล',
        subtitle: 'Automation & Early Warning',
        description: 'ตรวจจับเด็กที่ขาดเรียนเกินเกณฑ์, คะแนนต่ำกว่าเป้า หรือยังไม่ส่งงาน พร้อมแนะนำแนวทางแก้ไข',
        keywords: ['เสี่ยง', 'เตือน', 'ขาดบ่อย', 'งานค้าง', 'automation', 'warning'],
        icon: Workflow,
        path: '/app/dashboard?view=automation',
        badge: 'เด็กกลุ่มเสี่ยง',
        badgeTone: 'bg-purple-100 text-purple-800 border-purple-200',
        category: 'care',
        accentColor: {
          bg: 'from-purple-500/10 via-white to-fuchsia-500/5',
          text: 'text-purple-700',
          border: 'border-purple-200/80',
          hoverBorder: 'hover:border-purple-400',
          ring: 'focus:ring-purple-400',
          iconBg: 'bg-purple-600 text-white shadow-purple-500/30',
        },
      },

      // =========================================================================
      // 🛠️ หมวด 4: เครื่องมือช่วยสอน (Teacher Tools - 2 เมนู)
      // =========================================================================
      {
        id: 'randomizer',
        title: 'เกมคณิตศาสตร์ในห้องเรียน',
        subtitle: 'เปิดคลังเกมและกิจกรรมสำหรับห้องเรียน',
        description: 'รวมเกมคณิตศาสตร์สำหรับใช้สอนและทำกิจกรรมร่วมกับนักเรียน',
        keywords: ['สุ่ม', 'วงล้อ', 'สุ่มชื่อ', 'สุ่มเลขที่', 'ตอบคำถาม', 'จัดกลุ่ม', 'randomizer'],
        icon: Dice5,
        path: '/app/dashboard?view=randomizer',
        externalUrl: CLASSROOM_GAMES_URL,
        badge: 'ช่วยสอนสนุกขึ้น',
        badgeTone: 'bg-rose-100 text-rose-800 border-rose-200',
        category: 'tools',
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
        id: 'school-calendar',
        title: 'ปฏิทินโรงเรียน',
        subtitle: 'ดูวันหยุดราชการ วันสอบ และกิจกรรม',
        description: 'ปฏิทินรวมกิจกรรมของโรงเรียน วันเปิด-ปิดภาคเรียน กำหนดการสอบ และวันหยุดพิเศษ',
        keywords: ['ปฏิทิน', 'วันหยุด', 'กิจกรรม', 'วันสอบ', 'school-calendar', 'calendar'],
        icon: CalendarDays,
        path: '/app/dashboard?view=school-calendar',
        category: 'tools',
        accentColor: {
          bg: 'from-amber-500/10 via-white to-orange-500/5',
          text: 'text-amber-700',
          border: 'border-amber-200/80',
          hoverBorder: 'hover:border-amber-400',
          ring: 'focus:ring-amber-400',
          iconBg: 'bg-amber-600 text-white shadow-amber-500/30',
        },
      },

      // =========================================================================
      // ⚙️ หมวด 5: ตั้งค่าโรงเรียน & ระบบ (School Management - 4 เมนู)
      // =========================================================================
      {
        id: 'workspace-settings',
        title: 'ตั้งค่าโรงเรียนและห้องเรียน',
        subtitle: 'ตั้งชื่อห้อง, เพิ่มครูร่วม, เชิญสมาชิก',
        description: 'จัดการข้อมูลห้องเรียน กำหนดครูประจำชั้น เชิญครูผู้สอนร่วม และอนุมัติคำขอเข้าร่วม',
        keywords: ['ตั้งค่า', 'ห้องเรียน', 'ครูประจำชั้น', 'เชิญครู', 'workspace-settings'],
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
        title: 'จัดการปีการศึกษา',
        subtitle: 'คลังเก็บข้อมูลปีเก่า และขึ้นปีการศึกษาใหม่',
        description: 'เลื่อนชั้นนักเรียนขึ้นระดับถัดไป จัดเก็บข้อมูลประวัติของปีที่ผ่านมา และเปิดเทอมใหม่',
        keywords: ['เลื่อนชั้น', 'ปิดเทอม', 'ปีการศึกษา', 'จบการศึกษา', 'academic-year'],
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
        title: 'ล็อกงวดข้อมูล',
        subtitle: 'ป้องกันการแก้ไขข้อมูลหลังปิดงวด',
        description: 'ตรวจสอบและจัดการช่วงเวลาที่ปิดแก้ไขข้อมูลไว้',
        keywords: ['ล็อกงวด', 'ปิดงวด', 'period locks', 'งวดข้อมูล'],
        icon: CalendarRange,
        path: '/app/dashboard?view=period-locks',
        category: 'admin',
        accentColor: {
          bg: 'from-amber-500/10 via-white to-orange-500/5',
          text: 'text-amber-800',
          border: 'border-amber-200/80',
          hoverBorder: 'hover:border-amber-400',
          ring: 'focus:ring-amber-400',
          iconBg: 'bg-amber-600 text-white shadow-amber-600/30',
        },
      },
      {
        id: 'import-export',
        title: 'นำเข้าและส่งออกข้อมูล',
        subtitle: 'อัปโหลด Excel รายชื่อเด็ก และส่งออกข้อมูล',
        description: 'นำเข้ารายชื่อนักเรียนใหม่จากไฟล์ Excel หรือระบบจัดเก็บข้อมูลนักเรียน (DMC)',
        keywords: ['นำเข้า', 'ส่งออก', 'อัปโหลด', 'excel', 'dmc', 'import-export'],
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
        id: 'data-safety',
        title: 'สำรองข้อมูลและกู้คืน',
        subtitle: 'สำรองฐานข้อมูล กู้คืน และความปลอดภัย',
        description: 'สำรองฐานข้อมูลของโรงเรียน ตรวจสอบความสมบูรณ์ของข้อมูล และกู้คืนย้อนหลังได้ทุกเมื่อ',
        keywords: ['สำรองข้อมูล', 'กู้คืน', 'ความปลอดภัย', 'backup', 'data-safety'],
        icon: DatabaseZap,
        path: '/app/dashboard?view=data-safety',
        category: 'admin',
        accentColor: {
          bg: 'from-slate-500/10 via-white to-gray-500/5',
          text: 'text-slate-700',
          border: 'border-slate-200/80',
          hoverBorder: 'hover:border-slate-400',
          ring: 'focus:ring-slate-400',
          iconBg: 'bg-slate-800 text-white shadow-slate-700/30',
        },
      },
    ];
  }, [analyticsData, attendanceChecked, studentCount, assessmentCount, savingsAccounts]);

  // ระบบค้นหาอัจฉริยะ (กรองตามคำค้นหาภาษาพูด)
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allShortcuts.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
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
      'classroom-admin': allShortcuts.filter((i) => i.category === 'classroom-admin').length,
      academic: allShortcuts.filter((i) => i.category === 'academic').length,
      care: allShortcuts.filter((i) => i.category === 'care').length,
      tools: allShortcuts.filter((i) => i.category === 'tools').length,
      admin: allShortcuts.filter((i) => i.category === 'admin').length,
    };
  }, [allShortcuts]);

  // จัดกลุ่มเมนูตามหมวดหมู่เพื่อแสดงในกรอบสี
  const groupedSections = useMemo(() => {
    return SHORTCUT_CATEGORIES.map((cat) => {
      if (activeCategory !== 'all' && cat.key !== activeCategory) {
        return null;
      }
      const items = filteredShortcuts.filter((item) => item.category === cat.key);
      if (items.length === 0) return null;
      return { category: cat, items };
    }).filter((section): section is { category: (typeof SHORTCUT_CATEGORIES)[number]; items: ShortcutItem[] } => Boolean(section));
  }, [filteredShortcuts, activeCategory]);

  const quickFilterTags = [
    { label: '🟢 เช็กชื่อเช้า', query: 'เช็กชื่อ' },
    { label: '🔵 กรอกคะแนน', query: 'คะแนน' },
    { label: '🪥 สุขภาพ/แปรงฟัน', query: 'สุขภาพ' },
    { label: '🎓 ออก ปพ.5 / ปพ.6', query: 'ปพ' },
  ];

  // Helper render card
  const renderCard = (item: ShortcutItem) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.id}
        externalUrl={item.externalUrl}
        to={item.path}
        className={`group relative flex flex-col justify-between rounded-[22px] border-2 ${item.accentColor.border} ${item.accentColor.hoverBorder} bg-white/95 p-4 shadow-[0_3px_0_rgba(120,90,45,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.99] sm:p-5`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.accentColor.iconBg} shadow-sm transition-transform duration-200 group-hover:scale-105`}>
              <Icon size={21} aria-hidden="true" />
            </span>
            {item.badge && (
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${item.badgeTone || 'border-stone-200 bg-stone-100 text-stone-700'}`}>
                {item.badge}
              </span>
            )}
          </div>

          <h4 className="mt-3.5 text-base font-black text-slate-900 transition-colors group-hover:text-slate-950">
            {item.title}
          </h4>
          <p className="mt-0.5 line-clamp-1 text-xs font-bold text-stone-600">
            {item.subtitle}
          </p>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed text-stone-500">
            {item.description}
          </p>
        </div>

        <div className={`mt-4 flex items-center justify-between border-t border-dashed border-stone-200 pt-3 text-xs font-black ${item.accentColor.text}`}>
          <span>เข้าใช้งาน</span>
          <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {/* 🔎 Compact Stationery Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-[24px] border-2 border-[#e3d6c1] bg-[#fbf7ee] p-3.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex flex-1 items-center lg:max-w-md">
          <Search className="absolute left-3.5 text-stone-400" size={16} aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="กรองเมนูในหน้านี้ เช่น เช็กชื่อ, คะแนน, ปพ.5..."
            className="w-full rounded-xl border border-[#d9cab3] bg-white py-2 pl-9 pr-8 text-xs font-bold text-slate-900 placeholder:text-stone-400 transition-all focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 sm:text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 grid h-6 w-6 place-items-center rounded-full bg-stone-200/80 text-stone-600 hover:bg-stone-300"
              aria-label="ล้างคำค้นหา"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickFilterTags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => setSearchQuery(searchQuery === tag.query ? '' : tag.query)}
              className={`shrink-0 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                searchQuery === tag.query
                  ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                  : 'border-[#dfd0b8] bg-white text-stone-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🏷️ Category Filter Tabs */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 border-b-2 border-dashed border-[#e3d6c1] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition-all active:scale-95 sm:px-4 sm:py-2.5 ${
                activeCategory === 'all'
                  ? 'bg-stone-900 text-white shadow-sm ring-2 ring-stone-900/15'
                  : 'border border-[#e3d6c1] bg-[#fbf7ee] text-stone-700 hover:bg-white'
              }`}
            >
              <span>🌟 ทุกเมนู</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeCategory === 'all' ? 'bg-white/20 text-white' : 'bg-[#ede4d5] text-stone-800'}`}>
                {categoryCounts.all}
              </span>
            </button>

            {SHORTCUT_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.key];
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition-all active:scale-95 sm:px-4 sm:py-2.5 ${
                    isActive
                      ? cat.theme.tabActive
                      : 'border border-[#e3d6c1] bg-[#fbf7ee] text-stone-700 hover:bg-white'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-[#ede4d5] text-stone-800'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex w-full shrink-0 items-center justify-between pt-1 text-xs font-bold text-stone-500 sm:w-auto sm:pt-0">
            <span>
              แสดง <strong className="font-black text-stone-900">{filteredShortcuts.length}</strong> เมนู
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="ml-2 text-xs font-black text-teal-700 hover:underline"
              >
                ล้างคำค้นหา
              </button>
            )}
          </div>
        </div>

        {/* 🗂️ Grid of Shortcuts Grouped by Pastel Stationery Category Frames */}
        {groupedSections.length > 0 ? (
          <div className="space-y-6 sm:space-y-8">
            {groupedSections.map(({ category: cat, items }) => (
              <div
                key={cat.key}
                id={`cat-frame-${cat.key}`}
                className={`relative overflow-hidden rounded-[28px] border-2 ${cat.theme.frameBorder} ${cat.theme.frameBg} p-4 transition-all duration-300 sm:p-6`}
              >
                {/* 🏷️ Distinct Category Header inside Frame */}
                <div className={`mb-4 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between ${cat.theme.divider}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${cat.theme.headerIconBg} text-xl`}>
                      {cat.icon}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-base font-black tracking-tight sm:text-lg ${cat.theme.headerTitle}`}>
                          {cat.label}
                        </h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${cat.theme.headerBadge}`}>
                          {cat.badge}
                        </span>
                        <span className="rounded-full border border-stone-200/80 bg-white/90 px-2.5 py-0.5 text-xs font-black text-stone-700">
                          {items.length} เมนู
                        </span>
                      </div>
                      <p className={`mt-0.5 text-xs font-semibold ${cat.theme.headerDesc}`}>
                        {cat.desc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 🎴 Cards Grid inside Frame */}
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(renderCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border-2 border-dashed border-[#dfd0b8] bg-[#fbf7ee] p-8 text-center">
            <span className="text-3xl">🔍</span>
            <h4 className="mt-2 text-base font-black text-stone-800">ไม่พบเมนูที่ตรงกับ "{searchQuery}"</h4>
            <p className="mt-1 text-xs font-bold text-stone-500">
              ลองค้นหาด้วยคำอื่น เช่น "เช็กชื่อ", "คะแนน", "ปพ", "อาหาร", "เงินออม" หรือกดปุ่มด้านล่างเพื่อล้างคำค้นหา
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-teal-700"
            >
              <span>แสดงทุกเมนู</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
