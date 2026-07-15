import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Dice5,
  Download,
  History,
  ListRestart,
  Save,
  Shuffle,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
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
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [history, setHistory] = useState<RandomizerSessionRow[]>(demoHistory);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [mode, setMode] = useState<RandomizerMode>('single');
  const [pickCount, setPickCount] = useState('1');
  const [groupSize, setGroupSize] = useState('3');
  const [title, setTitle] = useState('สุ่มกิจกรรมในห้องเรียน');
  const [currentResult, setCurrentResult] = useState<RandomizerResult | null>(demoHistory[0].result);
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSaving, setIsSaving] = useState(false);
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

  const resultText = currentResult ? formatResultText(currentResult) : '';

  useEffect(() => {
    let isMounted = true;

    async function loadRandomizerData() {
      if (!supabase || !session.workspace) {
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
  }, [session.workspace]);

  function createRandomResult() {
    const shuffled = shuffleStudents(classroomStudents);
    const seed = `${Date.now()}-${randomInt(999999)}`;

    if (mode === 'groups') {
      const size = Math.max(1, Number(groupSize) || 1);
      return {
        groups: chunkIntoGroups(shuffled.map(toRandomizedStudent), size),
        seed,
      };
    }

    if (mode === 'order') {
      return {
        picked: shuffled.map(toRandomizedStudent),
        seed,
      };
    }

    const count = Math.max(1, Math.min(Number(pickCount) || 1, shuffled.length));
    return {
      picked: shuffled.slice(0, count).map(toRandomizedStudent),
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

    const result = createRandomResult();
    setCurrentResult(result);
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

    if (!supabase || !session.workspace) {
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <Dice5 size={16} aria-hidden="true" />
            Classroom Randomizer
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            เครื่องมือสุ่มรายชื่อ แบ่งกลุ่ม และจัดลำดับนำเสนอ
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            ใช้รายชื่อนักเรียนจาก Student 360 เพื่อสุ่มกิจกรรมในห้องเรียน พร้อมบันทึกประวัติการสุ่มแบบผูก workspace
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[520px]">
          {[
            { label: 'นักเรียน', value: classroomStudents.length },
            { label: 'ประวัติ', value: activeHistory.length },
            { label: 'โหมด', value: getModeLabel(mode) },
          ].map((item) => (
            <div className="nexus-card p-3 text-center" key={item.label}>
              <p className="text-xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="app-workbench">
        <aside className="grid gap-4">
          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void handleRandomize(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Shuffle size={16} aria-hidden="true" />
              ตั้งค่าการสุ่ม
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ห้องเรียน</span>
                <select className="nexus-field mt-2" onChange={(event) => setClassroomId(event.target.value)} value={classroomId}>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ชื่อกิจกรรม</span>
                <input className="nexus-field mt-2" onChange={(event) => setTitle(event.target.value)} value={title} />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['single', 'groups', 'order'] as RandomizerMode[]).map((item) => (
                  <button
                    className={`h-11 rounded-2xl px-2 text-xs font-black transition ${
                      mode === item ? 'bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]' : 'bg-white text-slate-600 ring-1 ring-slate-200'
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
                  <span className="text-xs font-black uppercase text-slate-500">จำนวนคนที่สุ่ม</span>
                  <input className="nexus-field mt-2" min="1" onChange={(event) => setPickCount(event.target.value)} type="number" value={pickCount} />
                </label>
              ) : null}
              {mode === 'groups' ? (
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">จำนวนคนต่อกลุ่ม</span>
                  <input className="nexus-field mt-2" min="1" onChange={(event) => setGroupSize(event.target.value)} type="number" value={groupSize} />
                </label>
              ) : null}
            </div>
            <button className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isLoading} type="submit">
              <Sparkles size={17} aria-hidden="true" />
              สุ่มเลย
            </button>
            <button className="dark-action mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!currentResult || isSaving} onClick={() => void handleSaveHistory()} type="button">
              <Save size={17} aria-hidden="true" />
              บันทึกประวัติ
            </button>
          </form>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-teal-700">
              <History size={16} aria-hidden="true" />
              ประวัติล่าสุด
            </div>
            <div className="mt-4 grid gap-3">
              {activeHistory.map((item) => (
                <button
                  className="nexus-muted-box p-3 text-left transition hover:bg-white"
                  key={item.id}
                  onClick={() => {
                    setCurrentResult(item.result);
                    setMode(item.mode);
                    setTitle(item.title);
                  }}
                  type="button"
                >
                  <p className="font-black text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {getModeLabel(item.mode)} | {new Date(item.created_at).toLocaleString('th-TH')}
                  </p>
                </button>
              ))}
              {activeHistory.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">ยังไม่มีประวัติการสุ่ม</div>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">Random Result</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{title || getModeLabel(mode)}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!currentResult} onClick={() => void copyResult()} type="button">
                  <Copy size={17} aria-hidden="true" />
                  คัดลอก
                </button>
                <button className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!currentResult} onClick={exportResult} type="button">
                  <Download size={17} aria-hidden="true" />
                  Export
                </button>
              </div>
            </div>

            <div className="mt-5">
              {currentResult?.groups ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {currentResult.groups.map((group, index) => (
                    <div className="rounded-3xl border border-slate-100 bg-white/75 p-4" key={`${currentResult.seed}-${index}`}>
                      <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
                        <UsersRound size={16} aria-hidden="true" />
                        กลุ่ม {index + 1}
                      </div>
                      <ol className="mt-3 grid gap-2">
                        {group.map((student) => (
                          <li className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700" key={student.id}>
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
                  {currentResult.picked.map((student, index) => (
                    <li className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white/75 p-4" key={`${student.id}-${index}`}>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">{student.label}</p>
                        <p className="text-xs font-bold text-slate-500">รหัส {student.studentCode || '-'}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}

              {!currentResult ? (
                <div className="nexus-muted-box p-5 text-center text-sm font-bold text-slate-600">
                  กดสุ่มเพื่อเริ่มกิจกรรมในห้องเรียน
                </div>
              ) : null}
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <ListRestart size={16} aria-hidden="true" />
              รายชื่อนักเรียนในชุดสุ่ม
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {classroomStudents.map((student) => (
                <div className="nexus-muted-box p-3" key={student.id}>
                  <p className="font-black text-slate-950">{getStudentLabel(student)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">รหัส {student.student_code || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>

      {notice ? (
        <div className="mt-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-sm font-bold leading-6 text-amber-800 shadow-sm">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
          <p>{notice}</p>
        </div>
      ) : null}

      <footer className="mt-6 text-center text-xs font-bold text-slate-500">Created by MIKPURINUT</footer>
    </main>
  );
}
