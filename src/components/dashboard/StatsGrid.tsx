import type { DashboardStatItem } from '../../data/dashboard';

interface StatsGridProps {
  stats: DashboardStatItem[];
}

const pastelCardThemes = [
  {
    bg: 'bg-[#f0f9ff]',
    border: 'border-[#bae6fd]',
    text: 'text-[#0369a1]',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
    tapeBg: 'bg-white/90 border-sky-200',
    rotate: 'rotate-[-1deg]',
    icon: '👥',
  },
  {
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    text: 'text-[#15803d]',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    tapeBg: 'bg-white/90 border-emerald-200',
    rotate: 'rotate-[1deg]',
    icon: '🏫',
  },
  {
    bg: 'bg-[#fefce8]',
    border: 'border-[#fef08a]',
    text: 'text-[#a16207]',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    tapeBg: 'bg-white/90 border-amber-200',
    rotate: 'rotate-[-0.5deg]',
    icon: '⚠️',
  },
  {
    bg: 'bg-[#fff1f2]',
    border: 'border-[#fecdd3]',
    text: 'text-[#be123c]',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    tapeBg: 'bg-white/90 border-rose-200',
    rotate: 'rotate-[1.5deg]',
    icon: '🐷',
  },
];

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="dashboard-stat-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถิติภาพรวม">
      {stats.map((stat, index) => {
        const theme = pastelCardThemes[index % pastelCardThemes.length];
        return (
          <article
            key={stat.label}
            className={`group relative rounded-2xl border-2 ${theme.border} ${theme.bg} p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-md`}
          >
            {/* Cute Tape Sticker */}
            <span
              className={`absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3.5 ${theme.tapeBg} border rounded-xs shadow-2xs pointer-events-none ${theme.rotate}`}
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-400">0{index + 1}</span>
              <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black border ${theme.badgeBg}`}>
                <span>{theme.icon}</span>
                <span>{stat.label}</span>
              </div>
            </div>

            <div className="mt-2.5 flex items-end justify-between gap-2">
              <p className="text-3xl font-black tracking-tight text-slate-900">{stat.value}</p>
              <div className="text-right pb-0.5 min-w-0">
                <p className="text-xs font-bold text-slate-600 truncate">{stat.detail}</p>
                {stat.subDetail && (
                  <p className="text-[10.5px] font-black text-teal-800 bg-white/90 px-2 py-0.5 rounded-full mt-1 inline-block border border-teal-200 shadow-2xs max-w-[140px] truncate">
                    {stat.subDetail}
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
