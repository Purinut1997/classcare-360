import { type FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, CheckCircle2, Clock3, GraduationCap, Plus, School } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { roleLabels } from '../../lib/roles';
import { setStoredActiveWorkspaceId } from '../../lib/session';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext, WorkspaceRole } from '../../types/core';

interface WorkspaceSetupPageProps {
  session: AppSessionContext;
}

interface WorkspaceOption {
  academicYear: string;
  classroomName: string;
  id: string;
  membershipStatus?: WorkspaceAccessStatus | null;
  name: string;
  ownerEmail?: string;
  ownerName?: string;
  role?: Exclude<WorkspaceRole, 'superadmin'>;
  schoolName: string;
}

type WorkspaceAccessStatus = 'invited' | 'active' | 'suspended' | 'removed';

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

interface JoinableWorkspaceRow {
  academic_year: string | null;
  classroom_name: string | null;
  membership_role: Exclude<WorkspaceRole, 'superadmin'> | null;
  membership_status: WorkspaceAccessStatus | null;
  name: string;
  owner_display_name: string | null;
  owner_email: string | null;
  school_name: string | null;
  workspace_id: string;
}

const demoWorkspaces: WorkspaceOption[] = [
  {
    academicYear: '2569',
    classroomName: 'ป.5/2',
    id: 'demo-workspace',
    name: 'ห้องเรียนตัวอย่าง',
    schoolName: 'โรงเรียนตัวอย่าง ClassCare',
  },
  {
    academicYear: '2569',
    classroomName: 'ป.4/1',
    id: 'demo-workspace-2',
    name: 'ห้องเรียนรออัปเกรด',
    schoolName: 'โรงเรียนตัวอย่าง ClassCare',
  },
];

function normalizeSchoolName(value: string | null | undefined) {
  return (value || '').trim().toLocaleLowerCase('th-TH').replace(/\s+/g, ' ');
}

export function WorkspaceSetupPage({ session }: WorkspaceSetupPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preferredSchoolName = session.profile.schoolName || session.workspace?.schoolName || '';
  const [workspaceName, setWorkspaceName] = useState('ห้องเรียนของฉัน');
  const [schoolName, setSchoolName] = useState(preferredSchoolName || 'โรงเรียนตัวอย่าง ClassCare');
  const [academicYear, setAcademicYear] = useState('2569');
  const [classroomName, setClassroomName] = useState('ป.5/2');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceOption[]>(demoWorkspaces);
  const [joinableWorkspaces, setJoinableWorkspaces] = useState<WorkspaceOption[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(Boolean(supabase));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestingWorkspaceId, setRequestingWorkspaceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: การสร้าง workspace จริงต้อง insert ผ่าน Supabase และ RLS',
  );

  const demoQuery = searchParams.get('demo');
  const dashboardTarget = demoQuery && !supabase ? `/app/dashboard?demo=${demoQuery}` : '/app/dashboard';
  const canCreateWorkspace = session.profile.role === 'teacher_owner' || session.profile.role === 'superadmin';
  const canRequestWorkspaceAccess = session.profile.role === 'teacher_owner' || session.profile.role === 'teacher_member';

  useEffect(() => {
    if (preferredSchoolName) {
      setSchoolName(preferredSchoolName);
    }
  }, [preferredSchoolName]);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspaces() {
      if (!supabase) {
        setAvailableWorkspaces(demoWorkspaces);
        setIsLoadingWorkspaces(false);
        return;
      }

      setIsLoadingWorkspaces(true);

      const [{ data, error }, { data: joinableRows, error: joinableError }] = await Promise.all([
        supabase
          .from('workspace_memberships')
          .select('workspace_id,role,workspaces(id,name,school_name,academic_year,settings)')
          .eq('profile_id', session.profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .returns<MembershipWorkspaceRow[]>(),
        supabase.rpc('list_joinable_school_workspaces').returns<JoinableWorkspaceRow[]>(),
      ]);

      if (!isMounted) return;

      if (error) {
        setNotice(error.message);
        setAvailableWorkspaces([]);
        setJoinableWorkspaces([]);
        setIsLoadingWorkspaces(false);
        return;
      }

      const profileSchoolKey = normalizeSchoolName(preferredSchoolName);
      const allWorkspaces = (data || [])
        .filter((membership) => membership.workspaces)
        .map((membership) => ({
          academicYear: membership.workspaces?.academic_year || 'ยังไม่ได้ระบุปีการศึกษา',
          classroomName: membership.workspaces?.settings?.classroom_name || 'ยังไม่ได้ระบุห้องเรียน',
          id: membership.workspace_id,
          name: membership.workspaces?.name || 'ไม่ระบุ workspace',
          role: membership.role,
          schoolName: membership.workspaces?.school_name || 'ยังไม่ได้ระบุโรงเรียน',
        }));
      const nextWorkspaces = profileSchoolKey
        ? allWorkspaces.filter((workspace) => normalizeSchoolName(workspace.schoolName) === profileSchoolKey)
        : allWorkspaces;

      if (profileSchoolKey && allWorkspaces.length > nextWorkspaces.length) {
        setNotice(`แสดงเฉพาะ workspace ของโรงเรียน ${preferredSchoolName} ตามข้อมูล profile`);
      }

      if (joinableError) {
        setNotice(`ยังโหลดคำขอเข้า workspace ไม่ได้: ${joinableError.message} | โปรดรัน tmp/supabase-workspace-join-requests.sql`);
        setJoinableWorkspaces([]);
      } else {
        const activeIds = new Set(nextWorkspaces.map((workspace) => workspace.id));
        const joinableWorkspaceRows = Array.isArray(joinableRows) ? (joinableRows as JoinableWorkspaceRow[]) : [];
        const nextJoinableWorkspaces = joinableWorkspaceRows
          .filter((workspace) => !activeIds.has(workspace.workspace_id))
          .map((workspace) => ({
            academicYear: workspace.academic_year || 'ยังไม่ได้ระบุปีการศึกษา',
            classroomName: workspace.classroom_name || 'ยังไม่ได้ระบุห้องเรียน',
            id: workspace.workspace_id,
            membershipStatus: workspace.membership_status,
            name: workspace.name || 'ไม่ระบุ workspace',
            ownerEmail: workspace.owner_email || '-',
            ownerName: workspace.owner_display_name || 'ไม่ระบุเจ้าของ',
            role: workspace.membership_role || undefined,
            schoolName: workspace.school_name || 'ยังไม่ได้ระบุโรงเรียน',
          }));
        setJoinableWorkspaces(nextJoinableWorkspaces);
      }

      setAvailableWorkspaces(nextWorkspaces);
      setIsLoadingWorkspaces(false);
    }

    void loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [preferredSchoolName, session.profile.id]);

  function handleSelectWorkspace(workspace: WorkspaceOption) {
    setStoredActiveWorkspaceId(workspace.id);

    if (!supabase) {
      navigate(dashboardTarget);
      return;
    }

    window.location.assign('/app/dashboard');
  }

  async function requestWorkspaceAccess(workspace: WorkspaceOption) {
    setRequestingWorkspaceId(workspace.id);
    setNotice(null);

    if (!supabase) {
      setJoinableWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? { ...item, membershipStatus: 'invited' } : item)),
      );
      setNotice('โหมดตัวอย่าง: ส่งคำขอเข้า workspace แล้ว เจ้าของ workspace จะต้องอนุมัติก่อนใช้งานจริง');
      setRequestingWorkspaceId(null);
      return;
    }

    const { error } = await supabase.rpc('request_workspace_access', {
      target_workspace_id: workspace.id,
    });

    if (error) {
      const message = error.message.includes('school_mismatch')
        ? 'ขอเข้าไม่ได้: workspace นี้ไม่ได้อยู่โรงเรียนเดียวกับข้อมูล profile'
        : error.message.includes('profile_school_required')
          ? 'กรุณากรอกชื่อโรงเรียนใน Complete Profile ก่อนขอเข้า workspace'
          : error.message.includes('membership_suspended')
            ? 'บัญชีนี้ถูกพักสิทธิ์ใน workspace นี้ โปรดติดต่อเจ้าของ workspace'
            : error.message.includes('workspace_archived')
              ? 'workspace นี้ถูกเก็บถาวรแล้ว'
              : error.message.includes('Could not find the function') || error.message.includes('function')
                ? 'ยังไม่ได้ติดตั้งระบบขอเข้า workspace โปรดรัน tmp/supabase-workspace-join-requests.sql ใน Supabase SQL Editor'
                : error.message;
      setNotice(message);
      setRequestingWorkspaceId(null);
      return;
    }

    setJoinableWorkspaces((current) =>
      current.map((item) => (item.id === workspace.id ? { ...item, membershipStatus: 'invited' } : item)),
    );
    setNotice(`ส่งคำขอเข้า ${workspace.name} แล้ว รอเจ้าของ workspace อนุมัติก่อนเข้าใช้งาน`);
    setRequestingWorkspaceId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!supabase) {
      setNotice(`โหมดตัวอย่าง: เตรียมสร้าง ${workspaceName} (${classroomName}/${academicYear}) แล้ว`);
      setIsSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setNotice(userError?.message || 'กรุณาเข้าสู่ระบบก่อนสร้าง workspace');
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

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: cleanedWorkspaceName,
        school_name: cleanedSchoolName,
        owner_profile_id: user.id,
        academic_year: cleanedAcademicYear,
        settings: {
          classroom_name: cleanedClassroomName,
        },
      })
      .select('id')
      .single();

    if (workspaceError) {
      setNotice(workspaceError.message);
      setIsSubmitting(false);
      return;
    }

    const { error: membershipError } = await supabase.from('workspace_memberships').insert({
      workspace_id: workspace.id,
      profile_id: user.id,
      role: 'teacher_owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

    if (membershipError) {
      setNotice(membershipError.message);
      setIsSubmitting(false);
      return;
    }

    const { data: trialPlan, error: planError } = await supabase
      .from('plans')
      .select('id')
      .eq('code', 'TRIAL_30')
      .single();

    if (planError || !trialPlan) {
      setNotice(planError?.message || 'ไม่พบแผน TRIAL_30 โปรดรัน supabase/seed.sql');
      setIsSubmitting(false);
      return;
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const { error: subscriptionError } = await supabase.from('subscriptions').insert({
      workspace_id: workspace.id,
      profile_id: user.id,
      plan_id: trialPlan.id,
      status: 'trial',
      starts_at: new Date().toISOString(),
      ends_at: trialEndsAt.toISOString(),
      trial_used: true,
      source: 'onboarding',
    });

    if (subscriptionError) {
      setNotice(subscriptionError.message);
      setIsSubmitting(false);
      return;
    }

    setNotice('สร้าง workspace และเปิดทดลองใช้ 30 วันสำเร็จ');
    setIsSubmitting(false);
    setStoredActiveWorkspaceId(workspace.id);
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
            {preferredSchoolName ? (
              <p className="mt-2 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-black text-cyan-800 ring-1 ring-cyan-100">
                แสดงเฉพาะ workspace ของ {preferredSchoolName}
              </p>
            ) : null}
          </div>

          <Link className="dark-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" to={dashboardTarget}>
            เข้าแดชบอร์ด
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className={`mt-6 grid gap-5 ${canCreateWorkspace ? 'lg:grid-cols-[minmax(0,1fr)_410px]' : ''}`}>
          <div className="grid gap-3">
            {isLoadingWorkspaces ? (
              <div className="glass-panel rounded-[2rem] p-5 text-sm font-black text-slate-600">
                กำลังโหลด workspace ที่คุณมีสิทธิ์ใช้งาน...
              </div>
            ) : null}

            {!isLoadingWorkspaces && availableWorkspaces.length === 0 && joinableWorkspaces.length === 0 ? (
              <div className="glass-panel rounded-[2rem] p-5 text-sm font-black leading-6 text-slate-600">
                {preferredSchoolName
                  ? `ยังไม่มี workspace ของ ${preferredSchoolName} ที่ผูกกับบัญชีนี้ สร้าง workspace ใหม่ทางฟอร์มด้านขวาเพื่อเริ่มใช้งาน`
                  : 'ยังไม่มี workspace ที่ผูกกับบัญชีนี้ สร้าง workspace ใหม่ทางฟอร์มด้านขวาเพื่อเริ่มใช้งาน'}
              </div>
            ) : null}

            {!isLoadingWorkspaces && availableWorkspaces.map((workspace) => (
              <article className="glass-panel rounded-[2rem] p-5 transition hover:-translate-y-1 hover:shadow-[0_28px_64px_rgba(14,165,233,0.16)]" key={workspace.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-cyan-700">{workspace.schoolName}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{workspace.name}</h2>
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

            {!isLoadingWorkspaces && canRequestWorkspaceAccess && joinableWorkspaces.length > 0 ? (
              <section className="glass-panel rounded-[2rem] p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                    <Clock3 size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-950">ขอเข้า workspace ของโรงเรียนนี้</h2>
                    <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                      ส่งคำขอแล้วต้องรอเจ้าของ workspace อนุมัติก่อน ระบบจะยังไม่เปิดข้อมูลห้องเรียนให้บัญชีนี้
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {joinableWorkspaces.map((workspace) => {
                    const isPending = workspace.membershipStatus === 'invited';
                    const isBlocked = workspace.membershipStatus === 'suspended';

                    return (
                      <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={workspace.id}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-cyan-700">{workspace.schoolName}</p>
                            <h3 className="mt-1 truncate text-lg font-black text-slate-950">{workspace.name}</h3>
                            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                              ห้อง {workspace.classroomName} | ปี {workspace.academicYear} | เจ้าของ {workspace.ownerName}
                            </p>
                          </div>
                          <button
                            className={`inline-flex h-11 shrink-0 items-center justify-center rounded-2xl px-4 text-sm font-black transition ${
                              isPending
                                ? 'border border-amber-100 bg-amber-50 text-amber-700'
                                : isBlocked
                                  ? 'border border-slate-200 bg-slate-100 text-slate-400'
                                  : 'bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:-translate-y-0.5'
                            }`}
                            disabled={Boolean(requestingWorkspaceId) || isPending || isBlocked}
                            onClick={() => void requestWorkspaceAccess(workspace)}
                            type="button"
                          >
                            {requestingWorkspaceId === workspace.id
                              ? 'กำลังส่งคำขอ'
                              : isPending
                                ? 'รออนุมัติ'
                                : isBlocked
                                  ? 'ถูกพักสิทธิ์'
                                  : 'ขอเข้าร่วม'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
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
              <h2 className="mt-4 text-2xl font-black text-slate-950">บัญชีนี้รอรับสิทธิ์จากเจ้าของ workspace</h2>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                บทบาท {roleLabels[session.profile.role]} ไม่สามารถสร้าง workspace เองได้ ต้องให้เจ้าของ workspace หรือผู้ดูแลระบบเพิ่มสิทธิ์ก่อน ระบบจึงจะแสดงห้องเรียนหรือรายงานที่เกี่ยวข้อง
              </p>
              <Link
                className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                to="/auth/complete-profile"
              >
                กลับไปตรวจ profile
              </Link>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
