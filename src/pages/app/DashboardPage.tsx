import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  HeartHandshake,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { dashboardStats, studentWatchlist } from '../../data/dashboard';
import { canManageWorkspace } from '../../lib/roles';
import { supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';
import { StatsGrid } from '../../components/dashboard/StatsGrid';
import { StudentWatchlist } from '../../components/dashboard/StudentWatchlist';

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

const todayTasks = [
  {
    detail: 'บันทึกสถานะนักเรียนก่อนเริ่มงานช่วงเช้า',
    icon: CalendarClock,
    label: 'เช็กเวลาเรียนประจำวัน',
    path: '/app/dashboard?view=teacher-work',
    status: 'ทำตอนนี้',
    tone: 'text-rose-700 bg-rose-50',
  },
  {
    detail: 'ตรวจรายการคะแนนที่ยังกรอกไม่ครบ',
    icon: ClipboardList,
    label: 'ตรวจและกรอกคะแนน',
    path: '/app/dashboard?view=scores&scoreView=entry',
    status: 'รอตรวจ',
    tone: 'text-sky-700 bg-sky-50',
  },
  {
    detail: 'ทบทวนนักเรียนที่มีสถานะติดตาม',
    icon: HeartHandshake,
    label: 'ติดตามเคสดูแลนักเรียน',
    path: '/app/dashboard?view=students&studentView=care',
    status: '3 คน',
    tone: 'text-amber-700 bg-amber-50',
  },
  {
    detail: 'ดูสรุปประจำเดือนก่อนส่งฝ่ายบริหาร',
    icon: FileSpreadsheet,
    label: 'ตรวจรายงานประจำเดือน',
    path: '/app/dashboard?view=reports&reportView=attendance',
    status: 'ตรวจสอบ',
    tone: 'text-teal-700 bg-teal-50',
  },
];

export function DashboardPage({ session }: DashboardPageProps) {
  const canManageCurrentWorkspace = canManageWorkspace(session.profile.role);
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
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active'),
        supabase.from('classrooms').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).eq('status', 'active'),
        supabase.from('student_care_cases').select('id', { count: 'exact', head: true }).eq('workspace_id', session.workspace.id).in('status', ['open', 'monitoring']),
        supabase.from('savings_accounts').select('balance').eq('workspace_id', session.workspace.id).eq('status', 'active'),
      ]);

      if (!isMounted) return;

      const savingsBalance = (savingsRows || []).reduce(
        (sum, row) => sum + Number((row as { balance?: number | string | null }).balance || 0),
        0,
      );

      setStats([
        { ...dashboardStats[0], detail: session.workspace.classroomName, value: String(studentCount ?? 0) },
        { ...dashboardStats[1], detail: 'ห้องที่กำลังใช้งาน', label: 'ห้องเรียน', value: String(classroomCount ?? 0) },
        { ...dashboardStats[2], detail: 'เปิดอยู่และกำลังติดตาม', value: String(careCaseCount ?? 0) },
        { ...dashboardStats[3], value: savingsBalance.toLocaleString('th-TH', { maximumFractionDigits: 0 }) },
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
      if (!supabase || !session.workspace || !canManageCurrentWorkspace) {
        setPendingJoinRequestCount(0);
        return;
      }

      const { data, error } = await supabase
        .rpc('get_workspace_members', { target_workspace_id: session.workspace.id })
        .returns<WorkspaceMemberSummaryRow[]>();

      if (!isMounted) return;
      if (error) {
        setPendingJoinRequestCount(0);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setPendingJoinRequestCount(rows.filter((member) => member.status === 'invited').length);
    }

    void loadPendingJoinRequests();
    return () => {
      isMounted = false;
    };
  }, [canManageCurrentWorkspace, session.workspace]);

  return (
    <main className="app-page">
      <div className="app-page-header">
        <div>
          <p className="text-sm font-black text-cyan-700">ภาพรวมการทำงาน</p>
          <h1 className="app-page-title">ภาพรวมวันนี้</h1>
          <p className="app-page-description">
            {session.workspace?.schoolName || 'โรงเรียน'} · {session.workspace?.classroomName || 'ยังไม่ได้เลือกห้อง'} · งานสำคัญที่ควรจัดการก่อน
          </p>
        </div>
        <Link
          className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black"
          to="/app/dashboard?view=teacher-work"
        >
          <CalendarClock size={18} aria-hidden="true" />
          เช็กเวลาเรียน
        </Link>
      </div>

      <StatsGrid stats={stats} />

      {pendingJoinRequestCount > 0 ? (
        <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-sky-700">
            <UserPlus size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-950">มีคำขอเข้าร่วม Workspace {pendingJoinRequestCount} รายการ</p>
            <p className="mt-0.5 text-xs font-bold text-slate-600">ตรวจชื่อ อีเมล และสิทธิ์ก่อนอนุมัติ</p>
          </div>
          <Link className="text-sm font-black text-sky-800" to="/app/dashboard?view=workspace-settings">
            ตรวจคำขอ <ArrowRight className="inline" size={15} aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <article className="app-panel-pad">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-cyan-700">TODAY</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">งานที่ต้องทำวันนี้</h2>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{todayTasks.length} รายการ</span>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {todayTasks.map((task, index) => {
              const Icon = task.icon;
              return (
                <Link className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={task.label} to={task.path}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                    {index + 1}
                  </span>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-amber-50 group-hover:text-amber-700">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-black text-slate-900">{task.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">{task.detail}</span>
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${task.tone}`}>{task.status}</span>
                  <ArrowRight className="text-slate-300 group-hover:text-slate-700" size={17} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </article>

        <StudentWatchlist students={studentWatchlist} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="app-panel-pad">
          <div className="flex items-center gap-2">
            <Clock3 className="text-cyan-700" size={19} aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">ตารางวันนี้</h2>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {[
              ['08:30–09:30', 'โฮมรูมและเช็กชื่อ', 'ห้องประจำชั้น'],
              ['09:30–10:30', 'คณิตศาสตร์', 'ป.5/1'],
              ['10:30–11:30', 'วิทยาศาสตร์', 'ป.5/1'],
            ].map(([time, subject, room]) => (
              <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0" key={`${time}-${subject}`}>
                <span className="text-xs font-black text-slate-500">{time}</span>
                <span className="font-black text-slate-900">{subject}</span>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{room}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="app-panel-pad">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={19} aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">ความพร้อมของห้องเรียน</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {['มีรายชื่อนักเรียนในห้อง', 'ตั้งค่าตารางสอนแล้ว', 'พร้อมสร้างรายงานประจำเดือน'].map((item) => (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800" key={item}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
