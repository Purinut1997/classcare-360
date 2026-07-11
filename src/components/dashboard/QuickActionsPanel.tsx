import { ChevronRight } from 'lucide-react';

import type { QuickAction } from '../../data/quickActions';

interface QuickActionsPanelProps {
  actions: QuickAction[];
}

export function QuickActionsPanel({ actions }: QuickActionsPanelProps) {
  return (
    <article className="glass-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-cyan-700">ClassCare Menu</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">งานครูที่ใช้บ่อย</h2>
        </div>
        <button className="dark-action inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black">
          เพิ่มงานใหม่
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              className="group flex min-h-28 items-center gap-4 rounded-3xl border border-slate-200/80 bg-white/75 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_44px_rgba(14,165,233,0.14)]"
              key={action.label}
              type="button"
            >
              <span
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-[0_14px_26px_rgba(15,23,42,0.18)] ${action.color}`}
              >
                <Icon size={23} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-black tracking-tight text-slate-950">{action.label}</span>
                <span className="mt-1 block text-sm font-bold text-slate-500">
                  พร้อมเชื่อมข้อมูลจริงในเฟสถัดไป
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
