import type { dashboardStats } from '../../data/dashboard';

interface StatsGridProps {
  stats: typeof dashboardStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถิติ">
      {stats.map((stat) => (
        <article
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_5px_18px_rgba(15,23,42,0.04)]"
          key={stat.label}
        >
          <div className={`inline-flex rounded-lg px-2 py-1 text-[11px] font-black ring-1 ${stat.tone}`}>
            {stat.label}
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-3xl font-black tracking-tight text-slate-950">{stat.value}</p>
            <p className="pb-1 text-xs font-bold text-slate-500">{stat.detail}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
