import type { ReactNode } from 'react';
import { ArrowRight, CalendarCheck2, Check, ClipboardList, Sparkles, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

import { ContextLink as Link } from '../navigation/ContextLink';
import type { DashboardStatItem } from '../../data/dashboard';

export interface DashboardPostItTask {
  detail: string;
  icon: LucideIcon;
  label: string;
  path: string;
  status: string;
}

interface DashboardPostItBoardProps {
  attendanceTrendDelta: number | null;
  classroomControl: ReactNode;
  classroomName: string;
  dateLabel: string;
  displayName: string;
  isHomeroom: boolean;
  schoolName: string;
  stats: DashboardStatItem[];
  tasks: DashboardPostItTask[];
}

const statThemes = [
  { accent: 'border-emerald-200 bg-[#e9fbef] text-emerald-950', icon: '👥', tape: 'border-emerald-100 bg-white/90' },
  { accent: 'border-sky-200 bg-[#edf8ff] text-sky-950', icon: '🏫', tape: 'border-sky-100 bg-white/90' },
  { accent: 'border-violet-200 bg-[#f4efff] text-violet-950', icon: '💜', tape: 'border-violet-100 bg-white/90' },
  { accent: 'border-amber-200 bg-[#fff8d9] text-amber-950', icon: '🌱', tape: 'border-amber-100 bg-white/90' },
];

const taskThemes = [
  { icon: 'bg-emerald-600 shadow-emerald-700/20', note: 'border-emerald-200 bg-[#f2fcf5] hover:border-emerald-300' },
  { icon: 'bg-sky-600 shadow-sky-700/20', note: 'border-sky-200 bg-[#f3faff] hover:border-sky-300' },
  { icon: 'bg-violet-600 shadow-violet-700/20', note: 'border-violet-200 bg-[#f7f4ff] hover:border-violet-300' },
];

export function DashboardPostItBoard({
  attendanceTrendDelta,
  classroomControl,
  classroomName,
  dateLabel,
  displayName,
  isHomeroom,
  schoolName,
  stats,
  tasks,
}: DashboardPostItBoardProps) {
  return (
    <section
      aria-label="หน้าแรกสำหรับเริ่มงานของคุณครู"
      className="dashboard-postit-board relative overflow-hidden rounded-[32px] border-2 border-[#e6dcce] bg-[#fffdf8] p-4 shadow-[0_12px_28px_rgba(68,53,35,0.08)] sm:p-6 xl:p-7"
    >
      <span aria-hidden="true" className="dashboard-postit-board__tape absolute -top-1 left-[12%] h-4 w-16 -rotate-3 border border-amber-200/70 bg-white/90 shadow-sm" />
      <span aria-hidden="true" className="dashboard-postit-board__sun absolute -right-9 -top-12 text-[9rem] opacity-[0.055]">☀️</span>

      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.07fr)_minmax(330px,0.93fr)]">
        <div className="rounded-[26px] border border-stone-200/90 bg-white/80 p-5 shadow-[0_3px_0_rgba(120,113,108,0.06)] sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900">
              <Sparkles size={14} aria-hidden="true" /> หน้าแรกของคุณครู
            </span>
            {isHomeroom ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-800">
                ห้องที่ปรึกษา
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl xl:text-[2.2rem]">
            สวัสดี, {displayName || 'คุณครู'} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-stone-600">
            เริ่มวันอย่างสบาย ๆ เลือกห้องเรียน แล้วหยิบงานสำคัญของวันนี้ได้จากกระดานนี้เลย
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-stone-600">
            <span className="rounded-xl border border-stone-200 bg-[#fffaf1] px-3 py-2">{schoolName || 'โรงเรียน'}</span>
            <span className="rounded-xl border border-stone-200 bg-[#fffaf1] px-3 py-2">{dateLabel}</span>
            <span className="rounded-xl border border-stone-200 bg-[#fffaf1] px-3 py-2">ห้อง {classroomName}</span>
            {attendanceTrendDelta !== null ? (
              <span className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 ${attendanceTrendDelta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                {attendanceTrendDelta >= 0 ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
                {attendanceTrendDelta >= 0 ? '+' : ''}{attendanceTrendDelta}% การมาเรียน
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">{classroomControl}</div>
            <Link
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#264c3b] px-5 text-sm font-black text-white shadow-[0_5px_0_#d59b19] transition hover:-translate-y-0.5 hover:bg-[#1d3b2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0 active:shadow-none"
              to="/app/dashboard?view=teacher-work"
            >
              <CalendarCheck2 size={18} aria-hidden="true" />
              เช็กเวลาเรียน
            </Link>
          </div>
        </div>

        <aside aria-label="งานสำคัญวันนี้" className="relative rounded-[26px] border border-[#e9d9bc] bg-[#fff8e8] p-4 shadow-[0_3px_0_rgba(146,109,44,0.07)] sm:p-5">
          <span aria-hidden="true" className="absolute -top-1.5 right-[18%] h-3.5 w-11 rotate-2 border border-amber-200/80 bg-white/90 shadow-sm" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.12em] text-amber-800">สิ่งที่รอคุณอยู่</p>
              <h2 className="mt-0.5 text-lg font-black text-stone-950">งานวันนี้</h2>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400 text-lg shadow-sm" aria-hidden="true">📌</span>
          </div>

          <ol className="mt-3 grid gap-2.5">
            {tasks.slice(0, 3).map((task, index) => {
              const Icon = task.icon;
              const theme = taskThemes[index % taskThemes.length];
              return (
                <li key={task.label}>
                  <Link
                    className={`group flex items-center gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 ${theme.note}`}
                    to={task.path}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-sm ${theme.icon}`}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-5 text-stone-950">{task.label}</span>
                      <span className="block truncate text-[11px] font-semibold text-stone-500">{task.detail}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/85 px-2 py-1 text-[10px] font-black text-stone-700 shadow-sm">
                      <Check size={11} aria-hidden="true" /> {task.status}
                    </span>
                    <ArrowRight className="shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" size={15} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>

      <div aria-label="สรุปข้อมูลโรงเรียน" className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.slice(0, 4).map((stat, index) => {
          const theme = statThemes[index % statThemes.length];
          return (
            <article className={`relative min-w-0 rounded-2xl border p-4 shadow-[0_4px_10px_rgba(68,53,35,0.06)] ${theme.accent}`} key={stat.label}>
              <span aria-hidden="true" className={`absolute -top-2 left-1/2 h-3.5 w-10 -translate-x-1/2 border shadow-sm ${theme.tape}`} />
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-black leading-5">{stat.label}</p>
                <span aria-hidden="true" className="text-lg">{theme.icon}</span>
              </div>
              <p className="mt-3 text-3xl font-black tracking-tight tabular-nums">{stat.value}</p>
              <p className="mt-1 truncate text-xs font-bold text-stone-600" title={stat.detail}>{stat.detail}</p>
              {stat.subDetail ? <p className="mt-1 truncate text-[11px] font-black text-stone-700" title={stat.subDetail}>{stat.subDetail}</p> : null}
            </article>
          );
        })}
      </div>

      <p className="relative mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
        <ClipboardList size={13} aria-hidden="true" /> เลือกบัตรงานเพื่อเริ่มทำงานต่อได้ทันที
      </p>
    </section>
  );
}
