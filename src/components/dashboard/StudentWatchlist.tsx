import { ArrowRight, Users } from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';

export interface WatchlistStudentItem {
  accent: string;
  id?: string;
  name: string;
  reason?: string;
  status: string;
}

interface StudentWatchlistProps {
  classroomName?: string;
  isHomeroom?: boolean;
  students: WatchlistStudentItem[];
}

export function StudentWatchlist({ classroomName, isHomeroom, students }: StudentWatchlistProps) {
  return (
    <article className="app-panel-pad rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-black text-rose-600">STUDENT 360</p>
            {isHomeroom && (
              <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 border border-amber-300">
                ⭐ ห้องที่ปรึกษา
              </span>
            )}
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            นักเรียนที่ต้องติดตาม {classroomName ? `(${classroomName})` : ''}
          </h2>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
          <Users size={20} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {students.length > 0 ? (
          students.map((student, index) => (
            <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={student.id || student.name + index}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-black text-cyan-100">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black tracking-tight text-slate-950">{student.name}</p>
                <p className="text-xs font-bold text-slate-500">{student.reason || 'ตรวจสอบรายการล่าสุด'}</p>
              </div>
              <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-black ${student.accent}`}>
                {student.status}
              </span>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-xs font-bold text-slate-400">
            ไม่มีนักเรียนที่มีเคสติดตามในห้องเรียนนี้
          </div>
        )}
      </div>

      <Link className="mt-4 inline-flex items-center gap-1 text-xs font-black text-cyan-700 hover:text-cyan-800" to="/app/dashboard?view=students&studentView=care">
        ดูเคสติดตามทั้งหมด <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}
