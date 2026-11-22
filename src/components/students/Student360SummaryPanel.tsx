import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarCheck,
  ChevronRight,
  HeartPulse,
  PiggyBank,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ContextLink as Link } from '../navigation/ContextLink';
import { isDemoSession, withDemoContext } from '../../lib/auth';
import { supabase } from '../../lib/supabaseClient';
import { evaluateThaiGrowth } from '../../lib/thaiGrowthStandards';
import {
  computeAttendanceStreaksAndRates,
  evaluateStudentRiskSignals,
  type StudentRiskSignalItem,
} from '../../lib/studentIntelligence';
import type { AppSessionContext } from '../../types/core';

interface Student360Target {
  id: string;
  student_code: string | null;
  first_name: string;
  last_name: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified' | null;
  birth_date?: string | null;
  health_flags?: Record<string, unknown> | null;
}

interface Student360SummaryPanelProps {
  session: AppSessionContext;
  student: Student360Target;
  classroomName?: string;
}

interface Student360Snapshot {
  attendanceRate: number;
  recordedDays: number;
  absentDays: number;
  consecutiveAbsentDays: number;
  scoreAveragePercent: number | null;
  gradedAssessmentsCount: number;
  behaviorNetPoints: number;
  behaviorCount: number;
  latestWeightKg: number | null;
  latestHeightCm: number | null;
  growthStatusLabel: string | null;
  hygieneAttentionCount: number;
  savingsBalance: number | null;
  traitSummaryLabel: string | null;
  riskItem: StudentRiskSignalItem | null;
}

const TRAIT_LABEL_MAP: Record<string, string> = {
  '3': 'ดีเยี่ยม (3)',
  '2': 'ดี (2)',
  '1': 'ผ่าน (1)',
  '0': 'ไม่ผ่าน (0)',
  ดีเยี่ยม: 'ดีเยี่ยม',
  ดี: 'ดี',
  ผ่าน: 'ผ่าน',
  ไม่ผ่าน: 'ไม่ผ่าน',
};

export function Student360SummaryPanel({
  session,
  student,
  classroomName,
}: Student360SummaryPanelProps) {
  const location = useLocation();
  const demoMode = isDemoSession(session);
  const workspaceId = session.workspace?.id || '';
  const [snapshot, setSnapshot] = useState<Student360Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadSummary() {
      if (demoMode || !supabase || !workspaceId) {
        const demoGrowth = evaluateThaiGrowth(student.gender || 'male', student.birth_date || '2015-05-10', 34.5, 141);
        setSnapshot({
          attendanceRate: 94.5,
          recordedDays: 36,
          absentDays: 2,
          consecutiveAbsentDays: 0,
          scoreAveragePercent: 78.5,
          gradedAssessmentsCount: 6,
          behaviorNetPoints: 6,
          behaviorCount: 4,
          latestWeightKg: 34.5,
          latestHeightCm: 141,
          growthStatusLabel: demoGrowth?.weightForHeight || 'สมส่วน',
          hygieneAttentionCount: 0,
          savingsBalance: 1450,
          traitSummaryLabel: 'ดีเยี่ยม (3)',
          riskItem: null,
        });
        return;
      }

      setIsLoading(true);
      try {
        const [
          attRecordsRes,
          scoreEntriesRes,
          behaviorRes,
          healthRes,
          savingsRes,
          traitsRes,
          careCasesRes,
        ] = await Promise.all([
          supabase
            .from('attendance_records')
            .select('session_id, status')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .limit(240),
          supabase
            .from('score_entries')
            .select('assessment_id, score')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .limit(120),
          supabase
            .from('behavior_records')
            .select('points, follow_up_status')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .limit(120),
          supabase
            .from('student_health_records')
            .select('record_type, weight_kg, height_cm, status, record_date')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .order('record_date', { ascending: false })
            .limit(30),
          supabase
            .from('savings_accounts')
            .select('balance')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .maybeSingle(),
          supabase
            .from('student_desirable_records')
            .select('trait_summary, reading_summary, updated_at')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('student_care_cases')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('student_id', student.id)
            .in('status', ['open', 'monitoring'])
            .limit(5),
        ]);

        if (!isCurrent) return;

        // Resolve session metadata for attendance streaks
        const attRows = (attRecordsRes.data || []) as Array<{ session_id: string; status: string }>;
        const sessionIds = Array.from(new Set(attRows.map((r) => r.session_id).filter(Boolean)));
        let attSessions: Array<{ id: string; attendance_date: string; subject_name?: string | null }> = [];
        if (sessionIds.length > 0) {
          const { data: sessRows } = await supabase
            .from('attendance_sessions')
            .select('id, attendance_date, subject_name')
            .eq('workspace_id', workspaceId)
            .in('id', sessionIds.slice(0, 200));
          attSessions = (sessRows || []) as typeof attSessions;
        }
        const attMap = computeAttendanceStreaksAndRates(
          attSessions,
          attRows.map((r) => ({ ...r, student_id: student.id })),
          [student.id],
        );
        const attStat = attMap.get(student.id);

        // Resolve score assessments
        const scoreRows = (scoreEntriesRes.data || []).filter((e) => e.score !== null);
        const asmIds = Array.from(new Set(scoreRows.map((e) => e.assessment_id).filter(Boolean)));
        let scoreAveragePercent: number | null = null;
        if (asmIds.length > 0) {
          const { data: asmRows } = await supabase
            .from('score_assessments')
            .select('id, max_score')
            .eq('workspace_id', workspaceId)
            .in('id', asmIds.slice(0, 120));
          const maxMap = new Map<string, number>(
            (asmRows || []).map((a) => [a.id, Number(a.max_score || 100)]),
          );
          const pcts = scoreRows
            .map((e) => {
              const mx = maxMap.get(e.assessment_id) || 100;
              return mx > 0 ? (Number(e.score) / mx) * 100 : null;
            })
            .filter((v): v is number => v !== null);
          if (pcts.length > 0) {
            scoreAveragePercent = Math.round((pcts.reduce((s, v) => s + v, 0) / pcts.length) * 10) / 10;
          }
        }

        // Behavior stats
        const bRows = (behaviorRes.data || []) as Array<{ points: number | null; follow_up_status: string | null }>;
        const behaviorNetPoints = bRows.reduce((s, b) => s + Number(b.points || 0), 0);
        const urgentFollowUps = bRows.filter(
          (b) => b.follow_up_status === 'contact_guardian' || b.follow_up_status === 'referred',
        ).length;

        // Health & Pediatric growth
        const hRows = (healthRes.data || []) as Array<{
          record_type: string;
          weight_kg: number | null;
          height_cm: number | null;
          status: string | null;
          record_date: string;
        }>;
        const latestGrowthRow = hRows.find(
          (h) => h.weight_kg !== null || h.height_cm !== null,
        );
        const fallbackWeight = Number(student.health_flags?.weight_kg || 0) || null;
        const fallbackHeight = Number(student.health_flags?.height_cm || 0) || null;
        const latestWeightKg = latestGrowthRow?.weight_kg ? Number(latestGrowthRow.weight_kg) : fallbackWeight;
        const latestHeightCm = latestGrowthRow?.height_cm ? Number(latestGrowthRow.height_cm) : fallbackHeight;
        const growthEval =
          latestWeightKg && latestHeightCm
            ? evaluateThaiGrowth(
                student.gender,
                student.birth_date,
                latestWeightKg,
                latestHeightCm,
                latestGrowthRow?.record_date,
              )
            : null;
        const hygieneAttentionCount = hRows.filter((h) => h.status === 'attention').length;

        // Traits
        const traitRaw = traitsRes.data?.trait_summary !== undefined && traitsRes.data?.trait_summary !== null
          ? String(traitsRes.data.trait_summary)
          : null;

        // Risk synthesis
        const riskList = evaluateStudentRiskSignals({
          students: [student],
          attendanceMap: attMap,
          scoresByStudent: new Map([
            [student.id, { averagePercent: scoreAveragePercent, gradedCount: scoreRows.length }],
          ]),
          behaviorByStudent: new Map([
            [student.id, { netPoints: behaviorNetPoints, urgentFollowUps }],
          ]),
          attentionHealthStudentIds: hygieneAttentionCount > 0 ? new Set([student.id]) : new Set(),
          openCareCaseStudentIds:
            (careCasesRes.data || []).length > 0 ? new Set([student.id]) : new Set(),
        });

        if (!isCurrent) return;
        setSnapshot({
          attendanceRate: attStat?.attendanceRate ?? 100,
          recordedDays: attStat?.recordedDays ?? 0,
          absentDays: attStat?.absentDays ?? 0,
          consecutiveAbsentDays: attStat?.consecutiveAbsentDays ?? 0,
          scoreAveragePercent,
          gradedAssessmentsCount: scoreRows.length,
          behaviorNetPoints,
          behaviorCount: bRows.length,
          latestWeightKg,
          latestHeightCm,
          growthStatusLabel: growthEval?.weightForHeight || null,
          hygieneAttentionCount,
          savingsBalance:
            savingsRes.data?.balance !== undefined && savingsRes.data?.balance !== null
              ? Number(savingsRes.data.balance)
              : null,
          traitSummaryLabel: traitRaw ? TRAIT_LABEL_MAP[traitRaw] || traitRaw : null,
          riskItem: riskList[0] || null,
        });
      } catch {
        // Non-blocking enrichment panel
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadSummary();
    return () => {
      isCurrent = false;
    };
  }, [demoMode, student.id, student.birth_date, student.gender, workspaceId]);

  if (!snapshot && !isLoading) return null;

  const metricCards = [
    {
      label: 'เวลาเรียนสะสม',
      value: snapshot
        ? snapshot.recordedDays > 0
          ? `${snapshot.attendanceRate.toFixed(0)}%`
          : 'ยังไม่มีข้อมูล'
        : '...',
      sub: snapshot
        ? snapshot.recordedDays > 0
          ? `ขาด ${snapshot.absentDays} วัน${snapshot.consecutiveAbsentDays >= 2 ? ` (ติดกัน ${snapshot.consecutiveAbsentDays})` : ''}`
          : 'ยังไม่เช็กชื่อ'
        : 'กำลังโหลด',
      tone:
        snapshot && snapshot.recordedDays > 0 && snapshot.attendanceRate < 80
          ? 'border-rose-200 bg-rose-50/70 text-rose-800'
          : 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
      icon: CalendarCheck,
      to: '/app/dashboard?view=teacher-work',
    },
    {
      label: 'คะแนนเฉลี่ยรวม',
      value:
        snapshot?.scoreAveragePercent !== null && snapshot?.scoreAveragePercent !== undefined
          ? `${snapshot.scoreAveragePercent.toFixed(1)}%`
          : 'ยังไม่มีคะแนน',
      sub: snapshot ? `จาก ${snapshot.gradedAssessmentsCount} ชิ้นงาน` : 'กำลังโหลด',
      tone:
        snapshot?.scoreAveragePercent !== null &&
        snapshot?.scoreAveragePercent !== undefined &&
        snapshot.scoreAveragePercent < 50
          ? 'border-rose-200 bg-rose-50/70 text-rose-800'
          : 'border-sky-200 bg-sky-50/50 text-sky-900',
      icon: BarChart3,
      to: '/app/dashboard?view=scores',
    },
    {
      label: 'พฤติกรรมสุทธิ',
      value: snapshot
        ? `${snapshot.behaviorNetPoints > 0 ? `+${snapshot.behaviorNetPoints}` : snapshot.behaviorNetPoints} แต้ม`
        : '...',
      sub: snapshot ? `บันทึก ${snapshot.behaviorCount} ครั้ง` : 'กำลังโหลด',
      tone:
        snapshot && snapshot.behaviorNetPoints < 0
          ? 'border-amber-200 bg-amber-50/70 text-amber-900'
          : 'border-slate-200 bg-slate-50/80 text-slate-900',
      icon: Sparkles,
      to: '/app/dashboard?view=behavior',
    },
    {
      label: 'สุขภาพ / การเติบโต',
      value:
        snapshot?.latestWeightKg && snapshot?.latestHeightCm
          ? `${snapshot.latestWeightKg} กก. / ${snapshot.latestHeightCm} ซม.`
          : 'ยังไม่บันทึก',
      sub:
        snapshot?.growthStatusLabel ||
        (snapshot?.hygieneAttentionCount ? `สุขภาพดูแล ${snapshot.hygieneAttentionCount} จุด` : 'เทียบเกณฑ์เด็กไทย'),
      tone: snapshot?.hygieneAttentionCount
        ? 'border-amber-200 bg-amber-50/70 text-amber-900'
        : 'border-pink-200 bg-pink-50/50 text-pink-900',
      icon: HeartPulse,
      to: '/app/dashboard?view=student-health',
    },
    {
      label: 'ยอดเงินออม',
      value:
        snapshot?.savingsBalance !== null && snapshot?.savingsBalance !== undefined
          ? `${snapshot.savingsBalance.toLocaleString('th-TH')} ฿`
          : 'ยังไม่มีบัญชี',
      sub: classroomName ? `ห้อง ${classroomName}` : 'บัญชีออมทรัพย์',
      tone: 'border-emerald-200 bg-white text-emerald-900',
      icon: PiggyBank,
      to: '/app/dashboard?view=savings',
    },
    {
      label: 'คุณลักษณะอันพึงประสงค์',
      value: snapshot?.traitSummaryLabel || 'รอประเมิน',
      sub: '8 ประการ (สพฐ.)',
      tone: 'border-indigo-200 bg-indigo-50/40 text-indigo-950',
      icon: Award,
      to: '/app/dashboard?view=desirable-characteristics',
    },
  ];

  return (
    <div className="mt-4 space-y-3 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50/90 via-white to-emerald-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
            <ShieldAlert size={14} aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              ภาพรวมอัจฉริยะ 360° (ข้อมูลเชื่อมทุกโมดูลอัตโนมัติ)
            </h3>
          </div>
        </div>

        {snapshot?.riskItem ? (
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${
              snapshot.riskItem.riskLevel === 'high'
                ? 'border-rose-300 bg-rose-50 text-rose-800'
                : snapshot.riskItem.riskLevel === 'medium'
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            <span>
              {snapshot.riskItem.riskLevel === 'high'
                ? 'เสี่ยงสูง'
                : snapshot.riskItem.riskLevel === 'medium'
                  ? 'ต้องติดตาม'
                  : 'เฝ้าระวัง'}
              : {snapshot.riskItem.reasons.join(' · ')}
            </span>
          </div>
        ) : snapshot ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
            สถานะปกติครบทุกด้าน
          </span>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={withDemoContext(card.to, location.search)}
              className={`group flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${card.tone}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold opacity-80">
                  <Icon size={13} aria-hidden="true" />
                  <span>{card.label}</span>
                </div>
                <p className="mt-1 truncate text-sm font-black">{card.value}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold opacity-75">{card.sub}</p>
              </div>
              <ChevronRight
                size={15}
                className="shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-80"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
