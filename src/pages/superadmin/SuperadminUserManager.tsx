import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MailCheck,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { appEnv } from '../../lib/env';
import { supabase } from '../../lib/supabaseClient';

type AdminLevel = 'admin' | 'superadmin';
type StatusFilter = 'all' | 'active' | 'suspended' | 'unconfirmed';
type RoleFilter = 'all' | 'admins' | 'regular';
type PasswordResetMode = 'direct' | 'email';
type DeleteWorkspaceStrategy = 'transfer' | 'delete';

export interface ManagedUserWorkspace {
  workspace_id: string;
  workspace_name: string;
  school_name: string;
  role: string;
  status: string;
  is_owner: boolean;
}

export interface ManagedUserRow {
  profileId: string;
  email: string;
  displayName: string;
  phone: string | null;
  accountStatus: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  adminLevel: AdminLevel | null;
  isAdminActive: boolean;
  workspaceCount: number;
  ownedWorkspaceCount: number;
  workspaces: ManagedUserWorkspace[];
}

interface SuperadminUserManagerProps {
  currentUserId: string;
  isDevelopmentDemo: boolean;
  onDataMutated?: () => void;
}

const demoManagedUsers: ManagedUserRow[] = [
  {
    profileId: 'demo-superadmin',
    email: 'superadmin@classcare.local',
    displayName: 'ผู้ดูแลระบบหลัก (ตัวอย่าง)',
    phone: '081-234-5678',
    accountStatus: 'active',
    createdAt: '2026-06-01T08:00:00+07:00',
    lastLoginAt: '2026-11-18T10:00:00+07:00',
    lastSignInAt: '2026-11-18T10:00:00+07:00',
    emailConfirmedAt: '2026-06-01T08:01:00+07:00',
    bannedUntil: null,
    adminLevel: 'superadmin',
    isAdminActive: true,
    workspaceCount: 1,
    ownedWorkspaceCount: 1,
    workspaces: [
      {
        workspace_id: 'demo-ws-1',
        workspace_name: 'ป.5/1',
        school_name: 'โรงเรียนบ้านโคกสูง',
        role: 'teacher_owner',
        status: 'active',
        is_owner: true,
      },
    ],
  },
  {
    profileId: 'demo-teacher-1',
    email: 'teacher.somchai@school.ac.th',
    displayName: 'ครูสมชาย ใจดี',
    phone: '089-111-2222',
    accountStatus: 'active',
    createdAt: '2026-08-15T09:30:00+07:00',
    lastLoginAt: '2026-11-17T14:20:00+07:00',
    lastSignInAt: '2026-11-17T14:20:00+07:00',
    emailConfirmedAt: '2026-08-15T09:35:00+07:00',
    bannedUntil: null,
    adminLevel: null,
    isAdminActive: false,
    workspaceCount: 1,
    ownedWorkspaceCount: 1,
    workspaces: [
      {
        workspace_id: 'demo-ws-2',
        workspace_name: 'ป.4/2',
        school_name: 'โรงเรียนวัดตัวอย่าง',
        role: 'teacher_owner',
        status: 'active',
        is_owner: true,
      },
    ],
  },
];

function formatThaiDateTime(value: string | null) {
  if (!value) return 'ยังไม่เคยเข้าใช้';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function generateStrongPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = upper + lower + digits + symbols;
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const chars = [pick(upper), pick(upper), pick(lower), pick(lower), pick(digits), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function getWorkspaceRoleLabel(role: string, isOwner: boolean) {
  if (isOwner || role === 'teacher_owner') return 'เจ้าของ';
  if (role === 'teacher_member' || role === 'teacher_editor') return 'ครูร่วมสอน';
  if (role === 'viewer' || role === 'teacher_viewer') return 'ผู้ดูข้อมูล';
  if (role === 'parent') return 'ผู้ปกครอง';
  if (role === 'student') return 'นักเรียน';
  return role;
}

function translateUserError(rawMessage: string) {
  if (rawMessage.includes('cannot_delete_yourself')) return 'ไม่สามารถลบบัญชีของตัวเองที่กำลังใช้งานอยู่ได้';
  if (rawMessage.includes('cannot_disable_yourself')) return 'ไม่สามารถระงับบัญชีของตัวเองที่กำลังใช้งานอยู่ได้';
  if (rawMessage.includes('cannot_delete_last_superadmin') || rawMessage.includes('cannot_disable_last_superadmin')) {
    return 'ไม่สามารถลบหรือระงับ SuperAdmin คนสุดท้ายของระบบได้';
  }
  if (rawMessage.includes('cannot_remove_workspace_owner')) {
    return 'ไม่สามารถนำเจ้าของหลักออกจาก Workspace ได้ กรุณาโอนสิทธิ์เจ้าของหรือลบ Workspace แทน';
  }
  if (rawMessage.includes('password_too_short')) return 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร';
  if (rawMessage.includes('email_already_in_use') || rawMessage.includes('User already registered')) {
    return 'อีเมลนี้มีบัญชีใช้งานอยู่ในระบบแล้ว';
  }
  if (rawMessage.includes('invalid_email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (rawMessage.includes('not_allowed')) return 'บัญชีปัจจุบันไม่มีสิทธิ์ SuperAdmin สำหรับคำสั่งนี้';
  if (rawMessage.includes('Could not find the function') || rawMessage.includes('does not exist')) {
    return 'ยังไม่ได้รัน Migration 0088_superadmin_user_management.sql ใน Supabase SQL Editor กรุณารันก่อนใช้งานฟีเจอร์นี้';
  }
  return rawMessage;
}

function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    Boolean(error.message?.includes('Could not find the function')) ||
    Boolean(error.message?.includes('does not exist'))
  );
}

export function SuperadminUserManager({ currentUserId, isDevelopmentDemo, onDataMutated }: SuperadminUserManagerProps) {
  const [users, setUsers] = useState<ManagedUserRow[]>(isDevelopmentDemo ? demoManagedUsers : []);
  const [isLoading, setIsLoading] = useState(!isDevelopmentDemo);
  const [needsMigrationNotice, setNeedsMigrationNotice] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active modals
  const [resetTarget, setResetTarget] = useState<ManagedUserRow | null>(null);
  const [resetMode, setResetMode] = useState<PasswordResetMode>('direct');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [resetSuccessText, setResetSuccessText] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [editTarget, setEditTarget] = useState<ManagedUserRow | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleSelection, setEditRoleSelection] = useState<'regular' | 'admin' | 'superadmin'>('regular');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState(() => generateStrongPassword());
  const [createConfirmEmail, setCreateConfirmEmail] = useState(true);
  const [createdCredentials, setCreatedCredentials] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ManagedUserRow | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteStrategy, setDeleteStrategy] = useState<DeleteWorkspaceStrategy>('transfer');
  const [isDeleting, setIsDeleting] = useState(false);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      setNotice({ tone: 'error', text: 'ไม่สามารถคัดลอกลงคลิปบอร์ดได้ กรุณาเลือกข้อความแล้วคัดลอกเอง' });
    }
  };

  const loadUsers = useCallback(async () => {
    if (!supabase || isDevelopmentDemo) {
      setUsers(demoManagedUsers);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setNeedsMigrationNotice(false);

    // 1. Primary path: rich directory RPC (migration 0088)
    const { data: rpcRows, error: rpcError } = await supabase.rpc('superadmin_list_users_directory', {
      search_text: null,
    });

    if (!rpcError && Array.isArray(rpcRows)) {
      const mapped: ManagedUserRow[] = rpcRows.map((row: Record<string, unknown>) => ({
        profileId: String(row.profile_id),
        email: String(row.email || ''),
        displayName: String(row.display_name || row.email || 'ไม่ระบุชื่อ'),
        phone: (row.phone as string | null) || null,
        accountStatus: String(row.account_status || 'active'),
        createdAt: (row.created_at as string | null) || null,
        lastLoginAt: (row.last_login_at as string | null) || null,
        lastSignInAt: (row.last_sign_in_at as string | null) || null,
        emailConfirmedAt: (row.email_confirmed_at as string | null) || null,
        bannedUntil: (row.banned_until as string | null) || null,
        adminLevel: (row.admin_level as AdminLevel | null) || null,
        isAdminActive: Boolean(row.is_admin_active),
        workspaceCount: Number(row.workspace_count || 0),
        ownedWorkspaceCount: Number(row.owned_workspace_count || 0),
        workspaces: Array.isArray(row.workspaces) ? (row.workspaces as ManagedUserWorkspace[]) : [],
      }));
      setUsers(mapped);
      setIsLoading(false);
      return;
    }

    // 2. Graceful fallback if migration 0088 is not yet applied in Supabase
    if (isMissingRpc(rpcError)) {
      setNeedsMigrationNotice(true);
    }

    const [candidatesRes, profilesRes, membersRes, workspacesRes] = await Promise.all([
      supabase.rpc('list_admin_access_candidates', { search_text: null }),
      supabase.from('profiles').select('id,email,display_name,phone,account_status,created_at,last_login_at').limit(500),
      supabase.from('workspace_memberships').select('workspace_id,profile_id,role,status').limit(1000),
      supabase.from('workspaces').select('id,name,school_name,owner_profile_id,archived_at').limit(500),
    ]);

    const activeWorkspaces = (
      (workspacesRes.data || []) as Array<{
        id: string;
        name: string;
        school_name: string | null;
        owner_profile_id: string;
        archived_at?: string | null;
      }>
    ).filter((w) => !w.archived_at);

    const wsById = new Map(activeWorkspaces.map((w) => [w.id, w]));
    const membersByProfile = new Map<string, ManagedUserWorkspace[]>();
    const addMembership = (profileId: string, item: ManagedUserWorkspace) => {
      const list = membersByProfile.get(profileId) || [];
      if (list.some((existing) => existing.workspace_id === item.workspace_id)) return;
      list.push(item);
      membersByProfile.set(profileId, list);
    };

    ((membersRes.data || []) as Array<{ workspace_id: string; profile_id: string; role: string; status: string }>).forEach((m) => {
      if (m.status === 'removed') return;
      const ws = wsById.get(m.workspace_id);
      if (!ws) return;
      addMembership(m.profile_id, {
        workspace_id: ws.id,
        workspace_name: ws.name,
        school_name: ws.school_name || ws.name,
        role: m.role,
        status: m.status,
        is_owner: ws.owner_profile_id === m.profile_id,
      });
    });

    activeWorkspaces.forEach((ws) => {
      if (!ws.owner_profile_id) return;
      addMembership(ws.owner_profile_id, {
        workspace_id: ws.id,
        workspace_name: ws.name,
        school_name: ws.school_name || ws.name,
        role: 'teacher_owner',
        status: 'active',
        is_owner: true,
      });
    });

    const profileMap = new Map(
      ((profilesRes.data || []) as Array<Record<string, unknown>>).map((p) => [String(p.id), p]),
    );

    const candidateRows = Array.isArray(candidatesRes.data) ? (candidatesRes.data as Array<Record<string, unknown>>) : [];
    const fallbackUsers: ManagedUserRow[] =
      candidateRows.length > 0
        ? candidateRows.map((c) => {
            const id = String(c.profile_id);
            const prof = profileMap.get(id);
            const wsList = membersByProfile.get(id) || [];
            return {
              profileId: id,
              email: String(c.email || ''),
              displayName: String(c.display_name || c.email || ''),
              phone: (prof?.phone as string | null) || null,
              accountStatus: String(c.account_status || prof?.account_status || 'active'),
              createdAt: (prof?.created_at as string | null) || null,
              lastLoginAt: (prof?.last_login_at as string | null) || null,
              lastSignInAt: null,
              emailConfirmedAt: 'fallback-unknown',
              bannedUntil: null,
              adminLevel: (c.current_level as AdminLevel | null) || null,
              isAdminActive: Boolean(c.is_admin_active),
              workspaceCount: wsList.length,
              ownedWorkspaceCount: wsList.filter((w) => w.is_owner).length,
              workspaces: wsList,
            };
          })
        : ((profilesRes.data || []) as Array<Record<string, unknown>>).map((p) => {
            const id = String(p.id);
            const wsList = membersByProfile.get(id) || [];
            return {
              profileId: id,
              email: String(p.email || ''),
              displayName: String(p.display_name || p.email || ''),
              phone: (p.phone as string | null) || null,
              accountStatus: String(p.account_status || 'active'),
              createdAt: (p.created_at as string | null) || null,
              lastLoginAt: (p.last_login_at as string | null) || null,
              lastSignInAt: null,
              emailConfirmedAt: 'fallback-unknown',
              bannedUntil: null,
              adminLevel: null,
              isAdminActive: false,
              workspaceCount: wsList.length,
              ownedWorkspaceCount: wsList.filter((w) => w.is_owner).length,
              workspaces: wsList,
            };
          });

    setUsers(fallbackUsers);
    setIsLoading(false);
  }, [isDevelopmentDemo]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const stats = useMemo(() => {
    const total = users.length;
    const suspended = users.filter((u) => u.accountStatus === 'suspended' || u.accountStatus === 'cancelled' || Boolean(u.bannedUntil)).length;
    const unconfirmed = users.filter((u) => u.emailConfirmedAt === null).length;
    const activeAdmins = users.filter((u) => u.isAdminActive).length;
    const active = total - suspended;
    return { active, activeAdmins, suspended, total, unconfirmed };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const isSuspended = u.accountStatus === 'suspended' || u.accountStatus === 'cancelled' || Boolean(u.bannedUntil);
      const isUnconfirmed = u.emailConfirmedAt === null;

      if (statusFilter === 'active' && isSuspended) return false;
      if (statusFilter === 'suspended' && !isSuspended) return false;
      if (statusFilter === 'unconfirmed' && !isUnconfirmed) return false;

      if (roleFilter === 'admins' && !u.isAdminActive) return false;
      if (roleFilter === 'regular' && u.isAdminActive) return false;

      if (!q) return true;
      const haystack = [
        u.displayName,
        u.email,
        u.phone || '',
        ...u.workspaces.map((w) => `${w.school_name} ${w.workspace_name}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  // --- Handlers ---

  function openResetModal(user: ManagedUserRow) {
    setResetTarget(user);
    setResetMode('direct');
    setNewPassword(generateStrongPassword());
    setShowPassword(true);
    setResetSuccessText(null);
  }

  async function handleExecutePasswordReset() {
    if (!resetTarget) return;
    if (!supabase || isDevelopmentDemo) {
      setResetSuccessText(`โหมดตัวอย่าง: ตั้งรหัสผ่านให้ ${resetTarget.email} เรียบร้อย`);
      return;
    }

    setIsResetting(true);
    setResetSuccessText(null);

    try {
      if (resetMode === 'email') {
        const { error } = await supabase.auth.resetPasswordForEmail(resetTarget.email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw new Error(error.message);
        setResetSuccessText(`ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${resetTarget.email} เรียบร้อยแล้ว`);
        setNotice({ tone: 'success', text: `ส่งอีเมลรีเซ็ตรหัสผ่านให้ ${resetTarget.email} แล้ว` });
      } else {
        if (newPassword.trim().length < 8) {
          throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
        }
        const { error: rpcErr } = await supabase.rpc('superadmin_set_user_password', {
          target_profile_id: resetTarget.profileId,
          next_password: newPassword.trim(),
        });
        if (rpcErr) throw new Error(translateUserError(rpcErr.message));

        const shareMessage = `ข้อมูลเข้าสู่ระบบ ClassCare 360 (รหัสผ่านใหม่)\nอีเมล: ${resetTarget.email}\nรหัสผ่านใหม่: ${newPassword.trim()}\nเข้าสู่ระบบได้ที่: ${window.location.origin}/auth/login`;
        setResetSuccessText(shareMessage);
        setNotice({ tone: 'success', text: `ตั้งรหัสผ่านใหม่ให้ ${resetTarget.displayName} (${resetTarget.email}) เรียบร้อยแล้ว` });
        await loadUsers();
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : 'รีเซ็ตรหัสผ่านไม่สำเร็จ' });
    } finally {
      setIsResetting(false);
    }
  }

  function openEditModal(user: ManagedUserRow) {
    setEditTarget(user);
    setEditDisplayName(user.displayName);
    setEditPhone(user.phone || '');
    setEditEmail(user.email);
    setEditRoleSelection(user.isAdminActive && user.adminLevel ? user.adminLevel : 'regular');
  }

  async function handleSaveUserEdit() {
    if (!editTarget) return;
    if (!supabase || isDevelopmentDemo) {
      setNotice({ tone: 'info', text: 'โหมดตัวอย่าง: บันทึกข้อมูลผู้ใช้จำลองสำเร็จ' });
      setEditTarget(null);
      return;
    }

    const trimmedName = editDisplayName.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();
    if (!trimmedName) {
      setNotice({ tone: 'error', text: 'กรุณากรอกชื่อแสดงผล' });
      return;
    }

    setIsSavingEdit(true);
    try {
      const emailChanged = Boolean(trimmedEmail) && trimmedEmail !== editTarget.email.toLowerCase();

      // 1. Update display name & phone via live SQL RPC
      const { error: rpcErr } = await supabase.rpc('superadmin_update_user_profile', {
        target_profile_id: editTarget.profileId,
        next_display_name: trimmedName,
        next_phone: trimmedPhone || null,
      });
      if (rpcErr) throw new Error(translateUserError(rpcErr.message));

      // 2. Update email if changed
      if (emailChanged) {
        const { error: emailErr } = await supabase.rpc('superadmin_update_user_email', {
          target_profile_id: editTarget.profileId,
          next_email: trimmedEmail,
        });
        if (emailErr) throw new Error(translateUserError(emailErr.message));
      }

      // 3. Update Admin / SuperAdmin level if changed
      const currentRole: 'regular' | 'admin' | 'superadmin' =
        editTarget.isAdminActive && editTarget.adminLevel ? editTarget.adminLevel : 'regular';

      if (editRoleSelection !== currentRole) {
        if (editRoleSelection === 'regular') {
          const { error: revErr } = await supabase.rpc('set_superadmin_profile_status', {
            target_profile_id: editTarget.profileId,
            next_is_active: false,
          });
          if (revErr) throw new Error(translateUserError(revErr.message));
        } else {
          const { error: grantErr } = await supabase.rpc('grant_admin_access_by_email', {
            target_email: emailChanged ? trimmedEmail : editTarget.email,
            target_level: editRoleSelection,
          });
          if (grantErr) throw new Error(translateUserError(grantErr.message));
        }
      }

      setNotice({ tone: 'success', text: `อัปเดตข้อมูลและสิทธิ์ของ ${trimmedName} เรียบร้อยแล้ว` });
      setEditTarget(null);
      await loadUsers();
      onDataMutated?.();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : 'บันทึกข้อมูลไม่สำเร็จ' });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleConfirmEmail(user: ManagedUserRow) {
    if (!supabase || isDevelopmentDemo) {
      setNotice({ tone: 'info', text: `โหมดตัวอย่าง: ยืนยันอีเมลให้ ${user.email} แล้ว` });
      return;
    }
    setIsSavingEdit(true);
    try {
      const { error: rpcErr } = await supabase.rpc('superadmin_confirm_user_email', {
        target_profile_id: user.profileId,
      });
      if (rpcErr) throw new Error(translateUserError(rpcErr.message));
      setNotice({ tone: 'success', text: `ยืนยันอีเมลให้ ${user.email} เรียบร้อยแล้ว ผู้ใช้สามารถเข้าสู่ระบบได้ทันที` });
      await loadUsers();
      if (editTarget?.profileId === user.profileId) {
        setEditTarget({ ...user, emailConfirmedAt: new Date().toISOString() });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : 'ยืนยันอีเมลไม่สำเร็จ' });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleToggleUserStatus(user: ManagedUserRow, nextStatus: 'active' | 'suspended') {
    if (!supabase || isDevelopmentDemo) {
      setNotice({ tone: 'info', text: `โหมดตัวอย่าง: เปลี่ยนสถานะ ${user.email} เป็น ${nextStatus}` });
      return;
    }

    const label = nextStatus === 'suspended' ? 'ระงับบัญชีผู้ใช้' : 'คืนสถานะบัญชีผู้ใช้';
    if (!window.confirm(`${label} "${user.displayName}" (${user.email}) หรือไม่?`)) return;

    setIsSavingEdit(true);
    try {
      const { error: rpcErr } = await supabase.rpc('superadmin_set_user_status', {
        target_profile_id: user.profileId,
        next_account_status: nextStatus,
      });
      if (rpcErr) {
        if (isMissingRpc(rpcErr)) {
          const { error: legacyErr } = await supabase.rpc('set_profile_account_status_by_email', {
            target_email: user.email,
            next_account_status: nextStatus,
          });
          if (legacyErr) throw new Error(translateUserError(legacyErr.message));
        } else {
          throw new Error(translateUserError(rpcErr.message));
        }
      }

      setNotice({
        tone: 'success',
        text: `${label} ${user.displayName} (${user.email}) เรียบร้อยแล้ว`,
      });
      await loadUsers();
      onDataMutated?.();
      if (editTarget?.profileId === user.profileId) {
        setEditTarget({
          ...user,
          accountStatus: nextStatus,
          bannedUntil: nextStatus === 'suspended' ? '2099-12-31T00:00:00Z' : null,
        });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : `${label}ไม่สำเร็จ` });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleRemoveFromWorkspace(user: ManagedUserRow, ws: ManagedUserWorkspace) {
    if (!supabase || isDevelopmentDemo) return;
    if (!window.confirm(`นำ ${user.displayName} ออกจาก "${ws.school_name}" หรือไม่?`)) return;

    setIsSavingEdit(true);
    try {
      const { error } = await supabase.rpc('superadmin_remove_user_from_workspace', {
        target_profile_id: user.profileId,
        target_workspace_id: ws.workspace_id,
      });
      if (error) throw new Error(translateUserError(error.message));
      setNotice({ tone: 'success', text: `นำ ${user.displayName} ออกจาก ${ws.school_name} แล้ว` });
      await loadUsers();
      if (editTarget?.profileId === user.profileId) {
        setEditTarget({
          ...user,
          workspaces: user.workspaces.filter((w) => w.workspace_id !== ws.workspace_id),
          workspaceCount: Math.max(0, user.workspaceCount - 1),
        });
      }
      onDataMutated?.();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : 'นำออกจาก Workspace ไม่สำเร็จ' });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleCreateUser() {
    if (!supabase || isDevelopmentDemo) {
      setCreatedCredentials(`อีเมล: ${createEmail}\nรหัสผ่าน: ${createPassword}`);
      return;
    }

    const email = createEmail.trim().toLowerCase();
    const displayName = createName.trim();
    const password = createPassword.trim();
    if (!email || !email.includes('@')) {
      setNotice({ tone: 'error', text: 'กรุณากรอกอีเมลให้ถูกต้อง' });
      return;
    }
    if (!displayName) {
      setNotice({ tone: 'error', text: 'กรุณากรอกชื่อ-นามสกุลผู้ใช้' });
      return;
    }
    if (password.length < 8) {
      setNotice({ tone: 'error', text: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
      return;
    }

    setIsCreating(true);
    try {
      // Use an isolated non-persisted Supabase Auth client so SuperAdmin session is untouched
      const tempClient = createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
          storageKey: 'classcare-superadmin-temp-create-user',
        },
      });

      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      if (signUpErr || !signUpData.user?.id) {
        throw new Error(translateUserError(signUpErr?.message || 'สร้างบัญชีผู้ใช้ไม่สำเร็จ'));
      }

      const newUserId = signUpData.user.id;

      if (createConfirmEmail) {
        await supabase.rpc('superadmin_confirm_user_email', {
          target_profile_id: newUserId,
        });
      }

      await supabase.rpc('superadmin_update_user_profile', {
        target_profile_id: newUserId,
        next_display_name: displayName,
        next_phone: createPhone.trim() || null,
      });

      const shareMessage = `บัญชีเข้าใช้งาน ClassCare 360\nชื่อ: ${displayName}\nอีเมล: ${email}\nรหัสผ่าน: ${password}\nเข้าสู่ระบบได้ที่: ${window.location.origin}/auth/login`;
      setCreatedCredentials(shareMessage);
      setNotice({ tone: 'success', text: `สร้างบัญชีผู้ใช้ ${displayName} (${email}) สำเร็จแล้ว` });
      await loadUsers();
      onDataMutated?.();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : 'สร้างบัญชีผู้ใช้ไม่สำเร็จ' });
    } finally {
      setIsCreating(false);
    }
  }

  function openDeleteModal(user: ManagedUserRow) {
    setDeleteTarget(user);
    setDeleteConfirmEmail('');
    setDeleteStrategy('transfer');
  }

  async function handleDeleteUserPermanently() {
    if (!deleteTarget) return;
    if (deleteConfirmEmail.trim().toLowerCase() !== deleteTarget.email.trim().toLowerCase()) {
      setNotice({ tone: 'error', text: 'กรุณาพิมพ์อีเมลผู้ใช้ให้ตรงกันเพื่อยืนยันการลบถาวร' });
      return;
    }

    if (!supabase || isDevelopmentDemo) {
      setUsers((prev) => prev.filter((u) => u.profileId !== deleteTarget.profileId));
      setNotice({ tone: 'info', text: `โหมดตัวอย่าง: ลบผู้ใช้ ${deleteTarget.email} จำลองเรียบร้อย` });
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('superadmin_delete_user_account', {
        target_profile_id: deleteTarget.profileId,
        workspace_strategy: deleteStrategy,
      });
      if (rpcErr) throw new Error(translateUserError(rpcErr.message));
      const result = rpcData as { deleted?: boolean; reason?: string } | null;
      if (!result?.deleted) {
        throw new Error(result?.reason ? translateUserError(result.reason) : 'ลบผู้ใช้ไม่สำเร็จ');
      }

      setNotice({
        tone: 'success',
        text: `ลบผู้ใช้ "${deleteTarget.displayName}" (${deleteTarget.email}) ถาวรเรียบร้อยแล้ว`,
      });
      setDeleteTarget(null);
      await loadUsers();
      onDataMutated?.();
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? translateUserError(err.message) : 'ลบผู้ใช้ไม่สำเร็จ' });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="nexus-card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <Users size={20} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-500">ผู้ใช้ทั้งหมด</p>
            <p className="text-2xl font-black text-slate-950">{stats.total}</p>
          </div>
        </div>
        <div className="nexus-card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-500">ใช้งานปกติ</p>
            <p className="text-2xl font-black text-emerald-700">{stats.active}</p>
          </div>
        </div>
        <div className="nexus-card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldAlert size={20} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-500">ถูกระงับ / รอยืนยัน</p>
            <p className="text-2xl font-black text-amber-800">
              {stats.suspended}
              {stats.unconfirmed > 0 ? <span className="ml-1.5 text-xs font-bold text-amber-600">(รอยืนยัน {stats.unconfirmed})</span> : null}
            </p>
          </div>
        </div>
        <div className="nexus-card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-800">
            <ShieldCheck size={20} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-500">ผู้ดูแลระบบ</p>
            <p className="text-2xl font-black text-cyan-800">{stats.activeAdmins}</p>
          </div>
        </div>
      </div>

      {/* Status Notice */}
      {notice ? (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 text-sm font-bold ${
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : notice.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-cyan-200 bg-cyan-50 text-cyan-900'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {needsMigrationNotice ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-black">เปิดใช้งานฟีเจอร์จัดการผู้ใช้แบบเต็มรูปแบบ (ลบผู้ใช้ / ตั้งรหัสผ่านให้ทันที / ยืนยันอีเมล)</p>
            <p className="mt-1">
              กรุณานำไฟล์ <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">supabase/migrations/0088_superadmin_user_management.sql</code> ไปรันใน Supabase SQL Editor (และ deploy Edge Function <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">superadmin-manage-users</code> หากต้องการสร้างผู้ใช้ใหม่/สร้างลิงก์คัดลอก)
            </p>
          </div>
        </div>
      ) : null}

      {/* Main Directory Card */}
      <section className="nexus-card p-4 sm:p-5">
        {/* Header + Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="nexus-kicker">
              <Users size={17} aria-hidden="true" />
              จัดการบัญชีผู้ใช้ทั้งหมด
            </div>
            <h2 className="mt-2 text-xl font-black text-slate-950">
              รายชื่อผู้ใช้ในระบบ ({filteredUsers.length} / {users.length} บัญชี)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              รีเฟรช
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateName('');
                setCreateEmail('');
                setCreatePhone('');
                setCreatePassword(generateStrongPassword());
                setCreateConfirmEmail(true);
                setCreatedCredentials(null);
                setIsCreateOpen(true);
              }}
              className="blue-action inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-black"
            >
              <UserPlus size={15} />
              สร้างผู้ใช้ใหม่
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร หรือชื่อโรงเรียน..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  ['all', 'ทุกสถานะ'],
                  ['active', 'ใช้งานปกติ'],
                  ['suspended', 'ถูกระงับ'],
                  ['unconfirmed', 'รอยืนยันเมล'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                    statusFilter === key ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  ['all', 'ทุกบทบาท'],
                  ['admins', 'ผู้ดูแลระบบ'],
                  ['regular', 'ผู้ใช้ทั่วไป'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRoleFilter(key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                    roleFilter === key ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* User List */}
        {isLoading ? (
          <div className="mt-6 py-12 text-center text-sm font-bold text-slate-500">กำลังโหลดรายชื่อผู้ใช้ในระบบ...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Users size={30} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-black text-slate-700">ไม่พบผู้ใช้ตามเงื่อนไขที่ค้นหา</p>
            <p className="mt-1 text-xs font-bold text-slate-500">ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองด้านบน</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">ผู้ใช้ / อีเมล</th>
                    <th className="px-4 py-3">บทบาท & โรงเรียนที่สังกัด</th>
                    <th className="px-4 py-3">สถานะบัญชี</th>
                    <th className="px-4 py-3">เข้าใช้งานล่าสุด</th>
                    <th className="px-4 py-3 text-right">จัดการบัญชี</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm">
                  {filteredUsers.map((user) => {
                    const isSelf = user.profileId === currentUserId;
                    const isSuspended =
                      user.accountStatus === 'suspended' || user.accountStatus === 'cancelled' || Boolean(user.bannedUntil);
                    const isUnconfirmed = user.emailConfirmedAt === null;
                    const initials = (user.displayName || user.email || '?').slice(0, 2).toUpperCase();

                    return (
                      <tr key={user.profileId} className={`transition hover:bg-slate-50/70 ${isSuspended ? 'bg-rose-50/20' : ''}`}>
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex items-start gap-3">
                            <span
                              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black ${
                                isSuspended
                                  ? 'bg-rose-100 text-rose-700'
                                  : user.isAdminActive
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {initials}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate font-black text-slate-950">{user.displayName}</p>
                                {isSelf ? (
                                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">คุณ</span>
                                ) : null}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <span className="truncate">{user.email}</span>
                                <button
                                  type="button"
                                  onClick={() => void copyText(user.email, `email-${user.profileId}`)}
                                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="คัดลอกอีเมล"
                                >
                                  {copiedId === `email-${user.profileId}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                </button>
                              </div>
                              {user.phone ? (
                                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                                  <Phone size={11} />
                                  {user.phone}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {user.isAdminActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-black text-cyan-800 ring-1 ring-cyan-200">
                                <Shield size={11} />
                                {user.adminLevel === 'superadmin' ? 'SuperAdmin' : 'Admin'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                                ผู้ใช้ทั่วไป
                              </span>
                            )}
                          </div>
                          {user.workspaces.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {user.workspaces.slice(0, 3).map((ws) => (
                                <span
                                  key={ws.workspace_id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                                >
                                  <Building2 size={10} className="text-slate-400" />
                                  {ws.school_name}
                                  <span className="text-slate-400">· {getWorkspaceRoleLabel(ws.role, ws.is_owner)}</span>
                                </span>
                              ))}
                              {user.workspaces.length > 3 ? (
                                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                  +{user.workspaces.length - 3} แห่ง
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-1 text-[11px] font-bold text-slate-400">ยังไม่มีโรงเรียน / Workspace</p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${
                                isSuspended
                                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              }`}
                            >
                              {isSuspended ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                              {isSuspended ? 'ถูกระงับ' : 'ใช้งานปกติ'}
                            </span>
                            {isUnconfirmed ? (
                              <button
                                type="button"
                                onClick={() => void handleConfirmEmail(user)}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                                title="คลิกเพื่อยืนยันอีเมลให้ผู้ใช้นี้ทันที"
                              >
                                <MailCheck size={11} />
                                รอยืนยันเมล (คลิกยืนยัน)
                              </button>
                            ) : user.emailConfirmedAt !== 'fallback-unknown' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                <MailCheck size={11} className="text-emerald-500" />
                                ยืนยันอีเมลแล้ว
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top text-xs font-bold text-slate-600">
                          <p>{formatThaiDateTime(user.lastSignInAt || user.lastLoginAt)}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">สมัคร: {formatThaiDateTime(user.createdAt)}</p>
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openResetModal(user)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900 transition hover:bg-amber-100"
                              title="รีเซ็ตรหัสผ่าน / ตั้งรหัสใหม่ให้ผู้ใช้"
                            >
                              <KeyRound size={14} />
                              รีเซ็ตรหัส
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                              title="แก้ไขข้อมูล ปรับสิทธิ์ หรือระงับบัญชี"
                            >
                              <Pencil size={14} />
                              จัดการ
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => openDeleteModal(user)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                              title={isSelf ? 'ไม่สามารถลบบัญชีตัวเองได้' : `ลบผู้ใช้ ${user.email} ถาวร`}
                              aria-label={`ลบผู้ใช้ ${user.email}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="mt-4 grid gap-3 lg:hidden">
              {filteredUsers.map((user) => {
                const isSelf = user.profileId === currentUserId;
                const isSuspended =
                  user.accountStatus === 'suspended' || user.accountStatus === 'cancelled' || Boolean(user.bannedUntil);
                const isUnconfirmed = user.emailConfirmedAt === null;

                return (
                  <article
                    key={user.profileId}
                    className={`rounded-2xl border p-4 ${isSuspended ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-base font-black text-slate-950">{user.displayName}</h3>
                          {isSelf ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">คุณ</span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs font-bold text-slate-600">{user.email}</p>
                        {user.phone ? <p className="mt-0.5 text-xs font-bold text-slate-500">โทร: {user.phone}</p> : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${
                          isSuspended
                            ? 'bg-rose-50 text-rose-700 ring-rose-200'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        }`}
                      >
                        {isSuspended ? 'ถูกระงับ' : 'ใช้งานปกติ'}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {user.isAdminActive ? (
                        <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-black text-cyan-800 ring-1 ring-cyan-200">
                          {user.adminLevel === 'superadmin' ? 'SuperAdmin' : 'Admin'}
                        </span>
                      ) : null}
                      {isUnconfirmed ? (
                        <button
                          type="button"
                          onClick={() => void handleConfirmEmail(user)}
                          className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-black text-amber-800 ring-1 ring-amber-200"
                        >
                          รอยืนยันเมล · กดยืนยัน
                        </button>
                      ) : null}
                      {user.workspaces.map((ws) => (
                        <span
                          key={ws.workspace_id}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                        >
                          {ws.school_name} ({getWorkspaceRoleLabel(ws.role, ws.is_owner)})
                        </span>
                      ))}
                    </div>

                    <p className="mt-2 text-[11px] font-bold text-slate-400">
                      เข้าใช้ล่าสุด: {formatThaiDateTime(user.lastSignInAt || user.lastLoginAt)}
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => openResetModal(user)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 text-xs font-black text-amber-900"
                      >
                        <KeyRound size={14} />
                        รีเซ็ตรหัส
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700"
                      >
                        <Pencil size={14} />
                        จัดการ
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => openDeleteModal(user)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        ลบ
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MODAL 1: Password Reset Modal (Direct / Email / Copy Recovery Link)   */}
      {/* ===================================================================== */}
      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-amber-50/70 p-5">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-black text-amber-800">
                  <KeyRound size={14} />
                  รีเซ็ตรหัสผ่านให้ผู้ใช้
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{resetTarget.displayName}</h3>
                <p className="text-xs font-bold text-slate-600">{resetTarget.email}</p>
              </div>
              <button type="button" onClick={() => setResetTarget(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white">
                <X size={18} />
              </button>
            </header>

            <div className="p-5 space-y-4">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {(
                  [
                    ['direct', 'ตั้งรหัสใหม่ทันที (แนะนำ)'],
                    ['email', 'ส่งลิงก์ทางอีเมล'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setResetMode(mode);
                      setResetSuccessText(null);
                    }}
                    className={`rounded-xl px-2 py-2 text-xs font-black transition ${
                      resetMode === mode ? 'bg-slate-950 text-white shadow-xs' : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {resetMode === 'direct' ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold leading-5 text-slate-600">
                    ตั้งรหัสผ่านใหม่ให้บัญชีนี้ทันทีโดยไม่ต้องรอรับอีเมล ระบบจะยืนยันอีเมลให้พร้อมออกจากระบบเครื่องเก่าทั้งหมดอัตโนมัติ
                  </p>
                  <label className="grid gap-1.5 text-xs font-black text-slate-700">
                    รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-10 font-mono text-sm font-bold text-slate-950 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                          placeholder="กรอกรหัสผ่านใหม่..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                          aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewPassword(generateStrongPassword())}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 hover:bg-slate-100"
                      >
                        <Shuffle size={14} />
                        สุ่มรหัส
                      </button>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-bold leading-5 text-slate-600">
                  <div className="flex items-center gap-2 font-black text-slate-900">
                    <Mail size={15} />
                    ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่
                  </div>
                  <p className="mt-1">
                    ระบบจะส่งอีเมลรีเซ็ตรหัสผ่านจาก Supabase Auth ไปยัง <strong>{resetTarget.email}</strong> (อาจมีข้อจำกัดจำนวนครั้งต่อชั่วโมงตามโควต้าอีเมล)
                  </p>
                </div>
              )}

              {resetSuccessText ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <p className="text-xs font-black text-emerald-900">ดำเนินการสำเร็จ!</p>
                  <pre className="mt-1.5 whitespace-pre-wrap break-all rounded-xl bg-white p-2.5 font-mono text-xs font-bold text-slate-800 border border-emerald-100">
                    {resetSuccessText}
                  </pre>
                  <button
                    type="button"
                    onClick={() => void copyText(resetSuccessText, 'reset-result')}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white hover:bg-emerald-800"
                  >
                    {copiedId === 'reset-result' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedId === 'reset-result' ? 'คัดลอกแล้ว' : 'คัดลอกส่งให้ผู้ใช้'}
                  </button>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => void handleExecutePasswordReset()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <KeyRound size={15} />
                  {isResetting
                    ? 'กำลังดำเนินการ...'
                    : resetMode === 'direct'
                      ? 'ยืนยันตั้งรหัสใหม่ทันที'
                      : 'ส่งอีเมลรีเซ็ต'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* MODAL 2: Edit User Profile, Role, Status & Workspaces                 */}
      {/* ===================================================================== */}
      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 p-5">
              <div>
                <p className="text-xs font-black text-cyan-800">จัดการรายละเอียดและสิทธิ์ผู้ใช้</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{editTarget.displayName}</h3>
                <p className="text-xs font-bold text-slate-500">{editTarget.email}</p>
              </div>
              <button type="button" onClick={() => setEditTarget(null)} className="rounded-xl p-2 text-slate-500 hover:bg-white">
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* Profile Info */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-700 sm:col-span-2">
                  ชื่อ-นามสกุลที่แสดง
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  อีเมลบัญชี
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  เบอร์โทรศัพท์
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              {/* System Role */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="grid gap-2 text-xs font-black text-slate-800">
                  <span>ระดับสิทธิ์ในระบบกลาง</span>
                  <select
                    disabled={editTarget.profileId === currentUserId}
                    value={editRoleSelection}
                    onChange={(e) => setEditRoleSelection(e.target.value as 'regular' | 'admin' | 'superadmin')}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 disabled:opacity-60"
                  >
                    <option value="regular">ผู้ใช้ทั่วไป (ครู / สมาชิกโรงเรียน)</option>
                    <option value="admin">Admin (ผู้ช่วยดูแลระบบ · VIP ตลอดชีพ)</option>
                    <option value="superadmin">SuperAdmin (สิทธิ์สูงสุดทั้งระบบ · VIP ตลอดชีพ)</option>
                  </select>
                </label>
                {editTarget.profileId === currentUserId ? (
                  <p className="mt-1.5 text-[11px] font-bold text-slate-500">ไม่สามารถลดระดับสิทธิ์ของบัญชีตัวเองได้</p>
                ) : null}
              </div>

              {/* Quick Security Actions */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <p className="text-xs font-black text-slate-800">สถานะบัญชีและความปลอดภัย</p>
                <div className="flex flex-wrap gap-2">
                  {editTarget.emailConfirmedAt === null ? (
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={() => void handleConfirmEmail(editTarget)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-900 hover:bg-amber-100"
                    >
                      <MailCheck size={14} />
                      ยืนยันอีเมลให้ทันที
                    </button>
                  ) : null}

                  {editTarget.profileId !== currentUserId ? (
                    editTarget.accountStatus === 'suspended' || editTarget.accountStatus === 'cancelled' || Boolean(editTarget.bannedUntil) ? (
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => void handleToggleUserStatus(editTarget, 'active')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 hover:bg-emerald-100"
                      >
                        <CheckCircle2 size={14} />
                        ปลดระงับ / คืนสถานะบัญชี
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => void handleToggleUserStatus(editTarget, 'suspended')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 hover:bg-rose-100"
                      >
                        <XCircle size={14} />
                        ระงับบัญชีและบังคับออกจากระบบ
                      </button>
                    )
                  ) : null}
                </div>
              </div>

              {/* Workspace Memberships */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black text-slate-800">โรงเรียน / Workspace ที่สังกัด ({editTarget.workspaces.length})</p>
                {editTarget.workspaces.length === 0 ? (
                  <p className="mt-2 text-xs font-bold text-slate-400">ผู้ใช้นี้ยังไม่ได้สังกัดโรงเรียนใด</p>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    {editTarget.workspaces.map((ws) => (
                      <div
                        key={ws.workspace_id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-900">{ws.school_name}</p>
                          <p className="text-[11px] font-bold text-slate-500">
                            {ws.workspace_name} · บทบาท: {getWorkspaceRoleLabel(ws.role, ws.is_owner)}
                          </p>
                        </div>
                        {!ws.is_owner ? (
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={() => void handleRemoveFromWorkspace(editTarget, ws)}
                            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-black text-rose-700 hover:bg-rose-50"
                          >
                            <UserMinus size={12} />
                            นำออก
                          </button>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            เจ้าของหลัก
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 p-4">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => void handleSaveUserEdit()}
                className="blue-action h-10 rounded-xl px-5 text-sm font-black disabled:opacity-50"
              >
                {isSavingEdit ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* MODAL 3: Create New User Modal                                        */}
      {/* ===================================================================== */}
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-cyan-50/70 p-5">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-black text-cyan-800">
                  <UserPlus size={14} />
                  สร้างบัญชีผู้ใช้ใหม่
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950">เพิ่มผู้ใช้เข้าสู่ระบบ ClassCare 360</h3>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white">
                <X size={18} />
              </button>
            </header>

            <div className="p-5 space-y-3.5">
              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                ชื่อ-นามสกุล *
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="เช่น ครูสมศรี ใจดี"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  อีเมลสำหรับเข้าสู่ระบบ *
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="teacher@school.ac.th"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-black text-slate-700">
                  เบอร์โทรศัพท์ (ไม่บังคับ)
                  <input
                    type="tel"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัวอักษร) *
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm font-bold text-slate-950 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => setCreatePassword(generateStrongPassword())}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 hover:bg-slate-100"
                  >
                    <Shuffle size={14} />
                    สุ่มใหม่
                  </button>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={createConfirmEmail}
                  onChange={(e) => setCreateConfirmEmail(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-600"
                />
                ยืนยันอีเมลให้อัตโนมัติ (ผู้ใช้ล็อกอินได้ทันทีโดยไม่ต้องกดยืนยันในอีเมล)
              </label>

              {createdCredentials ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                  <p className="text-xs font-black text-emerald-900">สร้างบัญชีเรียบร้อยแล้ว! คัดลอกข้อมูลด้านล่างส่งให้ผู้ใช้ได้เลย:</p>
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-emerald-100 bg-white p-2.5 font-mono text-xs font-bold text-slate-800">
                    {createdCredentials}
                  </pre>
                  <button
                    type="button"
                    onClick={() => void copyText(createdCredentials, 'created-creds')}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white hover:bg-emerald-800"
                  >
                    {copiedId === 'created-creds' ? <Check size={14} /> : <Copy size={14} />}
                    {copiedId === 'created-creds' ? 'คัดลอกแล้ว' : 'คัดลอกข้อมูลล็อกอิน'}
                  </button>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  ปิด
                </button>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => void handleCreateUser()}
                  className="blue-action inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-sm font-black disabled:opacity-50"
                >
                  <UserPlus size={15} />
                  {isCreating ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชีผู้ใช้'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===================================================================== */}
      {/* MODAL 4: Safe Permanent Delete User Modal                             */}
      {/* ===================================================================== */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-2xl" role="dialog" aria-modal="true">
            <header className="flex items-start justify-between gap-3 border-b border-rose-100 bg-rose-50 p-5">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700">
                  <AlertTriangle size={14} />
                  ลบผู้ใช้ถาวร (ไม่สามารถกู้คืนได้)
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{deleteTarget.displayName}</h3>
                <p className="text-xs font-bold text-rose-800">{deleteTarget.email}</p>
              </div>
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl p-2 text-rose-500 hover:bg-white">
                <X size={18} />
              </button>
            </header>

            <div className="p-5 space-y-4">
              <p className="text-xs font-bold leading-5 text-slate-600">
                การลบจะลบบัญชีนี้ออกจากระบบยืนยันตัวตน (Auth), โปรไฟล์ และสิทธิ์การเข้าถึงทั้งหมดอย่างถาวร
              </p>

              {deleteTarget.ownedWorkspaceCount > 0 ? (
                <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                  <p className="text-xs font-black text-amber-950">
                    ผู้ใช้นี้เป็นเจ้าของโรงเรียน / Workspace จำนวน {deleteTarget.ownedWorkspaceCount} แห่ง:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {deleteTarget.workspaces
                      .filter((w) => w.is_owner)
                      .map((w) => (
                        <span key={w.workspace_id} className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-black text-amber-900 border border-amber-200">
                          {w.school_name}
                        </span>
                      ))}
                  </div>
                  <div className="mt-2 space-y-2 pt-1">
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-white p-2.5 text-xs font-bold text-slate-800">
                      <input
                        type="radio"
                        name="delete-ws-strategy"
                        checked={deleteStrategy === 'transfer'}
                        onChange={() => setDeleteStrategy('transfer')}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <span>
                        <strong className="block text-emerald-800">โอนสิทธิ์เจ้าของโรงเรียนมาที่ฉัน (แนะนำ)</strong>
                        ข้อมูลนักเรียน เช็คชื่อ คะแนน และเงินออมจะยังคงอยู่ครบ ไม่สูญหาย
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 text-xs font-bold text-rose-900">
                      <input
                        type="radio"
                        name="delete-ws-strategy"
                        checked={deleteStrategy === 'delete'}
                        onChange={() => setDeleteStrategy('delete')}
                        className="mt-0.5 accent-rose-600"
                      />
                      <span>
                        <strong className="block text-rose-700">ลบโรงเรียนและข้อมูลทั้งหมดของผู้ใช้นี้ทิ้งด้วย</strong>
                        ข้อมูลนักเรียนและประวัติทั้งหมดในโรงเรียนที่ผู้ใช้นี้เป็นเจ้าของจะถูกลบถาวร
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              <label className="grid gap-1.5 text-xs font-black text-slate-700">
                พิมพ์อีเมล <span className="font-mono text-rose-700">{deleteTarget.email}</span> เพื่อยืนยันการลบถาวร
                <input
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  placeholder={deleteTarget.email}
                  className="h-11 rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={
                    isDeleting || deleteConfirmEmail.trim().toLowerCase() !== deleteTarget.email.trim().toLowerCase()
                  }
                  onClick={() => void handleDeleteUserPermanently()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-5 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={15} />
                  {isDeleting ? 'กำลังลบผู้ใช้...' : 'ยืนยันลบผู้ใช้ถาวร'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
