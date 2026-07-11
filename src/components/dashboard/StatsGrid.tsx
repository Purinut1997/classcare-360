import type { dashboardStats } from '../../data/dashboard';

interface StatsGridProps {
  stats: typeof dashboardStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถิติ">
      {stats.map((stat, index) => (
        <article
          className="group relative overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-5 shadow-[0_18px_42px_rgba(14,165,233,0.10)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(14,165,233,0.16)]"
          key={stat.label}
        >
          <div className="absolute right-[-32px] top-[-32px] h-24 w-24 rounded-full bg-sky-200/40 blur-2xl transition group-hover:bg-blue-300/40" />
          <div className={`relative inline-flex rounded-2xl px-3 py-1.5 text-xs font-black ring-1 ${stat.tone}`}>
            {stat.label}
          </div>
          <div className="relative mt-4 flex items-end justify-between gap-3">
            <p className="text-4xl font-black tracking-tight text-slate-950">{stat.value}</p>
            <p className="pb-1 text-sm font-black text-slate-500">{stat.detail}</p>
          </div>
          <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600"
              style={{ width: `${72 + index * 6}%` }}
            />
          </div>
        </article>
      ))}
    </section>
  );
}
