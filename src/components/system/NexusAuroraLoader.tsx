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
    name: 'Aurora Circular Orb',
    badge: 'วงกลมเรืองแสง พรีเมียม',
    tagline: 'วงกลมแก้วฝ้า + วงแหวนเรเดียลโพรเกรสระดับสตูดิโอ',
    icon: '🔮',
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

  // Smooth continuous progression animation
  useEffect(() => {
    const timer = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 96) return 96;
        const jump = Math.floor(Math.random() * 6) + 3;
        const next = Math.min(96, prev + jump);
        if (next > 72) setStepIndex(2);
        else if (next > 38) setStepIndex(1);
        return next;
      });
    }, 280);
    return () => clearInterval(timer);
  }, []);

  const statusHint = useMemo(() => {
    if (percent < 38) return 'กำลังตรวจสอบความปลอดภัยและยืนยันสิทธิ์...';
    if (percent < 72) return 'กำลังเชื่อมต่อและโหลดโมดูลการทำงาน...';
    if (percent < 95) return 'กำลังจัดเตรียมสภาพแวดล้อมให้พร้อมใช้...';
    return 'ระบบพร้อมใช้งาน กำลังเปิดหน้าจอ...';
  }, [percent]);


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
          THEME 2: AURORA CIRCULAR ORB PRO (ทรงกลมเรืองแสง พรีเมียมมินิมอล)
          ======================================================== */}
      {currentTheme === 'aurora' && (
        <div className="relative flex flex-col items-center justify-center">
          {/* Main Circular Portal / Orb */}
          <div className="relative flex h-80 w-80 sm:h-96 sm:w-96 flex-col items-center justify-center rounded-full border border-white/10 bg-slate-950/85 p-6 sm:p-8 text-center shadow-[0_0_120px_rgba(14,165,233,0.22),inset_0_0_50px_rgba(255,255,255,0.03)] backdrop-blur-3xl">
            {/* Outer Rotating Dashed Planetary Ring */}
            <div className="absolute -inset-4 sm:-inset-5 rounded-full border border-dashed border-teal-400/20 animate-[spin_35s_linear_infinite]" />

            {/* Outer Subtle Orbit Ring */}
            <div className="absolute -inset-2 rounded-full border border-cyan-400/15 animate-[spin_20s_linear_infinite_reverse]" />

            {/* Ambient Radial Core Glow */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-cyan-500/20 via-teal-400/15 to-indigo-500/20 blur-2xl pointer-events-none animate-pulse" />

            {/* SVG Radial Progress Ring (0% -> 100% Sweep) */}
            <svg
              className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
              viewBox="0 0 100 100"
            >
              <defs>
                <linearGradient id="auroraCircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2dd4bf" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r="47.5"
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="2.5"
              />
              {/* Dynamic Progress Arc */}
              <circle
                cx="50"
                cy="50"
                r="47.5"
                fill="none"
                stroke="url(#auroraCircleGrad)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 47.5}
                strokeDashoffset={2 * Math.PI * 47.5 * (1 - percent / 100)}
                className="transition-all duration-300 ease-out"
                style={{
                  filter: 'drop-shadow(0 0 6px rgba(45, 212, 191, 0.6))',
                }}
              />
            </svg>

            {/* Inner Content - Symmetrically Arranged Inside the Circle */}
            {/* 1. Brand Eyebrow */}
            <div className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-0.5 text-[9.5px] font-black tracking-widest text-teal-200 shadow-xs mb-2 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-400" />
              </span>
              <span>CLASSCARE 360</span>
            </div>

            {/* 2. Central Logo Pedestal */}
            <div className="relative z-10 grid h-16 w-16 sm:h-18 sm:w-18 place-items-center rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-2.5 border border-white/15 shadow-[0_0_25px_rgba(45,212,191,0.35)] backdrop-blur-xl mb-1.5 animate-pulse">
              <AppLogo className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl object-contain drop-shadow-[0_4px_16px_rgba(45,212,191,0.4)]" />
            </div>

            {/* 3. Percentage Counter */}
            <div className="relative z-10 text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-md">
              {percent}%
            </div>

            {/* 4. Title */}
            <h2 className="relative z-10 text-sm sm:text-base font-black tracking-tight text-slate-100 drop-shadow-sm mt-0.5 max-w-[200px] sm:max-w-[240px] truncate">
              {title}
            </h2>

            {/* 5. Dynamic Status Hint */}
            <p className="relative z-10 mt-1 text-[10.5px] sm:text-[11.5px] text-teal-200/90 font-bold max-w-[210px] sm:max-w-[240px] leading-tight flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping shrink-0" />
              <span className="truncate">{statusHint}</span>
            </p>
          </div>

          {/* Connected 3-Step Circular Pills Below the Orb */}
          <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-2">
            {[
              { label: 'ตรวจสอบสิทธิ์', step: 0 },
              { label: 'ซิงค์ข้อมูลระบบ', step: 1 },
              { label: 'พร้อมใช้งาน', step: 2 },
            ].map((item) => {
              const isCompleted = stepIndex > item.step;
              const isActive = stepIndex === item.step;
              return (
                <div
                  key={item.step}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] border transition-all duration-300 ${
                    isActive
                      ? 'border-teal-400/40 bg-teal-500/15 text-teal-200 shadow-[0_0_15px_rgba(45,212,191,0.2)] font-black'
                      : isCompleted
                      ? 'border-teal-500/20 bg-slate-900/60 text-teal-300/90 font-bold'
                      : 'border-white/5 bg-slate-900/30 text-slate-500 font-medium'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={12} className="text-teal-300 shrink-0" />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        isActive ? 'bg-teal-300 animate-pulse shadow-[0_0_8px_#2dd4bf]' : 'bg-slate-600'
                      }`}
                    />
                  )}
                  <span className="truncate text-[10.5px]">{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Security & System Trust Footnote */}
          <div className="relative z-10 mt-3.5 flex items-center justify-center gap-3 text-[10.5px] text-slate-400/80 font-medium">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck size={13} className="text-teal-400/90" />
              <span>TLS 1.3 / AES-256 GCM</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1 text-slate-400 font-mono">
              <Zap size={11} className="text-amber-400/80" />
              <span>Cloud Sync Active</span>
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
      <main className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-[#070b14] overflow-hidden px-4 py-8 select-none">
        {/* Ambient Cosmic Atmosphere */}
        <div className="absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full bg-cyan-500/12 blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 h-[480px] w-[480px] rounded-full bg-indigo-500/15 blur-[130px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[550px] w-[550px] rounded-full bg-teal-500/8 blur-[150px] pointer-events-none" />

        {/* Subtle Architectural Grid with Radial Mask */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none [mask-image:radial-gradient(ellipse_65%_55%_at_50%_50%,#000_65%,transparent_100%)]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

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
