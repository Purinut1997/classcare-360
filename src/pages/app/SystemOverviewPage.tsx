import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  HeartPulse,
  Home,
  PiggyBank,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';
import {
  TermAttendanceHeatmap,
  type TermHeatmapDayItem,
} from '../../components/dashboard/TermAttendanceHeatmap';
import { isDemoSession } from '../../lib/auth';
import { getBangkokDate } from '../../lib/date';
import { calculateOBECGrade } from '../../lib/obecAcademicEngine';
import {
  computeAttendanceStreaksAndRates,
  evaluateStudentRiskSignals,
  type StudentRiskBehaviorStats,
  type StudentRiskScoreStats,
} from '../../lib/studentIntelligence';
import { supabase } from '../../lib/supabaseClient';
import { getHiddenClassroomIds, isObsoleteGhostClassroom } from '../../lib/teacherClassrooms';
import { hydrateHiddenClassroomsFromCloud } from '../../lib/workspaceCloudPrefs';
import type { AppSessionContext } from '../../types/core';

interface SystemOverviewPageProps {
  session: AppSessionContext;
}

interface OverviewClassroomRow {
  id: string;
  name: string;
  academic_year: string | null;
  status?: string | null;
}

interface OverviewStudentRow {
  id: string;
  classroom_id: string | null;
  student_code: string | null;
  first_name: string;
  last_name: string;
}

interface OverviewAttendanceSessionRow {
  id: string;
  classroom_id: string | null;
  attendance_date: string;
  period_label: string;
  subject_name: string | null;
}

interface OverviewAttendanceRecordRow {
  session_id: string;
  student_id: string;
  status: string;
}

interface OverviewAssessmentRow {
  id: string;
  classroom_id: string | null;
  max_score: number | null;
}

interface OverviewScoreEntryRow {
  assessment_id: string;
  student_id: string;
  score: number | null;
}

interface OverviewSavingsAccountRow {
  student_id: string;
  balance: number | string | null;
}

interface OverviewSavingsTxRow {
  student_id: string;
  amount: number | string | null;
  transaction_type: string;
  transaction_date: string | null;
}

interface OverviewBehaviorRow {
  student_id: string;
  tone: string;
  points: number | null;
  follow_up_status: string | null;
}

interface OverviewHealthRow {
  student_id: string;
  record_type: string;
  status: string;
  record_date: string;
}

interface OverviewCareCaseRow {
  id: string;
  student_id: string;
}

interface OverviewHomeVisitRow {
  student_id: string;
}

const GRADE_BUCKETS = [4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0] as const;

function buildDemoDataset(today: string) {
  const classrooms: OverviewClassroomRow[] = [
    { id: 'demo-p4', name: 'ป.4/1', academic_year: '2569' },
    { id: 'demo-p5', name: 'ป.5/1', academic_year: '2569' },
    { id: 'demo-p6', name: 'ป.6/1', academic_year: '2569' },
  ];

  const students: OverviewStudentRow[] = [
    { id: 'd-st-1', classroom_id: 'demo-p4', student_code: '401', first_name: 'ณัฐวุฒิ', last_name: 'ใจดี' },
    { id: 'd-st-2', classroom_id: 'demo-p4', student_code: '402', first_name: 'กชกร', last_name: 'ทองสุข' },
    { id: 'd-st-3', classroom_id: 'demo-p5', student_code: '501', first_name: 'พิมพ์ชนก', last_name: 'แสงทอง' },
    { id: 'd-st-4', classroom_id: 'demo-p5', student_code: '502', first_name: 'กิตติพงศ์', last_name: 'สุขใจ' },
    { id: 'd-st-5', classroom_id: 'demo-p6', student_code: '601', first_name: 'ธนากร', last_name: 'รุ่งเรือง' },
    { id: 'd-st-6', classroom_id: 'demo-p6', student_code: '602', first_name: 'ณิชาภัทร', last_name: 'มีทรัพย์' },
  ];

  const attendanceSessions: OverviewAttendanceSessionRow[] = [];
  const attendanceRecords: OverviewAttendanceRecordRow[] = [];

  for (let offset = 75; offset >= 0; offset -= 1) {
    const dStr = getBangkokDate(new Date(Date.now() - offset * 86_400_000));
    const jsDay = new Date(`${dStr}T12:00:00+07:00`).getUTCDay();
    if (jsDay === 0 || jsDay === 6) continue;

    classrooms.forEach((room, rIdx) => {
      const sessId = `demo-sess-${room.id}-${dStr}`;
      attendanceSessions.push({
        id: sessId,
        classroom_id: room.id,
        attendance_date: dStr,
        period_label: 'เช้า',
        subject_name: null,
      });

      students
        .filter((s) => s.classroom_id === room.id)
        .forEach((st, sIdx) => {
          let status = 'present';
          if (st.id === 'd-st-3' && offset < 3) status = 'absent';
          else if ((offset + rIdx + sIdx) % 19 === 0) status = 'absent';
          else if ((offset + sIdx) % 13 === 0) status = 'leave';
          else if ((offset + rIdx) % 9 === 0) status = 'late';

          attendanceRecords.push({
            session_id: sessId,
            student_id: st.id,
            status,
          });
        });
    });
  }

  const scoreAssessments: OverviewAssessmentRow[] = [
    { id: 'da-1', classroom_id: 'demo-p4', max_score: 20 },
    { id: 'da-2', classroom_id: 'demo-p4', max_score: 50 },
    { id: 'da-3', classroom_id: 'demo-p5', max_score: 20 },
    { id: 'da-4', classroom_id: 'demo-p5', max_score: 50 },
    { id: 'da-5', classroom_id: 'demo-p6', max_score: 20 },
    { id: 'da-6', classroom_id: 'demo-p6', max_score: 50 },
  ];

  const scoreEntries: OverviewScoreEntryRow[] = [
    { assessment_id: 'da-1', student_id: 'd-st-1', score: 17 },
    { assessment_id: 'da-1', student_id: 'd-st-2', score: 15 },
    { assessment_id: 'da-2', student_id: 'd-st-1', score: 42 },
    { assessment_id: 'da-2', student_id: 'd-st-2', score: 38 },
    { assessment_id: 'da-3', student_id: 'd-st-3', score: 9 },
    { assessment_id: 'da-3', student_id: 'd-st-4', score: 15 },
    { assessment_id: 'da-4', student_id: 'd-st-3', score: 22 },
    { assessment_id: 'da-4', student_id: 'd-st-4', score: 34 },
    { assessment_id: 'da-5', student_id: 'd-st-5', score: 18 },
    { assessment_id: 'da-5', student_id: 'd-st-6', score: 14 },
  ];

  const savingsAccounts: OverviewSavingsAccountRow[] = [
    { student_id: 'd-st-1', balance: 1850 },
    { student_id: 'd-st-2', balance: 2400 },
    { student_id: 'd-st-3', balance: 960 },
    { student_id: 'd-st-4', balance: 1540 },
    { student_id: 'd-st-5', balance: 3100 },
    { student_id: 'd-st-6', balance: 2750 },
  ];

  const savingsTxs: OverviewSavingsTxRow[] = [
    { student_id: 'd-st-1', amount: 250, transaction_type: 'deposit', transaction_date: today },
    { student_id: 'd-st-5', amount: 400, transaction_type: 'deposit', transaction_date: today },
  ];

  const behaviorRows: OverviewBehaviorRow[] = [
    { student_id: 'd-st-1', tone: 'positive', points: 5, follow_up_status: null },
    { student_id: 'd-st-3', tone: 'negative', points: 3, follow_up_status: 'contact_guardian' },
    { student_id: 'd-st-5', tone: 'positive', points: 10, follow_up_status: null },
  ];

  const healthRows: OverviewHealthRow[] = [
    { student_id: 'd-st-1', record_type: 'toothbrushing', status: 'done', record_date: today },
    { student_id: 'd-st-2', record_type: 'milk', status: 'done', record_date: today },
    { student_id: 'd-st-3', record_type: 'lunch', status: 'attention', record_date: today },
    { student_id: 'd-st-5', record_type: 'toothbrushing', status: 'done', record_date: today },
  ];

  const careCases: OverviewCareCaseRow[] = [{ id: 'dc-1', student_id: 'd-st-3' }];
  const homeVisits: OverviewHomeVisitRow[] = [{ student_id: 'd-st-1' }, { student_id: 'd-st-3' }];

  return {
    classrooms,
    students,
    attendanceSessions,
    attendanceRecords,
    scoreAssessments,
    scoreEntries,
    savingsAccounts,
    savingsTxs,
    behaviorRows,
    healthRows,
    careCases,
    homeVisits,
    termName: '2/2569',
  };
}

export function SystemOverviewPage({ session }: SystemOverviewPageProps) {
  const demoMode = isDemoSession(session);
  const workspaceId = session.workspace?.id || '';
  const todayStr = getBangkokDate();

  const [isLoading, setIsLoading] = useState(Boolean(supabase && workspaceId && !demoMode));
  const [selectedClassroomId, setSelectedClassroomId] = useState<'all' | string>('all');
  const [classrooms, setClassrooms] = useState<OverviewClassroomRow[]>([]);
  const [students, setStudents] = useState<OverviewStudentRow[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<OverviewAttendanceSessionRow[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<OverviewAttendanceRecordRow[]>([]);
  const [scoreAssessments, setScoreAssessments] = useState<OverviewAssessmentRow[]>([]);
  const [scoreEntries, setScoreEntries] = useState<OverviewScoreEntryRow[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<OverviewSavingsAccountRow[]>([]);
  const [savingsTxs, setSavingsTxs] = useState<OverviewSavingsTxRow[]>([]);
  const [behaviorRows, setBehaviorRows] = useState<OverviewBehaviorRow[]>([]);
  const [healthRows, setHealthRows] = useState<OverviewHealthRow[]>([]);
  const [careCases, setCareCases] = useState<OverviewCareCaseRow[]>([]);
  const [homeVisits, setHomeVisits] = useState<OverviewHomeVisitRow[]>([]);
  const [termName, setTermName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAllWorkspaceStats() {
      if (demoMode) {
        const demo = buildDemoDataset(todayStr);
        if (!mounted) return;
        setClassrooms(demo.classrooms);
        setStudents(demo.students);
        setAttendanceSessions(demo.attendanceSessions);
        setAttendanceRecords(demo.attendanceRecords);
        setScoreAssessments(demo.scoreAssessments);
        setScoreEntries(demo.scoreEntries);
        setSavingsAccounts(demo.savingsAccounts);
        setSavingsTxs(demo.savingsTxs);
        setBehaviorRows(demo.behaviorRows);
        setHealthRows(demo.healthRows);
        setCareCases(demo.careCases);
        setHomeVisits(demo.homeVisits);
        setTermName(demo.termName);
        setIsLoading(false);
        return;
      }

      if (!supabase || !workspaceId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      await hydrateHiddenClassroomsFromCloud(session.profile.id, workspaceId);
      const hiddenIds = getHiddenClassroomIds(workspaceId);
      const heatmapWindowStart = getBangkokDate(new Date(Date.now() - 111 * 86_400_000));
      const riskWindowStart = getBangkokDate(new Date(Date.now() - 29 * 86_400_000));
      const monthPrefix = todayStr.slice(0, 7);

      const [
        clsRes,
        stuRes,
        sessRes,
        assessRes,
        savAccRes,
        savTxRes,
        behRes,
        healthRes,
        careRes,
        visitRes,
        termRes,
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id, name, academic_year, status')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active')
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id, classroom_id, student_code, first_name, last_name')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active')
          .order('student_code', { ascending: true }),
        supabase
          .from('attendance_sessions')
          .select('id, classroom_id, attendance_date, period_label, subject_name')
          .eq('workspace_id', workspaceId)
          .gte('attendance_date', heatmapWindowStart)
          .lte('attendance_date', todayStr)
          .order('attendance_date', { ascending: true }),
        supabase
          .from('score_assessments')
          .select('id, classroom_id, max_score')
          .eq('workspace_id', workspaceId)
          .neq('status', 'archived'),
        supabase
          .from('savings_accounts')
          .select('student_id, balance')
          .eq('workspace_id', workspaceId),
        supabase
          .from('savings_transactions')
          .select('student_id, amount, transaction_type, transaction_date')
          .eq('workspace_id', workspaceId)
          .eq('transaction_type', 'deposit')
          .gte('transaction_date', `${monthPrefix}-01`)
          .limit(3000),
        supabase
          .from('behavior_records')
          .select('student_id, tone, points, follow_up_status')
          .eq('workspace_id', workspaceId)
          .limit(3000),
        supabase
          .from('student_health_records')
          .select('student_id, record_type, status, record_date')
          .eq('workspace_id', workspaceId)
          .gte('record_date', riskWindowStart)
          .limit(3000),
        supabase
          .from('student_care_cases')
          .select('id, student_id')
          .eq('workspace_id', workspaceId)
          .in('status', ['open', 'monitoring']),
        supabase
          .from('student_home_visits')
          .select('student_id')
          .eq('workspace_id', workspaceId)
          .in('status', ['submitted', 'certified']),
        supabase
          .from('academic_terms')
          .select('term_name, is_current, status')
          .eq('workspace_id', workspaceId)
          .order('is_current', { ascending: false })
          .limit(3),
      ]);

      if (!mounted) return;

      const loadedStudents = (stuRes.data || []) as OverviewStudentRow[];
      const countsByClassroom = new Map<string, number>();
      loadedStudents.forEach((st) => {
        if (st.classroom_id) {
          countsByClassroom.set(st.classroom_id, (countsByClassroom.get(st.classroom_id) || 0) + 1);
        }
      });
      const allRooms = (clsRes.data || []) as OverviewClassroomRow[];
      const rawClassrooms = allRooms.filter(
        (c) =>
          !hiddenIds.has(c.id) &&
          !isObsoleteGhostClassroom(c, allRooms, countsByClassroom, workspaceId),
      );
      const loadedSessions = (sessRes.data || []) as OverviewAttendanceSessionRow[];
      const sessionIdList = loadedSessions.map((s) => s.id);
      const assessmentIdList = ((assessRes.data || []) as OverviewAssessmentRow[]).map((a) => a.id);

      const [attRowsRes, scoreRowsRes] = await Promise.all([
        sessionIdList.length > 0
          ? supabase
              .from('attendance_records')
              .select('session_id, student_id, status')
              .eq('workspace_id', workspaceId)
              .in('session_id', sessionIdList)
          : Promise.resolve({ data: [] as OverviewAttendanceRecordRow[] }),
        assessmentIdList.length > 0
          ? supabase
              .from('score_entries')
              .select('assessment_id, student_id, score')
              .eq('workspace_id', workspaceId)
              .in('assessment_id', assessmentIdList)
          : Promise.resolve({ data: [] as OverviewScoreEntryRow[] }),
      ]);

      if (!mounted) return;

      setClassrooms(rawClassrooms);
      setStudents((stuRes.data || []) as OverviewStudentRow[]);
      setAttendanceSessions(loadedSessions);
      setAttendanceRecords((attRowsRes.data || []) as OverviewAttendanceRecordRow[]);
      setScoreAssessments((assessRes.data || []) as OverviewAssessmentRow[]);
      setScoreEntries((scoreRowsRes.data || []) as OverviewScoreEntryRow[]);
      setSavingsAccounts((savAccRes.data || []) as OverviewSavingsAccountRow[]);
      setSavingsTxs((savTxRes.data || []) as OverviewSavingsTxRow[]);
      setBehaviorRows((behRes.data || []) as OverviewBehaviorRow[]);
      setHealthRows((healthRes.data || []) as OverviewHealthRow[]);
      setCareCases((careRes.data || []) as OverviewCareCaseRow[]);
      setHomeVisits((visitRes.data || []) as OverviewHomeVisitRow[]);

      const pickedTerm =
        (termRes.data || []).find((t) => t.is_current) ||
        (termRes.data || []).find((t) => t.status === 'open') ||
        termRes.data?.[0];
      setTermName(pickedTerm?.term_name ?? session.workspace?.academicYear ?? null);
      setIsLoading(false);
    }

    void loadAllWorkspaceStats();
    return () => {
      mounted = false;
    };
  }, [demoMode, session.profile.id, session.workspace?.academicYear, todayStr, workspaceId]);

  const classroomById = useMemo(
    () => new Map(classrooms.map((c) => [c.id, c])),
    [classrooms],
  );

  // Compute scoped metrics for 'all' or chosen classroom
  const scoped = useMemo(() => {
    const scopeStudents =
      selectedClassroomId === 'all'
        ? students
        : students.filter((s) => s.classroom_id === selectedClassroomId);
    const scopeStudentIds = new Set(scopeStudents.map((s) => s.id));
    const scopeSessions =
      selectedClassroomId === 'all'
        ? attendanceSessions
        : attendanceSessions.filter((s) => s.classroom_id === selectedClassroomId);
    const scopeSessionIdSet = new Set(scopeSessions.map((s) => s.id));
    const scopeAttRecords = attendanceRecords.filter(
      (r) => scopeSessionIdSet.has(r.session_id) && scopeStudentIds.has(r.student_id),
    );

    const recordsBySess = new Map<string, OverviewAttendanceRecordRow[]>();
    scopeAttRecords.forEach((r) => {
      const list = recordsBySess.get(r.session_id) || [];
      list.push(r);
      recordsBySess.set(r.session_id, list);
    });

    // Heatmap aggregated by date (all rooms summed when 'all', or chosen room)
    const heatMap = new Map<string, TermHeatmapDayItem>();
    const chosenSessionPerRoomDate = new Map<string, OverviewAttendanceSessionRow>();
    scopeSessions.forEach((sess) => {
      const key = `${sess.classroom_id || 'none'}:${sess.attendance_date}`;
      const existing = chosenSessionPerRoomDate.get(key);
      if (!existing || sess.period_label === 'เช้า' || !sess.subject_name) {
        if ((recordsBySess.get(sess.id) || []).length > 0 || !existing) {
          chosenSessionPerRoomDate.set(key, sess);
        }
      }
    });

    chosenSessionPerRoomDate.forEach((sess) => {
      const rows = recordsBySess.get(sess.id) || [];
      if (rows.length === 0) return;
      const dStr = sess.attendance_date.slice(0, 10);
      const cur = heatMap.get(dStr) || { date: dStr, present: 0, absent: 0, leave: 0, late: 0, total: 0 };
      rows.forEach((r) => {
        if (r.status === 'present' || r.status === 'activity') cur.present += 1;
        else if (r.status === 'late') cur.late += 1;
        else if (r.status === 'leave' || r.status === 'sick') cur.leave += 1;
        else if (r.status === 'absent') cur.absent += 1;
        cur.total += 1;
      });
      heatMap.set(dStr, cur);
    });

    const heatmapDays = Array.from(heatMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const attTotals = heatmapDays.reduce(
      (acc, d) => {
        acc.present += d.present;
        acc.late += d.late;
        acc.leave += d.leave;
        acc.absent += d.absent;
        acc.total += d.total;
        return acc;
      },
      { present: 0, late: 0, leave: 0, absent: 0, total: 0 },
    );
    const attRate =
      attTotals.total > 0
        ? Math.round(((attTotals.present + attTotals.late) / attTotals.total) * 100)
        : 0;

    // Scores & Grade Distribution
    const scopeAssessments =
      selectedClassroomId === 'all'
        ? scoreAssessments
        : scoreAssessments.filter((a) => a.classroom_id === selectedClassroomId);
    const maxScoreByAssess = new Map(
      scopeAssessments.map((a) => [a.id, Number(a.max_score || 100)]),
    );
    const scopeScores = scoreEntries.filter(
      (e) => scopeStudentIds.has(e.student_id) && maxScoreByAssess.has(e.assessment_id),
    );
    const gradedAssessIds = new Set<string>();
    const pctByStudent = new Map<string, number[]>();
    let sumPct = 0;

    scopeScores.forEach((entry) => {
      if (entry.score === null || entry.score === undefined) return;
      gradedAssessIds.add(entry.assessment_id);
      const max = Math.max(1, maxScoreByAssess.get(entry.assessment_id) || 100);
      const pct = Math.min(100, Math.max(0, (Number(entry.score) / max) * 100));
      sumPct += pct;
      const list = pctByStudent.get(entry.student_id) || [];
      list.push(pct);
      pctByStudent.set(entry.student_id, list);
    });

    const gradeCounts = new Map<number, number>(GRADE_BUCKETS.map((g) => [g, 0]));
    let passedCount = 0;
    pctByStudent.forEach((list) => {
      if (list.length === 0) return;
      const avg = list.reduce((a, b) => a + b, 0) / list.length;
      if (avg >= 50) passedCount += 1;
      const g = calculateOBECGrade(avg).grade;
      gradeCounts.set(g, (gradeCounts.get(g) || 0) + 1);
    });

    const gradedAssessmentsCount = gradedAssessIds.size;
    const totalAssessmentsCount = scopeAssessments.length;
    const gradedRatio =
      totalAssessmentsCount > 0
        ? Math.min(100, Math.round((gradedAssessmentsCount / totalAssessmentsCount) * 100))
        : 0;
    const avgScorePct = scopeScores.length > 0 ? Math.round(sumPct / scopeScores.length) : 0;

    // Savings
    const scopeSavingsAccounts = savingsAccounts.filter((a) => scopeStudentIds.has(a.student_id));
    const totalSavingsBalance = scopeSavingsAccounts.reduce((s, a) => s + Number(a.balance || 0), 0);
    const activeSavingsCount = scopeSavingsAccounts.filter((a) => Number(a.balance || 0) > 0).length;
    const monthPrefix = todayStr.slice(0, 7);
    const monthlySavingsDeposits = savingsTxs
      .filter(
        (tx) =>
          scopeStudentIds.has(tx.student_id) &&
          tx.transaction_type === 'deposit' &&
          (!tx.transaction_date || tx.transaction_date.startsWith(monthPrefix)),
      )
      .reduce((s, tx) => s + Number(tx.amount || 0), 0);

    // Health
    const todayRoutineStudents = new Set<string>();
    const attentionHealthIds = new Set<string>();
    healthRows.forEach((h) => {
      if (!scopeStudentIds.has(h.student_id)) return;
      if (
        h.record_date === todayStr &&
        ['toothbrushing', 'milk', 'lunch'].includes(h.record_type)
      ) {
        todayRoutineStudents.add(h.student_id);
      }
      if (h.status === 'attention') {
        attentionHealthIds.add(h.student_id);
      }
    });

    // Behavior & Visits & Care Cases
    let posPoints = 0;
    let negPoints = 0;
    let behaviorCount = 0;
    const behaviorStatsMap = new Map<string, StudentRiskBehaviorStats>();
    behaviorRows.forEach((b) => {
      if (!scopeStudentIds.has(b.student_id)) return;
      behaviorCount += 1;
      const pts = Number(b.points || 0);
      if (b.tone === 'positive') posPoints += pts || 1;
      else negPoints += pts || 1;
      const cur = behaviorStatsMap.get(b.student_id) || { netPoints: 0, urgentFollowUps: 0 };
      cur.netPoints += b.tone === 'negative' && pts > 0 ? -pts : pts;
      if (b.follow_up_status === 'contact_guardian' || b.follow_up_status === 'referred') {
        cur.urgentFollowUps += 1;
      }
      behaviorStatsMap.set(b.student_id, cur);
    });

    const homeVisitCount = homeVisits.filter((hv) => scopeStudentIds.has(hv.student_id)).length;
    const openCareCases = careCases.filter((cc) => scopeStudentIds.has(cc.student_id));

    // Risk signals (30-day window)
    const riskWindowStart = getBangkokDate(new Date(Date.now() - 29 * 86_400_000));
    const attMap30 = computeAttendanceStreaksAndRates(
      scopeSessions
        .filter((s) => s.attendance_date >= riskWindowStart)
        .map((s) => ({
          id: s.id,
          attendance_date: s.attendance_date,
          subject_name: s.subject_name,
        })),
      scopeAttRecords,
      scopeStudents.map((s) => s.id),
    );

    const scoreStatsMap = new Map<string, StudentRiskScoreStats>();
    pctByStudent.forEach((list, sid) => {
      const avg = list.length > 0 ? list.reduce((a, b) => a + b, 0) / list.length : null;
      scoreStatsMap.set(sid, { averagePercent: avg, gradedCount: list.length });
    });

    const riskSignals = evaluateStudentRiskSignals({
      students: scopeStudents,
      attendanceMap: attMap30,
      scoresByStudent: scoreStatsMap,
      behaviorByStudent: behaviorStatsMap,
      attentionHealthStudentIds: attentionHealthIds,
      openCareCaseStudentIds: new Set(openCareCases.map((c) => c.student_id)),
    });

    return {
      studentsCount: scopeStudents.length,
      heatmapDays,
      attTotals,
      attRate,
      gradedAssessmentsCount,
      totalAssessmentsCount,
      gradedRatio,
      avgScorePct,
      passedCount,
      gradeCounts,
      totalSavingsBalance,
      activeSavingsCount,
      monthlySavingsDeposits,
      todayRoutineCount: todayRoutineStudents.size,
      attentionHealthCount: attentionHealthIds.size,
      behaviorCount,
      posPoints,
      negPoints,
      homeVisitCount,
      openCareCaseCount: openCareCases.length,
      riskSignals,
    };
  }, [
    attendanceRecords,
    attendanceSessions,
    behaviorRows,
    careCases,
    healthRows,
    homeVisits,
    savingsAccounts,
    savingsTxs,
    scoreAssessments,
    scoreEntries,
    selectedClassroomId,
    students,
    todayStr,
  ]);

  // Per-classroom summary comparison rows when viewing 'all'
  const perClassroomRows = useMemo(() => {
    const riskIds = new Set(scoped.riskSignals.map((r) => r.studentId));
    return classrooms.map((room) => {
      const roomStudents = students.filter((s) => s.classroom_id === room.id);
      const roomStudentIds = new Set(roomStudents.map((s) => s.id));
      const roomSessions = attendanceSessions.filter((s) => s.classroom_id === room.id);
      const roomSessIds = new Set(roomSessions.map((s) => s.id));
      const roomAtt = attendanceRecords.filter(
        (r) => roomSessIds.has(r.session_id) && roomStudentIds.has(r.student_id),
      );
      const attOk = roomAtt.filter(
        (r) => r.status === 'present' || r.status === 'activity' || r.status === 'late',
      ).length;
      const attPct = roomAtt.length > 0 ? Math.round((attOk / roomAtt.length) * 100) : 0;

      const roomAssessments = scoreAssessments.filter((a) => a.classroom_id === room.id);
      const maxMap = new Map(roomAssessments.map((a) => [a.id, Number(a.max_score || 100)]));
      const roomScores = scoreEntries.filter(
        (e) => roomStudentIds.has(e.student_id) && maxMap.has(e.assessment_id),
      );
      const gradedIds = new Set(roomScores.map((e) => e.assessment_id));
      const scorePct =
        roomScores.length > 0
          ? Math.round(
              roomScores.reduce(
                (s, e) => s + Math.min(100, (Number(e.score || 0) / Math.max(1, maxMap.get(e.assessment_id) || 100)) * 100),
                0,
              ) / roomScores.length,
            )
          : 0;

      const roomSavings = savingsAccounts
        .filter((a) => roomStudentIds.has(a.student_id))
        .reduce((s, a) => s + Number(a.balance || 0), 0);

      const riskCount = roomStudents.filter((s) => riskIds.has(s.id)).length;

      return {
        id: room.id,
        name: room.name,
        studentCount: roomStudents.length,
        attPct,
        gradedCount: gradedIds.size,
        totalAssessments: roomAssessments.length,
        scorePct,
        roomSavings,
        riskCount,
      };
    });
  }, [
    attendanceRecords,
    attendanceSessions,
    classrooms,
    savingsAccounts,
    scoped.riskSignals,
    scoreAssessments,
    scoreEntries,
    students,
  ]);

  const scopeLabel =
    selectedClassroomId === 'all'
      ? `ทุกห้องเรียน (${classrooms.length} ห้อง)`
      : classroomById.get(selectedClassroomId)?.name || 'ห้องเรียน';

  const presentShare =
    scoped.attTotals.total > 0 ? (scoped.attTotals.present / scoped.attTotals.total) * 100 : 0;
  const lateShare =
    scoped.attTotals.total > 0 ? (scoped.attTotals.late / scoped.attTotals.total) * 100 : 0;
  const leaveShare =
    scoped.attTotals.total > 0 ? (scoped.attTotals.leave / scoped.attTotals.total) * 100 : 0;
  const absentShare =
    scoped.attTotals.total > 0 ? (scoped.attTotals.absent / scoped.attTotals.total) * 100 : 0;
  const riskRatio =
    scoped.studentsCount > 0
      ? Math.min(100, Math.round((scoped.riskSignals.length / scoped.studentsCount) * 100))
      : 0;

  const studentRoomMap = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (s.classroom_id) {
        const name = classroomById.get(s.classroom_id)?.name;
        if (name) map.set(s.id, name);
      }
    });
    return map;
  }, [classroomById, students]);

  return (
    <main className="app-page pb-24">
      <div className="mx-auto max-w-[1160px] space-y-4">
        {/* Top Clean Header */}
        <header className="rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ec] px-2.5 py-0.5 text-[11px] font-bold text-[#1c573d]">
                  <BarChart3 size={13} aria-hidden="true" />
                  {termName ? `ภาคเรียนที่ ${termName}` : 'ภาคเรียนปัจจุบัน'}
                </span>
                <span className="text-xs font-semibold text-[#75827a]">
                  {scopeLabel} · นักเรียนทั้งหมด {scoped.studentsCount} คน
                </span>
              </div>
              <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#1f2924]">
                ภาพรวมทั้งระบบ
              </h1>
              <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                สรุปสถิติการมาเรียน คะแนน เงินออม สุขภาพ พฤติกรรม และนักเรียนที่ควรดูแลในหน้าเดียว
              </p>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2 print:hidden">
              <Link
                to="/app/dashboard"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-[#fafbf8] px-3 text-xs font-bold text-[#1f2924] transition hover:bg-[#f0f3ee]"
              >
                <Home size={14} aria-hidden="true" />
                <span>ไปหน้าวันนี้</span>
              </Link>
              <Link
                to="/app/dashboard?view=academic-hub"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-white px-3 text-xs font-bold text-[#1f2924] transition hover:bg-[#fafbf8]"
              >
                <CheckCircle2 size={14} className="text-[#2f7d5b]" aria-hidden="true" />
                <span>ความพร้อมปิดเทอม</span>
              </Link>
              <Link
                to="/app/dashboard?view=reports&reportView=executive"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce3d7] bg-white px-3 text-xs font-bold text-[#1f2924] transition hover:bg-[#fafbf8]"
              >
                <BookOpen size={14} className="text-sky-700" aria-hidden="true" />
                <span>สรุปผู้บริหาร A4</span>
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1c342b] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#2f7d5b]"
              >
                <Printer size={14} aria-hidden="true" />
                <span>พิมพ์ / PDF</span>
              </button>
            </div>
          </div>

          {/* Scope Selector Pills: All Classrooms vs Per-Room */}
          <div className="no-print mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#f0f2ee] pt-3 print:hidden">
            <button
              type="button"
              onClick={() => setSelectedClassroomId('all')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                selectedClassroomId === 'all'
                  ? 'bg-[#1c342b] text-white shadow-2xs'
                  : 'border border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f0f3ee]'
              }`}
            >
              <span>ทุกห้อง (ทั้งโรงเรียน)</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  selectedClassroomId === 'all' ? 'bg-white/20 text-white' : 'bg-white text-[#55615a]'
                }`}
              >
                {students.length}
              </span>
            </button>

            {classrooms.map((room) => {
              const count = students.filter((s) => s.classroom_id === room.id).length;
              const active = selectedClassroomId === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setSelectedClassroomId(room.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-[#2f7d5b] text-white shadow-2xs'
                      : 'border border-[#e5e8e1] bg-[#fafbf9] text-[#55615a] hover:bg-[#f0f3ee]'
                  }`}
                >
                  <span>{room.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#75827a]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </header>

        {isLoading ? (
          <div className="rounded-[24px] border border-[#e5e8e1] bg-white p-10 text-center text-sm font-bold text-[#75827a]">
            กำลังรวบรวมสถิติทั้งหมดในระบบ...
          </div>
        ) : (
          <>
            {/* Row 1: 4 Primary KPI Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <p className="text-xs font-bold text-[#75827a]">มาเรียน</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                  {scoped.attRate}%
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                  ขาด {scoped.attTotals.absent} · ลา {scoped.attTotals.leave} · สาย {scoped.attTotals.late}
                </p>
                <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                  <div className="bg-emerald-500" style={{ width: `${presentShare}%` }} />
                  <div className="bg-amber-400" style={{ width: `${lateShare}%` }} />
                  <div className="bg-sky-400" style={{ width: `${leaveShare}%` }} />
                  <div className="bg-rose-400" style={{ width: `${absentShare}%` }} />
                </div>
              </article>

              <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <p className="text-xs font-bold text-[#75827a]">กรอกคะแนนแล้ว</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                  {scoped.gradedRatio}%
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                  {scoped.gradedAssessmentsCount} / {scoped.totalAssessmentsCount} ช่องคะแนน
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${scoped.gradedRatio}%` }} />
                </div>
              </article>

              <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <p className="text-xs font-bold text-[#75827a]">คะแนนเฉลี่ยรวม</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                  {scoped.avgScorePct}%
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                  ผ่านเกณฑ์ {scoped.passedCount} / {scoped.studentsCount} คน
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                  <div
                    className="h-full rounded-full bg-[#2f7d5b]"
                    style={{ width: `${Math.min(100, scoped.avgScorePct)}%` }}
                  />
                </div>
              </article>

              <article className="rounded-[20px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <p className="text-xs font-bold text-[#75827a]">ควรดูแลต่อเนื่อง</p>
                <p className="mt-1.5 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                  {scoped.riskSignals.length} คน
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[#75827a]">
                  {scoped.riskSignals.length > 0 ? 'ขาด/คะแนนต่ำ/เคสติดตาม' : 'ไม่พบสัญญาณเสี่ยงในขอบเขตนี้'}
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1ec]">
                  <div
                    className={`h-full rounded-full ${scoped.riskSignals.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${scoped.riskSignals.length > 0 ? Math.max(12, riskRatio) : 100}%` }}
                  />
                </div>
              </article>
            </div>

            {/* Row 2: 12-Col Term Attendance Heatmap + Actionable Watchlist */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-7">
                <TermAttendanceHeatmap
                  days={scoped.heatmapDays}
                  selectedDate={todayStr}
                  classroomName={scopeLabel}
                />
              </div>

              <article className="flex flex-col justify-between rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs xl:col-span-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-[#1f2924]">
                        <ShieldAlert
                          size={16}
                          className={scoped.riskSignals.length > 0 ? 'text-rose-600' : 'text-emerald-600'}
                          aria-hidden="true"
                        />
                        ควรดูแล ({scoped.riskSignals.length} คน)
                      </h2>
                      <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                        แตะชื่อเพื่อเปิดโปรไฟล์นักเรียนแบบ 360°
                      </p>
                    </div>
                    <Link
                      to="/app/dashboard?view=students&studentView=care"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#2f7d5b] hover:underline"
                    >
                      <span>ดูทั้งหมด</span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </Link>
                  </div>

                  {scoped.riskSignals.length > 0 ? (
                    <div className="mt-3.5 divide-y divide-[#f0f2ee]">
                      {scoped.riskSignals.slice(0, 6).map((item) => {
                        const roomName = studentRoomMap.get(item.studentId);
                        return (
                          <Link
                            key={item.studentId}
                            to={`/app/dashboard?view=students&studentView=profile&studentId=${encodeURIComponent(item.studentId)}`}
                            className="group -mx-1.5 flex items-center justify-between gap-3 rounded-xl px-1.5 py-2.5 transition hover:bg-[#fafbf9]"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                  item.riskLevel === 'high' ? 'bg-rose-500' : 'bg-amber-400'
                                }`}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#1f2924] group-hover:text-[#1c573d]">
                                  {item.studentName}
                                  {selectedClassroomId === 'all' && roomName ? (
                                    <span className="ml-1.5 rounded-md bg-[#f1f3ef] px-1.5 py-0.5 text-[10px] font-bold text-[#55615a]">
                                      {roomName}
                                    </span>
                                  ) : null}
                                </p>
                                <p className="mt-0.5 truncate text-xs font-medium text-[#75827a]">
                                  {item.reasons.slice(0, 2).join(' · ') || 'ต้องติดตามใกล้ชิด'}
                                </p>
                              </div>
                            </div>
                            <ChevronRight
                              size={15}
                              className="shrink-0 text-[#9aa59e] transition group-hover:translate-x-0.5 group-hover:text-[#1c573d]"
                              aria-hidden="true"
                            />
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dce3d7] bg-[#fafbf9] px-4 py-8 text-center">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e6f4ec] text-[#1c573d]">
                        <ShieldCheck size={20} aria-hidden="true" />
                      </span>
                      <p className="mt-2.5 text-sm font-bold text-[#1f2924]">ยังไม่มีนักเรียนกลุ่มเสี่ยง</p>
                      <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                        เวลาเรียนและคะแนนอยู่ในเกณฑ์ปกติ
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-[#f0f2ee] pt-2.5 text-[11px] font-medium text-[#75827a]">
                  ประเมินจากเวลาเรียน 30 วัน คะแนน พฤติกรรม สุขภาพ และเคสติดตาม
                </div>
              </article>
            </div>

            {/* Row 3: 4 All-System Module Summary Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* 1. Grade Distribution */}
              <article className="flex flex-col justify-between rounded-[22px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1f2924]">
                      <Award size={15} className="text-indigo-600" aria-hidden="true" />
                      การกระจายเกรด (0–4)
                    </h3>
                    <Link to="/app/dashboard?view=scores" className="text-[11px] font-bold text-[#2f7d5b] hover:underline">
                      เปิดคะแนน →
                    </Link>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {GRADE_BUCKETS.map((g) => {
                      const count = scoped.gradeCounts.get(g) || 0;
                      const maxG = Math.max(1, ...Array.from(scoped.gradeCounts.values()));
                      const width = count > 0 ? Math.max(8, Math.round((count / maxG) * 100)) : 0;
                      return (
                        <div key={g} className="flex items-center gap-2 text-[11px]">
                          <span className="w-7 font-mono font-bold text-[#55615a]">{g.toFixed(g % 1 === 0 ? 0 : 1)}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f3ef]">
                            <div
                              className={`h-full rounded-full ${g === 0 ? 'bg-rose-400' : g >= 3 ? 'bg-[#2f7d5b]' : 'bg-sky-500'}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-bold text-[#1f2924] tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>

              {/* 2. Savings */}
              <article className="flex flex-col justify-between rounded-[22px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1f2924]">
                      <PiggyBank size={15} className="text-amber-600" aria-hidden="true" />
                      เงินออมนักเรียน
                    </h3>
                    <Link to="/app/dashboard?view=savings" className="text-[11px] font-bold text-[#2f7d5b] hover:underline">
                      สมุดเงินออม →
                    </Link>
                  </div>
                  <p className="mt-3 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                    ฿{scoped.totalSavingsBalance.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[#75827a]">ยอดเงินออมรวมคงเหลือ</p>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-[#f0f2ee] pt-3 text-xs font-semibold text-[#55615a]">
                  <div className="flex justify-between">
                    <span>ยอดฝากเดือนนี้</span>
                    <strong className="text-[#1c573d]">
                      +฿{scoped.monthlySavingsDeposits.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>บัญชีที่มียอดออม</span>
                    <strong className="text-[#1f2924]">{scoped.activeSavingsCount} บัญชี</strong>
                  </div>
                </div>
              </article>

              {/* 3. Health & Daily Care */}
              <article className="flex flex-col justify-between rounded-[22px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1f2924]">
                      <HeartPulse size={15} className="text-teal-600" aria-hidden="true" />
                      สุขภาพ & กิจวัตรวันนี้
                    </h3>
                    <Link to="/app/dashboard?view=student-health" className="text-[11px] font-bold text-[#2f7d5b] hover:underline">
                      บันทึกสุขภาพ →
                    </Link>
                  </div>
                  <p className="mt-3 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                    {scoped.todayRoutineCount} / {scoped.studentsCount} คน
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[#75827a]">บันทึกแปรงฟัน / ดื่มนม / อาหารวันนี้</p>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-[#f0f2ee] pt-3 text-xs font-semibold text-[#55615a]">
                  <div className="flex justify-between">
                    <span>นักเรียนที่ควรเฝ้าระวังสุขภาพ</span>
                    <strong className={scoped.attentionHealthCount > 0 ? 'text-rose-700' : 'text-[#1c573d]'}>
                      {scoped.attentionHealthCount} คน
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>ประเมินข้อมูลสุขภาพ 30 วัน</span>
                    <strong className="text-[#1f2924]">ครบขอบเขต</strong>
                  </div>
                </div>
              </article>

              {/* 4. Behavior & Home Visits */}
              <article className="flex flex-col justify-between rounded-[22px] border border-[#e5e8e1] bg-white p-4 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-[#1f2924]">
                      <HeartHandshake size={15} className="text-rose-600" aria-hidden="true" />
                      พฤติกรรม & เยี่ยมบ้าน
                    </h3>
                    <Link to="/app/dashboard?view=behavior" className="text-[11px] font-bold text-[#2f7d5b] hover:underline">
                      บันทึกพฤติกรรม →
                    </Link>
                  </div>
                  <p className="mt-3 font-display text-2xl font-extrabold text-[#1f2924] tabular-nums">
                    {scoped.behaviorCount} รายการ
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                    ความดี +{scoped.posPoints} แต้ม · หัก -{scoped.negPoints} แต้ม
                  </p>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-[#f0f2ee] pt-3 text-xs font-semibold text-[#55615a]">
                  <div className="flex justify-between">
                    <span>เยี่ยมบ้านแล้ว</span>
                    <strong className="text-[#1f2924]">{scoped.homeVisitCount} ครั้ง</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>เคสดูแลที่เปิดอยู่</span>
                    <strong className={scoped.openCareCaseCount > 0 ? 'text-amber-700' : 'text-[#1c573d]'}>
                      {scoped.openCareCaseCount} เคส
                    </strong>
                  </div>
                </div>
              </article>
            </div>

            {/* Row 4: Per-Classroom Comparison Breakdown (when viewing 'all' with 2+ rooms) */}
            {selectedClassroomId === 'all' && classrooms.length > 1 ? (
              <section className="rounded-[24px] border border-[#e5e8e1] bg-white p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-[#1f2924]">
                      <Users size={16} className="text-[#2f7d5b]" aria-hidden="true" />
                      เปรียบเทียบรายห้องเรียน ({classrooms.length} ห้อง)
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#75827a]">
                      แตะที่ชื่อห้องเพื่อเจาะลึกดูข้อมูลเฉพาะห้องนั้น
                    </p>
                  </div>
                </div>

                {/* Mobile Cards (< md) */}
                <div className="mt-4 grid gap-2.5 md:hidden">
                  {perClassroomRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedClassroomId(row.id)}
                      className="rounded-2xl border border-[#e5e8e1] bg-[#fafbf9] p-3.5 text-left transition hover:border-[#2f7d5b]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[#1f2924]">{row.name}</span>
                        <span className="text-xs font-bold text-[#75827a]">{row.studentCount} คน</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="block text-[10px] text-[#75827a]">มาเรียน</span>
                          <strong className="text-[#1c573d]">{row.attPct}%</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#75827a]">คะแนนเฉลี่ย</span>
                          <strong className="text-[#1f2924]">{row.scorePct}%</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-[#75827a]">เงินออม</span>
                          <strong className="text-[#1f2924]">฿{row.roomSavings.toLocaleString('th-TH')}</strong>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Desktop Table (md+) */}
                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#f0f2ee] text-[11px] font-bold text-[#75827a]">
                        <th className="py-2.5 pr-4">ห้องเรียน</th>
                        <th className="py-2.5 pr-4">นักเรียน</th>
                        <th className="py-2.5 pr-4">มาเรียนรวม</th>
                        <th className="py-2.5 pr-4">กรอกคะแนน</th>
                        <th className="py-2.5 pr-4">คะแนนเฉลี่ย</th>
                        <th className="py-2.5 pr-4">เงินออมรวม</th>
                        <th className="py-2.5 text-right">ควรดูแล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f2ee]">
                      {perClassroomRows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedClassroomId(row.id)}
                          className="cursor-pointer transition hover:bg-[#fafbf9]"
                        >
                          <td className="py-3 pr-4 font-extrabold text-[#1c573d]">{row.name}</td>
                          <td className="py-3 pr-4 font-bold text-[#1f2924]">{row.studentCount} คน</td>
                          <td className="py-3 pr-4 font-bold text-emerald-700">{row.attPct}%</td>
                          <td className="py-3 pr-4 text-[#55615a]">
                            {row.gradedCount} / {row.totalAssessments} ช่อง
                          </td>
                          <td className="py-3 pr-4 font-bold text-[#1f2924]">{row.scorePct}%</td>
                          <td className="py-3 pr-4 font-bold text-[#1f2924]">
                            ฿{row.roomSavings.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                row.riskCount > 0 ? 'bg-rose-50 text-rose-700' : 'bg-[#e6f4ec] text-[#1c573d]'
                              }`}
                            >
                              {row.riskCount} คน
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
