import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeAlert,
  Check,
  ChevronDown,
  Download,
  Heart,
  LayoutGrid,
  ListFilter,
  MessageSquarePlus,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { ContextLink as Link } from '../../components/navigation/ContextLink';

import { writeAuditLog } from '../../lib/auditLog';
import { isDemoSession } from '../../lib/auth';
import { ThaiDatePicker } from '../../components/shared/ThaiDatePicker';
import { getBangkokDate } from '../../lib/date';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { getClassroomScopeBadge, getTeacherClassroomScope } from '../../lib/teacherClassrooms';
import type { AppSessionContext } from '../../types/core';

interface BehaviorPageProps {
  session: AppSessionContext;
}

type BehaviorTone = 'positive' | 'concern' | 'support' | 'discipline';
type FollowUpStatus = 'none' | 'watch' | 'contact_guardian' | 'referred' | 'resolved';

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
    behavior_date: getBangkokDate(),
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
    behavior_date: getBangkokDate(new Date(Date.now() - 1000 * 60 * 60 * 24)),
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

const NOTE_ROTATIONS = ['rotate-[-1.5deg]', 'rotate-[1deg]', 'rotate-[-0.8deg]', 'rotate-[1.8deg]', 'rotate-[-1deg]', 'rotate-[0.8deg]'];

interface QuickBehaviorPreset {
  category: string;
  id: string;
  label: string;
  points: number;
  tone: BehaviorTone;
}

const QUICK_PRESETS: QuickBehaviorPreset[] = [
  { category: 'ทำความดี', id: 'star_1', label: '⭐ ทำความดี (+1)', points: 1, tone: 'positive' },
  { category: 'จิตอาสา/ช่วยเหลือ', id: 'star_2', label: '🏆 จิตอาสา (+2)', points: 2, tone: 'positive' },
  { category: 'มารยาทและความประพฤติดีเยี่ยม', id: 'star_3', label: '✨ พิเศษ (+3)', points: 3, tone: 'positive' },
  { category: 'ตักเตือนพฤติกรรม', id: 'warn_1', label: '⚠️ เตือน (-1)', points: -1, tone: 'discipline' },
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
  return getBangkokDate();
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
  const demoMode = isDemoSession(session);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoMode ? demoClassrooms : []);
  const [students, setStudents] = useState<StudentRow[]>(demoMode ? demoStudents : []);
  const [records, setRecords] = useState<BehaviorRecordRow[]>(demoMode ? demoBehaviorRecords : []);
  const [classroomId, setClassroomId] = useState(demoMode ? demoClassrooms[0]?.id || '' : '');
  const [selectedStudentId, setSelectedStudentId] = useState(demoMode ? demoStudents[0]?.id || '' : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [toneFilter, setToneFilter] = useState<'all' | BehaviorTone>('all');
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration เพื่อบันทึกพฤติกรรมจริง',
  );
  const [scopeFilter, setScopeFilter] = useState<'homeroom' | 'all'>('homeroom');

  // Cute Post-it Board states
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('star_1');
  const [draftAwards, setDraftAwards] = useState<Record<string, { category: string; points: number; tone: BehaviorTone }>>({});
  const [sheetStudent, setSheetStudent] = useState<StudentRow | null>(null);
  const [sheetForm, setSheetForm] = useState({
    category: 'ช่วยเหลือเพื่อน',
    description: '',
    followUpStatus: 'none' as FollowUpStatus,
    points: '1',
    tone: 'positive' as BehaviorTone,
  });

  const [form, setForm] = useState({
    behaviorDate: getTodayDate(),
    category: 'ช่วยเหลือเพื่อน',
    description: '',
    followUpStatus: 'none' as FollowUpStatus,
    points: '3',
    tone: 'positive' as BehaviorTone,
  });

  const teacherScope = useMemo(
    () => getTeacherClassroomScope(session, classrooms),
    [session, classrooms],
  );

  const displayClassrooms = useMemo(() => {
    if (scopeFilter === 'homeroom' && teacherScope.hasHomeroom) {
      return teacherScope.homeroomClassrooms;
    }
    return classrooms;
  }, [classrooms, scopeFilter, teacherScope]);

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
      if (!supabase || !session.workspace || demoMode) {
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
          .select('id,name,academic_year,homeroom_teacher_profile_id')
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
      const initialScope = getTeacherClassroomScope(session, nextClassrooms);
      const nextClassroomId = initialScope.hasHomeroom
        ? initialScope.homeroomClassrooms[0].id
        : getClassroomWithStudents(nextClassrooms, nextStudents);
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
  }, [demoMode, session.workspace]);

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

    if (!supabase || !session.workspace || isDemoSession(session)) {
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

  async function handleSaveDailyStars() {
    const studentIds = Object.keys(draftAwards);
    if (studentIds.length === 0) {
      setNotice('ยังไม่มีแต้มดาวความดีที่ต้องบันทึก (แตะที่โน้ตของนักเรียนเพื่อใส่แต้ม)');
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    const today = getTodayDate();
    let totalPts = 0;

    try {
      if (!supabase || !session.workspace || demoMode) {
        const newRecords: BehaviorRecordRow[] = studentIds.map((stId) => {
          const award = draftAwards[stId];
          totalPts += award.points;
          return {
            behavior_date: today,
            category: award.category,
            created_at: new Date().toISOString(),
            description: `บันทึกด่วนผ่านกระดานดาวความดี (${award.category})`,
            follow_up_status: 'none',
            id: `demo-behavior-${Date.now()}-${stId}`,
            points: award.points,
            recorded_by: session.profile.id,
            student_id: stId,
            tone: award.tone,
            workspace_id: session.workspace?.id || 'demo-workspace',
          };
        });

        setRecords((current) => [...newRecords, ...current]);
        setDraftAwards({});
        setNotice(`✨ บันทึกดาวความดีเรียบร้อยแล้ว (${studentIds.length} คน รวม ${totalPts} แต้ม) [โหมดตัวอย่าง]`);
        setIsSubmitting(false);
        return;
      }

      const workspaceId = session.workspace?.id || 'demo-workspace';
      const insertRows = studentIds.map((stId) => {
        const award = draftAwards[stId];
        totalPts += award.points;
        return {
          behavior_date: today,
          category: award.category,
          description: `บันทึกด่วนผ่านกระดานดาวความดี (${award.category})`,
          follow_up_status: 'none' as FollowUpStatus,
          points: award.points,
          recorded_by: session.profile.id,
          student_id: stId,
          tone: award.tone,
          workspace_id: workspaceId,
        };
      });

      const { data, error } = await supabase
        .from('behavior_records')
        .insert(insertRows)
        .select('id,workspace_id,student_id,tone,category,description,points,follow_up_status,behavior_date,recorded_by,created_at');

      if (error) throw error;
      const createdRecords = (data || []) as BehaviorRecordRow[];

      setRecords((current) => [...createdRecords, ...current]);
      setDraftAwards({});
      setNotice(`✨ บันทึกดาวความดีเรียบร้อยแล้ว (${studentIds.length} คน รวม ${totalPts} แต้ม)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`บันทึกไม่สำเร็จ: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveSheetStudentBehavior(event: FormEvent) {
    event.preventDefault();
    if (!sheetStudent) return;
    const points = Number(sheetForm.points) || 1;
    setIsSubmitting(true);
    setNotice(null);
    const today = getTodayDate();

    try {
      if (!supabase || !session.workspace || demoMode) {
        const record: BehaviorRecordRow = {
          behavior_date: today,
          category: sheetForm.category.trim() || 'พฤติกรรม',
          created_at: new Date().toISOString(),
          description: sheetForm.description.trim() || 'บันทึกพฤติกรรมรายบุคคล',
          follow_up_status: sheetForm.followUpStatus,
          id: `demo-behavior-${Date.now()}`,
          points,
          recorded_by: session.profile.id,
          student_id: sheetStudent.id,
          tone: sheetForm.tone,
          workspace_id: session.workspace?.id || 'demo-workspace',
        };
        setRecords((current) => [record, ...current]);
        setSheetStudent(null);
        setNotice(`✨ บันทึกพฤติกรรมของน้อง${sheetStudent.nickname || sheetStudent.first_name}เรียบร้อย [โหมดตัวอย่าง]`);
        return;
      }

      const { data, error } = await supabase
        .from('behavior_records')
        .insert({
          behavior_date: today,
          category: sheetForm.category.trim() || 'พฤติกรรม',
          description: sheetForm.description.trim() || 'บันทึกพฤติกรรมรายบุคคล',
          follow_up_status: sheetForm.followUpStatus,
          points,
          recorded_by: session.profile.id,
          student_id: sheetStudent.id,
          tone: sheetForm.tone,
          workspace_id: session.workspace?.id || 'demo-workspace',
        })
        .select('id,workspace_id,student_id,tone,category,description,points,follow_up_status,behavior_date,recorded_by,created_at')
        .single();

      if (error) throw error;
      const record = data as BehaviorRecordRow;
      setRecords((current) => [record, ...current]);
      setSheetStudent(null);
      setNotice(`✨ บันทึกพฤติกรรมของน้อง${sheetStudent.nickname || sheetStudent.first_name}เรียบร้อย`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice(`บันทึกไม่สำเร็จ: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
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

  const activePreset = QUICK_PRESETS.find((p) => p.id === selectedPresetId) || QUICK_PRESETS[0];
  const draftAwardCount = Object.keys(draftAwards).length;
  const draftTotalPoints = Object.values(draftAwards).reduce((sum, a) => sum + a.points, 0);

  return (
    <main className="app-page min-h-screen pb-64 lg:pb-32 font-['Itim',sans-serif]">
      {/* ======================================================== */}
      {/* CORKBOARD / LINED PAPER CONTAINER (Style 5: Post-it)     */}
      {/* ======================================================== */}
      <div className="rounded-[32px] border-2 border-[#e6dcce] bg-[#f5efe6] [background-image:repeating-linear-gradient(0deg,transparent_0_27px,#e8dfd2_27px_28px)] p-4 sm:p-7 shadow-md">
        
        {/* Header */}
        <header className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
                <Heart size={13} className="text-amber-700" />
                บอร์ดพฤติกรรม & บันทึกความดี
              </span>
              <Link
                to="/app/dashboard?view=desirable-characteristics"
                className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-0.5 text-xs font-bold text-stone-700 hover:text-stone-950 border border-stone-300 transition-colors shadow-2xs"
              >
                <Award size={13} className="text-amber-600" />
                <span>ประเมินคุณลักษณะ 8 ประการ (สพฐ.) ➜</span>
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-1.5">
              <span>บอร์ดความดีและพฤติกรรม</span>
              <span className="text-xl sm:text-2xl">🌟📌</span>
            </h1>
            <p className="mt-0.5 text-sm sm:text-base font-semibold text-[#44403c]">
              ให้ดาวความดี บันทึกข้อห่วงใย และสะสมแต้มความดีรายคน
            </p>
          </div>

          {/* 4 Post-it Stat Memo Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:min-w-[480px]">
            {/* Total Points */}
            <div className="relative rounded-xl bg-[#d9f99d] p-3 text-center shadow-[2px_4px_6px_rgba(27,62,4,0.18)] rotate-[1deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#1b3e04]">{summary.totalPoints}</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#1b3e04]">คะแนนรวมทั้งห้อง</p>
            </div>

            {/* Positive */}
            <div className="relative rounded-xl bg-[#fef08a] p-3 text-center shadow-[2px_4px_6px_rgba(113,63,18,0.18)] -rotate-[1.5deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#713f12]">{summary.positive}</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#713f12]">ความดีเชิงบวก</p>
            </div>

            {/* Concern */}
            <div className="relative rounded-xl bg-[#fecdd3] p-3 text-center shadow-[2px_4px_6px_rgba(136,19,55,0.18)] rotate-[1.5deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#881337]">{summary.concern}</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#881337]">ข้อห่วงใย</p>
            </div>

            {/* Follow Up */}
            <div className="relative rounded-xl bg-[#bae6fd] p-3 text-center shadow-[2px_4px_6px_rgba(3,79,119,0.18)] -rotate-[1deg] hover:scale-105 transition">
              <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2 w-6 rounded-[1px] bg-white/70 shadow-2xs" />
              <p className="text-lg sm:text-xl font-bold text-[#034f77]">{summary.followUp}</p>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-[#034f77]">งานติดตาม</p>
            </div>
          </div>
        </header>

        {/* Mode Switcher & Filter Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e2d5c3] pt-3.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-2xl bg-white/80 p-1 border border-[#c7bca9] shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                viewMode === 'board'
                  ? 'bg-[#332f2b] text-white shadow-xs'
                  : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <LayoutGrid size={15} />
              <span>กระดานดาวความดี 📌</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition active:scale-95 ${
                viewMode === 'table'
                  ? 'bg-[#332f2b] text-white shadow-xs'
                  : 'text-[#57534e] hover:text-[#1c1917]'
              }`}
            >
              <ListFilter size={15} />
              <span>ตารางบันทึกละเอียด 📋</span>
            </button>
          </div>

          {/* Classroom Selector */}
          <div className="relative inline-flex items-center rotate-[0.8deg] shadow-xs">
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
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
        </div>

        {/* ======================================================== */}
        {/* POST-IT BOARD MODE                                       */}
        {/* ======================================================== */}
        {viewMode === 'board' && (
          <div className="mt-4">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-[#57534e]">เลือกรางวัล:</span>
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`h-8 px-2.5 rounded-xl text-xs font-bold transition active:scale-95 shadow-2xs ${
                      selectedPresetId === preset.id
                        ? 'bg-[#332f2b] text-white ring-2 ring-amber-400'
                        : 'bg-white border border-[#c7bca9] text-[#44403c] hover:bg-amber-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, { category: string; points: number; tone: BehaviorTone }> = {};
                    classroomStudents.forEach((s) => {
                      next[s.id] = { category: activePreset.category, points: activePreset.points, tone: activePreset.tone };
                    });
                    setDraftAwards(next);
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border border-lime-400 bg-white text-xs font-bold text-[#1b3e04] hover:bg-lime-50 active:scale-95 transition shadow-2xs"
                >
                  <Star size={13} className="text-[#1b3e04]" />
                  <span>+{activePreset.points} ให้ทุกคน</span>
                </button>

                {draftAwardCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftAwards({})}
                    className="h-8 px-2.5 rounded-xl border border-rose-300 bg-white text-xs font-bold text-[#881337] hover:bg-rose-50 active:scale-95 transition shadow-2xs"
                  >
                    ล้างรอบนี้
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={exportBehaviorCsv}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl border border-[#c7bca9] bg-white text-xs font-bold text-[#44403c] hover:bg-amber-50 active:scale-95 transition shadow-2xs"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <p className="mt-1 text-xs sm:text-sm font-medium text-[#57534e]">
              แตะโน้ตเพื่อเพิ่มแต้ม {activePreset.label} (แตะซ้ำเพื่อเพิ่ม หรือวนกลับเป็น 0) หรือกด ✏️ เพื่อดูรายละเอียด/ใส่ข้อห่วงใย
            </p>

            {/* Post-it Notes Grid */}
            <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 sm:gap-4.5 pt-2">
              {classroomStudents.map((student, idx) => {
                const rollNumber = idx + 1;
                const draft = draftAwards[student.id];
                const studentRecords = recordsByStudent.get(student.id) || [];
                const totalPoints = studentRecords.reduce((sum, r) => sum + r.points, 0);
                const rotation = NOTE_ROTATIONS[idx % NOTE_ROTATIONS.length];
                const hasDraft = Boolean(draft && draft.points !== 0);

                // Tone colors
                const bgClass = hasDraft
                  ? draft.points > 0
                    ? 'bg-[#d9f99d] text-[#1b3e04] shadow-[2px_4px_6px_rgba(27,62,4,0.18)] ring-2 ring-lime-400'
                    : 'bg-[#fecdd3] text-[#881337] shadow-[2px_4px_6px_rgba(136,19,55,0.18)] ring-2 ring-rose-400'
                  : 'bg-[#fef08a] text-[#713f12] shadow-[2px_4px_6px_rgba(113,63,18,0.18)]';

                return (
                  <div
                    key={student.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setDraftAwards((prev) => {
                        const cur = prev[student.id];
                        if (!cur) {
                          return {
                            ...prev,
                            [student.id]: {
                              category: activePreset.category,
                              points: activePreset.points,
                              tone: activePreset.tone,
                            },
                          };
                        }
                        if (cur.points === activePreset.points) {
                          return {
                            ...prev,
                            [student.id]: {
                              ...cur,
                              points: cur.points * 2,
                            },
                          };
                        }
                        const next = { ...prev };
                        delete next[student.id];
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDraftAwards((prev) => {
                          const cur = prev[student.id];
                          if (!cur) {
                            return {
                              ...prev,
                              [student.id]: {
                                category: activePreset.category,
                                points: activePreset.points,
                                tone: activePreset.tone,
                              },
                            };
                          }
                          const next = { ...prev };
                          delete next[student.id];
                          return next;
                        });
                      }
                    }}
                    className={`group relative flex flex-col items-center justify-center rounded-xs sm:rounded-sm p-2 sm:p-2.5 min-h-[74px] sm:min-h-[82px] transition-all select-none active:scale-95 cursor-pointer ${bgClass} ${rotation} hover:scale-105 hover:z-10`}
                    title={`เลขที่ ${rollNumber}. ${student.first_name} ${student.last_name} (คะแนนสะสม ${totalPoints}) — แตะเพื่อเพิ่มแต้ม ${activePreset.label}`}
                  >
                    {/* Frosted Tape */}
                    <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-7 rounded-[1px] bg-white/70 shadow-2xs backdrop-blur-2xs" />

                    {/* Pencil Edit Icon Button */}
                    <button
                      type="button"
                      aria-label={`แก้ไขพฤติกรรมของ ${student.first_name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSheetStudent(student);
                        setSheetForm({
                          category: 'ช่วยเหลือเพื่อน',
                          description: '',
                          followUpStatus: 'none',
                          points: '1',
                          tone: 'positive',
                        });
                      }}
                      className="absolute top-1 right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white/85 hover:bg-white text-stone-500 hover:text-stone-900 border border-stone-200/70 transition-all cursor-pointer z-20 shadow-2xs hover:scale-115 active:scale-90"
                    >
                      <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>

                    {/* Large Roll Number */}
                    <span className="text-2xl sm:text-3xl font-bold leading-none tracking-tight">
                      {rollNumber}
                    </span>

                    {/* Student Name */}
                    <span className="text-xs sm:text-sm font-bold truncate mt-0.5 max-w-full text-center px-0.5">
                      {student.nickname || student.first_name}
                    </span>

                    {/* Badge: Draft points or Cumulative points */}
                    <div className="mt-1">
                      {hasDraft ? (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[10px] sm:text-xs font-bold text-white shadow-2xs animate-in zoom-in-75 duration-100 ${
                          draft.points > 0 ? 'bg-[#1b3e04]' : 'bg-[#881337]'
                        }`}>
                          {draft.points > 0 ? `+${draft.points}` : draft.points} ⭐
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold opacity-75">
                          {totalPoints} ⭐
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {classroomStudents.length === 0 && !isLoading && (
              <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center text-amber-950">
                <p className="text-base font-bold">ยังไม่มีนักเรียนในห้องนี้</p>
                <p className="mt-1 text-xs text-amber-800/80">กรุณาเพิ่มหรือนำเข้ารายชื่อนักเรียนก่อนบันทึกพฤติกรรม</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* DETAILED TABLE MODE                                      */}
        {/* ======================================================== */}
        {viewMode === 'table' && (
          <section className="app-workbench mt-6">
            <aside className="grid gap-4">
              <form className="relative rounded-2xl border border-[#ded5c6] bg-white/95 p-4 sm:p-5 shadow-sm" onSubmit={(event) => void handleCreateBehavior(event)}>
                <span className="pointer-events-none absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-8 rounded-[1px] bg-white/80 shadow-2xs" />
                <div className="flex items-center gap-2 text-sm font-bold text-[#3f3a36] border-b border-[#f0e8dc] pb-2.5">
                  <MessageSquarePlus size={16} aria-hidden="true" />
                  <span>บันทึกพฤติกรรมรายบุคคล</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-[#78716c]">นักเรียน:</span>
                    <select
                      className="mt-1 h-9.5 w-full appearance-none rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 pr-8 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                      onChange={(event) => setSelectedStudentId(event.target.value)}
                      value={selectedStudent?.id || ''}
                    >
                      {classroomStudents.map((student, idx) => (
                        <option key={student.id} value={student.id}>
                          {idx + 1}. {student.first_name} {student.last_name} {student.nickname ? `(${student.nickname})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {toneOptions.map((option) => (
                      <button
                        className={`h-9 rounded-xl px-2 text-xs font-bold transition ${
                          form.tone === option.value
                            ? 'bg-[#332f2b] text-white shadow-xs'
                            : 'bg-white text-stone-700 border border-[#ded5c6] hover:bg-slate-50'
                        }`}
                        key={option.value}
                        onClick={() => applyTone(option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs font-bold text-[#78716c]">วันที่:</span>
                      <ThaiDatePicker className="mt-1 text-xs" onValueChange={(value) => setForm((current) => ({ ...current, behaviorDate: value }))} value={form.behaviorDate} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-[#78716c]">คะแนน:</span>
                      <input className="mt-1 h-9.5 w-full rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400" onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} type="number" value={form.points} />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold text-[#78716c]">ประเภท / พฤติกรรม:</span>
                    <input className="mt-1 h-9.5 w-full rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} value={form.category} />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-[#78716c]">การติดตามต่อ:</span>
                    <select className="mt-1 h-9.5 w-full appearance-none rounded-xl border border-[#ded5c6] bg-amber-50/40 px-3 pr-8 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400" onChange={(event) => setForm((current) => ({ ...current, followUpStatus: event.target.value as FollowUpStatus }))} value={form.followUpStatus}>
                      {Object.entries(followUpLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-[#78716c]">รายละเอียดเพิ่มเติม:</span>
                    <textarea className="mt-1 min-h-20 w-full rounded-2xl border border-[#ded5c6] bg-amber-50/40 p-2.5 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-400" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="เขียนบันทึกเหตุการณ์เพื่อติดตามย้อนหลัง" value={form.description} />
                  </label>
                </div>

                <button className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3f3a36] hover:bg-[#2c2825] text-white text-sm font-bold shadow-[3px_4px_0_#f59e0b] active:translate-y-0.5 active:shadow-[1px_2px_0_#f59e0b] transition-all disabled:opacity-50 cursor-pointer" disabled={isSubmitting || isLoading} type="submit">
                  <Save size={16} aria-hidden="true" />
                  <span>บันทึกพฤติกรรม ✓</span>
                </button>
              </form>

              <div className="rounded-2xl border border-[#ded5c6] bg-white/95 p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-teal-800">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>Care Guard & ส่งออก</span>
                </div>
                <p className="text-xs text-[#78716c]">
                  รายการที่เป็นข้อห่วงใยจะเชื่อมต่อระบบคัดกรองนักเรียนรายบุคคลอัตโนมัติ
                </p>
                <button className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm font-bold text-amber-900 hover:bg-amber-100 transition active:scale-95" onClick={exportBehaviorCsv} type="button">
                  <Download size={15} aria-hidden="true" />
                  <span>Export พฤติกรรม (CSV)</span>
                </button>
              </div>
            </aside>

            <section className="grid gap-5">
              <div className="rounded-2xl border border-[#ded5c6] bg-white/95 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#f0e8dc] pb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#3f3a36]">
                      ตารางคะแนนพฤติกรรม ({classroomStudents.length} คน)
                    </h2>
                    <p className="text-xs text-[#8a8178]">
                      แตะที่ชื่อนักเรียนเพื่อดูประวัติพฤติกรรมย้อนหลัง
                    </p>
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="h-9 w-full sm:w-56 rounded-xl border border-[#ded5c6] bg-amber-50/40 pl-9 pr-3 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400" onChange={(event) => setSearchTerm(event.target.value)} placeholder="ค้นหานักเรียน..." value={searchTerm} />
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#f0e8dc] text-left">
                    <thead>
                      <tr className="text-xs font-bold text-[#78716c]">
                        <th className="px-3 py-2.5">ลำดับ</th>
                        <th className="px-3 py-2.5">นักเรียน</th>
                        <th className="px-3 py-2.5 text-right">คะแนนรวม</th>
                        <th className="px-3 py-2.5 text-center">รายการ</th>
                        <th className="px-3 py-2.5 text-right">สถานะติดตาม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e8dc] text-xs sm:text-sm">
                      {filteredStudents.map((student, idx) => {
                        const studentRecords = recordsByStudent.get(student.id) || [];
                        const totalPoints = studentRecords.reduce((sum, record) => sum + record.points, 0);
                        const openFollowUp = studentRecords.filter((record) => record.follow_up_status !== 'none' && record.follow_up_status !== 'resolved').length;
                        const isSelected = selectedStudentId === student.id;
                        return (
                          <tr className={`cursor-pointer transition ${isSelected ? 'bg-amber-100/70 font-bold' : 'hover:bg-amber-50/50'}`} key={student.id} onClick={() => setSelectedStudentId(student.id)}>
                            <td className="px-3 py-2.5 text-[#78716c] font-bold">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-bold text-[#3f3a36]">{student.first_name} {student.last_name}</p>
                              <p className="text-[11px] text-[#8a8178]">{student.nickname ? `น้อง${student.nickname}` : student.student_code || '-'}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right text-base sm:text-lg font-bold text-[#3f3a36]">{totalPoints} ⭐</td>
                            <td className="px-3 py-2.5 text-center font-bold text-[#78716c]">{studentRecords.length}</td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${openFollowUp > 0 ? 'bg-amber-100 text-amber-800' : 'bg-lime-100 text-lime-800'}`}>
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

              <div className="rounded-2xl border border-[#ded5c6] bg-white/95 p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#f0e8dc] pb-2.5">
                  <h3 className="text-base sm:text-lg font-bold text-[#3f3a36]">
                    ประวัติพฤติกรรม: {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'เลือกนักเรียน'}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'positive', 'concern', 'support', 'discipline'] as Array<'all' | BehaviorTone>).map((filter) => (
                      <button
                        className={`h-8 rounded-xl px-2.5 text-xs font-bold transition ${
                          toneFilter === filter ? 'bg-[#332f2b] text-white' : 'bg-white text-stone-600 border border-[#ded5c6]'
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

                <div className="mt-3 grid gap-2">
                  {selectedRecords.map((record) => {
                    const Icon = record.tone === 'positive' ? SmilePlus : record.tone === 'concern' ? BadgeAlert : record.tone === 'support' ? Sparkles : AlertTriangle;
                    return (
                      <article className="rounded-xl border border-[#ded5c6] bg-amber-50/25 p-3 text-xs sm:text-sm" key={record.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${getToneClass(record.tone)}`}>
                                <Icon size={12} aria-hidden="true" />
                                {toneLabels[record.tone]}
                              </span>
                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#78716c] border border-stone-200">
                                {record.category}
                              </span>
                              {record.follow_up_status !== 'none' && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                                  {followUpLabels[record.follow_up_status]}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 font-bold text-[#3f3a36]">{record.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-base font-bold ${record.points >= 0 ? 'text-[#1b3e04]' : 'text-[#881337]'}`}>
                              {record.points >= 0 ? `+${record.points}` : record.points} ⭐
                            </span>
                            <p className="text-[11px] text-[#8a8178]">{record.behavior_date}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {selectedRecords.length === 0 ? (
                    <div className="p-4 text-center text-xs sm:text-sm text-[#8a8178]">ยังไม่มีบันทึกตามตัวกรองนี้</div>
                  ) : null}
                </div>
              </div>
            </section>
          </section>
        )}

        {/* Generous bottom spacer so page can scroll comfortably past bottom dock */}
        <div className="h-32 sm:h-20 lg:h-10" aria-hidden="true" />
      </div>

      {/* ======================================================== */}
      {/* FLOATING ACTION DOCK: Matches Style 5                      */}
      {/* ======================================================== */}
      {viewMode === 'board' && classroomStudents.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:sticky lg:bottom-4 lg:z-10 mx-auto max-w-sm sm:max-w-md rounded-2xl border border-[#c7bca9] bg-[#fbf8f3]/95 p-3.5 shadow-xl backdrop-blur-md">
          {/* Summary Text */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 text-sm sm:text-base font-bold text-[#1c1917]">
            <span>
              บันทึกวันนี้ <b className="text-[#1b3e04]">{draftAwardCount} คน</b>
            </span>
            <span>·</span>
            <span>
              รวมแต้ม <b className="text-[#1b3e04]">{draftTotalPoints >= 0 ? `+${draftTotalPoints}` : draftTotalPoints} ⭐</b>
            </span>
          </div>

          {/* Big Charcoal Button with Golden Shadow */}
          <button
            type="button"
            onClick={() => void handleSaveDailyStars()}
            disabled={isSubmitting || draftAwardCount === 0}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#332f2b] text-base font-bold text-white shadow-[0_5px_0_#d97706] hover:bg-[#252220] active:translate-y-1 active:shadow-[0_2px_0_#d97706] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <span>กำลังบันทึก...</span>
            ) : (
              <>
                <span>บันทึกดาวความดีเรียบร้อย</span>
                <Check size={20} className="stroke-[3]" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* SINGLE STUDENT QUICK BEHAVIOR MODAL                       */}
      {/* ======================================================== */}
      {sheetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-3xl border border-[#ded5c6] bg-[#fbf8f3] p-5 shadow-2xl flex flex-col font-['Itim',sans-serif]">
            <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-12 rounded-[1px] bg-white/80 shadow-2xs" />
            <div className="flex items-center justify-between border-b border-[#f0e8dc] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#3f3a36]">
                  {sheetStudent.first_name} {sheetStudent.last_name}
                </h3>
                <p className="text-xs text-[#8a8178]">
                  {sheetStudent.nickname ? `น้อง${sheetStudent.nickname}` : 'นักเรียน'} · คะแนนสะสมรวม: {(recordsByStudent.get(sheetStudent.id) || []).reduce((sum, r) => sum + r.points, 0)} ⭐
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetStudent(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveSheetStudentBehavior(e)} className="mt-3.5 space-y-3">
              {/* Tone Switcher */}
              <div className="grid grid-cols-2 gap-2">
                {toneOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSheetForm((prev) => ({ ...prev, tone: opt.value, points: String(opt.point) }))}
                    className={`h-9 rounded-xl text-xs font-bold transition ${
                      sheetForm.tone === opt.value
                        ? 'bg-[#332f2b] text-white shadow-xs'
                        : 'bg-white border border-[#ded5c6] text-[#78716c]'
                    }`}
                  >
                    {opt.label} ({opt.point > 0 ? `+${opt.point}` : opt.point})
                  </button>
                ))}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-bold text-[#78716c] block mb-1">พฤติกรรม / เรื่องที่บันทึก:</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ช่วยเหลือเพื่อน, ตั้งใจเรียน, ทำเวรสะอาด"
                  value={sheetForm.category}
                  onChange={(e) => setSheetForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 px-3 text-sm font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Points & Follow Up */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#78716c] block mb-1">คะแนนแต้ม:</label>
                  <input
                    type="number"
                    value={sheetForm.points}
                    onChange={(e) => setSheetForm((prev) => ({ ...prev, points: e.target.value }))}
                    className="h-9.5 w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 px-3 text-sm font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#78716c] block mb-1">งานติดตาม:</label>
                  <select
                    value={sheetForm.followUpStatus}
                    onChange={(e) => setSheetForm((prev) => ({ ...prev, followUpStatus: e.target.value as FollowUpStatus }))}
                    className="h-9.5 w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 px-2 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {Object.entries(followUpLabels).map(([val, lbl]) => (
                      <option key={val} value={val}>{lbl}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-[#78716c] block mb-1">รายละเอียดเพิ่มเติม (ไม่บังคับ):</label>
                <textarea
                  rows={2}
                  placeholder="เขียนบันทึกรายละเอียดเพื่อติดตามย้อนหลัง"
                  value={sheetForm.description}
                  onChange={(e) => setSheetForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-xl border border-[#ded5c6] bg-amber-50/30 p-2.5 text-xs font-bold text-[#3f3a36] outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3f3a36] text-white text-sm font-bold shadow-[2px_3px_0_#f59e0b] hover:bg-[#2c2825] active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกพฤติกรรม ✓'}
              </button>
            </form>
          </div>
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs sm:text-sm text-amber-950 font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-amber-800 hover:text-amber-950">
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
