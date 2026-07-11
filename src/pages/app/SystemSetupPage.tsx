import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  KeyRound,
  ServerCog,
  ShieldCheck,
} from 'lucide-react';

import { appEnv, hasSupabaseConfig } from '../../lib/env';
import { canManageWorkspace, roleLabels } from '../../lib/roles';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface SystemSetupPageProps {
  session: AppSessionContext;
}

type CheckStatus = 'checking' | 'manual' | 'pass' | 'pending' | 'warn';

interface CheckItem {
  detail: string;
  id: string;
  label: string;
  status: CheckStatus;
}

const migrationChecklist = [
  '0001_core_foundation.sql',
  '0002_student_care_cases.sql',
  '0003_student_home_visits.sql',
  '0004_home_visit_photo_storage.sql',
  '0005_teacher_audit_logs.sql',
  '0006_teacher_audit_log_read.sql',
  '0007_scorebook_foundation.sql',
  '0008_savings_behavior_foundation.sql',
  '0009_randomizer_foundation.sql',
  '0010_api_grants.sql',
  '0010_payment_slip_storage.sql',
  '0011_admin_lifetime_access.sql',
  '0012_workspace_member_admin.sql',
  '0013_payment_qr_storage.sql',
  '0014_workspace_join_requests.sql',
];

const edgeFunctionChecklist = [
  'approve-payment-request',
  'accept-portal-invitation',
  'dispatch-notification',
];

const storageBucketChecklist = [
  {
    detail: 'รูปเยี่ยมบ้าน กสศ.01 แบบ private แยก path ด้วย workspace_id',
    id: 'home-visit-photos',
    label: 'home-visit-photos',
  },
  {
    detail: 'สลิปชำระเงินแบบ private สำหรับ owner/superadmin เท่านั้น',
    id: 'payment-slips',
    label: 'payment-slips',
  },
  {
    detail: 'ไฟล์ QR/payment asset สำหรับ superadmin จัดการ',
    id: 'payment-qr-codes',
    label: 'payment-qr-codes',
  },
];

const serverSecretChecklist = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'ENCRYPTION_KEY',
];

const deployCommandChecklist = [
  'npm.cmd run check:deploy',
  'supabase link --project-ref <project-ref>',
  'supabase db push',
  'supabase functions deploy approve-payment-request',
  'supabase functions deploy accept-portal-invitation',
  'supabase functions deploy dispatch-notification',
  'supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...',
];

const statusStyles: Record<CheckStatus, string> = {
  checking: 'bg-sky-50 text-sky-700 ring-sky-100',
  manual: 'bg-violet-50 text-violet-700 ring-violet-100',
  pass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  pending: 'bg-slate-100 text-slate-600 ring-slate-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-100',
};

const statusLabels: Record<CheckStatus, string> = {
  checking: 'กำลังตรวจ',
  manual: 'ตรวจเอง',
  pass: 'พร้อม',
  pending: 'รอดำเนินการ',
  warn: 'ควรตรวจ',
};

function statusIcon(status: CheckStatus) {
  if (status === 'pass') return <CheckCircle2 size={17} aria-hidden="true" />;
  if (status === 'warn') return <AlertTriangle size={17} aria-hidden="true" />;
  return <ClipboardCheck size={17} aria-hidden="true" />;
}

export function SystemSetupPage({ session }: SystemSetupPageProps) {
  const canManageCurrentWorkspace = canManageWorkspace(session.profile.role);
  const [liveChecks, setLiveChecks] = useState<CheckItem[]>([
    {
      detail: 'รอโหลดสถานะจาก frontend environment',
      id: 'startup',
      label: 'เริ่มตรวจระบบ',
      status: 'checking',
    },
  ]);

  const staticChecks = useMemo<CheckItem[]>(
    () => [
      {
        detail: hasSupabaseConfig()
          ? `ตั้งค่า VITE_SUPABASE_URL แล้ว (${appEnv.supabaseUrl.replace(/^https?:\/\//, '').slice(0, 32)}...)`
          : 'ยังไม่มี VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY ใน .env.local',
        id: 'supabase-env',
        label: 'Supabase frontend env',
        status: hasSupabaseConfig() ? 'pass' : 'warn',
      },
      {
        detail: session.workspace
          ? `${session.workspace.schoolName || session.workspace.name} | ปีการศึกษา ${session.workspace.academicYear}`
          : 'ยังไม่มี active workspace',
        id: 'workspace',
        label: 'Active workspace',
        status: session.workspace ? 'pass' : 'warn',
      },
      {
        detail: `${roleLabels[session.profile.role]}${canManageCurrentWorkspace ? ' | จัดการ workspace ได้' : ' | อ่านตามสิทธิ์ที่ได้รับ'}`,
        id: 'workspace-role',
        label: 'Workspace role',
        status: canManageCurrentWorkspace ? 'pass' : 'warn',
      },
    ],
    [canManageCurrentWorkspace, session.profile.role, session.workspace],
  );

  useEffect(() => {
    let isMounted = true;

    async function runLiveChecks() {
      if (!supabase || !session.workspace) {
        setLiveChecks([
          {
            detail: 'ยังไม่เชื่อม Supabase จริง จึงแสดงเป็น checklist สำหรับเตรียม deploy',
            id: 'supabase-client',
            label: 'Supabase client',
            status: isSupabaseReady ? 'warn' : 'pending',
          },
        ]);
        return;
      }

      const activeSupabase = supabase;
      const tableChecks: Array<{ id: string; label: string; table: string }> = [
        { id: 'classrooms-table', label: 'classrooms table + RLS', table: 'classrooms' },
        { id: 'workspace-memberships-table', label: 'workspace_memberships table + RLS', table: 'workspace_memberships' },
        { id: 'students-table', label: 'students table + RLS', table: 'students' },
        { id: 'home-visits-table', label: 'student_home_visits table + RLS', table: 'student_home_visits' },
        { id: 'audit-logs-table', label: 'audit_logs table + RLS', table: 'audit_logs' },
        { id: 'notifications-table', label: 'notifications table + RLS', table: 'notifications' },
        { id: 'score-assessments-table', label: 'score_assessments table + RLS', table: 'score_assessments' },
        { id: 'savings-accounts-table', label: 'savings_accounts table + RLS', table: 'savings_accounts' },
        { id: 'behavior-records-table', label: 'behavior_records table + RLS', table: 'behavior_records' },
        { id: 'randomizer-sessions-table', label: 'randomizer_sessions table + RLS', table: 'randomizer_sessions' },
      ];

      const tableResults = await Promise.all(
        tableChecks.map(async (check) => {
          const { error } = await activeSupabase
            .from(check.table)
            .select('id')
            .eq('workspace_id', session.workspace?.id || '')
            .limit(1);

          return {
            detail: error ? error.message : 'query ผ่านโดยใช้ workspace_id และ RLS',
            id: check.id,
            label: check.label,
            status: error ? 'warn' : 'pass',
          } satisfies CheckItem;
        }),
      );

      const storageResults = await Promise.all(
        storageBucketChecklist.map(async (bucket) => {
          const { error } = await activeSupabase.storage.from(bucket.id).list(session.workspace?.id || '', { limit: 1 });

          return {
            detail: error ? error.message : `bucket ${bucket.id} พร้อมใช้งานตาม policy`,
            id: `${bucket.id}-storage`,
            label: `${bucket.label} storage`,
            status: error ? 'warn' : 'pass',
          } satisfies CheckItem;
        }),
      );

      const [{ error: memberRpcError }, { error: joinableRpcError }] = await Promise.all([
        activeSupabase.rpc('get_workspace_members', {
          target_workspace_id: session.workspace.id,
        }),
        activeSupabase.rpc('list_joinable_school_workspaces'),
      ]);

      const rpcResults: CheckItem[] = [
        {
          detail: memberRpcError
            ? `${memberRpcError.message} | โปรดรัน 0012_workspace_member_admin.sql`
            : 'owner/superadmin โหลดสมาชิกและคำขอรออนุมัติได้',
          id: 'workspace-member-admin-rpc',
          label: 'workspace member admin RPC',
          status: memberRpcError ? 'warn' : 'pass',
        },
        {
          detail: joinableRpcError
            ? `${joinableRpcError.message} | โปรดรัน 0014_workspace_join_requests.sql`
            : 'ครูค้นหา workspace โรงเรียนเดียวกันและส่งคำขอเข้า workspace ได้',
          id: 'workspace-join-request-rpc',
          label: 'workspace join request RPC',
          status: joinableRpcError ? 'warn' : 'pass',
        },
      ];

      if (!isMounted) return;

      setLiveChecks([
        ...tableResults,
        ...storageResults,
        ...rpcResults,
      ]);
    }

    void runLiveChecks();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  const allChecks = [...staticChecks, ...liveChecks];
  const passedCount = allChecks.filter((item) => item.status === 'pass').length;
  const readinessPercent = Math.round((passedCount / allChecks.length) * 100);

  function exportReadinessReport() {
    const report = {
      app: appEnv.appName,
      checkedAt: new Date().toISOString(),
      deployCommands: deployCommandChecklist,
      edgeFunctions: edgeFunctionChecklist,
      migrations: migrationChecklist,
      readinessPercent,
      serverSecrets: serverSecretChecklist,
      session: {
        role: session.profile.role,
        workspaceId: session.workspace?.id || null,
        workspaceName: session.workspace?.name || null,
      },
      status: allChecks,
      storageBuckets: storageBucketChecklist.map((bucket) => bucket.id),
      timezone: appEnv.timezone,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `classcare-readiness-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
      <section className="nexus-card overflow-hidden p-0">
        <div className="bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/20">
                <ServerCog size={15} aria-hidden="true" />
                System Readiness
              </div>
              <h1 className="mt-4 text-3xl font-black sm:text-4xl">
                ตรวจความพร้อมก่อนใช้งานจริง
              </h1>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-slate-300">
                รวมจุดที่ต้องตรวจเมื่อย้ายเครื่องหรือ deploy: env, workspace, role, migrations, storage, RLS และ Edge Functions ของระบบหลัก
              </p>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-cyan-50"
              onClick={exportReadinessReport}
              type="button"
            >
              Export report
              <Download size={17} aria-hidden="true" />
            </button>
            <div className="rounded-3xl bg-white p-4 text-slate-950 shadow-[0_22px_55px_rgba(14,165,233,0.18)]">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Readiness</p>
              <p className="mt-1 text-4xl font-black">{readinessPercent}%</p>
              <p className="text-xs font-bold text-slate-500">{passedCount}/{allChecks.length} checks passed</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
          {allChecks.map((item) => (
            <article className="rounded-3xl bg-white/85 p-4 ring-1 ring-slate-100" key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                  {statusIcon(item.status)}
                  {item.label}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusStyles[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="nexus-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <Database size={18} className="text-sky-600" aria-hidden="true" />
            Migration order
          </div>
          <div className="mt-4 grid gap-3">
            {migrationChecklist.map((migration, index) => (
              <div className="flex items-center justify-between gap-3 rounded-3xl bg-white/85 p-3 ring-1 ring-slate-100" key={migration}>
                <div>
                  <p className="text-sm font-black text-slate-950">{migration}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">ลำดับที่ {index + 1}</p>
                </div>
                <FileCode2 size={18} className="text-slate-400" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <section className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Database size={18} className="text-cyan-600" aria-hidden="true" />
              Storage buckets
            </div>
            <div className="mt-4 grid gap-3">
              {storageBucketChecklist.map((bucket) => (
                <div className="rounded-3xl bg-white/85 p-3 ring-1 ring-slate-100" key={bucket.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{bucket.label}</p>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-100">
                      private
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{bucket.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <ShieldCheck size={18} className="text-emerald-600" aria-hidden="true" />
              Edge Functions
            </div>
            <div className="mt-4 grid gap-3">
              {edgeFunctionChecklist.map((functionName) => (
                <div className="rounded-3xl bg-white/85 p-3 ring-1 ring-slate-100" key={functionName}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{functionName}</p>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700 ring-1 ring-violet-100">
                      deploy/test
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                    ต้อง deploy ด้วย Supabase CLI และตั้งค่า secret ฝั่ง Functions ก่อนใช้งานจริง
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-950">
              <KeyRound size={18} className="text-amber-600" aria-hidden="true" />
              Production secrets
            </div>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-slate-600">
              <p>ห้ามใส่ service role, LINE token, Telegram token หรือ Google secret ใน frontend</p>
              <p>ตั้งค่า secret ทั้งหมดใน Supabase Functions หรือ Cloudflare environment เท่านั้น</p>
              <div className="grid gap-2">
                {serverSecretChecklist.map((secret) => (
                  <code className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-cyan-100" key={secret}>
                    {secret}
                  </code>
                ))}
              </div>
              <a
                className="inline-flex items-center gap-2 text-sm font-black text-sky-700"
                href="/app/dashboard?view=students"
              >
                ไปตรวจ Student 360
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </section>

      <section className="nexus-card mt-5 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-black text-slate-950">
          <FileCode2 size={18} className="text-violet-600" aria-hidden="true" />
          Deployment command order
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {deployCommandChecklist.map((command, index) => (
            <div className="rounded-3xl bg-slate-950 p-4 text-cyan-50" key={command}>
              <p className="text-xs font-black uppercase text-cyan-300">Step {index + 1}</p>
              <code className="mt-2 block overflow-x-auto whitespace-nowrap text-sm font-black">{command}</code>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm font-bold leading-6 text-slate-500">
          คำสั่งนี้เป็นลำดับแนะนำสำหรับ deploy จริง ต้องรันในเครื่องที่ติดตั้ง Supabase CLI และ login project แล้ว
        </p>
      </section>
    </main>
  );
}
