import { type FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, CheckCircle2, GraduationCap, Pencil, Plus, Save, School, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { NexusAuroraLoader } from '../../components/system/NexusAuroraLoader';
import { demoWorkspaceQueryKey } from '../../lib/auth';
import { roleLabels } from '../../lib/roles';
import { activateWorkspace, setStoredActiveWorkspaceId } from '../../lib/session';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext, WorkspaceRole } from '../../types/core';

interface WorkspaceSetupPageProps {
  session: AppSessionContext;
}

interface WorkspaceOption {
  academicYear: string;
  classroomName: string;
  id: string;
  name: string;
  role?: Exclude<WorkspaceRole, 'superadmin'>;
  schoolName: string;
}

interface MembershipWorkspaceRow {
  role: Exclude<WorkspaceRole, 'superadmin'>;
  workspace_id: string;
  workspaces: {
    academic_year: string | null;
    id: string;
    name: string;
    school_name: string | null;
    settings: {
      classroom_name?: string;
    } | null;
  } | null;
}

interface TeacherInvitationRow {
  assigned_classroom_ids: string[];
  created_at: string;
  expires_at: string;
  invitation_id: string;
  role: 'teacher_member' | 'viewer';
  school_name: string;
  workspace_id: string;
  workspace_name: string;
}

const demoWorkspaces: WorkspaceOption[] = [
  {
    academicYear: '2569',
    classroomName: 'ป.5/2',
    id: 'demo-workspace',
    name: 'ห้องเรียนตัวอย่าง',
    role: 'teacher_owner',
    schoolName: 'โรงเรียนตัวอย่าง ClassCare',
  },
  {
    academicYear: '2569',
    classroomName: 'ป.4/1',
    id: 'demo-workspace-2',
    name: 'Workspace ครูร่วม',
    role: 'teacher_member',
    schoolName: 'โรงเรียนชุมชนบ้านสวน',
  },
];

const demoTeacherInvitations: TeacherInvitationRow[] = [{
  assigned_classroom_ids: ['demo-classroom'],
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  invitation_id: 'demo-teacher-invitation',
  role: 'teacher_member',
  school_name: 'โรงเรียนตัวอย่าง ClassCare',
  workspace_id: 'demo-invited-workspace',
  workspace_name: 'Workspace ครูประจำชั้น',
}];

export function WorkspaceSetupPage({ session }: WorkspaceSetupPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const demoQuery = searchParams.get('demo');
  const demoWorkspaceId = searchParams.get(demoWorkspaceQueryKey);
  const isDevelopmentDemo = import.meta.env.DEV && demoQuery !== null;
  const useRealBackend = Boolean(supabase) && !isDevelopmentDemo;
  const preferredSchoolName = session.profile.schoolName || session.workspace?.schoolName || '';
  const [workspaceName, setWorkspaceName] = useState('ห้องเรียนของฉัน');
  const [schoolName, setSchoolName] = useState(preferredSchoolName || 'โรงเรียนตัวอย่าง ClassCare');
  const [academicYear, setAcademicYear] = useState('2569');
  const [classroomName, setClassroomName] = useState('ป.5/2');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceOption[]>(demoWorkspaces);
  const [teacherInvitations, setTeacherInvitations] = useState<TeacherInvitationRow[]>(
    demoQuery === 'no-workspace' ? demoTeacherInvitations : [],
  );
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(Boolean(useRealBackend));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestingWorkspaceId, setRequestingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: การสร้าง workspace จริงต้อง insert ผ่าน Supabase และ RLS',
  );

  const dashboardTarget = demoQuery
    ? `/app/dashboard?${new URLSearchParams({
        demo: demoQuery,
        ...(demoWorkspaceId ? { [demoWorkspaceQueryKey]: demoWorkspaceId } : {}),
      }).toString()}`
    : '/app/dashboard';
  const canCreateWorkspace = session.profile.role === 'superadmin'
    || (session.profile.role === 'teacher_owner' && !session.primaryWorkspaceId);

  useEffect(() => {
    if (preferredSchoolName) {
      setSchoolName(preferredSchoolName);
    }
  }, [preferredSchoolName]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaces() {
      if (!useRealBackend || !supabase) {
        setAvailableWorkspaces(demoQuery === 'no-workspace' ? [] : demoWorkspaces);
        setTeacherInvitations(demoQuery === 'no-workspace' ? demoTeacherInvitations : []);
        setIsLoadingWorkspaces(false);
        return;
      }

      setIsLoadingWorkspaces(true);

      const [
        { data, error },
        { data: invitationRows, error: invitationError },
      ] = await Promise.all([
        supabase
          .from('workspace_memberships')
          .select('workspace_id,role,workspaces(id,name,school_name,academic_year,settings)')
          .eq('profile_id', session.profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .returns<MembershipWorkspaceRow[]>(),
        supabase.rpc('list_my_workspace_teacher_invitations').returns<TeacherInvitationRow[]>(),
      ]);

      if (!isMounted) return;

      if (error) {
        setNotice(error.message);
        setAvailableWorkspaces([]);
        setIsLoadingWorkspaces(false);
        return;
      }

      const allWorkspaces = (data || [])
        .filter((membership) => membership.workspaces)
        .map((membership) => ({
          academicYear: membership.workspaces?.academic_year || 'ยังไม่ได้ระบุปีการศึกษา',
          classroomName: membership.workspaces?.settings?.classroom_name || 'ยังไม่ได้ระบุห้องเรียน',
          id: membership.workspace_id,
          name: membership.workspaces?.name || 'ไม่ระบุ workspace',
          role: membership.role,
          schoolName: membership.workspaces?.school_name || 'ยังไม่ได้ระบุโรงเรียน',
        }))
        .sort((left, right) => {
          const leftPrimary = left.id === session.primaryWorkspaceId ? 0 : 1;
          const rightPrimary = right.id === session.primaryWorkspaceId ? 0 : 1;
          if (leftPrimary !== rightPrimary) return leftPrimary - rightPrimary;
          return `${left.schoolName} ${left.name}`.localeCompare(`${right.schoolName} ${right.name}`, 'th');
        });

      if (invitationError) {
        setNotice(`ยังโหลดคำเชิญครูไม่ได้: ${invitationError.message}`);
        setTeacherInvitations([]);
      } else {
        setTeacherInvitations((invitationRows || []) as TeacherInvitationRow[]);
      }

      setAvailableWorkspaces(allWorkspaces);
      setIsLoadingWorkspaces(false);
    }

    void loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [demoQuery, session.primaryWorkspaceId, session.profile.id, useRealBackend]);

  async function handleSelectWorkspace(workspace: WorkspaceOption) {
    if (!useRealBackend || !supabase) {
      setStoredActiveWorkspaceId(workspace.id, session.profile.id);
      const params = new URLSearchParams(searchParams);
      params.set('demo', demoQuery || 'teacher');
      params.set(demoWorkspaceQueryKey, workspace.id);
      params.delete('view');
      navigate(`/app/dashboard?${params.toString()}`);
      return;
    }

    try {
      await activateWorkspace(session.profile.id, workspace.id);
      window.location.assign('/app/dashboard');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'สลับพื้นที่ทำงานไม่สำเร็จ');
    }
  }

  async function saveWorkspaceName(workspace: WorkspaceOption) {
    const nextName = editingWorkspaceName.trim();
    if (!nextName) {
      setNotice('กรุณากรอกชื่อ workspace');
      return;
    }
    if (!useRealBackend || !supabase) {
      setAvailableWorkspaces((current) => current.map((item) => item.id === workspace.id ? { ...item, name: nextName } : item));
      setEditingWorkspaceId(null);
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from('workspaces').update({ name: nextName }).eq('id', workspace.id);
    if (error) setNotice(`เปลี่ยนชื่อ workspace ไม่สำเร็จ: ${error.message}`);
    else {
      setAvailableWorkspaces((current) => current.map((item) => item.id === workspace.id ? { ...item, name: nextName } : item));
      setNotice(`เปลี่ยนชื่อ workspace เป็น “${nextName}” แล้ว`);
      setEditingWorkspaceId(null);
    }
    setIsSubmitting(false);
  }

  async function acceptTeacherInvitation(invitation: TeacherInvitationRow) {
    setRequestingWorkspaceId(invitation.workspace_id);
    setNotice(null);
    if (!useRealBackend || !supabase) {
      setTeacherInvitations((current) => current.filter((item) => item.invitation_id !== invitation.invitation_id));
      setNotice('รับคำเชิญในโหมดตัวอย่างแล้ว คุณใช้ VIP ของ Workspace โดยไม่ต้องสมัครเพิ่ม');
      setRequestingWorkspaceId(null);
      return;
    }
    const { error } = await supabase.rpc('accept_workspace_teacher_invitation', {
      target_invitation_id: invitation.invitation_id,
    });
    if (error) {
      const messages: Record<string, string> = {
        invitation_email_mismatch: 'คำเชิญนี้ไม่ได้ส่งถึงอีเมลของบัญชีปัจจุบัน',
        invitation_expired: 'คำเชิญนี้หมดอายุแล้ว กรุณาให้เจ้าของ Workspace ส่งใหม่',
        invitation_not_pending: 'คำเชิญนี้ถูกรับหรือยกเลิกไปแล้ว',
      };
      setNotice(messages[error.message] || error.message);
      setRequestingWorkspaceId(null);
      return;
    }
    try {
      await activateWorkspace(session.profile.id, invitation.workspace_id);
      window.location.assign('/app/dashboard');
    } catch (activateError) {
      setNotice(activateError instanceof Error ? activateError.message : 'รับคำเชิญแล้ว แต่เปิด Workspace ไม่สำเร็จ');
      setRequestingWorkspaceId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!useRealBackend || !supabase) {
      setNotice(`โหมดตัวอย่าง: เตรียมสร้าง ${workspaceName} (${classroomName}/${academicYear}) แล้ว`);
      setIsSubmitting(false);
      return;
    }

    const cleanedWorkspaceName = workspaceName.trim();
    const cleanedSchoolName = (preferredSchoolName || schoolName).trim();
    const cleanedAcademicYear = academicYear.trim();
    const cleanedClassroomName = classroomName.trim();

    if (!cleanedWorkspaceName || !cleanedSchoolName || !cleanedAcademicYear || !cleanedClassroomName) {
      setNotice('กรุณากรอกชื่อ workspace โรงเรียน ปีการศึกษา และห้องเรียนให้ครบ');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc('create_primary_workspace', {
      workspace_name: cleanedWorkspaceName,
      school_name: cleanedSchoolName,
      academic_year: cleanedAcademicYear,
      first_classroom_name: cleanedClassroomName,
      school_code: null,
    });

    if (error) {
      const message = error.message.includes('workspace_owner_limit_reached')
        ? 'บัญชีนี้มี Workspace หลักอยู่แล้ว สามารถเพิ่มห้องหรือรับคำเชิญเข้าโรงเรียนอื่นได้'
        : error.message.includes('workspace_fields_required')
          ? 'กรุณากรอกข้อมูลโรงเรียนและห้องแรกให้ครบ'
          : error.message;
      setNotice(message);
      setIsSubmitting(false);
      return;
    }

    const result = data as { trial_days?: number | null; workspace_id?: string } | null;
    if (!result?.workspace_id) {
      setNotice('สร้างพื้นที่ทำงานไม่สำเร็จ: ฐานข้อมูลไม่คืน Workspace ใหม่');
      setIsSubmitting(false);
      return;
    }

    setNotice(
      result.trial_days
        ? `สร้างพื้นที่ทำงานและเปิดทดลองใช้ ${result.trial_days} วันสำเร็จ`
        : 'สร้างพื้นที่ทำงานสำเร็จ',
    );
    setIsSubmitting(false);
    setStoredActiveWorkspaceId(result.workspace_id, session.profile.id);
    window.location.assign('/app/dashboard');
  }

  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-7 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex h-11 items-center gap-2 rounded-full bg-cyan-50 px-4 text-sm font-black text-cyan-800 ring-1 ring-cyan-100">
              <Building2 size={18} aria-hidden="true" />
              Workspace
            </div>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl">
              เลือกหรือสร้าง workspace
            </h1>
            <p className="mt-3 max-w-2xl text-base font-bold leading-8 text-slate-600">
              {session.profile.displayName} | {session.profile.email}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-black text-cyan-800 ring-1 ring-cyan-100">
              Workspace หลัก 1 แห่ง · เข้าร่วมแห่งอื่นได้เมื่อได้รับคำเชิญ
            </p>
          </div>

          <Link className="dark-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" to={dashboardTarget}>
            เข้าแดชบอร์ด
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className={`mt-6 grid gap-5 ${canCreateWorkspace ? 'lg:grid-cols-[minmax(0,1fr)_410px]' : ''}`}>
          <div className="grid gap-3">
            {isLoadingWorkspaces ? (
              <NexusAuroraLoader message="กำลังตรวจสอบโรงเรียน ห้องเรียน และสิทธิ์ของบัญชีนี้" title="กำลังโหลด Workspace" />
            ) : null}

            {!isLoadingWorkspaces && teacherInvitations.map((invitation) => (
              <article className="rounded-[2rem] border border-amber-200 bg-amber-50/90 p-5 shadow-sm" key={invitation.invitation_id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black text-amber-700">คำเชิญจาก Workspace</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">{invitation.workspace_name}</h2>
                    <p className="mt-2 text-sm font-bold text-slate-600">{invitation.school_name} · {roleLabels[invitation.role]} · {invitation.assigned_classroom_ids.length} ห้อง</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">รับแล้วใช้สิทธิ์ Free/VIP ของ Workspace นี้ทันที ไม่ต้องซื้อ VIP แยก</p>
                  </div>
                  <button className="blue-action inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black" disabled={requestingWorkspaceId === invitation.workspace_id} onClick={() => void acceptTeacherInvitation(invitation)} type="button">
                    {requestingWorkspaceId === invitation.workspace_id ? 'กำลังรับคำเชิญ' : 'รับคำเชิญ'}
                  </button>
                </div>
              </article>
            ))}

            {!isLoadingWorkspaces && availableWorkspaces.length === 0 && teacherInvitations.length === 0 ? (
              <div className="glass-panel rounded-[2rem] p-5 text-sm font-black leading-6 text-slate-600">
                ยังไม่มี Workspace ที่ผูกกับบัญชีนี้ เจ้าของสร้าง Workspace หลักได้ 1 แห่ง ส่วนครูร่วมให้รอรับคำเชิญจากเจ้าของ
              </div>
            ) : null}

            {!isLoadingWorkspaces && availableWorkspaces.map((workspace) => (
              <article className="glass-panel rounded-[2rem] p-5 transition hover:-translate-y-1 hover:shadow-[0_28px_64px_rgba(14,165,233,0.16)]" key={workspace.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-cyan-700">{workspace.schoolName}</p>
                    {editingWorkspaceId === workspace.id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          className="h-11 min-w-[240px] flex-1 rounded-2xl border border-cyan-300 bg-white px-4 text-lg font-black text-slate-950 outline-none ring-4 ring-cyan-100"
                          onChange={(event) => setEditingWorkspaceName(event.target.value)}
                          value={editingWorkspaceName}
                        />
                        <button className="blue-action inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-black" disabled={isSubmitting} onClick={() => void saveWorkspaceName(workspace)} type="button"><Save size={16} /> บันทึก</button>
                        <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-600" onClick={() => setEditingWorkspaceId(null)} type="button"><X size={16} /> ยกเลิก</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <h2 className="text-2xl font-black tracking-tight text-slate-950">{workspace.name}</h2>
                        {(session.profile.role === 'superadmin' || workspace.role === 'teacher_owner') ? (
                          <button aria-label="เปลี่ยนชื่อ workspace" className="inline-grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-cyan-300 hover:text-cyan-700" onClick={() => { setEditingWorkspaceId(workspace.id); setEditingWorkspaceName(workspace.name); }} title="เปลี่ยนชื่อ workspace" type="button"><Pencil size={16} /></button>
                        ) : null}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                        <CalendarDays size={14} aria-hidden="true" />
                        {workspace.academicYear}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                        <GraduationCap size={14} aria-hidden="true" />
                        {workspace.classroomName}
                      </span>
                      {workspace.role ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                          {roleLabels[workspace.role]}
                        </span>
                      ) : null}
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1 ${workspace.id === session.primaryWorkspaceId ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-violet-50 text-violet-700 ring-violet-100'}`}>
                        {workspace.id === session.primaryWorkspaceId ? 'Workspace หลัก' : 'เข้าร่วมผ่านคำเชิญ'}
                      </span>
                    </div>
                  </div>
                  <button
                    className="blue-action inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black"
                    onClick={() => handleSelectWorkspace(workspace)}
                    type="button"
                  >
                    เลือก
                  </button>
                </div>
              </article>
            ))}

          </div>

          {canCreateWorkspace ? (
          <form className="glass-panel rounded-[2rem] p-5" onSubmit={handleSubmit}>
            <div className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-3 text-xs font-black text-cyan-100">
              <Plus size={16} aria-hidden="true" />
              New Workspace
            </div>
            <div className="mt-4 flex gap-3 rounded-3xl bg-gradient-to-r from-sky-50 to-cyan-50 p-3 ring-1 ring-sky-100">
              <CheckCircle2 className="mt-0.5 shrink-0 text-sky-700" size={18} aria-hidden="true" />
              <p className="text-xs font-bold leading-6 text-sky-900">
                สร้าง workspace ใหม่แล้วบัญชีนี้จะเป็นทั้งครูผู้ใช้งานและเจ้าของ workspace เหมาะกับโรงเรียนหรือห้องเรียนที่มีครูใช้งานคนเดียว
              </p>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-black text-slate-700">
                ชื่อ workspace
                <input
                  className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  value={workspaceName}
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-slate-700">
                โรงเรียน
                <span className="relative block">
                  <School className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-4 text-base font-bold outline-none transition read-only:bg-slate-50 read-only:text-slate-600 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    onChange={(event) => setSchoolName(event.target.value)}
                    placeholder="เช่น โรงเรียนตัวอย่าง ClassCare"
                    readOnly={Boolean(preferredSchoolName)}
                    value={schoolName}
                  />
                </span>
                {preferredSchoolName ? (
                  <span className="text-xs font-bold leading-5 text-slate-500">
                    ใช้ชื่อโรงเรียนจาก profile เพื่อกันไม่ให้สร้าง workspace ข้ามโรงเรียน
                  </span>
                ) : (
                  <span className="text-xs font-bold leading-5 text-slate-500">
                    ตัวอย่าง: โรงเรียนตัวอย่าง ClassCare ควรใช้ชื่อเดียวกับตอนสมัครเพื่อให้ระบบเลือก workspace ได้ถูกต้อง
                  </span>
                )}
              </label>

              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <label className="grid min-w-0 gap-2 text-sm font-black text-slate-700">
                  ปีการศึกษา
                  <input
                    className="h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    onChange={(event) => setAcademicYear(event.target.value)}
                    value={academicYear}
                  />
                </label>

                <label className="grid min-w-0 gap-2 text-sm font-black text-slate-700">
                  ห้องเรียน
                  <input
                    className="h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    onChange={(event) => setClassroomName(event.target.value)}
                    value={classroomName}
                  />
                </label>
              </div>
            </div>

            {notice ? (
              <div className="mt-4 flex gap-3 rounded-3xl bg-gradient-to-r from-sky-50 to-cyan-50 p-3 ring-1 ring-sky-100">
                <CheckCircle2 className="mt-0.5 shrink-0 text-sky-700" size={18} aria-hidden="true" />
                <p className="text-sm font-bold leading-6 text-sky-900">{notice}</p>
              </div>
            ) : null}

            <button
              className="blue-action mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'กำลังสร้าง workspace' : 'สร้าง workspace'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          ) : (
            <aside className="glass-panel rounded-[2rem] p-5">
              <div className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-3 text-xs font-black text-cyan-100">
                <Building2 size={16} aria-hidden="true" />
                Workspace Access
              </div>
              {session.primaryWorkspaceId ? (
                <>
                  <h2 className="mt-4 text-2xl font-black text-slate-950">บัญชีนี้มี Workspace หลักแล้ว</h2>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                    เจ้าของมี Workspace หลักได้ 1 แห่ง ให้เลือกจากรายการด้านซ้าย หรือเข้าแดชบอร์ดเพื่อเพิ่มห้อง เชิญครู หรือจัดการสิทธิ์
                  </p>
                  <Link
                    className="blue-action mt-5 inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-black"
                    to={dashboardTarget}
                  >
                    เข้าแดชบอร์ด
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-2xl font-black text-slate-950">บัญชีนี้รอรับคำเชิญจากเจ้าของ Workspace</h2>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                    บทบาท {roleLabels[session.profile.role]} ไม่สามารถสร้าง Workspace เองได้ เจ้าของต้องเชิญด้วยอีเมลและกำหนดห้องที่อนุญาต เมื่อรับคำเชิญแล้วจึงจะเห็นข้อมูลตามสิทธิ์
                  </p>
                  <Link
                    className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                    to="/auth/complete-profile"
                  >
                    กลับไปตรวจ profile
                  </Link>
                </>
              )}
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
