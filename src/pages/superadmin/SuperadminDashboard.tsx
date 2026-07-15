import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  Banknote,
  Building2,
  CheckCircle2,
  FileUp,
  GraduationCap,
  QrCode,
  RefreshCw,
  School,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';

import { buildPromptPayPayload, dataUrlToFile, promptPayPayloadToPngDataUrl } from '../../lib/promptpay';
import { setStoredActiveWorkspaceId } from '../../lib/session';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';

type PaymentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'expired';
type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended' | 'cancelled' | 'refunded';
type AdminLevel = 'admin' | 'superadmin';
type PromptPayIdentifierType = 'national_id' | 'phone';
type WorkspaceDirectoryFilter = 'active' | 'all' | 'archived';

const controlCenterSections = [
  {
    body: 'จำนวน workspace active, นักเรียน, สมาชิก, admin และคำขอสำคัญล่าสุด',
    href: '#superadmin-overview',
    icon: ShieldCheck,
    label: 'ภาพรวมระบบ',
  },
  {
    body: 'ค้นหาโรงเรียน เข้าใช้งานแทน เก็บถาวร ลบ และเตรียม flow รวม workspace ซ้ำ',
    href: '#superadmin-workspaces',
    icon: Building2,
    label: 'โรงเรียน / Workspace',
  },
  {
    body: 'ค้นหาอีเมล เพิ่ม Admin/Superadmin ปิดสิทธิ์ และมองเห็นผู้ดูแลทั้งหมด',
    href: '#superadmin-users',
    icon: Users,
    label: 'ผู้ใช้และสิทธิ์',
  },
  {
    body: 'ดู subscription, payment pending, QR และเตรียม override VIP ราย workspace',
    href: '#superadmin-billing',
    icon: Banknote,
    label: 'แพ็กเกจ / VIP',
  },
  {
    body: 'ตรวจ env, migrations, RLS, storage, Edge Functions และ Cloudflare readiness',
    href: '#superadmin-health',
    icon: AlertTriangle,
    label: 'System Health',
  },
  {
    body: 'ดู log สำคัญ ใครลบอะไร ใครอนุมัติใคร และ export ข้อมูลเพื่อ debug',
    href: '#superadmin-audit',
    icon: FileUp,
    label: 'Audit & Support',
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

export function SuperadminDashboard({ embedded = false }: SuperadminDashboardProps) {
  const [adminRows, setAdminRows] = useState<AdminAccessRow[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
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
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อเชื่อมคิวตรวจสลิปจริง',
  );
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [isQrSubmitting, setIsQrSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [workspaceActionId, setWorkspaceActionId] = useState<string | null>(null);

  const activeWorkspaceCount = workspaces.filter((workspace) => !workspace.archivedAt).length;
  const totalStudentCount = workspaces.reduce((sum, workspace) => sum + workspace.studentCount, 0);
  const totalMemberCount = workspaces.reduce((sum, workspace) => sum + workspace.memberCount, 0);

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

  async function loadSuperadminData() {
    if (!supabase) {
      setPayments(demoPayments);
      setQrRows(demoQrRows);
      setSubscriptions(demoSubscriptions);
      setWorkspaces(demoWorkspaces);
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
    if (!supabase) {
      setAdminNotice('โหมดตัวอย่าง: พร้อมเพิ่ม admin หลังเชื่อม Supabase');
      return;
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAdminNotice('กรุณากรอกอีเมลผู้ใช้ที่สมัครและมี profile แล้ว');
      return;
    }

    setAdminNotice(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAdminNotice(userError?.message || 'กรุณาเข้าสู่ระบบ SuperAdmin อีกครั้ง');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,email,display_name')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileError || !profile) {
      setAdminNotice(profileError?.message || 'ยังไม่พบ profile ของอีเมลนี้ ให้ผู้ใช้สมัคร/Complete Profile ก่อน');
      return;
    }

    const { error: adminError } = await supabase.from('superadmin_profiles').upsert(
      {
        created_by: user.id,
        is_active: true,
        level: adminLevel,
        profile_id: profile.id,
      },
      { onConflict: 'profile_id' },
    );

    if (adminError) {
      setAdminNotice(adminError.message);
      return;
    }

    setAdminNotice(`เพิ่ม ${adminLevel === 'superadmin' ? 'SuperAdmin' : 'Admin'} ให้ ${profile.email} สำเร็จ พร้อม VIP ตลอดชีพ`);
    setAdminEmail('');
    void loadSuperadminData();
  }

  async function setAdminAccess(row: AdminAccessRow, isActive: boolean) {
    if (!supabase) return;

    const { error } = await supabase
      .from('superadmin_profiles')
      .update({ is_active: isActive })
      .eq('profile_id', row.profileId);

    if (error) {
      setAdminNotice(error.message);
      return;
    }

    setAdminNotice(`${isActive ? 'เปิด' : 'ปิด'}สิทธิ์ ${row.email} สำเร็จ`);
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

  function openWorkspace(workspaceId: string) {
    setStoredActiveWorkspaceId(workspaceId);
    window.location.href = '/app/dashboard';
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

    const { data, error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspace.id)
      .select('id');

    if (error) {
      setNotice(`ลบ workspace ไม่สำเร็จ: ${error.message}`);
      setWorkspaceActionId(null);
      return;
    }

    if (!data || data.length === 0) {
      setNotice('ลบ workspace ไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง อาจยังไม่ได้รัน migration 0016_workspace_classroom_delete_policy.sql หรือสิทธิ์ RLS ยังไม่อนุญาตให้ลบ');
      setWorkspaceActionId(null);
      return;
    }

    setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
    setNotice(`ลบ workspace ${workspace.name} ถาวรแล้ว`);
    setWorkspaceActionId(null);
  }

  return (
    <main className={embedded ? 'min-w-0 px-4 pb-24 pt-4 text-slate-950 sm:px-6 lg:px-8 lg:pb-10' : 'classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8'}>
      {!embedded ? (
        <Link
          className="fixed left-4 top-4 z-30 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-4 text-sm font-black text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
          to="/app/dashboard"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          กลับหน้าแอป
        </Link>
      ) : null}
      <section className="mx-auto max-w-7xl">
        <div className="nexus-card overflow-hidden">
          <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="p-6 sm:p-8">
              <div className="nexus-kicker">
                <ShieldCheck size={18} aria-hidden="true" />
                Superadmin
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
                Superadmin Dashboard
              </h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-600">
                ศูนย์ผู้ดูแลระบบสำหรับตรวจ workspace โรงเรียน สมาชิก และสิทธิ์ผู้ใช้ก่อนใช้งานจริง ส่วนระบบเงินเก็บไว้เป็นงานภายหลัง
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={isLoading}
                  onClick={() => void loadSuperadminData()}
                  type="button"
                >
                  <RefreshCw size={17} aria-hidden="true" />
                  รีเฟรชข้อมูล
                </button>
                <span className="nexus-pill inline-flex h-11 items-center gap-2 px-4 text-sm font-black text-slate-700">
                  {isSupabaseReady ? 'Supabase ready' : 'Demo mode'}
                </span>
                {!embedded ? (
                  <Link
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                    to="/app/dashboard"
                  >
                    <ArrowLeft size={17} aria-hidden="true" />
                    กลับหน้า ClassCare
                  </Link>
                ) : null}
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                  to="/app/select-workspace"
                >
                  เลือก/สร้าง workspace
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden border-t border-slate-100 bg-slate-950 p-6 text-white xl:border-l xl:border-t-0 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-300/20 blur-2xl" />
              <p className="relative text-sm font-black text-cyan-200">System Guard</p>
              <div className="relative mt-5 grid gap-3">
                {[
                  'ทุกข้อมูลห้องเรียนต้องผูก workspace_id',
                  'Superadmin เข้าใช้งานห้องเรียนได้จาก shell เดียวกับครู',
                  'ระบบเงินถูกแยกไว้ด้านล่าง ไม่ใช่ flow หลักตอนตั้งระบบ',
                ].map((item) => (
                  <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur" key={item}>
                    <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden="true" />
                    <p className="text-sm font-bold leading-6 text-slate-100">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div id="superadmin-overview" className="mt-5 grid scroll-mt-24 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Building2, label: 'workspace active', value: activeWorkspaceCount },
            { icon: GraduationCap, label: 'นักเรียนทั้งหมด', value: totalStudentCount },
            { icon: Users, label: 'สมาชิก workspace', value: totalMemberCount },
            { icon: ShieldCheck, label: 'ผู้ดูแลระบบ', value: adminRows.length },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div className="nexus-card p-4 transition hover:-translate-y-1" key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-black text-slate-950">{item.value}</p>
                    <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {notice ? (
          <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>{notice}</p>
          </div>
        ) : null}

        <section className="mt-5 nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="nexus-kicker">
                <ShieldCheck size={18} aria-hidden="true" />
                Superadmin Control Center
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-950">ศูนย์ควบคุมระบบหลัก</h2>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">
                ใช้เมนูย่อยนี้แทนการเลื่อนหายาว ๆ: เริ่มจากภาพรวม แล้วเจาะไป workspace, ผู้ใช้, VIP, สุขภาพระบบ และ audit/debug
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              to="/app/dashboard?view=setup"
            >
              เปิด System Readiness
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {controlCenterSections.map((section) => {
              const Icon = section.icon;

              return (
                <a
                  className="group rounded-[24px] border border-slate-200 bg-white/86 p-4 shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_20px_48px_rgba(14,165,233,0.12)]"
                  href={section.href}
                  key={section.href}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-cyan-200 transition group-hover:bg-cyan-600 group-hover:text-white">
                      <Icon size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-950">{section.label}</h3>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{section.body}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section id="superadmin-workspaces" className="mt-5 scroll-mt-24 nexus-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="nexus-kicker">
                <School size={18} aria-hidden="true" />
                Workspace Directory
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-950">โรงเรียนและห้องเรียนล่าสุด</h2>
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

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {filteredWorkspaces.map((workspace) => (
              <article className="nexus-muted-box p-4" key={workspace.id}>
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
                    <h3 className="mt-3 truncate text-xl font-black text-slate-950">{workspace.name}</h3>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                      {workspace.schoolName} | ห้อง {workspace.classroomName}
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

        <section id="superadmin-users" className="mt-5 grid scroll-mt-24 gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <UserPlus size={18} aria-hidden="true" />
              Admin Lifetime VIP
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">เพิ่ม Admin เอง</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              Admin และ SuperAdmin จะได้สิทธิ์ VIP ตลอดชีพ และสามารถเข้าใช้ระบบห้องเรียนได้
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                อีเมลผู้ใช้
                <input
                  className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setAdminEmail(event.target.value)}
                  placeholder="admin@example.com"
                  type="email"
                  value={adminEmail}
                />
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
                <div className="nexus-muted-box grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center" key={admin.profileId}>
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
                  <button
                    className={`inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black shadow-sm transition hover:-translate-y-0.5 ${
                      admin.isActive
                        ? 'border border-rose-100 bg-white text-rose-600 hover:bg-rose-50'
                        : 'blue-action'
                    }`}
                    onClick={() => void setAdminAccess(admin, !admin.isActive)}
                    type="button"
                  >
                    {admin.isActive ? 'ปิดสิทธิ์' : 'เปิดสิทธิ์'}
                  </button>
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

        <section id="superadmin-billing" className="mt-5 grid scroll-mt-24 gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
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

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <div id="superadmin-health" className="scroll-mt-24 nexus-card p-4 sm:p-5">
            <div className="nexus-kicker">
              <AlertTriangle size={18} aria-hidden="true" />
              System Health
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950">ตรวจสุขภาพระบบก่อนเปิดใช้จริง</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              ส่วนนี้เป็นแผงควบคุมสำหรับ Superadmin เพื่อดูว่า Supabase, RLS, Storage, Edge Functions และ Cloudflare deploy พร้อมหรือยัง
            </p>

            <div className="mt-4 grid gap-3">
              {[
                { label: 'Supabase frontend env', value: isSupabaseReady ? 'พร้อมใช้งาน' : 'ยังไม่พร้อม', tone: isSupabaseReady ? 'ready' : 'warn' },
                { label: 'Workspace isolation / RLS', value: 'ตรวจผ่านหน้า System Readiness', tone: 'ready' },
                { label: 'Storage home-visit-photos', value: 'ต้องเปิด policy ก่อนใช้งานจริง', tone: 'warn' },
                { label: 'Edge Functions payment/admin', value: 'ใช้สำหรับ action สำคัญ ห้ามใส่ service role ใน frontend', tone: 'warn' },
              ].map((item) => (
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white/86 p-3" key={item.label}>
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.label}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{item.value}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${
                    item.tone === 'ready'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-amber-100'
                  }`}>
                    {item.tone === 'ready' ? 'ready' : 'ต้องตรวจ'}
                  </span>
                </div>
              ))}
            </div>

            <Link
              className="blue-action mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
              to="/app/dashboard?view=setup"
            >
              เปิดหน้า System Readiness
              <ArrowLeft className="rotate-180" size={17} aria-hidden="true" />
            </Link>
          </div>

          <div id="superadmin-audit" className="scroll-mt-24 nexus-card p-4 sm:p-5">
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
        </section>

        <footer className="mt-6 text-center text-xs font-bold text-slate-500">
          Created by MIKPURINUT
        </footer>
      </section>
    </main>
  );
}
