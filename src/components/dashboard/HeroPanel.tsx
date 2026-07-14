import { BookOpenCheck, CheckCircle2, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../brand/AppLogo';

interface HeroPanelProps {
  canManageBilling: boolean;
  copy: {
    eyebrow: string;
    title: string;
    body: string;
  };
  activeModules: number;
  initialRoute: string;
  supabaseStatus: string;
}

export function HeroPanel({ canManageBilling, copy, activeModules, initialRoute, supabaseStatus }: HeroPanelProps) {
  return (
    <section
      className="glass-panel overflow-hidden rounded-[2rem]"
      id="overview"
    >
      <div className="grid min-h-[520px] gap-0 xl:grid-cols-[minmax(0,0.86fr)_minmax(520px,1fr)]">
        <div className="flex flex-col justify-center p-6 sm:p-9">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-4 py-2 text-sm font-black text-cyan-900">
            <Sparkles size={17} aria-hidden="true" />
            {copy.eyebrow}
          </div>
          <h2 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-6xl">
            {copy.title}
          </h2>
          <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-slate-600 sm:text-lg">
            {copy.body}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="blue-action inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black"
              to="/app/dashboard"
            >
              <BookOpenCheck size={18} aria-hidden="true" />
              ดูแผนงาน
            </Link>
            {canManageBilling ? (
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-5 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                to="/app/package"
              >
                <WalletCards size={18} aria-hidden="true" />
                แพ็กเกจ
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-[430px] overflow-hidden bg-[linear-gradient(135deg,#dff6ff_0%,#58b8ff_45%,#0f4fb7_100%)] p-6 text-white xl:min-h-full">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] bg-[length:34px_34px]" />
          <div className="pulse-glow absolute left-14 top-12 h-2 w-2 rounded-full bg-white shadow-[0_0_28px_10px_rgba(255,255,255,0.5)]" />
          <div className="pulse-glow absolute right-24 top-20 h-1.5 w-1.5 rounded-full bg-cyan-100 shadow-[0_0_24px_8px_rgba(103,232,249,0.5)]" />

          <div className="relative z-10 flex h-full min-h-[390px] flex-col justify-between">
            <div className="ml-auto flex w-fit items-center gap-3 rounded-3xl border border-white/30 bg-white/20 px-4 py-3 shadow-[0_16px_36px_rgba(8,47,73,0.18)] backdrop-blur-xl">
              <AppLogo className="h-11 w-11 rounded-2xl bg-white" />
              <div>
                <p className="text-sm font-black leading-4">AI Classroom</p>
                <p className="text-xs font-bold text-cyan-50/80">Future-ready school hub</p>
              </div>
            </div>

            <div className="float-soft mx-auto mb-7 w-full max-w-md">
              <div className="relative mx-auto h-56 max-w-sm">
                <div className="absolute bottom-0 left-10 h-36 w-36 rounded-t-[2.5rem] border border-white/30 bg-white/30 shadow-[0_24px_54px_rgba(8,47,73,0.24)] backdrop-blur-md" />
                <div className="absolute bottom-0 left-28 h-48 w-28 rounded-t-[2rem] border border-white/30 bg-white/40 shadow-[0_24px_54px_rgba(8,47,73,0.22)] backdrop-blur-md" />
                <div className="absolute bottom-0 right-10 h-40 w-32 rounded-t-[2.4rem] border border-white/30 bg-cyan-100/30 shadow-[0_24px_54px_rgba(8,47,73,0.22)] backdrop-blur-md" />
                <div className="absolute bottom-24 left-[8.6rem] grid h-20 w-20 place-items-center rounded-full border border-white/50 bg-slate-950/90 text-center shadow-[0_0_38px_rgba(255,255,255,0.45)]">
                  <p className="text-xs font-black text-cyan-200">CLASS</p>
                  <p className="-mt-1 text-lg font-black">360</p>
                </div>
                <div className="absolute bottom-7 right-1 grid h-24 w-24 place-items-center rounded-full border border-white/40 bg-white/25 backdrop-blur-xl">
                  <ShieldCheck size={34} aria-hidden="true" />
                </div>
                <div className="absolute bottom-0 left-2 right-2 h-9 rounded-full bg-slate-950/25 blur-xl" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['3', 'Docs'],
                ['1', 'Migration'],
                [String(activeModules), 'Modules'],
              ].map(([value, label]) => (
                <div
                  className="rounded-3xl border border-white/30 bg-white/25 p-4 text-center shadow-[0_16px_34px_rgba(8,47,73,0.20)] backdrop-blur-xl"
                  key={label}
                >
                  <p className="text-3xl font-black">{value}</p>
                  <p className="mt-1 text-xs font-black text-cyan-50">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-28 left-7 z-10 rounded-2xl border border-white/30 bg-white/20 p-4 shadow-[0_14px_32px_rgba(8,47,73,0.18)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-cyan-100" size={19} aria-hidden="true" />
              <p className="text-sm font-black">Build ผ่านแล้ว</p>
            </div>
            <p className="mt-1 max-w-[230px] text-xs font-bold leading-5 text-cyan-50/90">
              {supabaseStatus} | route เริ่มต้น: {initialRoute}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
