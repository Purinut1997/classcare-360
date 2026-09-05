import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  Banknote,
  Building2,
  CheckCircle2,
  Crown,
  FileUp,
  GraduationCap,
  KeyRound,
  MessageSquare,
  QrCode,
  RefreshCw,
  School,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
  Megaphone,
  Activity,
  Bell,
  Clock,
  ExternalLink,
  Info,
  Sparkles,
  Wrench,
} from 'lucide-react';

import { buildPromptPayPayload, dataUrlToFile, promptPayPayloadToPngDataUrl } from '../../lib/promptpay';
import { activateWorkspace, setStoredActiveWorkspaceId } from '../../lib/session';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { clearSystemBroadcast, getSystemBroadcast, saveSystemBroadcast, type BroadcastSeverity, type SystemBroadcast } from '../../lib/systemBroadcast';
import { SuperadminSupportInbox } from './SuperadminSupportInbox';
import { VipAccessManager } from './VipAccessManager';

type PaymentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'expired';
type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled' | 'refunded';
type AdminLevel = 'admin' | 'superadmin';
type PromptPayIdentifierType = 'national_id' | 'phone';
type WorkspaceDirectoryFilter = 'active' | 'all' | 'archived';

interface SafeDeleteResult {
  deleted?: boolean;
  reason?: string;
}

function isMissingRpcFunction(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || '';
  return error?.code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
}

function getPermanentDeleteSetupNotice(actionLabel: string, detail?: string) {
  const suffix = detail ? ` รายละเอียดจาก Supabase: ${detail}` : '';
  return `${actionLabel}ไม่ได้ เพราะ Supabase project ยังไม่ได้ติดตั้ง RPC ลบถาวรชุดล่าสุด ให้รัน supabase/migrations/0020_harden_destructive_action_rpcs.sql ใน Supabase SQL Editor แล้วกด Reload schema cache/รอครู่หนึ่งก่อนลองใหม่.${suffix}`;
}

function getRoleOperationSetupNotice(actionLabel: string, detail?: string) {
  const suffix = detail ? ` Supabase: ${detail}` : '';
  return `${actionLabel}ไม่สำเร็จ เพราะ production ยังไม่มี RPC ชุดจัดการบทบาท ให้รัน supabase/migrations/0021_role_operations_control_center.sql ใน Supabase SQL Editor แล้วลองใหม่.${suffix}`;
}

type SuperadminCategory = 'management' | 'business' | 'operations';

type SuperadminSection = 'overview' | 'workspaces' | 'users' | 'billing' | 'support' | 'broadcast' | 'health' | 'audit';

interface ControlCenterSectionConfig {
  body: string;
  category: SuperadminCategory;
  categoryLabel: string;
  icon: typeof ShieldCheck;
  key: SuperadminSection;
  label: string;
}

const controlCenterSections: ControlCenterSectionConfig[] = [
  // 🏢 หมวดการจัดการ
  {
    body: 'สรุปภาพรวมทั้งหมด งานด่วนที่ต้องดำเนินการ และสถิติระบบ',
    category: 'management',
    categoryLabel: 'องค์กร & บัญชี',
    icon: ShieldCheck,
    key: 'overview',
    label: 'ภาพรวมระบบ',
  },
  {
    body: 'ค้นหาโรงเรียน เข้าใช้งานแทน เก็บถาวร ลบ และจัดการ workspace',
    category: 'management',
    categoryLabel: 'องค์กร & บัญชี',
    icon: Building2,
    key: 'workspaces',
    label: 'โรงเรียน / Workspace',
  },
  {
    body: 'ค้นหาอีเมล เพิ่ม Admin/Superadmin ปิดสิทธิ์ และจัดการผู้ดูแล',
    category: 'management',
    categoryLabel: 'องค์กร & บัญชี',
    icon: Users,
    key: 'users',
    label: 'ผู้ใช้และสิทธิ์',
  },

  // 💳 หมวดการเงิน & ลูกค้า
  {
    body: 'ดูสลิปรอตรวจ จัดการ VIP PromptPay QR และโรงเรียนใกล้หมดอายุ',
    category: 'business',
    categoryLabel: 'การเงิน & ซัพพอร์ต',
    icon: Banknote,
    key: 'billing',
    label: 'แพ็กเกจ & สลิป',
  },
  {
    body: 'รับเรื่องแจ้งปัญหาจากหน้าเว็บ ตอบกลับ และติดตามเคส',
    category: 'business',
    categoryLabel: 'การเงิน & ซัพพอร์ต',
    icon: MessageSquare,
    key: 'support',
    label: 'Support Inbox',
  },

  // ⚙️ หมวดความปลอดภัย & เสถียรภาพ
  {
    body: 'ส่งแถบประกาศขึ้นหน้าจอครูทุกคน แจ้งข่าวสารหรือเตือนปิดปรับปรุงระบบ',
    category: 'operations',
    categoryLabel: 'เสถียรภาพ & สื่อสาร',
    icon: Megaphone,
    key: 'broadcast',
    label: 'ประกาศทั้งระบบ',
  },
  {
    body: 'ทดสอบ Ping Latency, ตรวจความพร้อม Supabase, RLS และ Storage',
    category: 'operations',
    categoryLabel: 'เสถียรภาพ & สื่อสาร',
    icon: Activity,
    key: 'health',
    label: 'System Health',
  },
  {
    body: 'ดูประวัติใครลบ/แก้สิทธิ์อะไร และดาวน์โหลด debug pack',
    category: 'operations',
    categoryLabel: 'เสถียรภาพ & สื่อสาร',
    icon: FileUp,
    key: 'audit',
    label: 'Audit & กู้คืน',
  },
];

const superadminSectionKeys = new Set<SuperadminSection>(controlCenterSections.map((section) => section.key));

const roleCapabilityMatrix = [
  {
    capabilities: ['ภาพรวมระบบ', 'จัด workspace', 'รีเซ็ตรหัสผ่าน', 'กู้คืน/ระงับบัญชี', 'ให้ VIP lifetime', 'ตรวจ health/audit'],
    label: 'Superadmin',
    status: 'ควบคุมทั้งระบบ',
  },
  {
    capabilities: ['อนุมัติครู', 'จัดสมาชิก', 'เพิ่ม/ลบ/กู้คืนห้องเรียน', 'ตั้งค่าโรงเรียน', 'สำรองข้อมูล/เลื่อนชั้น'],
    label: 'Owner workspace',
    status: 'คุมโรงเรียนตัวเอง',
  },
  {
    capabilities: ['เช็กเวลาเรียน', 'กรอกคะแนน', 'เงินออม', 'พฤติกรรม', 'เยี่ยมบ้าน', 'รายงานที่เกี่ยวข้อง'],
    label: 'ครูร่วม',
    status: 'ทำงานใน workspace',
  },
  {
    capabilities: ['ดูรายงาน', 'ดูข้อมูลที่ได้รับสิทธิ์', 'export ตาม policy'],
    label: 'ผู้ดูรายงาน',
    status: 'อ่านอย่างเดียว',
  },
  {
    capabilities: ['ดูข้อมูลนักเรียนที่ผูกบัญชี', 'ดูรายงาน/คำเชิญ portal', 'รับแจ้งเตือน'],
    label: 'ผู้ปกครอง/นักเรียน',
    status: 'Portal',
  },
];

interface PaymentReviewRow {
  baseAmountThb: number;
  createdAt: string;
  creditAmountThb: number;
  id: string;
  ownerEmail: string;
  ownerName: string;
  payableAmountThb: number;
  planDurationDays: number;
  planId: string;
  planLabel: string;
  profileId: string;
  reviewNote: string | null;
  schoolName: string;
  slipBucket?: string | null;
  slipLabel: string;
  slipStoragePath?: string | null;
  slipUrl?: string | null;
  status: PaymentStatus;
  workspaceId: string;
  workspaceName: string;
}

interface PaymentQrAdminRow {
  accountHint: string | null;
  accountName: string | null;
  bankName: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  isActive: boolean;
}

interface SubscriptionAdminRow {
  endsAt: string | null;
  id: string;
  planCode: string;
  status: SubscriptionStatus;
  workspaceName: string;
}

interface AdminAccessRow {
  createdAt: string;
  displayName: string;
  email: string;
  isActive: boolean;
  level: AdminLevel;
  profileId: string;
}

interface AdminCandidateRow {
  accountStatus: string;
  currentLevel: AdminLevel | null;
  displayName: string;
  email: string;
  isAdminActive: boolean;
  profileId: string;
}

interface WorkspaceAdminRow {
  academicYear: string;
  archivedAt: string | null;
  classroomCount: number;
  classroomName: string;
  createdAt: string;
  id: string;
  memberCount: number;
  name: string;
  ownerEmail: string;
  ownerName: string;
  schoolName: string;
  studentCount: number;
}

const demoAdminCandidates: AdminCandidateRow[] = [
  {
    accountStatus: 'active',
    currentLevel: null,
    displayName: 'ครูตัวอย่าง ClassCare',
    email: 'teacher@classcare.demo',
    isAdminActive: false,
    profileId: 'demo-teacher-candidate',
  },
  {
    accountStatus: 'active',
    currentLevel: 'admin',
    displayName: 'ผู้ดูแลตัวอย่าง',
    email: 'admin@classcare.demo',
    isAdminActive: true,
    profileId: 'demo-admin-candidate',
  },
];

const statusLabels: Record<PaymentStatus, string> = {
  approved: 'อนุมัติแล้ว',
  cancelled: 'ยกเลิก',
  draft: 'แบบร่าง',
  expired: 'หมดอายุ',
  pending_review: 'รอตรวจสลิป',
  refunded: 'คืนเงินแล้ว',
  rejected: 'ไม่อนุมัติ',
};

const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  active: 'ใช้งานอยู่',
  cancelled: 'ยกเลิก',
  expired: 'หมดอายุ',
  refunded: 'คืนเงินแล้ว',
  suspended: 'ระงับ',
  trial: 'ทดลองใช้',
};

const demoPayments: PaymentReviewRow[] = [
  {
    baseAmountThb: 100,
    createdAt: new Date().toISOString(),
    creditAmountThb: 20,
    id: 'demo-payment-001',
    ownerEmail: 'teacher@classcare.demo',
    ownerName: 'ครูตัวอย่าง',
    payableAmountThb: 80,
    planDurationDays: 365,
    planId: 'demo-vip-plan',
    planLabel: 'ClassCare 360 VIP',
    profileId: 'demo-teacher',
    reviewNote: 'แนบสลิปหลังหักเครดิตแนะนำเพื่อน',
    schoolName: 'โรงเรียนตัวอย่าง',
    slipLabel: 'demo-slip-001.pdf',
    status: 'pending_review',
    workspaceId: 'demo-workspace',
    workspaceName: 'ป.5/2 Demo',
  },
  {
    baseAmountThb: 100,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    creditAmountThb: 0,
    id: 'demo-payment-002',
    ownerEmail: 'owner@classcare.demo',
    ownerName: 'เจ้าของ Workspace',
    payableAmountThb: 100,
    planDurationDays: 365,
    planId: 'demo-vip-plan',
    planLabel: 'ClassCare 360 VIP',
    profileId: 'demo-owner',
    reviewNote: null,
    schoolName: 'ClassCare Academy',
    slipLabel: 'ยังไม่แนบสลิป',
    status: 'draft',
    workspaceId: 'demo-workspace-2',
    workspaceName: 'ม.1/1 Demo',
  },
];

const demoQrRows: PaymentQrAdminRow[] = [
  {
    accountHint: 'QR ตัวอย่าง ห้ามใช้รับเงินจริง',
    accountName: 'ClassCare 360',
    bankName: 'Demo Bank',
    createdAt: new Date().toISOString(),
    displayName: 'QR ชำระเงินตัวอย่าง',
    id: 'demo-qr',
    isActive: true,
  },
];

const demoSubscriptions: SubscriptionAdminRow[] = [
  {
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    id: 'demo-subscription',
    planCode: 'VIP_YEARLY',
    status: 'active',
    workspaceName: 'ป.5/2 Demo',
  },
];

const demoWorkspaces: WorkspaceAdminRow[] = [
  {
    academicYear: '2569',
    archivedAt: null,
    classroomCount: 1,
    classroomName: 'ป.5/2',
    createdAt: new Date().toISOString(),
    id: 'demo-workspace',
    memberCount: 1,
    name: 'ป.5/2 Demo',
    ownerEmail: 'teacher@classcare.demo',
    ownerName: 'ครูตัวอย่าง',
    schoolName: 'โรงเรียนตัวอย่าง ClassCare',
    studentCount: 36,
  },
];

function formatBaht(value: number) {
  return new Intl.NumberFormat('th-TH', {
    currency: 'THB',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function mapPaymentRow(row: Record<string, unknown>): PaymentReviewRow {
  const workspace = row.workspaces as { name?: string | null; school_name?: string | null } | null;
  const profile = row.owner_profile as { display_name?: string | null; email?: string | null } | null;
  const plan = row.plans as { code?: string | null; duration_days?: number | null; name?: string | null } | null;
  const file = row.app_files as { bucket?: string | null; original_filename?: string | null; storage_path?: string | null } | null;

  return {
    baseAmountThb: Number(row.base_amount_thb || 0),
    createdAt: String(row.created_at || new Date().toISOString()),
    creditAmountThb: Number(row.credit_amount_thb || 0),
    id: String(row.id),
    ownerEmail: profile?.email || '-',
    ownerName: profile?.display_name || 'ไม่ระบุผู้ใช้',
    payableAmountThb: Number(row.payable_amount_thb || 0),
    planDurationDays: Number(plan?.duration_days || 365),
    planId: String(row.plan_id || ''),
    planLabel: plan?.name || plan?.code || 'ไม่ระบุแพ็กเกจ',
    profileId: String(row.profile_id || ''),
    reviewNote: (row.review_note as string | null) || null,
    schoolName: workspace?.school_name || '-',
    slipBucket: file?.bucket || null,
    slipLabel: file?.original_filename || file?.storage_path || 'ยังไม่แนบสลิป',
    slipStoragePath: file?.storage_path || null,
    slipUrl: null,
    status: String(row.status || 'draft') as PaymentStatus,
    workspaceId: String(row.workspace_id),
    workspaceName: workspace?.name || 'ไม่ระบุ workspace',
  };
}

function mapQrRow(row: Record<string, unknown>): PaymentQrAdminRow {
  return {
    accountHint: (row.account_hint as string | null) || null,
    accountName: (row.account_name as string | null) || null,
    bankName: (row.bank_name as string | null) || null,
    createdAt: String(row.created_at || new Date().toISOString()),
    displayName: String(row.display_name || 'Payment QR'),
    id: String(row.id),
    isActive: Boolean(row.is_active),
  };
}

function mapSubscriptionRow(row: Record<string, unknown>): SubscriptionAdminRow {
  const workspace = row.workspaces as { name?: string | null } | null;
  const plan = row.plans as { code?: string | null } | null;

  return {
    endsAt: (row.ends_at as string | null) || null,
    id: String(row.id),
    planCode: plan?.code || '-',
    status: String(row.status || 'trial') as SubscriptionStatus,
    workspaceName: workspace?.name || 'ไม่ระบุ workspace',
  };
}

function mapAdminRow(row: Record<string, unknown>): AdminAccessRow {
  const profile = row.admin_profile as { display_name?: string | null; email?: string | null } | null;

  return {
    createdAt: String(row.created_at || new Date().toISOString()),
    displayName: profile?.display_name || 'ไม่ระบุชื่อ',
    email: profile?.email || '-',
    isActive: Boolean(row.is_active),
    level: String(row.level || 'admin') as AdminLevel,
    profileId: String(row.profile_id),
  };
}

function mapWorkspaceRow(row: Record<string, unknown>): WorkspaceAdminRow {
  const owner = row.owner_profile as { display_name?: string | null; email?: string | null } | null;
  const settings = row.settings as { classroom_name?: string | null } | null;

  return {
    academicYear: String(row.academic_year || '-'),
    archivedAt: (row.archived_at as string | null) || null,
    classroomCount: 0,
    classroomName: settings?.classroom_name || '-',
    createdAt: String(row.created_at || new Date().toISOString()),
    id: String(row.id),
    memberCount: 0,
    name: String(row.name || 'ไม่ระบุ workspace'),
    ownerEmail: owner?.email || '-',
    ownerName: owner?.display_name || 'ไม่ระบุเจ้าของ',
    schoolName: String(row.school_name || 'ยังไม่ได้ระบุโรงเรียน'),
    studentCount: 0,
  };
}

async function countWorkspaceRows(
  activeSupabase: NonNullable<typeof supabase>,
  table: 'classrooms' | 'students' | 'workspace_memberships',
  workspaceId: string,
) {
  const { count, error } = await activeSupabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) return 0;
  return count || 0;
}

function getFunctionNotice(error: Error) {
  const message = error.message || '';
  if (message.includes('Failed to send a request') || message.includes('not found')) {
    return 'ยังไม่ได้ deploy Edge Function approve-payment-request ไปที่ Supabase โปรด deploy function ก่อนอนุมัติ/ปฏิเสธสลิปจริง';
  }

  return message;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getPaymentQrStoragePath(profileId: string, file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  return `${profileId}/${Date.now()}.${extension}`;
}

interface SuperadminDashboardProps {
  embedded?: boolean;
}

const isDevelopmentDemo =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

export function SuperadminDashboard({ embedded = false }: SuperadminDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');
  const activeSection =
    requestedSection && superadminSectionKeys.has(requestedSection as SuperadminSection)
      ? (requestedSection as SuperadminSection)
      : 'overview';
  const systemUsesSupabase = isSupabaseReady && !isDevelopmentDemo;
  const [adminRows, setAdminRows] = useState<AdminAccessRow[]>([]);
  const [adminCandidates, setAdminCandidates] = useState<AdminCandidateRow[]>(demoAdminCandidates);
  const [adminProfileId, setAdminProfileId] = useState('');
  const [adminLevel, setAdminLevel] = useState<AdminLevel>('admin');
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [qrForm, setQrForm] = useState({
    accountHint: '',
    accountName: 'ClassCare 360',
    bankName: '',
    displayName: 'QR ชำระเงิน ClassCare 360',
  });
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrNotice, setQrNotice] = useState<string | null>(null);
  const [promptPayAmount, setPromptPayAmount] = useState('');
  const [promptPayIdentifier, setPromptPayIdentifier] = useState('');
  const [promptPayIdentifierType, setPromptPayIdentifierType] = useState<PromptPayIdentifierType>('phone');
  const [promptPayPreviewUrl, setPromptPayPreviewUrl] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentReviewRow[]>(demoPayments);
  const [qrRows, setQrRows] = useState<PaymentQrAdminRow[]>(demoQrRows);
  const [subscriptions, setSubscriptions] = useState<SubscriptionAdminRow[]>(demoSubscriptions);
  const [workspaces, setWorkspaces] = useState<WorkspaceAdminRow[]>(demoWorkspaces);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceDirectoryFilter>('active');
  const [activeFilter, setActiveFilter] = useState<'all' | PaymentStatus>('pending_review');
  const [notice, setNotice] = useState<string | null>(
    systemUsesSupabase ? null : 'โหมดตัวอย่าง: ข้อมูลในหน้านี้ใช้สำหรับตรวจสอบหน้าจอและขั้นตอนการทำงาน',
  );
  const [isLoading, setIsLoading] = useState(Boolean(supabase) && !isDevelopmentDemo);
  const [isQrSubmitting, setIsQrSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [workspaceActionId, setWorkspaceActionId] = useState<string | null>(null);
  const [adminActionId, setAdminActionId] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [recoveryAction, setRecoveryAction] = useState<string | null>(null);

  const [broadcastForm, setBroadcastForm] = useState<SystemBroadcast>(() => {
    return (
      getSystemBroadcast() || {
        createdAt: new Date().toISOString(),
        dismissible: true,
        id: `broadcast-${Date.now()}`,
        isActive: false,
        linkText: '',
        linkUrl: '',
        message: '',
        severity: 'info',
        title: '',
        updatedAt: new Date().toISOString(),
      }
    );
  });
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);
  const [dbPingMs, setDbPingMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const activeWorkspaceCount = workspaces.filter((workspace) => !workspace.archivedAt).length;
  const archivedWorkspaceCount = workspaces.length - activeWorkspaceCount;
  const totalStudentCount = workspaces.reduce((sum, workspace) => sum + workspace.studentCount, 0);
  const totalMemberCount = workspaces.reduce((sum, workspace) => sum + workspace.memberCount, 0);
  const pendingPaymentCount = payments.filter((payment) => payment.status === 'pending_review').length;

  const filteredPayments = useMemo(
    () => (activeFilter === 'all' ? payments : payments.filter((payment) => payment.status === activeFilter)),
    [activeFilter, payments],
  );

  const filteredWorkspaces = useMemo(() => {
    const normalizedQuery = workspaceQuery.trim().toLowerCase();

    return workspaces.filter((workspace) => {
      const matchesStatus =
        workspaceFilter === 'all' ||
        (workspaceFilter === 'active' ? !workspace.archivedAt : Boolean(workspace.archivedAt));

      const searchTarget = [
        workspace.name,
        workspace.schoolName,
        workspace.classroomName,
        workspace.ownerName,
        workspace.ownerEmail,
        workspace.academicYear,
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || searchTarget.includes(normalizedQuery));
    });
  }, [workspaceFilter, workspaceQuery, workspaces]);

  const expiringSoonVipWorkspaces = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 86_400_000;
    return workspaces.filter((w) => {
      const sub = subscriptions.find((s) => s.workspaceName === w.name || s.id === w.id);
      if (!sub?.endsAt) return false;
      const exp = new Date(sub.endsAt).getTime();
      return exp > now && exp <= now + thirtyDaysMs;
    });
  }, [subscriptions, workspaces]);

  function handleSaveBroadcast(event: FormEvent) {
    event.preventDefault();
    if (!broadcastForm.title.trim() && broadcastForm.isActive) {
      setBroadcastNotice('กรุณากรอกหัวข้อประกาศ');
      return;
    }
    const updated: SystemBroadcast = {
      ...broadcastForm,
      title: broadcastForm.title.trim(),
      message: broadcastForm.message.trim(),
      updatedAt: new Date().toISOString(),
    };
    saveSystemBroadcast(updated);
    setBroadcastForm(updated);
    setBroadcastNotice(
      updated.isActive
        ? '✓ บันทึกและส่งแถบประกาศขึ้นหน้าจอทุกโรงเรียนแล้ว'
        : '✓ ปิดการแสดงประกาศเรียบร้อยแล้ว'
    );
  }

  function handleClearBroadcast() {
    clearSystemBroadcast();
    setBroadcastForm({
      createdAt: new Date().toISOString(),
      dismissible: true,
      id: `broadcast-${Date.now()}`,
      isActive: false,
      linkText: '',
      linkUrl: '',
      message: '',
      severity: 'info',
      title: '',
      updatedAt: new Date().toISOString(),
    });
    setBroadcastNotice('✓ ล้างและปิดประกาศทั้งหมดเรียบร้อย');
  }

  async function testDbPing() {
    if (!supabase) {
      setDbPingMs(null);
      return;
    }
    setIsPinging(true);
    const start = performance.now();
    try {
      await supabase.from('workspaces').select('id').limit(1);
      const end = performance.now();
      setDbPingMs(Math.max(1, Math.round(end - start)));
    } catch {
      setDbPingMs(null);
    } finally {
      setIsPinging(false);
    }
  }

  function openSection(section: SuperadminSection) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('view', 'superadmin-dashboard');
    if (section === 'overview') {
      nextSearchParams.delete('section');
    } else {
      nextSearchParams.set('section', section);
    }
    setSearchParams(nextSearchParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadSuperadminData() {
    if (!supabase || isDevelopmentDemo) {
      setPayments(demoPayments);
      setQrRows(demoQrRows);
      setSubscriptions(demoSubscriptions);
      setWorkspaces(demoWorkspaces);
      setAdminCandidates(demoAdminCandidates);
      setIsLoading(false);
      return;
    }

    const activeSupabase = supabase;

    setIsLoading(true);
    setNotice(null);

    const [
      { data: paymentRows, error: paymentError },
      { data: qrData, error: qrError },
      { data: subscriptionRows, error: subscriptionError },
      { data: adminData, error: adminError },
      { data: workspaceRows, error: workspaceError },
      { data: adminCandidateData, error: adminCandidateError },
    ] = await Promise.all([
      activeSupabase
        .from('payment_requests')
        .select('id,workspace_id,profile_id,plan_id,status,base_amount_thb,credit_amount_thb,payable_amount_thb,created_at,review_note,workspaces(name,school_name),owner_profile:profiles!payment_requests_profile_id_fkey(display_name,email),plans(name,code,duration_days),app_files(bucket,original_filename,storage_path)')
        .order('created_at', { ascending: false })
        .limit(20),
      activeSupabase
        .from('payment_qr_codes')
        .select('id,display_name,bank_name,account_name,account_hint,is_active,created_at')
        .order('created_at', { ascending: false })
        .limit(6),
      activeSupabase
        .from('subscriptions')
        .select('id,status,ends_at,workspaces(name),plans(code)')
        .order('updated_at', { ascending: false })
        .limit(8),
      activeSupabase
        .from('superadmin_profiles')
        .select('profile_id,level,is_active,created_at,admin_profile:profiles!superadmin_profiles_profile_id_fkey(email,display_name)')
        .order('created_at', { ascending: false })
        .limit(20),
      activeSupabase
        .from('workspaces')
        .select('id,name,school_name,academic_year,settings,owner_profile_id,created_at,archived_at,owner_profile:profiles!workspaces_owner_profile_id_fkey(email,display_name)')
        .order('created_at', { ascending: false })
        .limit(12),
      activeSupabase.rpc('list_admin_access_candidates', { search_text: null }),
    ]);

    if (paymentError || qrError || subscriptionError || adminError || workspaceError) {
      setNotice(paymentError?.message || qrError?.message || subscriptionError?.message || adminError?.message || workspaceError?.message || 'โหลด Superadmin data ไม่สำเร็จ');
      setIsLoading(false);
      return;
    }

    const mappedPayments = ((paymentRows || []) as Record<string, unknown>[]).map(mapPaymentRow);
    const paymentsWithSlipUrls = await Promise.all(
      mappedPayments.map(async (payment) => {
        if (!payment.slipStoragePath) return payment;

        const { data } = await activeSupabase.storage
          .from(payment.slipBucket || 'payment-slips')
          .createSignedUrl(payment.slipStoragePath, 60 * 10);

        return { ...payment, slipUrl: data?.signedUrl || null };
      }),
    );

    setPayments(paymentsWithSlipUrls);
    setQrRows(((qrData || []) as Record<string, unknown>[]).map(mapQrRow));
    setSubscriptions(((subscriptionRows || []) as Record<string, unknown>[]).map(mapSubscriptionRow));
    setAdminRows(((adminData || []) as Record<string, unknown>[]).map(mapAdminRow));
    if (!adminCandidateError) {
      setAdminCandidates(((adminCandidateData || []) as Record<string, unknown>[]).map((row) => ({
        accountStatus: String(row.account_status || ''),
        currentLevel: row.current_level === 'admin' || row.current_level === 'superadmin' ? row.current_level : null,
        displayName: String(row.display_name || row.email || 'ผู้ใช้ ClassCare'),
        email: String(row.email || ''),
        isAdminActive: Boolean(row.is_admin_active),
        profileId: String(row.profile_id || ''),
      })));
    }
    const mappedWorkspaces = ((workspaceRows || []) as Record<string, unknown>[]).map(mapWorkspaceRow);
    const workspacesWithCounts = await Promise.all(
      mappedWorkspaces.map(async (workspace) => {
        const [classroomCount, studentCount, memberCount] = await Promise.all([
          countWorkspaceRows(activeSupabase, 'classrooms', workspace.id),
          countWorkspaceRows(activeSupabase, 'students', workspace.id),
          countWorkspaceRows(activeSupabase, 'workspace_memberships', workspace.id),
        ]);

        return {
          ...workspace,
          classroomCount,
          memberCount,
          studentCount,
        };
      }),
    );
    setWorkspaces(workspacesWithCounts);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadSuperadminData();
  }, []);

  async function grantAdminAccess() {
    if (!supabase || isDevelopmentDemo) {
      setAdminNotice('โหมดตัวอย่าง: ตรวจขั้นตอนการเลือกผู้ใช้แล้ว โดยยังไม่เปลี่ยนสิทธิ์จริง');
      return;
    }

    const selectedCandidate = adminCandidates.find((candidate) => candidate.profileId === adminProfileId);
    if (!selectedCandidate) {
      setAdminNotice('กรุณาเลือกผู้ใช้ ClassCare ที่ต้องการกำหนดสิทธิ์');
      return;
    }

    const normalizedEmail = selectedCandidate.email.trim().toLowerCase();

    setAdminNotice(null);

    const { data, error: adminError } = await supabase.rpc('grant_admin_access_by_email', {
      target_email: normalizedEmail,
      target_level: adminLevel,
    });

    if (adminError) {
      setAdminNotice(
        isMissingRpcFunction(adminError)
          ? getRoleOperationSetupNotice('เพิ่มสิทธิ์ Admin', adminError.message)
          : adminError.message === 'not_allowed'
            ? 'บัญชีปัจจุบันไม่มีสิทธิ์ SuperAdmin สำหรับเพิ่มผู้ดูแลระบบ'
            : adminError.message,
      );
      return;
    }

    const result = data as { email?: string; granted?: boolean; reason?: string } | null;
    if (!result?.granted) {
      setAdminNotice(
        result?.reason === 'profile_not_found'
          ? 'ยังไม่พบ Profile ของอีเมลนี้ กรุณาให้ผู้ใช้สมัครและกรอกข้อมูลบัญชีให้เสร็จก่อน'
          : `เพิ่มสิทธิ์ไม่สำเร็จ${result?.reason ? `: ${result.reason}` : ''}`,
      );
      return;
    }

    setAdminNotice(`เพิ่ม ${adminLevel === 'superadmin' ? 'SuperAdmin' : 'Admin'} ให้ ${result.email || normalizedEmail} สำเร็จ พร้อม VIP ตลอดชีพ`);
    setAdminProfileId('');
    void loadSuperadminData();
  }

  async function setAdminAccess(row: AdminAccessRow, isActive: boolean) {
    if (!supabase) return;

    setAdminActionId(row.profileId);
    setAdminNotice(null);

    const { data, error } = await supabase.rpc('set_superadmin_profile_status', {
      next_is_active: isActive,
      target_profile_id: row.profileId,
    });

    if (error) {
      setAdminNotice(
        isMissingRpcFunction(error)
          ? getRoleOperationSetupNotice('ปรับสิทธิ์ผู้ดูแล', error.message)
          : error.message,
      );
      setAdminActionId(null);
      return;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      setAdminNotice('ปรับสิทธิ์ไม่สำเร็จ: ฐานข้อมูลไม่คืนแถวผู้ดูแลกลับมา โปรดตรวจ migration/RLS');
      setAdminActionId(null);
      return;
    }

    setAdminNotice(`${isActive ? 'เปิด' : 'ปิด'}สิทธิ์ ${row.email} สำเร็จ`);
    setAdminActionId(null);
    void loadSuperadminData();
  }

  async function sendPasswordResetEmail(emailInput?: string) {
    if (!supabase) {
      setRecoveryNotice('โหมดตัวอย่าง: ต้องเชื่อม Supabase ก่อนส่งอีเมลรีเซ็ตรหัสผ่าน');
      return;
    }

    const email = (emailInput || recoveryEmail).trim().toLowerCase();
    if (!email) {
      setRecoveryNotice('กรุณากรอกอีเมลผู้ใช้ก่อนส่งลิงก์รีเซ็ตรหัสผ่าน');
      return;
    }

    setRecoveryNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setRecoveryNotice(`ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ: ${error.message}`);
      return;
    }

    setRecoveryNotice(`ส่งอีเมลรีเซ็ตรหัสผ่านไปที่ ${email} แล้ว`);
  }

  async function setProfileAccountStatus(nextAccountStatus: 'active' | 'suspended') {
    if (!supabase) {
      setRecoveryNotice('โหมดตัวอย่าง: ต้องเชื่อม Supabase ก่อนปรับสถานะบัญชีผู้ใช้');
      return;
    }

    const email = recoveryEmail.trim().toLowerCase();
    if (!email) {
      setRecoveryNotice('กรุณากรอกอีเมลผู้ใช้ก่อนปรับสถานะบัญชี');
      return;
    }

    const actionLabel = nextAccountStatus === 'active' ? 'กู้คืนบัญชีผู้ใช้' : 'ระงับบัญชีผู้ใช้';
    const confirmed = window.confirm(`${actionLabel} ${email} หรือไม่?`);
    if (!confirmed) return;

    setRecoveryAction(nextAccountStatus);
    setRecoveryNotice(null);

    const { data, error } = await supabase.rpc('set_profile_account_status_by_email', {
      next_account_status: nextAccountStatus,
      target_email: email,
    });

    if (error) {
      setRecoveryNotice(
        isMissingRpcFunction(error)
          ? getRoleOperationSetupNotice(actionLabel, error.message)
          : `${actionLabel}ไม่สำเร็จ: ${error.message}`,
      );
      setRecoveryAction(null);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      setRecoveryNotice(`${actionLabel}ไม่สำเร็จ: ฐานข้อมูลไม่คืนข้อมูลผู้ใช้กลับมา`);
      setRecoveryAction(null);
      return;
    }

    setRecoveryNotice(`${actionLabel}สำเร็จ: ${email} -> ${nextAccountStatus}`);
    setRecoveryAction(null);
  }

  async function grantLifetimeVip(workspace: WorkspaceAdminRow) {
    if (!supabase) {
      setNotice('โหมดตัวอย่าง: พร้อมให้ VIP lifetime หลังเชื่อม Supabase');
      return;
    }

    const confirmed = window.confirm(`ให้ VIP ตลอดชีพกับ workspace "${workspace.name}" หรือไม่?`);
    if (!confirmed) return;

    setWorkspaceActionId(workspace.id);
    setNotice(null);

    const { data, error } = await supabase.rpc('grant_workspace_lifetime_vip', {
      target_workspace_id: workspace.id,
    });

    if (error) {
      setNotice(
        isMissingRpcFunction(error)
          ? getRoleOperationSetupNotice('ให้ VIP lifetime', error.message)
          : `ให้ VIP lifetime ไม่สำเร็จ: ${error.message}`,
      );
      setWorkspaceActionId(null);
      return;
    }

    const result = data as { granted?: boolean; reason?: string } | null;
    if (!result?.granted) {
      setNotice(`ให้ VIP lifetime ไม่สำเร็จ${result?.reason ? `: ${result.reason}` : ''}`);
      setWorkspaceActionId(null);
      return;
    }

    setNotice(`ให้ VIP lifetime กับ ${workspace.name} สำเร็จ`);
    setWorkspaceActionId(null);
    void loadSuperadminData();
  }

  async function createPaymentQr(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsQrSubmitting(true);
    setQrNotice(null);

    const nextQr = {
      accountHint: qrForm.accountHint.trim(),
      accountName: qrForm.accountName.trim(),
      bankName: qrForm.bankName.trim(),
      displayName: qrForm.displayName.trim(),
    };

    if (!nextQr.displayName || !nextQr.accountName || !qrFile) {
      setQrNotice('กรุณากรอกชื่อ QR ชื่อบัญชี และแนบรูป QR');
      setIsQrSubmitting(false);
      return;
    }

    if (!supabase) {
      setQrRows((current) => [
        {
          accountHint: nextQr.accountHint || null,
          accountName: nextQr.accountName,
          bankName: nextQr.bankName || null,
          createdAt: new Date().toISOString(),
          displayName: nextQr.displayName,
          id: `demo-qr-${Date.now()}`,
          isActive: true,
        },
        ...current.map((qr) => ({ ...qr, isActive: false })),
      ]);
      setQrFile(null);
      setPromptPayPreviewUrl(null);
      setQrNotice('เพิ่ม Payment QR ในโหมดตัวอย่างแล้ว');
      setIsQrSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setQrNotice(userError?.message || 'กรุณาเข้าสู่ระบบ SuperAdmin อีกครั้ง');
      setIsQrSubmitting(false);
      return;
    }

    try {
      const bucket = 'payment-qr-codes';
      const storagePath = getPaymentQrStoragePath(user.id, qrFile);
      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, qrFile, {
        contentType: qrFile.type || 'image/png',
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: fileRow, error: fileError } = await supabase
        .from('app_files')
        .insert({
          bucket,
          content_type: qrFile.type || 'image/png',
          metadata: {
            purpose: 'payment_qr_code',
          },
          original_filename: qrFile.name,
          owner_profile_id: user.id,
          privacy_level: 'restricted',
          size_bytes: qrFile.size,
          storage_path: storagePath,
          workspace_id: null,
        })
        .select('id')
        .single();

      if (fileError) throw fileError;

      const { error: deactivateError } = await supabase
        .from('payment_qr_codes')
        .update({ is_active: false })
        .eq('is_active', true);

      if (deactivateError) throw deactivateError;

      const { data: qrRow, error: qrError } = await supabase
        .from('payment_qr_codes')
        .insert({
          account_hint: nextQr.accountHint || null,
          account_name: nextQr.accountName,
          bank_name: nextQr.bankName || null,
          created_by: user.id,
          display_name: nextQr.displayName,
          file_id: fileRow.id,
          is_active: true,
        })
        .select('id,display_name,bank_name,account_name,account_hint,is_active,created_at')
        .single();

      if (qrError) throw qrError;

      setQrRows((current) => [mapQrRow(qrRow as Record<string, unknown>), ...current.map((qr) => ({ ...qr, isActive: false }))]);
      setQrFile(null);
      setPromptPayPreviewUrl(null);
      setQrNotice('เพิ่มและเปิดใช้งาน Payment QR สำเร็จ');
      void loadSuperadminData();
    } catch (error) {
      setQrNotice(error instanceof Error ? error.message : 'เพิ่ม Payment QR ไม่สำเร็จ');
    }

    setIsQrSubmitting(false);
  }

  async function generatePromptPayQr() {
    setQrNotice(null);

    try {
      const amount = promptPayAmount.trim() ? Number(promptPayAmount) : null;
      if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
        setQrNotice('ยอดเงินต้องเป็นตัวเลขมากกว่า 0 หรือเว้นว่างเพื่อสร้าง QR แบบไม่ล็อกยอด');
        return;
      }

      const payload = buildPromptPayPayload({
        amount,
        identifier: promptPayIdentifier,
        identifierType: promptPayIdentifierType,
      });
      const dataUrl = await promptPayPayloadToPngDataUrl(payload);
      const file = dataUrlToFile(dataUrl, `promptpay-${Date.now()}.png`);
      const cleanedIdentifier = promptPayIdentifier.replace(/\D/g, '');
      const maskedIdentifier =
        cleanedIdentifier.length > 4
          ? `${'*'.repeat(Math.max(cleanedIdentifier.length - 4, 0))}${cleanedIdentifier.slice(-4)}`
          : 'PromptPay';

      setQrFile(file);
      setPromptPayPreviewUrl(dataUrl);
      setQrForm((current) => ({
        ...current,
        accountHint: amount ? `PromptPay ${maskedIdentifier} | ยอด ${formatBaht(amount)}` : `PromptPay ${maskedIdentifier} | ไม่ล็อกยอด`,
        bankName: 'PromptPay',
        displayName: amount ? `PromptPay QR ${formatBaht(amount)}` : 'PromptPay QR ไม่ล็อกยอด',
      }));
      setQrNotice('สร้างรูป PromptPay QR แล้ว ตรวจสอบกับแอปธนาคารก่อนเปิดใช้งานจริง');
    } catch (error) {
      setQrNotice(error instanceof Error ? error.message : 'สร้าง PromptPay QR ไม่สำเร็จ');
    }
  }

  async function setPaymentQrActive(qr: PaymentQrAdminRow) {
    if (!supabase) {
      setQrRows((current) => current.map((item) => ({ ...item, isActive: item.id === qr.id })));
      return;
    }

    setIsQrSubmitting(true);
    setQrNotice(null);

    const { error: deactivateError } = await supabase
      .from('payment_qr_codes')
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateError) {
      setQrNotice(deactivateError.message);
      setIsQrSubmitting(false);
      return;
    }

    const { error: activateError } = await supabase
      .from('payment_qr_codes')
      .update({ is_active: true })
      .eq('id', qr.id);

    if (activateError) {
      setQrNotice(activateError.message);
      setIsQrSubmitting(false);
      return;
    }

    setQrRows((current) => current.map((item) => ({ ...item, isActive: item.id === qr.id })));
    setQrNotice(`เปิดใช้งาน ${qr.displayName} แล้ว`);
    setIsQrSubmitting(false);
  }

  async function reviewPaymentWithRls(payment: PaymentReviewRow, nextStatus: Extract<PaymentStatus, 'approved' | 'rejected'>) {
    if (!supabase) throw new Error('Supabase client is not ready');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(userError?.message || 'กรุณาเข้าสู่ระบบ SuperAdmin อีกครั้ง');
    }

    const reviewedAt = new Date();
    const reviewNote =
      nextStatus === 'approved'
        ? 'Approved from Superadmin Dashboard RLS fallback.'
        : 'Rejected from Superadmin Dashboard RLS fallback.';

    const { error: paymentError } = await supabase
      .from('payment_requests')
      .update({
        reviewed_at: reviewedAt.toISOString(),
        reviewed_by: user.id,
        review_note: reviewNote,
        status: nextStatus,
      })
      .eq('id', payment.id);

    if (paymentError) throw paymentError;

    let subscriptionId: string | null = null;

    if (nextStatus === 'approved') {
      const { error: closeSubscriptionError } = await supabase
        .from('subscriptions')
        .update({
          cancelled_at: reviewedAt.toISOString(),
          metadata: {
            replaced_by_payment_request_id: payment.id,
            replaced_by_source: 'superadmin_dashboard_rls_fallback',
          },
          status: 'cancelled',
        })
        .eq('workspace_id', payment.workspaceId)
        .in('status', ['trial', 'active']);

      if (closeSubscriptionError) throw closeSubscriptionError;

      const { data: subscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          ends_at: addDays(reviewedAt, payment.planDurationDays).toISOString(),
          metadata: {
            approved_by: user.id,
            approved_from: 'superadmin_dashboard_rls_fallback',
            payment_request_id: payment.id,
          },
          payment_request_id: payment.id,
          plan_id: payment.planId,
          profile_id: payment.profileId,
          source: 'superadmin_dashboard_rls_fallback',
          starts_at: reviewedAt.toISOString(),
          status: 'active',
          trial_used: false,
          workspace_id: payment.workspaceId,
        })
        .select('id')
        .single();

      if (subscriptionError) throw subscriptionError;
      subscriptionId = subscription.id;
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      action: nextStatus === 'approved' ? 'payment_request.approved' : 'payment_request.rejected',
      actor_profile_id: user.id,
      actor_role: 'superadmin',
      entity_id: payment.id,
      entity_table: 'payment_requests',
      metadata: {
        fallback: true,
        payable_amount_thb: payment.payableAmountThb,
        source: 'superadmin_dashboard_rls_fallback',
        subscription_id: subscriptionId,
      },
      risk_level: nextStatus === 'approved' ? 'critical' : 'high',
      workspace_id: payment.workspaceId,
    });

    if (auditError) throw auditError;
  }

  async function reviewPayment(payment: PaymentReviewRow, nextStatus: Extract<PaymentStatus, 'approved' | 'rejected'>) {
    setReviewingId(payment.id);
    setNotice(null);

    if (!supabase) {
      setPayments((current) =>
        current.map((item) => (item.id === payment.id ? { ...item, status: nextStatus } : item)),
      );
      setNotice(nextStatus === 'approved' ? 'อนุมัติคำขอในโหมดตัวอย่างแล้ว' : 'ปฏิเสธคำขอในโหมดตัวอย่างแล้ว');
      setReviewingId(null);
      return;
    }

    const { error: functionError } = await supabase.functions.invoke('approve-payment-request', {
      body: {
        action: nextStatus === 'approved' ? 'approve' : 'reject',
        paymentRequestId: payment.id,
        reviewNote:
          nextStatus === 'approved'
            ? 'Approved from Superadmin Dashboard.'
            : 'Rejected from Superadmin Dashboard.',
      },
    });

    if (functionError) {
      try {
        await reviewPaymentWithRls(payment, nextStatus);
        setPayments((current) =>
          current.map((item) => (item.id === payment.id ? { ...item, status: nextStatus } : item)),
        );
        setNotice(
          nextStatus === 'approved'
            ? 'อนุมัติสำเร็จผ่าน RLS fallback แล้ว ควร deploy Edge Function ก่อนใช้งาน production'
            : 'ปฏิเสธสำเร็จผ่าน RLS fallback แล้ว ควร deploy Edge Function ก่อนใช้งาน production',
        );
        setReviewingId(null);
        void loadSuperadminData();
        return;
      } catch (fallbackError) {
        setNotice(
          `${getFunctionNotice(functionError)} | RLS fallback ไม่สำเร็จ: ${
            fallbackError instanceof Error ? fallbackError.message : 'Unexpected error'
          }`,
        );
        setReviewingId(null);
        return;
      }
    }

    setPayments((current) =>
      current.map((item) => (item.id === payment.id ? { ...item, status: nextStatus } : item)),
    );
    setNotice(
      nextStatus === 'approved'
        ? 'อนุมัติและเรียก Edge Function เพื่อเปิด subscription แล้ว'
        : 'ปฏิเสธคำขอผ่าน Edge Function แล้ว',
    );
    setReviewingId(null);
    void loadSuperadminData();
  }

  async function openWorkspace(workspaceId: string) {
    if (!supabase || isDevelopmentDemo) {
      setStoredActiveWorkspaceId(workspaceId, 'demo-superadmin');
      window.location.href = '/app/dashboard?demo=superadmin';
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
      await activateWorkspace(user.id, workspaceId);
      window.location.href = '/app/dashboard';
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'เข้าใช้งาน Workspace ไม่สำเร็จ');
    }
  }

  async function setWorkspaceArchived(workspace: WorkspaceAdminRow, shouldArchive: boolean) {
    setWorkspaceActionId(workspace.id);
    setNotice(null);

    if (!supabase) {
      setWorkspaces((current) =>
        current.map((item) =>
          item.id === workspace.id
            ? { ...item, archivedAt: shouldArchive ? new Date().toISOString() : null }
            : item,
        ),
      );
      setNotice(shouldArchive ? 'โหมดตัวอย่าง: เก็บถาวร workspace แล้ว' : 'โหมดตัวอย่าง: กู้คืน workspace แล้ว');
      setWorkspaceActionId(null);
      return;
    }

    if (!shouldArchive) {
      const { data, error } = await supabase.rpc('restore_workspace_safely', {
        target_workspace_id: workspace.id,
      });

      if (error) {
        setNotice(
          isMissingRpcFunction(error)
            ? getRoleOperationSetupNotice('กู้คืน workspace', error.message)
            : error.message,
        );
        setWorkspaceActionId(null);
        return;
      }

      if (!(data as { restored?: boolean } | null)?.restored) {
        setNotice('กู้คืน workspace ไม่สำเร็จ: ฐานข้อมูลไม่คืนสถานะ restored กลับมา');
        setWorkspaceActionId(null);
        return;
      }

      setWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? { ...item, archivedAt: null } : item)),
      );
      setNotice(`กู้คืน ${workspace.name} แล้ว`);
      setWorkspaceActionId(null);
      return;
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update({ archived_at: shouldArchive ? new Date().toISOString() : null })
      .eq('id', workspace.id)
      .select('id, archived_at');

    if (error) {
      setNotice(error.message);
      setWorkspaceActionId(null);
      return;
    }

    if (!data || data.length === 0) {
      setNotice('ปรับสถานะ workspace ไม่สำเร็จ: ฐานข้อมูลไม่ได้อัปเดตแถวจริง โปรดตรวจ RLS/policy ของตาราง workspaces');
      setWorkspaceActionId(null);
      return;
    }

    setWorkspaces((current) =>
      current.map((item) =>
        item.id === workspace.id
          ? { ...item, archivedAt: shouldArchive ? new Date().toISOString() : null }
          : item,
      ),
    );
    setNotice(shouldArchive ? `เก็บถาวร ${workspace.name} แล้ว` : `กู้คืน ${workspace.name} แล้ว`);
    setWorkspaceActionId(null);
  }

  async function deleteWorkspacePermanently(workspace: WorkspaceAdminRow) {
    const confirmed = window.confirm(
      `ลบ workspace "${workspace.name}" ถาวรหรือไม่?\n\nข้อมูลห้องเรียน นักเรียน คะแนน เช็กชื่อ เงินออม และข้อมูลที่ผูกกับ workspace นี้จะถูกลบตาม cascade ของฐานข้อมูล`,
    );
    if (!confirmed) return;

    const typed = window.prompt('พิมพ์ DELETE เพื่อยืนยันการลบ workspace ถาวร');
    if (typed !== 'DELETE') {
      setNotice('ยกเลิกการลบ workspace เพราะไม่ได้พิมพ์ DELETE');
      return;
    }

    setWorkspaceActionId(workspace.id);
    setNotice(null);

    if (!supabase) {
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
      setNotice('โหมดตัวอย่าง: ลบ workspace ออกจากรายการแล้ว');
      setWorkspaceActionId(null);
      return;
    }

    const rpcResult = await supabase.rpc('delete_workspace_safely', {
      target_workspace_id: workspace.id,
    });

    let data: Array<{ id: string }> | null = null;
    const error = rpcResult.error;
    let failureReason: string | undefined;

    if (rpcResult.data) {
      const result = rpcResult.data as SafeDeleteResult;
      data = result.deleted ? [{ id: workspace.id }] : [];
      failureReason = result.reason;
    }

    if (error) {
      setNotice(
        isMissingRpcFunction(error)
          ? getPermanentDeleteSetupNotice('ลบ workspace ถาวร', error.message)
          : `ลบ workspace ไม่สำเร็จ: ${error.message}`,
      );
      setWorkspaceActionId(null);
      return;
    }

    if (!data || data.length === 0) {
      setNotice(
        `ลบ workspace ไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง${failureReason ? ` (${failureReason})` : ''} ถ้า production ยังไม่ได้รัน supabase/migrations/0020_harden_destructive_action_rpcs.sql ให้รันก่อน เพราะ Cloudflare/GitHub deploy ไม่ได้ติดตั้ง SQL ให้ Supabase`,
      );
      setWorkspaceActionId(null);
      return;
    }

    setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
    setNotice(`ลบ workspace ${workspace.name} ถาวรแล้ว`);
    setWorkspaceActionId(null);
  }

  return (
    <main className={embedded ? 'app-page' : 'classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8'}>
      {!embedded ? (
        <Link
          className="fixed left-4 top-4 z-30 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm font-black text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
          to="/app/dashboard"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          กลับหน้าแอป
        </Link>
      ) : null}
      <section className="mx-auto max-w-[1480px]">
        <header className="nexus-card overflow-hidden border-slate-200/80">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700">
                <ShieldCheck size={25} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">Superadmin / System Operations</p>
                <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">ศูนย์ควบคุมระบบ</h1>
                <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-slate-600">
                  กำกับดูแล Workspace ผู้ใช้ สิทธิ์ และความพร้อมของระบบจากจุดเดียว
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
                <span className={`h-2 w-2 rounded-full ${systemUsesSupabase ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {systemUsesSupabase ? 'Supabase พร้อมใช้งาน' : 'โหมดตัวอย่าง'}
              </span>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                to="/app/dashboard?view=setup"
              >
                System Readiness
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                to="/app/select-workspace"
              >
                เลือก Workspace
              </Link>
              <button
                aria-label="รีเฟรชข้อมูล Superadmin"
                className="blue-action inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={isLoading}
                onClick={() => void loadSuperadminData()}
                type="button"
              >
                <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} aria-hidden="true" />
                <span className="sm:hidden">รีเฟรช</span>
              </button>
            </div>
          </div>
        </header>

        <nav aria-label="เมนูย่อย Superadmin" className="sticky top-2 z-20 mt-4 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-sm backdrop-blur">
          <div className="flex min-w-max items-center gap-1">
            {controlCenterSections.map((section, idx) => {
              const Icon = section.icon;
              const isSelected = activeSection === section.key;
              const badgeCount = section.key === 'billing' && pendingPaymentCount > 0 ? pendingPaymentCount : null;
              const isNewGroup = idx > 0 && controlCenterSections[idx - 1].category !== section.category;

              return (
                <div className="flex items-center" key={section.key}>
                  {isNewGroup ? <div className="mx-2 h-6 w-px bg-slate-200" /> : null}
                  <button
                    aria-current={isSelected ? 'page' : undefined}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    onClick={() => openSection(section.key)}
                    title={section.body}
                    type="button"
                  >
                    <Icon className={isSelected ? 'text-cyan-300' : 'text-slate-400'} size={15} aria-hidden="true" />
                    <span>{section.label}</span>
                    {badgeCount !== null ? (
                      <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                        {badgeCount}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </nav>

        {activeSection === 'overview' ? (
          <>
            {/* 4 Stat Overview Cards */}
            <div className="nexus-card mt-4 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-slate-200">
              {[
                { icon: Building2, label: 'Workspace ที่ใช้งาน', meta: `${archivedWorkspaceCount} เก็บถาวร`, value: activeWorkspaceCount },
                { icon: GraduationCap, label: 'นักเรียนทั้งหมด', meta: `${activeWorkspaceCount} workspace`, value: totalStudentCount },
                { icon: Users, label: 'สมาชิกทั้งหมด', meta: 'ทุก workspace', value: totalMemberCount },
                { icon: ShieldCheck, label: 'ผู้ดูแลระบบ', meta: 'Admin และ Superadmin', value: adminRows.length },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div className="flex items-center gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:[&:nth-child(odd)]:border-r-0" key={item.label}>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-cyan-200">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-500">{item.label}</p>
                      <div className="mt-0.5 flex items-baseline gap-2">
                        <p className="text-2xl font-black tabular-nums text-slate-950">{item.value.toLocaleString('th-TH')}</p>
                        <span className="truncate text-[10px] font-bold text-slate-400">{item.meta}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Required: Summary of pending issues */}
            <section className="nexus-card mt-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Action Summary & Alerts</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950">สิ่งที่ต้องติดตามและดำเนินการ</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void testDbPing()}
                  disabled={isPinging}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 shadow-sm transition"
                >
                  <Activity size={14} className={isPinging ? 'animate-spin text-cyan-600' : 'text-slate-400'} />
                  <span>{isPinging ? 'กำลังวัด Ping...' : dbPingMs !== null ? `Ping: ${dbPingMs}ms` : 'ทดสอบ Ping DB'}</span>
                </button>
              </div>

              <div className="grid divide-y divide-slate-200 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
                {[
                  {
                    body: pendingPaymentCount > 0 ? `มี ${pendingPaymentCount} สลิปรออนุมัติ` : 'ไม่มีสลิปค้างตรวจ',
                    count: pendingPaymentCount,
                    dotClass: pendingPaymentCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500',
                    label: 'การชำระเงินรอตรวจ',
                    section: 'billing' as SuperadminSection,
                  },
                  {
                    body: expiringSoonVipWorkspaces.length > 0 ? `${expiringSoonVipWorkspaces.length} โรงเรียนใน 30 วัน` : 'ไม่มีรายการใกล้หมดอายุ',
                    count: expiringSoonVipWorkspaces.length,
                    dotClass: expiringSoonVipWorkspaces.length > 0 ? 'bg-amber-500' : 'bg-emerald-500',
                    label: 'VIP ใกล้หมดอายุ',
                    section: 'billing' as SuperadminSection,
                  },
                  {
                    body: broadcastForm.isActive ? `เปิดอยู่: ${broadcastForm.title || 'ไม่มีหัวข้อ'}` : 'ยังไม่มีประกาศ актив',
                    count: broadcastForm.isActive ? 'เปิดใช้งาน' : 'ปิดอยู่',
                    dotClass: broadcastForm.isActive ? 'bg-sky-500' : 'bg-slate-400',
                    label: 'ประกาศทั้งระบบ',
                    section: 'broadcast' as SuperadminSection,
                  },
                  {
                    body: systemUsesSupabase ? (dbPingMs ? `ความเร็วตอบสนอง ${dbPingMs}ms` : 'บริการหลักพร้อมใช้งาน') : 'โหมดสาธิต (Demo)',
                    count: systemUsesSupabase ? (dbPingMs ? `${dbPingMs}ms` : 'ปกติ') : 'Demo',
                    dotClass: systemUsesSupabase ? 'bg-emerald-500' : 'bg-amber-500',
                    label: 'ความพร้อมระบบ',
                    section: 'health' as SuperadminSection,
                  },
                ].map((item) => (
                  <button
                    className="flex items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                    key={item.label}
                    onClick={() => openSection(item.section)}
                    type="button"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClass}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900">{item.label}</p>
                        <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{item.body}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black tabular-nums text-slate-700">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Quick Navigation Cards */}
            <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => openSection('broadcast')}
                className="group flex flex-col justify-between rounded-3xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-white to-cyan-50/50 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600 text-white shadow-sm transition group-hover:scale-105">
                    <Megaphone size={20} />
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${broadcastForm.isActive ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-500'}`}>
                    {broadcastForm.isActive ? 'กำลังประกาศ' : 'ยังไม่เปิด'}
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900">ประกาศทั้งระบบ</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">แจ้งข่าวสารหรือเตือนปิดปรับปรุงระบบ</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openSection('billing')}
                className="group flex flex-col justify-between rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-white shadow-sm transition group-hover:scale-105">
                    <Banknote size={20} />
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800">
                    {pendingPaymentCount} รอตรวจ
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900">ตรวจสลิป & VIP</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">อนุมัติการชำระเงินและให้สิทธิ์โรงเรียน</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openSection('workspaces')}
                className="group flex flex-col justify-between rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm transition group-hover:scale-105">
                    <Building2 size={20} />
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
                    {activeWorkspaceCount} โรงเรียน
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900">จัดการ Workspace</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">เข้าใช้งานแทน กู้คืน และดูแลโรงเรียน</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openSection('users')}
                className="group flex flex-col justify-between rounded-3xl border border-purple-200/80 bg-gradient-to-br from-purple-50/80 via-white to-fuchsia-50/50 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white shadow-sm transition group-hover:scale-105">
                    <Users size={20} />
                  </span>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-black text-purple-800">
                    {adminRows.length} ผู้ดูแล
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-black text-slate-900">ผู้ใช้ & สิทธิ์</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">เพิ่ม Superadmin และรีเซ็ตรหัสผ่าน</p>
                </div>
              </button>
            </section>
          </>
        ) : null}

        {notice ? (
          <div className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{notice}</p>
          </div>
        ) : null}

        {activeSection === 'workspaces' ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-start">
        <section className="nexus-card overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="nexus-kicker">
                <School size={18} aria-hidden="true" />
                Workspace Directory
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-950">ทะเบียนโรงเรียนและ Workspace</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">
                Superadmin ใช้ส่วนนี้เพื่อตรวจว่าแต่ละ workspace อยู่โรงเรียนไหน มีสมาชิกกี่คน และเข้าใช้งานภาพรวมห้องเรียนได้จากระบบเดียวกัน
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              to="/app/select-workspace"
            >
              เลือก/สร้าง workspace
            </Link>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="block">
              <span className="sr-only">ค้นหา workspace</span>
              <input
                className="nexus-field h-11 w-full px-4 text-sm font-bold"
                onChange={(event) => setWorkspaceQuery(event.target.value)}
                placeholder="ค้นหาโรงเรียน / workspace / เจ้าของ / ปีการศึกษา"
                type="search"
                value={workspaceQuery}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Active', value: 'active' },
                { label: 'ทั้งหมด', value: 'all' },
                { label: 'Archived', value: 'archived' },
              ].map((item) => (
                <button
                  className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black transition ${
                    workspaceFilter === item.value
                      ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15'
                      : 'border border-slate-200 bg-white/90 text-slate-600 shadow-sm hover:bg-white'
                  }`}
                  key={item.value}
                  onClick={() => setWorkspaceFilter(item.value as WorkspaceDirectoryFilter)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 text-xs font-black text-slate-500">
            แสดง {filteredWorkspaces.length} จาก {workspaces.length} workspace
          </div>

          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
                <tr>
                  <th className="px-4 py-3">โรงเรียน / ห้องเรียน</th>
                  <th className="px-4 py-3">เจ้าของ</th>
                  <th className="px-4 py-3 text-center">ห้อง</th>
                  <th className="px-4 py-3 text-center">นักเรียน</th>
                  <th className="px-4 py-3 text-center">สมาชิก</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredWorkspaces.map((workspace) => (
                  <tr className="align-middle transition hover:bg-cyan-50/40" key={workspace.id}>
                    <td className="px-4 py-3">
                      <p className="max-w-[260px] truncate text-sm font-black text-slate-950">{workspace.schoolName}</p>
                      <p className="mt-0.5 max-w-[260px] truncate text-xs font-bold text-slate-500">
                        {workspace.name} · {workspace.classroomName} · ปี {workspace.academicYear}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-[190px] truncate text-xs font-black text-slate-700">{workspace.ownerName}</p>
                      <p className="mt-0.5 max-w-[190px] truncate text-[11px] font-bold text-slate-400">{workspace.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-black tabular-nums text-slate-700">{workspace.classroomCount}</td>
                    <td className="px-4 py-3 text-center text-sm font-black tabular-nums text-slate-700">{workspace.studentCount}</td>
                    <td className="px-4 py-3 text-center text-sm font-black tabular-nums text-slate-700">{workspace.memberCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-black ${workspace.archivedAt ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${workspace.archivedAt ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                        {workspace.archivedAt ? 'เก็บถาวร' : 'ใช้งานอยู่'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <button aria-label={`เข้าใช้งาน ${workspace.schoolName}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-50 px-3 text-xs font-black text-cyan-700 hover:bg-cyan-100" onClick={() => openWorkspace(workspace.id)} type="button">
                          <Building2 size={15} aria-hidden="true" /> เข้าใช้
                        </button>
                        <button aria-label={`${workspace.archivedAt ? 'กู้คืน' : 'เก็บถาวร'} ${workspace.schoolName}`} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled={workspaceActionId === workspace.id} onClick={() => void setWorkspaceArchived(workspace, !workspace.archivedAt)} title={workspace.archivedAt ? 'กู้คืน Workspace' : 'เก็บถาวร'} type="button">
                          <Archive size={15} aria-hidden="true" />
                        </button>
                        <button aria-label={`ให้ VIP ${workspace.schoolName}`} className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-amber-700 hover:bg-amber-100 disabled:opacity-50" disabled={workspaceActionId === workspace.id} onClick={() => void grantLifetimeVip(workspace)} title="VIP lifetime" type="button">
                          <Crown size={15} aria-hidden="true" />
                        </button>
                        <button aria-label={`ลบ ${workspace.schoolName} ถาวร`} className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-rose-700 hover:bg-rose-100 disabled:opacity-50" disabled={workspaceActionId === workspace.id} onClick={() => void deleteWorkspacePermanently(workspace)} title="ลบถาวร" type="button">
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 lg:hidden">
            {filteredWorkspaces.map((workspace) => (
              <article className="rounded-xl border border-slate-200 bg-white p-4" key={workspace.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                        {workspace.archivedAt ? 'archived' : 'active'}
                      </span>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
                        ปี {workspace.academicYear}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-base font-black text-slate-950">{workspace.schoolName}</h3>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                      {workspace.name} | ห้อง {workspace.classroomName}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                      เจ้าของ: {workspace.ownerName} | {workspace.ownerEmail}
                    </p>
                  </div>
                  <button
                    className="blue-action inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                    onClick={() => openWorkspace(workspace.id)}
                    type="button"
                  >
                    <Building2 size={17} aria-hidden="true" />
                    เข้าใช้งาน
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workspaceActionId === workspace.id}
                    onClick={() => void setWorkspaceArchived(workspace, !workspace.archivedAt)}
                    type="button"
                  >
                    <Archive size={16} aria-hidden="true" />
                    {workspace.archivedAt ? 'กู้คืน workspace' : 'เก็บถาวร workspace'}
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs font-black text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workspaceActionId === workspace.id}
                    onClick={() => void grantLifetimeVip(workspace)}
                    type="button"
                  >
                    <Crown size={16} aria-hidden="true" />
                    VIP lifetime
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workspaceActionId === workspace.id}
                    onClick={() => void deleteWorkspacePermanently(workspace)}
                    type="button"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    ลบ workspace ถาวร
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'ห้อง', value: workspace.classroomCount },
                    { label: 'นักเรียน', value: workspace.studentCount },
                    { label: 'สมาชิก', value: workspace.memberCount },
                  ].map((item) => (
                    <div className="rounded-2xl bg-white/80 p-3 text-center ring-1 ring-slate-100" key={item.label}>
                      <p className="text-2xl font-black text-slate-950">{item.value}</p>
                      <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}

            {filteredWorkspaces.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ไม่พบ workspace ตามเงื่อนไขที่เลือก
              </div>
            ) : null}
          </div>
        </section>

          <aside className="nexus-card overflow-hidden xl:sticky xl:top-16">
            <div className="border-b border-slate-200 px-4 py-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Operations Queue</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">งานที่ต้องตรวจสอบ</h2>
            </div>
            <div className="divide-y divide-slate-200">
              <button className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50" onClick={() => openSection('billing')} type="button">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">คิวตรวจการชำระเงิน</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">รอการอนุมัติหรือปฏิเสธ</p>
                  </div>
                </div>
                <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-sm font-black tabular-nums text-rose-700">{pendingPaymentCount}</span>
              </button>
              <button className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50" onClick={() => openSection('users')} type="button">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">ผู้ดูแลและสิทธิ์</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">บัญชีที่มีสิทธิ์ระดับระบบ</p>
                  </div>
                </div>
                <span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-sm font-black tabular-nums text-cyan-700">{adminRows.length}</span>
              </button>
              <button className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50" onClick={() => openSection('workspaces')} type="button">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">Workspace เก็บถาวร</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">ตรวจสอบก่อนลบถาวร</p>
                  </div>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-black tabular-nums text-slate-700">{archivedWorkspaceCount}</span>
              </button>
              <button className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50" onClick={() => openSection('health')} type="button">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${systemUsesSupabase ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">System Status</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">ฐานข้อมูลและบริการหลัก</p>
                  </div>
                </div>
                <span className={`text-xs font-black ${systemUsesSupabase ? 'text-emerald-700' : 'text-amber-700'}`}>{systemUsesSupabase ? 'ปกติ' : 'Demo'}</span>
              </button>
            </div>
          </aside>
        </div>
        ) : null}

        {activeSection === 'users' ? (
        <>
        <section className="mt-5 grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <UserPlus size={18} aria-hidden="true" />
              Admin Lifetime VIP
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">กำหนดผู้ดูแลจากผู้ใช้ในระบบ</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              เลือกบัญชีที่สมัคร ClassCare แล้ว ระบบจะแสดงชื่อและอีเมลให้ตรวจสอบก่อนกำหนดสิทธิ์
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ผู้ใช้ ClassCare
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setAdminProfileId(event.target.value)}
                  value={adminProfileId}
                >
                  <option value="">เลือกชื่อผู้ใช้…</option>
                  {adminCandidates.map((candidate) => (
                    <option disabled={candidate.isAdminActive} key={candidate.profileId} value={candidate.profileId}>
                      {candidate.displayName} · {candidate.email}{candidate.isAdminActive ? ` · เป็น ${candidate.currentLevel || 'admin'} แล้ว` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ระดับสิทธิ์
                <select
                  className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setAdminLevel(event.target.value as AdminLevel)}
                  value={adminLevel}
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">SuperAdmin</option>
                </select>
              </label>
              <button
                className="blue-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                onClick={() => void grantAdminAccess()}
                type="button"
              >
                <UserPlus size={17} aria-hidden="true" />
                เพิ่มสิทธิ์
              </button>
            </div>

            {adminNotice ? (
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-3 text-sm font-bold leading-6 text-cyan-900">
                {adminNotice}
              </div>
            ) : null}

            <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/40 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-amber-800">
                <KeyRound size={17} aria-hidden="true" />
                User Recovery
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                ใช้ส่งอีเมลรีเซ็ตรหัสผ่านให้ผู้ใช้ที่เข้าไม่ได้ โดยไม่ต้องรู้รหัสเดิมของผู้ใช้
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  placeholder="user@example.com"
                  type="email"
                  value={recoveryEmail}
                />
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5"
                  onClick={() => void sendPasswordResetEmail()}
                  type="button"
                >
                  <KeyRound size={16} aria-hidden="true" />
                  ส่ง reset
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 text-sm font-black text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={recoveryAction === 'active'}
                  onClick={() => void setProfileAccountStatus('active')}
                  type="button"
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Restore active
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-4 text-sm font-black text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={recoveryAction === 'suspended'}
                  onClick={() => void setProfileAccountStatus('suspended')}
                  type="button"
                >
                  <XCircle size={16} aria-hidden="true" />
                  Suspend account
                </button>
              </div>
              {recoveryNotice ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-white/80 p-3 text-sm font-bold leading-6 text-amber-900">
                  {recoveryNotice}
                </div>
              ) : null}
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="nexus-kicker">
                  <Users size={18} aria-hidden="true" />
                  Admin List
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">ผู้ดูแลระบบ {adminRows.length} คน</h2>
              </div>
              <span className="nexus-pill inline-flex h-10 items-center px-3 text-xs font-black text-slate-600">
                VIP ตลอดชีพ
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {adminRows.map((admin) => (
                <div className="nexus-muted-box grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_330px] md:items-center" key={admin.profileId}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                        {admin.level === 'superadmin' ? 'SuperAdmin' : 'Admin'}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                        admin.isActive
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                          : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}>
                        {admin.isActive ? 'active' : 'inactive'}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-base font-black text-slate-950">{admin.email}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {admin.displayName} | เพิ่มเมื่อ {formatDateTime(admin.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-white px-4 text-sm font-black text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50"
                      onClick={() => void sendPasswordResetEmail(admin.email)}
                      type="button"
                    >
                      <KeyRound size={16} aria-hidden="true" />
                      Reset
                    </button>
                  <button
                    className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black shadow-sm transition hover:-translate-y-0.5 ${
                      admin.isActive
                        ? 'border border-rose-100 bg-white text-rose-600 hover:bg-rose-50'
                        : 'blue-action'
                    }`}
                    disabled={adminActionId === admin.profileId}
                    onClick={() => void setAdminAccess(admin, !admin.isActive)}
                    type="button"
                  >
                    {admin.isActive ? 'ปิดสิทธิ์' : 'เปิดสิทธิ์'}
                  </button>
                  </div>
                </div>
              ))}

              {adminRows.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีรายการ Admin
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-5 nexus-card p-4 sm:p-5">
          <div className="nexus-kicker">
            <ShieldCheck size={18} aria-hidden="true" />
            Role Capability Matrix
          </div>
          <h2 className="mt-4 text-2xl font-black text-slate-950">ขอบเขตการใช้งานตามบทบาท</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            ใช้เป็น checklist ว่าบทบาทไหนควรเห็นเมนูอะไร และ action สำคัญต้องผ่าน backend/RPC ไม่ใช่แก้ข้อมูลตรงจากหน้าเว็บ
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {roleCapabilityMatrix.map((role) => (
              <article className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm" key={role.label}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{role.label}</h3>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-700">{role.status}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                    mapped
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {role.capabilities.map((capability) => (
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100" key={capability}>
                      {capability}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        </>
        ) : null}

        {activeSection === 'billing' ? (
        <section className="mt-5 grid gap-5">
          {/* Expiring Soon VIP Tracker */}
          {expiringSoonVipWorkspaces.length > 0 ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="text-amber-700" size={18} />
                  <h3 className="font-black text-amber-950">โรงเรียนที่แพ็กเกจ VIP ใกล้หมดอายุ (ภายใน 30 วัน)</h3>
                </div>
                <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-black text-amber-900">
                  {expiringSoonVipWorkspaces.length} โรงเรียน
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-amber-800">
                ตรวจสอบและขยายเวลาใช้งานให้โรงเรียนเพื่อไม่ให้การทำงานของครูสะดุด
              </p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {expiringSoonVipWorkspaces.map((ws) => (
                  <div key={ws.id} className="flex items-center justify-between rounded-2xl bg-white p-3.5 shadow-sm border border-amber-100">
                    <div className="min-w-0 pr-2">
                      <p className="truncate font-black text-sm text-slate-900">{ws.name}</p>
                      <p className="text-xs text-slate-500 font-bold">{ws.schoolName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceQuery(ws.name);
                        openSection('workspaces');
                      }}
                      className="shrink-0 rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 hover:bg-amber-200 transition"
                    >
                      จัดการ VIP
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <VipAccessManager />
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">Payment Review Queue</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">คิวตรวจสลิป {filteredPayments.length} รายการ</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'รอตรวจ', value: 'pending_review' },
                  { label: 'ทั้งหมด', value: 'all' },
                  { label: 'อนุมัติ', value: 'approved' },
                  { label: 'ไม่อนุมัติ', value: 'rejected' },
                ].map((filter) => (
                  <button
                    className={`h-10 rounded-2xl px-3 text-xs font-black transition ${
                      activeFilter === filter.value
                        ? 'bg-slate-950 text-white shadow-[0_12px_26px_rgba(2,6,23,0.22)]'
                        : 'nexus-pill text-slate-600 hover:-translate-y-0.5'
                    }`}
                    key={filter.value}
                    onClick={() => setActiveFilter(filter.value as 'all' | PaymentStatus)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {filteredPayments.map((payment) => (
                <article className="nexus-muted-box p-4" key={payment.id}>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                          {statusLabels[payment.status]}
                        </span>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
                          {formatDateTime(payment.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{payment.workspaceName}</h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                        {payment.schoolName} | {payment.ownerName} | {payment.ownerEmail}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                        {payment.planLabel} | สลิป: {payment.slipLabel}
                      </p>
                      {payment.slipUrl ? (
                        <a
                          className="mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-cyan-100 bg-cyan-50 px-3 text-xs font-black text-cyan-700 transition hover:-translate-y-0.5 hover:bg-cyan-100"
                          href={payment.slipUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <FileUp size={14} aria-hidden="true" />
                          เปิดสลิป
                        </a>
                      ) : (
                        <p className="mt-2 text-xs font-black text-amber-700">ยังไม่มีไฟล์สลิปให้เปิดตรวจ</p>
                      )}
                      {payment.reviewNote ? (
                        <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{payment.reviewNote}</p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                      <p className="text-xs font-black text-slate-500">ยอดชำระจริง</p>
                      <p className="mt-1 text-2xl font-black text-slate-950">{formatBaht(payment.payableAmountThb)}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        ฐาน {formatBaht(payment.baseAmountThb)} | เครดิต {formatBaht(payment.creditAmountThb)}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          className="blue-action inline-flex h-10 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                          disabled={reviewingId === payment.id || payment.status === 'approved'}
                          onClick={() => void reviewPayment(payment, 'approved')}
                          type="button"
                        >
                          <CheckCircle2 size={15} aria-hidden="true" />
                          อนุมัติ
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-3 text-xs font-black text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          disabled={reviewingId === payment.id || payment.status === 'rejected'}
                          onClick={() => void reviewPayment(payment, 'rejected')}
                          type="button"
                        >
                          <XCircle size={15} aria-hidden="true" />
                          ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {filteredPayments.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีคำขอตามตัวกรองนี้
                </div>
              ) : null}
            </div>
          </div>

          <aside className="grid gap-5">
            <div className="nexus-card p-4 sm:p-5">
              <div className="nexus-kicker">
                <QrCode size={16} aria-hidden="true" />
                Payment QR
              </div>
              <form className="mt-4 grid gap-3 rounded-3xl bg-white/80 p-3 ring-1 ring-slate-100" onSubmit={createPaymentQr}>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อ QR
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setQrForm((current) => ({ ...current, displayName: event.target.value }))}
                    value={qrForm.displayName}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ธนาคาร
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setQrForm((current) => ({ ...current, bankName: event.target.value }))}
                      placeholder="เช่น KBank"
                      value={qrForm.bankName}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-black text-slate-700">
                    ชื่อบัญชี
                    <input
                      className="nexus-field h-11 px-3"
                      onChange={(event) => setQrForm((current) => ({ ...current, accountName: event.target.value }))}
                      value={qrForm.accountName}
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  รายละเอียด
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setQrForm((current) => ({ ...current, accountHint: event.target.value }))}
                    placeholder="เช่น ใช้สำหรับรับชำระ ClassCare 360 VIP"
                    value={qrForm.accountHint}
                  />
                </label>
                <div className="rounded-3xl border border-cyan-100 bg-cyan-50/70 p-3">
                  <div className="flex items-center gap-2 text-sm font-black text-cyan-800">
                    <QrCode size={16} aria-hidden="true" />
                    สร้าง PromptPay QR อัตโนมัติ
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-cyan-900/80">
                    กรอกเบอร์หรือเลขบัตรเพื่อสร้าง QR รับเงิน ไม่ต้องอัปโหลดรูปเอง แนะนำให้สแกนทดสอบด้วยแอปธนาคารก่อนเปิดใช้งานจริง
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-xs font-black text-slate-700">
                      ประเภท PromptPay
                      <select
                        className="nexus-field h-11 px-3"
                        onChange={(event) => setPromptPayIdentifierType(event.target.value as PromptPayIdentifierType)}
                        value={promptPayIdentifierType}
                      >
                        <option value="phone">เบอร์โทรศัพท์</option>
                        <option value="national_id">เลขบัตร/เลขภาษี 13 หลัก</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-black text-slate-700">
                      ยอดเงิน (เว้นว่างได้)
                      <input
                        className="nexus-field h-11 px-3"
                        min="0"
                        onChange={(event) => setPromptPayAmount(event.target.value)}
                        placeholder="เช่น 100"
                        type="number"
                        value={promptPayAmount}
                      />
                    </label>
                  </div>
                  <label className="mt-3 grid gap-2 text-xs font-black text-slate-700">
                    {promptPayIdentifierType === 'phone' ? 'เบอร์พร้อมเพย์' : 'เลขบัตร/เลขภาษี'}
                    <input
                      className="nexus-field h-11 px-3"
                      inputMode="numeric"
                      onChange={(event) => setPromptPayIdentifier(event.target.value)}
                      placeholder={promptPayIdentifierType === 'phone' ? '0812345678' : '1234567890123'}
                      value={promptPayIdentifier}
                    />
                  </label>
                  <button
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-cyan-100 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isQrSubmitting}
                    onClick={() => void generatePromptPayQr()}
                    type="button"
                  >
                    <QrCode size={16} aria-hidden="true" />
                    เจนรูป PromptPay QR
                  </button>
                  {promptPayPreviewUrl ? (
                    <div className="mt-3 rounded-3xl bg-white p-3 ring-1 ring-cyan-100">
                      <img
                        alt="PromptPay QR preview"
                        className="mx-auto aspect-square max-h-52 w-full max-w-52 rounded-2xl object-contain"
                        src={promptPayPreviewUrl}
                      />
                    </div>
                  ) : null}
                </div>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  รูป QR
                  <span className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-cyan-200 bg-cyan-50/60 p-3 text-center transition hover:bg-cyan-50">
                    <FileUp className="text-cyan-700" size={22} aria-hidden="true" />
                    <span className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      {qrFile ? `${qrFile.name} (${Math.ceil(qrFile.size / 1024)} KB)` : 'เลือกไฟล์ PNG/JPG/WebP'}
                    </span>
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        setQrFile(event.target.files?.[0] || null);
                        setPromptPayPreviewUrl(null);
                      }}
                      type="file"
                    />
                  </span>
                </label>
                <button
                  className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isQrSubmitting}
                  type="submit"
                >
                  <QrCode size={17} aria-hidden="true" />
                  {isQrSubmitting ? 'กำลังบันทึก QR' : 'เพิ่มและเปิดใช้ QR'}
                </button>
                {qrNotice ? (
                  <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-3 text-xs font-bold leading-5 text-cyan-900">
                    {qrNotice}
                  </div>
                ) : null}
              </form>
              <div className="mt-4 grid gap-3">
                {qrRows.map((qr) => (
                  <div className="nexus-muted-box p-3" key={qr.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-950">{qr.displayName}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                        qr.isActive
                          ? 'bg-cyan-50 text-cyan-700 ring-cyan-100'
                          : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}
                      >
                        {qr.isActive ? 'active' : 'inactive'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                      {qr.bankName || 'ไม่ระบุธนาคาร'} | {qr.accountName || 'ไม่ระบุชื่อบัญชี'}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{qr.accountHint || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                    <button
                      className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isQrSubmitting || qr.isActive}
                      onClick={() => void setPaymentQrActive(qr)}
                      type="button"
                    >
                      {qr.isActive ? 'ใช้งานอยู่' : 'ตั้งเป็น active'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="nexus-card p-4 sm:p-5">
              <div className="nexus-kicker">
                <Banknote size={16} aria-hidden="true" />
                Subscriptions
              </div>
              <div className="mt-4 grid gap-3">
                {subscriptions.map((subscription) => (
                  <div className="nexus-muted-box p-3" key={subscription.id}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-950">{subscription.workspaceName}</p>
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-100">
                        {subscription.planCode}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-cyan-700">{subscriptionStatusLabels[subscription.status]}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">หมดอายุ: {formatDateTime(subscription.endsAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
        ) : null}

        {activeSection === 'support' ? <SuperadminSupportInbox /> : null}

        {activeSection === 'broadcast' ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="nexus-card p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700">
                  <Megaphone size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">ส่งประกาศทั่วทั้งระบบ (Global Broadcast)</h2>
                  <p className="text-xs font-bold text-slate-500">แถบประกาศจะปรากฏด้านบนสุดของหน้าจอครูและผู้ใช้ทุกคนในทุก Workspace</p>
                </div>
              </div>

              {broadcastNotice ? (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-black text-sky-900 shadow-sm">
                  {broadcastNotice}
                </div>
              ) : null}

              <form onSubmit={handleSaveBroadcast} className="mt-5 space-y-4">
                {/* Active Toggle Switch */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-black text-slate-900">สถานะการแสดงประกาศ</p>
                    <p className="text-xs font-bold text-slate-500">เปิดสวิตช์นี้เพื่อให้แถบประกาศแสดงผลทันที</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={broadcastForm.isActive}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-sky-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all"></div>
                  </label>
                </div>

                {/* Severity Selector */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">ระดับความสำคัญและโทนสี</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'info', label: 'ℹ️ ประกาศทั่วไป (สีฟ้า)', tone: 'border-sky-300 bg-sky-50 text-sky-900' },
                      { key: 'warning', label: '⚠️ เตือนสำคัญ (สีส้ม)', tone: 'border-amber-300 bg-amber-50 text-amber-900' },
                      { key: 'maintenance', label: '🚨 ปิดปรับปรุง (สีแดง)', tone: 'border-rose-300 bg-rose-50 text-rose-900' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setBroadcastForm({ ...broadcastForm, severity: item.key as BroadcastSeverity })}
                        className={`rounded-xl border p-2.5 text-xs font-black transition-all ${
                          broadcastForm.severity === item.key
                            ? `${item.tone} ring-2 ring-slate-900 shadow-sm`
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">หัวข้อประกาศ (สั้นกระชับและชัดเจน)</label>
                  <input
                    type="text"
                    value={broadcastForm.title}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                    placeholder="เช่น: ปิดปรับปรุงระบบชั่วคราว คืนนี้ 00:00 - 02:00 น."
                    className="w-full h-11 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">ข้อความรายละเอียด</label>
                  <textarea
                    rows={3}
                    value={broadcastForm.message}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                    placeholder="เช่น: ทีมงานกำลังอัปเกรดฐานข้อมูลเพื่อเพิ่มความเร็วในการใช้งาน กรุณาบันทึกคะแนนและข้อมูลก่อนช่วงเวลาดังกล่าว"
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Link URL & Link Text */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">ข้อความปุ่มลิงก์ (ไม่บังคับ)</label>
                    <input
                      type="text"
                      value={broadcastForm.linkText || ''}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, linkText: e.target.value })}
                      placeholder="เช่น: ดูรายละเอียดเพิ่มเติม"
                      className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">URL ลิงก์ (ไม่บังคับ)</label>
                    <input
                      type="url"
                      value={broadcastForm.linkUrl || ''}
                      onChange={(e) => setBroadcastForm({ ...broadcastForm, linkUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                {/* Dismissible checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={broadcastForm.dismissible !== false}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, dismissible: e.target.checked })}
                    className="rounded text-sky-600 focus:ring-sky-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-slate-600">อนุญาตให้ผู้ใช้กดยุบ/ปิดแถบประกาศนี้ได้</span>
                </label>

                {/* Submit buttons */}
                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    type="submit"
                    className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black shadow-sm"
                  >
                    <Sparkles size={16} />
                    <span>{broadcastForm.isActive ? 'บันทึกและส่งประกาศ' : 'บันทึกการตั้งค่า'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearBroadcast}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-rose-600 hover:bg-rose-50 shadow-sm transition"
                  >
                    <Trash2 size={16} />
                    <span>ปิดและล้างประกาศ</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Live Preview Column */}
            <div className="space-y-4">
              <div className="nexus-card p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                  <Bell size={14} />
                  <span>Real-time Live Preview</span>
                </div>
                <h3 className="mt-2 text-base font-black text-slate-950">ตัวอย่างแถบประกาศบนหน้าจอจริง</h3>
                <p className="mt-1 text-xs text-slate-500 font-bold">แบนเนอร์จะแสดงผลตามตัวอย่างนี้:</p>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                  <div className={`p-4 text-xs font-bold text-white shadow-inner ${
                    broadcastForm.severity === 'info'
                      ? 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600'
                      : broadcastForm.severity === 'warning'
                      ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700'
                      : 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-800'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase">
                        {broadcastForm.severity === 'info' ? <Info size={12} /> : broadcastForm.severity === 'warning' ? <AlertTriangle size={12} /> : <Wrench size={12} />}
                        {broadcastForm.severity === 'info' ? 'ประกาศ' : broadcastForm.severity === 'warning' ? 'แจ้งเตือน' : 'ปรับปรุงระบบ'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-sm text-white">{broadcastForm.title || '(ยังไม่ได้กรอกหัวข้อ)'}</p>
                        <p className="mt-1 text-xs text-white/90 leading-5">{broadcastForm.message || '(ยังไม่ได้กรอกรายละเอียดข้อความ)'}</p>
                        {broadcastForm.linkText ? (
                          <span className="mt-2 inline-flex items-center gap-1 font-black underline text-xs">
                            {broadcastForm.linkText} <ExternalLink size={10} />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 px-4 py-2 text-center text-[10px] font-bold text-slate-400 border-t border-slate-100">
                    สถานะปัจจุบัน: {broadcastForm.isActive ? '🟢 พร้อมแสดงผลทั่วทั้งระบบ' : '⚪ ปิดอยู่ (ไม่มีใครเห็น)'}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600 font-bold space-y-2">
                <p className="font-black text-slate-800">💡 เคล็ดลับการส่งประกาศ:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-500">
                  <li>เลือก <b>"ปิดปรับปรุงระบบ"</b> เมื่อจำเป็นต้องแจ้งล่วงหน้าก่อนอัปเดต Supabase หรือระบบหลัก</li>
                  <li>ข้อความควรกระชับ ระบุช่วงเวลาชัดเจน (เช่น 23:00 - 01:00 น.)</li>
                  <li>เมื่อบำรุงรักษาเสร็จสิ้น สามารถกด <b>"ปิดและล้างประกาศ"</b> เพื่อเอาแถบออกได้ทันที</li>
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === 'health' || activeSection === 'audit' ? (
        <section className="mt-5 grid gap-5">
          {activeSection === 'health' ? (
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="nexus-kicker">
                  <Activity size={18} aria-hidden="true" />
                  Live System Health & Telemetry
                </div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">ตรวจสุขภาพและประสิทธิภาพระบบ</h2>
              </div>
              <button
                type="button"
                onClick={() => void testDbPing()}
                disabled={isPinging}
                className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-black shadow-sm"
              >
                <Activity size={15} className={isPinging ? 'animate-spin' : ''} />
                <span>{isPinging ? 'กำลัง Ping...' : 'ทดสอบ Ping Latency เดี๋ยวนี้'}</span>
              </button>
            </div>

            {/* Latency & Live Metrics */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500">Database Latency</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-2xl font-black text-slate-950 tabular-nums">
                    {dbPingMs !== null ? `${dbPingMs} ms` : 'ยังไม่ได้วัด'}
                  </p>
                  {dbPingMs !== null ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      dbPingMs < 150 ? 'bg-emerald-100 text-emerald-800' : dbPingMs < 350 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {dbPingMs < 150 ? 'เร็วดีเยี่ยม' : dbPingMs < 350 ? 'ปานกลาง' : 'ช้า'}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">ความเร็วตอบสนองไปยัง Supabase</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500">Workspaces ทั้งหมด</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-2xl font-black text-slate-950 tabular-nums">{workspaces.length}</p>
                  <span className="text-xs font-bold text-emerald-600">{activeWorkspaceCount} active</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">{archivedWorkspaceCount} โรงเรียนเก็บถาวร</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500">นักเรียนในระบบรวม</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-2xl font-black text-slate-950 tabular-nums">{totalStudentCount.toLocaleString('th-TH')}</p>
                  <span className="text-xs font-bold text-slate-400">คน</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">จากทุกโรงเรียนที่เชื่อมต่อ</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-black text-slate-500">บัญชีผู้ดูแล (Admins)</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-2xl font-black text-slate-950 tabular-nums">{adminRows.length}</p>
                  <span className="text-xs font-bold text-purple-600">VIP ตลอดชีพ</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">ผู้มีสิทธิ์ระดับบริหาร</p>
              </div>
            </div>

            {/* Checklist items */}
            <div className="mt-5 grid gap-3">
              {[
                { label: 'Supabase Frontend Connection', value: isSupabaseReady ? 'เชื่อมต่อเสร็จสมบูรณ์' : 'ยังไม่ได้เชื่อมต่อ', tone: isSupabaseReady ? 'ready' : 'warn' },
                { label: 'Workspace Multi-tenant Isolation (RLS)', value: 'ตรวจสอบผ่านนโยบาย Row Level Security', tone: 'ready' },
                { label: 'Storage Buckets (สลิป & รูปถ่ายเยี่ยมบ้าน)', value: 'home-visit-photos และ payment-slips พร้อม', tone: 'ready' },
                { label: 'Cloudflare Pages CDN & Edge Network', value: 'Deploy อัตโนมัติและมี Cache ป้องกัน downtime', tone: 'ready' },
              ].map((item) => (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white/86 p-3.5 shadow-sm" key={item.label}>
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.label}</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">{item.value}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${
                    item.tone === 'ready'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-amber-100'
                  }`}>
                    {item.tone === 'ready' ? '✓ พร้อมใช้งาน' : 'ต้องตรวจ'}
                  </span>
                </div>
              ))}
            </div>

            <Link
              className="blue-action mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black shadow-sm"
              to="/app/dashboard?view=setup"
            >
              <span>เปิดดูรายงาน System Readiness ละเอียด</span>
              <ArrowLeft className="rotate-180" size={17} aria-hidden="true" />
            </Link>
          </div>
          ) : null}

          {activeSection === 'audit' ? (
          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <FileUp size={18} aria-hidden="true" />
              Audit & Support
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">ศูนย์ช่วย debug และตรวจย้อนหลัง</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              ใช้ตรวจว่าใครลบ/เก็บถาวร/อนุมัติ/แก้สิทธิ์อะไร และเป็นจุดส่งออก log เมื่อผู้ใช้แจ้งปัญหา “ข้อมูลไม่โผล่”
            </p>

            <div className="mt-4 grid gap-3">
              {[
                'ใครลบหรือเก็บถาวร workspace/classroom/student',
                'ใครอนุมัติครูเข้า workspace และให้สิทธิ์อะไร',
                'คำขอ payment/subscription ล่าสุดและผลอนุมัติ',
                'error ล่าสุดจาก Edge Function หรือ RLS policy',
              ].map((item) => (
                <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white/86 p-3" key={item}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-600" size={17} aria-hidden="true" />
                  <p className="text-sm font-bold leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                to="/app/dashboard?view=audit"
              >
                เปิด Audit Center
              </Link>
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-800 shadow-sm"
                onClick={() => setNotice('Export log จะผูกกับ Edge Function ในรอบถัดไป เพื่อรวม audit_logs, payment_requests และ workspace action แบบปลอดภัย')}
                type="button"
              >
                เตรียม Export Debug Pack
              </button>
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        <footer className="mt-6 text-center text-xs font-bold text-slate-500">
          Created by MIKPURINUT
        </footer>
      </section>
    </main>
  );
}
