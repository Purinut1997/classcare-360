import { ArrowRight, CheckCircle2, Crown, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';

const plans = [
  {
    badge: 'FREE_LOGIN',
    name: 'เริ่มต้น',
    price: 'ฟรี',
    description: 'เข้าสู่ระบบได้ แต่ยังไม่เปิดโมดูลหลักจนกว่าจะมี subscription active',
    cta: 'เข้าสู่ระบบ',
    href: '/login',
    tone: 'border-slate-200/80 bg-white/75',
    icon: WalletCards,
    features: ['ใช้ทดสอบบัญชีและ onboarding', 'ยังไม่เปิด Student 360/Reports', 'เหมาะกับการเช็คสิทธิ์ก่อนสมัคร'],
  },
  {
    badge: 'TRIAL_30',
    name: 'ทดลองใช้',
    price: '30 วัน',
    description: 'ใช้ได้ 1 ครั้งต่อ user/workspace สำหรับทดลอง workflow ครูหลัก',
    cta: 'สร้าง workspace',
    href: '/app/select-workspace?demo=no-workspace',
    tone: 'border-sky-200/80 bg-sky-50/80',
    icon: Sparkles,
    features: ['เปิด dashboard และโมดูลครูพื้นฐาน', 'เหมาะกับทดลองทั้งห้องเรียน', 'ต้องผูก workspace และ RLS'],
  },
  {
    badge: 'ClassCare 360 VIP',
    name: 'รายปี',
    price: '100 บาท/ปี',
    description: 'แพ็กเกจพรีเมียมสำหรับเปิดใช้สิทธิ์เต็มตาม Prompt และต่อยอดโมดูลชำระเงินจริง',
    cta: 'ดูแพ็กเกจ',
    href: '/app/package',
    tone: 'border-cyan-200/80 bg-white/85 shadow-[0_26px_70px_rgba(14,165,233,0.18)]',
    icon: Crown,
    features: ['ใช้คำว่า VIP เฉพาะบริบทแพ็กเกจ', 'สลิปต้องเก็บ private bucket', 'อนุมัติสิทธิ์ผ่าน backend/Superadmin'],
  },
];

const paymentRules = [
  'QR Code ต้องมาจาก Superadmin ห้าม hard-code ใน frontend',
  'ห้ามเก็บภาพสลิปหรือเอกสารเป็น base64 ใน database',
  'การอนุมัติ subscription ต้องทำผ่าน backend หรือ Superadmin เท่านั้น',
];

export function PricingPage() {
  return (
    <main className="classcare-grid-bg min-h-screen px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="nexus-card overflow-hidden">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-6 sm:p-8">
              <div className="nexus-kicker">
                <WalletCards size={18} aria-hidden="true" />
                Package
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
                แพ็กเกจและการอัปเกรด
              </h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-600">
                หน้าแพ็กเกจใช้คำว่า ClassCare 360 VIP เฉพาะบริบทสมัครสมาชิก ต่ออายุ สิทธิ์พิเศษ และฟีเจอร์พรีเมียมเท่านั้น
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" to="/app/package">
                  ไปหน้าชำระเงิน
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="nexus-pill inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-black text-slate-700 transition hover:-translate-y-0.5" to="/login">
                  เข้าสู่ระบบ
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden border-t border-slate-100 bg-slate-950 p-6 text-white lg:border-l lg:border-t-0 sm:p-8">
              <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-cyan-300/20 blur-2xl" />
              <p className="relative text-sm font-black text-cyan-200">Payment Guard</p>
              <div className="relative mt-5 grid gap-3">
                {paymentRules.map((rule) => (
                  <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur" key={rule}>
                    <ShieldCheck className="mt-0.5 shrink-0 text-cyan-300" size={18} aria-hidden="true" />
                    <p className="text-sm font-bold leading-6 text-slate-100">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="nexus-card p-5">
          <p className="text-sm font-black text-cyan-700">สถานะระบบ</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">พร้อมต่อ payment flow</h2>
          <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
            ฝั่ง UI พร้อมแล้ว เหลือ Edge Function, storage policy, audit log และหน้า Superadmin สำหรับอนุมัติจริง
          </p>
        </aside>
      </section>

      <section className="mx-auto mt-6 grid max-w-7xl gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;

          return (
            <article className={`rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.09)] backdrop-blur-xl transition hover:-translate-y-1 ${plan.tone}`} key={plan.badge}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                    {plan.badge}
                  </p>
                  <h2 className="mt-4 text-2xl font-black text-slate-950">{plan.name}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200 shadow-lg">
                  <Icon size={22} aria-hidden="true" />
                </div>
              </div>
              <p className="mt-5 text-4xl font-black text-slate-950">{plan.price}</p>
              <p className="mt-3 min-h-[84px] text-sm font-bold leading-7 text-slate-600">{plan.description}</p>
              <div className="mt-5 grid gap-3">
                {plan.features.map((feature) => (
                  <div className="flex gap-2 text-sm font-bold leading-6 text-slate-700" key={feature}>
                    <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-600" size={17} aria-hidden="true" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <Link
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-[0_16px_34px_rgba(2,6,23,0.20)] transition hover:-translate-y-0.5 hover:bg-slate-900"
                to={plan.href}
              >
                {plan.cta}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </article>
          );
        })}
      </section>

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">
        Created by MIKPURINUT
      </footer>
    </main>
  );
}
