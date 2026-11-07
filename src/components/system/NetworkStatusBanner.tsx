import { useEffect, useState } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';

type NetworkState = 'online' | 'offline' | 'restored';

export function NetworkStatusBanner() {
  const [state, setState] = useState<NetworkState>(() =>
    typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  );

  useEffect(() => {
    let restoreTimer: number | undefined;
    const handleOffline = () => {
      if (restoreTimer) window.clearTimeout(restoreTimer);
      setState('offline');
    };
    const handleOnline = () => {
      setState('restored');
      restoreTimer = window.setTimeout(() => setState('online'), 6000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
  }, []);

  if (state === 'online') return null;
  const isOffline = state === 'offline';
  const Icon = isOffline ? WifiOff : CheckCircle2;

  return (
    <div
      aria-live="polite"
      className={`flex items-start gap-3 px-4 py-3 text-sm font-semibold sm:items-center sm:px-6 ${
        isOffline ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-950'
      }`}
      role="status"
    >
      <Icon className="mt-0.5 shrink-0 sm:mt-0" size={18} aria-hidden="true" />
      <span>
        {isOffline
          ? 'เครือข่ายขาดการเชื่อมต่อ งานที่ยังไม่ได้บันทึกอาจไม่ถูกส่ง โปรดคงหน้านี้ไว้และตรวจสถานะหลังเชื่อมต่อกลับ'
          : 'เครือข่ายกลับมาแล้ว โปรดตรวจว่ารายการล่าสุดแสดงสถานะบันทึกสำเร็จ'}
      </span>
    </div>
  );
}
