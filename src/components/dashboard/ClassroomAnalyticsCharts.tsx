import React from 'react';
import {
  Award,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Coins,
  FileText,
  HeartHandshake,
  PieChart,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from 'lucide-react';

export interface ClassroomAnalyticsData {
  attendance: {
    absent: number;
    late: number;
    leave: number;
    present: number;
    totalSessions: number;
  };
  behavior: {
    negativePoints: number;
    positivePoints: number;
    totalRecords: number;
  };
  classroomName: string;
  dataCompleteness: {
    attendanceCheckedToday: boolean;
    behaviorRecorded: boolean;
    homeVisitsCount: number;
    scoresEnteredCount: number;
    studentsCount: number;
  };
  savings: {
    accountCount: number;
    activeAccounts: number;
    monthlyDeposits: number;
    totalBalance: number;
  };
  scores: {
    assessmentCount: number;
    averagePercent: number;
    passedStudentsCount: number;
  };
}

interface ClassroomAnalyticsChartsProps {
  data: ClassroomAnalyticsData;
}

export function ClassroomAnalyticsCharts({ data }: ClassroomAnalyticsChartsProps) {
  const { attendance, behavior, dataCompleteness, savings, scores } = data;

  const totalAttendance = attendance.present + attendance.late + attendance.leave + attendance.absent || 1;
  const presentPct = Math.round((attendance.present / totalAttendance) * 100);
  const latePct = Math.round((attendance.late / totalAttendance) * 100);
  const leavePct = Math.round((attendance.leave / totalAttendance) * 100);
  const absentPct = Math.round((attendance.absent / totalAttendance) * 100);

  // Donut chart calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${circumference}`;

  const offsetPresent = 0;
  const offsetLate = (attendance.present / totalAttendance) * circumference;
  const offsetLeave = ((attendance.present + attendance.late) / totalAttendance) * circumference;
  const offsetAbsent = ((attendance.present + attendance.late + attendance.leave) / totalAttendance) * circumference;

  const totalBehavior = (behavior.positivePoints || 0) + (behavior.negativePoints || 0) || 1;
  const posBehaviorPct = Math.round(((behavior.positivePoints || 0) / totalBehavior) * 100);

  const completenessScore = Math.round(
    ((dataCompleteness.studentsCount > 0 ? 25 : 0) +
      (dataCompleteness.attendanceCheckedToday ? 25 : 0) +
      (scores.assessmentCount > 0 ? 25 : 0) +
      (savings.activeAccounts > 0 ? 25 : 0))
  );

  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-12">
      {/* Classroom Dataset Health & Completeness Status Card */}
      <article className="nexus-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">
                สถานะความสมบูรณ์ของชุดข้อมูลห้องเรียน ({data.classroomName || 'ห้องเรียน'})
              </h2>
              <p className="text-xs font-bold text-slate-500">
                ประเมินความพร้อมของการบันทึกเวลาเรียน คะแนน เงินออม และการดูแลนักเรียน
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-black text-slate-500">ความสมบูรณ์ข้อมูล</span>
              <p className="text-xl font-black text-teal-700">{completenessScore}%</p>
            </div>
            <div className="h-3 w-28 overflow-hidden rounded-full bg-slate-100 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-800">
              <UserCheck size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-500">รายชื่อนักเรียน</p>
              <p className="font-black text-slate-900">{dataCompleteness.studentsCount} คน</p>
            </div>
          </div>

          <div className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${dataCompleteness.attendanceCheckedToday ? 'bg-emerald-50 text-emerald-900 ring-emerald-100' : 'bg-amber-50 text-amber-900 ring-amber-100'}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${dataCompleteness.attendanceCheckedToday ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              <CalendarCheck size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black opacity-80">เช็กชื่อวันนี้</p>
              <p className="font-black">{dataCompleteness.attendanceCheckedToday ? 'เรียบร้อยแล้ว' : 'ยังไม่เช็กชื่อ'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-800">
              <FileText size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-500">ชุดคะแนนสอบ</p>
              <p className="font-black text-slate-900">{scores.assessmentCount} ชุด</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <Coins size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-500">บัญชีเงินออม</p>
              <p className="font-black text-slate-900">{savings.activeAccounts} บัญชี active</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-800">
              <HeartHandshake size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-500">การเยี่ยมบ้าน</p>
              <p className="font-black text-slate-900">{dataCompleteness.homeVisitsCount} / {dataCompleteness.studentsCount || 20} คน</p>
            </div>
          </div>
        </div>
      </article>

      {/* Donut Chart: สถิติการมาเรียนประจำเดือน */}
      <article className="nexus-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-6 xl:col-span-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="text-teal-600" size={20} aria-hidden="true" />
            <h3 className="text-base font-black text-slate-950">สถิติการมาเรียนเดือนนี้</h3>
          </div>
          <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-700">
            {presentPct}% มาเรียน
          </span>
        </div>

        <div className="mt-5 flex flex-col items-center justify-center sm:flex-row sm:items-center sm:gap-6">
          {/* SVG Donut Chart */}
          <div className="relative h-36 w-36 shrink-0">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="12" fill="transparent" />
              {/* มา */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#10b981"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-offsetPresent}
                className="transition-all duration-700"
              />
              {/* สาย */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#f59e0b"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-offsetLate}
                className="transition-all duration-700"
              />
              {/* ลา */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#06b6d4"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-offsetLeave}
                className="transition-all duration-700"
              />
              {/* ขาด */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#f43f5e"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-offsetAbsent}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-950">{totalAttendance}</span>
              <span className="text-[10px] font-bold text-slate-400">รายการบันทึก</span>
            </div>
          </div>

          <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:mt-0">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2 text-center">
              <span className="text-[11px] font-black text-emerald-800">มาเรียน</span>
              <p className="text-lg font-black text-emerald-700">{attendance.present} <span className="text-xs font-bold text-emerald-600">({presentPct}%)</span></p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-2 text-center">
              <span className="text-[11px] font-black text-amber-800">มาสาย</span>
              <p className="text-lg font-black text-amber-700">{attendance.late} <span className="text-xs font-bold text-amber-600">({latePct}%)</span></p>
            </div>
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-2 text-center">
              <span className="text-[11px] font-black text-cyan-800">ลางาน</span>
              <p className="text-lg font-black text-cyan-700">{attendance.leave} <span className="text-xs font-bold text-cyan-600">({leavePct}%)</span></p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-2 text-center">
              <span className="text-[11px] font-black text-rose-800">ขาดเรียน</span>
              <p className="text-lg font-black text-rose-700">{attendance.absent} <span className="text-xs font-bold text-rose-600">({absentPct}%)</span></p>
            </div>
          </div>
        </div>
      </article>

      {/* Bar Chart 2: ยอดเงินออม & สถิติบัญชีเงินออมห้องเรียน */}
      <article className="nexus-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-6 xl:col-span-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-amber-600" size={20} aria-hidden="true" />
            <h3 className="text-base font-black text-slate-950">เงินออมสะสมประจำห้อง</h3>
          </div>
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
            {savings.activeAccounts} บัญชี active
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4">
            <span className="text-xs font-black text-amber-800">ยอดเงินออมสะสมคงเหลือห้องเรียน</span>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-3xl font-black text-slate-950">
                {savings.totalBalance.toLocaleString('th-TH')} <span className="text-sm font-bold text-slate-500">บาท</span>
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                <Coins size={12} /> ฝากเดือนนี้ {savings.monthlyDeposits.toLocaleString('th-TH')} ฿
              </span>
            </div>
          </div>

          <div className="mt-1">
            <div className="flex justify-between text-xs font-black text-slate-600">
              <span>สัดส่วนนักเรียนที่ร่วมออมเงิน</span>
              <span>{savings.activeAccounts} จาก {dataCompleteness.studentsCount || 20} คน</span>
            </div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100 p-0.5">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((savings.activeAccounts / (dataCompleteness.studentsCount || 20)) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </article>

      {/* Chart 3: คะแนนเฉลี่ย & สถิติพฤติกรรม */}
      <article className="nexus-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm xl:col-span-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-purple-600" size={20} aria-hidden="true" />
            <h3 className="text-base font-black text-slate-950">ผลการเรียน & พฤติกรรม</h3>
          </div>
          <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700">
            เฉลี่ย {scores.averagePercent}%
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <Award size={16} />
              </span>
              <div>
                <p className="text-xs font-black text-slate-500">ผลประเมินสอบ</p>
                <p className="font-black text-slate-900">{scores.passedStudentsCount} คน ผ่านเกณฑ์</p>
              </div>
            </div>
            <span className="text-sm font-black text-purple-700">{scores.averagePercent}%</span>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <p className="text-xs font-black text-slate-500">พฤติกรรมเชิงบวก</p>
                <p className="font-black text-slate-900">บันทึก {behavior.positivePoints} คะแนน</p>
              </div>
            </div>
            <span className="text-sm font-black text-emerald-700">{posBehaviorPct}% Positive</span>
          </div>
        </div>
      </article>
    </section>
  );
}
