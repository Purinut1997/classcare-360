import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BellRing,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Database,
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

const primaryFeatures = [
  {
    icon: Users,
    title: 'Student 360',
    body: 'รวมข้อมูลนักเรียน ผู้ปกครอง เคสดูแล พฤติกรรม และประวัติสำคัญไว้ในมุมมองเดียว',
  },
  {
    icon: ClipboardList,
    title: 'งานครูและเช็กชื่อ',
    body: 'จัดการงานประจำวัน เช็กชื่อ ติดตามงานค้าง และเก็บหลักฐานการดูแลอย่างเป็นระบบ',
  },
  {
    icon: BarChart3,
    title: 'คะแนนและรายงาน',
    body: 'บันทึกคะแนน วิเคราะห์ภาพรวมห้องเรียน และส่งออกรายงานสำหรับครูประจำชั้น',
  },
  {
    icon: WalletCards,
    title: 'เงินออมและธุรกรรมห้อง',
    body: 'ติดตามเงินออมรายคน สรุปยอดรายเดือน และแยกข้อมูลตาม workspace ของโรงเรียน',
  },
  {
    icon: HeartHandshake,
    title: 'พฤติกรรมและการดูแล',
    body: 'บันทึกเชิงบวก เคสที่ต้องติดตาม และประวัติการช่วยเหลือนักเรียนแบบต่อเนื่อง',
  },
  {
    icon: BellRing,
    title: 'แจ้งเตือนและพอร์ทัล',
    body: 'เตรียมช่องทางแจ้งผู้ปกครอง นักเรียน และคำเชิญเข้าสู่ระบบอย่างปลอดภัย',
  },
];

const trustItems = [
  'แยกข้อมูลด้วย workspace isolation และ Supabase RLS',
  'เจ้าของ workspace อนุมัติครูที่ขอเข้าร่วมก่อนใช้งาน',
  'Superadmin และ Admin ได้สิทธิ์ VIP ตลอดชีพสำหรับดูแลระบบ',
  'Audit log สำหรับ action สำคัญ เช่น อนุมัติสิทธิ์และแพ็กเกจ',
];

const audienceCards = [
  {
    icon: GraduationCap,
    label: 'ครูประจำชั้น',
    text: 'เห็นภาพทั้งห้องในหน้าเดียว ลดงานซ้ำ และติดตามเด็กที่ต้องดูแลได้ทันเวลา',
  },
  {
    icon: School,
    label: 'เจ้าของ workspace',
    text: 'ควบคุมสมาชิกของโรงเรียนตัวเอง อนุมัติครู และจัดการห้องเรียนที่รับผิดชอบ',
  },
  {
    icon: ShieldCheck,
    label: 'Superadmin',
    text: 'ดูแลแพ็กเกจ QR สิทธิ์ผู้ดูแล ระบบ readiness และภาพรวมการใช้งานทั้งหมด',
  },
];

export function LandingPage({ session }: LandingPageProps) {
  const dashboardHref = session?.workspace ? '/app/dashboard' : '/app/select-workspace';
  const primaryHref = session ? dashboardHref : '/login?mode=register';
  const primaryLabel = session ? 'เข้าแดชบอร์ด' : 'เริ่มใช้งานฟรี';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(125,211,252,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.12)_1px,transparent_1px)] bg-[length:38px_38px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.32),transparent_27rem),radial-gradient(circle_at_12%_30%,rgba(34,211,238,0.18),transparent_22rem),linear-gradient(180deg,#020617_0%,#06223b_60%,#e0f7ff_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/10 px-3 py-3 backdrop-blur" to="/">
              <span className="grid h-11 w-11 place-items-center rounded-[8px] bg-cyan-300 text-slate-950">
                <GraduationCap size={25} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-lg font-black leading-5">ClassCare 360</span>
                <span className="block text-xs font-bold text-cyan-100/80">ระบบดูแลนักเรียนสำหรับครู</span>
              </span>
            </Link>

            <nav className="flex flex-wrap items-center gap-2 text-sm font-black">
              <a className="rounded-[8px] px-3 py-2 text-cyan-50/85 transition hover:bg-white/10 hover:text-white" href="#features">
                ฟีเจอร์
              </a>
              <a className="rounded-[8px] px-3 py-2 text-cyan-50/85 transition hover:bg-white/10 hover:text-white" href="#security">
                ความปลอดภัย
              </a>
              <Link className="rounded-[8px] px-3 py-2 text-cyan-50/85 transition hover:bg-white/10 hover:text-white" to="/pricing">
                แพ็กเกจ
              </Link>
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-slate-950 shadow-[0_18px_40px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5" to={session ? dashboardHref : '/login'}>
                {session ? 'เข้าแอป' : 'เข้าสู่ระบบ'}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </nav>
          </header>

          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(480px,1fr)]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/12 px-4 py-2 text-sm font-black text-cyan-100">
                <Sparkles size={17} aria-hidden="true" />
                ห้องเรียน โรงเรียน และผู้ดูแล อยู่ในระบบเดียว
              </div>
              <h1 className="mt-6 text-5xl font-black leading-[0.98] tracking-normal text-white sm:text-7xl lg:text-8xl">
                ClassCare 360
              </h1>
              <p className="mt-6 max-w-2xl text-lg font-bold leading-9 text-cyan-50/82">
                ระบบช่วยครูประจำชั้นดูแลนักเรียนครบวงจร ตั้งแต่ข้อมูลรายคน งานครู คะแนน เงินออม พฤติกรรม รายงาน ไปจนถึง workspace ของแต่ละโรงเรียน และสิทธิ์ Superadmin สำหรับดูแลแพ็กเกจ
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-cyan-300 px-6 text-sm font-black text-slate-950 shadow-[0_18px_42px_rgba(34,211,238,0.28)] transition hover:-translate-y-0.5" to={primaryHref}>
                  {primaryLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-white/15 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15" to="/pricing">
                  ดูแพ็กเกจ
                  <WalletCards size={18} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ['18', 'โมดูลหลัก'],
                  ['RLS', 'แยกข้อมูลโรงเรียน'],
                  ['VIP', 'สิทธิ์ผู้ดูแลตลอดชีพ'],
                ].map(([value, label]) => (
                  <div className="rounded-[8px] border border-white/12 bg-white/10 p-4 backdrop-blur" key={label}>
                    <p className="text-3xl font-black text-white">{value}</p>
                    <p className="mt-1 text-xs font-black text-cyan-100/75">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[520px] overflow-hidden rounded-[8px] border border-cyan-100/20 bg-white/10 p-4 shadow-[0_28px_90px_rgba(8,47,73,0.35)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:34px_34px]" />
              <div className="relative z-10 grid h-full gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="rounded-[8px] bg-slate-950/80 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-cyan-300 text-slate-950">
                      <BookOpenCheck size={23} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-black">ClassCare</p>
                      <p className="text-xs font-bold text-cyan-100/70">โรงเรียนบ้านโคกสูง</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-2">
                    {['ภาพรวม', 'นักเรียน', 'งานครู', 'คะแนน', 'รายงาน'].map((item, index) => (
                      <div className={`rounded-[8px] px-3 py-3 text-sm font-black ${index === 0 ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.08] text-cyan-50/80'}`} key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="rounded-[8px] bg-slate-50 p-4 text-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Live classroom</p>
                      <h2 className="mt-1 text-2xl font-black">แดชบอร์ดครูประจำชั้น</h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
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
                      <div className="rounded-[8px] border border-slate-200 bg-white p-4" key={label}>
                        <p className="text-3xl font-black">{value}</p>
                        <p className="mt-1 text-xs font-black text-slate-500">{label}</p>
                        <div className="mt-3 h-2 rounded-full bg-slate-100">
                          <div className="h-2 w-4/5 rounded-full bg-sky-500" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[8px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">คิวอนุมัติครูเข้าร่วม workspace</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">กันครูต่างโรงเรียนเข้าข้อมูลผิดห้อง</p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">2 รออนุมัติ</span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {['ครูประจำชั้น ป.5/2', 'ครูแนะแนว'].map((item) => (
                        <div className="flex items-center justify-between rounded-[8px] bg-slate-50 px-3 py-3 text-sm font-black" key={item}>
                          <span>{item}</span>
                          <span className="text-cyan-700">ตรวจสอบ</span>
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

      <section className="bg-slate-50 px-5 py-16 text-slate-950 sm:px-8 lg:px-10" id="features">
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
            {primaryFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_20px_55px_rgba(15,23,42,0.06)]" key={feature.title}>
                  <div className="grid h-12 w-12 place-items-center rounded-[8px] bg-slate-950 text-cyan-200">
                    <Icon size={23} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-black">{feature.title}</h3>
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-slate-950 sm:px-8 lg:px-10" id="security">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
          <div>
            <p className="nexus-kicker">
              <LockKeyhole size={17} aria-hidden="true" />
              ออกแบบเพื่อใช้จริงในโรงเรียน
            </p>
            <h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
              ทุกโรงเรียนเห็นเฉพาะข้อมูลของตัวเอง
            </h2>
            <p className="mt-5 text-base font-bold leading-8 text-slate-600">
              ครูหนึ่งคนสามารถเป็นทั้งผู้ใช้งานและเจ้าของ workspace ได้ เหมาะกับโรงเรียนที่มีครูใช้งานคนเดียว ส่วนโรงเรียนที่มีหลายคน เจ้าของ workspace จะเป็นคนอนุมัติสมาชิกก่อนเข้าถึงข้อมูล
            </p>
            <div className="mt-7 grid gap-3">
              {trustItems.map((item) => (
                <div className="flex gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-700" key={item}>
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-600" size={18} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {audienceCards.map((card) => {
              const Icon = card.icon;

              return (
                <article className="rounded-[8px] border border-slate-200 bg-slate-50 p-5" key={card.label}>
                  <div className="flex gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-cyan-100 text-cyan-800">
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black">{card.label}</h3>
                      <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{card.text}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-14 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 rounded-[8px] border border-white/10 bg-white/[0.08] p-6 backdrop-blur lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black text-cyan-200">พร้อมต่อจากระบบหลังบ้านไปสู่ผู้ใช้งานจริง</p>
            <h2 className="mt-2 text-3xl font-black leading-tight">เปิดหน้าแรกให้คนสมัคร ดูฟีเจอร์ และเข้าสู่ระบบได้ชัดเจน</h2>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-cyan-50/75">
              ขั้นต่อไปคือ publish ตัวเว็บให้คนภายนอกเปิดได้ แล้วค่อยเชื่อม payment/PromptPay จริงเมื่อระบบหลักนิ่งแล้ว
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-cyan-300 px-5 text-sm font-black text-slate-950" to={primaryHref}>
              {primaryLabel}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-white/15 bg-white/10 px-5 text-sm font-black text-white" to="/app/dashboard">
              ดูระบบตัวอย่าง
              <Database size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 px-5 pb-8 text-center text-xs font-bold text-cyan-50/55">
        ClassCare 360 | Created by MIKPURINUT
      </footer>
    </main>
  );
}
