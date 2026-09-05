import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  Check,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  FileText,
  School,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ContextLink as Link } from '../navigation/ContextLink';
import type { AppSessionContext } from '../../types/core';

export interface OnboardingStepItem {
  id: string;
  stepNumber: number;
  title: string;
  shortDesc: string;
  icon: LucideIcon;
  destination: string;
  destinationLabel: string;
  isAutoDone: boolean;
}

interface OnboardingRoadmapCardProps {
  session: AppSessionContext;
  classroomsCount?: number;
  studentsCount?: number;
  hasAttendanceRecorded?: boolean;
  hasScoresRecorded?: boolean;
  onOpenGuide?: () => void;
}

const STORAGE_KEY_HIDE = 'classcare_hide_onboarding_roadmap';
const STORAGE_KEY_COMPLETED = 'classcare_roadmap_completed_steps';

export function OnboardingRoadmapCard({
  session,
  classroomsCount = 0,
  studentsCount = 0,
  hasAttendanceRecorded = false,
  hasScoresRecorded = false,
  onOpenGuide,
}: OnboardingRoadmapCardProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_HIDE) === 'true';
    } catch {
      return false;
    }
  });

  const [manuallyCompletedIds, setManuallyCompletedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COMPLETED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync manually completed steps to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(manuallyCompletedIds));
    } catch {
      // Ignore storage errors
    }
  }, [manuallyCompletedIds]);

  // Step definitions matching user request
  const steps: OnboardingStepItem[] = useMemo(
    () => [
      {
        id: 'school_settings',
        stepNumber: 1,
        title: 'ตั้งค่าโรงเรียน & ปีการศึกษา',
        shortDesc: 'กำหนดชื่อโรงเรียน ปีการศึกษา และผู้ลงนาม 4 ฝ่าย',
        icon: School,
        destination: '/app/dashboard?view=workspace-settings',
        destinationLabel: 'ไปหน้าตั้งค่าโรงเรียน',
        isAutoDone: classroomsCount > 0 && Boolean(session.workspace?.schoolName),
      },
      {
        id: 'import_students',
        stepNumber: 2,
        title: 'นำเข้ารายชื่อนักเรียน',
        shortDesc: 'นำเข้าไฟล์ DMC, Excel หรือเพิ่มนักเรียนรายคน',
        icon: Users,
        destination: '/app/dashboard?view=import-export',
        destinationLabel: 'ไปหน้านำเข้านักเรียน',
        isAutoDone: studentsCount > 0,
      },
      {
        id: 'check_attendance',
        stepNumber: 3,
        title: 'เช็กชื่อนักเรียนประจำวัน',
        shortDesc: 'บันทึกการมาแถวเช้า โฮมรูม มา/สาย/ขาด/ลา',
        icon: CalendarCheck,
        destination: '/app/dashboard?view=teacher-work',
        destinationLabel: 'ไปหน้าเช็กเวลาเรียน',
        isAutoDone: hasAttendanceRecorded,
      },
      {
        id: 'scores_and_grades',
        stepNumber: 4,
        title: 'บันทึกคะแนนและตัดเกรด',
        shortDesc: 'สร้างชุดคะแนน นำเข้าคะแนน ปรับสัดส่วน ตัดเกรด',
        icon: BarChart3,
        destination: '/app/dashboard?view=scores',
        destinationLabel: 'ไปหน้าระบบบันทึกคะแนน',
        isAutoDone: hasScoresRecorded,
      },
      {
        id: 'academic_reports',
        stepNumber: 5,
        title: 'ออกรายงาน ปพ. สพฐ.',
        shortDesc: 'พิมพ์ ปพ.5, ปพ.6 สรุปเวลาเรียน และใบแสดงผล',
        icon: FileSpreadsheet,
        destination: '/app/dashboard?view=academic-reports',
        destinationLabel: 'ไปหน้ารายงาน ปพ.',
        isAutoDone: false,
      },
    ],
    [classroomsCount, session.workspace?.schoolName, studentsCount, hasAttendanceRecorded, hasScoresRecorded],
  );

  // Determine completion for each step (auto or manual)
  const isStepDone = (step: OnboardingStepItem) => {
    return step.isAutoDone || manuallyCompletedIds.includes(step.id);
  };

  const completedCount = steps.filter(isStepDone).length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const isAllCompleted = completedCount === totalSteps;

  // Find the first unfinished step index
  const currentWorkingIndex = steps.findIndex((step) => !isStepDone(step));

  const toggleManualCheck = (stepId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setManuallyCompletedIds((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId],
    );
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_HIDE, 'true');
    } catch {
      // Ignore
    }
  };

  const handleRestore = () => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(STORAGE_KEY_HIDE);
    } catch {
      // Ignore
    }
  };

  const handleStartTour = () => {
    if (onOpenGuide) {
      onOpenGuide();
    } else {
      window.dispatchEvent(new CustomEvent('open-setup-guide'));
    }
  };

  // Compact collapsed state if dismissed
  if (isDismissed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-sm transition-all hover:border-cyan-500/40">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🚀</span>
          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
            ก้าวแรกสู่ ClassCare 360
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600">·</span>
          <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-black text-cyan-700 dark:text-cyan-300">
            ความคืบหน้า: {completedCount}/{totalSteps} ({progressPercent}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestore}
            className="text-xs font-black text-cyan-700 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
          >
            แสดงการ์ดแนะนำ ↗
          </button>
          <button
            type="button"
            onClick={handleStartTour}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-black text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300 hover:bg-cyan-500/20"
          >
            <Compass size={13} className="animate-spin duration-3000 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">ทัวร์นำทาง</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="ก้าวแรกสู่ ClassCare 360"
      className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/90 backdrop-blur-sm"
    >
      {/* Background Ambient Accents */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-500/15" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/15" />

      {/* Header with Title and Dismiss button */}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-xl text-white shadow-md shadow-cyan-500/25">
            🚀
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              ก้าวแรกสู่ ClassCare 360 — แนะนำการเริ่มต้นใช้งานระบบ
            </h2>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              5 ขั้นตอนง่ายๆ เพื่อเตรียมระบบและเปิดใช้งานครบทุกส่วนของโรงเรียน
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          title="ซ่อนการ์ดนี้ (สามารถเปิดใหม่ได้ตลอดเวลา)"
        >
          <X size={14} />
          <span>ซ่อนการ์ดนี้</span>
        </button>
      </div>

      {/* Progress Bar Header */}
      <div className="relative mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800/80 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-black">
          <span className="text-slate-700 dark:text-slate-300">
            ความคืบหน้า:{' '}
            <span className="text-cyan-600 dark:text-cyan-400">
              {completedCount}/{totalSteps} ขั้นตอน
            </span>{' '}
            ({progressPercent}%)
          </span>
          {isAllCompleted ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> ทำครบทุกขั้นตอนแล้ว ยอดเยี่ยมมาก!
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 font-bold">
              อีก {totalSteps - completedCount} ขั้นตอนสู่ความพร้อม 100%
            </span>
          )}
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-600 transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 5 Step Cards */}
      <div className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, idx) => {
          const done = isStepDone(step);
          const isCurrent = !done && idx === currentWorkingIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                done
                  ? 'border-emerald-500/40 bg-emerald-50/40 dark:border-emerald-500/25 dark:bg-emerald-950/20'
                  : isCurrent
                  ? 'border-cyan-500/60 bg-cyan-50/50 shadow-md shadow-cyan-500/10 ring-2 ring-cyan-400/30 dark:border-cyan-400/40 dark:bg-cyan-950/25'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-slate-700'
              }`}
            >
              <div>
                {/* Step number and status badge */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-lg text-xs font-black ${
                      done
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-cyan-600 text-white animate-pulse'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {step.stepNumber}
                  </span>

                  {done ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                      <Check size={11} strokeWidth={3} /> ทำแล้ว ✓
                    </span>
                  ) : isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black text-cyan-800 dark:text-cyan-200 animate-pulse">
                      👉 กำลังทำ
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      รอเริ่ม
                    </span>
                  )}
                </div>

                {/* Step Icon & Title */}
                <div className="mt-3 flex items-start gap-2.5">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      done
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : isCurrent
                        ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-black leading-snug text-slate-900 dark:text-slate-100">
                      {step.title}
                    </h3>
                  </div>
                </div>

                <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  {step.shortDesc}
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex items-center justify-between gap-1 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                <Link
                  to={step.destination}
                  className={`text-xs font-black transition-colors ${
                    isCurrent
                      ? 'text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 underline underline-offset-2'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:underline'
                  }`}
                  title={step.destinationLabel}
                >
                  เปิดหน้านี้ →
                </Link>

                <button
                  type="button"
                  onClick={(e) => toggleManualCheck(step.id, e)}
                  className={`grid h-6 w-6 place-items-center rounded-md border transition-all ${
                    done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-300 bg-slate-50 text-transparent hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800'
                  }`}
                  title={done ? 'คลิกเพื่อเปลี่ยนเป็นยังไม่เสร็จ' : 'คลิกเพื่อทำเครื่องหมายว่าเสร็จแล้ว'}
                >
                  <Check size={13} strokeWidth={3} className={done ? 'block' : 'opacity-0 hover:opacity-40'} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prominent CTA Banner */}
      <div className="relative mt-5 flex flex-col gap-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-teal-500/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-500/20 dark:from-cyan-950/30 dark:via-indigo-950/30 dark:to-teal-950/30">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
            <Compass size={20} className="animate-spin duration-3000" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              ต้องการผู้ช่วยนำทางทีละหน้าจอแบบสดๆ?
            </p>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
              เปิดโหมดทัวร์นำทางลอยช่วยทำงานบนหน้าจอจริง ไม่ต้องสลับแท็บ และพาทัวร์ครบทั้ง 5 ขั้นตอน
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartTour}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-cyan-500/25 transition-all hover:shadow-lg hover:shadow-cyan-500/35 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Compass size={17} className="animate-spin duration-3000" />
          <span>🧭 เริ่มต้นทัวร์นำทางสดทีละขั้น</span>
        </button>
      </div>
    </section>
  );
}
