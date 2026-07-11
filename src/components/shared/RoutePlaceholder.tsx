import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RoutePlaceholderProps {
  actions?: Array<{ label: string; to: string }>;
  checkpoints: string[];
  description: string;
  icon: LucideIcon;
  title: string;
  eyebrow: string;
}

export function RoutePlaceholder({
  actions = [{ label: 'กลับแดชบอร์ด', to: '/app/dashboard' }],
  checkpoints,
  description,
  icon: Icon,
  title,
  eyebrow,
}: RoutePlaceholderProps) {
  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="nexus-card mx-auto max-w-6xl overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6 sm:p-8">
            <div className="nexus-kicker">
              <Icon size={18} aria-hidden="true" />
              {eyebrow}
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base font-medium leading-8 text-slate-600">
              {description}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {actions.map((action, index) => (
                <Link
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black ${
                    index === 0
                      ? 'blue-action'
                      : 'nexus-pill text-slate-700 transition hover:-translate-y-0.5'
                  }`}
                  key={action.to}
                  to={action.to}
                >
                  {action.label}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden border-t border-slate-100 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-cyan-300/10 blur-2xl" />
            <p className="relative text-sm font-black text-cyan-200">ต้องพร้อมก่อนใช้งานจริง</p>
            <div className="mt-5 grid gap-3">
              {checkpoints.map((checkpoint) => (
                <div className="relative flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 shadow-[0_16px_34px_rgba(0,0,0,0.18)] backdrop-blur" key={checkpoint}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden="true" />
                  <p className="text-sm font-bold leading-6 text-slate-100">{checkpoint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
