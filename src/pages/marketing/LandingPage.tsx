import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import type { AppSessionContext } from '../../types/core';

interface LandingPageProps {
  session: AppSessionContext | null;
}

const tasks = [
  { icon: ClipboardCheck, title: 'เช็กชื่อรายวันและรายวิชา', body: 'บันทึกการมาเรียนแยกคาบและรายวิชา พร้อมสถานะที่ใช้ในรายงานจริง' },
  { icon: CalendarRange, title: 'ตารางสอนที่ใช้ร่วมกัน', body: 'สร้างรายวิชา กำหนดคาบเรียน และใช้เป็นข้อมูลกลางของครูในโรงเรียน' },
  { icon: BookOpenCheck, title: 'คะแนนและข้อมูลนักเรียน', body: 'จัดการรายชื่อนักเรียน คะแนน และข้อมูลประกอบการดูแลรายบุคคล' },
  { icon: FileSpreadsheet, title: 'รายงานพร้อมใช้งาน', body: 'สรุปเวลาเรียนรายวิชา การมาเรียน และผลการเรียนจากข้อมูลที่บันทึกไว้' },
];

const previewRows = [
  ['คณิตศาสตร์ 1', '08:30 – 09:20', '28', '2'],
  ['ภาษาไทย 1', '09:30 – 10:20', '29', '1'],
  ['วิทยาศาสตร์ 1', '10:30 – 11:20', '27', '3'],
];

export function LandingPage({ session }: LandingPageProps) {
  const dashboardHref = session?.workspace ? '/app/dashboard' : '/app/select-workspace';
  const startHref = session ? dashboardHref : '/login?mode=register';

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <Link className="inline-flex items-center gap-3" to="/" aria-label="ClassCare 360 หน้าแรก">
            <AppLogo className="h-10 w-10 rounded-xl bg-white ring-1 ring-slate-200" />
            <span className="text-lg font-black tracking-tight text-[#06152d]">ClassCare 360</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link className="hidden h-10 items-center rounded-xl px-4 text-sm font-black text-slate-600 transition hover:bg-slate-100 sm:inline-flex" to="/pricing">
              แพ็กเกจ
            </Link>
            <Link className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-[#06152d] transition hover:bg-slate-50" to={session ? dashboardHref : '/login'}>
              {session ? 'เข้าแอป' : 'เข้าสู่ระบบ'}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(520px,1.2fr)] lg:items-center lg:px-10 lg:py-20">
          <div className="max-w-xl">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-[#06152d] sm:text-5xl">
              จัดการงานประจำวันของครู ให้เป็นระบบในที่เดียว
            </h1>
            <p className="mt-5 text-base font-semibold leading-8 text-slate-600 sm:text-lg">
              บันทึกการมาเรียนรายวันและรายวิชา จัดการตารางสอน คะแนน และสร้างรายงานจากข้อมูลจริงของห้องเรียน
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-amber-400" to={startHref}>
                {session ? 'ไปที่แดชบอร์ด' : 'เริ่มใช้งาน'} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50" to="/public/report">
                ดูรายงานนักเรียน <BarChart3 size={18} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-500">เริ่มจากสร้าง workspace แล้วเพิ่มห้องเรียน รายวิชา และรายชื่อนักเรียน</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.10)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-sm font-black text-[#06152d]">ภาพรวมงานครูวันนี้</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">เช็กชื่อรายวิชาและตารางสอน</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 size={14} /> พร้อมใช้งาน</span>
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(220px,0.92fr)]">
              <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">การเข้าเรียนรายวิชา</h2><Link className="text-xs font-black text-amber-700 hover:underline" to={session ? '/app/dashboard?view=teacher-work' : '/login'}>เปิดเช็กชื่อ</Link></div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_42px_42px] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-500"><span>รายวิชา</span><span>เวลา</span><span className="text-center">มา</span><span className="text-center">ขาด</span></div>
                  {previewRows.map(([subject, time, present, absent]) => <div className="grid grid-cols-[minmax(0,1fr)_90px_42px_42px] gap-2 border-t border-slate-100 px-3 py-3 text-xs font-bold text-slate-700" key={subject}><span>{subject}</span><span className="text-slate-500">{time}</span><span className="text-center text-emerald-700">{present}</span><span className="text-center text-rose-600">{absent}</span></div>)}
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">ตารางสอนวันนี้</h2><Link className="text-xs font-black text-amber-700 hover:underline" to={session ? '/app/dashboard?view=schedule' : '/login'}>จัดการ</Link></div>
                <div className="grid gap-2">
                  {['คาบ 1  คณิตศาสตร์', 'คาบ 2  ภาษาไทย', 'คาบ 3  วิทยาศาสตร์', 'คาบ 4  สังคมศึกษา'].map((item, index) => <div className={`rounded-xl border p-3 text-xs font-black ${index === 1 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`} key={item}>{item}</div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-6">
          {[['1', 'สร้าง workspace ของโรงเรียน', 'กำหนดข้อมูลโรงเรียนและเชิญครูเข้าร่วม'], ['2', 'ตั้งค่าห้องเรียนและรายวิชา', 'สร้างรายวิชา ตารางสอน และเพิ่มรายชื่อนักเรียน'], ['3', 'เริ่มบันทึกและออกรายงาน', 'ใช้เช็กชื่อ คะแนน และรายงานตามช่วงเวลาที่ต้องการ']].map(([number, title, body]) => <div className="flex gap-4" key={number}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#06152d] text-sm font-black text-white">{number}</span><div><h2 className="font-black text-slate-900">{title}</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{body}</p></div></div>)}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <h2 className="text-2xl font-black tracking-tight text-[#06152d] sm:text-3xl">ฟังก์ชันที่เชื่อมกับงานจริงของครู</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tasks.map(({ icon: Icon, title, body }) => <div className="rounded-2xl border border-slate-200 bg-white p-5" key={title}><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon size={20} /></span><h3 className="mt-4 font-black text-slate-900">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{body}</p></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
