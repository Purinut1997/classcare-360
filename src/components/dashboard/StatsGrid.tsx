import { AlertTriangle, PiggyBank, School, Users, type LucideIcon } from 'lucide-react';
import type { DashboardStatItem } from '../../data/dashboard';
import { BotanicalCardSprig } from '../shared/BotanicalDecor';

interface StatsGridProps {
  stats: DashboardStatItem[];
}

const botanicalCardThemes: Array<{
  topBar: string;
  sprigColor: string;
  badgeBg: string;
  icon: LucideIcon;
}> = [
  {
    topBar: 'bg-[#2D72A3]',
    sprigColor: '#2D72A3',
    badgeBg: 'bg-[#E9F3FA] text-[#1D547C] border-[#CBE1F2]',
    icon: Users,
  },
  {
    topBar: 'bg-[#2F7D5B]',
    sprigColor: '#2F7D5B',
    badgeBg: 'bg-[#E6F4EC] text-[#1C573D] border-[#BFE0CD]',
    icon: School,
  },
  {
    topBar: 'bg-[#D98B26]',
    sprigColor: '#D98B26',
    badgeBg: 'bg-[#FDF4E1] text-[#8B5312] border-[#F0D9AE]',
    icon: AlertTriangle,
  },
  {
    topBar: 'bg-[#C25970]',
    sprigColor: '#C25970',
    badgeBg: 'bg-[#FBEFF2] text-[#8E354A] border-[#F0CFD7]',
    icon: PiggyBank,
  },
];

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="dashboard-stat-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สถิติภาพรวม">
      {stats.map((stat, index) => {
        const theme = botanicalCardThemes[index % botanicalCardThemes.length];
        const Icon = theme.icon;
        return (
          <article
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-white p-4 pt-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B6C7B3] hover:shadow-md"
          >
            <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${theme.topBar}`} />
            <BotanicalCardSprig className="absolute -right-2 -top-1.5" color={theme.sprigColor} opacity={0.14} />

            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#7B8A7E]">0{index + 1}</span>
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${theme.badgeBg}`}>
                <Icon size={12} aria-hidden="true" />
                <span>{stat.label}</span>
              </div>
            </div>

            <div className="relative z-10 mt-2.5 flex items-end justify-between gap-2">
              <p className="font-display text-3xl font-bold tracking-tight text-[#1F2A22]">{stat.value}</p>
              <div className="pb-0.5 text-right min-w-0">
                <p className="truncate text-xs font-bold text-[#5B6A5F]">{stat.detail}</p>
                {stat.subDetail && (
                  <p className="mt-1 inline-block max-w-[140px] truncate rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-2 py-0.5 text-[10.5px] font-bold text-[#1C573D]">
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
