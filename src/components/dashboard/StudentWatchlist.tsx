import { Users } from 'lucide-react';

import type { studentWatchlist } from '../../data/dashboard';

interface StudentWatchlistProps {
  students: typeof studentWatchlist;
}

export function StudentWatchlist({ students }: StudentWatchlistProps) {
  return (
    <article className="glass-panel rounded-3xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-rose-600">Student 360</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">นักเรียนที่ต้องดูแล</h2>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm">
          <Users size={26} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {students.map((student, index) => (
          <div
            className="group flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white/75 p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_38px_rgba(244,63,94,0.12)]"
            key={student.name}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-cyan-100">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black tracking-tight text-slate-950">{student.name}</p>
              <p className="text-sm font-bold text-slate-500">ข้อมูลตัวอย่างสำหรับ layout</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${student.accent}`}>
              {student.status}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}
