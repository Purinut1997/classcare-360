import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, ExternalLink, Info, RefreshCw, ShieldCheck, Wrench, X } from 'lucide-react';
import {
  dismissBroadcast,
  fetchActiveSystemBroadcast,
  getSystemBroadcast,
  isBroadcastDismissed,
  type SystemBroadcast,
} from '../../lib/systemBroadcast';

interface GlobalBroadcastBannerProps {
  isSuperadmin?: boolean;
}

export function GlobalBroadcastBanner({ isSuperadmin = false }: GlobalBroadcastBannerProps) {
  const [broadcast, setBroadcast] = useState<SystemBroadcast | null>(() => {
    const b = getSystemBroadcast();
    return b && (b.maintenanceLock || !isBroadcastDismissed(b.id)) ? b : null;
  });

  useEffect(() => {
    let active = true;

    const syncFromLocal = () => {
      const b = getSystemBroadcast();
      if (!active) return;
      setBroadcast(b && (b.maintenanceLock || !isBroadcastDismissed(b.id)) ? b : null);
    };

    const syncFromServer = async () => {
      const b = await fetchActiveSystemBroadcast();
      if (!active) return;
      setBroadcast(b && (b.maintenanceLock || !isBroadcastDismissed(b.id)) ? b : null);
    };

    void syncFromServer();

    const intervalId = window.setInterval(() => {
      void syncFromServer();
    }, 60_000);

    window.addEventListener('classcare-broadcast-changed', syncFromLocal);
    window.addEventListener('storage', syncFromLocal);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('classcare-broadcast-changed', syncFromLocal);
      window.removeEventListener('storage', syncFromLocal);
    };
  }, []);

  if (!broadcast || !broadcast.isActive) return null;

  // Hard Maintenance Mode Lock Screen for regular users (Superadmin can still access everything)
  if (broadcast.maintenanceLock && !isSuperadmin) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="ระบบกำลังปิดปรับปรุงชั่วคราว"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-5 backdrop-blur-md"
      >
        <div className="w-full max-w-lg rounded-3xl border border-rose-500/30 bg-white p-7 text-center shadow-2xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-rose-600">
            <Wrench size={30} aria-hidden="true" />
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-200">
            กำลังปิดปรับปรุงระบบชั่วคราว
          </span>
          <h1 className="mt-3 text-2xl font-black text-slate-950">{broadcast.title || 'ปิดปรับปรุงระบบ ClassCare 360'}</h1>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
            {broadcast.message || 'ทีมงานกำลังอัปเดตและดูแลระบบเพื่อความปลอดภัยของข้อมูล กรุณากลับมาใช้งานอีกครั้งในอีกสักครู่'}
          </p>
          {broadcast.endsAt ? (
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700">
              คาดว่าเปิดให้บริการอีกครั้ง:{' '}
              {new Intl.DateTimeFormat('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Bangkok',
              }).format(new Date(broadcast.endsAt))}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm hover:bg-slate-800"
            >
              <RefreshCw size={15} /> ตรวจสอบสถานะอีกครั้ง
            </button>
            {broadcast.linkUrl ? (
              <a
                href={broadcast.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                {broadcast.linkText || 'ติดตามประกาศ'} <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const config = {
    info: {
      bg: 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 text-white border-b border-cyan-400/30',
      badge: 'bg-white/25 text-white ring-1 ring-white/30',
      icon: Info,
      label: 'ประกาศ',
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-b border-amber-400/30',
      badge: 'bg-black/25 text-white ring-1 ring-white/30',
      icon: AlertTriangle,
      label: 'แจ้งเตือนสำคัญ',
    },
    maintenance: {
      bg: 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-800 text-white border-b border-rose-400/30',
      badge: 'bg-white/25 text-white ring-1 ring-white/30',
      icon: Wrench,
      label: broadcast.maintenanceLock ? 'โหมดปิดปรับปรุง (ล็อกผู้ใช้ทั่วไป)' : 'แจ้งปรับปรุงระบบ',
    },
  }[broadcast.severity] || {
    bg: 'bg-slate-800 text-white border-b border-slate-700',
    badge: 'bg-white/25 text-white ring-1 ring-white/30',
    icon: Bell,
    label: 'ประกาศ',
  };

  const Icon = config.icon;

  return (
    <aside
      aria-label="ประกาศจากผู้ดูแลระบบ"
      className={`relative z-40 flex items-center justify-between gap-4 px-4 py-3 sm:py-3.5 shadow-lg transition-all ${config.bg}`}
    >
      <div className="mx-auto flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-center">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs sm:text-sm font-black tracking-wide shadow-xs backdrop-blur-md ${config.badge}`}>
          <Icon size={16} className="shrink-0" aria-hidden="true" />
          <span>{config.label}</span>
        </span>

        {broadcast.maintenanceLock && isSuperadmin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-0.5 text-[11px] font-black text-slate-950">
            <ShieldCheck size={13} /> สิทธิ์ SuperAdmin เข้าใช้งานได้ปกติ
          </span>
        ) : null}

        <span className="text-sm sm:text-base font-black text-white tracking-tight drop-shadow-xs">
          {broadcast.title}
        </span>

        {broadcast.message ? (
          <>
            <span className="hidden opacity-60 sm:inline text-white font-bold">|</span>
            <span className="text-white/95 text-xs sm:text-sm font-bold leading-relaxed">
              {broadcast.message}
            </span>
          </>
        ) : null}

        {broadcast.linkUrl ? (
          <a
            href={broadcast.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1 text-xs font-black text-slate-900 shadow-sm hover:bg-white/90 active:scale-95 transition"
          >
            <span>{broadcast.linkText || 'ดูรายละเอียด'}</span>
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>

      {broadcast.dismissible !== false && !broadcast.maintenanceLock ? (
        <button
          type="button"
          onClick={() => dismissBroadcast(broadcast.id)}
          aria-label="ปิดการแจ้งเตือน"
          className="shrink-0 grid h-8 w-8 place-items-center rounded-xl bg-black/15 text-white/80 hover:bg-black/30 hover:text-white transition active:scale-95"
          title="ปิดแถบประกาศนี้"
        >
          <X size={18} />
        </button>
      ) : null}
    </aside>
  );
}
