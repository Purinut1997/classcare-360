import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, ExternalLink, Info, Wrench, X } from 'lucide-react';
import { dismissBroadcast, getSystemBroadcast, isBroadcastDismissed, type SystemBroadcast } from '../../lib/systemBroadcast';

export function GlobalBroadcastBanner() {
  const [broadcast, setBroadcast] = useState<SystemBroadcast | null>(() => {
    const b = getSystemBroadcast();
    return b && !isBroadcastDismissed(b.id) ? b : null;
  });

  useEffect(() => {
    const handleUpdate = () => {
      const b = getSystemBroadcast();
      setBroadcast(b && !isBroadcastDismissed(b.id) ? b : null);
    };

    window.addEventListener('classcare-broadcast-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('classcare-broadcast-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  if (!broadcast || !broadcast.isActive) return null;

  const config = {
    info: {
      bg: 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 text-white',
      badge: 'bg-white/20 text-white',
      icon: Info,
      label: 'ประกาศ',
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white',
      badge: 'bg-black/20 text-white',
      icon: AlertTriangle,
      label: 'แจ้งเตือนสำคัญ',
    },
    maintenance: {
      bg: 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-800 text-white animate-pulse-slow',
      badge: 'bg-white/20 text-white',
      icon: Wrench,
      label: 'แจ้งปรับปรุงระบบ',
    },
  }[broadcast.severity] || {
    bg: 'bg-slate-800 text-white',
    badge: 'bg-white/20 text-white',
    icon: Bell,
    label: 'ประกาศ',
  };

  const Icon = config.icon;

  return (
    <aside
      aria-label="ประกาศจากผู้ดูแลระบบ"
      className={`relative z-40 flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold shadow-md transition-all ${config.bg}`}
    >
      <div className="mx-auto flex flex-wrap items-center justify-center gap-2.5 text-center">
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm shadow-sm">
          <Icon size={14} className="shrink-0" aria-hidden="true" />
          <span>{config.label}</span>
        </span>
        <span className="font-black text-white sm:text-sm">{broadcast.title}</span>
        <span className="hidden opacity-60 sm:inline">|</span>
        <span className="text-white/90 text-xs sm:text-sm">{broadcast.message}</span>
        {broadcast.linkUrl && (
          <a
            href={broadcast.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 font-black text-white hover:text-white/80"
          >
            {broadcast.linkText || 'ดูรายละเอียด'}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      {broadcast.dismissible !== false && (
        <button
          type="button"
          onClick={() => dismissBroadcast(broadcast.id)}
          aria-label="ปิดการแจ้งเตือน"
          className="shrink-0 rounded-lg p-1 text-white/70 hover:bg-white/20 hover:text-white transition"
        >
          <X size={15} />
        </button>
      )}
    </aside>
  );
}
