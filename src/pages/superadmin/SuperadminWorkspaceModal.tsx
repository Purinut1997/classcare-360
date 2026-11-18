import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Crown,
  Download,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export interface WorkspaceModalTarget {
  id: string;
  name: string;
  schoolName: string;
  academicYear: string;
  ownerName: string;
  ownerEmail: string;
  ownerProfileId?: string;
  settings?: Record<string, unknown>;
  vipStatus?: string | null;
  vipEndsAt?: string | null;
}

interface WorkspaceMemberRow {
  profile_id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  is_owner: boolean;
  joined_at: string | null;
}

interface DirectoryUserOption {
  profile_id: string;
  email: string;
  display_name: string;
  workspace_count: number;
}

interface SuperadminWorkspaceModalProps {
  workspace: WorkspaceModalTarget | null;
  onClose: () => void;
  onUpdated: () => void;
}

const FEATURE_FLAG_DEFINITIONS = [
  { key: 'ai_vision', label: 'AI Vision / ตรวจเอกสารอัจฉริยะ', desc: 'สแกน OCR เช็คชื่อและช่วยวิเคราะห์ด้วย AI' },
  { key: 'omr', label: 'ตรวจข้อสอบ OMR', desc: 'กระดาษคำตอบและสแกนตรวจข้อสอบอัตโนมัติ' },
  { key: 'telegram', label: 'แจ้งเตือนผ่าน Telegram', desc: 'เชื่อมต่อบอทส่งแจ้งเตือนรายวันให้ครู/ผู้ปกครอง' },
  { key: 'parent_portal', label: 'พอร์ทัลผู้ปกครอง (Parent Portal)', desc: 'ลิงก์ตรวจเวลาเรียน คะแนน และเงินออมสำหรับผู้ปกครอง' },
  { key: 'savings_reports', label: 'สมุดเงินออม & รายงาน A4', desc: 'ระบบออมเงินนักเรียน รายงานรายเดือน/รายปี' },
] as const;

function getRoleLabel(role: string, isOwner: boolean) {
  if (isOwner || role === 'teacher_owner') return 'เจ้าของโรงเรียน';
  if (role === 'teacher_member') return 'ครูร่วมสอน';
  if (role === 'viewer') return 'ผู้ดูข้อมูล';
  if (role === 'parent') return 'ผู้ปกครอง';
  if (role === 'student') return 'นักเรียน';
  return role;
}

export function SuperadminWorkspaceModal({ workspace, onClose, onUpdated }: SuperadminWorkspaceModalProps) {
  const [tab, setTab] = useState<'info' | 'members' | 'backup'>('info');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Tab 1: Edit info & feature flags
  const [schoolName, setSchoolName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    ai_vision: true,
    omr: true,
    telegram: true,
    parent_portal: true,
    savings_reports: true,
  });
  const [vipDaysToAdd, setVipDaysToAdd] = useState(365);

  // Tab 2: Members & Ownership
  const [members, setMembers] = useState<WorkspaceMemberRow[]>([]);
  const [allUsers, setAllUsers] = useState<DirectoryUserOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addUserRole, setAddUserRole] = useState<'teacher_member' | 'viewer' | 'teacher_owner'>('teacher_member');
  const [transferOwnerId, setTransferOwnerId] = useState('');

  // Tab 3: Backup
  const [exportingBackup, setExportingBackup] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setTab('info');
    setNotice(null);
    setSchoolName(workspace.schoolName || '');
    setWorkspaceName(workspace.name || '');
    setAcademicYear(workspace.academicYear || '2569');
    const existingFlags = (workspace.settings?.feature_flags as Record<string, boolean> | undefined) || {};
    setFeatureFlags({
      ai_vision: existingFlags.ai_vision !== false,
      omr: existingFlags.omr !== false,
      telegram: existingFlags.telegram !== false,
      parent_portal: existingFlags.parent_portal !== false,
      savings_reports: existingFlags.savings_reports !== false,
    });
    setAddUserId('');
    setTransferOwnerId('');
  }, [workspace]);

  const loadMembersAndUsers = useCallback(async () => {
    if (!supabase || !workspace) return;
    setLoadingMembers(true);
    const [membersRes, usersRes] = await Promise.all([
      supabase.rpc('superadmin_list_workspace_members', { target_workspace_id: workspace.id }),
      supabase.rpc('superadmin_list_users_directory', { search_text: null }),
    ]);

    if (!membersRes.error && Array.isArray(membersRes.data)) {
      setMembers(membersRes.data as WorkspaceMemberRow[]);
    }
    if (!usersRes.error && Array.isArray(usersRes.data)) {
      setAllUsers(
        (usersRes.data as Array<Record<string, unknown>>).map((u) => ({
          profile_id: String(u.profile_id),
          email: String(u.email || ''),
          display_name: String(u.display_name || u.email || ''),
          workspace_count: Number(u.workspace_count || 0),
        })),
      );
    }
    setLoadingMembers(false);
  }, [workspace]);

  useEffect(() => {
    if (workspace && tab === 'members') {
      void loadMembersAndUsers();
    }
  }, [workspace, tab, loadMembersAndUsers]);

  const availableUsersToAdd = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.profile_id));
    // Sort orphan users (workspace_count === 0) to the very top so SuperAdmin can assign them easily!
    return allUsers
      .filter((u) => !memberIds.has(u.profile_id))
      .sort((a, b) => a.workspace_count - b.workspace_count || a.display_name.localeCompare(b.display_name, 'th'));
  }, [allUsers, members]);

  if (!workspace) return null;

  async function handleSaveInfo() {
    if (!supabase || !workspace) return;
    if (!workspaceName.trim()) {
      setNotice({ tone: 'error', text: 'กรุณากรอกชื่อ Workspace' });
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('superadmin_update_workspace', {
      target_workspace_id: workspace.id,
      next_name: workspaceName.trim(),
      next_school_name: schoolName.trim() || workspaceName.trim(),
      next_academic_year: academicYear.trim() || null,
      next_feature_flags: featureFlags,
    });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
    } else {
      setNotice({ tone: 'success', text: 'บันทึกข้อมูลโรงเรียนและการตั้งค่าฟีเจอร์เรียบร้อยแล้ว' });
      onUpdated();
    }
  }

  async function handleGrantVipDays() {
    if (!supabase || !workspace) return;
    if (!window.confirm(`เพิ่มสิทธิ์ VIP ${vipDaysToAdd} วัน ให้ "${workspace.schoolName}" หรือไม่?`)) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('grant_workspace_vip', {
      target_workspace_id: workspace.id,
      days_to_add: vipDaysToAdd,
      grant_reason: `SuperAdmin เพิ่ม VIP ${vipDaysToAdd} วัน`,
    });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
    } else {
      setNotice({ tone: 'success', text: `เพิ่มสิทธิ์ VIP ${vipDaysToAdd} วัน สำเร็จแล้ว` });
      onUpdated();
    }
  }

  async function handleRevokeVip() {
    if (!supabase || !workspace) return;
    const reason = window.prompt(`ระบุเหตุผลในการถอดสิทธิ์ VIP ของ "${workspace.schoolName}" (ไม่บังคับ):`, 'สิ้นสุดสิทธิ์ทดสอบ');
    if (reason === null) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('superadmin_revoke_workspace_vip', {
      target_workspace_id: workspace.id,
      revoke_reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
    } else {
      setNotice({ tone: 'success', text: 'ถอดสิทธิ์ VIP ของโรงเรียนนี้เรียบร้อยแล้ว' });
      onUpdated();
    }
  }

  async function handleAddMember() {
    if (!supabase || !workspace || !addUserId) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('superadmin_add_workspace_member', {
      target_workspace_id: workspace.id,
      target_profile_id: addUserId,
      next_role: addUserRole,
    });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
    } else {
      setNotice({ tone: 'success', text: 'เพิ่มผู้ใช้เข้าโรงเรียนเรียบร้อยแล้ว' });
      setAddUserId('');
      await loadMembersAndUsers();
      onUpdated();
    }
  }

  async function handleRemoveMember(member: WorkspaceMemberRow) {
    if (!supabase || !workspace) return;
    if (member.is_owner) {
      setNotice({ tone: 'error', text: 'ไม่สามารถลบเจ้าของหลักออกได้ กรุณาโอนสิทธิ์เจ้าของให้คนอื่นก่อน' });
      return;
    }
    if (!window.confirm(`นำ ${member.display_name} (${member.email}) ออกจาก "${workspace.schoolName}" หรือไม่?`)) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('superadmin_remove_user_from_workspace', {
      target_profile_id: member.profile_id,
      target_workspace_id: workspace.id,
    });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
    } else {
      setNotice({ tone: 'success', text: `นำ ${member.display_name} ออกจากโรงเรียนแล้ว` });
      await loadMembersAndUsers();
      onUpdated();
    }
  }

  async function handleTransferOwner() {
    if (!supabase || !workspace || !transferOwnerId) return;
    const targetUser = allUsers.find((u) => u.profile_id === transferOwnerId);
    if (
      !window.confirm(
        `ยืนยันโอนสิทธิ์ "เจ้าของหลัก" ของ "${workspace.schoolName}" ให้กับ ${targetUser?.display_name || ''} (${targetUser?.email || ''}) หรือไม่?\n\nเจ้าของเดิมจะถูกปรับเป็นครูร่วมสอนแทนเพื่อไม่ให้ข้อมูลสะดุด`,
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('superadmin_transfer_workspace_owner', {
      target_workspace_id: workspace.id,
      next_owner_profile_id: transferOwnerId,
    });
    setBusy(false);
    if (error) {
      setNotice({ tone: 'error', text: error.message });
    } else {
      setNotice({ tone: 'success', text: `โอนสิทธิ์เจ้าของให้ ${targetUser?.display_name || 'ผู้ใช้ใหม่'} เรียบร้อยแล้ว` });
      setTransferOwnerId('');
      await loadMembersAndUsers();
      onUpdated();
    }
  }

  async function handleExportSnapshot() {
    if (!supabase || !workspace) return;
    setExportingBackup(true);
    setNotice(null);
    const { data, error } = await supabase.rpc('superadmin_export_workspace_snapshot', {
      target_workspace_id: workspace.id,
    });
    setExportingBackup(false);
    if (error) {
      setNotice({ tone: 'error', text: `ส่งออกสำรองข้อมูลไม่สำเร็จ: ${error.message}` });
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = workspace.schoolName.replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_').slice(0, 40);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${safeName}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice({ tone: 'success', text: `ดาวน์โหลดไฟล์สำรองข้อมูลของ "${workspace.schoolName}" เรียบร้อยแล้ว` });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-700">
              <Building2 size={14} /> จัดการโรงเรียน / Workspace
            </p>
            <h3 className="mt-0.5 truncate text-xl font-black text-slate-950">{workspace.schoolName}</h3>
            <p className="text-xs font-bold text-slate-500">
              {workspace.name} · เจ้าของปัจจุบัน: {workspace.ownerName} ({workspace.ownerEmail})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Bar */}
        <div className="flex gap-1.5 border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          {[
            { id: 'info', label: 'ข้อมูล, ฟีเจอร์ & VIP', icon: Settings2 },
            { id: 'members', label: 'สมาชิก & โอนเจ้าของ', icon: Users },
            { id: 'backup', label: 'สำรองข้อมูลทันที', icon: Download },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id as 'info' | 'members' | 'backup');
                  setNotice(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition ${
                  tab === t.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {notice ? (
            <div
              className={`flex items-center gap-2 rounded-2xl border p-3 text-xs font-black ${
                notice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {notice.tone === 'error' ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
              <span>{notice.text}</span>
            </div>
          ) : null}

          {tab === 'info' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-black text-slate-700">
                  ชื่อโรงเรียน
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="nexus-field mt-1 h-10 w-full px-3 text-sm font-bold"
                  />
                </label>
                <label className="block text-xs font-black text-slate-700">
                  ชื่อ Workspace
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="nexus-field mt-1 h-10 w-full px-3 text-sm font-bold"
                  />
                </label>
                <label className="block text-xs font-black text-slate-700">
                  ปีการศึกษา
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2569"
                    className="nexus-field mt-1 h-10 w-full px-3 text-sm font-bold"
                  />
                </label>
              </div>

              {/* Feature Flags */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-black text-slate-800">ควบคุมฟีเจอร์สำหรับโรงเรียนนี้ (Feature Flags)</p>
                <div className="mt-3 space-y-2.5">
                  {FEATURE_FLAG_DEFINITIONS.map((flag) => (
                    <label
                      key={flag.key}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-black text-slate-900">{flag.label}</p>
                        <p className="text-[11px] font-semibold text-slate-500">{flag.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={featureFlags[flag.key] !== false}
                        onChange={(e) => setFeatureFlags((prev) => ({ ...prev, [flag.key]: e.target.checked }))}
                        className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSaveInfo()}
                  className="blue-action inline-flex h-11 items-center gap-2 rounded-xl px-5 text-xs font-black shadow-sm disabled:opacity-50"
                >
                  <Save size={15} /> {busy ? 'กำลังบันทึก...' : 'บันทึกข้อมูลและฟีเจอร์'}
                </button>
              </div>

              {/* Quick VIP Control */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Crown size={16} className="text-amber-700" />
                    <p className="text-xs font-black text-amber-950">จัดการสิทธิ์แพ็กเกจ VIP</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
                    สถานะ: {workspace.vipStatus || 'ยังไม่ระบุ'}
                    {workspace.vipEndsAt
                      ? ` · ถึง ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(workspace.vipEndsAt))}`
                      : ''}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={vipDaysToAdd}
                    onChange={(e) => setVipDaysToAdd(Number(e.target.value) || 30)}
                    className="h-9 w-24 rounded-xl border border-amber-200 bg-white px-2.5 text-center text-xs font-black"
                  />
                  <span className="text-xs font-bold text-amber-900">วัน</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleGrantVipDays()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 text-xs font-black text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <Crown size={13} /> เพิ่มวัน VIP
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRevokeVip()}
                    className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    ถอดสิทธิ์ VIP
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {tab === 'members' ? (
            <>
              {/* Add user to workspace */}
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-black text-cyan-950">
                  <UserPlus size={15} /> เพิ่มผู้ใช้เข้าโรงเรียนนี้ (ช่วยผูกบัญชีที่ยังไม่มีโรงเรียนได้ทันที)
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"
                  >
                    <option value="">-- เลือกผู้ใช้ที่ต้องการเพิ่ม --</option>
                    {availableUsersToAdd.map((u) => (
                      <option key={u.profile_id} value={u.profile_id}>
                        {u.workspace_count === 0 ? '[ยังไม่มีโรงเรียน] ' : ''}
                        {u.display_name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <select
                    value={addUserRole}
                    onChange={(e) => setAddUserRole(e.target.value as 'teacher_member' | 'viewer' | 'teacher_owner')}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold"
                  >
                    <option value="teacher_member">ครูร่วมสอน</option>
                    <option value="viewer">ผู้ดูข้อมูล</option>
                    <option value="teacher_owner">เจ้าของร่วม</option>
                  </select>
                  <button
                    type="button"
                    disabled={busy || !addUserId}
                    onClick={() => void handleAddMember()}
                    className="blue-action inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black disabled:opacity-40"
                  >
                    <UserPlus size={14} /> เพิ่มเข้าโรงเรียน
                  </button>
                </div>
              </div>

              {/* Current Members list */}
              <div className="rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <span className="text-xs font-black text-slate-700">สมาชิกปัจจุบัน ({members.length} คน)</span>
                  <button
                    type="button"
                    onClick={() => void loadMembersAndUsers()}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-slate-800"
                  >
                    <RefreshCw size={12} className={loadingMembers ? 'animate-spin' : ''} /> รีเฟรช
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {loadingMembers ? (
                    <p className="p-4 text-center text-xs font-bold text-slate-400">กำลังโหลดรายชื่อสมาชิก...</p>
                  ) : members.length === 0 ? (
                    <p className="p-4 text-center text-xs font-bold text-slate-400">ยังไม่มีข้อมูลสมาชิก</p>
                  ) : (
                    members.map((m) => (
                      <div key={m.profile_id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">
                            {m.display_name}{' '}
                            {m.is_owner ? (
                              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                                เจ้าของหลัก
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] font-semibold text-slate-500">
                            {m.email} · {getRoleLabel(m.role, m.is_owner)}
                          </p>
                        </div>
                        {!m.is_owner ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRemoveMember(m)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 size={12} /> นำออก
                          </button>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Transfer Ownership */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                  <ArrowRightLeft size={15} /> โอนสิทธิ์เจ้าของโรงเรียน (Transfer Ownership)
                </p>
                <p className="mt-1 text-[11px] font-semibold text-amber-900">
                  ใช้เมื่อครูประจำชั้นย้ายโรงเรียนหรือต้องการเปลี่ยนผู้ดูแลหลัก — เจ้าของเดิมจะยังคงเข้าดูได้ในฐานะครูร่วมสอน
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={transferOwnerId}
                    onChange={(e) => setTransferOwnerId(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-amber-200 bg-white px-3 text-xs font-bold"
                  >
                    <option value="">-- เลือกเจ้าของใหม่ --</option>
                    {allUsers
                      .filter((u) => u.profile_id !== workspace.ownerProfileId)
                      .map((u) => (
                        <option key={u.profile_id} value={u.profile_id}>
                          {u.display_name} ({u.email})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !transferOwnerId}
                    onClick={() => void handleTransferOwner()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-4 text-xs font-black text-white hover:bg-amber-800 disabled:opacity-40"
                  >
                    <ArrowRightLeft size={14} /> โอนเจ้าของ
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {tab === 'backup' ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
              <h4 className="text-base font-black text-slate-950">ส่งออกไฟล์สำรองข้อมูลของโรงเรียนนี้ (JSON Snapshot)</h4>
              <p className="mt-1.5 text-xs font-semibold leading-6 text-slate-600">
                ดึงข้อมูลจริงจากฐานข้อมูลโดยตรง ได้แก่ ข้อมูลโรงเรียน, สมาชิก, แพ็กเกจ, ห้องเรียน, รายชื่อนักเรียน, บัญชีเงินออม และรายการฝาก-ถอนทั้งหมดของ{' '}
                <strong>{workspace.schoolName}</strong> ออกมาเก็บเป็นไฟล์ JSON ไว้บนเครื่องทันที (ไม่ต้องรอ R2 Edge Function)
              </p>
              <button
                type="button"
                disabled={exportingBackup}
                onClick={() => void handleExportSnapshot()}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-sky-700 px-5 text-xs font-black text-white shadow-sm hover:bg-sky-800 disabled:opacity-50"
              >
                {exportingBackup ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                <span>{exportingBackup ? 'กำลังส่งออกข้อมูล...' : 'ดาวน์โหลดไฟล์สำรองข้อมูล (.json)'}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
