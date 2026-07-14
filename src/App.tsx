import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';

import {
  getInitialRouteForSession,
  getPostAuthRouteForSession,
  getRouteGuardPreview,
} from './lib/auth';
import { appEnv } from './lib/env';
import { canUseModule, getEntitlementSummary } from './lib/entitlements';
import { canManageWorkspace, roleLabels } from './lib/roles';
import { useAppSession } from './lib/session';
import { isSupabaseReady } from './lib/supabaseClient';
import { AppLogo } from './components/brand/AppLogo';
import { AppShell } from './layouts/AppShell';
import { appNavItems, appViewCopy, superadminNavItem } from './routes/appRoutes';
import { RequireRouteAccess } from './routes/RouteGuards';
import './styles/globals.css';
import type { AppSessionContext, WorkspaceRole } from './types/core';

const CompleteProfilePage = lazy(() =>
  import('./pages/auth/CompleteProfilePage').then((module) => ({ default: module.CompleteProfilePage })),
);
const LoginPage = lazy(() =>
  import('./pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const LandingPage = lazy(() =>
  import('./pages/marketing/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const PricingPage = lazy(() =>
  import('./pages/auth/PricingPage').then((module) => ({ default: module.PricingPage })),
);
const AuditCenterPage = lazy(() =>
  import('./pages/app/AuditCenterPage').then((module) => ({ default: module.AuditCenterPage })),
);
const AttendancePage = lazy(() =>
  import('./pages/app/AttendancePage').then((module) => ({ default: module.AttendancePage })),
);
const DashboardPage = lazy(() =>
  import('./pages/app/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const ImportExportPage = lazy(() =>
  import('./pages/app/ImportExportPage').then((module) => ({ default: module.ImportExportPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/app/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const PackagePage = lazy(() =>
  import('./pages/app/PackagePage').then((module) => ({ default: module.PackagePage })),
);
const ReportsPage = lazy(() =>
  import('./pages/app/ReportsPage').then((module) => ({ default: module.ReportsPage })),
);
const ScoresPage = lazy(() =>
  import('./pages/app/ScoresPage').then((module) => ({ default: module.ScoresPage })),
);
const SavingsPage = lazy(() =>
  import('./pages/app/SavingsPage').then((module) => ({ default: module.SavingsPage })),
);
const BehaviorPage = lazy(() =>
  import('./pages/app/BehaviorPage').then((module) => ({ default: module.BehaviorPage })),
);
const RandomizerPage = lazy(() =>
  import('./pages/app/RandomizerPage').then((module) => ({ default: module.RandomizerPage })),
);
const StudentsPage = lazy(() =>
  import('./pages/app/StudentsPage').then((module) => ({ default: module.StudentsPage })),
);
const SystemSetupPage = lazy(() =>
  import('./pages/app/SystemSetupPage').then((module) => ({ default: module.SystemSetupPage })),
);
const WorkspaceSettingsPage = lazy(() =>
  import('./pages/app/WorkspaceSettingsPage').then((module) => ({ default: module.WorkspaceSettingsPage })),
);
const WorkspaceSetupPage = lazy(() =>
  import('./pages/app/WorkspaceSetupPage').then((module) => ({ default: module.WorkspaceSetupPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const PortalHome = lazy(() =>
  import('./pages/portal/PortalHome').then((module) => ({ default: module.PortalHome })),
);
const PortalInvitationsPage = lazy(() =>
  import('./pages/portal/PortalInvitationsPage').then((module) => ({ default: module.PortalInvitationsPage })),
);
const SuperadminDashboard = lazy(() =>
  import('./pages/superadmin/SuperadminDashboard').then((module) => ({ default: module.SuperadminDashboard })),
);

const workspaceSelectionRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner', 'teacher_member', 'viewer'];
const classroomUserRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner', 'teacher_member'];
const reportViewerRoles: WorkspaceRole[] = ['superadmin', 'teacher_owner', 'teacher_member', 'viewer'];

function getAppShellNavItems(session: AppSessionContext | null) {
  if (!session) return appNavItems.filter((item) => item.key === 'overview');

  const navKeysByRole: Record<WorkspaceRole, string[]> = {
    parent: [],
    student: [],
    viewer: ['overview', 'reports'],
    teacher_member: [
      'overview',
      'students',
      'teacher-work',
      'scores',
      'savings',
      'behavior',
      'randomizer',
      'reports',
      'notifications',
      'workspace-switch',
    ],
    teacher_owner: [
      'overview',
      'students',
      'teacher-work',
      'scores',
      'savings',
      'behavior',
      'randomizer',
      'reports',
      'import-export',
      'notifications',
      'workspace-settings',
      'workspace-switch',
    ],
    superadmin: [
      'overview',
      'students',
      'teacher-work',
      'scores',
      'savings',
      'behavior',
      'randomizer',
      'reports',
      'import-export',
      'notifications',
      'workspace-settings',
      'workspace-switch',
      'setup',
      'audit',
    ],
  };

  const allowedKeys = new Set(navKeysByRole[session.profile.role]);
  const visibleItems = appNavItems.filter((item) => allowedKeys.has(item.key));

  return session.profile.role === 'superadmin' ? [...visibleItems, superadminNavItem] : visibleItems;
}

function getAllowedRolesForNavItem(key: string) {
  if (key === 'reports') return reportViewerRoles;
  if (key === 'audit') return ['superadmin'] as WorkspaceRole[];
  if (key === 'setup' || key === 'superadmin-dashboard') return ['superadmin'] as WorkspaceRole[];
  if (key === 'workspace-switch') return workspaceSelectionRoles;
  if (key === 'workspace-settings' || key === 'import-export' || key === 'package') {
    return ['superadmin', 'teacher_owner'] as WorkspaceRole[];
  }

  return classroomUserRoles;
}

function SessionStateScreen({ detail, title }: { detail: string; title: string }) {
  return (
    <main className="classcare-grid-bg flex min-h-screen items-center px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="nexus-card mx-auto max-w-3xl p-6 text-center sm:p-8">
        <AppLogo className="mx-auto h-16 w-16 rounded-2xl bg-white shadow-[0_18px_42px_rgba(2,6,23,0.12)] ring-1 ring-slate-200" />
        <h1 className="mt-5 text-3xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-600">{detail}</p>
        <p className="mt-6 text-xs font-bold text-slate-500">Created by MIKPURINUT</p>
      </section>
    </main>
  );
}

function AppDashboardRoute({ session }: { session: AppSessionContext | null }) {
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view') || 'overview';
  const shellNavItems = getAppShellNavItems(session);
  const routeNavItems = [...appNavItems, superadminNavItem];
  const activeNavItem =
    routeNavItems.find((item) => item.key === requestedView) ?? appNavItems[0];
  const activeCopy = appViewCopy[activeNavItem.key] ?? appViewCopy.overview;
  const allowedRoles = getAllowedRolesForNavItem(activeNavItem.key);

  const guardPreview = useMemo(
    () => (session ? getRouteGuardPreview(session, activeNavItem.moduleKey) : []),
    [activeNavItem.moduleKey, session],
  );

  if (!session) {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        {null}
      </RequireRouteAccess>
    );
  }

  const entitlementSummary = getEntitlementSummary(session.subscription);
  const initialRoute = getInitialRouteForSession(session);
  const canManageCurrentWorkspace = canManageWorkspace(session.profile.role);
  const activeModuleEnabled = canUseModule(session.subscription, activeNavItem.moduleKey);

  const topbarBadges = [
    'Phase 2 Foundation',
    appEnv.timezone,
    roleLabels[session.profile.role],
    canManageCurrentWorkspace ? 'จัดการ workspace ได้' : 'ดูตามสิทธิ์',
  ];

  if (activeNavItem.key === 'students') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <StudentsPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'teacher-work') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <AttendancePage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'reports') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <ReportsPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'scores') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <ScoresPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'savings') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <SavingsPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'behavior') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <BehaviorPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'randomizer') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <RandomizerPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'import-export') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <ImportExportPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'notifications') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <NotificationsPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'setup') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <SystemSetupPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'workspace-settings') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <WorkspaceSettingsPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'audit') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <AuditCenterPage session={session} />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  if (activeNavItem.key === 'superadmin-dashboard') {
    return (
      <RequireRouteAccess
        allowedRoles={allowedRoles}
        featureName={activeNavItem.label}
        moduleKey={activeNavItem.moduleKey}
        session={session}
      >
        <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
          <SuperadminDashboard embedded />
        </AppShell>
      </RequireRouteAccess>
    );
  }

  return (
    <RequireRouteAccess
      allowedRoles={allowedRoles}
      featureName={activeNavItem.label}
      moduleKey={activeNavItem.moduleKey}
      session={session}
    >
      <AppShell activeView={activeNavItem.key} navItems={shellNavItems} session={session}>
        <DashboardPage
          activeLabel={activeNavItem.label}
          activeModules={entitlementSummary.activeModules}
          badges={topbarBadges}
          copy={activeCopy}
          entitlementLabel={entitlementSummary.label}
          guardPreview={guardPreview}
          initialRoute={initialRoute}
          isModuleEnabled={activeModuleEnabled}
          session={session}
          supabaseStatus={isSupabaseReady ? 'เชื่อม Supabase แล้ว' : 'รอ .env.local'}
        />
      </AppShell>
    </RequireRouteAccess>
  );
}

function PackageRoute({ session }: { session: AppSessionContext | null }) {
  return (
    <RequireRouteAccess
      allowedRoles={getAllowedRolesForNavItem('package')}
      featureName="จัดการแพ็กเกจ"
      moduleKey="payment"
      session={session}
    >
      <AppShell activeView="package" navItems={getAppShellNavItems(session)} session={session || undefined}>
        {session ? <PackagePage session={session} /> : null}
      </AppShell>
    </RequireRouteAccess>
  );
}

function WorkspaceSetupRoute({ session }: { session: AppSessionContext | null }) {
  if (!session) {
    return (
      <RequireRouteAccess
        allowedRoles={workspaceSelectionRoles}
        featureName="เลือกหรือสร้าง workspace"
        requireWorkspace={false}
        session={session}
      >
        {null}
      </RequireRouteAccess>
    );
  }

  return (
    <RequireRouteAccess
      allowedRoles={workspaceSelectionRoles}
      featureName="เลือกหรือสร้าง workspace"
      requireWorkspace={false}
      session={session}
    >
      <WorkspaceSetupPage session={session} />
    </RequireRouteAccess>
  );
}

function SuperadminRoute({ session }: { session: AppSessionContext | null }) {
  if (session?.profile.role === 'superadmin') {
    return <Navigate replace to="/app/dashboard?view=superadmin-dashboard" />;
  }

  return (
    <RequireRouteAccess
      allowedRoles={['superadmin']}
      featureName="Superadmin Dashboard"
      requireWorkspace={false}
      session={session}
    >
      {null}
    </RequireRouteAccess>
  );
}

function PortalRoute({
  moduleKey,
  role,
  session,
}: {
  moduleKey: 'parent_portal' | 'student_portal';
  role: 'parent' | 'student';
  session: AppSessionContext | null;
}) {
  return (
    <RequireRouteAccess
      allowedRoles={[role]}
      featureName={role === 'parent' ? 'Parent Portal' : 'Student Portal'}
      moduleKey={moduleKey}
      session={session}
    >
      {session ? <PortalHome portalRole={role} session={session} /> : null}
    </RequireRouteAccess>
  );
}

function PortalInvitationsRoute({ session }: { session: AppSessionContext | null }) {
  return (
    <RequireRouteAccess
      featureName="รับคำเชิญ Portal"
      requireWorkspace={false}
      session={session}
    >
      {session ? <PortalInvitationsPage session={session} /> : null}
    </RequireRouteAccess>
  );
}

function AppRoutes() {
  const location = useLocation();
  const { error, session, state } = useAppSession(location.search);

  if (state === 'loading' && location.pathname !== '/') {
    return (
      <SessionStateScreen
        detail="กำลังตรวจ Supabase Auth, profile, workspace และ subscription เพื่อส่งต่อให้ route guard"
        title="กำลังโหลดข้อมูลผู้ใช้"
      />
    );
  }

  if (state === 'error' && location.pathname !== '/') {
    return (
      <SessionStateScreen
        detail={error || 'ตรวจสอบ .env.local, migration, RLS policy และการเชื่อมต่อ Supabase อีกครั้ง'}
        title="โหลด session ไม่สำเร็จ"
      />
    );
  }

  if (session?.profile.needsProfile && location.pathname !== '/auth/complete-profile') {
    return <Navigate replace to="/auth/complete-profile" />;
  }

  if (session && location.pathname === '/login') {
    const redirectTo = new URLSearchParams(location.search).get('redirect');
    return <Navigate replace to={getPostAuthRouteForSession(session, redirectTo)} />;
  }

  return (
    <Routes>
      <Route element={<LandingPage session={session} />} path="/" />
      <Route element={<LoginPage session={session} />} path="/login" />
      <Route element={<CompleteProfilePage />} path="/auth/complete-profile" />
      <Route element={<PricingPage />} path="/pricing" />
      <Route element={<AppDashboardRoute session={session} />} path="/app/dashboard" />
      <Route element={<WorkspaceSetupRoute session={session} />} path="/app/select-workspace" />
      <Route element={<PackageRoute session={session} />} path="/app/package" />
      <Route element={<SuperadminRoute session={session} />} path="/superadmin/dashboard" />
      <Route element={<PortalInvitationsRoute session={session} />} path="/portal/invitations" />
      <Route element={<PortalRoute moduleKey="parent_portal" role="parent" session={session} />} path="/portal/parent" />
      <Route element={<PortalRoute moduleKey="student_portal" role="student" session={session} />} path="/portal/student" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <SessionStateScreen
            detail="กำลังเปิดหน้าและโหลดโมดูลที่จำเป็นสำหรับการใช้งาน"
            title="กำลังโหลดหน้า"
          />
        }
      >
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

