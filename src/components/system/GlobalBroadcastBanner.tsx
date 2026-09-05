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
      bg: 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-800 text-white border-b border-rose-400/30 animate-pulse-slow',
      badge: 'bg-white/25 text-white ring-1 ring-white/30',
      icon: Wrench,
      label: 'แจ้งปรับปรุงระบบ',
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
        {/* Category Badge */}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs sm:text-sm font-black tracking-wide shadow-xs backdrop-blur-md ${config.badge}`}>
          <Icon size={16} className="shrink-0" aria-hidden="true" />
          <span>{config.label}</span>
        </span>

        {/* Title */}
        <span className="text-sm sm:text-base font-black text-white tracking-tight drop-shadow-xs">
          {broadcast.title}
        </span>

        {/* Message */}
        {broadcast.message && (
          <>
            <span className="hidden opacity-60 sm:inline text-white font-bold">|</span>
            <span className="text-white/95 text-xs sm:text-sm font-bold leading-relaxed">
              {broadcast.message}
            </span>
          </>
        )}

        {/* Optional Link Button */}
        {broadcast.linkUrl && (
          <a
            href={broadcast.linkUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1 text-xs font-black text-slate-900 shadow-sm hover:bg-white/90 active:scale-95 transition"
          >
            <span>{broadcast.linkText || 'ดูรายละเอียด'}</span>
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Dismiss Button */}
      {broadcast.dismissible !== false && (
        <button
          type="button"
          onClick={() => dismissBroadcast(broadcast.id)}
          aria-label="ปิดการแจ้งเตือน"
          className="shrink-0 grid h-8 w-8 place-items-center rounded-xl bg-black/15 text-white/80 hover:bg-black/30 hover:text-white transition active:scale-95"
          title="ปิดแถบประกาศนี้"
        >
          <X size={18} />
        </button>
      )}
    </aside>
  );
}
