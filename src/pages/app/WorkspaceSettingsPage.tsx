import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Plus, Save, School, ShieldCheck, UserPlus, Users } from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { roleLabels } from '../../lib/roles';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext, WorkspaceRole } from '../../types/core';

interface WorkspaceSettingsPageProps {
  session: AppSessionContext;
}

interface ClassroomRow {
  academic_year: string | null;
  grade_level: string | null;
  id: string;
  name: string;
  status: 'active' | 'archived';
}

type ManageableMemberRole = Extract<WorkspaceRole, 'teacher_member' | 'viewer'>;
type MemberStatus = 'invited' | 'active' | 'suspended' | 'removed';

interface WorkspaceMemberRow {
  created_at: string;
  display_name: string;
  email: string;
  joined_at: string | null;
  profile_id: string;
  role: Exclude<WorkspaceRole, 'superadmin'>;
  status: MemberStatus;
}

const demoClassrooms: ClassroomRow[] = [
  { academic_year: '2569', grade_level: 'ป.5', id: 'demo-classroom', name: 'ป.5/2', status: 'active' },
];

const demoMembers: WorkspaceMemberRow[] = [
  {
    created_at: new Date().toISOString(),
    display_name: 'ครูประจำชั้น',
    email: 'teacher@classcare.local',
    joined_at: new Date().toISOString(),
    profile_id: 'demo-teacher',
    role: 'teacher_owner',
    status: 'active',
  },
];

const memberStatusLabels: Record<MemberStatus, string> = {
  active: 'ใช้งานอยู่',
  invited: 'รออนุมัติ',
  removed: 'ถอดออก',
  suspended: 'พักสิทธิ์',
};

const memberRoleOptions: Array<{ label: string; value: ManageableMemberRole }> = [
  { label: 'ครูร่วม', value: 'teacher_member' },
  { label: 'ผู้ดูรายงาน', value: 'viewer' },
];

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function WorkspaceSettingsPage({ session }: WorkspaceSettingsPageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>(demoMembers);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMemberSubmitting, setIsMemberSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกข้อมูลโรงเรียนลง Supabase จริง',
  );
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<ManageableMemberRole>('teacher_member');
  const [workspaceForm, setWorkspaceForm] = useState({
    academicYear: session.workspace?.academicYear || '2569',
    classroomName: session.workspace?.classroomName || 'ป.5/2',
    name: session.workspace?.name || 'ห้องเรียนของฉัน',
    schoolName: session.workspace?.schoolName || 'โรงเรียนตัวอย่าง ClassCare',
  });
  const [classroomForm, setClassroomForm] = useState({
    academicYear: session.workspace?.academicYear || '2569',
    gradeLevel: 'ป.5',
    name: session.workspace?.classroomName || 'ป.5/2',
  });

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setMembers(demoMembers);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: workspaceRow, error: workspaceError },
        { data: classroomRows, error: classroomError },
        { data: memberRows, error: memberError },
      ] = await Promise.all([
        supabase
          .from('workspaces')
          .select('id,name,school_name,academic_year,settings')
          .eq('id', session.workspace.id)
          .single(),
        supabase
          .from('classrooms')
          .select('id,name,grade_level,academic_year,status')
          .eq('workspace_id', session.workspace.id)
          .order('status', { ascending: true })
          .order('name', { ascending: true }),
        supabase.rpc('get_workspace_members', {
          target_workspace_id: session.workspace.id,
        }),
      ]);

      if (!isMounted) return;

      if (workspaceError || classroomError) {
        setNotice(workspaceError?.message || classroomError?.message || 'โหลดข้อมูลตั้งค่าโรงเรียนไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      if (memberError) {
        setMemberNotice(`ยังโหลดสมาชิกไม่ได้: ${memberError.message} | โปรดรัน tmp/supabase-workspace-member-admin.sql`);
        setMembers([]);
      } else {
        setMemberNotice(null);
        setMembers((memberRows || []) as WorkspaceMemberRow[]);
      }

      const settings = (workspaceRow?.settings || {}) as { classroom_name?: string };
      setWorkspaceForm({
        academicYear: workspaceRow?.academic_year || session.workspace.academicYear,
        classroomName: settings.classroom_name || session.workspace.classroomName,
        name: workspaceRow?.name || session.workspace.name,
        schoolName: workspaceRow?.school_name || session.workspace.schoolName,
      });
      setClassroomForm((current) => ({
        ...current,
        academicYear: workspaceRow?.academic_year || session.workspace?.academicYear || current.academicYear,
        name: settings.classroom_name || session.workspace?.classroomName || current.name,
      }));
      setClassrooms((classroomRows || []) as ClassroomRow[]);
      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  const activeClassrooms = useMemo(
    () => classrooms.filter((classroom) => classroom.status === 'active'),
    [classrooms],
  );
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );
  const pendingMembers = useMemo(
    () => members.filter((member) => member.status === 'invited'),
    [members],
  );
  const visibleMembers = useMemo(
    () => members.filter((member) => member.status !== 'invited'),
    [members],
  );

  async function saveWorkspaceSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const nextWorkspace = {
      academicYear: workspaceForm.academicYear.trim(),
      classroomName: workspaceForm.classroomName.trim(),
      name: workspaceForm.name.trim(),
      schoolName: workspaceForm.schoolName.trim(),
    };

    if (!nextWorkspace.name || !nextWorkspace.schoolName || !nextWorkspace.academicYear) {
      setNotice('กรุณากรอกชื่อ workspace โรงเรียน และปีการศึกษา');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      setWorkspaceForm(nextWorkspace);
      setNotice('บันทึกตั้งค่าโรงเรียนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('workspaces')
      .update({
        academic_year: nextWorkspace.academicYear,
        name: nextWorkspace.name,
        school_name: nextWorkspace.schoolName,
        settings: {
          classroom_name: nextWorkspace.classroomName,
        },
      })
      .eq('id', session.workspace.id);

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    await writeAuditLog(session, {
      action: 'workspace_settings.updated',
      entityId: session.workspace.id,
      entityTable: 'workspaces',
      metadata: {
        academic_year: nextWorkspace.academicYear,
        classroom_name: nextWorkspace.classroomName,
        school_name: nextWorkspace.schoolName,
      },
      riskLevel: 'low',
      source: 'workspace_settings',
    });
    setNotice('บันทึกตั้งค่าโรงเรียนแล้ว หาก header ยังแสดงค่าเดิมให้ refresh เพื่อโหลด session ใหม่');
    setIsSubmitting(false);
  }

  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const nextClassroom = {
      academic_year: classroomForm.academicYear.trim(),
      grade_level: classroomForm.gradeLevel.trim() || null,
      name: classroomForm.name.trim(),
      status: 'active' as const,
    };

    if (!nextClassroom.name || !nextClassroom.academic_year) {
      setNotice('กรุณากรอกชื่อห้องเรียนและปีการศึกษา');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const classroom = { ...nextClassroom, id: `demo-classroom-${Date.now()}` };
      setClassrooms((current) => [classroom, ...current]);
      setNotice('เพิ่มห้องเรียนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        ...nextClassroom,
        homeroom_teacher_profile_id: session.profile.id,
        workspace_id: session.workspace.id,
      })
      .select('id,name,grade_level,academic_year,status')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const classroom = data as ClassroomRow;
    await writeAuditLog(session, {
      action: 'classroom.created',
      entityId: classroom.id,
      entityTable: 'classrooms',
      metadata: {
        academic_year: classroom.academic_year,
        grade_level: classroom.grade_level,
        name: classroom.name,
      },
      riskLevel: 'low',
      source: 'workspace_settings',
    });
    setClassrooms((current) => [classroom, ...current]);
    setClassroomForm((current) => ({ ...current, name: '' }));
    setNotice('เพิ่มห้องเรียนแล้ว');
    setIsSubmitting(false);
  }

  async function addWorkspaceMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsMemberSubmitting(true);
    setMemberNotice(null);

    const email = memberEmail.trim().toLowerCase();
    if (!email) {
      setMemberNotice('กรุณากรอกอีเมลผู้ใช้ที่สมัครและ Complete Profile แล้ว');
      setIsMemberSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const localMember: WorkspaceMemberRow = {
        created_at: new Date().toISOString(),
        display_name: email,
        email,
        joined_at: new Date().toISOString(),
        profile_id: `demo-member-${Date.now()}`,
        role: memberRole,
        status: 'active',
      };
      setMembers((current) => [localMember, ...current]);
      setMemberEmail('');
      setMemberNotice('เพิ่มสมาชิกในโหมดตัวอย่างแล้ว');
      setIsMemberSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc('add_workspace_member_by_email', {
      target_email: email,
      target_role: memberRole,
      target_workspace_id: session.workspace.id,
    });

    if (error) {
      const message = error.message.includes('profile_not_found')
        ? 'ยังไม่พบ profile ของอีเมลนี้ ให้ผู้ใช้สมัครและ Complete Profile ก่อน'
        : error.message.includes('not_allowed')
          ? 'บัญชีนี้ไม่มีสิทธิ์จัดการสมาชิก workspace'
          : error.message;
      setMemberNotice(message);
      setIsMemberSubmitting(false);
      return;
    }

    const addedMember = (data || [])[0] as WorkspaceMemberRow | undefined;
    if (addedMember) {
      setMembers((current) => [addedMember, ...current.filter((member) => member.profile_id !== addedMember.profile_id)]);
    }

    await writeAuditLog(session, {
      action: 'workspace_member.added',
      entityId: session.workspace.id,
      entityTable: 'workspace_memberships',
      metadata: {
        email,
        role: memberRole,
      },
      riskLevel: 'normal',
      source: 'workspace_settings',
    });

    setMemberEmail('');
    setMemberNotice(`เพิ่ม ${roleLabels[memberRole]} สำเร็จ`);
    setIsMemberSubmitting(false);
  }

  async function setWorkspaceMemberStatus(member: WorkspaceMemberRow, nextStatus: MemberStatus) {
    setIsMemberSubmitting(true);
    setMemberNotice(null);

    if (!supabase || !session.workspace) {
      setMembers((current) =>
        current.map((item) => (item.profile_id === member.profile_id ? { ...item, status: nextStatus } : item)),
      );
      setMemberNotice('เปลี่ยนสถานะสมาชิกในโหมดตัวอย่างแล้ว');
      setIsMemberSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc('set_workspace_member_status', {
      next_status: nextStatus,
      target_profile_id: member.profile_id,
      target_workspace_id: session.workspace.id,
    });

    if (error) {
      const message = error.message.includes('cannot_disable_yourself')
        ? 'ไม่สามารถปิดสิทธิ์บัญชีตัวเองได้'
        : error.message.includes('owner_membership_is_protected')
          ? 'ครูเจ้าของ workspace ถูกป้องกัน ไม่สามารถปิดสิทธิ์จากหน้านี้'
          : error.message;
      setMemberNotice(message);
      setIsMemberSubmitting(false);
      return;
    }

    const updatedMember = (data || [])[0] as WorkspaceMemberRow | undefined;
    if (updatedMember) {
      setMembers((current) =>
        current.map((item) => (item.profile_id === updatedMember.profile_id ? updatedMember : item)),
      );
    }

    await writeAuditLog(session, {
      action: `workspace_member.${nextStatus}`,
      entityId: member.profile_id,
      entityTable: 'workspace_memberships',
      metadata: {
        email: member.email,
        role: member.role,
        status: nextStatus,
      },
      riskLevel: nextStatus === 'removed' ? 'high' : 'normal',
      source: 'workspace_settings',
    });

    setMemberNotice(`${memberStatusLabels[nextStatus]} ${member.email} สำเร็จ`);
    setIsMemberSubmitting(false);
  }

  function exportSettingsSnapshot() {
    downloadJson(`classcare-workspace-settings-${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'ClassCare 360',
      classrooms,
      exportedAt: new Date().toISOString(),
      ownerRole: session.profile.role,
      schemaVersion: 'classcare-workspace-settings-v1',
      workspace: {
        ...workspaceForm,
        id: session.workspace?.id || null,
      },
    });
  }

  return (
    <main className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
      <section className="nexus-card overflow-hidden p-0">
        <div className="bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/20">
                <School size={15} aria-hidden="true" />
                Workspace Settings
              </div>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">ตั้งค่าโรงเรียนและห้องเรียน</h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-slate-300">
                จัดข้อมูลพื้นฐานของ workspace ให้พร้อมก่อนใช้งาน Student 360, รายงาน, import/export และระบบผู้ปกครอง
              </p>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              onClick={exportSettingsSnapshot}
              type="button"
            >
              Export settings
              <Download size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-4">
          {[
            { label: 'โรงเรียน', value: workspaceForm.schoolName || '-' },
            { label: 'ปีการศึกษา', value: workspaceForm.academicYear || '-' },
            { label: 'ห้อง active', value: activeClassrooms.length },
            { label: 'รออนุมัติ', value: pendingMembers.length },
          ].map((item) => (
            <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={item.label}>
              <p className="text-xs font-black uppercase text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="grid gap-5">
          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void saveWorkspaceSettings(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <ShieldCheck size={16} aria-hidden="true" />
              ข้อมูล workspace
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อ workspace
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))}
                  value={workspaceForm.name}
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อโรงเรียน
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setWorkspaceForm((current) => ({ ...current, schoolName: event.target.value }))}
                  value={workspaceForm.schoolName}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ปีการศึกษา
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setWorkspaceForm((current) => ({ ...current, academicYear: event.target.value }))}
                    value={workspaceForm.academicYear}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ห้องหลัก
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setWorkspaceForm((current) => ({ ...current, classroomName: event.target.value }))}
                    value={workspaceForm.classroomName}
                  />
                </label>
              </div>
            </div>
            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || isLoading}
              type="submit"
            >
              <Save size={17} aria-hidden="true" />
              บันทึกข้อมูลโรงเรียน
            </button>
          </form>

          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void createClassroom(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Plus size={16} aria-hidden="true" />
              เพิ่มห้องเรียน
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อห้องเรียน
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setClassroomForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="เช่น ป.5/2"
                  value={classroomForm.name}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ระดับชั้น
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setClassroomForm((current) => ({ ...current, gradeLevel: event.target.value }))}
                    placeholder="เช่น ป.5"
                    value={classroomForm.gradeLevel}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ปีการศึกษา
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setClassroomForm((current) => ({ ...current, academicYear: event.target.value }))}
                    value={classroomForm.academicYear}
                  />
                </label>
              </div>
            </div>
            <button
              className="dark-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || isLoading}
              type="submit"
            >
              <Plus size={17} aria-hidden="true" />
              เพิ่มห้องเรียน
            </button>
          </form>

          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void addWorkspaceMember(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <UserPlus size={16} aria-hidden="true" />
              เพิ่มสมาชิก workspace
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
              เพิ่มได้เฉพาะผู้ใช้ที่สมัครและ Complete Profile แล้ว ระบบจะไม่เปิดรายชื่อผู้ใช้ทั้งระบบให้ค้นเอง
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                อีเมลผู้ใช้
                <input
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="teacher@example.com"
                  type="email"
                  value={memberEmail}
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                บทบาท
                <select
                  className="nexus-field h-11 px-3"
                  onChange={(event) => setMemberRole(event.target.value as ManageableMemberRole)}
                  value={memberRole}
                >
                  {memberRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isMemberSubmitting || isLoading}
              type="submit"
            >
              <UserPlus size={17} aria-hidden="true" />
              เพิ่มสมาชิก
            </button>
          </form>
        </div>

        <section className="nexus-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-cyan-700">Classrooms</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">รายการห้องเรียน</h2>
            </div>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
              {classrooms.length} ห้อง
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {classrooms.map((classroom) => (
              <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={classroom.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-950">{classroom.name}</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {classroom.grade_level || 'ไม่ระบุระดับ'} | ปีการศึกษา {classroom.academic_year || '-'}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${
                      classroom.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}
                  >
                    {classroom.status === 'active' ? 'active' : 'archived'}
                  </span>
                </div>
              </article>
            ))}
            {classrooms.length === 0 ? (
              <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                ยังไม่มีห้องเรียนใน workspace นี้
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <section className="nexus-card mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Users size={17} aria-hidden="true" />
              Workspace Members
            </div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">สมาชิกใน workspace</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              ครูเจ้าของ workspace ใช้งานโมดูลห้องเรียนได้เหมือนครูทั่วไป และจัดการสมาชิก/แพ็กเกจ/ตั้งค่าได้ในบัญชีเดียว
            </p>
          </div>
          <span className="w-fit rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
            {activeMembers.length} active | {pendingMembers.length} รออนุมัติ
          </span>
        </div>

        {pendingMembers.length > 0 ? (
          <div className="mt-4 rounded-[1.75rem] border border-sky-100 bg-sky-50/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-sky-700">Approval Queue</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">คำขอเข้า workspace รออนุมัติ</h3>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                  ตรวจอีเมลและชื่อผู้ใช้ก่อนอนุมัติ เพื่อกันครูต่างโรงเรียนหรือบัญชีที่ไม่เกี่ยวข้องเข้า workspace
                </p>
              </div>
              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                {pendingMembers.length} คำขอ
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {pendingMembers.map((member) => (
                <article className="rounded-3xl bg-white/90 p-4 ring-1 ring-sky-100" key={member.profile_id}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                          รออนุมัติ
                        </span>
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-cyan-100">
                          {roleLabels[member.role]}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-lg font-black text-slate-950">{member.display_name}</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-500">{member.email}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isMemberSubmitting}
                        onClick={() => void setWorkspaceMemberStatus(member, 'active')}
                        type="button"
                      >
                        อนุมัติ
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-100 bg-white px-4 text-sm font-black text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isMemberSubmitting}
                        onClick={() => void setWorkspaceMemberStatus(member, 'removed')}
                        type="button"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          {visibleMembers.map((member) => {
            const isProtectedOwner = member.role === 'teacher_owner';
            const isCurrentUser = member.profile_id === session.profile.id;

            return (
              <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={member.profile_id}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-cyan-100">
                        {roleLabels[member.role]}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                          member.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                            : member.status === 'invited'
                              ? 'bg-sky-50 text-sky-700 ring-sky-100'
                            : member.status === 'suspended'
                              ? 'bg-amber-50 text-amber-700 ring-amber-100'
                              : 'bg-slate-100 text-slate-500 ring-slate-200'
                        }`}
                      >
                        {memberStatusLabels[member.status]}
                      </span>
                      {isCurrentUser ? (
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                          คุณ
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-lg font-black text-slate-950">{member.display_name}</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-500">{member.email}</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-100 bg-white px-4 text-sm font-black text-amber-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isMemberSubmitting || isProtectedOwner || isCurrentUser || member.status === 'suspended'}
                      onClick={() => void setWorkspaceMemberStatus(member, 'suspended')}
                      type="button"
                    >
                      พักสิทธิ์
                    </button>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isMemberSubmitting || member.status === 'active'}
                      onClick={() => void setWorkspaceMemberStatus(member, 'active')}
                      type="button"
                    >
                      เปิดสิทธิ์
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {members.length === 0 ? (
            <div className="nexus-muted-box p-4 text-sm font-bold leading-6 text-slate-600">
              ยังโหลดสมาชิกไม่ได้หรือยังไม่มีสมาชิกใน workspace นี้ หากเพิ่งเพิ่มฟีเจอร์นี้ โปรดรัน SQL ในไฟล์ tmp/supabase-workspace-member-admin.sql ก่อน
            </div>
          ) : null}
        </div>
      </section>

      {memberNotice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/90 p-3 text-sm font-bold leading-6 text-cyan-900 shadow-sm">
          <Users className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{memberNotice}</p>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}
    </main>
  );
}
