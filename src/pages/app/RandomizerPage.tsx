import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Copy,
  Dice5,
  Download,
  History,
  ListRestart,
  Minimize2,
  MonitorPlay,
  Save,
  Shuffle,
  Sparkles,
  UserCheck,
  UsersRound,
} from 'lucide-react';

import { BotanicalCardSprig, BotanicalCornerWatermark, BotanicalEmptyState } from '../../components/shared/BotanicalDecor';

import { writeAuditLog } from '../../lib/auditLog';
import { isDemoSession } from '../../lib/auth';
import { getBangkokDate } from '../../lib/date';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface RandomizerPageProps {
  session: AppSessionContext;
}

type RandomizerMode = 'single' | 'groups' | 'order';

interface ClassroomRow {
  academic_year: string | null;
  id: string;
  name: string;
}

interface StudentRow {
  classroom_id: string | null;
  first_name: string;
  id: string;
  last_name: string;
  nickname: string | null;
  student_code: string | null;
}

interface RandomizerSessionRow {
  classroom_id: string;
  created_at: string;
  id: string;
  mode: RandomizerMode;
  result: RandomizerResult;
  title: string;
  workspace_id: string;
}

interface RandomizedStudent {
  id: string;
  label: string;
  studentCode: string | null;
}

interface RandomizerResult {
  groups?: RandomizedStudent[][];
  picked?: RandomizedStudent[];
  seed: string;
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
  { classroom_id: 'demo-classroom', first_name: 'อภิชญา', id: 'demo-student-4', last_name: 'ตั้งใจ', nickname: 'ออม', student_code: '004' },
  { classroom_id: 'demo-classroom', first_name: 'ธนกร', id: 'demo-student-5', last_name: 'มั่นคง', nickname: 'ต้น', student_code: '005' },
  { classroom_id: 'demo-classroom', first_name: 'ศิริพร', id: 'demo-student-6', last_name: 'ยิ้มแย้ม', nickname: 'มาย', student_code: '006' },
];

const demoHistory: RandomizerSessionRow[] = [
  {
    classroom_id: 'demo-classroom',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    id: 'demo-randomizer-1',
    mode: 'single',
    result: {
      picked: [{ id: 'demo-student-2', label: 'พิมพ์ชนก แสงทอง (พิม)', studentCode: '002' }],
      seed: 'demo-001',
    },
    title: 'สุ่มตอบคำถาม',
    workspace_id: 'demo-workspace',
  },
];

function getStudentLabel(student: StudentRow) {
  return `${student.first_name} ${student.last_name}${student.nickname ? ` (${student.nickname})` : ''}`;
}

function toRandomizedStudent(student: StudentRow): RandomizedStudent {
  return {
    id: student.id,
    label: getStudentLabel(student),
    studentCode: student.student_code,
  };
}

function randomInt(maxExclusive: number) {
  if (maxExclusive <= 0) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % maxExclusive;
}

function shuffleStudents(students: StudentRow[]) {
  const shuffled = [...students];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function chunkIntoGroups(items: RandomizedStudent[], groupSize: number) {
  const groups: RandomizedStudent[][] = [];
  for (let index = 0; index < items.length; index += groupSize) {
    groups.push(items.slice(index, index + groupSize));
  }
  return groups;
}

function getModeLabel(mode: RandomizerMode) {
  if (mode === 'single') return 'สุ่มรายคน';
  if (mode === 'groups') return 'สุ่มกลุ่ม';
  return 'สุ่มลำดับ';
}

function formatResultText(result: RandomizerResult) {
  if (result.groups) {
    return result.groups
      .map((group, index) => `กลุ่ม ${index + 1}: ${group.map((student) => student.label).join(', ')}`)
      .join('\n');
  }
  return (result.picked || []).map((student, index) => `${index + 1}. ${student.label}`).join('\n');
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getClassroomWithStudents(classrooms: ClassroomRow[], students: StudentRow[], history: RandomizerSessionRow[] = []) {
  const classroomWithStudents = classrooms.find((classroom) =>
    students.some((student) => student.classroom_id === classroom.id),
  );
  const classroomWithHistory = classrooms.find((classroom) =>
    history.some((item) => item.classroom_id === classroom.id),
  );

  return classroomWithStudents?.id || classroomWithHistory?.id || classrooms[0]?.id || '';
}

export function RandomizerPage({ session }: RandomizerPageProps) {
  const demoMode = isDemoSession(session);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [history, setHistory] = useState<RandomizerSessionRow[]>(demoMode ? demoHistory : []);
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [mode, setMode] = useState<RandomizerMode>('single');
  const [pickCount, setPickCount] = useState('1');
  const [groupSize, setGroupSize] = useState('3');
  const [title, setTitle] = useState('สุ่มกิจกรรมในห้องเรียน');
  const [currentResult, setCurrentResult] = useState<RandomizerResult | null>(demoMode ? demoHistory[0]?.result || null : null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSaving, setIsSaving] = useState(false);
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [excludeAbsentToday, setExcludeAbsentToday] = useState(true);
  const [fairMode, setFairMode] = useState(true);
  const [absentStudentIdsToday, setAbsentStudentIdsToday] = useState<Set<string>>(() => new Set());
  const [bonusAwardedIds, setBonusAwardedIds] = useState<Record<string, boolean>>({});
  const [awardingStudentId, setAwardingStudentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration เพื่อบันทึกประวัติการสุ่มจริง',
  );

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

  const activeHistory = useMemo(
    () => history.filter((item) => item.classroom_id === classroomId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [classroomId, history],
  );

  const eligibleStudents = useMemo(() => {
    if (!excludeAbsentToday || absentStudentIdsToday.size === 0) return classroomStudents;
    return classroomStudents.filter((student) => !absentStudentIdsToday.has(student.id));
  }, [absentStudentIdsToday, classroomStudents, excludeAbsentToday]);

  const pickCountByStudent = useMemo(() => {
    const counts = new Map<string, number>();
    activeHistory.forEach((entry) => {
      entry.result?.picked?.forEach((p) => {
        counts.set(p.id, (counts.get(p.id) || 0) + 1);
      });
    });
    return counts;
  }, [activeHistory]);

  const resultText = currentResult ? formatResultText(currentResult) : '';

  useEffect(() => {
    let isMounted = true;

    async function loadRandomizerData() {
      if (!supabase || !session.workspace || demoMode) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setHistory(demoHistory);
        setClassroomId(demoClassrooms[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: historyRows, error: historyError },
      ] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id,name,academic_year')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active')
          .order('name', { ascending: true }),
        supabase
          .from('students')
          .select('id,student_code,first_name,last_name,nickname,classroom_id')
          .eq('workspace_id', session.workspace.id)
          .eq('status', 'active')
          .order('student_code', { ascending: true }),
        supabase
          .from('randomizer_sessions')
          .select('id,workspace_id,classroom_id,title,mode,result,created_at')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false })
          .limit(40),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || historyError) {
        setNotice(classroomError?.message || studentError?.message || historyError?.message || 'โหลดข้อมูลสุ่มห้องเรียนไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const nextHistory = (historyRows || []) as RandomizerSessionRow[];
      const nextClassroomId = getClassroomWithStudents(nextClassrooms, nextStudents, nextHistory);
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setHistory(nextHistory);
      setClassroomId(nextClassroomId);
      setCurrentResult(nextHistory.find((item) => item.classroom_id === nextClassroomId)?.result || null);
      setIsLoading(false);
    }

    void loadRandomizerData();

    return () => {
      isMounted = false;
    };
  }, [demoMode, session.workspace]);

  // Sync today's attendance so absent/sick/leave students can be excluded automatically
  useEffect(() => {
    let active = true;

    async function loadTodayAbsences() {
      if (!supabase || !session.workspace || demoMode || !classroomId) {
        if (active) setAbsentStudentIdsToday(new Set());
        return;
      }

      const today = getBangkokDate();
      const { data: sessionRows } = await supabase
        .from('attendance_sessions')
        .select('id,subject_name')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', classroomId)
        .eq('attendance_date', today);

      const sessions = (sessionRows || []) as Array<{ id: string; subject_name: string | null }>;
      if (!active || sessions.length === 0) {
        if (active) setAbsentStudentIdsToday(new Set());
        return;
      }

      const targetSession = sessions.find((s) => !s.subject_name || s.subject_name === 'โฮมรูม') || sessions[0];
      const { data: recRows } = await supabase
        .from('attendance_records')
        .select('student_id,status')
        .eq('workspace_id', session.workspace.id)
        .eq('session_id', targetSession.id)
        .in('status', ['absent', 'sick', 'leave']);

      if (!active) return;
      const absentSet = new Set<string>();
      ((recRows || []) as Array<{ student_id: string; status: string }>).forEach((r) => {
        absentSet.add(r.student_id);
      });
      setAbsentStudentIdsToday(absentSet);
    }

    void loadTodayAbsences();
    return () => {
      active = false;
    };
  }, [classroomId, demoMode, session.workspace]);

  function createRandomResult() {
    const pool = eligibleStudents;
    const seed = `${Date.now()}-${randomInt(999999)}`;

    if (mode === 'groups') {
      const shuffled = shuffleStudents(pool);
      const size = Math.max(1, Number(groupSize) || 1);
      return {
        groups: chunkIntoGroups(shuffled.map(toRandomizedStudent), size),
        seed,
      };
    }

    if (mode === 'order') {
      const shuffled = shuffleStudents(pool);
      return {
        picked: shuffled.map(toRandomizedStudent),
        seed,
      };
    }

    let orderedPool = shuffleStudents(pool);
    if (fairMode) {
      const buckets = new Map<number, StudentRow[]>();
      pool.forEach((student) => {
        const picks = pickCountByStudent.get(student.id) ?? 0;
        const list = buckets.get(picks) || [];
        list.push(student);
        buckets.set(picks, list);
      });
      orderedPool = Array.from(buckets.keys())
        .sort((a, b) => a - b)
        .flatMap((countKey) => shuffleStudents(buckets.get(countKey) || []));
    }

    const count = Math.max(1, Math.min(Number(pickCount) || 1, orderedPool.length));
    return {
      picked: orderedPool.slice(0, count).map(toRandomizedStudent),
      seed,
    };
  }

  async function handleRandomize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (classroomStudents.length === 0) {
      setNotice('ยังไม่มีนักเรียนในห้องนี้');
      return;
    }

    if (eligibleStudents.length === 0) {
      setNotice('นักเรียนทุกคนถูกตัดออกตามสถานะขาด/ลาวันนี้ ลองปิดตัวเลือก "ตัดคนขาด/ลาวันนี้"');
      return;
    }

    const result = createRandomResult();
    setBonusAwardedIds({});
    setCurrentResult(result);
  }

  async function handleAwardParticipationPoint(student: RandomizedStudent) {
    if (awardingStudentId || bonusAwardedIds[student.id]) return;
    setAwardingStudentId(student.id);
    setNotice(null);

    if (!supabase || !session.workspace || isDemoSession(session)) {
      setBonusAwardedIds((prev) => ({ ...prev, [student.id]: true }));
      setNotice(`มอบ +1 แต้มมีส่วนร่วมให้ ${student.label} แล้ว [โหมดตัวอย่าง]`);
      setAwardingStudentId(null);
      return;
    }

    const { error } = await supabase.from('behavior_records').insert({
      behavior_date: getBangkokDate(),
      category: 'การมีส่วนร่วมในชั้นเรียน',
      description: `สุ่มตอบคำถาม/ร่วมกิจกรรม: ${title.trim() || getModeLabel(mode)}`,
      follow_up_status: 'none',
      points: 1,
      recorded_by: session.profile.id,
      student_id: student.id,
      tone: 'positive',
      workspace_id: session.workspace.id,
    });

    if (error) {
      setNotice(`เพิ่มแต้มมีส่วนร่วมไม่สำเร็จ: ${error.message}`);
      setAwardingStudentId(null);
      return;
    }

    setBonusAwardedIds((prev) => ({ ...prev, [student.id]: true }));
    setNotice(`บันทึก +1 แต้มมีส่วนร่วมลงบอร์ดพฤติกรรมให้ ${student.label} แล้ว`);
    setAwardingStudentId(null);
  }

  async function handleSaveHistory() {
    if (!currentResult) return;

    setIsSaving(true);
    setNotice(null);

    const row: RandomizerSessionRow = {
      classroom_id: classroomId,
      created_at: new Date().toISOString(),
      id: `demo-randomizer-${Date.now()}`,
      mode,
      result: currentResult,
      title: title.trim() || getModeLabel(mode),
      workspace_id: session.workspace?.id || 'demo-workspace',
    };

    if (!supabase || !session.workspace || isDemoSession(session)) {
      setHistory((current) => [row, ...current]);
      setNotice('บันทึกประวัติการสุ่มในโหมดตัวอย่างแล้ว');
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from('randomizer_sessions')
      .insert({
        classroom_id: classroomId,
        created_by: session.profile.id,
        mode,
        result: currentResult,
        title: row.title,
        workspace_id: session.workspace.id,
      })
      .select('id,workspace_id,classroom_id,title,mode,result,created_at')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSaving(false);
      return;
    }

    const savedSession = data as RandomizerSessionRow;
    const participantCount =
      currentResult.groups?.flat().length ?? currentResult.picked?.length ?? 0;
    await writeAuditLog(session, {
      action: 'randomizer_session.created',
      entityId: savedSession.id,
      entityTable: 'randomizer_sessions',
      metadata: {
        classroom_id: savedSession.classroom_id,
        group_count: currentResult.groups?.length ?? null,
        mode: savedSession.mode,
        participant_count: participantCount,
        title: savedSession.title,
      },
      riskLevel: 'low',
      source: 'classroom_randomizer',
    });
    setHistory((current) => [savedSession, ...current]);
    setNotice('บันทึกประวัติการสุ่มแล้ว');
    setIsSaving(false);
  }

  async function copyResult() {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
    setNotice('คัดลอกผลการสุ่มแล้ว');
  }

  function exportResult() {
    if (!resultText) return;
    downloadTextFile(`classcare-randomizer-${new Date().toISOString().slice(0, 10)}.txt`, resultText);
  }

  return (
    <main className="app-page">
      <div className="botanical-banner relative flex flex-col gap-4 overflow-hidden p-5 xl:flex-row xl:items-end xl:justify-between">
        <BotanicalCornerWatermark className="pointer-events-none absolute -bottom-4 right-2 opacity-60" color="#2F7D5B" opacity={0.14} />
        <div className="relative z-10">
          <div className="nexus-kicker">
            <Dice5 size={16} aria-hidden="true" />
            กิจกรรมห้องเรียน · สุ่มรายชื่อและจัดกลุ่ม
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-2xl font-bold leading-tight text-[#1F2A22] sm:text-3xl">
            เครื่องมือสุ่มรายชื่อ แบ่งกลุ่ม และจัดลำดับนำเสนอ
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5B6A5F]">
            ใช้รายชื่อนักเรียนในห้องเพื่อสุ่มกิจกรรมร่วมกัน พร้อมโหมดขึ้นจอห้องเรียนที่ตัวอักษรใหญ่ อ่านง่ายทั้งห้อง
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-2.5 sm:min-w-[440px]">
          {[
            { label: 'นักเรียน', value: classroomStudents.length, topBar: 'bg-[#2F7D5B]' },
            { label: 'ประวัติการสุ่ม', value: activeHistory.length, topBar: 'bg-[#2D72A3]' },
            { label: 'โหมดใช้งาน', value: getModeLabel(mode), topBar: 'bg-[#D98B26]' },
          ].map((item) => (
            <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-white p-3 pt-3.5 text-center shadow-2xs" key={item.label}>
              <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${item.topBar}`} />
              <p className="font-display text-xl font-bold text-[#1F2A22]">{item.value}</p>
              <p className="mt-0.5 text-xs font-bold text-[#5B6A5F]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {isProjectorMode && currentResult ? (
        <section
          aria-label="โหมดขึ้นจอห้องเรียน"
          className="relative mt-5 overflow-hidden rounded-3xl border-2 border-[#2F7D5B] bg-gradient-to-br from-[#F5FBF7] via-white to-[#EDF4EE] p-6 shadow-md sm:p-10"
        >
          <BotanicalCornerWatermark className="pointer-events-none absolute -bottom-4 right-4 opacity-70" color="#2F7D5B" opacity={0.14} />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE3D7] pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFE0CD] bg-[#E6F4EC] px-3 py-1 text-xs font-bold text-[#1C573D]">
                <MonitorPlay size={14} aria-hidden="true" />
                โหมดขึ้นจอห้องเรียน (Projector View)
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold text-[#1F2A22] sm:text-4xl">
                {title || getModeLabel(mode)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2F7D5B] px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#235F45]"
                onClick={() => {
                  if (eligibleStudents.length === 0) {
                    setNotice('นักเรียนทุกคนถูกตัดออกตามสถานะขาด/ลาวันนี้ ลองปิดตัวเลือก "ตัดคนขาด/ลาวันนี้"');
                    return;
                  }
                  setBonusAwardedIds({});
                  setCurrentResult(createRandomResult());
                }}
                type="button"
              >
                <Sparkles size={17} aria-hidden="true" />
                สุ่มใหม่อีกครั้ง
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DCE3D7] bg-white px-4 text-sm font-bold text-[#1F2A22] shadow-2xs transition hover:bg-[#FAFBF8]"
                onClick={() => setIsProjectorMode(false)}
                type="button"
              >
                <Minimize2 size={17} aria-hidden="true" />
                กลับสู่มุมมองปกติ
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-6">
            {currentResult.groups ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {currentResult.groups.map((group, index) => (
                  <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-white p-5 pt-6 shadow-xs" key={`${currentResult.seed}-proj-${index}`}>
                    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#2F7D5B]" />
                    <div className="flex items-center gap-2 font-display text-lg font-bold text-[#1C573D]">
                      <UsersRound size={20} aria-hidden="true" />
                      กลุ่มที่ {index + 1}
                    </div>
                    <ol className="mt-3 grid gap-2">
                      {group.map((student) => (
                        <li className="rounded-xl border border-[#EDF1EA] bg-[#FAFBF8] px-3.5 py-2.5 text-lg font-bold text-[#1F2A22]" key={student.id}>
                          {student.studentCode ? `${student.studentCode} · ` : ''}
                          {student.label}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : null}

            {currentResult.picked ? (
              <ol className="grid gap-4 sm:grid-cols-2">
                {currentResult.picked.map((student, index) => {
                  const awarded = Boolean(bonusAwardedIds[student.id]);
                  return (
                    <li className="flex items-center justify-between gap-3 rounded-2xl border border-[#BFE0CD] bg-white p-5 shadow-xs" key={`${student.id}-proj-${index}`}>
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#2F7D5B] font-display text-2xl font-bold text-white shadow-xs">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-2xl font-bold text-[#1F2A22] sm:text-3xl truncate">{student.label}</p>
                          <p className="mt-1 text-sm font-bold text-[#5B6A5F]">เลขประจำตัว / รหัส {student.studentCode || '-'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={awarded || awardingStudentId === student.id}
                        onClick={() => void handleAwardParticipationPoint(student)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition ${
                          awarded
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 active:scale-95'
                        }`}
                      >
                        {awarded ? <Check size={14} /> : <Award size={14} />}
                        <span>{awarded ? 'ให้แล้ว +1' : '+1 มีส่วนร่วม'}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="app-workbench">
        <aside className="grid gap-4">
          <form className="rounded-2xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-5" onSubmit={(event) => void handleRandomize(event)}>
            <div className="flex items-center gap-2 text-sm font-bold text-[#2F7D5B]">
              <Shuffle size={16} aria-hidden="true" />
              ตั้งค่าการสุ่ม
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#5B6A5F]">ห้องเรียน</span>
                <select className="nexus-field mt-1.5" onChange={(event) => setClassroomId(event.target.value)} value={classroomId}>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#5B6A5F]">ชื่อกิจกรรม</span>
                <input className="nexus-field mt-1.5" onChange={(event) => setTitle(event.target.value)} value={title} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['single', 'groups', 'order'] as RandomizerMode[]).map((item) => (
                  <button
                    className={`h-11 rounded-xl px-2 text-xs font-bold transition ${
                      mode === item ? 'bg-[#1C342B] text-white shadow-xs' : 'border border-[#DCE3D7] bg-[#FAFBF8] text-[#465549] hover:bg-white'
                    }`}
                    key={item}
                    onClick={() => setMode(item)}
                    type="button"
                  >
                    {getModeLabel(item)}
                  </button>
                ))}
              </div>
              {mode === 'single' ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase text-[#5B6A5F]">จำนวนคนที่สุ่ม</span>
                  <input className="nexus-field mt-1.5" min="1" onChange={(event) => setPickCount(event.target.value)} type="number" value={pickCount} />
                </label>
              ) : null}
              {mode === 'groups' ? (
                <label className="block">
                  <span className="text-xs font-bold uppercase text-[#5B6A5F]">จำนวนคนต่อกลุ่ม</span>
                  <input className="nexus-field mt-1.5" min="1" onChange={(event) => setGroupSize(event.target.value)} type="number" value={groupSize} />
                </label>
              ) : null}
              <div className="grid gap-2 rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] p-3 text-xs">
                <div className="flex items-center justify-between font-bold text-[#1C573D]">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCheck size={14} />
                    รายชื่อพร้อมสุ่มวันนี้
                  </span>
                  <span>
                    {eligibleStudents.length} / {classroomStudents.length} คน
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 font-semibold text-[#465549]">
                  <input
                    type="checkbox"
                    checked={excludeAbsentToday}
                    onChange={(e) => setExcludeAbsentToday(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 accent-[#2F7D5B]"
                  />
                  <span>
                    ตัดคนขาด/ลา/ป่วยวันนี้อัตโนมัติ
                    {absentStudentIdsToday.size > 0 ? ` (${absentStudentIdsToday.size} คน)` : ''}
                  </span>
                </label>
                {mode === 'single' && (
                  <label className="flex cursor-pointer items-center gap-2 font-semibold text-[#465549]">
                    <input
                      type="checkbox"
                      checked={fairMode}
                      onChange={(e) => setFairMode(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 accent-[#2F7D5B]"
                    />
                    <span>โหมดสุ่มยุติธรรม (เรียงคนที่ยังไม่ค่อยถูกเรียกก่อน)</span>
                  </label>
                )}
              </div>
            </div>
            <button className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isLoading} type="submit">
              <Sparkles size={17} aria-hidden="true" />
              สุ่มเลย
            </button>
            <button className="dark-action mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!currentResult || isSaving} onClick={() => void handleSaveHistory()} type="button">
              <Save size={17} aria-hidden="true" />
              บันทึกประวัติ
            </button>
          </form>

          <div className="rounded-2xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#2F7D5B]">
              <History size={16} aria-hidden="true" />
              ประวัติล่าสุด
            </div>
            <div className="mt-4 grid gap-2.5">
              {activeHistory.map((item) => (
                <button
                  className="rounded-xl border border-[#DCE3D7] bg-[#FAFBF8] p-3 text-left transition hover:border-[#2F7D5B]/50 hover:bg-white"
                  key={item.id}
                  onClick={() => {
                    setCurrentResult(item.result);
                    setMode(item.mode);
                    setTitle(item.title);
                  }}
                  type="button"
                >
                  <p className="font-bold text-[#1F2A22]">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5B6A5F]">
                    {getModeLabel(item.mode)} | {new Date(item.created_at).toLocaleString('th-TH')}
                  </p>
                </button>
              ))}
              {activeHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DCE3D7] bg-[#FAFBF8] p-4 text-center text-sm font-semibold text-[#5B6A5F]">
                  ยังไม่มีประวัติการสุ่ม
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-6">
            <BotanicalCardSprig className="absolute right-2 top-2" color="#2F7D5B" opacity={0.14} />
            <div className="relative z-10 flex flex-col gap-3 border-b border-[#EDF1EA] pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#2F7D5B]">Random Result</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#1F2A22]">{title || getModeLabel(mode)}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#BFE0CD] bg-[#E6F4EC] px-4 text-xs font-bold text-[#1C573D] transition hover:bg-[#d6ede0] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!currentResult}
                  onClick={() => setIsProjectorMode((prev) => !prev)}
                  type="button"
                >
                  <MonitorPlay size={16} aria-hidden="true" />
                  {isProjectorMode ? 'ซ่อนโหมดขึ้นจอ' : 'โหมดขึ้นจอห้องเรียน'}
                </button>
                <button className="dark-action inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!currentResult} onClick={() => void copyResult()} type="button">
                  <Copy size={16} aria-hidden="true" />
                  คัดลอก
                </button>
                <button className="amber-action inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!currentResult} onClick={exportResult} type="button">
                  <Download size={16} aria-hidden="true" />
                  Export
                </button>
              </div>
            </div>

            <div className="relative z-10 mt-5">
              {currentResult?.groups ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {currentResult.groups.map((group, index) => (
                    <div className="relative overflow-hidden rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-4 pt-5" key={`${currentResult.seed}-${index}`}>
                      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[#2F7D5B]" />
                      <div className="flex items-center gap-2 text-sm font-bold text-[#1C573D]">
                        <UsersRound size={16} aria-hidden="true" />
                        กลุ่ม {index + 1}
                      </div>
                      <ol className="mt-3 grid gap-2">
                        {group.map((student) => (
                          <li className="rounded-xl border border-[#DCE3D7] bg-white px-3 py-2 text-sm font-bold text-[#1F2A22]" key={student.id}>
                            {student.studentCode ? `${student.studentCode} ` : ''}
                            {student.label}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : null}

              {currentResult?.picked ? (
                <ol className="grid gap-3">
                  {currentResult.picked.map((student, index) => {
                    const awarded = Boolean(bonusAwardedIds[student.id]);
                    return (
                      <li className="flex items-center justify-between gap-3 rounded-2xl border border-[#DCE3D7] bg-[#FAFBF8] p-4" key={`${student.id}-${index}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#2F7D5B] font-display text-sm font-bold text-white shadow-2xs">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display font-bold text-[#1F2A22] truncate">{student.label}</p>
                            <p className="text-xs font-semibold text-[#5B6A5F]">รหัส {student.studentCode || '-'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={awarded || awardingStudentId === student.id}
                          onClick={() => void handleAwardParticipationPoint(student)}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            awarded
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 active:scale-95'
                          }`}
                          title="บันทึก +1 แต้มความดี (การมีส่วนร่วม) ลงบอร์ดพฤติกรรมทันที"
                        >
                          {awarded ? <Check size={13} /> : <Award size={13} />}
                          <span>{awarded ? 'ให้แล้ว +1 ✓' : '+1 แต้มมีส่วนร่วม'}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {!currentResult ? (
                <BotanicalEmptyState
                  title="พร้อมสุ่มกิจกรรมในห้องเรียน"
                  description="เลือกโหมดการสุ่มด้านซ้ายแล้วกดปุ่มสุ่มเลย เพื่อจัดกลุ่มหรือสุ่มผู้โชคดี"
                  icon={<Dice5 className="text-[#2F7D5B]" size={22} />}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[#DCE3D7] bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#2F7D5B]">
              <ListRestart size={16} aria-hidden="true" />
              รายชื่อนักเรียนในชุดสุ่ม ({classroomStudents.length} คน)
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {classroomStudents.map((student) => {
                const isAbsent = absentStudentIdsToday.has(student.id);
                return (
                  <div
                    className={`rounded-xl border p-3 ${
                      isAbsent && excludeAbsentToday
                        ? 'border-rose-200 bg-rose-50/50 opacity-65'
                        : 'border-[#DCE3D7] bg-[#FAFBF8]'
                    }`}
                    key={student.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-[#1F2A22] truncate">{getStudentLabel(student)}</p>
                      {isAbsent && (
                        <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          ขาด/ลาวันนี้
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#5B6A5F]">รหัส {student.student_code || '-'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-[#F0D9AE] bg-[#FDF4E1] p-3 text-sm font-bold leading-6 text-[#8B5312] shadow-2xs">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-[#6F8073]">ClassCare 360 · Classroom Randomizer</footer>
    </main>
  );
}
