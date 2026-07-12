import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import type { AppSessionContext } from '../../types/core';

interface LandingPageProps {
  session: AppSessionContext | null;
}

const featureGroups = [
  {
    icon: Users,
    title: 'Student 360',
    body: 'รวมข้อมูลนักเรียน ผู้ปกครอง เคสดูแล พฤติกรรม และประวัติสำคัญไว้ในที่เดียว',
  },
  {
    icon: ClipboardList,
    title: 'งานครูและเช็กชื่อ',
    body: 'เปิดรอบเช็กชื่อ บันทึกงานประจำวัน และติดตามนักเรียนที่ต้องดูแลต่อ',
  },
  {
    icon: BarChart3,
    title: 'คะแนนและรายงาน',
    body: 'สรุปเวลาเรียน คะแนน เงินออม และพฤติกรรม เป็นรายงานที่อ่านง่าย',
  },
  {
    icon: WalletCards,
    title: 'เงินออมและแพ็กเกจ',
    body: 'จัดการเงินออมรายคน พร้อมฐานระบบแพ็กเกจ ClassCare 360 VIP',
  },
  {
    icon: HeartHandshake,
    title: 'ดูแลรายเคส',
    body: 'บันทึกเคสดูแล การเยี่ยมบ้าน และสิ่งที่ต้องติดตามต่อแบบเป็นระบบ',
  },
  {
    icon: BellRing,
    title: 'แจ้งเตือนและพอร์ทัล',
    body: 'เตรียมพอร์ทัลผู้ปกครอง/นักเรียน และช่องทางแจ้งเตือนในอนาคต',
  },
];

const trustItems = [
  'แยกข้อมูลรายโรงเรียนด้วย workspace และ Supabase RLS',
  'เจ้าของ workspace อนุมัติครูที่ขอเข้าร่วมก่อนเห็นข้อมูล',
  'Superadmin และ Admin ได้สิทธิ์ดูแลระบบแบบ lifetime VIP',
  'มี audit log สำหรับ action สำคัญและ workflow ที่ต้องตรวจย้อนหลัง',
];

const roleCards = [
  {
    icon: GraduationCap,
    title: 'ครูประจำชั้น',
    body: 'เห็นภาพห้องเรียน งานค้าง เคสสำคัญ และรายงานที่ต้องใช้ประจำวัน',
  },
  {
    icon: School,
    title: 'เจ้าของ workspace',
    body: 'จัดการโรงเรียน ห้องเรียน สมาชิก และคำขอเข้าร่วมของครูในโรงเรียนเดียวกัน',
  },
  {
    icon: ShieldCheck,
    title: 'Superadmin',
    body: 'ดูแลแพ็กเกจ ผู้ดูแลระบบ readiness และภาพรวมการใช้งานของระบบทั้งหมด',
  },
];

export function LandingPage({ session }: LandingPageProps) {
  const dashboardHref = session?.workspace ? '/app/dashboard' : '/app/select-workspace';
  const primaryHref = session ? dashboardHref : '/login?mode=register';
  const primaryLabel = session ? 'เข้าแดชบอร์ด' : 'เริ่มใช้งาน';

  return (
    <main className="min-h-screen bg-[#fff8ef] text-[#2f241b]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(180,123,62,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(180,123,62,0.07)_1px,transparent_1px)] bg-[length:42px_42px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_16%,rgba(251,191,36,0.26),transparent_24rem),radial-gradient(circle_at_14%_20%,rgba(253,230,138,0.32),transparent_22rem),linear-gradient(180deg,#fff8ef_0%,#fff3df_62%,#fffaf3_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex items-center gap-3 rounded-[8px] border border-[#e7d6bd] bg-white/78 px-3 py-3 shadow-[0_16px_40px_rgba(122,79,38,0.10)] backdrop-blur" to="/">
              <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-[#f6c76d] text-[#3a2817]">
                <GraduationCap size={25} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-black leading-5">ClassCare 360</span>
                <span className="block text-xs font-bold text-[#8b6a45]">ดูแลทั้งห้อง ครบจบในระบบเดียว</span>
              </span>
            </Link>

            <nav className="flex flex-wrap items-center gap-2 text-sm font-black">
              <a className="rounded-[8px] px-3 py-2 text-[#6f5434] transition hover:bg-white/80 hover:text-[#2f241b]" href="#features">
                ฟีเจอร์
              </a>
              <a className="rounded-[8px] px-3 py-2 text-[#6f5434] transition hover:bg-white/80 hover:text-[#2f241b]" href="#security">
                ความปลอดภัย
              </a>
              <Link className="rounded-[8px] px-3 py-2 text-[#6f5434] transition hover:bg-white/80 hover:text-[#2f241b]" to="/pricing">
                แพ็กเกจ
              </Link>
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#3a2817] px-4 text-white shadow-[0_18px_36px_rgba(88,52,20,0.18)] transition hover:-translate-y-0.5 hover:bg-[#4d3520]" to={session ? dashboardHref : '/login'}>
                {session ? 'เข้าแอป' : 'เข้าสู่ระบบ'}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </nav>
          </header>

          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1fr)]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#efcf94] bg-white/72 px-4 py-2 text-sm font-black text-[#7c4f1f] shadow-sm">
                <Sparkles size={17} aria-hidden="true" />
                ระบบช่วยครูที่นุ่มตา ใช้ได้จริงในโรงเรียน
              </div>
              <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-normal text-[#2f241b] sm:text-7xl lg:text-8xl">
                ClassCare 360
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-bold leading-9 text-[#654b31]">
                เว็บแอปสำหรับครูประจำชั้นที่อยากเห็นภาพทั้งห้องในหน้าเดียว ตั้งแต่ข้อมูลนักเรียน งานครู คะแนน เงินออม พฤติกรรม รายงาน workspace ของโรงเรียน และสิทธิ์ Superadmin สำหรับดูแลระบบ
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#f0b64f] px-6 text-sm font-black text-[#2f241b] shadow-[0_18px_40px_rgba(188,117,32,0.24)] transition hover:-translate-y-0.5 hover:bg-[#f4c76f]" to={primaryHref}>
                  {primaryLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#e7d6bd] bg-white/78 px-6 text-sm font-black text-[#4d3520] shadow-sm transition hover:-translate-y-0.5 hover:bg-white" to="/pricing">
                  ดูแพ็กเกจ
                  <WalletCards size={18} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ['18', 'โมดูลหลัก'],
                  ['RLS', 'แยกข้อมูลโรงเรียน'],
                  ['VIP', 'สิทธิ์ผู้ดูแล'],
                ].map(([value, label]) => (
                  <div className="rounded-[8px] border border-[#e7d6bd] bg-white/70 p-4 shadow-sm backdrop-blur" key={label}>
                    <p className="text-3xl font-black text-[#3a2817]">{value}</p>
                    <p className="mt-1 text-xs font-black text-[#8b6a45]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[520px] overflow-hidden rounded-[8px] border border-[#e5cfae] bg-[#fffdf8]/78 p-4 shadow-[0_28px_90px_rgba(122,79,38,0.16)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(180,123,62,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(180,123,62,0.07)_1px,transparent_1px)] bg-[length:34px_34px]" />
              <div className="relative z-10 grid h-full gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
                <aside className="rounded-[8px] border border-[#dfc29b] bg-[#3a2817] p-4 text-white">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-[#f6c76d] text-[#3a2817]">
                      <BookOpenCheck size={23} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-black">ClassCare</p>
                      <p className="text-xs font-bold text-[#f9e7c9]">โรงเรียนบ้านโคกสูง</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2">
                    {['ภาพรวม', 'นักเรียน', 'งานครู', 'คะแนน', 'รายงาน'].map((item, index) => (
                      <div className={`rounded-[8px] px-3 py-3 text-sm font-black ${index === 0 ? 'bg-[#f6c76d] text-[#3a2817]' : 'bg-white/[0.08] text-[#f9e7c9]'}`} key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="rounded-[8px] border border-[#ead8bd] bg-[#fffaf3] p-4 text-[#2f241b]">
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
                        <p className="mt-1 text-xs font-black text-[#8b6a45]">{label}</p>
                        <div className="mt-3 h-2 rounded-full bg-[#f3eadc]">
                          <div className="h-2 w-4/5 rounded-full bg-[#e8a63f]" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[8px] border border-[#ead8bd] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">คิวอนุมัติครูเข้าร่วม workspace</p>
                        <p className="mt-1 text-xs font-bold text-[#8b6a45]">กันครูต่างโรงเรียนเข้าข้อมูลผิดห้อง</p>
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

      <section className="bg-[#fffaf3] px-5 py-16 text-[#2f241b] sm:px-8 lg:px-10" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="nexus-kicker">
              <BadgeCheck size={17} aria-hidden="true" />
              ระบบหลักที่มีให้ใช้งาน
            </p>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
              จากงานครูรายวันถึงข้อมูลโรงเรียน ใช้ร่วมกันได้ในระบบเดียว
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureGroups.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="rounded-[8px] border border-[#ead8bd] bg-white p-5 shadow-[0_20px_55px_rgba(122,79,38,0.07)]" key={feature.title}>
                  <div className="grid h-12 w-12 place-items-center rounded-[8px] bg-[#f7dfad] text-[#6e4215]">
                    <Icon size={23} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-black">{feature.title}</h3>
                  <p className="mt-3 text-sm font-bold leading-7 text-[#6f5434]">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#fff8ef] px-5 py-16 text-[#2f241b] sm:px-8 lg:px-10" id="security">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
          <div>
            <p className="nexus-kicker">
              <LockKeyhole size={17} aria-hidden="true" />
              ออกแบบเพื่อใช้จริงในโรงเรียน
            </p>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
              ทุกโรงเรียนเห็นเฉพาะข้อมูลของตัวเอง
            </h2>
            <p className="mt-5 text-base font-bold leading-8 text-[#6f5434]">
              ครูหนึ่งคนสามารถเป็นทั้งผู้ใช้งานและเจ้าของ workspace ได้ เหมาะกับโรงเรียนที่มีครูใช้งานคนเดียว ส่วนโรงเรียนที่มีหลายคน เจ้าของ workspace จะเป็นคนอนุมัติสมาชิกก่อนเข้าถึงข้อมูล
            </p>
            <div className="mt-7 grid gap-3">
              {trustItems.map((item) => (
                <div className="flex gap-3 rounded-[8px] border border-[#ead8bd] bg-white p-4 text-sm font-black text-[#4d3520]" key={item}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#b87922]" size={18} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {roleCards.map((card) => {
              const Icon = card.icon;

              return (
                <article className="rounded-[8px] border border-[#ead8bd] bg-white p-5" key={card.title}>
                  <div className="flex gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[#f7dfad] text-[#6e4215]">
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{card.title}</h3>
                      <p className="mt-2 text-sm font-bold leading-7 text-[#6f5434]">{card.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#3a2817] px-5 py-14 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 rounded-[8px] border border-[#6b4a2a] bg-[#4a321d] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black text-[#f6c76d]">พร้อมต่อจากระบบหลังบ้านไปสู่ผู้ใช้งานจริง</p>
            <h2 className="mt-2 text-3xl font-black leading-tight">เปิดหน้าแรก สมัครสมาชิก และเข้าสู่ระบบได้ชัดเจน</h2>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#f9e7c9]">
              ขั้นต่อไปคือทำให้ Cloudflare Pages deploy จาก GitHub และทดสอบ Supabase Auth บน URL จริง
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#f6c76d] px-5 text-sm font-black text-[#3a2817]" to={primaryHref}>
              {primaryLabel}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#8a6338] bg-white/10 px-5 text-sm font-black text-white" to="/app/dashboard">
              ดูระบบตัวอย่าง
              <BookOpenCheck size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#3a2817] px-5 pb-8 text-center text-xs font-bold text-[#f9e7c9]/70">
        ClassCare 360 | Created by MIKPURINUT
      </footer>
    </main>
  );
}
