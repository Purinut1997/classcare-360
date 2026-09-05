import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  HeartPulse,
  Ruler,
  Save,
  Scale,
  ShieldCheck,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';

import { useSystemFeedback } from '../../components/system/SystemFeedback';
import { writeAuditLog } from '../../lib/auditLog';
import { isDemoSession } from '../../lib/auth';
import { getBangkokDate } from '../../lib/date';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { getTeacherClassroomScope, getClassroomScopeBadge } from '../../lib/teacherClassrooms';
import type { AppSessionContext } from '../../types/core';

interface StudentHealthPageProps {
  session: AppSessionContext;
}

interface ClassroomRow {
  academic_year: string | null;
  homeroom_teacher_profile_id?: string | null;
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

type HealthMode = 'toothbrushing' | 'milk' | 'lunch' | 'growth' | 'hygiene';
type RoutineMode = Extract<HealthMode, 'toothbrushing' | 'milk' | 'lunch'>;
type RoutineStatus = 'completed' | 'missed' | 'exempt';
type InspectionStatus = 'pass' | 'attention' | 'not_checked';

interface HealthRecordRow {
  bmi: number | null;
  height_cm: number | null;
  inspection_results: Record<string, InspectionStatus> | null;
  record_type: HealthMode;
  status: string;
  student_id: string;
  weight_kg: number | null;
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/1' }];
const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ก้องภพ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'ก้อง', student_code: 'TEST-01' },
  { classroom_id: 'demo-classroom', first_name: 'ณัฐธิดา', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'นัท', student_code: 'TEST-02' },
  { classroom_id: 'demo-classroom', first_name: 'ปกรณ์', id: 'demo-student-3', last_name: 'เรียนดี', nickname: 'ปอ', student_code: 'TEST-03' },
];

const routineModes: RoutineMode[] = ['toothbrushing', 'milk', 'lunch'];
const inspectionKeys = ['nails', 'hair', 'ears', 'nose', 'teeth', 'skin', 'clothes'] as const;
type InspectionKey = (typeof inspectionKeys)[number];

const inspectionLabels: Record<InspectionKey, string> = {
  nails: 'เล็บ',
  hair: 'ผม',
  ears: 'หู',
  nose: 'จมูก',
  teeth: 'ฟัน',
  skin: 'ผิวหนัง',
  clothes: 'เสื้อผ้า',
};

const modeOptions: Array<{ body: string; icon: typeof HeartPulse; label: string; value: HealthMode }> = [
  { body: 'ติ๊กหลังอาหารกลางวัน', icon: Sparkles, label: 'แปรงฟัน', value: 'toothbrushing' },
  { body: 'บันทึกการดื่มนมรายวัน', icon: ShieldCheck, label: 'ดื่มนม', value: 'milk' },
  { body: 'ติดตามอาหารกลางวัน', icon: Utensils, label: 'อาหารกลางวัน', value: 'lunch' },
  { body: 'น้ำหนัก ส่วนสูง และ BMI', icon: Scale, label: 'น้ำหนัก–ส่วนสูง', value: 'growth' },
  { body: 'ตรวจสุขอนามัย 7 ด้าน', icon: ClipboardCheck, label: 'ตรวจสุขภาพ', value: 'hygiene' },
];

const routineLabels: Record<RoutineStatus, string> = {
  completed: 'เรียบร้อย',
  missed: 'ไม่ได้ทำ',
  exempt: 'ยกเว้น',
};

function createRoutineState(students: StudentRow[], status: RoutineStatus = 'completed') {
  return Object.fromEntries(students.map((student) => [student.id, status])) as Record<string, RoutineStatus>;
}

function createInspectionState(students: StudentRow[], status: InspectionStatus = 'not_checked') {
  return Object.fromEntries(
    students.map((student) => [
      student.id,
      Object.fromEntries(inspectionKeys.map((key) => [key, status])) as Record<InspectionKey, InspectionStatus>,
    ]),
  );
}

function getClassroomWithStudents(classrooms: ClassroomRow[], students: StudentRow[]) {
  return classrooms.find((classroom) => students.some((student) => student.classroom_id === classroom.id))?.id || classrooms[0]?.id || '';
}

function calculateBmi(weight: string, height: string) {
  const weightNumber = Number(weight);
  const heightNumber = Number(height);
  if (!weightNumber || !heightNumber) return null;
  return weightNumber / ((heightNumber / 100) ** 2);
}

export function StudentHealthPage({ session }: StudentHealthPageProps) {
  const demoMode = isDemoSession(session);
  const feedback = useSystemFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMode = searchParams.get('healthMode');
  const requestedClassroomId = searchParams.get('classroomId');
  const initialMode = modeOptions.some((option) => option.value === requestedMode) ? requestedMode as HealthMode : 'toothbrushing';
  const [mode, setMode] = useState<HealthMode>(initialMode);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [recordDate, setRecordDate] = useState(getBangkokDate());
  const [routineMarks, setRoutineMarks] = useState<Record<RoutineMode, Record<string, RoutineStatus>>>(() => ({
    toothbrushing: createRoutineState(demoStudents),
    milk: createRoutineState(demoStudents),
    lunch: createRoutineState(demoStudents),
  }));
  const [growthValues, setGrowthValues] = useState<Record<string, { height: string; weight: string }>>({});
  const [inspectionValues, setInspectionValues] = useState<Record<string, Record<InspectionKey, InspectionStatus>>>(() => createInspectionState(demoStudents));
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า Supabase เพื่อบันทึกข้อมูลจริง');

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

  const activeRoutineMarks = routineModes.includes(mode as RoutineMode)
    ? routineMarks[mode as RoutineMode]
    : routineMarks.toothbrushing;

  const completedCount = useMemo(() => {
    if (routineModes.includes(mode as RoutineMode)) {
      return classroomStudents.filter((student) => activeRoutineMarks[student.id] === 'completed').length;
    }
    if (mode === 'growth') {
      return classroomStudents.filter((student) => calculateBmi(growthValues[student.id]?.weight || '', growthValues[student.id]?.height || '') !== null).length;
    }
    return classroomStudents.filter((student) =>
      inspectionKeys.every((key) => inspectionValues[student.id]?.[key] !== 'not_checked'),
    ).length;
  }, [activeRoutineMarks, classroomStudents, growthValues, inspectionValues, mode]);

  const attentionCount = useMemo(() => {
    if (routineModes.includes(mode as RoutineMode)) {
      return classroomStudents.filter((student) => activeRoutineMarks[student.id] === 'missed').length;
    }
    if (mode === 'hygiene') {
      return classroomStudents.filter((student) => inspectionKeys.some((key) => inspectionValues[student.id]?.[key] === 'attention')).length;
    }
    return 0;
  }, [activeRoutineMarks, classroomStudents, inspectionValues, mode]);

  const [scopeFilter, setScopeFilter] = useState<'homeroom' | 'all'>('homeroom');

  const teacherScope = useMemo(
    () => getTeacherClassroomScope(session, classrooms),
    [classrooms, session],
  );

  const displayClassrooms = useMemo(() => {
    if (scopeFilter === 'homeroom' && teacherScope.homeroomClassrooms.length > 0) {
      return teacherScope.homeroomClassrooms;
    }
    return teacherScope.allClassrooms;
  }, [scopeFilter, teacherScope]);

  useEffect(() => {
    let mounted = true;
    async function loadBaseData() {
      if (!supabase || !session.workspace || demoMode) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const [{ data: classroomRows, error: classroomError }, { data: studentRows, error: studentError }] = await Promise.all([
        supabase.from('classrooms').select('id,name,academic_year,homeroom_teacher_profile_id').eq('workspace_id', session.workspace.id).eq('status', 'active').order('name'),
        supabase.from('students').select('id,student_code,first_name,last_name,nickname,classroom_id').eq('workspace_id', session.workspace.id).eq('status', 'active').order('student_code'),
      ]);
      if (!mounted) return;
      if (classroomError || studentError) {
        setNotice(classroomError?.message || studentError?.message || 'โหลดรายชื่อนักเรียนไม่สำเร็จ');
        setIsLoading(false);
        return;
      }
      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const nextScope = getTeacherClassroomScope(session, nextClassrooms);
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      const linkedClassroomId = requestedClassroomId && nextClassrooms.some((classroom) => classroom.id === requestedClassroomId)
        ? requestedClassroomId
        : nextScope.defaultClassroomId || getClassroomWithStudents(nextClassrooms, nextStudents);
      setClassroomId(linkedClassroomId);
      setIsLoading(false);
    }
    void loadBaseData();
    return () => { mounted = false; };
  }, [demoMode, requestedClassroomId, session.workspace]);

  useEffect(() => {
    const defaultRoutine = createRoutineState(classroomStudents);
    setRoutineMarks({ toothbrushing: defaultRoutine, milk: { ...defaultRoutine }, lunch: { ...defaultRoutine } });
    setGrowthValues({});
    setInspectionValues(createInspectionState(classroomStudents));

    let mounted = true;
    async function loadRecords() {
      if (!supabase || !session.workspace || !classroomId || demoMode) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from('student_health_records')
        .select('student_id,record_type,status,weight_kg,height_cm,bmi,inspection_results')
        .eq('workspace_id', session.workspace.id)
        .eq('classroom_id', classroomId)
        .eq('record_date', recordDate);
      if (!mounted) return;
      if (error) {
        setNotice(error.message.includes('student_health_records') ? 'ฐานข้อมูลยังไม่มีตารางสุขภาพ กรุณารัน migration 0038 ก่อน' : error.message);
        setIsLoading(false);
        return;
      }
      const nextRoutine: Record<RoutineMode, Record<string, RoutineStatus>> = {
        toothbrushing: createRoutineState(classroomStudents),
        milk: createRoutineState(classroomStudents),
        lunch: createRoutineState(classroomStudents),
      };
      const nextGrowth: Record<string, { height: string; weight: string }> = {};
      const nextInspection = createInspectionState(classroomStudents);
      for (const record of (data || []) as HealthRecordRow[]) {
        if (routineModes.includes(record.record_type as RoutineMode)) {
          nextRoutine[record.record_type as RoutineMode][record.student_id] = record.status as RoutineStatus;
        } else if (record.record_type === 'growth') {
          nextGrowth[record.student_id] = { height: String(record.height_cm || ''), weight: String(record.weight_kg || '') };
        } else if (record.record_type === 'hygiene' && record.inspection_results) {
          nextInspection[record.student_id] = { ...nextInspection[record.student_id], ...record.inspection_results };
        }
      }
      setRoutineMarks(nextRoutine);
      setGrowthValues(nextGrowth);
      setInspectionValues(nextInspection);
      setNotice(null);
      setIsLoading(false);
    }
    void loadRecords();
    return () => { mounted = false; };
  }, [classroomId, classroomStudents, demoMode, recordDate, session.workspace]);

  function markAllRoutine(status: RoutineStatus) {
    if (!routineModes.includes(mode as RoutineMode)) return;
    setRoutineMarks((current) => ({ ...current, [mode]: createRoutineState(classroomStudents, status) }));
  }

  function selectMode(nextMode: HealthMode) {
    setMode(nextMode);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('healthMode', nextMode);
    if (classroomId) nextParams.set('classroomId', classroomId);
    setSearchParams(nextParams, { replace: true });
  }

  function markAllInspection(status: InspectionStatus) {
    setInspectionValues(createInspectionState(classroomStudents, status));
  }

  async function saveRecords() {
    if (!classroomId || !classroomStudents.length) {
      feedback.warning({ title: 'ยังบันทึกไม่ได้', message: 'ห้องเรียนนี้ยังไม่มีนักเรียน' });
      return;
    }

    let rows: Array<Record<string, unknown>> = [];
    const workspaceId = session.workspace?.id || 'demo-workspace';
    if (routineModes.includes(mode as RoutineMode)) {
      rows = classroomStudents.map((student) => ({
        classroom_id: classroomId,
        inspection_results: {},
        record_date: recordDate,
        record_type: mode,
        recorded_by: session.profile.id,
        status: routineMarks[mode as RoutineMode][student.id] || 'completed',
        student_id: student.id,
        workspace_id: workspaceId,
      }));
    } else if (mode === 'growth') {
      rows = classroomStudents.flatMap((student) => {
        const values = growthValues[student.id];
        const bmi = calculateBmi(values?.weight || '', values?.height || '');
        if (bmi === null) return [];
        return [{
          classroom_id: classroomId,
          height_cm: Number(values.height),
          inspection_results: {},
          record_date: recordDate,
          record_type: mode,
          recorded_by: session.profile.id,
          status: 'recorded',
          student_id: student.id,
          weight_kg: Number(values.weight),
          workspace_id: workspaceId,
        }];
      });
      if (!rows.length) {
        feedback.warning({ title: 'ยังไม่มีค่าที่บันทึกได้', message: 'กรอกน้ำหนักและส่วนสูงอย่างน้อย 1 คน' });
        return;
      }
    } else {
      rows = classroomStudents.map((student) => {
        const values = inspectionValues[student.id] || createInspectionState([student])[student.id];
        const statuses = Object.values(values);
        return {
          classroom_id: classroomId,
          inspection_results: values,
          record_date: recordDate,
          record_type: mode,
          recorded_by: session.profile.id,
          status: statuses.includes('attention') ? 'attention' : statuses.includes('not_checked') ? 'not_checked' : 'normal',
          student_id: student.id,
          workspace_id: workspaceId,
        };
      });
    }

    if (!supabase || !session.workspace || isDemoSession(session)) {
      setNotice(`บันทึกตัวอย่าง ${rows.length} รายการแล้ว ข้อมูลจะไม่ถูกส่งออกจากเครื่อง`);
      feedback.success({ title: 'บันทึกโหมดตัวอย่างแล้ว', message: `${rows.length} รายการ` });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('student_health_records').upsert(rows, {
      onConflict: 'workspace_id,student_id,record_date,record_type',
    });
    setIsSaving(false);
    if (error) {
      feedback.error({ title: 'บันทึกไม่สำเร็จ', message: error.message });
      return;
    }

    await writeAuditLog(session, {
      action: 'student_health.bulk_saved',
      entityId: classroomId,
      entityTable: 'student_health_records',
      metadata: { count: rows.length, recordDate, recordType: mode },
      source: 'student-health',
    });
    setNotice(null);
    feedback.success({ title: 'บันทึกเรียบร้อย', message: `${rows.length} รายการ • ${recordDate}` });
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker"><HeartPulse size={16} aria-hidden="true" /> Student Health & Daily Care</div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">สุขภาพและกิจวัตรนักเรียน ครบทั้งห้องในหน้าเดียว</h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">อ้างอิงจากแบบบันทึกน้ำหนัก–ส่วนสูง, BMI, การแปรงฟัน, ดื่มนม, ตรวจสุขภาพ และอาหารกลางวัน พร้อมผูกข้อมูลกับนักเรียนจริง</p>
        </div>
        <div className="grid min-w-[280px] grid-cols-3 gap-2">
          {[
            { label: 'นักเรียน', value: classroomStudents.length },
            { label: 'ครบแล้ว', value: completedCount },
            { label: 'ติดตาม', value: attentionCount },
          ].map((item) => <div className="nexus-card p-3 text-center" key={item.label}><p className="text-2xl font-black text-slate-950">{item.value}</p><p className="mt-1 text-xs font-black text-slate-500">{item.label}</p></div>)}
        </div>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {modeOptions.map((option) => {
          const Icon = option.icon;
          const active = mode === option.value;
          return <button className={`nexus-card p-4 text-left transition ${active ? 'ring-2 ring-cyan-400' : 'hover:-translate-y-0.5'}`} key={option.value} onClick={() => selectMode(option.value)} type="button"><span className={`grid h-10 w-10 place-items-center rounded-2xl ${active ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-700'}`}><Icon size={19} /></span><strong className="mt-3 block text-sm font-black text-slate-950">{option.label}</strong><span className="mt-1 block text-xs font-bold text-slate-500">{option.body}</span></button>;
        })}
      </section>

      <section className="mt-5 nexus-card p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-black uppercase text-slate-500">ห้องเรียน</span>
              {teacherScope.hasMultipleScopes ? (
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-black">
                  <button
                    className={`rounded-lg px-2.5 py-0.5 transition ${
                      scopeFilter === 'homeroom'
                        ? 'bg-white text-cyan-900 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    onClick={() => {
                      setScopeFilter('homeroom');
                      if (
                        teacherScope.homeroomClassrooms.length > 0 &&
                        !teacherScope.homeroomClassrooms.some((c) => c.id === classroomId)
                      ) {
                        const targetId = teacherScope.homeroomClassrooms[0].id;
                        setClassroomId(targetId);
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set('classroomId', targetId);
                        setSearchParams(nextParams, { replace: true });
                      }
                    }}
                    type="button"
                  >
                    ⭐ ที่ปรึกษา ({teacherScope.homeroomClassrooms.length})
                  </button>
                  <button
                    className={`rounded-lg px-2.5 py-0.5 transition ${
                      scopeFilter === 'all'
                        ? 'bg-white text-cyan-900 shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    onClick={() => setScopeFilter('all')}
                    type="button"
                  >
                    🌐 ทุกห้อง ({teacherScope.allClassrooms.length})
                  </button>
                </div>
              ) : teacherScope.hasHomeroom ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-200">
                  ⭐ ห้องที่ปรึกษา
                </span>
              ) : null}
            </div>
            <select
              className="nexus-field"
              value={classroomId}
              onChange={(event) => {
                setClassroomId(event.target.value);
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('classroomId', event.target.value);
                setSearchParams(nextParams, { replace: true });
              }}
            >
              {displayClassrooms.map((classroom) => {
                const badge = getClassroomScopeBadge(classroom, session.profile.id);
                return (
                  <option key={classroom.id} value={classroom.id}>
                    {badge.prefix}{classroom.name} {classroom.academic_year ? `(${classroom.academic_year})` : ''} — {badge.label}
                  </option>
                );
              })}
            </select>
          </div>
          <label><span className="text-xs font-black uppercase text-slate-500">วันที่บันทึก</span><ThaiDatePicker className="mt-2" value={recordDate} onValueChange={setRecordDate} /></label>
          <button className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isLoading || isSaving} onClick={() => void saveRecords()} type="button"><Save size={17} />{isSaving ? 'กำลังบันทึก...' : 'บันทึกทั้งห้อง'}</button>
        </div>
      </section>

      <section className="mt-5 nexus-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><p className="text-sm font-black text-cyan-700">{modeOptions.find((item) => item.value === mode)?.label}</p><h2 className="mt-1 text-2xl font-black text-slate-950">รายชื่อนักเรียน {classroomStudents.length} คน</h2></div>
          {routineModes.includes(mode as RoutineMode) ? <div className="flex flex-wrap gap-2">{(['completed', 'missed', 'exempt'] as RoutineStatus[]).map((status) => <button className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" key={status} onClick={() => markAllRoutine(status)} type="button">ทั้งห้อง: {routineLabels[status]}</button>)}</div> : null}
          {mode === 'hygiene' ? <div className="flex gap-2"><button className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100" onClick={() => markAllInspection('pass')} type="button">ผ่านทั้งหมด</button><button className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200" onClick={() => markAllInspection('not_checked')} type="button">ล้างค่า</button></div> : null}
        </div>

        <div className="divide-y divide-slate-100">
          {classroomStudents.map((student, index) => {
            const bmi = calculateBmi(growthValues[student.id]?.weight || '', growthValues[student.id]?.height || '');
            return <div className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] lg:items-center sm:p-5" key={student.id}>
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600">{index + 1}</span><div className="min-w-0"><p className="truncate font-black text-slate-950">{student.first_name} {student.last_name}</p><p className="text-xs font-bold text-slate-500">{student.student_code || 'ไม่มีรหัส'} • {student.nickname || 'ไม่มีชื่อเล่น'}</p></div></div>

              {routineModes.includes(mode as RoutineMode) ? <div className="grid grid-cols-3 gap-2">{(['completed', 'missed', 'exempt'] as RoutineStatus[]).map((status) => { const active = activeRoutineMarks[student.id] === status; return <button className={`h-10 rounded-xl text-xs font-black transition ${active ? status === 'completed' ? 'bg-emerald-600 text-white' : status === 'missed' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`} key={status} onClick={() => setRoutineMarks((current) => ({ ...current, [mode]: { ...current[mode as RoutineMode], [student.id]: status } }))} type="button">{active ? <Check className="mr-1 inline" size={14} /> : null}{routineLabels[status]}</button>; })}</div> : null}

              {mode === 'growth' ? <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px]"><label className="relative"><Scale className="absolute left-3 top-3 text-slate-400" size={16} /><input className="nexus-field pl-10" min="1" max="300" step="0.1" type="number" placeholder="น้ำหนัก (กก.)" value={growthValues[student.id]?.weight || ''} onChange={(event) => setGrowthValues((current) => ({ ...current, [student.id]: { height: current[student.id]?.height || '', weight: event.target.value } }))} /></label><label className="relative"><Ruler className="absolute left-3 top-3 text-slate-400" size={16} /><input className="nexus-field pl-10" min="30" max="250" step="0.1" type="number" placeholder="ส่วนสูง (ซม.)" value={growthValues[student.id]?.height || ''} onChange={(event) => setGrowthValues((current) => ({ ...current, [student.id]: { height: event.target.value, weight: current[student.id]?.weight || '' } }))} /></label><div className="rounded-2xl bg-cyan-50 px-3 py-2 text-center ring-1 ring-cyan-100"><p className="text-[10px] font-black uppercase text-cyan-600">BMI</p><p className="text-lg font-black text-cyan-950">{bmi === null ? '—' : bmi.toFixed(2)}</p></div></div> : null}

              {mode === 'hygiene' ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{inspectionKeys.map((key) => { const status = inspectionValues[student.id]?.[key] || 'not_checked'; return <button className={`rounded-xl px-2 py-2 text-xs font-black ring-1 transition ${status === 'pass' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : status === 'attention' ? 'bg-rose-50 text-rose-700 ring-rose-100' : 'bg-white text-slate-500 ring-slate-200'}`} key={key} onClick={() => setInspectionValues((current) => ({ ...current, [student.id]: { ...current[student.id], [key]: status === 'not_checked' ? 'pass' : status === 'pass' ? 'attention' : 'not_checked' } }))} type="button">{inspectionLabels[key]}<span className="mt-0.5 block text-[10px]">{status === 'pass' ? 'ผ่าน' : status === 'attention' ? 'ติดตาม' : 'ยังไม่ตรวจ'}</span></button>; })}</div> : null}
            </div>;
          })}
          {!classroomStudents.length ? <div className="p-8 text-center text-sm font-bold text-slate-500">ห้องนี้ยังไม่มีนักเรียน กรุณาเพิ่มหรือนำเข้ารายชื่อก่อน</div> : null}
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4 text-sm font-bold leading-7 text-cyan-900"><strong>หมายเหตุเรื่อง BMI เด็ก:</strong> ระบบคำนวณค่าดัชนีมวลกายจากน้ำหนักและส่วนสูงเพื่อบันทึกแนวโน้มเท่านั้น การแปลผลภาวะโภชนาการเด็กควรใช้เกณฑ์อายุและเพศจากหน่วยงานสาธารณสุข</div>
      {notice ? <div className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={17} /><p>{notice}</p></div> : null}
      <footer className="mt-6 text-center text-xs font-bold text-slate-500">Created by MIKPURINUT</footer>
    </main>
  );
}
