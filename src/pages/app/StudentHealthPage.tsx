import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardCheck,
  HeartPulse,
  Ruler,
  Save,
  Scale,
  ShieldCheck,
  Sparkles,
  Utensils,
  X,
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

const NOTE_ROTATIONS = [
  'rotate-[1.5deg]',
  '-rotate-[2deg]',
  'rotate-[2deg]',
  '-rotate-[1.5deg]',
  'rotate-[1deg]',
  '-rotate-[2.5deg]',
  'rotate-[2.5deg]',
  '-rotate-[1deg]',
];

const routineTone: Record<RoutineStatus, { bg: string; text: string; shadow: string; label: string }> = {
  completed: {
    bg: 'bg-[#d9f99d]',
    text: 'text-[#1b3e04]',
    shadow: 'shadow-[2px_5px_8px_rgba(27,62,4,0.22)]',
    label: 'เรียบร้อย ✓',
  },
  missed: {
    bg: 'bg-[#fecdd3]',
    text: 'text-[#881337]',
    shadow: 'shadow-[2px_5px_8px_rgba(136,19,55,0.22)]',
    label: 'ไม่ได้ทำ ✕',
  },
  exempt: {
    bg: 'bg-[#fde68a]',
    text: 'text-[#78350f]',
    shadow: 'shadow-[2px_5px_8px_rgba(120,53,15,0.22)]',
    label: 'ยกเว้น',
  },
};

const ROUTINE_CYCLE: RoutineStatus[] = ['completed', 'missed', 'exempt'];

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
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [recordDate, setRecordDate] = useState(getBangkokDate());
  const [routineMarks, setRoutineMarks] = useState<Record<RoutineMode, Record<string, RoutineStatus>>>(() => ({
    toothbrushing: createRoutineState(demoMode ? demoStudents : []),
    milk: createRoutineState(demoMode ? demoStudents : []),
    lunch: createRoutineState(demoMode ? demoStudents : []),
  }));
  const [growthValues, setGrowthValues] = useState<Record<string, { height: string; weight: string }>>({});
  const [inspectionValues, setInspectionValues] = useState<Record<string, Record<InspectionKey, InspectionStatus>>>(() => createInspectionState(demoMode ? demoStudents : []));
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
    <main className="app-page min-h-screen pb-64 lg:pb-32 font-['Itim',sans-serif]">
      {/* ======================================================== */}
      {/* CORKBOARD / LINED PAPER CONTAINER (Post-it Theme)         */}
      {/* ======================================================== */}
      <div className="rounded-[32px] border-2 border-[#e6dcce] bg-[#f5efe6] [background-image:repeating-linear-gradient(0deg,transparent_0_27px,#e8dfd2_27px_28px)] p-4 sm:p-7 shadow-md">

        {/* Top Header */}
        <header className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-1.5">
              <span>สุขภาพและกิจวัตรนักเรียน</span>
              <span className="text-xl sm:text-2xl">📌</span>
            </h1>
            <p className="mt-0.5 text-sm sm:text-base font-semibold text-[#44403c]">
              บันทึกกิจกรรมประจำวัน น้ำหนัก ส่วนสูง BMI และตรวจสุขภาพ 7 ด้าน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Classroom Selector with cute tilt */}
            <div className="relative inline-flex items-center rotate-[1.5deg] shadow-xs">
              <select
                value={classroomId}
                onChange={(event) => {
                  setClassroomId(event.target.value);
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('classroomId', event.target.value);
                  setSearchParams(nextParams, { replace: true });
                }}
                className="appearance-none rounded-xl border border-[#c7bca9] bg-white py-1.5 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-[#1c1917] shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {displayClassrooms.map((c) => {
                  const badge = getClassroomScopeBadge(c, session.profile.id);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.academic_year ? `(${c.academic_year})` : ''} — {badge.label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#57534e]" />
            </div>

            {/* Date Picker */}
            <div className="relative inline-flex items-center rotate-[-1deg] shadow-xs">
              <ThaiDatePicker
                className="h-8.5 rounded-xl border border-[#c7bca9] bg-white px-2.5 text-xs font-bold text-[#1c1917]"
                value={recordDate}
                onValueChange={setRecordDate}
              />
            </div>
          </div>
        </header>

        {/* Notice alert if any */}
        {notice && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-950 font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-amber-800 hover:text-amber-950">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Mode Selector Tabs (Styled as cute sticky tabs) */}
        <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-[#e2d5c3]">
          {modeOptions.map((option, idx) => {
            const active = mode === option.value;
            const tabRotations = ['rotate-[1deg]', '-rotate-[1deg]', 'rotate-[0.5deg]', '-rotate-[1.5deg]', 'rotate-[1deg]'];
            const rot = tabRotations[idx % tabRotations.length];
            return (
              <button
                key={option.value}
                onClick={() => selectMode(option.value)}
                type="button"
                className={`relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${rot} ${
                  active
                    ? 'bg-[#3f3a36] text-white shadow-[2px_3px_0_#f59e0b] -translate-y-0.5'
                    : 'bg-white text-[#292524] border border-[#c7bca9] hover:bg-stone-50 shadow-2xs'
                }`}
              >
                <span>{option.value === 'toothbrushing' ? '🪥' : option.value === 'milk' ? '🥛' : option.value === 'lunch' ? '🍱' : option.value === 'growth' ? '⚖️' : '🧼'}</span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick actions for current mode */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm sm:text-base font-semibold text-[#292524]">
            {routineModes.includes(mode as RoutineMode)
              ? 'แตะโน้ตเพื่อสลับสถานะ: เรียบร้อย ➔ ไม่ได้ทำ ➔ ยกเว้น'
              : mode === 'growth'
              ? 'กรอกน้ำหนักและส่วนสูง ระบบจะคำนวณ BMI อัตโนมัติ'
              : 'แตะที่แต่ละด้านเพื่อตรวจ: ผ่าน ➔ ติดตาม ➔ ยังไม่ตรวจ'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {routineModes.includes(mode as RoutineMode) && (
              <>
                <button
                  type="button"
                  onClick={() => markAllRoutine('completed')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-lime-400 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-[#1b3e04] hover:bg-lime-50 active:scale-95 transition shadow-2xs"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>เรียบร้อยทุกคน</span>
                </button>
                <button
                  type="button"
                  onClick={() => markAllRoutine('missed')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-[#881337] hover:bg-rose-50 active:scale-95 transition shadow-2xs"
                >
                  <X size={14} />
                  <span>ล้างเป็นไม่ได้ทำ</span>
                </button>
              </>
            )}
            {mode === 'hygiene' && (
              <>
                <button
                  type="button"
                  onClick={() => markAllInspection('pass')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-lime-400 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-[#1b3e04] hover:bg-lime-50 active:scale-95 transition shadow-2xs"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>ผ่านหมดทุกคน</span>
                </button>
                <button
                  type="button"
                  onClick={() => markAllInspection('not_checked')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#c7bca9] bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-[#44403c] hover:bg-stone-50 active:scale-95 transition shadow-2xs"
                >
                  <span>ล้างค่า</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* STUDENT CONTENT (Post-it Grid or Cards)                   */}
        {/* ======================================================== */}
        <section className="mt-5">
          {/* Routine Mode: Post-it Grid (แปรงฟัน, ดื่มนม, อาหารกลางวัน) */}
          {routineModes.includes(mode as RoutineMode) && (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4.5 pt-2">
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const status = activeRoutineMarks[student.id] || 'completed';
                const tone = routineTone[status] || routineTone.completed;
                const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];
                const displayName = status === 'completed'
                  ? (student.nickname || student.first_name)
                  : routineLabels[status];

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      const nextStatus = ROUTINE_CYCLE[(ROUTINE_CYCLE.indexOf(status) + 1) % ROUTINE_CYCLE.length];
                      setRoutineMarks((current) => ({
                        ...current,
                        [mode]: { ...current[mode as RoutineMode], [student.id]: nextStatus },
                      }));
                    }}
                    className={`relative flex flex-col items-center justify-center rounded-xs sm:rounded-sm p-2 sm:p-2.5 min-h-[68px] sm:min-h-[76px] transition-all select-none active:scale-95 cursor-pointer ${tone.bg} ${tone.shadow} ${rotation} hover:scale-105 hover:z-10`}
                    title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (${routineLabels[status]}) — แตะเพื่อสลับสถานะ`}
                  >
                    {/* Frosted Tape on top */}
                    <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-7 rounded-[1px] bg-white/70 shadow-2xs backdrop-blur-2xs" />

                    {/* Roll Number */}
                    <span className={`text-2xl sm:text-3xl font-bold leading-none tracking-tight ${tone.text}`}>
                      {rollNumber}
                    </span>

                    {/* Name / Status */}
                    <span className={`text-sm sm:text-base font-bold truncate mt-1 max-w-full text-center px-0.5 ${tone.text}`}>
                      {displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Growth Mode (น้ำหนัก ส่วนสูง BMI) */}
          {mode === 'growth' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const bmi = calculateBmi(growthValues[student.id]?.weight || '', growthValues[student.id]?.height || '');
                const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];
                return (
                  <div
                    key={student.id}
                    className={`relative rounded-2xl border border-[#c7bca9] bg-white/95 p-3.5 shadow-sm transition-all ${rotation} hover:scale-[1.01]`}
                  >
                    {/* Top tape */}
                    <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-8 rounded-[1px] bg-white/80 shadow-2xs" />

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-200 text-sm font-bold text-amber-950 shadow-2xs">
                          {rollNumber}
                        </span>
                        <div>
                          <p className="text-base font-bold text-[#1c1917]">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-[#44403c]">
                            {student.nickname ? `น้อง${student.nickname}` : student.student_code || '-'}
                          </p>
                        </div>
                      </div>

                      {/* BMI Badge */}
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs sm:text-sm font-bold shadow-2xs ${
                          bmi === null
                            ? 'bg-stone-100 text-stone-700 border border-stone-300'
                            : bmi < 18.5
                            ? 'bg-sky-100 text-sky-900 border border-sky-300'
                            : bmi <= 22.9
                            ? 'bg-lime-100 text-lime-900 border border-lime-300'
                            : 'bg-amber-100 text-amber-950 border border-amber-300'
                        }`}>
                          <span>BMI:</span>
                          <b>{bmi === null ? '—' : bmi.toFixed(1)}</b>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-[#1c1917] mb-1">น้ำหนัก (กก.):</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 32.5"
                          value={growthValues[student.id]?.weight || ''}
                          onChange={(e) =>
                            setGrowthValues((current) => ({
                              ...current,
                              [student.id]: { height: current[student.id]?.height || '', weight: e.target.value },
                            }))
                          }
                          className="h-9 w-full rounded-xl border border-[#c7bca9] bg-white px-3 text-sm font-bold text-[#1c1917] placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-[#1c1917] mb-1">ส่วนสูง (ซม.):</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="เช่น 138"
                          value={growthValues[student.id]?.height || ''}
                          onChange={(e) =>
                            setGrowthValues((current) => ({
                              ...current,
                              [student.id]: { height: e.target.value, weight: current[student.id]?.weight || '' },
                            }))
                          }
                          className="h-9 w-full rounded-xl border border-[#c7bca9] bg-white px-3 text-sm font-bold text-[#1c1917] placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Hygiene Mode (ตรวจสุขภาพ 7 ด้าน) */}
          {mode === 'hygiene' && (
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];
                return (
                  <div
                    key={student.id}
                    className={`relative rounded-2xl border border-[#c7bca9] bg-white/95 p-3.5 shadow-sm ${rotation}`}
                  >
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-200 text-sm font-bold text-teal-950 shadow-2xs">
                        {rollNumber}
                      </span>
                      <div>
                        <p className="text-base font-bold text-[#1c1917]">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs sm:text-sm font-semibold text-[#44403c]">
                          {student.nickname ? `น้อง${student.nickname}` : student.student_code || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {inspectionKeys.map((key) => {
                        const status = inspectionValues[student.id]?.[key] || 'not_checked';
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setInspectionValues((current) => ({
                                ...current,
                                [student.id]: {
                                  ...current[student.id],
                                  [key]: status === 'not_checked' ? 'pass' : status === 'pass' ? 'attention' : 'not_checked',
                                },
                              }))
                            }
                            className={`rounded-xl p-2 text-center transition active:scale-95 ${
                              status === 'pass'
                                ? 'bg-[#d9f99d] text-[#1b3e04] ring-2 ring-lime-500 font-bold shadow-xs'
                                : status === 'attention'
                                ? 'bg-[#fecdd3] text-[#881337] ring-2 ring-rose-500 font-bold shadow-xs'
                                : 'bg-stone-100 text-[#44403c] hover:bg-stone-200/80 border border-stone-300 font-bold'
                            }`}
                          >
                            <span className="block text-xs sm:text-sm font-bold leading-tight">{inspectionLabels[key]}</span>
                            <span className="block text-xs font-bold mt-1">
                              {status === 'pass' ? '✓ ผ่าน' : status === 'attention' ? '✕ ตรวจ' : '— รอ'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {classroomStudents.length === 0 && !isLoading && (
            <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-950">
              <p className="text-base font-bold">ห้องนี้ยังไม่มีนักเรียน</p>
              <p className="mt-1 text-xs text-amber-800/80">กรุณาเพิ่มหรือนำเข้ารายชื่อนักเรียนก่อนบันทึกสุขภาพ</p>
            </div>
          )}

          {/* Bottom spacer for mobile scrolling */}
          <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
        </section>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM FOOTER DOCK: Matches Theme (Style 5)               */}
      {/* ======================================================== */}
      {classroomStudents.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-[#c7bca9] bg-[#fbf8f3]/95 p-3.5 shadow-xl backdrop-blur-md">
          {/* Summary Text */}
          <div className="flex items-center justify-center gap-4 text-base sm:text-lg font-bold text-[#1c1917]">
            <span>
              ครบแล้ว <b className="text-[#1b3e04]">{completedCount}</b>
            </span>
            <span>
              ติดตาม/ขาด <b className="text-[#881337]">{attentionCount}</b>
            </span>
            <span>
              ทั้งหมด <b>{classroomStudents.length}</b>
            </span>
          </div>

          {/* Big Charcoal Button */}
          <button
            type="button"
            onClick={() => void saveRecords()}
            disabled={isLoading || isSaving}
            className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3f3a36] hover:bg-[#2c2825] text-white text-base sm:text-lg font-bold shadow-[3px_4px_0_#f59e0b] active:translate-y-0.5 active:shadow-[1px_2px_0_#f59e0b] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <span>บันทึกทั้งห้อง ✓ ({classroomStudents.length} คน)</span>
            )}
          </button>
        </div>
      )}
    </main>
  );
}
