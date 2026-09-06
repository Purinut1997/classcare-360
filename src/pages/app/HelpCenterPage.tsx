import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileSpreadsheet,
  GraduationCap,
  LifeBuoy,
  Link as LinkIcon,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';

import { ContextLink } from '../../components/navigation/ContextLink';
import { canUseModule } from '../../lib/entitlements';
import { canManageWorkspace, roleLabels } from '../../lib/roles';
import type { AppSessionContext, ModuleKey, WorkspaceRole } from '../../types/core';

interface HelpCenterPageProps {
  session: AppSessionContext;
}

interface HelpLinkAccess {
  allowedRoles: WorkspaceRole[];
  moduleKey: ModuleKey;
}

export type GuideCategory =
  | 'all'
  | 'ai_exam'
  | 'mobile_ux'
  | 'schedule_cal'
  | 'scores_reports'
  | 'students_data'
  | 'admin_settings';

export interface GuideCard extends HelpLinkAccess {
  title: string;
  category: GuideCategory;
  categoryLabel: string;
  body: string;
  cta: string;
  href: string;
  tags: string[];
  isNew?: boolean;
}

const teacherRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner', 'teacher_member'];
const ownerRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner'];
const reportRoles: WorkspaceRole[] = [...teacherRoles, 'viewer'];

const startSteps: Array<HelpLinkAccess & { title: string; body: string; href: string }> = [
  {
    title: '1. ตั้งค่าโรงเรียน & ผู้ลงนาม 4 ฝ่าย',
    body: 'กรอกชื่อโรงเรียน ปีการศึกษา ห้องหลัก โลโก้ และผู้มีอำนาจลงนาม (ผอ., วิชาการ, ทะเบียน, ครูประจำชั้น) เพื่อให้รายงานทุกฉบับประทับหัวเอกสารถูกต้อง',
    href: '/app/dashboard?view=workspace-settings#workspace-profile',
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: '2. เพิ่มห้องเรียน & นำเข้านักเรียน',
    body: 'สร้างห้องเรียนตามระดับชั้น แล้วนำเข้ารายชื่อผ่านไฟล์ DMC Excel หรือ CSV ตรวจสอบปีและห้องให้เรียบร้อยก่อนเริ่มงานประจำวัน',
    href: '/app/dashboard?view=import-export',
    allowedRoles: ownerRoles,
    moduleKey: 'import_export',
  },
  {
    title: '3. ตรวจสอบคุณภาพข้อมูล (Data Quality)',
    body: 'เช็กรายชื่อซ้ำ นักเรียนไม่มีห้อง นักเรียนผิดปี หรือ import รอบล่าสุดที่ต้องลบ/กู้คืน เพื่อให้สถิตินักเรียนถูกต้อง 100%',
    href: '/app/dashboard?view=students&studentView=quality',
    allowedRoles: teacherRoles,
    moduleKey: 'students',
  },
  {
    title: '4. จัดตารางสอน & ปฏิทินโรงเรียน',
    body: 'ตั้งคาบเรียน พักเที่ยง วันเรียน รายวิชา และห้องเรียน พร้อมกำหนดวันเปิด-ปิดเทอม วันสอบ และกิจกรรมสถานศึกษาบนปฏิทิน',
    href: '/app/dashboard?view=schedule&scheduleView=settings',
    allowedRoles: teacherRoles,
    moduleKey: 'attendance',
  },
  {
    title: '5. เริ่มงานครู ออกข้อสอบ AI & รายงาน ปพ.',
    body: 'เช็กชื่อ เช็กรายวิชา ใช้ AI ออกข้อสอบพร้อม Test Blueprint กรอกคะแนน ตัดเกรด และพิมพ์ ปพ.5 / ปพ.6 สรุปส่งฝ่ายวิชาการ',
    href: '/app/dashboard?view=scores',
    allowedRoles: teacherRoles,
    moduleKey: 'scores',
  },
];

const guideCards: GuideCard[] = [
  {
    title: '✨ การออกข้อสอบกลางภาค / ปลายภาค ด้วย AI (หลายหน่วย & Test Blueprint)',
    category: 'ai_exam',
    categoryLabel: 'AI & ออกข้อสอบ',
    body: 'ออกแบบข้อสอบกลางภาค/ปลายภาคโดยยึดหน่วยการเรียนรู้เป็นตัวหลัก ใส่ได้หลายหน่วย ระบบมี AI ช่วยวิเคราะห์ตัวชี้วัด สพฐ. จากหน่วยอัตโนมัติ พร้อมระบบจัดสรรจำนวนข้อสอบ (โหมดสมดุล/โหมดกำหนดเอง) บังคับแสดงตัวชี้วัดกำกับท้ายข้อ และสร้างผัง Test Blueprint สำหรับส่งวิชาการ',
    cta: 'เปิดศูนย์ออกแบบข้อสอบ AI',
    href: '/app/dashboard?view=scores',
    tags: ['exam', 'blueprint', 'ข้อสอบ', 'กลางภาค', 'ปลายภาค', 'ตัวชี้วัด', 'หน่วยการเรียนรู้', 'สพฐ', 'ai'],
    allowedRoles: teacherRoles,
    moduleKey: 'scores',
    isNew: true,
  },
  {
    title: '✨ การออกแบบเกณฑ์ประเมินรูบริก 4 ระดับ (Rubric 4 Levels)',
    category: 'ai_exam',
    categoryLabel: 'AI & ออกข้อสอบ',
    body: 'ระบุภาระงานหรือชิ้นงานที่ต้องการประเมิน ให้ AI ช่วยแตกมิติการประเมิน พร้อมกำหนดเกณฑ์ 4 ระดับ (ระดับ 4 ดีเยี่ยม, ระดับ 3 ดี, ระดับ 2 พอใช้, ระดับ 1 ปรับปรุง) พร้อมแนวทางการให้คะแนนที่ตรงตามมาตรฐาน สพฐ.',
    cta: 'สร้างเกณฑ์รูบริก AI',
    href: '/app/dashboard?view=scores',
    tags: ['rubric', 'รูบริก', 'เกณฑ์ประเมิน', '4 ระดับ', 'สพฐ', 'ai'],
    allowedRoles: teacherRoles,
    moduleKey: 'scores',
    isNew: true,
  },
  {
    title: '✨ การออกข้อสอบซ่อมเสริมเฉพาะจุด (Remedial Quiz)',
    category: 'ai_exam',
    categoryLabel: 'AI & ออกข้อสอบ',
    body: 'เลือกเนื้อหาหรือมโนทัศน์ที่นักเรียนมักทำผิดบ่อย กำหนดจำนวนข้อสอบได้อิสระ 1-30 ข้อ พร้อมเลือกรูปแบบตัวเลือก (4 ชอยส์มาตรฐาน สพฐ., 3 ชอยส์เด็กเล็ก, 5 ชอยส์มัธยม, หรือ ถูก/ผิด) พร้อมเฉลยละเอียดและวิเคราะห์ตัวลวง',
    cta: 'สร้างข้อสอบซ่อมเสริม',
    href: '/app/dashboard?view=scores',
    tags: ['quiz', 'remedial', 'ซ่อมเสริม', 'ข้อสอบ', 'ปรนัย', 'ตัวลวง', 'ai'],
    allowedRoles: teacherRoles,
    moduleKey: 'scores',
    isNew: true,
  },
  {
    title: '🤖 การใช้งานแชทบอทผู้ช่วยครู "น้องแคร์ AI" & ตารางสอนรายวัน',
    category: 'ai_exam',
    categoryLabel: 'AI & ออกข้อสอบ',
    body: 'แตะปุ่มกลม "น้องแคร์ AI" ที่อยู่ตรงกลางแถบเมนูล่าง เพื่อถามคำถามตารางสอน เช่น "บอกตารางสอนวันจันทร์", "วันนี้มีสอนคาบไหนบ้าง", "สรุปสถิติมาเรียน", "วิเคราะห์พฤติกรรมนักเรียน" AI จะดึงข้อมูลโรงเรียนและห้องเรียนจริงมาตอบทันที',
    cta: 'เปิดหน้าแรกเพื่อคุยกับ AI',
    href: '/app/dashboard?view=overview',
    tags: ['ai', 'chatbot', 'น้องแคร์', 'ตารางสอน', 'ถามตอบ', 'ผู้ช่วยครู'],
    allowedRoles: teacherRoles,
    moduleKey: 'support',
    isNew: true,
  },
  {
    title: '📱 การใช้งานระบบบนสมาร์ทโฟน & แผงเมนูด่วน (Mobile Super-App)',
    category: 'mobile_ux',
    categoryLabel: 'สมาร์ทโฟน',
    body: 'แถบเมนูด้านล่าง 5 ช่องสมมาตร ออกแบบให้ใช้งานสะดวกด้วยนิ้วโป้ง ช่องตรงกลางคือปุ่มยกสูง "น้องแคร์ AI" พร้อมแสงเรืองนีออน และช่องขวาสุดสำหรับเปิด "แผงรวมเมนูและงานครู 12 โมดูล สพฐ." พร้อมช่องค้นหาด่วน (Live Search) ให้เข้าถึงทุกหน้าใน 1 วินาที',
    cta: 'ดูหน้าหลักบนมือถือ',
    href: '/app/dashboard?view=overview',
    tags: ['mobile', 'dock', 'มือถือ', 'เมนู', 'quick launcher', 'สมาร์ทโฟน'],
    allowedRoles: teacherRoles,
    moduleKey: 'support',
    isNew: true,
  },
  {
    title: '📅 การใช้งานปฏิทินโรงเรียน & กำหนดกิจกรรมสถานศึกษา',
    category: 'schedule_cal',
    categoryLabel: 'ตารางสอน & ปฏิทิน',
    body: 'บันทึกวันเปิด-ปิดภาคเรียน วันสอบกลางภาค/ปลายภาค วันหยุดราชการ และกิจกรรมวิชาการ แสดงผลจุดสี (Dots Indicator) แยกหมวดหมู่อย่างเป็นระเบียบ ตัวย่อหัววันบนมือถืออ่านง่ายไม่ตกบรรทัด',
    cta: 'เปิดปฏิทินโรงเรียน',
    href: '/app/dashboard?view=calendar',
    tags: ['calendar', 'ปฏิทิน', 'วันหยุด', 'วันสอบ', 'กิจกรรม', 'กำหนดการ'],
    allowedRoles: reportRoles,
    moduleKey: 'attendance',
    isNew: true,
  },
  {
    title: '⏰ การจัดตารางสอนและบันทึกเวลาเรียนรายวิชา',
    category: 'schedule_cal',
    categoryLabel: 'ตารางสอน & ปฏิทิน',
    body: 'ตั้งคาบเรียน เวลาพักเที่ยง วันเรียน รายวิชา และห้องเรียน (เช่น ห้อง ป.5/1) ระบบรองรับการแสดงผลตารางสอนแบบการ์ดไทม์ไลน์รายวันบนมือถือ และเชื่อมโยงกับการเช็กชื่อรายวิชาทันที',
    cta: 'เปิดตารางสอน',
    href: '/app/dashboard?view=schedule&scheduleView=settings',
    tags: ['schedule', 'ตารางสอน', 'คาบเรียน', 'รายวิชา', 'เวลาเรียน', 'เช็กชื่อ'],
    allowedRoles: teacherRoles,
    moduleKey: 'attendance',
  },
  {
    title: '📊 การบันทึกคะแนน ตัดเกรด 0-4 และสมุดรวมคะแนน',
    category: 'scores_reports',
    categoryLabel: 'คะแนน & รายงาน',
    body: 'สร้างชุดคะแนนตามสัดส่วน (กลางภาค/ปลายภาค/เก็บย่อย) บันทึกคะแนนแบบตาราง Excel-grid คัดลอก-วางได้ ตัดเกรด 0-4 และสรุปผลประเมินอัตโนมัติตามระเบียบวัดและประเมินผลของกระทรวงศึกษาธิการ',
    cta: 'เปิดสมุดบันทึกคะแนน',
    href: '/app/dashboard?view=scores&scoreView=excel',
    tags: ['score', 'assessment', 'คะแนน', 'ตัดเกรด', 'ปพ.5', 'excel'],
    allowedRoles: teacherRoles,
    moduleKey: 'scores',
  },
  {
    title: '📄 การออกเอกสารทางการ ปพ.5 / ปพ.6 และรายงานราชการ',
    category: 'scores_reports',
    categoryLabel: 'คะแนน & รายงาน',
    body: 'พิมพ์เอกสารทางการ ปพ.5 สมุดบันทึกผลการพัฒนาคุณภาพผู้เรียน, ปพ.6 แบบรายงานผลการเรียนรายบุคคล และรายงานสถิติเวลาเรียน พร้อมประทับชื่อ-ตำแหน่งผู้มีอำนาจลงนาม 4 ฝ่ายอัตโนมัติ',
    cta: 'เปิดศูนย์รายงาน',
    href: '/app/dashboard?view=reports&reportView=attendance',
    tags: ['report', 'ปพ.5', 'ปพ.6', 'รายงาน', 'ผู้ลงนาม', 'pdf', 'xlsx'],
    allowedRoles: reportRoles,
    moduleKey: 'reports',
  },
  {
    title: '📥 การนำเข้ารายชื่อนักเรียนจาก DMC และตรวจ Data Quality',
    category: 'students_data',
    categoryLabel: 'ข้อมูลนักเรียน',
    body: 'นำเข้ารายชื่อนักเรียนจากไฟล์ Excel ระบบ DMC ของกระทรวงฯ หรือเทมเพลต CSV แล้วใช้ศูนย์ Data Quality เพื่อตรวจรายชื่อซ้ำ นักเรียนไม่มีห้อง หรือนักเรียนผิดปีการศึกษา พร้อมระบบกู้คืนข้อมูล',
    cta: 'ไปหน้านำเข้านักเรียน',
    href: '/app/dashboard?view=import-export',
    tags: ['import', 'dmc', 'csv', 'excel', 'data quality', 'นักเรียน', 'รายชื่อซ้ำ'],
    allowedRoles: ownerRoles,
    moduleKey: 'import_export',
  },
  {
    title: '🏥 ระบบดูแลช่วยเหลือนักเรียน 360 (Student 360 & เยี่ยมบ้าน กสศ.01)',
    category: 'students_data',
    categoryLabel: 'ข้อมูลนักเรียน',
    body: 'บันทึกข้อมูลนักเรียนรายบุคคล, บันทึกการเยี่ยมบ้านตามแบบ กสศ.01 แนบรูปถ่ายและพิกัดแผนที่, บันทึกคัดกรองสุขภาพกาย-ใจ, บันทึกพฤติกรรมเชิงบวก/แก้ไข และบันทึกเงินออมทรัพย์เพื่อการศึกษา',
    cta: 'เปิด Student 360',
    href: '/app/dashboard?view=students',
    tags: ['student 360', 'เยี่ยมบ้าน', 'กสศ.01', 'สุขภาพ', 'พฤติกรรม', 'เงินออม'],
    allowedRoles: teacherRoles,
    moduleKey: 'students',
  },
  {
    title: '⚙️ การตั้งค่าข้อมูลโรงเรียน โลโก้ และผู้มีอำนาจลงนาม 4 ฝ่าย',
    category: 'admin_settings',
    categoryLabel: 'ตั้งค่า & สิทธิ์',
    body: 'กรอกชื่อโรงเรียน สังกัด เขตพื้นที่การศึกษา อัปโหลดตราสัญลักษณ์ (โลโก้) และตั้งชื่อ-ตำแหน่ง ผู้อำนวยการ, นายทะเบียน, หัวหน้าวิชาการ และครูประจำชั้น เพื่อใช้ร่วมกันบนหัวเอกสารทางการทั้งระบบ',
    cta: 'ตั้งค่าโรงเรียน',
    href: '/app/dashboard?view=workspace-settings#workspace-profile',
    tags: ['profile', 'logo', 'signature', 'โรงเรียน', 'ผู้ลงนาม', 'ผอ', 'ตราโรงเรียน'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: '👥 การเชิญครูผู้สอนและการจัดสิทธิ์ห้องเรียน',
    category: 'admin_settings',
    categoryLabel: 'ตั้งค่า & สิทธิ์',
    body: 'ส่งคำเชิญครูเข้าโรงเรียนผ่านอีเมล กำหนดบทบาท ผู้ดูแลระบบ (Admin), ครูผู้สอน (Teacher) หรือ ผู้ดูรายงาน (Viewer) พร้อมจำกัดห้องเรียนที่รับผิดชอบเพื่อความปลอดภัยของข้อมูล',
    cta: 'จัดการสมาชิก',
    href: '/app/dashboard?view=workspace-settings#workspace-members',
    tags: ['members', 'roles', 'สิทธิ์', 'เชิญครู', 'ครูประจำชั้น', 'admin'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: '👨‍👩‍👧 การเชื่อมโยงระบบผู้ปกครองและรายงานสาธารณะ (Parent Portal)',
    category: 'admin_settings',
    categoryLabel: 'ตั้งค่า & สิทธิ์',
    body: 'ตั้งค่านโยบายรายงานสาธารณะ (Public Report Policy) ก่อน แล้วส่งคำเชิญ Portal หรือแชร์ลิงก์ให้ผู้ปกครองและนักเรียนตรวจสอบเวลาเรียนและผลการเรียนได้แบบเรียลไทม์',
    cta: 'ตั้งค่านโยบายรายงาน',
    href: '/app/dashboard?view=workspace-settings#public-report-policy',
    tags: ['portal', 'parent', 'ผู้ปกครอง', 'นักเรียน', 'public report'],
    allowedRoles: ownerRoles,
    moduleKey: 'parent_portal',
  },
  {
    title: '🛡️ ศูนย์ดูแลความปลอดภัยและการกู้คืนข้อมูล (Data Safety Center)',
    category: 'admin_settings',
    categoryLabel: 'ตั้งค่า & สิทธิ์',
    body: 'ตรวจสอบบันทึกการใช้งาน (Audit Logs), ตรวจสอบความสมบูรณ์ของฐานข้อมูล, และกู้คืนข้อมูลที่ถูกเก็บถาวรหรือลบผิดพลาดได้อย่างปลอดภัย',
    cta: 'เปิดศูนย์ดูแลข้อมูล',
    href: '/app/dashboard?view=data-safety',
    tags: ['safety', 'backup', 'audit', 'กู้คืน', 'ความปลอดภัย', 'สำรองข้อมูล'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
  {
    title: 'นักเรียนนำเข้าแล้วไม่แสดงในบางเมนู',
    category: 'students_data',
    categoryLabel: 'ข้อมูลนักเรียน',
    body: 'ตรวจตัวกรองห้องเรียน/สถานะที่แถบด้านบนก่อน จากนั้นเปิดหน้า Data Quality เพื่อดูว่านักเรียนอยู่ผิดห้อง ผิดปีการศึกษา หรือถูกเก็บถาวรหรือไม่',
    cta: 'เปิด Data Quality',
    href: '/app/dashboard?view=students&studentView=quality',
    tags: ['student', 'import', 'data quality', 'นักเรียนไม่ขึ้น', 'รายชื่อ'],
    allowedRoles: teacherRoles,
    moduleKey: 'students',
  },
  {
    title: 'จะเช็กชื่อแบบครูประจำชั้นหรือรายวิชา',
    category: 'schedule_cal',
    categoryLabel: 'ตารางสอน & ปฏิทิน',
    body: 'ใช้บันทึกเวลาเรียนเพื่อแยกรอบเช็กชื่อ: แบบโฮมรูมเช้า (มา/สาย/ขาด/ลา) หรือแบบรายวิชาตามคาบสอน ระบบจะนำข้อมูลไปคำนวณสถิติเวลาเรียน ปพ.5 อัตโนมัติ',
    cta: 'เปิดบันทึกเวลาเรียน',
    href: '/app/dashboard?view=teacher-work',
    tags: ['attendance', 'session', 'เช็กชื่อ', 'รายวิชา'],
    allowedRoles: teacherRoles,
    moduleKey: 'attendance',
  },
  {
    title: 'ลบแล้วข้อมูลกลับมา / การลบถาวร vs เก็บถาวร',
    category: 'admin_settings',
    categoryLabel: 'ตั้งค่า & สิทธิ์',
    body: 'ตรวจว่าเป็นการลบถาวรหรือเก็บถาวร และบัญชีมีสิทธิ์ owner/admin จากนั้นเปิดศูนย์ดูแลข้อมูลเพื่อตรวจคิวกู้คืนและปัญหาข้อมูล',
    cta: 'เปิดศูนย์ดูแลข้อมูล',
    href: '/app/dashboard?view=data-safety',
    tags: ['delete', 'archive', 'rls', 'ลบไม่ได้', 'กู้คืน'],
    allowedRoles: ownerRoles,
    moduleKey: 'support',
  },
];

const roleWorkflows = [
  {
    icon: Users,
    title: 'ครูผู้สอน / ครูประจำชั้น',
    items: [
      'เช็กเวลาเรียนโฮมรูม & รายวิชา',
      'ออกแบบข้อสอบ & เกณฑ์รูบริก AI',
      'กรอกคะแนน & ตัดเกรดอัตโนมัติ',
      'บันทึกเงินออม & พฤติกรรม 360',
      'ออกเล่ม ปพ.5 & ปพ.6 ประจำห้อง',
    ],
    roles: ['teacher_owner', 'teacher_member'] as WorkspaceRole[],
  },
  {
    icon: ShieldCheck,
    title: 'เจ้าของ workspace / Admin โรงเรียน',
    items: [
      'อนุมัติครูเข้าโรงเรียน & จัดสิทธิ์สมาชิก',
      'ตั้งค่าสถานศึกษา & ผู้ลงนาม 4 ฝ่าย',
      'สร้างห้องเรียน & นำเข้านักเรียน DMC',
      'จัดโครงสร้างตารางสอน & ปฏิทินโรงเรียน',
      'ตรวจสอบ Data Quality & สำรองข้อมูล',
    ],
    roles: ['teacher_owner'] as WorkspaceRole[],
  },
  {
    icon: Wrench,
    title: 'Superadmin',
    items: [
      'ตรวจ workspace ซ้ำ & ควบรวมโรงเรียน',
      'จัดสิทธิ์ Admin / Superadmin VIP',
      'ตรวจระบบความปลอดภัย RLS & Migration',
      'ดู Audit Logs การทำงานทั้งระบบ',
      'กู้คืนข้อมูลหรือจัดการสิทธิ์ฉุกเฉิน',
    ],
    roles: ['superadmin'] as WorkspaceRole[],
  },
  {
    icon: FileSpreadsheet,
    title: 'ผู้ดูรายงาน / ผู้บริหาร (Viewer)',
    items: [
      'ดูข้อมูลสรุปภาพรวมสถานศึกษาที่ได้รับอนุญาต',
      'ส่งออกรายงานสถิติเวลาเรียนและผลการเรียน',
      'ไม่สามารถแก้ไขข้อมูลนักเรียนหรือตั้งค่าระบบ',
    ],
    roles: ['viewer'] as WorkspaceRole[],
  },
];

const quickLinks: Array<HelpLinkAccess & { label: string; href: string; icon: typeof DatabaseZap }> = [
  { label: '✨ ออกข้อสอบ & รูบริก AI', href: '/app/dashboard?view=scores', icon: Sparkles, allowedRoles: teacherRoles, moduleKey: 'scores' },
  { label: '📅 ปฏิทินโรงเรียน', href: '/app/dashboard?view=calendar', icon: Calendar, allowedRoles: reportRoles, moduleKey: 'attendance' },
  { label: '📋 ตารางสอน', href: '/app/dashboard?view=schedule&scheduleView=settings', icon: ClipboardList, allowedRoles: teacherRoles, moduleKey: 'attendance' },
  { label: '🎓 กรอกคะแนน & ตัดเกรด', href: '/app/dashboard?view=scores&scoreView=excel', icon: GraduationCap, allowedRoles: teacherRoles, moduleKey: 'scores' },
  { label: '👥 นำเข้านักเรียน DMC', href: '/app/dashboard?view=import-export', icon: DatabaseZap, allowedRoles: ownerRoles, moduleKey: 'import_export' },
  { label: '📄 ออกรายงาน ปพ.5 / ปพ.6', href: '/app/dashboard?view=reports&reportView=attendance', icon: FileSpreadsheet, allowedRoles: reportRoles, moduleKey: 'reports' },
];

export function HelpCenterPage({ session }: HelpCenterPageProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GuideCategory>('all');
  const normalizedQuery = query.trim().toLowerCase();

  const canOpenHelpLink = (item: HelpLinkAccess) => (
    item.allowedRoles.includes(session.profile.role) && canUseModule(session.subscription, item.moduleKey)
  );

  const accessibleLinks = quickLinks.filter(canOpenHelpLink);
  const roleQuickLinks = (() => {
    if (session.profile.role === 'superadmin') {
      return [...accessibleLinks, { label: 'ตรวจระบบ', href: '/app/dashboard?view=setup', icon: Settings2, allowedRoles: ['superadmin'] as WorkspaceRole[], moduleKey: 'support' as ModuleKey }];
    }
    if (canManageWorkspace(session.profile.role)) {
      return [...accessibleLinks, { label: 'ตั้งค่าโรงเรียน', href: '/app/dashboard?view=workspace-settings', icon: Settings2, allowedRoles: ownerRoles, moduleKey: 'support' as ModuleKey }];
    }
    return accessibleLinks;
  })();

  const accessibleStartSteps = startSteps.filter(canOpenHelpLink);
  const accessibleGuides = guideCards.filter(canOpenHelpLink);

  const filteredGuides = accessibleGuides.filter((guide) => {
    const matchesCategory = selectedCategory === 'all' || guide.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;
    const haystack = [guide.title, guide.body, guide.cta, ...guide.tags].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const categories: { id: GuideCategory; label: string; icon: typeof BookOpen }[] = [
    { id: 'all', label: 'ทั้งหมด', icon: BookOpen },
    { id: 'ai_exam', label: '✨ AI & ออกข้อสอบ สพฐ.', icon: Sparkles },
    { id: 'mobile_ux', label: '📱 ใช้งานบนมือถือ', icon: Smartphone },
    { id: 'schedule_cal', label: '📅 ตารางสอน & ปฏิทิน', icon: Calendar },
    { id: 'scores_reports', label: '📊 คะแนน & รายงาน ปพ.', icon: GraduationCap },
    { id: 'students_data', label: '👥 ข้อมูลนักเรียน & DMC', icon: DatabaseZap },
    { id: 'admin_settings', label: '⚙️ ตั้งค่า & สิทธิ์', icon: Settings2 },
  ];

  return (
    <main className="app-page space-y-6">
      {/* Header Banner */}
      <div className="app-page-header">
        <div>
          <span className="nexus-kicker">
            <LifeBuoy size={16} aria-hidden="true" />
            ClassCare 360 Official Knowledge Base
          </span>
          <h1 className="app-page-title">ศูนย์คู่มือการใช้งาน & ทางลัดแก้ปัญหา</h1>
          <p className="app-page-description">
            รวมลำดับขั้นตอนการใช้งานทุกโมดูล สพฐ., ระบบปัญญาประดิษฐ์ AI ออกข้อสอบและรูบริก,
            การใช้งานบนสมาร์ทโฟน ตลอดจนแนวทางแก้ปัญหาที่เจอบ่อย สำหรับบทบาท{' '}
            <span className="font-black text-slate-900">{roleLabels[session.profile.role]}</span>
          </p>
        </div>

        <div className="nexus-card min-w-[220px] p-4 text-sm font-black text-slate-700">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Current role</p>
          <p className="mt-1 text-xl text-slate-950">{roleLabels[session.profile.role]}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{session.workspace?.schoolName || 'ยังไม่ได้เลือกโรงเรียน'}</p>
        </div>
      </div>

      {/* Quick Access Grid */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {roleQuickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <ContextLink
              className="nexus-card flex min-h-24 items-center gap-3 p-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-violet-400 hover:bg-white shadow-xs"
              key={item.href}
              to={item.href}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="leading-snug">{item.label}</span>
            </ContextLink>
          );
        })}
      </section>

      {/* First Setup Stepper */}
      {accessibleStartSteps.length > 0 ? (
        <section className="nexus-card p-5 sm:p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="nexus-kicker">
                <Route size={16} aria-hidden="true" />
                First Setup Roadmap
              </span>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                เริ่มต้นใช้งานให้ไม่หลงขั้นตอน (5 ขั้นตอนสู่ความสำเร็จ)
              </h2>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm font-medium leading-relaxed text-slate-600">
                หากเริ่มต้นระบบใหม่หรือข้อมูลไม่แสดง ให้ไล่ตามลำดับนี้ เพราะทุกโมดูลจะอิงข้อมูลโรงเรียน, ห้องเรียน,
                นักเรียน และตารางสอนร่วมกันทั้งระบบ
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-setup-guide'))}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-xs sm:text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
              >
                <BookOpen size={16} aria-hidden="true" />
                เปิดไกด์พาทำ 5 ขั้นตอน
              </button>
              {canManageWorkspace(session.profile.role) ? (
                <ContextLink
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs sm:text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
                  to="/app/dashboard?view=workspace-settings"
                >
                  เปิดศูนย์จัดการโรงเรียน
                  <LinkIcon size={15} aria-hidden="true" />
                </ContextLink>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-5">
            {accessibleStartSteps.map((step) => (
              <ContextLink
                className="rounded-2xl border border-slate-200 bg-white/90 p-4 transition hover:-translate-y-0.5 hover:border-violet-500 hover:shadow-md"
                key={step.title}
                to={step.href}
              >
                <p className="text-xs sm:text-sm font-black text-slate-950">{step.title}</p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">{step.body}</p>
              </ContextLink>
            ))}
          </div>
        </section>
      ) : null}

      {/* Main Manuals & Guides Section */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="nexus-card p-5 sm:p-6 shadow-sm border border-slate-200 space-y-5">
          {/* Search and Title */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="nexus-kicker">
                <BookOpen size={16} aria-hidden="true" />
                Knowledge Base & Guides
              </span>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                คู่มือการใช้งานระบบ & คลังคำตอบแก้ปัญหา
              </h2>
            </div>
            <label className="relative block w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="nexus-field h-10 pl-10 pr-3 text-xs"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหา เช่น ออกข้อสอบ, รูบริก, มือถือ, DMC..."
                type="search"
                value={query}
              />
            </label>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition shrink-0 ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon size={13} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Guide Cards Grid */}
          <div className="grid gap-3.5 md:grid-cols-2">
            {filteredGuides.map((guide) => (
              <article
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs hover:border-violet-300 hover:shadow-md transition"
                key={guide.title}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">
                      {guide.categoryLabel}
                    </span>
                    {guide.isNew && (
                      <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                        ✨ ฟีเจอร์ใหม่
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 leading-snug">{guide.title}</h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">{guide.body}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <ContextLink
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-50 px-3 text-xs font-black text-violet-800 border border-violet-200 shadow-xs hover:bg-violet-100 transition"
                    to={guide.href}
                  >
                    <span>{guide.cta}</span>
                    <LinkIcon size={13} aria-hidden="true" />
                  </ContextLink>
                </div>
              </article>
            ))}

            {filteredGuides.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center text-xs font-bold text-slate-600 md:col-span-2">
                ยังไม่พบคู่มือจากคำค้นหรือหมวดหมู่นี้ ลองค้นด้วยคำอื่น เช่น ออกข้อสอบ, รูบริก, ตารางสอน, DMC หรือ ปพ.5
              </div>
            ) : null}
          </div>
        </div>

        {/* Sidebar: Role Workflow & Checklist */}
        <aside className="space-y-6">
          <section className="nexus-card p-5 sm:p-6 shadow-sm border border-slate-200">
            <span className="nexus-kicker">
              <Users size={16} aria-hidden="true" />
              Role Workflow Guide
            </span>
            <h3 className="mt-2 text-lg font-black text-slate-950">บทบาทและหน้าที่ในระบบ</h3>
            <div className="mt-4 grid gap-3">
              {roleWorkflows
                .filter((workflow) => workflow.roles.includes(session.profile.role))
                .map((workflow) => {
                  const Icon = workflow.icon;

                  return (
                    <article className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4" key={workflow.title}>
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-sm">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <h4 className="font-black text-slate-950 text-sm">{workflow.title}</h4>
                          <ul className="mt-2 grid gap-1.5 text-xs font-medium leading-relaxed text-slate-600">
                            {workflow.items.map((item) => (
                              <li className="flex items-start gap-2" key={item}>
                                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={14} aria-hidden="true" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>

          {session.profile.role !== 'viewer' ? (
            <section className="nexus-card p-5 sm:p-6 shadow-sm border border-slate-200">
              <span className="nexus-kicker">
                <Wrench size={16} aria-hidden="true" />
                Readiness Checklist
              </span>
              <h3 className="mt-2 text-lg font-black text-slate-950">เช็กลิสต์ความพร้อมก่อนใช้งาน</h3>
              <div className="mt-4 grid gap-2">
                {[
                  'เลือก workspace ถูกโรงเรียน & ปีการศึกษา',
                  'มีห้องเรียน active อย่างน้อย 1 ห้อง',
                  'มีนักเรียน active ในห้องที่เลือก (หรือนำเข้า DMC)',
                  'ตั้งตารางสอน & รายวิชาก่อนเช็กชื่อรายคาบ',
                  'สร้างชุดคะแนนก่อนบันทึกคะแนนในสมุดเกรด',
                  'ทดลองใช้ AI ออกข้อสอบกลางภาค/ปลายภาค & Test Blueprint',
                  'ตั้งค่าโลโก้ & ผู้ลงนาม 4 ฝ่ายก่อนพิมพ์ ปพ.5/ปพ.6',
                ].map((item) => (
                  <label
                    className="flex min-h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    key={item}
                  >
                    <input className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400" type="checkbox" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
