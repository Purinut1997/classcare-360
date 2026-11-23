import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Crown,
  KeyRound,
  Minus,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { AppLogo } from '../../components/brand/AppLogo';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import { supabase } from '../../lib/supabaseClient';

interface LivePlanPricing {
  trialDays: number;
  vipPriceThb: number;
  vipDurationDays: number;
}

const DEFAULT_PRICING: LivePlanPricing = {
  trialDays: 30,
  vipPriceThb: 300,
  vipDurationDays: 365,
};

const COMPARISON_ROWS: Array<{
  label: string;
  free: string;
  trial: string;
  vip: string;
}> = [
  { label: 'จำนวนห้องเรียนที่ใช้งานได้', free: '1 ห้อง', trial: 'สูงสุด 10 ห้อง', vip: 'สูงสุด 100 ห้อง' },
  { label: 'จำนวนนักเรียนในระบบ', free: '40 คน', trial: 'สูงสุด 500 คน', vip: 'สูงสุด 5,000 คน' },
  { label: 'ครูผู้ร่วมงานในโรงเรียนเดียวกัน', free: '1 บัญชี', trial: 'สูงสุด 10 บัญชี', vip: 'สูงสุด 100 บัญชี' },
  { label: 'ทะเบียนนักเรียน เช็กชื่อเวลาเรียน และตารางสอน', free: '✓', trial: '✓', vip: '✓' },
  { label: 'สมุดคะแนน ตัดเกรด 8 ระดับ และตรวจข้อสอบ OMR', free: 'จำกัดสิทธิ์', trial: 'เปิดใช้งาน', vip: 'ครบทุกโมดูล' },
  { label: 'ดูแลช่วยเหลือ เยี่ยมบ้าน กสศ.01 และสมุดเงินออม', free: 'จำกัดสิทธิ์', trial: 'เปิดใช้งาน', vip: 'ครบทุกโมดูล' },
  { label: 'รายงานมาตรฐาน A4 / ปพ. / ส่งออก Excel & DMC', free: '—', trial: 'เปิดใช้งาน', vip: 'ครบทุกฉบับ' },
  { label: 'ผู้ช่วยอัจฉริยะ ClassCare AI (Gemini) & OCR', free: '—', trial: 'ตามสิทธิ์ทดลอง', vip: 'เต็มรูปแบบ' },
  { label: 'สำรองข้อมูล กู้คืน และพอร์ทัลผู้ปกครอง', free: '—', trial: 'เปิดใช้งาน', vip: 'ครบทุกฟังก์ชัน' },
];

export function PricingPage() {
  const [pricing, setPricing] = useState<LivePlanPricing>(DEFAULT_PRICING);

  useEffect(() => {
    let active = true;
    async function loadLivePricing() {
      if (!supabase) return;
      const { data } = await supabase
        .from('plans')
        .select('code,price_thb,duration_days')
        .in('code', ['TRIAL_30', 'VIP_YEARLY'])
        .eq('is_active', true);

      if (!active || !data || data.length === 0) return;

      const trialRow = data.find((row) => row.code === 'TRIAL_30');
      const vipRow = data.find((row) => row.code === 'VIP_YEARLY');

      setPricing({
        trialDays: Number(trialRow?.duration_days) > 0 ? Number(trialRow?.duration_days) : DEFAULT_PRICING.trialDays,
        vipPriceThb:
          vipRow && typeof vipRow.price_thb === 'number' && Number.isFinite(vipRow.price_thb)
            ? Number(vipRow.price_thb)
            : DEFAULT_PRICING.vipPriceThb,
        vipDurationDays:
          Number(vipRow?.duration_days) > 0 ? Number(vipRow?.duration_days) : DEFAULT_PRICING.vipDurationDays,
      });
    }
    void loadLivePricing();
    return () => {
      active = false;
    };
  }, []);

  const monthlyApprox = Math.max(
    1,
    Math.round(pricing.vipPriceThb / Math.max(1, Math.round(pricing.vipDurationDays / 30))),
  );

  return (
    <div className="classcare-grid-bg min-h-screen bg-[#f6f7f3] text-[#1C342B]">
      {/* Clean Sticky Public Header */}
      <header className="sticky top-0 z-30 border-b border-[#dce4dc]/80 bg-[#f6f7f3]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <AppLogo className="h-9 w-9 rounded-xl bg-white p-0.5 shadow-2xs ring-1 ring-[#dce4dc]" />
            <div className="min-w-0">
              <p className="font-display text-sm font-black tracking-tight text-[#1C342B]">ClassCare 360</p>
              <p className="hidden text-[10.5px] font-semibold text-[#5A6F64] sm:block">
                ระบบบริหารจัดการห้องเรียนครบวงจร
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-[#4a5e54] transition hover:bg-white hover:text-[#1C342B]"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="hidden sm:inline">หน้าแรก</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-[#cfdcd3] bg-white px-3.5 text-xs font-black text-[#1C342B] shadow-2xs transition hover:border-[#2F7D5B]/40 hover:bg-[#edf6f1]"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              to="/app/package"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1C342B] px-3.5 text-xs font-black text-white shadow-xs transition hover:bg-[#2F7D5B]"
            >
              <Crown size={13} className="text-amber-300" aria-hidden="true" />
              <span>สมัคร VIP</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        {/* Centered Executive Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7dfd0] bg-[#e9f5ee] px-3.5 py-1 text-xs font-black text-[#1c573d]">
            <Crown size={13} className="text-[#d98b26]" aria-hidden="true" />
            แพ็กเกจและอัตราค่าบริการ
          </span>
          <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-[#1C342B] sm:text-4xl lg:text-[42px] lg:leading-[1.18]">
            แพ็กเกจที่คุ้มค่าสำหรับครูและสถานศึกษา
          </h1>
          <p className="mx-auto mt-3.5 max-w-2xl text-sm font-semibold leading-7 text-[#55695f] sm:text-base">
            สมัครเพียง 1 แพ็กเกจต่อพื้นที่ทำงาน ครูทุกคนในโรงเรียนใช้งานร่วมกันได้ครบทุกโมดูล
            ไม่มีค่าใช้จ่ายแอบแฝง และสามารถทดลองใช้งานระบบจริงก่อนตัดสินใจได้ฟรี
          </p>

          {/* Subtle Trust Chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 text-xs font-bold text-[#355043]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e5dc] bg-white px-3.5 py-1.5 shadow-2xs">
              <Users size={14} className="text-[#2F7D5B]" aria-hidden="true" />
              สมัครครั้งเดียว ใช้ได้ทั้งทีมครูในโรงเรียน
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e5dc] bg-white px-3.5 py-1.5 shadow-2xs">
              <ShieldCheck size={14} className="text-[#2F7D5B]" aria-hidden="true" />
              ข้อมูลเดิมปลอดภัยอยู่ครบทุกช่วงแพ็กเกจ
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9e5dc] bg-white px-3.5 py-1.5 shadow-2xs">
              <KeyRound size={14} className="text-[#d98b26]" aria-hidden="true" />
              รองรับ PromptPay QR และโค้ด VIP
            </span>
          </div>
        </section>

        {/* 3-Column Pricing Cards */}
        <section className="mt-10 grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
          {/* Plan 1: Free */}
          <article className="flex flex-col rounded-3xl border border-[#dce4dc] bg-white p-6 shadow-xs transition hover:border-[#b9d0c2] hover:shadow-md sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">
                  ClassCare 360 Free
                </span>
                <h2 className="mt-3 font-display text-2xl font-black text-[#1C342B]">เริ่มต้นใช้งาน</h2>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f1f6f3] text-[#2F7D5B] ring-1 ring-[#dce6df]">
                <WalletCards size={20} aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-black tracking-tight text-[#1C342B]">ฟรี</span>
              <span className="text-xs font-bold text-[#62756b]">/ ไม่มีค่าใช้จ่าย</span>
            </div>
            <p className="mt-2.5 text-xs font-semibold leading-6 text-[#5a6f64]">
              เหมาะสำหรับครูประจำชั้นที่ต้องการเริ่มต้นจัดเก็บรายชื่อและเช็กชื่อเวลาเรียนในห้องเรียนขนาดเล็ก
            </p>

            <div className="mt-5 rounded-2xl border border-[#e7eee9] bg-[#f8fbf9] px-3.5 py-2.5 text-xs font-bold text-[#355043]">
              โควตา: 1 ห้องเรียน · นักเรียน 40 คน · 1 ผู้ใช้งาน
            </div>

            <ul className="mt-5 flex-1 space-y-2.5 text-xs font-bold text-[#2b4238]">
              {[
                'จัดการรายชื่อและทะเบียนนักเรียนพื้นฐาน',
                'เช็กชื่อเข้าแถว / เวลาเรียนประจำวัน',
                'ตารางสอนและภาพรวมห้องเรียนประจำวัน',
                'เริ่มต้นใช้งานได้ทันทีโดยไม่ต้องผูกบัตร',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 leading-5">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#2F7D5B]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/login"
              className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#cbd9cf] bg-white px-4 text-sm font-black text-[#1C342B] transition hover:border-[#2F7D5B] hover:bg-[#edf6f1]"
            >
              เริ่มใช้งานฟรี
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>

          {/* Plan 2: Trial */}
          <article className="flex flex-col rounded-3xl border border-[#c8dfd1] bg-gradient-to-b from-[#f3faf6] to-white p-6 shadow-xs transition hover:border-[#8dc4a5] hover:shadow-md sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full bg-[#dff1e7] px-3 py-1 text-[11px] font-black text-[#1c573d]">
                  ทดลองใช้ฟรี {pricing.trialDays} วัน
                </span>
                <h2 className="mt-3 font-display text-2xl font-black text-[#1C342B]">ทดลองใช้ทั้งโรงเรียน</h2>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2F7D5B] text-white shadow-xs">
                <Sparkles size={20} aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-black tracking-tight text-[#1C342B]">฿0</span>
              <span className="text-xs font-bold text-[#526c5f]">/ {pricing.trialDays} วันแรก (1 ครั้งต่อโรงเรียน)</span>
            </div>
            <p className="mt-2.5 text-xs font-semibold leading-6 text-[#4e6559]">
              ทดลองใช้ฟีเจอร์หลักครบวงจรกับข้อมูลห้องเรียนจริง เพื่อประเมินความพร้อมของทีมครูก่อนสมัครใช้งานรายปี
            </p>

            <div className="mt-5 rounded-2xl border border-[#cfe5d7] bg-white/85 px-3.5 py-2.5 text-xs font-bold text-[#1c573d]">
              โควตา: 10 ห้องเรียน · นักเรียน 500 คน · 10 ครูร่วม
            </div>

            <ul className="mt-5 flex-1 space-y-2.5 text-xs font-bold text-[#1f3b2f]">
              {[
                'เปิดใช้งานโมดูลวิชาการ วัดผล และดูแลช่วยเหลือ',
                'ทดลองสมุดคะแนน ตัดเกรด เงินออม และเยี่ยมบ้าน',
                'เชิญครูร่วมสอนในโรงเรียนเข้าใช้งานพร้อมกันได้',
                'เมื่อครบกำหนด ข้อมูลทั้งหมดยังคงอยู่ครบไม่สูญหาย',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 leading-5">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#2F7D5B]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/login"
              className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2F7D5B] px-4 text-sm font-black text-white shadow-xs transition hover:bg-[#236347]"
            >
              สร้างพื้นที่ทดลองใช้งาน
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>

          {/* Plan 3: Featured ClassCare 360 VIP */}
          <article className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-[#2F7D5B] bg-white shadow-[0_24px_60px_rgba(28,52,43,0.14)] transition hover:-translate-y-0.5">
            {/* Dark Emerald Executive Header */}
            <div className="relative bg-gradient-to-br from-[#1C342B] via-[#1a3a2d] to-[#13261f] p-6 text-white sm:p-7">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-400/15 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-black text-amber-200 ring-1 ring-amber-300/40">
                    <Crown size={12} className="fill-amber-300/30" aria-hidden="true" />
                    แพ็กเกจแนะนำ
                  </span>
                  <h2 className="mt-3 font-display text-2xl font-black text-white">ClassCare 360 VIP</h2>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/35">
                  <Crown size={21} aria-hidden="true" />
                </span>
              </div>

              <div className="relative mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-4xl font-black tabular-nums tracking-tight text-white">
                  ฿{pricing.vipPriceThb.toLocaleString('th-TH')}
                </span>
                <span className="text-xs font-bold text-emerald-200/85">/ {pricing.vipDurationDays} วัน</span>
                <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                  เฉลี่ย ฿{monthlyApprox} / เดือน
                </span>
              </div>
              <p className="relative mt-2 text-xs font-semibold leading-5 text-emerald-100/80">
                ปลดล็อกครบทุกโมดูลเต็มรูปแบบและ ClassCare AI สำหรับทั้งโรงเรียนในแพ็กเกจเดียว
              </p>
            </div>

            {/* White Body */}
            <div className="flex flex-1 flex-col p-6 sm:p-7">
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs font-black text-amber-950">
                โควตา: 100 ห้องเรียน · นักเรียน 5,000 คน · 100 ครูร่วม
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 text-xs font-bold text-[#1C342B]">
                {[
                  'ครบทุกโมดูลวิชาการ: สมุดคะแนน ตัดเกรด 8 ระดับ ตรวจข้อสอบ OMR และเอกสาร ปพ.',
                  'ดูแลช่วยเหลือครบวงจร: เยี่ยมบ้าน กสศ.01 พฤติกรรม สมุดเงินออม และรายงาน A4 / Excel',
                  'ผู้ช่วยอัจฉริยะ ClassCare AI (Google Gemini) พร้อมสแกนเอกสาร OCR อัตโนมัติ',
                  'นำเข้า-ส่งออก DMC / Excel, สำรองข้อมูล และพอร์ทัลผู้ปกครอง',
                  'สมัครครั้งเดียว ครูทุกคนในพื้นที่ทำงานใช้สิทธิ์ VIP ร่วมกันทั้งหมด',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 leading-5">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#2F7D5B]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/app/package"
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1C342B] to-[#2F7D5B] px-4 text-sm font-black text-white shadow-md transition hover:brightness-110"
              >
                <Crown size={15} className="text-amber-300" aria-hidden="true" />
                สมัครแพ็กเกจ VIP
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>

        {/* Feature Comparison Matrix */}
        <section className="mt-12 overflow-hidden rounded-3xl border border-[#dce4dc] bg-white shadow-xs">
          <div className="border-b border-[#e6ede8] px-6 py-5 sm:px-7">
            <h2 className="font-display text-lg font-black text-[#1C342B] sm:text-xl">เปรียบเทียบสิทธิ์การใช้งานแต่ละแพ็กเกจ</h2>
            <p className="mt-1 text-xs font-semibold text-[#5b6f64]">
              แสดงรายละเอียดโควตาและฟังก์ชันหลักอย่างโปร่งใส เพื่อให้เลือกแพ็กเกจที่เหมาะกับขนาดโรงเรียนของคุณ
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#e6ede8] bg-[#f8fbf9] text-[11px] font-black text-[#55695f]">
                  <th className="px-6 py-3.5 sm:px-7">รายการสิทธิ์และฟังก์ชัน</th>
                  <th className="px-4 py-3.5 text-center">Free</th>
                  <th className="px-4 py-3.5 text-center">ทดลองใช้ ({pricing.trialDays} วัน)</th>
                  <th className="bg-[#edf7f1] px-5 py-3.5 text-center text-[#1c573d]">ClassCare 360 VIP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ef]">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="transition hover:bg-[#fafcfa]">
                    <td className="px-6 py-3.5 font-bold text-[#1C342B] sm:px-7">{row.label}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-[#607368]">
                      {row.free === '✓' ? (
                        <Check size={15} className="mx-auto text-[#2F7D5B]" />
                      ) : row.free === '—' ? (
                        <Minus size={14} className="mx-auto text-slate-300" />
                      ) : (
                        row.free
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-[#3f584b]">
                      {row.trial === '✓' ? <Check size={15} className="mx-auto text-[#2F7D5B]" /> : row.trial}
                    </td>
                    <td className="bg-[#f4faf6]/75 px-5 py-3.5 text-center font-black text-[#1c573d]">
                      {row.vip === '✓' ? <Check size={16} className="mx-auto text-[#2F7D5B]" /> : row.vip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Simple 3-Step Upgrade Flow */}
        <section className="mt-10 rounded-3xl border border-[#dce4dc] bg-white p-6 shadow-xs sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-black text-[#1C342B] sm:text-xl">ขั้นตอนการสมัครและเปิดสิทธิ์ VIP</h2>
              <p className="mt-1 text-xs font-semibold text-[#5b6f64]">
                ดำเนินการได้ด้วยตนเองภายในไม่กี่นาที พร้อมทีมงานตรวจสอบและดูแลอย่างใกล้ชิด
              </p>
            </div>
            <Link
              to="/app/package"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1C342B] px-4 text-xs font-black text-white transition hover:bg-[#2F7D5B]"
            >
              ไปยังหน้าชำระเงิน
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: Building2,
                title: 'สร้างบัญชีและพื้นที่โรงเรียน',
                desc: 'เข้าสู่ระบบและสร้างพื้นที่ทำงานของโรงเรียนหรือห้องเรียนของคุณ โดยข้อมูลจะถูกจัดเก็บแยกเป็นสัดส่วนปลอดภัย',
              },
              {
                step: '02',
                icon: WalletCards,
                title: 'ชำระผ่าน PromptPay QR หรือใช้โค้ด VIP',
                desc: 'เลือกชำระผ่าน QR ในระบบพร้อมแนบสลิปโอนเงิน หรือกรอกรหัสโค้ด VIP เพื่อเปิดสิทธิ์ใช้งานได้ทันที',
              },
              {
                step: '03',
                icon: ShieldCheck,
                title: 'เปิดสิทธิ์ครบทั้งโรงเรียน',
                desc: 'เมื่อยืนยันการชำระเงินแล้ว สิทธิ์ VIP จะเปิดใช้งานอัตโนมัติให้ครูทุกคนในพื้นที่ทำงานเดียวกันทันที',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="rounded-2xl border border-[#e6ede8] bg-[#f9fbf9] p-4">
                  <div className="flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f4ec] text-[#1c573d]">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs font-black text-[#95ab9e]">STEP {item.step}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-black text-[#1C342B]">{item.title}</h3>
                  <p className="mt-1.5 text-xs font-semibold leading-5 text-[#5a6f64]">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
