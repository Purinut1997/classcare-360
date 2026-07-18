import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Camera,
  CheckCircle2,
  Edit3,
  History,
  Home,
  Link2,
  Mail,
  MapPin,
  Phone,
  Printer,
  Save,
  School,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface StudentsPageProps {
  session: AppSessionContext;
}

type StudentStatus = 'active' | 'transferred' | 'graduated' | 'inactive' | 'archived';
type ConsentStatus = 'pending' | 'granted' | 'revoked';
type StudentLinkStatus = 'invited' | 'active' | 'suspended' | 'removed';
type PortalInviteRole = 'parent' | 'student';
type PortalInviteStatus = 'invited' | 'accepted' | 'revoked' | 'expired';
type CarePriority = 'normal' | 'watch' | 'urgent';
type CareCaseStatus = 'open' | 'monitoring' | 'closed' | 'archived';
type HomeVisitStatus = 'draft' | 'ready' | 'submitted' | 'certified' | 'archived';
type AuditRiskLevel = 'low' | 'normal' | 'high' | 'critical';

interface AuditLogRow {
  action: string;
  actor_profile_id: string | null;
  actor_role: string | null;
  created_at: string;
  entity_id: string | null;
  entity_table: string | null;
  id: string;
  metadata: Record<string, unknown>;
  risk_level: AuditRiskLevel;
}

interface ClassroomRow {
  academic_year: string | null;
  grade_level: string | null;
  id: string;
  name: string;
  status: 'active' | 'archived';
}

interface StudentRow {
  birth_date?: string | null;
  care_flags: Record<string, unknown>;
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  metadata?: Record<string, unknown>;
  nickname: string | null;
  status: StudentStatus;
  student_code: string | null;
}

interface GuardianRow {
  consent_status: ConsentStatus;
  display_name: string;
  id: string;
  is_primary: boolean;
  phone: string | null;
  relation: string;
  student_id: string;
}

interface StudentProfileLinkRow {
  id: string;
  linked_at: string | null;
  profile_id: string;
  status: StudentLinkStatus;
  student_id: string;
}

interface PortalInvitationRow {
  created_at: string | null;
  id: string;
  invite_email: string;
  portal_role: PortalInviteRole;
  relation: string | null;
  status: PortalInviteStatus;
  student_id: string;
}

interface StudentCareCaseRow {
  case_type: string;
  closed_at: string | null;
  id: string;
  next_action: string | null;
  opened_at: string | null;
  risk_level: CarePriority;
  status: CareCaseStatus;
  student_id: string;
  summary: string;
}

interface HomeVisitFormState {
  address: string;
  appliances: string;
  consentAccepted: boolean;
  dailyAllowance: string;
  dependencyNotes: string;
  distanceKm: string;
  drinkingWater: string;
  electricity: string;
  farmingLand: string;
  familyStatus: string;
  floorMaterial: string;
  googleMapUrl: string;
  guardianCitizenId: string;
  guardianEducation: string;
  guardianName: string;
  guardianOccupation: string;
  guardianPhone: string;
  householdIncome: string;
  householdMembers: string;
  housePhotoNote: string;
  housingType: string;
  indoorPhotoFileId: string | null;
  indoorPhotoLabel: string;
  latitude: string;
  livingWith: string;
  longitude: string;
  mapPlaceName: string;
  outdoorPhotoFileId: string | null;
  outdoorPhotoLabel: string;
  photoSource: string;
  photoType: string;
  rentPerMonth: string;
  relationship: string;
  roofMaterial: string;
  status: HomeVisitStatus;
  toilet: string;
  travelCost: string;
  travelMethod: string;
  travelMinutes: string;
  vehicles: string;
  visitDate: string;
  wallMaterial: string;
  welfareSupport: string;
}

interface StudentHomeVisitRow {
  academic_year: string | null;
  address_text: string | null;
  completion_percent: number;
  consent_accepted: boolean;
  distance_km: number | null;
  form_data: Partial<HomeVisitFormState>;
  household_income_monthly: number | null;
  household_member_count: number | null;
  id: string;
  photo_status: 'pending' | 'partial' | 'complete' | 'exempted';
  status: HomeVisitStatus;
  student_id: string;
  term: string | null;
  travel_method: string | null;
  visited_at: string | null;
}

const defaultHomeVisitForm: HomeVisitFormState = {
  address: '',
  appliances: 'ตู้เย็น, ทีวีจอแบน',
  consentAccepted: false,
  dailyAllowance: '',
  dependencyNotes: 'ไม่มีภาระพึ่งพิงเพิ่มเติม',
  distanceKm: '',
  drinkingWater: 'น้ำประปา',
  electricity: 'ไฟบ้านหรือมิเตอร์',
  farmingLand: 'ไม่ทำเกษตร',
  familyStatus: 'พ่อแม่อยู่ด้วยกัน',
  floorMaterial: 'ซีเมนต์เปลือย',
  googleMapUrl: '',
  guardianCitizenId: '',
  guardianEducation: 'ประถมศึกษา',
  guardianName: '',
  guardianOccupation: '',
  guardianPhone: '',
  householdIncome: '',
  householdMembers: '',
  housePhotoNote: '',
  housingType: 'อยู่บ้านตนเอง/เจ้าของบ้าน',
  indoorPhotoFileId: null,
  indoorPhotoLabel: '',
  latitude: '',
  livingWith: 'พ่อ/แม่',
  longitude: '',
  mapPlaceName: '',
  outdoorPhotoFileId: null,
  outdoorPhotoLabel: '',
  photoSource: 'คุณครูลงเยี่ยมบ้านด้วยตนเอง',
  photoType: 'ภาพถ่ายที่พักอาศัย/หอพักของนักเรียน',
  rentPerMonth: '',
  relationship: '',
  roofMaterial: 'โลหะ',
  status: 'draft',
  toilet: 'มี',
  travelCost: '',
  travelMethod: 'เดิน',
  travelMinutes: '',
  vehicles: 'รถมอเตอร์ไซต์/เรือประมงพื้นบ้าน',
  visitDate: new Date().toISOString().slice(0, 10),
  wallMaterial: 'ไม้กระดาน',
  welfareSupport: 'ไม่ได้รับสวัสดิการแห่งรัฐ',
};

const demoClassrooms: ClassroomRow[] = [
  {
    academic_year: '2569',
    grade_level: 'ป.5',
    id: 'demo-classroom',
    name: 'ป.5/2',
    status: 'active',
  },
];

const demoStudents: StudentRow[] = [
  {
    care_flags: {
      urgent: true,
      missingWorks: 2,
      homeVisit: {
        ...defaultHomeVisitForm,
        address: 'บ้านเลขที่ 12 หมู่ 4 ต.ตัวอย่าง อ.เมือง จ.เชียงใหม่ 50000',
        consentAccepted: true,
        dailyAllowance: '30',
        dependencyNotes: 'ผู้ปกครองรับจ้างรายวัน รายได้ไม่แน่นอน',
        distanceKm: '3.5',
        familyStatus: 'พ่อแม่อยู่ด้วยกัน',
        googleMapUrl: 'https://www.google.com/maps?q=18.788343,98.985300',
        guardianEducation: 'มัธยมศึกษาตอนต้น',
        guardianName: 'คุณแม่ณัฐวุฒิ',
        guardianOccupation: 'รับจ้างรายวัน',
        guardianPhone: '08x-xxx-1122',
        householdIncome: '9200',
        householdMembers: '4',
        housePhotoNote: 'ต้องแนบภาพภายนอกและภายในที่พักอาศัยก่อนส่งรับรอง',
        indoorPhotoFileId: 'demo-home-visit-photo-indoor',
        indoorPhotoLabel: 'inside-home-demo.jpg',
        latitude: '18.788343',
        livingWith: 'พ่อ/แม่',
        longitude: '98.985300',
        mapPlaceName: 'บ้านนักเรียนตัวอย่าง',
        outdoorPhotoFileId: 'demo-home-visit-photo-outdoor',
        outdoorPhotoLabel: 'outside-home-demo.jpg',
        relationship: 'มารดา',
        status: 'ready',
        travelCost: '300',
        travelMethod: 'จักรยานยนต์ส่วนตัว',
        travelMinutes: '25',
      },
    },
    classroom_id: 'demo-classroom',
    first_name: 'ณัฐวุฒิ',
    id: 'demo-student-1',
    last_name: 'ใจดี',
    nickname: 'นัท',
    status: 'active',
    student_code: '001',
  },
  {
    care_flags: { improved: true },
    classroom_id: 'demo-classroom',
    first_name: 'พิมพ์ชนก',
    id: 'demo-student-2',
    last_name: 'แสงทอง',
    nickname: 'พิม',
    status: 'active',
    student_code: '002',
  },
  {
    care_flags: { parentAppointment: true },
    classroom_id: 'demo-classroom',
    first_name: 'กิตติพงศ์',
    id: 'demo-student-3',
    last_name: 'สุขใจ',
    nickname: 'ก้อง',
    status: 'active',
    student_code: '003',
  },
];

const demoGuardians: GuardianRow[] = [
  {
    consent_status: 'granted',
    display_name: 'คุณแม่ณัฐวุฒิ',
    id: 'demo-guardian-1',
    is_primary: true,
    phone: '08x-xxx-1122',
    relation: 'มารดา',
    student_id: 'demo-student-1',
  },
  {
    consent_status: 'pending',
    display_name: 'คุณพ่อกิตติพงศ์',
    id: 'demo-guardian-2',
    is_primary: true,
    phone: '08x-xxx-3344',
    relation: 'บิดา',
    student_id: 'demo-student-3',
  },
];

const demoStudentLinks: StudentProfileLinkRow[] = [
  {
    id: 'demo-student-link-1',
    linked_at: '2026-06-25T09:00:00.000Z',
    profile_id: 'demo-student-profile-001',
    status: 'active',
    student_id: 'demo-student-1',
  },
];

const demoPortalInvitations: PortalInvitationRow[] = [
  {
    created_at: '2026-06-28T09:30:00.000Z',
    id: 'demo-portal-invite-1',
    invite_email: 'student001@example.com',
    portal_role: 'student',
    relation: 'บัญชีนักเรียน',
    status: 'invited',
    student_id: 'demo-student-1',
  },
  {
    created_at: '2026-06-28T10:00:00.000Z',
    id: 'demo-portal-invite-2',
    invite_email: 'parent001@example.com',
    portal_role: 'parent',
    relation: 'มารดา',
    status: 'invited',
    student_id: 'demo-student-1',
  },
];

const demoCareCases: StudentCareCaseRow[] = [
  {
    case_type: 'ติดตามเวลาเรียน',
    closed_at: null,
    id: 'demo-care-case-1',
    next_action: 'โทรผู้ปกครองและนัดคุยหลังเลิกเรียน',
    opened_at: '2026-06-28T08:30:00.000Z',
    risk_level: 'urgent',
    status: 'open',
    student_id: 'demo-student-1',
    summary: 'ขาดเรียนช่วงเช้าต่อเนื่อง ครูประจำชั้นพูดคุยเบื้องต้นแล้ว',
  },
  {
    case_type: 'งานค้าง',
    closed_at: null,
    id: 'demo-care-case-2',
    next_action: 'ตรวจงานซ่อมในคาบ homeroom',
    opened_at: '2026-06-27T10:00:00.000Z',
    risk_level: 'watch',
    status: 'monitoring',
    student_id: 'demo-student-1',
    summary: 'มีงานค้าง 2 ชิ้นและเริ่มส่งงานช้ากว่ากำหนด',
  },
];

const demoHomeVisits: StudentHomeVisitRow[] = [
  {
    academic_year: '2569',
    address_text: 'บ้านเลขที่ 12 หมู่ 4 ต.ตัวอย่าง อ.เมือง จ.เชียงใหม่ 50000',
    completion_percent: 100,
    consent_accepted: true,
    distance_km: 3.5,
    form_data: {
      ...defaultHomeVisitForm,
      address: 'บ้านเลขที่ 12 หมู่ 4 ต.ตัวอย่าง อ.เมือง จ.เชียงใหม่ 50000',
      consentAccepted: true,
      dailyAllowance: '30',
      dependencyNotes: 'ผู้ปกครองรับจ้างรายวัน รายได้ไม่แน่นอน',
      distanceKm: '3.5',
      familyStatus: 'พ่อแม่อยู่ด้วยกัน',
      googleMapUrl: 'https://www.google.com/maps?q=18.788343,98.985300',
      guardianEducation: 'มัธยมศึกษาตอนต้น',
      guardianName: 'คุณแม่ณัฐวุฒิ',
      guardianOccupation: 'รับจ้างรายวัน',
      guardianPhone: '08x-xxx-1122',
      householdIncome: '9200',
      householdMembers: '4',
      housePhotoNote: 'ต้องแนบภาพภายนอกและภายในที่พักอาศัยก่อนส่งรับรอง',
      indoorPhotoFileId: 'demo-home-visit-photo-indoor',
      indoorPhotoLabel: 'inside-home-demo.jpg',
      latitude: '18.788343',
      livingWith: 'พ่อ/แม่',
      longitude: '98.985300',
      mapPlaceName: 'บ้านนักเรียนตัวอย่าง',
      outdoorPhotoFileId: 'demo-home-visit-photo-outdoor',
      outdoorPhotoLabel: 'outside-home-demo.jpg',
      relationship: 'มารดา',
      status: 'ready',
      travelCost: '300',
      travelMethod: 'จักรยานยนต์ส่วนตัว',
      travelMinutes: '25',
    },
    household_income_monthly: 9200,
    household_member_count: 4,
    id: 'demo-home-visit-1',
    photo_status: 'partial',
    status: 'ready',
    student_id: 'demo-student-1',
    term: '1',
    travel_method: 'จักรยานยนต์ส่วนตัว',
    visited_at: defaultHomeVisitForm.visitDate,
  },
];

const demoAuditLogs: AuditLogRow[] = [
  {
    action: 'student_home_visit.saved',
    actor_profile_id: 'demo-teacher-profile',
    actor_role: 'teacher_owner',
    created_at: '2026-07-02T09:15:00.000Z',
    entity_id: 'demo-home-visit-1',
    entity_table: 'student_home_visits',
    id: 'demo-audit-home-visit-1',
    metadata: {
      completion_percent: 100,
      photo_status: 'partial',
      status: 'ready',
      student_id: 'demo-student-1',
    },
    risk_level: 'normal',
  },
  {
    action: 'student_care_case.created',
    actor_profile_id: 'demo-teacher-profile',
    actor_role: 'teacher_owner',
    created_at: '2026-06-28T08:30:00.000Z',
    entity_id: 'demo-care-case-1',
    entity_table: 'student_care_cases',
    id: 'demo-audit-care-case-1',
    metadata: {
      risk_level: 'urgent',
      status: 'open',
      student_id: 'demo-student-1',
    },
    risk_level: 'high',
  },
  {
    action: 'student.status_changed',
    actor_profile_id: 'demo-teacher-profile',
    actor_role: 'teacher_owner',
    created_at: '2026-06-27T14:10:00.000Z',
    entity_id: 'demo-student-1',
    entity_table: 'students',
    id: 'demo-audit-student-status-1',
    metadata: {
      from_status: 'inactive',
      to_status: 'active',
    },
    risk_level: 'low',
  },
];

const studentTaskLinks = [
  {
    description: 'เพิ่ม แก้ไข ค้นหา และจัดห้องเรียน โดยข้อมูลทุกแถวต้องผูก workspace_id',
    label: 'รายชื่อและห้องเรียน',
    title: 'จัดการรายชื่อนักเรียน',
    value: 'roster',
  },
  {
    description: 'ตรวจรายชื่อซ้ำ นักเรียนไม่มีห้อง ชื่อหรือรหัสว่าง และตัวกรองที่ทำให้รายชื่อไม่โผล่หลัง import',
    label: 'Data Quality',
    title: 'ตรวจคุณภาพข้อมูลนักเรียน',
    value: 'quality',
  },
  {
    description: 'บันทึกแบบเยี่ยมบ้าน กสศ.01 แยกจากงานรายชื่อเพื่อลดหน้าจอยาว',
    label: 'แบบเยี่ยมบ้าน กสศ.',
    title: 'แบบเยี่ยมบ้านนักเรียน',
    value: 'home-visit',
  },
  {
    description: 'ดูข้อมูลพื้นฐาน ผู้ปกครอง บัญชี portal และสถานะดูแลของนักเรียนรายคน',
    label: 'โปรไฟล์รายคน',
    title: 'โปรไฟล์นักเรียนรายคน',
    value: 'profile',
  },
  {
    description: 'บันทึกเคสดูแล ระดับติดตาม ประเภทเคส บันทึกครู และสิ่งที่ต้องทำต่อ',
    label: 'เคสดูแล',
    title: 'เคสดูแลนักเรียน',
    value: 'care',
  },
  {
    description: 'จัดการคำเชิญ Portal ผู้ปกครอง บัญชีนักเรียน และ consent ในจุดเดียว',
    label: 'Portal และผู้ปกครอง',
    title: 'Portal และผู้ปกครอง',
    value: 'portal',
  },
  {
    description: 'ดูร่องรอยการทำงานจาก Student 360 เคสดูแล และแบบเยี่ยมบ้านย้อนหลัง',
    label: 'ประวัติการทำงาน',
    title: 'ประวัติการทำงานนักเรียน',
    value: 'timeline',
  },
];

const statusLabels: Record<StudentStatus, string> = {
  active: 'กำลังเรียน',
  transferred: 'ย้ายออก',
  graduated: 'จบการศึกษา',
  inactive: 'พักสถานะ',
  archived: 'เก็บถาวร',
};

const consentLabels: Record<ConsentStatus, string> = {
  pending: 'รอยืนยัน',
  granted: 'ยินยอมแล้ว',
  revoked: 'ถอนยินยอม',
};

const studentLinkStatusLabels: Record<StudentLinkStatus, string> = {
  active: 'ใช้งานได้',
  invited: 'เชิญแล้ว',
  removed: 'ยกเลิก',
  suspended: 'พักสิทธิ์',
};

const portalInviteRoleLabels: Record<PortalInviteRole, string> = {
  parent: 'ผู้ปกครอง',
  student: 'นักเรียน',
};

const portalInviteStatusLabels: Record<PortalInviteStatus, string> = {
  accepted: 'รับสิทธิ์แล้ว',
  expired: 'หมดอายุ',
  invited: 'ส่งคำเชิญแล้ว',
  revoked: 'ยกเลิกแล้ว',
};

const carePriorityLabels: Record<CarePriority, string> = {
  normal: 'เฝ้าดูทั่วไป',
  urgent: 'ติดตามด่วน',
  watch: 'ต้องติดตาม',
};

const careCaseStatusLabels: Record<CareCaseStatus, string> = {
  archived: 'เก็บประวัติ',
  closed: 'ปิดเคส',
  monitoring: 'เฝ้าติดตาม',
  open: 'เปิดเคส',
};

const homeVisitStatusLabels: Record<HomeVisitStatus, string> = {
  archived: 'เก็บประวัติ',
  certified: 'รับรองแล้ว',
  draft: 'ฉบับร่าง',
  ready: 'พร้อมตรวจ',
  submitted: 'ส่งรับรองแล้ว',
};

const auditActionLabels: Record<string, string> = {
  'student.created': 'เพิ่มข้อมูลนักเรียน',
  'student.updated': 'แก้ไขข้อมูลนักเรียน',
  'student.status_changed': 'เปลี่ยนสถานะนักเรียน',
  'student_care_case.created': 'สร้างเคสดูแล',
  'student_care_case.updated': 'แก้ไขเคสดูแล',
  'student_care_case.status_changed': 'เปลี่ยนสถานะเคสดูแล',
  'student_home_visit.fallback_saved': 'บันทึกแบบเยี่ยมบ้านแบบสำรอง',
  'student_home_visit.saved': 'บันทึกแบบเยี่ยมบ้าน กสศ.01',
};

const auditRiskLabels: Record<AuditRiskLevel, string> = {
  critical: 'สำคัญมาก',
  high: 'ต้องติดตาม',
  low: 'ทั่วไป',
  normal: 'ปกติ',
};

function getAuditRiskTone(riskLevel: AuditRiskLevel) {
  if (riskLevel === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
  if (riskLevel === 'high') return 'bg-amber-100 text-amber-800 ring-amber-200';
  if (riskLevel === 'low') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-cyan-50 text-cyan-700 ring-cyan-100';
}

function QualityList({
  classrooms,
  emptyLabel,
  onArchive,
  onDelete,
  onSelect,
  students,
  title,
}: {
  classrooms: ClassroomRow[];
  emptyLabel: string;
  onArchive: (student: StudentRow) => void;
  onDelete: (student: StudentRow) => void;
  onSelect: (studentId: string) => void;
  students: StudentRow[];
  title: string;
}) {
  return (
    <div className="nexus-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
          {students.length} รายการ
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {students.map((student) => {
          const classroom = classrooms.find((item) => item.id === student.classroom_id);

          return (
            <div className="rounded-[20px] border border-slate-200 bg-white/86 p-3" key={student.id}>
              <button
                className="block text-left text-sm font-black text-slate-950"
                onClick={() => onSelect(student.id)}
                type="button"
              >
                {student.student_code || 'ไม่มีรหัส'} | {student.first_name || '-'} {student.last_name || '-'}
              </button>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                {classroom?.name || 'ยังไม่ผูกห้อง'} | {statusLabels[student.status]} | {student.nickname || 'ไม่มีชื่อเล่น'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5"
                  onClick={() => onSelect(student.id)}
                  type="button"
                >
                  เลือกคนนี้
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 shadow-sm transition hover:-translate-y-0.5"
                  onClick={() => onArchive(student)}
                  type="button"
                >
                  {student.status === 'archived' ? 'กู้คืน' : 'เก็บถาวร'}
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 shadow-sm transition hover:-translate-y-0.5"
                  onClick={() => onDelete(student)}
                  type="button"
                >
                  ลบถาวร
                </button>
              </div>
            </div>
          );
        })}

        {students.length === 0 ? (
          <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">{emptyLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

function getAuditSummary(log: AuditLogRow) {
  const parts = [
    typeof log.metadata.status === 'string' ? `status: ${log.metadata.status}` : null,
    typeof log.metadata.to_status === 'string' ? `to: ${log.metadata.to_status}` : null,
    typeof log.metadata.risk_level === 'string' ? `risk: ${log.metadata.risk_level}` : null,
    typeof log.metadata.completion_percent === 'number' ? `complete: ${log.metadata.completion_percent}%` : null,
    typeof log.metadata.photo_status === 'string' ? `photo: ${log.metadata.photo_status}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : log.entity_table || 'student_360';
}

function getCareCaseStatusActions(status: CareCaseStatus): Array<{ label: string; status: CareCaseStatus }> {
  if (status === 'closed' || status === 'archived') {
    return [{ label: 'เปิดใหม่', status: 'open' }];
  }

  if (status === 'monitoring') {
    return [
      { label: 'เปิดเคส', status: 'open' },
      { label: 'ปิดเคส', status: 'closed' },
    ];
  }

  return [
    { label: 'เฝ้าติดตาม', status: 'monitoring' },
    { label: 'ปิดเคส', status: 'closed' },
  ];
}

function getCareLabel(flags: Record<string, unknown>) {
  if (flags.carePriority === 'urgent') return 'ติดตามด่วน';
  if (flags.carePriority === 'watch') return 'ต้องติดตาม';
  if (flags.urgent) return 'ติดตามด่วน';
  if (flags.missingWorks) return `งานค้าง ${flags.missingWorks} ชิ้น`;
  if (flags.parentAppointment) return 'นัดผู้ปกครอง';
  if (flags.improved) return 'แนวโน้มดีขึ้น';
  return 'ปกติ';
}

function getHomeVisitForm(flags?: Record<string, unknown>): HomeVisitFormState {
  const rawForm = flags?.homeVisit;
  if (!rawForm || typeof rawForm !== 'object') return defaultHomeVisitForm;
  return {
    ...defaultHomeVisitForm,
    ...(rawForm as Partial<HomeVisitFormState>),
  };
}

function getHomeVisitCompletion(form: HomeVisitFormState) {
  const requiredValues = [
    form.guardianName,
    form.relationship,
    form.guardianPhone,
    form.familyStatus,
    form.livingWith,
    form.householdMembers,
    form.householdIncome,
    form.housingType,
    form.floorMaterial,
    form.wallMaterial,
    form.roofMaterial,
    form.travelMethod,
    form.distanceKm,
    form.travelMinutes,
    form.address,
    form.googleMapUrl || (form.latitude && form.longitude ? `${form.latitude},${form.longitude}` : ''),
    form.photoSource,
    form.photoType,
    form.outdoorPhotoFileId || form.outdoorPhotoLabel,
    form.indoorPhotoFileId || form.indoorPhotoLabel,
  ];
  const filled = requiredValues.filter((value) => value.trim().length > 0).length + (form.consentAccepted ? 1 : 0);
  const total = requiredValues.length + 1;
  return Math.round((filled / total) * 100);
}

function extractGoogleMapCoordinates(value: string) {
  let decodedValue = value;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    decodedValue = value;
  }
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/,
  ];

  for (const pattern of patterns) {
    const match = decodedValue.match(pattern);
    if (match) {
      return { latitude: match[1], longitude: match[2] };
    }
  }

  return null;
}

function getGoogleMapsHref(form: HomeVisitFormState) {
  if (form.googleMapUrl.trim()) return form.googleMapUrl.trim();
  if (form.latitude.trim() && form.longitude.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`;
  }
  if (form.address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`;
  }
  return 'https://www.google.com/maps';
}

function getGoogleMapsPinHref(form: HomeVisitFormState) {
  const placeLabel = form.mapPlaceName.trim() || form.address.trim() || 'ตำแหน่งที่พักอาศัยนักเรียน';
  if (form.latitude.trim() && form.longitude.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`;
  }
  if (form.address.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeLabel)}`;
  }
  return 'https://www.google.com/maps';
}

function getHomeVisitPhotoStatus(form: HomeVisitFormState): StudentHomeVisitRow['photo_status'] {
  const hasOutdoorPhoto = Boolean(form.outdoorPhotoFileId || form.outdoorPhotoLabel.trim());
  const hasIndoorPhoto = Boolean(form.indoorPhotoFileId || form.indoorPhotoLabel.trim());
  if (form.photoType === 'ภาพถ่ายนักเรียนคู่กับป้ายโรงเรียน' && (hasOutdoorPhoto || hasIndoorPhoto)) return 'exempted';
  if (hasOutdoorPhoto && hasIndoorPhoto) return 'complete';
  if (hasOutdoorPhoto || hasIndoorPhoto) return 'partial';
  return 'pending';
}

function getHomeVisitStoragePath(workspaceId: string, studentId: string, photoKind: 'indoor' | 'outdoor', file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  return `${workspaceId}/home-visits/${studentId}/${photoKind}-${Date.now()}.${extension}`;
}

const HOME_VISIT_PHOTO_MAX_EDGE = 1600;
const HOME_VISIT_PHOTO_QUALITY = 0.78;
const HOME_VISIT_PHOTO_SKIP_BYTES = 650 * 1024;

function getOptimizedPhotoName(fileName: string) {
  const cleanName = fileName.replace(/\.[^.]+$/, '');
  return `${cleanName || 'home-visit-photo'}-optimized.jpg`;
}

async function optimizeHomeVisitPhoto(file: File) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('อ่านรูปภาพไม่สำเร็จ'));
      nextImage.src = objectUrl;
    });

    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (longestEdge <= HOME_VISIT_PHOTO_MAX_EDGE && file.size <= HOME_VISIT_PHOTO_SKIP_BYTES) {
      return file;
    }

    const scale = longestEdge > HOME_VISIT_PHOTO_MAX_EDGE ? HOME_VISIT_PHOTO_MAX_EDGE / longestEdge : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', HOME_VISIT_PHOTO_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], getOptimizedPhotoName(file.name), {
      lastModified: Date.now(),
      type: 'image/jpeg',
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderHomeVisitPrintHtml({
  classroom,
  completion,
  form,
  guardian,
  schoolName,
  student,
}: {
  classroom: ClassroomRow | null;
  completion: number;
  form: HomeVisitFormState;
  guardian: GuardianRow | null;
  schoolName: string;
  student: StudentRow;
}) {
  const studentName = `${student.first_name} ${student.last_name}`;
  const classroomLabel = classroom ? `${classroom.name} ${classroom.academic_year ? `ปีการศึกษา ${classroom.academic_year}` : ''}` : '-';
  const rows = [
    ['ผู้ปกครอง', form.guardianName || guardian?.display_name || '-'],
    ['ความสัมพันธ์', form.relationship || guardian?.relation || '-'],
    ['เบอร์ติดต่อผู้ปกครอง', form.guardianPhone || guardian?.phone || '-'],
    ['เลขประจำตัวประชาชนผู้ปกครอง', form.guardianCitizenId || '-'],
    ['การศึกษาสูงสุดผู้ปกครอง', form.guardianEducation || '-'],
    ['อาชีพผู้ปกครอง', form.guardianOccupation || '-'],
    ['สถานภาพครอบครัว', form.familyStatus || '-'],
    ['นักเรียนอาศัยอยู่กับ', form.livingWith || '-'],
    ['สวัสดิการแห่งรัฐ', form.welfareSupport || '-'],
    ['สมาชิกในครัวเรือน', form.householdMembers ? `${form.householdMembers} คน` : '-'],
    ['รายได้รวมครัวเรือน', form.householdIncome ? `${form.householdIncome} บาท/เดือน` : '-'],
    ['ภาระพึ่งพิง', form.dependencyNotes || '-'],
    ['การอยู่อาศัย', form.housingType || '-'],
    ['ค่าเช่า', form.rentPerMonth ? `${form.rentPerMonth} บาท/เดือน` : '-'],
    ['ที่อยู่ปัจจุบัน', form.address || '-'],
    ['ชื่อหมุดแผนที่', form.mapPlaceName || '-'],
    ['Google Map', form.googleMapUrl || '-'],
    ['พิกัด', form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : '-'],
    ['พื้นบ้าน', form.floorMaterial || '-'],
    ['ฝาบ้าน', form.wallMaterial || '-'],
    ['หลังคา', form.roofMaterial || '-'],
    ['ห้องส้วม', form.toilet || '-'],
    ['แหล่งน้ำดื่ม', form.drinkingWater || '-'],
    ['แหล่งไฟฟ้า', form.electricity || '-'],
    ['ที่ดินทำเกษตร', form.farmingLand || '-'],
    ['วิธีเดินทางหลัก', form.travelMethod || '-'],
    ['ระยะทาง', form.distanceKm ? `${form.distanceKm} กิโลเมตร` : '-'],
    ['เวลาเดินทาง', form.travelMinutes ? `${form.travelMinutes} นาที` : '-'],
    ['ค่าเดินทาง', form.travelCost ? `${form.travelCost} บาท/เดือน` : '-'],
    ['เงินมาโรงเรียน', form.dailyAllowance ? `${form.dailyAllowance} บาท/วัน` : '-'],
  ];
  const photoRows = [
    ['รูปที่ 1 ภายนอกที่พักอาศัย', form.outdoorPhotoLabel || (form.outdoorPhotoFileId ? 'แนบไฟล์แล้ว' : 'ยังไม่ได้แนบ')],
    ['รูปที่ 2 ภายในที่พักอาศัย', form.indoorPhotoLabel || (form.indoorPhotoFileId ? 'แนบไฟล์แล้ว' : 'ยังไม่ได้แนบ')],
    ['แหล่งที่มาภาพถ่าย', form.photoSource || '-'],
    ['ประเภทภาพถ่าย', form.photoType || '-'],
    ['หมายเหตุภาพถ่าย', form.housePhotoNote || '-'],
  ];

  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>กสศ.01 - ${escapeHtml(studentName)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { color: #0f172a; font-family: "Tahoma", "Sarabun", sans-serif; font-size: 12px; line-height: 1.55; margin: 0; }
    h1, h2, h3, p { margin: 0; }
    .page { min-height: 267mm; padding: 0; }
    .header { align-items: flex-start; border-bottom: 2px solid #0f172a; display: flex; justify-content: space-between; gap: 16px; padding-bottom: 12px; }
    .brand { color: #0e7490; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .title { font-size: 22px; font-weight: 900; margin-top: 4px; }
    .subtitle { color: #475569; font-size: 12px; font-weight: 700; margin-top: 4px; }
    .badge { border: 1px solid #0f172a; border-radius: 10px; min-width: 110px; padding: 8px 10px; text-align: center; }
    .badge strong { display: block; font-size: 20px; }
    .section { break-inside: avoid; margin-top: 14px; }
    .section h2 { background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 10px; color: #075985; font-size: 14px; font-weight: 900; padding: 7px 10px; }
    .grid { display: grid; gap: 8px; grid-template-columns: repeat(2, 1fr); margin-top: 8px; }
    .field { border: 1px solid #cbd5e1; border-radius: 10px; min-height: 43px; padding: 7px 9px; }
    .field span { color: #64748b; display: block; font-size: 10px; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; }
    .field strong { display: block; font-size: 12px; margin-top: 2px; }
    table { border-collapse: collapse; margin-top: 8px; width: 100%; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-size: 11px; font-weight: 900; width: 32%; }
    .photo-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); margin-top: 8px; }
    .photo-box { align-items: center; border: 2px dashed #94a3b8; border-radius: 12px; color: #475569; display: flex; flex-direction: column; height: 120px; justify-content: center; padding: 12px; text-align: center; }
    .photo-box strong { color: #0f172a; display: block; font-size: 13px; margin-bottom: 5px; }
    .cert { border: 1px solid #cbd5e1; border-radius: 12px; margin-top: 8px; padding: 10px; }
    .signatures { display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); margin-top: 28px; }
    .signature { border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; }
    .muted { color: #64748b; font-size: 11px; }
    @media print { button { display: none; } .page { page-break-after: always; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div>
        <p class="brand">ClassCare 360 / Home Visit</p>
        <h1 class="title">แบบขอรับเงินอุดหนุนนักเรียนยากจน กสศ.01</h1>
        <p class="subtitle">จัดพิมพ์จากระบบ ClassCare 360 | ${escapeHtml(new Date().toLocaleString('th-TH'))}</p>
      </div>
      <div class="badge">
        <span>Complete</span>
        <strong>${completion}%</strong>
      </div>
    </header>

    <section class="section">
      <h2>1. ข้อมูลนักเรียน</h2>
      <div class="grid">
        <div class="field"><span>โรงเรียน</span><strong>${escapeHtml(schoolName || '-')}</strong></div>
        <div class="field"><span>ชั้น/ห้อง</span><strong>${escapeHtml(classroomLabel)}</strong></div>
        <div class="field"><span>ชื่อนักเรียน</span><strong>${escapeHtml(studentName)}</strong></div>
        <div class="field"><span>รหัสนักเรียน</span><strong>${escapeHtml(student.student_code || '-')}</strong></div>
        <div class="field"><span>วันที่เยี่ยมบ้าน</span><strong>${escapeHtml(form.visitDate || '-')}</strong></div>
        <div class="field"><span>สถานะเอกสาร</span><strong>${escapeHtml(homeVisitStatusLabels[form.status])}</strong></div>
      </div>
    </section>

    <section class="section">
      <h2>2-6. ข้อมูลครัวเรือน ที่อยู่อาศัย และการเดินทาง</h2>
      <table>
        <tbody>
          ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
          <tr><th>ที่อยู่ปัจจุบัน</th><td>${escapeHtml(form.address || '-')}</td></tr>
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>7. รูปถ่ายที่พักอาศัย</h2>
      <div class="photo-grid">
        <div class="photo-box"><strong>รูปที่ 1 ภายนอกที่พักอาศัย</strong>${escapeHtml(form.outdoorPhotoLabel || 'ยังไม่ได้แนบไฟล์')}</div>
        <div class="photo-box"><strong>รูปที่ 2 ภายในที่พักอาศัย</strong>${escapeHtml(form.indoorPhotoLabel || 'ยังไม่ได้แนบไฟล์')}</div>
      </div>
      <table>
        <tbody>
          ${photoRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2>8-10. การรับรองข้อมูล</h2>
      <div class="cert">
        <p>${form.consentAccepted ? 'รับรองว่าได้แจ้งวัตถุประสงค์การเก็บข้อมูลและข้อมูลส่วนบุคคลแล้ว' : 'ยังไม่ได้ยืนยันการรับรองข้อมูลส่วนบุคคล'}</p>
        <p class="muted">หมายเหตุ: ครูผู้สำรวจ/เยี่ยมบ้านเก็บข้อมูล ไม่มีส่วนเกี่ยวข้องกับการพิจารณาคัดกรองความยากจน</p>
      </div>
      <div class="signatures">
        <div class="signature">นักเรียน</div>
        <div class="signature">ผู้ปกครอง</div>
        <div class="signature">ครูผู้เยี่ยมบ้าน/สำรวจข้อมูล</div>
      </div>
    </section>
  </main>
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;
}

function emptyStudentForm(classroomId: string) {
  return {
    birthDate: '',
    citizenId: '',
    classroomId,
    firstName: '',
    lastName: '',
    nickname: '',
    studentCode: '',
  };
}

export function StudentsPage({ session }: StudentsPageProps) {
  const [searchParams] = useSearchParams();
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [guardians, setGuardians] = useState<GuardianRow[]>(demoGuardians);
  const [studentLinks, setStudentLinks] = useState<StudentProfileLinkRow[]>(demoStudentLinks);
  const [portalInvitations, setPortalInvitations] = useState<PortalInvitationRow[]>(demoPortalInvitations);
  const [careCases, setCareCases] = useState<StudentCareCaseRow[]>(demoCareCases);
  const [homeVisits, setHomeVisits] = useState<StudentHomeVisitRow[]>(demoHomeVisits);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>(demoAuditLogs);
  const [query, setQuery] = useState('');
  const [rosterClassroomFilter, setRosterClassroomFilter] = useState('all');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<StudentStatus | 'all'>('active');
  const [selectedStudentId, setSelectedStudentId] = useState(demoStudents[0].id);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState(() => emptyStudentForm(demoClassrooms[0].id));
  const [classroomName, setClassroomName] = useState(session.workspace?.classroomName || 'ป.5/2');
  const [gradeLevel, setGradeLevel] = useState('ป.5');
  const [academicYear, setAcademicYear] = useState(session.workspace?.academicYear || '2569');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('มารดา');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianConsent, setGuardianConsent] = useState<ConsentStatus>('pending');
  const [studentProfileId, setStudentProfileId] = useState('');
  const [studentLinkStatus, setStudentLinkStatus] = useState<StudentLinkStatus>('active');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PortalInviteRole>('student');
  const [inviteRelation, setInviteRelation] = useState('บัญชีนักเรียน');
  const [carePriority, setCarePriority] = useState<CarePriority>('watch');
  const [careType, setCareType] = useState('ติดตามเวลาเรียน');
  const [careNote, setCareNote] = useState('');
  const [careNextAction, setCareNextAction] = useState('');
  const [selectedCareCaseId, setSelectedCareCaseId] = useState<string | null>(demoCareCases[0]?.id || null);
  const [editingCareCaseId, setEditingCareCaseId] = useState<string | null>(null);
  const [careCaseEditPriority, setCareCaseEditPriority] = useState<CarePriority>('watch');
  const [careCaseEditType, setCareCaseEditType] = useState('');
  const [careCaseEditSummary, setCareCaseEditSummary] = useState('');
  const [careCaseEditNextAction, setCareCaseEditNextAction] = useState('');
  const [homeVisitForm, setHomeVisitForm] = useState<HomeVisitFormState>(() =>
    getHomeVisitForm(demoStudents[0]?.care_flags),
  );
  const [homeVisitOutdoorFile, setHomeVisitOutdoorFile] = useState<File | null>(null);
  const [homeVisitIndoorFile, setHomeVisitIndoorFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกนักเรียนลง Supabase จริง',
  );
  const requestedStudentView = searchParams.get('studentView') || 'roster';
  const activeStudentView = studentTaskLinks.some((item) => item.value === requestedStudentView)
    ? requestedStudentView
    : 'roster';
  const activeStudentTask =
    studentTaskLinks.find((item) => item.value === activeStudentView) || studentTaskLinks[0];

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || students[0] || null,
    [selectedStudentId, students],
  );

  const selectedGuardians = useMemo(
    () => guardians.filter((guardian) => guardian.student_id === selectedStudent?.id),
    [guardians, selectedStudent?.id],
  );

  const selectedStudentLinks = useMemo(
    () => studentLinks.filter((link) => link.student_id === selectedStudent?.id),
    [selectedStudent?.id, studentLinks],
  );

  const selectedPortalInvitations = useMemo(
    () => portalInvitations.filter((invite) => invite.student_id === selectedStudent?.id),
    [portalInvitations, selectedStudent?.id],
  );

  const selectedCareCases = useMemo(
    () => careCases.filter((careCase) => careCase.student_id === selectedStudent?.id),
    [careCases, selectedStudent?.id],
  );

  const selectedCareCase = useMemo(
    () => selectedCareCases.find((careCase) => careCase.id === selectedCareCaseId) || selectedCareCases[0] || null,
    [selectedCareCaseId, selectedCareCases],
  );

  const selectedClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === selectedStudent?.classroom_id) || null,
    [classrooms, selectedStudent?.classroom_id],
  );

  const openCareCases = useMemo(
    () => selectedCareCases.filter((careCase) => !['closed', 'archived'].includes(careCase.status)),
    [selectedCareCases],
  );

  const grantedGuardians = useMemo(
    () => selectedGuardians.filter((guardian) => guardian.consent_status === 'granted'),
    [selectedGuardians],
  );

  const primaryGuardian = useMemo(
    () => selectedGuardians.find((guardian) => guardian.is_primary) || selectedGuardians[0] || null,
    [selectedGuardians],
  );

  const selectedHomeVisitRow = useMemo(
    () => homeVisits.find((homeVisit) => homeVisit.student_id === selectedStudent?.id) || null,
    [homeVisits, selectedStudent?.id],
  );

  const selectedHomeVisit = useMemo(
    () => (selectedHomeVisitRow ? getHomeVisitForm({ homeVisit: selectedHomeVisitRow.form_data }) : getHomeVisitForm(selectedStudent?.care_flags)),
    [selectedHomeVisitRow, selectedStudent?.care_flags],
  );

  const homeVisitCompletion = useMemo(
    () => getHomeVisitCompletion(selectedHomeVisit),
    [selectedHomeVisit],
  );

  const selectedAuditLogs = useMemo(() => {
    if (!selectedStudent) return [];

    const selectedCareCaseIds = new Set(selectedCareCases.map((careCase) => careCase.id));
    const selectedHomeVisitIds = new Set(
      homeVisits.filter((homeVisit) => homeVisit.student_id === selectedStudent.id).map((homeVisit) => homeVisit.id),
    );

    return auditLogs
      .filter((log) => {
        const metadataStudentId = typeof log.metadata.student_id === 'string' ? log.metadata.student_id : null;
        return (
          log.entity_id === selectedStudent.id ||
          metadataStudentId === selectedStudent.id ||
          (log.entity_table === 'student_care_cases' && log.entity_id ? selectedCareCaseIds.has(log.entity_id) : false) ||
          (log.entity_table === 'student_home_visits' && log.entity_id ? selectedHomeVisitIds.has(log.entity_id) : false)
        );
      })
      .slice(0, 8);
  }, [auditLogs, homeVisits, selectedCareCases, selectedStudent]);

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === 'active'),
    [students],
  );

  const careStudents = useMemo(
    () => students.filter((student) => Object.keys(student.care_flags).length > 0),
    [students],
  );

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return students.filter((student) => {
      if (rosterStatusFilter !== 'all' && student.status !== rosterStatusFilter) return false;
      if (rosterClassroomFilter !== 'all' && student.classroom_id !== rosterClassroomFilter) return false;
      if (!normalizedQuery) return true;

      const classroom = classrooms.find((item) => item.id === student.classroom_id);
      const haystack = [
        student.student_code,
        student.first_name,
        student.last_name,
        student.nickname,
        classroom?.name,
        statusLabels[student.status],
        getCareLabel(student.care_flags),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [classrooms, query, rosterClassroomFilter, rosterStatusFilter, students]);

  const studentsWithoutClassroom = useMemo(
    () => students.filter((student) => !student.classroom_id || !classrooms.some((classroom) => classroom.id === student.classroom_id)),
    [classrooms, students],
  );

  const studentsWithBlankIdentity = useMemo(
    () =>
      students.filter(
        (student) =>
          !student.student_code?.trim() ||
          !student.first_name?.trim() ||
          !student.last_name?.trim(),
      ),
    [students],
  );

  const archivedOrInactiveStudents = useMemo(
    () => students.filter((student) => ['archived', 'inactive', 'transferred', 'graduated'].includes(student.status)),
    [students],
  );

  const duplicateStudentGroups = useMemo(() => {
    const grouped = new Map<string, StudentRow[]>();

    students.forEach((student) => {
      const codeKey = student.student_code?.trim()
        ? `code:${student.student_code.trim().toLowerCase()}`
        : '';
      const nameKey = `${student.first_name.trim().toLowerCase()}|${student.last_name.trim().toLowerCase()}|${student.classroom_id || 'no-room'}`;
      const key = codeKey || `name:${nameKey}`;
      const current = grouped.get(key) || [];
      grouped.set(key, [...current, student]);
    });

    return [...grouped.entries()]
      .map(([key, group]) => ({ group, key }))
      .filter((item) => item.group.length > 1)
      .sort((left, right) => right.group.length - left.group.length);
  }, [students]);

  const qualityIssueCount =
    studentsWithoutClassroom.length +
    studentsWithBlankIdentity.length +
    archivedOrInactiveStudents.length +
    duplicateStudentGroups.reduce((sum, item) => sum + item.group.length, 0);

  const studentSwitcherOptions = useMemo(
    () =>
      [...students].sort((left, right) => {
        const leftClassroom = classrooms.find((classroom) => classroom.id === left.classroom_id)?.name || '';
        const rightClassroom = classrooms.find((classroom) => classroom.id === right.classroom_id)?.name || '';
        return `${leftClassroom} ${left.student_code || ''} ${left.first_name}`.localeCompare(
          `${rightClassroom} ${right.student_code || ''} ${right.first_name}`,
          'th',
        );
      }),
    [classrooms, students],
  );

  useEffect(() => {
    if (!selectedStudent || selectedCareCases.length === 0) {
      if (selectedCareCaseId) setSelectedCareCaseId(null);
      return;
    }

    if (!selectedCareCaseId || !selectedCareCases.some((careCase) => careCase.id === selectedCareCaseId)) {
      setSelectedCareCaseId(selectedCareCases[0].id);
    }
  }, [selectedCareCaseId, selectedCareCases, selectedStudent]);

  useEffect(() => {
    const nextForm = selectedHomeVisit;
    setHomeVisitForm({
      ...nextForm,
      guardianName: nextForm.guardianName || primaryGuardian?.display_name || '',
      relationship: nextForm.relationship || primaryGuardian?.relation || '',
    });
    setHomeVisitOutdoorFile(null);
    setHomeVisitIndoorFile(null);
  }, [primaryGuardian?.display_name, primaryGuardian?.relation, selectedHomeVisit, selectedStudent?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadRoster() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setGuardians(demoGuardians);
        setStudentLinks(demoStudentLinks);
        setPortalInvitations(demoPortalInvitations);
        setCareCases(demoCareCases);
        setHomeVisits(demoHomeVisits);
        setAuditLogs(demoAuditLogs);
        setStudentForm(emptyStudentForm(demoClassrooms[0].id));
        setSelectedStudentId(demoStudents[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: guardianRows, error: guardianError },
        { data: studentLinkRows, error: studentLinkError },
        { data: portalInvitationRows, error: portalInvitationError },
        { data: careCaseRows, error: careCaseError },
        { data: homeVisitRows, error: homeVisitError },
        { data: auditLogRows, error: auditLogError },
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id,name,grade_level,academic_year,status')
          .eq('workspace_id', session.workspace.id)
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_guardians')
          .select('id,student_id,relation,display_name,phone,is_primary,consent_status')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('student_profile_links')
          .select('id,student_id,profile_id,status,linked_at')
          .eq('workspace_id', session.workspace.id)
          .order('linked_at', { ascending: false }),
        supabase
          .from('portal_invitations')
          .select('id,student_id,portal_role,invite_email,relation,status,created_at')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_care_cases')
          .select('id,student_id,case_type,risk_level,status,summary,next_action,opened_at,closed_at')
          .eq('workspace_id', session.workspace.id)
          .order('opened_at', { ascending: false }),
        supabase
          .from('student_home_visits')
          .select('id,student_id,academic_year,term,status,form_data,completion_percent,household_member_count,household_income_monthly,address_text,travel_method,distance_km,photo_status,consent_accepted,visited_at')
          .eq('workspace_id', session.workspace.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('id,actor_profile_id,actor_role,action,entity_table,entity_id,risk_level,metadata,created_at')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false })
          .limit(80),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || guardianError || studentLinkError || portalInvitationError || careCaseError) {
        setNotice(
          classroomError?.message ||
            studentError?.message ||
            guardianError?.message ||
            studentLinkError?.message ||
            portalInvitationError?.message ||
            careCaseError?.message ||
            'โหลดข้อมูล Student 360 ไม่สำเร็จ',
        );
        setIsLoading(false);
        return;
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setGuardians((guardianRows || []) as GuardianRow[]);
      setStudentLinks((studentLinkRows || []) as StudentProfileLinkRow[]);
      setPortalInvitations((portalInvitationRows || []) as PortalInvitationRow[]);
      setCareCases((careCaseRows || []) as StudentCareCaseRow[]);
      setHomeVisits(homeVisitError ? [] : ((homeVisitRows || []) as StudentHomeVisitRow[]));
      setAuditLogs(auditLogError ? [] : ((auditLogRows || []) as AuditLogRow[]));
      setStudentForm(emptyStudentForm(nextClassrooms[0]?.id || ''));
      setSelectedStudentId(nextStudents[0]?.id || '');
      if (homeVisitError) {
        setNotice('ยังไม่ได้รัน migration student_home_visits จึงแสดงแบบเยี่ยมบ้านจาก care_flags ชั่วคราว');
      }
      setIsLoading(false);
    }

    void loadRoster();

    return () => {
      isMounted = false;
    };
  }, [session.profile.id, session.workspace]);

  function resetStudentForm(nextClassroomId = classrooms[0]?.id || '') {
    setEditingStudentId(null);
    setStudentForm(emptyStudentForm(nextClassroomId));
  }

  function startEditStudent(student: StudentRow) {
    setSelectedStudentId(student.id);
    setEditingStudentId(student.id);
    setStudentForm({
      birthDate: student.birth_date || '',
      citizenId: '',
      classroomId: student.classroom_id || classrooms[0]?.id || '',
      firstName: student.first_name,
      lastName: student.last_name,
      nickname: student.nickname || '',
      studentCode: student.student_code || '',
    });
  }

  async function writeAuditLog({
    action,
    entityId,
    entityTable,
    metadata = {},
    riskLevel = 'normal',
  }: {
    action: string;
    entityId: string;
    entityTable: string;
    metadata?: Record<string, unknown>;
    riskLevel?: AuditRiskLevel;
  }) {
    if (!supabase || !session.workspace) return;

    const payload = {
      action,
      actor_profile_id: session.profile.id,
      actor_role: session.profile.role,
      entity_id: entityId,
      entity_table: entityTable,
      metadata: {
        ...metadata,
        source: 'student_360',
      },
      risk_level: riskLevel,
      workspace_id: session.workspace.id,
    };

    const { error } = await supabase.from('audit_logs').insert(payload);

    if (error) {
      console.warn('audit log insert failed', error.message);
      return;
    }

    setAuditLogs((current) => [
      {
        ...payload,
        created_at: new Date().toISOString(),
        id: `local-audit-${Date.now()}`,
      },
      ...current,
    ]);
  }

  function normalizeCitizenId(value: string) {
    return value.replace(/\D/g, '');
  }

  async function savePublicLookupIdentity(studentId: string) {
    const citizenId = normalizeCitizenId(studentForm.citizenId);
    if (!citizenId) return;

    if (citizenId.length !== 13) {
      throw new Error('เลขบัตรประชาชนต้องมี 13 หลักก่อนเปิดดูรายงานหน้าแรก');
    }

    if (!studentForm.birthDate) {
      throw new Error('ต้องกรอกวันเกิดนักเรียนก่อนเปิดดูรายงานหน้าแรก');
    }

    if (!supabase) return;

    const { data, error } = await supabase.rpc('set_student_public_lookup_identity', {
      citizen_id: citizenId,
      target_student_id: studentId,
    });

    if (error) throw error;
    if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
      throw new Error(typeof data.reason === 'string' ? data.reason : 'ตั้งค่ารหัสค้นหารายงานหน้าแรกไม่สำเร็จ');
    }
  }

  async function ensureClassroom() {
    if (!supabase || !session.workspace) return studentForm.classroomId;
    if (studentForm.classroomId) return studentForm.classroomId;

    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        workspace_id: session.workspace.id,
        name: session.workspace.classroomName,
        academic_year: session.workspace.academicYear,
        homeroom_teacher_profile_id: session.profile.id,
      })
      .select('id,name,grade_level,academic_year,status')
      .single();

    if (error) throw error;

    const nextClassroom = data as ClassroomRow;
    setClassrooms((current) => [...current, nextClassroom]);
    setStudentForm((current) => ({ ...current, classroomId: nextClassroom.id }));
    return nextClassroom.id;
  }

  async function handleCreateClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const trimmedName = classroomName.trim();
    if (!trimmedName) {
      setNotice('กรุณากรอกชื่อห้องเรียน');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const localClassroom: ClassroomRow = {
        academic_year: academicYear.trim() || null,
        grade_level: gradeLevel.trim() || null,
        id: `demo-classroom-${Date.now()}`,
        name: trimmedName,
        status: 'active',
      };
      setClassrooms((current) => [...current, localClassroom]);
      setStudentForm((current) => ({ ...current, classroomId: localClassroom.id }));
      setNotice('เพิ่มห้องเรียนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        workspace_id: session.workspace.id,
        name: trimmedName,
        grade_level: gradeLevel.trim() || null,
        academic_year: academicYear.trim() || null,
        homeroom_teacher_profile_id: session.profile.id,
      })
      .select('id,name,grade_level,academic_year,status')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const nextClassroom = data as ClassroomRow;
    setClassrooms((current) => [...current, nextClassroom]);
    setStudentForm((current) => ({ ...current, classroomId: nextClassroom.id }));
    setNotice('เพิ่มห้องเรียนสำเร็จ');
    setIsSubmitting(false);
  }

  async function handleStudentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const trimmedFirstName = studentForm.firstName.trim();
    const trimmedLastName = studentForm.lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setNotice('กรุณากรอกชื่อและนามสกุลนักเรียน');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      if (editingStudentId) {
        setStudents((current) =>
          current.map((student) =>
            student.id === editingStudentId
              ? {
                  ...student,
                  birth_date: studentForm.birthDate || null,
                  classroom_id: studentForm.classroomId,
                  first_name: trimmedFirstName,
                  last_name: trimmedLastName,
                  nickname: studentForm.nickname.trim() || null,
                  student_code: studentForm.studentCode.trim() || null,
                }
              : student,
          ),
        );
        setNotice('แก้ไขนักเรียนในโหมดตัวอย่างแล้ว');
      } else {
        const localStudent: StudentRow = {
          birth_date: studentForm.birthDate || null,
          care_flags: {},
          classroom_id: studentForm.classroomId,
          first_name: trimmedFirstName,
          id: `demo-student-${Date.now()}`,
          last_name: trimmedLastName,
          metadata: studentForm.citizenId ? { public_lookup_ready: true } : {},
          nickname: studentForm.nickname.trim() || null,
          status: 'active',
          student_code: studentForm.studentCode.trim() || null,
        };
        setStudents((current) => [localStudent, ...current]);
        setSelectedStudentId(localStudent.id);
        setNotice('เพิ่มนักเรียนในโหมดตัวอย่างแล้ว');
      }
      resetStudentForm(studentForm.classroomId);
      setIsSubmitting(false);
      return;
    }

    try {
      const targetClassroomId = await ensureClassroom();
      const payload = {
        birth_date: studentForm.birthDate || null,
        classroom_id: targetClassroomId || null,
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        nickname: studentForm.nickname.trim() || null,
        student_code: studentForm.studentCode.trim() || null,
      };

      if (editingStudentId) {
        const { data, error } = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudentId)
          .eq('workspace_id', session.workspace.id)
          .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata')
          .single();

        if (error) throw error;

        const nextStudent = data as StudentRow;
        await savePublicLookupIdentity(nextStudent.id);
        const refreshedStudent: StudentRow = studentForm.citizenId
          ? {
              ...nextStudent,
              metadata: {
                ...nextStudent.metadata,
                public_lookup_enabled: true,
              },
            }
          : nextStudent;
        setStudents((current) => current.map((student) => (student.id === editingStudentId ? refreshedStudent : student)));
        await writeAuditLog({
          action: 'student.updated',
          entityId: refreshedStudent.id,
          entityTable: 'students',
          metadata: {
            classroom_id: refreshedStudent.classroom_id,
            public_lookup_enabled: Boolean(studentForm.citizenId),
            student_code: refreshedStudent.student_code,
          },
          riskLevel: 'low',
        });
        setNotice('แก้ไขข้อมูลนักเรียนสำเร็จ');
      } else {
        const { data, error } = await supabase
          .from('students')
          .insert({
            ...payload,
            status: 'active',
            workspace_id: session.workspace.id,
          })
          .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata')
          .single();

        if (error) throw error;

        const nextStudent = data as StudentRow;
        await savePublicLookupIdentity(nextStudent.id);
        const refreshedStudent: StudentRow = studentForm.citizenId
          ? {
              ...nextStudent,
              metadata: {
                ...nextStudent.metadata,
                public_lookup_enabled: true,
              },
            }
          : nextStudent;
        setStudents((current) => [refreshedStudent, ...current]);
        setSelectedStudentId(refreshedStudent.id);
        await writeAuditLog({
          action: 'student.created',
          entityId: refreshedStudent.id,
          entityTable: 'students',
          metadata: {
            classroom_id: refreshedStudent.classroom_id,
            public_lookup_enabled: Boolean(studentForm.citizenId),
            student_code: refreshedStudent.student_code,
          },
          riskLevel: 'low',
        });
        setNotice('เพิ่มนักเรียนสำเร็จ ข้อมูลถูกบังคับด้วย workspace_id และ RLS');
      }

      resetStudentForm(targetClassroomId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'บันทึกนักเรียนไม่สำเร็จ');
    }

    setIsSubmitting(false);
  }

  async function createDemoStudentsForCurrentWorkspace() {
    setIsSubmitting(true);
    setNotice(null);

    const targetClassroomId =
      rosterClassroomFilter !== 'all'
        ? rosterClassroomFilter
        : studentForm.classroomId || classrooms.find((classroom) => classroom.status === 'active')?.id || classrooms[0]?.id || '';

    if (!targetClassroomId) {
      setNotice('กรุณาสร้างห้องเรียนก่อนเพิ่มรายชื่อนักเรียนทดลอง');
      setIsSubmitting(false);
      return;
    }

    const nowSuffix = Date.now().toString().slice(-6);
    const demoRoster = [
      ['เด็กชาย', 'ก้องภพ', 'ใจดี', 'ก้อง'],
      ['เด็กหญิง', 'ณัฐธิดา', 'แสงทอง', 'นัท'],
      ['เด็กชาย', 'ปกรณ์', 'เรียนดี', 'ปอ'],
      ['เด็กหญิง', 'พิชชาพร', 'สุขใจ', 'พิม'],
      ['เด็กชาย', 'ธนวัฒน์', 'กล้าหาญ', 'ต้น'],
      ['เด็กหญิง', 'วรัญญา', 'ทองสุข', 'แอน'],
      ['เด็กชาย', 'ภาคิน', 'มีสุข', 'คิน'],
      ['เด็กหญิง', 'สุพิชชา', 'บ้านโคกสูง', 'ฟ้า'],
      ['เด็กชาย', 'อนุชา', 'รักเรียน', 'นุ'],
      ['เด็กหญิง', 'กมลชนก', 'เพียรดี', 'เมย์'],
    ];

    const rows = demoRoster.map(([prefix, firstName, lastName, nickname], index) => ({
      care_flags: index % 4 === 0 ? { priority: 'watch', tags: ['ทดลองติดตาม'] } : {},
      classroom_id: targetClassroomId,
      first_name: `${prefix}${firstName}`,
      gender: prefix === 'เด็กหญิง' ? 'female' : 'male',
      health_flags: {},
      last_name: lastName,
      metadata: {
        seed_source: 'student_360_demo_button',
      },
      nickname,
      status: 'active',
      student_code: `TEST-${nowSuffix}-${String(index + 1).padStart(2, '0')}`,
      workspace_id: session.workspace?.id || 'demo-workspace',
    }));

    if (!supabase || !session.workspace) {
      const nextStudents = rows.map((row, index) => ({
        care_flags: row.care_flags,
        classroom_id: row.classroom_id,
        first_name: row.first_name,
        id: `demo-seed-student-${Date.now()}-${index}`,
        last_name: row.last_name,
        nickname: row.nickname,
        status: 'active' as const,
        student_code: row.student_code,
      }));
      setStudents((current) => [...nextStudents, ...current]);
      setRosterClassroomFilter(targetClassroomId);
      setRosterStatusFilter('active');
      setSelectedStudentId(nextStudents[0]?.id || selectedStudentId);
      setNotice(`เพิ่มนักเรียนทดลอง ${nextStudents.length} คนในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .insert(rows)
      .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata');

    if (error) {
      setNotice(`เพิ่มข้อมูลทดลองไม่สำเร็จ: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    const nextStudents = (data || []) as StudentRow[];
    setStudents((current) => [...nextStudents, ...current]);
    setRosterClassroomFilter(targetClassroomId);
    setRosterStatusFilter('active');
    setSelectedStudentId(nextStudents[0]?.id || selectedStudentId);
    await writeAuditLog({
      action: 'student.demo_seeded',
      entityId: session.workspace.id,
      entityTable: 'students',
      metadata: {
        classroom_id: targetClassroomId,
        count: nextStudents.length,
        source: 'student_360',
      },
      riskLevel: 'normal',
    });
    setNotice(`เพิ่มนักเรียนทดลอง ${nextStudents.length} คนแล้ว ตอนนี้สามารถทดลองเช็กชื่อ/คะแนน/เยี่ยมบ้านได้`);
    setIsSubmitting(false);
  }

  async function updateStudentStatus(student: StudentRow, status: StudentStatus) {
    setNotice(null);

    if (!supabase || !session.workspace) {
      setStudents((current) => current.map((item) => (item.id === student.id ? { ...item, status } : item)));
      setNotice(`เปลี่ยนสถานะเป็น ${statusLabels[status]} ในโหมดตัวอย่างแล้ว`);
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .update({ status })
      .eq('id', student.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata')
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    const nextStudent = data as StudentRow;
    setStudents((current) => current.map((item) => (item.id === student.id ? nextStudent : item)));
    await writeAuditLog({
      action: 'student.status_changed',
      entityId: student.id,
      entityTable: 'students',
      metadata: {
        from_status: student.status,
        to_status: status,
      },
      riskLevel: status === 'archived' ? 'normal' : 'low',
    });
    setNotice(`เปลี่ยนสถานะเป็น ${statusLabels[status]} สำเร็จ`);
  }

  async function deleteStudentPermanently(student: StudentRow) {
    const studentName = `${student.first_name} ${student.last_name}`.trim();
    const confirmed = window.confirm(
      `ลบนักเรียน "${studentName}" ถาวรหรือไม่?\n\nเหมาะสำหรับกรณีนำเข้าซ้ำหรือนำเข้าผิดเท่านั้น ข้อมูลที่ผูกกับนักเรียนคนนี้อาจถูกลบตาม policy ของฐานข้อมูล`,
    );
    if (!confirmed) return;

    setNotice(null);

    if (!supabase || !session.workspace) {
      setStudents((current) => current.filter((item) => item.id !== student.id));
      if (selectedStudentId === student.id) {
        const nextStudent = students.find((item) => item.id !== student.id);
        setSelectedStudentId(nextStudent?.id || '');
      }
      setNotice('ลบนักเรียนออกจากโหมดตัวอย่างแล้ว');
      return;
    }

    const { data, error } = await supabase
      .from('students')
      .delete()
      .eq('id', student.id)
      .eq('workspace_id', session.workspace.id)
      .select('id');

    if (error) {
      setNotice(`ลบถาวรไม่สำเร็จ: ${error.message} | ใช้ปุ่มเก็บถาวรก่อนได้ถ้า RLS ยังไม่เปิด delete`);
      return;
    }

    if (!data || data.length === 0) {
      setNotice('ลบนักเรียนไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง อาจยังไม่ได้รัน migration 0015_student_delete_owner_policy.sql หรือบัญชีนี้ไม่มีสิทธิ์ลบนักเรียน');
      return;
    }

    setStudents((current) => current.filter((item) => item.id !== student.id));
    if (selectedStudentId === student.id) {
      const nextStudent = students.find((item) => item.id !== student.id);
      setSelectedStudentId(nextStudent?.id || '');
    }
    await writeAuditLog({
      action: 'student.deleted',
      entityId: student.id,
      entityTable: 'students',
      metadata: {
        classroom_id: student.classroom_id,
        student_code: student.student_code,
      },
      riskLevel: 'high',
    });
    setNotice(`ลบนักเรียน ${studentName} ถาวรแล้ว`);
  }

  async function handleCareSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนบันทึกเคสดูแล');
      setIsSubmitting(false);
      return;
    }

    const trimmedType = careType.trim();
    const trimmedNote = careNote.trim();
    const trimmedNextAction = careNextAction.trim();
    const openedAt = new Date().toISOString();

    if (!trimmedType || !trimmedNote) {
      setNotice('กรุณากรอกประเภทเคสและบันทึกการติดตาม');
      setIsSubmitting(false);
      return;
    }

    const nextCareFlags = {
      ...selectedStudent.care_flags,
      careLastNote: trimmedNote,
      careLastUpdatedAt: openedAt,
      careNextAction: trimmedNextAction || null,
      carePriority,
      careType: trimmedType,
      urgent: carePriority === 'urgent',
    };

    if (!supabase || !session.workspace) {
      const localCareCase: StudentCareCaseRow = {
        case_type: trimmedType,
        closed_at: null,
        id: `demo-care-case-${Date.now()}`,
        next_action: trimmedNextAction || null,
        opened_at: openedAt,
        risk_level: carePriority,
        status: carePriority === 'normal' ? 'monitoring' : 'open',
        student_id: selectedStudent.id,
        summary: trimmedNote,
      };
      setStudents((current) =>
        current.map((student) =>
          student.id === selectedStudent.id ? { ...student, care_flags: nextCareFlags } : student,
        ),
      );
      setCareCases((current) => [localCareCase, ...current]);
      setSelectedCareCaseId(localCareCase.id);
      setCareNote('');
      setCareNextAction('');
      setNotice('บันทึกเคสดูแลในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const [
      { data: careCaseData, error: careCaseError },
      { data, error },
    ] = await Promise.all([
      supabase
        .from('student_care_cases')
        .insert({
          assigned_to: session.profile.id,
          case_type: trimmedType,
          metadata: { source: 'student_360_quick_log' },
          next_action: trimmedNextAction || null,
          opened_by: session.profile.id,
          risk_level: carePriority,
          status: carePriority === 'normal' ? 'monitoring' : 'open',
          student_id: selectedStudent.id,
          summary: trimmedNote,
          workspace_id: session.workspace.id,
        })
        .select('id,student_id,case_type,risk_level,status,summary,next_action,opened_at,closed_at')
        .single(),
      supabase
        .from('students')
        .update({ care_flags: nextCareFlags })
        .eq('id', selectedStudent.id)
        .eq('workspace_id', session.workspace.id)
        .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata')
        .single(),
    ]);

    if (careCaseError || error) {
      setNotice(careCaseError?.message || error?.message || 'บันทึกเคสดูแลไม่สำเร็จ');
      setIsSubmitting(false);
      return;
    }

    const nextCareCase = careCaseData as StudentCareCaseRow;
    setStudents((current) => current.map((student) => (student.id === selectedStudent.id ? (data as StudentRow) : student)));
    setCareCases((current) => [nextCareCase, ...current]);
    setSelectedCareCaseId(nextCareCase.id);
    await writeAuditLog({
      action: 'student_care_case.created',
      entityId: nextCareCase.id,
      entityTable: 'student_care_cases',
      metadata: {
        risk_level: nextCareCase.risk_level,
        status: nextCareCase.status,
        student_id: selectedStudent.id,
      },
      riskLevel: nextCareCase.risk_level === 'urgent' ? 'high' : 'normal',
    });
    setCareNote('');
    setCareNextAction('');
    setNotice('บันทึกเคสดูแลสำเร็จและอัปเดต care_flags แล้ว');
    setIsSubmitting(false);
  }

  function startEditCareCase(careCase: StudentCareCaseRow) {
    setEditingCareCaseId(careCase.id);
    setCareCaseEditPriority(careCase.risk_level);
    setCareCaseEditType(careCase.case_type);
    setCareCaseEditSummary(careCase.summary);
    setCareCaseEditNextAction(careCase.next_action || '');
  }

  function resetCareCaseEdit() {
    setEditingCareCaseId(null);
    setCareCaseEditPriority('watch');
    setCareCaseEditType('');
    setCareCaseEditSummary('');
    setCareCaseEditNextAction('');
  }

  async function handleCareCaseUpdate(careCase: StudentCareCaseRow) {
    setIsSubmitting(true);
    setNotice(null);

    const trimmedType = careCaseEditType.trim();
    const trimmedSummary = careCaseEditSummary.trim();
    const trimmedNextAction = careCaseEditNextAction.trim();

    if (!trimmedType || !trimmedSummary) {
      setNotice('กรุณากรอกประเภทเคสและรายละเอียดเคสก่อนบันทึก');
      setIsSubmitting(false);
      return;
    }

    const nextCareCase: StudentCareCaseRow = {
      ...careCase,
      case_type: trimmedType,
      next_action: trimmedNextAction || null,
      risk_level: careCaseEditPriority,
      summary: trimmedSummary,
    };

    if (!supabase || !session.workspace) {
      setCareCases((current) => current.map((item) => (item.id === careCase.id ? nextCareCase : item)));
      resetCareCaseEdit();
      setNotice('แก้ไขรายละเอียดเคสในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('student_care_cases')
      .update({
        case_type: trimmedType,
        next_action: trimmedNextAction || null,
        risk_level: careCaseEditPriority,
        summary: trimmedSummary,
      })
      .eq('id', careCase.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,student_id,case_type,risk_level,status,summary,next_action,opened_at,closed_at')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const updatedCareCase = data as StudentCareCaseRow;
    setCareCases((current) => current.map((item) => (item.id === careCase.id ? updatedCareCase : item)));
    await writeAuditLog({
      action: 'student_care_case.updated',
      entityId: careCase.id,
      entityTable: 'student_care_cases',
      metadata: {
        from_risk_level: careCase.risk_level,
        status: careCase.status,
        student_id: careCase.student_id,
        to_risk_level: updatedCareCase.risk_level,
      },
      riskLevel: updatedCareCase.risk_level === 'urgent' ? 'high' : 'normal',
    });
    resetCareCaseEdit();
    setNotice('แก้ไขรายละเอียดเคสสำเร็จ');
    setIsSubmitting(false);
  }

  async function updateCareCaseStatus(careCase: StudentCareCaseRow, status: CareCaseStatus) {
    setIsSubmitting(true);
    setNotice(null);

    const closedAt = status === 'closed' || status === 'archived' ? new Date().toISOString() : null;
    const nextCareCase = {
      ...careCase,
      closed_at: closedAt,
      status,
    };

    if (!supabase || !session.workspace) {
      setCareCases((current) => current.map((item) => (item.id === careCase.id ? nextCareCase : item)));
      setNotice(`เปลี่ยนสถานะเคสเป็น ${careCaseStatusLabels[status]} ในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('student_care_cases')
      .update({
        closed_at: closedAt,
        status,
      })
      .eq('id', careCase.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,student_id,case_type,risk_level,status,summary,next_action,opened_at,closed_at')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const updatedCareCase = data as StudentCareCaseRow;
    setCareCases((current) => current.map((item) => (item.id === careCase.id ? updatedCareCase : item)));
    await writeAuditLog({
      action: 'student_care_case.status_changed',
      entityId: careCase.id,
      entityTable: 'student_care_cases',
      metadata: {
        from_status: careCase.status,
        student_id: careCase.student_id,
        to_status: status,
      },
      riskLevel: status === 'archived' || status === 'closed' ? 'normal' : 'low',
    });
    setNotice(`เปลี่ยนสถานะเคสเป็น ${careCaseStatusLabels[status]} สำเร็จ`);
    setIsSubmitting(false);
  }

  function updateHomeVisitField<K extends keyof HomeVisitFormState>(key: K, value: HomeVisitFormState[K]) {
    setHomeVisitForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleGoogleMapUrlChange(value: string) {
    const coordinates = extractGoogleMapCoordinates(value);
    setHomeVisitForm((current) => ({
      ...current,
      googleMapUrl: value,
      latitude: coordinates?.latitude || current.latitude,
      longitude: coordinates?.longitude || current.longitude,
    }));
    if (coordinates) {
      setNotice('ดึงพิกัดจากลิงก์ Google Maps แล้ว');
    }
  }

  function useCurrentHomeVisitLocation() {
    if (!navigator.geolocation) {
      setNotice('Browser นี้ยังไม่รองรับการดึงพิกัดอัตโนมัติ กรุณาวางลิงก์ Google Maps หรือกรอกพิกัดเอง');
      return;
    }

    setNotice('กำลังขอพิกัดจากอุปกรณ์...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        setHomeVisitForm((current) => ({
          ...current,
          googleMapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
          latitude,
          longitude,
          mapPlaceName: current.mapPlaceName || 'ตำแหน่งที่พักอาศัยจากอุปกรณ์',
        }));
        setNotice('ปักหมุดตำแหน่งจากอุปกรณ์เรียบร้อยแล้ว');
      },
      () => {
        setNotice('ไม่สามารถดึงพิกัดได้ กรุณาอนุญาต Location หรือวางลิงก์ Google Maps แทน');
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  }

  async function uploadHomeVisitPhoto(file: File, photoKind: 'indoor' | 'outdoor') {
    if (!supabase || !session.workspace || !selectedStudent) return null;

    const optimizedFile = await optimizeHomeVisitPhoto(file);
    const bucket = 'home-visit-photos';
    const storagePath = getHomeVisitStoragePath(session.workspace.id, selectedStudent.id, photoKind, optimizedFile);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, optimizedFile, {
      contentType: optimizedFile.type || 'application/octet-stream',
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: fileRow, error: fileError } = await supabase
      .from('app_files')
      .insert({
        bucket,
        content_type: file.type || 'application/octet-stream',
        metadata: {
          optimized_content_type: optimizedFile.type || null,
          optimized_filename: optimizedFile.name,
          optimized_size_bytes: optimizedFile.size,
          original_size_bytes: file.size,
          photo_kind: photoKind,
          purpose: 'home_visit_photo',
          resized_for_storage: optimizedFile !== file,
          student_id: selectedStudent.id,
        },
        original_filename: file.name,
        owner_profile_id: session.profile.id,
        privacy_level: 'sensitive',
        size_bytes: optimizedFile.size,
        storage_path: storagePath,
        workspace_id: session.workspace.id,
      })
      .select('id')
      .single();

    if (fileError) throw fileError;
    return fileRow.id as string;
  }

  async function handleHomeVisitSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนบันทึกแบบเยี่ยมบ้าน');
      setIsSubmitting(false);
      return;
    }

    let nextHomeVisit: HomeVisitFormState = {
      ...homeVisitForm,
      indoorPhotoLabel: homeVisitIndoorFile?.name || homeVisitForm.indoorPhotoLabel,
      outdoorPhotoLabel: homeVisitOutdoorFile?.name || homeVisitForm.outdoorPhotoLabel,
    };
    if (supabase && session.workspace) {
      try {
        const [outdoorFileId, indoorFileId] = await Promise.all([
          homeVisitOutdoorFile ? uploadHomeVisitPhoto(homeVisitOutdoorFile, 'outdoor') : Promise.resolve(null),
          homeVisitIndoorFile ? uploadHomeVisitPhoto(homeVisitIndoorFile, 'indoor') : Promise.resolve(null),
        ]);
        nextHomeVisit = {
          ...nextHomeVisit,
          indoorPhotoFileId: indoorFileId || nextHomeVisit.indoorPhotoFileId,
          outdoorPhotoFileId: outdoorFileId || nextHomeVisit.outdoorPhotoFileId,
        };
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'อัปโหลดรูปเยี่ยมบ้านไม่สำเร็จ');
        setIsSubmitting(false);
        return;
      }
    } else {
      nextHomeVisit = {
        ...nextHomeVisit,
        indoorPhotoFileId: homeVisitIndoorFile ? `demo-home-visit-indoor-${Date.now()}` : nextHomeVisit.indoorPhotoFileId,
        outdoorPhotoFileId: homeVisitOutdoorFile ? `demo-home-visit-outdoor-${Date.now()}` : nextHomeVisit.outdoorPhotoFileId,
      };
    }

    const completion = getHomeVisitCompletion(nextHomeVisit);
    const nextStatus: HomeVisitStatus = completion >= 90 && nextHomeVisit.consentAccepted ? 'ready' : 'draft';
    nextHomeVisit = {
      ...nextHomeVisit,
      status: nextStatus,
    };
    const nextCareFlags = {
      ...selectedStudent.care_flags,
      homeVisit: nextHomeVisit,
      homeVisitCompletion: completion,
      homeVisitLastUpdatedAt: new Date().toISOString(),
    };
    const householdMemberCount = Number.parseInt(homeVisitForm.householdMembers, 10);
    const householdIncomeMonthly = Number.parseFloat(homeVisitForm.householdIncome);
    const distanceKm = Number.parseFloat(homeVisitForm.distanceKm);
    const nextHomeVisitRow: StudentHomeVisitRow = {
      academic_year: academicYear,
      address_text: nextHomeVisit.address.trim() || null,
      completion_percent: completion,
      consent_accepted: nextHomeVisit.consentAccepted,
      distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
      form_data: nextHomeVisit,
      household_income_monthly: Number.isFinite(householdIncomeMonthly) ? householdIncomeMonthly : null,
      household_member_count: Number.isFinite(householdMemberCount) ? householdMemberCount : null,
      id: selectedHomeVisitRow?.id || `demo-home-visit-${Date.now()}`,
      photo_status: getHomeVisitPhotoStatus(nextHomeVisit),
      status: nextStatus,
      student_id: selectedStudent.id,
      term: '1',
      travel_method: nextHomeVisit.travelMethod.trim() || null,
      visited_at: nextHomeVisit.visitDate || null,
    };

    if (!supabase || !session.workspace) {
      setStudents((current) =>
        current.map((student) =>
          student.id === selectedStudent.id ? { ...student, care_flags: nextCareFlags } : student,
        ),
      );
      setHomeVisits((current) => {
        const exists = current.some((homeVisit) => homeVisit.id === nextHomeVisitRow.id);
        return exists
          ? current.map((homeVisit) => (homeVisit.id === nextHomeVisitRow.id ? nextHomeVisitRow : homeVisit))
          : [nextHomeVisitRow, ...current];
      });
      setHomeVisitForm(nextHomeVisit);
      setHomeVisitOutdoorFile(null);
      setHomeVisitIndoorFile(null);
      setNotice(`บันทึกแบบเยี่ยมบ้าน กสศ.01 ในโหมดตัวอย่างแล้ว (${completion}%)`);
      setIsSubmitting(false);
      return;
    }

    const homeVisitPayload = {
      academic_year: academicYear,
      address_text: nextHomeVisitRow.address_text,
      completion_percent: completion,
      consent_accepted: nextHomeVisit.consentAccepted,
      distance_km: nextHomeVisitRow.distance_km,
      form_data: nextHomeVisit,
      form_code: 'gsf_01',
      form_version: '2569-03-06',
      household_income_monthly: nextHomeVisitRow.household_income_monthly,
      household_member_count: nextHomeVisitRow.household_member_count,
      metadata: { source: 'student_360_home_visit_form' },
      photo_status: nextHomeVisitRow.photo_status,
      status: nextStatus,
      student_id: selectedStudent.id,
      term: '1',
      travel_method: nextHomeVisitRow.travel_method,
      visited_at: nextHomeVisitRow.visited_at,
      visited_by: session.profile.id,
      workspace_id: session.workspace.id,
    };
    const homeVisitMutation = selectedHomeVisitRow
      ? supabase
          .from('student_home_visits')
          .update(homeVisitPayload)
          .eq('id', selectedHomeVisitRow.id)
          .eq('workspace_id', session.workspace.id)
          .select('id,student_id,academic_year,term,status,form_data,completion_percent,household_member_count,household_income_monthly,address_text,travel_method,distance_km,photo_status,consent_accepted,visited_at')
          .single()
      : supabase
          .from('student_home_visits')
          .insert(homeVisitPayload)
          .select('id,student_id,academic_year,term,status,form_data,completion_percent,household_member_count,household_income_monthly,address_text,travel_method,distance_km,photo_status,consent_accepted,visited_at')
          .single();

    const [
      { data: homeVisitData, error: homeVisitError },
      { data: studentData, error: studentError },
    ] = await Promise.all([
      homeVisitMutation,
      supabase
        .from('students')
        .update({ care_flags: nextCareFlags })
        .eq('id', selectedStudent.id)
        .eq('workspace_id', session.workspace.id)
        .select('id,student_code,first_name,last_name,nickname,status,care_flags,classroom_id,birth_date,metadata')
        .single(),
    ]);

    if (studentError) {
      setNotice(studentError.message);
      setIsSubmitting(false);
      return;
    }

    setStudents((current) =>
      current.map((student) => (student.id === selectedStudent.id ? (studentData as StudentRow) : student)),
    );
    if (!homeVisitError && homeVisitData) {
      setHomeVisits((current) => {
        const nextRow = homeVisitData as StudentHomeVisitRow;
        const exists = current.some((homeVisit) => homeVisit.id === nextRow.id);
        return exists
          ? current.map((homeVisit) => (homeVisit.id === nextRow.id ? nextRow : homeVisit))
          : [nextRow, ...current];
      });
    }
    setHomeVisitForm(nextHomeVisit);
    setHomeVisitOutdoorFile(null);
    setHomeVisitIndoorFile(null);
    if (!homeVisitError && homeVisitData) {
      await writeAuditLog({
        action: 'student_home_visit.saved',
        entityId: (homeVisitData as StudentHomeVisitRow).id,
        entityTable: 'student_home_visits',
        metadata: {
          completion_percent: completion,
          consent_accepted: nextHomeVisit.consentAccepted,
          photo_status: nextHomeVisitRow.photo_status,
          status: nextStatus,
          student_id: selectedStudent.id,
        },
        riskLevel: nextHomeVisit.consentAccepted ? 'normal' : 'high',
      });
    } else {
      await writeAuditLog({
        action: 'student_home_visit.fallback_saved',
        entityId: selectedStudent.id,
        entityTable: 'students',
        metadata: {
          completion_percent: completion,
          reason: homeVisitError?.message || 'student_home_visits_unavailable',
          student_id: selectedStudent.id,
        },
        riskLevel: 'normal',
      });
    }
    setNotice(
      homeVisitError
        ? `บันทึกสำรองใน care_flags แล้ว แต่ยังบันทึกตาราง student_home_visits ไม่ได้: ${homeVisitError.message}`
        : `บันทึกแบบเยี่ยมบ้าน กสศ.01 สำเร็จ (${completion}%)`,
    );
    setIsSubmitting(false);
  }

  function handlePrintHomeVisit() {
    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนพิมพ์แบบเยี่ยมบ้าน');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!printWindow) {
      setNotice('ไม่สามารถเปิดหน้าพิมพ์ได้ กรุณาอนุญาต popup ใน browser');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      renderHomeVisitPrintHtml({
        classroom: selectedClassroom,
        completion: getHomeVisitCompletion(homeVisitForm),
        form: homeVisitForm,
        guardian: primaryGuardian,
        schoolName: session.workspace?.schoolName || session.workspace?.name || 'โรงเรียนตัวอย่าง ClassCare',
        student: selectedStudent,
      }),
    );
    printWindow.document.close();
    setNotice('เปิดหน้าพิมพ์แบบเยี่ยมบ้าน กสศ.01 แล้ว สามารถเลือก Save as PDF ได้จากหน้าพิมพ์');
  }

  async function handleGuardianSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนเพิ่มผู้ปกครอง');
      setIsSubmitting(false);
      return;
    }

    const trimmedName = guardianName.trim();
    if (!trimmedName) {
      setNotice('กรุณากรอกชื่อผู้ปกครอง');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const localGuardian: GuardianRow = {
        consent_status: guardianConsent,
        display_name: trimmedName,
        id: `demo-guardian-${Date.now()}`,
        is_primary: selectedGuardians.length === 0,
        phone: guardianPhone.trim() || null,
        relation: guardianRelation.trim() || 'ผู้ปกครอง',
        student_id: selectedStudent.id,
      };
      setGuardians((current) => [...current, localGuardian]);
      setGuardianName('');
      setGuardianPhone('');
      setGuardianConsent('pending');
      setNotice('เพิ่มผู้ปกครองในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('student_guardians')
      .insert({
        workspace_id: session.workspace.id,
        student_id: selectedStudent.id,
        relation: guardianRelation.trim() || 'ผู้ปกครอง',
        display_name: trimmedName,
        phone: guardianPhone.trim() || null,
        is_primary: selectedGuardians.length === 0,
        consent_status: guardianConsent,
      })
      .select('id,student_id,relation,display_name,phone,is_primary,consent_status')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    setGuardians((current) => [...current, data as GuardianRow]);
    setGuardianName('');
    setGuardianPhone('');
    setGuardianConsent('pending');
    setNotice('เพิ่มผู้ปกครองและสถานะ consent สำเร็จ');
    setIsSubmitting(false);
  }

  async function handlePortalInvitationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนส่งคำเชิญ');
      setIsSubmitting(false);
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setNotice('กรุณากรอกอีเมลสำหรับส่งคำเชิญให้ถูกต้อง');
      setIsSubmitting(false);
      return;
    }

    const relation = inviteRelation.trim() || (inviteRole === 'student' ? 'บัญชีนักเรียน' : 'ผู้ปกครอง');

    if (!supabase || !session.workspace) {
      const localInvite: PortalInvitationRow = {
        created_at: new Date().toISOString(),
        id: `demo-portal-invite-${Date.now()}`,
        invite_email: normalizedEmail,
        portal_role: inviteRole,
        relation,
        status: 'invited',
        student_id: selectedStudent.id,
      };
      setPortalInvitations((current) => [localInvite, ...current]);
      setInviteEmail('');
      setInviteRole('student');
      setInviteRelation('บัญชีนักเรียน');
      setNotice('สร้างคำเชิญ Portal ในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('portal_invitations')
      .insert({
        workspace_id: session.workspace.id,
        student_id: selectedStudent.id,
        portal_role: inviteRole,
        invite_email: normalizedEmail,
        relation,
        status: 'invited',
        invited_by: session.profile.id,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      })
      .select('id,student_id,portal_role,invite_email,relation,status,created_at')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    setPortalInvitations((current) => [data as PortalInvitationRow, ...current]);
    setInviteEmail('');
    setInviteRole('student');
    setInviteRelation('บัญชีนักเรียน');
    setNotice('สร้างคำเชิญ Portal สำเร็จ ขั้นส่งอีเมล/รับสิทธิ์จริงจะต่อผ่าน Edge Function');
    setIsSubmitting(false);
  }

  async function updatePortalInvitationStatus(invite: PortalInvitationRow, status: PortalInviteStatus) {
    setNotice(null);

    if (!supabase || !session.workspace) {
      setPortalInvitations((current) => current.map((item) => (item.id === invite.id ? { ...item, status } : item)));
      setNotice(`เปลี่ยนสถานะคำเชิญเป็น ${portalInviteStatusLabels[status]} ในโหมดตัวอย่างแล้ว`);
      return;
    }

    const { data, error } = await supabase
      .from('portal_invitations')
      .update({ status })
      .eq('id', invite.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,student_id,portal_role,invite_email,relation,status,created_at')
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setPortalInvitations((current) => current.map((item) => (item.id === invite.id ? (data as PortalInvitationRow) : item)));
    setNotice(`เปลี่ยนสถานะคำเชิญเป็น ${portalInviteStatusLabels[status]} สำเร็จ`);
  }

  async function handleStudentLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนผูกบัญชี');
      setIsSubmitting(false);
      return;
    }

    const trimmedProfileId = studentProfileId.trim();
    if (!trimmedProfileId) {
      setNotice('กรุณากรอก profile_id ของบัญชีนักเรียน');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const existingLink = studentLinks.find((link) => link.student_id === selectedStudent.id);
      const nextLink: StudentProfileLinkRow = {
        id: existingLink?.id || `demo-student-link-${Date.now()}`,
        linked_at: existingLink?.linked_at || new Date().toISOString(),
        profile_id: trimmedProfileId,
        status: studentLinkStatus,
        student_id: selectedStudent.id,
      };
      setStudentLinks((current) =>
        existingLink
          ? current.map((link) => (link.id === existingLink.id ? nextLink : link))
          : [...current, nextLink],
      );
      setStudentProfileId('');
      setStudentLinkStatus('active');
      setNotice('ผูกบัญชีนักเรียนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const existingLink = selectedStudentLinks[0];
    const payload = {
      linked_by: session.profile.id,
      profile_id: trimmedProfileId,
      status: studentLinkStatus,
      student_id: selectedStudent.id,
      workspace_id: session.workspace.id,
    };

    const { data, error } = existingLink
      ? await supabase
          .from('student_profile_links')
          .update(payload)
          .eq('id', existingLink.id)
          .eq('workspace_id', session.workspace.id)
          .select('id,student_id,profile_id,status,linked_at')
          .single()
      : await supabase
          .from('student_profile_links')
          .insert(payload)
          .select('id,student_id,profile_id,status,linked_at')
          .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const nextLink = data as StudentProfileLinkRow;
    setStudentLinks((current) =>
      existingLink
        ? current.map((link) => (link.id === existingLink.id ? nextLink : link))
        : [nextLink, ...current],
    );
    setStudentProfileId('');
    setStudentLinkStatus('active');
    setNotice('ผูกบัญชีนักเรียนสำเร็จ Student Portal จะอ่านผ่าน student_profile_links และ RLS');
    setIsSubmitting(false);
  }

  async function updateStudentLinkStatus(link: StudentProfileLinkRow, status: StudentLinkStatus) {
    setNotice(null);

    if (!supabase || !session.workspace) {
      setStudentLinks((current) => current.map((item) => (item.id === link.id ? { ...item, status } : item)));
      setNotice(`เปลี่ยนสถานะบัญชีนักเรียนเป็น ${studentLinkStatusLabels[status]} ในโหมดตัวอย่างแล้ว`);
      return;
    }

    const { data, error } = await supabase
      .from('student_profile_links')
      .update({ status })
      .eq('id', link.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,student_id,profile_id,status,linked_at')
      .single();

    if (error) {
      setNotice(error.message);
      return;
    }

    setStudentLinks((current) => current.map((item) => (item.id === link.id ? (data as StudentProfileLinkRow) : item)));
    setNotice(`เปลี่ยนสถานะบัญชีนักเรียนเป็น ${studentLinkStatusLabels[status]} สำเร็จ`);
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="nexus-kicker">
            <Users size={18} aria-hidden="true" />
            Student 360
          </div>
          <h1 className="app-page-title">
            {activeStudentTask.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            {session.workspace?.schoolName || 'Demo Workspace'} | {session.workspace?.classroomName || 'ป.5/2'} | {activeStudentTask.description}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
          {[
            { label: 'ทั้งหมด', value: students.length },
            { label: 'กำลังเรียน', value: activeStudents.length },
            { label: 'ติดตาม', value: careStudents.length },
          ].map((item) => (
            <div className="nexus-card p-3 text-center transition hover:-translate-y-1" key={item.label}>
              <p className="text-2xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <nav
        aria-label="เมนูย่อย Student 360"
        className="mt-5 flex gap-2 overflow-x-auto rounded-3xl border border-amber-200/70 bg-white/80 p-2 shadow-sm lg:hidden"
      >
        {studentTaskLinks.map((item) => (
          <Link
            className={`inline-flex h-10 shrink-0 items-center justify-center rounded-2xl px-4 text-xs font-black ring-1 transition hover:-translate-y-0.5 ${
              activeStudentView === item.value
                ? 'bg-slate-950 text-white ring-slate-950'
                : 'text-slate-600 ring-slate-200 hover:bg-slate-950 hover:text-white hover:ring-slate-950'
            }`}
            key={item.value}
            to={`/app/dashboard?view=students&studentView=${item.value}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {!['roster', 'quality'].includes(activeStudentView) ? (
        <section className="mt-5 rounded-[28px] border border-amber-200/70 bg-white/90 p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] lg:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-100">
                <UserRound size={15} aria-hidden="true" />
                เลือกนักเรียน
              </div>
              <h2 className="mt-3 truncate text-2xl font-black text-slate-950">
                {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'ยังไม่ได้เลือกนักเรียน'}
              </h2>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                {selectedStudent
                  ? `${selectedStudent.student_code || 'ไม่มีรหัส'} | ${selectedClassroom?.name || 'ยังไม่ระบุห้อง'} | ${statusLabels[selectedStudent.status]}`
                  : 'เลือกนักเรียนจากช่องด้านขวาเพื่อทำงานในหน้านี้'}
              </p>
            </div>

            <label className="grid gap-2 text-sm font-black text-slate-700">
              เปลี่ยนนักเรียนในหน้านี้
              <select
                className="nexus-field h-12 w-full px-3"
                disabled={studentSwitcherOptions.length === 0}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                value={selectedStudent?.id || ''}
              >
                {studentSwitcherOptions.length === 0 ? <option value="">ยังไม่มีรายชื่อนักเรียน</option> : null}
                {studentSwitcherOptions.map((student) => {
                  const classroom = classrooms.find((item) => item.id === student.classroom_id);

                  return (
                    <option key={student.id} value={student.id}>
                      {student.student_code ? `${student.student_code} - ` : ''}
                      {student.first_name} {student.last_name}
                      {classroom ? ` | ${classroom.name}` : ' | ยังไม่ผูกห้อง'}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {activeStudentView === 'quality' ? (
        <section className="mt-5 grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="nexus-kicker">
                  <AlertTriangle size={18} aria-hidden="true" />
                  Data Quality Center
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">ตรวจว่าทำไมรายชื่อนักเรียนไม่โผล่</h2>
                <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">
                  ใช้หน้านี้หลัง import ทุกครั้ง เพื่อตรวจข้อมูลซ้ำ นักเรียนไม่มีห้อง ชื่อ/รหัสว่าง และสถานะที่ถูกซ่อนจากตัวกรองปกติ
                </p>
              </div>
              <div className={`rounded-3xl px-5 py-4 text-center ring-1 ${
                qualityIssueCount === 0
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
                  : 'bg-amber-50 text-amber-800 ring-amber-100'
              }`}>
                <p className="text-3xl font-black">{qualityIssueCount}</p>
                <p className="text-xs font-black">จุดที่ควรตรวจ</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'ไม่มีห้อง', value: studentsWithoutClassroom.length, tone: 'amber' },
                { label: 'ชื่อ/รหัสว่าง', value: studentsWithBlankIdentity.length, tone: 'rose' },
                { label: 'ซ้ำ', value: duplicateStudentGroups.reduce((sum, item) => sum + item.group.length, 0), tone: 'cyan' },
                { label: 'ถูกซ่อนด้วยสถานะ', value: archivedOrInactiveStudents.length, tone: 'slate' },
              ].map((item) => (
                <div className="rounded-[24px] border border-slate-200 bg-white/88 p-4 shadow-sm" key={item.label}>
                  <p className="text-3xl font-black text-slate-950">{item.value}</p>
                  <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-4">
                <h3 className="text-lg font-black text-amber-950">เช็กลำดับนี้เมื่อ import แล้วรายชื่อไม่ขึ้น</h3>
                <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-amber-900">
                  {[
                    'เปิดตัวกรองเป็นทุกห้องเรียนและทุกสถานะก่อน',
                    'ดูว่ารายชื่อถูก import เข้าห้องผิด หรือไม่มี classroom_id หรือไม่',
                    'ตรวจว่ามี workspace ซ้ำและ import เข้า workspace คนละอันหรือไม่',
                    'ถ้านำเข้าผิดไฟล์ ให้ไปหน้า นำเข้า/สำรอง แล้วใช้จัดการข้อมูลนำเข้าหรือลบรายชื่อที่ผิด',
                  ].map((item) => (
                    <div className="flex gap-2" key={item}>
                      <CheckCircle2 className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 text-xs font-black text-amber-800 shadow-sm transition hover:-translate-y-0.5"
                    onClick={() => {
                      setQuery('');
                      setRosterClassroomFilter('all');
                      setRosterStatusFilter('all');
                    }}
                    type="button"
                  >
                    ล้างตัวกรองรายชื่อ
                  </button>
                  <Link
                    className="blue-action inline-flex h-10 items-center justify-center rounded-2xl px-4 text-xs font-black"
                    to="/app/dashboard?view=import-export"
                  >
                    ไปหน้า Import / Backup
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <QualityList
                  classrooms={classrooms}
                  emptyLabel="ไม่พบนักเรียนที่ไม่มีห้อง"
                  onArchive={(student) => void updateStudentStatus(student, 'archived')}
                  onDelete={(student) => void deleteStudentPermanently(student)}
                  onSelect={setSelectedStudentId}
                  students={studentsWithoutClassroom}
                  title="นักเรียนไม่มีห้องหรือห้องถูกลบ"
                />
                <QualityList
                  classrooms={classrooms}
                  emptyLabel="ไม่พบข้อมูลชื่อ/รหัสว่าง"
                  onArchive={(student) => void updateStudentStatus(student, 'archived')}
                  onDelete={(student) => void deleteStudentPermanently(student)}
                  onSelect={setSelectedStudentId}
                  students={studentsWithBlankIdentity}
                  title="ชื่อ รหัส หรือข้อมูลหลักว่าง"
                />
              </div>
            </div>
          </div>

          <aside className="grid gap-5">
            <div className="nexus-card p-4 sm:p-5">
              <div className="nexus-kicker">
                <Users size={18} aria-hidden="true" />
                รายชื่อซ้ำ
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-950">{duplicateStudentGroups.length} กลุ่มซ้ำ</h2>
              <div className="mt-4 grid gap-3">
                {duplicateStudentGroups.map((item) => (
                  <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/55 p-3" key={item.key}>
                    <p className="text-xs font-black text-cyan-700">{item.group.length} รายการในกลุ่มนี้</p>
                    <div className="mt-2 grid gap-2">
                      {item.group.map((student) => {
                        const classroom = classrooms.find((classroomItem) => classroomItem.id === student.classroom_id);

                        return (
                          <div className="rounded-2xl bg-white/90 p-3 ring-1 ring-cyan-100" key={student.id}>
                            <button
                              className="text-left text-sm font-black text-slate-950"
                              onClick={() => setSelectedStudentId(student.id)}
                              type="button"
                            >
                              {student.student_code || 'ไม่มีรหัส'} | {student.first_name} {student.last_name}
                            </button>
                            <p className="mt-1 text-xs font-bold text-slate-500">{classroom?.name || 'ยังไม่ผูกห้อง'} | {statusLabels[student.status]}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {duplicateStudentGroups.length === 0 ? (
                  <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">ไม่พบรายชื่อนักเรียนซ้ำ</div>
                ) : null}
              </div>
            </div>

            <QualityList
              classrooms={classrooms}
              emptyLabel="ไม่มีนักเรียนที่ถูกซ่อนด้วยสถานะ"
              onArchive={(student) => void updateStudentStatus(student, 'active')}
              onDelete={(student) => void deleteStudentPermanently(student)}
              onSelect={setSelectedStudentId}
              students={archivedOrInactiveStudents}
              title="นักเรียนที่ไม่แสดงในตัวกรองกำลังเรียน"
            />
          </aside>
        </section>
      ) : null}

      {activeStudentView === 'roster' ? (
      <section id="student-roster" className="mt-5 scroll-mt-24 grid gap-5">
        <div className="nexus-card p-4 sm:p-5">
          <div className="grid gap-3 2xl:grid-cols-[minmax(220px,1fr)_220px_180px_auto] 2xl:items-center">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
              <input
                className="nexus-field h-11 w-full pl-10 pr-3"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อ รหัส ห้องเรียน สถานะ"
                value={query}
              />
            </label>

            <select
              className="nexus-field h-11 px-3"
              onChange={(event) => setRosterClassroomFilter(event.target.value)}
              value={rosterClassroomFilter}
            >
              <option value="all">ทุกห้องเรียน</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                </option>
              ))}
              <option value="">ยังไม่ผูกห้อง</option>
            </select>

            <select
              className="nexus-field h-11 px-3"
              onChange={(event) => setRosterStatusFilter(event.target.value as StudentStatus | 'all')}
              value={rosterStatusFilter}
            >
              <option value="active">กำลังเรียน</option>
              <option value="all">ทุกสถานะ</option>
              <option value="archived">เก็บถาวร</option>
              <option value="inactive">พักใช้งาน</option>
              <option value="transferred">ย้ายออก</option>
              <option value="graduated">จบแล้ว</option>
            </select>

            <div className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-3 text-xs font-black text-slate-600">
              <ShieldCheck size={16} className="text-teal-600" aria-hidden="true" />
              แสดง {filteredStudents.length}/{students.length}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead>
                <tr className="text-xs font-black uppercase text-slate-500">
                  <th className="px-3 py-3">รหัส</th>
                  <th className="px-3 py-3">ชื่อ-นามสกุล</th>
                  <th className="px-3 py-3">ห้องเรียน</th>
                  <th className="px-3 py-3">สถานะดูแล</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-3 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((student) => {
                  const classroom = classrooms.find((item) => item.id === student.classroom_id);
                  const isSelected = selectedStudent?.id === student.id;

                  return (
                    <tr className={isSelected ? 'bg-sky-50/80' : 'hover:bg-sky-50/50'} key={student.id}>
                      <td className="whitespace-nowrap px-3 py-3 font-black text-slate-700">{student.student_code || '-'}</td>
                      <td className="px-3 py-3">
                        <button
                          className="text-left"
                          onClick={() => setSelectedStudentId(student.id)}
                          type="button"
                        >
                          <span className="block font-black text-slate-950">
                            {student.first_name} {student.last_name}
                          </span>
                          <span className="text-xs font-bold text-slate-500">{student.nickname || 'ยังไม่มีชื่อเล่น'}</span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{classroom?.name || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                          {getCareLabel(student.care_flags)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                          {statusLabels[student.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="nexus-icon-button h-9 w-9"
                            onClick={() => startEditStudent(student)}
                            type="button"
                            title="แก้ไขนักเรียน"
                          >
                            <Edit3 size={16} aria-hidden="true" />
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-100 bg-white/85 text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50"
                            onClick={() => updateStudentStatus(student, student.status === 'archived' ? 'active' : 'archived')}
                            type="button"
                            title={student.status === 'archived' ? 'นำกลับมาใช้งาน' : 'เก็บถาวร'}
                          >
                            <Archive size={16} aria-hidden="true" />
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100"
                            onClick={() => void deleteStudentPermanently(student)}
                            type="button"
                            title="ลบถาวรเมื่อ import ซ้ำหรือผิด"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && filteredStudents.length === 0 ? (
            <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
              <p>
                {students.length === 0
                  ? 'workspace นี้ยังไม่มีนักเรียนในฐานข้อมูล จึงยังทดลองเช็กชื่อ/คะแนน/เยี่ยมบ้านไม่ได้'
                  : 'ยังไม่พบนักเรียนตามตัวกรองนี้ ลองเปลี่ยนเป็น “ทุกห้องเรียน” และ “ทุกสถานะ” เพื่อตรวจว่ารายชื่อถูกนำเข้าไปอยู่ห้อง/สถานะอื่นหรือไม่'}
              </p>
              {students.length === 0 ? (
                <button
                  className="blue-action mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isSubmitting || classrooms.length === 0}
                  onClick={() => void createDemoStudentsForCurrentWorkspace()}
                  type="button"
                >
                  <UserPlus size={17} aria-hidden="true" />
                  เพิ่มนักเรียนทดลอง 10 คน
                </button>
              ) : (
                <button
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl border border-amber-200 bg-white px-4 text-sm font-black text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50"
                  onClick={() => {
                    setQuery('');
                    setRosterClassroomFilter('all');
                    setRosterStatusFilter('all');
                  }}
                  type="button"
                >
                  ล้างตัวกรองและแสดงนักเรียนทั้งหมด
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5">
          <form className="nexus-card p-4 sm:p-5" onSubmit={handleStudentSubmit}>
            <div className="nexus-kicker">
              {editingStudentId ? <Edit3 size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
              {editingStudentId ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียน'}
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ห้องเรียน
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setStudentForm((current) => ({ ...current, classroomId: event.target.value }))}
                  value={studentForm.classroomId}
                >
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''}
                    </option>
                  ))}
                  {classrooms.length === 0 ? <option value="">สร้างจากห้องเรียนปัจจุบัน</option> : null}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                รหัสนักเรียน
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setStudentForm((current) => ({ ...current, studentCode: event.target.value }))}
                  placeholder="เช่น 001"
                  value={studentForm.studentCode}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อ
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setStudentForm((current) => ({ ...current, firstName: event.target.value }))}
                    value={studentForm.firstName}
                  />
                </label>

                <label className="grid gap-2 text-sm font-black text-slate-700">
                  นามสกุล
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setStudentForm((current) => ({ ...current, lastName: event.target.value }))}
                    value={studentForm.lastName}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อเล่น
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setStudentForm((current) => ({ ...current, nickname: event.target.value }))}
                  value={studentForm.nickname}
                />
              </label>

              <div className="rounded-3xl bg-cyan-50/70 p-4 ring-1 ring-cyan-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-cyan-800">รายงานหน้าแรก</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                      ใช้สำหรับให้ผู้ปกครองหรือนักเรียนเลือกโรงเรียน กรอกเลขบัตรและวันเกิด เพื่อดูเฉพาะรายงานที่โรงเรียนเปิดให้
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                    {selectedStudent?.metadata?.public_lookup_enabled || selectedStudent?.metadata?.public_lookup_id_hash
                      ? 'เปิดแล้ว'
                      : 'ยังไม่เปิด'}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    วันเกิดนักเรียน
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setStudentForm((current) => ({ ...current, birthDate: event.target.value }))}
                      type="date"
                      value={studentForm.birthDate}
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    เลขบัตรประชาชน 13 หลัก
                    <input
                      className="nexus-field h-11 px-3"
                      inputMode="numeric"
                      maxLength={13}
                      onChange={(event) =>
                        setStudentForm((current) => ({
                          ...current,
                          citizenId: normalizeCitizenId(event.target.value).slice(0, 13),
                        }))
                      }
                      placeholder="กรอกเมื่อต้องการเปิด public report"
                      value={studentForm.citizenId}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="blue-action inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'กำลังบันทึก' : editingStudentId ? 'บันทึกการแก้ไข' : 'บันทึกนักเรียน'}
                <Save size={17} aria-hidden="true" />
              </button>
              {editingStudentId ? (
                <button
                  className="nexus-pill inline-flex h-11 items-center justify-center px-3 text-sm font-black text-slate-700 transition hover:-translate-y-0.5"
                  onClick={() => resetStudentForm(studentForm.classroomId)}
                  type="button"
                >
                  ยกเลิก
                </button>
              ) : null}
            </div>
          </form>

          <form className="nexus-card p-4 sm:p-5" onSubmit={handleCreateClassroom}>
            <div className="nexus-kicker">
              <School size={16} aria-hidden="true" />
              ห้องเรียน
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อห้อง
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setClassroomName(event.target.value)}
                  value={classroomName}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ระดับชั้น
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setGradeLevel(event.target.value)}
                    value={gradeLevel}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ปีการศึกษา
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setAcademicYear(event.target.value)}
                    value={academicYear}
                  />
                </label>
              </div>
            </div>
            <button
              className="nexus-pill mt-4 inline-flex h-11 w-full items-center justify-center gap-2 px-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5"
              disabled={isSubmitting}
              type="submit"
            >
              เพิ่มห้องเรียน
              <School size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>
      ) : null}

      {activeStudentView === 'home-visit' ? (
      <section id="student-home-visit" className="mt-5 scroll-mt-24 grid gap-5">
        <div className="nexus-card overflow-hidden p-0">
          <div className="bg-slate-950 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/20">
                  <Home size={14} aria-hidden="true" />
                  กสศ.01 / Home Visit
                </div>
                <h2 className="mt-3 text-2xl font-black">แบบเยี่ยมบ้านตามฟอร์ม กสศ.</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
                  เก็บข้อมูลครัวเรือน สภาพที่อยู่อาศัย การเดินทาง รูปถ่าย และการรับรองข้อมูลของนักเรียนที่เลือก
                </p>
              </div>
              <span className="rounded-3xl bg-white px-4 py-3 text-right text-slate-950">
                <span className="block text-2xl font-black">{homeVisitCompletion}%</span>
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Complete</span>
              </span>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:p-5">
            {[
              { label: 'สถานะเอกสาร', value: homeVisitStatusLabels[selectedHomeVisit.status], tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
              { label: 'สมาชิกครัวเรือน', value: selectedHomeVisit.householdMembers ? `${selectedHomeVisit.householdMembers} คน` : 'ยังไม่ระบุ', tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100' },
              { label: 'รายได้ครัวเรือน', value: selectedHomeVisit.householdIncome ? `${selectedHomeVisit.householdIncome} บาท/เดือน` : 'ยังไม่ระบุ', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
              { label: 'การเดินทาง', value: selectedHomeVisit.travelMethod || 'ยังไม่ระบุ', tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
            ].map((item) => (
              <div className={`rounded-3xl px-4 py-3 ring-1 ${item.tone}`} key={item.label}>
                <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{item.label}</p>
                <p className="mt-1 text-sm font-black">{item.value}</p>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <MapPin size={16} aria-hidden="true" />
                  ที่พักอาศัยปัจจุบัน
                </div>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  {selectedHomeVisit.address || 'ยังไม่มีที่อยู่เยี่ยมบ้าน'}
                </p>
                <a
                  className="mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-black text-white transition hover:-translate-y-0.5"
                  href={getGoogleMapsHref(selectedHomeVisit)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {selectedHomeVisit.googleMapUrl || (selectedHomeVisit.latitude && selectedHomeVisit.longitude)
                    ? 'เปิดหมุด Google Map'
                    : 'ค้นหาจากที่อยู่'}
                  <MapPin size={14} aria-hidden="true" />
                </a>
              </div>
              <div className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <Camera size={16} aria-hidden="true" />
                  รูปถ่ายประกอบ
                </div>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  {selectedHomeVisit.housePhotoNote || 'เตรียมช่องแนบภาพภายนอก/ภายในที่พักอาศัย'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form className="nexus-card p-4 sm:p-6 xl:p-8" data-testid="home-visit-form" onSubmit={handleHomeVisitSubmit}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-cyan-700">Home Visit Form</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {selectedStudent ? `แบบเยี่ยมบ้านของ ${selectedStudent.first_name}` : 'เลือกนักเรียนก่อนบันทึก'}
              </h2>
            </div>
            <Home className="text-cyan-600" size={26} aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-4">
            <section className="home-visit-section border-amber-200/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">01 Student & Guardian</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">ข้อมูลนักเรียนและผู้ปกครอง</h3>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">นร.01</span>
              </div>

              <div className="home-visit-grid mt-4">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  วันที่เยี่ยมบ้าน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('visitDate', event.target.value)}
                    type="date"
                    value={homeVisitForm.visitDate}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ผู้ปกครอง
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('guardianName', event.target.value)}
                    value={homeVisitForm.guardianName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ความสัมพันธ์
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('relationship', event.target.value)}
                    value={homeVisitForm.relationship}
                  />
                </label>
              </div>

              <div className="home-visit-grid mt-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เบอร์ติดต่อ
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="tel"
                    onChange={(event) => updateHomeVisitField('guardianPhone', event.target.value)}
                    placeholder="08x-xxx-xxxx"
                    value={homeVisitForm.guardianPhone}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  การศึกษาสูงสุด
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('guardianEducation', event.target.value)}
                    value={homeVisitForm.guardianEducation}
                  >
                    <option>ไม่ได้ศึกษา</option>
                    <option>ประถมศึกษา</option>
                    <option>มัธยมศึกษาตอนต้น</option>
                    <option>มัธยมศึกษาตอนปลาย/ปวช.</option>
                    <option>ปวส./อนุปริญญา</option>
                    <option>ปริญญาตรีขึ้นไป</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  อาชีพ
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('guardianOccupation', event.target.value)}
                    placeholder="เช่น เกษตรกร รับจ้าง ค้าขาย"
                    value={homeVisitForm.guardianOccupation}
                  />
                </label>
              </div>

              <div className="home-visit-grid mt-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  สถานภาพครอบครัว
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('familyStatus', event.target.value)}
                    value={homeVisitForm.familyStatus}
                  >
                    <option>พ่อแม่อยู่ด้วยกัน</option>
                    <option>พ่อแม่แยกกันอยู่</option>
                    <option>พ่อแม่หย่าร้าง</option>
                    <option>พ่อเสียชีวิต/สาบสูญ</option>
                    <option>แม่เสียชีวิต/สาบสูญ</option>
                    <option>เสียชีวิตทั้งคู่/สาบสูญ</option>
                    <option>พ่อ/แม่ทอดทิ้ง</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  นักเรียนอาศัยอยู่กับ
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('livingWith', event.target.value)}
                    value={homeVisitForm.livingWith}
                  >
                    <option>พ่อ/แม่</option>
                    <option>ญาติ</option>
                    <option>อยู่ลำพัง</option>
                    <option>ผู้อุปการะ/นายจ้าง</option>
                    <option>ครัวเรือนสถาบัน</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เลขบัตรผู้ปกครอง
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="numeric"
                    onChange={(event) => updateHomeVisitField('guardianCitizenId', event.target.value)}
                    placeholder="13 หลัก หรือเว้นว่าง"
                    value={homeVisitForm.guardianCitizenId}
                  />
                </label>
              </div>
            </section>

            <section className="home-visit-section border-cyan-200/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">02 Household</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">สมาชิกครัวเรือนและรายได้</h3>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">รวมทั้งบ้าน</span>
              </div>

              <div className="home-visit-grid mt-4">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  สมาชิกครัวเรือน
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="numeric"
                    onChange={(event) => updateHomeVisitField('householdMembers', event.target.value)}
                    placeholder="รวมตัวนักเรียน"
                    value={homeVisitForm.householdMembers}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  รายได้รวม/เดือน
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('householdIncome', event.target.value)}
                    placeholder="บาท"
                    value={homeVisitForm.householdIncome}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เงินมาโรงเรียน/วัน
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('dailyAllowance', event.target.value)}
                    placeholder="บาท"
                    value={homeVisitForm.dailyAllowance}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  สวัสดิการแห่งรัฐ
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('welfareSupport', event.target.value)}
                    value={homeVisitForm.welfareSupport}
                  >
                    <option>ไม่ได้รับสวัสดิการแห่งรัฐ</option>
                    <option>ได้สวัสดิการแห่งรัฐ</option>
                    <option>ไม่ทราบ/รอตรวจสอบ</option>
                  </select>
                </label>
              </div>

              <label className="mt-3 grid gap-2 text-sm font-black text-slate-700">
                ภาระพึ่งพิง / หมายเหตุครัวเรือน
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => updateHomeVisitField('dependencyNotes', event.target.value)}
                  placeholder="เช่น ผู้สูงอายุ ผู้พิการ ว่างงาน เลี้ยงเดี่ยว"
                  value={homeVisitForm.dependencyNotes}
                />
              </label>
            </section>

            <section className="home-visit-section border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">03 House & Map</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">ที่พักอาศัยและปักหมุด Google Map</h3>
                </div>
                <MapPin className="text-cyan-600" size={24} aria-hidden="true" />
              </div>

              <div className="home-visit-grid-wide mt-4">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ที่อยู่ปัจจุบัน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('address', event.target.value)}
                    placeholder="บ้านเลขที่ หมู่ ซอย ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                    value={homeVisitForm.address}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  การอยู่อาศัย
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('housingType', event.target.value)}
                    value={homeVisitForm.housingType}
                  >
                    <option>อยู่บ้านตนเอง/เจ้าของบ้าน</option>
                    <option>อยู่บ้านเช่า</option>
                    <option>อยู่กับผู้อื่น/อยู่ฟรี</option>
                    <option>หอพัก</option>
                    <option>ครัวเรือนสถาบัน</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-[24px] border border-sky-200 bg-sky-50/65 p-3 sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                  <label className="grid min-w-0 flex-1 gap-2 text-sm font-black text-slate-700">
                    ลิงก์ Google Maps / หมุดบ้าน
                    <input
                      className="nexus-field h-12 w-full px-3"
                      onChange={(event) => handleGoogleMapUrlChange(event.target.value)}
                      placeholder="วางลิงก์ Google Maps หลังเลือกหมุด เช่น https://maps.app.goo.gl/..."
                      value={homeVisitForm.googleMapUrl}
                    />
                  </label>
                  <a
                    className="sky-action inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                    href={getGoogleMapsPinHref(homeVisitForm)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    เปิด Google Maps เพื่อปักหมุด
                    <MapPin size={17} aria-hidden="true" />
                  </a>
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-sky-800">
                  วิธีใช้: กดเปิด Google Maps เพื่อค้นหาหรือเลือกตำแหน่งบ้าน จากนั้นคัดลอกลิงก์มาใส่ช่องนี้ ระบบจะดึงพิกัดจากลิงก์ให้เมื่อพบ lat/lng
                </p>
              </div>

              <div className="home-visit-grid mt-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อหมุด / จุดสังเกต
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('mapPlaceName', event.target.value)}
                    placeholder="เช่น บ้านนักเรียน หลังวัด"
                    value={homeVisitForm.mapPlaceName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Latitude
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('latitude', event.target.value)}
                    placeholder="เช่น 14.970000"
                    value={homeVisitForm.latitude}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Longitude
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('longitude', event.target.value)}
                    placeholder="เช่น 104.070000"
                    value={homeVisitForm.longitude}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ค่าเช่า/เดือน
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('rentPerMonth', event.target.value)}
                    placeholder="บาท"
                    value={homeVisitForm.rentPerMonth}
                  />
                </label>
              </div>

              <div className="home-visit-grid-wide mt-3">
                <button
                  className="sky-action inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                  onClick={useCurrentHomeVisitLocation}
                  type="button"
                >
                  ใช้พิกัดจากอุปกรณ์
                  <MapPin size={17} aria-hidden="true" />
                </button>
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-950 hover:text-white"
                  href={getGoogleMapsHref(homeVisitForm)}
                  rel="noreferrer"
                  target="_blank"
                >
                  เปิดหมุดที่บันทึกไว้
                  <MapPin size={17} aria-hidden="true" />
                </a>
              </div>
            </section>

            <section className="home-visit-section border-emerald-200/70">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">04 Living Condition</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">สภาพที่อยู่อาศัยและทรัพย์สิน</h3>
              </div>

              <div className="home-visit-grid mt-4">
                {[
                  { key: 'floorMaterial', label: 'พื้นบ้าน', options: ['กระเบื้อง/เซรามิค', 'ปาเก้/ไม้ขัดเงา', 'ซีเมนต์เปลือย', 'ไม้กระดาน', 'ไวนิล/กระเบื้องยาง', 'ไม้ไผ่', 'ดิน/ทราย', 'อื่น ๆ'] },
                  { key: 'wallMaterial', label: 'ฝาบ้าน', options: ['ฉาบซีเมนต์', 'อิฐ/ก้อนปูน/อิฐบล็อค', 'สังกะสี', 'ไม้กระดาน', 'ไม้อัด', 'สมาร์ทบอร์ด/ไฟเบอร์', 'ไม้ไผ่/เศษไม้', 'ดิน', 'ไวนิล', 'อื่น ๆ'] },
                  { key: 'roofMaterial', label: 'หลังคา', options: ['โลหะ', 'กระเบื้อง/เซรามิค', 'ไม้กระดาน', 'ใบไม้/วัสดุธรรมชาติ', 'ไวนิล/กระดาษ/แผ่นพลาสติก', 'อื่น ๆ'] },
                ].map((field) => (
                  <label className="grid gap-2 text-sm font-black text-slate-700" key={field.key}>
                    {field.label}
                    <select
                      className="nexus-field h-11 px-3"
                      onChange={(event) => updateHomeVisitField(field.key as keyof HomeVisitFormState, event.target.value)}
                      value={String(homeVisitForm[field.key as keyof HomeVisitFormState])}
                    >
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="home-visit-grid mt-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ห้องส้วม
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('toilet', event.target.value)}
                    value={homeVisitForm.toilet}
                  >
                    <option>มี</option>
                    <option>ไม่มี</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  แหล่งน้ำดื่ม
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('drinkingWater', event.target.value)}
                    value={homeVisitForm.drinkingWater}
                  >
                    <option>น้ำดื่มบรรจุขวด/ตู้หยอดน้ำ</option>
                    <option>น้ำประปา</option>
                    <option>น้ำบ่อ/น้ำบาดาล</option>
                    <option>น้ำฝน/น้ำประปาภูเขา/ลำธาร</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  แหล่งไฟฟ้า
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('electricity', event.target.value)}
                    value={homeVisitForm.electricity}
                  >
                    <option>ไม่มีไฟฟ้า</option>
                    <option>เครื่องปั่นไฟ/โซลาเซลล์</option>
                    <option>ไฟต่อพ่วง/แบตเตอรี่</option>
                    <option>ไฟบ้านหรือมิเตอร์</option>
                  </select>
                </label>
              </div>

              <div className="home-visit-grid mt-3">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ที่ดินเกษตร
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('farmingLand', event.target.value)}
                    value={homeVisitForm.farmingLand}
                  >
                    <option>ไม่ทำเกษตร</option>
                    <option>ทำเกษตร มีที่ดินน้อยกว่า 1 ไร่</option>
                    <option>ทำเกษตร มีที่ดิน 1 ถึง 5 ไร่</option>
                    <option>ทำเกษตร มีที่ดินมากกว่า 5 ไร่</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ยานพาหนะที่ใช้งานได้
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('vehicles', event.target.value)}
                    placeholder="เช่น ไม่มี, รถมอเตอร์ไซค์, รถปิกอัพ"
                    value={homeVisitForm.vehicles}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ของใช้ในครัวเรือน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('appliances', event.target.value)}
                    placeholder="เช่น ตู้เย็น ทีวี เครื่องซักผ้า"
                    value={homeVisitForm.appliances}
                  />
                </label>
              </div>
            </section>

            <section className="home-visit-section border-orange-200/70">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">05 Travel</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">การเดินทางจากที่พักไปโรงเรียน</h3>
              </div>

              <div className="home-visit-grid mt-4">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  วิธีเดินทางหลัก
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) => updateHomeVisitField('travelMethod', event.target.value)}
                    value={homeVisitForm.travelMethod}
                  >
                    <option>เดิน</option>
                    <option>จักรยาน</option>
                    <option>รถโรงเรียน</option>
                    <option>จักรยานยนต์ส่วนตัว</option>
                    <option>รถส่วนตัว</option>
                    <option>เรือส่วนตัว</option>
                    <option>จักรยานยนต์รับจ้าง</option>
                    <option>รถโดยสารประจำทาง/รับจ้าง</option>
                    <option>เรือโดยสารประจำทาง/รับจ้าง</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ระยะทาง กม.
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('distanceKm', event.target.value)}
                    value={homeVisitForm.distanceKm}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  เวลา นาที
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="numeric"
                    onChange={(event) => updateHomeVisitField('travelMinutes', event.target.value)}
                    value={homeVisitForm.travelMinutes}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ค่าเดินทาง/เดือน
                  <input
                    className="nexus-field h-11 px-3"
                    inputMode="decimal"
                    onChange={(event) => updateHomeVisitField('travelCost', event.target.value)}
                    value={homeVisitForm.travelCost}
                  />
                </label>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                แหล่งที่มาภาพถ่าย
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => updateHomeVisitField('photoSource', event.target.value)}
                  value={homeVisitForm.photoSource}
                >
                  <option>คุณครูลงเยี่ยมบ้านด้วยตนเอง</option>
                  <option>ให้นักเรียนถ่ายภาพมาให้</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ประเภทภาพถ่าย
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => updateHomeVisitField('photoType', event.target.value)}
                  value={homeVisitForm.photoType}
                >
                  <option>ภาพถ่ายที่พักอาศัย/หอพักของนักเรียน</option>
                  <option>ภาพถ่ายครัวเรือนสถาบัน</option>
                  <option>ภาพถ่ายนักเรียนคู่กับป้ายโรงเรียน</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  description: 'กรุณาถ่ายให้เห็นหลังคาและฝาผนังของที่พักอาศัยทั้งหลัง',
                  file: homeVisitOutdoorFile,
                  label: 'รูปที่ 1 ภายนอกที่พักอาศัย',
                  savedLabel: homeVisitForm.outdoorPhotoLabel,
                  setFile: setHomeVisitOutdoorFile,
                },
                {
                  description: 'กรุณาถ่ายให้เห็นพื้นและบริเวณภายในของที่พักอาศัย',
                  file: homeVisitIndoorFile,
                  label: 'รูปที่ 2 ภายในที่พักอาศัย',
                  savedLabel: homeVisitForm.indoorPhotoLabel,
                  setFile: setHomeVisitIndoorFile,
                },
              ].map((item) => (
                <label
                  className="group grid cursor-pointer gap-3 rounded-3xl border border-dashed border-sky-200 bg-sky-50/70 p-4 transition hover:-translate-y-0.5 hover:bg-sky-100"
                  key={item.label}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-black text-slate-950">
                      <Camera size={16} aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                      <Upload size={13} aria-hidden="true" />
                    </span>
                  </span>
                  <span className="text-xs font-bold leading-5 text-slate-500">{item.description}</span>
                  <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                    {item.file?.name || item.savedLabel || 'ยังไม่ได้เลือกไฟล์'}
                  </span>
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => item.setFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>
              ))}
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs font-bold leading-5 text-emerald-800">
              ระบบจะย่อรูปอัตโนมัติก่อนอัปโหลด: ด้านยาวไม่เกิน {HOME_VISIT_PHOTO_MAX_EDGE}px และบีบอัดเป็น JPEG เพื่อประหยัดพื้นที่จัดเก็บ
            </div>

            <label className="grid gap-2 text-sm font-black text-slate-700">
              หมายเหตุภาพถ่าย/ข้อจำกัด
              <textarea
                className="nexus-field min-h-20 px-3 py-3"
                onChange={(event) => updateHomeVisitField('housePhotoNote', event.target.value)}
                placeholder="เช่น ต้องแนบภาพภายนอกและภายใน หรือเหตุผลกรณีถ่ายภาพที่พักไม่ได้"
                value={homeVisitForm.housePhotoNote}
              />
            </label>

            <label className="flex items-start gap-3 rounded-3xl bg-cyan-50 p-4 text-sm font-bold leading-6 text-slate-700 ring-1 ring-cyan-100">
              <input
                checked={homeVisitForm.consentAccepted}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600"
                onChange={(event) => updateHomeVisitField('consentAccepted', event.target.checked)}
                type="checkbox"
              />
              รับรองว่าได้แจ้งวัตถุประสงค์การเก็บข้อมูลและข้อมูลส่วนบุคคลตามแบบ กสศ.01 แล้ว
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              className="sky-action inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || !selectedStudent}
              type="submit"
            >
              บันทึกแบบเยี่ยมบ้าน
              <Save size={17} aria-hidden="true" />
            </button>
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedStudent}
              onClick={handlePrintHomeVisit}
              type="button"
            >
              พิมพ์ / Save PDF
              <Printer size={17} aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
      ) : null}

      {activeStudentView === 'timeline' ? (
      <section id="student-timeline" className="nexus-card mt-5 scroll-mt-24 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="nexus-kicker">
              <History size={16} aria-hidden="true" />
              Activity Timeline
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {selectedStudent
                ? `ประวัติการทำงานของ ${selectedStudent.first_name}`
                : 'เลือกนักเรียนเพื่อดูประวัติการทำงาน'}
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              แสดงร่องรอยสำคัญจาก Student 360, เคสดูแล และแบบเยี่ยมบ้าน/กสศ.01 สำหรับตรวจสอบย้อนหลัง
            </p>
          </div>
          <span className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-cyan-100">
            {selectedAuditLogs.length} รายการล่าสุด
          </span>
        </div>

        {selectedStudent ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {selectedAuditLogs.length > 0 ? (
              selectedAuditLogs.map((log) => (
                <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={log.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${getAuditRiskTone(log.risk_level)}`}>
                        {auditRiskLabels[log.risk_level]}
                      </span>
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                        {log.entity_table || 'student_360'}
                      </span>
                    </div>
                    <time className="text-xs font-black text-slate-400">
                      {new Date(log.created_at).toLocaleString('th-TH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                  <h3 className="mt-3 text-base font-black text-slate-950">
                    {auditActionLabels[log.action] || log.action}
                  </h3>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{getAuditSummary(log)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-400">
                    <span>actor: {log.actor_role || '-'}</span>
                    <span>id: {log.entity_id ? log.entity_id.slice(0, 8) : '-'}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100 lg:col-span-2">
                ยังไม่มี audit log สำหรับนักเรียนคนนี้ เมื่อเพิ่ม/แก้ไขข้อมูล เคสดูแล หรือแบบเยี่ยมบ้าน ระบบจะแสดงรายการล่าสุดที่นี่
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
            เลือกนักเรียนจากตารางด้านบนก่อนเพื่อดู activity timeline
          </div>
        )}
      </section>
      ) : null}

      {activeStudentView === 'profile' ? (
      <section id="student-profile" className="mt-5 scroll-mt-24 grid gap-5">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black text-sky-700">Student Profile</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {selectedStudent
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : 'เลือกนักเรียนเพื่อดูโปรไฟล์รายคน'}
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                {selectedStudent
                  ? `${selectedStudent.student_code || 'ไม่มีรหัส'} | ${selectedClassroom?.name || 'ยังไม่ระบุห้องเรียน'}`
                  : 'โปรไฟล์นี้รวมข้อมูลพื้นฐาน ผู้ปกครอง Portal และเคสดูแลไว้ในจุดเดียว'}
              </p>
            </div>
            {selectedStudent ? (
              <button
                className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                onClick={() => startEditStudent(selectedStudent)}
                type="button"
              >
                แก้ไขข้อมูล
                <Edit3 size={17} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {selectedStudent ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'สถานะนักเรียน', value: statusLabels[selectedStudent.status], tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100' },
                { label: 'เคสเปิดอยู่', value: `${openCareCases.length} เคส`, tone: openCareCases.length > 0 ? 'bg-rose-50 text-rose-700 ring-rose-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
                { label: 'ผู้ปกครองยินยอม', value: `${grantedGuardians.length}/${selectedGuardians.length} คน`, tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
                { label: 'Student Portal', value: selectedStudentLinks.some((link) => link.status === 'active') ? 'พร้อมใช้งาน' : 'ยังไม่ active', tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
              ].map((item) => (
                <div className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={item.label}>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                  <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-black ring-1 ${item.tone}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {selectedStudent ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <article className="nexus-muted-box p-4">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <UserRound size={17} className="text-sky-600" aria-hidden="true" />
                  ข้อมูลพื้นฐาน
                </div>
                <dl className="mt-3 grid gap-2 text-sm font-bold text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt>ชื่อเล่น</dt>
                    <dd className="text-right text-slate-950">{selectedStudent.nickname || '-'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>ห้องเรียน</dt>
                    <dd className="text-right text-slate-950">{selectedClassroom?.name || '-'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>ปีการศึกษา</dt>
                    <dd className="text-right text-slate-950">{selectedClassroom?.academic_year || session.workspace?.academicYear || '-'}</dd>
                  </div>
                </dl>
              </article>

              <article className="nexus-muted-box p-4">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <Phone size={17} className="text-emerald-600" aria-hidden="true" />
                  ผู้ปกครองหลัก
                </div>
                {primaryGuardian ? (
                  <div className="mt-3">
                    <p className="font-black text-slate-950">{primaryGuardian.display_name}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {primaryGuardian.relation} {primaryGuardian.phone ? `| ${primaryGuardian.phone}` : ''}
                    </p>
                    <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                      {consentLabels[primaryGuardian.consent_status]}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-bold text-slate-500">ยังไม่มีข้อมูลผู้ปกครอง</p>
                )}
              </article>

              <article className="nexus-muted-box p-4">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <ShieldCheck size={17} className="text-rose-600" aria-hidden="true" />
                  เคสดูแลล่าสุด
                </div>
                {selectedCareCases[0] ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100">
                        {carePriorityLabels[selectedCareCases[0].risk_level]}
                      </span>
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                        {careCaseStatusLabels[selectedCareCases[0].status]}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-slate-600">{selectedCareCases[0].summary}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-bold text-slate-500">ยังไม่มีเคสดูแล</p>
                )}
              </article>
            </div>
          ) : (
            <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
              เลือกนักเรียนจากตารางด้านบนเพื่อเปิดโปรไฟล์รายคน
            </div>
          )}
        </div>

        <div className="nexus-card p-4 sm:p-5">
          <div className="nexus-kicker">
            <Link2 size={16} aria-hidden="true" />
            Quick Links
          </div>
          <div className="mt-4 grid gap-3">
            {[
              { label: 'ผู้ปกครอง', value: `${selectedGuardians.length} คน`, icon: Users },
              { label: 'คำเชิญ Portal', value: `${selectedPortalInvitations.length} รายการ`, icon: Mail },
              { label: 'บัญชี Student', value: selectedStudentLinks[0]?.status ? studentLinkStatusLabels[selectedStudentLinks[0].status] : 'ยังไม่ผูก', icon: Link2 },
              { label: 'เคสดูแลทั้งหมด', value: `${selectedCareCases.length} เคส`, icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={item.label}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{item.label}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{item.value}</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      ) : null}

      {activeStudentView === 'care' ? (
      <section id="student-care" className="mt-5 scroll-mt-24 grid gap-5">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-rose-700">Care Quick Log</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {selectedStudent
                  ? `ติดตาม ${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : 'เลือกนักเรียนเพื่อดูเคสดูแล'}
              </h2>
            </div>
            <ShieldCheck className="text-rose-600" size={28} aria-hidden="true" />
          </div>

          {selectedStudent ? (
            <div className="mt-4 grid gap-3">
              <div className="nexus-muted-box p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100">
                    {getCareLabel(selectedStudent.care_flags)}
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                  {String(selectedStudent.care_flags.careType || 'ยังไม่ระบุประเภท')}
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                  {carePriorityLabels[(selectedStudent.care_flags.carePriority as CarePriority) || 'normal']}
                </span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                  {String(selectedStudent.care_flags.careLastNote || 'ยังไม่มีบันทึกเคสดูแลล่าสุด')}
                </p>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  นัดหมายถัดไป: {String(selectedStudent.care_flags.careNextAction || '-')}
                </p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Case Timeline</p>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
                    {selectedCareCases.length} เคส
                  </span>
                </div>
                {selectedCareCases.length > 0 ? (
                  selectedCareCases.slice(0, 4).map((careCase) => {
                    const isEditingCareCase = editingCareCaseId === careCase.id;
                    const isSelectedCareCase = selectedCareCase?.id === careCase.id;

                    return (
                      <article
                        className={`rounded-3xl bg-white/85 p-4 ring-1 transition ${
                          isSelectedCareCase ? 'ring-2 ring-sky-300 shadow-[0_18px_40px_rgba(14,165,233,0.18)]' : 'ring-slate-100'
                        }`}
                        data-testid={`care-case-${careCase.id}`}
                        key={careCase.id}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100">
                            {carePriorityLabels[careCase.risk_level]}
                          </span>
                          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                            {careCaseStatusLabels[careCase.status]}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {careCase.opened_at ? new Date(careCase.opened_at).toLocaleDateString('th-TH') : 'ยังไม่ระบุวันที่'}
                          </span>
                        </div>

                        {isEditingCareCase ? (
                          <div className="mt-3 grid gap-3 rounded-3xl bg-sky-50/70 p-3 ring-1 ring-sky-100">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                              <label className="grid gap-2 text-xs font-black text-slate-700">
                                ประเภทเคส
                                <input
                                  className="nexus-field h-11 px-3 text-sm"
                                  onChange={(event) => setCareCaseEditType(event.target.value)}
                                  value={careCaseEditType}
                                />
                              </label>
                              <label className="grid gap-2 text-xs font-black text-slate-700">
                                ระดับติดตาม
                                <select
                                  className="nexus-field h-11 px-3 text-sm"
                                  onChange={(event) => setCareCaseEditPriority(event.target.value as CarePriority)}
                                  value={careCaseEditPriority}
                                >
                                  <option value="normal">เฝ้าดูทั่วไป</option>
                                  <option value="watch">ต้องติดตาม</option>
                                  <option value="urgent">ติดตามด่วน</option>
                                </select>
                              </label>
                            </div>
                            <label className="grid gap-2 text-xs font-black text-slate-700">
                              รายละเอียดเคส
                              <textarea
                                className="nexus-field min-h-24 px-3 py-3 text-sm"
                                onChange={(event) => setCareCaseEditSummary(event.target.value)}
                                value={careCaseEditSummary}
                              />
                            </label>
                            <label className="grid gap-2 text-xs font-black text-slate-700">
                              สิ่งที่ต้องทำต่อ
                              <input
                                className="nexus-field h-11 px-3 text-sm"
                                onChange={(event) => setCareCaseEditNextAction(event.target.value)}
                                value={careCaseEditNextAction}
                              />
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid={`care-case-save-${careCase.id}`}
                                disabled={isSubmitting}
                                onClick={() => handleCareCaseUpdate(careCase)}
                                type="button"
                              >
                                <Save size={14} aria-hidden="true" />
                                บันทึกการแก้ไข
                              </button>
                              <button
                                className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid={`care-case-cancel-${careCase.id}`}
                                disabled={isSubmitting}
                                onClick={resetCareCaseEdit}
                                type="button"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="mt-3 font-black text-slate-950">{careCase.case_type}</h3>
                            <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{careCase.summary}</p>
                            {careCase.next_action ? (
                              <p className="mt-2 text-xs font-black text-slate-500">ถัดไป: {careCase.next_action}</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid={`care-case-detail-${careCase.id}`}
                                disabled={isSubmitting}
                                onClick={() => setSelectedCareCaseId(careCase.id)}
                                type="button"
                              >
                                ดูรายละเอียด
                              </button>
                              <button
                                className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-700 ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid={`care-case-edit-${careCase.id}`}
                                disabled={isSubmitting}
                                onClick={() => startEditCareCase(careCase)}
                                type="button"
                              >
                                <Edit3 size={14} aria-hidden="true" />
                                แก้ไข
                              </button>
                              {getCareCaseStatusActions(careCase.status).map((action) => (
                                <button
                                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={isSubmitting}
                                  key={action.status}
                                  onClick={() => updateCareCaseStatus(careCase, action.status)}
                                  type="button"
                                >
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-3xl bg-white/80 p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
                    ยังไม่มีประวัติเคสดูแลสำหรับนักเรียนคนนี้
                  </div>
                )}
              </div>
              {selectedCareCase ? (
                <section
                  className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
                  data-testid="care-case-detail-panel"
                >
                  <div className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.28),transparent_36%),linear-gradient(135deg,rgba(15,23,42,1),rgba(3,7,18,1))] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Case Detail</p>
                        <h3 className="mt-2 text-xl font-black text-white">{selectedCareCase.case_type}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-300">
                          {selectedStudent.first_name} {selectedStudent.last_name}
                          {selectedClassroom ? ` | ${selectedClassroom.name}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/20">
                          {carePriorityLabels[selectedCareCase.risk_level]}
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white ring-1 ring-white/15">
                          {careCaseStatusLabels[selectedCareCase.status]}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          label: 'เปิดเคส',
                          value: selectedCareCase.opened_at
                            ? new Date(selectedCareCase.opened_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
                            : 'ยังไม่ระบุ',
                        },
                        {
                          label: 'ปิดเคส',
                          value: selectedCareCase.closed_at
                            ? new Date(selectedCareCase.closed_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
                            : 'ยังเปิดอยู่',
                        },
                        {
                          label: 'ผู้ปกครองหลัก',
                          value: primaryGuardian ? `${primaryGuardian.display_name} (${primaryGuardian.relation})` : 'ยังไม่บันทึก',
                        },
                      ].map((item) => (
                        <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/10" key={item.label}>
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                          <p className="mt-1 text-sm font-black leading-5 text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 bg-white p-4 text-slate-900 sm:p-5">
                    <div className="rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-100">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">บันทึกเคส</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{selectedCareCase.summary}</p>
                    </div>
                    <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">สิ่งที่ต้องทำต่อ</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                        {selectedCareCase.next_action || 'ยังไม่มี action ถัดไป'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSubmitting}
                        onClick={() => {
                          setSelectedCareCaseId(selectedCareCase.id);
                          startEditCareCase(selectedCareCase);
                        }}
                        type="button"
                      >
                        <Edit3 size={14} aria-hidden="true" />
                        แก้ไขเคสนี้
                      </button>
                      {getCareCaseStatusActions(selectedCareCase.status).map((action) => (
                        <button
                          className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSubmitting}
                          key={action.status}
                          onClick={() => updateCareCaseStatus(selectedCareCase, action.status)}
                          type="button"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="nexus-muted-box mt-4 p-4 text-sm font-bold text-slate-600">
              เลือกนักเรียนจากตารางด้านบนเพื่อดูและบันทึกเคสดูแล
            </div>
          )}
        </div>

        <form className="nexus-card p-4 sm:p-5" onSubmit={handleCareSubmit}>
          <div className="nexus-kicker">
            <ShieldCheck size={16} aria-hidden="true" />
            บันทึกเคสดูแล
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ระดับติดตาม
              <select
                className="nexus-field h-11 px-3"
                onChange={(event) => setCarePriority(event.target.value as CarePriority)}
                value={carePriority}
              >
                <option value="normal">เฝ้าดูทั่วไป</option>
                <option value="watch">ต้องติดตาม</option>
                <option value="urgent">ติดตามด่วน</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ประเภทเคส
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setCareType(event.target.value)}
                placeholder="เช่น เวลาเรียน งานค้าง พฤติกรรม สุขภาพ"
                value={careType}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              บันทึกการติดตาม
              <textarea
                className="nexus-field min-h-24 px-3 py-3"
                onChange={(event) => setCareNote(event.target.value)}
                placeholder="สรุปสิ่งที่พบหรือสิ่งที่ครูทำไปแล้ว"
                value={careNote}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              นัดหมาย/สิ่งที่ต้องทำต่อ
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setCareNextAction(event.target.value)}
                placeholder="เช่น โทรผู้ปกครองวันศุกร์"
                value={careNextAction}
              />
            </label>
          </div>
          <button
            className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting || !selectedStudent}
            type="submit"
          >
            บันทึกเคสดูแล
            <Save size={17} aria-hidden="true" />
          </button>
        </form>
      </section>
      ) : null}

      {activeStudentView === 'portal' ? (
      <>
      <section id="student-portal" className="mt-5 scroll-mt-24 grid gap-5">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-cyan-700">Portal Invitations</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {selectedStudent
                  ? `คำเชิญของ ${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : 'เลือกนักเรียนเพื่อดูคำเชิญ'}
              </h2>
            </div>
            <Mail className="text-cyan-600" size={28} aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-3">
            {selectedPortalInvitations.map((invite) => (
              <div className="nexus-muted-box grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_190px] md:items-center" key={invite.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                      {portalInviteRoleLabels[invite.portal_role]}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                      {portalInviteStatusLabels[invite.status]}
                    </span>
                  </div>
                  <p className="mt-3 truncate font-black text-slate-950">{invite.invite_email}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {invite.relation || '-'} | {invite.created_at ? new Date(invite.created_at).toLocaleDateString('th-TH') : 'ยังไม่ระบุวันที่'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  {(['invited', 'revoked', 'expired'] as PortalInviteStatus[]).map((status) => (
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-black ring-1 transition hover:-translate-y-0.5 ${
                        invite.status === status
                          ? 'bg-slate-950 text-white ring-slate-950'
                          : 'bg-white/90 text-slate-600 ring-slate-100'
                      }`}
                      key={status}
                      onClick={() => updatePortalInvitationStatus(invite, status)}
                      type="button"
                    >
                      {portalInviteStatusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {selectedPortalInvitations.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold leading-6 text-slate-600">
                ยังไม่มีคำเชิญ Portal สำหรับนักเรียนคนนี้ ส่งคำเชิญด้วยอีเมลก่อน แล้วขั้น accept จริงจะสร้าง guardian/student link ผ่าน Edge Function ในเฟสถัดไป
              </div>
            ) : null}
          </div>
        </div>

        <form className="nexus-card p-4 sm:p-5" onSubmit={handlePortalInvitationSubmit}>
          <div className="nexus-kicker">
            <Send size={16} aria-hidden="true" />
            ส่งคำเชิญ Portal
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              อีเมลผู้รับคำเชิญ
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={inviteEmail}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ประเภท Portal
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => {
                    const nextRole = event.target.value as PortalInviteRole;
                    setInviteRole(nextRole);
                    setInviteRelation(nextRole === 'student' ? 'บัญชีนักเรียน' : 'ผู้ปกครอง');
                  }}
                  value={inviteRole}
                >
                  <option value="student">นักเรียน</option>
                  <option value="parent">ผู้ปกครอง</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ความสัมพันธ์
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setInviteRelation(event.target.value)}
                  value={inviteRelation}
                />
              </label>
            </div>
          </div>
          <button
            className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting || !selectedStudent}
            type="submit"
          >
            สร้างคำเชิญ
            <Send size={17} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className="mt-5 grid gap-5">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-sky-700">Student Account Link</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {selectedStudent
                  ? `บัญชีของ ${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : 'เลือกนักเรียนเพื่อผูกบัญชี'}
              </h2>
            </div>
            <Link2 className="text-sky-600" size={28} aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-3">
            {selectedStudentLinks.map((link) => (
              <div className="nexus-muted-box grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-center" key={link.id}>
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{link.profile_id}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    profile_id | {link.linked_at ? new Date(link.linked_at).toLocaleDateString('th-TH') : 'ยังไม่มีเวลา link'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                  {(['active', 'suspended', 'removed'] as StudentLinkStatus[]).map((status) => (
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-black ring-1 transition hover:-translate-y-0.5 ${
                        link.status === status
                          ? 'bg-slate-950 text-white ring-slate-950'
                          : 'bg-white/90 text-slate-600 ring-slate-100'
                      }`}
                      key={status}
                      onClick={() => updateStudentLinkStatus(link, status)}
                      type="button"
                    >
                      {studentLinkStatusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {selectedStudentLinks.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold leading-6 text-slate-600">
                ยังไม่มีบัญชี student ที่ผูกกับนักเรียนคนนี้ กรอก profile_id แล้วตั้งสถานะ active เพื่อให้ Student Portal อ่านข้อมูลได้
              </div>
            ) : null}
          </div>
        </div>

        <form className="nexus-card p-4 sm:p-5" onSubmit={handleStudentLinkSubmit}>
          <div className="nexus-kicker">
            <Link2 size={16} aria-hidden="true" />
            ผูก Student Portal
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              profile_id ของบัญชี student
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setStudentProfileId(event.target.value)}
                placeholder="uuid จากตาราง profiles"
                value={studentProfileId}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              สถานะ link
              <select
                className="nexus-field h-11 px-3"
                onChange={(event) => setStudentLinkStatus(event.target.value as StudentLinkStatus)}
                value={studentLinkStatus}
              >
                <option value="active">ใช้งานได้</option>
                <option value="invited">เชิญแล้ว</option>
                <option value="suspended">พักสิทธิ์</option>
                <option value="removed">ยกเลิก</option>
              </select>
            </label>
          </div>
          <button
            className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting || !selectedStudent}
            type="submit"
          >
            บันทึกการผูกบัญชี
            <Link2 size={17} aria-hidden="true" />
          </button>
        </form>
      </section>

      <section className="mt-5 grid gap-5">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-teal-700">Guardian Consent</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">
                {selectedStudent
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : 'เลือกนักเรียนเพื่อดูผู้ปกครอง'}
              </h2>
            </div>
            <UserRound className="text-teal-600" size={28} aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-3">
            {selectedGuardians.map((guardian) => (
              <div className="nexus-muted-box flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between" key={guardian.id}>
                <div>
                  <p className="font-black text-slate-950">{guardian.display_name}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {guardian.relation} {guardian.phone ? `| ${guardian.phone}` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  {consentLabels[guardian.consent_status]}
                </span>
              </div>
            ))}

            {selectedGuardians.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ยังไม่มีข้อมูลผู้ปกครองสำหรับนักเรียนคนนี้
              </div>
            ) : null}
          </div>
        </div>

        <form className="nexus-card p-4 sm:p-5" onSubmit={handleGuardianSubmit}>
          <div className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-50/90 px-4 text-xs font-black text-amber-700 ring-1 ring-amber-100">
            <Phone size={16} aria-hidden="true" />
            เพิ่มผู้ปกครอง
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ชื่อผู้ปกครอง
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setGuardianName(event.target.value)}
                value={guardianName}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ความสัมพันธ์
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setGuardianRelation(event.target.value)}
                  value={guardianRelation}
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                เบอร์ติดต่อ
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setGuardianPhone(event.target.value)}
                  value={guardianPhone}
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              Consent
              <select
                className="nexus-field h-11 px-3"
                onChange={(event) => setGuardianConsent(event.target.value as ConsentStatus)}
                value={guardianConsent}
              >
                <option value="pending">รอยืนยัน</option>
                <option value="granted">ยินยอมแล้ว</option>
                <option value="revoked">ถอนยินยอม</option>
              </select>
            </label>
          </div>
          <button
            className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting || !selectedStudent}
            type="submit"
          >
            บันทึกผู้ปกครอง
            <Phone size={17} aria-hidden="true" />
          </button>
        </form>
      </section>
      </>
      ) : null}

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
