import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, UserPlus } from 'lucide-react';

import { buildRoadmap, dashboardStats, studentWatchlist } from '../../data/dashboard';
import { quickActions } from '../../data/quickActions';
import { HeroPanel } from '../../components/dashboard/HeroPanel';
import { PackageCard } from '../../components/dashboard/PackageCard';
import { QuickActionsPanel } from '../../components/dashboard/QuickActionsPanel';
import { RoadmapPanel } from '../../components/dashboard/RoadmapPanel';
import { SecurityPanel } from '../../components/dashboard/SecurityPanel';
import { StatsGrid } from '../../components/dashboard/StatsGrid';
import { StudentWatchlist } from '../../components/dashboard/StudentWatchlist';
import { Topbar } from '../../components/dashboard/Topbar';
import { canManageWorkspace } from '../../lib/roles';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface DashboardPageProps {
  activeLabel: string;
  activeModules: number;
  badges: string[];
  copy: {
    eyebrow: string;
    title: string;
    body: string;
  };
  entitlementLabel: string;
  guardPreview: Array<{ label: string; passed: boolean }>;
  initialRoute: string;
  isModuleEnabled: boolean;
  session: AppSessionContext;
  supabaseStatus: string;
}

interface WorkspaceMemberSummaryRow {
  status: string;
}

export function DashboardPage({
  activeLabel,
  activeModules,
  badges,
  copy,
  entitlementLabel,
  guardPreview,
  initialRoute,
  isModuleEnabled,
  session,
  supabaseStatus,
}: DashboardPageProps) {
  const canManageBilling = canManageWorkspace(session.profile.role);
  const [stats, setStats] = useState(dashboardStats);
  const [pendingJoinRequestCount, setPendingJoinRequestCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      if (!supabase || !session.workspace) {
        setStats(dashboardStats);
        return;
      }

      const [
        { count: studentCount },
        { count: classroomCount },
        { count: careCaseCount },
        { data: savingsRows },
      ] = await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active'),
        supabase
          .from('classrooms')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active'),
        supabase
          .from('student_care_cases')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', session.workspace.id)
          .in('status', ['open', 'monitoring']),
        supabase
          .from('savings_accounts')
          .select('balance')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active'),
      ]);

      if (!isMounted) return;

      const savingsBalance = (savingsRows || []).reduce(
        (sum, row) => sum + Number((row as { balance?: number | string | null }).balance || 0),
        0,
      );

      setStats([
        {
          ...dashboardStats[0],
          detail: session.workspace.classroomName,
          value: String(studentCount ?? 0),
        },
        {
          ...dashboardStats[1],
          detail: 'ห้อง active',
          label: 'ห้องเรียน',
          value: String(classroomCount ?? 0),
        },
        {
          ...dashboardStats[2],
          detail: 'open / monitoring',
          value: String(careCaseCount ?? 0),
        },
        {
          ...dashboardStats[3],
          value: savingsBalance.toLocaleString('th-TH', { maximumFractionDigits: 0 }),
        },
      ]);
    }

    void loadDashboardStats();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  useEffect(() => {
    let isMounted = true;

    async function loadPendingJoinRequests() {
      if (!supabase || !session.workspace || !canManageBilling) {
        setPendingJoinRequestCount(0);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_workspace_members', {
          target_workspace_id: session.workspace.id,
        })
        .returns<WorkspaceMemberSummaryRow[]>();

      if (!isMounted) return;

      if (error) {
        setPendingJoinRequestCount(0);
        return;
      }

      const memberRows = Array.isArray(data) ? (data as WorkspaceMemberSummaryRow[]) : [];
      setPendingJoinRequestCount(memberRows.filter((member) => member.status === 'invited').length);
    }

    void loadPendingJoinRequests();

    return () => {
      isMounted = false;
    };
  }, [canManageBilling, session.workspace]);

  return (
    <main className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
      <Topbar
        badges={badges}
        canSwitchWorkspace={['superadmin', 'teacher_owner', 'teacher_member'].includes(session.profile.role)}
        workspace={session.workspace}
      />

      <HeroPanel
        activeModules={activeModules}
        canManageBilling={canManageBilling}
        copy={copy}
        initialRoute={initialRoute}
        supabaseStatus={supabaseStatus}
      />

      <StatsGrid stats={stats} />

      {canManageBilling && pendingJoinRequestCount > 0 ? (
        <section className="mt-5 rounded-[1.75rem] border border-sky-100 bg-sky-50/80 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 ring-1 ring-sky-100">
                <UserPlus size={22} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-sky-700">Workspace Approval</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  มีครูขอเข้า workspace {pendingJoinRequestCount} รายการ
                </h2>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                  ตรวจชื่อและอีเมลก่อนอนุมัติ เพื่อให้ข้อมูลห้องเรียนเปิดเฉพาะครูในโรงเรียนของคุณ
                </p>
              </div>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5"
              to="/app/dashboard?view=workspace-settings"
            >
              ไปอนุมัติ
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <QuickActionsPanel actions={quickActions} />
        <StudentWatchlist students={studentWatchlist} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SecurityPanel
          activeLabel={activeLabel}
          entitlementLabel={entitlementLabel}
          guardPreview={guardPreview}
          isModuleEnabled={isModuleEnabled}
        />
        <PackageCard />
      </section>

      <RoadmapPanel items={buildRoadmap} />

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
