import React, { useEffect, useState, useMemo } from 'react';
import { AppLogo } from '../brand/AppLogo';
import { CuteCareyAvatar, MascotAvatarType } from '../support/CuteCareyAvatar';
import { Sparkles, ShieldCheck, Cpu, Zap, Compass, CheckCircle2 } from 'lucide-react';

export type LoaderTheme = 'quantum' | 'aurora' | 'titanium' | 'magic';

export interface LoaderThemeOption {
  id: LoaderTheme;
  name: string;
  badge: string;
  tagline: string;
  icon: string;
}

export const LOADER_THEMES: LoaderThemeOption[] = [
  {
    id: 'quantum',
    name: 'Quantum Holo',
    badge: 'ล้ำยุค ไซเบอร์เนติก',
    tagline: 'วงแหวนปฏิกรณ์ควอนตัมคู่ + แสงเลเซอร์โฮโลแกรม',
    icon: '🌐',
  },
  {
    id: 'aurora',
    name: 'Aurora Glass',
    badge: 'แสงเหนือ พรีเมียมหรู',
    tagline: 'กระจกแก้วฝ้า + คลื่นแสงออโรร่าพริ้วไหวสีรุ้ง',
    icon: '🌌',
  },
  {
    id: 'titanium',
    name: 'Titanium Pro',
    badge: 'มินิมอลโมเดิร์น',
    tagline: 'สไตล์ Apple Pro เลเซอร์สปินเนอร์แม่นยำสูง',
    icon: '⚡',
  },
  {
    id: 'magic',
    name: 'Carey Magic',
    badge: 'น้องแคร์ & ดวงดาว',
    tagline: 'มาสคอตคู่ประกายดาววิเศษ อบอุ่น สบายตา',
    icon: '🐻',
  },
];

interface NexusAuroraLoaderProps {
  message?: string;
  title: string;
  variant?: 'page' | 'panel';
  theme?: LoaderTheme;
}

// System-wide official loader theme setting (Chosen: Aurora Borealis Glass)
export const SYSTEM_LOADER_THEME: LoaderTheme = 'aurora';

export function NexusAuroraVisual({
  message,
  title,
  theme: explicitTheme,
}: Omit<NexusAuroraLoaderProps, 'variant'>) {
  const currentTheme: LoaderTheme = explicitTheme || SYSTEM_LOADER_THEME;

  const [mascotType] = useState<MascotAvatarType>(() => {
    try {
      const saved = window.localStorage.getItem('classcare_ai_mascot_avatar') as MascotAvatarType;
      if (saved && ['bear', 'cat', 'bunny', 'girl', 'shiba'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'bear';
  });

  const [percent, setPercent] = useState(28);
  const [stepIndex, setStepIndex] = useState(0);

  // Simulated smooth progression animation
  useEffect(() => {
    const timer = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 96) return 96;
        const jump = Math.floor(Math.random() * 8) + 3;
        const next = Math.min(96, prev + jump);
        if (next > 70) setStepIndex(2);
        else if (next > 40) setStepIndex(1);
        return next;
      });
    }, 450);
    return () => clearInterval(timer);
  }, []);


  return (
    <div className="relative flex flex-col items-center justify-center p-4 w-full max-w-xl mx-auto select-none">
      {/* ========================================================
          THEME 1: QUANTUM HOLO-MATRIX (ล้ำยุค Cybernetic Quantum)
          ======================================================== */}
      {currentTheme === 'quantum' && (
        <div className="relative w-full rounded-[2.5rem] border border-cyan-500/30 bg-slate-950/80 p-8 sm:p-10 text-center shadow-[0_0_80px_rgba(6,182,212,0.25)] backdrop-blur-2xl overflow-hidden">
          {/* Cyber Grid Background */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(#06b6d4 1px, transparent 1px), linear-gradient(90deg, #06b6d4 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Ambient Glows */}
          <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-indigo-600/25 blur-3xl pointer-events-none" />

          {/* Holographic Laser Scan Line */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-75 blur-xs animate-[scan_3s_ease-in-out_infinite]" />

          {/* Central Reactor / Quantum Ring */}
          <div className="relative z-10 mx-auto grid h-32 w-32 place-items-center mb-6">
            {/* Outer Cyber Ring (Counter-clockwise) */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/40 animate-[spin_12s_linear_infinite_reverse]"
              style={{ boxShadow: '0 0 25px rgba(6,182,212,0.35)' }}
            />

            {/* Inner High-Speed Ring (Clockwise) */}
            <div className="absolute inset-2.5 rounded-full border-2 border-t-cyan-300 border-r-indigo-400 border-b-transparent border-l-transparent animate-[spin_1.8s_cubic-bezier(0.4,0,0.2,1)_infinite]" />

            {/* Quantum Energy Nodes */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee] animate-ping" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-2.5 w-2.5 rounded-full bg-indigo-400 shadow-[0_0_10px_#818cf8]" />

            {/* Central 3D Levitation App Logo */}
            <div className="relative z-10 grid h-18 w-18 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950 p-2 border border-cyan-400/50 shadow-2xl shadow-cyan-900/60">
              <AppLogo className="h-14 w-14 rounded-xl object-contain drop-shadow-[0_4px_12px_rgba(34,211,238,0.5)]" />
            </div>
          </div>

          {/* System Status Eyebrow */}
          <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 shadow-inner mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
            <span>QUANTUM PROTOCOL ACTIVE</span>
          </div>

          {/* Title & Message */}
          <h2 className="relative z-10 text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
            {title}
          </h2>
          <p className="relative z-10 mt-2 text-xs sm:text-sm font-medium text-cyan-100/70 max-w-md mx-auto leading-relaxed">
            {message || 'ระบบกำลังตรวจสอบความปลอดภัยและจัดเตรียมสภาพแวดล้อมการทำงาน'}
          </p>

          {/* Dynamic 3-Step Process */}
          <div className="relative z-10 mt-7 grid grid-cols-3 gap-2 text-[11px] font-bold">
            {[
              { label: 'ยืนยันสิทธิ์ระบบ', step: 0 },
              { label: 'เชื่อมต่อฐานข้อมูล', step: 1 },
              { label: 'จัดเตรียมพร้อมใช้', step: 2 },
            ].map((item) => {
              const active = stepIndex >= item.step;
              return (
                <div key={item.step} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-2 w-full rounded-full transition-all duration-500 ${
                      active
                        ? 'bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                        : 'bg-slate-800/80'
                    }`}
                  />
                  <span
                    className={`text-[10px] sm:text-[11px] transition-colors ${
                      active ? 'text-cyan-300 font-black' : 'text-slate-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* High-Tech Progress & Live Telemetry */}
          <div className="relative z-10 mt-6 pt-5 border-t border-cyan-500/20 flex flex-wrap items-center justify-between text-[11px] text-cyan-400/80 font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-cyan-400" />
              <span>TLS 1.3 • AES-256 GCM</span>
            </div>
            <div className="flex items-center gap-2 font-black text-white">
              <Cpu size={14} className="text-indigo-400 animate-spin" />
              <span>{percent}% SYNCHRONIZED</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          THEME 2: AURORA BOREALIS GLASS (แสงเหนือพรีเมียมหรูหรา)
          ======================================================== */}
      {currentTheme === 'aurora' && (
        <div className="relative w-full rounded-[2.5rem] border border-white/20 bg-gradient-to-b from-white/10 via-slate-900/40 to-slate-950/80 p-8 sm:p-10 text-center shadow-[0_30px_100px_rgba(30,58,138,0.4)] backdrop-blur-3xl overflow-hidden">
          {/* Multi-layered Fluid Aurora Lights */}
          <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-teal-400 via-emerald-400 to-transparent opacity-30 blur-3xl pointer-events-none animate-pulse" />
          <div
            className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-gradient-to-tr from-fuchsia-500 via-indigo-600 to-transparent opacity-30 blur-3xl pointer-events-none"
            style={{ animationDelay: '1s' }}
          />
          <div className="absolute top-1/3 left-1/4 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none animate-pulse" />

          {/* Floating Logo Badge with Aurora Halo */}
          <div className="relative z-10 mx-auto grid h-32 w-32 place-items-center mb-6">
            <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-tr from-teal-400 via-cyan-400 to-fuchsia-500 opacity-60 blur-md animate-[spin_8s_linear_infinite]" />
            <div className="relative z-10 grid h-24 w-24 place-items-center rounded-[2rem] bg-slate-950/85 p-2.5 border border-white/30 shadow-2xl backdrop-blur-xl">
              <AppLogo className="h-16 w-16 rounded-2xl object-contain drop-shadow-[0_8px_20px_rgba(45,212,191,0.5)]" />
            </div>
          </div>

          {/* Eyebrow Pill */}
          <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-500/10 px-4 py-1 text-[11px] font-black tracking-wide text-teal-200 backdrop-blur-md mb-3">
            <Sparkles size={12} className="text-teal-300 animate-spin" />
            <span>CLASSCARE 360 LUXURY SUITE</span>
          </div>

          <h2 className="relative z-10 text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-sky-200">
            {title}
          </h2>
          <p className="relative z-10 mt-2 text-xs sm:text-sm text-slate-300/80 max-w-md mx-auto leading-relaxed">
            {message || 'ระบบกำลังจัดเตรียมบริการความปลอดภัยระดับพรีเมียมสำหรับโรงเรียน'}
          </p>

          {/* 3 Frosted Glass Steps */}
          <div className="relative z-10 mt-6 grid grid-cols-3 gap-2 text-[11px] font-bold">
            {[
              { label: 'ตรวจสอบข้อมูล', step: 0 },
              { label: 'เตรียมรายการ', step: 1 },
              { label: 'พร้อมใช้งาน', step: 2 },
            ].map((item) => {
              const active = stepIndex >= item.step;
              return (
                <div
                  key={item.step}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-1.5 px-2 transition-all duration-300 ${
                    active
                      ? 'border-teal-400/40 bg-teal-500/15 text-teal-200 shadow-[0_0_15px_rgba(45,212,191,0.2)] font-black'
                      : 'border-white/5 bg-white/5 text-slate-500'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      active ? 'bg-teal-300 shadow-[0_0_8px_#2dd4bf]' : 'bg-slate-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Smooth Aurora Progress Bar */}
          <div className="relative z-10 mt-6">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 p-0.5 backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-fuchsia-400 shadow-[0_0_20px_rgba(45,212,191,0.8)] transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-bold text-teal-200/90">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-teal-300" />
                <span>ระบบจะดำเนินการต่อโดยอัตโนมัติ</span>
              </span>
              <span className="font-mono text-white text-xs">{percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          THEME 3: TITANIUM PRO MINIMAL (มินิมอลโมเดิร์น สไตล์ Apple Pro)
          ======================================================== */}
      {currentTheme === 'titanium' && (
        <div className="relative w-full rounded-[2.2rem] border border-slate-700/60 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-8 sm:p-10 text-center shadow-2xl overflow-hidden">
          {/* Subtle Metallic Brushed Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(148,163,184,0.12),transparent_70%)] pointer-events-none" />

          {/* Precision Laser Arc Spinner */}
          <div className="relative z-10 mx-auto grid h-28 w-28 place-items-center mb-6">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#334155"
                strokeWidth="2.5"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="90 190"
              />
            </svg>
            <div className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl bg-black border border-slate-800 shadow-xl">
              <AppLogo className="h-11 w-11 object-contain" />
            </div>
          </div>

          <div className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-0.5 text-[10px] font-bold text-slate-300 border border-slate-700 mb-3 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span>PRO WORKSPACE ARCHITECTURE</span>
          </div>

          <h2 className="relative z-10 text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
            {title}
          </h2>
          <p className="relative z-10 mt-1.5 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {message || 'กำลังโหลดคอมโพเนนต์และข้อมูลล่าสุดอย่างปลอดภัย'}
          </p>

          <div className="relative z-10 mt-7 flex items-center justify-center gap-4 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Zap size={13} className="text-sky-400" /> 120 FPS UI
            </span>
            <span>•</span>
            <span className="text-slate-300 font-bold">{percent}% LOADED</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">READY</span>
          </div>
        </div>
      )}

      {/* ========================================================
          THEME 4: CAREY MAGIC STAR (มาสคอตน่ารัก & ประกายดวงดาว)
          ======================================================== */}
      {currentTheme === 'magic' && (
        <div className="relative w-full rounded-[2.5rem] border border-amber-300/40 bg-gradient-to-b from-indigo-950/90 via-slate-950/95 to-slate-950 p-8 sm:p-10 text-center shadow-[0_0_80px_rgba(245,158,11,0.2)] backdrop-blur-2xl overflow-hidden">
          {/* Warm Starlight Aura */}
          <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-sky-400/20 blur-3xl pointer-events-none" />

          {/* Floating Starlight Particles */}
          <div className="absolute top-6 left-10 text-amber-300 animate-bounce text-sm pointer-events-none">✨</div>
          <div className="absolute top-12 right-12 text-yellow-200 animate-pulse text-xs pointer-events-none">⭐</div>
          <div className="absolute bottom-8 left-14 text-sky-300 animate-pulse text-xs pointer-events-none">🌟</div>

          {/* Mascot in Glowing Starlight Pedestal */}
          <div className="relative z-10 mx-auto grid h-32 w-32 place-items-center mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-300/40 animate-[spin_10s_linear_infinite]" />
            <div className="relative z-10 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-amber-200 via-sky-400 to-indigo-600 p-1 shadow-2xl shadow-amber-500/25">
              <div className="grid h-full w-full place-items-center rounded-[1.3rem] bg-slate-950/90">
                <CuteCareyAvatar type={mascotType} size={54} className="drop-shadow-md" />
              </div>
            </div>
            <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-300 animate-bounce" />
          </div>

          <div className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1 text-[11px] font-black text-amber-300 mb-3">
            <span>✨</span>
            <span>น้องแคร์พร้อมดูแลคุณครูค่ะ</span>
          </div>

          <h2 className="relative z-10 text-2xl sm:text-3xl font-black text-white">
            {title}
          </h2>
          <p className="relative z-10 mt-2 text-xs sm:text-sm text-amber-100/80 max-w-md mx-auto leading-relaxed">
            {message || 'รอสักครู่นะคะ น้องแคร์กำลังเตรียมห้องเรียนและข้อมูลให้พร้อมใช้งานค่ะ'}
          </p>

          <div className="relative z-10 mt-7">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80 p-0.5 border border-amber-400/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-400 to-sky-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-bold text-amber-200/90">
              <span>🌟 กำลังส่งต่อความสุข...</span>
              <span className="font-mono text-white">{percent}%</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export function NexusAuroraLoader({
  message,
  title,
  variant = 'panel',
  theme,
}: NexusAuroraLoaderProps) {
  if (variant === 'page') {
    return (
      <main className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-[#050b14] overflow-y-auto px-4 py-8">
        <NexusAuroraVisual message={message} title={title} theme={theme} />
      </main>
    );
  }

  return (
    <div aria-live="polite" className="nexus-aurora-panel-loader" role="status">
      <span aria-hidden="true" className="nexus-aurora-mini-orbit">
        <i />
      </span>
      <span className="min-w-0">
        <strong>{title}</strong>
        {message ? <small>{message}</small> : null}
      </span>
      <span aria-hidden="true" className="nexus-aurora-dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function NexusAuroraInline({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <span aria-live="polite" className="nexus-aurora-inline" role="status">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
