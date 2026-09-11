import type { DashboardStatItem } from '../../data/dashboard';

interface StatsGridProps {
  stats: DashboardStatItem[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="dashboard-stat-grid mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถิติ">
      {stats.map((stat, index) => (
        <article
          className={`dashboard-stat dashboard-stat-${index + 1} rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,0.04)]`}
          key={stat.label}
        >
          <span className="dashboard-stat-index" aria-hidden="true">0{index + 1}</span>
          <div className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-black ring-1 ${stat.tone}`}>
            {stat.label}
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="text-3xl font-black tracking-tight text-slate-950">{stat.value}</p>
            <div className="text-right pb-0.5 min-w-0">
              <p className="text-xs font-bold text-slate-600 truncate">{stat.detail}</p>
              {stat.subDetail && (
                <p className="text-[10.5px] font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md mt-0.5 inline-block border border-teal-200/60 max-w-[140px] truncate">
                  {stat.subDetail}
                </p>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
