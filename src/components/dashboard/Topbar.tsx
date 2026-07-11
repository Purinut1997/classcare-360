import { Bell, Building2, Menu, Moon, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { WorkspaceSummary } from '../../types/core';

interface TopbarProps {
  badges: string[];
  canSwitchWorkspace?: boolean;
  workspace?: WorkspaceSummary | null;
}

export function Topbar({ badges, canSwitchWorkspace = false, workspace }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-white/60 bg-white/90 px-4 py-3 shadow-[0_10px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-5 lg:shadow-none">
      <div className="flex items-center gap-3">
        <button
          className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          aria-label="เปิดเมนู"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge, index) => (
              <span
                className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-black ring-1 ${
                  index === 0
                    ? 'bg-cyan-100 text-cyan-800 ring-cyan-200'
                    : 'bg-white/90 text-slate-600 ring-slate-200'
                }`}
                key={badge}
              >
                {badge}
              </span>
            ))}
          </div>
          <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">
            ClassCare 360
          </h1>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {workspace ? (
            <Link
              className="nexus-pill inline-flex h-11 max-w-[300px] items-center gap-2 px-4 text-left text-slate-700"
              to="/app/select-workspace"
              title={`${workspace.schoolName} | ${workspace.classroomName}`}
            >
              <Building2 className="shrink-0 text-cyan-700" size={18} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-slate-500">{workspace.schoolName}</span>
                <span className="block truncate text-sm font-black text-slate-800">
                  {canSwitchWorkspace ? 'เปลี่ยน workspace' : workspace.classroomName}
                </span>
              </span>
            </Link>
          ) : null}
          <label className="nexus-pill relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              className="h-11 w-64 rounded-full bg-transparent pl-10 pr-3 text-sm font-bold text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="ค้นหานักเรียนหรือรายงาน"
              type="search"
            />
          </label>
          <button className="nexus-pill grid h-11 w-11 place-items-center text-slate-700">
            <Moon size={19} aria-hidden="true" />
          </button>
          <button className="nexus-pill grid h-11 w-11 place-items-center text-slate-700">
            <Bell size={19} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
