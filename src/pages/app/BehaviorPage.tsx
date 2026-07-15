import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeAlert,
  Download,
  Heart,
  MessageSquarePlus,
  Save,
  Search,
  ShieldCheck,
  SmilePlus,
  Sparkles,
} from 'lucide-react';

import { writeAuditLog } from '../../lib/auditLog';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import type { AppSessionContext } from '../../types/core';

interface BehaviorPageProps {
  session: AppSessionContext;
}

type BehaviorTone = 'positive' | 'concern' | 'support' | 'discipline';
type FollowUpStatus = 'none' | 'watch' | 'contact_guardian' | 'referred' | 'resolved';

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

interface BehaviorRecordRow {
  behavior_date: string;
  category: string;
  created_at: string;
  description: string;
  follow_up_status: FollowUpStatus;
  id: string;
  points: number;
  recorded_by: string | null;
  student_id: string;
  tone: BehaviorTone;
  workspace_id: string;
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  { classroom_id: 'demo-classroom', first_name: 'ณัฐวุฒิ', id: 'demo-student-1', last_name: 'ใจดี', nickname: 'นัท', student_code: '001' },
  { classroom_id: 'demo-classroom', first_name: 'พิมพ์ชนก', id: 'demo-student-2', last_name: 'แสงทอง', nickname: 'พิม', student_code: '002' },
  { classroom_id: 'demo-classroom', first_name: 'กิตติพงศ์', id: 'demo-student-3', last_name: 'สุขใจ', nickname: 'ก้อง', student_code: '003' },
];

const demoBehaviorRecords: BehaviorRecordRow[] = [
  {
    behavior_date: new Date().toISOString().slice(0, 10),
    category: 'ช่วยเหลือเพื่อน',
    created_at: new Date().toISOString(),
    description: 'ช่วยเพื่อนเก็บอุปกรณ์หลังเลิกเรียนโดยครูไม่ต้องเตือน',
    follow_up_status: 'none',
    id: 'demo-behavior-1',
    points: 3,
    recorded_by: 'demo-teacher',
    student_id: 'demo-student-1',
    tone: 'positive',
    workspace_id: 'demo-workspace',
  },
  {
    behavior_date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString().slice(0, 10),
    category: 'งานไม่ครบ',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    description: 'ค้างใบงานภาษาไทย 1 ชิ้น นัดติดตามในคาบโฮมรูม',
    follow_up_status: 'watch',
    id: 'demo-behavior-2',
    points: -2,
    recorded_by: 'demo-teacher',
    student_id: 'demo-student-2',
    tone: 'concern',
    workspace_id: 'demo-workspace',
  },
];

const toneOptions: Array<{ label: string; point: number; value: BehaviorTone }> = [
  { label: 'เชิงบวก', point: 3, value: 'positive' },
  { label: 'ข้อห่วงใย', point: -2, value: 'concern' },
  { label: 'ช่วยเหลือ', point: 1, value: 'support' },
  { label: 'วินัย', point: -1, value: 'discipline' },
];

const toneLabels = Object.fromEntries(toneOptions.map((option) => [option.value, option.label])) as Record<
  BehaviorTone,
  string
>;

const followUpLabels: Record<FollowUpStatus, string> = {
  contact_guardian: 'ติดต่อผู้ปกครอง',
  none: 'ไม่ต้องติดตาม',
  referred: 'ส่งต่อดูแล',
  resolved: 'จบการติดตาม',
  watch: 'เฝ้าดู',
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsv(value: string | number | null) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getToneClass(tone: BehaviorTone) {
  if (tone === 'positive') return 'bg-cyan-50 text-cyan-700 ring-cyan-100';
  if (tone === 'support') return 'bg-teal-50 text-teal-700 ring-teal-100';
  if (tone === 'discipline') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-rose-50 text-rose-700 ring-rose-100';
}

function getClassroomWithStudents(classrooms: ClassroomRow[], students: StudentRow[]) {
  const classroomWithStudents = classrooms.find((classroom) =>
    students.some((student) => student.classroom_id === classroom.id),
  );

  return classroomWithStudents?.id || classrooms[0]?.id || '';
}

export function BehaviorPage({ session }: BehaviorPageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [records, setRecords] = useState<BehaviorRecordRow[]>(demoBehaviorRecords);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [selectedStudentId, setSelectedStudentId] = useState(demoStudents[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [toneFilter, setToneFilter] = useState<'all' | BehaviorTone>('all');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration เพื่อบันทึกพฤติกรรมจริง',
  );
  const [form, setForm] = useState({
    behaviorDate: getTodayDate(),
    category: 'ช่วยเหลือเพื่อน',
    description: '',
    followUpStatus: 'none' as FollowUpStatus,
    points: '3',
    tone: 'positive' as BehaviorTone,
  });

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

  const selectedStudent = useMemo(
    () => classroomStudents.find((student) => student.id === selectedStudentId) || classroomStudents[0] || null,
    [classroomStudents, selectedStudentId],
  );

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return classroomStudents;
    return classroomStudents.filter((student) =>
      [student.student_code, student.first_name, student.last_name, student.nickname]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [classroomStudents, searchTerm]);

  const recordsByStudent = useMemo(() => {
    const map = new Map<string, BehaviorRecordRow[]>();
    records.forEach((record) => {
      map.set(record.student_id, [...(map.get(record.student_id) || []), record]);
    });
    return map;
  }, [records]);

  const selectedRecords = useMemo(
    () =>
      records
        .filter((record) => record.student_id === selectedStudent?.id)
        .filter((record) => toneFilter === 'all' || record.tone === toneFilter)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [records, selectedStudent?.id, toneFilter],
  );

  const summary = useMemo(() => {
    const classroomStudentIds = new Set(classroomStudents.map((student) => student.id));
    const classroomRecords = records.filter((record) => classroomStudentIds.has(record.student_id));
    const positive = classroomRecords.filter((record) => record.points > 0).length;
    const concern = classroomRecords.filter((record) => record.points < 0).length;
    const followUp = classroomRecords.filter((record) => record.follow_up_status !== 'none' && record.follow_up_status !== 'resolved').length;
    const totalPoints = classroomRecords.reduce((sum, record) => sum + record.points, 0);
    return { concern, followUp, positive, totalPoints };
  }, [classroomStudents, records]);

  useEffect(() => {
    let isMounted = true;

    async function loadBehaviorData() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setRecords(demoBehaviorRecords);
        setClassroomId(demoClassrooms[0].id);
        setSelectedStudentId(demoStudents[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: behaviorRows, error: behaviorError },
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
          .from('behavior_records')
          .select('id,workspace_id,student_id,tone,category,description,points,follow_up_status,behavior_date,recorded_by,created_at')
          .eq('workspace_id', session.workspace.id)
          .order('created_at', { ascending: false })
          .limit(160),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || behaviorError) {
        setNotice(classroomError?.message || studentError?.message || behaviorError?.message || 'โหลดข้อมูลพฤติกรรมไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const nextClassroomId = getClassroomWithStudents(nextClassrooms, nextStudents);
      const nextSelectedStudentId =
        nextStudents.find((student) => student.classroom_id === nextClassroomId)?.id || nextStudents[0]?.id || '';
      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setRecords((behaviorRows || []) as BehaviorRecordRow[]);
      setClassroomId(nextClassroomId);
      setSelectedStudentId(nextSelectedStudentId);
      setIsLoading(false);
    }

    void loadBehaviorData();

    return () => {
      isMounted = false;
    };
  }, [session.workspace]);

  useEffect(() => {
    const selectedStudentInClassroom = classroomStudents.some((student) => student.id === selectedStudentId);
    if (!selectedStudentInClassroom && classroomStudents[0]) setSelectedStudentId(classroomStudents[0].id);
  }, [classroomStudents, selectedStudentId]);

  function applyTone(value: BehaviorTone) {
    const option = toneOptions.find((item) => item.value === value);
    setForm((current) => ({ ...current, points: String(option?.point || 0), tone: value }));
  }

  async function handleCreateBehavior(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    if (!selectedStudent) {
      setNotice('กรุณาเลือกนักเรียนก่อนบันทึกพฤติกรรม');
      setIsSubmitting(false);
      return;
    }

    const category = form.category.trim();
    const description = form.description.trim();
    const points = Number(form.points);

    if (!category || !description) {
      setNotice('กรุณากรอกประเภทและรายละเอียด');
      setIsSubmitting(false);
      return;
    }

    if (!Number.isFinite(points)) {
      setNotice('คะแนนพฤติกรรมต้องเป็นตัวเลข');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const record: BehaviorRecordRow = {
        behavior_date: form.behaviorDate,
        category,
        created_at: new Date().toISOString(),
        description,
        follow_up_status: form.followUpStatus,
        id: `demo-behavior-${Date.now()}`,
        points,
        recorded_by: session.profile.id,
        student_id: selectedStudent.id,
        tone: form.tone,
        workspace_id: session.workspace?.id || 'demo-workspace',
      };

      setRecords((current) => [record, ...current]);
      setForm((current) => ({ ...current, description: '' }));
      setNotice('บันทึกพฤติกรรมในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('behavior_records')
      .insert({
        behavior_date: form.behaviorDate,
        category,
        description,
        follow_up_status: form.followUpStatus,
        points,
        recorded_by: session.profile.id,
        student_id: selectedStudent.id,
        tone: form.tone,
        workspace_id: session.workspace.id,
      })
      .select('id,workspace_id,student_id,tone,category,description,points,follow_up_status,behavior_date,recorded_by,created_at')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const record = data as BehaviorRecordRow;
    await writeAuditLog(session, {
      action: 'behavior_record.created',
      entityId: record.id,
      entityTable: 'behavior_records',
      metadata: {
        category: record.category,
        follow_up_status: record.follow_up_status,
        points: record.points,
        student_id: record.student_id,
        tone: record.tone,
      },
      riskLevel: record.tone === 'concern' || record.follow_up_status !== 'none' ? 'normal' : 'low',
      source: 'behavior_center',
    });
    setRecords((current) => [record, ...current]);
    setForm((current) => ({ ...current, description: '' }));
    setNotice('บันทึกพฤติกรรมแล้ว');
    setIsSubmitting(false);
  }

  function exportBehaviorCsv() {
    const studentById = new Map(students.map((student) => [student.id, student]));
    const rows = records.map((record) => {
      const student = studentById.get(record.student_id);
      return [
        record.behavior_date,
        student?.student_code || '',
        student?.first_name || '',
        student?.last_name || '',
        record.tone,
        record.category,
        record.points,
        record.follow_up_status,
        record.description,
      ];
    });
    const csv = [
      ['behavior_date', 'student_code', 'first_name', 'last_name', 'tone', 'category', 'points', 'follow_up_status', 'description'],
      ...rows,
    ]
      .map((row) => row.map((value) => escapeCsv(value)).join(','))
      .join('\n');
    downloadTextFile(`classcare-behavior-${getTodayDate()}.csv`, `\uFEFF${csv}`);
  }

  return (
    <main className="app-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <Heart size={16} aria-hidden="true" />
            Behavior Center
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            บันทึกพฤติกรรมเชิงบวก ข้อห่วงใย และงานติดตามรายคน
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            เห็นประวัติพฤติกรรมของนักเรียนแต่ละคน พร้อมคะแนน สถานะติดตาม และข้อมูลสำหรับต่อยอดไปยังเคสดูแลหรือแจ้งผู้ปกครอง
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[520px] sm:grid-cols-4">
          {[
            { label: 'คะแนนรวม', value: summary.totalPoints },
            { label: 'เชิงบวก', value: summary.positive },
            { label: 'ข้อห่วงใย', value: summary.concern },
            { label: 'ต้องติดตาม', value: summary.followUp },
          ].map((item) => (
            <div className="nexus-card p-3 text-center" key={item.label}>
              <p className="text-2xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="app-workbench">
        <aside className="grid gap-4">
          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void handleCreateBehavior(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <MessageSquarePlus size={16} aria-hidden="true" />
              บันทึกพฤติกรรม
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
                <span className="text-xs font-black uppercase text-slate-500">นักเรียน</span>
                <select className="nexus-field mt-2" onChange={(event) => setSelectedStudentId(event.target.value)} value={selectedStudent?.id || ''}>
                  {classroomStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.student_code || '-'} {student.first_name} {student.last_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {toneOptions.map((option) => (
                  <button
                    className={`h-11 rounded-2xl px-3 text-xs font-black transition ${
                      form.tone === option.value ? 'bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)]' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                    }`}
                    key={option.value}
                    onClick={() => applyTone(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">วันที่</span>
                  <input className="nexus-field mt-2" onChange={(event) => setForm((current) => ({ ...current, behaviorDate: event.target.value }))} type="date" value={form.behaviorDate} />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">คะแนน</span>
                  <input className="nexus-field mt-2" onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} type="number" value={form.points} />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ประเภท</span>
                <input className="nexus-field mt-2" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} value={form.category} />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ติดตามต่อ</span>
                <select className="nexus-field mt-2" onChange={(event) => setForm((current) => ({ ...current, followUpStatus: event.target.value as FollowUpStatus }))} value={form.followUpStatus}>
                  {Object.entries(followUpLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">รายละเอียด</span>
                <textarea className="mt-2 min-h-28 w-full rounded-3xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="เขียนเหตุการณ์ให้ชัดพอสำหรับติดตามย้อนหลัง" value={form.description} />
              </label>
            </div>
            <button className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300" disabled={isSubmitting || isLoading} type="submit">
              <Save size={17} aria-hidden="true" />
              บันทึกพฤติกรรม
            </button>
          </form>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-teal-700">
              <ShieldCheck size={16} aria-hidden="true" />
              Care Guard
            </div>
            <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
              รายการที่เป็นข้อห่วงใยควรเชื่อมต่อ Student Care Case ในเฟสถัดไป เพื่อให้การติดตามไม่หายไปกับบันทึกรายวัน
            </p>
            <button className="amber-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black" onClick={exportBehaviorCsv} type="button">
              <Download size={17} aria-hidden="true" />
              Export พฤติกรรม
            </button>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">Student Behavior Map</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{classroomStudents.length} คนในห้องนี้</h2>
              </div>
              <label className="flex min-h-11 min-w-[260px] items-center gap-2 rounded-2xl bg-white/80 px-3 ring-1 ring-slate-200">
                <Search className="shrink-0 text-slate-400" size={17} aria-hidden="true" />
                <input className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none" onChange={(event) => setSearchTerm(event.target.value)} placeholder="ค้นหานักเรียน" value={searchTerm} />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-500">
                    <th className="px-3 py-3">รหัส</th>
                    <th className="px-3 py-3">นักเรียน</th>
                    <th className="px-3 py-3">คะแนนรวม</th>
                    <th className="px-3 py-3">บันทึก</th>
                    <th className="px-3 py-3">ติดตาม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((student) => {
                    const studentRecords = recordsByStudent.get(student.id) || [];
                    const totalPoints = studentRecords.reduce((sum, record) => sum + record.points, 0);
                    const openFollowUp = studentRecords.filter((record) => record.follow_up_status !== 'none' && record.follow_up_status !== 'resolved').length;
                    return (
                      <tr className="cursor-pointer hover:bg-slate-50" key={student.id} onClick={() => setSelectedStudentId(student.id)}>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{student.student_code || '-'}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">{student.first_name} {student.last_name}</p>
                          <p className="text-xs font-bold text-slate-500">{student.nickname || 'ไม่มีชื่อเล่น'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-lg font-black text-slate-950">{totalPoints}</td>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{studentRecords.length}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${openFollowUp > 0 ? 'bg-amber-50 text-amber-700 ring-amber-100' : 'bg-cyan-50 text-cyan-700 ring-cyan-100'}`}>
                            {openFollowUp > 0 ? `${openFollowUp} รายการ` : 'ปกติ'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black text-teal-700">Behavior Timeline</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'เลือกนักเรียน'}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'positive', 'concern', 'support', 'discipline'] as Array<'all' | BehaviorTone>).map((filter) => (
                  <button
                    className={`h-10 rounded-2xl px-3 text-xs font-black transition ${
                      toneFilter === filter ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                    }`}
                    key={filter}
                    onClick={() => setToneFilter(filter)}
                    type="button"
                  >
                    {filter === 'all' ? 'ทั้งหมด' : toneLabels[filter]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {selectedRecords.map((record) => {
                const Icon = record.tone === 'positive' ? SmilePlus : record.tone === 'concern' ? BadgeAlert : record.tone === 'support' ? Sparkles : AlertTriangle;
                return (
                  <article className="rounded-3xl border border-slate-100 bg-white/75 p-4" key={record.id}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1 ${getToneClass(record.tone)}`}>
                            <Icon size={14} aria-hidden="true" />
                            {toneLabels[record.tone]}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                            {record.category}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200">
                            {followUpLabels[record.follow_up_status]}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{record.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                        <span className={`rounded-full px-3 py-1 text-sm font-black ${record.points >= 0 ? 'bg-cyan-50 text-cyan-700' : 'bg-rose-50 text-rose-700'}`}>
                          {record.points >= 0 ? '+' : ''}{record.points}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{record.behavior_date}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
              {selectedRecords.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">ยังไม่มีบันทึกตามตัวกรองนี้</div>
              ) : null}
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
