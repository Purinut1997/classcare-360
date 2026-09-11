import { useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GraduationCap,
  HeartPulse,
  Layers,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { AppLogo } from '../../components/brand/AppLogo';
import type { AppSessionContext } from '../../types/core';

interface LandingPageProps {
  session: AppSessionContext | null;
}

type ShowcaseTab = 'overview' | 'pp5' | 'grading';

export function LandingPage({ session }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('overview');

  const [mascotMessage, setMascotMessage] = useState(false);

  const dashboardHref = session?.workspace ? '/app/dashboard' : '/app/select-workspace';
  const startHref = session ? dashboardHref : '/login?mode=register';

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* ======================================================== */}
      {/* 1. TOP STICKY NAVIGATION BAR */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-10">
          <Link className="inline-flex items-center gap-3 group" to="/" aria-label="ClassCare 360 หน้าแรก">
            <AppLogo className="h-10 w-10 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-slate-900">ClassCare 360</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 border border-blue-200/60">
                  v2.0
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 -mt-0.5 hidden sm:inline">
                ระบบสารสนเทศสถานศึกษา & เอกสาร ปพ. สพฐ.
              </span>
            </div>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition">ฟีเจอร์หลัก</a>
            <a href="#official-docs" className="hover:text-blue-600 transition">เอกสาร ปพ.๕ / ปพ.๖</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition">ขั้นตอนการใช้งาน</a>
            <Link to="/pricing" className="hover:text-blue-600 transition">แพ็กเกจ VIP</Link>
            <Link to="/public/report" className="hover:text-blue-600 transition">พอร์ทัลตรวจผลการเรียน</Link>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <Link
              className="inline-flex h-9 sm:h-10 items-center justify-center rounded-xl px-4 text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-100/80 transition"
              to={session ? dashboardHref : '/login'}
            >
              {session ? 'ไปที่แอป' : 'เข้าสู่ระบบ'}
            </Link>

            <Link
              className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-4 sm:px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all"
              to={startHref}
            >
              <span>{session ? 'เข้าสู่แดชบอร์ด' : 'เริ่มต้นใช้งานฟรี'}</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. HERO SECTION WITH WALL.PNG THEMATIC BACKGROUND */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden pt-10 pb-20 sm:pt-16 sm:pb-28">
        {/* Wall.png Animated Dynamic Backdrop */}
        <div className="landing-hero-backdrop-container">
          <div className="landing-hero-wall-img" />
          <div className="landing-hero-overlay" />
          {/* Luminous energy orbs matching Wall.png holographic elements */}
          <div className="landing-hero-ambient-glow -top-24 left-1/4 w-[520px] h-[520px] bg-sky-400/20" />
          <div className="landing-hero-ambient-glow top-32 right-1/4 w-[460px] h-[460px] bg-emerald-400/15" />
          <div className="landing-hero-ambient-glow top-80 left-1/3 w-[600px] h-[400px] bg-indigo-500/10" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Top Interactive AI Mascot Carey Badge (matching white AI robot in Wall.png) */}
            <div className="flex flex-col items-center justify-center mb-5">
              <button
                type="button"
                onClick={() => setMascotMessage(!mascotMessage)}
                className="landing-carey-pill landing-carey-glow inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-slate-800 border border-sky-300/80 shadow-md shadow-sky-500/15 hover:border-sky-500 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                title="คลิกเพื่อสนทนากับน้องแคร์รี่ AI สพฐ."
              >
                <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-sm text-xs">
                  🤖
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </span>
                <span className="font-extrabold bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Carey AI Assistant
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">• ผู้ช่วยประจำโรงเรียน</span>
                <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold ml-1">
                  {mascotMessage ? 'ปิดข้อความ ✕' : 'แตะคุยกับฉัน ✨'}
                </span>
              </button>

              {/* Popover speech bubble if clicked */}
              {mascotMessage && (
                <div className="mt-3 animate-in fade-in zoom-in-95 duration-200 max-w-md mx-auto rounded-2xl bg-white/95 backdrop-blur-md border border-sky-300 p-3.5 text-xs text-slate-700 shadow-xl shadow-sky-500/15 flex items-start gap-2.5 text-left ring-1 ring-sky-100">
                  <span className="text-2xl">🎓</span>
                  <div className="flex-1">
                    <div className="font-extrabold text-sky-800 flex items-center gap-1.5">
                      <span>น้องแคร์รี่ AI: ยินดีต้อนรับสู่ ClassCare 360 ค่ะ!</span>
                    </div>
                    <div className="text-[11.5px] text-slate-600 mt-1 leading-relaxed">
                      ระบบเชื่อมโยงข้อมูลเวลาเรียน คัดกรองนักเรียน และตัดเกรดอัตโนมัติ 8 ระดับ พร้อมพิมพ์เล่ม ปพ.๕ และ ปพ.๖ ได้ถูกต้องตามระเบียบ สพฐ. 100% เลยค่ะ ✨
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMascotMessage(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs px-1 py-0.5 rounded hover:bg-slate-100"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-slate-700 shadow-sm border border-slate-200/90 mb-5 hover:border-blue-300 transition">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-blue-600 font-extrabold">มาตรฐาน สพฐ. 100%</span>
              <span className="text-slate-300">•</span>
              <span>ระบบออก ปพ.๕ / ปพ.๖ และดูแลนักเรียน 360°</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-[4.2rem] font-black tracking-tight text-slate-900 leading-[1.12]">
              จัดการงานโรงเรียนและเอกสาร ปพ.{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent drop-shadow-sm">
                ให้ง่ายและเป็นมืออาชีพ
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-base sm:text-xl font-normal text-slate-600 leading-relaxed max-w-2xl mx-auto drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
              ลดภาระงานครูกว่า 80% บันทึกเวลาเรียน ตัดเกรดอัตโนมัติ 8 ระดับ ออกเล่ม ปพ.๕/ปพ.๖ ใน 1 คลิก
              พร้อมระบบคัดกรอง ดูแลช่วยเหลือนักเรียนรอบด้านตามเกณฑ์กระทรวงศึกษาธิการ
            </p>

            {/* CTAs */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                className="inline-flex h-12 sm:h-13 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-7 text-sm sm:text-base font-extrabold text-white shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all ring-2 ring-white/50"
                to={startHref}
              >
                <Sparkles size={18} className="text-amber-300" />
                <span>{session ? 'เปิดหน้าแดชบอร์ด' : 'เริ่มใช้งานฟรีวันนี้'}</span>
                <ArrowRight size={18} />
              </Link>

              <Link
                className="inline-flex h-12 sm:h-13 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-sm px-6 text-sm sm:text-base font-bold text-slate-700 shadow-sm hover:bg-white hover:border-slate-300 hover:shadow-md transition"
                to="/public/report"
              >
                <BarChart3 size={18} className="text-blue-600" />
                <span>พอร์ทัลตรวจผลการเรียน</span>
              </Link>
            </div>

            {/* Quick Badges below Hero */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200/50">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>8 กลุ่มสาระการเรียนรู้</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200/50">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>ส่งออกไฟล์ Excel / PDF สมบูรณ์</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200/50">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>คุ้มครองข้อมูลตาม พ.ร.บ. PDPA</span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 3. INTERACTIVE PRODUCT SHOWCASE WINDOW WITH HOLO WIDGETS */}
          {/* ======================================================== */}
          <div className="relative mt-14 sm:mt-18 max-w-5xl mx-auto">
            {/* Holographic Floating Widget Left (Attendance & Sync) */}
            <div className="hidden xl:flex landing-holo-card landing-holo-badge-left -left-12 top-14 items-center gap-3.5 px-4 py-3 max-w-[230px]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                <ClipboardCheck size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Cloud Sync</span>
                </div>
                <div className="text-xs font-black text-slate-800 truncate">เช็คชื่อ & ปพ.๕ อัตโนมัติ</div>
                <div className="text-[10px] font-semibold text-slate-500">บันทึกเวลาเรียน 360°</div>
              </div>
            </div>

            {/* Holographic Floating Widget Right (GPA & Grading) */}
            <div className="hidden xl:flex landing-holo-card landing-holo-badge-right -right-12 bottom-16 items-center gap-3.5 px-4 py-3 max-w-[230px]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                <GraduationCap size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <Sparkles size={10} className="text-amber-400" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600">GPAX Engine</span>
                </div>
                <div className="text-xs font-black text-slate-800 truncate">ตัดเกรด 8 ระดับทันที</div>
                <div className="text-[10px] font-semibold text-slate-500">ลดงานเอกสารกว่า 80%</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/95 backdrop-blur-md landing-showcase-glow ring-1 ring-slate-900/5 transition-all">
              
              {/* Window Header / Tab Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/90 px-5 py-3.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-400 inline-block shadow-xs" />
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block shadow-xs" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block shadow-xs" />
                  </div>
                  <span className="ml-3 text-xs font-bold text-slate-600 hidden sm:inline">
                    ClassCare 360 Workspace • โรงเรียนสาธิตพัฒนาวิทยาการ
                  </span>
                </div>

                {/* Showcase Interactive Tabs */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-200/60 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      activeTab === 'overview'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📊 ภาพรวม & เช็คชื่อ
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('pp5')}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      activeTab === 'pp5'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📄 เอกสาร ปพ.๕ (สพฐ.)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('grading')}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      activeTab === 'grading'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🎯 ตัดเกรดอัตโนมัติ
                  </button>
                </div>
              </div>

              {/* Showcase Window Body */}
              <div className="p-5 sm:p-7 bg-white">
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    {/* Top KPI row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-4">
                        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">นักเรียนทั้งหมด</span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-slate-900">32</span>
                          <span className="text-xs font-bold text-slate-500">คน</span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4">
                        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">อัตรามาเรียนวันนี้</span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-emerald-700">96.8%</span>
                          <span className="text-xs font-semibold text-emerald-600">ดีเยี่ยม</span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 p-4">
                        <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">เกรดเฉลี่ยห้อง (GPA)</span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-slate-900">3.48</span>
                          <span className="text-xs font-semibold text-indigo-600">8 สาระ</span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-4">
                        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">สถานะ ปพ.๕ ล่าสุด</span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-xs font-black text-amber-700">พร้อมออกเล่ม</span>
                          <span className="text-[10px] text-amber-600 font-bold">100%</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Mock Table */}
                    <div className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 flex justify-between items-center">
                        <span>บันทึกการสอน & เวลาเรียนประจำวัน (ป.5/1)</span>
                        <span className="text-blue-600 text-[11px]">ซิงก์เรียลไทม์ ⚡</span>
                      </div>
                      <div className="divide-y divide-slate-100 text-xs font-medium">
                        {[
                          { sub: 'คณิตศาสตร์ (ค15101)', time: '08:30 - 09:20', present: 31, absent: 1, status: 'เช็คชื่อครบแล้ว' },
                          { sub: 'ภาษาไทย (ท15101)', time: '09:30 - 10:20', present: 32, absent: 0, status: 'มาเรียน 100%' },
                          { sub: 'วิทยาศาสตร์และเทคโนโลยี', time: '10:30 - 11:20', present: 30, absent: 2, status: 'แจ้งเตือนผู้ปกครองแล้ว' },
                        ].map((row, idx) => (
                          <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/60 transition">
                            <div className="flex items-center gap-3">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="font-bold text-slate-800">{row.sub}</span>
                              <span className="text-slate-400 text-[11px] hidden sm:inline">{row.time}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-600">มา <strong className="text-emerald-600">{row.present}</strong> ขาด <strong className="text-rose-500">{row.absent}</strong></span>
                              <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200/50">
                                {row.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'pp5' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 shadow-inner flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-400/30">
                          แบบ ปพ.๕ สพฐ. ฉบับทางการ
                        </div>
                        <h3 className="text-lg font-bold mt-1 text-white">แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล</h3>
                        <p className="text-xs text-slate-300 mt-0.5">ตรงตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พุทธศักราช ๒๕๕๑ (ฉบับปรับปรุง ๒๕๖๐)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white border border-white/10 flex items-center gap-1.5">
                          <Printer size={14} /> สั่งพิมพ์เล่ม ปพ.
                        </span>
                        <span className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-md flex items-center gap-1.5">
                          <Download size={14} /> ส่งออก Excel
                        </span>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                        <span className="text-slate-400 font-semibold block text-[11px]">หน้า 1: ปกและข้อมูลสถานศึกษา</span>
                        <strong className="text-slate-800 text-sm mt-1 block">รายชื่อครูประจำชั้น & ผู้บริหาร</strong>
                        <p className="text-slate-500 text-[11px] mt-1">อนุมัติผลการเรียนอัตโนมัติ</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                        <span className="text-slate-400 font-semibold block text-[11px]">หน้า 2: สรุปเวลาเรียนตลอดปี</span>
                        <strong className="text-slate-800 text-sm mt-1 block">คำนวณร้อยละเวลาเรียน 80%</strong>
                        <p className="text-emerald-600 text-[11px] font-bold mt-1">ผ่านเกณฑ์ทุกคน</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                        <span className="text-slate-400 font-semibold block text-[11px]">หน้า 3: สรุปผลสัมฤทธิ์ 8 สาระ</span>
                        <strong className="text-slate-800 text-sm mt-1 block">ตัดเกรด 8 ระดับ (0 - 4)</strong>
                        <p className="text-blue-600 text-[11px] font-bold mt-1">รวมกิจกรรมพัฒนาผู้เรียน</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'grading' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">เกณฑ์การตัดเกรด 8 ระดับ (สพฐ.)</h4>
                        <p className="text-xs text-slate-500 mt-0.5">คำนวณคะแนนเก็บ 70% + ปลายภาค 30% อัตโนมัติ</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-extrabold border border-emerald-200/60">
                        แม่นยำ 100%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center text-xs">
                      {[
                        { grade: '4.0', range: '80-100', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
                        { grade: '3.5', range: '75-79', color: 'bg-emerald-50/60 border-emerald-100 text-emerald-700' },
                        { grade: '3.0', range: '70-74', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                        { grade: '2.5', range: '65-69', color: 'bg-blue-50/60 border-blue-100 text-blue-700' },
                        { grade: '2.0', range: '60-64', color: 'bg-amber-50 border-amber-200 text-amber-800' },
                        { grade: '1.5', range: '55-59', color: 'bg-amber-50/60 border-amber-100 text-amber-700' },
                        { grade: '1.0', range: '50-54', color: 'bg-orange-50 border-orange-200 text-orange-800' },
                        { grade: '0', range: '0-49', color: 'bg-rose-50 border-rose-200 text-rose-800' },
                      ].map((item) => (
                        <div key={item.grade} className={`rounded-xl border p-2.5 ${item.color}`}>
                          <div className="text-base font-black">{item.grade}</div>
                          <div className="text-[10px] font-bold opacity-75 mt-0.5">{item.range}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 flex items-center justify-between">
                      <span>💡 <strong>คำนวณอัตโนมัติ:</strong> คุณลักษณะอันพึงประสงค์ 8 ประการ • กิจกรรมพัฒนาผู้เรียน (ผ่าน/ไม่ผ่าน) • อ่านคิดวิเคราะห์</span>
                      <span className="text-blue-600 font-bold hidden sm:inline">ประหยัดเวลากว่า 20 ชั่วโมง/เทอม</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. SIX CORE PILLARS OF CLASSCARE 360 */}
      {/* ======================================================== */}
      <section id="features" className="border-t border-slate-200/80 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-blue-600 border border-blue-200/60">
              จุดเด่นสำคัญของระบบ
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              ครบทุกมิติงานสถานศึกษาในที่เดียว
            </h2>
            <p className="mt-3 text-base text-slate-600">
              ออกแบบโดยครูเพื่อครูไทย เชื่อมโยงข้อมูลทุกฝ่ายอย่างไร้รอยต่อ ตั้งแต่งานเช็คชื่อจนถึงรายงาน ปพ.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div className="group rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 sm:p-7 hover:bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">
                เอกสาร ปพ.๕ / ปพ.๖ มาตรฐาน สพฐ.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                ออกเล่ม ปพ.๕ และสมุดรายงาน ปพ.๖ ครบถ้วนตามระเบียบกระทรวงศึกษาธิการ ส่งออก Excel ได้ 100% หรือสั่งพิมพ์เข้าเล่มได้ใน 1 คลิก
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-600">
                <span>มีระบบตรวจสอบหน้าและระยะพิมพ์</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Card 2 */}
            <div className="group rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 sm:p-7 hover:bg-white hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap size={24} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">
                ระบบคะแนน & ตัดเกรด 8 ระดับ
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                จัดการคะแนนเก็บตามตัวชี้วัด สอบกลางภาค สอบปลายภาค ตัดเกรดอัตโนมัติ 8 ระดับ (0 - 4) พร้อมสรุปสถิติผลการเรียนเฉลี่ยทั้งชั้น
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600">
                <span>รองรับ 8 กลุ่มสาระและกิจกรรมพัฒนาผู้เรียน</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Card 3 */}
            <div className="group rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 sm:p-7 hover:bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardCheck size={24} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">
                เช็คชื่อรายวัน & คัดกรองเวลาเรียน
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                บันทึกการมาเรียนรายวันและรายวิชาแบบเรียลไทม์ คำนวณร้อยละเวลาเรียน 80% อัตโนมัติ แจ้งเตือนผู้เรียนที่มีความเสี่ยงหมดสิทธิ์สอบ
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600">
                <span>ส่งข้อมูลเชื่อมต่อกับ ปพ. ทันที</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Card 4 */}
            <div className="group rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 sm:p-7 hover:bg-white hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <HeartPulse size={24} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">
                คุณลักษณะ 8 ประการ & สุขภาพ BMI
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                ประเมินคุณลักษณะอันพึงประสงค์, อ่าน คิด วิเคราะห์ เขียน, บันทึกการเจริญเติบโตกายภาพ น้ำหนัก ส่วนสูง ค่า BMI และประวัติแพ้ยา
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-purple-600">
                <span>ระบบดูแลช่วยเหลือนักเรียนรอบด้าน</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Card 5 */}
            <div className="group rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 sm:p-7 hover:bg-white hover:border-amber-200 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-500/20 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles size={24} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">
                เครื่องมือห้องเรียนอัจฉริยะ & ออมทรัพย์
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                วงล้อสุ่มชื่อตอบคำถาม, จัดผังที่นั่ง, จัดกลุ่มคละความสามารถ, ตารางสอน, ปฏิทินกิจกรรมโรงเรียน และระบบบันทึกเงินออมนักเรียน
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-amber-600">
                <span>เพิ่มความสนุกสนานและมีวินัยในชั้นเรียน</span>
                <ChevronRight size={14} />
              </div>
            </div>

            {/* Card 6 */}
            <div className="group rounded-3xl border border-slate-200/80 bg-slate-50/40 p-6 sm:p-7 hover:bg-white hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck size={24} />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">
                Student Portal & ความปลอดภัย PDPA
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                ผู้ปกครองและนักเรียนตรวจสอบผลการเรียน การเช็คชื่อ และพฤติกรรมผ่านพอร์ทัลออนไลน์ พร้อมระบบ Audit Log บันทึกประวัติความปลอดภัย
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-cyan-600">
                <span>เข้ารหัสมาตรฐานสากล 24 ชั่วโมง</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. HOW IT WORKS (3 EASY STEPS) */}
      {/* ======================================================== */}
      <section id="how-it-works" className="border-t border-slate-200/80 bg-slate-50/60 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
              ง่าย รวดเร็ว ไม่ซับซ้อน
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              เริ่มต้นใช้งานใน 3 ขั้นตอน
            </h2>
            <p className="mt-3 text-base text-slate-600">
              ไม่ต้องติดตั้งโปรแกรม ใช้งานผ่านเว็บบราวเซอร์ได้ทันทีบนคอมพิวเตอร์และมือถือ
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'สร้าง Workspace โรงเรียน',
                desc: 'ลงทะเบียนและกำหนดข้อมูลพื้นฐานของโรงเรียน เพิ่มห้องเรียน และเชิญครูผู้สอนเข้าร่วมระบบ',
                badge: '1 นาที',
              },
              {
                step: '02',
                title: 'นำเข้าข้อมูลหรือเริ่มกรอก',
                desc: 'เพิ่มรายชื่อนักเรียน รายวิชา หรือคัดลอกไฟล์ Excel คะแนนและข้อมูลเดิมที่มีเข้าสู่ระบบได้อย่างง่ายดาย',
                badge: 'ยืดหยุ่นสูง',
              },
              {
                step: '03',
                title: 'บันทึกงานสอนและออกเล่ม ปพ.',
                desc: 'เช็คชื่อ กรอกคะแนนสอบ และกดพิมพ์เอกสาร ปพ.๕ / ปพ.๖ ส่งงานวิชาการได้ทันทีใน 1 คลิก',
                badge: '1-Click Export',
              },
            ].map((item) => (
              <div key={item.step} className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-blue-600/30">{item.step}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                    {item.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. CALL TO ACTION BANNER */}
      {/* ======================================================== */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-[#071329] to-blue-950 p-8 sm:p-14 text-white shadow-2xl">
          {/* Subtle decoration lights */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-blue-200 border border-white/10 mb-4">
              <Sparkles size={14} className="text-amber-300" />
              <span>ยกระดับโรงเรียนของคุณวันนี้</span>
            </div>
            
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              พร้อมเปลี่ยนงานเอกสารที่ยุ่งยาก ให้กลายเป็นเรื่องง่ายหรือยัง?
            </h2>
            
            <p className="mt-4 text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
              ร่วมเป็นส่วนหนึ่งกับคุณครูทั่วประเทศที่ไว้วางใจ ClassCare 360 ช่วยประหยัดเวลาและดูแลนักเรียนได้อย่างมีประสิทธิภาพ
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-7 text-sm font-extrabold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-400 hover:scale-[1.02] active:scale-95 transition-all"
                to={startHref}
              >
                <span>เริ่มต้นใช้งานฟรี</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 text-sm font-bold text-white hover:bg-white/10 transition"
                to="/pricing"
              >
                <span>ดูรายละเอียดแพ็กเกจ VIP</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 7. FOOTER */}
      {/* ======================================================== */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-500 text-xs">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <AppLogo className="h-8 w-8 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
            <div>
              <p className="font-bold text-slate-900">ClassCare 360 v2.0</p>
              <p className="text-[11px] text-slate-500">ระบบบริหารสถานศึกษาอัจฉริยะ & เอกสาร ปพ. มาตรฐาน สพฐ.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-semibold">
            <Link to="/pricing" className="hover:text-slate-900 transition">แพ็กเกจ</Link>
            <Link to="/public/report" className="hover:text-slate-900 transition">พอร์ทัลตรวจผล</Link>
            <Link to="/support" className="hover:text-slate-900 transition">ศูนย์ช่วยเหลือ</Link>
            <Link to="/login" className="hover:text-slate-900 transition">เข้าสู่ระบบ</Link>
          </div>

          <p className="text-[11px] text-slate-400 text-center sm:text-right">
            © {new Date().getFullYear()} ClassCare 360. All rights reserved. <br />
            <span className="text-slate-400/80">Crafted with care by MIKPURINUT</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
