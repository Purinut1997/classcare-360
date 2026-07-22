import {
  Archive,
  Bell,
  Building2,
  CalendarDays,
  CalendarRange,
  CircleHelp,
  ClipboardList,
  DatabaseZap,
  Dice5,
  FileSpreadsheet,
  GraduationCap,
  History,
  Heart,
  Home,
  PiggyBank,
  ServerCog,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { ModuleKey } from '../types/core';

export interface AppNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  moduleKey: ModuleKey;
  path: string;
}

export const appNavItems: AppNavItem[] = [
  { key: 'overview', label: 'ภาพรวม', icon: Home, moduleKey: 'dashboard', path: '/app/dashboard' },
  { key: 'students', label: 'นักเรียน', icon: Users, moduleKey: 'students', path: '/app/dashboard?view=students' },
  {
    key: 'teacher-work',
    label: 'บันทึกการมาเรียน',
    icon: ClipboardList,
    moduleKey: 'attendance',
    path: '/app/dashboard?view=teacher-work',
  },
  {
    key: 'schedule',
    label: 'ตารางสอน/ตารางเรียน',
    icon: CalendarRange,
    moduleKey: 'attendance',
    path: '/app/dashboard?view=schedule',
  },
  { key: 'scores', label: 'ระบบคะแนน', icon: GraduationCap, moduleKey: 'scores', path: '/app/dashboard?view=scores' },
  { key: 'savings', label: 'บันทึกเงินออม', icon: PiggyBank, moduleKey: 'savings', path: '/app/dashboard?view=savings' },
  { key: 'behavior', label: 'บันทึกพฤติกรรม', icon: Heart, moduleKey: 'behavior', path: '/app/dashboard?view=behavior' },
  {
    key: 'randomizer',
    label: 'สุ่ม',
    icon: Dice5,
    moduleKey: 'classroom_randomizer',
    path: '/app/dashboard?view=randomizer',
  },
  { key: 'reports', label: 'รายงาน', icon: FileSpreadsheet, moduleKey: 'reports', path: '/app/dashboard?view=reports&reportView=attendance' },
  {
    key: 'school-calendar',
    label: 'ปฏิทินโรงเรียน',
    icon: CalendarDays,
    moduleKey: 'attendance',
    path: '/app/dashboard?view=school-calendar',
  },
  {
    key: 'import-export',
    label: 'นำเข้า/สำรอง',
    icon: Archive,
    moduleKey: 'import_export',
    path: '/app/dashboard?view=import-export',
  },
  {
    key: 'data-safety',
    label: 'ศูนย์ดูแลข้อมูล',
    icon: DatabaseZap,
    moduleKey: 'support',
    path: '/app/dashboard?view=data-safety',
  },
  {
    key: 'notifications',
    label: 'แจ้งเตือน',
    icon: Bell,
    moduleKey: 'notifications',
    path: '/app/dashboard?view=notifications',
  },
  {
    key: 'workspace-settings',
    label: 'ศูนย์จัดการโรงเรียน',
    icon: School,
    moduleKey: 'support',
    path: '/app/dashboard?view=workspace-settings',
  },
  {
    key: 'workspace-switch',
    label: 'เปลี่ยน workspace',
    icon: Building2,
    moduleKey: 'support',
    path: '/app/select-workspace',
  },
  {
    key: 'setup',
    label: 'ตั้งค่าระบบ',
    icon: ServerCog,
    moduleKey: 'support',
    path: '/app/dashboard?view=setup',
  },
  {
    key: 'help-center',
    label: 'คู่มือใช้งาน',
    icon: CircleHelp,
    moduleKey: 'support',
    path: '/app/dashboard?view=help-center',
  },
  {
    key: 'audit',
    label: 'ประวัติระบบ',
    icon: History,
    moduleKey: 'support',
    path: '/app/dashboard?view=audit',
  },
  { key: 'package', label: 'แพ็กเกจ', icon: Sparkles, moduleKey: 'payment', path: '/app/package' },
];

export const superadminNavItem: AppNavItem = {
  key: 'superadmin-dashboard',
  label: 'Superadmin Center',
  icon: ShieldCheck,
  moduleKey: 'support',
  path: '/app/dashboard?view=superadmin-dashboard',
};

export const appViewCopy: Record<string, { eyebrow: string; title: string; body: string }> = {
  overview: {
    eyebrow: 'ระบบผู้ช่วยครูและดูแลนักเรียนครบวงจร',
    title: 'แดชบอร์ดสำหรับครูที่ต้องเห็นภาพทั้งห้องในหน้าเดียว',
    body: 'วางฐานสำหรับ Login, Student 360, งานครู, คะแนน, เงินออม, พฤติกรรม, เครื่องมือสุ่ม, รายงาน, แพ็กเกจ และ Superadmin โดยยึด RLS และ workspace isolation เป็นแกนหลัก',
  },
  students: {
    eyebrow: 'Student 360',
    title: 'มองเห็นข้อมูลนักเรียนรายคนแบบไม่หลุดบริบท',
    body: 'เตรียมพื้นที่สำหรับเวลาเรียน คะแนน งานค้าง เงินออม พฤติกรรม เคสดูแลช่วยเหลือ และข้อมูลผู้ปกครอง โดยทุก query ต้องผูก workspace และสิทธิ์ผู้ใช้',
  },
  'teacher-work': {
    eyebrow: 'Attendance',
    title: 'บันทึกการมาเรียนรายวันให้จบในหน้าห้องเรียน',
    body: 'เปิดรอบเช็กชื่อ เลือกห้อง/วันที่/ช่วงเวลา แล้วบันทึกสถานะ มา ขาด สาย ลา ป่วย หรือกิจกรรม โดยข้อมูลผูกกับ workspace และรายชื่อนักเรียนจริง',
  },
  scores: {
    eyebrow: 'Score Center',
    title: 'บันทึกคะแนนรายวิชาและเห็นสัญญาณติดตามได้ทันที',
    body: 'สร้างชุดคะแนน กรอกคะแนนรายนักเรียน ดูค่าเฉลี่ย ความครบถ้วน นักเรียนที่ควรติดตาม และ export CSV โดยยังคงผูก workspace_id และสิทธิ์ผู้ใช้ตาม RLS',
  },
  savings: {
    eyebrow: 'Savings Center',
    title: 'จัดการเงินออมนักเรียนแบบแยกบัญชีรายคน',
    body: 'ฝาก ถอน ดูยอดคงเหลือทั้งห้อง ตรวจประวัติธุรกรรม และ export รายการเงินออม โดยไม่เก็บข้อมูลสำคัญนอก workspace',
  },
  behavior: {
    eyebrow: 'Behavior Center',
    title: 'บันทึกพฤติกรรมและงานติดตามที่ครูต้องไม่พลาด',
    body: 'บันทึกเชิงบวก ข้อห่วงใย คะแนนพฤติกรรม และสถานะติดตาม เพื่อเชื่อมต่อไปยัง Student Care Case และการแจ้งผู้ปกครองในเฟสถัดไป',
  },
  randomizer: {
    eyebrow: 'Classroom Randomizer',
    title: 'สุ่มรายชื่อ แบ่งกลุ่ม และจัดลำดับนำเสนอจากรายชื่อนักเรียนจริง',
    body: 'ใช้รายชื่อนักเรียนใน workspace เพื่อสุ่มกิจกรรมในห้องเรียน บันทึกประวัติ และ export ผลลัพธ์โดยไม่ต้องพึ่งบริการภายนอก',
  },
  reports: {
    eyebrow: 'Report Center',
    title: 'ศูนย์รายงานแยกตามงานครูและช่วงเวลา',
    body: 'รวมรายงานเวลาเรียน เงินออม คะแนนรวมห้อง รายบุคคล และเคสดูแล โดยเลือกช่วงเดือน เทอม หรือปีการศึกษาได้จากจุดเดียว',
  },
  'import-export': {
    eyebrow: 'Import Export Backup',
    title: 'นำเข้า ส่งออก และสำรองข้อมูลโดยไม่ทำข้อมูลพัง',
    body: 'รองรับ template import, preview row errors, duplicate check, export และ backup manifest โดยทุกงานต้องผูก workspace_id และมี metadata ตรวจสอบย้อนหลัง',
  },
  'data-safety': {
    eyebrow: 'Data Safety Center',
    title: 'ศูนย์ดูแลข้อมูลก่อนใช้งานจริง',
    body: 'รวม import safety, duplicate protection, trash/restore, data health, ปฏิทินโรงเรียน, simple mode และ template ข้อความไว้จุดเดียว เพื่อลดปัญหานำเข้าผิด ลบผิด หรือรายงานไม่ตรง',
  },
  'school-calendar': {
    eyebrow: 'School Calendar',
    title: 'ปฏิทินโรงเรียนสำหรับวันหยุด สอบ กิจกรรม และรายงาน',
    body: 'ใช้เป็นฐานวันกลางของโรงเรียน เพื่อให้เช็กชื่อ ตารางสอน ตารางเรียน และรายงานอ่านข้อมูลตรงกันจากจุดเดียว',
  },
  'workspace-settings': {
    eyebrow: 'Owner Workspace Center',
    title: 'ศูนย์จัดการโรงเรียนสำหรับเจ้าของ workspace',
    body: 'รวมอนุมัติครู จัดสิทธิ์สมาชิก เพิ่ม/ลบ/เก็บถาวรห้องเรียน ตั้งค่าข้อมูลโรงเรียน สำรองข้อมูล และเตรียมแผนเลื่อนชั้นปีถัดไปในหน้าเดียว',
  },
  notifications: {
    eyebrow: 'Notification Center',
    title: 'รวมแจ้งเตือนสำคัญจากงานครูและช่องทางผู้ปกครอง',
    body: 'อ่าน notification ตาม workspace, แยก unread, เตรียม metadata สำหรับ In-App, Telegram และ LINE โดยให้ backend/Edge Function เป็นจุดส่งข้อความจริง',
  },
  setup: {
    eyebrow: 'System Readiness',
    title: 'ปิดงาน production launch ก่อนเปิดให้ใช้งานจริง',
    body: 'รวม checklist สำหรับ Cloudflare Pages, Supabase Auth redirect, workspace smoke test, RLS isolation, migrations, storage bucket, Edge Functions และ secret ที่ต้องตั้งฝั่ง server',
  },
  'help-center': {
    eyebrow: 'Help Center',
    title: 'คู่มือใช้งานและทางลัดแก้ปัญหาระบบ',
    body: 'รวมขั้นตอนเริ่มต้น ปุ่มลัดตามงานครู วิธีตรวจข้อมูลไม่แสดง วิธีลบ/กู้คืน และลำดับงานตามบทบาท เพื่อให้ผู้ใช้ไปถูกหน้าโดยไม่ต้องเดาเมนูเอง',
  },
  audit: {
    eyebrow: 'Audit Center',
    title: 'ค้นหาและส่งออกประวัติการใช้งานระบบ',
    body: 'ดู audit log ของ workspace สำหรับตรวจย้อนหลังหลังแก้ข้อมูลนักเรียน เคสดูแล แบบเยี่ยมบ้าน และ workflow สำคัญอื่น ๆ',
  },
  package: {
    eyebrow: 'Premium Package',
    title: 'จัดการแพ็กเกจและสิทธิ์แบบไม่สับสนกับชื่อระบบหลัก',
    body: 'พื้นที่นี้ใช้กับ ClassCare 360 VIP เท่านั้น เช่น สมัคร ต่ออายุ แนบสลิป ตรวจสิทธิ์ คืนเงิน และเครดิตแนะนำเพื่อน',
  },
};
