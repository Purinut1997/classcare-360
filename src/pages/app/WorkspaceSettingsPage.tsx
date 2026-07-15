import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Download, Plus, RotateCcw, Save, School, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { canManageWorkspace, roleLabels } from '../../lib/roles';
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

const workspaceControlSections = [
  {
    body: 'ตรวจคำขอครูเข้า workspace และอนุมัติก่อนให้เห็นข้อมูลนักเรียน',
    href: '#workspace-members',
    label: 'อนุมัติครู',
  },
  {
    body: 'เพิ่ม เก็บถาวร หรือลบห้องเรียน โดยนักเรียนจะไม่ถูกลบตามห้อง',
    href: '#workspace-classrooms',
    label: 'ห้องเรียน',
  },
  {
    body: 'ตั้งชื่อโรงเรียน ปีการศึกษา ห้องหลัก และข้อมูลพื้นฐานของ workspace',
    href: '#workspace-profile',
    label: 'ข้อมูลโรงเรียน',
  },
  {
    body: 'สำรอง snapshot การตั้งค่าและเตรียมส่งออก debug ให้ผู้ดูแลระบบ',
    href: '#workspace-backup',
    label: 'สำรองข้อมูล',
  },
  {
    body: 'เตรียมแผนเลื่อนชั้น เช่น ป.5/1 ไป ป.6/1 สำหรับปีการศึกษาถัดไป',
    href: '#workspace-rollover',
    label: 'เลื่อนชั้น',
  },
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
  const [classroomStudentCounts, setClassroomStudentCounts] = useState<Record<string, number>>({});
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
  const [rolloverForm, setRolloverForm] = useState({
    fromYear: session.workspace?.academicYear || '2569',
    toYear: String(Number(session.workspace?.academicYear || '2569') + 1),
  });

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setClassroomStudentCounts({ [demoClassrooms[0].id]: 0 });
        setMembers(demoMembers);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: workspaceRow, error: workspaceError },
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
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
        supabase
          .from('students')
          .select('classroom_id')
          .eq('workspace_id', session.workspace.id),
        supabase.rpc('get_workspace_members', {
          target_workspace_id: session.workspace.id,
        }),
      ]);

      if (!isMounted) return;

      if (workspaceError || classroomError || studentError) {
        setNotice(workspaceError?.message || classroomError?.message || studentError?.message || 'โหลดข้อมูลตั้งค่าโรงเรียนไม่สำเร็จ');
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
      const nextCounts = ((studentRows || []) as Array<{ classroom_id: string | null }>).reduce<Record<string, number>>((counts, student) => {
        if (!student.classroom_id) return counts;
        counts[student.classroom_id] = (counts[student.classroom_id] || 0) + 1;
        return counts;
      }, {});
      setClassroomStudentCounts(nextCounts);
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
  const canUseDestructiveActions = canManageWorkspace(session.profile.role);

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

  async function setClassroomStatus(classroom: ClassroomRow, status: ClassroomRow['status']) {
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่จัดการสถานะห้องเรียนได้');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase || !session.workspace) {
      setClassrooms((current) => current.map((item) => (item.id === classroom.id ? { ...item, status } : item)));
      setNotice(`เปลี่ยนสถานะห้องเรียนเป็น ${status === 'active' ? 'active' : 'archived'} ในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('classrooms')
      .update({ status })
      .eq('id', classroom.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,name,grade_level,academic_year,status')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const nextClassroom = data as ClassroomRow;
    setClassrooms((current) => current.map((item) => (item.id === nextClassroom.id ? nextClassroom : item)));
    await writeAuditLog(session, {
      action: `classroom.${status}`,
      entityId: classroom.id,
      entityTable: 'classrooms',
      metadata: {
        name: classroom.name,
        status,
      },
      riskLevel: status === 'archived' ? 'normal' : 'low',
      source: 'workspace_settings',
    });
    setNotice(`เปลี่ยนสถานะห้องเรียน ${classroom.name} เป็น ${status === 'active' ? 'active' : 'archived'} แล้ว`);
    setIsSubmitting(false);
  }

  async function deleteClassroomPermanently(classroom: ClassroomRow) {
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่ลบห้องเรียนได้');
      return;
    }

    const studentCount = classroomStudentCounts[classroom.id] || 0;
    const confirmed = window.confirm(
      `ลบห้องเรียน "${classroom.name}" ถาวรหรือไม่?\n\nนักเรียน ${studentCount} คนในห้องนี้จะไม่ถูกลบ แต่จะถูกปลดออกจากห้องเรียนนี้และไปอยู่สถานะ “ยังไม่ผูกห้อง”`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase || !session.workspace) {
      setClassrooms((current) => current.filter((item) => item.id !== classroom.id));
      setClassroomStudentCounts((current) => {
        const next = { ...current };
        delete next[classroom.id];
        return next;
      });
      setNotice('ลบห้องเรียนออกจากโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('classrooms')
      .delete()
      .eq('id', classroom.id)
      .eq('workspace_id', session.workspace.id)
      .select('id');

    if (error) {
      setNotice(`ลบห้องเรียนไม่สำเร็จ: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    if (!data || data.length === 0) {
      setNotice('ลบห้องเรียนไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง อาจยังไม่ได้รัน migration 0016_workspace_classroom_delete_policy.sql หรือบัญชีนี้ไม่ใช่เจ้าของ workspace/Superadmin');
      setIsSubmitting(false);
      return;
    }

    setClassrooms((current) => current.filter((item) => item.id !== classroom.id));
    setClassroomStudentCounts((current) => {
      const next = { ...current };
      delete next[classroom.id];
      return next;
    });
    await writeAuditLog(session, {
      action: 'classroom.deleted',
      entityId: classroom.id,
      entityTable: 'classrooms',
      metadata: {
        name: classroom.name,
        student_count: studentCount,
      },
      riskLevel: 'high',
      source: 'workspace_settings',
    });
    setNotice(`ลบห้องเรียน ${classroom.name} ถาวรแล้ว`);
    setIsSubmitting(false);
  }

  async function archiveCurrentWorkspace() {
    if (!session.workspace) return;
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่เก็บถาวร workspace ได้');
      return;
    }

    const confirmed = window.confirm(
      `เก็บถาวร workspace "${workspaceForm.name}" หรือไม่?\n\nผู้ใช้จะไม่ควรใช้งาน workspace นี้ต่อ แต่ข้อมูลยังอยู่ในฐานข้อมูล`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase) {
      setNotice('เก็บถาวร workspace ในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('workspaces')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', session.workspace.id);

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    await writeAuditLog(session, {
      action: 'workspace.archived',
      entityId: session.workspace.id,
      entityTable: 'workspaces',
      metadata: {
        name: workspaceForm.name,
        school_name: workspaceForm.schoolName,
      },
      riskLevel: 'high',
      source: 'workspace_settings',
    });
    setNotice('เก็บถาวร workspace แล้ว กำลังพาไปหน้าเลือก/สร้าง workspace');
    setTimeout(() => {
      window.location.href = '/app/select-workspace';
    }, 800);
    setIsSubmitting(false);
  }

  async function deleteCurrentWorkspacePermanently() {
    if (!session.workspace) return;
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่ลบ workspace ได้');
      return;
    }

    const confirmed = window.confirm(
      `ลบ workspace "${workspaceForm.name}" ถาวรหรือไม่?\n\nการลบนี้จะลบข้อมูลที่ผูกกับ workspace นี้ทั้งหมด เช่น ห้องเรียน นักเรียน เช็กชื่อ คะแนน เงินออม และไฟล์ที่อ้างอิงในฐานข้อมูล`,
    );
    if (!confirmed) return;

    const typed = window.prompt('พิมพ์ DELETE เพื่อยืนยันการลบ workspace ถาวร');
    if (typed !== 'DELETE') {
      setNotice('ยกเลิกการลบ workspace เพราะไม่ได้พิมพ์ DELETE');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    if (!supabase) {
      setNotice('ลบ workspace ในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', session.workspace.id)
      .select('id');

    if (error) {
      setNotice(`ลบ workspace ไม่สำเร็จ: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    if (!data || data.length === 0) {
      setNotice('ลบ workspace ไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง อาจยังไม่ได้รัน migration 0016_workspace_classroom_delete_policy.sql หรือบัญชีนี้ไม่ใช่เจ้าของ workspace/Superadmin');
      setIsSubmitting(false);
      return;
    }

    setNotice('ลบ workspace ถาวรแล้ว กำลังพาไปหน้าเลือก/สร้าง workspace');
    setTimeout(() => {
      window.location.href = '/app/select-workspace';
    }, 800);
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
      classroomStudentCounts,
      exportedAt: new Date().toISOString(),
      members,
      ownerRole: session.profile.role,
      schemaVersion: 'classcare-workspace-settings-v1',
      workspace: {
        ...workspaceForm,
        id: session.workspace?.id || null,
      },
    });
  }

  function exportRolloverPlan() {
    const fromYear = rolloverForm.fromYear.trim();
    const toYear = rolloverForm.toYear.trim();
    const plan = activeClassrooms.map((classroom) => ({
      currentAcademicYear: classroom.academic_year || fromYear,
      currentClassroomId: classroom.id,
      currentClassroomName: classroom.name,
      currentGradeLevel: classroom.grade_level,
      nextAcademicYear: toYear,
      nextClassroomName: classroom.name,
      nextGradeLevel: classroom.grade_level,
      studentCount: classroomStudentCounts[classroom.id] || 0,
    }));

    downloadJson(`classcare-rollover-plan-${fromYear}-to-${toYear}.json`, {
      app: 'ClassCare 360',
      exportedAt: new Date().toISOString(),
      note: 'ไฟล์นี้เป็นแผนเลื่อนชั้นแบบ preview ยังไม่ย้ายข้อมูลจริง ควรตรวจชื่อห้อง/ปีการศึกษาก่อนสร้างข้อมูลปีใหม่',
      plan,
      workspace: {
        id: session.workspace?.id || null,
        name: workspaceForm.name,
        schoolName: workspaceForm.schoolName,
      },
    });
    setNotice(`สร้างแผนเลื่อนชั้น ${fromYear} -> ${toYear} แล้ว ยังไม่ย้ายข้อมูลจริง`);
  }

  return (
    <main className="app-page">
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

      <section className="nexus-card mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <ShieldCheck size={17} aria-hidden="true" />
              Owner Workspace Control Center
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">ศูนย์จัดการโรงเรียน</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              รวมงานของเจ้าของ workspace ไว้ในหน้าเดียว: อนุมัติครู จัดสิทธิ์ ห้องเรียน ตั้งค่าโรงเรียน สำรองข้อมูล และเตรียมเลื่อนชั้นปีถัดไป
            </p>
          </div>
          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
            เจ้าของ workspace ใช้งานห้องเรียนได้ด้วย
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {workspaceControlSections.map((section) => (
            <a
              className="rounded-[24px] border border-slate-200 bg-white/86 p-4 shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[0_18px_42px_rgba(14,165,233,0.12)]"
              href={section.href}
              key={section.href}
            >
              <p className="text-base font-black text-slate-950">{section.label}</p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{section.body}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="grid gap-5">
          <form id="workspace-profile" className="scroll-mt-24 nexus-card p-4 sm:p-5" onSubmit={(event) => void saveWorkspaceSettings(event)}>
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

        <section id="workspace-classrooms" className="scroll-mt-24 nexus-card p-4 sm:p-5">
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
                    <p className="mt-1 text-xs font-black text-slate-400">
                      นักเรียน {classroomStudentCounts[classroom.id] || 0} คน
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${
                        classroom.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                          : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}
                    >
                      {classroom.status === 'active' ? 'active' : 'archived'}
                    </span>
                    <button
                      className="nexus-icon-button h-10 w-10"
                      disabled={isSubmitting || !canUseDestructiveActions}
                      onClick={() => void setClassroomStatus(classroom, classroom.status === 'active' ? 'archived' : 'active')}
                      title={classroom.status === 'active' ? 'เก็บถาวรห้องเรียน' : 'กู้คืนห้องเรียน'}
                      type="button"
                    >
                      {classroom.status === 'active' ? <Archive size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
                    </button>
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSubmitting || !canUseDestructiveActions}
                      onClick={() => void deleteClassroomPermanently(classroom)}
                      title="ลบห้องเรียนถาวร"
                      type="button"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
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

      <section id="workspace-members" className="scroll-mt-24 nexus-card mt-5 p-4 sm:p-5">
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

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div id="workspace-backup" className="scroll-mt-24 nexus-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
            <Download size={17} aria-hidden="true" />
            Backup & Debug Snapshot
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">สำรองข้อมูลตั้งค่า workspace</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
            ดาวน์โหลด snapshot สำหรับตรวจโรงเรียน ห้องเรียน สมาชิก และจำนวนเด็กต่อห้อง ใช้ส่ง debug ได้เมื่อเจอปัญหาข้อมูลไม่โผล่หรือ workspace ซ้ำ
          </p>
          <button
            className="blue-action mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
            onClick={exportSettingsSnapshot}
            type="button"
          >
            Export settings snapshot
            <Download size={17} aria-hidden="true" />
          </button>
        </div>

        <div id="workspace-rollover" className="scroll-mt-24 nexus-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
            <RotateCcw size={17} aria-hidden="true" />
            Academic Year Rollover
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">เตรียมเลื่อนชั้นปีถัดไป</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
            รอบนี้ทำเป็น preview/export ก่อน เพื่อกันการย้ายข้อมูลผิดปี เมื่อพร้อมค่อยผูก Edge Function ให้สร้างห้องปีใหม่และย้ายนักเรียนแบบมี audit log
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ปีเดิม
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setRolloverForm((current) => ({ ...current, fromYear: event.target.value }))}
                value={rolloverForm.fromYear}
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-slate-700">
              ปีถัดไป
              <input
                className="nexus-field h-11 px-3"
                onChange={(event) => setRolloverForm((current) => ({ ...current, toYear: event.target.value }))}
                value={rolloverForm.toYear}
              />
            </label>
          </div>
          <button
            className="dark-action mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
            onClick={exportRolloverPlan}
            type="button"
          >
            สร้างแผนเลื่อนชั้น
            <Download size={17} aria-hidden="true" />
          </button>
        </div>
      </section>

      {canUseDestructiveActions ? (
      <section className="mt-5 rounded-[28px] border border-rose-200 bg-rose-50/45 p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100">
              <AlertTriangle size={15} aria-hidden="true" />
              Danger Zone
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">จัดการ workspace นี้</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-600">
              เก็บถาวรเหมาะกับ workspace ที่ไม่ใช้งานแล้ว ส่วนลบถาวรใช้เฉพาะ workspace ที่สร้างซ้ำหรือผิดเท่านั้น เพราะข้อมูลที่ผูกกับ workspace จะถูกลบตาม cascade ของฐานข้อมูล
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !session.workspace}
              onClick={() => void archiveCurrentWorkspace()}
              type="button"
            >
              <Archive size={17} aria-hidden="true" />
              เก็บถาวร workspace
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !session.workspace}
              onClick={() => void deleteCurrentWorkspacePermanently()}
              type="button"
            >
              <Trash2 size={17} aria-hidden="true" />
              ลบ workspace ถาวร
            </button>
          </div>
        </div>
      </section>
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
