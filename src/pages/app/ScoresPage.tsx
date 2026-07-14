import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Gauge,
  Plus,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { isSupabaseReady, supabase } from '../../lib/supabaseClient';
import { writeAuditLog } from '../../lib/auditLog';
import type { AppSessionContext } from '../../types/core';

interface ScoresPageProps {
  session: AppSessionContext;
}

type AssessmentCategory = 'quiz' | 'assignment' | 'exam' | 'project' | 'reading' | 'other';
type AssessmentStatus = 'draft' | 'published' | 'archived';

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

interface ScoreAssessmentRow {
  assessment_date: string;
  category: AssessmentCategory;
  classroom_id: string;
  created_by: string | null;
  id: string;
  max_score: number;
  status: AssessmentStatus;
  subject_name: string;
  title: string;
  weight: number;
  workspace_id: string;
}

interface ScoreEntryRow {
  assessment_id: string;
  id: string;
  note: string | null;
  score: number | null;
  student_id: string;
}

const demoClassrooms: ClassroomRow[] = [{ academic_year: '2569', id: 'demo-classroom', name: 'ป.5/2' }];

const demoStudents: StudentRow[] = [
  {
    classroom_id: 'demo-classroom',
    first_name: 'ณัฐวุฒิ',
    id: 'demo-student-1',
    last_name: 'ใจดี',
    nickname: 'นัท',
    student_code: '001',
  },
  {
    classroom_id: 'demo-classroom',
    first_name: 'พิมพ์ชนก',
    id: 'demo-student-2',
    last_name: 'แสงทอง',
    nickname: 'พิม',
    student_code: '002',
  },
  {
    classroom_id: 'demo-classroom',
    first_name: 'กิตติพงศ์',
    id: 'demo-student-3',
    last_name: 'สุขใจ',
    nickname: 'ก้อง',
    student_code: '003',
  },
];

const demoAssessments: ScoreAssessmentRow[] = [
  {
    assessment_date: new Date().toISOString().slice(0, 10),
    category: 'quiz',
    classroom_id: 'demo-classroom',
    created_by: 'demo-teacher',
    id: 'demo-assessment-1',
    max_score: 20,
    status: 'draft',
    subject_name: 'คณิตศาสตร์',
    title: 'แบบทดสอบเศษส่วน',
    weight: 10,
    workspace_id: 'demo-workspace',
  },
  {
    assessment_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString().slice(0, 10),
    category: 'assignment',
    classroom_id: 'demo-classroom',
    created_by: 'demo-teacher',
    id: 'demo-assessment-2',
    max_score: 30,
    status: 'published',
    subject_name: 'ภาษาไทย',
    title: 'อ่านจับใจความ',
    weight: 15,
    workspace_id: 'demo-workspace',
  },
];

const demoEntries: ScoreEntryRow[] = [
  { assessment_id: 'demo-assessment-1', id: 'demo-entry-1', note: null, score: 18, student_id: 'demo-student-1' },
  { assessment_id: 'demo-assessment-1', id: 'demo-entry-2', note: 'ต้องทบทวนข้อ 4', score: 12, student_id: 'demo-student-2' },
  { assessment_id: 'demo-assessment-1', id: 'demo-entry-3', note: null, score: 16, student_id: 'demo-student-3' },
  { assessment_id: 'demo-assessment-2', id: 'demo-entry-4', note: null, score: 27, student_id: 'demo-student-1' },
  { assessment_id: 'demo-assessment-2', id: 'demo-entry-5', note: null, score: 24, student_id: 'demo-student-2' },
  { assessment_id: 'demo-assessment-2', id: 'demo-entry-6', note: 'ส่งช้า', score: 21, student_id: 'demo-student-3' },
];

const categoryOptions: Array<{ label: string; value: AssessmentCategory }> = [
  { label: 'แบบทดสอบ', value: 'quiz' },
  { label: 'งาน/ใบงาน', value: 'assignment' },
  { label: 'สอบ', value: 'exam' },
  { label: 'โครงงาน', value: 'project' },
  { label: 'อ่านเขียน', value: 'reading' },
  { label: 'อื่นๆ', value: 'other' },
];

const categoryLabels = Object.fromEntries(categoryOptions.map((option) => [option.value, option.label])) as Record<
  AssessmentCategory,
  string
>;

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsv(value: string | number | null) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseNumericInput(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClassroomWithRoster(
  classrooms: ClassroomRow[],
  students: StudentRow[],
  assessments: ScoreAssessmentRow[] = [],
) {
  const classroomWithStudents = classrooms.find((classroom) =>
    students.some((student) => student.classroom_id === classroom.id),
  );
  const classroomWithAssessment = classrooms.find((classroom) =>
    assessments.some((assessment) => assessment.classroom_id === classroom.id && assessment.status !== 'archived'),
  );

  return classroomWithStudents?.id || classroomWithAssessment?.id || classrooms[0]?.id || '';
}

export function ScoresPage({ session }: ScoresPageProps) {
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>(demoClassrooms);
  const [students, setStudents] = useState<StudentRow[]>(demoStudents);
  const [assessments, setAssessments] = useState<ScoreAssessmentRow[]>(demoAssessments);
  const [entries, setEntries] = useState<ScoreEntryRow[]>(demoEntries);
  const [classroomId, setClassroomId] = useState(demoClassrooms[0].id);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(demoAssessments[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(Boolean(supabase && session.workspace));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    isSupabaseReady ? null : 'โหมดตัวอย่าง: ตั้งค่า .env.local และรัน migration เพื่อบันทึกคะแนนลง Supabase จริง',
  );
  const [form, setForm] = useState({
    assessmentDate: getTodayDate(),
    category: 'quiz' as AssessmentCategory,
    maxScore: '20',
    subjectName: 'คณิตศาสตร์',
    title: '',
    weight: '10',
  });

  const classroomStudents = useMemo(
    () => students.filter((student) => student.classroom_id === classroomId),
    [classroomId, students],
  );

  const classroomAssessments = useMemo(
    () =>
      assessments
        .filter((assessment) => assessment.classroom_id === classroomId && assessment.status !== 'archived')
        .sort((a, b) => b.assessment_date.localeCompare(a.assessment_date)),
    [assessments, classroomId],
  );

  const selectedAssessment = useMemo(
    () => classroomAssessments.find((assessment) => assessment.id === selectedAssessmentId) || classroomAssessments[0] || null,
    [classroomAssessments, selectedAssessmentId],
  );

  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.assessment_id === selectedAssessment?.id),
    [entries, selectedAssessment?.id],
  );

  const selectedEntryByStudent = useMemo(
    () => new Map(selectedEntries.map((entry) => [entry.student_id, entry])),
    [selectedEntries],
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

  const scoreStats = useMemo(() => {
    if (!selectedAssessment) {
      return {
        average: 0,
        belowHalf: 0,
        complete: 0,
        highest: 0,
        percentComplete: 0,
      };
    }

    const filledScores = classroomStudents
      .map((student) => {
        const entry = selectedEntryByStudent.get(student.id);
        const draftValue = scores[student.id];
        if (draftValue !== undefined && draftValue !== '') return Number(draftValue);
        return entry?.score ?? null;
      })
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));

    const total = filledScores.reduce((sum, score) => sum + score, 0);
    const complete = filledScores.length;
    const average = complete > 0 ? total / complete : 0;
    const highest = complete > 0 ? Math.max(...filledScores) : 0;
    const belowHalf = filledScores.filter((score) => score < selectedAssessment.max_score * 0.5).length;

    return {
      average,
      belowHalf,
      complete,
      highest,
      percentComplete: classroomStudents.length > 0 ? Math.round((complete / classroomStudents.length) * 100) : 0,
    };
  }, [classroomStudents, scores, selectedAssessment, selectedEntryByStudent]);

  const subjectSummary = useMemo(() => {
    const subjectMap = new Map<string, { count: number; totalPercent: number }>();

    assessments.forEach((assessment) => {
      const assessmentEntries = entries.filter((entry) => entry.assessment_id === assessment.id && entry.score !== null);
      if (assessmentEntries.length === 0) return;

      const averagePercent =
        assessmentEntries.reduce((sum, entry) => sum + ((entry.score || 0) / assessment.max_score) * 100, 0) /
        assessmentEntries.length;
      const current = subjectMap.get(assessment.subject_name) || { count: 0, totalPercent: 0 };
      subjectMap.set(assessment.subject_name, {
        count: current.count + 1,
        totalPercent: current.totalPercent + averagePercent,
      });
    });

    return Array.from(subjectMap.entries()).map(([subjectName, summary]) => ({
      assessmentCount: summary.count,
      averagePercent: summary.count > 0 ? summary.totalPercent / summary.count : 0,
      subjectName,
    }));
  }, [assessments, entries]);

  useEffect(() => {
    let isMounted = true;

    async function loadBaseData() {
      if (!supabase || !session.workspace) {
        setClassrooms(demoClassrooms);
        setStudents(demoStudents);
        setAssessments(demoAssessments);
        setEntries(demoEntries);
        setClassroomId(demoClassrooms[0].id);
        setSelectedAssessmentId(demoAssessments[0].id);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNotice(null);

      const [
        { data: classroomRows, error: classroomError },
        { data: studentRows, error: studentError },
        { data: assessmentRows, error: assessmentError },
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
          .from('score_assessments')
          .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by')
          .eq('workspace_id', session.workspace.id)
          .order('assessment_date', { ascending: false }),
      ]);

      if (!isMounted) return;

      if (classroomError || studentError || assessmentError) {
        setNotice(classroomError?.message || studentError?.message || assessmentError?.message || 'โหลดข้อมูลคะแนนไม่สำเร็จ');
        setIsLoading(false);
        return;
      }

      const nextClassrooms = (classroomRows || []) as ClassroomRow[];
      const nextStudents = (studentRows || []) as StudentRow[];
      const nextAssessments = (assessmentRows || []) as ScoreAssessmentRow[];
      const nextAssessmentIds = nextAssessments.map((assessment) => assessment.id);
      const nextClassroomId = getClassroomWithRoster(nextClassrooms, nextStudents, nextAssessments);
      const nextSelectedAssessmentId =
        nextAssessments.find((assessment) => assessment.classroom_id === nextClassroomId && assessment.status !== 'archived')?.id ||
        nextAssessments.find((assessment) => assessment.status !== 'archived')?.id ||
        '';

      let nextEntries: ScoreEntryRow[] = [];
      if (nextAssessmentIds.length > 0) {
        const { data: entryRows, error: entryError } = await supabase
          .from('score_entries')
          .select('id,assessment_id,student_id,score,note')
          .in('assessment_id', nextAssessmentIds);

        if (!isMounted) return;

        if (entryError) {
          setNotice(entryError.message);
          setIsLoading(false);
          return;
        }

        nextEntries = (entryRows || []) as ScoreEntryRow[];
      }

      setClassrooms(nextClassrooms);
      setStudents(nextStudents);
      setAssessments(nextAssessments);
      setEntries(nextEntries);
      setClassroomId(nextClassroomId);
      setSelectedAssessmentId(nextSelectedAssessmentId);
      setIsLoading(false);
    }

    void loadBaseData();

    return () => {
      isMounted = false;
    };
  }, [session.profile.id, session.workspace]);

  useEffect(() => {
    if (!selectedAssessment && classroomAssessments[0]) {
      setSelectedAssessmentId(classroomAssessments[0].id);
    }
  }, [classroomAssessments, selectedAssessment]);

  useEffect(() => {
    if (!selectedAssessment) {
      setScores({});
      setNotes({});
      return;
    }

    setScores(
      Object.fromEntries(
        selectedEntries.map((entry) => [entry.student_id, entry.score === null ? '' : String(entry.score)]),
      ),
    );
    setNotes(Object.fromEntries(selectedEntries.map((entry) => [entry.student_id, entry.note || ''])));
  }, [selectedAssessment, selectedEntries]);

  async function handleCreateAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    const title = form.title.trim();
    const subjectName = form.subjectName.trim();
    const maxScore = parseNumericInput(form.maxScore, 20);
    const weight = parseNumericInput(form.weight, 10);

    if (!classroomId) {
      setNotice('กรุณาเลือกห้องเรียนก่อนสร้างชุดคะแนน');
      setIsSubmitting(false);
      return;
    }

    if (!title || !subjectName) {
      setNotice('กรุณากรอกชื่อชุดคะแนนและวิชา');
      setIsSubmitting(false);
      return;
    }

    if (!supabase || !session.workspace) {
      const assessment: ScoreAssessmentRow = {
        assessment_date: form.assessmentDate,
        category: form.category,
        classroom_id: classroomId,
        created_by: session.profile.id,
        id: `demo-assessment-${Date.now()}`,
        max_score: maxScore,
        status: 'draft',
        subject_name: subjectName,
        title,
        weight,
        workspace_id: session.workspace?.id || 'demo-workspace',
      };

      setAssessments((current) => [assessment, ...current]);
      setSelectedAssessmentId(assessment.id);
      setForm((current) => ({ ...current, title: '' }));
      setNotice('สร้างชุดคะแนนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('score_assessments')
      .insert({
        assessment_date: form.assessmentDate,
        category: form.category,
        classroom_id: classroomId,
        created_by: session.profile.id,
        max_score: maxScore,
        status: 'draft',
        subject_name: subjectName,
        title,
        weight,
        workspace_id: session.workspace.id,
      })
      .select('id,workspace_id,classroom_id,title,subject_name,category,max_score,weight,assessment_date,status,created_by')
      .single();

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const assessment = data as ScoreAssessmentRow;
    await writeAuditLog(session, {
      action: 'score_assessment.created',
      entityId: assessment.id,
      entityTable: 'score_assessments',
      metadata: {
        category: assessment.category,
        classroom_id: assessment.classroom_id,
        max_score: assessment.max_score,
        status: assessment.status,
        subject_name: assessment.subject_name,
      },
      riskLevel: 'low',
      source: 'score_center',
    });
    setAssessments((current) => [assessment, ...current]);
    setSelectedAssessmentId(assessment.id);
    setForm((current) => ({ ...current, title: '' }));
    setNotice('สร้างชุดคะแนนแล้ว');
    setIsSubmitting(false);
  }

  async function handleSaveScores() {
    if (!selectedAssessment) return;

    setIsSubmitting(true);
    setNotice(null);

    const payload = classroomStudents
      .map((student) => {
        const rawScore = scores[student.id];
        const trimmedNote = (notes[student.id] || '').trim();
        const score = rawScore === undefined || rawScore === '' ? null : Number(rawScore);

        if (score !== null && (!Number.isFinite(score) || score < 0 || score > selectedAssessment.max_score)) {
          return null;
        }

        return {
          assessment_id: selectedAssessment.id,
          note: trimmedNote || null,
          score,
          student_id: student.id,
          workspace_id: selectedAssessment.workspace_id,
        };
      })
      .filter((row): row is Exclude<typeof row, null> => row !== null);

    if (payload.length !== classroomStudents.length) {
      setNotice(`คะแนนต้องอยู่ระหว่าง 0 ถึง ${selectedAssessment.max_score}`);
      setIsSubmitting(false);
      return;
    }

    if (!supabase) {
      const nextEntries = payload.map((row) => {
        const existing = selectedEntryByStudent.get(row.student_id);
        return {
          assessment_id: row.assessment_id,
          id: existing?.id || `demo-score-entry-${Date.now()}-${row.student_id}`,
          note: row.note,
          score: row.score,
          student_id: row.student_id,
        };
      });

      setEntries((current) => [
        ...current.filter((entry) => entry.assessment_id !== selectedAssessment.id),
        ...nextEntries,
      ]);
      setNotice('บันทึกคะแนนในโหมดตัวอย่างแล้ว');
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('score_entries')
      .upsert(payload, { onConflict: 'assessment_id,student_id' })
      .select('id,assessment_id,student_id,score,note');

    if (error) {
      setNotice(error.message);
      setIsSubmitting(false);
      return;
    }

    const savedEntries = (data || []) as ScoreEntryRow[];
    await writeAuditLog(session, {
      action: 'score_entries.saved',
      entityId: selectedAssessment.id,
      entityTable: 'score_assessments',
      metadata: {
        assessment_id: selectedAssessment.id,
        average: Math.round(scoreStats.average * 100) / 100,
        below_half: scoreStats.belowHalf,
        classroom_id: selectedAssessment.classroom_id,
        complete: scoreStats.complete,
        percent_complete: scoreStats.percentComplete,
        subject_name: selectedAssessment.subject_name,
      },
      riskLevel: scoreStats.belowHalf > 0 ? 'normal' : 'low',
      source: 'score_center',
    });
    setEntries((current) => [
      ...current.filter((entry) => entry.assessment_id !== selectedAssessment.id),
      ...savedEntries,
    ]);
    setNotice('บันทึกคะแนนแล้ว');
    setIsSubmitting(false);
  }

  async function handlePublishAssessment() {
    if (!selectedAssessment) return;
    const nextStatus: AssessmentStatus = selectedAssessment.status === 'published' ? 'draft' : 'published';

    if (!supabase) {
      setAssessments((current) =>
        current.map((assessment) =>
          assessment.id === selectedAssessment.id ? { ...assessment, status: nextStatus } : assessment,
        ),
      );
      return;
    }

    const { error } = await supabase
      .from('score_assessments')
      .update({ status: nextStatus })
      .eq('id', selectedAssessment.id)
      .eq('workspace_id', selectedAssessment.workspace_id);

    if (error) {
      setNotice(error.message);
      return;
    }

    await writeAuditLog(session, {
      action: 'score_assessment.status_changed',
      entityId: selectedAssessment.id,
      entityTable: 'score_assessments',
      metadata: {
        classroom_id: selectedAssessment.classroom_id,
        from_status: selectedAssessment.status,
        subject_name: selectedAssessment.subject_name,
        to_status: nextStatus,
      },
      riskLevel: 'low',
      source: 'score_center',
    });
    setAssessments((current) =>
      current.map((assessment) =>
        assessment.id === selectedAssessment.id ? { ...assessment, status: nextStatus } : assessment,
      ),
    );
  }

  function exportAssessmentCsv() {
    if (!selectedAssessment) return;

    const rows = classroomStudents.map((student) => {
      const entry = selectedEntryByStudent.get(student.id);
      const score = scores[student.id] === undefined || scores[student.id] === '' ? entry?.score ?? null : Number(scores[student.id]);
      const percent = score === null ? '' : Math.round((score / selectedAssessment.max_score) * 10000) / 100;

      return [
        student.student_code || '',
        student.first_name,
        student.last_name,
        student.nickname || '',
        selectedAssessment.subject_name,
        selectedAssessment.title,
        score,
        selectedAssessment.max_score,
        percent,
        notes[student.id] || entry?.note || '',
      ];
    });

    const headers = [
      'student_code',
      'first_name',
      'last_name',
      'nickname',
      'subject_name',
      'assessment_title',
      'score',
      'max_score',
      'percent',
      'note',
    ];
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsv(value)).join(',')).join('\n');
    downloadTextFile(`classcare-score-${selectedAssessment.assessment_date}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
  }

  return (
    <main className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="nexus-kicker">
            <Award size={16} aria-hidden="true" />
            Score Center
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            ศูนย์คะแนนรายวิชา เห็นทั้งห้องและรายคนในหน้าจอเดียว
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
            สร้างชุดคะแนน บันทึกคะแนนรายนักเรียน ดูค่าเฉลี่ย ความครบถ้วน และ export CSV สำหรับส่งต่อรายงาน
            โดยทุกข้อมูลผูกกับ workspace และ RLS ฝั่ง Supabase
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[520px] sm:grid-cols-4">
          {[
            { label: 'ชุดคะแนน', value: classroomAssessments.length },
            { label: 'กรอกแล้ว', value: `${scoreStats.percentComplete}%` },
            { label: 'เฉลี่ย', value: scoreStats.average.toFixed(1) },
            { label: 'ต่ำกว่า 50%', value: scoreStats.belowHalf },
          ].map((item) => (
            <div className="nexus-card p-3 text-center" key={item.label}>
              <p className="text-2xl font-black text-slate-950">{item.value}</p>
              <p className="mt-1 text-xs font-black text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-3 lg:grid-cols-3" aria-label="ลำดับการกรอกคะแนน">
        {[
          {
            label: '1. เลือกห้อง',
            text: classrooms.find((classroom) => classroom.id === classroomId)?.name || 'ยังไม่มีห้องเรียน',
          },
          {
            label: '2. เลือก/สร้างชุดคะแนน',
            text: selectedAssessment ? selectedAssessment.title : 'สร้างชุดคะแนนก่อนกรอก',
          },
          {
            label: '3. กรอกและบันทึก',
            text: classroomStudents.length > 0 ? `${classroomStudents.length} คนในห้องนี้` : 'ยังไม่มีรายชื่อนักเรียน',
          },
        ].map((step) => (
          <div className="rounded-3xl border border-amber-200/80 bg-white/80 p-4 shadow-sm" key={step.label}>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">{step.label}</p>
            <p className="mt-2 truncate text-sm font-black text-slate-950">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="grid gap-5">
          <form className="nexus-card p-4 sm:p-5" onSubmit={(event) => void handleCreateAssessment(event)}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <Plus size={16} aria-hidden="true" />
              1. สร้างชุดคะแนน
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ห้องเรียน</span>
                <select
                  className="nexus-field mt-2"
                  onChange={(event) => setClassroomId(event.target.value)}
                  value={classroomId}
                >
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">วิชา</span>
                <input
                  className="nexus-field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, subjectName: event.target.value }))}
                  value={form.subjectName}
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase text-slate-500">ชื่อชุดคะแนน</span>
                <input
                  className="nexus-field mt-2"
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="เช่น แบบทดสอบบทที่ 3"
                  value={form.title}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">วันที่</span>
                  <input
                    className="nexus-field mt-2"
                    onChange={(event) => setForm((current) => ({ ...current, assessmentDate: event.target.value }))}
                    type="date"
                    value={form.assessmentDate}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">ประเภท</span>
                  <select
                    className="nexus-field mt-2"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value as AssessmentCategory }))
                    }
                    value={form.category}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">คะแนนเต็ม</span>
                  <input
                    className="nexus-field mt-2"
                    min="1"
                    onChange={(event) => setForm((current) => ({ ...current, maxScore: event.target.value }))}
                    type="number"
                    value={form.maxScore}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500">น้ำหนัก</span>
                  <input
                    className="nexus-field mt-2"
                    min="1"
                    onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))}
                    type="number"
                    value={form.weight}
                  />
                </label>
              </div>
            </div>

            <button
              className="blue-action mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isSubmitting || isLoading}
              type="submit"
            >
              <Plus size={17} aria-hidden="true" />
              สร้างชุดคะแนน
            </button>
          </form>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-teal-700">
              <FileSpreadsheet size={16} aria-hidden="true" />
              2. ชุดคะแนนในห้องนี้
            </div>
            <div className="mt-4 grid gap-2">
              {classroomAssessments.map((assessment) => (
                <button
                  className={`rounded-3xl p-3 text-left transition ${
                    assessment.id === selectedAssessment?.id
                      ? 'bg-slate-950 text-white shadow-[0_18px_36px_rgba(15,23,42,0.22)]'
                      : 'bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white'
                  }`}
                  key={assessment.id}
                  onClick={() => setSelectedAssessmentId(assessment.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{assessment.title}</p>
                      <p className={`mt-1 text-xs font-bold ${assessment.id === selectedAssessment?.id ? 'text-cyan-100' : 'text-slate-500'}`}>
                        {assessment.subject_name} | {categoryLabels[assessment.category]} | {assessment.max_score} คะแนน
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                        assessment.status === 'published'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-white/20 text-current ring-1 ring-current/15'
                      }`}
                    >
                      {assessment.status}
                    </span>
                  </div>
                </button>
              ))}

              {classroomAssessments.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีชุดคะแนนของห้องนี้
                </div>
              ) : null}
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <BarChart3 size={16} aria-hidden="true" />
              สรุปรายวิชา
            </div>
            <div className="mt-4 grid gap-3">
              {subjectSummary.map((subject) => (
                <div className="nexus-muted-box p-3" key={subject.subjectName}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{subject.subjectName}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{subject.assessmentCount} ชุดคะแนน</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">
                      {subject.averagePercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}

              {subjectSummary.length === 0 ? (
                <div className="nexus-muted-box p-4 text-sm font-bold text-slate-600">
                  ยังไม่มีคะแนนสำหรับสรุปรายวิชา
                </div>
              ) : null}
            </div>
          </div>

          <div className="nexus-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-black text-cyan-700">
              <ShieldCheck size={16} aria-hidden="true" />
              Privacy Guard
            </div>
            <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
              คะแนนเป็นข้อมูลรายบุคคล จึงอ่าน/เขียนผ่าน workspace role เท่านั้น และ export จะสร้างใน browser
              โดยไม่ส่ง secret หรือ token ออกจาก frontend
            </p>
          </div>
        </aside>

        <section className="grid gap-5">
          <div className="nexus-card p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-black text-cyan-700">3. Scorebook</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedAssessment ? selectedAssessment.title : 'ยังไม่ได้เลือกชุดคะแนน'}
                </h2>
                {selectedAssessment ? (
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {selectedAssessment.subject_name} | {categoryLabels[selectedAssessment.category]} | เต็ม{' '}
                    {selectedAssessment.max_score} | น้ำหนัก {selectedAssessment.weight}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="dark-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!selectedAssessment || isSubmitting}
                  onClick={() => void handlePublishAssessment()}
                  type="button"
                >
                  <CheckCircle2 size={17} aria-hidden="true" />
                  {selectedAssessment?.status === 'published' ? 'กลับเป็น draft' : 'เผยแพร่'}
                </button>
                <button
                  className="amber-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!selectedAssessment}
                  onClick={exportAssessmentCsv}
                  type="button"
                >
                  <Download size={17} aria-hidden="true" />
                  Export CSV
                </button>
                <button
                  className="blue-action inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!selectedAssessment || isSubmitting}
                  onClick={() => void handleSaveScores()}
                  type="button"
                >
                  <Save size={17} aria-hidden="true" />
                  บันทึกคะแนน
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-4">
              {[
                { icon: Gauge, label: 'กรอกครบ', value: `${scoreStats.complete}/${classroomStudents.length}` },
                { icon: BarChart3, label: 'ค่าเฉลี่ย', value: scoreStats.average.toFixed(2) },
                { icon: Award, label: 'สูงสุด', value: scoreStats.highest.toFixed(2) },
                { icon: AlertTriangle, label: 'ต้องติดตาม', value: scoreStats.belowHalf },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div className="nexus-muted-box flex items-center gap-3 p-3" key={item.label}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xl font-black text-slate-950">{item.value}</p>
                      <p className="text-xs font-black text-slate-500">{item.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="mt-5 flex min-h-11 items-center gap-2 rounded-2xl bg-white/80 px-3 ring-1 ring-slate-200">
              <Search className="shrink-0 text-slate-400" size={17} aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-700 outline-none"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="ค้นหาชื่อ รหัส หรือชื่อเล่น"
                value={searchTerm}
              />
            </label>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-slate-500">
                    <th className="px-3 py-3">รหัส</th>
                    <th className="px-3 py-3">นักเรียน</th>
                    <th className="px-3 py-3">คะแนน</th>
                    <th className="px-3 py-3">ร้อยละ</th>
                    <th className="px-3 py-3">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudents.map((student) => {
                    const entry = selectedEntryByStudent.get(student.id);
                    const scoreValue = scores[student.id] ?? (entry?.score === null || entry?.score === undefined ? '' : String(entry.score));
                    const scoreNumber = scoreValue === '' ? null : Number(scoreValue);
                    const percent =
                      selectedAssessment && scoreNumber !== null && Number.isFinite(scoreNumber)
                        ? Math.round((scoreNumber / selectedAssessment.max_score) * 10000) / 100
                        : null;

                    return (
                      <tr className="hover:bg-slate-50" key={student.id}>
                        <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-600">{student.student_code || '-'}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-950">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs font-bold text-slate-500">{student.nickname || 'ไม่มีชื่อเล่น'}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <input
                            className="h-10 w-24 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                            disabled={!selectedAssessment}
                            max={selectedAssessment?.max_score || undefined}
                            min="0"
                            onChange={(event) =>
                              setScores((current) => ({ ...current, [student.id]: event.target.value }))
                            }
                            type="number"
                            value={scoreValue}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                              percent === null
                                ? 'bg-slate-50 text-slate-500 ring-slate-100'
                                : percent < 50
                                  ? 'bg-rose-50 text-rose-700 ring-rose-100'
                                  : percent < 70
                                    ? 'bg-amber-50 text-amber-700 ring-amber-100'
                                    : 'bg-cyan-50 text-cyan-700 ring-cyan-100'
                            }`}
                          >
                            {percent === null ? '-' : `${percent}%`}
                          </span>
                        </td>
                        <td className="min-w-[220px] px-3 py-3">
                          <input
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                            disabled={!selectedAssessment}
                            onChange={(event) =>
                              setNotes((current) => ({ ...current, [student.id]: event.target.value }))
                            }
                            placeholder="เช่น ต้องทบทวน / ส่งช้า"
                            value={notes[student.id] ?? entry?.note ?? ''}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-bold leading-6 text-amber-900">
                {classroomStudents.length === 0
                  ? 'ห้องนี้ยังไม่มีรายชื่อนักเรียน ให้เพิ่มหรือนำเข้ารายชื่อก่อนจึงจะกรอกคะแนนได้'
                  : 'ไม่พบนักเรียนตามคำค้นนี้'}
                {classroomStudents.length === 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:-translate-y-0.5"
                      to="/app/dashboard?view=students"
                    >
                      เพิ่มนักเรียน
                    </Link>
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-xs font-black text-amber-900 ring-1 ring-amber-200 transition hover:-translate-y-0.5"
                      to="/app/dashboard?view=import-export"
                    >
                      นำเข้ารายชื่อ
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
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
