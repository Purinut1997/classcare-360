import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, ArrowRight, Building2, Download, Globe2, GraduationCap, ImagePlus, Plus, RotateCcw, Save, School, ShieldCheck, Sparkles, Trash2, UserPlus, Users } from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

import { writeAuditLog } from '../../lib/auditLog';
import { getEffectivePlanCode, planLabels, planLimits } from '../../lib/entitlements';
import { canManageWorkspace, roleLabels } from '../../lib/roles';
import { compressImageFile, loadSchoolReportIdentity, saveSchoolReportIdentity } from '../../lib/scheduleSettings';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext, WorkspaceRole } from '../../types/core';
import { MemberAccessControl } from '../../components/workspace/MemberAccessControl';

interface WorkspaceSettingsPageProps {
  session: AppSessionContext;
}

interface ClassroomRow {
  academic_year: string | null;
  grade_level: string | null;
  homeroom_teacher_profile_id?: string | null;
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

interface TeacherInvitationRow {
  assigned_classroom_ids: string[];
  created_at: string;
  expires_at: string;
  id: string;
  invite_email: string;
  role: ManageableMemberRole;
  status: 'invited' | 'accepted' | 'revoked' | 'expired';
}

interface SafeDeleteResult {
  affected_students?: number;
  deleted?: boolean;
  reason?: string;
}

type ClassroomStudentStrategy = 'detach' | 'archive';

interface PublicReportPolicy {
  attendance: boolean;
  behavior: boolean;
  enabled: boolean;
  guardians: boolean;
  home_visit: boolean;
  savings: boolean;
  scores: boolean;
}

const defaultPublicReportPolicy: PublicReportPolicy = {
  attendance: true,
  behavior: false,
  enabled: false,
  guardians: false,
  home_visit: false,
  savings: false,
  scores: true,
};

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

const isDevelopmentDemo =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

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
    body: 'ตั้งชื่อโรงเรียน ปีการศึกษา ห้องหลัก โลโก้ และผู้ลงนามสำหรับรายงานทุกฉบับ',
    href: '#workspace-profile',
    label: 'ข้อมูลโรงเรียน/ผู้ลงนาม',
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

function getRpcErrorMessage(actionLabel: string, error: { code?: string; message?: string }) {
  const message = error.message || 'ไม่ทราบสาเหตุ';
  const isMissingRpc =
    error.code === 'PGRST202' ||
    message.includes('schema cache') ||
    message.includes('Could not find the function') ||
    message.includes('delete_classroom_with_student_strategy') ||
    message.includes('delete_classroom_safely') ||
    message.includes('delete_workspace_safely');

  if (isMissingRpc) {
    return `${actionLabel}ไม่สำเร็จ: Supabase project ยังไม่มี RPC ชุดล่าสุด ให้รัน migrations ถึง 0039_classroom_student_cleanup_strategy.sql ใน SQL Editor แล้ว reload schema cache ก่อนลองใหม่`;
  }

  if (error.code === '42501' || message.includes('not allowed')) {
    return `${actionLabel}ไม่สำเร็จ: บัญชีนี้ต้องเป็นเจ้าของ workspace หรือ Superadmin`;
  }

  return `${actionLabel}ไม่สำเร็จ: ${message}`;
}

export function WorkspaceSettingsPage({ session }: WorkspaceSettingsPageProps) {
  const useRealBackend = Boolean(supabase) && !isDevelopmentDemo;
  const initialReportIdentity = loadSchoolReportIdentity(session.workspace?.id);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [classroomStudentCounts, setClassroomStudentCounts] = useState<Record<string, number>>({});
  const [activeStudentCount, setActiveStudentCount] = useState(0);
  const [classroomDeleteStrategy, setClassroomDeleteStrategy] = useState<ClassroomStudentStrategy>('archive');
  const [pendingClassroomDelete, setPendingClassroomDelete] = useState<ClassroomRow | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberRow[]>(demoMembers);
  const [teacherInvitations, setTeacherInvitations] = useState<TeacherInvitationRow[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(useRealBackend && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMemberSubmitting, setIsMemberSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local เพื่อบันทึกข้อมูลโรงเรียนลง Supabase จริง',
  );
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<ManageableMemberRole>('teacher_member');
  const [invitedClassroomIds, setInvitedClassroomIds] = useState<string[]>([]);
  const [workspaceForm, setWorkspaceForm] = useState({
    academicYear: session.workspace?.academicYear || '2569',
    academicHeadName: initialReportIdentity.academicHeadName,
    classroomName: session.workspace?.classroomName || 'ป.5/2',
    coAdvisorName: initialReportIdentity.coAdvisorName || '',
    directorName: initialReportIdentity.directorName,
    registrarName: initialReportIdentity.registrarName,
    name: session.workspace?.name || 'ห้องเรียนของฉัน',
    schoolLogoDataUrl: initialReportIdentity.schoolLogoDataUrl,
    schoolName: session.workspace?.schoolName || 'โรงเรียนตัวอย่าง ClassCare',
    teacherName: initialReportIdentity.teacherName,
  });
  const [workspaceSettingsJson, setWorkspaceSettingsJson] = useState<Record<string, unknown>>({});
  const [publicReportPolicy, setPublicReportPolicy] = useState<PublicReportPolicy>(defaultPublicReportPolicy);
  const [classroomForm, setClassroomForm] = useState({
    academicYear: session.workspace?.academicYear || '2569',
    gradeLevel: 'ป.5',
    homeroomTeacherProfileId: session.profile.id,
    name: session.workspace?.classroomName || 'ป.5/2',
  });
  const [rolloverForm, setRolloverForm] = useState({
    fromYear: session.workspace?.academicYear || '2569',
    toYear: String(Number(session.workspace?.academicYear || '2569') + 1),
  });
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'classrooms' | 'members' | 'all'>('profile');

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!useRealBackend || !supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setClassroomStudentCounts({ [demoClassrooms[0].id]: 0 });
        setActiveStudentCount(0);
        setMembers(demoMembers);
        setTeacherInvitations([]);
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
        { data: invitationRows, error: invitationError },
      ] = await Promise.all([
        supabase
          .from('workspaces')
          .select('id,name,school_name,academic_year,settings')
          .eq('id', session.workspace.id)
          .single(),
        supabase
          .from('classrooms')
          .select('id,name,grade_level,academic_year,status,homeroom_teacher_profile_id')
          .eq('workspace_id', session.workspace.id)
          .order('status', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('classroom_id,status')
          .eq('workspace_id', session.workspace.id),
        supabase.rpc('get_workspace_members', {
          target_workspace_id: session.workspace.id,
        }),
        supabase
          .from('workspace_teacher_invitations')
          .select('id,invite_email,role,status,assigned_classroom_ids,expires_at,created_at')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'invited')
          .order('created_at', { ascending: false }),
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
      if (invitationError) {
        setMemberNotice(`ยังโหลดคำเชิญครูไม่ได้: ${invitationError.message}`);
        setTeacherInvitations([]);
      } else {
        setTeacherInvitations((invitationRows || []) as TeacherInvitationRow[]);
      }

      const settings = (workspaceRow?.settings || {}) as Record<string, unknown> & {
        classroom_name?: string;
        public_report?: Partial<PublicReportPolicy>;
        report_identity?: Partial<{
          academicHeadName: string;
          directorName: string;
          registrarName: string;
          schoolLogoDataUrl: string;
          teacherName: string;
        }>;
      };
      const reportIdentity = {
        ...loadSchoolReportIdentity(session.workspace.id),
        ...(settings.report_identity || {}),
      };
      setWorkspaceSettingsJson(settings);
      setPublicReportPolicy({
        ...defaultPublicReportPolicy,
        ...(settings.public_report || {}),
      });
      setWorkspaceForm({
        academicYear: workspaceRow?.academic_year || session.workspace.academicYear,
        academicHeadName: reportIdentity.academicHeadName || '',
        classroomName: settings.classroom_name || session.workspace.classroomName,
        coAdvisorName: reportIdentity.coAdvisorName || '',
        directorName: reportIdentity.directorName || '',
        registrarName: reportIdentity.registrarName || '',
        name: workspaceRow?.name || session.workspace.name,
        schoolLogoDataUrl: reportIdentity.schoolLogoDataUrl || '',
        schoolName: workspaceRow?.school_name || session.workspace.schoolName,
        teacherName: reportIdentity.teacherName || '',
      });
      saveSchoolReportIdentity({
        academicHeadName: reportIdentity.academicHeadName || '',
        academicYear: workspaceRow?.academic_year || session.workspace.academicYear,
        classroomName: settings.classroom_name || session.workspace.classroomName,
        coAdvisorName: reportIdentity.coAdvisorName || '',
        directorName: reportIdentity.directorName || '',
        registrarName: reportIdentity.registrarName || '',
        schoolLogoDataUrl: reportIdentity.schoolLogoDataUrl || '',
        schoolName: workspaceRow?.school_name || session.workspace.schoolName,
        teacherName: reportIdentity.teacherName || '',
      }, session.workspace.id);
      setClassroomForm((current) => ({
        ...current,
        academicYear: workspaceRow?.academic_year || session.workspace?.academicYear || current.academicYear,
        name: settings.classroom_name || session.workspace?.classroomName || current.name,
      }));
      setClassrooms((classroomRows || []) as ClassroomRow[]);
      const typedStudents = (studentRows || []) as Array<{ classroom_id: string | null; status: string }>;
      const nextCounts = typedStudents.reduce<Record<string, number>>((counts, student) => {
        if (!student.classroom_id) return counts;
        counts[student.classroom_id] = (counts[student.classroom_id] || 0) + 1;
        return counts;
      }, {});
      setClassroomStudentCounts(nextCounts);
      setActiveStudentCount(typedStudents.filter((student) => student.status === 'active').length);
      setIsLoading(false);
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [session.workspace, useRealBackend]);

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
  const effectivePlanCode = getEffectivePlanCode(session.subscription);
  const workspaceLimits = planLimits[effectivePlanCode];
  const collaboratorCount = activeMembers.filter((member) => member.role !== 'teacher_owner').length + teacherInvitations.length;
  const classroomLimitReached = activeClassrooms.length >= workspaceLimits.activeClassrooms;
  const collaboratorLimitReached = collaboratorCount >= workspaceLimits.collaborators;
  const canUseDestructiveActions = canManageWorkspace(session.profile.role);

  async function saveWorkspaceSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const nextWorkspace = {
      academicYear: workspaceForm.academicYear.trim(),
      academicHeadName: workspaceForm.academicHeadName.trim(),
      classroomName: workspaceForm.classroomName.trim(),
      coAdvisorName: workspaceForm.coAdvisorName.trim(),
      directorName: workspaceForm.directorName.trim(),
      registrarName: workspaceForm.registrarName.trim(),
      name: workspaceForm.name.trim(),
      schoolLogoDataUrl: workspaceForm.schoolLogoDataUrl,
      schoolName: workspaceForm.schoolName.trim(),
      teacherName: workspaceForm.teacherName.trim(),
    };
    const reportIdentity = {
      academicHeadName: nextWorkspace.academicHeadName,
      academicYear: nextWorkspace.academicYear,
      classroomName: nextWorkspace.classroomName,
      coAdvisorName: nextWorkspace.coAdvisorName || '',
      directorName: nextWorkspace.directorName,
      registrarName: nextWorkspace.registrarName,
      schoolLogoDataUrl: nextWorkspace.schoolLogoDataUrl,
      schoolName: nextWorkspace.schoolName,
      teacherName: nextWorkspace.teacherName,
    };

    if (!nextWorkspace.name || !nextWorkspace.schoolName || !nextWorkspace.academicYear) {
      setNotice('กรุณากรอกชื่อ workspace โรงเรียน และปีการศึกษา');
      setIsSubmitting(false);
      return;
    }

    if (!useRealBackend || !supabase || !session.workspace) {
      setWorkspaceForm(nextWorkspace);
      saveSchoolReportIdentity(reportIdentity, session.workspace?.id);
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
          ...workspaceSettingsJson,
          classroom_name: nextWorkspace.classroomName,
          public_report: publicReportPolicy,
          report_identity: reportIdentity,
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
        academic_head_name: nextWorkspace.academicHeadName,
        classroom_name: nextWorkspace.classroomName,
        director_name: nextWorkspace.directorName,
        school_name: nextWorkspace.schoolName,
        teacher_name: nextWorkspace.teacherName,
      },
      riskLevel: 'low',
      source: 'workspace_settings',
    });
    setNotice('บันทึกตั้งค่าโรงเรียนแล้ว หาก header ยังแสดงค่าเดิมให้ refresh เพื่อโหลด session ใหม่');
    setWorkspaceSettingsJson((current) => ({
      ...current,
      classroom_name: nextWorkspace.classroomName,
      public_report: publicReportPolicy,
      report_identity: reportIdentity,
    }));
    saveSchoolReportIdentity(reportIdentity, session.workspace.id);
    setIsSubmitting(false);
  }

  async function savePublicReportPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!useRealBackend || !supabase || !session.workspace) {
      setWorkspaceSettingsJson((current) => ({ ...current, public_report: publicReportPolicy }));
      setNotice('บันทึกการเปิดรายงานหน้าแรกในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc('set_workspace_public_report_policy', {
      policy: publicReportPolicy,
      target_workspace_id: session.workspace.id,
    });

    if (error) {
      setNotice(`บันทึกการเปิดรายงานหน้าแรกไม่สำเร็จ: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    const payload = data as { ok?: boolean; reason?: string } | null;
    if (payload && payload.ok === false) {
      setNotice(`บันทึกการเปิดรายงานหน้าแรกไม่สำเร็จ: ${payload.reason || 'not_allowed'}`);
      setIsSubmitting(false);
      return;
    }

    setWorkspaceSettingsJson((current) => ({ ...current, public_report: publicReportPolicy }));
    await writeAuditLog(session, {
      action: 'workspace_public_report_policy.updated',
      entityId: session.workspace.id,
      entityTable: 'workspaces',
      metadata: { ...publicReportPolicy },
      riskLevel: publicReportPolicy.enabled ? 'normal' : 'low',
      source: 'workspace_settings',
    });
    setNotice('บันทึกการเปิดรายงานหน้าแรกแล้ว');
    setIsSubmitting(false);
  }

  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (classroomLimitReached) {
      setNotice(`แพ็กเกจ ${planLabels[effectivePlanCode]} ใช้ห้อง active ได้ ${workspaceLimits.activeClassrooms} ห้อง กรุณาเก็บห้องเดิมหรืออัปเกรดแพ็กเกจ`);
      setIsSubmitting(false);
      return;
    }

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

    if (!useRealBackend || !supabase || !session.workspace) {
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
        homeroom_teacher_profile_id: classroomForm.homeroomTeacherProfileId || session.profile.id,
        workspace_id: session.workspace.id,
      })
      .select('id,name,grade_level,academic_year,status,homeroom_teacher_profile_id')
      .single();

    if (error) {
      setNotice(error.message.includes('workspace_classroom_limit_reached')
        ? `ใช้ห้อง active ครบ ${workspaceLimits.activeClassrooms} ห้องตามแพ็กเกจแล้ว`
        : error.message);
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
        homeroom_teacher_profile_id: classroom.homeroom_teacher_profile_id,
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

  async function setClassroomHomeroomTeacher(classroom: ClassroomRow, homeroomTeacherProfileId: string | null) {
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่มอบหมายครูประจำชั้นได้');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    if (!useRealBackend || !supabase || !session.workspace) {
      setClassrooms((current) =>
        current.map((item) =>
          item.id === classroom.id ? { ...item, homeroom_teacher_profile_id: homeroomTeacherProfileId } : item,
        ),
      );
      setNotice(`มอบหมายครูที่ปรึกษาห้อง ${classroom.name} ในโหมดตัวอย่างแล้ว`);
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('classrooms')
      .update({ homeroom_teacher_profile_id: homeroomTeacherProfileId || null })
      .eq('id', classroom.id)
      .eq('workspace_id', session.workspace.id)
      .select('id,name,grade_level,academic_year,status,homeroom_teacher_profile_id')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const updatedClassroom = data as ClassroomRow;
    setClassrooms((current) =>
      current.map((item) => (item.id === updatedClassroom.id ? updatedClassroom : item)),
    );
    await writeAuditLog(session, {
      action: 'classroom.homeroom_assigned',
      entityId: classroom.id,
      entityTable: 'classrooms',
      metadata: {
        classroom_id: classroom.id,
        homeroom_teacher_profile_id: homeroomTeacherProfileId,
      },
      riskLevel: 'normal',
      source: 'workspace_settings',
    });
    setNotice(`บันทึกครูประจำชั้น/ที่ปรึกษาของห้อง ${classroom.name} เรียบร้อยแล้ว`);
    setIsSubmitting(false);
  }

  async function setClassroomStatus(classroom: ClassroomRow, status: ClassroomRow['status']) {
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่จัดการสถานะห้องเรียนได้');
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    if (!useRealBackend || !supabase || !session.workspace) {
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

  async function deleteClassroomPermanently(
    classroom: ClassroomRow,
    studentStrategy: ClassroomStudentStrategy,
  ) {
    if (!canUseDestructiveActions) {
      setNotice('เฉพาะ Superadmin หรือเจ้าของ workspace เท่านั้นที่ลบห้องเรียนได้');
      return;
    }

    const studentCount = classroomStudentCounts[classroom.id] || 0;

    setIsSubmitting(true);
    setNotice(null);

    if (!useRealBackend || !supabase || !session.workspace) {
      setClassrooms((current) => current.filter((item) => item.id !== classroom.id));
      setClassroomStudentCounts((current) => {
        const next = { ...current };
        delete next[classroom.id];
        return next;
      });
      setPendingClassroomDelete(null);
      setNotice(
        studentStrategy === 'archive'
          ? `ลบห้องเรียนและเก็บนักเรียน ${studentCount} คนเป็นประวัติในโหมดตัวอย่างแล้ว`
          : `ลบห้องเรียนและย้ายนักเรียน ${studentCount} คนไปยัง “ยังไม่ผูกห้อง” ในโหมดตัวอย่างแล้ว`,
      );
      setIsSubmitting(false);
      return;
    }

    const rpcResult = await supabase.rpc('delete_classroom_with_student_strategy', {
      student_strategy: studentStrategy,
      target_classroom_id: classroom.id,
    });

    let data: Array<{ id: string }> | null = null;
    const error = rpcResult.error;
    let failureReason: string | undefined;

    if (rpcResult.data) {
      const result = rpcResult.data as SafeDeleteResult;
      data = result.deleted ? [{ id: classroom.id }] : [];
      failureReason = result.reason;
    }

    if (error) {
      setNotice(getRpcErrorMessage('ลบห้องเรียน', error));
      setIsSubmitting(false);
      return;
    }

    if (!data || data.length === 0) {
      setNotice(
        `ลบห้องเรียนไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง${failureReason ? ` (${failureReason})` : ''} ถ้า production ยังไม่ได้รัน supabase/migrations/0020_harden_destructive_action_rpcs.sql ให้รันก่อน`,
      );
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
        student_strategy: studentStrategy,
      },
      riskLevel: 'high',
      source: 'workspace_settings',
    });
    setPendingClassroomDelete(null);
    setNotice(
      studentStrategy === 'archive'
        ? `ลบห้องเรียน ${classroom.name} และเก็บนักเรียน ${studentCount} คนเป็นประวัติแล้ว`
        : `ลบห้องเรียน ${classroom.name} และย้ายนักเรียน ${studentCount} คนไปยัง “ยังไม่ผูกห้อง” แล้ว`,
    );
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

    if (!useRealBackend || !supabase) {
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

    if (!useRealBackend || !supabase) {
      setNotice('ลบ workspace ในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const rpcResult = await supabase.rpc('delete_workspace_safely', {
      target_workspace_id: session.workspace.id,
    });

    let data: Array<{ id: string }> | null = null;
    const error = rpcResult.error;
    let failureReason: string | undefined;

    if (rpcResult.data) {
      const result = rpcResult.data as SafeDeleteResult;
      data = result.deleted ? [{ id: session.workspace.id }] : [];
      failureReason = result.reason;
    }

    if (error) {
      setNotice(getRpcErrorMessage('ลบ workspace', error));
      setIsSubmitting(false);
      return;
    }

    if (!data || data.length === 0) {
      setNotice(
        `ลบ workspace ไม่สำเร็จ: ฐานข้อมูลไม่ได้ลบแถวจริง${failureReason ? ` (${failureReason})` : ''} ถ้า production ยังไม่ได้รัน supabase/migrations/0020_harden_destructive_action_rpcs.sql ให้รันก่อน เพราะ Cloudflare/GitHub deploy ไม่ได้ติดตั้ง SQL ให้ Supabase`,
      );
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

    if (collaboratorLimitReached) {
      setMemberNotice(`แพ็กเกจ ${planLabels[effectivePlanCode]} เชิญผู้ร่วมงานได้ ${workspaceLimits.collaborators} คน กรุณาถอนคำเชิญเดิมหรืออัปเกรดแพ็กเกจ`);
      setIsMemberSubmitting(false);
      return;
    }

    const email = memberEmail.trim().toLowerCase();
    if (!email) {
      setMemberNotice('กรุณากรอกอีเมลผู้ใช้ที่สมัครและ Complete Profile แล้ว');
      setIsMemberSubmitting(false);
      return;
    }

    if (!useRealBackend || !supabase || !session.workspace) {
      const localInvitation: TeacherInvitationRow = {
        assigned_classroom_ids: invitedClassroomIds,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        id: `demo-invitation-${Date.now()}`,
        invite_email: email,
        role: memberRole,
        status: 'invited',
      };
      setTeacherInvitations((current) => [localInvitation, ...current]);
      setMemberEmail('');
      setInvitedClassroomIds([]);
      setMemberNotice('ส่งคำเชิญครูในโหมดตัวอย่างแล้ว ผู้รับต้องกดยอมรับก่อน');
      setIsMemberSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc('create_workspace_teacher_invitation', {
      expires_in_days: 14,
      target_classroom_ids: invitedClassroomIds,
      target_email: email,
      target_role: memberRole,
      target_workspace_id: session.workspace.id,
    });

    if (error) {
      const message = error.message.includes('profile_not_found')
        ? 'ยังไม่พบ profile ของอีเมลนี้'
        : error.message.includes('not_allowed')
          ? 'บัญชีนี้ไม่มีสิทธิ์จัดการสมาชิก workspace'
          : error.message.includes('already_active_member')
            ? 'อีเมลนี้เป็นสมาชิกที่ใช้งานอยู่แล้ว'
            : error.message.includes('workspace_collaborator_limit_reached')
              ? `ใช้โควตาผู้ร่วมงานครบ ${workspaceLimits.collaborators} คนตามแพ็กเกจแล้ว`
          : error.message;
      setMemberNotice(message);
      setIsMemberSubmitting(false);
      return;
    }

    const invitation = (data || [])[0] as TeacherInvitationRow | undefined;
    if (invitation) {
      setTeacherInvitations((current) => [
        invitation,
        ...current.filter((item) => item.id !== invitation.id && item.invite_email !== invitation.invite_email),
      ]);
    }

    setMemberEmail('');
    setInvitedClassroomIds([]);
    setMemberNotice(`ส่งคำเชิญ ${roleLabels[memberRole]} สำเร็จ ผู้รับไม่ต้องซื้อ VIP เพิ่ม`);
    setIsMemberSubmitting(false);
  }

  async function revokeTeacherInvitation(invitation: TeacherInvitationRow) {
    setIsMemberSubmitting(true);
    setMemberNotice(null);
    if (!useRealBackend || !supabase) {
      setTeacherInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setMemberNotice('ยกเลิกคำเชิญในโหมดตัวอย่างแล้ว');
      setIsMemberSubmitting(false);
      return;
    }
    const { error } = await supabase.rpc('revoke_workspace_teacher_invitation', {
      target_invitation_id: invitation.id,
    });
    if (error) setMemberNotice(error.message);
    else {
      setTeacherInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setMemberNotice(`ยกเลิกคำเชิญ ${invitation.invite_email} แล้ว`);
    }
    setIsMemberSubmitting(false);
  }

  async function setWorkspaceMemberStatus(member: WorkspaceMemberRow, nextStatus: MemberStatus) {
    setIsMemberSubmitting(true);
    setMemberNotice(null);

    if (!useRealBackend || !supabase || !session.workspace) {
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

  async function handleSchoolLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const schoolLogoDataUrl = await compressImageFile(file, 520, 0.78);
      setWorkspaceForm((current) => ({ ...current, schoolLogoDataUrl }));
      setNotice('บีบอัดโลโก้โรงเรียนแล้ว กดบันทึกข้อมูลโรงเรียนเพื่อใช้กับรายงานทั้งหมด');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'อัปโหลดโลโก้โรงเรียนไม่สำเร็จ');
    }
  }

  return (
    <main className="app-page workspace-settings-page">
      <section className="workspace-settings-hero overflow-hidden">
        <div className="workspace-settings-hero-main p-5 text-white sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="workspace-settings-eyebrow inline-flex items-center gap-2 text-xs font-black">
                <School size={15} aria-hidden="true" />
                Workspace Settings
              </div>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">ตั้งค่าโรงเรียนและห้องเรียน</h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-slate-300">
                จัดข้อมูลพื้นฐานของ workspace ให้พร้อมก่อนใช้งาน Student 360, รายงาน, import/export และระบบผู้ปกครอง
              </p>
            </div>
            <button
              className="workspace-settings-export inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black transition"
              onClick={exportSettingsSnapshot}
              type="button"
            >
              Export settings
              <Download size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="workspace-settings-stats grid grid-cols-6 sm:grid-cols-4">
          {[
            { label: 'โรงเรียน', value: workspaceForm.schoolName || '-' },
            { label: 'ปีการศึกษา', value: workspaceForm.academicYear || '-' },
            { label: 'ห้อง active', value: activeClassrooms.length },
            { label: 'รออนุมัติ', value: pendingMembers.length },
          ].map((item, index) => (
            <article className={`workspace-settings-stat p-4 sm:col-span-1 sm:p-5 ${index === 0 ? 'col-span-6' : 'col-span-2'}`} key={item.label}>
              <p className="text-xs font-black text-slate-400">{item.label}</p>
              <p className="mt-1.5 truncate text-2xl font-black text-white">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nexus-card mt-5 p-4 sm:p-5" aria-label="โควตาแพ็กเกจ Workspace">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black text-cyan-700">Workspace quota</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{planLabels[effectivePlanCode]}</h2>
          </div>
          <p className="text-xs font-bold text-slate-500">เมื่อ Trial/VIP หมดอายุ ข้อมูลเดิมยังอยู่และระบบจะกลับเป็น Free อัตโนมัติ</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'ห้อง active', used: activeClassrooms.length, limit: workspaceLimits.activeClassrooms },
            { label: 'นักเรียน active', used: activeStudentCount, limit: workspaceLimits.activeStudents },
            { label: 'ผู้ร่วมงาน + คำเชิญ', used: collaboratorCount, limit: workspaceLimits.collaborators },
          ].map((quota) => {
            const ratio = Math.min((quota.used / Math.max(quota.limit, 1)) * 100, 100);
            return (
              <article className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100" key={quota.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-slate-500">{quota.label}</p>
                  <p className="text-sm font-black text-slate-950">{quota.used} / {quota.limit}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${ratio >= 100 ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${ratio}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workspace-settings-control mt-5 p-4 sm:p-6">
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

        {/* 🧭 Tab Switcher */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('profile')}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
              activeSettingsTab === 'profile'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
            }`}
          >
            <School size={17} />
            🏫 ข้อมูลโรงเรียน & ผู้ลงนาม
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('classrooms')}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
              activeSettingsTab === 'classrooms'
                ? 'bg-cyan-700 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
            }`}
          >
            <Building2 size={17} />
            📚 จัดการห้องเรียน & ครูประจำชั้น
            <span className="ml-1 rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-black">
              {classrooms.length} ห้อง
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('members')}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
              activeSettingsTab === 'members'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
            }`}
          >
            <Users size={17} />
            👥 อนุมัติครู & สิทธิ์สมาชิก
            {pendingMembers.length > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 text-white px-2 py-0.5 text-xs font-black">
                {pendingMembers.length} รออนุมัติ
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('all')}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition ${
              activeSettingsTab === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200'
            }`}
          >
            📋 แสดงทั้งหมด
          </button>
        </div>
      </section>

      <section className="workspace-settings-workbench mt-5 grid gap-5 xl:grid-cols-12 xl:items-start">
        <div className={`workspace-settings-forms grid gap-5 ${
          activeSettingsTab === 'classrooms' || activeSettingsTab === 'all' ? 'xl:col-span-8' : 'xl:col-span-12'
        } xl:grid-cols-2`}>
          {(activeSettingsTab === 'profile' || activeSettingsTab === 'all') && (
            <>
          <form id="workspace-profile" className="workspace-settings-form workspace-profile-form scroll-mt-24 nexus-card p-4 sm:p-6 xl:col-span-2" onSubmit={(event) => void saveWorkspaceSettings(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <ShieldCheck size={16} aria-hidden="true" />
              ตั้งค่าโรงเรียนและผู้ลงนาม
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
              ข้อมูลส่วนนี้เป็นฐานกลางของรายงานทั้งหมด เช่น ตารางสอน เวลาเรียน คะแนน เงินออม รายบุคคล และเอกสารพิมพ์ของโรงเรียน
            </p>
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
              <div className="rounded-[24px] border border-[#ead8bd] bg-[#fffaf0]/85 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#ead8bd] bg-white text-[#8a5200]">
                    {workspaceForm.schoolLogoDataUrl ? (
                      <img alt="โลโก้โรงเรียน" className="h-full w-full object-contain p-2" src={workspaceForm.schoolLogoDataUrl} />
                    ) : (
                      <ImagePlus size={28} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="grid gap-2 text-sm font-black text-slate-700">
                      โลโก้โรงเรียนสำหรับรายงานทุกฉบับ
                      <input
                        accept="image/*"
                        className="nexus-field h-11 px-3 py-2"
                        onChange={(event) => void handleSchoolLogoChange(event)}
                        type="file"
                      />
                    </label>
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      ระบบย่อรูปก่อนเก็บไว้ใช้ในรายงาน ตารางสอน และเอกสารพิมพ์ เพื่อลดขนาดข้อมูลใน browser และ payload
                    </p>
                  </div>
                </div>
              </div>
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
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ชื่อครูผู้สอน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setWorkspaceForm((current) => ({ ...current, teacherName: event.target.value }))}
                    placeholder="เช่น นางสาว..."
                    value={workspaceForm.teacherName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  หัวหน้าวิชาการ
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setWorkspaceForm((current) => ({ ...current, academicHeadName: event.target.value }))}
                    placeholder="ชื่อผู้ตรวจตาราง/รายงาน"
                    value={workspaceForm.academicHeadName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  นายทะเบียนโรงเรียน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setWorkspaceForm((current) => ({ ...current, registrarName: event.target.value }))}
                    placeholder="ชื่อผู้รับรองทะเบียนนักเรียน"
                    value={workspaceForm.registrarName}
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  ผู้อำนวยการโรงเรียน
                  <input
                    className="nexus-field h-11 px-3"
                    onChange={(event) => setWorkspaceForm((current) => ({ ...current, directorName: event.target.value }))}
                    placeholder="ชื่อผู้อำนวยการ"
                    value={workspaceForm.directorName}
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

          <form id="public-report-policy" className="workspace-settings-form scroll-mt-24 nexus-card p-4 sm:p-6 xl:col-span-2" onSubmit={(event) => void savePublicReportPolicy(event)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
                  <Globe2 size={16} aria-hidden="true" />
                  รายงานหน้าแรก
                </div>
                <h3 className="mt-2 text-xl font-black text-slate-950">เปิดให้ค้นหารายงานด้วยโรงเรียน เลขบัตร และวันเกิด</h3>
                <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                  ใช้สำหรับผู้ปกครอง/นักเรียนที่ยังไม่เข้า Portal ระบบแสดงเฉพาะหมวดที่เปิดไว้ และค้นหาด้วย hash ไม่เปิดเลขบัตรจริงในหน้าเว็บ
                </p>
              </div>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                <input
                  checked={publicReportPolicy.enabled}
                  className="h-4 w-4 accent-cyan-600"
                  onChange={(event) => setPublicReportPolicy((current) => ({ ...current, enabled: event.target.checked }))}
                  type="checkbox"
                />
                เปิดใช้งาน
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['attendance', 'เวลาเรียน', 'มา ขาด สาย ลา และรายการล่าสุด'],
                ['scores', 'คะแนน', 'จำนวนชุดคะแนนและค่าเฉลี่ย'],
                ['savings', 'เงินออม', 'ยอดเงินออมคงเหลือ'],
                ['behavior', 'พฤติกรรม/เคสดูแล', 'เชิงบวก ข้อห่วงใย และติดตาม'],
                ['home_visit', 'เยี่ยมบ้าน', 'สถานะและความครบถ้วน กสศ.01'],
                ['guardians', 'ผู้ปกครอง', 'ข้อมูลผู้ปกครองที่โรงเรียนอนุญาต'],
              ].map(([key, label, body]) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-slate-200 bg-white/80 p-4 text-sm shadow-sm"
                  key={key}
                >
                  <input
                    checked={Boolean(publicReportPolicy[key as keyof PublicReportPolicy])}
                    className="mt-1 h-4 w-4 accent-cyan-600"
                    disabled={!publicReportPolicy.enabled}
                    onChange={(event) =>
                      setPublicReportPolicy((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <span className="block font-black text-slate-950">{label}</span>
                    <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{body}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
              ก่อนค้นหาได้ ครูต้องไปที่ Student 360 แล้วแก้นักเรียนเพื่อบันทึกวันเกิดและเลขบัตร 13 หลัก ระบบจะสร้างรหัสค้นหาแบบ hash ให้โดยไม่โชว์เลขบัตรในหน้าเว็บ
            </div>

            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || isLoading}
              type="submit"
            >
              <Save size={17} aria-hidden="true" />
              บันทึกการเปิดรายงานหน้าแรก
            </button>
          </form>
            </>
          )}

          {(activeSettingsTab === 'classrooms' || activeSettingsTab === 'all') && (
          <form className="workspace-settings-form nexus-card p-4 sm:p-5" onSubmit={(event) => void createClassroom(event)}>
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
                <label className="grid gap-2 text-sm font-black text-slate-700 sm:col-span-2">
                  ครูที่ปรึกษา / ประจำชั้นหลัก
                  <select
                    className="nexus-field h-11 px-3"
                    onChange={(event) =>
                      setClassroomForm((current) => ({ ...current, homeroomTeacherProfileId: event.target.value }))
                    }
                    value={classroomForm.homeroomTeacherProfileId}
                  >
                    {activeMembers.map((member) => (
                      <option key={member.profile_id} value={member.profile_id}>
                        ⭐ {member.display_name} ({member.email})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <button
              className="dark-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || isLoading || classroomLimitReached}
              type="submit"
            >
              <Plus size={17} aria-hidden="true" />
              เพิ่มห้องเรียน
            </button>
          </form>
          )}

          {(activeSettingsTab === 'members' || activeSettingsTab === 'all') && (
          <form className="workspace-settings-form nexus-card p-4 sm:p-5" onSubmit={(event) => void addWorkspaceMember(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <UserPlus size={16} aria-hidden="true" />
              เชิญครูเข้า Workspace
            </div>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
              ผู้รับสมัครภายหลังได้และไม่ต้องซื้อ VIP เพิ่ม เพราะใช้แพ็กเกจของ Workspace นี้
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
              <fieldset className="rounded-3xl border border-slate-200 bg-white/70 p-3">
                <legend className="px-2 text-sm font-black text-slate-700">ห้องที่อนุญาต</legend>
                <p className="mb-3 text-xs font-bold leading-5 text-slate-500">ไม่เลือกห้อง = ยังไม่เห็นข้อมูลนักเรียน จัดเพิ่มภายหลังได้</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeClassrooms.map((classroom) => (
                    <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700" key={classroom.id}>
                      <input
                        checked={invitedClassroomIds.includes(classroom.id)}
                        className="h-4 w-4 accent-cyan-600"
                        onChange={(event) => setInvitedClassroomIds((current) => event.target.checked ? [...current, classroom.id] : current.filter((id) => id !== classroom.id))}
                        type="checkbox"
                      />
                      {classroom.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isMemberSubmitting || isLoading || collaboratorLimitReached}
              type="submit"
            >
              <UserPlus size={17} aria-hidden="true" />
              ส่งคำเชิญ
            </button>

            {teacherInvitations.length > 0 ? (
              <div className="mt-4 grid gap-2">
                <p className="text-xs font-black text-slate-500">คำเชิญที่รอรับ</p>
                {teacherInvitations.map((invitation) => (
                  <div className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100 sm:flex-row sm:items-center sm:justify-between" key={invitation.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{invitation.invite_email}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{roleLabels[invitation.role]} · {invitation.assigned_classroom_ids.length} ห้อง · หมดอายุ {new Date(invitation.expires_at).toLocaleDateString('th-TH')}</p>
                    </div>
                    <button className="h-9 rounded-xl bg-white px-3 text-xs font-black text-rose-700 ring-1 ring-rose-100" disabled={isMemberSubmitting} onClick={() => void revokeTeacherInvitation(invitation)} type="button">ยกเลิก</button>
                  </div>
                ))}
              </div>
            ) : null}
          </form>
          )}
        </div>

        {(activeSettingsTab === 'classrooms' || activeSettingsTab === 'all') && (
        <section id="workspace-classrooms" className={`workspace-classroom-panel scroll-mt-24 nexus-card p-4 sm:p-5 ${
          activeSettingsTab === 'classrooms' ? 'xl:col-span-4' : 'xl:sticky xl:top-24 xl:col-span-4'
        }`}>
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
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-black text-cyan-800">ครูที่ปรึกษา:</span>
                      <select
                        className="h-8 max-w-[210px] truncate rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white disabled:opacity-60"
                        disabled={isSubmitting || !canUseDestructiveActions}
                        onChange={(event) => void setClassroomHomeroomTeacher(classroom, event.target.value || null)}
                        value={classroom.homeroom_teacher_profile_id || ''}
                      >
                        <option value="">-- ยังไม่ระบุครูที่ปรึกษา --</option>
                        {activeMembers.map((member) => (
                          <option key={member.profile_id} value={member.profile_id}>
                            ⭐ {member.display_name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                      onClick={() => {
                        setClassroomDeleteStrategy('archive');
                        setPendingClassroomDelete(classroom);
                      }}
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
        )}
      </section>

      {(activeSettingsTab === 'members' || activeSettingsTab === 'all') && (
        <>
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

          {canUseDestructiveActions && useRealBackend ? <MemberAccessControl classrooms={activeClassrooms} session={session} /> : null}

          {memberNotice ? (
            <div className="mt-5 flex gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/90 p-3 text-sm font-bold leading-6 text-cyan-900 shadow-sm">
              <Users className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
              <p>{memberNotice}</p>
            </div>
          ) : null}
        </>
      )}

      {(activeSettingsTab === 'profile' || activeSettingsTab === 'classrooms' || activeSettingsTab === 'all') && (
        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          {(activeSettingsTab === 'profile' || activeSettingsTab === 'all') && (
            <div id="workspace-backup" className={`scroll-mt-24 nexus-card p-4 sm:p-5 ${activeSettingsTab === 'profile' ? 'xl:col-span-2' : ''}`}>
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
          )}

          {(activeSettingsTab === 'classrooms' || activeSettingsTab === 'all') && (
            <div id="workspace-rollover" className={`scroll-mt-24 nexus-card p-4 sm:p-5 ${activeSettingsTab === 'classrooms' ? 'xl:col-span-2' : ''}`}>
              <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
                <RotateCcw size={17} aria-hidden="true" />
                Academic Year Rollover
              </div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">ระบบเลื่อนชั้นเรียนข้ามปีการศึกษา</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                ระบบจัดการย้ายข้อมูลนักเรียนข้ามปีการศึกษาจริง พร้อมระบบความปลอดภัยสูงสุด: สร้าง Snapshot สำรองข้อมูลเดิมอัตโนมัติก่อนย้าย และสามารถสั่งย้อนกลับ (Undo) เพื่อคืนสภาพเดิมได้ภายใน 7 วัน
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  to="/app/dashboard?view=classroom-operations&tab=rollover"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-teal-600 px-5 text-sm font-black text-white shadow-md shadow-cyan-500/25 transition-all hover:scale-105 hover:shadow-lg"
                >
                  <GraduationCap size={18} />
                  <span>เปิดระบบเลื่อนชั้นเรียน (Promotion Wizard) →</span>
                </Link>
                <button
                  className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
                  onClick={exportRolloverPlan}
                  type="button"
                >
                  <Download size={16} aria-hidden="true" />
                  <span>ดาวน์โหลดแผนสำรอง JSON</span>
                </button>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-black text-slate-600">
                  ปีการศึกษาเดิม (สำหรับ Export)
                  <input
                    className="nexus-field h-10 px-3 text-xs"
                    onChange={(event) => setRolloverForm((current) => ({ ...current, fromYear: event.target.value }))}
                    value={rolloverForm.fromYear}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-black text-slate-600">
                  ปีการศึกษาถัดไป (สำหรับ Export)
                  <input
                    className="nexus-field h-10 px-3 text-xs"
                    onChange={(event) => setRolloverForm((current) => ({ ...current, toYear: event.target.value }))}
                    value={rolloverForm.toYear}
                  />
                </label>
              </div>
            </div>
          )}
        </section>
      )}

      {(activeSettingsTab === 'profile' || activeSettingsTab === 'all') && canUseDestructiveActions ? (
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

      {pendingClassroomDelete ? (
        <div
          aria-labelledby="delete-classroom-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700">
                  <Trash2 size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">ลบห้องเรียนถาวร</p>
                  <h2 className="mt-1 text-xl font-black text-slate-950" id="delete-classroom-title">
                    {pendingClassroomDelete.name}
                  </h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                    ห้องนี้มีนักเรียน {classroomStudentCounts[pendingClassroomDelete.id] || 0} คน กรุณาเลือกวิธีจัดการรายชื่อก่อนลบห้อง
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 sm:p-6">
              <label className={`cursor-pointer rounded-2xl border p-4 transition ${classroomDeleteStrategy === 'archive' ? 'border-cyan-400 bg-cyan-50 ring-2 ring-cyan-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className="flex items-start gap-3">
                  <input
                    checked={classroomDeleteStrategy === 'archive'}
                    className="mt-1 h-4 w-4 accent-cyan-600"
                    name="classroom-student-strategy"
                    onChange={() => setClassroomDeleteStrategy('archive')}
                    type="radio"
                    value="archive"
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-950">เก็บนักเรียนเป็นประวัติ (แนะนำ)</span>
                    <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">
                      นักเรียนจะไม่แสดงในยอดกำลังเรียน ข้อมูลประจำตัวยังคงอยู่และสามารถกู้คืนสถานะได้
                    </span>
                  </span>
                </span>
              </label>

              <label className={`cursor-pointer rounded-2xl border p-4 transition ${classroomDeleteStrategy === 'detach' ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <span className="flex items-start gap-3">
                  <input
                    checked={classroomDeleteStrategy === 'detach'}
                    className="mt-1 h-4 w-4 accent-amber-600"
                    name="classroom-student-strategy"
                    onChange={() => setClassroomDeleteStrategy('detach')}
                    type="radio"
                    value="detach"
                  />
                  <span>
                    <span className="block text-sm font-black text-slate-950">ย้ายไป “ยังไม่ผูกห้อง”</span>
                    <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">
                      นักเรียนยังเป็นกำลังเรียนและยังถูกนับใน Dashboard เพื่อรอจัดเข้าห้องใหม่
                    </span>
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => setPendingClassroomDelete(null)}
                type="button"
              >
                ยกเลิก
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-700 px-4 text-sm font-black text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => void deleteClassroomPermanently(pendingClassroomDelete, classroomDeleteStrategy)}
                type="button"
              >
                <Trash2 size={16} aria-hidden="true" />
                {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันลบห้องเรียน'}
              </button>
            </div>
          </div>
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
