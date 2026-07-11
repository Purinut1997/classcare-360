import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PackageCard() {
  return (
    <article className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-white/90 via-violet-50/90 to-sky-50/90 p-5 shadow-[0_22px_50px_rgba(124,58,237,0.13)] backdrop-blur-xl sm:p-6">
      <p className="text-sm font-black uppercase tracking-wide text-violet-700">Premium Package</p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
        อัปเกรดเป็น ClassCare 360 VIP
      </h2>
      <p className="mt-3 text-sm font-bold leading-7 text-slate-700">
        เปิดทุกโมดูล รายงาน PDF/XLSX, Parent/Student Portal, แจ้งเตือน Telegram/LINE
        และ Google Drive Cold Storage
      </p>
      <div className="mt-5 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-white">
        <p className="text-sm font-black text-slate-500">ราคาเริ่มต้น</p>
        <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">100 บาท/ปี</p>
        <Link
          className="blue-action mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black"
          to="/app/package"
        >
          สมัคร VIP
          <Sparkles size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
