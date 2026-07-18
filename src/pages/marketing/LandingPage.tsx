import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  FileSpreadsheet,
  HeartHandshake,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import type { AppSessionContext } from '../../types/core';

interface LandingPageProps {
  session: AppSessionContext | null;
}

const modules = [
  {
    icon: Users,
    title: 'Student 360',
    body: 'จัดการรายชื่อนักเรียน โปรไฟล์รายคน ผู้ปกครอง เคสดูแล Portal และประวัติการทำงานในพื้นที่เดียว',
  },
  {
    icon: ClipboardList,
    title: 'งานครูและเช็กชื่อ',
    body: 'เปิดรอบเช็กชื่อ บันทึกงานประจำวัน และต่อยอดเป็นรายงานเวลาเรียนรายเดือน',
  },
  {
    icon: BookOpenCheck,
    title: 'คะแนนรายวิชา',
    body: 'สร้างชุดคะแนน กรอกคะแนนทั้งห้อง ดูค่าเฉลี่ย และเตรียม export ต่อให้รายงานโรงเรียน',
  },
  {
    icon: WalletCards,
    title: 'เงินออม',
    body: 'บันทึกเงินออมนักเรียนรายวัน สรุปยอดรายเดือน และจัดรูปแบบรายงานพร้อมลงนาม',
  },
  {
    icon: HeartHandshake,
    title: 'เยี่ยมบ้านและเคสดูแล',
    body: 'ฟอร์มเยี่ยมบ้าน กสศ.01 แนบรูปที่ย่อขนาดแล้ว ปักหมุด Google Maps และบันทึกเคสติดตาม',
  },
  {
    icon: FileSpreadsheet,
    title: 'นำเข้าและรายงาน',
    body: 'นำเข้ารายชื่อจาก DMC/Excel ตรวจข้อมูลซ้ำ สำรองข้อมูล และ export รายงาน PDF/XLSX',
  },
];

const workflowSteps = [
  'สมัครและกรอกโรงเรียนให้ตรงกัน',
  'เลือกหรือสร้าง workspace ของโรงเรียน',
  'เจ้าของ workspace อนุมัติครูที่ขอเข้าร่วม',
  'นำเข้าหรือเพิ่มนักเรียน',
  'เริ่มเช็กชื่อ คะแนน เงินออม เยี่ยมบ้าน และรายงาน',
];

const trustItems = [
  {
    icon: Database,
    title: 'แยกข้อมูลตาม workspace',
    body: 'ทุกข้อมูลหลักผูก workspace_id และออกแบบให้โรงเรียนเห็นเฉพาะข้อมูลของตัวเอง',
  },
  {
    icon: ShieldCheck,
    title: 'คุมสิทธิ์ด้วย RLS',
    body: 'Frontend เป็น UX ส่วนสิทธิ์จริงอยู่ที่ Supabase RLS และ Edge Functions',
  },
  {
    icon: LockKeyhole,
    title: 'ไม่มี service role ในหน้าเว็บ',
    body: 'ข้อมูลสำคัญและการอนุมัติที่เสี่ยงต้องผ่าน server-side function เท่านั้น',
  },
];

export function LandingPage({ session }: LandingPageProps) {
  const dashboardHref = session?.workspace ? '/app/dashboard' : '/app/select-workspace';
  const primaryHref = session ? dashboardHref : '/login?mode=register';
  const primaryLabel = session ? 'เข้าแดชบอร์ด' : 'เริ่มใช้งานฟรี';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fff8ed] text-[#271d15]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(156,100,38,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(156,100,38,0.07)_1px,transparent_1px)] bg-[length:42px_42px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(244,180,70,0.30),transparent_24rem),radial-gradient(circle_at_8%_22%,rgba(255,232,182,0.55),transparent_22rem),linear-gradient(180deg,#fff8ed_0%,#fff1db_58%,#fffaf4_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col px-5 pb-12 pt-5 sm:px-8 lg:px-10">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <Link
              className="inline-flex items-center gap-3 rounded-[8px] border border-[#ead7bb] bg-white/80 px-3 py-3 shadow-[0_16px_42px_rgba(115,74,32,0.10)] backdrop-blur"
              to="/"
            >
              <AppLogo className="h-11 w-11 rounded-[8px] bg-white ring-1 ring-[#ead7bb]" />
              <span>
                <span className="block text-lg font-black leading-5">ClassCare 360</span>
                <span className="block text-xs font-bold text-[#7b603f]">ดูแลทั้งห้อง ครบจบในระบบเดียว</span>
              </span>
            </Link>

            <nav className="flex w-full max-w-full flex-wrap items-center gap-2 text-sm font-black md:w-auto">
              <a className="hidden rounded-[8px] px-3 py-2 text-[#6c5133] transition hover:bg-white/80 sm:inline-flex" href="#modules">
                ฟีเจอร์
              </a>
              <a className="hidden rounded-[8px] px-3 py-2 text-[#6c5133] transition hover:bg-white/80 sm:inline-flex" href="#security">
                ความปลอดภัย
              </a>
              <Link className="hidden rounded-[8px] px-3 py-2 text-[#6c5133] transition hover:bg-white/80 sm:inline-flex" to="/pricing">
                แพ็กเกจ
              </Link>
              <Link
                className="inline-flex h-11 max-w-full items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 text-white shadow-[0_18px_38px_rgba(88,52,20,0.18)] transition hover:-translate-y-0.5 hover:bg-[#3b2918] sm:w-auto"
                style={{ width: 'min(100%, calc(100vw - 2.5rem))' }}
                to={session ? dashboardHref : '/login'}
              >
                {session ? 'เข้าแอป' : 'เข้าสู่ระบบ'}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </nav>
          </header>

          <div className="grid min-w-0 flex-1 items-center gap-10 py-10 lg:grid-cols-2">
            <div className="min-w-0 max-w-3xl" style={{ maxWidth: 'min(48rem, calc(100vw - 2.5rem))' }}>
              <h1 className="max-w-full break-words text-5xl font-black leading-[0.98] tracking-normal text-[#271d15] [overflow-wrap:anywhere] sm:text-7xl lg:text-7xl xl:text-8xl">
                ระบบช่วยครูดูแลนักเรียนทั้งห้อง
              </h1>
              <p className="mt-6 max-w-full break-words text-lg font-bold leading-9 text-[#654b31] [overflow-wrap:anywhere] sm:max-w-2xl">
                ClassCare 360 ช่วยครูประจำชั้นจัดข้อมูลนักเรียน งานครู คะแนน เงินออม พฤติกรรม เยี่ยมบ้าน รายงาน และ workspace ของโรงเรียนในระบบเดียว โดยคุมสิทธิ์ตามบทบาทและแยกข้อมูลแต่ละโรงเรียนอย่างชัดเจน
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#f0b64f] px-6 text-sm font-black text-[#271d15] shadow-[0_18px_40px_rgba(188,117,32,0.24)] transition hover:-translate-y-0.5 hover:bg-[#f5c970]"
                  to={primaryHref}
                >
                  {primaryLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#e7d2b0] bg-white/78 px-6 text-sm font-black text-[#4b3521] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  to="/pricing"
                >
                  ดูแพ็กเกจ
                  <WalletCards size={18} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ['18', 'โมดูลหลัก'],
                  ['RLS', 'แยกข้อมูลโรงเรียน'],
                  ['VIP', 'Admin ใช้ได้ตลอดชีพ'],
                ].map(([value, label]) => (
                  <div className="rounded-[8px] border border-[#e7d2b0] bg-white/70 p-4 shadow-sm backdrop-blur" key={label}>
                    <p className="text-3xl font-black text-[#3b2918]">{value}</p>
                    <p className="mt-1 text-xs font-black text-[#7b603f]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-[500px] min-w-0 overflow-hidden rounded-[8px] border border-[#e3c79d] bg-[#fffdf8]/82 p-4 shadow-[0_28px_90px_rgba(115,74,32,0.16)] backdrop-blur-xl lg:block">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(156,100,38,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(156,100,38,0.07)_1px,transparent_1px)] bg-[length:34px_34px]" />
              <div className="relative z-10 grid h-full gap-4 lg:grid-cols-5">
                <aside className="rounded-[8px] border border-[#dfc29b] bg-slate-950 p-4 text-white lg:col-span-2">
                  <div className="flex items-center gap-3">
                    <AppLogo className="h-12 w-12 rounded-[8px] bg-white ring-1 ring-white/40" />
                    <div>
                      <p className="text-sm font-black">ClassCare</p>
                      <p className="text-xs font-bold text-[#f9e7c9]">โรงเรียนบ้านโคกสูง</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2">
                    {['ภาพรวม', 'นักเรียน', 'งานครู', 'คะแนน', 'รายงาน'].map((item, index) => (
                      <div
                        className={`rounded-[8px] px-3 py-3 text-sm font-black ${
                          index === 0 ? 'bg-[#f6c76d] text-[#3b2918]' : 'bg-white/[0.08] text-[#f9e7c9]'
                        }`}
                        key={item}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="rounded-[8px] border border-[#ead8bd] bg-[#fffaf3] p-4 text-[#271d15] lg:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#a56519]">Live classroom</p>
                      <h2 className="mt-1 text-2xl font-black">แดชบอร์ดครูประจำชั้น</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#edf8e9] px-3 py-2 text-xs font-black text-[#3d7b3d] ring-1 ring-[#cbe8c4]">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      พร้อมใช้งาน
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      ['36', 'นักเรียนในความดูแล'],
                      ['4', 'เคสที่ต้องติดตาม'],
                      ['92%', 'เช็กชื่อแล้ว'],
                      ['8,420', 'เงินออมเดือนนี้'],
                    ].map(([value, label]) => (
                      <div className="rounded-[8px] border border-[#ead8bd] bg-white p-4" key={label}>
                        <p className="text-3xl font-black">{value}</p>
                        <p className="mt-1 text-xs font-black text-[#7b603f]">{label}</p>
                        <div className="mt-3 h-2 rounded-full bg-[#f3eadc]">
                          <div className="h-2 w-4/5 rounded-full bg-[#e8a63f]" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[8px] border border-[#ead8bd] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">คิวอนุมัติครูเข้า workspace</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-[#7b603f]">
                          กันครูต่างโรงเรียนเข้าข้อมูลผิดห้อง ก่อนเริ่มเห็นรายชื่อนักเรียน
                        </p>
                      </div>
                      <span className="rounded-full bg-[#fff4d6] px-3 py-1 text-xs font-black text-[#9a5a00] ring-1 ring-[#f1d18c]">2 รออนุมัติ</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {['ครูประจำชั้น ป.5/2', 'ครูแนะแนว'].map((item) => (
                        <div className="flex items-center justify-between rounded-[8px] bg-[#fff8ef] px-3 py-3 text-sm font-black" key={item}>
                          <span>{item}</span>
                          <span className="text-[#a56519]">ตรวจสอบ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#a56519]">Designed for teachers</p>
            <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">ลดงานกระจัดกระจาย ให้ครูเห็นภาพรวมที่ต้องตัดสินใจ</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              'รายชื่อนักเรียนไม่หาย เพราะทุกเมนูเลือกห้องที่มีนักเรียนจริงก่อน',
              'งานเยี่ยมบ้านมี Google Maps และรูปถูกย่อขนาดก่อนเก็บ',
              'รายงานออกแบบให้ใกล้รูปแบบเอกสารโรงเรียน',
              'เจ้าของ workspace อนุมัติครูเข้าโรงเรียนก่อนเห็นข้อมูล',
            ].map((item) => (
              <div className="rounded-[8px] border border-[#ead8bd] bg-white/78 p-4 text-sm font-bold leading-7 text-[#654b31] shadow-sm" key={item}>
                <BadgeCheck className="mb-3 text-[#c57916]" size={22} aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#fffaf3] px-5 py-16 sm:px-8 lg:px-10" id="modules">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#a56519]">Core modules</p>
            <h2 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">ระบบหลักที่ครูใช้ได้ทุกวัน</h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <article className="rounded-[8px] border border-[#ead8bd] bg-white p-5 shadow-[0_20px_55px_rgba(122,79,38,0.07)]" key={module.title}>
                  <div className="grid h-12 w-12 place-items-center rounded-[8px] bg-[#f7dfad] text-[#6e4215]">
                    <Icon size={23} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-black">{module.title}</h3>
                  <p className="mt-3 text-sm font-bold leading-7 text-[#6f5434]">{module.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-10" id="security">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_430px]">
          <div className="rounded-[8px] border border-[#ead8bd] bg-white p-6 shadow-[0_24px_70px_rgba(122,79,38,0.08)] sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#a56519]">Workspace workflow</p>
            <h2 className="mt-4 text-4xl font-black leading-tight">เริ่มใช้งานเป็นขั้นตอน ไม่ปล่อยให้ข้อมูลปนกัน</h2>
            <div className="mt-8 grid gap-3">
              {workflowSteps.map((step, index) => (
                <div className="flex gap-4 rounded-[8px] border border-[#ead8bd] bg-[#fff8ef] p-4" key={step}>
                  <div className="landing-workflow-number grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black">
                    {index + 1}
                  </div>
                  <p className="self-center text-sm font-black text-[#4b3521]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-owner-panel rounded-[8px] p-6 shadow-[0_24px_70px_rgba(122,79,38,0.14)] sm:p-8">
            <div className="grid h-14 w-14 place-items-center rounded-[8px] bg-[#f6c76d] text-[#3b2918]">
              <MapPinned size={28} aria-hidden="true" />
            </div>
            <h2 className="mt-6 text-3xl font-black leading-tight">เหมาะกับโรงเรียนที่เริ่มจากครูคนเดียว หรือมีหลายห้องพร้อมกัน</h2>
            <p className="landing-owner-panel-muted mt-4 text-sm font-bold leading-7">
              เจ้าของ workspace ใช้งานเป็นครูได้เอง และยังเพิ่มครูร่วมได้เมื่อโรงเรียนขยายการใช้ระบบ
            </p>
            <div className="mt-6 grid gap-3">
              {trustItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="landing-owner-panel-card rounded-[8px] p-4" key={item.title}>
                    <div className="flex items-center gap-3">
                      <Icon className="text-[#f6c76d]" size={22} aria-hidden="true" />
                      <h3 className="text-sm font-black">{item.title}</h3>
                    </div>
                    <p className="landing-owner-panel-muted mt-2 text-xs font-bold leading-6">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[8px] border border-[#e3c79d] bg-[#f6c76d] p-6 shadow-[0_28px_80px_rgba(166,95,20,0.18)] sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-4xl font-black leading-tight text-[#271d15]">พร้อมทดลอง ClassCare 360 กับห้องเรียนจริงหรือยัง</h2>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#5b3f22]">
                เริ่มจากเพิ่มห้องเรียนและรายชื่อนักเรียนก่อน แล้วค่อยต่อยอดไปเช็กชื่อ คะแนน เงินออม เยี่ยมบ้าน รายงาน และระบบผู้ปกครอง
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#271d15] px-6 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#3b2918]"
                to={primaryHref}
              >
                {primaryLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#d49a31] bg-white/80 px-6 text-sm font-black text-[#3b2918] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                to="/public/report"
              >
                ดูรายงานนักเรียน
                <FileSearch size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
